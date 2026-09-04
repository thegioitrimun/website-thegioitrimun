import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { randomId, sha256, timingSafeEqual } from '../platform/crypto.js';
import { createOutboxStatement } from '../email/outbox.js';
import { getSession, requireCsrf, requireGuestCsrf, requireRole } from '../auth/session.js';
import { paymentStateAfterFulfillment } from '../orders/paymentState.js';
import {
    calculateFee,
    cancelShipment,
    createShipment,
    getPickAddress,
    getShipmentLabel,
    listPickAddresses,
    trackShipment,
} from './ghtk.js';

const STATUS_MAP = new Map([
    ['-1', 'cancelled'], ['2', 'processing'], ['3', 'processing'], ['123', 'processing'],
    ['4', 'shipped'], ['5', 'completed'], ['6', 'completed'], ['45', 'completed'],
    ['12', 'cancelled'], ['21', 'cancelled'],
]);

function ghtkEnabled(env) {
    return String(env.GHTK_ENABLED || 'true').toLowerCase() !== 'false'
        && Boolean(String(env.GHTK_TOKEN || '').trim());
}

function requireGhtkEnabled(env) {
    if (!ghtkEnabled(env)) {
        throw Object.assign(new Error('GHTK integration is disabled until its token is configured.'), {
            status: 503,
            code: 'GHTK_DISABLED',
        });
    }
}

async function authorizeWrite(db, request) {
    const session = await getSession(db, request);
    if (session) await requireCsrf(db, request, session);
    else requireGuestCsrf(request);
}

function cleanAddress(street, ...parts) {
    let result = String(street || '');
    for (const part of parts.filter(Boolean)) {
        const escaped = String(part).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`,?\\s*${escaped}`, 'gi'), '');
    }
    return result.replace(/,+/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
}

async function getOrder(db, id) {
    const order = await db.prepare('SELECT * FROM product_orders WHERE id = ? LIMIT 1').bind(id).first();
    if (!order) throw Object.assign(new Error('Order was not found.'), { status: 404 });
    const items = await db.prepare('SELECT * FROM product_order_items WHERE order_id = ?').bind(id).all();
    return { ...order, items: items.results || [] };
}

function notificationPayload(order, extra = {}) {
    return {
        order_id: order.id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        grand_total: order.grand_total,
        subtotal_price: order.subtotal_price,
        discount_amount: order.discount_amount,
        taxable_amount: order.taxable_amount,
        tax_amount: order.tax_amount,
        tax_rate: order.tax_rate,
        shipping_fee: order.shipping_fee,
        shipping_tax_rate: order.shipping_tax_rate,
        shipping_tax_amount: order.shipping_tax_amount,
        shipping_address: [order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', '),
        payment_method: order.payment_method,
        payment_status: order.payment_status || 'unpaid',
        payment_provider: order.payment_provider || null,
        payment_reference: order.payment_reference || null,
        paid_at: order.paid_at || null,
        items: order.items.map((item) => ({
            product_id: item.product_id,
            name: item.product_name,
            quantity: item.quantity,
            price_at_purchase: item.price_at_purchase,
        })),
        ...extra,
    };
}

export async function handleFee(request, env) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        await authorizeWrite(db, request);
        const body = await readJson(request, 32 * 1024);
        for (const field of ['address', 'province', 'district', 'ward']) {
            if (!String(body[field] || '').trim()) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
        }
        const weight = Math.max(100, Math.min(100000, Math.round(Number(body.weight || 0))));
        const fee = await calculateFee(env, { ...body, weight });
        return json({ ...fee, estimated_delivery_time: fee.delivery ? String(fee.delivery) : '2-4 ngày' });
    } catch (error) {
        return apiError(error, 'Could not calculate shipping fee.');
    }
}

