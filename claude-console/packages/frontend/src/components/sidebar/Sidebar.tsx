import React from 'react';
import { Plus, Settings, PanelLeftClose, Search, Sparkles } from 'lucide-react';
import { useSessionsStore } from '@/store/sessions';
import { useUIStore } from '@/store/ui';
import { cn } from '@/utils';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { SessionItem } from './SessionItem';

export const Sidebar: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
  } = useSessionsStore();

  const { sidebarOpen, sidebarWidth, toggleSidebar, setSettingsOpen } = useUIStore();

  const handleNewSession = async () => {
    await createSession();
  };

  if (!sidebarOpen) {
    return (
      <div className="w-16 flex flex-col items-center py-4 bg-dark-900 border-r border-dark-800">
        <IconButton onClick={toggleSidebar} tooltip="Open sidebar" className="mb-4">
          <PanelLeftClose size={20} className="rotate-180" />
        </IconButton>

        <IconButton onClick={handleNewSession} tooltip="New conversation" className="mb-2">
          <Plus size={20} />
        </IconButton>

        <div className="flex-1" />

        <IconButton onClick={() => setSettingsOpen(true)} tooltip="Settings">
          <Settings size={20} />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-dark-900 border-r border-dark-800 h-full"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-claude-orange to-claude-orange-dark flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-semibold text-dark-100">Claude Console</span>
        </div>
        <IconButton onClick={toggleSidebar} tooltip="Close sidebar" size="sm">
          <PanelLeftClose size={18} />
        </IconButton>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={handleNewSession}
          variant="secondary"
          className="w-full justify-start"
          leftIcon={<Plus size={18} />}
        >
          New Conversation
        </Button>
      </div>

      {/* Search (placeholder) */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg text-dark-500 text-sm cursor-not-allowed opacity-50">
          <Search size={16} />
          <span>Search conversations...</span>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-dark-500 text-sm">
              No conversations yet. Start a new one to begin!
            </p>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onSelect={() => selectSession(session.id)}
                onRename={(name) => renameSession(session.id, name)}
                onDelete={() => deleteSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-dark-800">
        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg',
            'text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors'
          )}
        >
          <Settings size={18} />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </div>
  );
};
