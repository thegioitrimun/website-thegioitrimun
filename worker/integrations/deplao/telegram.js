import { randomId } from '../../platform/crypto.js';
import { getSpxA5Label } from '../../shipping/spxLabel.js';
import { createTelegramOutboxStatement, isTelegramOrderAlertsEnabled } from './records.js';

const TELEGRAM_MAX_CHARS = 4096;
const TELEGRAM_CHUNK_CHARS = 3500;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function money(value, currency = 'VND') {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value || 0)))} ${escapeHtml(currency || 'VND')}`;
}

function orderItems(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return '• Không có chi tiết sản phẩm';
    return items.map((item) => `• ${escapeHtml(item.name)} × ${Number(item.quantity || 0)} — ${money(item.line_total, payload.currency)}`).join('\n');
}

const PANCAKE_VALUE_LABELS = Object.freeze({
    pos: 'Pancake POS',
    online: 'Pancake Online',
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipped: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
    unpaid: 'Chưa thanh toán',
    paid: 'Đã thanh toán',
    cash: 'Tiền mặt',
    cod: 'COD',
    bank_transfer: 'Chuyển khoản',
});

function pancakeValue(value) {
    const normalized = String(value ?? '');
    return PANCAKE_VALUE_LABELS[normalized] || normalized || '—';
}

function pancakeChanges(payload) {
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    if (!changes.length) return '';
    return changes.map((change) => {
        const from = change?.kind === 'money' ? money(change.from, payload.currency) : escapeHtml(pancakeValue(change?.from));
        const to = change?.kind === 'money' ? money(change.to, payload.currency) : escapeHtml(pancakeValue(change?.to));
        return `• <b>${escapeHtml(change?.label || change?.field)}:</b> ${from} → ${to}`;
    }).join('\n');
}

function pancakeChangeHeading(payload) {
    if (payload.order_status === 'refunded' || payload.payment_status === 'refunded') return '↩️ <b>PANCAKE — HOÀN TIỀN</b>';
    if (payload.order_status === 'cancelled') return '❌ <b>PANCAKE — ĐƠN ĐÃ HỦY</b>';
    if (payload.payment_status === 'paid') return '💰 <b>PANCAKE — ĐÃ THANH TOÁN</b>';
    if (payload.order_status === 'completed') return '✅ <b>PANCAKE — ĐƠN HOÀN TẤT</b>';
    return '🔄 <b>PANCAKE — CẬP NHẬT GIAO DỊCH</b>';
}

export function renderTelegramAlert(eventType, payload = {}) {
    if (eventType === 'pancake.spx.label.ready') {
        return [
            '🚚 <b>VẬN ĐƠN SPX — PDF A5</b>',
            `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>`,
            `<b>Mã vận đơn:</b> <code>${escapeHtml(payload.tracking_code)}</code>`,
            `<b>Đơn vị vận chuyển:</b> ${escapeHtml(payload.provider_label || 'SPX Express')}`,
            '<b>Khổ in:</b> A5 — in 100%, không co giãn',
            `<a href="${escapeHtml(payload.admin_url)}">Mở đơn trên trang quản trị</a>`,
        ].filter(Boolean).join('\n');
    }
    if (eventType === 'pancake.order.created') {
        return [
            '🧾 <b>GIAO DỊCH PANCAKE MỚI</b>',
            `<b>Kênh:</b> ${escapeHtml(payload.channel_label || pancakeValue(payload.order_channel))}`,
            `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>`,
            `<b>ID Pancake:</b> <code>${escapeHtml(payload.pancake_order_id)}</code>`,
            `<b>Khách:</b> ${escapeHtml(payload.customer_name)}`,
            payload.customer_phone ? `<b>Điện thoại:</b> <code>${escapeHtml(payload.customer_phone)}</code>` : '',
            '',
            '<b>Sản phẩm:</b>',
            orderItems(payload),
            '',
            `<b>Tổng tiền:</b> ${money(payload.total, payload.currency)}`,
            `<b>Trạng thái:</b> ${escapeHtml(pancakeValue(payload.order_status))}`,
            `<b>Thanh toán:</b> ${escapeHtml(pancakeValue(payload.payment_method))} / ${escapeHtml(pancakeValue(payload.payment_status))}`,
            payload.notes ? `<b>Ghi chú:</b> ${escapeHtml(payload.notes)}` : '',
            `<a href="${escapeHtml(payload.admin_url)}">Mở đơn trên trang quản trị</a>`,
        ].filter(Boolean).join('\n');
    }
    if (eventType === 'pancake.order.changed') {
        return [
            pancakeChangeHeading(payload),
            `<b>Kênh:</b> ${escapeHtml(payload.channel_label || pancakeValue(payload.order_channel))}`,
            `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>`,
            `<b>ID Pancake:</b> <code>${escapeHtml(payload.pancake_order_id)}</code>`,
            payload.customer_name ? `<b>Khách:</b> ${escapeHtml(payload.customer_name)}` : '',
            '',
            '<b>Thay đổi:</b>',
            pancakeChanges(payload),
            '',
            `<b>Tổng tiền hiện tại:</b> ${money(payload.total, payload.currency)}`,
            `<a href="${escapeHtml(payload.admin_url)}">Mở đơn trên trang quản trị</a>`,
        ].filter(Boolean).join('\n');
    }
    if (eventType === 'order.created') {
        return [
            '🛍️ <b>ĐƠN HÀNG MỚI</b>',
            `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>`,
            `<b>Khách:</b> ${escapeHtml(payload.customer_name)}`,
            `<b>Điện thoại:</b> <code>${escapeHtml(payload.customer_phone)}</code>`,
            payload.customer_email ? `<b>Email:</b> ${escapeHtml(payload.customer_email)}` : '',
            `<b>Địa chỉ:</b> ${escapeHtml(payload.shipping_address)}`,
            '',
            '<b>Sản phẩm:</b>',
            orderItems(payload),
            '',
            `<b>Tổng tiền:</b> ${money(payload.total, payload.currency)}`,
            `<b>Thanh toán:</b> ${escapeHtml(payload.payment_method)} / ${escapeHtml(payload.payment_status)}`,
            payload.notes ? `<b>Ghi chú:</b> ${escapeHtml(payload.notes)}` : '',
            `<a href="${escapeHtml(payload.admin_url)}">Mở trang quản trị</a>`,
        ].filter(Boolean).join('\n');
    }
    if (eventType === 'order.paid') {
        return [
            '✅ <b>ĐƠN HÀNG ĐÃ THANH TOÁN</b>',
            `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>`,
            `<b>Khách:</b> ${escapeHtml(payload.customer_name)} — <code>${escapeHtml(payload.customer_phone)}</code>`,
            `<b>Số tiền:</b> ${money(payload.received_amount || payload.total, payload.currency)}`,
            `<b>Kênh:</b> ${escapeHtml(payload.payment_provider || payload.payment_method)}`,
            payload.transaction_ref ? `<b>Mã giao dịch:</b> <code>${escapeHtml(payload.transaction_ref)}</code>` : '',
        ].filter(Boolean).join('\n');
    }

    const labels = {
        'deplao.completed': '✅ <b>ZALO ĐÃ GỬI THÀNH CÔNG</b>',
        'deplao.waiting_friend': '👥 <b>ZALO ĐANG CHỜ KẾT BẠN</b>',
        'deplao.failed': '❌ <b>ZALO AUTOMATION THẤT BẠI</b>',
        'deplao.delivery_unknown': '⚠️ <b>CHƯA XÁC ĐỊNH ĐÃ GỬI ZALO</b>',
        'deplao.expired': '⌛ <b>JOB ZALO ĐÃ HẾT HẠN</b>',
        'deplao.device_offline': '🔌 <b>MÁY DEPLAO ĐANG OFFLINE</b>',
        'deplao.device_recovered': '🟢 <b>MÁY DEPLAO ĐÃ KẾT NỐI LẠI</b>',
    };
    return [
        labels[eventType] || `ℹ️ <b>${escapeHtml(eventType)}</b>`,
        payload.order_code ? `<b>Mã đơn:</b> <code>${escapeHtml(payload.order_code)}</code>` : '',
        payload.customer_name ? `<b>Khách:</b> ${escapeHtml(payload.customer_name)}` : '',
        payload.customer_phone ? `<b>Điện thoại:</b> <code>${escapeHtml(payload.customer_phone)}</code>` : '',
        payload.device_id ? `<b>Thiết bị:</b> <code>${escapeHtml(payload.device_id)}</code>` : '',
        payload.account_id ? `<b>Tài khoản Zalo:</b> <code>${escapeHtml(payload.account_id)}</code>` : '',
        Number.isFinite(Number(payload.backlog_count)) ? `<b>Việc đang chờ:</b> ${Number(payload.backlog_count)}` : '',
        payload.friend_request_sent ? '<b>Yêu cầu kết bạn:</b> Đã gửi' : '',
        payload.message ? `<b>Chi tiết:</b> ${escapeHtml(payload.message)}` : '',
        payload.last_error ? `<b>Lỗi:</b> ${escapeHtml(payload.last_error)}` : '',
    ].filter(Boolean).join('\n');
}

export function splitTelegramMessage(text, limit = TELEGRAM_CHUNK_CHARS) {
    const source = String(text || '');
    if (source.length <= Math.min(limit, TELEGRAM_MAX_CHARS)) return [source];
    const chunks = [];
    let remaining = source;
    while (remaining.length) {
        if (remaining.length <= limit) {
            chunks.push(remaining);
            break;
        }
        let cut = remaining.lastIndexOf('\n', limit);
        if (cut < Math.floor(limit * 0.6)) cut = limit;
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut).replace(/^\n+/, '');
    }
    return chunks;
}

async function sendTelegram(env, text) {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
    if (!token || !chatId) throw new Error('Telegram bot token or private chat ID is not configured.');
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.description || `Telegram API returned ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    return body.result?.message_id;
}

