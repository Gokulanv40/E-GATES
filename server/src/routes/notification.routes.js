const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all user notifications as read
 * @access  Private
 */
router.put(
  '/read-all',
  authenticate,
  notificationController.markAllRead
);

/**
 * @route   GET /api/v1/notifications
 * @desc    List user notifications
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  notificationController.list
);

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark single notification as read
 * @access  Private
 */
router.put(
  '/:id/read',
  authenticate,
  [param('id').isInt().withMessage('Notification ID must be an integer'), validate],
  notificationController.markRead
);

module.exports = router;
