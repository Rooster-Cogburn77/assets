import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import type {
  Message,
  ToolExecution,
  ToolType,
} from '../types/index.js';

const PROCESS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max per request

// ============================================================================
// Types
// ============================================================================

interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
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
    };
  };
  result?: string;
}

interface ActiveSession {
  process: ChildProcess;
  claudeSessionId?: string;
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
}

interface StreamContext {
  sessionId: string;
  messageId: string;
  content: string;
  claudeSessionId?: string;
  tools: Map<string, ToolExecution>;
  toolInputBuffers: Map<string, string>;
  currentToolIndex: number;
}

// ============================================================================
// Claude Service
// ============================================================================

export class ClaudeService extends EventEmitter {
  private activeSessions = new Map<string, ActiveSession>();

  sendMessage(
    sessionId: string,
    content: string,
    options: {
      workingDirectory: string;
      resumeSessionId?: string;
      allowedTools?: string[];
    }
  ): void {
    this.cancelSession(sessionId);

    const messageId = uuidv4();
    const abortController = new AbortController();

    const args = this.buildArgs(content, options);

    const proc = spawn(config.claudePath, args, {
      cwd: options.workingDirectory,
      env: { ...process.env, FORCE_COLOR: '0' },
      signal: abortController.signal,
    });

    // Timeout - kill process if it takes too long
    const timeoutId = setTimeout(() => {
      console.error(`[Claude] Process timeout after ${PROCESS_TIMEOUT_MS}ms`, { sessionId });
      this.cancelSession(sessionId);
      this.emit('message:error', {
        sessionId,
        messageId,
        error: 'Request timed out',
        code: 'TIMEOUT',
      });
    }, PROCESS_TIMEOUT_MS);

    this.activeSessions.set(sessionId, {
      process: proc,
      claudeSessionId: options.resumeSessionId,
      abortController,
      timeoutId,
    });

    const ctx: StreamContext = {
      sessionId,
      messageId,
      content: '',
      claudeSessionId: options.resumeSessionId,
      tools: new Map(),
      toolInputBuffers: new Map(),
      currentToolIndex: -1,
    };

    this.emit('message:start', {
      messageId,
      sessionId,
      role: 'assistant',
      createdAt: Date.now(),
    });

    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        this.processLine(line, ctx);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      console.warn(`[Claude] stderr:`, data.toString());
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      // Process remaining buffer
      if (buffer.trim()) {
        this.processLine(buffer, ctx);
      }

      // Mark any running tools as completed
      for (const tool of ctx.tools.values()) {
        if (tool.status === 'running' || tool.status === 'pending') {
          tool.status = 'completed';
          tool.completedAt = Date.now();
        }
      }

      const message: Message = {
        id: messageId,
        sessionId,
        role: 'assistant',
        content: ctx.content,
        toolExecutions: Array.from(ctx.tools.values()),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.emit('message:complete', {
        message,
        sessionId,
        claudeSessionId: ctx.claudeSessionId,
      });

      this.activeSessions.delete(sessionId);
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);

      if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR') {
        return; // Expected on cancel
      }

      console.error(`[Claude] Process error:`, error.message);
      this.emit('message:error', {
        sessionId,
        messageId,
        error: error.message,
        code: 'PROCESS_ERROR',
      });

      this.activeSessions.delete(sessionId);
    });
  }

  private processLine(line: string, ctx: StreamContext): void {
    let event: ClaudeStreamEvent;
    try {
      event = JSON.parse(line);
    } catch (err) {
      // Log non-JSON lines at debug level - these are expected sometimes
      if (line.trim()) {
        console.debug(`[Claude] Non-JSON output: ${line.slice(0, 100)}`);
      }
      return;
    }

    // Session init
    if (event.type === 'message' && event.subtype === 'init' && event.session_id) {
      ctx.claudeSessionId = event.session_id;
      const session = this.activeSessions.get(ctx.sessionId);
      if (session) {
        session.claudeSessionId = event.session_id;
      }
    }

    // Result - mark tools complete
    if (event.type === 'result') {
      for (const tool of ctx.tools.values()) {
        if (tool.status !== 'completed') {
          tool.status = 'completed';
          tool.completedAt = Date.now();

          this.emit('tool:complete', {
            messageId: ctx.messageId,
            sessionId: ctx.sessionId,
            tool,
          });
        }
      }
      return;
    }

    if (event.type !== 'stream_event' || !event.event) return;

    const { type, index, delta, content_block } = event.event;

    // Tool start
    if (type === 'content_block_start' && content_block?.type === 'tool_use') {
      const toolId = content_block.id;
      const toolName = content_block.name;

      if (toolId && toolName) {
        ctx.currentToolIndex = index ?? -1;

        const tool: ToolExecution = {
          id: toolId,
          type: this.mapToolName(toolName),
          name: toolName,
          input: {},
          status: 'pending',
          startedAt: Date.now(),
        };

        ctx.tools.set(toolId, tool);
        ctx.toolInputBuffers.set(toolId, '');

        this.emit('tool:start', {
          messageId: ctx.messageId,
          sessionId: ctx.sessionId,
          tool,
        });
      }
    }

    // Text delta
    if (type === 'content_block_delta' && delta?.type === 'text_delta' && delta.text) {
      ctx.content += delta.text;
      this.emit('message:stream', {
        messageId: ctx.messageId,
        sessionId: ctx.sessionId,
        delta: delta.text,
        fullContent: ctx.content,
      });
    }

    // Tool input delta - use the event index to find the right tool
    if (type === 'content_block_delta' && delta?.type === 'input_json_delta' && delta.partial_json) {
      // Find tool by matching the current content block index
      const tool = Array.from(ctx.tools.values()).find((_, i) => i === ctx.tools.size - 1);
      if (tool) {
        const current = ctx.toolInputBuffers.get(tool.id) ?? '';
        ctx.toolInputBuffers.set(tool.id, current + delta.partial_json);
      }
    }

    // Content block stop - finalize tool input
    if (type === 'content_block_stop') {
      const tool = Array.from(ctx.tools.values()).pop();
      if (tool && tool.status === 'pending') {
        const inputJson = ctx.toolInputBuffers.get(tool.id);
        if (inputJson) {
          try {
            tool.input = JSON.parse(inputJson);
          } catch (err) {
            console.warn(`[Claude] Failed to parse tool input for ${tool.name}:`, err);
            tool.input = { _raw: inputJson, _parseError: true };
          }
        }
        tool.status = 'running';

        this.emit('tool:update', {
          messageId: ctx.messageId,
          sessionId: ctx.sessionId,
          toolId: tool.id,
          status: 'running',
        });
      }
    }
  }

  private mapToolName(name: string): ToolType {
    const map: Record<string, ToolType> = {
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
    return map[name] ?? 'Unknown';
  }

  private buildArgs(content: string, options: {
    resumeSessionId?: string;
    allowedTools?: string[];
  }): string[] {
    const args = ['-p', content, '--output-format', 'stream-json', '--verbose'];

    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    if (options.allowedTools?.length) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    return args;
  }

  cancelSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      clearTimeout(session.timeoutId);
      session.abortController.abort();
      session.process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
    }
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }
}

export const claudeService = new ClaudeService();
