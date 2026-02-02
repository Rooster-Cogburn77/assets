import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Format a timestamp to a relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Format a timestamp to a full date/time string
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Get file extension from a path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1]! : '';
}

/**
 * Get filename from a path
 */
export function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/**
 * Map file extension to language for syntax highlighting
 */
export function extensionToLanguage(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
  };

  return map[ext.toLowerCase()] ?? ext;
}

/**
 * Get tool icon name based on tool type
 */
export function getToolIcon(toolType: string): string {
  const iconMap: Record<string, string> = {
    Read: 'file-text',
    Write: 'file-plus',
    Edit: 'edit-3',
    Bash: 'terminal',
    Glob: 'search',
    Grep: 'file-search',
    WebFetch: 'globe',
    WebSearch: 'search',
    Task: 'list-todo',
    TodoWrite: 'check-square',
    NotebookEdit: 'book-open',
    Unknown: 'help-circle',
  };

  return iconMap[toolType] ?? 'help-circle';
}

/**
 * Get tool color based on tool type
 */
export function getToolColor(toolType: string): string {
  const colorMap: Record<string, string> = {
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

  return colorMap[toolType] ?? 'text-gray-400';
}
