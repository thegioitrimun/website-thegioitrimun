/* Admin notifications only. Never cache authenticated pages or API responses. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function updateBadge(unread) {
    try {
        if (unread > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(unread);
        else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    } catch { /* Badging depends on OS permission and support. */ }
}

self.addEventListener('push', event => {
    event.waitUntil((async () => {
        let payload = {};
        try { payload = event.data?.json() || {}; } catch { /* Still show a visible notification. */ }
        let unread = Number(payload.unread) || 0;
        // Refresh counts after reads on another device; offline delivery uses the encrypted payload.
        try {
            const response = await fetch('/api/admin/push/config', {
                credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(4000),
            });
            if (response.ok) unread = Number((await response.json()).unread) || 0;
        } catch { /* Offline. */ }
        const url = typeof payload.url === 'string' && /^\/admin\/(?:don-hang)(?:\/[^/?#]+)?$/.test(payload.url)
            ? payload.url : '/admin/don-hang';
        // Safari requires a visible notification for every push event.
        await self.registration.showNotification(payload.title || 'TGTM Admin', {
            body: payload.body || 'Bạn có đơn hàng mới. Mở quản trị để xem chi tiết.',
            icon: '/icons/admin-pwa-192.png',
            tag: payload.tag || 'admin-new-order',
            data: { url },
        });
        await updateBadge(unread);
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if (new URL(client.url).pathname.startsWith('/admin')) client.postMessage({ type: 'ADMIN_PUSH_REFRESH' });
        }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil((async () => {
        const path = event.notification.data?.url;
        const target = new URL(typeof path === 'string' && /^\/admin\/don-hang(?:\/[^/?#]+)?$/.test(path)
            ? path : '/admin/don-hang', self.location.origin).href;
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const admin = windows.find(client => {
            const url = new URL(client.url);
            return url.origin === self.location.origin && /^\/admin(?:\/|$)/.test(url.pathname);
        });
        if (admin) {
            await admin.navigate(target);
            await admin.focus();
        } else await self.clients.openWindow(target);
    })());
});

self.addEventListener('message', event => {
    const client = event.source;
    if (!client?.url || !/^\/admin(?:\/|$)/.test(new URL(client.url).pathname)) return;
    if (event.data?.type === 'ADMIN_PUSH_BADGE') {
        event.waitUntil(updateBadge(Math.max(0, Number(event.data.unread) || 0)));
    }
});
