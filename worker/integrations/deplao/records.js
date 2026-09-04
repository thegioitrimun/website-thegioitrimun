import { randomId } from '../../platform/crypto.js';

const BASE_URL = 'https://thegioitrimun.vn';

export function isDeplaoAutomationEnabled(env) {
    return String(env?.DEPLAO_ORDER_AUTOMATION_ENABLED || '').toLowerCase() === 'true';
}

export function isTelegramOrderAlertsEnabled(env) {
    return String(env?.TELEGRAM_ORDER_ALERTS_ENABLED || '').toLowerCase() === 'true';
}

export function buildOrderAutomationPayload(order, items = [], extra = {}, env = {}) {
    const siteUrl = String(env.PUBLIC_SITE_URL || BASE_URL).replace(/\/+$/, '');
    const normalizedItems = items.map((item) => ({
        product_id: item.product_id ?? null,
        name: String(item.product_name || item.name || `Sản phẩm #${item.product_id || ''}`).trim(),
        sku: String(item.product_sku || item.sku || '').trim(),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.price_at_purchase ?? item.unit_price ?? 0),
        line_total: Number(item.line_total ?? (Number(item.price_at_purchase || 0) * Number(item.quantity || 0))),
    }));
    return {
        event_type: String(extra.event_type || 'order.created'),
        order_id: order.id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email || '',
        shipping_address: order.shipping_address || [
            order.shipping_street,
            order.shipping_ward,
            order.shipping_district,
            order.shipping_province,
        ].filter(Boolean).join(', '),
        shipping_provider: order.shipping_provider || '',
        notes: order.notes || '',
        currency: order.currency || 'VND',
        subtotal: Number(order.subtotal_price || 0),
        discount_amount: Number(order.discount_amount || 0),
        shipping_fee: Number(order.shipping_fee || 0),
        tax_amount: Number(order.tax_amount || 0),
        total: Number(order.grand_total ?? order.total_price ?? 0),
        order_status: order.status || 'pending',
        payment_method: order.payment_method || '',
        payment_provider: order.payment_provider || '',
        payment_status: order.payment_status || 'unpaid',
        payment_reference: order.payment_reference || '',
        paid_at: order.paid_at || extra.paid_at || null,
        transaction_ref: extra.transaction_ref || '',
        received_amount: Number(extra.received_amount || 0),
        items: normalizedItems,
        lookup_url: `${siteUrl}/tra-cuu-don-hang`,
        admin_url: `${siteUrl}/admin/pancake-pos`,
        created_at: order.created_at || extra.created_at || new Date().toISOString(),
    };
}

export function createDeplaoJobStatement(db, input) {
    const now = input.now || new Date().toISOString();
    const expiresAt = input.expiresAt || new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.prepare(`INSERT OR IGNORE INTO deplao_automation_jobs (
        id, event_type, order_id, order_code, idempotency_key, payload_json,
        status, attempts, available_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`)
        .bind(
            input.id || randomId(), input.eventType, input.orderId, input.orderCode,
            input.idempotencyKey, JSON.stringify(input.payload || {}),
            now, expiresAt, now, now,
        );
}

export function createTelegramOutboxStatement(db, input) {
    const now = input.now || new Date().toISOString();
    return db.prepare(`INSERT OR IGNORE INTO telegram_order_outbox (
        id, event_type, order_id, idempotency_key, payload_json, status,
        attempts, available_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`)
        .bind(
            input.id || randomId(), input.eventType, input.orderId || null,
            input.idempotencyKey, JSON.stringify(input.payload || {}), now, now, now,
        );
}

export function appendOrderAutomationStatements(statements, db, env, input) {
    if (isDeplaoAutomationEnabled(env)) {
        statements.push(createDeplaoJobStatement(db, {
            eventType: input.eventType,
            orderId: input.order.id,
            orderCode: input.order.order_code,
            idempotencyKey: `deplao/${input.eventType}/${input.order.id}`,
            payload: input.payload,
            now: input.now,
        }));
    }
    if (isTelegramOrderAlertsEnabled(env)) {
        statements.push(createTelegramOutboxStatement(db, {
            eventType: input.eventType,
            orderId: input.order.id,
            idempotencyKey: `telegram/${input.eventType}/${input.order.id}`,
            payload: input.payload,
            now: input.now,
        }));
    }
    return statements;
}
