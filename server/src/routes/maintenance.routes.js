const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

/**
 * @route   GET /api/v1/maintenance/summary
 * @desc    Get maintenance financial summary
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  maintenanceController.getSummary
);

/**
 * @route   POST /api/v1/maintenance
 * @desc    Create maintenance fee record (individual or bulk)
 * @access  Private (Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'admin'),
  [
    body('amount').isNumeric().withMessage('Valid fee amount is required'),
    body('period').trim().notEmpty().withMessage('Billing period is required'),
    body('due_date').notEmpty().withMessage('Due date is required'),
    validate
  ],
  maintenanceController.create
);

/**
 * @route   GET /api/v1/maintenance
 * @desc    List maintenance records
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  maintenanceController.list
);

/**
 * @route   PUT /api/v1/maintenance/:id
 * @desc    Update maintenance fee (mark as paid)
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Record ID must be an integer'), validate],
  maintenanceController.update
);

module.exports = router;
