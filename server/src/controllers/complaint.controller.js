const pool = require('../config/db');

const complaintController = {
  /**
   * Create a new complaint
   * Member or Admin
   */
  async create(req, res, next) {
    try {
      const userId = req.user.id;
      const associationId = req.user.association_id;
      const {
        title,
        description,
        category = 'General',
        priority = 'medium'
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'User must belong to an association to lodge a complaint'
        });
      }

      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const finalPriority = validPriorities.includes(priority) ? priority : 'medium';

      let attachment = null;
      if (req.file) {
        const norm = req.file.path.replace(/\\/g, '/');
        const uploadIdx = norm.indexOf('/uploads/');
        attachment = uploadIdx !== -1 ? norm.substring(uploadIdx) : norm;
      }

      const insertQuery = `
        INSERT INTO complaints (
          association_id, user_id, title, description,
          category, status, priority, attachment
        ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
        RETURNING *
      `;

      const values = [
        associationId,
        userId,
        title.trim(),
        description ? description.trim() : null,
        category ? category.trim() : 'General',
        finalPriority,
        attachment
      ];

      const result = await pool.query(insertQuery, values);
      const complaint = result.rows[0];

      // Notify association admins
      try {
        const admins = await pool.query(
          "SELECT id FROM users WHERE association_id = $1 AND role = 'admin' AND status = 'approved'",
          [associationId]
        );
        for (const admin of admins.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              admin.id,
              'New Complaint Registered',
              `Complaint #${complaint.id}: "${title.trim()}" has been filed by a resident.`,
              'info',
              '/admin/complaints'
            ]
          );
        }
      } catch (err) {
        console.error('Failed to notify admin on complaint:', err.message);
      }

      res.status(201).json({
        success: true,
        message: 'Complaint registered successfully',
        data: complaint
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List complaints
   * Member: own complaints
   * Admin: own association
   * Super Admin: all (or filtered by association_id)
   */
  async list(req, res, next) {
    try {
      const { id: userId, role, association_id: userAssocId } = req.user;
      const {
        status,
        category,
        priority,
        search,
        association_id: queryAssocId,
        page = 1,
        limit = 20
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const params = [];

      if (role === 'member') {
        params.push(userId);
        conditions.push(`c.user_id = $${params.length}`);
      } else if (role === 'admin') {
        params.push(userAssocId);
        conditions.push(`c.association_id = $${params.length}`);
      } else if (role === 'super_admin' && queryAssocId) {
        params.push(queryAssocId);
        conditions.push(`c.association_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }

      if (category) {
        params.push(category);
        conditions.push(`c.category = $${params.length}`);
      }

      if (priority) {
        params.push(priority);
        conditions.push(`c.priority = $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        const searchIdx = params.length;
        conditions.push(`(c.title ILIKE $${searchIdx} OR c.description ILIKE $${searchIdx} OR u.name ILIKE $${searchIdx})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM complaints c JOIN users u ON c.user_id = u.id ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0].count, 10);

      // Data
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const dataQuery = `
        SELECT c.*,
               u.name as user_name, u.phone as user_phone, u.door_no as user_door_no,
               a.name as association_name
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN associations a ON c.association_id = a.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const result = await pool.query(dataQuery, params);

      const rows = result.rows.map((row) => {
        if (row.attachment) {
          const norm = row.attachment.replace(/\\/g, '/');
          const uploadIdx = norm.indexOf('/uploads/');
          row.attachment = uploadIdx !== -1 ? norm.substring(uploadIdx) : norm;
        }
        return row;
      });

      res.json({
        success: true,
        data: rows,
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
   * Get single complaint by ID
   */
  async getById(req, res, next) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { id: userId, role, association_id: userAssocId } = req.user;

      const query = `
        SELECT c.*,
               u.name as user_name, u.phone as user_phone, u.door_no as user_door_no,
               u.email as user_email, a.name as association_name
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN associations a ON c.association_id = a.id
        WHERE c.id = $1
      `;
      const result = await pool.query(query, [complaintId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      const complaint = result.rows[0];

      if (complaint.attachment) {
        const norm = complaint.attachment.replace(/\\/g, '/');
        const uploadIdx = norm.indexOf('/uploads/');
        complaint.attachment = uploadIdx !== -1 ? norm.substring(uploadIdx) : norm;
      }

      // Enforce isolation
      if (role === 'member' && complaint.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to complaint'
        });
      }

      if (role === 'admin' && complaint.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to complaint outside your association'
        });
      }

      res.json({
        success: true,
        data: complaint
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update complaint (Admin updates status/priority; Member can update own if still open)
   */
  async update(req, res, next) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { id: userId, role, association_id: userAssocId } = req.user;
      const { status, priority, title, description, category } = req.body;

      const check = await pool.query('SELECT * FROM complaints WHERE id = $1', [complaintId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      const existing = check.rows[0];

      if (role === 'member') {
        if (existing.user_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized'
          });
        }
        if (existing.status !== 'open') {
          return res.status(400).json({
            success: false,
            message: 'Cannot edit a complaint that is already in progress or resolved'
          });
        }

        const memberUpdate = await pool.query(
          `UPDATE complaints
           SET title = COALESCE($1, title),
               description = COALESCE($2, description),
               category = COALESCE($3, category),
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [title ? title.trim() : null, description ? description.trim() : null, category || null, complaintId]
        );

        return res.json({
          success: true,
          message: 'Complaint updated successfully',
          data: memberUpdate.rows[0]
        });
      }

      // Admin or Super Admin updates status or priority
      if (role !== 'super_admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      const targetStatus = validStatuses.includes(status) ? status : existing.status;
      const isResolving = targetStatus === 'resolved' && existing.status !== 'resolved';

      const updateQuery = `
        UPDATE complaints
        SET status = $1,
            priority = COALESCE($2, priority),
            resolved_at = CASE WHEN $3 = true THEN NOW() ELSE resolved_at END,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [
        targetStatus,
        priority || null,
        isResolving,
        complaintId
      ]);

      const updatedComplaint = result.rows[0];

      // Notify user if status changed
      if (status && status !== existing.status) {
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              existing.user_id,
              'Complaint Status Updated',
              `Your complaint #${complaintId} ("${existing.title}") status changed to: ${targetStatus.replace('_', ' ')}.`,
              targetStatus === 'resolved' ? 'success' : 'info',
              '/member/complaints'
            ]
          );
        } catch (err) {
          console.error('Failed to send status update notification:', err.message);
        }
      }

      res.json({
        success: true,
        message: 'Complaint updated successfully',
        data: updatedComplaint
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete complaint
   */
  async remove(req, res, next) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { id: userId, role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM complaints WHERE id = $1', [complaintId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      const existing = check.rows[0];

      if (role === 'member') {
        if (existing.user_id !== userId || existing.status !== 'open') {
          return res.status(403).json({
            success: false,
            message: 'You can only delete your own open complaints'
          });
        }
      } else if (role === 'admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      await pool.query('DELETE FROM complaints WHERE id = $1', [complaintId]);

      res.json({
        success: true,
        message: 'Complaint deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = complaintController;
