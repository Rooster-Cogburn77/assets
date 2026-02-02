import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type {
  Message,
  ToolExecution,
  ToolType,
  ToolExecutionStatus,
} from '../types/index.js';

const logger = createLogger('ClaudeService');

// ============================================================================
// Types
// ============================================================================

interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    id?: string;
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  event?: {
    type?: string;
    index?: number;
    delta?: {
      type?: string;
      text?: string;
      partial_json?: string;
    };
    content_block?: {
      type?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    };
  };
  result?: string;
  duration_ms?: number;
  num_turns?: number;
}

interface ActiveSession {
  process: ChildProcess;
  claudeSessionId?: string;
  abortController: AbortController;
}

// ============================================================================
// Claude Service
// ============================================================================

export class ClaudeService extends EventEmitter {
  private activeSessions: Map<string, ActiveSession> = new Map();

  constructor() {
    super();
  }

  async sendMessage(
    sessionId: string,
    content: string,
    options: {
      workingDirectory: string;
      resumeSessionId?: string;
      allowedTools?: string[];
    }
  ): Promise<void> {
    // Cancel any existing process for this session
    this.cancelSession(sessionId);

    const messageId = uuidv4();
    const abortController = new AbortController();

    const args = this.buildClaudeArgs(content, options);

    logger.info('Starting Claude process', {
      sessionId,
      messageId,
      workingDirectory: options.workingDirectory,
      resume: options.resumeSessionId ? 'yes' : 'no',
    });

    const process = spawn(config.claudePath, args, {
      cwd: options.workingDirectory,
      env: {
        ...process.env,
        FORCE_COLOR: '0', // Disable color codes in output
      },
      signal: abortController.signal,
    });

    this.activeSessions.set(sessionId, {
      process,
      claudeSessionId: options.resumeSessionId,
      abortController,
    });

    let fullContent = '';
    let claudeSessionId: string | undefined = options.resumeSessionId;
    let buffer = '';
    const toolExecutions: Map<string, ToolExecution> = new Map();
    const toolContentBuffer: Map<string, string> = new Map();

    // Emit message start
    this.emit('message:start', {
      messageId,
      sessionId,
      role: 'assistant',
      createdAt: Date.now(),
    });

    process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as ClaudeStreamEvent;
          this.processStreamEvent(
            event,
            sessionId,
            messageId,
            fullContent,
            claudeSessionId,
            toolExecutions,
            toolContentBuffer,
            (newContent) => {
              fullContent = newContent;
            },
            (newSessionId) => {
              claudeSessionId = newSessionId;
              const activeSession = this.activeSessions.get(sessionId);
              if (activeSession) {
                activeSession.claudeSessionId = newSessionId;
              }
            }
          );
        } catch (e) {
          // Not JSON or parse error - might be regular output
          logger.debug('Non-JSON output from Claude', { line });
        }
      }
    });

    process.stderr?.on('data', (data: Buffer) => {
      const stderr = data.toString();
      logger.warn('Claude stderr', { sessionId, stderr });
    });

    process.on('close', (code) => {
      logger.info('Claude process exited', { sessionId, messageId, code });

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as ClaudeStreamEvent;
          this.processStreamEvent(
            event,
            sessionId,
            messageId,
            fullContent,
            claudeSessionId,
            toolExecutions,
            toolContentBuffer,
            (newContent) => {
              fullContent = newContent;
            },
            (newSessionId) => {
              claudeSessionId = newSessionId;
            }
          );
        } catch {
          // Ignore
        }
      }

      // Emit message complete
      const message: Message = {
        id: messageId,
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolExecutions: Array.from(toolExecutions.values()),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.emit('message:complete', {
        message,
        sessionId,
        claudeSessionId,
      });

      this.activeSessions.delete(sessionId);
    });

    process.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR') {
        logger.info('Claude process aborted', { sessionId });
        return;
      }

      logger.error('Claude process error', { sessionId, error: error.message });

      this.emit('message:error', {
        sessionId,
        messageId,
        error: error.message,
        code: 'PROCESS_ERROR',
      });

      this.activeSessions.delete(sessionId);
    });
  }

  private processStreamEvent(
    event: ClaudeStreamEvent,
    sessionId: string,
    messageId: string,
    currentContent: string,
    _claudeSessionId: string | undefined,
    toolExecutions: Map<string, ToolExecution>,
    toolContentBuffer: Map<string, string>,
    updateContent: (content: string) => void,
    updateClaudeSessionId: (sessionId: string) => void
  ): void {
    // Handle init event - get session ID
    if (event.type === 'message' && event.subtype === 'init' && event.session_id) {
      updateClaudeSessionId(event.session_id);
      this.emit('session:updated', { sessionId, claudeSessionId: event.session_id });
    }

    // Handle stream events
    if (event.type === 'stream_event' && event.event) {
      const streamEvent = event.event;

      // Content block start - could be text or tool use
      if (streamEvent.type === 'content_block_start' && streamEvent.content_block) {
        const block = streamEvent.content_block;

        if (block.type === 'tool_use' && block.id && block.name) {
          const toolExecution: ToolExecution = {
            id: block.id,
            type: this.mapToolName(block.name),
            name: block.name,
            input: {},
            status: 'pending',
            startedAt: Date.now(),
          };
          toolExecutions.set(block.id, toolExecution);
          toolContentBuffer.set(block.id, '');

          this.emit('tool:start', {
            messageId,
            sessionId,
            tool: toolExecution,
          });
        }
      }

      // Content delta - text or tool input
      if (streamEvent.type === 'content_block_delta' && streamEvent.delta) {
        const delta = streamEvent.delta;

        if (delta.type === 'text_delta' && delta.text) {
          const newContent = currentContent + delta.text;
          updateContent(newContent);

          this.emit('message:stream', {
            messageId,
            sessionId,
            delta: delta.text,
            fullContent: newContent,
          });
        }

        if (delta.type === 'input_json_delta' && delta.partial_json) {
          // Find the current tool by index
          const toolId = Array.from(toolExecutions.keys())[toolExecutions.size - 1];
          if (toolId) {
            const currentBuffer = toolContentBuffer.get(toolId) ?? '';
            toolContentBuffer.set(toolId, currentBuffer + delta.partial_json);
          }
        }
      }

      // Content block stop - finalize tool
      if (streamEvent.type === 'content_block_stop') {
        // Find the most recent tool and update its input
        const toolId = Array.from(toolExecutions.keys())[toolExecutions.size - 1];
        if (toolId) {
          const tool = toolExecutions.get(toolId);
          const inputJson = toolContentBuffer.get(toolId);

          if (tool && inputJson) {
            try {
              tool.input = JSON.parse(inputJson);
              tool.status = 'running';
              toolExecutions.set(toolId, tool);

              this.emit('tool:update', {
                messageId,
                sessionId,
                toolId: tool.id,
                status: 'running' as ToolExecutionStatus,
              });
            } catch {
              // Invalid JSON, keep empty input
            }
          }
        }
      }
    }

    // Handle result event (tool results come back in content)
    if (event.type === 'result') {
      // Mark all pending tools as completed
      for (const [id, tool] of toolExecutions) {
        if (tool.status === 'running' || tool.status === 'pending') {
          tool.status = 'completed';
          tool.completedAt = Date.now();
          toolExecutions.set(id, tool);

          this.emit('tool:complete', {
            messageId,
            sessionId,
            tool,
          });
        }
      }
    }
  }

  private mapToolName(name: string): ToolType {
    const toolMap: Record<string, ToolType> = {
      Read: 'Read',
      Write: 'Write',
      Edit: 'Edit',
      Bash: 'Bash',
      Glob: 'Glob',
      Grep: 'Grep',
      WebFetch: 'WebFetch',
      WebSearch: 'WebSearch',
      Task: 'Task',
      TodoWrite: 'TodoWrite',
      NotebookEdit: 'NotebookEdit',
    };
    return toolMap[name] ?? 'Unknown';
  }

  private buildClaudeArgs(content: string, options: {
    resumeSessionId?: string;
    allowedTools?: string[];
  }): string[] {
    const args = [
      '-p', content,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    return args;
  }

  cancelSession(sessionId: string): void {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      logger.info('Cancelling session', { sessionId });
      activeSession.abortController.abort();
      activeSession.process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
    }
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  getClaudeSessionId(sessionId: string): string | undefined {
    return this.activeSessions.get(sessionId)?.claudeSessionId;
  }
}

// Singleton instance
export const claudeService = new ClaudeService();
