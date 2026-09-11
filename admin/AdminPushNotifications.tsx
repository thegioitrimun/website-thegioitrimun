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

  // Condition 1: iPhone where notification is NOT yet granted (shows every time webapp opens until granted)
  const shouldShowIPhonePrompt = isIPhone && !isNotificationGranted && showIPhonePrompt;

  // Condition 2: New order notification popup (when unread > 0 and not dismissed for current cursor)
  const hasUnread = Boolean(state?.unread && state.unread > 0);
  const shouldShowOrderAlert = hasUnread && (dismissedCursor === null || (state?.cursor !== undefined && state.cursor > dismissedCursor));

  return (
    <>
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

              {/* Nút đóng popup đơn hàng */}
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

        {/* POPUP 2: BẬT THÔNG BÁO IPHONE (chỉ hiện khi iPhone chưa bật, tắt được, thiết kế chuẩn theo mẫu) */}
        {shouldShowIPhonePrompt && (
          <div
            role="region"
            aria-label="Cài đặt thông báo đơn hàng trên iPhone"
            className="pointer-events-auto relative rounded-2xl border border-slate-700/60 bg-[#161c28]/95 p-3.5 shadow-2xl backdrop-blur-xl text-slate-100 ring-1 ring-white/10"
          >
            {/* Nút đóng popup */}
            <button
              type="button"
              onClick={() => setShowIPhonePrompt(false)}
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
              className="btn-press absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer touch-manipulation select-none"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>

            <div className="flex flex-col gap-2.5 pr-5">
              <div className="flex items-center gap-3">
                <p className="flex-1 text-xs sm:text-sm text-slate-200 leading-snug font-medium">
                  Kích hoạt thông báo để nhận chuông và tin báo đơn hàng mới tức thì.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={enable}
                  className="btn-press shrink-0 rounded-full bg-[#38b2ac] hover:bg-[#319795] active:scale-95 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                >
                  {busy ? 'Đang bật…' : 'Bật thông báo'}
                </button>
              </div>

              {!standalone && (
                <p className="text-[11px] leading-relaxed text-slate-400 border-t border-slate-700/50 pt-2">
                  Để nhận thông báo đơn mới trên iPhone, thêm trang quản trị vào Màn hình chính rồi mở app TGTM Admin.
                </p>
              )}

              {error && (
                <div role="alert" className="mt-1 rounded-xl bg-amber-500/15 border border-amber-500/30 p-2 text-[10.5px] text-amber-300 leading-relaxed">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
