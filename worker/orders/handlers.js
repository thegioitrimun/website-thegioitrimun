import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { randomId } from '../platform/crypto.js';
import { createOutboxStatement } from '../email/outboxRecord.js';
import { dispatchPendingNotifications } from '../email/dispatcher.js';
import { getSession, requireCsrf, requireGuestCsrf, requireRole } from '../auth/session.js';
import {
    createPancakeCustomerOutboxStatement,
    createPancakeInventoryOutboxStatement,
    createPancakeOrderOutboxStatement,
    dispatchPendingPancakeSyncBestEffort,
} from '../integrations/pancake/outbox.js';
import { hydrateOrderItemsWithProductImages } from '../products/orderImage.js';
import { getSepayOrderPaymentSession, prepareSepayOrderPayment } from '../payments/sepay.js';
import {
    appendOrderAutomationStatements,
    buildOrderAutomationPayload,
    createTelegramOutboxStatement,
    isTelegramOrderAlertsEnabled,
} from '../integrations/deplao/records.js';
import { paymentStateAfterFulfillment } from './paymentState.js';
import { recordAdminAuditAttempt } from '../adminD1/support.js';
import { calculateVatDocument } from '../vat/calculation.js';
import { appendPosCustomerNotificationStatements } from './customerNotifications.js';
import { buildOrderEmailPayload, ORDER_EMAIL_PATTERN } from './notificationPayload.js';

const LOCALES = new Set(['vi', 'en', 'ru', 'cn']);
const ORDER_STATUSES = new Set(['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']);
const EMAIL_ORDER_STATUSES = new Set(['processing', 'shipped', 'completed', 'cancelled']);
const EMAIL_PATTERN = ORDER_EMAIL_PATTERN;
const PHONE_PATTERN = /^[0-9+\s().-]{8,20}$/;
const ADMIN_ORDER_CHANNELS = new Set(['online', 'pos']);

function requiredText(value, field, max = 255) {
    const normalized = String(value || '').trim();
    if (!normalized) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
    return normalized.slice(0, max);
}

function normalizeEmail(value) {
    const email = requiredText(value, 'customerEmail', 320).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
        throw Object.assign(new Error('Email is invalid.'), { status: 400 });
    }
    return email;
}

function normalizeOptionalEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!email) return null;
    if (!EMAIL_PATTERN.test(email)) {
        throw Object.assign(new Error('Email is invalid.'), { status: 400 });
    }
    return email.slice(0, 320);
}

function normalizeLocale(value) {
    return LOCALES.has(value) ? value : 'vi';
}

function normalizeItems(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
        throw Object.assign(new Error('Order must contain between 1 and 100 products.'), { status: 400 });
    }
    const merged = new Map();
    for (const item of value) {
        const productId = Number(item?.product_id ?? item?.productId);
        const quantity = Number(item?.quantity);
        if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            throw Object.assign(new Error('Invalid product or quantity.'), { status: 400 });
        }
        const mergedQuantity = (merged.get(productId) || 0) + quantity;
        if (mergedQuantity > 99) {
            throw Object.assign(new Error('Invalid product or quantity.'), { status: 400 });
        }
        merged.set(productId, mergedQuantity);
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

async function dispatchCustomerEmailBestEffort(env) {
    try {
        await dispatchPendingNotifications(env, 20);
    } catch (error) {
        console.error('[customer-email-outbox] Immediate dispatch failed:', {
            message: String(error?.message || error).slice(0, 500),
        });
    }
}

function orderCode(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `TG${date}-${suffix}`;
}

function calculateDiscount(discount, subtotal) {
    if (!discount || !discount.is_active || subtotal < Number(discount.min_purchase_amount || 0)) return 0;
    const now = Date.now();
    if (discount.starts_at && Date.parse(discount.starts_at) > now) return 0;
    if (discount.ends_at && Date.parse(discount.ends_at) < now) return 0;
    if (discount.usage_limit != null && Number(discount.usage_count || 0) >= Number(discount.usage_limit)) return 0;
    let amount = discount.type === 'percentage'
        ? Math.round(subtotal * Number(discount.value || 0) / 100)
        : Math.round(Number(discount.value || 0));
    if (discount.max_discount_amount != null) amount = Math.min(amount, Number(discount.max_discount_amount));
    return Math.max(0, Math.min(subtotal, amount));
}

async function getDiscount(db, code, subtotal, userId = null) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) return null;
    const discount = await db.prepare('SELECT * FROM discount_codes WHERE upper(code) = ? LIMIT 1')
        .bind(normalizedCode).first();
    const amount = calculateDiscount(discount, subtotal);
    if (!discount || !amount) return null;
    if (discount.usage_limit_per_user != null && userId) {
        const usage = await db.prepare('SELECT COUNT(*) AS count FROM discount_redemptions WHERE discount_code_id = ? AND user_id = ?')
            .bind(discount.id, userId).first();
        if (Number(usage?.count || 0) >= Number(discount.usage_limit_per_user)) return null;
    }
    return { ...discount, preview_discount_amount: amount };
}

