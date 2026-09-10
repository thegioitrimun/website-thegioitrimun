import React from 'react';
import AdminButton from './AdminButton';
import AdminSurface from './AdminSurface';
export function AdminAsyncState({ status, message, onRetry, children }: { status: 'loading' | 'refreshing' | 'empty' | 'error' | 'forbidden'; message?: string; onRetry?: () => void; children?: React.ReactNode }) {
  if (status === 'refreshing') return <p role="status" className="min-h-5 text-xs text-muted-foreground">{message || 'Đang cập nhật…'}</p>;
  if (status === 'loading') return <div role="status" aria-label="Đang tải dữ liệu" className="space-y-3"><AdminSurface variant="toolbar" className="h-16 p-4"><div className="h-8 w-2/3 rounded-xl bg-muted motion-safe:animate-pulse" /></AdminSurface><AdminSurface className="divide-y divide-border/40 p-4">{Array.from({length: 6}, (_, index) => <div key={index} className="flex h-20 items-center gap-4"><div className="h-11 w-11 rounded-xl bg-muted motion-safe:animate-pulse" /><div className="h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" /></div>)}</AdminSurface></div>;
  return <AdminSurface className="p-8 text-center"><p role={status === 'error' ? 'alert' : 'status'} className="text-sm">{message || (status === 'error' ? 'Không thể tải dữ liệu. Vui lòng thử lại.' : status === 'forbidden' ? 'Bạn không có quyền truy cập khu vực này.' : 'Chưa có dữ liệu.')}</p>{onRetry && <AdminButton className="mt-4" onClick={onRetry}>Thử lại</AdminButton>}{children}</AdminSurface>;
}
