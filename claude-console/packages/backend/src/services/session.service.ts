import { v4 as uuidv4 } from 'uuid';
import { sessionRepository, messageRepository } from '../db/index.js';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type {
  Session,
  SessionWithMessages,
  Message,
  CreateSessionRequest,
} from '../types/index.js';

const logger = createLogger('SessionService');

export class SessionService {
  generateSessionName(): string {
    const adjectives = [
      'Swift', 'Bright', 'Calm', 'Deep', 'Fresh',
      'Golden', 'Hidden', 'Icy', 'Jade', 'Keen',
      'Light', 'Mystic', 'Noble', 'Ocean', 'Prime',
      'Quick', 'Royal', 'Silent', 'True', 'Vivid',
    ];
    const nouns = [
      'Aurora', 'Breeze', 'Canyon', 'Dawn', 'Echo',
      'Falcon', 'Grove', 'Harbor', 'Isle', 'Journey',
      'Kindle', 'Lagoon', 'Mesa', 'Nexus', 'Orbit',
      'Peak', 'Quest', 'Ridge', 'Stream', 'Trail',
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);

    return `${adj} ${noun} ${num}`;
  }

  createSession(request: CreateSessionRequest): Session {
    const now = Date.now();
    const session: Omit<Session, 'messageCount'> = {
      id: uuidv4(),
      name: request.name ?? this.generateSessionName(),
      status: 'active',
      workingDirectory: request.workingDirectory ?? config.defaultWorkingDirectory,
      createdAt: now,
      updatedAt: now,
    };

    const created = sessionRepository.create(session);
    logger.info('Session created', { sessionId: created.id, name: created.name });

    return created;
  }

  getSession(id: string): Session | null {
    return sessionRepository.findById(id);
  }

  getSessionWithMessages(id: string): SessionWithMessages | null {
    const session = sessionRepository.findById(id);
    if (!session) return null;

    const messages = messageRepository.findBySessionId(id);

    return {
      ...session,
      messages,
    };
  }

  listSessions(includeArchived: boolean = false): Session[] {
    if (includeArchived) {
      return sessionRepository.findAll();
    }
    // Get active and idle sessions
    const active = sessionRepository.findAll('active');
    const idle = sessionRepository.findAll('idle');
    return [...active, ...idle].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  renameSession(id: string, name: string): Session | null {
    const updated = sessionRepository.update(id, { name });
    if (updated) {
      logger.info('Session renamed', { sessionId: id, name });
    }
    return updated;
  }

  archiveSession(id: string): Session | null {
    const updated = sessionRepository.update(id, { status: 'archived' });
    if (updated) {
      logger.info('Session archived', { sessionId: id });
    }
    return updated;
  }

  deleteSession(id: string): boolean {
    const deleted = sessionRepository.delete(id);
    if (deleted) {
      logger.info('Session deleted', { sessionId: id });
    }
    return deleted;
  }

  updateClaudeSessionId(id: string, claudeSessionId: string): Session | null {
    return sessionRepository.update(id, { claudeSessionId });
  }

  addMessage(message: Omit<Message, 'createdAt' | 'updatedAt'>): Message {
    const now = Date.now();
    const fullMessage: Message = {
      ...message,
      createdAt: now,
      updatedAt: now,
    };

    const created = messageRepository.create(fullMessage);
    logger.debug('Message added', { messageId: created.id, sessionId: created.sessionId });

    return created;
  }

  updateMessage(id: string, updates: Partial<Message>): Message | null {
    return messageRepository.update(id, updates);
  }

  getMessages(sessionId: string): Message[] {
    return messageRepository.findBySessionId(sessionId);
  }
}

// Singleton instance
export const sessionService = new SessionService();
