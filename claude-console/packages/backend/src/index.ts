import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { initializeWebSocket } from './socket/index.js';

// ============================================================================
// Application Setup
// ============================================================================

async function main(): Promise<void> {
  logger.info('Starting Claude Console Backend', {
    port: config.port,
    host: config.host,
    nodeVersion: process.version,
  });

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    process.exit(1);
  }

  // Initialize database
  try {
    initDatabase();
  } catch (error) {
    logger.error('Database initialization failed', { error });
    process.exit(1);
  }

  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
  }));

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // API info endpoint
  app.get('/api', (_req, res) => {
    res.json({
      name: 'Claude Console API',
      version: '1.0.0',
      websocket: true,
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket
  initializeWebSocket(httpServer);

  // Start server
  httpServer.listen(config.port, config.host, () => {
    logger.info(`Server running at http://${config.host}:${config.port}`);
    logger.info(`WebSocket server ready`);
    logger.info(`Health check: http://${config.host}:${config.port}/health`);
  });

  // ============================================================================
  // Graceful Shutdown
  // ============================================================================

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Close database
    closeDatabase();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
