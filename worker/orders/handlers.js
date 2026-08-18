import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { randomId } from '../platform/crypto.js';
import { createOutboxStatement } from '../email/outbox.js';
import { getSession, requireCsrf, requireGuestCsrf, requireRole } from '../auth/session.js';
import {
    createPancakeCustomerOutboxStatement,
    createPancakeInventoryOutboxStatement,
    createPancakeOrderOutboxStatement,
} from '../integrations/pancake/outbox.js';
import { hydrateOrderItemsWithProductImages, resolvePublicProductImageUrl } from '../products/orderImage.js';

const LOCALES = new Set(['vi', 'en', 'ru', 'cn']);
const ORDER_STATUSES = new Set(['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']);
const EMAIL_ORDER_STATUSES = new Set(['processing', 'shipped', 'completed', 'cancelled']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        merged.set(productId, (merged.get(productId) || 0) + quantity);
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
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
    const afterDiscount = subtotal - discountAmount;
    let taxableAmount;
    let taxAmount;
    let shippingNetAmount;
    let shippingTaxAmount;
    let grandTotal;
    if (taxMode === 'inclusive' && rate > 0) {
        taxableAmount = Math.round(afterDiscount / (1 + rate));
        taxAmount = afterDiscount - taxableAmount;
        shippingNetAmount = shippingTaxable ? Math.round(shippingFee / (1 + rate)) : shippingFee;
        shippingTaxAmount = shippingTaxable ? shippingFee - shippingNetAmount : 0;
        grandTotal = afterDiscount + shippingFee;
    } else {
        taxableAmount = afterDiscount;
        taxAmount = Math.round(taxableAmount * rate);
        shippingNetAmount = shippingFee;
        shippingTaxAmount = shippingTaxable ? Math.round(shippingFee * rate) : 0;
        grandTotal = taxableAmount + shippingNetAmount + taxAmount + shippingTaxAmount;
    }
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
    };
}

