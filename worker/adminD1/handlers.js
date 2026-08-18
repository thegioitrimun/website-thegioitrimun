import { requireCsrf, requireRole } from '../auth/session.js';
import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import {
    createPancakeInventoryOutboxStatement,
    createPancakeProductOutboxStatement,
} from '../integrations/pancake/outbox.js';
import { listPayload, paginationFromRequest, recordAdminAuditAttempt, revisionValue } from './support.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPORT_PRESETS = new Set(['7d', '30d', '90d']);
const REPORT_FREQUENCIES = new Set(['daily', 'weekly']);
const PRODUCT_IMAGE_QUERY_BATCH_SIZE = 80;

function parseJson(value, fallback) {
    if (value == null || value === '') return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}

function number(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function text(value, max = 10000) {
    return String(value ?? '').trim().slice(0, max);
}

function isPlaceholderProductName(value) {
    return /^(?:sản phẩm|sp|product)\s*#\s*\d+$/i.test(text(value, 500));
}

function nullableText(value, max = 10000) {
    const normalized = text(value, max);
    return normalized || null;
}

function boolInt(value, fallback = false) {
    if (value == null) return fallback ? 1 : 0;
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

function jsonText(value, fallback = []) {
    if (value == null || value === '') return JSON.stringify(fallback);
    if (typeof value === 'string') {
        try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
    }
    return JSON.stringify(value);
}

function numericObjectId() {
    return String(Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000);
}

function uniqueSlugSuffix() {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 6);
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function dateRange(url, fallbackDays = 30) {
    const end = url.searchParams.get('to') || new Date().toISOString();
    const start = url.searchParams.get('from') || new Date(Date.now() - fallbackDays * 86400000).toISOString();
    return { start, end };
}

async function requireAdmin(request, env, write = false) {
    const db = requireD1(env);
    const session = await requireRole(db, request, ['admin', 'master_admin']);
    if (write) {
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
    }
    return { db, session };
}

function mapProduct(row) {
    return {
        ...row,
        is_published: Boolean(row.is_published),
        is_featured: Boolean(row.is_featured),
        long_description: parseJson(row.long_description, row.long_description || []),
        key_benefits: parseJson(row.key_benefits_json, []),
        key_benefits_en: parseJson(row.key_benefits_en_json, []),
        key_benefits_ru: parseJson(row.key_benefits_ru_json, []),
        key_benefits_cn: parseJson(row.key_benefits_cn_json, []),
        skin_types: parseJson(row.skin_types_json, []),
        faq_items: parseJson(row.faq_items_json, []),
        category: row.category_id ? {
            id: row.category_id,
            slug: row.category_slug,
            name: row.category_name,
        } : null,
    };
}

async function attachProductImages(db, rows) {
    if (!rows.length) return [];
    const imageRows = [];
    for (let index = 0; index < rows.length; index += PRODUCT_IMAGE_QUERY_BATCH_SIZE) {
        const productIds = rows.slice(index, index + PRODUCT_IMAGE_QUERY_BATCH_SIZE).map((row) => row.id);
        const images = await db.prepare(`SELECT * FROM product_images WHERE product_id IN (${productIds.map(() => '?').join(',')}) ORDER BY product_id, is_primary DESC, display_order, id`)
            .bind(...productIds).all();
        imageRows.push(...(images.results || []));
    }
    const byProduct = new Map();
    for (const image of imageRows) {
        const list = byProduct.get(image.product_id) || [];
        list.push({
            ...image,
            id: /^\d+$/.test(String(image.id)) && Number.isSafeInteger(Number(image.id)) ? Number(image.id) : image.id,
            is_primary: Boolean(image.is_primary),
        });
        byProduct.set(image.product_id, list);
    }
    return rows.map((row) => ({ ...mapProduct(row), images: byProduct.get(row.id) || [] }));
}

const PRODUCT_COLUMNS = new Map([
    ['slug', 'slug'], ['sku', 'sku'], ['category_id', 'category_id'], ['brand', 'brand'],
    ['name', 'name'], ['name_en', 'name_en'], ['name_ru', 'name_ru'], ['name_cn', 'name_cn'],
    ['description', 'description'], ['description_en', 'description_en'], ['description_ru', 'description_ru'], ['description_cn', 'description_cn'],
    ['long_description', 'long_description'], ['long_description_en', 'long_description_en'], ['long_description_ru', 'long_description_ru'], ['long_description_cn', 'long_description_cn'],
    ['usage_instructions', 'usage_instructions'], ['usage_instructions_en', 'usage_instructions_en'], ['usage_instructions_ru', 'usage_instructions_ru'], ['usage_instructions_cn', 'usage_instructions_cn'],
    ['ingredients', 'ingredients'], ['ingredients_en', 'ingredients_en'], ['ingredients_ru', 'ingredients_ru'], ['ingredients_cn', 'ingredients_cn'], ['inci_text', 'inci_text'],
    ['key_benefits', 'key_benefits_json'], ['key_benefits_json', 'key_benefits_json'],
    ['key_benefits_en', 'key_benefits_en_json'], ['key_benefits_en_json', 'key_benefits_en_json'],
    ['key_benefits_ru', 'key_benefits_ru_json'], ['key_benefits_ru_json', 'key_benefits_ru_json'],
    ['key_benefits_cn', 'key_benefits_cn_json'], ['key_benefits_cn_json', 'key_benefits_cn_json'],
    ['skin_types', 'skin_types_json'], ['skin_types_json', 'skin_types_json'],
    ['faq_items', 'faq_items_json'], ['faq_items_json', 'faq_items_json'],
    ['precautions', 'precautions'], ['precautions_en', 'precautions_en'], ['precautions_ru', 'precautions_ru'], ['precautions_cn', 'precautions_cn'],
    ['price', 'price'], ['vat_rate', 'vat_rate'], ['stock_quantity', 'stock_quantity'], ['low_stock_threshold', 'low_stock_threshold'],
    ['volume', 'volume'], ['origin', 'origin'], ['origin_en', 'origin_en'], ['origin_ru', 'origin_ru'], ['origin_cn', 'origin_cn'],
    ['texture', 'texture'], ['texture_en', 'texture_en'], ['texture_ru', 'texture_ru'], ['texture_cn', 'texture_cn'],
    ['expiry_date', 'expiry_date'], ['sold_count', 'sold_count'], ['is_published', 'is_published'], ['is_featured', 'is_featured'],
]);

const PRODUCT_JSON_FIELDS = new Set([
    'long_description', 'long_description_en', 'long_description_ru', 'long_description_cn',
    'key_benefits', 'key_benefits_json', 'key_benefits_en', 'key_benefits_en_json',
    'key_benefits_ru', 'key_benefits_ru_json', 'key_benefits_cn', 'key_benefits_cn_json',
    'skin_types', 'skin_types_json', 'faq_items', 'faq_items_json',
]);
const PRODUCT_BOOLEAN_FIELDS = new Set(['is_published', 'is_featured']);
const PRODUCT_NUMBER_FIELDS = new Set(['price', 'vat_rate', 'stock_quantity', 'low_stock_threshold', 'sold_count']);

function normalizeProductPayload(input) {
    const output = {};
    for (const [source, column] of PRODUCT_COLUMNS) {
        if (!Object.hasOwn(input, source)) continue;
        if (PRODUCT_JSON_FIELDS.has(source)) output[column] = jsonText(input[source]);
        else if (PRODUCT_BOOLEAN_FIELDS.has(source)) output[column] = boolInt(input[source]);
        else if (PRODUCT_NUMBER_FIELDS.has(source)) output[column] = Math.max(0, number(input[source]));
        else if (source === 'category_id') output[column] = input[source] == null || input[source] === '' ? null : Math.trunc(number(input[source]));
        else output[column] = nullableText(input[source], 100000);
    }
    if (Object.hasOwn(input, 'slug')) output.slug = text(output.slug, 255);
    if (Object.hasOwn(input, 'name')) output.name = text(output.name, 500);
    if (output.vat_rate != null && output.vat_rate > 1) throw Object.assign(new Error('VAT phải nằm trong khoảng 0 đến 1.'), { status: 400 });
    return output;
}

export async function saveAdminProduct(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 512 * 1024);
        const input = body.product || body;
        const payload = normalizeProductPayload(input);
        const now = new Date().toISOString();
        const requestedId = Number(input.id);
        const id = Number.isSafeInteger(requestedId) && requestedId > 0
            ? requestedId
            : number((await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products').first())?.id);
        const existing = await db.prepare('SELECT id, slug, name, created_at FROM products WHERE id = ?').bind(id).first();
        if (!payload.slug && existing?.slug) payload.slug = existing.slug;
        if (!payload.name && existing?.name) payload.name = existing.name;
        if (!payload.slug || !payload.name) throw Object.assign(new Error('Tên và slug sản phẩm là bắt buộc.'), { status: 400 });

        const slugOwner = await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1').bind(payload.slug, id).first();
        if (slugOwner) payload.slug = `${payload.slug}-${uniqueSlugSuffix()}`;

        const columns = ['id', 'created_at', ...Object.keys(payload), 'updated_at'];
        const values = [id, existing?.created_at || now, ...Object.values(payload), now];
        const updateColumns = [...Object.keys(payload), 'updated_at'];
        const statements = [db.prepare(`INSERT INTO products (${columns.join(', ')})
            VALUES (${columns.map(() => '?').join(', ')})
            ON CONFLICT(id) DO UPDATE SET ${updateColumns.map((column) => `${column} = excluded.${column}`).join(', ')}`)
            .bind(...values)];

        const deleteIds = (Array.isArray(body.imagesToDelete) ? body.imagesToDelete : [])
            .map((image) => String(image?.id || '')).filter(Boolean).slice(0, 100);
        let deletedImagePaths = [];
        if (deleteIds.length) {
            const rows = await db.prepare(`SELECT image_path FROM product_images WHERE product_id = ? AND id IN (${deleteIds.map(() => '?').join(',')})`)
                .bind(id, ...deleteIds).all();
            deletedImagePaths = (rows.results || []).map((row) => row.image_path).filter(Boolean);
            statements.push(db.prepare(`DELETE FROM product_images WHERE product_id = ? AND id IN (${deleteIds.map(() => '?').join(',')})`)
                .bind(id, ...deleteIds));
        }

        const images = Array.isArray(input.images) ? input.images.slice(0, 100) : [];
        if (images.some((image) => image?.is_primary)) {
            statements.push(db.prepare('UPDATE product_images SET is_primary = 0, updated_at = ? WHERE product_id = ?').bind(now, id));
        }
        for (const image of images) {
            const imagePath = text(image?.image_path, 2000);
            if (!imagePath) continue;
            const imageId = image?.id ? String(image.id) : numericObjectId();
            statements.push(db.prepare(`INSERT INTO product_images (
                id, product_id, image_path, alt_text, is_primary, display_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(product_id, image_path) DO UPDATE SET
                alt_text = excluded.alt_text,
                is_primary = excluded.is_primary,
                display_order = excluded.display_order,
                updated_at = excluded.updated_at`)
                .bind(imageId, id, imagePath, nullableText(image?.alt_text, 500), boolInt(image?.is_primary),
                    Math.trunc(number(image?.display_order)), now, now));
        }
        statements.push(createPancakeProductOutboxStatement(db, id, now, 'upsert', now));
        statements.push(createPancakeInventoryOutboxStatement(db, id, `${now}:inventory`, now));
        await db.batch(statements);
        const row = await db.prepare(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
            FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`).bind(id).first();
        const [product] = await attachProductImages(db, row ? [row] : []);
        return json({ product, deletedImagePaths });
    } catch (error) {
        console.error('Failed to save admin product:', error);
        return apiError(error, error?.message || 'Could not save product.');
    }
}

export async function deleteAdminProduct(request, env, productId) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const id = Math.trunc(number(productId));
        const product = await db.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
        if (!product) throw Object.assign(new Error('Không tìm thấy sản phẩm.'), { status: 404 });
        const references = await db.prepare('SELECT COUNT(*) AS count FROM product_order_items WHERE product_id = ?').bind(id).first();
        const images = await db.prepare('SELECT image_path FROM product_images WHERE product_id = ?').bind(id).all();
        const imagePaths = (images.results || []).map((row) => row.image_path).filter(Boolean);
        if (number(references?.count) > 0) {
            const now = new Date().toISOString();
            await db.batch([
                db.prepare('UPDATE products SET archived_at = ?, is_published = 0, updated_at = ? WHERE id = ?').bind(now, now, id),
                createPancakeProductOutboxStatement(db, id, now, 'hide', now),
            ]);
            return json({ result: { product_id: id, outcome: 'archived', image_paths: [] } });
        }
        const now = new Date().toISOString();
        await db.batch([
            createPancakeProductOutboxStatement(db, id, now, 'hide', now),
            db.prepare('DELETE FROM products WHERE id = ?').bind(id),
        ]);
        return json({ result: { product_id: id, outcome: 'deleted', image_paths: imagePaths } });
    } catch (error) {
        return apiError(error, 'Could not delete product.');
    }
}

export async function appendAdminProductImages(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 256 * 1024);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
        const now = new Date().toISOString();
        const statements = rows.map((row) => db.prepare(`INSERT INTO product_images (
            id, product_id, image_path, alt_text, is_primary, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
        ON CONFLICT(product_id, image_path) DO NOTHING`).bind(
            numericObjectId(), Math.trunc(number(row.product_id)), text(row.image_path, 2000),
            boolInt(row.is_primary), Math.trunc(number(row.display_order)), now, now,
        ));
        const productIds = [...new Set(rows.map((row) => Math.trunc(number(row.product_id))).filter(Boolean))];
        statements.push(...productIds.map((productId) => createPancakeProductOutboxStatement(
            db, productId, `${now}:images`, 'upsert', now,
        )));
        if (statements.length) await db.batch(statements);
        return json({ ok: true, inserted: statements.length });
    } catch (error) {
        return apiError(error, 'Could not append product images.');
    }
}

export async function promoteAdminProductImages(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 128 * 1024);
        const rows = Array.isArray(body.selections) ? body.selections.slice(0, 500) : [];
        const now = new Date().toISOString();
        const statements = [];
        for (const row of rows) {
            const productId = Math.trunc(number(row.product_id));
            const path = text(row.image_path, 2000);
            if (!productId || !path) continue;
            statements.push(
                db.prepare('UPDATE product_images SET is_primary = 0, updated_at = ? WHERE product_id = ?').bind(now, productId),
                db.prepare('UPDATE product_images SET is_primary = 1, updated_at = ? WHERE product_id = ? AND image_path = ?').bind(now, productId, path),
            );
        }
        const productIds = [...new Set(rows.map((row) => Math.trunc(number(row.product_id))).filter(Boolean))];
        statements.push(...productIds.map((productId) => createPancakeProductOutboxStatement(
            db, productId, `${now}:primary-image`, 'upsert', now,
        )));
        if (statements.length) await db.batch(statements);
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not promote product images.');
    }
}

export async function listAdminProducts(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const { url, page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const conditions = ['p.archived_at IS NULL'];
        const bindings = [];
        if (query) {
            conditions.push('(p.name LIKE ? ESCAPE \'\\\' OR p.slug LIKE ? ESCAPE \'\\\' OR p.sku LIKE ? ESCAPE \'\\\' OR p.brand LIKE ? ESCAPE \'\\\')');
            const pattern = `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            bindings.push(pattern, pattern, pattern, pattern);
        }
        const categoryId = Math.trunc(number(url.searchParams.get('categoryId')));
        if (categoryId > 0) { conditions.push('p.category_id = ?'); bindings.push(categoryId); }
        const brand = text(url.searchParams.get('brand'), 500);
        if (brand) { conditions.push('p.brand = ? COLLATE NOCASE'); bindings.push(brand); }
        const published = url.searchParams.get('published');
        if (published === 'true' || published === 'false') { conditions.push('p.is_published = ?'); bindings.push(published === 'true' ? 1 : 0); }
        const sortMap = new Map([
            ['name', 'p.name COLLATE NOCASE ASC'], ['name-desc', 'p.name COLLATE NOCASE DESC'],
            ['newest', 'p.created_at DESC'], ['updated', 'p.updated_at DESC'],
            ['stock', 'p.stock_quantity DESC'], ['price', 'p.price ASC'], ['price-desc', 'p.price DESC'],
        ]);
        const orderBy = sortMap.get(url.searchParams.get('sort')) || 'p.name COLLATE NOCASE ASC';
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, result] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM products p WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
                FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
                WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all(),
        ]);
        const products = await attachProductImages(db, result.results || []);
        return json(listPayload(products, {
            page, pageSize, total: number(countRow?.total), revision: revisionValue(revisionRow?.revision),
        }, 'products'));
    } catch (error) {
        return apiError(error, 'Could not load admin products.');
    }
}

