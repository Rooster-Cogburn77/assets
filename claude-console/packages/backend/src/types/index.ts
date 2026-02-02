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

export interface ClientToServerEvents {
  'session:create': (data: CreateSessionRequest, callback: (response: SessionResponse) => void) => void;
  'session:list': (callback: (response: SessionListResponse) => void) => void;
  'session:get': (sessionId: string, callback: (response: SessionDetailResponse) => void) => void;
  'session:delete': (sessionId: string, callback: (response: BaseResponse) => void) => void;
  'session:rename': (data: RenameSessionRequest, callback: (response: SessionResponse) => void) => void;
  'message:send': (data: SendMessageRequest) => void;
  'message:cancel': (sessionId: string) => void;
}

export interface ServerToClientEvents {
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

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  connectedAt: number;
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
// WebSocket Event Payloads
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
// Database Types
// ============================================================================

export interface DbSession {
  id: string;
  name: string;
  status: string;
  working_directory: string;
  created_at: number;
  updated_at: number;
  last_message_at: number | null;
  message_count: number;
  claude_session_id: string | null;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_executions: string | null;
  created_at: number;
  updated_at: number;
}
