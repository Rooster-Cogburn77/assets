import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useSessionsStore } from '@/store/sessions';
import { cn } from '@/utils';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, isLoading, error } = useSessionsStore();

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="flex items-center gap-2 px-4 py-2 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          <WifiOff size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-300 text-sm">
          <Loader2 size={16} className="animate-spin" />
          <span>Connecting...</span>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-950 border border-yellow-800 rounded-lg text-yellow-200 text-sm">
          <WifiOff size={16} />
          <span>Disconnected - Reconnecting...</span>
        </div>
      </div>
    );
  }

  // Don't show anything when connected (clean UI)
  return null;
};
