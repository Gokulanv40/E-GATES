const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

/**
 * @route   POST /api/v1/events
 * @desc    Create event
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  [
    body('title').trim().notEmpty().withMessage('Event title is required'),
    body('event_date').notEmpty().withMessage('Event date is required'),
    validate
  ],
  eventController.create
);

/**
 * @route   GET /api/v1/events
 * @desc    List events
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  eventController.list
);

/**
 * @route   GET /api/v1/events/:id
 * @desc    Get single event
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Event ID must be an integer'), validate],
  eventController.getById
);

/**
 * @route   PUT /api/v1/events/:id
 * @desc    Update event
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Event ID must be an integer'), validate],
  eventController.update
);

/**
 * @route   DELETE /api/v1/events/:id
 * @desc    Delete event
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Event ID must be an integer'), validate],
  eventController.remove
);

module.exports = router;