export async function enqueueShipment(request, env, operation) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 32 * 1024);
        const orderId = String(body.orderId ?? body.order_id ?? '').trim();
        if (!orderId) throw Object.assign(new Error('orderId is required.'), { status: 400 });
        const order = await getOrder(db, orderId);
        const id = randomId();
        const now = new Date().toISOString();
        const key = `${operation}/${orderId}`;
        await db.prepare(`
            INSERT OR IGNORE INTO shipping_outbox (
                id, order_id, operation, idempotency_key, payload_json, status,
                attempts, available_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
        `).bind(id, orderId, operation, key, JSON.stringify(body), now, now, now).run();
        const row = await db.prepare('SELECT id, status FROM shipping_outbox WHERE idempotency_key = ? LIMIT 1').bind(key).first();
        if (row?.status !== 'completed') await dispatchPendingShipping(env, 1, row.id);
        return json({
            accepted: true,
            operationId: row.id,
            status: row.status,
            order: { ...order, order_items: order.items },
        }, 202);
    } catch (error) {
        return apiError(error, 'Could not queue shipping operation.');
    }
}

export async function dispatchPendingShipping(env, limit = 50, onlyId = null) {
    if (!env.APP_DB || !env.SHIPPING_QUEUE || !ghtkEnabled(env)) {
        return { skipped: true, queued: 0, reason: 'GHTK_DISABLED' };
    }
    const now = new Date().toISOString();
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    const rows = onlyId
        ? await env.APP_DB.prepare(`SELECT id FROM shipping_outbox WHERE id = ? AND status IN ('pending', 'retrying') AND available_at <= ? LIMIT 1`).bind(onlyId, now).all()
        : await env.APP_DB.prepare(`SELECT id FROM shipping_outbox WHERE status IN ('pending', 'retrying') AND available_at <= ? ORDER BY created_at LIMIT ?`).bind(now, safeLimit).all();

    let queued = 0;
    for (const row of rows.results || []) {
        const leaseToken = randomId();
        const reserved = await env.APP_DB.prepare(`
            UPDATE shipping_outbox
            SET status = 'processing', queued_at = ?, lease_token = ?, updated_at = ?
            WHERE id = ? AND status IN ('pending', 'retrying') AND available_at <= ?
        `).bind(now, leaseToken, now, row.id, now).run();
        if (!Number(reserved.meta?.changes || 0)) continue;
        try {
            await env.SHIPPING_QUEUE.send({ kind: 'shipping', outboxId: row.id, leaseToken });
            queued += 1;
        } catch (error) {
            await env.APP_DB.prepare(`
                UPDATE shipping_outbox
                SET status = 'retrying', available_at = ?, lease_token = NULL, last_error = ?, updated_at = ?
                WHERE id = ? AND lease_token = ?
            `).bind(
                new Date(Date.now() + 30_000).toISOString(),
                String(error?.message || error).slice(0, 1000),
                now,
                row.id,
                leaseToken,
            ).run();
        }
    }
    return { skipped: false, queued };
}

export async function handleTrack(request, env, orderId) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        await requireRole(db, request, ['admin', 'master_admin']);
        const order = await getOrder(db, orderId);
        if (!order.ghtk_label) throw Object.assign(new Error('Order has no GHTK shipment.'), { status: 404 });
        const payload = await trackShipment(env, order.ghtk_label);
        const providerOrder = payload?.order || {};
        const events = Array.isArray(providerOrder.log)
            ? providerOrder.log.map((entry) => ({
                status: String(entry?.status_text || entry?.status || ''),
                timestamp: String(entry?.created || entry?.created_at || ''),
                location: String(entry?.address || entry?.location || 'N/A'),
            }))
            : [];
        if (providerOrder.status_text) {
            await db.prepare('UPDATE product_orders SET ghtk_status_text = ?, updated_at = ? WHERE id = ?')
                .bind(String(providerOrder.status_text), new Date().toISOString(), order.id).run();
        }
        return json({ events });
    } catch (error) {
        return apiError(error, 'Could not track shipment.');
    }
}

export async function handleLabel(request, env, orderId) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        await requireRole(db, request, ['admin', 'master_admin']);
        const order = await getOrder(db, orderId);
        if (!order.ghtk_label) throw Object.assign(new Error('Order has no GHTK shipment.'), { status: 404 });
        const response = await getShipmentLabel(env, order.ghtk_label);
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/pdf');
        headers.set('Cache-Control', 'private, no-store');
        return new Response(response.body, { status: 200, headers });
    } catch (error) {
        return apiError(error, 'Could not load shipping label.');
    }
}

export async function handlePickAddresses(request, env, id = null) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        await requireRole(db, request, ['admin', 'master_admin']);
        return json(id ? await getPickAddress(env, id) : await listPickAddresses(env));
    } catch (error) {
        return apiError(error, 'Could not load pick-up addresses.');
    }
}

