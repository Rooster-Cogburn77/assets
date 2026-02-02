import { v4 as uuidv4 } from 'uuid';
import { sessionRepository, messageRepository } from '../db/index.js';
import { config } from '../config/index.js';
import type {
  Session,
  SessionWithMessages,
  Message,
  CreateSessionRequest,
} from '../types/index.js';

const SESSION_NAMES = {
  adjectives: [
    'Swift', 'Bright', 'Calm', 'Deep', 'Fresh',
    'Golden', 'Hidden', 'Icy', 'Jade', 'Keen',
    'Light', 'Mystic', 'Noble', 'Ocean', 'Prime',
    'Quick', 'Royal', 'Silent', 'True', 'Vivid',
  ],
  nouns: [
    'Aurora', 'Breeze', 'Canyon', 'Dawn', 'Echo',
    'Falcon', 'Grove', 'Harbor', 'Isle', 'Journey',
    'Kindle', 'Lagoon', 'Mesa', 'Nexus', 'Orbit',
    'Peak', 'Quest', 'Ridge', 'Stream', 'Trail',
  ],
};

function generateSessionName(): string {
  const adj = SESSION_NAMES.adjectives[Math.floor(Math.random() * SESSION_NAMES.adjectives.length)];
  const noun = SESSION_NAMES.nouns[Math.floor(Math.random() * SESSION_NAMES.nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj} ${noun} ${num}`;
}

export const sessionService = {
  createSession(request: CreateSessionRequest): Session {
    const now = Date.now();
    return sessionRepository.create({
      id: uuidv4(),
      name: request.name ?? generateSessionName(),
      status: 'active',
      workingDirectory: request.workingDirectory ?? config.defaultWorkingDirectory,
      createdAt: now,
      updatedAt: now,
    });
  },

  getSession(id: string): Session | null {
    return sessionRepository.findById(id);
  },

  getSessionWithMessages(id: string): SessionWithMessages | null {
    const session = sessionRepository.findById(id);
    if (!session) return null;
    return { ...session, messages: messageRepository.findBySessionId(id) };
  },

  listSessions(): Session[] {
    const active = sessionRepository.findAll('active');
    const idle = sessionRepository.findAll('idle');
    return [...active, ...idle].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  renameSession(id: string, name: string): Session | null {
    return sessionRepository.update(id, { name });
  },

  deleteSession(id: string): boolean {
    return sessionRepository.delete(id);
  },

  updateClaudeSessionId(id: string, claudeSessionId: string): Session | null {
    return sessionRepository.update(id, { claudeSessionId });
  },

  addMessage(message: Omit<Message, 'createdAt' | 'updatedAt'>): Message {
    const now = Date.now();
    return messageRepository.create({ ...message, createdAt: now, updatedAt: now });
  },
};
