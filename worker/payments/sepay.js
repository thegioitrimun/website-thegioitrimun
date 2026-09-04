import { createOutboxStatement } from '../email/outboxRecord.js';
import {
    createPancakeOrderOutboxStatement,
    dispatchPendingPancakeSyncBestEffort,
} from '../integrations/pancake/outbox.js';
import { appendOrderAutomationStatements, buildOrderAutomationPayload } from '../integrations/deplao/records.js';
import { hmacSha256Hex, randomId, timingSafeEqual } from '../platform/crypto.js';
import { apiError, json, requireD1 } from '../platform/http.js';
import { buildOrderEmailPayload, ORDER_EMAIL_PATTERN } from '../orders/notificationPayload.js';

const DEFAULT_PAYMENT_PREFIX = 'TGTM';
const PAYMENT_SUFFIX_LENGTH = 12;
const DEFAULT_PAYMENT_TTL_MINUTES = 15;
const MAX_WEBHOOK_BYTES = 128 * 1024;
const HMAC_MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const EMAIL_PATTERN = ORDER_EMAIL_PATTERN;
const BANK_NAMES = new Map([
    ['970436', 'Vietcombank'],
    ['970415', 'VietinBank'],
    ['970422', 'MBBank'],
    ['970407', 'Techcombank'],
    ['970423', 'TPBank'],
    ['970418', 'BIDV'],
]);

function clean(value, max = 255) {
    return String(value ?? '').trim().slice(0, max);
}

function normalizeAccount(value) {
    return clean(value, 100).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function paymentPrefix(env) {
    const configured = clean(env?.SEPAY_PAYMENT_PREFIX || DEFAULT_PAYMENT_PREFIX, 8)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    return configured.length >= 2 ? configured : DEFAULT_PAYMENT_PREFIX;
}

function paymentTtlMinutes(env) {
    const value = Number(env?.SEPAY_PAYMENT_TTL_MINUTES || DEFAULT_PAYMENT_TTL_MINUTES);
    return Number.isFinite(value) ? Math.max(5, Math.min(60, Math.round(value))) : DEFAULT_PAYMENT_TTL_MINUTES;
}

function webhookSecret(env) {
    return clean(env?.SEPAY_WEBHOOK_SECRET, 1000);
}

function webhookApiKey(env) {
    return clean(env?.SEPAY_WEBHOOK_API_KEY, 1000);
}

function statusTokenSecret(env) {
    return clean(env?.SEPAY_STATUS_TOKEN_SECRET || env?.SEPAY_WEBHOOK_SECRET || env?.SEPAY_WEBHOOK_API_KEY, 1000);
}

function hasWebhookAuthentication(env) {
    return Boolean(webhookSecret(env) || webhookApiKey(env));
}

function isSepayCheckoutEnabled(env) {
    return String(env?.SEPAY_ENABLED || '').toLowerCase() === 'true';
}

function paymentConfigurationError(message) {
    return Object.assign(new Error(message), { status: 503, code: 'SEPAY_NOT_CONFIGURED' });
}

export async function loadSepayPaymentSettings(db) {
    const row = await db.prepare(`SELECT payload_json FROM site_content
        WHERE resource = 'payment_settings' AND resource_key = '1' AND is_published = 1 LIMIT 1`).first();
    let payload = {};
    try { payload = JSON.parse(row?.payload_json || '{}'); } catch { payload = {}; }
    const bankCode = clean(payload.bank_code || payload.bank_bin, 100);
    const accountNumber = clean(payload.account_number, 100);
    const accountHolderName = clean(payload.account_holder_name, 255);
    return {
        bank_code: bankCode,
        bank_name: clean(payload.bank_name, 255) || BANK_NAMES.get(bankCode) || bankCode,
        account_number: accountNumber,
        account_holder_name: accountHolderName,
        description_prefix: clean(payload.sepay_description_prefix, 64),
    };
}

function assertCheckoutConfiguration(env, settings) {
    if (!isSepayCheckoutEnabled(env)) {
        throw paymentConfigurationError('SePay đang tạm khóa trong lúc hoàn tất cấu hình webhook.');
    }
    if (!hasWebhookAuthentication(env) || !statusTokenSecret(env)) {
        throw paymentConfigurationError('SePay chưa được cấu hình khóa xác thực webhook trên máy chủ.');
    }
    if (!settings.bank_code || !settings.account_number || !settings.account_holder_name) {
        throw paymentConfigurationError('SePay chưa có đủ ngân hàng, số tài khoản và tên chủ tài khoản.');
    }
}

function newPaymentReference(env) {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, PAYMENT_SUFFIX_LENGTH).toUpperCase();
    return `${paymentPrefix(env)}${suffix}`;
}