async function attachOrderItems(db, orders) {
    if (!orders.length) return [];
    const orderIds = orders.map((order) => order.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const [items, refunds] = await Promise.all([
        db.prepare(`SELECT i.*, p.id AS current_product_id, p.name AS current_product_name,
                p.sku AS current_product_sku, p.stock_quantity AS current_stock_quantity
            FROM product_order_items i LEFT JOIN products p ON p.id = i.product_id
            WHERE i.order_id IN (${placeholders}) ORDER BY i.created_at, i.id`).bind(...orderIds).all(),
        db.prepare(`SELECT * FROM order_refund_logs WHERE order_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...orderIds).all(),
    ]);
    const productIds = Array.from(new Set(
        (items.results || [])
            .map((item) => item.product_id)
            .filter((productId) => productId !== null && productId !== undefined && productId !== '')
    ));
    const primaryImageByProduct = new Map();
    for (let index = 0; index < productIds.length; index += PRODUCT_IMAGE_QUERY_BATCH_SIZE) {
        const batch = productIds.slice(index, index + PRODUCT_IMAGE_QUERY_BATCH_SIZE);
        const imageRows = await db.prepare(`
            SELECT product_id, image_path
            FROM product_images
            WHERE product_id IN (${batch.map(() => '?').join(',')})
            ORDER BY product_id, is_primary DESC, display_order, id
        `).bind(...batch).all();
        for (const image of imageRows.results || []) {
            if (!primaryImageByProduct.has(image.product_id) && image.image_path) {
                primaryImageByProduct.set(image.product_id, image.image_path);
            }
        }
    }
    const byOrder = new Map();
    for (const item of items.results || []) {
        const list = byOrder.get(item.order_id) || [];
        // Prefer the current primary image so old order snapshots cannot show a stale or legacy asset.
        const imagePath = primaryImageByProduct.get(item.product_id) || item.product_image_path || '';
        const snapshotName = text(item.product_name, 500);
        const displayName = snapshotName && !isPlaceholderProductName(snapshotName)
            ? snapshotName
            : text(item.current_product_name, 500) || snapshotName || `Sản phẩm #${item.product_id}`;
        const displaySku = text(item.product_sku, 255) || text(item.current_product_sku, 255) || null;
        const stockQuantity = item.current_product_id == null || item.current_stock_quantity == null
            ? null
            : number(item.current_stock_quantity);
        list.push({
            ...item,
            product_name: displayName,
            product_sku: displaySku,
            product_image_path: imagePath || null,
            product: {
                id: item.product_id,
                name: displayName,
                sku: displaySku,
                stock_quantity: stockQuantity,
                main_image_path: imagePath,
                main_image_url: '',
            },
        });
        byOrder.set(item.order_id, list);
    }
    const refundsByOrder = new Map();
    for (const refund of refunds.results || []) {
        const list = refundsByOrder.get(refund.order_id) || [];
        list.push(refund);
        refundsByOrder.set(refund.order_id, list);
    }
    return orders.map((order) => ({
        ...order,
        order_items: byOrder.get(order.id) || [],
        refund_logs: refundsByOrder.get(order.id) || [],
    }));
}

export async function listAdminOrders(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const { url, page, pageSize: requestedPageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 1000 });
        const legacyLimit = boundedInteger(url.searchParams.get('limit'), 0, 0, 1000);
        const pageSize = legacyLimit || requestedPageSize;
        const conditions = ['1 = 1'];
        const bindings = [];
        if (query) {
            const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            conditions.push('(order_code LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)');
            bindings.push(pattern, pattern, pattern, pattern);
        }
        const status = text(url.searchParams.get('status'), 40);
        if (status) { conditions.push('status = ?'); bindings.push(status); }
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM product_orders WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM product_orders WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT * FROM product_orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, legacyLimit ? 0 : offset).all(),
        ]);
        const orders = await attachOrderItems(db, rows.results || []);
        return json(listPayload(orders, {
            page: legacyLimit ? 1 : page, pageSize, total: number(countRow?.total), revision: revisionValue(revisionRow?.revision),
        }, 'orders'));
    } catch (error) {
        return apiError(error, 'Could not load admin orders.');
    }
}

