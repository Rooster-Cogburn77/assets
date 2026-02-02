import React, { useState } from 'react';
import {
  FileText,
  FilePlus,
  Edit3,
  Terminal,
  Search,
  FileSearch,
  Globe,
  ListTodo,
  CheckSquare,
  BookOpen,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { cn, getFileName, truncate } from '@/utils';
import type { ToolExecution } from '@/types';

interface ToolCardProps {
  tool: ToolExecution;
  className?: string;
}

const toolIcons: Record<string, React.ReactNode> = {
  Read: <FileText size={16} />,
  Write: <FilePlus size={16} />,
  Edit: <Edit3 size={16} />,
  Bash: <Terminal size={16} />,
  Glob: <Search size={16} />,
  Grep: <FileSearch size={16} />,
  WebFetch: <Globe size={16} />,
  WebSearch: <Globe size={16} />,
  Task: <ListTodo size={16} />,
  TodoWrite: <CheckSquare size={16} />,
  NotebookEdit: <BookOpen size={16} />,
  Unknown: <HelpCircle size={16} />,
};

const toolColors: Record<string, string> = {
  Read: 'text-blue-400',
  Write: 'text-green-400',
  Edit: 'text-yellow-400',
  Bash: 'text-purple-400',
  Glob: 'text-cyan-400',
  Grep: 'text-cyan-400',
  WebFetch: 'text-orange-400',
  WebSearch: 'text-orange-400',
  Task: 'text-pink-400',
  TodoWrite: 'text-emerald-400',
  NotebookEdit: 'text-indigo-400',
  Unknown: 'text-gray-400',
};

export const ToolCard: React.FC<ToolCardProps> = ({ tool, className }) => {
  const [expanded, setExpanded] = useState(false);

  const icon = toolIcons[tool.type] ?? toolIcons.Unknown;
  const color = toolColors[tool.type] ?? toolColors.Unknown;

  const getStatusIndicator = () => {
    switch (tool.status) {
      case 'pending':
      case 'running':
        return <Loader2 size={14} className="animate-spin text-claude-orange" />;
      case 'completed':
        return <Check size={14} className="text-green-400" />;
      case 'error':
        return <X size={14} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getToolSummary = () => {
    const input = tool.input;

    switch (tool.type) {
      case 'Read':
        return input.file_path ? getFileName(String(input.file_path)) : 'Reading file...';
      case 'Write':
        return input.file_path ? `Writing ${getFileName(String(input.file_path))}` : 'Writing file...';
      case 'Edit':
        return input.file_path ? `Editing ${getFileName(String(input.file_path))}` : 'Editing file...';
      case 'Bash':
        return input.command ? truncate(String(input.command), 50) : 'Running command...';
      case 'Glob':
        return input.pattern ? `Pattern: ${input.pattern}` : 'Searching files...';
      case 'Grep':
        return input.pattern ? `Pattern: ${input.pattern}` : 'Searching content...';
      case 'WebFetch':
        return input.url ? truncate(String(input.url), 50) : 'Fetching URL...';
      case 'WebSearch':
        return input.query ? `"${input.query}"` : 'Searching web...';
      case 'Task':
        return input.description ? String(input.description) : 'Running task...';
      default:
        return tool.name;
    }
  };

  const borderClass = {
    pending: 'border-l-dark-500',
    running: 'border-l-claude-orange',
    completed: 'border-l-green-500',
    error: 'border-l-red-500',
  }[tool.status];

  const hasDetails = tool.output || Object.keys(tool.input).length > 0;

  return (
    <div
      className={cn(
        'bg-dark-800/50 border border-dark-700 border-l-2 rounded-lg overflow-hidden',
        borderClass,
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 text-left',
          hasDetails && 'hover:bg-dark-700/50 cursor-pointer'
        )}
        disabled={!hasDetails}
      >
        <span className={color}>{icon}</span>
        <span className="flex-1 text-sm text-dark-200 truncate">
          {getToolSummary()}
        </span>
        <div className="flex items-center gap-2">
          {getStatusIndicator()}
          {hasDetails && (
            <span className="text-dark-500">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && hasDetails && (
        <div className="px-3 pb-3 pt-1 border-t border-dark-700/50">
          {/* Input */}
          {Object.keys(tool.input).length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-dark-500 mb-1">Input</div>
              <pre className="text-xs text-dark-300 bg-dark-900/50 rounded p-2 overflow-x-auto">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {tool.output && (
            <div>
              <div className="text-xs text-dark-500 mb-1">Output</div>
              <pre className="text-xs text-dark-300 bg-dark-900/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {tool.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {tool.error && (
            <div>
              <div className="text-xs text-red-400 mb-1">Error</div>
              <pre className="text-xs text-red-300 bg-red-950/30 rounded p-2 overflow-x-auto">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
