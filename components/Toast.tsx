import React from 'react';
import type { ToastMessage, ToastType } from '../contexts/ToastContext';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, CloseIcon } from './icons';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircleIcon className="w-6 h-6 text-green-500" />,
    error: <XCircleIcon className="w-6 h-6 text-destructive" />,
    info: <InformationCircleIcon className="w-6 h-6 text-primary" />,
  };
  
  const baseClasses = "w-full max-w-sm bg-card text-card-foreground rounded-xl shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden";
  
  const handleDismiss = () => {
    const toastElement = document.getElementById(`toast-${toast.id}`);
    if (toastElement) {
        toastElement.classList.remove('animate-toast-in');
        toastElement.classList.add('animate-toast-out');
        setTimeout(() => onDismiss(toast.id), 500);
    } else {
        onDismiss(toast.id);
    }
  }

  return (
    <div id={`toast-${toast.id}`} className={`${baseClasses} animate-toast-in`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {icons[toast.type]}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{toast.title}</p>
            {toast.description && (
              <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleDismiss}
              className="inline-flex rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              <span className="sr-only">Close</span>
              <CloseIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-start px-4 py-6 pointer-events-none sm:p-6 sm:items-end z-[9999]"
    >
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
