import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot } from 'lucide-react';
import { cn, formatRelativeTime } from '@/utils';
import { CodeBlock } from '@/components/common/CodeBlock';
import { ToolCard } from '@/components/tools/ToolCard';
import type { Message, ToolExecution } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
  streamingTools?: ToolExecution[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  streamingContent,
  streamingTools,
}) => {
  const isUser = message.role === 'user';
  const content = isStreaming && streamingContent !== undefined ? streamingContent : message.content;
  const tools = isStreaming && streamingTools ? streamingTools : message.toolExecutions;

  // Memoize markdown components to prevent re-renders
  const markdownComponents = useMemo(
    () => ({
      code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
        const match = /language-(\w+)/.exec(className ?? '');
        const codeContent = String(children).replace(/\n$/, '');

        // Check if this is an inline code or a code block
        const isInline = !match && !codeContent.includes('\n');

        if (isInline) {
          return (
            <code
              className="bg-dark-800 text-claude-orange-light px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }

        return (
          <CodeBlock
            code={codeContent}
            language={match?.[1] ?? 'text'}
            showLineNumbers={codeContent.split('\n').length > 3}
          />
        );
      },
      pre: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      p: ({ children }: { children: React.ReactNode }) => (
        <p className="mb-3 last:mb-0">{children}</p>
      ),
      ul: ({ children }: { children: React.ReactNode }) => (
        <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>
      ),
      ol: ({ children }: { children: React.ReactNode }) => (
        <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>
      ),
      li: ({ children }: { children: React.ReactNode }) => (
        <li className="text-dark-200">{children}</li>
      ),
      a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-claude-orange hover:text-claude-orange-light underline underline-offset-2"
        >
          {children}
        </a>
      ),
      blockquote: ({ children }: { children: React.ReactNode }) => (
        <blockquote className="border-l-4 border-dark-600 pl-4 italic text-dark-400 my-3">
          {children}
        </blockquote>
      ),
      h1: ({ children }: { children: React.ReactNode }) => (
        <h1 className="text-xl font-semibold text-dark-100 mt-4 mb-2">{children}</h1>
      ),
      h2: ({ children }: { children: React.ReactNode }) => (
        <h2 className="text-lg font-semibold text-dark-100 mt-4 mb-2">{children}</h2>
      ),
      h3: ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-base font-semibold text-dark-100 mt-3 mb-2">{children}</h3>
      ),
      table: ({ children }: { children: React.ReactNode }) => (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse border border-dark-700">
            {children}
          </table>
        </div>
      ),
      th: ({ children }: { children: React.ReactNode }) => (
        <th className="border border-dark-700 bg-dark-800 px-4 py-2 text-left font-medium">
          {children}
        </th>
      ),
      td: ({ children }: { children: React.ReactNode }) => (
        <td className="border border-dark-700 px-4 py-2">{children}</td>
      ),
    }),
    []
  );

  return (
    <div
      className={cn(
        'flex gap-4 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
          isUser ? 'bg-claude-orange' : 'bg-dark-700'
        )}
      >
        {isUser ? (
          <User size={18} className="text-white" />
        ) : (
          <Bot size={18} className="text-dark-300" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-3xl', isUser && 'flex flex-col items-end')}>
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-dark-700 rounded-br-md'
              : 'bg-transparent'
          )}
        >
          {/* Tool executions (for assistant) */}
          {!isUser && tools && tools.length > 0 && (
            <div className="space-y-2 mb-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}

          {/* Message content */}
          {content && (
            <div className={cn('markdown-content text-dark-200', isUser && 'text-dark-100')}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !content && (
            <div className="typing-indicator py-2">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs text-dark-500 mt-1 px-1',
            isUser && 'text-right'
          )}
        >
          {formatRelativeTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
};
