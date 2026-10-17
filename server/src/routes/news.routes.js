const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

const newsUploadMiddleware = (req, res, next) => {
  if (upload && upload.newsUpload && typeof upload.newsUpload.fields === 'function') {
    upload.newsUpload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'attachment', maxCount: 1 },
      { name: 'voice_message', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * @route   POST /api/v1/news
 * @desc    Create news post
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  newsUploadMiddleware,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('category')
      .optional()
      .isIn(['Urgent', 'Meeting', 'Maintenance', 'General'])
      .withMessage('Invalid category'),
    validate
  ],
  newsController.create
);

/**
 * @route   GET /api/v1/news
 * @desc    List news posts
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  newsController.list
);

/**
 * @route   GET /api/v1/news/:id
 * @desc    Get single news post
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Post ID must be an integer'), validate],
  newsController.getById
);

/**
 * @route   PUT /api/v1/news/:id
 * @desc    Update news post
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  newsUploadMiddleware,
  [param('id').isInt().withMessage('Post ID must be an integer'), validate],
  newsController.update
);

/**
 * @route   DELETE /api/v1/news/:id
 * @desc    Delete news post
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Post ID must be an integer'), validate],
  newsController.remove
);

/**
 * @route   PUT /api/v1/news/:id/pin
 * @desc    Toggle pin status of a news post
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/:id/pin',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Post ID must be an integer'), validate],
  newsController.togglePin
);

module.exports = router;