export async function getAdminOrderLifecycle(request, env, orderId) {
    try {
        const { db } = await requireAdmin(request, env);
        const [history, payments, refunds] = await Promise.all([
            db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at').bind(orderId).all(),
            db.prepare('SELECT * FROM order_payment_logs WHERE order_id = ? ORDER BY created_at DESC').bind(orderId).all(),
            db.prepare('SELECT * FROM order_refund_logs WHERE order_id = ? ORDER BY created_at DESC').bind(orderId).all(),
        ]);
        return json({ statusHistory: history.results || [], paymentLogs: payments.results || [], refundLogs: refunds.results || [] });
    } catch (error) {
        return apiError(error, 'Could not load order lifecycle.');
    }
}

export async function getDashboardKpi(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const { start, end } = dateRange(new URL(request.url));
        const [orders, customers, appointments] = await Promise.all([
            db.prepare(`SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
                SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded_orders,
                SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS guest_orders,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN grand_total ELSE 0 END), 0) AS gross_revenue,
                COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'refunded') THEN grand_total ELSE 0 END), 0) AS net_revenue,
                COALESCE(SUM(discount_amount), 0) AS discount_total,
                COALESCE(SUM(tax_amount), 0) AS tax_total,
                COALESCE(SUM(shipping_fee), 0) AS shipping_total,
                COALESCE(AVG(CASE WHEN status NOT IN ('cancelled', 'refunded') THEN grand_total END), 0) AS average_order_value
                FROM product_orders WHERE created_at >= ? AND created_at <= ?`).bind(start, end).first(),
            db.prepare(`SELECT COUNT(DISTINCT customer_email) AS total_customers,
                SUM(CASE WHEN first_order_at >= ? THEN 1 ELSE 0 END) AS new_customers,
                SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) AS returning_customers
                FROM (SELECT lower(customer_email) AS customer_email, MIN(created_at) AS first_order_at, COUNT(*) AS order_count
                      FROM product_orders WHERE customer_email IS NOT NULL GROUP BY lower(customer_email))`).bind(start).first(),
            db.prepare(`SELECT COUNT(*) AS appointments_total,
                SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS appointments_pending,
                SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS appointments_completed,
                SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS appointments_cancelled,
                COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS service_revenue
                FROM appointments a LEFT JOIN services s ON s.id = a.service_id
                WHERE a.created_at >= ? AND a.created_at <= ?`).bind(start, end).first(),
        ]);
        const refunds = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS refund_total FROM order_refund_logs WHERE created_at >= ? AND created_at <= ? AND status = 'completed'`)
            .bind(start, end).first();
        return json({ kpi: { ...orders, ...customers, ...appointments, refund_total: number(refunds?.refund_total) } });
    } catch (error) {
        return apiError(error, 'Could not load dashboard KPI.');
    }
}

export async function getDashboardTimeseries(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const url = new URL(request.url);
        const { start, end } = dateRange(url);
        const granularity = url.searchParams.get('granularity') === 'week' ? 'week' : 'day';
        const bucket = granularity === 'week' ? "strftime('%Y-W%W', created_at)" : "substr(created_at, 1, 10)";
        const [orders, appointments] = await Promise.all([
            db.prepare(`SELECT ${bucket} AS bucket_start, COUNT(*) AS total_orders,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN grand_total ELSE 0 END), 0) AS gross_revenue,
                COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'refunded') THEN grand_total ELSE 0 END), 0) AS net_revenue
                FROM product_orders WHERE created_at >= ? AND created_at <= ? GROUP BY bucket_start ORDER BY bucket_start`).bind(start, end).all(),
            db.prepare(`SELECT ${bucket} AS bucket_start, COUNT(*) AS appointments_total FROM appointments WHERE created_at >= ? AND created_at <= ? GROUP BY bucket_start`).bind(start, end).all(),
        ]);
        const appointmentMap = new Map((appointments.results || []).map((row) => [row.bucket_start, number(row.appointments_total)]));
        const rows = (orders.results || []).map((row) => ({ ...row, refund_total: 0, appointments_total: appointmentMap.get(row.bucket_start) || 0 }));
        return json({ timeseries: rows });
    } catch (error) {
        return apiError(error, 'Could not load dashboard timeseries.');
    }
}

export async function getInventoryMetrics(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const metrics = await db.prepare(`SELECT COUNT(*) AS total_products,
            SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) AS published_products,
            SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) AS featured_products,
            SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END) AS hidden_products,
            SUM(CASE WHEN stock_quantity > low_stock_threshold THEN 1 ELSE 0 END) AS in_stock_products,
            SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low_stock_products,
            SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_products,
            SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= date('now', '+90 day') THEN 1 ELSE 0 END) AS near_expiry_products,
            SUM(CASE WHEN sku IS NULL OR trim(sku) = '' THEN 1 ELSE 0 END) AS no_sku_products,
            COALESCE(SUM(stock_quantity * price), 0) AS inventory_estimated_value
            FROM products WHERE archived_at IS NULL`).first();
        return json({ inventory: metrics || {} });
    } catch (error) {
        return apiError(error, 'Could not load inventory metrics.');
    }
}

export async function getTopProducts(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const url = new URL(request.url);
        const { start, end } = dateRange(url);
        const limit = boundedInteger(url.searchParams.get('limit'), 10, 1, 50);
        const result = await db.prepare(`SELECT i.product_id, i.product_name, COALESCE(p.brand, '') AS brand,
            SUM(i.quantity) AS units_sold, COUNT(DISTINCT i.order_id) AS order_count,
            SUM(i.quantity * i.price_at_purchase) AS gross_revenue
            FROM product_order_items i JOIN product_orders o ON o.id = i.order_id
            LEFT JOIN products p ON p.id = i.product_id
            WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'refunded')
            GROUP BY i.product_id, i.product_name, p.brand ORDER BY units_sold DESC, gross_revenue DESC LIMIT ?`)
            .bind(start, end, limit).all();
        return json({ products: result.results || [] });
    } catch (error) {
        return apiError(error, 'Could not load top products.');
    }
}

export async function getServicePerformance(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const url = new URL(request.url);
        const { start, end } = dateRange(url);
        const limit = boundedInteger(url.searchParams.get('limit'), 10, 1, 50);
        const result = await db.prepare(`SELECT s.id AS service_id, s.name AS service_name,
            COUNT(a.id) AS appointment_count,
            SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
            SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS realized_revenue
            FROM services s LEFT JOIN appointments a ON a.service_id = s.id AND a.created_at >= ? AND a.created_at <= ?
            GROUP BY s.id, s.name ORDER BY appointment_count DESC, realized_revenue DESC LIMIT ?`).bind(start, end, limit).all();
        return json({ services: result.results || [] });
    } catch (error) {
        return apiError(error, 'Could not load service performance.');
    }
}

export async function getCustomerMetrics(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const url = new URL(request.url);
        const { start, end } = dateRange(url);
        const limit = boundedInteger(url.searchParams.get('limit'), 25, 1, 200);
        const offset = boundedInteger(url.searchParams.get('offset'), 0, 0, 100000);
        const result = await db.prepare(`SELECT u.id AS patient_id, COALESCE(u.display_name, '') AS name, u.email, COALESCE(u.phone, '') AS phone, u.created_at,
            COUNT(DISTINCT o.id) AS total_orders, COALESCE(SUM(o.grand_total), 0) AS total_spent,
            COALESCE(AVG(o.grand_total), 0) AS average_order_value, MIN(o.created_at) AS first_order_at, MAX(o.created_at) AS last_order_at,
            COUNT(DISTINCT a.id) AS total_appointments, MAX(a.created_at) AS last_appointment_at,
            COUNT(DISTINCT CASE WHEN o.created_at >= ? AND o.created_at <= ? THEN o.id END) AS orders_in_period,
            COALESCE(SUM(CASE WHEN o.created_at >= ? AND o.created_at <= ? THEN o.grand_total ELSE 0 END), 0) AS spent_in_period
            FROM users u LEFT JOIN product_orders o ON o.user_id = u.id AND o.status NOT IN ('cancelled', 'refunded')
            LEFT JOIN appointments a ON a.user_id = u.id GROUP BY u.id
            ORDER BY total_spent DESC, u.created_at DESC LIMIT ? OFFSET ?`).bind(start, end, start, end, limit, offset).all();
        return json({ customers: (result.results || []).map((row) => ({
            ...row,
            segment: number(row.total_orders) > 1 ? 'returning_customer' : number(row.total_orders) > 0 ? 'first_time_customer' : 'lead_only_customer',
            is_at_risk: Boolean(row.last_order_at && new Date(row.last_order_at).getTime() < Date.now() - 90 * 86400000),
            is_returning: number(row.total_orders) > 1,
        })) });
    } catch (error) {
        return apiError(error, 'Could not load customer metrics.');
    }
}

export async function getAppointmentsDrilldown(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const url = new URL(request.url);
        const start = url.searchParams.get('fromDate') || '1970-01-01';
        const end = url.searchParams.get('toDate') || '9999-12-31';
        const status = url.searchParams.get('status');
        const serviceId = Number(url.searchParams.get('serviceId') || 0);
        const doctorId = url.searchParams.get('doctorId') || '';
        const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
        const limit = boundedInteger(url.searchParams.get('limit'), 200, 1, 500);
        const offset = boundedInteger(url.searchParams.get('offset'), 0, 0, 100000);
        const result = await db.prepare(`SELECT a.id, a.user_id AS patient_id, a.customer_name AS patient_name,
            a.customer_email AS patient_email, a.customer_phone AS patient_phone, a.doctor_id,
            COALESCE(d.display_name, '') AS doctor_name, a.service_id, COALESCE(s.name, '') AS service_name,
            a.appointment_date AS date, a.appointment_time AS time, a.notes, a.status, a.created_at, a.updated_at,
            0 AS invoice_total_amount, '' AS invoice_payment_status, '' AS invoice_payment_method, NULL AS invoice_payment_date
            FROM appointments a LEFT JOIN services s ON s.id = a.service_id LEFT JOIN users d ON d.id = a.doctor_id
            WHERE a.appointment_date >= ? AND a.appointment_date <= ?
              AND (? = '' OR a.status = ?) AND (? = 0 OR a.service_id = ?) AND (? = '' OR a.doctor_id = ?)
              AND (? = '%%' OR a.customer_name LIKE ? OR a.customer_email LIKE ? OR a.customer_phone LIKE ?)
            ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`)
            .bind(start, end, status || '', status || '', serviceId, serviceId, doctorId, doctorId, search, search, search, search, limit, offset).all();
        return json({ appointments: result.results || [] });
    } catch (error) {
        return apiError(error, 'Could not load appointments.');
    }
}

export async function getAlerts(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const limit = boundedInteger(new URL(request.url).searchParams.get('limit'), 25, 1, 100);
        const result = await db.prepare(`SELECT * FROM (
            SELECT 'stock-' || id AS alert_key, 'inventory' AS alert_type,
                   CASE WHEN stock_quantity = 0 THEN 'high' ELSE 'medium' END AS severity,
                   name AS title,
                   CASE WHEN stock_quantity = 0 THEN 'Sản phẩm đã hết hàng' ELSE 'Sản phẩm sắp hết hàng' END AS description,
                   'product' AS ref_type, CAST(id AS TEXT) AS ref_id, updated_at AS created_at
            FROM products WHERE archived_at IS NULL AND stock_quantity <= low_stock_threshold
            UNION ALL
            SELECT 'shipping-' || s.id, 'shipping', 'high', COALESCE(o.order_code, s.order_id),
                   COALESCE(s.last_error, 'Tác vụ vận chuyển thất bại'), 'order', s.order_id, s.updated_at
            FROM shipping_outbox s LEFT JOIN product_orders o ON o.id = s.order_id
            WHERE s.status = 'failed'
            UNION ALL
            SELECT 'email-' || id, 'email', 'medium', event_type,
                   COALESCE(last_error, 'Email gửi thất bại'), aggregate_type, aggregate_id, updated_at
            FROM notification_outbox WHERE status IN ('failed', 'delivery_unknown')
        ) ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
        return json({ alerts: result.results || [] });
    } catch (error) {
        return apiError(error, 'Could not load alerts.');
    }
}

