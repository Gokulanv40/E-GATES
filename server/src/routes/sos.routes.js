const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const sosController = require('../controllers/sos.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

// Dedicated SOS trigger rate limiter: max 5 requests per minute per IP
const sosTriggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many SOS requests. Please wait a minute before trying again.'
  }
});

/**
 * @route   POST /api/v1/sos/trigger
 * @desc    Trigger emergency SOS alert
 * @access  Private (Member, Admin)
 */
router.post(
  '/trigger',
  authenticate,
  sosTriggerLimiter,
  [
    body('emergency_type')
      .optional()
      .isIn([
        'Medical', 'Medical Emergency',
        'Fire', 'Fire Outbreak', 'Fire Incident',
        'Theft/Intruder', 'Theft / Intruder',
        'Women Safety',
        'Immediate Distress', 'Immediate Emergency Distress',
        'Other', 'Other Emergency', 'General Emergency'
      ])
      .withMessage('Invalid emergency type'),
    validate
  ],
  sosController.trigger
);

/**
 * @route   GET /api/v1/sos/report
 * @desc    Get SOS analytics & report
 * @access  Private (Admin, Super Admin)
 */
router.get(
  '/report',
  authenticate,
  authorize('super_admin', 'admin'),
  sosController.getReport
);

/**
 * @route   GET /api/v1/sos/contacts
 * @desc    Get configured SOS contacts
 * @access  Private
 */
router.get(
  '/contacts',
  authenticate,
  sosController.getContacts
);

/**
 * @route   POST /api/v1/sos/contacts
 * @desc    Set all 3 SOS contacts (2 members, 1 police)
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/contacts',
  authenticate,
  authorize('super_admin', 'admin'),
  sosController.setContacts
);

/**
  * @route   POST /api/v1/sos/contacts/single
  * @desc    Add single emergency contact (family, etc.)
  * @access  Private (Admin, Super Admin)
  */
router.post(
  '/contacts/single',
  authenticate,
  authorize('super_admin', 'admin'),
  sosController.addSingleContact
);

/**
 * @route   PUT /api/v1/sos/contacts/:id
 * @desc    Update single SOS contact
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/contacts/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Contact ID must be an integer'), validate],
  sosController.updateContact
);

/**
 * @route   DELETE /api/v1/sos/contacts/:id
 * @desc    Delete single SOS contact
 * @access  Private (Admin, Super Admin)
 */
router.delete(
  '/contacts/:id',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Contact ID must be an integer'), validate],
  sosController.deleteContact
);

/**
 * @route   GET /api/v1/sos/alerts
 * @desc    List SOS alerts
 * @access  Private (Admin, Super Admin)
 */
router.get(
  '/alerts',
  authenticate,
  authorize('super_admin', 'admin'),
  sosController.listAlerts
);

/**
 * @route   GET /api/v1/sos/alerts/:id
 * @desc    Get SOS alert detail
 * @access  Private (Admin, Super Admin)
 */
router.get(
  '/alerts/:id',
  authenticate,
  [param('id').isInt().withMessage('Alert ID must be an integer'), validate],
  sosController.getAlert
);

/**
 * @route   PUT /api/v1/sos/:id/acknowledge
 * @desc    Acknowledge SOS alert
 * @access  Private (Admin, Super Admin, Contact)
 */
router.put(
  '/:id/acknowledge',
  authenticate,
  [param('id').isInt().withMessage('Alert ID must be an integer'), validate],
  sosController.acknowledge
);

/**
 * @route   PUT /api/v1/sos/:id/resolve
 * @desc    Resolve or mark false alarm
 * @access  Private (Admin, Super Admin)
 */
router.put(
  '/:id/resolve',
  authenticate,
  authorize('super_admin', 'admin'),
  [param('id').isInt().withMessage('Alert ID must be an integer'), validate],
  sosController.resolve
);

/**
 * @route   DELETE /api/v1/sos/alerts/:id
 * @desc    Delete SOS alert record
 * @access  Private (Super Admin)
 */
router.delete(
  '/alerts/:id',
  authenticate,
  authorize('super_admin'),
  [param('id').isInt().withMessage('Alert ID must be an integer'), validate],
  sosController.deleteAlert
);

router.delete(
  '/:id',
  authenticate,
  authorize('super_admin'),
  [param('id').isInt().withMessage('Alert ID must be an integer'), validate],
  sosController.deleteAlert
);

module.exports = router;
