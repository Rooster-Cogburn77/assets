import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import type { ServerConfig } from '../types/index.js';

dotenvConfig();

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config: ServerConfig = {
  port: getEnvNumber('PORT', 3001),
  host: getEnvString('HOST', '0.0.0.0'),
  corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:5173', 'http://localhost:3000']),
  logLevel: getEnvString('LOG_LEVEL', 'info') as ServerConfig['logLevel'],
  dbPath: getEnvString('DB_PATH', path.join(process.cwd(), 'data', 'claude-console.db')),
  claudePath: getEnvString('CLAUDE_PATH', 'claude'),
  defaultWorkingDirectory: getEnvString('DEFAULT_WORKING_DIR', process.cwd()),
  maxConcurrentSessions: getEnvNumber('MAX_CONCURRENT_SESSIONS', 10),
  sessionTimeoutMs: getEnvNumber('SESSION_TIMEOUT_MS', 30 * 60 * 1000), // 30 minutes
  streamBufferMs: getEnvNumber('STREAM_BUFFER_MS', 50), // Buffer streams for smoother UI
};

export function validateConfig(): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  if (config.maxConcurrentSessions < 1) {
    throw new Error(`Invalid maxConcurrentSessions: ${config.maxConcurrentSessions}`);
  }
}