export async function saveProductCategory(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 64 * 1024);
        const now = new Date().toISOString();
        const requestedId = Math.trunc(number(body.id));
        const id = requestedId > 0 ? requestedId : number((await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM product_categories').first())?.id);
        const slug = text(body.slug, 255);
        const name = text(body.name, 500);
        if (!slug || !name) throw Object.assign(new Error('Tên và slug danh mục là bắt buộc.'), { status: 400 });
        await db.prepare(`INSERT INTO product_categories (
            id, slug, name, name_en, name_ru, name_cn, description, description_en,
            description_ru, description_cn, image_path, is_featured, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name,
            name_en = excluded.name_en, name_ru = excluded.name_ru, name_cn = excluded.name_cn,
            description = excluded.description, description_en = excluded.description_en,
            description_ru = excluded.description_ru, description_cn = excluded.description_cn,
            image_path = excluded.image_path, is_featured = excluded.is_featured,
            display_order = excluded.display_order, updated_at = excluded.updated_at`)
            .bind(id, slug, name, nullableText(body.name_en, 500), nullableText(body.name_ru, 500), nullableText(body.name_cn, 500),
                nullableText(body.description, 10000), nullableText(body.description_en, 10000),
                nullableText(body.description_ru, 10000), nullableText(body.description_cn, 10000),
                nullableText(body.image_path, 2000), boolInt(body.is_featured), Math.trunc(number(body.display_order)), now, now).run();
        const category = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(id).first();
        return json({ category: { ...category, is_featured: Boolean(category?.is_featured) } });
    } catch (error) {
        return apiError(error, 'Could not save product category.');
    }
}

