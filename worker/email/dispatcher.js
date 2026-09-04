export async function dispatchPendingNotifications(env, limit = 50) {
    if (!env.APP_DB || !env.NOTIFICATION_QUEUE) return { skipped: true, queued: 0 };
    const now = new Date().toISOString();
    const staleQueuedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await env.APP_DB.prepare(`
        UPDATE notification_outbox
        SET status = 'retrying', available_at = ?, queued_at = NULL,
            last_error = 'Queue dispatch lease expired before delivery.', updated_at = ?
        WHERE status = 'queued' AND queued_at IS NOT NULL AND queued_at < ?
    `).bind(now, now, staleQueuedAt).run();
    const rows = await env.APP_DB.prepare(`
        SELECT id FROM notification_outbox
        WHERE status IN ('pending', 'retrying') AND available_at <= ?
        ORDER BY created_at ASC LIMIT ?
    `).bind(now, Math.max(1, Math.min(100, Number(limit || 50)))).all();
    const ids = (rows.results || []).map((row) => row.id);
    if (!ids.length) return { skipped: false, queued: 0 };
    await env.APP_DB.batch(ids.map((id) => env.APP_DB.prepare(`
        UPDATE notification_outbox SET status = 'queued', queued_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'retrying')
    `).bind(now, now, id)));
    const reserved = await env.APP_DB.prepare(`
        SELECT id FROM notification_outbox
        WHERE queued_at = ? AND status = 'queued' AND id IN (${ids.map(() => '?').join(',')})
    `).bind(now, ...ids).all();
    const reservedIds = (reserved.results || []).map((row) => row.id);
    let queued = 0;
    for (let offset = 0; offset < reservedIds.length; offset += 100) {
        const chunk = reservedIds.slice(offset, offset + 100);
        try {
            await env.NOTIFICATION_QUEUE.sendBatch(chunk.map((id) => ({ body: { kind: 'notification', outboxId: id } })));
            queued += chunk.length;
        } catch (error) {
            const availableAt = new Date(Date.now() + 30_000).toISOString();
            await env.APP_DB.batch(chunk.map((id) => env.APP_DB.prepare(`
                UPDATE notification_outbox SET status = 'retrying', available_at = ?, last_error = ?, updated_at = ?
                WHERE id = ? AND status = 'queued' AND queued_at = ?
            `).bind(availableAt, String(error?.message || error).slice(0, 1000), now, id, now)));
        }
    }
    return { skipped: false, queued };
}
