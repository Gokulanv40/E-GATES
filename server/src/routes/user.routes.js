const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

// Multer middleware wrapper for proof documents upload
const proofUploadMiddleware = (req, res, next) => {
  if (upload && upload.proofUpload && typeof upload.proofUpload.fields === 'function') {
    upload.proofUpload.fields([
      { name: 'eb_bill_proof', maxCount: 1 },
      { name: 'property_tax_receipt', maxCount: 1 }
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
 * @route   POST /api/v1/users/create-superadmin
 * @desc    Create another super admin
 * @access  Private (Super Admin)
 */
router.post(
  '/create-superadmin',
  authenticate,
  authorize('super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  userController.createSuperAdmin
);

/**
 * @route   GET /api/v1/users/pending
 * @desc    Get all pending registration requests
 * @access  Private (Super Admin, Admin)
 */
router.get(
  '/pending',
  authenticate,
  authorize('super_admin', 'admin'),
  userController.getPending
);

/**
 * @route   GET /api/v1/users/export/excel
 * @desc    Export users list as Excel
 * @access  Private (Super Admin, Admin)
 */
router.get(
  '/export/excel',
  authenticate,
  authorize('super_admin', 'admin'),
  userController.exportExcel
);

/**
 * @route   GET /api/v1/users/export/pdf
 * @desc    Export users list as PDF
 * @access  Private (Super Admin, Admin)
 */
router.get(
  '/export/pdf',
  authenticate,
  authorize('super_admin', 'admin'),
  userController.exportPdf
);

/**
 * @route   PUT /api/v1/users/:id/approve
 * @desc    Approve pending registration
 * @access  Private (Super Admin, Admin)
 */
router.put(
  '/:id/approve',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('User ID must be an integer'), validate],
  userController.approve
);

/**
 * @route   PUT /api/v1/users/:id/reject
 * @desc    Reject pending registration with reason
 * @access  Private (Super Admin, Admin)
 */
router.put(
  '/:id/reject',
  authenticate,
  authorize('super_admin', 'admin'),
  [
    param('id').isInt().withMessage('User ID must be an integer'),
    body('rejection_reason').optional().isString().trim(),
    validate
  ],
  userController.reject
);

/**
 * @route   GET /api/v1/users
 * @desc    List all users (SA: all, Admin: own association)
 * @access  Private (Super Admin, Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  userController.list
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user profile by ID
 * @access  Private (All authenticated users with isolation check)
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('User ID must be an integer'), validate],
  userController.getById
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user profile
 * @access  Private (Self, Admin, SA)
 */
router.put(
  '/:id',
  authenticate,
  proofUploadMiddleware,
  [param('id').isInt().withMessage('User ID must be an integer'), validate],
  userController.update
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user
 * @access  Private (Super Admin, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('User ID must be an integer'), validate],
  userController.remove
);

module.exports = router;
