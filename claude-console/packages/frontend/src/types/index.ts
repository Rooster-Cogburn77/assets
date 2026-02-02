// ============================================================================
// Core Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';
export type ToolExecutionStatus = 'pending' | 'running' | 'completed' | 'error';
export type ToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task'
  | 'TodoWrite'
  | 'NotebookEdit'
  | 'Unknown';

export interface ToolExecution {
  id: string;
  type: ToolType;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: ToolExecutionStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolExecutions?: ToolExecution[];
  createdAt: number;
  updatedAt: number;
  isStreaming?: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'active' | 'idle' | 'archived';

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  messageCount: number;
  claudeSessionId?: string;
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export interface MessageStartEvent {
  messageId: string;
  sessionId: string;
  role: MessageRole;
  createdAt: number;
}

export interface MessageStreamEvent {
  messageId: string;
  sessionId: string;
  delta: string;
  fullContent: string;
}

export interface MessageCompleteEvent {
  message: Message;
  sessionId: string;
}

export interface MessageErrorEvent {
  sessionId: string;
  messageId?: string;
  error: string;
  code?: string;
}

export interface ToolStartEvent {
  messageId: string;
  sessionId: string;
  tool: ToolExecution;
}

export interface ToolUpdateEvent {
  messageId: string;
  sessionId: string;
  toolId: string;
  status: ToolExecutionStatus;
  output?: string;
}

export interface ToolCompleteEvent {
  messageId: string;
  sessionId: string;
  tool: ToolExecution;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  claudeAvailable: boolean;
  timestamp: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface CreateSessionRequest {
  name?: string;
  workingDirectory?: string;
}

export interface RenameSessionRequest {
  sessionId: string;
  name: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  allowedTools?: string[];
}

export interface SessionResponse extends BaseResponse {
  session?: Session;
}

export interface SessionListResponse extends BaseResponse {
  sessions?: Session[];
}

export interface SessionDetailResponse extends BaseResponse {
  session?: SessionWithMessages;
}

// ============================================================================
// UI State Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  settingsOpen: boolean;
}
