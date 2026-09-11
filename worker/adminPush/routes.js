import { apiError, json, readJson, requireD1, methodNotAllowed } from '../platform/http.js';
import { requireRole, requireCsrf } from '../auth/session.js';
import { sha256 } from '../platform/crypto.js';
import { pushConfigured, validateSubscription } from './push.js';
import { unreadState } from './dispatcher.js';

export async function maybeHandleAdminPushRoute({ request, env, path }) {
    if (!path.startsWith('/api/admin/push/')) return null;
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        const method = request.method;
        if (method !== 'GET') await requireCsrf(db, request, session);
        if (path === '/api/admin/push/config' && method === 'GET') {
            return json({ configured: pushConfigured(env), publicKey: env.ADMIN_PUSH_VAPID_PUBLIC_KEY || null,
                ...await unreadState(db, session.user_id) });
        }
        if (path === '/api/admin/push/subscription' && method === 'PUT') {
            if (!pushConfigured(env)) throw Object.assign(new Error('Thông báo chưa được cấu hình.'), { status: 503 });
            const sub = validateSubscription(await readJson(request, 4096));
            const id = await sha256(sub.endpoint);
            const now = new Date().toISOString();
            // Changing account/session invalidates old deliveries for this browser's endpoint.
            await db.batch([
                db.prepare(`DELETE FROM admin_push_subscriptions WHERE id = ? AND (user_id != ? OR session_id != ? OR active = 0)`)
                    .bind(id, session.user_id, session.session_id),
                db.prepare(`INSERT OR IGNORE INTO admin_push_read_state(user_id, read_seq)
                    SELECT ?, COALESCE(MAX(seq), 0) FROM admin_push_events`).bind(session.user_id),
                db.prepare(`INSERT INTO admin_push_subscriptions(id, user_id, session_id, endpoint, p256dh, auth, subscribed_seq, updated_at)
                    SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(seq), 0), ? FROM admin_push_events WHERE 1
                    ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`)
                    .bind(id, session.user_id, session.session_id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now),
            ]);
            return json({ ok: true, ...await unreadState(db, session.user_id) });
        }
        if (path === '/api/admin/push/subscription' && method === 'DELETE') {
            const body = await readJson(request, 4096);
            const id = await sha256(String(body.endpoint || ''));
            await db.prepare('DELETE FROM admin_push_subscriptions WHERE id = ? AND user_id = ?')
                .bind(id, session.user_id).run();
            return json({ ok: true });
        }
        if (path === '/api/admin/push/read' && method === 'POST') {
            const { cursor } = await readJson(request, 1024);
            if (!Number.isSafeInteger(cursor) || cursor < 0) throw Object.assign(new Error('Mốc thông báo không hợp lệ.'), { status: 400 });
            await db.prepare(`INSERT INTO admin_push_read_state(user_id, read_seq)
                SELECT ?, MIN(?, COALESCE(MAX(seq), 0)) FROM admin_push_events WHERE 1
                ON CONFLICT(user_id) DO UPDATE SET read_seq = MAX(read_seq, excluded.read_seq)`)
                .bind(session.user_id, cursor).run();
            return json({ ok: true, ...await unreadState(db, session.user_id) });
        }
        return methodNotAllowed(['GET', 'PUT', 'DELETE', 'POST']);
    } catch (error) { return apiError(error, 'Không thể cập nhật thông báo quản trị.'); }
}
