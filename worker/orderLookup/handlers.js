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

function toE164Phone(value) {
    const raw = String(value || '').trim();
    const digits = normalizePhone(raw);
    if (raw.startsWith('+')) return `+${digits}`;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.startsWith('84')) return `+${digits}`;
    if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
    return `+${digits}`;
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
    return { body, orderCode, phone, e164Phone: toE164Phone(body?.phone) };
}

function getServerConfig(env, deps, respond) {
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
    const publishableKey = deps.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
    if (!serviceRoleKey || !publishableKey || !deps.SUPABASE_URL) {
        return { response: respond({ error: 'Order lookup service is not configured.' }, 503) };
    }
    return { serviceRoleKey, publishableKey };
}

function usesD1Backend(env) {
    return String(env?.DATA_BACKEND || '').toLowerCase() === 'd1';
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

async function fetchSecureOrder({ orderCode, phone, serviceRoleKey, supabaseUrl, fetchImpl }) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/lookup_guest_product_order_secure`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            p_order_code: orderCode,
            p_customer_phone: phone,
        }),
    });
    if (!response.ok) return { error: response };
    const orders = await response.json();
    return { orders: Array.isArray(orders) ? orders : [] };
}

export async function handleGuestOrderOtpRequest(request, env, deps) {
    const respond = createResponder(deps.jsonResponse);
    const guard = await enforceRequestGuards(request, env, respond);
    if (guard.response) return guard.response;

    const parsed = await parseLookupBody(request, respond);
    if (parsed.response) return parsed.response;
    if (usesD1Backend(env)) return requestD1EmailOtp(parsed, env, deps, respond);

    if (String(env.ORDER_LOOKUP_SMS_ENABLED || '').toLowerCase() !== 'true') {
        return respond({ error: 'Dịch vụ OTP qua SMS chưa được cấu hình.' }, 503);
    }
    const config = getServerConfig(env, deps, respond);
    if (config.response) return config.response;
    const fetchImpl = deps.fetchImpl || fetch;

    const lookup = await fetchSecureOrder({
        orderCode: parsed.orderCode,
        phone: parsed.phone,
        serviceRoleKey: config.serviceRoleKey,
        supabaseUrl: deps.SUPABASE_URL,
        fetchImpl,
    });
    if (lookup.error) return respond({ error: 'Không thể xác minh đơn hàng vào lúc này.' }, 502);

    // Return the same response for unknown orders to avoid credential enumeration.
    if (lookup.orders.length === 0) {
        return respond({ sent: true }, 202);
    }

    const otpResponse = await fetchImpl(`${deps.SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: {
            apikey: config.publishableKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phone: parsed.e164Phone,
            create_user: true,
            channel: 'sms',
        }),
    });
    if (!otpResponse.ok) {
        return respond({ error: 'Không thể gửi mã OTP vào lúc này.' }, otpResponse.status === 429 ? 429 : 502);
    }

    return respond({ sent: true, channel: 'sms' }, 202);
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
    if (usesD1Backend(env)) return verifyD1EmailOtp(parsed, otp, env, respond);

    if (String(env.ORDER_LOOKUP_SMS_ENABLED || '').toLowerCase() !== 'true') {
        return respond({ error: 'Dịch vụ OTP qua SMS chưa được cấu hình.' }, 503);
    }

    const config = getServerConfig(env, deps, respond);
    if (config.response) return config.response;
    const fetchImpl = deps.fetchImpl || fetch;

    const verifyResponse = await fetchImpl(`${deps.SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
            apikey: config.publishableKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phone: parsed.e164Phone,
            token: otp,
            type: 'sms',
        }),
    });
    if (!verifyResponse.ok) {
        return respond({ error: 'Mã OTP không đúng hoặc đã hết hạn.' }, 401);
    }

    const verification = await verifyResponse.json().catch(() => null);
    if (normalizePhone(verification?.user?.phone) !== normalizePhone(parsed.e164Phone)) {
        return respond({ error: 'Không thể xác minh số điện thoại.' }, 401);
    }

    const lookup = await fetchSecureOrder({
        orderCode: parsed.orderCode,
        phone: parsed.phone,
        serviceRoleKey: config.serviceRoleKey,
        supabaseUrl: deps.SUPABASE_URL,
        fetchImpl,
    });
    if (lookup.error) return respond({ error: 'Không thể tra cứu đơn hàng vào lúc này.' }, 502);
    return respond(lookup.orders);
}