export async function handleWebhook(request, env) {
    try {
        requireGhtkEnabled(env);
        const db = requireD1(env);
        const configured = String(env.GHTK_WEBHOOK_SECRET || env.GHTK_WEBHOOK_TOKEN || '');
        const provided = new URL(request.url).searchParams.get('token') || request.headers.get('X-GHTK-Token') || '';
        if (!configured || !timingSafeEqual(configured, provided)) {
            throw Object.assign(new Error('Unauthorized.'), { status: 401 });
        }
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 128 * 1024) {
            throw Object.assign(new Error('Webhook payload is too large.'), { status: 413 });
        }
        const payload = JSON.parse(raw || '{}');
        const label = String(payload.label_id || payload.label || '').trim();
        const providerStatus = String(payload.status_id ?? '').trim();
        if (!label || !providerStatus) throw Object.assign(new Error('Invalid GHTK webhook payload.'), { status: 400 });
        const eventHash = await sha256(raw);
        const receiptId = randomId();
        const now = new Date().toISOString();
        const receipt = await db.prepare(`
            INSERT OR IGNORE INTO webhook_receipts (
                id, provider, event_hash, headers_json, payload_json, received_at, status
            ) VALUES (?, 'ghtk', ?, '{}', ?, ?, 'received')
        `).bind(receiptId, eventHash, raw, now).run();
        if (!Number(receipt.meta?.changes || 0)) return json({ success: true, duplicate: true });

        const order = await db.prepare('SELECT * FROM product_orders WHERE ghtk_label = ? OR shipping_code = ? LIMIT 1')
            .bind(label, label).first();
        if (!order) {
            await db.prepare(`UPDATE webhook_receipts SET status = 'ignored', processed_at = ? WHERE id = ?`).bind(now, receiptId).run();
            return json({ success: true, ignored: true });
        }
        const mapped = STATUS_MAP.get(providerStatus) || null;
        const statusText = String(payload.status_text || 'Trạng thái GHTK đã cập nhật').slice(0, 500);
        const statements = [
            db.prepare('UPDATE product_orders SET ghtk_status_text = ?, updated_at = ? WHERE id = ?')
                .bind(statusText, now, order.id),
            db.prepare(`INSERT INTO shipping_status_history (id, shipment_id, provider_status, mapped_status, payload_json, occurred_at, created_at)
                SELECT ?, id, ?, ?, ?, ?, ? FROM shipping_shipments WHERE order_id = ?`)
                .bind(randomId(), providerStatus, mapped, raw, now, now, order.id),
            db.prepare(`UPDATE webhook_receipts SET status = 'processed', processed_at = ? WHERE id = ?`).bind(now, receiptId),
        ];
        if (mapped && mapped !== order.status) {
            const paymentState = paymentStateAfterFulfillment(order, mapped, now);
            statements.push(
                db.prepare(`UPDATE product_orders SET status = ?, fulfillment_status = ?,
                    payment_status = CASE WHEN ? = 1 THEN 'paid' ELSE payment_status END,
                    paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, ?) ELSE paid_at END,
                    updated_at = ? WHERE id = ?`)
                    .bind(mapped, mapped, paymentState.changed ? 1 : 0, paymentState.changed ? 1 : 0,
                        paymentState.paid_at, now, order.id),
                db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, ?, NULL, 'ghtk', ?, ?)`)
                    .bind(randomId(), order.id, order.status, mapped, `GHTK ${providerStatus}: ${statusText}`, now),
            );
            if (paymentState.changed) {
                statements.push(db.prepare(`UPDATE order_payment_logs SET status = 'paid', paid_at = ?,
                    transaction_ref = COALESCE(transaction_ref, 'COD'), metadata_json = ?
                    WHERE order_id = ? AND status = 'unpaid'`)
                    .bind(paymentState.paid_at, JSON.stringify({ provider: 'cod', confirmation: 'delivery_completed' }), order.id));
            }
            if (['processing', 'shipped', 'completed', 'cancelled'].includes(mapped) && order.customer_email) {
                const items = await db.prepare('SELECT * FROM product_order_items WHERE order_id = ?').bind(order.id).all();
                statements.push(createOutboxStatement(db, {
                    eventType: `order.${mapped}`, aggregateType: 'order', aggregateId: order.id, audience: 'customer',
                    recipientEmail: order.customer_email, locale: order.locale,
                    payload: notificationPayload({
                        ...order,
                        items: items.results || [],
                        payment_status: paymentState.payment_status,
                        paid_at: paymentState.paid_at,
                    }, { tracking_code: order.shipping_code, ghtk_status_text: statusText }),
                    idempotencyKey: `customer/order.${mapped}/${order.id}`,
                }));
            }
        }
        await db.batch(statements);
        return json({ success: true });
    } catch (error) {
        return apiError(error, 'Could not process GHTK webhook.');
    }
}

async function processCreate(db, env, row, order) {
    const addresses = await listPickAddresses(env).catch(() => []);
    const pick = addresses.find((item) => Number(item.is_default) === 1) || {
        pick_name: env.GHTK_PICK_NAME,
        pick_address: env.GHTK_PICK_ADDRESS,
        pick_province: env.GHTK_PICK_PROVINCE,
        pick_district: env.GHTK_PICK_DISTRICT,
        pick_ward: env.GHTK_PICK_WARD,
        pick_tel: env.GHTK_PICK_PHONE,
    };
    const shipment = await createShipment(env, {
        products: order.items.map((item) => ({ name: item.product_name, weight: 0.2, quantity: item.quantity })),
        order: {
            id: order.order_code,
            pick_name: pick.pick_name,
            pick_address: pick.pick_address,
            pick_province: pick.pick_province,
            pick_district: pick.pick_district,
            pick_ward: pick.pick_ward,
            pick_tel: pick.pick_tel,
            name: order.customer_name,
            address: cleanAddress(order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province),
            province: order.shipping_province,
            district: order.shipping_district,
            ward: order.shipping_ward,
            hamlet: 'Khác',
            tel: order.customer_phone,
            note: order.notes || 'Không có ghi chú',
            is_freeship: '0',
            pick_money: order.payment_method === 'cod' && order.payment_status !== 'paid'
                ? Math.round(order.grand_total)
                : 0,
            value: Math.round(order.grand_total),
            transport: 'road',
        },
    });
    const now = new Date().toISOString();
    const statements = [
        db.prepare(`INSERT OR REPLACE INTO shipping_shipments (id, order_id, provider, provider_order_id, tracking_code, status, status_text, request_json, response_json, created_at, updated_at) VALUES (?, ?, 'ghtk', ?, ?, 'processing', 'Đã tiếp nhận', ?, ?, ?, ?)`)
            .bind(randomId(), order.id, shipment.label || null, shipment.tracking_id || null, row.payload_json, JSON.stringify(shipment), now, now),
        db.prepare(`UPDATE product_orders SET ghtk_label = ?, shipping_code = ?, ghtk_status_text = 'Đã tiếp nhận', status = 'processing', fulfillment_status = 'processing', updated_at = ? WHERE id = ?`)
            .bind(shipment.label || null, shipment.tracking_id || null, now, order.id),
        db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, 'processing', NULL, 'system', ?, ?)`)
            .bind(randomId(), order.id, order.fulfillment_status || order.status || 'pending', 'GHTK accepted the shipment.', now),
    ];
    if (order.customer_email) {
        statements.push(createOutboxStatement(db, {
            eventType: 'order.processing', aggregateType: 'order', aggregateId: order.id, audience: 'customer',
            recipientEmail: order.customer_email, locale: order.locale,
            payload: notificationPayload(order, { tracking_code: shipment.tracking_id || null }),
            idempotencyKey: `customer/order.processing/${order.id}`,
        }));
    }
    await db.batch(statements);
    return shipment;
}