async function subtotalFromItems(db, value) {
    const items = normalizeItems(value);
    const placeholders = items.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT id, price, is_published FROM products WHERE id IN (${placeholders})`)
        .bind(...items.map((item) => item.productId)).all();
    const products = new Map((rows.results || []).map((row) => [Number(row.id), row]));
    if (products.size !== items.length || [...products.values()].some((row) => !row.is_published)) {
        throw Object.assign(new Error('One or more products are unavailable.'), { status: 409 });
    }
    return items.reduce((total, item) => total + Math.round(Number(products.get(item.productId).price || 0)) * item.quantity, 0);
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

function publicEmailImageUrl(value, env) {
    const resolved = resolvePublicProductImageUrl(value);
    if (!resolved) return '';
    if (/^https?:\/\//i.test(resolved)) return resolved;
    const origin = String(env?.PUBLIC_SITE_URL || env?.OAUTH_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
    if (resolved.startsWith('/r2/')) return `${origin}${resolved}`;
    const r2Base = String(env?.R2_PUBLIC_BASE_URL || `${origin}/r2`).replace(/\/+$/, '');
    return `${r2Base}/product-images/${resolved.replace(/^\/+/, '')}`;
}

function emailPayload(order, items, extra = {}, env = {}) {
    return {
        order_id: order.id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        currency: order.currency || 'VND',
        subtotal_price: order.subtotal_price ?? order.total_price ?? 0,
        discount_amount: order.discount_amount || 0,
        taxable_amount: order.taxable_amount || 0,
        tax_amount: order.tax_amount || 0,
        shipping_fee: order.shipping_fee || 0,
        shipping_net_amount: order.shipping_net_amount ?? order.shipping_fee ?? 0,
        shipping_tax_rate: order.shipping_tax_rate || 0,
        shipping_tax_amount: order.shipping_tax_amount || 0,
        tax_rate: order.tax_rate || 0,
        grand_total: order.grand_total,
        total_price: order.total_price,
        shipping_provider: order.shipping_provider,
        shipping_address: [order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', '),
        payment_method: order.payment_method,
        items: items.map((item) => ({
            product_id: item.product_id,
            name: item.product_name || item.product?.name || `Sản phẩm #${item.product_id}`,
            sku: item.product_sku || item.product?.sku || '',
            image_url: publicEmailImageUrl(
                item.product_image_path || item.resolved_product_image_path || item.product?.main_image_url || item.product?.main_image_path,
                env,
            ),
            quantity: Number(item.quantity || 0),
            price_at_purchase: Number(item.price_at_purchase || 0),
            line_total: Number(item.line_total ?? item.lineTotal ?? (Number(item.price_at_purchase || 0) * Number(item.quantity || 0))),
            vat_rate: Number(item.vat_rate ?? item.vatRate ?? 0),
            tax_amount: Number(item.tax_amount ?? item.lineTax ?? 0),
        })),
        ...extra,
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
        if (existing) return json({ order: await loadOrder(db, existing.id), idempotentReplay: true });

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
        let taxAmount = 0;
        const normalizedItems = items.map((item) => {
            const product = productMap.get(item.productId);
            if (Number(product.stock_quantity) < item.quantity) {
                throw Object.assign(new Error(`${product.name} does not have enough stock.`), { status: 409 });
            }
            const lineTotal = Math.round(Number(product.price || 0) * item.quantity);
            const rawRate = Math.max(0, Number(product.vat_rate || 0));
            const rate = rawRate > 1 ? rawRate / 100 : rawRate;
            const lineTax = rate > 0 ? Math.round(lineTotal * rate / (1 + rate)) : 0;
            subtotal += lineTotal;
            taxAmount += lineTax;
            return { ...item, product, lineTotal, lineTax, vatRate: rate };
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
        });
        const grandTotal = quote.grand_total;
        const now = new Date().toISOString();
        const id = randomId();
        const code = orderCode();
        const status = body.paymentMethod === 'bank_transfer' || body.payment_method === 'bank_transfer' ? 'pending' : 'processing';
        const paymentMethod = body.paymentMethod === 'bank_transfer' || body.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
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
                    subtotal_price, discount_code, discount_amount, taxable_amount, tax_amount,
                    shipping_provider, shipping_fee, shipping_net_amount, shipping_tax_rate,
                    shipping_tax_amount, estimated_delivery_time, currency, grand_total,
                    total_price, tax_profile_id, tax_mode, tax_rate, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id, code, idempotencyKey, session?.user_id || null, order.customer_name, order.customer_phone,
                customerEmail, locale, order.shipping_street, order.shipping_ward, order.shipping_district,
                order.shipping_province, order.notes, status, status, paymentMethod,
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
        const payload = emailPayload(order, itemSnapshots, {}, env);
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

        try {
            await db.batch(statements);
        } catch (error) {
            if (String(error?.message || error).includes('INSUFFICIENT_STOCK')) {
                throw Object.assign(new Error('One or more products no longer have enough stock.'), { status: 409 });
            }
            throw error;
        }
        return json({ order: await loadOrder(db, id) }, 201);
    } catch (error) {
        return apiError(error, 'Could not create order.');
    }
}

export async function quoteOrderTotals(request, env) {
    try {
        const db = requireD1(env);
        const body = await readJson(request, 32 * 1024);
        const subtotal = Array.isArray(body.items) && body.items.length
            ? await subtotalFromItems(db, body.items)
            : Math.max(0, Math.round(Number(body.subtotal || 0)));
        const quote = await calculateTaxQuote(db, {
            subtotal,
            discountAmount: body.discountAmount ?? body.discount_amount,
            shippingFee: body.shippingFee ?? body.shipping_fee,
            province: body.shippingProvince ?? body.shipping_province,
            district: body.shippingDistrict ?? body.shipping_district,
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
        const statements = [
            db.prepare(`UPDATE product_orders SET status = ?, fulfillment_status = CASE WHEN ? = 'refunded' THEN fulfillment_status ELSE ? END, updated_at = ? WHERE id = ?`)
                .bind(nextStatus, nextStatus, nextStatus === 'refunded' ? current.fulfillment_status : nextStatus, now, current.id),
            db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, note, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`)
                .bind(randomId(), current.id, current.status, nextStatus, session.user_id, note, now),
        ];
        const payload = emailPayload(current, current.order_items, {
            reason: note,
            tracking_code: body.trackingCode ?? body.tracking_code ?? current.shipping_code ?? null,
        }, env);
        if (EMAIL_ORDER_STATUSES.has(nextStatus) && EMAIL_PATTERN.test(String(current.customer_email || ''))) {
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
                payload: { ...emailPayload(order, order.order_items, { reason }, env), refund_amount: amount, refund_id: refundId },
                idempotencyKey: `customer/order.refunded/${refundId}`,
            }));
        }
        statements.push(createPancakeOrderOutboxStatement(
            db, order.id, `${now}:refund:${refundId}`, now,
        ));
        await db.batch(statements);
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