function paymentDescription(settings, reference) {
    return [settings.description_prefix, reference].filter(Boolean).join(' ');
}

function unaccent(value) {
    return clean(value, 255).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd');
}

export function buildSepayQrUrl(settings, amount, reference) {
    const url = new URL('https://vietqr.app/img');
    url.searchParams.set('acc', settings.account_number);
    url.searchParams.set('bank', settings.bank_code);
    url.searchParams.set('amount', String(Math.max(0, Math.round(Number(amount || 0)))));
    url.searchParams.set('des', paymentDescription(settings, reference));
    url.searchParams.set('template', 'compact');
    url.searchParams.set('showinfo', 'true');
    url.searchParams.set('fullacc', 'true');
    url.searchParams.set('holder', unaccent(settings.account_holder_name).toUpperCase());
    url.searchParams.set('store', 'THE GIOI TRI MUN');
    return url.toString();
}

export async function createSepayStatusToken(env, orderId) {
    const secret = statusTokenSecret(env);
    if (!secret) throw paymentConfigurationError('SePay chưa có khóa bảo vệ trạng thái thanh toán.');
    return hmacSha256Hex(secret, `sepay-payment-status:${orderId}`);
}

async function paymentSession(env, settings, order) {
    return {
        provider: 'sepay',
        status: order.payment_status || 'unpaid',
        reference: order.payment_reference,
        amount: Number(order.grand_total ?? order.total_price ?? 0),
        expires_at: order.payment_expires_at,
        status_token: await createSepayStatusToken(env, order.id),
        qr_url: buildSepayQrUrl(settings, order.grand_total ?? order.total_price, order.payment_reference),
        bank: {
            code: settings.bank_code,
            name: settings.bank_name,
            account_number: settings.account_number,
            account_holder_name: settings.account_holder_name,
        },
    };
}

export async function prepareSepayOrderPayment(db, env, order) {
    const settings = await loadSepayPaymentSettings(db);
    assertCheckoutConfiguration(env, settings);
    const expiresAt = new Date(Date.now() + paymentTtlMinutes(env) * 60 * 1000).toISOString();
    const prepared = {
        ...order,
        payment_provider: 'sepay',
        payment_reference: newPaymentReference(env),
        payment_expires_at: expiresAt,
    };
    return {
        payment_provider: prepared.payment_provider,
        payment_reference: prepared.payment_reference,
        payment_expires_at: prepared.payment_expires_at,
        session: await paymentSession(env, settings, prepared),
    };
}

export async function getSepayOrderPaymentSession(db, env, order) {
    const settings = await loadSepayPaymentSettings(db);
    assertCheckoutConfiguration(env, settings);
    let current = { ...order };
    if (!current.payment_reference) {
        current.payment_provider = 'sepay';
        current.payment_reference = newPaymentReference(env);
        current.payment_expires_at = new Date(Date.now() + paymentTtlMinutes(env) * 60 * 1000).toISOString();
        await db.prepare(`UPDATE product_orders SET payment_provider = 'sepay', payment_reference = ?,
            payment_expires_at = ?, updated_at = ? WHERE id = ? AND payment_reference IS NULL`)
            .bind(current.payment_reference, current.payment_expires_at, new Date().toISOString(), current.id).run();
    }
    return paymentSession(env, settings, current);
}

