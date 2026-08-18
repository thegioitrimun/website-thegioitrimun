import assert from 'node:assert/strict';
import test from 'node:test';

import { PancakeClient, getPancakeConfig } from '../worker/integrations/pancake/client.js';
import {
    mapCustomerToPancake,
    mapOrderToPancake,
    mapProductToPancake,
    normalizePancakePhone,
} from '../worker/integrations/pancake/mappers.js';
import {
    getEnabledPancakeEntityTypes,
    isPancakeEntityEnabled,
    parsePancakeSyncSettings,
} from '../worker/integrations/pancake/settings.js';

const env = {
    PANCAKE_API_KEY: 'server-secret',
    PANCAKE_SHOP_ID: '12345',
    PANCAKE_WAREHOUSE_ID: 'warehouse-01',
    PUBLIC_SITE_URL: 'https://thegioitrimun.vn',
};

function mockFetch(t, handler) {
    const original = globalThis.fetch;
    globalThis.fetch = handler;
    t.after(() => { globalThis.fetch = original; });
}

test('Pancake stays disabled until API key and shop ID are both server-configured', () => {
    assert.equal(getPancakeConfig({}).enabled, false);
    assert.equal(getPancakeConfig({ PANCAKE_API_KEY: 'key' }).enabled, false);
    assert.equal(getPancakeConfig(env).enabled, true);
    assert.equal(getPancakeConfig({ ...env, PANCAKE_ENABLED: 'false' }).enabled, false);
});

