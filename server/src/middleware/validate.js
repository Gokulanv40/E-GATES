const { validationResult } = require('express-validator');

/**
 * Middleware to check express-validator validation results.
 * If validation errors exist, returns 400 with details.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the specified fields.',
      errors: errorDetails,
    });
  }
  next();
};

module.exports = {
  validate,
};
