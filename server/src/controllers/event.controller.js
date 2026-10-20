const pool = require('../config/db');

const eventController = {
  /**
   * Create community event
   * Admin or Super Admin
   */
  async create(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: creatorId } = req.user;
      const {
        title,
        description,
        event_date,
        end_date,
        location,
        association_id
      } = req.body;

      if (!title || !event_date) {
        return res.status(400).json({
          success: false,
          message: 'Event title and date are required'
        });
      }

      let targetAssocIds = [];
      if (role === 'super_admin') {
        if (!association_id || association_id === 'all') {
          const assocs = await pool.query('SELECT id FROM associations WHERE is_active = true');
          targetAssocIds = assocs.rows.map((a) => a.id);
          if (targetAssocIds.length === 0) {
            const anyAssoc = await pool.query('SELECT id FROM associations LIMIT 1');
            if (anyAssoc.rows.length > 0) targetAssocIds = [anyAssoc.rows[0].id];
          }
        } else {
          targetAssocIds = [parseInt(association_id, 10)];
        }
      } else {
        if (!userAssocId) {
          return res.status(400).json({
            success: false,
            message: 'User must belong to an association to create an event'
          });
        }
        targetAssocIds = [userAssocId];
      }

      if (targetAssocIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required to create an event'
        });
      }

      const insertQuery = `
        INSERT INTO events (association_id, title, description, event_date, end_date, location, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      let firstCreated = null;
      for (const tId of targetAssocIds) {
        const values = [
          tId,
          title.trim(),
          description ? description.trim() : null,
          new Date(event_date),
          end_date ? new Date(end_date) : null,
          location ? location.trim() : null,
          creatorId
        ];

        const result = await pool.query(insertQuery, values);
        if (!firstCreated) firstCreated = result.rows[0];

        // Notify association members
        try {
          const members = await pool.query(
            "SELECT id FROM users WHERE association_id = $1 AND status = 'approved'",
            [tId]
          );
          for (const m of members.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, type, link)
               VALUES ($1, $2, $3, 'info', '/member/events')`,
              [
                m.id,
                `New Event: ${title.trim()}`,
                `An upcoming event has been scheduled for ${new Date(event_date).toLocaleDateString()} at ${location || 'Layout Association'}.`
              ]
            );
          }
        } catch (err) {
          console.error('Failed to notify members of new event:', err.message);
        }
      }

      res.status(201).json({
        success: true,
        message: targetAssocIds.length > 1
          ? `Event broadcasted to all ${targetAssocIds.length} associations successfully`
          : 'Event created successfully',
        data: firstCreated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List events for association
   */
  async list(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        from,
        to,
        upcoming,
        search,
        association_id: queryAssocId,
        page = 1,
        limit = 500
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const params = [];

      if (role === 'super_admin') {
        if (queryAssocId) {
          params.push(queryAssocId);
          conditions.push(`e.association_id = $${params.length}`);
        }
      } else {
        params.push(userAssocId);
        conditions.push(`e.association_id = $${params.length}`);
      }

      if (upcoming === 'true') {
        conditions.push('e.event_date >= NOW()');
      }

      if (from) {
        params.push(new Date(from));
        conditions.push(`e.event_date >= $${params.length}`);
      }

      if (to) {
        params.push(new Date(to));
        conditions.push(`e.event_date <= $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        const searchIdx = params.length;
        conditions.push(`(e.title ILIKE $${searchIdx} OR e.location ILIKE $${searchIdx})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countRes = await pool.query(`SELECT COUNT(*) FROM events e ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      // Data
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const query = `
        SELECT e.*, u.name as creator_name, a.name as association_name
        FROM events e
        JOIN users u ON e.created_by = u.id
        LEFT JOIN associations a ON e.association_id = a.id
        ${whereClause}
        ORDER BY e.event_date ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const result = await pool.query(query, params);

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
   * Get single event by ID
   */
  async getById(req, res, next) {
    try {
      const eventId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const query = `
        SELECT e.*, u.name as creator_name, a.name as association_name
        FROM events e
        JOIN users u ON e.created_by = u.id
        LEFT JOIN associations a ON e.association_id = a.id
        WHERE e.id = $1
      `;
      const result = await pool.query(query, [eventId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const event = result.rows[0];

      if (role !== 'super_admin' && event.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update event
   */
  async update(req, res, next) {
    try {
      const eventId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { title, description, event_date, end_date, location } = req.body;

      const check = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const existing = check.rows[0];

      if (role !== 'super_admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateQuery = `
        UPDATE events
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            event_date = COALESCE($3, event_date),
            end_date = COALESCE($4, end_date),
            location = COALESCE($5, location)
        WHERE id = $6
        RETURNING *
      `;

      const values = [
        title ? title.trim() : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        event_date ? new Date(event_date) : null,
        end_date ? new Date(end_date) : null,
        location ? location.trim() : null,
        eventId
      ];

      const result = await pool.query(updateQuery, values);

      res.json({
        success: true,
        message: 'Event updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete event
   */
  async remove(req, res, next) {
    try {
      const eventId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const existing = check.rows[0];

      if (role !== 'super_admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      await pool.query('DELETE FROM events WHERE id = $1', [eventId]);

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = eventController;
