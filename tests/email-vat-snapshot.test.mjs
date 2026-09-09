import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { sha256 } from '../worker/platform/crypto.js';
import { createOrder, createAdminOrder, updateOrderStatus, refundOrder } from '../worker/orders/handlers.js';
import { createPancakeInboundEvent, consumePancakeInboundMessage } from '../worker/integrations/pancake/inbound.js';
import { matchPancakeOrderItems, resolvePancakeOrderTax } from '../worker/integrations/pancake/orderTax.js';
import { handleWebhook } from '../worker/shipping/handlers.js';
import { handleSepayWebhook } from '../worker/payments/sepay.js';
import { buildOrderEmailPayload } from '../worker/orders/notificationPayload.js';
import { renderEmail } from '../worker/email/templates.js';

const migrations = new URL('../d1/app/migrations/', import.meta.url);
const schema = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
    .map((name) => readFileSync(new URL(name, migrations), 'utf8'));
const moneyFields = ['subtotal_price', 'discount_amount', 'taxable_amount', 'tax_amount',
    'tax_rate', 'tax_mode', 'shipping_fee', 'shipping_net_amount', 'shipping_tax_rate',
    'shipping_tax_amount', 'grand_total', 'total_price'];
const money = (value) => Object.fromEntries(moneyFields.map((key) => [key, value[key]]));
const lineTaxes = (items) => [...items].sort((a, b) => a.product_id - b.product_id).map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity, price_at_purchase: item.price_at_purchase,
    vat_rate: item.vat_rate, tax_amount: item.tax_amount,
}));

async function fixture(t, taxMode = 'exclusive', shippingTaxable = 0) {
    const sqlite = new DatabaseSync(':memory:');
    t.after(() => sqlite.close());
    for (const sql of schema) sqlite.exec(sql);
    const now = new Date().toISOString();
    for (const [index, rate] of [0, 0.05, 0.08, 0.1].entries()) {
        const id = index + 1;
        sqlite.prepare(`INSERT INTO products (id, slug, name, price, vat_rate, stock_quantity, is_published, created_at, updated_at)
            VALUES (?, ?, ?, 110000, ?, 100, 1, ?, ?)`).run(id, `vat-${id}`, `Sản phẩm ${id}`, rate, now, now);
        sqlite.prepare(`INSERT INTO pancake_entity_links (entity_type, local_entity_id, pancake_entity_id, pancake_variation_id, created_at, updated_at)
            VALUES ('product', ?, ?, ?, ?, ?)`).run(String(id), `product-${id}`, `variation-${id}`, now, now);
    }
    sqlite.prepare('UPDATE tax_profiles SET tax_mode = ?, applies_to_shipping = ?').run(taxMode, shippingTaxable);
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('vat-admin', 'test@example.com', ?, ?)`).run(now, now);
    sqlite.prepare(`INSERT INTO user_roles (user_id, role_id, created_at)
        SELECT 'vat-admin', id, ? FROM roles WHERE code = 'master_admin'`).run(now);
    sqlite.prepare(`INSERT INTO sessions (id, user_id, token_hash, csrf_hash, created_at, last_seen_at, expires_at)
        VALUES ('vat-session', 'vat-admin', ?, ?, ?, ?, '2099-01-01T00:00:00.000Z')`)
        .run(await sha256('vat-token'), await sha256('vat-csrf'), now, now);
    const db = {
        prepare(sql) {
            const wrap = (values = []) => ({
                bind: (...args) => wrap(args),
                first: async (column) => {
                    const row = sqlite.prepare(sql).get(...values);
                    return column ? row?.[column] ?? null : row ?? null;
                },
                all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
                run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
            });
            return wrap();
        },
        async batch(statements) {
            sqlite.exec('BEGIN');
            try {
                const result = [];
                for (const statement of statements) result.push(await statement.run());
                sqlite.exec('COMMIT');
                return result;
            } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
        },
    };
    const env = { DATA_BACKEND: 'd1', APP_DB: db };
    const saved = (id) => sqlite.prepare('SELECT * FROM product_orders WHERE id = ?').get(id);
    const items = (id) => sqlite.prepare('SELECT * FROM product_order_items WHERE order_id = ? ORDER BY created_at, id').all(id);
    const emails = (id) => sqlite.prepare(`SELECT event_type, payload_json FROM notification_outbox
        WHERE json_extract(payload_json, '$.order_id') = ? AND audience = 'customer' ORDER BY created_at`).all(id)
        .map((row) => ({ ...row, payload: JSON.parse(row.payload_json) }));
    return { sqlite, db, env, saved, items, emails };
}

function request(path, body, admin = true) {
    return new Request(`https://thegioitrimun.vn${path}`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json', Origin: 'https://thegioitrimun.vn',
            Cookie: admin ? 'tg_session=vat-token; tg_csrf=vat-csrf' : 'tg_guest_csrf=vat-csrf',
            'X-CSRF-Token': 'vat-csrf',
        }, body: JSON.stringify(body),
    });
}

