import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { maybeHandleAnalyticsRoute } from '../worker/analytics/routes.js';
import { handleGuestOrderLookup, handleGuestOrderOtpRequest } from '../worker/orderLookup/handlers.js';
import { decryptText } from '../worker/platform/crypto.js';
import { renderEmail } from '../worker/email/templates.js';

const root = new URL('../', import.meta.url);
const source = (file) => readFile(new URL(file, root), 'utf8');

function createAnalyticsDb() {
    const inserts = [];
    return {
        inserts,
        prepare(sql) {
            let values = [];
            return {
                bind(...next) {
                    values = next;
                    return this;
                },
                async first() {
                    if (/FROM sessions/i.test(sql)) return null;
                    return null;
                },
                async run() {
                    if (/INSERT INTO funnel_events/i.test(sql)) inserts.push(values);
                    return { success: true };
                },
            };
        },
    };
}

test('D1 analytics uses guest CSRF and ignores client supplied user id', async () => {
    const db = createAnalyticsDb();
    const request = new Request('https://example.test/api/analytics/funnel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: 'tg_guest_csrf=test-token',
            'X-CSRF-Token': 'test-token',
        },
        body: JSON.stringify({
            eventName: 'checkout.started',
            sessionId: 'browser-session-1',
            userId: 'forged-admin-id',
            path: '/thanh-toan',
            metadata: { source: 'cart' },
        }),
    });

    const response = await maybeHandleAnalyticsRoute({
        request,
        env: { DATA_BACKEND: 'd1', APP_DB: db },
        path: '/api/analytics/funnel',
    });

    assert.equal(response.status, 202);
    assert.equal(db.inserts.length, 1);
    assert.equal(db.inserts[0][1], 'checkout.started');
    assert.equal(db.inserts[0][2], null);
    assert.equal(db.inserts[0][3], 'browser-session-1');
});

test('D1 analytics rejects writes without CSRF', async () => {
    const db = createAnalyticsDb();
    const request = new Request('https://example.test/api/analytics/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'checkout.started', sessionId: 'browser-session-1' }),
    });
    const response = await maybeHandleAnalyticsRoute({
        request,
        env: { DATA_BACKEND: 'd1', APP_DB: db },
        path: '/api/analytics/funnel',
    });

    assert.equal(response.status, 403);
    assert.equal(db.inserts.length, 0);
});