export async function listProductCategories(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const { page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        const where = query ? 'WHERE c.name LIKE ? OR c.slug LIKE ?' : '';
        const values = query ? [pattern, pattern] : [];
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM product_categories c ${where}`).bind(...values).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM product_categories c ${where}`).bind(...values).first(),
            db.prepare(`SELECT c.*, COUNT(p.id) AS product_count FROM product_categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.archived_at IS NULL ${where}
                GROUP BY c.id ORDER BY c.display_order, c.name COLLATE NOCASE LIMIT ? OFFSET ?`)
                .bind(...values, pageSize, offset).all(),
        ]);
        const categories = (rows.results || []).map((row) => ({ ...row, is_featured: Boolean(row.is_featured), product_count: number(row.product_count) }));
        return json(listPayload(categories, { page, pageSize, total: number(countRow?.total), revision: revisionValue(revisionRow?.revision) }, 'categories'));
    } catch (error) {
        return apiError(error, 'Could not load product categories.');
    }
}

export async function deleteProductCategory(request, env, categoryId) {
    try {
        const { db } = await requireAdmin(request, env, true);
        await db.prepare('DELETE FROM product_categories WHERE id = ?').bind(Math.trunc(number(categoryId))).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete product category.');
    }
}

export async function saveProductBrand(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 64 * 1024);
        const now = new Date().toISOString();
        let id = text(body.id, 100);
        if (!id || id === '0') {
            id = String(number((await db.prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS id FROM product_brands').first())?.id));
        }
        const slug = text(body.slug, 255);
        const name = text(body.name, 500);
        if (!slug || !name) throw Object.assign(new Error('Tên và slug thương hiệu là bắt buộc.'), { status: 400 });
        const existing = await db.prepare('SELECT name, created_at FROM product_brands WHERE id = ?').bind(id).first();
        const statements = [db.prepare(`INSERT INTO product_brands (
            id, slug, name, description, logo_path, is_active, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name,
            description = excluded.description, logo_path = excluded.logo_path,
            is_active = excluded.is_active, display_order = excluded.display_order,
            updated_at = excluded.updated_at`).bind(
            id, slug, name, nullableText(body.description, 20000), nullableText(body.logo_path, 2000),
            boolInt(body.is_active, true), Math.trunc(number(body.display_order)), existing?.created_at || now, now,
        )];
        if (existing?.name && existing.name !== name) {
            statements.push(db.prepare('UPDATE products SET brand = ?, updated_at = ? WHERE brand = ?').bind(name, now, existing.name));
        }
        await db.batch(statements);
        const brand = await db.prepare('SELECT * FROM product_brands WHERE id = ?').bind(id).first();
        return json({ brand: { ...brand, id: Number.isSafeInteger(Number(brand?.id)) ? Number(brand.id) : brand?.id, is_active: Boolean(brand?.is_active) } });
    } catch (error) {
        return apiError(error, 'Could not save product brand.');
    }
}

export async function listProductBrands(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const { page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        const where = query ? 'WHERE b.name LIKE ? OR b.slug LIKE ?' : '';
        const values = query ? [pattern, pattern] : [];
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM product_brands b ${where}`).bind(...values).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM product_brands b ${where}`).bind(...values).first(),
            db.prepare(`SELECT b.*, COUNT(p.id) AS product_count FROM product_brands b
                LEFT JOIN products p ON p.brand = b.name COLLATE NOCASE AND p.archived_at IS NULL ${where}
                GROUP BY b.id ORDER BY b.display_order, b.name COLLATE NOCASE LIMIT ? OFFSET ?`)
                .bind(...values, pageSize, offset).all(),
        ]);
        const brands = (rows.results || []).map((row) => ({
            ...row,
            id: Number.isSafeInteger(Number(row.id)) ? Number(row.id) : row.id,
            is_active: Boolean(row.is_active),
            product_count: number(row.product_count),
        }));
        return json(listPayload(brands, { page, pageSize, total: number(countRow?.total), revision: revisionValue(revisionRow?.revision) }, 'brands'));
    } catch (error) {
        return apiError(error, 'Could not load product brands.');
    }
}