async function create(f, channel = 'online', overrides = {}) {
    const body = {
        channel, items: [1, 2, 3, 4].map((productId) => ({ productId, quantity: 1 })),
        customerName: 'Khách kiểm thử', customerPhone: '0900000000', customerEmail: 'test@example.com',
        shippingStreet: 'Địa chỉ kiểm thử', shippingWard: 'Phường kiểm thử', shippingProvince: 'Tỉnh kiểm thử',
        paymentMethod: channel === 'pos' ? 'cash' : 'cod', paymentStatus: 'unpaid',
        workflow: 'unpaid_processing',
        shippingProvider: 'spx', checkoutIdempotencyKey: 'vat-checkout', idempotencyKey: 'vat-admin-create',
        ...overrides,
    };
    const response = channel === 'pos'
        ? await createAdminOrder(request('/api/admin/orders', body), f.env)
        : await createOrder(request('/api/orders', body, false), f.env);
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    return result.order;
}

function remote(order, items, overrides = {}) {
    return {
        id: 'remote-vat', custom_id: order.order_code, status: 1,
        received_at_shop: order.order_channel === 'pos', is_from_ecommerce: order.order_channel !== 'pos',
        total_price: order.subtotal_price, total_discount: order.discount_amount,
        shipping_fee: order.shipping_fee, tax: 0,
        bill_full_name: 'Khách kiểm thử', bill_phone_number: '0900000000', bill_email: 'test@example.com',
        updated_at: '2090-01-01T01:00:00Z',
        items: items.map((item) => ({
            product_id: `product-${item.product_id}`, variation_id: `variation-${item.product_id}`,
            quantity: item.quantity,
            variation_info: { retail_price: item.price_at_purchase, name: item.product_name },
        })), ...overrides,
    };
}

async function inbound(f, snapshot) {
    const env = { ...f.env, PANCAKE_API_KEY: 'test', PANCAKE_SHOP_ID: '123' };
    const queued = await createPancakeInboundEvent(f.db, env, {
        resourceType: 'order', entity: snapshot, source: 'webhook', enqueue: false,
    });
    if (queued.duplicate) return queued;
    const result = await consumePancakeInboundMessage({
        body: { inboundEventId: queued.eventId }, ack() {},
        retry() { assert.fail('Valid VAT snapshot must not retry'); },
    }, env, { masterEnabled: true, inboundEnabled: true, inboundOrdersEnabled: true }, { config: { maxAttempts: 3 } });
    return { ...result, eventId: queued.eventId };
}

