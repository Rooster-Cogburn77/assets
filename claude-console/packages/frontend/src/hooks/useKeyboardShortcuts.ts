import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
        const modifierMatch =
          (ctrlOrMeta ? event.ctrlKey || event.metaKey : true) &&
          (shortcut.shift ? event.shiftKey : !event.shiftKey) &&
          (shortcut.alt ? event.altKey : !event.altKey);

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          modifierMatch
        ) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcuts for the app
export function useAppShortcuts({
  onNewChat,
  onToggleSidebar,
  onFocusInput,
  onSettings,
}: {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onFocusInput: () => void;
  onSettings: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      ctrl: true,
      action: onNewChat,
      description: 'New conversation',
    },
    {
      key: 'b',
      ctrl: true,
      action: onToggleSidebar,
      description: 'Toggle sidebar',
    },
    {
      key: '/',
      ctrl: true,
      action: onFocusInput,
      description: 'Focus message input',
    },
    {
      key: ',',
      ctrl: true,
      action: onSettings,
      description: 'Open settings',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}
