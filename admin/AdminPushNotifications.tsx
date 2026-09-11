import React, { useCallback, useEffect, useState } from 'react';
import { adminPushRegistration, applicationServerKey, disableAdminPush, isAdminStandalone, pushApi,
  supportsAdminPush, updateAdminBadge, type AdminPushState } from './pushClient';
import { CheckIcon, CloseIcon, ShoppingBagIcon } from '../components/icons';
import type { AdminNavigationView } from '../types';

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

interface AdminPushNotificationsProps {
  onNavigate?: (view: AdminNavigationView) => void;
}

export default function AdminPushNotifications({ onNavigate }: AdminPushNotificationsProps = {}) {
  const [state, setState] = useState<AdminPushState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showIPhonePrompt, setShowIPhonePrompt] = useState(true);
  const [dismissedCursor, setDismissedCursor] = useState<number | null>(null);

  const standalone = isAdminStandalone();
  const supported = supportsAdminPush();
  const isIPhone = isIOSDevice();
  const isNotificationGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

  const refresh = useCallback(async () => {
    try {
      const next = await pushApi('config');
      setState(next);
      if (standalone && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await updateAdminBadge(next.unread);
      }
      return next;
    } catch {
      return null;
    }
  }, [standalone]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        await refresh();
        if (standalone && supported && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration('/admin/');
          const sub = await registration?.pushManager.getSubscription();
          if (sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            await pushApi('subscription', 'PUT', sub.toJSON());
            await registration?.update();
          }
          if (!cancelled) setEnabled(Boolean(sub && typeof Notification !== 'undefined' && Notification.permission === 'granted'));
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    void sync();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {});
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ADMIN_PUSH_REFRESH') onVisible();
    };

    document.addEventListener('visibilitychange', onVisible);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage);
    }
    const timer = window.setInterval(onVisible, 60000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, [refresh, standalone, supported]);

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      if (typeof Notification === 'undefined' || !('requestPermission' in Notification)) {
        throw new Error('Safari chưa hỗ trợ Web Push trong tab. Vui lòng nhấn nút Chia sẻ ⎋ ➔ chọn "Thêm vào MH chính" rồi mở app TGTM Admin để nhận thông báo.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (!standalone && isIPhone) {
          throw new Error('iOS Safari yêu cầu thêm vào MH chính trước: Nhấn nút Chia sẻ ⎋ ➔ chọn "Thêm vào MH chính" ➔ mở app để bật.');
        }
        throw new Error('Hãy cho phép thông báo cho TGTM Admin trong Cài đặt iPhone → Thông báo.');
      }
      const config = state || await refresh();
      if (!config?.configured || !config.publicKey) {
        throw new Error('Hệ thống thông báo chưa sẵn sàng.');
      }
      const registration = await adminPushRegistration();
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.publicKey),
      });
      await pushApi('subscription', 'PUT', subscription.toJSON());
      setEnabled(true);
      setShowIPhonePrompt(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markRead = async () => {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const next = await pushApi<AdminPushState>('read', 'POST', { cursor: state.cursor });
      setState(previous => previous ? { ...previous, ...next } : next);
      await updateAdminBadge(next.unread);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDismissOrderAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state?.cursor !== undefined) {
      setDismissedCursor(state.cursor);
    }
  };

  const handleOpenOrders = () => {
    if (onNavigate) {
      onNavigate({ page: 'adminPharmacyManagement', section: 'orders' } as any);
    }
  };

  // Condition 1: WebKit browser on iPhone/iPad (not standalone) where notification is NOT yet granted
  const shouldShowWebKitIPhonePrompt = isIPhone && !standalone && !isNotificationGranted && showIPhonePrompt;

  // Condition 2: New order notification popup (when unread > 0 and not dismissed for current cursor)
  const hasUnread = Boolean(state?.unread && state.unread > 0);
  const shouldShowOrderAlert = hasUnread && (dismissedCursor === null || (state?.cursor !== undefined && state.cursor > dismissedCursor));

  return (
    <>
      {/* Inline settings bar for Standalone to toggle or view push status */}
      {standalone && supported && (
        <section aria-label="Cài đặt thông báo đơn hàng" className="mx-4 my-2.5 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-2.5 text-xs backdrop-blur-md">
          <span className="flex-1 text-muted-foreground">
            {enabled
              ? `Thông báo đơn hàng đã kích hoạt trên thiết bị này${state?.unread ? ` (${state.unread} đơn chưa đọc)` : ''}`
              : 'Kích hoạt thông báo để nhận chuông và tin báo đơn hàng mới tức thì.'}
          </span>
          {!enabled ? (
            <button
              type="button"
              disabled={busy || !state?.configured}
              onClick={enable}
              className="btn-press rounded-xl bg-primary px-3 py-1.5 font-semibold text-primary-foreground shadow-xs transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation select-none"
            >
              {busy ? 'Đang bật…' : 'Bật thông báo'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await disableAdminPush();
                  setEnabled(false);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="text-muted-foreground underline hover:text-foreground cursor-pointer touch-manipulation"
            >
              Tắt trên máy này
            </button>
          )}
          {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
        </section>
      )}

      {/* FLOATING POPUPS CONTAINER (BOTTOM-RIGHT / MOBILE-BOTTOM) */}
      <aside
        aria-label="Thông báo và nhắc nhở quản trị"
        className="fixed bottom-4 right-4 z-[99] flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 pointer-events-none sm:bottom-6 sm:right-6 sm:max-w-sm"
      >
        {/* POPUP 1: ĐƠN HÀNG MỚI (có thể tắt, cái đánh dấu đã đọc là cái icon) */}
        {shouldShowOrderAlert && (
          <div
            role="alert"
            onClick={handleOpenOrders}
            className="pointer-events-auto group relative flex items-center gap-3 rounded-2xl border border-primary/25 bg-background/95 p-3 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl dark:bg-slate-900/95 cursor-pointer ring-1 ring-primary/15"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShoppingBagIcon className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse">
                {state?.unread}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-foreground">Đơn hàng mới!</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">
                  Mới
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                Có <strong className="text-foreground font-semibold">{state?.unread}</strong> đơn hàng cần xử lý
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Nút đánh dấu đã đọc là cái icon (Checkmark ✓) */}
              <button
                type="button"
                disabled={busy}
                onClick={markRead}
                title="Đánh dấu đã đọc"
                aria-label="Đánh dấu đã đọc"
                className="btn-press flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-muted/60 text-foreground transition-colors hover:bg-primary/15 hover:text-primary hover:border-primary/40 active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation select-none"
              >
                <CheckIcon className="h-4 w-4 stroke-[2.5]" />
              </button>

              {/* Nút đóng popup */}
              <button
                type="button"
                onClick={handleDismissOrderAlert}
                title="Đóng thông báo"
                aria-label="Đóng thông báo"
                className="btn-press flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer touch-manipulation select-none"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* POPUP 2: HƯỚNG DẪN & BẬT THÔNG BÁO WEBKIT IPHONE (chỉ hiện trên WebKit khi chưa bật, tắt được) */}
        {shouldShowWebKitIPhonePrompt && (
          <div
            role="region"
            aria-label="Hướng dẫn bật thông báo trên iPhone"
            className="pointer-events-auto relative rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-xl dark:bg-slate-900/95 ring-1 ring-black/5 dark:ring-white/10"
          >
            <button
              type="button"
              onClick={() => setShowIPhonePrompt(false)}
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
              className="btn-press absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer touch-manipulation select-none"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.66-.82 1.11-1.96.99-3.1-.96.04-2.16.65-2.84 1.45-.6.7-.1.13 1.86-1.01 3.02 1.07.08 2.2-.55 2.86-1.37z" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-foreground">
                  Nhận thông báo đơn mới trên iPhone
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Bật thông báo để nhận chuông và tin báo đơn hàng mới. Nếu Safari yêu cầu, nhấn nút Chia sẻ <span className="font-semibold text-foreground">⎋</span> ở thanh dưới ➔ chọn <span className="font-semibold text-foreground">"Thêm vào MH chính"</span>.
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={enable}
                    className="btn-press rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-xs transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                  >
                    {busy ? 'Đang bật…' : 'Bật thông báo ngay'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIPhonePrompt(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation select-none"
                  >
                    Để sau
                  </button>
                </div>

                {error && (
                  <div role="alert" className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 text-[10.5px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
