import { createOutboxStatement } from '../email/outboxRecord.js';
import { encryptText, randomId, sha256, timingSafeEqual } from '../platform/crypto.js';
import { hydrateOrderItemsWithProductImages } from '../products/orderImage.js';

const MAX_BODY_BYTES = 2048;
const OTP_PATTERN = /^\d{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientRateLimitKey(request) {
    return request.headers.get('CF-Connecting-IP')
        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown';
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function createResponder(jsonResponse) {
    return (payload, status = 200, headers = {}) => jsonResponse(payload, status, {
        'Cache-Control': 'no-store',
        ...headers,
    });
}

async function enforceRequestGuards(request, env, respond) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
        return { response: respond({ error: 'Request body is too large.' }, 413) };
    }
    if (!env.ORDER_LOOKUP_RATE_LIMITER) {
        return { response: respond({ error: 'Order lookup rate limiter is not configured.' }, 503) };
    }
    const rateLimit = await env.ORDER_LOOKUP_RATE_LIMITER.limit({ key: getClientRateLimitKey(request) });
    if (!rateLimit.success) {
        return {
            response: respond({ error: 'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau.' }, 429, {
                'Retry-After': '60',
            }),
        };
    }
    return {};
}

async function parseLookupBody(request, respond) {
    let body;
    try {
        body = await request.json();
    } catch {
        return { response: respond({ error: 'Invalid JSON body.' }, 400) };
    }

    const orderCode = String(body?.orderCode || '').trim().toUpperCase();
    const phone = normalizePhone(body?.phone);
    if (orderCode.length < 5 || orderCode.length > 40 || phone.length < 8 || phone.length > 15) {
        return { response: respond({ error: 'Mã đơn hàng hoặc số điện thoại không hợp lệ.' }, 400) };
    }
    return { body, orderCode, phone };
}

function generateOtp() {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return String(random[0] % 1_000_000).padStart(6, '0');
}

