import React, { useEffect, useRef } from 'react';
import { MessageSquarePlus, Sparkles } from 'lucide-react';
import { useSessionsStore } from '@/store/sessions';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Button } from '@/components/common/Button';
import type { Message } from '@/types';

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    currentSessionId,
    messages,
    streamingMessages,
    sessions,
    isSending,
    sendMessage,
    cancelMessage,
    createSession,
  } = useSessionsStore();

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const currentMessages = currentSessionId ? messages.get(currentSessionId) ?? [] : [];
  const streamingMessage = currentSessionId ? streamingMessages.get(currentSessionId) : undefined;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, streamingMessage?.content]);

  // Create streaming message object for display
  const streamingMessageObj: Message | undefined = streamingMessage
    ? {
        id: streamingMessage.id,
        sessionId: currentSessionId!,
        role: 'assistant',
        content: streamingMessage.content,
        toolExecutions: streamingMessage.toolExecutions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isStreaming: true,
      }
    : undefined;

  const handleNewChat = async () => {
    await createSession();
  };

  // Empty state - no session selected
  if (!currentSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-claude-orange to-claude-orange-dark flex items-center justify-center mb-6">
          <Sparkles size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-dark-100 mb-2">
          Welcome to Claude Console
        </h2>
        <p className="text-dark-400 mb-6 max-w-md">
          Start a new conversation to begin working with Claude. Your conversations are saved locally and can be resumed anytime.
        </p>
        <Button onClick={handleNewChat} leftIcon={<MessageSquarePlus size={18} />}>
          Start New Conversation
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-dark-800">
        <div>
          <h1 className="text-lg font-semibold text-dark-100">
            {currentSession?.name ?? 'Conversation'}
          </h1>
          <p className="text-sm text-dark-500">
            {currentSession?.workingDirectory}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {currentMessages.length === 0 && !streamingMessage ? (
          // Empty conversation state
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center mb-4">
              <MessageSquarePlus size={24} className="text-dark-400" />
            </div>
            <h3 className="text-lg font-medium text-dark-200 mb-2">
              Start the conversation
            </h3>
            <p className="text-dark-500 max-w-sm">
              Ask Claude to help with code, explain concepts, fix bugs, or build features.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {currentMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming message */}
            {streamingMessageObj && (
              <MessageBubble
                message={streamingMessageObj}
                isStreaming={true}
                streamingContent={streamingMessage?.content}
                streamingTools={streamingMessage?.toolExecutions}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-dark-800">
        <div className="max-w-4xl mx-auto">
          <MessageInput
            onSend={sendMessage}
            onCancel={cancelMessage}
            isSending={isSending}
            disabled={!currentSessionId}
          />
        </div>
      </div>
    </div>
  );
};