test('D1 import and cutover source enforce migration safety contracts', async () => {
    const [generator, importer, gate, capacityAudit, capacityPolicy, authRoutes, migration, lookupMigration, privateCopy, backupScript, workerSource] = await Promise.all([
        source('scripts/d1_generate_import_sql.mjs'),
        source('scripts/d1_import_data.mjs'),
        source('scripts/d1_cutover_gate.mjs'),
        source('scripts/d1_audit_capacity.mjs'),
        source('d1/capacity-policy.json'),
        source('worker/auth/routes.js'),
        source('d1/app/migrations/0012_funnel_analytics.sql'),
        source('d1/app/migrations/0013_order_lookup_otp.sql'),
        source('scripts/migrate_private_documents_to_r2.mjs'),
        source('scripts/d1_backup_to_r2.mjs'),
        source('_worker.js'),
    ]);

    assert.doesNotMatch(generator, /app\.push\([^\n]*BEGIN\s+(?:TRANSACTION|IMMEDIATE|EXCLUSIVE)/i);
    assert.doesNotMatch(generator, /app\.push\([^\n]*COMMIT\s*;/i);
    assert.match(importer, /5 \* 1024 \* 1024 \* 1024/);
    assert.match(importer, /checksum does not match/);
    assert.match(gate, /private-storage-copy-report\.json/);
    assert.match(gate, /CUTOVER_FRONTEND_BACKEND/);
    assert.match(gate, /D1 capacity report/);
    assert.match(gate, /oauth_google/);
    assert.match(capacityAudit, /450 MiB shard threshold/);
    assert.equal(JSON.parse(capacityPolicy).shardThresholdBytes, 450 * 1024 * 1024);
    assert.match(authRoutes, /\(google\)/);
    assert.doesNotMatch(authRoutes, /google\|apple/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS funnel_events/);
    assert.match(lookupMigration, /CREATE TABLE IF NOT EXISTS order_lookup_otps/);
    assert.match(privateCopy, /target R2 checksum or size mismatch/);
    assert.match(backupScript, /sha256File/);
    assert.match(backupScript, /confirm-remote-backup/);
    assert.match(backupScript, /manifest\.json/);
    assert.match(workerSource, /supabaseFetch: publicDataFetch/);
});

test('D1 frontend routes AI, GHTK and auth-page reads away from Supabase', async () => {
    const [apiSource, shippingSource] = await Promise.all([
        source('services/api.ts'),
        source('worker/shipping/handlers.js'),
    ]);

    assert.match(apiSource, /if \(!USE_D1_API\) \{\s*try \{\s*await ensureSessionFresh\(\)/s);
    assert.match(apiSource, /\/api\/shipping\/ghtk\/create/);
    assert.match(apiSource, /\/api\/shipping\/ghtk\/cancel/);
    assert.match(apiSource, /\/api\/shipping\/ghtk\/orders\/\$\{encodeURIComponent\(orderId\)\}/);
    assert.match(apiSource, /if \(USE_D1_API\) throw error;\s*const directResult = await supabase/s);
    assert.match(shippingSource, /eventType: 'order\.processing'/);
    assert.match(shippingSource, /eventType: 'order\.cancelled'/);
    assert.match(shippingSource, /return json\(\{ events \}\)/);
});

test('D1 admin, review and pricing routes cover the public application contracts', async () => {
    const [adminRoutes, adminHandlers, contentHandlers, reviewRoutes, apiSource, inciMigration] = await Promise.all([
        source('worker/adminD1/routes.js'),
        source('worker/adminD1/handlers.js'),
        source('worker/adminD1/contentHandlers.js'),
        source('worker/reviews/routes.js'),
        source('services/api.ts'),
        source('d1/inci/migrations/0002_replace_fts_search_index.sql'),
    ]);

    for (const route of [
        '/api/admin/products', '/api/admin/product-categories', '/api/admin/product-brands',
        '/api/admin/services', '/api/admin/blog-posts', '/api/admin/blog-categories',
        '/api/admin/users', '/api/admin/medical-records', '/api/admin/dashboard/kpi',
        '/api/admin/dashboard/timeseries', '/api/admin/dashboard/inventory',
        '/api/admin/dashboard/top-products', '/api/admin/dashboard/services',
        '/api/admin/dashboard/customers', '/api/admin/dashboard/appointments',
        '/api/admin/dashboard/alerts', '/api/admin/discount-codes',
        '/api/admin/tax-profiles', '/api/admin/tax-rates',
    ]) {
        assert.ok(adminRoutes.includes(route), `missing D1 admin route ${route}`);
    }
    assert.match(adminHandlers, /requireAdmin/);
    assert.match(adminHandlers, /INSERT INTO products/);
    assert.match(adminHandlers, /INSERT INTO discount_codes/);
    assert.match(adminHandlers, /INSERT INTO tax_profiles/);
    assert.match(contentHandlers, /INSERT INTO services/);
    assert.match(contentHandlers, /INSERT INTO blog_posts/);
    assert.match(contentHandlers, /INSERT INTO medical_records/);
    assert.match(reviewRoutes, /\/api\\\/products\\\/\(\\d\+\)\\\/reviews/);
    assert.match(apiSource, /\/api\/admin\/products/);
    assert.match(apiSource, /\/api\/admin\/services/);
    assert.match(apiSource, /\/api\/admin\/blog-posts/);
    assert.match(apiSource, /\/api\/admin\/users/);
    assert.match(apiSource, /\/api\/account/);
    assert.match(apiSource, /\/api\/products\/\$\{productId\}\/reviews/);
    assert.match(apiSource, /\/api\/admin\/discount-codes/);
    assert.match(apiSource, /\/api\/admin\/tax-profiles/);
    assert.match(inciMigration, /DROP TABLE IF EXISTS ingredient_search_fts/);
    assert.match(inciMigration, /CREATE TABLE IF NOT EXISTS ingredient_search_terms/);
});

test('ingredient analyzer supports active D1 shards and operational source records', async () => {
    const [handlers, productSync, sourceMigration, shardMigration, chunkMigration] = await Promise.all([
        source('worker/ingredientAnalyzer/handlers.js'),
        source('worker/ingredientAnalyzer/productSync.js'),
        source('d1/inci/migrations/0003_ingredient_source_records.sql'),
        source('d1/inci/migrations/0004_shard_metadata.sql'),
        source('d1/inci/migrations/0005_source_record_chunks.sql'),
    ]);
    assert.match(handlers, /INCI_SHARD_COUNT/);
    assert.match(handlers, /INCI_DB_\$\{index\}/);
    assert.match(handlers, /ingredient_source_records/);
    assert.match(handlers, /cloudflare-d1-sharded/);
    assert.match(productSync, /getIngredientD1Databases/);
    assert.match(sourceMigration, /CREATE TABLE IF NOT EXISTS ingredient_source_records/);
    assert.match(shardMigration, /CREATE TABLE IF NOT EXISTS ingredient_shard_metadata/);
    assert.match(chunkMigration, /CREATE TABLE IF NOT EXISTS ingredient_source_record_chunks/);
    assert.match(handlers, /chunksBySourceId/);
});

test('transactional email templates cover every lifecycle event and locale', () => {
    const payload = {
        order_id: 'order-1', order_code: 'TG-1001', customer_name: '<script>alert(1)</script>',
        shipping_address: '1 Đường Biển, Phú Quốc', payment_method: 'cod', tracking_code: 'GHTK-1',
        grand_total: 250000, reason: 'Khách yêu cầu', refund_amount: 250000,
        items: [{ product_id: 1, name: 'Gel trị mụn', quantity: 1, price_at_purchase: 250000 }],
    };
    for (const locale of ['vi', 'en', 'ru', 'cn']) {
        for (const event of ['order.created', 'order.processing', 'order.shipped', 'order.completed', 'order.cancelled', 'order.refunded']) {
            const rendered = renderEmail(event, payload, locale);
            assert.ok(rendered.subject.length > 3, `${event}/${locale} subject`);
            assert.match(rendered.html, /TG-1001/);
            assert.doesNotMatch(rendered.html, /<script>alert\(1\)<\/script>/);
        }
        const appointment = renderEmail('appointment.confirmed', {
            service_name: 'Điều trị mụn', date: '2026-08-10', time: '09:00', status: 'confirmed',
        }, locale);
        assert.ok(appointment.subject.length > 3);
        assert.match(appointment.html, /Điều trị mụn/);
    }
});

test('order email includes product image and transparent price breakdown', () => {
    const rendered = renderEmail('order.created', {
        order_id: 'order-2', order_code: 'TG-1002', customer_name: 'Khách hàng', customer_phone: '0900000000',
        shipping_address: 'Bãi Dài, Phú Quốc', payment_method: 'cod',
        subtotal_price: 395000, discount_amount: 10000, taxable_amount: 385000,
        tax_amount: 38500, tax_rate: 0.1, shipping_fee: 30000,
        shipping_tax_rate: 0.1, shipping_tax_amount: 3000, grand_total: 456500,
        items: [{
            product_id: 382, name: 'Gel trị mụn Klenzit MS', sku: 'KLENZIT-MS',
            image_url: 'https://thegioitrimun.vn/r2/product-images/klenzit.webp', quantity: 1,
            price_at_purchase: 395000, line_total: 395000, vat_rate: 0.1, tax_amount: 35909,
        }],
    }, 'vi');

    assert.match(rendered.html, /https:\/\/thegioitrimun\.vn\/r2\/product-images\/klenzit\.webp/);
    assert.match(rendered.html, /Đơn giá/);
    assert.match(rendered.html, /Thuế sản phẩm/);
    assert.match(rendered.html, /Phí vận chuyển/);
    assert.match(rendered.html, /Thuế vận chuyển/);
    assert.match(rendered.html, /456\.500/);
});

function createOrderLookupDb() {
    const order = {
        id: 'order-1', order_code: 'TGTM-10001', customer_phone: '0901234567',
        customer_email: 'buyer@example.com', customer_name: 'Khách hàng', locale: 'vi',
        status: 'processing', grand_total: 250000, total_price: 250000,
    };
    const state = { statements: [], otp: null, consumed: false };
    return {
        state,
        prepare(sql) {
            const statement = {
                sql, values: [],
                bind(...values) { this.values = values; return this; },
                async first() {
                    if (/FROM product_orders/i.test(sql)) return order;
                    if (/created_at >=/i.test(sql)) return null;
                    if (/FROM order_lookup_otps/i.test(sql)) return state.consumed ? null : state.otp;
                    return null;
                },
                async all() {
                    if (/FROM product_order_items/i.test(sql)) {
                        return { results: [{
                            id: 'item-1', order_id: order.id, product_id: 7, product_name: 'Gel trị mụn',
                            product_sku: 'GEL-7', product_image_path: 'products/gel.webp', quantity: 1,
                            price_at_purchase: 250000, vat_rate: 0, tax_amount: 0, created_at: new Date().toISOString(),
                        }] };
                    }
                    return { results: [] };
                },
                async run() {
                    if (/SET consumed_at/i.test(sql)) state.consumed = true;
                    return { meta: { changes: 1 } };
                },
            };
            state.statements.push(statement);
            return statement;
        },
        async batch(statements) {
            const otpInsert = statements.find((statement) => /INSERT INTO order_lookup_otps/i.test(statement.sql));
            if (otpInsert) {
                state.otp = {
                    id: otpInsert.values[0], order_id: otpInsert.values[1], otp_hash: otpInsert.values[2],
                    destination_hint: otpInsert.values[3], attempts: 0, expires_at: otpInsert.values[4],
                    consumed_at: null, created_at: otpInsert.values[5],
                };
            }
            return statements.map(() => ({ success: true }));
        },
    };
}

const orderLookupJson = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
});

function orderLookupRequest(path, body) {
    return new Request(`https://example.test${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1' },
        body: JSON.stringify(body),
    });
}

test('D1 guest lookup sends encrypted email OTP and consumes it once', async () => {
    const db = createOrderLookupDb();
    const pepper = 'test-order-lookup-pepper-with-32-bytes';
    const env = {
        DATA_BACKEND: 'd1', APP_DB: db, ORDER_LOOKUP_OTP_PEPPER: pepper,
        ORDER_LOOKUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
    };
    const deps = { jsonResponse: orderLookupJson, dispatchPendingNotifications: async () => ({ queued: 1 }) };
    const requestResponse = await handleGuestOrderOtpRequest(orderLookupRequest('/api/orders/guest-lookup/request-otp', {
        orderCode: 'TGTM-10001', phone: '0901234567',
    }), env, deps);
    assert.equal(requestResponse.status, 202);
    assert.deepEqual(await requestResponse.json(), { sent: true, channel: 'email' });

    const outbox = db.state.statements.find((statement) => /INSERT OR IGNORE INTO notification_outbox/i.test(statement.sql));
    const payload = JSON.parse(outbox.values[7]);
    assert.equal(Object.hasOwn(payload, 'otp'), false);
    const otp = await decryptText(payload.otp_encrypted, pepper, payload.otp_context);
    assert.match(otp, /^\d{6}$/);

    const verifyResponse = await handleGuestOrderLookup(orderLookupRequest('/api/orders/guest-lookup', {
        orderCode: 'TGTM-10001', phone: '0901234567', otp,
    }), env, deps);
    assert.equal(verifyResponse.status, 200);
    const orders = await verifyResponse.json();
    assert.equal(orders[0].order_items[0].product.name, 'Gel trị mụn');

    const replayResponse = await handleGuestOrderLookup(orderLookupRequest('/api/orders/guest-lookup', {
        orderCode: 'TGTM-10001', phone: '0901234567', otp,
    }), env, deps);
    assert.equal(replayResponse.status, 401);
});
