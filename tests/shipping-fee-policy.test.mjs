import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { sha256 } from '../worker/platform/crypto.js';
import { createOrder, createAdminOrder, quoteOrderTotals, quoteAdminOrder } from '../worker/orders/handlers.js';
import { maybeHandleGhtkRoute } from '../worker/shipping/routes.js';
import { publicShippingPolicy, shippingFeeForNewOrder } from '../worker/shipping/feePolicy.js';

const migrationsDir = new URL('../d1/app/migrations/', import.meta.url);
const schema = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'));

async function fixture(t, { taxMode = 'exclusive', shippingTaxable = 0 } = {}) {
    const sqlite = new DatabaseSync(':memory:');
    t.after(() => sqlite.close());
    for (const sql of schema) sqlite.exec(sql);
    const now = new Date().toISOString();
    sqlite.prepare(`INSERT INTO products (id, slug, name, price, vat_rate, stock_quantity, is_published, created_at, updated_at)
        VALUES (1, 'shipping-test', 'Sản phẩm kiểm thử', 110000, 0.1, 100, 1, ?, ?)`).run(now, now);
    sqlite.prepare('UPDATE tax_profiles SET tax_mode = ?, applies_to_shipping = ?').run(taxMode, shippingTaxable);
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES ('shipping-admin', 'shipping-test@example.com', ?, ?)`).run(now, now);
    sqlite.prepare(`INSERT INTO user_roles (user_id, role_id, created_at)
        SELECT 'shipping-admin', id, ? FROM roles WHERE code = 'master_admin'`).run(now);
    sqlite.prepare(`INSERT INTO sessions (id, user_id, token_hash, csrf_hash, created_at, last_seen_at, expires_at)
        VALUES ('shipping-session', 'shipping-admin', ?, ?, ?, ?, '2099-01-01T00:00:00.000Z')`)
        .run(await sha256('shipping-token'), await sha256('shipping-csrf'), now, now);
    // Exercise real SQL, constraints, stock triggers and atomic batches, without network calls.
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
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        },
    };
    return { sqlite, env: { DATA_BACKEND: 'd1', APP_DB: db } };
}

function request(path, body, admin = false) {
    return new Request(`https://thegioitrimun.vn${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: 'https://thegioitrimun.vn',
            Cookie: admin ? 'tg_session=shipping-token; tg_csrf=shipping-csrf' : 'tg_guest_csrf=shipping-csrf',
            'X-CSRF-Token': 'shipping-csrf',
        },
        body: JSON.stringify(body),
    });
}

const orderInput = () => ({
    channel: 'online',
    items: [{ productId: 1, quantity: 2 }],
    customerName: 'Khách kiểm thử', customerPhone: '0900000000', customerEmail: 'shipping-test@example.com',
    shippingStreet: 'Địa chỉ kiểm thử', shippingWard: 'Phường kiểm thử', shippingProvince: 'Tỉnh kiểm thử',
    paymentMethod: 'cod', shippingProvider: 'spx',
    idempotencyKey: 'shipping-create', checkoutIdempotencyKey: 'shipping-create',
});

test('fixed customer fee is separate from carrier configuration and does not expose credentials', () => {
    assert.equal(shippingFeeForNewOrder('online'), 30000);
    assert.equal(shippingFeeForNewOrder('pos'), 0);
    assert.throws(() => shippingFeeForNewOrder('invalid'));
    const policy = publicShippingPolicy({ GHTK_ENABLED: 'true', GHTK_TOKEN: 'test-secret' });
    assert.deepEqual(policy.checkout_providers, ['spx', 'ghtk']);
    assert.equal(policy.online_fee, 30000);
    assert.equal(policy.mode, 'fixed');
    assert.ok(!JSON.stringify(policy).includes('test-secret'));
    for (const env of [{}, { GHTK_ENABLED: 'true' }, { GHTK_ENABLED: 'false', GHTK_TOKEN: 'test-secret' }]) {
        assert.deepEqual(publicShippingPolicy(env).checkout_providers, ['spx']);
    }
});

test('public shipping policy needs no D1 reads or carrier requests, and rejects writes', async () => {
    const env = { DATA_BACKEND: 'd1', APP_DB: { prepare() { throw new Error('Policy must not query D1'); } } };
    const path = '/api/shipping/policy';
    const response = await maybeHandleGhtkRoute({ env, path, request: new Request(`https://thegioitrimun.vn${path}`) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).online_fee, 30000);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
    const invalid = await maybeHandleGhtkRoute({ env, path, request: request(path, {}) });
    assert.equal(invalid.status, 405);
});

