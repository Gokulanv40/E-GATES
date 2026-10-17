const multer = require('multer');
const config = require('../config/env');

/**
 * Global Error Handling Middleware
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error('[Error Details]:', {
    message: err.message,
    name: err.name,
    code: err.code,
    stack: config.isDev ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  // Handle Multer Errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds allowed limit (Max 5MB for documents/images, 10MB for audio).',
        error: err.message,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: `Unexpected file field received: ${err.field}.`,
        error: err.message,
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
      error: err.code,
    });
  }

  // Handle Multer custom filter errors
  if (err.message && (err.message.includes('Invalid file format') || err.message.includes('must be'))) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Handle JSON Syntax Errors in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body.',
    });
  }

  // Handle Database Connection Errors
  if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('ECONNREFUSED'))) {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed: PostgreSQL is not running on localhost:5432. Please ensure the PostgreSQL service is started.',
      error: 'ECONNREFUSED',
    });
  }

  // Handle PostgreSQL specific error codes
  if (err.code) {
    // Unique violation
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate record already exists.',
        detail: err.detail || err.message,
      });
    }
    // Foreign key violation
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Referenced entity does not exist.',
        detail: err.detail || err.message,
      });
    }
    // Check constraint violation
    if (err.code === '23514') {
      return res.status(400).json({
        success: false,
        message: 'Database check constraint failed.',
        detail: err.detail || err.message,
      });
    }
  }

  const statusCode = err.statusCode || err.status || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (config.isDev) {
    response.stack = err.stack;
    response.error = err;
  }

  return res.status(statusCode).json(response);
};

module.exports = errorHandler;
