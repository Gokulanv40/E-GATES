const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { authenticate } = require('../middleware/auth');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

const complaintUploadMiddleware = (req, res, next) => {
  const uploader = upload && (upload.documentUpload || upload.proofUpload);
  if (uploader && typeof uploader.single === 'function') {
    uploader.single('attachment')(req, res, (err) => {
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
 * @route   POST /api/v1/complaints
 * @desc    Submit a new complaint
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  complaintUploadMiddleware,
  [
    body('title').trim().notEmpty().withMessage('Complaint title is required'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority level'),
    validate
  ],
  complaintController.create
);

/**
 * @route   GET /api/v1/complaints
 * @desc    List complaints (Member: own, Admin: association, SA: all)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  complaintController.list
);

/**
 * @route   GET /api/v1/complaints/:id
 * @desc    Get complaint details by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Complaint ID must be an integer'), validate],
  complaintController.getById
);

/**
 * @route   PUT /api/v1/complaints/:id
 * @desc    Update complaint (Status/priority for Admin; Edit for Member if open)
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [
    param('id').isInt().withMessage('Complaint ID must be an integer'),
    body('status')
      .optional()
      .isIn(['open', 'in_progress', 'resolved', 'closed'])
      .withMessage('Invalid status'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    validate
  ],
  complaintController.update
);

/**
 * @route   DELETE /api/v1/complaints/:id
 * @desc    Delete complaint
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Complaint ID must be an integer'), validate],
  complaintController.remove
);

module.exports = router;
