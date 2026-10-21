const express = require('express');
const router = express.Router();
const eventCaptureController = require('../controllers/eventCapture.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { eventCapturesUpload } = require('../config/multer');

/**
 * @route   GET /api/v1/event-captures
 * @desc    Get all event captures with filtering & stats
 * @access  Private (All authenticated users)
 */
router.get('/', authenticate, eventCaptureController.getAll);

/**
 * @route   GET /api/v1/event-captures/options
 * @desc    Get event options for tagging & dropdown selection
 * @access  Private (All authenticated users)
 */
router.get('/options', authenticate, eventCaptureController.getEventOptions);

/**
 * @route   POST /api/v1/event-captures
 * @desc    Upload multiple photos/videos for events
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  eventCapturesUpload.array('media', 20),
  eventCaptureController.create
);

/**
 * @route   PUT /api/v1/event-captures/:id
 * @desc    Update capture metadata
 * @access  Private (Admin, Super Admin)
 */
router.put('/:id', authenticate, authorize('super_admin', 'admin'), eventCaptureController.update);

/**
 * @route   DELETE /api/v1/event-captures/:id
 * @desc    Delete a capture
 * @access  Private (Admin, Super Admin)
 */
router.delete('/:id', authenticate, authorize('super_admin', 'admin'), eventCaptureController.remove);

/**
 * @route   GET /api/v1/event-captures/:id/download
 * @desc    Direct attachment download for capture media file
 * @access  Private / Public
 */
router.get('/:id/download', eventCaptureController.download);

/**
 * @route   POST /api/v1/event-captures/:id/like
 * @desc    Like a capture
 * @access  Private (All authenticated users)
 */
router.post('/:id/like', authenticate, eventCaptureController.like);

module.exports = router;