for (const fee of [undefined, 0, -1, 12000, 999999, 'not-a-number']) {
    test(`checkout and admin quotes ignore client fee ${String(fee)}`, async (t) => {
        const { env } = await fixture(t);
        // Public checkout must remain online even if the caller forges channel=pos.
        const publicResponse = await quoteOrderTotals(request('/api/checkout/quote', {
            ...orderInput(), channel: 'pos', shipping_fee: fee,
        }), env);
        const publicBody = await publicResponse.json();
        assert.equal(publicResponse.status, 200, JSON.stringify(publicBody));
        assert.equal(publicBody.quote.shipping_fee, 30000);
        for (const channel of ['online', 'pos']) {
            const response = await quoteAdminOrder(request('/api/admin/orders/quote', {
                ...orderInput(), channel, shippingFee: fee,
            }, true), env);
            const body = await response.json();
            assert.equal(response.status, 200, JSON.stringify(body));
            assert.equal(body.quote.shipping_fee, channel === 'online' ? 30000 : 0);
        }
    });
}

for (const taxMode of ['inclusive', 'exclusive']) {
    for (const shippingTaxable of [0, 1]) {
        test(`saved checkout, email and quote agree with ${taxMode} VAT, shipping taxable=${shippingTaxable}`, async (t) => {
            const { sqlite, env } = await fixture(t, { taxMode, shippingTaxable });
            const input = { ...orderInput(), shipping_fee: 0 };
            const quoted = await (await quoteOrderTotals(request('/api/checkout/quote', input), env)).json();
            const response = await createOrder(request('/api/orders', input), env);
            const body = await response.json();
            assert.equal(response.status, 201, JSON.stringify(body));
            assert.equal(body.order.shipping_fee, 30000);
            assert.equal(body.order.grand_total, quoted.quote.grand_total);
            assert.equal(body.order.grand_total, body.order.taxable_amount + body.order.tax_amount
                + body.order.shipping_net_amount + body.order.shipping_tax_amount);
            const email = JSON.parse(sqlite.prepare('SELECT payload_json FROM notification_outbox LIMIT 1').get().payload_json);
            assert.equal(email.shipping_fee, 30000);
            assert.equal(email.grand_total, body.order.grand_total);
            // Existing orders must replay their stored fee rather than acquire the new policy.
            sqlite.prepare('UPDATE product_orders SET shipping_fee = 12000 WHERE id = ?').run(body.order.id);
            const replay = await (await createOrder(request('/api/orders', { ...input, shipping_fee: 999999 }), env)).json();
            assert.equal(replay.idempotentReplay, true);
            assert.equal(replay.order.shipping_fee, 12000);
            assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM product_orders').get().n, 1);
            assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 1);
            assert.equal(sqlite.prepare('SELECT stock_quantity FROM products WHERE id = 1').get().stock_quantity, 98);
            assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_outbox').get().n, 0);
        });
    }
}

for (const channel of ['online', 'pos']) {
    test(`admin ${channel} creation and replay use server fee without booking a carrier`, async (t) => {
        const { sqlite, env } = await fixture(t);
        const input = { ...orderInput(), channel, paymentMethod: channel === 'pos' ? 'cash' : 'cod', shippingFee: 999999 };
        const quoted = await (await quoteAdminOrder(request('/api/admin/orders/quote', input, true), env)).json();
        const response = await createAdminOrder(request('/api/admin/orders', input, true), env);
        const body = await response.json();
        assert.equal(response.status, 201, JSON.stringify(body));
        assert.equal(body.order.shipping_fee, channel === 'pos' ? 0 : 30000);
        assert.equal(body.order.grand_total, quoted.quote.grand_total);
        const replay = await (await createAdminOrder(request('/api/admin/orders', input, true), env)).json();
        assert.equal(replay.idempotentReplay, true);
        assert.equal(replay.order.id, body.order.id);
        assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_outbox').get().n, 0);
    });
}

test('checkout and admin share fixed policy without address-based fee calls or an editable fee', () => {
    const checkout = readFileSync(new URL('../components/CheckoutPage.tsx', import.meta.url), 'utf8');
    const admin = readFileSync(new URL('../components/AdminOrderCreatePage.tsx', import.meta.url), 'utf8');
    assert.match(checkout, /ONLINE_SHIPPING_FEE_VND/);
    assert.doesNotMatch(checkout, /calculateShippingFee|setShippingFee|SPX_FALLBACK_FEE/);
    assert.match(admin, /shippingFeeForNewOrder\(channel\)/);
    assert.doesNotMatch(admin, /setShippingFeeInput/);
    const inbound = readFileSync(new URL('../worker/integrations/pancake/inbound.js', import.meta.url), 'utf8');
    assert.doesNotMatch(inbound, /shippingFeeForNewOrder/);
});