async function calculateTaxQuote(db, input) {
    const now = new Date().toISOString();
    const subtotal = Math.max(0, Math.round(Number(input.subtotal || 0)));
    const discountAmount = Math.min(subtotal, Math.max(0, Math.round(Number(input.discountAmount || 0))));
    const shippingFee = Math.max(0, Math.round(Number(input.shippingFee || 0)));
    const province = String(input.province || '').trim();
    const district = String(input.district || '').trim();
    const profile = await db.prepare(`SELECT * FROM tax_profiles
        WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
        ORDER BY is_default DESC, created_at LIMIT 1`).bind(now, now).first();
    let rate = Math.max(0, Number(profile?.default_rate || 0));
    let shippingTaxable = Boolean(profile?.applies_to_shipping);
    let currency = String(profile?.currency || 'VND');
    if (profile) {
        const regional = await db.prepare(`SELECT * FROM tax_rates
            WHERE tax_profile_id = ? AND is_active = 1
              AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
              AND (province IS NULL OR lower(province) = lower(?))
              AND (district IS NULL OR lower(district) = lower(?))
            ORDER BY
              CASE WHEN district IS NOT NULL AND lower(district) = lower(?) THEN 0
                   WHEN province IS NOT NULL AND lower(province) = lower(?) THEN 1 ELSE 2 END,
              priority DESC, created_at DESC LIMIT 1`)
            .bind(profile.id, now, now, province, district, district, province).first();
        if (regional) {
            rate = Math.max(0, Number(regional.rate ?? rate));
            if (regional.applies_to_shipping != null) shippingTaxable = Boolean(regional.applies_to_shipping);
            currency = String(regional.currency || currency);
        }
    }
    const taxMode = profile?.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive';
    const fallbackRateBps = Math.round(rate * 10_000);
    const document = calculateVatDocument({
        priceMode: taxMode,
        lines: Array.isArray(input.lines) && input.lines.length
            ? input.lines.map((line, index) => ({
                id: line.id ?? line.productId ?? index + 1,
                description: line.description || line.product?.name || 'Sản phẩm',
                quantity: line.quantity,
                unitPrice: line.unitPrice ?? line.product?.price ?? line.price,
                rateBps: Number.isFinite(Number(line.rateBps))
                    ? Math.round(Number(line.rateBps))
                    : Number.isFinite(Number(line.vatRate))
                        ? Math.round(Number(line.vatRate) * 10_000)
                        : fallbackRateBps,
                vatCategoryCode: line.vatCategoryCode || line.product?.vat_category_code,
                taxClass: line.taxClass,
            }))
            : [{ id: 'subtotal', quantity: 1, unitPrice: subtotal, rateBps: fallbackRateBps }],
        discountAmount,
        shippingFee,
        shippingRateBps: shippingTaxable ? fallbackRateBps : 0,
        shippingVatCategoryCode: shippingTaxable ? `VAT_${Math.round(rate * 100)}` : 'NON_SUBJECT',
        shippingTaxClass: shippingTaxable ? 'standard' : 'non_subject',
    });
    const productLines = document.lines.filter((line) => !line.isShipping);
    const shippingLine = document.lines.find((line) => line.isShipping);
    const taxableAmount = productLines.reduce((sum, line) => sum + line.netAmount, 0);
    const taxAmount = productLines.reduce((sum, line) => sum + line.vatAmount, 0);
    const shippingNetAmount = shippingLine?.netAmount || 0;
    const shippingTaxAmount = shippingLine?.vatAmount || 0;
    const grandTotal = document.grossAmount;
    return {
        tax_profile_id: profile?.id || null,
        tax_mode: taxMode,
        tax_rate: rate,
        currency,
        subtotal,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
        shipping_net_amount: shippingNetAmount,
        shipping_tax_rate: shippingTaxable ? rate : 0,
        shipping_tax_amount: shippingTaxAmount,
        shipping_fee: shippingFee,
        grand_total: grandTotal,
        lines: productLines.map((line) => ({
            id: line.id,
            allocated_discount: line.allocatedDiscount,
            net_amount: line.netAmount,
            tax_amount: line.vatAmount,
            gross_amount: line.grossAmount,
            rate_bps: line.rateBps,
        })),
        tax_groups: document.groups,
    };
}

