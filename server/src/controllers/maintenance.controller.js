const pool = require('../config/db');

const maintenanceController = {
  /**
   * Create maintenance fee record
   * Admin can create for a single member or bulk generate for all association members
   */
  async create(req, res, next) {
    const client = await pool.connect();
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        amount,
        period,
        due_date,
        user_id,
        all_members = false,
        association_id
      } = req.body;

      if (!amount || !period || !due_date) {
        return res.status(400).json({
          success: false,
          message: 'Amount, period, and due date are required'
        });
      }

      const targetAssocId = role === 'super_admin'
        ? (association_id || userAssocId)
        : userAssocId;

      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required'
        });
      }

      await client.query('BEGIN');

      const parsedAmount = parseFloat(amount);
      const insertedRecords = [];

      if (all_members === true || all_members === 'true') {
        // Fetch all approved members in this association
        const membersRes = await client.query(
          "SELECT id, name, email FROM users WHERE association_id = $1 AND role = 'member' AND status = 'approved'",
          [targetAssocId]
        );

        for (const member of membersRes.rows) {
          const insertQuery = `
            INSERT INTO maintenance_fees (association_id, user_id, amount, period, due_date, status)
            VALUES ($1, $2, $3, $4, $5, 'due')
            RETURNING *
          `;
          const resInsert = await client.query(insertQuery, [
            targetAssocId,
            member.id,
            parsedAmount,
            period.trim(),
            new Date(due_date)
          ]);
          insertedRecords.push(resInsert.rows[0]);

          // Notification for each member
          await client.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              member.id,
              'Maintenance Due Notice',
              `Maintenance fee of ₹${parsedAmount} for period "${period.trim()}" is due on ${new Date(due_date).toLocaleDateString()}.`,
              'info',
              '/member/maintenance'
            ]
          );
        }
      } else {
        if (!user_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'User ID is required for individual fee generation'
          });
        }

        const insertQuery = `
          INSERT INTO maintenance_fees (association_id, user_id, amount, period, due_date, status)
          VALUES ($1, $2, $3, $4, $5, 'due')
          RETURNING *
        `;
        const resInsert = await client.query(insertQuery, [
          targetAssocId,
          parseInt(user_id, 10),
          parsedAmount,
          period.trim(),
          new Date(due_date)
        ]);
        insertedRecords.push(resInsert.rows[0]);

        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user_id,
            'Maintenance Due Notice',
            `Maintenance fee of ₹${parsedAmount} for period "${period.trim()}" is due on ${new Date(due_date).toLocaleDateString()}.`,
            'info',
            '/member/maintenance'
          ]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: `Maintenance fee record(s) created successfully (${insertedRecords.length} member(s))`,
        data: insertedRecords
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  },

  /**
   * List maintenance fees
   * Member: own fees
   * Admin: own association
   */
  async list(req, res, next) {
    try {
      const { id: userId, role, association_id: userAssocId } = req.user;
      const {
        status,
        period,
        search,
        association_id: queryAssocId,
        page = 1,
        limit = 20
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      // Update overdue records in DB dynamically
      await pool.query(
        "UPDATE maintenance_fees SET status = 'overdue' WHERE due_date < CURRENT_DATE AND status = 'due'"
      );

      const conditions = [];
      const params = [];

      if (role === 'member') {
        params.push(userId);
        conditions.push(`m.user_id = $${params.length}`);
      } else if (role === 'admin') {
        params.push(userAssocId);
        conditions.push(`m.association_id = $${params.length}`);
      } else if (role === 'super_admin' && queryAssocId) {
        params.push(queryAssocId);
        conditions.push(`m.association_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`m.status = $${params.length}`);
      }

      if (period) {
        params.push(`%${period.trim()}%`);
        conditions.push(`m.period ILIKE $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        const searchIdx = params.length;
        conditions.push(`(u.name ILIKE $${searchIdx} OR u.door_no ILIKE $${searchIdx} OR m.payment_reference ILIKE $${searchIdx})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM maintenance_fees m JOIN users u ON m.user_id = u.id ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0].count, 10);

      // Data
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const dataQuery = `
        SELECT m.*,
               u.name as user_name, u.phone as user_phone, u.door_no as user_door_no,
               u.member_code as user_member_code,
               a.name as association_name
        FROM maintenance_fees m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN associations a ON m.association_id = a.id
        ${whereClause}
        ORDER BY m.due_date DESC, m.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const result = await pool.query(dataQuery, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update fee (Mark paid)
   */
  async update(req, res, next) {
    try {
      const feeId = parseInt(req.params.id, 10);
      const { id: userId, role, association_id: userAssocId } = req.user;
      const { paid_date, payment_reference, status = 'paid' } = req.body;

      const check = await pool.query('SELECT * FROM maintenance_fees WHERE id = $1', [feeId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance record not found'
        });
      }

      const fee = check.rows[0];

      if (role === 'member' && fee.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      if (role === 'admin' && fee.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized across associations'
        });
      }

      const effectivePaidDate = paid_date ? new Date(paid_date) : new Date();

      const updateQuery = `
        UPDATE maintenance_fees
        SET paid_date = $1,
            payment_reference = COALESCE($2, payment_reference),
            status = $3
        WHERE id = $4
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [
        effectivePaidDate,
        payment_reference ? payment_reference.trim() : null,
        status,
        feeId
      ]);

      const updated = result.rows[0];

      // If marked paid, notify user
      if (status === 'paid' && role !== 'member') {
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, 'success', '/member/maintenance')`,
            [
              fee.user_id,
              'Payment Confirmed',
              `Your payment of ₹${fee.amount} for "${fee.period}" has been marked as PAID (Ref: ${payment_reference || 'N/A'}).`
            ]
          );
        } catch (err) {
          console.error('Failed to notify member of paid fee:', err.message);
        }
      }

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get maintenance financial summary
   */
  async getSummary(req, res, next) {
    try {
      const { id: userId, role, association_id: userAssocId } = req.user;
      const targetAssocId = role === 'super_admin'
        ? (req.query.association_id || null)
        : userAssocId;

      let whereClause = '';
      const params = [];

      if (role === 'member') {
        params.push(userId);
        whereClause = 'WHERE user_id = $1';
      } else if (targetAssocId) {
        params.push(targetAssocId);
        whereClause = 'WHERE association_id = $1';
      }

      const summaryQuery = `
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_collected,
          COALESCE(SUM(amount) FILTER (WHERE status = 'due'), 0) as total_due,
          COALESCE(SUM(amount) FILTER (WHERE status = 'overdue' OR (status = 'due' AND due_date < CURRENT_DATE)), 0) as total_overdue,
          COUNT(*) FILTER (WHERE status = 'paid') as count_paid,
          COUNT(*) FILTER (WHERE status = 'due') as count_due,
          COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'due' AND due_date < CURRENT_DATE)) as count_overdue,
          COUNT(*) as total_records
        FROM maintenance_fees
        ${whereClause}
      `;

      const summaryRes = await pool.query(summaryQuery, params);

      // Period breakdown
      const periodQuery = `
        SELECT period,
               SUM(amount) as total_amount,
               SUM(amount) FILTER (WHERE status = 'paid') as collected,
               COUNT(*) as total_count
        FROM maintenance_fees
        ${whereClause}
        GROUP BY period
        ORDER BY MAX(due_date) DESC
        LIMIT 6
      `;

      const periodRes = await pool.query(periodQuery, params);

      res.json({
        success: true,
        data: {
          metrics: summaryRes.rows[0],
          by_period: periodRes.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = maintenanceController;
