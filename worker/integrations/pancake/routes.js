import { requireCsrf, requireRole } from '../../auth/session.js';
import { randomId, sha256, timingSafeEqual } from '../../platform/crypto.js';
import { apiError, json, methodNotAllowed, readJson, requireD1 } from '../../platform/http.js';
import { recordAdminAuditAttempt } from '../../adminD1/support.js';
import { getPancakeConfig, PancakeClient } from './client.js';
import {
    createPancakeInboundEvent,
    detectPancakeWebhookEntity,
    dispatchPendingPancakeInbound,
    pollPancakeInbound,
} from './inbound.js';
import { normalizePancakePhone } from './mappers.js';
import {
    createPancakeCustomerOutboxStatement,
    createPancakeInventoryOutboxStatement,
    createPancakeOrderOutboxStatement,
    createPancakeProductOutboxStatement,
    dispatchPendingPancakeSync,
} from './outbox.js';
import {
    getPancakeSyncSettings,
    isPancakeInboundEnabled,
    isPancakeEntityEnabled,
    PANCAKE_SYNC_SETTING_KEYS,
} from './settings.js';

function boundedInteger(value, fallback, min, max) {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

async function authorize(request, env, write = false) {
    const db = requireD1(env);
    const session = await requireRole(db, request, ['admin', 'master_admin']);
    if (write) {
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
    }
    return { db, session };
}

async function insertInChunks(db, statements, chunkSize = 75) {
    let inserted = 0;
    for (let offset = 0; offset < statements.length; offset += chunkSize) {
        const results = await db.batch(statements.slice(offset, offset + chunkSize));
        inserted += results.reduce((total, result) => total + Number(result?.meta?.changes || 0), 0);
    }
    return inserted;
}

const SETTINGS_COLUMN_BY_KEY = Object.freeze({
    masterEnabled: 'master_enabled',
    productsEnabled: 'products_enabled',
    inventoryEnabled: 'inventory_enabled',
    customersEnabled: 'customers_enabled',
    ordersEnabled: 'orders_enabled',
    inboundEnabled: 'inbound_enabled',
    inboundOrdersEnabled: 'inbound_orders_enabled',
    inboundCustomersEnabled: 'inbound_customers_enabled',
    inboundPollEnabled: 'inbound_poll_enabled',
});

const ENTITY_TYPES = Object.freeze(['product', 'inventory', 'customer', 'order']);

function requireSyncEnabled(settings, entityType, label) {
    if (!isPancakeEntityEnabled(settings, entityType)) {
        throw Object.assign(new Error(`Pancake ${label} synchronization is disabled.`), { status: 409 });
    }
}

function publicConfig(env) {
    const config = getPancakeConfig(env);
    return {
        enabled: config.enabled,
        apiKeyConfigured: Boolean(config.apiKey),
        shopConfigured: Boolean(config.shopId),
        warehouseConfigured: Boolean(config.warehouseId),
        shopId: config.shopId || null,
        warehouseId: config.warehouseId || null,
        queueConfigured: Boolean(env.PANCAKE_QUEUE),
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        maxAttempts: config.maxAttempts,
        direction: 'bidirectional',
        sourceOfTruth: 'shared_by_origin',
        resources: ['products', 'inventory', 'customers', 'orders', 'order_tax_snapshot', 'pancake_pos_orders'],
    };
}

async function integrationStatus(request, env) {
    try {
        const { db } = await authorize(request, env);
        const [settings, outbox, links, lastCompleted, lastError, inboundEvents, inboundCursors, inboundLastError] = await Promise.all([
            getPancakeSyncSettings(db),
            db.prepare(`SELECT entity_type, status, COUNT(*) AS count
                FROM pancake_sync_outbox GROUP BY entity_type, status ORDER BY entity_type, status`).all(),
            db.prepare(`SELECT entity_type, sync_status, COUNT(*) AS count, MAX(last_synced_at) AS last_synced_at
                FROM pancake_entity_links GROUP BY entity_type, sync_status ORDER BY entity_type, sync_status`).all(),
            db.prepare(`SELECT entity_type, entity_id, completed_at
                FROM pancake_sync_outbox WHERE status = 'completed'
                ORDER BY completed_at DESC LIMIT 1`).first(),
            db.prepare(`SELECT entity_type, entity_id, status, last_error, updated_at
                FROM pancake_sync_outbox
                WHERE last_error IS NOT NULL AND TRIM(last_error) <> ''
                ORDER BY updated_at DESC LIMIT 1`).first(),
            db.prepare(`SELECT resource_type, status, COUNT(*) AS count
                FROM pancake_inbound_events GROUP BY resource_type, status ORDER BY resource_type, status`).all(),
            db.prepare(`SELECT resource_type, cursor_timestamp, window_end_at, next_page,
                    last_polled_at, consecutive_failures, last_error
                FROM pancake_inbound_cursors ORDER BY resource_type`).all(),
            db.prepare(`SELECT resource_type, remote_id, status, last_error, updated_at
                FROM pancake_inbound_events
                WHERE last_error IS NOT NULL AND TRIM(last_error) <> ''
                ORDER BY updated_at DESC LIMIT 1`).first(),
        ]);
        const outboxRows = outbox.results || [];
        const queueSummary = outboxRows.reduce((summary, row) => {
            const count = Number(row.count || 0);
            summary.total += count;
            summary[row.status] = (summary[row.status] || 0) + count;
            return summary;
        }, { total: 0, pending: 0, paused: 0, queued: 0, processing: 0, retrying: 0, failed: 0 });
        return json({
            config: publicConfig(env),
            settings,
            outbox: outboxRows,
            queueSummary,
            links: links.results || [],
            lastCompleted: lastCompleted || null,
            lastError: lastError || null,
            inbound: {
                events: inboundEvents.results || [],
                cursors: inboundCursors.results || [],
                lastError: inboundLastError || null,
                pollSeconds: boundedInteger(env.PANCAKE_INBOUND_POLL_SECONDS, 120, 60, 3600),
                pageSize: boundedInteger(env.PANCAKE_INBOUND_PAGE_SIZE, 25, 1, 30),
            },
            webhook: {
                configured: Boolean(env.PANCAKE_WEBHOOK_SECRET),
                receivingEnabled: Boolean(env.PANCAKE_WEBHOOK_SECRET),
                processingEnabled: Boolean(env.PANCAKE_WEBHOOK_SECRET && settings.masterEnabled && settings.inboundEnabled),
                endpoint: '/api/webhooks/pancake',
            },
        });
    } catch (error) {
        return apiError(error, 'Could not load Pancake integration status.');
    }
}

async function listOutbox(request, env) {
    try {
        const { db } = await authorize(request, env);
        const url = new URL(request.url);
        const page = boundedInteger(url.searchParams.get('page'), 1, 1, 100000);
        const pageSize = boundedInteger(url.searchParams.get('pageSize'), 50, 1, 200);
        const entityType = String(url.searchParams.get('entityType') || '').trim();
        const status = String(url.searchParams.get('status') || '').trim();
        const conditions = [];
        const bindings = [];
        if (ENTITY_TYPES.includes(entityType)) {
            conditions.push('entity_type = ?');
            bindings.push(entityType);
        }
        if (['pending', 'paused', 'queued', 'processing', 'retrying', 'completed', 'blocked', 'failed'].includes(status)) {
            conditions.push('status = ?');
            bindings.push(status);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [count, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM pancake_sync_outbox ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT id, entity_type, entity_id, operation, idempotency_key, status, attempts,
                    available_at, queued_at, last_error, completed_at, created_at, updated_at
                FROM pancake_sync_outbox ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, (page - 1) * pageSize).all(),
        ]);
        return json({
            data: rows.results || [],
            meta: { page, pageSize, total: Number(count?.total || 0) },
        });
    } catch (error) {
        return apiError(error, 'Could not load Pancake synchronization queue.');
    }
}

