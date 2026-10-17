const pool = require('../config/db');

const auditController = {
  /**
   * List audit log entries
   * Super Admin sees all logs
   * Admin sees logs for users within their association
   */
  async list(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        action,
        entity_type,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 25
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const params = [];

      if (role !== 'super_admin') {
        params.push(userAssocId);
        conditions.push(`u.association_id = $${params.length}`);
      }

      if (action) {
        params.push(action);
        conditions.push(`al.action = $${params.length}`);
      }

      if (entity_type) {
        params.push(entity_type);
        conditions.push(`al.entity_type = $${params.length}`);
      }

      if (startDate) {
        params.push(new Date(startDate));
        conditions.push(`al.created_at >= $${params.length}`);
      }

      if (endDate) {
        params.push(new Date(endDate));
        conditions.push(`al.created_at <= $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        const searchIdx = params.length;
        conditions.push(`(al.action ILIKE $${searchIdx} OR u.name ILIKE $${searchIdx} OR al.ip_address ILIKE $${searchIdx})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `
        SELECT COUNT(*)
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
      `;
      const countRes = await pool.query(countQuery, params);
      const total = parseInt(countRes.rows[0].count, 10);

      // Data query
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const dataQuery = `
        SELECT al.*,
               u.name as user_name, u.email as user_email, u.role as user_role,
               u.member_code as user_member_code,
               a.name as association_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN associations a ON u.association_id = a.id
        ${whereClause}
        ORDER BY al.created_at DESC
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
   * Delete single audit log entry
   * Super Admin only
   */
  async deleteEntry(req, res, next) {
    try {
      const entryId = parseInt(req.params.id, 10);
      await pool.query('DELETE FROM audit_log WHERE id = $1', [entryId]);
      res.json({
        success: true,
        message: 'Audit log entry deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Clear all audit logs
   * Super Admin only
   */
  async clearAll(req, res, next) {
    try {
      await pool.query('DELETE FROM audit_log');
      res.json({
        success: true,
        message: 'All audit logs cleared successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = auditController;