for (const taxMode of ['exclusive', 'inclusive']) {
    for (const shippingTaxable of [0, 1]) {
        test(`checkout -> Pancake zero VAT echo -> every status email keeps ${taxMode} mixed VAT, shipping=${shippingTaxable}`, async (t) => {
            const f = await fixture(t, taxMode, shippingTaxable);
            const order = await create(f);
            const initial = f.emails(order.id)[0].payload;
            assert.deepEqual(money(initial), money(order));
            // Changing today's catalog/profile must not reprice a status email.
            f.sqlite.exec('UPDATE products SET vat_rate = 0; UPDATE tax_profiles SET default_rate = 0;');
            const snapshot = remote(order, f.items(order.id));
            assert.equal((await inbound(f, snapshot)).linked, true);
            assert.deepEqual(money(f.saved(order.id)), money(order));
            assert.deepEqual(lineTaxes(f.items(order.id)), lineTaxes(initial.items));
            const repeated = await inbound(f, { ...snapshot, note: 'Metadata only' });
            assert.equal(repeated.linked, true);
            // Exercise identical checksum in a retried queued event as well as webhook dedup.
            f.sqlite.prepare("UPDATE pancake_inbound_events SET status='queued' WHERE id=?").run(repeated.eventId);
            let acked = false;
            const unchanged = await consumePancakeInboundMessage({
                body: { inboundEventId: repeated.eventId }, ack() { acked = true; }, retry() { assert.fail(); },
            }, { ...f.env, PANCAKE_API_KEY: 'test', PANCAKE_SHOP_ID: '123' },
            { masterEnabled: true, inboundEnabled: true, inboundOrdersEnabled: true }, { config: { maxAttempts: 3 } });
            assert.equal(acked, true);
            assert.equal(unchanged.unchanged, true);
            assert.equal((await inbound(f, snapshot)).duplicate, true);
            for (const status of ['shipped', 'completed', 'cancelled']) {
                const response = await updateOrderStatus(request('/api/admin/orders/status', { status }), f.env, order.id);
                assert.equal(response.status, 200, await response.clone().text());
            }
            const refunded = await refundOrder(request('/api/admin/orders/refund', { amount: 10000 }), f.env, order.id);
            assert.equal(refunded.status, 200, await refunded.clone().text());
            const emails = f.emails(order.id);
            assert.equal(emails.length, 5);
            for (const email of emails) {
                assert.deepEqual(money(email.payload), money(initial), email.event_type);
                assert.deepEqual(lineTaxes(email.payload.items), lineTaxes(initial.items), email.event_type);
                const html = renderEmail(email.event_type, email.payload, 'vi').html;
                for (const amount of [order.tax_amount, order.grand_total]) {
                    assert.ok(html.includes(new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)));
                }
            }
        });
    }
}

test('admin POS paid email from Pancake retains exactly the created VAT snapshot and item taxes', async (t) => {
    const f = await fixture(t);
    const order = await create(f, 'pos');
    const initial = f.emails(order.id)[0].payload;
    const result = await inbound(f, remote(order, f.items(order.id), { status: 3, cash: order.grand_total }));
    assert.equal(result.emailOutboxCreated, true);
    const emails = f.emails(order.id);
    assert.deepEqual(emails.map((email) => email.event_type), ['order.created', 'order.paid']);
    assert.deepEqual(money(emails[1].payload), money(initial));
    assert.deepEqual(lineTaxes(emails[1].payload.items), lineTaxes(initial.items));
    assert.deepEqual(money(f.saved(order.id)), money(order));
});

test('shipping webhook emails use the same item VAT snapshots as checkout', async (t) => {
    const f = await fixture(t, 'inclusive', 1);
    const order = await create(f);
    f.sqlite.prepare("UPDATE product_orders SET ghtk_label = 'test-label', shipping_code = 'test-label' WHERE id=?").run(order.id);
    const response = await handleWebhook(new Request('https://thegioitrimun.vn/api/ghtk/webhook?token=test-secret', {
        method: 'POST', body: JSON.stringify({ label_id: 'test-label', status_id: 4 }),
    }), { ...f.env, GHTK_ENABLED: 'true', GHTK_TOKEN: 'test', GHTK_WEBHOOK_SECRET: 'test-secret' });
    assert.equal(response.status, 200, await response.clone().text());
    const emails = f.emails(order.id);
    assert.equal(emails.length, 2);
    assert.deepEqual(money(emails[1].payload), money(emails[0].payload));
    assert.deepEqual(lineTaxes(emails[1].payload.items), lineTaxes(emails[0].payload.items));
});

