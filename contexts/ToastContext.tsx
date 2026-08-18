import React, { createContext, useState, useCallback, ReactNode } from 'react';
import ToastContainer from '../components/Toast';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  addToast: (title: string, options?: { description?: string; type?: ToastType }) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((title: string, options: { description?: string; type?: ToastType } = {}) => {
    const { description, type = 'info' } = options;
    const id = Date.now() + Math.random();
    
    const newToast: ToastMessage = {
      id,
      title,
      description,
      type
    };

    setToasts(currentToasts => [newToast, ...currentToasts]);

    setTimeout(() => {
      // Trigger exit animation
      const toastElement = document.getElementById(`toast-${id}`);
      if (toastElement) {
        toastElement.classList.remove('animate-toast-in');
        toastElement.classList.add('animate-toast-out');
      }
       // Remove from state after animation
      setTimeout(() => removeToast(id), 500);
    }, 4500); // Start hiding 0.5s before removal
  }, [removeToast]);
  
  const contextValue = { addToast };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};
