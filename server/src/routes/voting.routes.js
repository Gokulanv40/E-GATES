const express = require('express');
const router = express.Router();
const votingController = require('../controllers/voting.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const upload = require('../config/multer');

const votingUploadMiddleware = (req, res, next) => {
  if (upload && upload.votingUpload && typeof upload.votingUpload.single === 'function') {
    upload.votingUpload.single('document')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Vendor document upload failed'
        });
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * @route   POST /api/v1/voting/polls
 * @desc    Create a new poll
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/polls',
  authenticate,
  authorize('super_admin', 'admin'),
  [
    body('title').trim().notEmpty().withMessage('Poll title is required'),
    body('start_date').notEmpty().withMessage('Start date is required'),
    body('end_date').notEmpty().withMessage('End date is required'),
    validate
  ],
  votingController.createPoll
);

/**
 * @route   GET /api/v1/voting/polls
 * @desc    List polls for association
 * @access  Private
 */
router.get(
  '/polls',
  authenticate,
  votingController.listPolls
);

/**
 * @route   GET /api/v1/voting/polls/:id/results
 * @desc    Get poll voting results
 * @access  Private
 */
router.get(
  '/polls/:id/results',
  authenticate,
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.getResults
);

/**
 * @route   GET /api/v1/voting/polls/:id/export/excel
 * @desc    Export poll results to Excel
 * @access  Private (Admin, Super Admin)
 */
router.get(
  '/polls/:id/export/excel',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.exportResults
);

/**
 * @route   POST /api/v1/voting/polls/:id/vote
 * @desc    Cast vote on a poll (vendor poll, resolution, or election)
 * @access  Private (Member)
 */
router.post(
  '/polls/:id/vote',
  authenticate,
  [
    param('id').isInt().withMessage('Poll ID must be an integer'),
    body().custom((value, { req }) => {
      const hasVendor = req.body.vendor_id !== undefined && req.body.vendor_id !== null && !isNaN(Number(req.body.vendor_id));
      const hasCandidates = Array.isArray(req.body.candidate_ids) && req.body.candidate_ids.length > 0;
      if (!hasVendor && !hasCandidates) {
        throw new Error('Selection is required to cast vote (vendor_id or candidate_ids)');
      }
      return true;
    }),
    validate
  ],
  votingController.castVote
);

/**
 * @route   POST /api/v1/voting/polls/:id/vendors
 * @desc    Add vendor to poll
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/polls/:id/vendors',
  authenticate,
  authorize('super_admin', 'admin'),
  votingUploadMiddleware,
  [
    param('id').isInt().withMessage('Poll ID must be an integer'),
    body('name').trim().notEmpty().withMessage('Vendor name is required'),
    validate
  ],
  votingController.addVendor
);

/**
 * @route   GET /api/v1/voting/polls/:id
 * @desc    Get poll details with vendors and votes
 * @access  Private
 */
router.get(
  '/polls/:id',
  authenticate,
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.getPoll
);

/**
 * @route   POST /api/v1/voting/polls/:id/end
 * @desc    End poll now immediately
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/polls/:id/end',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.endPollNow
);

/**
 * @route   PUT /api/v1/voting/polls/:id
 * @desc    Update poll
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/polls/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.updatePoll
);

/**
 * @route   DELETE /api/v1/voting/polls/:id
 * @desc    Delete poll
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/polls/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Poll ID must be an integer'), validate],
  votingController.deletePoll
);

/**
 * @route   PUT /api/v1/voting/vendors/:id
 * @desc    Update vendor
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/vendors/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  votingUploadMiddleware,
  [param('id').isInt().withMessage('Vendor ID must be an integer'), validate],
  votingController.updateVendor
);

/**
 * @route   DELETE /api/v1/voting/vendors/:id
 * @desc    Delete vendor
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/vendors/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Vendor ID must be an integer'), validate],
  votingController.deleteVendor
);

module.exports = router;