test('SePay payment email retains order and line VAT without recalculation', async (t) => {
    const f = await fixture(t);
    const order = await create(f);
    f.sqlite.prepare(`UPDATE product_orders SET payment_method='bank_transfer', payment_provider='sepay', payment_reference='TGTMABCDEF123456' WHERE id=?`).run(order.id);
    f.sqlite.prepare(`INSERT OR REPLACE INTO site_content (resource, resource_key, payload_json, is_published, created_at, updated_at)
        VALUES ('payment_settings', '1', ?, 1, ?, ?)`)
        .run(JSON.stringify({ bank_code: '970436', account_number: 'test12345' }), new Date().toISOString(), new Date().toISOString());
    const response = await handleSepayWebhook(new Request('https://thegioitrimun.vn/api/payments/sepay/webhook', {
        method: 'POST', headers: { Authorization: 'Apikey test-key' },
        body: JSON.stringify({ id: 42, gateway: 'Vietcombank', transferType: 'in', accountNumber: 'test12345',
            transactionDate: '2026-09-05 12:00:00',
            transferAmount: order.grand_total, code: 'TGTMABCDEF123456', content: 'TGTMABCDEF123456', referenceCode: 'test-transaction' }),
    }), { ...f.env, SEPAY_WEBHOOK_API_KEY: 'test-key', SEPAY_ACCOUNT_NUMBER: 'test12345' });
    assert.equal(response.status, 200, await response.clone().text());
    const emails = f.emails(order.id);
    assert.equal(emails.length, 2, JSON.stringify(f.sqlite.prepare('SELECT status, reason FROM sepay_transactions').all()));
    assert.deepEqual(money(emails[1].payload), money(emails[0].payload));
    assert.deepEqual(lineTaxes(emails[1].payload.items), lineTaxes(emails[0].payload.items));
});

test('real Pancake price/quantity edits recalculate with saved rates, not a zero remote tax or current catalog', async (t) => {
    const f = await fixture(t);
    const order = await create(f);
    const snapshot = remote(order, f.items(order.id));
    snapshot.items.find((item) => item.variation_id === 'variation-4').quantity = 2;
    snapshot.total_price += 110000;
    snapshot.total_discount = 10000;
    f.sqlite.exec('UPDATE products SET vat_rate=0; UPDATE tax_profiles SET default_rate=0;');
    assert.equal((await inbound(f, snapshot)).linked, true);
    const saved = f.saved(order.id);
    assert.ok(saved.tax_amount > order.tax_amount);
    assert.equal(saved.tax_amount, f.items(order.id).reduce((sum, item) => sum + item.tax_amount, 0));
    assert.equal(saved.grand_total, saved.taxable_amount + saved.tax_amount + saved.shipping_net_amount + saved.shipping_tax_amount);
    assert.equal(f.items(order.id).find((item) => item.product_id === 4).vat_rate, 0.1);
});

test('native Pancake zero VAT is not silently changed to the website default rate', () => {
    const incoming = { subtotal_price: 100000, discount_amount: 0, tax_amount: 0, shipping_fee: 0, grand_total: 100000 };
    const result = resolvePancakeOrderTax({ tax_rate: 0.1 }, incoming, [], 0);
    assert.equal(result.financials.tax_amount, 0);
    assert.equal(result.financials.grand_total, 100000);
});

test('new unclassified items fail safely instead of silently zeroing a quoted order VAT', () => {
    const local = { tax_profile_id: 'saved-profile', tax_mode: 'exclusive', subtotal_price: 100000, shipping_fee: 30000 };
    const items = matchPancakeOrderItems([{ quantity: 1, price: 200000 }], []);
    assert.throws(() => resolvePancakeOrderTax(local, { subtotal_price: 200000, discount_amount: 0 }, items, 0), /verified VAT classification/);
});

test('email payload renders saved zero VAT honestly without inventing tax from a default rate', () => {
    const payload = buildOrderEmailPayload({ tax_amount: 0, tax_rate: 0.1, grand_total: 100000 }, []);
    assert.equal(payload.tax_amount, 0);
    assert.equal(payload.grand_total, 100000);
});

test('regression: a 979000 VND order keeps 97900 VAT and 1106900 total after the zero-tax Pancake echo', async (t) => {
    const f = await fixture(t);
    f.sqlite.prepare('UPDATE products SET price=979000 WHERE id=4').run();
    const order = await create(f, 'online', { items: [{ productId: 4, quantity: 1 }] });
    assert.equal(order.tax_amount, 97900);
    assert.equal(order.grand_total, 1106900);
    await inbound(f, remote(order, f.items(order.id)));
    assert.equal(f.saved(order.id).tax_amount, 97900);
    assert.equal(f.saved(order.id).grand_total, 1106900);
    await updateOrderStatus(request('/api/admin/orders/status', { status: 'shipped' }), f.env, order.id);
    const shipped = f.emails(order.id).find((email) => email.event_type === 'order.shipped').payload;
    assert.equal(shipped.tax_amount, 97900);
    assert.equal(shipped.grand_total, 1106900);
});
