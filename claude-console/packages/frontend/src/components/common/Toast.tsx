import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastType } from '@/store/toast';
import { cn } from '@/utils';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-green-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  info: <Info size={18} className="text-blue-400" />,
  warning: <AlertTriangle size={18} className="text-yellow-400" />,
};

const styles: Record<ToastType, string> = {
  success: 'bg-green-950/90 border-green-800',
  error: 'bg-red-950/90 border-red-800',
  info: 'bg-blue-950/90 border-blue-800',
  warning: 'bg-yellow-950/90 border-yellow-800',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
            'animate-slide-up max-w-sm',
            styles[toast.type]
          )}
        >
          {icons[toast.type]}
          <span className="flex-1 text-sm text-dark-100">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-dark-400 hover:text-dark-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
