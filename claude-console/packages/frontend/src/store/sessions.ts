import { create } from 'zustand';
import { socketService } from '@/services/socket';
import type { Session, Message, ToolExecution, SessionWithMessages } from '@/types';

interface StreamingMessage {
  id: string;
  content: string;
  toolExecutions: ToolExecution[];
}

interface SessionsState {
  // Data - using objects instead of Maps for better Zustand compatibility
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  streamingMessages: Record<string, StreamingMessage>;

  // Status
  isLoading: boolean;
  isConnected: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  loadSessions: () => Promise<void>;
  createSession: (name?: string, workingDirectory?: string) => Promise<Session>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  sendMessage: (content: string) => void;
  cancelMessage: () => void;
  clearError: () => void;
}

// Track in-flight session requests to prevent race conditions
let pendingSessionRequest: string | null = null;

export const useSessionsStore = create<SessionsState>((set, get) => {
  const setupSocketHandlers = () => {
    socketService.on('connection:status', (data) => {
      set({ isConnected: data.connected });
    });

    socketService.on('message:start', (data) => {
      const { sessionId, messageId } = data;
      set((state) => ({
        streamingMessages: {
          ...state.streamingMessages,
          [sessionId]: { id: messageId, content: '', toolExecutions: [] },
        },
        isSending: true,
      }));
    });

    socketService.on('message:stream', (data) => {
      const { sessionId, fullContent } = data;
      set((state) => {
        const current = state.streamingMessages[sessionId];
        if (!current) return state;
        return {
          streamingMessages: {
            ...state.streamingMessages,
            [sessionId]: { ...current, content: fullContent },
          },
        };
      });
    });

    socketService.on('message:complete', (data) => {
      const { message, sessionId } = data;
      set((state) => {
        const { [sessionId]: _, ...restStreaming } = state.streamingMessages;
        const sessionMessages = state.messages[sessionId] ?? [];

        return {
          messages: {
            ...state.messages,
            [sessionId]: [...sessionMessages, message],
          },
          streamingMessages: restStreaming,
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messageCount: s.messageCount + 1, lastMessageAt: message.createdAt, updatedAt: Date.now() }
              : s
          ),
          isSending: false,
        };
      });
    });

    socketService.on('message:error', (data) => {
      const { sessionId, error } = data;
      set((state) => {
        const { [sessionId]: _, ...restStreaming } = state.streamingMessages;
        return {
          streamingMessages: restStreaming,
          isSending: false,
          error,
        };
      });
    });

    socketService.on('tool:start', (data) => {
      const { sessionId, tool } = data;
      set((state) => {
        const current = state.streamingMessages[sessionId];
        if (!current) return state;
        return {
          streamingMessages: {
            ...state.streamingMessages,
            [sessionId]: {
              ...current,
              toolExecutions: [...current.toolExecutions, tool],
            },
          },
        };
      });
    });

    socketService.on('tool:update', (data) => {
      const { sessionId, toolId, status, output } = data;
      set((state) => {
        const current = state.streamingMessages[sessionId];
        if (!current) return state;
        return {
          streamingMessages: {
            ...state.streamingMessages,
            [sessionId]: {
              ...current,
              toolExecutions: current.toolExecutions.map((t) =>
                t.id === toolId ? { ...t, status, output: output ?? t.output } : t
              ),
            },
          },
        };
      });
    });

    socketService.on('tool:complete', (data) => {
      const { sessionId, tool } = data;
      set((state) => {
        const current = state.streamingMessages[sessionId];
        if (!current) return state;
        return {
          streamingMessages: {
            ...state.streamingMessages,
            [sessionId]: {
              ...current,
              toolExecutions: current.toolExecutions.map((t) =>
                t.id === tool.id ? tool : t
              ),
            },
          },
        };
      });
    });
  };

  return {
    sessions: [],
    currentSessionId: null,
    messages: {},
    streamingMessages: {},
    isLoading: false,
    isConnected: false,
    isSending: false,
    error: null,

    connect: async () => {
      try {
        set({ isLoading: true, error: null });
        await socketService.connect();
        setupSocketHandlers();
        set({ isConnected: true, isLoading: false });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to connect',
        });
        throw error;
      }
    },

    disconnect: () => {
      socketService.disconnect();
      set({ isConnected: false });
    },

    loadSessions: async () => {
      try {
        set({ isLoading: true, error: null });
        const sessions = await socketService.listSessions();
        set({ sessions, isLoading: false });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load sessions',
        });
      }
    },

    createSession: async (name?: string, workingDirectory?: string) => {
      try {
        set({ isLoading: true, error: null });
        const session = await socketService.createSession({ name, workingDirectory });
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          isLoading: false,
        }));
        return session;
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create session',
        });
        throw error;
      }
    },

    selectSession: async (sessionId: string) => {
      const state = get();

      // If we already have messages for this session, just select it
      if (state.messages[sessionId]) {
        set({ currentSessionId: sessionId });
        return;
      }

      // Track this request to prevent race conditions
      pendingSessionRequest = sessionId;

      try {
        set({ isLoading: true, error: null, currentSessionId: sessionId });
        const sessionWithMessages: SessionWithMessages = await socketService.getSession(sessionId);

        // Only apply if this is still the pending request (prevents race condition)
        if (pendingSessionRequest !== sessionId) {
          return;
        }

        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: sessionWithMessages.messages,
          },
          isLoading: false,
        }));
      } catch (error) {
        // Only show error if this is still the active request
        if (pendingSessionRequest === sessionId) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load session',
          });
        }
      }
    },

    deleteSession: async (sessionId: string) => {
      try {
        await socketService.deleteSession(sessionId);
        set((state) => {
          const { [sessionId]: _msgs, ...restMessages } = state.messages;
          const { [sessionId]: _stream, ...restStreaming } = state.streamingMessages;

          return {
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            messages: restMessages,
            streamingMessages: restStreaming,
            currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          };
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to delete session',
        });
      }
    },

    renameSession: async (sessionId: string, name: string) => {
      try {
        const updated = await socketService.renameSession(sessionId, name);
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to rename session',
        });
      }
    },

    sendMessage: (content: string) => {
      const { currentSessionId, isSending } = get();
      if (!currentSessionId || isSending) return;

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [currentSessionId]: [...(state.messages[currentSessionId] ?? []), userMessage],
        },
        isSending: true,
      }));

      socketService.sendMessage({ sessionId: currentSessionId, content });
    },

    cancelMessage: () => {
      const { currentSessionId } = get();
      if (currentSessionId) {
        socketService.cancelMessage(currentSessionId);
        set((state) => {
          const { [currentSessionId]: _, ...restStreaming } = state.streamingMessages;
          return { streamingMessages: restStreaming, isSending: false };
        });
      }
    },

    clearError: () => set({ error: null }),
  };
});
