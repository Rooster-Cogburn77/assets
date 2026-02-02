import { io, Socket } from 'socket.io-client';
import type {
  Session,
  SessionWithMessages,
  CreateSessionRequest,
  RenameSessionRequest,
  SendMessageRequest,
  SessionResponse,
  SessionListResponse,
  SessionDetailResponse,
  BaseResponse,
  MessageStartEvent,
  MessageStreamEvent,
  MessageCompleteEvent,
  MessageErrorEvent,
  ToolStartEvent,
  ToolUpdateEvent,
  ToolCompleteEvent,
  ConnectionStatusEvent,
} from '@/types';

// ============================================================================
// Socket Event Types
// ============================================================================

interface ServerToClientEvents {
  'message:start': (data: MessageStartEvent) => void;
  'message:stream': (data: MessageStreamEvent) => void;
  'message:complete': (data: MessageCompleteEvent) => void;
  'message:error': (data: MessageErrorEvent) => void;
  'tool:start': (data: ToolStartEvent) => void;
  'tool:update': (data: ToolUpdateEvent) => void;
  'tool:complete': (data: ToolCompleteEvent) => void;
  'session:updated': (data: Session) => void;
  'connection:status': (data: ConnectionStatusEvent) => void;
}

interface ClientToServerEvents {
  'session:create': (data: CreateSessionRequest, callback: (response: SessionResponse) => void) => void;
  'session:list': (callback: (response: SessionListResponse) => void) => void;
  'session:get': (sessionId: string, callback: (response: SessionDetailResponse) => void) => void;
  'session:delete': (sessionId: string, callback: (response: BaseResponse) => void) => void;
  'session:rename': (data: RenameSessionRequest, callback: (response: SessionResponse) => void) => void;
  'message:send': (data: SendMessageRequest) => void;
  'message:cancel': (sessionId: string) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ============================================================================
// Socket Service
// ============================================================================

class SocketService {
  private socket: TypedSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  connect(url: string = 'http://localhost:3001'): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        this.notifyHandlers('disconnect', reason);
      });

      // Forward all server events to registered handlers
      const events: (keyof ServerToClientEvents)[] = [
        'message:start',
        'message:stream',
        'message:complete',
        'message:error',
        'tool:start',
        'tool:update',
        'tool:complete',
        'session:updated',
        'connection:status',
      ];

      events.forEach((event) => {
        this.socket?.on(event, (data: unknown) => {
          this.notifyHandlers(event, data);
        });
      });
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as (...args: unknown[]) => void);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler as (...args: unknown[]) => void);
    };
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    this.eventHandlers.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  private notifyHandlers(event: string, ...args: unknown[]): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // ========================================================================
  // Session Methods
  // ========================================================================

  async createSession(data: CreateSessionRequest = {}): Promise<Session> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('session:create', data, (response) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error ?? 'Failed to create session'));
        }
      });
    });
  }

  async listSessions(): Promise<Session[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('session:list', (response) => {
        if (response.success && response.sessions) {
          resolve(response.sessions);
        } else {
          reject(new Error(response.error ?? 'Failed to list sessions'));
        }
      });
    });
  }

  async getSession(sessionId: string): Promise<SessionWithMessages> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('session:get', sessionId, (response) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error ?? 'Failed to get session'));
        }
      });
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('session:delete', sessionId, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error ?? 'Failed to delete session'));
        }
      });
    });
  }

  async renameSession(sessionId: string, name: string): Promise<Session> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('session:rename', { sessionId, name }, (response) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error ?? 'Failed to rename session'));
        }
      });
    });
  }

  // ========================================================================
  // Message Methods
  // ========================================================================

  sendMessage(data: SendMessageRequest): void {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.emit('message:send', data);
  }

  cancelMessage(sessionId: string): void {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.emit('message:cancel', sessionId);
  }
}

// Singleton instance
export const socketService = new SocketService();