export async function renameProductBrand(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 16 * 1024);
        const oldName = text(body.oldName, 500);
        const newName = text(body.newName, 500);
        if (!oldName || !newName) throw Object.assign(new Error('Tên thương hiệu là bắt buộc.'), { status: 400 });
        await db.prepare('UPDATE products SET brand = ?, updated_at = ? WHERE brand = ?').bind(newName, new Date().toISOString(), oldName).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not rename product brand.');
    }
}

export async function deleteProductBrand(request, env, brandId) {
    try {
        const { db } = await requireAdmin(request, env, true);
        await db.prepare('DELETE FROM product_brands WHERE id = ?').bind(String(brandId)).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete product brand.');
    }
}

function discountRow(row) {
    return row ? { ...row, is_active: Boolean(row.is_active) } : row;
}

export async function listDiscountCodes(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const rows = await db.prepare('SELECT * FROM discount_codes ORDER BY created_at DESC').all();
        return json({ discountCodes: (rows.results || []).map(discountRow) });
    } catch (error) {
        return apiError(error, 'Could not load discount codes.');
    }
}

export async function saveDiscountCode(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 32 * 1024);
        const code = text(body.code, 100).toUpperCase();
        const type = body.type === 'fixed_amount' ? 'fixed_amount' : body.type === 'percentage' ? 'percentage' : '';
        const value = number(body.value);
        if (!code || !type || value < 0) throw Object.assign(new Error('Mã, loại và giá trị giảm là bắt buộc.'), { status: 400 });
        const id = text(body.id, 100) || crypto.randomUUID();
        const now = new Date().toISOString();
        const existing = await db.prepare('SELECT created_at, usage_count FROM discount_codes WHERE id = ?').bind(id).first();
        await db.prepare(`INSERT INTO discount_codes (
            id, code, type, value, min_purchase_amount, max_discount_amount, starts_at, ends_at,
            usage_limit, usage_limit_per_user, usage_count, is_active, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET code = excluded.code, type = excluded.type, value = excluded.value,
            min_purchase_amount = excluded.min_purchase_amount, max_discount_amount = excluded.max_discount_amount,
            starts_at = excluded.starts_at, ends_at = excluded.ends_at, usage_limit = excluded.usage_limit,
            usage_limit_per_user = excluded.usage_limit_per_user, is_active = excluded.is_active,
            description = excluded.description, updated_at = excluded.updated_at`).bind(
            id, code, type, value, Math.max(0, Math.round(number(body.min_purchase_amount))),
            body.max_discount_amount == null ? null : Math.max(0, Math.round(number(body.max_discount_amount))),
            nullableText(body.starts_at, 100), nullableText(body.ends_at, 100),
            body.usage_limit == null ? null : Math.max(0, Math.trunc(number(body.usage_limit))),
            body.usage_limit_per_user == null ? null : Math.max(0, Math.trunc(number(body.usage_limit_per_user))),
            number(existing?.usage_count), boolInt(body.is_active, true), nullableText(body.description, 2000),
            existing?.created_at || now, now,
        ).run();
        return json({ discountCode: discountRow(await db.prepare('SELECT * FROM discount_codes WHERE id = ?').bind(id).first()) });
    } catch (error) {
        return apiError(error, 'Could not save discount code.');
    }
}

