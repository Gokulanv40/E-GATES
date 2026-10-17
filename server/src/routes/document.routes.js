const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

const documentUploadMiddleware = (req, res, next) => {
  upload.uploadDocument(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
      });
    }
    if (req.files) {
      req.file = req.files.document?.[0] || req.files.file?.[0] || req.file;
    }
    next();
  });
};

/**
 * @route   POST /api/v1/documents
 * @desc    Upload document to association library
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  documentUploadMiddleware,
  documentController.upload
);

/**
 * @route   GET /api/v1/documents
 * @desc    List documents for association
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  documentController.list
);

/**
 * @route   GET /api/v1/documents/:id/download
 * @desc    Download document file
 * @access  Private
 */
router.get(
  '/:id/download',
  authenticate,
  [param('id').isInt().withMessage('Document ID must be an integer'), validate],
  documentController.download
);

/**
 * @route   DELETE /api/v1/documents/:id
 * @desc    Delete document
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Document ID must be an integer'), validate],
  documentController.remove
);

module.exports = router;
