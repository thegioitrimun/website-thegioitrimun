export type AdminPushState = { configured: boolean; publicKey: string | null; unread: number; cursor: number };

export function isAdminStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
export function supportsAdminPush() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushApi<T = AdminPushState>(action: string, method = 'GET', body?: unknown): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (method !== 'GET') {
    const token = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('tg_csrf='))?.slice(8);
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    headers.set('X-CSRF-Token', decodeURIComponent(token));
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api/admin/push/${action}`, {
    method, headers, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Không thể kết nối thông báo.');
  return data;
}

export async function adminPushRegistration() {
  const registration = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/', updateViaCache: 'none' });
  if (!registration.active) {
    const worker = registration.installing || registration.waiting;
    if (!worker) throw new Error('Không thể khởi động thông báo.');
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Khởi động thông báo quá lâu. Vui lòng thử lại.')); }, 15000);
      const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', changed); };
      const changed = () => {
        if (worker.state === 'activated') { cleanup(); resolve(); }
        else if (worker.state === 'redundant') { cleanup(); reject(new Error('Vui lòng tải lại app để bật thông báo.')); }
      };
      worker.addEventListener('statechange', changed);
      changed();
    });
  }
  return registration;
}

export function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const raw = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(publicKey.length / 4) * 4, '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function updateAdminBadge(unread: number) {
  const nav = navigator as Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try { if (unread > 0) await nav.setAppBadge?.(unread); else await nav.clearAppBadge?.(); } catch { /* Optional OS feature. */ }
}

export async function disableAdminPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/admin/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await pushApi('subscription', 'DELETE', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
  await updateAdminBadge(0);
}