async function checkoutLinesFromItems(db, value) {
    const items = normalizeItems(value);
    const placeholders = items.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT id, name, price, vat_rate, vat_category_code, is_published FROM products WHERE id IN (${placeholders})`)
        .bind(...items.map((item) => item.productId)).all();
    const products = new Map((rows.results || []).map((row) => [Number(row.id), row]));
    if (products.size !== items.length || [...products.values()].some((row) => !row.is_published)) {
        throw Object.assign(new Error('One or more products are unavailable.'), { status: 409 });
    }
    return items.map((item) => {
        const product = products.get(item.productId);
        const rawRate = Math.max(0, Number(product.vat_rate || 0));
        return {
            id: item.productId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Math.round(Number(product.price || 0)),
            vatRate: rawRate > 1 ? rawRate / 100 : rawRate,
            vatCategoryCode: product.vat_category_code || null,
            description: product.name,
        };
    });
}

async function buildAdminOrderQuote(db, body) {
    const channel = ADMIN_ORDER_CHANNELS.has(body.channel) ? body.channel : null;
    if (!channel) throw Object.assign(new Error('Kênh bán hàng không hợp lệ.'), { status: 400 });

    const items = normalizeItems(body.items);
    const placeholders = items.map(() => '?').join(',');
    const productsResult = await db.prepare(`
        SELECT p.*, (
            SELECT image_path FROM product_images pi
            WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.display_order, pi.id LIMIT 1
        ) AS main_image_path
        FROM products p
        WHERE p.id IN (${placeholders})
          AND p.archived_at IS NULL
          AND (? = 'pos' OR p.is_published = 1)
    `).bind(...items.map((item) => item.productId), channel).all();
    const productMap = new Map((productsResult.results || []).map((product) => [Number(product.id), product]));
    if (productMap.size !== items.length) {
        throw Object.assign(new Error('Một hoặc nhiều sản phẩm không khả dụng cho kênh bán đã chọn.'), { status: 409 });
    }

    let subtotal = 0;
    const normalizedItems = items.map((item) => {
        const product = productMap.get(item.productId);
        if (Number(product.stock_quantity) < item.quantity) {
            throw Object.assign(new Error(`${product.name} không đủ tồn kho.`), { status: 409 });
        }
        const lineTotal = Math.round(Number(product.price || 0) * item.quantity);
        const rawRate = Math.max(0, Number(product.vat_rate || 0));
        const vatRate = rawRate > 1 ? rawRate / 100 : rawRate;
        subtotal += lineTotal;
        return { ...item, product, lineTotal, lineTax: 0, vatRate };
    });

    const rawDiscount = Number(body.discountAmount ?? body.discount_amount ?? 0);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
        throw Object.assign(new Error('Giảm giá không hợp lệ.'), { status: 400 });
    }
    const discountAmount = Math.round(rawDiscount);
    if (discountAmount > subtotal) {
        throw Object.assign(new Error('Giảm giá không được vượt quá tạm tính.'), { status: 400 });
    }
    const rawShippingFee = Number(body.shippingFee ?? body.shipping_fee ?? 0);
    if (!Number.isFinite(rawShippingFee) || rawShippingFee < 0) {
        throw Object.assign(new Error('Phí giao hàng không hợp lệ.'), { status: 400 });
    }
    const shippingFee = channel === 'pos' ? 0 : Math.round(rawShippingFee);
    const quote = await calculateTaxQuote(db, {
        subtotal,
        discountAmount,
        shippingFee,
        province: body.shippingProvince ?? body.shipping_province,
        district: body.shippingDistrict ?? body.shipping_district,
        lines: normalizedItems,
    });
    const quotedLines = new Map(quote.lines.map((line) => [String(line.id), line]));
    for (const item of normalizedItems) {
        const quoted = quotedLines.get(String(item.productId));
        item.lineTax = quoted?.tax_amount || 0;
        item.allocatedDiscount = quoted?.allocated_discount || 0;
        item.lineNet = quoted?.net_amount ?? item.lineTotal;
        item.lineGross = quoted?.gross_amount ?? item.lineTotal;
    }

    return { channel, items, normalizedItems, subtotal, discountAmount, shippingFee, quote };
}

async function authorizeOrderWrite(db, request) {
    const session = await getSession(db, request);
    if (session) {
        await requireCsrf(db, request, session);
        return session;
    }
    requireGuestCsrf(request);
    return null;
}

async function loadOrder(db, id) {
    const order = await db.prepare('SELECT * FROM product_orders WHERE id = ? OR order_code = ? LIMIT 1')
        .bind(id, id).first();
    if (!order) throw Object.assign(new Error('Order was not found.'), { status: 404 });
    const result = await db.prepare('SELECT * FROM product_order_items WHERE order_id = ? ORDER BY created_at, id')
        .bind(order.id).all();
    return {
        ...order,
        order_items: await hydrateOrderItemsWithProductImages(db, result.results || []),
    };
}

export async function createOrder(request, env) {
    try {
        const db = requireD1(env);
        const session = await authorizeOrderWrite(db, request);
        const body = await readJson(request, 128 * 1024);
        const items = normalizeItems(body.items);
        const customerEmail = normalizeEmail(body.customerEmail ?? body.customer_email);
        const locale = normalizeLocale(body.locale);
        const idempotencyKey = requiredText(
            body.checkoutIdempotencyKey ?? body.checkout_idempotency_key ?? request.headers.get('Idempotency-Key'),
            'checkoutIdempotencyKey',
            128,
        );

        const existing = await db.prepare('SELECT id FROM product_orders WHERE checkout_idempotency_key = ? LIMIT 1')
            .bind(idempotencyKey).first();
        if (existing) {
            const existingOrder = await loadOrder(db, existing.id);
            if (existingOrder.payment_method === 'bank_transfer') {
                existingOrder.payment = await getSepayOrderPaymentSession(db, env, existingOrder);
            }
            return json({ order: existingOrder, idempotentReplay: true });
        }

        const placeholders = items.map(() => '?').join(',');
        const productsResult = await db.prepare(`
            SELECT p.*, (
                SELECT image_path FROM product_images pi
                WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.display_order, pi.id LIMIT 1
            ) AS main_image_path
            FROM products p WHERE p.id IN (${placeholders}) AND p.is_published = 1
        `).bind(...items.map((item) => item.productId)).all();
        const productMap = new Map((productsResult.results || []).map((product) => [Number(product.id), product]));
        if (productMap.size !== items.length) {
            throw Object.assign(new Error('One or more products are unavailable.'), { status: 409 });
        }

        let subtotal = 0;
        const normalizedItems = items.map((item) => {
            const product = productMap.get(item.productId);
            if (Number(product.stock_quantity) < item.quantity) {
                throw Object.assign(new Error(`${product.name} does not have enough stock.`), { status: 409 });
            }
            const lineTotal = Math.round(Number(product.price || 0) * item.quantity);
            const rawRate = Math.max(0, Number(product.vat_rate || 0));
            const rate = rawRate > 1 ? rawRate / 100 : rawRate;
            subtotal += lineTotal;
            return { ...item, product, lineTotal, lineTax: 0, vatRate: rate };
        });

        const discountCode = String(body.discountCode ?? body.discount_code ?? '').trim().toUpperCase() || null;
        const discount = discountCode ? await getDiscount(db, discountCode, subtotal, session?.user_id || null) : null;
        if (discountCode && !discount) throw Object.assign(new Error('Discount code is invalid.'), { status: 400 });
        const discountAmount = Number(discount?.preview_discount_amount || 0);
        const shippingFee = Math.max(0, Math.round(Number(body.shippingFee ?? body.shipping_fee ?? 0)));
        const quote = await calculateTaxQuote(db, {
            subtotal,
            discountAmount,
            shippingFee,
            province: body.shippingProvince ?? body.shipping_province,
            district: body.shippingDistrict ?? body.shipping_district,
            lines: normalizedItems,
        });
        const quotedLines = new Map(quote.lines.map((line) => [String(line.id), line]));
        for (const item of normalizedItems) {
            const quoted = quotedLines.get(String(item.productId));
            item.lineTax = quoted?.tax_amount || 0;
            item.allocatedDiscount = quoted?.allocated_discount || 0;
            item.lineNet = quoted?.net_amount ?? item.lineTotal;
            item.lineGross = quoted?.gross_amount ?? item.lineTotal;
        }
        const grandTotal = quote.grand_total;
        const now = new Date().toISOString();
        const id = randomId();
        const code = orderCode();
        const status = body.paymentMethod === 'bank_transfer' || body.payment_method === 'bank_transfer' ? 'pending' : 'processing';
        const paymentMethod = body.paymentMethod === 'bank_transfer' || body.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
        const sepayPayment = paymentMethod === 'bank_transfer'
            ? await prepareSepayOrderPayment(db, env, {
                id,
                order_code: code,
                payment_status: 'unpaid',
                grand_total: grandTotal,
                total_price: grandTotal,
            })
            : null;
        const order = {
            id,
            order_code: code,
            customer_name: requiredText(body.customerName ?? body.customer_name, 'customerName'),
            customer_phone: requiredText(body.customerPhone ?? body.customer_phone, 'customerPhone', 32),
            customer_email: customerEmail,
            locale,
            shipping_street: requiredText(body.shippingStreet ?? body.shipping_street, 'shippingStreet'),
            shipping_ward: requiredText(body.shippingWard ?? body.shipping_ward, 'shippingWard'),
            shipping_district: String(body.shippingDistrict ?? body.shipping_district ?? '').trim().slice(0, 255),
            shipping_province: requiredText(body.shippingProvince ?? body.shipping_province, 'shippingProvince'),
            notes: String(body.notes || '').trim().slice(0, 2000) || null,
            shipping_provider: String(body.shippingProvider ?? body.shipping_provider ?? 'spx').trim().slice(0, 64),
            estimated_delivery_time: String(body.estimatedDeliveryTime ?? body.estimated_delivery_time ?? '').trim().slice(0, 255) || null,
            status,
            payment_method: paymentMethod,
            payment_status: 'unpaid',
            payment_provider: sepayPayment?.payment_provider || null,
            payment_reference: sepayPayment?.payment_reference || null,
            payment_expires_at: sepayPayment?.payment_expires_at || null,
            subtotal_price: subtotal,
            discount_code: discountCode,
            discount_amount: discountAmount,
            taxable_amount: quote.taxable_amount,
            tax_amount: quote.tax_amount,
            shipping_fee: shippingFee,
            shipping_net_amount: quote.shipping_net_amount,
            shipping_tax_rate: quote.shipping_tax_rate,
            shipping_tax_amount: quote.shipping_tax_amount,
            currency: quote.currency,
            tax_rate: quote.tax_rate,
            grand_total: grandTotal,
            total_price: grandTotal,
        };

        const statements = [
            db.prepare(`
                INSERT INTO product_orders (
                    id, order_code, checkout_idempotency_key, user_id, customer_name, customer_phone,
                    customer_email, locale, shipping_street, shipping_ward, shipping_district,
                    shipping_province, notes, status, fulfillment_status, payment_method, payment_status,
                    payment_provider, payment_reference, payment_expires_at,
                    subtotal_price, discount_code, discount_amount, taxable_amount, tax_amount,
                    shipping_provider, shipping_fee, shipping_net_amount, shipping_tax_rate,
                    shipping_tax_amount, estimated_delivery_time, currency, grand_total,
                    total_price, tax_profile_id, tax_mode, tax_rate, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id, code, idempotencyKey, session?.user_id || null, order.customer_name, order.customer_phone,
                customerEmail, locale, order.shipping_street, order.shipping_ward, order.shipping_district,
                order.shipping_province, order.notes, status, status, paymentMethod,
                order.payment_provider, order.payment_reference, order.payment_expires_at,
                subtotal, discountCode, discountAmount, quote.taxable_amount, quote.tax_amount,
                order.shipping_provider, quote.shipping_fee, quote.shipping_net_amount,
                quote.shipping_tax_rate, quote.shipping_tax_amount, order.estimated_delivery_time,
                quote.currency, grandTotal, grandTotal, quote.tax_profile_id, quote.tax_mode,
                quote.tax_rate, now, now,
            ),
            db.prepare(`
                INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at)
                VALUES (?, ?, NULL, ?, ?, ?, 'Checkout created', ?)
            `).bind(randomId(), id, status, session?.user_id || null, session ? 'customer' : 'guest', now),
            db.prepare(`
                INSERT INTO order_payment_logs (id, order_id, method, amount, status, metadata_json, created_at)
                VALUES (?, ?, ?, ?, 'unpaid', '{}', ?)
            `).bind(randomId(), id, paymentMethod, grandTotal, now),
        ];

        for (const item of normalizedItems) {
            statements.push(
                db.prepare(`
                    INSERT INTO product_order_items (
                        id, order_id, product_id, product_name, product_sku, product_image_path,
                        quantity, price_at_purchase, vat_rate, tax_amount, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    randomId(), id, item.productId, item.product.name, item.product.sku || null,
                    item.product.main_image_path || null, item.quantity, Number(item.product.price || 0),
                    item.vatRate, item.lineTax, now,
                ),
                db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ?, updated_at = ? WHERE id = ?')
                    .bind(item.quantity, item.quantity, now, item.productId),
            );
        }

        if (discount && discountAmount > 0) {
            statements.push(
                db.prepare('UPDATE discount_codes SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?')
                    .bind(now, discount.id),
                db.prepare(`
                    INSERT INTO discount_redemptions (id, discount_code_id, order_id, user_id, customer_email, amount, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(randomId(), discount.id, id, session?.user_id || null, customerEmail, discountAmount, now),
            );
        }

        const itemSnapshots = normalizedItems.map((item) => ({
            product_id: item.productId,
            product_name: item.product.name,
            product_sku: item.product.sku || null,
            product_image_path: item.product.main_image_path || null,
            quantity: item.quantity,
            price_at_purchase: Number(item.product.price || 0),
            line_total: item.lineTotal,
            vat_rate: item.vatRate,
            tax_amount: item.lineTax,
        }));
        const payload = buildOrderEmailPayload(order, itemSnapshots, {}, env);
        statements.push(createOutboxStatement(db, {
            eventType: 'order.created', aggregateType: 'order', aggregateId: id, audience: 'customer',
            recipientEmail: customerEmail, locale, payload, idempotencyKey: `customer/order.created/${id}`,
        }));
        const adminEmail = String(env.ADMIN_NOTIFICATION_EMAIL || env.SMTP_FROM_ADDRESS || '').trim().toLowerCase();
        if (EMAIL_PATTERN.test(adminEmail)) {
            statements.push(createOutboxStatement(db, {
                eventType: 'order.created', aggregateType: 'order', aggregateId: id, audience: 'admin',
                recipientEmail: adminEmail, locale: 'vi', payload, idempotencyKey: `admin/order.created/${id}`,
            }));
        }
        for (const item of normalizedItems) {
            statements.push(createPancakeInventoryOutboxStatement(
                db, item.productId, `${now}:order:${id}`, now,
            ));
        }
        statements.push(
            createPancakeCustomerOutboxStatement(
                db, order.customer_phone, `${now}:order:${id}`, { orderId: id }, now,
            ),
            createPancakeOrderOutboxStatement(db, id, `${now}:created`, now),
        );
        const automationPayload = buildOrderAutomationPayload(order, itemSnapshots, {
            event_type: 'order.created',
            created_at: now,
        }, env);
        appendOrderAutomationStatements(statements, db, env, {
            eventType: 'order.created',
            order,
            payload: automationPayload,
            now,
        });

        try {
            await db.batch(statements);
        } catch (error) {
            if (String(error?.message || error).includes('INSUFFICIENT_STOCK')) {
                throw Object.assign(new Error('One or more products no longer have enough stock.'), { status: 409 });
            }
            throw error;
        }
        const createdOrder = await loadOrder(db, id);
        if (sepayPayment) createdOrder.payment = sepayPayment.session;
        await dispatchPendingPancakeSyncBestEffort(env);
        return json({ order: createdOrder }, 201);
    } catch (error) {
        return apiError(error, 'Could not create order.');
    }
}

