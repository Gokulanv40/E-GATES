const express = require('express');
const router = express.Router();
const associationController = require('../controllers/association.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

const logoUploadMiddleware = (req, res, next) => {
  if (upload && upload.logoUpload && typeof upload.logoUpload.single === 'function') {
    upload.logoUpload.single('logo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Logo upload failed'
        });
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * Optional authentication helper:
 * populates req.user if token is present, but doesn't block unauthenticated requests.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
};

/**
 * @route   GET /api/v1/associations/dashboard-stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get(
  '/dashboard-stats',
  authenticate,
  associationController.getDashboardStats
);

/**
 * @route   POST /api/v1/associations
 * @desc    Create new association
 * @access  Private (Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin'),
  logoUploadMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Association name is required'),
    validate
  ],
  associationController.create
);

/**
 * @route   POST /api/v1/associations/bulk
 * @desc    Bulk create multiple associations
 * @access  Private (Super Admin)
 */
router.post(
  '/bulk',
  authenticate,
  authorize('super_admin'),
  associationController.createBulk
);

/**
 * @route   GET /api/v1/associations
 * @desc    List associations
 * @access  Public / Authenticated
 */
router.get(
  '/',
  optionalAuth,
  associationController.list
);

/**
 * @route   GET /api/v1/associations/:id
 * @desc    Get association details by ID
 * @access  Public / Authenticated
 */
router.get(
  '/:id',
  optionalAuth,
  [param('id').isInt().withMessage('Association ID must be an integer'), validate],
  associationController.getById
);

/**
 * @route   PUT /api/v1/associations/:id
 * @desc    Update association details & logo
 * @access  Private (Super Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('super_admin'),
  logoUploadMiddleware,
  [param('id').isInt().withMessage('Association ID must be an integer'), validate],
  associationController.update
);

/**
 * @route   PUT /api/v1/associations/:id/toggle
 * @desc    Toggle association active/inactive state
 * @access  Private (Super Admin)
 */
router.put(
  '/:id/toggle',
  authenticate,
  authorize('super_admin'),
  [param('id').isInt().withMessage('Association ID must be an integer'), validate],
  associationController.toggle
);

/**
 * @route   PUT /api/v1/associations/:id/assign-admin
 * @desc    Assign user as admin for association
 * @access  Private (Super Admin)
 */
router.put(
  '/:id/assign-admin',
  authenticate,
  authorize('super_admin'),
  [
    param('id').isInt().withMessage('Association ID must be an integer'),
    body('user_id').isInt().withMessage('Valid user ID is required'),
    validate
  ],
  associationController.assignAdmin
);

/**
 * @route   DELETE /api/v1/associations/:id
 * @desc    Delete association
 * @access  Private (Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin'),
  [param('id').isInt().withMessage('Association ID must be an integer'), validate],
  associationController.remove
);

module.exports = router;
