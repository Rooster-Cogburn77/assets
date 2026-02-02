import { config as dotenvConfig } from 'dotenv';
import path from 'path';

dotenvConfig();

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: envNumber('PORT', 3001),
  host: env('HOST', '0.0.0.0'),
  corsOrigins: envArray('CORS_ORIGINS', ['http://localhost:5173', 'http://localhost:3000']),
  dbPath: env('DB_PATH', path.join(process.cwd(), 'data', 'claude-console.db')),
  claudePath: env('CLAUDE_PATH', 'claude'),
  defaultWorkingDirectory: env('DEFAULT_WORKING_DIR', process.cwd()),
};

export function validateConfig(): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }
}
