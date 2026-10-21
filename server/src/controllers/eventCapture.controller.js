const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const eventCaptureController = {
  /**
   * Get all event captures (photos & videos)
   */
  async getAll(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        association_id,
        event_id,
        media_type,
        search,
        sort = 'newest',
      } = req.query;

      let targetAssocId = userAssocId;
      if (role === 'super_admin') {
        targetAssocId = association_id && association_id !== 'all' ? parseInt(association_id, 10) : null;
      }

      let whereConditions = [];
      let params = [];
      let pIdx = 1;

      if (targetAssocId) {
        whereConditions.push(`ec.association_id = $${pIdx++}`);
        params.push(targetAssocId);
      }

      if (event_id && event_id !== 'all') {
        whereConditions.push(`ec.event_id = $${pIdx++}`);
        params.push(parseInt(event_id, 10));
      }

      if (media_type && media_type !== 'all') {
        whereConditions.push(`ec.media_type = $${pIdx++}`);
        params.push(media_type);
      }

      if (search && search.trim()) {
        whereConditions.push(`(ec.title ILIKE $${pIdx} OR ec.description ILIKE $${pIdx} OR ec.event_name ILIKE $${pIdx} OR e.title ILIKE $${pIdx})`);
        params.push(`%${search.trim()}%`);
        pIdx++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      let orderBy = 'ORDER BY ec.created_at DESC';
      if (sort === 'oldest') {
        orderBy = 'ORDER BY ec.created_at ASC';
      } else if (sort === 'event_date') {
        orderBy = 'ORDER BY ec.event_date DESC NULLS LAST, ec.created_at DESC';
      } else if (sort === 'popular') {
        orderBy = 'ORDER BY ec.likes_count DESC, ec.created_at DESC';
      }

      const query = `
        SELECT 
          ec.*,
          u.name AS uploader_name,
          u.role AS uploader_role,
          u.profile_photo AS uploader_avatar,
          a.name AS association_name,
          e.title AS event_title,
          e.location AS event_location,
          e.event_date AS formal_event_date
        FROM event_captures ec
        LEFT JOIN users u ON ec.uploaded_by = u.id
        LEFT JOIN associations a ON ec.association_id = a.id
        LEFT JOIN events e ON ec.event_id = e.id
        ${whereClause}
        ${orderBy}
      `;

      const result = await pool.query(query, params);

      // Compute statistics
      let statsQuery = `
        SELECT 
          COUNT(*) as total_captures,
          COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as total_photos,
          COUNT(CASE WHEN media_type = 'video' THEN 1 END) as total_videos,
          COUNT(DISTINCT COALESCE(CAST(event_id AS TEXT), event_name, 'misc')) as total_events
        FROM event_captures ec
        ${targetAssocId ? `WHERE ec.association_id = ${targetAssocId}` : ''}
      `;
      const statsRes = await pool.query(statsQuery);

      res.json({
        success: true,
        data: result.rows,
        stats: statsRes.rows[0] || {
          total_captures: 0,
          total_photos: 0,
          total_videos: 0,
          total_events: 0,
        },
      });
    } catch (err) {
      console.error('Error fetching event captures:', err);
      next(err);
    }
  },

  /**
   * Upload event captures (Multiple photos / videos)
   */
  async create(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: userId } = req.user;
      let {
        title,
        description,
        event_id,
        event_name,
        event_date,
        association_id,
      } = req.body;

      let targetAssocId = userAssocId;
      if (role === 'super_admin') {
        if (!association_id || association_id === 'all') {
          const firstAssoc = await pool.query('SELECT id FROM associations WHERE is_active = true LIMIT 1');
          targetAssocId = firstAssoc.rows[0]?.id;
        } else {
          targetAssocId = parseInt(association_id, 10);
        }
      }

      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'An active association is required to upload event captures.',
        });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title is required.',
        });
      }

      if (!event_date) {
        return res.status(400).json({
          success: false,
          message: 'Event date is required.',
        });
      }

      const files = req.files || (req.file ? [req.file] : []);
      const parsedEventId = event_id && event_id !== 'none' && !isNaN(event_id) ? parseInt(event_id, 10) : null;

      // If event_id is selected, get event name and date if not provided
      if (parsedEventId && !event_name) {
        try {
          const evRes = await pool.query('SELECT title, event_date FROM events WHERE id = $1', [parsedEventId]);
          if (evRes.rows.length > 0) {
            if (!event_name) event_name = evRes.rows[0].title;
            if (!event_date) event_date = evRes.rows[0].event_date;
          }
        } catch (e) {
          console.warn('Failed to fetch event title for capture:', e.message);
        }
      }

      const createdCaptures = [];

      if (files.length > 0) {
        for (const file of files) {
          const isPhoto = file.mimetype.startsWith('image/');
          const mediaType = isPhoto ? 'photo' : 'video';
          const relativePath = path.posix.join('uploads', 'events', file.filename);

          // Individual title fallback
          const captureTitle = title && title.trim()
            ? (files.length > 1 ? `${title.trim()} (${files.indexOf(file) + 1})` : title.trim())
            : file.originalname.replace(/\.[^/.]+$/, '');

          const insertQuery = `
            INSERT INTO event_captures (
              association_id,
              event_id,
              uploaded_by,
              title,
              description,
              event_name,
              media_type,
              file_path,
              file_name,
              file_size,
              mime_type,
              event_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
          `;

          const values = [
            targetAssocId,
            parsedEventId,
            userId,
            captureTitle,
            description ? description.trim() : null,
            event_name ? event_name.trim() : 'Community Event',
            mediaType,
            relativePath,
            file.originalname,
            file.size,
            file.mimetype,
            new Date(event_date),
          ];

          const inserted = await pool.query(insertQuery, values);
          createdCaptures.push(inserted.rows[0]);
        }
      } else {
        // Files optional: create entry with title & date
        const insertQuery = `
          INSERT INTO event_captures (
            association_id,
            event_id,
            uploaded_by,
            title,
            description,
            event_name,
            media_type,
            file_path,
            event_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        const values = [
          targetAssocId,
          parsedEventId,
          userId,
          title.trim(),
          description ? description.trim() : null,
          event_name ? event_name.trim() : 'Community Event',
          'photo',
          null,
          new Date(event_date),
        ];
        const inserted = await pool.query(insertQuery, values);
        createdCaptures.push(inserted.rows[0]);
      }

      // Notify community members about new captures
      try {
        const members = await pool.query(
          "SELECT id FROM users WHERE association_id = $1 AND status = 'approved' AND id != $2",
          [targetAssocId, userId]
        );
        const notifyCount = files.length;
        const mediaWord = notifyCount === 1 ? (files[0].mimetype.startsWith('video/') ? 'video' : 'photo') : 'captures';
        for (const m of members.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, 'info', '/member/event-captures')`,
            [
              m.id,
              `New Event ${mediaWord === 'video' ? 'Video' : 'Captures'} Uploaded!`,
              `${notifyCount} new event ${mediaWord} shared for "${event_name || title || 'Community Event'}".`,
            ]
          );
        }
      } catch (notifyErr) {
        console.warn('Failed to send notification for event captures:', notifyErr.message);
      }

      res.status(201).json({
        success: true,
        message: `${createdCaptures.length} event capture(s) uploaded successfully!`,
        data: createdCaptures,
      });
    } catch (err) {
      console.error('Error uploading event capture:', err);
      next(err);
    }
  },

  /**
   * Update event capture details (title, description, event_date, event_name)
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { role, association_id: userAssocId } = req.user;
      const { title, description, event_id, event_name, event_date } = req.body;

      const existingRes = await pool.query('SELECT * FROM event_captures WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event capture not found' });
      }

      const capture = existingRes.rows[0];
      if (role !== 'super_admin' && capture.association_id !== userAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to edit this capture' });
      }

      const parsedEventId = event_id && event_id !== 'none' && !isNaN(event_id) ? parseInt(event_id, 10) : null;

      const updateQuery = `
        UPDATE event_captures
        SET 
          title = COALESCE($1, title),
          description = $2,
          event_id = $3,
          event_name = COALESCE($4, event_name),
          event_date = COALESCE($5, event_date),
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `;

      const values = [
        title ? title.trim() : null,
        description !== undefined ? description.trim() : capture.description,
        parsedEventId,
        event_name ? event_name.trim() : capture.event_name,
        event_date ? new Date(event_date) : capture.event_date,
        id,
      ];

      const updated = await pool.query(updateQuery, values);
      res.json({
        success: true,
        message: 'Event capture updated successfully!',
        data: updated.rows[0],
      });
    } catch (err) {
      console.error('Error updating event capture:', err);
      next(err);
    }
  },

  /**
   * Delete an event capture
   */
  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const { role, association_id: userAssocId } = req.user;

      const existingRes = await pool.query('SELECT * FROM event_captures WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event capture not found' });
      }

      const capture = existingRes.rows[0];
      if (role !== 'super_admin' && capture.association_id !== userAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete this capture' });
      }

      await pool.query('DELETE FROM event_captures WHERE id = $1', [id]);

      // Attempt to clean up file from storage
      if (capture.file_path) {
        const fullPath = path.resolve(__dirname, '../../', capture.file_path);
        fs.unlink(fullPath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.warn('Failed to remove event capture file:', err.message);
          }
        });
      }

      res.json({
        success: true,
        message: 'Event capture deleted successfully.',
      });
    } catch (err) {
      console.error('Error deleting event capture:', err);
      next(err);
    }
  },

  /**
   * Toggle like on an event capture
   */
  async like(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'UPDATE event_captures SET likes_count = likes_count + 1 WHERE id = $1 RETURNING id, likes_count',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event capture not found' });
      }
      res.json({
        success: true,
        likes_count: result.rows[0].likes_count,
      });
    } catch (err) {
      console.error('Error liking capture:', err);
      next(err);
    }
  },

  /**
   * Get distinct event options for filtering and tagging
   */
  async getEventOptions(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const { association_id } = req.query;

      let targetAssocId = userAssocId;
      if (role === 'super_admin') {
        targetAssocId = association_id && association_id !== 'all' ? parseInt(association_id, 10) : null;
      }

      const eventsWhere = targetAssocId ? 'WHERE association_id = $1' : '';
      const params = targetAssocId ? [targetAssocId] : [];

      const eventsRes = await pool.query(
        `SELECT id, title, event_date, location FROM events ${eventsWhere} ORDER BY event_date DESC`,
        params
      );

      const customConditions = ["event_name IS NOT NULL AND event_name != ''"];
      if (targetAssocId) customConditions.push('association_id = $1');
      const customWhere = `WHERE ${customConditions.join(' AND ')}`;

      const distinctCustomRes = await pool.query(
        `SELECT DISTINCT event_name FROM event_captures ${customWhere}`,
        params
      );

      res.json({
        success: true,
        events: eventsRes.rows,
        customEventNames: distinctCustomRes.rows.map((r) => r.event_name),
      });
    } catch (err) {
      console.error('Error fetching event options:', err);
      next(err);
    }
  },

  /**
   * Direct download endpoint for event capture media
   */
  async download(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM event_captures WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Capture not found.' });
      }

      const capture = result.rows[0];
      if (!capture.file_path) {
        return res.status(404).json({ success: false, message: 'No file available for this capture.' });
      }

      const fullPath = path.resolve(__dirname, '../../', capture.file_path);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'File not found on server storage.' });
      }

      const ext = path.extname(fullPath) || (capture.media_type === 'video' ? '.mp4' : '.jpg');
      let downloadFileName = capture.file_name || `${capture.title || 'event-capture'}${ext}`;
      if (!path.extname(downloadFileName)) {
        downloadFileName += ext;
      }

      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return res.download(fullPath, downloadFileName);
    } catch (err) {
      console.error('Error downloading event capture:', err);
      next(err);
    }
  },
};

module.exports = eventCaptureController;
