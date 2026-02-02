import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
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

const logger = createLogger('WebSocket');

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

  // Set up Claude service event listeners (only once)
  setupClaudeEventListeners(io);

  io.on('connection', (socket: TypedSocket) => {
    const clientId = uuidv4();
    socket.data.connectedAt = Date.now();

    logger.info('Client connected', { clientId, socketId: socket.id });

    // Emit connection status
    socket.emit('connection:status', {
      connected: true,
      claudeAvailable: true,
      timestamp: Date.now(),
    });

    // ========================================================================
    // Session Handlers
    // ========================================================================

    socket.on('session:create', (data: CreateSessionRequest, callback) => {
      try {
        const session = sessionService.createSession(data);
        logger.info('Session created via socket', { sessionId: session.id });
        callback({ success: true, session });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to create session', { error: message });
        callback({ success: false, error: message });
      }
    });

    socket.on('session:list', (callback) => {
      try {
        const sessions = sessionService.listSessions();
        callback({ success: true, sessions });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to list sessions', { error: message });
        callback({ success: false, error: message });
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get session', { error: message, sessionId });
        callback({ success: false, error: message });
      }
    });

    socket.on('session:delete', (sessionId: string, callback) => {
      try {
        // Cancel any active Claude process
        claudeService.cancelSession(sessionId);

        const deleted = sessionService.deleteSession(sessionId);
        if (!deleted) {
          callback({ success: false, error: 'Session not found' });
          return;
        }
        callback({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to delete session', { error: message, sessionId });
        callback({ success: false, error: message });
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to rename session', { error: message, sessionId: data.sessionId });
        callback({ success: false, error: message });
      }
    });

    socket.on('session:archive', (sessionId: string, callback) => {
      try {
        const session = sessionService.archiveSession(sessionId);
        if (!session) {
          callback({ success: false, error: 'Session not found' });
          return;
        }
        callback({ success: true, session });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to archive session', { error: message, sessionId });
        callback({ success: false, error: message });
      }
    });

    // ========================================================================
    // Message Handlers
    // ========================================================================

    socket.on('message:send', async (data: SendMessageRequest) => {
      const { sessionId, content, allowedTools } = data;

      try {
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

        // Join the session room for this socket
        socket.join(`session:${sessionId}`);

        // Start Claude
        await claudeService.sendMessage(sessionId, content, {
          workingDirectory: session.workingDirectory,
          resumeSessionId: session.claudeSessionId,
          allowedTools,
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send message', { error: message, sessionId });
        socket.emit('message:error', {
          sessionId,
          error: message,
          code: 'SEND_FAILED',
        });
      }
    });

    socket.on('message:cancel', (sessionId: string) => {
      logger.info('Message cancel requested', { sessionId });
      claudeService.cancelSession(sessionId);
    });

    // ========================================================================
    // Disconnect Handler
    // ========================================================================

    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', { clientId, socketId: socket.id, reason });
    });
  });

  logger.info('WebSocket server initialized');

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

    // Save the message to the database
    sessionService.addMessage(message);

    // Update the Claude session ID if we got one
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