test('client authenticates by api_key query and wraps Pancake product payload', async (t) => {
    let captured;
    mockFetch(t, async (url, init) => {
        captured = { url: new URL(url), init, body: JSON.parse(init.body) };
        return new Response(JSON.stringify({ success: true, data: { id: 'p-1' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    });
    const client = new PancakeClient(env);
    await client.createProduct({ name: 'Sản phẩm', weight: 100 });

    assert.equal(captured.url.origin, 'https://pos.pages.fm');
    assert.equal(captured.url.pathname, '/api/v1/shops/12345/products');
    assert.equal(captured.url.searchParams.get('api_key'), 'server-secret');
    assert.deepEqual(captured.body, { product: { name: 'Sản phẩm', weight: 100 } });
});

test('client sends inventory through the documented variation quantity endpoint', async (t) => {
    let captured;
    mockFetch(t, async (url, init) => {
        captured = { url: new URL(url), body: JSON.parse(init.body) };
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    const client = new PancakeClient(env);
    await client.updateVariationQuantity('variation-9', 17);

    assert.equal(captured.url.pathname, '/api/v1/shops/12345/variations/variation-9/update_quantity');
    assert.deepEqual(captured.body, {
        variations_warehouses: [{ warehouse_id: 'warehouse-01', remain_quantity: 17 }],
    });
});

test('client normalizes Pancake semantic product-not-found responses', async (t) => {
    mockFetch(t, async () => new Response(JSON.stringify({ success: false, message: 'Product not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));
    await assert.rejects(
        () => new PancakeClient(env).getProductBySku('TGTM-42'),
        (error) => error?.name === 'PancakeApiError'
            && error.status === 404
            && error.code === 'PANCAKE_NOT_FOUND'
            && error.retryable === false,
    );
});

test('array query parameters preserve Pancake bracket notation', async (t) => {
    let capturedUrl;
    mockFetch(t, async (url) => {
        capturedUrl = new URL(url);
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    });
    await new PancakeClient(env).listOrders('WEB-ORDER-1');
    assert.deepEqual(capturedUrl.searchParams.getAll('extra_fields[]'), ['custom_id']);
});

test('product mapper preserves website identity, price and image without mixing inventory', () => {
    const payload = mapProductToPancake({
        id: 42,
        sku: 'TGTM-42',
        name: 'Gel trị mụn',
        description: 'Mô tả',
        price: 145000,
        stock_quantity: 12,
        is_published: 1,
        volume: '30ml',
        brand: 'Glenmark',
        images: [
            { image_path: '/r2/product-images/secondary.webp', is_primary: 0, display_order: 2 },
            { image_path: '/r2/product-images/primary.webp', is_primary: 1, display_order: 1 },
        ],
    }, env);
    assert.equal(payload.custom_id, 'TGTM-42');
    assert.equal(payload.variations[0].custom_id, 'TGTM-42');
    assert.equal(payload.variations[0].retail_price, 145000);
    assert.equal(payload.variations[0].weight, 30);
    assert.equal(payload.variations[0].images[0], 'https://thegioitrimun.vn/r2/product-images/primary.webp');
    assert.equal(payload.variations[0].variations_warehouses, undefined);
});

test('Pancake sync settings default to off and master switch gates every entity', () => {
    const defaults = parsePancakeSyncSettings(null);
    assert.deepEqual(defaults, {
        masterEnabled: false,
        productsEnabled: false,
        inventoryEnabled: false,
        customersEnabled: false,
        ordersEnabled: false,
        updatedBy: null,
        updatedAt: null,
    });
    assert.deepEqual(getEnabledPancakeEntityTypes(defaults), []);

    const childrenOn = parsePancakeSyncSettings({
        master_enabled: 0,
        products_enabled: 1,
        inventory_enabled: 1,
        customers_enabled: 1,
        orders_enabled: 1,
    });
    assert.equal(isPancakeEntityEnabled(childrenOn, 'product'), false);
    assert.deepEqual(getEnabledPancakeEntityTypes(childrenOn), []);

    const allOn = { ...childrenOn, masterEnabled: true };
    assert.deepEqual(getEnabledPancakeEntityTypes(allOn), [
        'product',
        'inventory',
        'customer',
        'order',
    ]);
});

test('product mapper includes the product-images bucket for database-relative image paths', () => {
    const payload = mapProductToPancake({
        id: 43,
        sku: 'TGTM-43',
        name: 'Sản phẩm có ảnh R2',
        price: 100000,
        stock_quantity: 3,
        is_published: 1,
        images: [{ image_path: 'products/example/gallery.webp', is_primary: 1, display_order: 1 }],
    }, env);
    assert.equal(payload.variations[0].images[0], 'https://thegioitrimun.vn/r2/product-images/products/example/gallery.webp');
});

test('customer mapper normalizes Vietnamese phone and keeps email on update', () => {
    const order = {
        customer_name: 'Nguyễn Văn A',
        customer_phone: '+84 912 345 678',
        customer_email: 'a@example.com',
        shipping_street: '1 Đường A',
        shipping_ward: 'Phường B',
        shipping_district: 'Quận C',
        shipping_province: 'TP HCM',
    };
    assert.equal(normalizePancakePhone(order.customer_phone), '0912345678');
    assert.equal(mapCustomerToPancake(order).phoneNumber, '0912345678');
    assert.deepEqual(mapCustomerToPancake(order, { forUpdate: true }).emails, ['a@example.com']);
});

test('order mapper sends tax snapshot and linked Pancake variations', () => {
    const productLinks = new Map([['42', {
        pancake_entity_id: 'product-42',
        pancake_variation_id: 'variation-42',
    }]]);
    const payload = mapOrderToPancake({
        id: 'order-local-1',
        order_code: 'DH0001',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0912345678',
        customer_email: 'a@example.com',
        shipping_street: '1 Đường A',
        shipping_ward: 'Phường B',
        shipping_district: 'Quận C',
        shipping_province: 'TP HCM',
        shipping_fee: 30000,
        subtotal_price: 145000,
        discount_amount: 5000,
        tax_amount: 11600,
        shipping_tax_amount: 2400,
        grand_total: 184000,
        payment_method: 'cod',
        status: 'processing',
        currency: 'VND',
        order_items: [{
            product_id: 42,
            product_name: 'Gel trị mụn',
            product_image_path: '/r2/product-images/primary.webp',
            quantity: 1,
            price_at_purchase: 145000,
        }],
    }, productLinks, 'customer-1', env);

    assert.equal(payload.custom_id, 'DH0001');
    assert.equal(payload.status, 1);
    assert.equal(payload.tax, 14000);
    assert.equal(payload.customer_pay_fee, true);
    assert.equal(payload.is_from_ecommerce, true);
    assert.equal(payload.items[0].variation_id, 'variation-42');
    assert.equal(payload.items[0].variation_info.retail_price, 145000);
    assert.equal(payload.cod, 184000);
});

test('repository contract keeps Pancake one-way, configurable, Queue-backed and connected to mutations', async () => {
    const fs = await import('node:fs/promises');
    const root = new URL('../', import.meta.url);
    const [
        worker,
        routes,
        outbox,
        productHandlers,
        orderHandlers,
        staging,
        production,
        migration,
        settings,
        adminPage,
        api,
    ] = await Promise.all([
        fs.readFile(new URL('_worker.js', root), 'utf8'),
        fs.readFile(new URL('worker/integrations/pancake/routes.js', root), 'utf8'),
        fs.readFile(new URL('worker/integrations/pancake/outbox.js', root), 'utf8'),
        fs.readFile(new URL('worker/adminD1/handlers.js', root), 'utf8'),
        fs.readFile(new URL('worker/orders/handlers.js', root), 'utf8'),
        fs.readFile(new URL('wrangler.d1.staging.jsonc', root), 'utf8'),
        fs.readFile(new URL('wrangler.d1.production.jsonc', root), 'utf8'),
        fs.readFile(new URL('d1/app/migrations/0016_pancake_sync_settings.sql', root), 'utf8'),
        fs.readFile(new URL('worker/integrations/pancake/settings.js', root), 'utf8'),
        fs.readFile(new URL('components/AdminPancakeManagementPage.tsx', root), 'utf8'),
        fs.readFile(new URL('services/api.ts', root), 'utf8'),
    ]);
    assert.match(worker, /consumePancakeQueue/);
    assert.match(worker, /dispatchPendingPancakeSync/);
    assert.match(staging, /"binding": "PANCAKE_QUEUE"/);
    assert.match(production, /"binding": "PANCAKE_QUEUE"/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS pancake_sync_settings/);
    assert.match(migration, /inventory/);
    assert.match(migration, /paused/);
    assert.match(migration, /INSERT OR IGNORE INTO pancake_sync_settings \(id\) VALUES \(1\)/);
    assert.equal((migration.match(/enabled INTEGER NOT NULL DEFAULT 0/g) || []).length, 5);
    assert.match(settings, /masterEnabled: false/);
    assert.match(settings, /inventoryEnabled: false/);
    assert.match(productHandlers, /createPancakeProductOutboxStatement/);
    assert.match(productHandlers, /createPancakeInventoryOutboxStatement/);
    assert.match(orderHandlers, /createPancakeCustomerOutboxStatement/);
    assert.match(orderHandlers, /createPancakeOrderOutboxStatement/);
    assert.match(routes, /\/api\/admin\/integrations\/pancake\/settings/);
    assert.match(routes, /\/api\/webhooks\/pancake/);
    assert.match(routes, /X-Pancake-Webhook-Secret/);
    assert.match(routes, /INSERT OR IGNORE INTO webhook_receipts/);
    assert.match(routes, /reverseSynchronization: false/);
    assert.doesNotMatch(routes, /webhook_disabled/);
    assert.match(routes, /processingEnabled: false/);
    assert.doesNotMatch(routes, /pauseStatements/);
    assert.match(outbox, /status IN \('pending', 'paused', 'retrying'\)/);
    assert.match(outbox, /ORDER BY created_at LIMIT \?/);
    assert.match(adminPage, /Đồng bộ toàn hệ thống/);
    assert.match(adminPage, /title: 'Kho hàng'/);
    assert.match(adminPage, /Webhook chưa cấu hình/);
    assert.doesNotMatch(adminPage, /PANCAKE_API_KEY/);
    assert.match(api, /updatePancakeSyncSettings/);
    assert.match(api, /syncInventoryToPancake/);
});
