import React from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { SettingsModal } from './SettingsModal';
import { ConnectionStatus } from './ConnectionStatus';
import { ToastContainer } from '@/components/common/Toast';
import { useAppShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSessionsStore } from '@/store/sessions';
import { useUIStore } from '@/store/ui';

export const Layout: React.FC = () => {
  const { createSession } = useSessionsStore();
  const { toggleSidebar, setSettingsOpen } = useUIStore();

  // Register keyboard shortcuts
  useAppShortcuts({
    onNewChat: () => createSession(),
    onToggleSidebar: toggleSidebar,
    onFocusInput: () => {
      const input = document.querySelector('textarea');
      input?.focus();
    },
    onSettings: () => setSettingsOpen(true),
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-dark-950">
        <ChatContainer />
      </main>

      {/* Modals & Overlays */}
      <SettingsModal />
      <ConnectionStatus />
      <ToastContainer />
    </div>
  );
};
