import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { sessionService } from '../services/session.service.js';
import { claudeService } from '../services/claude.service.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  CreateSessionRequest,
  RenameSessionRequest,
  SendMessageRequest,
  Message,
} from '../types/index.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function initializeWebSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  setupClaudeEventListeners(io);

  io.on('connection', (socket: TypedSocket) => {
    socket.data.connectedAt = Date.now();

    socket.emit('connection:status', {
      connected: true,
      claudeAvailable: true,
      timestamp: Date.now(),
    });

    // Session handlers
    socket.on('session:create', (data: CreateSessionRequest, callback) => {
      try {
        const session = sessionService.createSession(data);
        callback({ success: true, session });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('session:list', (callback) => {
      try {
        callback({ success: true, sessions: sessionService.listSessions() });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('session:get', (sessionId: string, callback) => {
      try {
        const session = sessionService.getSessionWithMessages(sessionId);
        if (!session) {
          callback({ success: false, error: 'Session not found' });
          return;
        }
        callback({ success: true, session });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('session:delete', (sessionId: string, callback) => {
      try {
        claudeService.cancelSession(sessionId);
        const deleted = sessionService.deleteSession(sessionId);
        callback(deleted ? { success: true } : { success: false, error: 'Session not found' });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('session:rename', (data: RenameSessionRequest, callback) => {
      try {
        const session = sessionService.renameSession(data.sessionId, data.name);
        if (!session) {
          callback({ success: false, error: 'Session not found' });
          return;
        }
        callback({ success: true, session });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Message handlers
    socket.on('message:send', (data: SendMessageRequest) => {
      const { sessionId, content, allowedTools } = data;

      const session = sessionService.getSession(sessionId);
      if (!session) {
        socket.emit('message:error', {
          sessionId,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
        return;
      }

      // Store user message
      const userMessage: Message = {
        id: uuidv4(),
        sessionId,
        role: 'user',
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessionService.addMessage(userMessage);

      // Join the session room
      socket.join(`session:${sessionId}`);

      // Start Claude
      claudeService.sendMessage(sessionId, content, {
        workingDirectory: session.workingDirectory,
        resumeSessionId: session.claudeSessionId,
        allowedTools,
      });
    });

    socket.on('message:cancel', (sessionId: string) => {
      claudeService.cancelSession(sessionId);
    });
  });

  console.log('[WebSocket] Server initialized');
  return io;
}

function setupClaudeEventListeners(io: SocketServer): void {
  claudeService.on('message:start', (data) => {
    io.to(`session:${data.sessionId}`).emit('message:start', data);
  });

  claudeService.on('message:stream', (data) => {
    io.to(`session:${data.sessionId}`).emit('message:stream', data);
  });

  claudeService.on('message:complete', (data) => {
    const { message, claudeSessionId } = data;

    sessionService.addMessage(message);

    if (claudeSessionId) {
      sessionService.updateClaudeSessionId(message.sessionId, claudeSessionId);
    }

    io.to(`session:${message.sessionId}`).emit('message:complete', {
      message,
      sessionId: message.sessionId,
    });
  });

  claudeService.on('message:error', (data) => {
    io.to(`session:${data.sessionId}`).emit('message:error', data);
  });

  claudeService.on('tool:start', (data) => {
    io.to(`session:${data.sessionId}`).emit('tool:start', data);
  });

  claudeService.on('tool:update', (data) => {
    io.to(`session:${data.sessionId}`).emit('tool:update', data);
  });

  claudeService.on('tool:complete', (data) => {
    io.to(`session:${data.sessionId}`).emit('tool:complete', data);
  });
}
