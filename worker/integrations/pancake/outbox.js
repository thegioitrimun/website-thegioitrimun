import { randomId, sha256 } from '../../platform/crypto.js';
import { PancakeApiError, PancakeClient, getPancakeConfig } from './client.js';
import { consumePancakeInboundMessage } from './inbound.js';
import {
    getEnabledPancakeEntityTypes,
    getPancakeSettingColumn,
    getPancakeSyncSettings,
    isPancakeEntityEnabled,
} from './settings.js';
import {
    mapCustomerToPancake,
    mapOrderToPancake,
    mapProductToPancake,
    normalizePancakePhone,
    pancakeCustomerEntityId,
    pancakeProductSku,
} from './mappers.js';

const TERMINAL_STATUSES = new Set(['completed', 'blocked', 'failed']);
const PRODUCT_SYNC_CONTRACT_VERSION = 4;
const PANCAKE_ENTITY_TYPES = Object.freeze(['product', 'inventory', 'customer', 'order']);

function stableJson(value) {
    if (value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function safelyParse(value, fallback = {}) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function retryDelay(attempt) {
    return Math.min(6 * 60 * 60, 30 * Math.pow(2, Math.max(0, attempt - 1)));
}

export function createPancakeOutboxStatement(db, {
    entityType,
    entityId,
    operation = 'upsert',
    version,
    payload = {},
    now = new Date().toISOString(),
}) {
    const normalizedId = String(entityId);
    const settingColumn = getPancakeSettingColumn(entityType);
    if (!settingColumn) throw new Error(`Unsupported Pancake entity type ${entityType}.`);
    const idempotencyKey = `${entityType}/${operation}/${normalizedId}/${String(version || now)}`;
    return db.prepare(`
        INSERT OR IGNORE INTO pancake_sync_outbox (
            id, entity_type, entity_id, operation, idempotency_key, payload_json,
            status, attempts, available_at, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?
        WHERE EXISTS (
            SELECT 1 FROM pancake_sync_settings
            WHERE id = 1 AND master_enabled = 1 AND ${settingColumn} = 1
        )
    `).bind(randomId(), entityType, normalizedId, operation, idempotencyKey, JSON.stringify(payload), now, now, now);
}

export function createPancakeProductOutboxStatement(db, productId, version, operation = 'upsert', now) {
    return createPancakeOutboxStatement(db, {
        entityType: 'product', entityId: String(productId), operation, version, now,
    });
}

export function createPancakeInventoryOutboxStatement(db, productId, version, now) {
    return createPancakeOutboxStatement(db, {
        entityType: 'inventory', entityId: String(productId), operation: 'upsert', version, now,
    });
}

export function createPancakeCustomerOutboxStatement(db, phone, version, payload = {}, now) {
    return createPancakeOutboxStatement(db, {
        entityType: 'customer', entityId: pancakeCustomerEntityId(phone), version, payload, now,
    });
}

export function createPancakeOrderOutboxStatement(db, orderId, version, now) {
    return createPancakeOutboxStatement(db, {
        entityType: 'order', entityId: String(orderId), version, now,
    });
}

function productImageObjectKey(imagePath) {
    const value = String(imagePath || '').trim();
    if (!value || /^https?:\/\//i.test(value)) return null;

    const r2Match = value.match(/^\/r2\/([^/]+)\/(.+)$/i);
    if (r2Match) {
        if (decodeURIComponent(r2Match[1]) !== 'product-images') return null;
        return `product-images/${decodeURIComponent(r2Match[2])}`;
    }

    return `product-images/${value.replace(/^\/+/, '')}`;
}

async function keepExistingProductImages(env, images) {
    if (!env?.R2_IMAGES?.head || !images.length) return images;

    const checks = await Promise.all(images.map(async (image) => {
        const objectKey = productImageObjectKey(image.image_path);
        if (!objectKey) return image;
        try {
            return (await env.R2_IMAGES.head(objectKey)) ? image : null;
        } catch (error) {
            // An R2 availability issue must not block a product sync. The next
            // sync can retry the check, while Pancake still receives usable URLs.
            console.warn('Pancake image existence check skipped:', error instanceof Error ? error.message : error);
            return image;
        }
    }));
    return checks.filter(Boolean);
}

async function loadProduct(db, env, productId) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').bind(productId).first();
    if (!product) return null;
    const images = await db.prepare(`SELECT image_path, alt_text, is_primary, display_order FROM product_images
        WHERE product_id = ? ORDER BY is_primary DESC, display_order, id`).bind(productId).all();
    return { ...product, images: await keepExistingProductImages(env, images.results || []) };
}

async function loadOrder(db, orderId) {
    const order = await db.prepare('SELECT * FROM product_orders WHERE id = ? OR order_code = ? LIMIT 1')
        .bind(orderId, orderId).first();
    if (!order) return null;
    const items = await db.prepare('SELECT * FROM product_order_items WHERE order_id = ? ORDER BY created_at, id')
        .bind(order.id).all();
    return { ...order, order_items: items.results || [] };
}

async function getLink(db, entityType, localEntityId) {
    return db.prepare(`SELECT * FROM pancake_entity_links WHERE entity_type = ? AND local_entity_id = ? LIMIT 1`)
        .bind(entityType, String(localEntityId)).first();
}

async function saveLink(db, {
    entityType,
    localEntityId,
    pancakeEntityId,
    pancakeParentId = null,
    pancakeVariationId = null,
    checksum = null,
    status = 'synced',
    error = null,
}) {
    const now = new Date().toISOString();
    await db.prepare(`
        INSERT INTO pancake_entity_links (
            entity_type, local_entity_id, pancake_entity_id, pancake_parent_id,
            pancake_variation_id, local_checksum, sync_status, last_error,
            last_synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_type, local_entity_id) DO UPDATE SET
            pancake_entity_id = excluded.pancake_entity_id,
            pancake_parent_id = excluded.pancake_parent_id,
            pancake_variation_id = excluded.pancake_variation_id,
            local_checksum = excluded.local_checksum,
            sync_status = excluded.sync_status,
            last_error = excluded.last_error,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at
    `).bind(
        entityType, String(localEntityId), pancakeEntityId == null ? null : String(pancakeEntityId),
        pancakeParentId == null ? null : String(pancakeParentId),
        pancakeVariationId == null ? null : String(pancakeVariationId), checksum, status, error,
        status === 'synced' ? now : null, now, now,
    ).run();
}

function unwrapData(payload) {
    return payload?.data ?? payload?.product ?? payload?.order ?? payload?.customer ?? payload;
}

function findVariation(product, sku) {
    const variations = Array.isArray(product?.variations) ? product.variations : [];
    return variations.find((variation) => String(variation.custom_id || variation.barcode || '') === sku)
        || variations.find((variation) => !variation.is_removed)
        || variations[0]
        || null;
}

function remoteProductId(product) {
    return product?.id ?? product?.product_id ?? null;
}

function orderRows(payload) {
    const value = payload?.data ?? payload?.orders ?? payload;
    return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
}

async function resolveRemoteOrder(client, customId) {
    const payload = await client.listOrders(customId, 1);
    return orderRows(payload).find((order) => String(order?.custom_id || '') === String(customId)) || null;
}

async function resolveRemoteProduct(client, sku) {
    try {
        const payload = await client.getProductBySku(sku);
        const product = unwrapData(payload);
        if (!product || typeof product !== 'object') return null;
        return product;
    } catch (error) {
        if (error instanceof PancakeApiError && error.status === 404) return null;
        throw error;
    }
}

export async function syncProductById(db, client, env, productId) {
    const product = await loadProduct(db, env, productId);
    const existingLink = await getLink(db, 'product', productId);
    if (!product) {
        if (existingLink?.pancake_entity_id) {
            await client.setProductsHidden([existingLink.pancake_entity_id], true);
            await saveLink(db, {
                entityType: 'product', localEntityId: productId,
                pancakeEntityId: existingLink.pancake_entity_id,
                pancakeVariationId: existingLink.pancake_variation_id,
                checksum: existingLink.local_checksum, status: 'synced',
            });
            return { hidden: true, missingLocally: true };
        }
        throw Object.assign(new Error(`Product ${productId} was not found.`), { retryable: false });
    }
    const sku = pancakeProductSku(product);
    let remote = await resolveRemoteProduct(client, sku);
    if (!remote && existingLink?.pancake_entity_id) {
        remote = {
            id: existingLink.pancake_entity_id,
            variations: existingLink.pancake_variation_id
                ? [{ id: existingLink.pancake_variation_id, custom_id: sku }]
                : [],
        };
    }
    const discoveredVariation = findVariation(remote, sku);
    const effectiveLink = {
        pancake_entity_id: remoteProductId(remote) || existingLink?.pancake_entity_id || null,
        pancake_variation_id: discoveredVariation?.id || existingLink?.pancake_variation_id || null,
    };
    const payload = mapProductToPancake(product, env, effectiveLink);
    const checksum = await sha256(stableJson({
        contractVersion: PRODUCT_SYNC_CONTRACT_VERSION,
        payload,
    }));
    if (existingLink?.sync_status === 'synced' && existingLink.local_checksum === checksum) {
        return { unchanged: true, link: existingLink };
    }

    const remoteId = remoteProductId(remote);
    if (remoteId) await client.updateProduct(remoteId, payload);
    else {
        await client.createProduct(payload);
        remote = await resolveRemoteProduct(client, sku);
        if (!remoteProductId(remote)) {
            throw Object.assign(new Error(`Pancake accepted product ${sku} but it is not queryable yet.`), { retryable: true });
        }
    }
    const refreshed = await resolveRemoteProduct(client, sku) || remote;
    const variation = findVariation(refreshed, sku) || findVariation(remote, sku);
    if (!variation?.id) {
        throw Object.assign(new Error(`Pancake variation was not found for ${sku}.`), { retryable: true });
    }
    const refreshedId = remoteProductId(refreshed) || remoteProductId(remote);
    await saveLink(db, {
        entityType: 'product', localEntityId: productId, pancakeEntityId: refreshedId,
        pancakeVariationId: variation.id, checksum, status: 'synced',
    });
    return { productId: refreshedId, variationId: variation.id, checksum };
}

export async function syncInventoryByProductId(db, client, env, productId, settings = null) {
    const product = await loadProduct(db, env, productId);
    if (!product) {
        throw Object.assign(new Error(`Product ${productId} was not found for inventory sync.`), { retryable: false });
    }
    if (!client.config.warehouseId) {
        throw Object.assign(new Error('Pancake warehouse is not configured.'), { retryable: false });
    }

    const sku = pancakeProductSku(product);
    let link = await getLink(db, 'product', productId);
    if (!link?.pancake_variation_id) {
        const remote = await resolveRemoteProduct(client, sku);
        const variation = findVariation(remote, sku);
        if (remoteProductId(remote) && variation?.id) {
            await saveLink(db, {
                entityType: 'product', localEntityId: productId,
                pancakeEntityId: remoteProductId(remote), pancakeVariationId: variation.id,
                checksum: link?.local_checksum || null, status: 'synced',
            });
            link = await getLink(db, 'product', productId);
        }
    }
    if (!link?.pancake_variation_id && isPancakeEntityEnabled(settings, 'product')) {
        await syncProductById(db, client, env, productId);
        link = await getLink(db, 'product', productId);
    }
    if (!link?.pancake_variation_id) {
        throw Object.assign(new Error(`Product ${sku} must be synced before its inventory.`), { retryable: true });
    }

    const quantity = Math.max(0, Math.trunc(Number(product.stock_quantity) || 0));
    await client.updateVariationQuantity(link.pancake_variation_id, quantity, client.config.warehouseId);
    return { productId: String(productId), variationId: link.pancake_variation_id, quantity };
}

async function hideProductById(db, client, productId) {
    const link = await getLink(db, 'product', productId);
    if (!link?.pancake_entity_id) return { skipped: true, reason: 'not_linked' };
    await client.setProductsHidden([link.pancake_entity_id], true);
    await saveLink(db, {
        entityType: 'product', localEntityId: productId, pancakeEntityId: link.pancake_entity_id,
        pancakeVariationId: link.pancake_variation_id, checksum: link.local_checksum, status: 'synced',
    });
    return { hidden: true };
}

function customerRows(payload) {
    const value = payload?.data ?? payload?.customers ?? payload;
    return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
}

function customerPhones(customer) {
    const values = customer?.phone_numbers || customer?.phones || [customer?.phone_number, customer?.phone];
    return (Array.isArray(values) ? values : [values]).map((item) => normalizePancakePhone(item?.phone_number ?? item));
}

async function ensureCustomer(db, client, order) {
    const phone = normalizePancakePhone(order.customer_phone);
    if (!phone) throw Object.assign(new Error('Customer phone is required for Pancake sync.'), { retryable: false });
    const localEntityId = pancakeCustomerEntityId(phone);
    const existingLink = await getLink(db, 'customer', localEntityId);
    if (existingLink?.pancake_entity_id) {
        await client.updateCustomer(existingLink.pancake_entity_id, mapCustomerToPancake(order, { forUpdate: true }));
        await saveLink(db, {
            entityType: 'customer', localEntityId, pancakeEntityId: existingLink.pancake_entity_id,
            checksum: await sha256(stableJson(mapCustomerToPancake(order, { forUpdate: true }))), status: 'synced',
        });
        return String(existingLink.pancake_entity_id);
    }
    const searchPayload = await client.listCustomers(phone);
    let remote = customerRows(searchPayload).find((customer) => customerPhones(customer).includes(phone));
    if (!remote) {
        const created = await client.createCustomer(mapCustomerToPancake(order));
        remote = unwrapData(created);
    }
    if (!remote?.id) throw Object.assign(new Error(`Pancake customer was not resolved for ${phone}.`), { retryable: true });
    const updatePayload = mapCustomerToPancake(order, { forUpdate: true });
    await client.updateCustomer(remote.id, updatePayload);
    await saveLink(db, {
        entityType: 'customer', localEntityId, pancakeEntityId: remote.id,
        checksum: await sha256(stableJson(updatePayload)), status: 'synced',
    });
    return String(remote.id);
}

async function syncCustomerFromPayload(db, client, payload) {
    const orderId = String(payload?.orderId || '');
    if (!orderId) throw Object.assign(new Error('Customer sync requires an orderId snapshot.'), { retryable: false });
    const order = await loadOrder(db, orderId);
    if (!order) throw Object.assign(new Error(`Order ${orderId} was not found.`), { retryable: false });
    return { customerId: await ensureCustomer(db, client, order) };
}

export async function syncOrderById(db, client, env, orderId, settings = null) {
    const order = await loadOrder(db, orderId);
    if (!order) throw Object.assign(new Error(`Order ${orderId} was not found.`), { retryable: false });
    const productLinks = new Map();
    for (const item of order.order_items) {
        if (item.product_id == null && item.external_variation_id) {
            productLinks.set(`external:${String(item.external_variation_id)}`, {
                pancake_entity_id: item.external_product_id || '',
                pancake_variation_id: item.external_variation_id,
            });
            continue;
        }
        let link = await getLink(db, 'product', item.product_id);
        if (!link?.pancake_variation_id) {
            const product = await loadProduct(db, env, item.product_id);
            const sku = product ? pancakeProductSku(product) : null;
            const remote = sku ? await resolveRemoteProduct(client, sku) : null;
            const variation = sku ? findVariation(remote, sku) : null;
            if (remoteProductId(remote) && variation?.id) {
                await saveLink(db, {
                    entityType: 'product', localEntityId: item.product_id,
                    pancakeEntityId: remoteProductId(remote), pancakeVariationId: variation.id,
                    checksum: link?.local_checksum || null, status: 'synced',
                });
            } else if (isPancakeEntityEnabled(settings, 'product')) {
                await syncProductById(db, client, env, item.product_id);
            }
            link = await getLink(db, 'product', item.product_id);
        }
        if (!link?.pancake_variation_id) {
            throw Object.assign(new Error(`Product ${item.product_id} is not ready in Pancake.`), { retryable: true });
        }
        productLinks.set(String(item.product_id), link);
    }
    const customerId = await ensureCustomer(db, client, order);
    const payload = mapOrderToPancake(order, productLinks, customerId, env);
    const checksum = await sha256(stableJson(payload));
    const existingLink = await getLink(db, 'order', order.id);
    if (existingLink?.sync_status === 'synced' && existingLink.local_checksum === checksum) {
        return { unchanged: true, link: existingLink };
    }
    const discoveredOrder = existingLink?.pancake_entity_id
        ? null
        : await resolveRemoteOrder(client, payload.custom_id);
    const knownRemoteId = existingLink?.pancake_entity_id || discoveredOrder?.id || null;
    const result = knownRemoteId
        ? await client.updateOrder(knownRemoteId, payload)
        : await client.createOrder(payload);
    const remote = unwrapData(result);
    const remoteId = remote?.id ?? result?.id ?? knownRemoteId;
    if (!remoteId) throw Object.assign(new Error(`Pancake order ID was not returned for ${order.order_code}.`), { retryable: true });
    await saveLink(db, {
        entityType: 'order', localEntityId: order.id, pancakeEntityId: remoteId,
        pancakeParentId: customerId, checksum, status: 'synced',
    });
    return { orderId: remoteId, customerId, checksum };
}

async function processOutboxRow(db, client, env, row, settings) {
    if (row.entity_type === 'product') {
        return row.operation === 'hide'
            ? hideProductById(db, client, row.entity_id)
            : syncProductById(db, client, env, row.entity_id);
    }
    if (row.entity_type === 'inventory') {
        return syncInventoryByProductId(db, client, env, row.entity_id, settings);
    }
    if (row.entity_type === 'customer') {
        return syncCustomerFromPayload(db, client, safelyParse(row.payload_json));
    }
    if (row.entity_type === 'order') return syncOrderById(db, client, env, row.entity_id, settings);
    throw Object.assign(new Error(`Unsupported Pancake entity type ${row.entity_type}.`), { retryable: false });
}

export async function dispatchPendingPancakeSync(env, limit = 50) {
    if (!env.APP_DB || !env.PANCAKE_QUEUE) return { skipped: true, queued: 0 };
    if (!getPancakeConfig(env).enabled) return { skipped: true, queued: 0, reason: 'not_configured' };
    const settings = await getPancakeSyncSettings(env.APP_DB);
    const enabledTypes = getEnabledPancakeEntityTypes(settings);
    const now = new Date().toISOString();
    const batchLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    const disabledTypes = PANCAKE_ENTITY_TYPES.filter((entityType) => !enabledTypes.includes(entityType));
    if (disabledTypes.length) {
        const disabledPlaceholders = disabledTypes.map(() => '?').join(',');
        await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
            SET status = 'paused', queued_at = NULL, lease_token = NULL, updated_at = ?
            WHERE id IN (
                SELECT id FROM pancake_sync_outbox
                WHERE entity_type IN (${disabledPlaceholders})
                  AND status IN ('pending', 'retrying')
                ORDER BY created_at LIMIT ?
            )`).bind(now, ...disabledTypes, batchLimit).run();
    }
    if (!enabledTypes.length) return { skipped: true, queued: 0, reason: 'sync_disabled' };
    const staleQueuedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const staleProcessingAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
        SET status = 'retrying', available_at = ?, queued_at = NULL, lease_token = NULL,
            last_error = 'Pancake processing lease expired.', updated_at = ?
        WHERE status = 'processing' AND updated_at < ?`).bind(now, now, staleProcessingAt).run();
    await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
        SET status = 'retrying', available_at = ?, queued_at = NULL,
            last_error = 'Queue dispatch lease expired.', updated_at = ?
        WHERE status = 'queued' AND queued_at IS NOT NULL AND queued_at < ?`).bind(now, now, staleQueuedAt).run();
    const typePlaceholders = enabledTypes.map(() => '?').join(',');
    const rows = await env.APP_DB.prepare(`SELECT id FROM pancake_sync_outbox
        WHERE status IN ('pending', 'paused', 'retrying') AND available_at <= ?
          AND entity_type IN (${typePlaceholders})
        ORDER BY created_at LIMIT ?`).bind(now, ...enabledTypes, batchLimit).all();
    const ids = (rows.results || []).map((row) => row.id);
    if (!ids.length) return { skipped: false, queued: 0 };
    await env.APP_DB.batch(ids.map((id) => env.APP_DB.prepare(`UPDATE pancake_sync_outbox
        SET status = 'queued', queued_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'paused', 'retrying')`).bind(now, now, id)));
    const reserved = await env.APP_DB.prepare(`SELECT id FROM pancake_sync_outbox
        WHERE status = 'queued' AND queued_at = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(now, ...ids).all();
    const reservedIds = (reserved.results || []).map((row) => row.id);
    try {
        for (let offset = 0; offset < reservedIds.length; offset += 100) {
            const chunk = reservedIds.slice(offset, offset + 100);
            await env.PANCAKE_QUEUE.sendBatch(chunk.map((id) => ({ body: { kind: 'pancake', outboxId: id } })));
        }
        return { skipped: false, queued: reservedIds.length };
    } catch (error) {
        await env.APP_DB.batch(reservedIds.map((id) => env.APP_DB.prepare(`UPDATE pancake_sync_outbox
            SET status = 'retrying', queued_at = NULL, available_at = ?, last_error = ?, updated_at = ?
            WHERE id = ? AND status = 'queued'`).bind(
            new Date(Date.now() + 30_000).toISOString(), String(error?.message || error).slice(0, 1000), now, id,
        )));
        throw error;
    }
}

export async function dispatchPendingPancakeSyncBestEffort(env, limit = 50) {
    try {
        return await dispatchPendingPancakeSync(env, limit);
    } catch (error) {
        console.error('[pancake-outbox] Immediate dispatch failed:', {
            message: String(error?.message || error).slice(0, 500),
        });
        return { skipped: false, queued: 0, failed: true };
    }
}

export async function consumePancakeQueue(batch, env) {
    if (!env.APP_DB) {
        for (const message of batch.messages) message.retry({ delaySeconds: 300 });
        return;
    }
    const settings = await getPancakeSyncSettings(env.APP_DB);
    let client;
    try { client = new PancakeClient(env); } catch (error) {
        for (const message of batch.messages) {
            const id = message.body?.outboxId;
            if (id) await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
                SET status = 'blocked', last_error = ?, updated_at = ? WHERE id = ?`)
                .bind(String(error?.message || error).slice(0, 1000), new Date().toISOString(), id).run();
            const inboundId = message.body?.inboundEventId;
            if (inboundId) await env.APP_DB.prepare(`UPDATE pancake_inbound_events
                SET status = 'failed', last_error = ?, processed_at = ?, updated_at = ? WHERE id = ?`)
                .bind(String(error?.message || error).slice(0, 1000), new Date().toISOString(), new Date().toISOString(), inboundId).run();
            message.ack();
        }
        return;
    }
    for (const message of batch.messages) {
        if (await consumePancakeInboundMessage(message, env, settings, client)) continue;
        const outboxId = message.body?.outboxId;
        const row = outboxId
            ? await env.APP_DB.prepare('SELECT * FROM pancake_sync_outbox WHERE id = ? LIMIT 1').bind(outboxId).first()
            : null;
        if (!row || TERMINAL_STATUSES.has(row.status)) {
            message.ack();
            continue;
        }
        if (!isPancakeEntityEnabled(settings, row.entity_type)) {
            await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
                SET status = 'paused', queued_at = NULL, lease_token = NULL, updated_at = ?
                WHERE id = ? AND status IN ('pending', 'queued', 'processing', 'retrying')`)
                .bind(new Date().toISOString(), outboxId).run();
            message.ack();
            continue;
        }
        const attempt = Number(row.attempts || 0) + 1;
        const now = new Date().toISOString();
        const leaseToken = randomId();
        const claimed = await env.APP_DB.prepare(`UPDATE pancake_sync_outbox
            SET status = 'processing', attempts = ?, lease_token = ?, updated_at = ?
            WHERE id = ? AND status IN ('queued', 'retrying')`).bind(attempt, leaseToken, now, outboxId).run();
        if (!Number(claimed.meta?.changes || 0)) {
            message.ack();
            continue;
        }
        try {
            const result = await processOutboxRow(env.APP_DB, client, env, row, settings);
            await env.APP_DB.prepare(`UPDATE pancake_sync_outbox SET status = 'completed', response_json = ?,
                last_error = NULL, completed_at = ?, lease_token = NULL, updated_at = ?
                WHERE id = ? AND lease_token = ?`).bind(JSON.stringify(result), now, now, outboxId, leaseToken).run();
            message.ack();
        } catch (error) {
            const retryable = error?.retryable !== false;
            const terminal = !retryable || attempt >= client.config.maxAttempts;
            const delaySeconds = retryDelay(attempt);
            await env.APP_DB.prepare(`UPDATE pancake_sync_outbox SET status = ?, available_at = ?,
                last_error = ?, lease_token = NULL, updated_at = ? WHERE id = ? AND lease_token = ?`).bind(
                terminal ? 'failed' : 'retrying',
                new Date(Date.now() + delaySeconds * 1000).toISOString(),
                String(error?.message || error).slice(0, 1000), now, outboxId, leaseToken,
            ).run();
            if (terminal) message.ack();
            else message.retry({ delaySeconds });
        }
    }
}
