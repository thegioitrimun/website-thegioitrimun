import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext, type ToastType, type ToastMessage } from '../../contexts/ToastContext';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, CloseIcon } from '../icons';
import SurfacePresence, { motionDuration } from './SurfacePresence';

type MotionToast = ToastMessage & { closing?: boolean };
export default function MotionToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<MotionToast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    setToasts(current => current.map(toast => toast.id === id ? { ...toast, closing: true } : toast));
    timers.current.set(id, setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
      timers.current.delete(id);
    }, motionDuration('--toast-close', 250)));
  }, []);
  const addToast = useCallback((title: string, options: { description?: string; type?: ToastType } = {}) => {
    const id = ++sequence.current;
    setToasts(current => [{ id, title, type: options.type || 'info', description: options.description }, ...current]);
    timers.current.set(id, setTimeout(() => dismiss(id), 4500));
  }, [dismiss]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  return <ToastContext.Provider value={{ addToast }}>
    {children}
    <div className="fixed inset-x-0 top-[max(env(safe-area-inset-top,0px),1rem)] z-[9999] flex flex-col items-center gap-3 px-4 pointer-events-none sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:w-96" aria-live="polite" aria-relevant="additions">
      {toasts.map(toast => <SurfacePresence key={toast.id} kind="toast">
        {!toast.closing && <div className="t-toast motion-toast pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl" data-motion-surface="true" role="status">
          <div className="flex items-start gap-3">
            {toast.type === 'success' ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" /> : toast.type === 'error' ? <XCircleIcon className="h-5 w-5 shrink-0 text-destructive" /> : <InformationCircleIcon className="h-5 w-5 shrink-0 text-primary" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{toast.title}</p>{toast.description && <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>}</div>
            <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)} className="rounded-lg p-1 hover:bg-muted"><CloseIcon className="h-4 w-4" /></button>
          </div>
        </div>}
      </SurfacePresence>)}
    </div>
  </ToastContext.Provider>;
}
