import React, { useId, useLayoutEffect, useRef } from 'react';
import { AdminPortal } from './AdminPortalHost';

export interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  busy?: boolean;
  placement?: 'center' | 'desktop-menu' | 'mobile-menu';
}
function DialogContent({ onClose, title, children, className = '', busy = false, placement = 'center' }: Omit<AdminDialogProps, 'open'>) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
    className={`admin-surface admin-surface-overlay overflow-y-auto rounded-2xl p-4 text-foreground backdrop:bg-black/40 ${placement === 'desktop-menu' ? 'fixed bottom-6 left-6 right-auto top-6 m-0 h-[calc(100dvh-48px)] max-h-none w-[268px] max-w-[268px]' : placement === 'mobile-menu' ? 'fixed bottom-0 left-auto right-0 top-0 m-0 h-dvh max-h-none w-[320px] max-w-[88vw] rounded-r-none' : 'm-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-[720px]'} ${className}`}>
    <header className="mb-4 flex items-center justify-between gap-3">
      <h2 id={titleId} className="text-base font-bold">{title}</h2>
      <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted">✕</button>
    </header>
    {children}
  </dialog>;
}
export function AdminDialog({ open, ...props }: AdminDialogProps) {
  return open ? <AdminPortal><DialogContent {...props} /></AdminPortal> : null;
}
