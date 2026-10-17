const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

/**
 * @route   GET /api/v1/audit
 * @desc    List audit trail logs
 * @access  Private (Admin, Super Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  auditController.list
);

/**
 * @route   DELETE /api/v1/audit/:id
 * @desc    Delete single audit entry
 * @access  Private (Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin'),
  auditController.deleteEntry
);

/**
 * @route   DELETE /api/v1/audit
 * @desc    Clear all audit logs
 * @access  Private (Super Admin)
 */
router.delete(
  '/',
  authenticate,
  authorize('super_admin'),
  auditController.clearAll
);

module.exports = router;
