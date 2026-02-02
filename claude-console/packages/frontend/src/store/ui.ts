import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/types';

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarWidth: number;
  settingsOpen: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
}

const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && systemDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: true,
      sidebarWidth: 280,
      settingsOpen: false,

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),

      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: 'claude-console-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useUIStore.getState();
    if (theme === 'system') {
      applyTheme('system');
    }
  });
}
