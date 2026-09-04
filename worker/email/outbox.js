import { SmtpMailer } from './smtpMailer.js';
import { renderEmail } from './templates.js';
import { decryptText } from '../platform/crypto.js';
export { createOutboxStatement } from './outboxRecord.js';
export { dispatchPendingNotifications } from './dispatcher.js';

function retryDelay(attempt) {
    return Math.min(6 * 60 * 60, 30 * Math.pow(2, Math.max(0, attempt - 1)));
}

export async function consumeNotificationQueue(batch, env) {
    if (!env.APP_DB) {
        for (const message of batch.messages) message.retry({ delaySeconds: 300 });
        return;
    }
    let mailer;
    try {
        mailer = new SmtpMailer(env);
    } catch (error) {
        for (const message of batch.messages) {
            const outboxId = message.body?.outboxId;
            const row = outboxId
                ? await env.APP_DB.prepare('SELECT attempts FROM notification_outbox WHERE id = ? LIMIT 1').bind(outboxId).first()
                : null;
            if (!row) {
                message.ack();
                continue;
            }
            const attempt = Number(row.attempts || 0) + 1;
            const terminal = attempt >= Number(env.EMAIL_MAX_ATTEMPTS || 6);
            const delaySeconds = retryDelay(attempt);
            const now = new Date().toISOString();
            await env.APP_DB.prepare(`
                UPDATE notification_outbox
                SET status = ?, attempts = ?, available_at = ?, last_error = ?, updated_at = ?
                WHERE id = ? AND status IN ('queued', 'retrying')
            `).bind(
                terminal ? 'failed' : 'retrying',
                attempt,
                new Date(Date.now() + delaySeconds * 1000).toISOString(),
                String(error?.message || error).slice(0, 1000),
                now,
                outboxId,
            ).run();
            if (terminal) message.ack();
            else message.retry({ delaySeconds });
        }
        return;
    }

    for (const message of batch.messages) {
        const outboxId = message.body?.outboxId;
        if (!outboxId) {
            message.ack();
            continue;
        }
        const row = await env.APP_DB.prepare('SELECT * FROM notification_outbox WHERE id = ? LIMIT 1')
            .bind(outboxId).first();
        if (!row || ['accepted', 'delivery_unknown', 'failed'].includes(row.status)) {
            message.ack();
            continue;
        }
        if (row.status === 'sending') {
            await env.APP_DB.prepare(`
                UPDATE notification_outbox
                SET status = 'delivery_unknown', last_error = 'Queue redelivered after SMTP sending began.', updated_at = ?
                WHERE id = ? AND status = 'sending'
            `).bind(new Date().toISOString(), outboxId).run();
            message.ack();
            continue;
        }
        const attempt = Number(row.attempts || 0) + 1;
        const now = new Date().toISOString();
        const claimed = await env.APP_DB.prepare(`
            UPDATE notification_outbox SET status = 'sending', attempts = ?, last_attempt_at = ?, updated_at = ?
            WHERE id = ? AND status IN ('queued', 'retrying')
        `).bind(attempt, now, now, outboxId).run();
        if (!Number(claimed.meta?.changes || 0)) {
            message.ack();
            continue;
        }
        try {
            const payload = JSON.parse(row.payload_json || '{}');
            if (row.event_type === 'order.lookup_otp') {
                const secret = String(env.ORDER_LOOKUP_OTP_PEPPER || '');
                if (secret.length < 24) throw new Error('Order lookup OTP secret is not configured.');
                payload.otp = await decryptText(payload.otp_encrypted, secret, payload.otp_context);
                delete payload.otp_encrypted;
                delete payload.otp_context;
            }
            const rendered = renderEmail(row.event_type, payload, row.locale);
            const result = await mailer.send({
                to: row.recipient_email,
                toName: payload.customer_name || '',
                subject: rendered.subject,
                html: rendered.html,
                messageId: `${row.id}@thegioitrimun.vn`,
            });
            await env.APP_DB.prepare(`
                UPDATE notification_outbox SET status = 'accepted', accepted_at = ?, smtp_response = ?, last_error = NULL, updated_at = ? WHERE id = ?
            `).bind(now, result.response, now, outboxId).run();
            message.ack();
        } catch (error) {
            const deliveryUnknown = Boolean(error?.deliveryUnknown);
            const terminal = deliveryUnknown || attempt >= Number(env.EMAIL_MAX_ATTEMPTS || 6);
            const status = deliveryUnknown ? 'delivery_unknown' : terminal ? 'failed' : 'retrying';
            const delaySeconds = retryDelay(attempt);
            const availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
            await env.APP_DB.prepare(`
                UPDATE notification_outbox SET status = ?, available_at = ?, last_error = ?, updated_at = ? WHERE id = ?
            `).bind(status, availableAt, String(error?.message || error).slice(0, 1000), now, outboxId).run();
            if (terminal) message.ack();
            else message.retry({ delaySeconds });
        }
    }
}
