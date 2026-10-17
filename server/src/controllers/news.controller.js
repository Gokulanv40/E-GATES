const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { getIO } = require('../services/socket.service');

// Helper to remove file from disk safely
const safelyDeleteFile = (filePath) => {
  if (!filePath) return;
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('Error deleting file:', err.message);
  }
};

const newsController = {
  /**
   * Create a news post
   * Admin or Super Admin
   */
  async create(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: authorId } = req.user;
      const {
        title,
        content,
        category = 'General',
        is_pinned = false,
        association_id
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
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

      // Allowed categories
      const validCategories = ['Urgent', 'Meeting', 'Maintenance', 'General'];
      const finalCategory = validCategories.includes(category) ? category : 'General';

      // Helper to store clean relative upload path
      const normalizeUploadPath = (p) => {
        if (!p) return null;
        const normalized = p.replace(/\\/g, '/');
        const idx = normalized.indexOf('uploads/');
        return idx !== -1 ? normalized.substring(idx) : normalized;
      };

      // Files
      const image = req.files && req.files.image && req.files.image[0]
        ? normalizeUploadPath(req.files.image[0].path)
        : null;

      const attachment = req.files && req.files.attachment && req.files.attachment[0]
        ? normalizeUploadPath(req.files.attachment[0].path)
        : null;

      const voiceMessage = req.files && req.files.voice_message && req.files.voice_message[0]
        ? normalizeUploadPath(req.files.voice_message[0].path)
        : null;

      const insertQuery = `
        INSERT INTO news_posts (
          association_id, author_id, title, content,
          voice_message, attachment, image, category, is_pinned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        targetAssocId,
        authorId,
        title.trim(),
        content ? content.trim() : null,
        voiceMessage,
        attachment,
        image,
        finalCategory,
        Boolean(is_pinned)
      ];

      const result = await pool.query(insertQuery, values);
      const post = result.rows[0];

      // Add author info for response & socket
      const enrichedPost = {
        ...post,
        author_name: req.user.name
      };

      // Emit socket event
      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`association_${targetAssocId}`).emit('news:new', enrichedPost);
          io.emit('news:new', enrichedPost);
        }
      } catch (err) {
        console.error('Socket error on news:new:', err.message);
      }

      // If category is Urgent, create notifications for all association members
      if (finalCategory === 'Urgent') {
        try {
          const members = await pool.query(
            "SELECT id FROM users WHERE association_id = $1 AND status = 'approved'",
            [targetAssocId]
          );
          for (const m of members.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, type, link)
               VALUES ($1, $2, $3, 'warning', '/member/news')`,
              [m.id, `Urgent Announcement: ${title.trim()}`, content || 'New urgent update from association management']
            );
          }
        } catch (notifErr) {
          console.error('Failed to notify members for urgent news:', notifErr.message);
        }
      }

      res.status(201).json({
        success: true,
        message: 'News post published successfully',
        data: enrichedPost
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List news posts for association
   */
  async list(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        category,
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

      if (role === 'super_admin') {
        if (queryAssocId) {
          params.push(queryAssocId);
          conditions.push(`n.association_id = $${params.length}`);
        }
      } else {
        params.push(userAssocId);
        conditions.push(`n.association_id = $${params.length}`);
      }

      if (category) {
        params.push(category);
        conditions.push(`n.category = $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        conditions.push(`(n.title ILIKE $${params.length} OR n.content ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total
      const countRes = await pool.query(`SELECT COUNT(*) FROM news_posts n ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      // Data query: pinned posts first, then newest
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const dataQuery = `
        SELECT n.*, u.name as author_name, u.role as author_role, a.name as association_name
        FROM news_posts n
        JOIN users u ON n.author_id = u.id
        LEFT JOIN associations a ON n.association_id = a.id
        ${whereClause}
        ORDER BY n.is_pinned DESC, n.created_at DESC
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
   * Get single news post
   */
  async getById(req, res, next) {
    try {
      const postId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const query = `
        SELECT n.*, u.name as author_name, u.role as author_role, a.name as association_name
        FROM news_posts n
        JOIN users u ON n.author_id = u.id
        LEFT JOIN associations a ON n.association_id = a.id
        WHERE n.id = $1
      `;
      const result = await pool.query(query, [postId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'News post not found'
        });
      }

      const post = result.rows[0];

      if (role !== 'super_admin' && post.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to news post'
        });
      }

      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update news post
   */
  async update(req, res, next) {
    try {
      const postId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { title, content, category, is_pinned } = req.body;

      const check = await pool.query('SELECT * FROM news_posts WHERE id = $1', [postId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'News post not found'
        });
      }

      const existing = check.rows[0];

      if (role !== 'super_admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update this news post'
        });
      }

      // Helper to store clean relative upload path
      const normalizeUploadPath = (p) => {
        if (!p) return null;
        const normalized = p.replace(/\\/g, '/');
        const idx = normalized.indexOf('uploads/');
        return idx !== -1 ? normalized.substring(idx) : normalized;
      };

      // Handle new files or keep existing
      const image = req.files && req.files.image && req.files.image[0]
        ? normalizeUploadPath(req.files.image[0].path)
        : existing.image;

      const attachment = req.files && req.files.attachment && req.files.attachment[0]
        ? normalizeUploadPath(req.files.attachment[0].path)
        : existing.attachment;

      const voiceMessage = req.files && req.files.voice_message && req.files.voice_message[0]
        ? normalizeUploadPath(req.files.voice_message[0].path)
        : existing.voice_message;

      const updateQuery = `
        UPDATE news_posts
        SET title = COALESCE($1, title),
            content = COALESCE($2, content),
            category = COALESCE($3, category),
            is_pinned = COALESCE($4, is_pinned),
            image = $5,
            attachment = $6,
            voice_message = $7,
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `;

      const values = [
        title ? title.trim() : null,
        content !== undefined ? (content ? content.trim() : null) : null,
        category || null,
        is_pinned !== undefined ? Boolean(is_pinned) : null,
        image,
        attachment,
        voiceMessage,
        postId
      ];

      const result = await pool.query(updateQuery, values);

      res.json({
        success: true,
        message: 'News post updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete news post
   */
  async remove(req, res, next) {
    try {
      const postId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM news_posts WHERE id = $1', [postId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'News post not found'
        });
      }

      const post = check.rows[0];

      if (role !== 'super_admin' && post.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to delete this news post'
        });
      }

      // Remove files from disk
      if (post.image) safelyDeleteFile(post.image);
      if (post.attachment) safelyDeleteFile(post.attachment);
      if (post.voice_message) safelyDeleteFile(post.voice_message);

      await pool.query('DELETE FROM news_posts WHERE id = $1', [postId]);

      res.json({
        success: true,
        message: 'News post deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Toggle pin status
   */
  async togglePin(req, res, next) {
    try {
      const postId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM news_posts WHERE id = $1', [postId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'News post not found'
        });
      }

      const post = check.rows[0];

      if (role !== 'super_admin' && post.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const result = await pool.query(
        'UPDATE news_posts SET is_pinned = NOT is_pinned, updated_at = NOW() WHERE id = $1 RETURNING *',
        [postId]
      );

      res.json({
        success: true,
        message: `Post ${result.rows[0].is_pinned ? 'pinned' : 'unpinned'} successfully`,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = newsController;