function destinationHint(email) {
    const [local, domain] = String(email || '').split('@');
    if (!local || !domain) return 'email checkout';
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

async function hashLookupOtp(otp, lookupId, env) {
    const pepper = String(env.ORDER_LOOKUP_OTP_PEPPER || '');
    if (pepper.length < 24) {
        throw Object.assign(new Error('Order lookup OTP secret is not configured.'), { status: 503 });
    }
    return sha256(`${lookupId}:${otp}:${pepper}`);
}

async function findD1Order(db, orderCode, phone) {
    const order = await db.prepare('SELECT * FROM product_orders WHERE order_code = ? COLLATE NOCASE LIMIT 1')
        .bind(orderCode).first();
    if (!order || normalizePhone(order.customer_phone) !== phone) return null;
    return order;
}

async function loadD1GuestOrder(db, order) {
    const result = await db.prepare(`
        SELECT id, order_id, product_id, product_name, product_sku, product_image_path,
               quantity, price_at_purchase, vat_rate, tax_amount, created_at
        FROM product_order_items WHERE order_id = ? ORDER BY created_at, id
    `).bind(order.id).all();
    const orderItems = await hydrateOrderItemsWithProductImages(db, result.results || []);
    return { ...order, order_items: orderItems };
}

async function requestD1EmailOtp(parsed, env, deps, respond) {
    if (!env.APP_DB) return respond({ error: 'Order lookup database is not configured.' }, 503);
    let order;
    try {
        order = await findD1Order(env.APP_DB, parsed.orderCode, parsed.phone);
    } catch {
        return respond({ error: 'Không thể xác minh đơn hàng vào lúc này.' }, 502);
    }

    // Keep the response indistinguishable for unknown orders and legacy orders without email.
    if (!order || !EMAIL_PATTERN.test(String(order.customer_email || ''))) {
        return respond({ sent: true, channel: 'email' }, 202);
    }

    const now = new Date();
    const cooldownAt = new Date(now.getTime() - 60_000).toISOString();
    const recent = await env.APP_DB.prepare(`
        SELECT id FROM order_lookup_otps WHERE order_id = ? AND created_at >= ? LIMIT 1
    `).bind(order.id, cooldownAt).first();
    if (recent) return respond({ sent: true, channel: 'email' }, 202);

    const otp = generateOtp();
    const lookupId = randomId();
    const ttlMinutes = Math.max(5, Math.min(15, Number(env.ORDER_LOOKUP_OTP_TTL_MINUTES || 10)));
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
    let otpHash;
    try {
        otpHash = await hashLookupOtp(otp, lookupId, env);
    } catch (error) {
        return respond({ error: error.message }, error.status || 503);
    }
    const hint = destinationHint(order.customer_email);
    const encryptedOtp = await encryptText(otp, env.ORDER_LOOKUP_OTP_PEPPER, `order.lookup_otp:${lookupId}`);
    const outbox = createOutboxStatement(env.APP_DB, {
        eventType: 'order.lookup_otp',
        aggregateType: 'product_order',
        aggregateId: order.id,
        audience: 'customer',
        recipientEmail: order.customer_email,
        locale: order.locale || 'vi',
        payload: {
            customer_name: order.customer_name,
            order_code: order.order_code,
            otp_encrypted: encryptedOtp,
            otp_context: `order.lookup_otp:${lookupId}`,
            expires_minutes: ttlMinutes,
        },
        idempotencyKey: `customer/order.lookup_otp/${lookupId}`,
    });
    await env.APP_DB.batch([
        env.APP_DB.prepare(`
            INSERT INTO order_lookup_otps (id, order_id, otp_hash, destination_hint, attempts, expires_at, consumed_at, created_at)
            VALUES (?, ?, ?, ?, 0, ?, NULL, ?)
        `).bind(lookupId, order.id, otpHash, hint, expiresAt, now.toISOString()),
        outbox,
        env.APP_DB.prepare('DELETE FROM order_lookup_otps WHERE expires_at < ?').bind(new Date(now.getTime() - 86_400_000).toISOString()),
    ]);

    if (typeof deps.dispatchPendingNotifications === 'function') {
        const task = deps.dispatchPendingNotifications(env, 20).catch(() => null);
        if (deps.ctx?.waitUntil) deps.ctx.waitUntil(task);
        else await task;
    }
    return respond({ sent: true, channel: 'email' }, 202);
}

async function verifyD1EmailOtp(parsed, otp, env, respond) {
    if (!env.APP_DB) return respond({ error: 'Order lookup database is not configured.' }, 503);
    const order = await findD1Order(env.APP_DB, parsed.orderCode, parsed.phone);
    if (!order) return respond({ error: 'Mã OTP không đúng hoặc đã hết hạn.' }, 401);
    const now = new Date().toISOString();
    const lookup = await env.APP_DB.prepare(`
        SELECT * FROM order_lookup_otps
        WHERE order_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
        ORDER BY created_at DESC LIMIT 1
    `).bind(order.id, now).first();
    if (!lookup) return respond({ error: 'Mã OTP không đúng hoặc đã hết hạn.' }, 401);

    let candidateHash;
    try {
        candidateHash = await hashLookupOtp(otp, lookup.id, env);
    } catch (error) {
        return respond({ error: error.message }, error.status || 503);
    }
    if (!timingSafeEqual(candidateHash, lookup.otp_hash)) {
        await env.APP_DB.prepare('UPDATE order_lookup_otps SET attempts = attempts + 1 WHERE id = ?')
            .bind(lookup.id).run();
        return respond({ error: 'Mã OTP không đúng hoặc đã hết hạn.' }, 401);
    }

    const consumed = await env.APP_DB.prepare(`
        UPDATE order_lookup_otps SET consumed_at = ?
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
    `).bind(now, lookup.id, now).run();
    if (!Number(consumed.meta?.changes || 0)) {
        return respond({ error: 'Mã OTP không đúng hoặc đã hết hạn.' }, 401);
    }
    return respond([await loadD1GuestOrder(env.APP_DB, order)]);
}

export async function handleGuestOrderOtpRequest(request, env, deps) {
    const respond = createResponder(deps.jsonResponse);
    const guard = await enforceRequestGuards(request, env, respond);
    if (guard.response) return guard.response;

    const parsed = await parseLookupBody(request, respond);
    if (parsed.response) return parsed.response;
    return requestD1EmailOtp(parsed, env, deps, respond);
}

export async function handleGuestOrderLookup(request, env, deps) {
    const respond = createResponder(deps.jsonResponse);
    const guard = await enforceRequestGuards(request, env, respond);
    if (guard.response) return guard.response;

    const parsed = await parseLookupBody(request, respond);
    if (parsed.response) return parsed.response;
    const otp = String(parsed.body?.otp || '').trim();
    if (!OTP_PATTERN.test(otp)) {
        return respond({ error: 'Mã OTP không hợp lệ.' }, 400);
    }
    return verifyD1EmailOtp(parsed, otp, env, respond);
}
