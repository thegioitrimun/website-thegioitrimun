import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256 as workerSha256 } from '../worker/platform/crypto.js';

import { PancakeClient, getPancakeConfig } from '../worker/integrations/pancake/client.js';
import {
    mapCustomerToPancake,
    mapOrderToPancake,
    mapProductToPancake,
    normalizePancakePhone,
} from '../worker/integrations/pancake/mappers.js';
import {
    getEnabledPancakeEntityTypes,
    isPancakeInboundEnabled,
    isPancakeEntityEnabled,
    parsePancakeSyncSettings,
} from '../worker/integrations/pancake/settings.js';
import {
    consumePancakeInboundMessage,
    detectPancakeWebhookEntity,
    pancakeFinancials,
    remoteItems,
} from '../worker/integrations/pancake/inbound.js';

const env = {
    PANCAKE_API_KEY: 'server-secret',
    PANCAKE_SHOP_ID: '12345',
    PANCAKE_WAREHOUSE_ID: 'warehouse-01',
    PUBLIC_SITE_URL: 'https://thegioitrimun.vn',
};

function stableJsonForTest(value) {
    if (value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map(stableJsonForTest).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonForTest(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

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

test('bounded inbound polling requests only updated Pancake rows', async (t) => {
    const captured = [];
    mockFetch(t, async (url) => {
        captured.push(new URL(url));
        return new Response(JSON.stringify({ success: true, data: [], total_pages: 1 }), { status: 200 });
    });
    const client = new PancakeClient(env);
    await client.listOrdersUpdated(1_700_000_000, 1_700_000_120, 2, 25);
    await client.listCustomersUpdated(1_700_000_000, 1_700_000_120, 3, 25);

    assert.equal(captured[0].searchParams.get('updateStatus'), 'updated_at');
    assert.equal(captured[0].searchParams.get('option_sort'), 'last_updated_order_asc');
    assert.equal(captured[0].searchParams.get('page_size'), '25');
    assert.equal(captured[0].searchParams.get('page_number'), '2');
    assert.equal(captured[0].searchParams.get('startDateTime'), '1700000000');
    assert.equal(captured[1].searchParams.get('start_time_updated_at'), '1700000000');
    assert.equal(captured[1].searchParams.get('end_time_updated_at'), '1700000120');
    assert.equal(captured[1].searchParams.get('page_number'), '3');
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
        inboundEnabled: true,
        inboundOrdersEnabled: true,
        inboundCustomersEnabled: true,
        inboundPollEnabled: true,
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
    assert.equal(isPancakeInboundEnabled(childrenOn, 'order'), false);

    const allOn = { ...childrenOn, masterEnabled: true };
    assert.deepEqual(getEnabledPancakeEntityTypes(allOn), [
        'product',
        'inventory',
        'customer',
        'order',
    ]);
    assert.equal(isPancakeInboundEnabled(allOn, 'order'), true);
    assert.equal(isPancakeInboundEnabled(allOn, 'customer'), true);
});

test('webhook detector accepts order and customer payload variants without inventing an entity', () => {
    assert.deepEqual(detectPancakeWebhookEntity({
        event: 'order.updated',
        data: { id: 987, received_at_shop: true, items: [] },
    }), {
        resourceType: 'order',
        entity: { id: 987, received_at_shop: true, items: [] },
    });
    assert.deepEqual(detectPancakeWebhookEntity({
        type: 'customer.updated',
        customer: { id: 'customer-1', phone_numbers: ['0912345678'] },
    }), {
        resourceType: 'customer',
        entity: { id: 'customer-1', phone_numbers: ['0912345678'] },
    });
    assert.equal(detectPancakeWebhookEntity({ event: 'inventory.updated', data: { id: 1 } }), null);
});

test('order webhook detector never mistakes the nested customer ID for the order ID', () => {
    const order = {
        type: 'orders',
        id: 'order-987',
        status: 1,
        items: [],
        customer: { id: 'customer-123', phone_numbers: ['0912345678'] },
    };
    assert.deepEqual(detectPancakeWebhookEntity(order), {
        resourceType: 'order',
        entity: order,
    });
});

test('Pancake item discounts become order discounts without treating COD balance as order total', () => {
    const order = {
        total_price: 1_340_000,
        total_price_after_sub_discount: 1_280_000,
        total_discount: 0,
        money_to_collect: 900_000,
        tax: 0,
        items: [
            {
                variation_id: 'variation-1', quantity: 1, discount_each_product: 20_000,
                total_discount: 20_000, variation_info: { retail_price: 300_000 },
            },
            {
                variation_id: 'variation-2', quantity: 1, discount_each_product: 40_000,
                total_discount: 40_000, variation_info: { retail_price: 1_040_000 },
            },
        ],
    };
    const items = remoteItems(order);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0);

    assert.equal(itemDiscount, 60_000);
    assert.deepEqual(pancakeFinancials(order, 'pos', subtotal, itemDiscount), {
        subtotal_price: 1_340_000,
        discount_amount: 60_000,
        tax_amount: 0,
        shipping_fee: 0,
        grand_total: 1_280_000,
    });
});

test('inbound POS event creates a local guest order without requiring a website account or catalog match', async () => {
    const event = {
        id: 'event-1',
        resource_type: 'order',
        remote_id: '987',
        status: 'queued',
        attempts: 0,
        receipt_id: null,
        payload_json: JSON.stringify({
            id: 987,
            display_id: 987,
            inserted_at: '2026-08-25T01:00:00Z',
            updated_at: '2026-08-25T01:01:00Z',
            received_at_shop: true,
            is_from_ecommerce: false,
            status: 3,
            cash: 150000,
            total_price: 150000,
            customer: { phone_numbers: [], emails: [] },
            bill_full_name: 'Khách tại quầy',
            bill_phone_number: '0912345678',
            bill_email: 'pos@example.com',
            items: [{
                product_id: 'remote-product',
                variation_id: 'remote-variation',
                quantity: 1,
                variation_info: { id: 'remote-variation', product_id: 'remote-product', name: 'Gel POS', retail_price: 150000 },
            }],
        }),
    };
    const preparedSql = [];
    const boundStatements = [];
    const placeholderCount = (sql) => [...sql].filter((character) => character === '?').length;
    const prepare = (sql) => {
        preparedSql.push(sql);
        const statement = {
            params: [],
            bind(...params) {
                const bound = Object.create(statement);
                bound.params = params;
                boundStatements.push({ sql, params });
                return bound;
            },
            async first() {
                assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                if (sql.includes('FROM pancake_inbound_events WHERE id')) return event;
                return null;
            },
            async all() {
                assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                return { results: [] };
            },
            async run() {
                assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                return { meta: { changes: 1 } };
            },
        };
        return statement;
    };
    const db = {
        prepare,
        async batch(statements) {
            for (const statement of statements) await statement.run();
            return statements.map(() => ({ meta: { changes: 1 } }));
        },
    };
    let acknowledged = false;
    const message = {
        body: { kind: 'pancake', inboundEventId: event.id },
        ack() { acknowledged = true; },
        retry() { throw new Error('The valid POS event must not retry.'); },
    };
    const settings = {
        masterEnabled: true,
        inboundEnabled: true,
        inboundOrdersEnabled: true,
        inboundCustomersEnabled: true,
    };
    const client = { config: { maxAttempts: 3 } };
    const result = await consumePancakeInboundMessage(message, {
        APP_DB: db,
        PANCAKE_API_KEY: 'server-secret',
        PANCAKE_SHOP_ID: '12345',
        TELEGRAM_ORDER_ALERTS_ENABLED: 'true',
        DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
    }, settings, client);

    assert.equal(acknowledged, true);
    assert.equal(result.imported, true);
    assert.equal(result.channel, 'pos');
    assert.equal(result.partial, true);
    assert.equal(result.telegramOutboxCreated, true);
    assert.equal(result.emailOutboxCreated, true);
    assert.equal(result.zaloJobCreated, true);
    assert.ok(preparedSql.some((sql) => sql.includes('INSERT INTO product_orders')));
    assert.ok(preparedSql.some((sql) => sql.includes("source_system, created_at")));
    const telegram = boundStatements.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO telegram_order_outbox'));
    assert.ok(telegram);
    assert.equal(telegram.params[1], 'pancake.order.created');
    assert.equal(telegram.params[3], 'telegram/pancake.order.created/987');
    const telegramPayload = JSON.parse(telegram.params[4]);
    assert.equal(telegramPayload.channel_label, 'Pancake POS');
    assert.equal(telegramPayload.pancake_order_id, '987');
    assert.equal(telegramPayload.items[0].name, 'Gel POS');
    assert.equal(telegramPayload.total, 150000);
    const email = boundStatements.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO notification_outbox'));
    assert.ok(email);
    assert.equal(email.params[1], 'order.created');
    assert.equal(email.params[5], 'pos@example.com');
    assert.match(email.params[8], /^customer\/order\.created\//);
    assert.equal(JSON.parse(email.params[7]).payment_status, 'paid');
    const zalo = boundStatements.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO deplao_automation_jobs'));
    assert.ok(zalo);
    assert.equal(zalo.params[1], 'order.created');
    assert.match(zalo.params[4], /^deplao\/order\.created\//);
    assert.equal(boundStatements.some(({ params }) => params.includes('order.paid')), false);
    assert.ok(preparedSql.every((sql) => !sql.includes('INSERT INTO users')));
    assert.ok(preparedSql.every((sql) => !sql.includes('pancake_sync_outbox')));
});

test('one Pancake snapshot coalesces status and payment transitions into one Telegram alert', async () => {
    const previousRemote = {
        id: 987,
        updated_at: '2026-08-25T01:01:00Z',
        received_at_shop: true,
        is_from_ecommerce: false,
        status: 1,
        cash: 0,
        total_price: 120000,
        bill_full_name: 'Khách tại quầy',
        bill_phone_number: '0912345678',
        bill_email: 'pos@example.com',
        items: [{
            product_id: 'remote-product', variation_id: 'remote-variation', quantity: 1,
            variation_info: { id: 'remote-variation', product_id: 'remote-product', name: 'Gel POS', retail_price: 150000 },
        }],
    };
    const nextRemote = {
        ...previousRemote, updated_at: '2026-08-25T01:03:00Z', status: 3, cash: 150000, total_price: 150000,
    };
    const event = {
        id: 'event-change', resource_type: 'order', remote_id: '987', status: 'queued', attempts: 0,
        receipt_id: null, payload_json: JSON.stringify(nextRemote),
    };
    const localOrder = {
        id: 'local-order', order_code: 'PC-987', customer_name: 'Khách tại quầy', customer_phone: '0912345678',
        customer_email: 'pos@example.com', status: 'processing', payment_method: 'cash', payment_status: 'unpaid',
        subtotal_price: 120000, discount_amount: 0, tax_amount: 0, shipping_fee: 0,
        grand_total: 120000, total_price: 120000, currency: 'VND', created_at: '2026-08-25T01:00:00Z',
    };
    const boundStatements = [];
    const placeholderCount = (sql) => [...sql].filter((character) => character === '?').length;
    const db = {
        prepare(sql) {
            const statement = {
                params: [],
                bind(...params) {
                    const bound = Object.create(statement);
                    bound.params = params;
                    boundStatements.push({ sql, params });
                    return bound;
                },
                async first() {
                    assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                    if (sql.includes('FROM pancake_inbound_events WHERE id')) return event;
                    if (sql.includes('FROM pancake_inbound_orders WHERE pancake_order_id')) {
                        return {
                            pancake_order_id: '987', local_order_id: localOrder.id,
                            pancake_updated_at: previousRemote.updated_at, payload_checksum: 'previous-checksum',
                            raw_json: JSON.stringify(previousRemote), first_seen_at: previousRemote.updated_at,
                            created_at: previousRemote.updated_at,
                        };
                    }
                    if (sql.includes("entity_type = 'order' AND pancake_entity_id")) {
                        return { local_entity_id: localOrder.id, pancake_entity_id: '987' };
                    }
                    if (sql.includes('FROM product_orders WHERE id')) return localOrder;
                    return null;
                },
                async all() {
                    assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                    if (sql.includes("entity_type = 'product' AND pancake_variation_id")) {
                        return { results: [{
                            local_entity_id: '42',
                            pancake_entity_id: 'remote-product',
                            pancake_variation_id: 'remote-variation',
                        }] };
                    }
                    if (sql.includes('FROM product_order_items WHERE order_id')) {
                        return { results: [{
                            id: 'local-line', order_id: localOrder.id, product_id: 42,
                            product_name: 'Gel POS', product_sku: null, product_image_path: null,
                            quantity: 1, price_at_purchase: 120000, vat_rate: 0, tax_amount: 0,
                            external_product_id: 'remote-product', external_variation_id: 'remote-variation',
                            source_system: 'pancake', created_at: previousRemote.updated_at,
                        }] };
                    }
                    return { results: [] };
                },
                async run() {
                    assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                    return { meta: { changes: 1 } };
                },
            };
            return statement;
        },
        async batch(statements) {
            for (const statement of statements) await statement.run();
            return statements.map(() => ({ meta: { changes: 1 } }));
        },
    };
    const message = {
        body: { kind: 'pancake', inboundEventId: event.id },
        ack() {},
        retry() { throw new Error('The valid transition must not retry.'); },
    };
    const result = await consumePancakeInboundMessage(message, {
        APP_DB: db,
        PANCAKE_API_KEY: 'server-secret',
        PANCAKE_SHOP_ID: '12345',
        TELEGRAM_ORDER_ALERTS_ENABLED: 'true',
        DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
    }, {
        masterEnabled: true, inboundEnabled: true, inboundOrdersEnabled: true, inboundCustomersEnabled: true,
    }, { config: { maxAttempts: 3 } });

    assert.equal(result.linked, true);
    assert.equal(result.telegramOutboxCreated, true);
    assert.equal(result.emailOutboxCreated, true);
    assert.equal(result.zaloJobCreated, true);
    assert.deepEqual(result.changes.map((change) => change.field), [
        'status', 'payment_status', 'subtotal_price', 'grand_total',
    ]);
    const telegramRows = boundStatements.filter(({ sql }) => sql.includes('INSERT OR IGNORE INTO telegram_order_outbox'));
    assert.equal(telegramRows.length, 1);
    assert.equal(telegramRows[0].params[1], 'pancake.order.changed');
    assert.match(telegramRows[0].params[3], /^telegram\/pancake\.order\.changed\/987\/[A-Za-z0-9_-]{43}$/);
    const payload = JSON.parse(telegramRows[0].params[4]);
    assert.equal(payload.payment_status, 'paid');
    assert.deepEqual(payload.changes.map((change) => change.field), [
        'status', 'payment_status', 'subtotal_price', 'grand_total',
    ]);
    const paidEmails = boundStatements.filter(({ sql, params }) => (
        sql.includes('INSERT OR IGNORE INTO notification_outbox') && params[1] === 'order.paid'
    ));
    const paidZaloJobs = boundStatements.filter(({ sql, params }) => (
        sql.includes('INSERT OR IGNORE INTO deplao_automation_jobs') && params[1] === 'order.paid'
    ));
    assert.equal(paidEmails.length, 1);
    assert.equal(paidEmails[0].params[8], 'customer/order.paid/local-order');
    assert.equal(paidZaloJobs.length, 1);
    assert.equal(paidZaloJobs[0].params[4], 'deplao/order.paid/local-order');
    const orderUpdate = boundStatements.find(({ sql }) => sql.includes('UPDATE product_orders SET'));
    assert.ok(orderUpdate);
    assert.match(orderUpdate.sql, /shipping_street = CASE/);
    assert.match(orderUpdate.sql, /subtotal_price = \?/);
    assert.match(orderUpdate.sql, /grand_total = \?/);
    assert.ok(boundStatements.some(({ sql, params }) => (
        sql.includes('DELETE FROM product_order_items') && params[0] === localOrder.id
    )));
    const refreshedLine = boundStatements.find(({ sql }) => sql.includes('INSERT INTO product_order_items'));
    assert.ok(refreshedLine);
    assert.equal(refreshedLine.params[0], 'local-line');
    assert.equal(refreshedLine.params[2], 42);
    assert.equal(refreshedLine.params[6], 1);
    assert.equal(refreshedLine.params[7], 150000);
});

test('an already imported Pancake checksum is acknowledged without a duplicate Telegram alert', async () => {
    const remote = {
        id: 987, updated_at: '2026-08-25T01:03:00Z', received_at_shop: true,
        is_from_ecommerce: false, status: 3, cash: 150000, total_price: 150000, items: [],
    };
    const checksum = await workerSha256(stableJsonForTest(remote));
    const event = {
        id: 'event-duplicate', resource_type: 'order', remote_id: '987', status: 'queued', attempts: 0,
        receipt_id: null, payload_json: JSON.stringify(remote),
    };
    const preparedSql = [];
    const placeholderCount = (sql) => [...sql].filter((character) => character === '?').length;
    const db = {
        prepare(sql) {
            preparedSql.push(sql);
            const statement = {
                params: [],
                bind(...params) { const bound = Object.create(statement); bound.params = params; return bound; },
                async first() {
                    assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                    if (sql.includes('FROM pancake_inbound_events WHERE id')) return event;
                    if (sql.includes('FROM pancake_inbound_orders WHERE pancake_order_id')) {
                        return { local_order_id: 'local-order', payload_checksum: checksum };
                    }
                    if (sql.includes('FROM product_orders o WHERE o.id')) {
                        return {
                            status: 'completed', payment_method: 'cash', payment_status: 'paid',
                            order_channel: 'pos', subtotal_price: 150000, discount_amount: 0,
                            tax_amount: 0, shipping_fee: 0, grand_total: 150000, item_count: 0,
                        };
                    }
                    return null;
                },
                async all() { return { results: [] }; },
                async run() {
                    assert.equal(this.params.length, placeholderCount(sql), `Unexpected bind count for ${sql}`);
                    return { meta: { changes: 1 } };
                },
            };
            return statement;
        },
    };
    let acknowledged = false;
    const result = await consumePancakeInboundMessage({
        body: { kind: 'pancake', inboundEventId: event.id },
        ack() { acknowledged = true; },
        retry() { throw new Error('A duplicate snapshot must not retry.'); },
    }, {
        APP_DB: db,
        PANCAKE_API_KEY: 'server-secret',
        PANCAKE_SHOP_ID: '12345',
        TELEGRAM_ORDER_ALERTS_ENABLED: 'true',
    }, {
        masterEnabled: true, inboundEnabled: true, inboundOrdersEnabled: true, inboundCustomersEnabled: true,
    }, { config: { maxAttempts: 3 } });

    assert.equal(acknowledged, true);
    assert.equal(result.unchanged, true);
    assert.ok(preparedSql.every((sql) => !sql.includes('telegram_order_outbox')));
    assert.ok(preparedSql.every((sql) => !sql.includes('notification_outbox')));
    assert.ok(preparedSql.every((sql) => !sql.includes('deplao_automation_jobs')));
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

test('POS cash orders are counter orders and never masquerade as ecommerce COD', () => {
    const productLinks = new Map([['42', {
        pancake_entity_id: 'product-42',
        pancake_variation_id: 'variation-42',
    }]]);
    const payload = mapOrderToPancake({
        id: 'pos-local-1',
        order_code: 'POS0001',
        order_channel: 'pos',
        customer_name: 'Khách lẻ',
        customer_phone: '0912345678',
        shipping_street: '',
        shipping_ward: '',
        shipping_district: '',
        shipping_province: '',
        shipping_fee: 0,
        subtotal_price: 145000,
        discount_amount: 0,
        tax_amount: 0,
        shipping_tax_amount: 0,
        grand_total: 145000,
        payment_method: 'cash',
        payment_status: 'paid',
        status: 'completed',
        currency: 'VND',
        order_items: [{
            product_id: 42,
            product_name: 'Gel trị mụn',
            quantity: 1,
            price_at_purchase: 145000,
        }],
    }, productLinks, 'customer-1', env);

    assert.equal(payload.received_at_shop, true);
    assert.equal(payload.is_from_ecommerce, false);
    assert.equal('cod' in payload, false);
    assert.equal('transfer_money' in payload, false);
});

test('repository contract keeps Pancake bidirectional, bounded, idempotent and Queue-backed', async () => {
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
        inbound,
        inboundMigration,
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
        fs.readFile(new URL('worker/integrations/pancake/inbound.js', root), 'utf8'),
        fs.readFile(new URL('d1/app/migrations/0020_pancake_bidirectional_sync.sql', root), 'utf8'),
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
    assert.match(orderHandlers, /dispatchPendingPancakeSyncBestEffort/);
    assert.match(routes, /\/api\/admin\/integrations\/pancake\/settings/);
    assert.match(routes, /\/api\/webhooks\/pancake/);
    assert.match(routes, /X-Pancake-Webhook-Secret/);
    assert.match(routes, /INSERT OR IGNORE INTO webhook_receipts/);
    assert.match(routes, /reverseSynchronization: true/);
    assert.doesNotMatch(routes, /webhook_disabled/);
    assert.match(routes, /processingEnabled: Boolean/);
    assert.match(routes, /\/api\/admin\/integrations\/pancake\/inbound\/poll/);
    assert.doesNotMatch(routes, /pauseStatements/);
    assert.match(outbox, /status IN \('pending', 'paused', 'retrying'\)/);
    assert.match(outbox, /ORDER BY created_at LIMIT \?/);
    assert.match(adminPage, /Đồng bộ toàn hệ thống/);
    assert.match(adminPage, /title: 'Kho hàng'/);
    assert.match(adminPage, /Webhook chưa cấu hình/);
    assert.doesNotMatch(adminPage, /PANCAKE_API_KEY/);
    assert.match(api, /updatePancakeSyncSettings/);
    assert.match(api, /syncInventoryToPancake/);
    assert.match(api, /pollPancakeInbound/);
    assert.match(worker, /pollPancakeInbound/);
    assert.match(outbox, /consumePancakeInboundMessage/);
    assert.match(inbound, /listOrdersUpdated/);
    assert.match(inbound, /listCustomersUpdated/);
    assert.match(inbound, /pancake-inbound:/);
    assert.match(inbound, /INSERT OR IGNORE INTO pancake_inbound_events/);
    assert.doesNotMatch(inbound, /createPancakeOrderOutboxStatement/);
    assert.match(inboundMigration, /CREATE TABLE pancake_customers/);
    assert.match(inboundMigration, /CREATE TABLE pancake_inbound_events/);
    assert.match(inboundMigration, /CREATE TABLE pancake_inbound_cursors/);
    assert.match(inboundMigration, /external_variation_id/);
    assert.match(adminPage, /Website ↔ Pancake/);
    assert.match(adminPage, /Đồng bộ ngược ngay/);
});
