import React from 'react';
import { X, Sun, Moon, Monitor, Github } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { cn } from '@/utils';
import { IconButton } from '@/components/common/IconButton';
import type { Theme } from '@/types';

export const SettingsModal: React.FC = () => {
  const { settingsOpen, setSettingsOpen, theme, setTheme } = useUIStore();

  if (!settingsOpen) return null;

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={18} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
    { value: 'system', label: 'System', icon: <Monitor size={18} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-full max-w-md animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100">Settings</h2>
            <IconButton onClick={() => setSettingsOpen(false)} tooltip="Close">
              <X size={20} />
            </IconButton>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-3">
                Appearance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {themes.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                      theme === value
                        ? 'bg-claude-orange/10 border-claude-orange text-claude-orange'
                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                    )}
                  >
                    {icon}
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-3">
                Keyboard Shortcuts
              </label>
              <div className="bg-dark-900 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between text-dark-300">
                  <span>New conversation</span>
                  <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-400">Ctrl+N</kbd>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>Toggle sidebar</span>
                  <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-400">Ctrl+B</kbd>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>Focus input</span>
                  <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-400">Ctrl+/</kbd>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>Settings</span>
                  <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-400">Ctrl+,</kbd>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="pt-4 border-t border-dark-700">
              <div className="text-sm text-dark-400 space-y-2">
                <p>
                  <strong className="text-dark-200">Claude Console</strong> v1.0.0
                </p>
                <p>
                  Enterprise-grade local UI for Claude Code with real-time streaming
                  and session management.
                </p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/anthropics/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-200 transition-colors"
              >
                <Github size={16} />
                Claude Code
              </a>
              <a
                href="https://docs.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dark-400 hover:text-dark-200 transition-colors"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
