const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config/env');
const pool = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socket.service');
const { initCronJobs } = require('./services/cron.service');
const apiRoutes = require('./routes');

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows client to fetch uploaded media/proofs
  })
);

// Enable CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  })
);

// Body parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Apply general rate limiting to API routes
app.use('/api', generalLimiter);

// Serve static uploads
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Layout Association Management System',
    footer: 'Powered by JishnuInfotech',
  });
});

app.get('/api/v1/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const result = await pool.query('SELECT 1');
    if (result.rows.length > 0) dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  res.json({
    success: true,
    status: 'healthy',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    service: 'Layout Association Management System API v1',
    footer: 'Powered by JishnuInfotech',
  });
});

// Mount Central API Routes at /api/v1
app.use('/api/v1', apiRoutes);

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Serve frontend build if available (production / Docker)
const fs = require('fs');
const clientBuildPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/health')
    ) {
      return next();
    }
    const indexHtml = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    next();
  });
}

// Central Error Handling Middleware (must be registered last)
app.use(errorHandler);

// Create HTTP Server & initialize Socket.io
const server = http.createServer(app);
initSocket(server);

// Initialize scheduled background jobs
initCronJobs();

// Start Listening
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Layout Association Management Backend Server`);
  console.log(`  Listening on port: ${PORT}`);
  console.log(`  API Base URL:      http://localhost:${PORT}/api/v1`);
  console.log(`  Uploads:           http://localhost:${PORT}/uploads/`);
  console.log(`  Environment:       ${config.nodeEnv}`);
  console.log(`  Powered by JishnuInfotech`);
  console.log(`=======================================================`);
});

// Graceful Shutdown Handling
const handleShutdown = async (signal) => {
  console.log(`\n[${signal}] Received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP and Socket.io servers closed.');
    try {
      await pool.end();
      console.log('Database pool connections closed.');
    } catch (err) {
      console.error('Error closing database pool:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful close hangs
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, server };