export async function quoteAdminOrder(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 64 * 1024);
        const { quote } = await buildAdminOrderQuote(db, body);
        return json({ quote });
    } catch (error) {
        return apiError(error, 'Không thể tính tổng đơn quản trị.');
    }
}

export async function createAdminOrder(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
        const body = await readJson(request, 128 * 1024);
        const idempotencyKey = requiredText(
            body.idempotencyKey ?? body.idempotency_key ?? request.headers.get('Idempotency-Key'),
            'idempotencyKey',
            128,
        );

        const existing = await db.prepare('SELECT id FROM product_orders WHERE checkout_idempotency_key = ? LIMIT 1')
            .bind(idempotencyKey).first();
        if (existing) return json({ order: await loadOrder(db, existing.id), idempotentReplay: true });

        const quoteData = await buildAdminOrderQuote(db, body);
        const { channel, normalizedItems, subtotal, discountAmount, quote } = quoteData;
        const paymentMethod = String((body.paymentMethod ?? body.payment_method) || '').trim();
        const allowedPaymentMethods = channel === 'pos'
            ? new Set(['cash', 'bank_transfer'])
            : new Set(['cod', 'bank_transfer']);
        if (!allowedPaymentMethods.has(paymentMethod)) {
            throw Object.assign(new Error('Phương thức thanh toán không hợp lệ cho kênh bán.'), { status: 400 });
        }

        const customerName = channel === 'online'
            ? requiredText(body.customerName ?? body.customer_name, 'customerName', 255)
            : String(body.customerName ?? body.customer_name ?? '').trim().slice(0, 255) || 'Khách lẻ';
        const customerPhone = String(body.customerPhone ?? body.customer_phone ?? '').trim().slice(0, 32);
        if (channel === 'online' && !customerPhone) {
            throw Object.assign(new Error('Số điện thoại khách hàng là bắt buộc với đơn online.'), { status: 400 });
        }
        if (customerPhone && !PHONE_PATTERN.test(customerPhone)) {
            throw Object.assign(new Error('Số điện thoại không hợp lệ.'), { status: 400 });
        }
        const customerEmail = normalizeOptionalEmail(body.customerEmail ?? body.customer_email);
        const shippingStreet = channel === 'online'
            ? requiredText(body.shippingStreet ?? body.shipping_street, 'shippingStreet', 500)
            : '';
        const shippingWard = channel === 'online'
            ? requiredText(body.shippingWard ?? body.shipping_ward, 'shippingWard', 255)
            : '';
        const shippingDistrict = channel === 'online'
            ? String(body.shippingDistrict ?? body.shipping_district ?? '').trim().slice(0, 255)
            : '';
        const shippingProvince = channel === 'online'
            ? requiredText(body.shippingProvince ?? body.shipping_province, 'shippingProvince', 255)
            : '';
        const shippingProvider = channel === 'online'
            ? String(body.shippingProvider ?? body.shipping_provider ?? 'manual').trim().slice(0, 64) || 'manual'
            : null;

        const workflow = String(body.workflow || 'paid_completed').trim();
        if (channel === 'pos' && !['paid_completed', 'unpaid_processing'].includes(workflow)) {
            throw Object.assign(new Error('Preset trạng thái POS không hợp lệ.'), { status: 400 });
        }
        const posPaidAndCompleted = channel === 'pos' && workflow === 'paid_completed';
        const status = channel === 'online'
            ? (paymentMethod === 'bank_transfer' ? 'pending' : 'processing')
            : (posPaidAndCompleted ? 'completed' : 'processing');
        const paymentStatus = posPaidAndCompleted ? 'paid' : 'unpaid';
        const now = new Date().toISOString();
        const id = randomId();
        const code = orderCode();
        const paidAt = paymentStatus === 'paid' ? now : null;
        const notes = String(body.notes || '').trim().slice(0, 2000) || null;
        const orderColumns = [
            'id', 'order_code', 'checkout_idempotency_key', 'user_id', 'customer_name', 'customer_phone',
            'customer_email', 'locale', 'shipping_street', 'shipping_ward', 'shipping_district',
            'shipping_province', 'notes', 'status', 'fulfillment_status', 'payment_method', 'payment_status',
            'payment_provider', 'payment_reference', 'payment_expires_at', 'paid_at', 'subtotal_price',
            'discount_code', 'discount_amount', 'taxable_amount', 'tax_amount', 'shipping_provider',
            'shipping_fee', 'shipping_net_amount', 'shipping_tax_rate', 'shipping_tax_amount',
            'estimated_delivery_time', 'currency', 'grand_total', 'total_price', 'tax_profile_id',
            'tax_mode', 'tax_rate', 'order_channel', 'created_at', 'updated_at',
        ];
        const orderValues = [
            id, code, idempotencyKey, null, customerName, customerPhone, customerEmail, 'vi',
            shippingStreet, shippingWard, shippingDistrict, shippingProvince, notes, status, status,
            paymentMethod, paymentStatus, null, null, null, paidAt, subtotal, null, discountAmount,
            quote.taxable_amount, quote.tax_amount, shippingProvider, quote.shipping_fee,
            quote.shipping_net_amount, quote.shipping_tax_rate, quote.shipping_tax_amount, null,
            quote.currency, quote.grand_total, quote.grand_total, quote.tax_profile_id, quote.tax_mode,
            quote.tax_rate, channel, now, now,
        ];
        const statements = [
            db.prepare(`INSERT INTO product_orders (${orderColumns.join(', ')}) VALUES (${orderColumns.map(() => '?').join(', ')})`)
                .bind(...orderValues),
            db.prepare(`INSERT INTO order_status_history (
                id, order_id, from_status, to_status, actor_id, actor_role, note, created_at
            ) VALUES (?, ?, NULL, ?, ?, 'admin', ?, ?)`)
                .bind(randomId(), id, status, session.user_id, `Admin tạo đơn ${channel === 'pos' ? 'POS' : 'online'}`, now),
            db.prepare(`INSERT INTO order_payment_logs (
                id, order_id, method, amount, status, transaction_ref, paid_at, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`)
                .bind(randomId(), id, paymentMethod, quote.grand_total, paymentStatus, paidAt,
                    JSON.stringify({ source: 'admin', channel }), now),
        ];

        for (const item of normalizedItems) {
            statements.push(
                db.prepare(`INSERT INTO product_order_items (
                    id, order_id, product_id, product_name, product_sku, product_image_path,
                    quantity, price_at_purchase, vat_rate, tax_amount, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .bind(randomId(), id, item.productId, item.product.name, item.product.sku || null,
                        item.product.main_image_path || null, item.quantity, Number(item.product.price || 0),
                        item.vatRate, item.lineTax, now),
                db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ?, updated_at = ? WHERE id = ?')
                    .bind(item.quantity, item.quantity, now, item.productId),
                createPancakeInventoryOutboxStatement(db, item.productId, `${now}:admin-order:${id}`, now),
            );
        }

        const itemSnapshots = normalizedItems.map((item) => ({
            product_id: item.productId,
            product_name: item.product.name,
            product_sku: item.product.sku || null,
            product_image_path: item.product.main_image_path || null,
            quantity: item.quantity,
            price_at_purchase: Number(item.product.price || 0),
            line_total: item.lineTotal,
            vat_rate: item.vatRate,
            tax_amount: item.lineTax,
        }));
        let posCustomerNotification = { emailOutboxCreated: false, zaloJobCreated: false };
        if (channel === 'pos') {
            posCustomerNotification = appendPosCustomerNotificationStatements(statements, db, env, {
                eventType: 'order.created',
                order: {
                    id,
                    order_code: code,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_email: customerEmail,
                    locale: 'vi',
                    status,
                    fulfillment_status: status,
                    payment_method: paymentMethod,
                    payment_status: paymentStatus,
                    paid_at: paidAt,
                    subtotal_price: subtotal,
                    discount_amount: discountAmount,
                    taxable_amount: quote.taxable_amount,
                    tax_amount: quote.tax_amount,
                    shipping_fee: quote.shipping_fee,
                    shipping_net_amount: quote.shipping_net_amount,
                    shipping_tax_rate: quote.shipping_tax_rate,
                    shipping_tax_amount: quote.shipping_tax_amount,
                    currency: quote.currency,
                    grand_total: quote.grand_total,
                    total_price: quote.grand_total,
                    tax_rate: quote.tax_rate,
                    order_channel: channel,
                    notes,
                    created_at: now,
                },
                items: itemSnapshots,
                now,
            });
        }

        if (customerPhone) {
            statements.push(
                createPancakeCustomerOutboxStatement(db, customerPhone, `${now}:admin-order:${id}`, { orderId: id }, now),
                createPancakeOrderOutboxStatement(db, id, `${now}:admin-created`, now),
            );
        }

        try {
            await db.batch(statements);
        } catch (error) {
            if (String(error?.message || error).includes('INSUFFICIENT_STOCK')) {
                throw Object.assign(new Error('Một hoặc nhiều sản phẩm vừa hết tồn kho.'), { status: 409 });
            }
            const replay = await db.prepare('SELECT id FROM product_orders WHERE checkout_idempotency_key = ? LIMIT 1')
                .bind(idempotencyKey).first();
            if (replay) {
                return json({ order: await loadOrder(db, replay.id), idempotentReplay: true });
            }
            throw error;
        }

        if (posCustomerNotification.emailOutboxCreated) {
            await dispatchCustomerEmailBestEffort(env);
        }
        await dispatchPendingPancakeSyncBestEffort(env);
        return json({ order: await loadOrder(db, id) }, 201);
    } catch (error) {
        return apiError(error, 'Không thể tạo đơn quản trị.');
    }
}

export async function quoteOrderTotals(request, env) {
    try {
        const db = requireD1(env);
        const body = await readJson(request, 32 * 1024);
        const lines = Array.isArray(body.items) && body.items.length
            ? await checkoutLinesFromItems(db, body.items)
            : null;
        const subtotal = lines
            ? lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
            : Math.max(0, Math.round(Number(body.subtotal || 0)));
        const quote = await calculateTaxQuote(db, {
            subtotal,
            discountAmount: body.discountAmount ?? body.discount_amount,
            shippingFee: body.shippingFee ?? body.shipping_fee,
            province: body.shippingProvince ?? body.shipping_province,
            district: body.shippingDistrict ?? body.shipping_district,
            lines,
        });
        return json({ quote });
    } catch (error) {
        return apiError(error, 'Could not calculate order totals.');
    }
}

export async function validateDiscountCode(request, env) {
    try {
        const db = requireD1(env);
        const url = new URL(request.url);
        const subtotal = Math.max(0, Math.round(Number(url.searchParams.get('subtotal') || 0)));
        const session = await getSession(db, request);
        const discount = await getDiscount(db, url.searchParams.get('code'), subtotal, session?.user_id || null);
        if (!discount) throw Object.assign(new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn.'), { status: 400 });
        return json({ discount });
    } catch (error) {
        return apiError(error, 'Could not validate discount code.');
    }
}

export async function updateOrderStatus(request, env, id) {
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 32 * 1024);
        const nextStatus = String(body.status || '').trim();
        if (!ORDER_STATUSES.has(nextStatus)) throw Object.assign(new Error('Invalid order status.'), { status: 400 });
        const current = await loadOrder(db, id);
        if (current.status === nextStatus) return json({ order: current, unchanged: true });
        const now = new Date().toISOString();
        const note = String(body.reason ?? body.note ?? '').trim().slice(0, 1000) || null;
        const paymentState = paymentStateAfterFulfillment(current, nextStatus, now);
        const completedPaymentProvider = current.payment_method === 'cash' ? 'cash' : 'cod';
        const completedPaymentReference = current.payment_method === 'cash' ? 'CASH' : 'COD';
        let posPaidNotification = { emailOutboxCreated: false, zaloJobCreated: false };
        const statements = [
            db.prepare(`UPDATE product_orders SET status = ?,
                fulfillment_status = CASE WHEN ? = 'refunded' THEN fulfillment_status ELSE ? END,
                payment_status = CASE WHEN ? = 1 THEN 'paid' ELSE payment_status END,
                paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, ?) ELSE paid_at END,
                updated_at = ? WHERE id = ?`)
                .bind(nextStatus, nextStatus, nextStatus === 'refunded' ? current.fulfillment_status : nextStatus,
                    paymentState.changed ? 1 : 0, paymentState.changed ? 1 : 0, paymentState.paid_at,
                    now, current.id),
            db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`)
                .bind(randomId(), current.id, current.status, nextStatus, session.user_id, note, now),
        ];
        if (paymentState.changed) {
            statements.push(db.prepare(`UPDATE order_payment_logs SET status = 'paid', paid_at = ?,
                transaction_ref = COALESCE(transaction_ref, ?), metadata_json = ?
                WHERE order_id = ? AND status = 'unpaid'`)
                .bind(paymentState.paid_at, completedPaymentReference,
                    JSON.stringify({ provider: completedPaymentProvider, confirmation: 'order_completed' }), current.id));
            if (isTelegramOrderAlertsEnabled(env)) {
                const telegramPayload = buildOrderAutomationPayload({
                    ...current,
                    status: nextStatus,
                    payment_status: paymentState.payment_status,
                    paid_at: paymentState.paid_at,
                    payment_provider: current.payment_provider || completedPaymentProvider,
                }, current.order_items, {
                    event_type: 'order.paid',
                    paid_at: paymentState.paid_at,
                    transaction_ref: completedPaymentReference,
                    received_amount: Number(current.grand_total ?? current.total_price ?? 0),
                }, env);
                statements.push(createTelegramOutboxStatement(db, {
                    eventType: 'order.paid',
                    orderId: current.id,
                    idempotencyKey: `telegram/order.paid/${current.id}`,
                    payload: telegramPayload,
                    now,
                }));
            }
            if (current.order_channel === 'pos') {
                posPaidNotification = appendPosCustomerNotificationStatements(statements, db, env, {
                    eventType: 'order.paid',
                    order: {
                        ...current,
                        status: nextStatus,
                        fulfillment_status: nextStatus,
                        payment_status: paymentState.payment_status,
                        paid_at: paymentState.paid_at,
                        payment_provider: current.payment_provider || completedPaymentProvider,
                        payment_reference: current.payment_reference || completedPaymentReference,
                    },
                    items: current.order_items,
                    now,
                    emailExtra: {
                        transaction_ref: completedPaymentReference,
                    },
                    automationExtra: {
                        paid_at: paymentState.paid_at,
                        transaction_ref: completedPaymentReference,
                        received_amount: Number(current.grand_total ?? current.total_price ?? 0),
                    },
                });
            }
        }
        const payload = buildOrderEmailPayload({
            ...current,
            status: nextStatus,
            payment_status: paymentState.payment_status,
            paid_at: paymentState.paid_at,
        }, current.order_items, {
            reason: note,
            tracking_code: body.trackingCode ?? body.tracking_code ?? current.shipping_code ?? null,
        }, env);
        const posPaymentEmailReplacesStatusEmail = current.order_channel === 'pos'
            && paymentState.changed
            && posPaidNotification.emailOutboxCreated;
        if (!posPaymentEmailReplacesStatusEmail
            && EMAIL_ORDER_STATUSES.has(nextStatus)
            && EMAIL_PATTERN.test(String(current.customer_email || ''))) {
            statements.push(createOutboxStatement(db, {
                eventType: `order.${nextStatus}`,
                aggregateType: 'order', aggregateId: current.id, audience: 'customer',
                recipientEmail: current.customer_email, locale: current.locale, payload,
                idempotencyKey: `customer/order.${nextStatus}/${current.id}`,
            }));
        }
        statements.push(createPancakeOrderOutboxStatement(
            db, current.id, `${now}:status:${nextStatus}`, now,
        ));
        await db.batch(statements);
        if (posPaidNotification.emailOutboxCreated) {
            await dispatchCustomerEmailBestEffort(env);
        }
        await dispatchPendingPancakeSyncBestEffort(env);
        return json({ order: await loadOrder(db, current.id) });
    } catch (error) {
        return apiError(error, 'Could not update order status.');
    }
}