async function getSettings(request, env) {
    try {
        const { db } = await authorize(request, env);
        return json({ data: await getPancakeSyncSettings(db) });
    } catch (error) {
        return apiError(error, 'Could not load Pancake synchronization settings.');
    }
}

async function patchSettings(request, env) {
    try {
        const { db, session } = await authorize(request, env, true);
        const body = await readJson(request, 64 * 1024);
        const keys = Object.keys(body || {});
        if (!keys.length || keys.some((key) => !PANCAKE_SYNC_SETTING_KEYS.includes(key))) {
            throw Object.assign(new Error('Only Pancake boolean synchronization settings are accepted.'), { status: 400 });
        }
        if (keys.some((key) => typeof body[key] !== 'boolean')) {
            throw Object.assign(new Error('Every Pancake synchronization setting must be boolean.'), { status: 400 });
        }

        const assignments = keys.map((key) => `${SETTINGS_COLUMN_BY_KEY[key]} = ?`);
        const values = keys.map((key) => body[key] ? 1 : 0);
        const now = new Date().toISOString();
        await db.prepare(`UPDATE pancake_sync_settings
            SET ${assignments.join(', ')}, updated_by = ?, updated_at = ? WHERE id = 1`)
            .bind(...values, session.user_id, now).run();

        const settings = await getPancakeSyncSettings(db);
        return json({ data: settings });
    } catch (error) {
        return apiError(error, 'Could not update Pancake synchronization settings.');
    }
}

