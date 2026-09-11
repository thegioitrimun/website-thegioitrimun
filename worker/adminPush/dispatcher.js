import { pushConfigured, sendPush } from './push.js';

export const ELIGIBLE_SUBSCRIPTION = `s.active = 1 AND u.disabled_at IS NULL
    AND se.revoked_at IS NULL AND se.expires_at > ?
    AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = s.user_id AND r.code IN ('admin', 'master_admin'))`;

export async function unreadState(db, userId) {
    return db.prepare(`SELECT COALESCE(MAX(seq), 0) AS cursor,
        COUNT(CASE WHEN seq > COALESCE((SELECT read_seq FROM admin_push_read_state WHERE user_id = ?),
            (SELECT COALESCE(MAX(seq), 0) FROM admin_push_events)) THEN 1 END) AS unread
        FROM admin_push_events`).bind(userId).first();
}

export async function dispatchAdminPush(env, transport = fetch) {
    if (!pushConfigured(env) || !env.APP_DB) return;
    const db = env.APP_DB;
    const now = new Date().toISOString();
    // Lease atomically, so checkout and cron cannot normally send the same delivery concurrently.
    const claimed = await db.prepare(`UPDATE admin_push_deliveries SET attempts = attempts + 1, next_attempt_at = ?
        WHERE (event_seq, subscription_id) IN (
            SELECT d.event_seq, d.subscription_id FROM admin_push_deliveries d
            WHERE d.status = 'pending' AND d.attempts < 8 AND d.next_attempt_at <= ?
            ORDER BY d.next_attempt_at LIMIT 30
        ) RETURNING *`).bind(new Date(Date.now() + 120000).toISOString(), now).all();
    await Promise.all((claimed.results || []).map(async delivery => {
        let status = 'pending';
        let httpStatus = 0;
        try {
            const row = await db.prepare(`SELECT s.*, e.order_id, e.order_code, e.created_at
                FROM admin_push_subscriptions s
                JOIN sessions se ON se.id = s.session_id AND se.user_id = s.user_id
                JOIN users u ON u.id = s.user_id
                JOIN admin_push_events e ON e.seq = ?
                WHERE s.id = ? AND ${ELIGIBLE_SUBSCRIPTION}`)
                .bind(delivery.event_seq, delivery.subscription_id, now).first();
            if (!row || Date.parse(row.created_at) < Date.now() - 86400000) {
                status = 'cancelled';
            } else {
                const state = await unreadState(db, row.user_id);
                httpStatus = await sendPush(env, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, {
                    title: 'Đơn hàng mới · TGTM Admin',
                    body: row.order_code ? `Đơn ${row.order_code}. Mở quản trị để xem chi tiết.` : 'Bạn có đơn hàng mới. Mở quản trị để xem chi tiết.',
                    tag: `admin-order-${row.order_id}`,
                    url: `/admin/don-hang/${encodeURIComponent(row.order_id)}`,
                    unread: Number(state.unread), cursor: Number(state.cursor),
                }, transport);
                if (httpStatus >= 200 && httpStatus < 300) status = 'sent';
                else if ([404, 410].includes(httpStatus)) {
                    await db.prepare('UPDATE admin_push_subscriptions SET active = 0 WHERE id = ?').bind(row.id).run();
                    status = 'expired';
                } else if (httpStatus >= 400 && httpStatus < 500 && ![408, 429].includes(httpStatus)) status = 'failed';
            }
        } catch (error) {
            // Redact capability URLs and long key/token-like strings from provider/runtime errors.
            const detail = String(error?.message || '').replace(/https?:\/\/\S+/g, '[url]')
                .replace(/[A-Za-z0-9_+=/-]{24,}/g, '[redacted]').slice(0, 250);
            console.warn('[admin-push] Delivery will retry', {
                event: delivery.event_seq, stage: error?.pushStage || 'database',
                error: error?.name || 'Error', detail,
            });
        }
        if (status === 'pending' && delivery.attempts >= 8) status = 'failed';
        await db.prepare(`UPDATE admin_push_deliveries SET status = ?, last_status = ?, next_attempt_at = ?
            WHERE event_seq = ? AND subscription_id = ?`)
            .bind(status, httpStatus, new Date(Date.now() + Math.min(3600, 30 * 2 ** delivery.attempts) * 1000).toISOString(),
                delivery.event_seq, delivery.subscription_id).run();
    }));
}

export async function dispatchAdminPushBestEffort(env) {
    try { await dispatchAdminPush(env); }
    catch { console.warn('[admin-push] Dispatch unavailable; scheduled retry will follow.'); }
}
