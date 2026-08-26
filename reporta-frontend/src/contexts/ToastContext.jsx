import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast]);
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);
  const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const { id, message, type } = toast;

  const config = {
    success: {
      icon: CheckCircle,
      bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      iconClass: 'text-green-600 dark:text-green-400',
      textClass: 'text-green-900 dark:text-green-100'
    },
    error: {
      icon: XCircle,
      bgClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      iconClass: 'text-red-600 dark:text-red-400',
      textClass: 'text-red-900 dark:text-red-100'
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      iconClass: 'text-yellow-600 dark:text-yellow-400',
      textClass: 'text-yellow-900 dark:text-yellow-100'
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      iconClass: 'text-blue-600 dark:text-blue-400',
      textClass: 'text-blue-900 dark:text-blue-100'
    }
  };

  const { icon: Icon, bgClass, iconClass, textClass } = config[type];

  return (
    <div
      className={`${bgClass} border rounded-lg p-4 shadow-lg animate-slide-in pointer-events-auto flex items-start space-x-3`}
    >
      <Icon className={`h-5 w-5 ${iconClass} flex-shrink-0 mt-0.5`} />
      <p className={`text-sm flex-1 ${textClass}`}>{message}</p>
      <button
        onClick={() => onRemove(id)}
        className={`${iconClass} hover:opacity-70 transition-opacity flex-shrink-0`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
