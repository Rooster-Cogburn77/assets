import { create } from 'zustand';
import { socketService } from '@/services/socket';
import type { Session, Message, ToolExecution, SessionWithMessages } from '@/types';

interface StreamingMessage {
  id: string;
  content: string;
  toolExecutions: ToolExecution[];
}

interface SessionsState {
  // Data
  sessions: Session[];
  currentSessionId: string | null;
  messages: Map<string, Message[]>;
  streamingMessages: Map<string, StreamingMessage>;

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

export const useSessionsStore = create<SessionsState>((set, get) => {
  // Set up socket event handlers
  const setupSocketHandlers = () => {
    socketService.on('connection:status', (data) => {
      set({ isConnected: data.connected });
    });

    socketService.on('message:start', (data) => {
      const { sessionId, messageId } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        newStreamingMessages.set(sessionId, {
          id: messageId,
          content: '',
          toolExecutions: [],
        });
        return { streamingMessages: newStreamingMessages, isSending: true };
      });
    });

    socketService.on('message:stream', (data) => {
      const { sessionId, fullContent } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        const current = newStreamingMessages.get(sessionId);
        if (current) {
          newStreamingMessages.set(sessionId, {
            ...current,
            content: fullContent,
          });
        }
        return { streamingMessages: newStreamingMessages };
      });
    });

    socketService.on('message:complete', (data) => {
      const { message, sessionId } = data;
      set((state) => {
        // Add the completed message to the messages map
        const newMessages = new Map(state.messages);
        const sessionMessages = newMessages.get(sessionId) ?? [];
        newMessages.set(sessionId, [...sessionMessages, message]);

        // Clear streaming state
        const newStreamingMessages = new Map(state.streamingMessages);
        newStreamingMessages.delete(sessionId);

        // Update session in the list
        const newSessions = state.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, messageCount: s.messageCount + 1, lastMessageAt: message.createdAt, updatedAt: Date.now() }
            : s
        );

        return {
          messages: newMessages,
          streamingMessages: newStreamingMessages,
          sessions: newSessions,
          isSending: false,
        };
      });
    });

    socketService.on('message:error', (data) => {
      const { sessionId, error } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        newStreamingMessages.delete(sessionId);
        return {
          streamingMessages: newStreamingMessages,
          isSending: false,
          error,
        };
      });
    });

    socketService.on('tool:start', (data) => {
      const { sessionId, tool } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        const current = newStreamingMessages.get(sessionId);
        if (current) {
          newStreamingMessages.set(sessionId, {
            ...current,
            toolExecutions: [...current.toolExecutions, tool],
          });
        }
        return { streamingMessages: newStreamingMessages };
      });
    });

    socketService.on('tool:update', (data) => {
      const { sessionId, toolId, status, output } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        const current = newStreamingMessages.get(sessionId);
        if (current) {
          const updatedTools = current.toolExecutions.map((t) =>
            t.id === toolId ? { ...t, status, output: output ?? t.output } : t
          );
          newStreamingMessages.set(sessionId, {
            ...current,
            toolExecutions: updatedTools,
          });
        }
        return { streamingMessages: newStreamingMessages };
      });
    });

    socketService.on('tool:complete', (data) => {
      const { sessionId, tool } = data;
      set((state) => {
        const newStreamingMessages = new Map(state.streamingMessages);
        const current = newStreamingMessages.get(sessionId);
        if (current) {
          const updatedTools = current.toolExecutions.map((t) =>
            t.id === tool.id ? tool : t
          );
          newStreamingMessages.set(sessionId, {
            ...current,
            toolExecutions: updatedTools,
          });
        }
        return { streamingMessages: newStreamingMessages };
      });
    });
  };

  return {
    // Initial state
    sessions: [],
    currentSessionId: null,
    messages: new Map(),
    streamingMessages: new Map(),
    isLoading: false,
    isConnected: false,
    isSending: false,
    error: null,

    // Actions
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
      if (state.messages.has(sessionId)) {
        set({ currentSessionId: sessionId });
        return;
      }

      try {
        set({ isLoading: true, error: null });
        const sessionWithMessages: SessionWithMessages = await socketService.getSession(sessionId);

        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(sessionId, sessionWithMessages.messages);
          return {
            messages: newMessages,
            currentSessionId: sessionId,
            isLoading: false,
          };
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load session',
        });
      }
    },

    deleteSession: async (sessionId: string) => {
      try {
        await socketService.deleteSession(sessionId);
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.delete(sessionId);

          const newStreamingMessages = new Map(state.streamingMessages);
          newStreamingMessages.delete(sessionId);

          return {
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            messages: newMessages,
            streamingMessages: newStreamingMessages,
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

      // Add user message immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((state) => {
        const newMessages = new Map(state.messages);
        const sessionMessages = newMessages.get(currentSessionId) ?? [];
        newMessages.set(currentSessionId, [...sessionMessages, userMessage]);
        return { messages: newMessages, isSending: true };
      });

      socketService.sendMessage({ sessionId: currentSessionId, content });
    },

    cancelMessage: () => {
      const { currentSessionId } = get();
      if (currentSessionId) {
        socketService.cancelMessage(currentSessionId);
        set((state) => {
          const newStreamingMessages = new Map(state.streamingMessages);
          newStreamingMessages.delete(currentSessionId);
          return { streamingMessages: newStreamingMessages, isSending: false };
        });
      }
    },

    clearError: () => set({ error: null }),
  };
});