async function processCancel(db, env, order) {
    if (!order.ghtk_label) throw new Error('Order has no GHTK shipment.');
    const response = await cancelShipment(env, order.ghtk_label);
    const now = new Date().toISOString();
    const statements = [
        db.prepare(`UPDATE shipping_shipments SET status = 'cancelled', status_text = 'Đã hủy', response_json = ?, updated_at = ? WHERE order_id = ? AND provider = 'ghtk'`)
            .bind(JSON.stringify(response || {}), now, order.id),
        db.prepare(`UPDATE product_orders SET ghtk_label = NULL, shipping_code = NULL, ghtk_status_text = 'Đã hủy vận đơn GHTK', status = 'cancelled', fulfillment_status = 'cancelled', updated_at = ? WHERE id = ?`)
            .bind(now, order.id),
        db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, 'cancelled', NULL, 'system', ?, ?)`)
            .bind(randomId(), order.id, order.fulfillment_status || order.status || 'processing', 'GHTK shipment was cancelled.', now),
    ];
    if (order.customer_email) {
        statements.push(createOutboxStatement(db, {
            eventType: 'order.cancelled', aggregateType: 'order', aggregateId: order.id, audience: 'customer',
            recipientEmail: order.customer_email, locale: order.locale,
            payload: notificationPayload(order, { reason: 'Vận đơn GHTK đã được hủy.' }),
            idempotencyKey: `customer/order.cancelled/${order.id}`,
        }));
    }
    await db.batch(statements);
    return response;
}

async function processRefresh(db, env, order) {
    if (!order.ghtk_label) throw new Error('Order has no GHTK shipment.');
    const response = await trackShipment(env, order.ghtk_label);
    const statusText = String(response?.order?.status_text || '').trim();
    if (statusText) {
        await db.prepare(`UPDATE product_orders SET ghtk_status_text = ?, updated_at = ? WHERE id = ?`)
            .bind(statusText, new Date().toISOString(), order.id).run();
    }
    return response;
}

export async function consumeShippingQueue(batch, env) {
    if (!env.APP_DB) {
        for (const message of batch.messages) message.retry({ delaySeconds: 300 });
        return;
    }
    if (!ghtkEnabled(env)) {
        const now = new Date().toISOString();
        for (const message of batch.messages) {
            const id = message.body?.outboxId;
            if (id) {
                await env.APP_DB.prepare(`UPDATE shipping_outbox
                    SET status = 'failed', lease_token = NULL, last_error = 'GHTK integration is disabled.', updated_at = ?
                    WHERE id = ? AND status = 'processing'`).bind(now, id).run();
            }
            message.ack();
        }
        return;
    }
    for (const message of batch.messages) {
        const id = message.body?.outboxId;
        const leaseToken = message.body?.leaseToken;
        const row = id ? await env.APP_DB.prepare('SELECT * FROM shipping_outbox WHERE id = ? LIMIT 1').bind(id).first() : null;
        if (!row || !leaseToken || row.status !== 'processing' || row.lease_token !== leaseToken) {
            message.ack();
            continue;
        }
        const attempt = Number(row.attempts || 0) + 1;
        const now = new Date().toISOString();
        const claimed = await env.APP_DB.prepare(`
            UPDATE shipping_outbox SET attempts = ?, last_error = NULL, updated_at = ?
            WHERE id = ? AND status = 'processing' AND lease_token = ? AND attempts = ?
        `).bind(attempt, now, row.id, leaseToken, Number(row.attempts || 0)).run();
        if (!Number(claimed.meta?.changes || 0)) {
            message.ack();
            continue;
        }
        try {
            const order = await getOrder(env.APP_DB, row.order_id);
            let response;
            if (row.operation === 'create') response = await processCreate(env.APP_DB, env, row, order);
            else if (row.operation === 'cancel') response = await processCancel(env.APP_DB, env, order);
            else if (row.operation === 'refresh') response = await processRefresh(env.APP_DB, env, order);
            else throw new Error('Unsupported shipping operation.');
            await env.APP_DB.prepare(`UPDATE shipping_outbox SET status = 'completed', response_json = ?, lease_token = NULL, last_error = NULL, updated_at = ? WHERE id = ?`)
                .bind(JSON.stringify(response || {}), new Date().toISOString(), row.id).run();
            message.ack();
        } catch (error) {
            const terminal = attempt >= Number(env.SHIPPING_MAX_ATTEMPTS || 5);
            const delay = Math.min(3600, 30 * Math.pow(2, attempt - 1));
            await env.APP_DB.prepare(`UPDATE shipping_outbox SET status = ?, available_at = ?, lease_token = NULL, last_error = ?, updated_at = ? WHERE id = ?`)
                .bind(terminal ? 'failed' : 'retrying', new Date(Date.now() + delay * 1000).toISOString(), String(error?.message || error).slice(0, 1000), new Date().toISOString(), row.id).run();
            if (terminal) message.ack();
            else message.retry({ delaySeconds: delay });
        }
    }
}