export async function verifySepayWebhookAuthentication(request, rawBody, env, nowSeconds = Math.floor(Date.now() / 1000)) {
    const signature = clean(request.headers.get('X-SePay-Signature'), 1000);
    const rawTimestamp = clean(request.headers.get('X-SePay-Timestamp'), 32);
    const secret = webhookSecret(env);

    if (signature || rawTimestamp) {
        const timestamp = Number(rawTimestamp);
        if (!secret || !signature.startsWith('sha256=') || !Number.isInteger(timestamp)) {
            throw Object.assign(new Error('Webhook SePay không hợp lệ.'), { status: 401 });
        }
        if (Math.abs(nowSeconds - timestamp) > HMAC_MAX_CLOCK_SKEW_SECONDS) {
            throw Object.assign(new Error('Webhook SePay đã hết hạn.'), { status: 401 });
        }
        const expected = `sha256=${await hmacSha256Hex(secret, `${rawTimestamp}.${rawBody}`)}`;
        if (!timingSafeEqual(expected, signature)) {
            throw Object.assign(new Error('Chữ ký webhook SePay không hợp lệ.'), { status: 401 });
        }
        return 'hmac';
    }

    const apiKey = webhookApiKey(env);
    const provided = clean(request.headers.get('Authorization'), 1200);
    if (apiKey && provided.startsWith('Apikey ') && timingSafeEqual(apiKey, provided.slice(7))) {
        return 'api-key';
    }
    if (!hasWebhookAuthentication(env)) {
        throw paymentConfigurationError('SePay chưa được cấu hình xác thực webhook.');
    }
    throw Object.assign(new Error('Webhook SePay không được phép.'), { status: 401 });
}

