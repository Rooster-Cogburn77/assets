import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Paperclip } from 'lucide-react';
import { cn } from '@/utils';
import { IconButton } from '@/components/common/IconButton';

interface MessageInputProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onCancel,
  disabled = false,
  isSending = false,
  placeholder = 'Message Claude...',
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled && !isSending) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    // Cancel on Escape
    if (e.key === 'Escape' && isSending) {
      onCancel();
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-end gap-2 bg-dark-800 border border-dark-700 rounded-xl p-3',
          'focus-within:ring-2 focus-within:ring-claude-orange focus-within:border-transparent',
          'transition-all duration-200',
          disabled && 'opacity-50'
        )}
      >
        {/* Attachment button (placeholder for future feature) */}
        <IconButton
          size="sm"
          variant="ghost"
          tooltip="Attach file (coming soon)"
          disabled
          className="mb-0.5"
        >
          <Paperclip size={18} />
        </IconButton>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 bg-transparent text-dark-100 placeholder-dark-500',
            'resize-none outline-none',
            'min-h-[24px] max-h-[200px]',
            'text-base leading-relaxed'
          )}
        />

        {/* Send/Cancel button */}
        {isSending ? (
          <IconButton
            size="sm"
            onClick={onCancel}
            tooltip="Cancel (Esc)"
            className="mb-0.5 text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <Square size={18} fill="currentColor" />
          </IconButton>
        ) : (
          <IconButton
            size="sm"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            tooltip="Send message (Enter)"
            className={cn(
              'mb-0.5',
              value.trim() && !disabled
                ? 'text-claude-orange hover:text-claude-orange-light hover:bg-claude-orange/10'
                : ''
            )}
          >
            <Send size={18} />
          </IconButton>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs text-dark-500">
        <span>
          <kbd className="px-1.5 py-0.5 bg-dark-800 rounded text-dark-400">Enter</kbd>
          {' '}to send
          {' '}&bull;{' '}
          <kbd className="px-1.5 py-0.5 bg-dark-800 rounded text-dark-400">Shift + Enter</kbd>
          {' '}for new line
        </span>
        {isSending && (
          <span className="text-claude-orange animate-pulse">
            Claude is thinking...
          </span>
        )}
      </div>
    </div>
  );
};