async function testConnection(request, env) {
    try {
        await authorize(request, env, true);
        const client = new PancakeClient(env);
        const payload = await client.listWarehouses();
        const warehouses = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        const configuredWarehouse = client.config.warehouseId
            ? warehouses.find((warehouse) => String(warehouse?.id) === client.config.warehouseId) || null
            : null;
        return json({
            ok: true,
            config: publicConfig(env),
            warehouseCount: warehouses.length,
            configuredWarehouseFound: client.config.warehouseId ? Boolean(configuredWarehouse) : null,
        });
    } catch (error) {
        return apiError(error, 'Could not connect to Pancake.');
    }
}

async function listWarehouses(request, env) {
    try {
        await authorize(request, env);
        const client = new PancakeClient(env);
        const payload = await client.listWarehouses();
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        return json({
            data: rows.map((row) => ({
                id: row?.id == null ? null : String(row.id),
                name: String(row?.name || ''),
                phoneNumber: String(row?.phone_number || ''),
                fullAddress: String(row?.full_address || row?.address || ''),
                selected: String(row?.id || '') === String(client.config.warehouseId || ''),
            })),
        });
    } catch (error) {
        return apiError(error, 'Could not load Pancake warehouses.');
    }
}

async function enqueueProducts(request, env) {
    try {
        const { db } = await authorize(request, env, true);
        requireSyncEnabled(await getPancakeSyncSettings(db), 'product', 'product');
        const body = await readJson(request, 256 * 1024);
        const requested = Array.isArray(body.productIds) ? body.productIds : Array.isArray(body.ids) ? body.ids : [];
        let productIds = [...new Set(requested.map((value) => Math.trunc(Number(value))).filter((value) => value > 0))].slice(0, 1000);
        if (!productIds.length) {
            const result = await db.prepare(`SELECT id FROM products WHERE archived_at IS NULL
                ORDER BY updated_at, id LIMIT 1000`).all();
            productIds = (result.results || []).map((row) => row.id);
        }
        const now = new Date().toISOString();
        const queued = await insertInChunks(db, productIds.map((productId) => createPancakeProductOutboxStatement(
            db, productId, `${now}:manual`, 'upsert', now,
        )));
        const dispatch = await dispatchPendingPancakeSync(env, 100);
        return json({ queued, requested: productIds.length, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not queue Pancake product synchronization.');
    }
}

async function enqueueInventory(request, env) {
    try {
        const { db } = await authorize(request, env, true);
        requireSyncEnabled(await getPancakeSyncSettings(db), 'inventory', 'inventory');
        const body = await readJson(request, 256 * 1024);
        const requested = Array.isArray(body.productIds) ? body.productIds : Array.isArray(body.ids) ? body.ids : [];
        let productIds = [...new Set(requested.map((value) => Math.trunc(Number(value))).filter((value) => value > 0))].slice(0, 1000);
        if (!productIds.length) {
            const result = await db.prepare(`SELECT id FROM products WHERE archived_at IS NULL
                ORDER BY updated_at, id LIMIT 1000`).all();
            productIds = (result.results || []).map((row) => row.id);
        }
        const now = new Date().toISOString();
        const queued = await insertInChunks(db, productIds.map((productId) => createPancakeInventoryOutboxStatement(
            db, productId, `${now}:manual`, now,
        )));
        const dispatch = await dispatchPendingPancakeSync(env, 100);
        return json({ queued, requested: productIds.length, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not queue Pancake inventory synchronization.');
    }
}

async function enqueueOrders(request, env) {
    try {
        const { db } = await authorize(request, env, true);
        requireSyncEnabled(await getPancakeSyncSettings(db), 'order', 'order');
        const body = await readJson(request, 256 * 1024);
        const requested = Array.isArray(body.orderIds) ? body.orderIds : Array.isArray(body.ids) ? body.ids : [];
        let orderIds = [...new Set(requested.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 500);
        if (!orderIds.length) {
            const result = await db.prepare('SELECT id FROM product_orders ORDER BY created_at DESC LIMIT 500').all();
            orderIds = (result.results || []).map((row) => String(row.id));
        }
        const now = new Date().toISOString();
        const queued = await insertInChunks(db, orderIds.map((orderId) => createPancakeOrderOutboxStatement(
            db, orderId, `${now}:manual`, now,
        )));
        const dispatch = await dispatchPendingPancakeSync(env, 100);
        return json({ queued, requested: orderIds.length, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not queue Pancake order synchronization.');
    }
}

async function enqueueCustomers(request, env) {
    try {
        const { db } = await authorize(request, env, true);
        requireSyncEnabled(await getPancakeSyncSettings(db), 'customer', 'customer');
        const body = await readJson(request, 256 * 1024);
        const requested = Array.isArray(body.orderIds) ? body.orderIds : Array.isArray(body.ids) ? body.ids : [];
        let rows;
        if (requested.length) {
            const ids = [...new Set(requested.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 500);
            rows = ids.length
                ? (await db.prepare(`SELECT id, customer_phone, updated_at, created_at FROM product_orders
                    WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`).bind(...ids).all()).results || []
                : [];
        } else {
            rows = (await db.prepare(`SELECT id, customer_phone, updated_at, created_at FROM product_orders
                WHERE customer_phone IS NOT NULL AND TRIM(customer_phone) <> ''
                ORDER BY created_at DESC LIMIT 1000`).all()).results || [];
        }
        const unique = new Map();
        for (const row of rows) {
            const phone = normalizePancakePhone(row.customer_phone);
            if (phone && !unique.has(phone)) unique.set(phone, row);
        }
        const now = new Date().toISOString();
        const statements = [...unique.values()].map((row) => createPancakeCustomerOutboxStatement(
            db,
            row.customer_phone,
            `${row.updated_at || row.created_at || now}:manual`,
            { orderId: String(row.id) },
            now,
        ));
        const queued = await insertInChunks(db, statements);
        const dispatch = await dispatchPendingPancakeSync(env, 100);
        return json({ queued, requested: statements.length, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not queue Pancake customer synchronization.');
    }
}

async function dispatchOutbox(request, env) {
    try {
        await authorize(request, env, true);
        return json(await dispatchPendingPancakeSync(env, 100), 202);
    } catch (error) {
        return apiError(error, 'Could not dispatch Pancake synchronization.');
    }
}

async function pollInbound(request, env) {
    try {
        await authorize(request, env, true);
        const poll = await pollPancakeInbound(env, { force: true });
        const dispatch = await dispatchPendingPancakeInbound(env, 100);
        return json({ poll, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not poll Pancake inbound changes.');
    }
}

async function retryOutbox(request, env) {
    try {
        const { db } = await authorize(request, env, true);
        const body = await readJson(request, 128 * 1024);
        const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 500);
        if (!ids.length) throw Object.assign(new Error('At least one outbox ID is required.'), { status: 400 });
        const now = new Date().toISOString();
        const settings = await getPancakeSyncSettings(db);
        let retried = 0;
        for (let offset = 0; offset < ids.length; offset += 75) {
            const chunk = ids.slice(offset, offset + 75);
            const result = await db.prepare(`UPDATE pancake_sync_outbox SET status = CASE
                        WHEN entity_type = 'product' AND ? = 1 THEN 'retrying'
                        WHEN entity_type = 'inventory' AND ? = 1 THEN 'retrying'
                        WHEN entity_type = 'customer' AND ? = 1 THEN 'retrying'
                        WHEN entity_type = 'order' AND ? = 1 THEN 'retrying'
                        ELSE 'paused' END,
                    attempts = 0,
                    available_at = ?, queued_at = NULL, lease_token = NULL, last_error = NULL, updated_at = ?
                WHERE id IN (${chunk.map(() => '?').join(',')}) AND status IN ('blocked', 'failed', 'retrying')`)
                .bind(
                    isPancakeEntityEnabled(settings, 'product') ? 1 : 0,
                    isPancakeEntityEnabled(settings, 'inventory') ? 1 : 0,
                    isPancakeEntityEnabled(settings, 'customer') ? 1 : 0,
                    isPancakeEntityEnabled(settings, 'order') ? 1 : 0,
                    now, now, ...chunk,
                ).run();
            retried += Number(result.meta?.changes || 0);
        }
        const dispatch = await dispatchPendingPancakeSync(env, 100);
        return json({ retried, dispatch }, 202);
    } catch (error) {
        return apiError(error, 'Could not retry Pancake synchronization.');
    }
}

async function pancakeWebhook(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    try {
        const db = requireD1(env);
        const configuredSecret = String(env.PANCAKE_WEBHOOK_SECRET || '').trim();
        if (!configuredSecret) {
            return json({
                error: { code: 'webhook_not_configured', message: 'Pancake webhook is not configured.' },
            }, 503);
        }

        const authorization = String(request.headers.get('Authorization') || '');
        const bearerSecret = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
        const providedSecret = String(
            request.headers.get('X-Pancake-Webhook-Secret')
            || request.headers.get('X-Webhook-Secret')
            || bearerSecret
            || new URL(request.url).searchParams.get('token')
            || '',
        ).trim();
        if (!timingSafeEqual(configuredSecret, providedSecret)) {
            throw Object.assign(new Error('Unauthorized Pancake webhook.'), {
                status: 401,
                code: 'invalid_webhook_secret',
            });
        }

        const rawPayload = await request.text();
        if (new TextEncoder().encode(rawPayload).byteLength > 256 * 1024) {
            throw Object.assign(new Error('Pancake webhook payload is too large.'), { status: 413 });
        }
        let payload;
        try {
            payload = JSON.parse(rawPayload || '{}');
        } catch {
            throw Object.assign(new Error('Invalid Pancake webhook JSON body.'), { status: 400 });
        }

        const now = new Date().toISOString();
        const eventHash = await sha256(rawPayload);
        const receiptId = randomId();
        const headersJson = JSON.stringify({
            contentType: request.headers.get('Content-Type') || null,
            event: request.headers.get('X-Pancake-Event') || null,
            requestId: request.headers.get('X-Request-Id') || null,
            userAgent: request.headers.get('User-Agent') || null,
        });
        const inserted = await db.prepare(`
            INSERT OR IGNORE INTO webhook_receipts (
                id, provider, event_hash, headers_json, payload_json, received_at, status
            ) VALUES (?, 'pancake', ?, ?, ?, ?, 'received')
        `).bind(receiptId, eventHash, headersJson, rawPayload || '{}', now).run();

        if (!Number(inserted.meta?.changes || 0)) {
            return json({
                success: true,
                accepted: true,
                duplicate: true,
                reverseSynchronization: false,
            });
        }

        const settings = await getPancakeSyncSettings(db);
        const detected = detectPancakeWebhookEntity(
            payload,
            request.headers.get('X-Pancake-Event') || payload?.event || payload?.type || '',
        );
        if (!detected || !isPancakeInboundEnabled(settings, detected.resourceType)) {
            await db.prepare(`UPDATE webhook_receipts
                SET status = 'ignored', processed_at = ?, last_error = NULL WHERE id = ?`)
                .bind(now, receiptId).run();
            return json({
                success: true,
                accepted: true,
                duplicate: false,
                reverseSynchronization: false,
                ignored: true,
                receiptId,
            });
        }

        const inbound = await createPancakeInboundEvent(db, env, {
            resourceType: detected.resourceType,
            entity: detected.entity,
            source: 'webhook',
            receiptId,
        });

        return json({
            success: true,
            accepted: true,
            duplicate: false,
            reverseSynchronization: true,
            receiptId,
            inbound,
        });
    } catch (error) {
        return apiError(error, 'Could not accept Pancake webhook.');
    }
}

export async function maybeHandlePancakeRoute({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    if (path === '/api/webhooks/pancake') return pancakeWebhook(request, env);
    if (!path.startsWith('/api/admin/integrations/pancake')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (path === '/api/admin/integrations/pancake/status') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return integrationStatus(request, env);
    }
    if (path === '/api/admin/integrations/pancake/settings') {
        if (request.method === 'GET') return getSettings(request, env);
        if (request.method === 'PATCH') return patchSettings(request, env);
        return methodNotAllowed(['GET', 'PATCH']);
    }
    if (path === '/api/admin/integrations/pancake/outbox') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return listOutbox(request, env);
    }
    if (path === '/api/admin/integrations/pancake/test') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return testConnection(request, env);
    }
    if (path === '/api/admin/integrations/pancake/warehouses') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return listWarehouses(request, env);
    }
    if (path === '/api/admin/integrations/pancake/sync/products') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueProducts(request, env);
    }
    if (path === '/api/admin/integrations/pancake/sync/inventory') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueInventory(request, env);
    }
    if (path === '/api/admin/integrations/pancake/sync/orders') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueOrders(request, env);
    }
    if (path === '/api/admin/integrations/pancake/sync/customers') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueCustomers(request, env);
    }
    if (path === '/api/admin/integrations/pancake/dispatch') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return dispatchOutbox(request, env);
    }
    if (path === '/api/admin/integrations/pancake/inbound/poll') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return pollInbound(request, env);
    }
    if (path === '/api/admin/integrations/pancake/retry') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return retryOutbox(request, env);
    }
    return null;
}