export async function sendTelegramDocument(env, { bytes, filename, caption }) {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
    if (!token || !chatId) throw new Error('Telegram bot token or private chat ID is not configured.');
    const safeFilename = String(filename || 'SPX-A5.pdf')
        .replace(/[^a-zA-Z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'SPX-A5.pdf';
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', String(caption || '').slice(0, 1024));
    form.append('parse_mode', 'HTML');
    form.append('document', new Blob([bytes], { type: 'application/pdf' }), safeFilename);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.description || `Telegram API returned ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    return body.result?.message_id;
}

function retryDelay(attempt) {
    return Math.min(6 * 60 * 60, 30 * Math.pow(2, Math.max(0, attempt - 1)));
}

export async function dispatchPendingTelegram(env, limit = 50) {
    if (!env.APP_DB || !env.TELEGRAM_QUEUE || !isTelegramOrderAlertsEnabled(env)) return { skipped: true, queued: 0 };
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await env.APP_DB.prepare(`UPDATE telegram_order_outbox
        SET status = 'retrying', available_at = ?, queued_at = NULL,
            last_error = 'Telegram queue dispatch lease expired.', updated_at = ?
        WHERE status = 'queued' AND queued_at < ?`).bind(now, now, stale).run();
    const rows = await env.APP_DB.prepare(`SELECT id FROM telegram_order_outbox
        WHERE status IN ('pending', 'retrying') AND available_at <= ?
        ORDER BY created_at LIMIT ?`).bind(now, Math.max(1, Math.min(100, Number(limit || 50)))).all();
    const ids = (rows.results || []).map((row) => row.id);
    if (!ids.length) return { skipped: false, queued: 0 };
    const claims = await env.APP_DB.batch(ids.map((id) => env.APP_DB.prepare(`UPDATE telegram_order_outbox
        SET status = 'queued', queued_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'retrying')`).bind(now, now, id)));
    const claimedIds = ids.filter((_id, index) => Number(claims[index]?.meta?.changes || 0) > 0);
    let queued = 0;
    for (const id of claimedIds) {
        try {
            await env.TELEGRAM_QUEUE.send({ kind: 'telegram', outboxId: id });
            queued += 1;
        } catch (error) {
            await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'retrying', queued_at = NULL,
                available_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND status = 'queued'`)
                .bind(new Date(Date.now() + 30_000).toISOString(), String(error?.message || error).slice(0, 1000), now, id).run();
        }
    }
    return { skipped: false, queued };
}

