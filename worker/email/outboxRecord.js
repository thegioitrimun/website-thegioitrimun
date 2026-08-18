import { randomId } from '../platform/crypto.js';

export function createOutboxStatement(db, input) {
    const id = input.id || randomId();
    const now = new Date().toISOString();
    return db.prepare(`
        INSERT OR IGNORE INTO notification_outbox (
            id, event_type, aggregate_type, aggregate_id, audience, recipient_email,
            locale, payload_json, idempotency_key, status, attempts, available_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
    `).bind(
        id,
        input.eventType,
        input.aggregateType,
        input.aggregateId,
        input.audience,
        String(input.recipientEmail || '').toLowerCase(),
        input.locale || 'vi',
        JSON.stringify(input.payload || {}),
        input.idempotencyKey,
        now,
        now,
        now,
    );
}
