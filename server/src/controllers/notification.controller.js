const pool = require('../config/db');

const notificationController = {
  /**
   * List user's notifications
   */
  async list(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, is_read } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = ['user_id = $1'];
      const params = [userId];

      if (is_read !== undefined) {
        params.push(is_read === 'true');
        conditions.push(`is_read = $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Count total
      const countRes = await pool.query(`SELECT COUNT(*) FROM notifications ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      // Data query
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const dataQuery = `
        SELECT *
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
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
   * Mark a single notification as read
   */
  async markRead(req, res, next) {
    try {
      const notifId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const result = await pool.query(
        `UPDATE notifications
         SET is_read = true
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notifId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllRead(req, res, next) {
    try {
      const userId = req.user.id;

      await pool.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      res.json({
        success: true,
        data: {
          unread_count: parseInt(result.rows[0].count, 10)
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificationController;