export async function consumeTelegramQueue(batch, env) {
    if (!env.APP_DB) {
        for (const message of batch.messages) message.retry({ delaySeconds: 300 });
        return;
    }
    for (const message of batch.messages) {
        const id = message.body?.outboxId;
        if (!id) { message.ack(); continue; }
        const row = await env.APP_DB.prepare('SELECT * FROM telegram_order_outbox WHERE id = ? LIMIT 1').bind(id).first();
        if (!row || ['accepted', 'delivery_unknown', 'failed'].includes(row.status)) { message.ack(); continue; }
        if (!isTelegramOrderAlertsEnabled(env)) {
            const now = new Date().toISOString();
            if (row.status === 'queued') {
                await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'retrying', queued_at = NULL,
                    available_at = ?, last_error = 'Telegram alerts are disabled.', updated_at = ? WHERE id = ? AND status = 'queued'`)
                    .bind(new Date(Date.now() + 5 * 60 * 1000).toISOString(), now, id).run();
            } else if (row.status === 'sending') {
                await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'delivery_unknown',
                    last_error = 'Telegram alerts were disabled after delivery began.', updated_at = ? WHERE id = ? AND status = 'sending'`)
                    .bind(now, id).run();
            }
            message.ack();
            continue;
        }
        if (row.status === 'sending') {
            await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'delivery_unknown',
                last_error = 'Queue redelivered after Telegram delivery began.', updated_at = ? WHERE id = ?`)
                .bind(new Date().toISOString(), id).run();
            message.ack();
            continue;
        }
        const attempt = Number(row.attempts || 0) + 1;
        const now = new Date().toISOString();
        const claimed = await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'sending', attempts = ?,
            last_attempt_at = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'retrying')`)
            .bind(attempt, now, now, id).run();
        if (!Number(claimed.meta?.changes || 0)) { message.ack(); continue; }
        const sentIds = [];
        let telegramDeliveryStarted = false;
        try {
            const payload = JSON.parse(row.payload_json || '{}');
            if (row.event_type === 'pancake.spx.label.ready') {
                const label = await getSpxA5Label(env, payload);
                telegramDeliveryStarted = true;
                sentIds.push(await sendTelegramDocument(env, {
                    bytes: label.bytes,
                    filename: payload.filename || 'SPX-A5.pdf',
                    caption: renderTelegramAlert(row.event_type, payload),
                }));
            } else {
                for (const chunk of splitTelegramMessage(renderTelegramAlert(row.event_type, payload))) {
                    telegramDeliveryStarted = true;
                    sentIds.push(await sendTelegram(env, chunk));
                }
            }
            await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = 'accepted', accepted_at = ?,
                telegram_message_ids_json = ?, last_error = NULL, updated_at = ? WHERE id = ?`)
                .bind(now, JSON.stringify(sentIds), now, id).run();
            message.ack();
        } catch (error) {
            const ambiguous = sentIds.length > 0 || (telegramDeliveryStarted
                && /timeout|socket|network|fetch failed/i.test(String(error?.message || error)));
            const terminal = ambiguous || attempt >= Number(env.TELEGRAM_MAX_ATTEMPTS || 6);
            const status = ambiguous ? 'delivery_unknown' : terminal ? 'failed' : 'retrying';
            const delay = retryDelay(attempt);
            await env.APP_DB.prepare(`UPDATE telegram_order_outbox SET status = ?, available_at = ?,
                telegram_message_ids_json = ?, last_error = ?, updated_at = ? WHERE id = ?`)
                .bind(status, new Date(Date.now() + delay * 1000).toISOString(), JSON.stringify(sentIds),
                    String(error?.message || error).slice(0, 1000), now, id).run();
            if (terminal) message.ack(); else message.retry({ delaySeconds: delay });
        }
    }
}

export async function enqueueTelegramAlert(db, env, input) {
    if (!isTelegramOrderAlertsEnabled(env)) return false;
    await createTelegramOutboxStatement(db, {
        id: randomId(),
        eventType: input.eventType,
        orderId: input.orderId || null,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        now: input.now,
    }).run();
    return true;
}
