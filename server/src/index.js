const http = require('http');
const path = require('path');
const fs = require('fs');
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

// Serve static uploads / attachments
const uploadsPath = config.attachmentsPath || path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
  } catch (err) {
    console.warn('Could not auto-create uploads directory:', err.message);
  }
}
app.use('/uploads', express.static(uploadsPath));

// Universal Health Check endpoints (for Easypanel, Traefik, Docker Swarm, Kubernetes)
app.get(['/health', '/healthz', '/ping', '/api/health', '/api/v1/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'EGATES Platform',
    host: req.hostname,
    port: config.port,
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
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  '/app/client/dist',
];
const resolvedClientPath = possibleClientPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || possibleClientPaths[0];

if (fs.existsSync(resolvedClientPath)) {
  app.use(express.static(resolvedClientPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/health') ||
      req.path === '/ping' ||
      req.path === '/healthz'
    ) {
      return next();
    }
    const indexHtml = path.join(resolvedClientPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    next();
  });
}

// Fallback root for container health checks if client build is still mounting
app.get('/', (req, res) => {
  res.status(200).send('EGATES Backend is live. API available at /api/v1');
});

// Central Error Handling Middleware (must be registered last)
app.use(errorHandler);

// Create HTTP Server & initialize Socket.io
const server = http.createServer(app);
initSocket(server);

// Bootstrapping function
async function startServer() {
  // Pre-initialize database schema and seed if using PostgreSQL
  if (pool.initPostgresSchemaAndSeed) {
    await pool.initPostgresSchemaAndSeed().catch((err) => {
      console.warn('[Database Boot Notice]:', err.message);
    });
  }

  // Initialize scheduled background jobs
  initCronJobs();

  // Start Listening on primary port
  const PORT = config.port || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  Layout Association Management Backend Server`);
    console.log(`  Listening on:      http://0.0.0.0:${PORT}`);
    console.log(`  API Base URL:      http://0.0.0.0:${PORT}/api/v1`);
    console.log(`  Uploads:           http://0.0.0.0:${PORT}/uploads/`);
    console.log(`  Environment:       ${config.nodeEnv}`);
    console.log(`  Powered by JishnuInfotech`);
    console.log(`=======================================================`);
  });

  // Multi-Port support: Also listen on common Easypanel ports so Traefik never fails
  const fallbackPorts = [3002, 3001, 3000, 5000, 5002, 8080].filter((p) => p !== PORT);
  fallbackPorts.forEach((p) => {
    try {
      const s = http.createServer(app);
      s.listen(p, '0.0.0.0', () => {
        console.log(`  [Multi-Port]: Also listening on http://0.0.0.0:${p}`);
      }).on('error', () => {
        // Port already in use or unavailable, safe to ignore
      });
    } catch (_) {}
  });
}

startServer();

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