function normalizeWebhookPayload(payload) {
    const id = clean(payload?.id, 100);
    const gateway = clean(payload?.gateway, 100);
    const transactionDate = clean(payload?.transactionDate, 64);
    const accountNumber = clean(payload?.accountNumber, 100);
    const transferType = clean(payload?.transferType, 10).toLowerCase();
    const transferAmount = Math.round(Number(payload?.transferAmount));
    if (!id || !gateway || !transactionDate || !accountNumber || !['in', 'out'].includes(transferType)
        || !Number.isSafeInteger(transferAmount) || transferAmount <= 0) {
        throw Object.assign(new Error('Payload webhook SePay không hợp lệ.'), { status: 400 });
    }
    return {
        id,
        gateway,
        transactionDate,
        accountNumber,
        subAccount: clean(payload?.subAccount, 250) || null,
        code: payload?.code == null ? null : clean(payload.code, 255).toUpperCase(),
        content: clean(payload?.content, 5000),
        transferType,
        description: clean(payload?.description, 5000),
        transferAmount,
        accumulated: Math.max(0, Math.round(Number(payload?.accumulated) || 0)),
        referenceCode: clean(payload?.referenceCode, 255) || null,
    };
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSepayPaymentReference(payload, env = {}) {
    const prefix = paymentPrefix(env);
    const exactPattern = new RegExp(`^${escapeRegExp(prefix)}[A-Z0-9]{${PAYMENT_SUFFIX_LENGTH}}$`, 'i');
    if (payload?.code && exactPattern.test(String(payload.code).trim())) {
        return String(payload.code).trim().toUpperCase();
    }
    const searchPattern = new RegExp(`${escapeRegExp(prefix)}[A-Z0-9]{${PAYMENT_SUFFIX_LENGTH}}`, 'i');
    const source = `${payload?.content || ''} ${payload?.description || ''}`;
    return source.match(searchPattern)?.[0]?.toUpperCase() || null;
}

function transactionStatement(db, transaction, rawBody, now, input = {}) {
    return db.prepare(`INSERT INTO sepay_transactions (
        sepay_id, order_id, payment_reference, gateway, account_number, sub_account,
        transfer_type, amount, accumulated, transaction_date, reference_code, content,
        description, status, reason, payload_json, received_at, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
            transaction.id,
            input.orderId || null,
            input.paymentReference || null,
            transaction.gateway,
            transaction.accountNumber,
            transaction.subAccount,
            transaction.transferType,
            transaction.transferAmount,
            transaction.accumulated,
            transaction.transactionDate,
            transaction.referenceCode,
            transaction.content,
            transaction.description,
            input.status || 'ignored',
            input.reason || null,
            rawBody,
            now,
            now,
        );
}

async function recordIgnoredTransaction(db, transaction, rawBody, now, input) {
    await transactionStatement(db, transaction, rawBody, now, input).run();
    return json({ success: true });
}

export async function handleSepayWebhook(request, env) {
    try {
        const db = requireD1(env);
        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > MAX_WEBHOOK_BYTES) {
            throw Object.assign(new Error('Webhook SePay quá lớn.'), { status: 413 });
        }
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
            throw Object.assign(new Error('Webhook SePay quá lớn.'), { status: 413 });
        }
        await verifySepayWebhookAuthentication(request, rawBody, env);
        let parsed;
        try { parsed = JSON.parse(rawBody || '{}'); } catch {
            throw Object.assign(new Error('Webhook SePay không phải JSON hợp lệ.'), { status: 400 });
        }
        const transaction = normalizeWebhookPayload(parsed);
        const duplicate = await db.prepare('SELECT sepay_id FROM sepay_transactions WHERE sepay_id = ? LIMIT 1')
            .bind(transaction.id).first();
        if (duplicate) return json({ success: true });

        const now = new Date().toISOString();
        const reference = extractSepayPaymentReference(transaction, env);
        if (transaction.transferType !== 'in') {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                paymentReference: reference, status: 'ignored', reason: 'outgoing_transfer',
            });
        }

        const settings = await loadSepayPaymentSettings(db);
        const expectedAccount = normalizeAccount(env.SEPAY_ACCOUNT_NUMBER || settings.account_number);
        if (expectedAccount && normalizeAccount(transaction.accountNumber) !== expectedAccount) {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                paymentReference: reference, status: 'ignored', reason: 'account_mismatch',
            });
        }
        if (!reference) {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                status: 'unmatched', reason: 'payment_reference_missing',
            });
        }

        const order = await db.prepare(`SELECT * FROM product_orders
            WHERE payment_reference = ? AND payment_provider = 'sepay' LIMIT 1`).bind(reference).first();
        if (!order) {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                paymentReference: reference, status: 'unmatched', reason: 'order_not_found',
            });
        }
        if (order.payment_status === 'paid') {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                orderId: order.id, paymentReference: reference, status: 'ignored', reason: 'order_already_paid',
            });
        }
        if (order.status === 'cancelled' || order.status === 'refunded' || order.payment_status === 'refunded') {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                orderId: order.id, paymentReference: reference, status: 'ignored', reason: 'order_not_payable',
            });
        }
        const expectedAmount = Math.round(Number(order.grand_total ?? order.total_price ?? 0));
        if (transaction.transferAmount < expectedAmount) {
            return recordIgnoredTransaction(db, transaction, rawBody, now, {
                orderId: order.id, paymentReference: reference, status: 'amount_mismatch', reason: 'amount_below_order_total',
            });
        }

        const nextStatus = order.status === 'pending' ? 'processing' : order.status;
        const itemsResult = await db.prepare('SELECT * FROM product_order_items WHERE order_id = ? ORDER BY created_at, id')
            .bind(order.id).all();
        const statements = [
            transactionStatement(db, transaction, rawBody, now, {
                orderId: order.id, paymentReference: reference, status: 'matched', reason: 'payment_confirmed',
            }),
            db.prepare(`UPDATE product_orders SET payment_status = 'paid', paid_at = ?, status = ?,
                fulfillment_status = CASE WHEN fulfillment_status = 'pending' THEN 'processing' ELSE fulfillment_status END,
                updated_at = ? WHERE id = ? AND payment_status = 'unpaid'`)
                .bind(now, nextStatus, now, order.id),
            db.prepare(`UPDATE order_payment_logs SET status = 'paid', transaction_ref = ?, paid_at = ?,
                metadata_json = ? WHERE order_id = ? AND status = 'unpaid'`)
                .bind(transaction.referenceCode || transaction.id, now, JSON.stringify({
                    provider: 'sepay', sepay_id: transaction.id, gateway: transaction.gateway,
                    payment_reference: reference, received_amount: transaction.transferAmount,
                }), order.id),
            createPancakeOrderOutboxStatement(db, order.id, `${now}:payment:sepay`, now),
        ];
        if (nextStatus !== order.status) {
            statements.push(db.prepare(`INSERT INTO order_status_history (
                id, order_id, from_status, to_status, actor_id, actor_role, note, created_at
            ) VALUES (?, ?, ?, ?, NULL, 'sepay', ?, ?)`)
                .bind(randomId(), order.id, order.status, nextStatus, `SePay xác nhận giao dịch ${transaction.referenceCode || transaction.id}.`, now));
        }
        if (EMAIL_PATTERN.test(String(order.customer_email || ''))) {
            statements.push(createOutboxStatement(db, {
                eventType: 'order.paid',
                aggregateType: 'order',
                aggregateId: order.id,
                audience: 'customer',
                recipientEmail: order.customer_email,
                locale: order.locale || 'vi',
                payload: buildOrderEmailPayload({
                    ...order,
                    status: nextStatus,
                    payment_status: 'paid',
                    payment_provider: 'sepay',
                    paid_at: now,
                }, itemsResult.results || [], {
                    transaction_ref: transaction.referenceCode || transaction.id,
                }, env),
                idempotencyKey: `customer/order.paid/${order.id}`,
            }));
        }
        const automationPayload = buildOrderAutomationPayload({
            ...order,
            status: nextStatus,
            payment_status: 'paid',
            payment_provider: 'sepay',
            paid_at: now,
        }, itemsResult.results || [], {
            event_type: 'order.paid',
            paid_at: now,
            transaction_ref: transaction.referenceCode || transaction.id,
            received_amount: transaction.transferAmount,
        }, env);
        appendOrderAutomationStatements(statements, db, env, {
            eventType: 'order.paid',
            order,
            payload: automationPayload,
            now,
        });
        await db.batch(statements);
        await dispatchPendingPancakeSyncBestEffort(env);
        return json({ success: true });
    } catch (error) {
        if (/UNIQUE constraint failed:\s*sepay_transactions\.sepay_id/i.test(String(error?.message || error))) {
            return json({ success: true });
        }
        return apiError(error, 'Không thể xử lý webhook SePay.');
    }
}

export async function handleSepayPaymentStatus(request, env, orderId) {
    try {
        const db = requireD1(env);
        const order = await db.prepare(`SELECT id, status, payment_status, payment_provider, payment_reference,
            payment_expires_at, paid_at, grand_total, total_price FROM product_orders WHERE id = ? LIMIT 1`)
            .bind(orderId).first();
        if (!order || order.payment_provider !== 'sepay') {
            throw Object.assign(new Error('Không tìm thấy phiên thanh toán SePay.'), { status: 404 });
        }
        const providedToken = clean(request.headers.get('X-Payment-Token'), 1000);
        const expectedToken = await createSepayStatusToken(env, order.id);
        if (!providedToken || !timingSafeEqual(providedToken, expectedToken)) {
            throw Object.assign(new Error('Không được phép xem trạng thái thanh toán.'), { status: 401 });
        }
        return json({
            payment: {
                provider: 'sepay',
                status: order.payment_status || 'unpaid',
                order_status: order.status,
                reference: order.payment_reference,
                amount: Number(order.grand_total ?? order.total_price ?? 0),
                expires_at: order.payment_expires_at,
                paid_at: order.paid_at || null,
            },
        });
    } catch (error) {
        return apiError(error, 'Không thể kiểm tra trạng thái thanh toán SePay.');
    }
}

export async function handleSepayPublicConfiguration(_request, env) {
    try {
        const db = requireD1(env);
        const settings = await loadSepayPaymentSettings(db);
        const enabled = isSepayCheckoutEnabled(env)
            && hasWebhookAuthentication(env)
            && Boolean(statusTokenSecret(env))
            && Boolean(settings.bank_code && settings.account_number && settings.account_holder_name);
        return json({
            provider: 'sepay',
            enabled,
            payment_prefix: paymentPrefix(env),
            bank: enabled ? {
                code: settings.bank_code,
                name: settings.bank_name,
                account_number: settings.account_number,
                account_holder_name: settings.account_holder_name,
            } : null,
        });
    } catch (error) {
        return apiError(error, 'Không thể tải cấu hình SePay.');
    }
}
