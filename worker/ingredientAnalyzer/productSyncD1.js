import { createPublicCache, finalizePublicCacheResponse } from '../publicRuntime/cache.js';
import { analyzeIngredients, parseInciText } from './analyzer.js';
import { fetchIngredientRowsD1, getIngredientD1Databases } from './handlersD1.js';
import { requireCsrf, requireRole } from '../auth/session.js';

const ANALYSIS_VERSION = 1;
const PUBLIC_SNAPSHOT_HEADERS = {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300, stale-if-error=3600',
    'X-Robots-Tag': 'noindex, nofollow',
};

function getProductInciText(product) {
    return String(product?.ingredients || '').trim() || String(product?.inci_text || '').trim();
}

async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeRequestedLanguage(value) {
    const lang = String(value || 'vi').toLowerCase();
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('zh') || lang.startsWith('cn')) return 'cn';
    return 'vi';
}

export async function syncD1ProductIngredientSnapshots(env, options = {}) {
    if (!env.APP_DB || !getIngredientD1Databases(env).length) {
        return { selected: 0, synced: 0, failed: 0, errors: [], skipped: true };
    }
    const productLimit = Math.max(1, Math.min(Number(options.productLimit || 12), 30));
    const requestedIds = Array.from(new Set((options.productIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 30);
    const idFilter = requestedIds.length ? `AND p.id IN (${requestedIds.map(() => '?').join(',')})` : '';
    const result = requestedIds.length
        ? await env.APP_DB.prepare(`SELECT p.id, p.inci_text, p.ingredients, p.updated_at,
            d.generation AS dirty_generation FROM products p
            LEFT JOIN product_ingredient_dirty d ON d.product_id = p.id
            WHERE p.is_published = 1
              AND trim(COALESCE(NULLIF(trim(p.ingredients), ''), NULLIF(trim(p.inci_text), ''), '')) <> ''
              ${idFilter} ORDER BY p.updated_at ASC LIMIT ?`).bind(...requestedIds, productLimit).all()
        : await env.APP_DB.prepare(`SELECT p.id, p.inci_text, p.ingredients, p.updated_at,
            d.generation AS dirty_generation
            FROM (SELECT product_id, generation FROM product_ingredient_dirty ORDER BY product_id LIMIT ?) d
            JOIN products p ON p.id = d.product_id`).bind(productLimit).all();
    const products = result.results || [];
    const summary = { selected: products.length, synced: 0, failed: 0, errors: [], skipped: false };
    for (const product of products) {
        try {
            const inciText = getProductInciText(product);
            const rawNames = parseInciText(inciText);
            const rows = await fetchIngredientRowsD1(env, rawNames);
            const analysis = {
                ...analyzeIngredients(inciText, { rows }),
                meta: { source: 'cloudflare-d1-snapshot', matched_rows: rows.length, lang: 'vi' },
            };
            const hash = await sha256(inciText);
            const now = new Date().toISOString();
            await env.APP_DB.prepare(`INSERT INTO product_ingredient_snapshots (
                product_id, inci_text, inci_hash, analysis_json, recognized_count, total_count,
                analyzer_version, source_updated_at, analyzed_at, updated_at
            ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND is_published = 1
                AND updated_at = ? AND ingredients IS ? AND inci_text IS ?)
            ON CONFLICT(product_id) DO UPDATE SET inci_text=excluded.inci_text, inci_hash=excluded.inci_hash,
                analysis_json=excluded.analysis_json, recognized_count=excluded.recognized_count,
                total_count=excluded.total_count, analyzer_version=excluded.analyzer_version,
                source_updated_at=excluded.source_updated_at, analyzed_at=excluded.analyzed_at, updated_at=excluded.updated_at`)
                .bind(product.id, inciText, hash, JSON.stringify(analysis), analysis.summary?.recognized || 0,
                    analysis.summary?.total || rawNames.length, String(ANALYSIS_VERSION), product.updated_at, now, now,
                    product.id, product.updated_at, product.ingredients ?? null, product.inci_text ?? null).run();
            if (product.dirty_generation != null) {
                await env.APP_DB.prepare(`DELETE FROM product_ingredient_dirty
                    WHERE product_id = ? AND generation = ?`)
                    .bind(product.id, product.dirty_generation).run();
            }
            summary.synced += 1;
        } catch (error) {
            summary.failed += 1;
            summary.errors.push({ productId: product.id, message: error instanceof Error ? error.message : String(error) });
        }
    }
    return summary;
}

export async function handleProductIngredientSnapshot(request, productKey, env, deps = {}) {
    const { jsonResponse } = deps;
    const cache = createPublicCache(env, deps.edgeCache || globalThis.caches?.default);
    const hit = await cache.readEdgeCache(request);
    if (hit) return finalizePublicCacheResponse(hit);
    if (!env.APP_DB) return jsonResponse({ error: 'APP_DB is not configured.' }, 503);
    const isNumeric = /^\d+$/.test(String(productKey || ''));
    let snapshot = await env.APP_DB.prepare(`SELECT s.*, p.slug FROM product_ingredient_snapshots s
        JOIN products p ON p.id = s.product_id WHERE ${isNumeric ? 'p.id' : 'p.slug'} = ? AND p.is_published = 1 LIMIT 1`)
        .bind(isNumeric ? Number(productKey) : String(productKey)).first();
    if (!snapshot) {
        const product = await env.APP_DB.prepare(`SELECT id FROM products
            WHERE ${isNumeric ? 'id' : 'slug'} = ? AND is_published = 1 LIMIT 1`)
            .bind(isNumeric ? Number(productKey) : String(productKey)).first();
        if (product?.id) {
            const summary = await syncD1ProductIngredientSnapshots(env, { productIds: [Number(product.id)], productLimit: 1 });
            if (summary.synced) snapshot = await env.APP_DB.prepare(`SELECT s.*, p.slug FROM product_ingredient_snapshots s
                JOIN products p ON p.id = s.product_id WHERE p.id = ? AND p.is_published = 1 LIMIT 1`).bind(Number(product.id)).first();
        }
    }
    if (!snapshot) return jsonResponse({ error: 'Product ingredient snapshot not found.' }, 404, { 'Cache-Control': 'no-store' });
    const analysis = JSON.parse(snapshot.analysis_json || '{}');
    const response = jsonResponse({
        ...analysis,
        meta: {
            ...(analysis.meta || {}), source: 'cloudflare-d1-snapshot', source_product_id: snapshot.product_id,
            source_updated_at: snapshot.source_updated_at, synced_at: snapshot.updated_at,
            analysis_version: snapshot.analyzer_version,
            lang: normalizeRequestedLanguage(new URL(request.url).searchParams.get('lang')),
        },
    }, 200, { ...PUBLIC_SNAPSHOT_HEADERS, ETag: `"${snapshot.inci_hash}-${snapshot.analyzer_version}"`, 'X-Ingredient-Snapshot-Cache': 'MISS' });
    await cache.writeEdgeCache(request, response, deps.ctx);
    return finalizePublicCacheResponse(response);
}

export async function handleProductIngredientSync(request, env, deps = {}) {
    const { jsonResponse } = deps;
    try {
        const session = await requireRole(env.APP_DB, request, ['admin', 'master_admin', 'doctor']);
        await requireCsrf(env.APP_DB, request, session);
    } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : 'Forbidden.' }, Number(error?.status || 403));
    }
    const payload = await request.json().catch(() => null);
    const productIds = Array.from(new Set([
        payload?.productId,
        ...(Array.isArray(payload?.productIds) ? payload.productIds : []),
    ].map(Number).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 20);
    if (!productIds.length) return jsonResponse({ error: 'productId is required.' }, 400);
    const summary = await syncD1ProductIngredientSnapshots(env, { productIds, productLimit: productIds.length });
    if (summary.failed) return jsonResponse({ error: 'Không thể đồng bộ một số INCI sản phẩm.', ...summary }, 502);
    return jsonResponse({ synced: summary.synced, results: summary }, 200, { 'Cache-Control': 'no-store' });
}