export async function deleteDiscountCode(request, env, id) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const used = await db.prepare('SELECT COUNT(*) AS count FROM discount_redemptions WHERE discount_code_id = ?').bind(id).first();
        if (number(used?.count) > 0) {
            await db.prepare('UPDATE discount_codes SET is_active = 0, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
        } else {
            await db.prepare('DELETE FROM discount_codes WHERE id = ?').bind(id).run();
        }
        return json({ ok: true, outcome: number(used?.count) > 0 ? 'disabled' : 'deleted' });
    } catch (error) {
        return apiError(error, 'Could not delete discount code.');
    }
}

function taxProfileRow(row, rates = []) {
    return row ? {
        ...row,
        applies_to_shipping: Boolean(row.applies_to_shipping),
        is_active: Boolean(row.is_active),
        is_default: Boolean(row.is_default),
        rates,
    } : row;
}

function taxRateRow(row) {
    return row ? {
        ...row,
        applies_to_shipping: row.applies_to_shipping == null ? null : Boolean(row.applies_to_shipping),
        is_active: Boolean(row.is_active),
    } : row;
}

export async function listTaxProfiles(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const [profiles, rates] = await Promise.all([
            db.prepare('SELECT * FROM tax_profiles ORDER BY is_default DESC, created_at').all(),
            db.prepare('SELECT * FROM tax_rates ORDER BY tax_profile_id, priority DESC, created_at').all(),
        ]);
        const byProfile = new Map();
        for (const row of rates.results || []) {
            const list = byProfile.get(row.tax_profile_id) || [];
            list.push(taxRateRow(row));
            byProfile.set(row.tax_profile_id, list);
        }
        return json({ taxProfiles: (profiles.results || []).map((row) => taxProfileRow(row, byProfile.get(row.id) || [])) });
    } catch (error) {
        return apiError(error, 'Could not load tax profiles.');
    }
}

export async function saveTaxProfile(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 32 * 1024);
        const code = text(body.code, 100).toUpperCase();
        const name = text(body.name, 255);
        const rate = number(body.default_rate);
        if (!code || !name || rate < 0 || rate > 1) throw Object.assign(new Error('Hồ sơ thuế không hợp lệ.'), { status: 400 });
        const id = text(body.id, 100) || crypto.randomUUID();
        const now = new Date().toISOString();
        const existing = await db.prepare('SELECT created_at FROM tax_profiles WHERE id = ?').bind(id).first();
        const statements = [];
        if (boolInt(body.is_default)) statements.push(db.prepare('UPDATE tax_profiles SET is_default = 0, updated_at = ? WHERE id != ?').bind(now, id));
        statements.push(db.prepare(`INSERT INTO tax_profiles (
            id, code, name, tax_mode, default_rate, applies_to_shipping, currency,
            is_active, is_default, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name,
            tax_mode = excluded.tax_mode, default_rate = excluded.default_rate,
            applies_to_shipping = excluded.applies_to_shipping, currency = excluded.currency,
            is_active = excluded.is_active, is_default = excluded.is_default,
            starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = excluded.updated_at`).bind(
            id, code, name, body.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive', rate,
            boolInt(body.applies_to_shipping), text(body.currency || 'VND', 10).toUpperCase(),
            boolInt(body.is_active, true), boolInt(body.is_default), nullableText(body.starts_at, 100),
            nullableText(body.ends_at, 100), existing?.created_at || now, now,
        ));
        await db.batch(statements);
        return json({ taxProfile: taxProfileRow(await db.prepare('SELECT * FROM tax_profiles WHERE id = ?').bind(id).first()) });
    } catch (error) {
        return apiError(error, 'Could not save tax profile.');
    }
}