export async function refundOrder(request, env, id) {
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 32 * 1024);
        const order = await loadOrder(db, id);
        const amount = Math.max(0, Math.round(Number(body.amount ?? order.grand_total)));
        if (!amount || amount > Number(order.grand_total)) {
            throw Object.assign(new Error('Refund amount is invalid.'), { status: 400 });
        }
        const refundId = randomId();
        const now = new Date().toISOString();
        const reason = String(body.reason || '').trim().slice(0, 1000) || null;
        const restock = body.restock === true;
        const statements = [
            db.prepare(`INSERT INTO order_refund_logs (id, order_id, amount, reason, status, restocked, refunded_at, created_by, created_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`)
                .bind(refundId, order.id, amount, reason, restock ? 1 : 0, now, session.user_id, now),
            db.prepare(`UPDATE product_orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`)
                .bind(now, order.id),
            db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, 'refunded', ?, 'admin', ?, ?)`)
                .bind(randomId(), order.id, order.status, session.user_id, reason, now),
        ];
        if (restock) {
            for (const item of order.order_items) {
                if (item.product_id == null) continue;
                statements.push(
                    db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?')
                        .bind(item.quantity, now, item.product_id),
                    createPancakeInventoryOutboxStatement(
                        db, item.product_id, `${now}:refund:${refundId}`, now,
                    ),
                );
            }
        }
        if (EMAIL_PATTERN.test(String(order.customer_email || ''))) {
            statements.push(createOutboxStatement(db, {
                eventType: 'order.refunded', aggregateType: 'refund', aggregateId: refundId, audience: 'customer',
                recipientEmail: order.customer_email, locale: order.locale,
                payload: {
                    ...buildOrderEmailPayload({ ...order, status: 'refunded', payment_status: 'refunded' }, order.order_items, { reason }, env),
                    refund_amount: amount,
                    refund_id: refundId,
                },
                idempotencyKey: `customer/order.refunded/${refundId}`,
            }));
        }
        statements.push(createPancakeOrderOutboxStatement(
            db, order.id, `${now}:refund:${refundId}`, now,
        ));
        await db.batch(statements);
        await dispatchPendingPancakeSyncBestEffort(env);
        return json({ order: await loadOrder(db, order.id), refundId });
    } catch (error) {
        return apiError(error, 'Could not refund order.');
    }
}

export async function getProductWithIngredientSnapshot(_request, env, idOrSlug) {
    try {
        const db = requireD1(env);
        const product = await db.prepare(`
            SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.analysis_json,
                   s.recognized_count, s.total_count, s.analyzer_version, s.analyzed_at
            FROM products p
            LEFT JOIN product_categories c ON c.id = p.category_id
            LEFT JOIN product_ingredient_snapshots s ON s.product_id = p.id
            WHERE (CAST(p.id AS TEXT) = ? OR p.slug = ?) AND p.is_published = 1 LIMIT 1
        `).bind(idOrSlug, idOrSlug).first();
        if (!product) throw Object.assign(new Error('Product was not found.'), { status: 404 });
        const images = await db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order, id')
            .bind(product.id).all();
        const analysis = product.analysis_json ? JSON.parse(product.analysis_json) : null;
        delete product.analysis_json;
        return json({ product: { ...product, images: images.results || [], ingredient_analysis: analysis } }, 200, {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        });
    } catch (error) {
        return apiError(error, 'Could not load product.');
    }
}
