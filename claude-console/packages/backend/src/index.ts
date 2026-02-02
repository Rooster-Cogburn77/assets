import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { initializeWebSocket } from './socket/index.js';

async function main(): Promise<void> {
  validateConfig();
  initDatabase();

  const app = express();

  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
  });

  const httpServer = createServer(app);
  initializeWebSocket(httpServer);

  httpServer.listen(config.port, config.host, () => {
    console.log(`[Server] Running at http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} received, shutting down...`);
    httpServer.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
}

main().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
