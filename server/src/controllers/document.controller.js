const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const documentController = {
  /**
   * Upload document
   * Admin or Super Admin
   */
  async upload(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: userId } = req.user;
      const { title, description, association_id } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No document file uploaded'
        });
      }

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Document title is required'
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

      const filePath = req.file.path.replace(/\\/g, '/');
      const fileType = req.file.mimetype || path.extname(req.file.originalname).slice(1);
      const fileSize = req.file.size;

      const insertQuery = `
        INSERT INTO documents (association_id, uploaded_by, title, description, file_path, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        targetAssocId,
        userId,
        title.trim(),
        description ? description.trim() : null,
        filePath,
        fileType,
        fileSize
      ];

      const result = await pool.query(insertQuery, values);

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List documents for association
   */
  async list(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        search,
        file_type,
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
          conditions.push(`d.association_id = $${params.length}`);
        }
      } else {
        params.push(userAssocId);
        conditions.push(`d.association_id = $${params.length}`);
      }

      if (file_type) {
        params.push(`%${file_type.trim()}%`);
        conditions.push(`d.file_type ILIKE $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        const searchIdx = params.length;
        conditions.push(`(d.title ILIKE $${searchIdx} OR d.description ILIKE $${searchIdx})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countRes = await pool.query(`SELECT COUNT(*) FROM documents d ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      // Data
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const query = `
        SELECT d.*, u.name as uploader_name, a.name as association_name
        FROM documents d
        JOIN users u ON d.uploaded_by = u.id
        LEFT JOIN associations a ON d.association_id = a.id
        ${whereClause}
        ORDER BY d.created_at DESC
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
   * Download / serve document file
   */
  async download(req, res, next) {
    try {
      const docId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const query = 'SELECT * FROM documents WHERE id = $1';
      const result = await pool.query(query, [docId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      const doc = result.rows[0];

      if (role !== 'super_admin' && doc.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to document'
        });
      }

      const absolutePath = path.isAbsolute(doc.file_path)
        ? doc.file_path
        : path.join(process.cwd(), doc.file_path);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on storage server'
        });
      }

      const ext = path.extname(absolutePath);
      const downloadFilename = `${doc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;

      res.download(absolutePath, downloadFilename);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete document and physical file
   */
  async remove(req, res, next) {
    try {
      const docId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      const doc = check.rows[0];

      if (role !== 'super_admin' && doc.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // Delete file on disk
      try {
        const absolutePath = path.isAbsolute(doc.file_path)
          ? doc.file_path
          : path.join(process.cwd(), doc.file_path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (fileErr) {
        console.error('Error removing document file from disk:', fileErr.message);
      }

      await pool.query('DELETE FROM documents WHERE id = $1', [docId]);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = documentController;
