import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type { DbSession, DbMessage, Session, Message, ToolExecution } from '../types/index.js';

const logger = createLogger('Database');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dbDir = path.dirname(config.dbPath);

  // Ensure the data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info('Created database directory', { path: dbDir });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  logger.info('Database initialized', { path: config.dbPath });

  runMigrations();
}

function runMigrations(): void {
  const database = getDatabase();

  // Create sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      working_directory TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_at INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      claude_session_id TEXT
    )
  `);

  // Create messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_executions TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
  `);

  logger.info('Database migrations completed');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

// ============================================================================
// Session Repository
// ============================================================================

export const sessionRepository = {
  create(session: Omit<Session, 'messageCount'>): Session {
    const database = getDatabase();
    const stmt = database.prepare(`
      INSERT INTO sessions (id, name, status, working_directory, created_at, updated_at, last_message_at, message_count, claude_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.name,
      session.status,
      session.workingDirectory,
      session.createdAt,
      session.updatedAt,
      session.lastMessageAt ?? null,
      0,
      session.claudeSessionId ?? null
    );

    return { ...session, messageCount: 0 };
  },

  findById(id: string): Session | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as DbSession | undefined;
    return row ? mapDbSessionToSession(row) : null;
  },

  findAll(status?: string): Session[] {
    const database = getDatabase();
    let stmt;
    if (status) {
      stmt = database.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY updated_at DESC');
      return (stmt.all(status) as DbSession[]).map(mapDbSessionToSession);
    }
    stmt = database.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return (stmt.all() as DbSession[]).map(mapDbSessionToSession);
  },

  update(id: string, updates: Partial<Session>): Session | null {
    const database = getDatabase();
    const session = this.findById(id);
    if (!session) return null;

    const updatedSession = { ...session, ...updates, updatedAt: Date.now() };

    const stmt = database.prepare(`
      UPDATE sessions
      SET name = ?, status = ?, working_directory = ?, updated_at = ?, last_message_at = ?, message_count = ?, claude_session_id = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedSession.name,
      updatedSession.status,
      updatedSession.workingDirectory,
      updatedSession.updatedAt,
      updatedSession.lastMessageAt ?? null,
      updatedSession.messageCount,
      updatedSession.claudeSessionId ?? null,
      id
    );

    return updatedSession;
  },

  delete(id: string): boolean {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  incrementMessageCount(id: string): void {
    const database = getDatabase();
    const stmt = database.prepare(`
      UPDATE sessions
      SET message_count = message_count + 1, last_message_at = ?, updated_at = ?
      WHERE id = ?
    `);
    const now = Date.now();
    stmt.run(now, now, id);
  },
};

// ============================================================================
// Message Repository
// ============================================================================

export const messageRepository = {
  create(message: Message): Message {
    const database = getDatabase();
    const stmt = database.prepare(`
      INSERT INTO messages (id, session_id, role, content, tool_executions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.toolExecutions ? JSON.stringify(message.toolExecutions) : null,
      message.createdAt,
      message.updatedAt
    );

    sessionRepository.incrementMessageCount(message.sessionId);

    return message;
  },

  findBySessionId(sessionId: string): Message[] {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
    return (stmt.all(sessionId) as DbMessage[]).map(mapDbMessageToMessage);
  },

  update(id: string, updates: Partial<Message>): Message | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM messages WHERE id = ?');
    const row = stmt.get(id) as DbMessage | undefined;
    if (!row) return null;

    const message = mapDbMessageToMessage(row);
    const updatedMessage = { ...message, ...updates, updatedAt: Date.now() };

    const updateStmt = database.prepare(`
      UPDATE messages
      SET content = ?, tool_executions = ?, updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      updatedMessage.content,
      updatedMessage.toolExecutions ? JSON.stringify(updatedMessage.toolExecutions) : null,
      updatedMessage.updatedAt,
      id
    );

    return updatedMessage;
  },

  delete(id: string): boolean {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteBySessionId(sessionId: string): number {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM messages WHERE session_id = ?');
    const result = stmt.run(sessionId);
    return result.changes;
  },
};

// ============================================================================
// Mappers
// ============================================================================

function mapDbSessionToSession(row: DbSession): Session {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Session['status'],
    workingDirectory: row.working_directory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at ?? undefined,
    messageCount: row.message_count,
    claudeSessionId: row.claude_session_id ?? undefined,
  };
}

function mapDbMessageToMessage(row: DbMessage): Message {
  let toolExecutions: ToolExecution[] | undefined;
  if (row.tool_executions) {
    try {
      toolExecutions = JSON.parse(row.tool_executions);
    } catch {
      toolExecutions = undefined;
    }
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as Message['role'],
    content: row.content,
    toolExecutions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