export async function deleteTaxProfile(request, env, id) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const existing = await db.prepare('SELECT is_default FROM tax_profiles WHERE id = ?').bind(id).first();
        await db.prepare('DELETE FROM tax_profiles WHERE id = ?').bind(id).run();
        if (existing?.is_default) {
            const next = await db.prepare('SELECT id FROM tax_profiles WHERE is_active = 1 ORDER BY created_at LIMIT 1').first();
            if (next) await db.prepare('UPDATE tax_profiles SET is_default = 1, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), next.id).run();
        }
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete tax profile.');
    }
}

export async function saveTaxRate(request, env) {
    try {
        const { db } = await requireAdmin(request, env, true);
        const body = await readJson(request, 32 * 1024);
        const profileId = text(body.tax_profile_id, 100);
        const rate = number(body.rate);
        if (!profileId || rate < 0 || rate > 1) throw Object.assign(new Error('Mức thuế không hợp lệ.'), { status: 400 });
        const id = text(body.id, 100) || crypto.randomUUID();
        const now = new Date().toISOString();
        const existing = await db.prepare('SELECT created_at FROM tax_rates WHERE id = ?').bind(id).first();
        await db.prepare(`INSERT INTO tax_rates (
            id, tax_profile_id, province, district, rate, applies_to_shipping, currency,
            priority, is_active, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET tax_profile_id = excluded.tax_profile_id,
            province = excluded.province, district = excluded.district, rate = excluded.rate,
            applies_to_shipping = excluded.applies_to_shipping, currency = excluded.currency,
            priority = excluded.priority, is_active = excluded.is_active,
            starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = excluded.updated_at`).bind(
            id, profileId, nullableText(body.province, 255), nullableText(body.district, 255), rate,
            body.applies_to_shipping == null ? null : boolInt(body.applies_to_shipping),
            nullableText(body.currency, 10)?.toUpperCase() || null, Math.trunc(number(body.priority)),
            boolInt(body.is_active, true), nullableText(body.starts_at, 100), nullableText(body.ends_at, 100),
            existing?.created_at || now, now,
        ).run();
        return json({ taxRate: taxRateRow(await db.prepare('SELECT * FROM tax_rates WHERE id = ?').bind(id).first()) });
    } catch (error) {
        return apiError(error, 'Could not save tax rate.');
    }
}

export async function deleteTaxRate(request, env, id) {
    try {
        const { db } = await requireAdmin(request, env, true);
        await db.prepare('DELETE FROM tax_rates WHERE id = ?').bind(id).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete tax rate.');
    }
}

function reportSchedule(row) {
    return { ...row, enabled: Boolean(row.enabled), recipients: parseJson(row.recipients_json, []) };
}

export async function listReportSchedules(request, env) {
    try {
        const { db } = await requireAdmin(request, env);
        const result = await db.prepare('SELECT * FROM admin_report_schedules ORDER BY created_at DESC').all();
        return json({ schedules: (result.results || []).map(reportSchedule) });
    } catch (error) {
        return apiError(error, 'Could not load report schedules.');
    }
}

export async function saveReportSchedule(request, env) {
    try {
        const { db, session } = await requireAdmin(request, env, true);
        const body = await readJson(request, 32 * 1024);
        const recipients = Array.from(new Set((Array.isArray(body.recipients) ? body.recipients : [])
            .map((value) => String(value || '').trim().toLowerCase()).filter((value) => EMAIL_PATTERN.test(value))));
        const name = String(body.name || '').trim().slice(0, 200);
        const preset = REPORT_PRESETS.has(body.preset) ? body.preset : '30d';
        const frequency = REPORT_FREQUENCIES.has(body.frequency) ? body.frequency : 'daily';
        if (!name || !recipients.length) throw Object.assign(new Error('Tên và email nhận báo cáo là bắt buộc.'), { status: 400 });
        const id = String(body.id || crypto.randomUUID());
        const now = new Date();
        const nextRunAt = new Date(now.getTime() + (frequency === 'weekly' ? 7 : 1) * 86400000).toISOString();
        await db.prepare(`INSERT INTO admin_report_schedules (
            id, name, preset, frequency, day_of_week, hour_local, minute_local, timezone,
            recipients_json, enabled, next_run_at, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, preset = excluded.preset,
            frequency = excluded.frequency, day_of_week = excluded.day_of_week,
            hour_local = excluded.hour_local, minute_local = excluded.minute_local,
            timezone = excluded.timezone, recipients_json = excluded.recipients_json,
            enabled = excluded.enabled, next_run_at = excluded.next_run_at,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
            .bind(
                id, name, preset, frequency,
                frequency === 'weekly' ? boundedInteger(body.dayOfWeek, 1, 0, 6) : null,
                boundedInteger(body.hourLocal, 8, 0, 23), boundedInteger(body.minuteLocal, 0, 0, 59),
                String(body.timezone || 'Asia/Ho_Chi_Minh').slice(0, 100), JSON.stringify(recipients),
                body.enabled === false ? 0 : 1, nextRunAt, session.user_id, session.user_id,
                now.toISOString(), now.toISOString(),
            ).run();
        const saved = await db.prepare('SELECT * FROM admin_report_schedules WHERE id = ?').bind(id).first();
        return json({ schedule: reportSchedule(saved) });
    } catch (error) {
        return apiError(error, 'Could not save report schedule.');
    }
}

export async function deleteReportSchedule(request, env, id) {
    try {
        const { db } = await requireAdmin(request, env, true);
        await db.prepare('DELETE FROM admin_report_schedules WHERE id = ?').bind(id).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete report schedule.');
    }
}
