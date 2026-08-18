import { analyzeIngredients, parseInciText } from './analyzer.js';
import {
    fetchIngredientRows,
    fetchIngredientRowsD1,
    getIngredientD1Databases,
    getIngredientSupabaseConfig,
    ingredientRestHeaders,
    ingredientRestUrl,
} from './handlers.js';
import { requireCsrf, requireRole } from '../auth/session.js';

const DEFAULT_SOURCE_PROJECT = 'thegioitrimun.vn';
const ANALYSIS_VERSION = 1;
const PRODUCT_SELECT = [
    'id',
    'slug',
    'sku',
    'name',
    'name_en',
    'name_ru',
    'name_cn',
    'ingredients',
    'ingredients_en',
    'ingredients_ru',
    'ingredients_cn',
    'brand',
    'category_id',
    'is_published',
    'archived_at',
    'created_at',
    'updated_at',
].join(',');

const SNAPSHOT_SELECT = [
    'source_product_id',
    'slug',
    'name',
    'ingredients',
    'inci_hash',
    'analysis_by_lang',
    'analysis_version',
    'source_updated_at',
    'synced_at',
].join(',');

const PUBLIC_SNAPSHOT_HEADERS = {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300, stale-if-error=3600',
    'X-Robots-Tag': 'noindex, nofollow',
};

function getProductInciText(product) {
    const canonicalInci = String(product?.ingredients || '').trim();
    return canonicalInci || String(product?.inci_text || '').trim();
}

function normalizeBaseUrl(value) {
    return String(value || '').replace(/\/+$/, '');
}

function getPrimarySupabaseConfig(env = {}, deps = {}) {
    return {
        url: normalizeBaseUrl(
            deps.SUPABASE_URL ||
            env.SUPABASE_URL ||
            env.VITE_SUPABASE_URL,
        ),
        key: String(
            env.SUPABASE_SERVICE_ROLE_KEY ||
            env.SUPABASE_SECRET_KEY ||
            '',
        ),
    };
}

function getSourceProject(env = {}) {
    return String(env.PRODUCT_SOURCE_PROJECT || DEFAULT_SOURCE_PROJECT).trim() || DEFAULT_SOURCE_PROJECT;
}

function buildRestUrl(baseUrl, table, params = {}) {
    const url = new URL(`/rest/v1/${String(table || '').replace(/^\/+/, '')}`, `${baseUrl}/`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

function serviceHeaders(key, extra = {}) {
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        ...extra,
    };
}

async function readJson(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(payload?.message || payload?.error || `Upstream responded with ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}

function ensureSyncConfig(primaryConfig, ingredientConfig, requirePrimary = true) {
    if (requirePrimary && (!primaryConfig.url || !primaryConfig.key)) {
        throw new Error('Primary Supabase service configuration is missing.');
    }
    if (!ingredientConfig.url || !ingredientConfig.key) {
        throw new Error('Ingredient Supabase service configuration is missing.');
    }
}

async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function localizedInciEntries(product) {
    const candidates = [
        ['vi', product?.ingredients],
        ['en', product?.ingredients_en],
        ['ru', product?.ingredients_ru],
        ['cn', product?.ingredients_cn],
    ];
    const fallback = String(product?.ingredients || '').trim();

    return candidates
        .map(([lang, value]) => [lang, String(value || fallback).trim()])
        .filter(([, value]) => Boolean(value));
}

async function buildAnalysisByLanguage(product, ingredientConfig, signal) {
    const entries = localizedInciEntries(product);
    const analysesByInci = new Map();

    await Promise.all(entries.map(async ([, inciText]) => {
        if (analysesByInci.has(inciText)) return;
        const pending = (async () => {
            const rawNames = parseInciText(inciText);
            if (rawNames.length > 160) {
                throw new Error(`Product ${product.id} contains more than 160 INCI entries.`);
            }
            const rows = await fetchIngredientRows(ingredientConfig, rawNames, signal);
            return {
                ...analyzeIngredients(inciText, { rows }),
                meta: {
                    source: 'synced-product-snapshot',
                    matched_rows: rows.length,
                },
            };
        })();
        analysesByInci.set(inciText, pending);
        await pending;
    }));

    const analysisByLang = {};
    await Promise.all(entries.map(async ([lang, inciText]) => {
        analysisByLang[lang] = await analysesByInci.get(inciText);
    }));
    return analysisByLang;
}

async function fetchPrimaryProduct(primaryConfig, productId, fetchImpl = fetch) {
    const url = buildRestUrl(primaryConfig.url, 'products', {
        id: `eq.${Number(productId)}`,
        select: PRODUCT_SELECT,
        limit: 1,
    });
    const rows = await readJson(await fetchImpl(url, {
        headers: serviceHeaders(primaryConfig.key),
    }));
    return rows?.[0] || null;
}

async function fetchExistingSnapshot(ingredientConfig, sourceProject, productId, fetchImpl = fetch) {
    const url = ingredientRestUrl(ingredientConfig.url, 'product_ingredient_snapshots', {
        source_project: `eq.${sourceProject}`,
        source_product_id: `eq.${Number(productId)}`,
        select: 'inci_hash,analysis_by_lang,analysis_version',
        limit: 1,
    });
    const rows = await readJson(await fetchImpl(url, {
        headers: ingredientRestHeaders(ingredientConfig.key),
    }));
    return rows?.[0] || null;
}

async function deleteSnapshot(ingredientConfig, sourceProject, productId, fetchImpl = fetch) {
    const url = ingredientRestUrl(ingredientConfig.url, 'product_ingredient_snapshots', {
        source_project: `eq.${sourceProject}`,
        source_product_id: `eq.${Number(productId)}`,
    });
    await readJson(await fetchImpl(url, {
        method: 'DELETE',
        headers: ingredientRestHeaders(ingredientConfig.key),
    }));
}

async function upsertSnapshot(ingredientConfig, snapshot, fetchImpl = fetch) {
    const url = ingredientRestUrl(ingredientConfig.url, 'product_ingredient_snapshots', {
        on_conflict: 'source_project,source_product_id',
    });
    const rows = await readJson(await fetchImpl(url, {
        method: 'POST',
        headers: {
            ...ingredientRestHeaders(ingredientConfig.key),
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify([snapshot]),
    }));
    return rows?.[0] || snapshot;
}

async function markEvents(primaryConfig, params, updates, fetchImpl = fetch) {
    const url = buildRestUrl(primaryConfig.url, 'product_ingredient_sync_events', params);
    await readJson(await fetchImpl(url, {
        method: 'PATCH',
        headers: serviceHeaders(primaryConfig.key, {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        }),
        body: JSON.stringify(updates),
    }));
}

export async function syncProductIngredientSnapshot(productId, env = {}, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    const primaryConfig = getPrimarySupabaseConfig(env, deps);
    const ingredientConfig = getIngredientSupabaseConfig(env);
    ensureSyncConfig(primaryConfig, ingredientConfig, !deps.product);

    const sourceProject = getSourceProject(env);
    const product = deps.product || await fetchPrimaryProduct(primaryConfig, productId, fetchImpl);
    if (!product) {
        await deleteSnapshot(ingredientConfig, sourceProject, productId, fetchImpl);
        return { productId: Number(productId), action: 'deleted' };
    }

    const inciFields = {
        vi: String(product.ingredients || '').trim(),
        en: String(product.ingredients_en || '').trim(),
        ru: String(product.ingredients_ru || '').trim(),
        cn: String(product.ingredients_cn || '').trim(),
    };
    const inciHash = await sha256(JSON.stringify(inciFields));
    const existing = await fetchExistingSnapshot(
        ingredientConfig,
        sourceProject,
        product.id,
        fetchImpl,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('product ingredient sync timeout'), 15000);
    try {
        const canReuseAnalysis = existing?.inci_hash === inciHash
            && Number(existing?.analysis_version) === ANALYSIS_VERSION
            && existing?.analysis_by_lang
            && Object.keys(existing.analysis_by_lang).length > 0;
        const analysisByLang = canReuseAnalysis
            ? existing.analysis_by_lang
            : await buildAnalysisByLanguage(product, ingredientConfig, controller.signal);

        const snapshot = {
            source_project: sourceProject,
            source_product_id: Number(product.id),
            slug: String(product.slug || product.id),
            sku: product.sku || null,
            name: String(product.name || ''),
            name_en: product.name_en || null,
            name_ru: product.name_ru || null,
            name_cn: product.name_cn || null,
            ingredients: inciFields.vi,
            ingredients_en: inciFields.en || null,
            ingredients_ru: inciFields.ru || null,
            ingredients_cn: inciFields.cn || null,
            brand: product.brand || null,
            category_id: product.category_id == null ? null : Number(product.category_id),
            is_published: product.is_published === true,
            archived_at: product.archived_at || null,
            source_updated_at: product.updated_at || product.created_at || new Date().toISOString(),
            inci_hash: inciHash,
            analysis_by_lang: analysisByLang,
            analysis_version: ANALYSIS_VERSION,
            synced_at: new Date().toISOString(),
        };
        const saved = await upsertSnapshot(ingredientConfig, snapshot, fetchImpl);
        return {
            productId: Number(product.id),
            action: canReuseAnalysis ? 'metadata-updated' : 'analyzed',
            snapshot: saved,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function syncPendingProductIngredientEvents(env = {}, deps = {}, options = {}) {
    if (String(env.DATA_BACKEND || '').toLowerCase() === 'd1') {
        return syncD1ProductIngredientSnapshots(env, options);
    }
    const fetchImpl = deps.fetchImpl || fetch;
    const primaryConfig = getPrimarySupabaseConfig(env, deps);
    const ingredientConfig = getIngredientSupabaseConfig(env);
    ensureSyncConfig(primaryConfig, ingredientConfig);

    const eventLimit = Math.max(1, Math.min(Number(options.eventLimit || 80), 200));
    const productLimit = Math.max(1, Math.min(Number(options.productLimit || 12), 30));
    const eventsUrl = buildRestUrl(primaryConfig.url, 'product_ingredient_sync_events', {
        select: 'id,product_id,action,attempt_count,created_at',
        processed_at: 'is.null',
        order: 'created_at.asc',
        limit: eventLimit,
    });
    const events = await readJson(await fetchImpl(eventsUrl, {
        headers: serviceHeaders(primaryConfig.key),
    }));

    const grouped = new Map();
    for (const event of events || []) {
        const productId = Number(event.product_id);
        if (!Number.isFinite(productId)) continue;
        const bucket = grouped.get(productId) || [];
        bucket.push(event);
        grouped.set(productId, bucket);
        if (grouped.size >= productLimit) break;
    }

    const summary = { selected: grouped.size, synced: 0, failed: 0, errors: [] };
    for (const [productId, productEvents] of grouped) {
        const ids = productEvents.map((event) => Number(event.id)).filter(Number.isFinite);
        try {
            await syncProductIngredientSnapshot(productId, env, {
                ...deps,
                SUPABASE_URL: primaryConfig.url,
                fetchImpl,
            });
            await markEvents(primaryConfig, {
                id: `in.(${ids.join(',')})`,
            }, {
                processed_at: new Date().toISOString(),
                last_error: null,
            }, fetchImpl);
            summary.synced += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const attemptCount = Math.max(...productEvents.map((event) => Number(event.attempt_count || 0))) + 1;
            await markEvents(primaryConfig, {
                id: `in.(${ids.join(',')})`,
            }, {
                attempt_count: attemptCount,
                last_error: message.slice(0, 500),
            }, fetchImpl).catch(() => undefined);
            summary.failed += 1;
            summary.errors.push({ productId, message });
        }
    }
    return summary;
}

export async function syncD1ProductIngredientSnapshots(env, options = {}) {
    if (!env.APP_DB || !getIngredientD1Databases(env).length) {
        return { selected: 0, synced: 0, failed: 0, errors: [], skipped: true };
    }
    const productLimit = Math.max(1, Math.min(Number(options.productLimit || 12), 30));
    const requestedIds = Array.from(new Set((options.productIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 30);
    const idFilter = requestedIds.length ? `AND p.id IN (${requestedIds.map(() => '?').join(',')})` : '';
    const result = await env.APP_DB.prepare(`SELECT p.id, p.inci_text, p.ingredients, p.updated_at
        FROM products p LEFT JOIN product_ingredient_snapshots s ON s.product_id = p.id
        WHERE p.is_published = 1 AND trim(COALESCE(NULLIF(trim(p.ingredients), ''), NULLIF(trim(p.inci_text), ''), '')) <> ''
          ${idFilter}
          AND (${requestedIds.length ? '1 = 1' : 's.product_id IS NULL OR s.source_updated_at IS NULL OR s.source_updated_at <> p.updated_at'})
        ORDER BY p.updated_at ASC LIMIT ?`).bind(...requestedIds, productLimit).all();
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(product_id) DO UPDATE SET inci_text=excluded.inci_text, inci_hash=excluded.inci_hash,
                analysis_json=excluded.analysis_json, recognized_count=excluded.recognized_count,
                total_count=excluded.total_count, analyzer_version=excluded.analyzer_version,
                source_updated_at=excluded.source_updated_at, analyzed_at=excluded.analyzed_at, updated_at=excluded.updated_at`)
                .bind(product.id, inciText, hash, JSON.stringify(analysis), analysis.summary?.recognized || 0,
                    analysis.summary?.total || rawNames.length, String(ANALYSIS_VERSION), product.updated_at, now, now).run();
            summary.synced += 1;
        } catch (error) {
            summary.failed += 1;
            summary.errors.push({ productId: product.id, message: error instanceof Error ? error.message : String(error) });
        }
    }
    return summary;
}

function normalizeRequestedLanguage(value) {
    const lang = String(value || 'vi').toLowerCase();
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('zh') || lang.startsWith('cn')) return 'cn';
    return 'vi';
}

export async function handleProductIngredientSnapshot(request, productKey, env, deps = {}) {
    const { jsonResponse } = deps;
    const edgeCache = deps.edgeCache || globalThis.caches?.default;
    if (edgeCache) {
        const cachedResponse = await edgeCache.match(request).catch(() => null);
        if (cachedResponse) {
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Ingredient-Snapshot-Cache', 'HIT');
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers,
            });
        }
    }

    if (String(env.DATA_BACKEND || '').toLowerCase() === 'd1') {
        if (!env.APP_DB) return jsonResponse({ error: 'APP_DB is not configured.' }, 503);
        const isNumericD1 = /^\d+$/.test(String(productKey || ''));
        let snapshot = await env.APP_DB.prepare(`SELECT s.*, p.slug FROM product_ingredient_snapshots s
            JOIN products p ON p.id = s.product_id WHERE ${isNumericD1 ? 'p.id' : 'p.slug'} = ? AND p.is_published = 1 LIMIT 1`)
            .bind(isNumericD1 ? Number(productKey) : String(productKey)).first();
        if (!snapshot) {
            const product = await env.APP_DB.prepare(`SELECT id FROM products
                WHERE ${isNumericD1 ? 'id' : 'slug'} = ? AND is_published = 1 LIMIT 1`)
                .bind(isNumericD1 ? Number(productKey) : String(productKey)).first();
            if (product?.id) {
                const summary = await syncD1ProductIngredientSnapshots(env, {
                    productIds: [Number(product.id)],
                    productLimit: 1,
                });
                if (summary.synced) {
                    snapshot = await env.APP_DB.prepare(`SELECT s.*, p.slug FROM product_ingredient_snapshots s
                        JOIN products p ON p.id = s.product_id WHERE p.id = ? AND p.is_published = 1 LIMIT 1`)
                        .bind(Number(product.id)).first();
                }
            }
        }
        if (!snapshot) return jsonResponse({ error: 'Product ingredient snapshot not found.' }, 404, { 'Cache-Control': 'no-store' });
        const analysis = JSON.parse(snapshot.analysis_json || '{}');
        return jsonResponse({
            ...analysis,
            meta: { ...(analysis.meta || {}), source: 'cloudflare-d1-snapshot', source_product_id: snapshot.product_id,
                source_updated_at: snapshot.source_updated_at, synced_at: snapshot.updated_at,
                analysis_version: snapshot.analyzer_version, lang: normalizeRequestedLanguage(new URL(request.url).searchParams.get('lang')) },
        }, 200, { ...PUBLIC_SNAPSHOT_HEADERS, ETag: `"${snapshot.inci_hash}-${snapshot.analyzer_version}"` });
    }

    const ingredientConfig = getIngredientSupabaseConfig(env);
    if (!ingredientConfig.url || !ingredientConfig.key) {
        return jsonResponse({ error: 'Ingredient Supabase environment is not configured.' }, 503);
    }

    const sourceProject = getSourceProject(env);
    const isNumeric = /^\d+$/.test(String(productKey || ''));
    const url = ingredientRestUrl(ingredientConfig.url, 'product_ingredient_snapshots', {
        source_project: `eq.${sourceProject}`,
        [isNumeric ? 'source_product_id' : 'slug']: `eq.${String(productKey || '')}`,
        is_published: 'eq.true',
        archived_at: 'is.null',
        select: SNAPSHOT_SELECT,
        limit: 1,
    });

    try {
        const rows = await readJson(await (deps.fetchImpl || fetch)(url, {
            headers: ingredientRestHeaders(ingredientConfig.key),
        }));
        const snapshot = rows?.[0];
        if (!snapshot) {
            return jsonResponse({ error: 'Product ingredient snapshot not found.' }, 404, {
                'Cache-Control': 'no-store',
            });
        }

        const lang = normalizeRequestedLanguage(new URL(request.url).searchParams.get('lang'));
        const analyses = snapshot.analysis_by_lang || {};
        const analysis = analyses[lang] || analyses.vi || Object.values(analyses)[0];
        if (!analysis) {
            return jsonResponse({ error: 'Product ingredient analysis is not ready.' }, 404, {
                'Cache-Control': 'no-store',
            });
        }

        const response = jsonResponse({
            ...analysis,
            meta: {
                ...(analysis.meta || {}),
                source: 'synced-product-snapshot',
                source_product_id: snapshot.source_product_id,
                source_updated_at: snapshot.source_updated_at,
                synced_at: snapshot.synced_at,
                analysis_version: snapshot.analysis_version,
                lang,
            },
        }, 200, {
            ...PUBLIC_SNAPSHOT_HEADERS,
            ETag: `"${snapshot.inci_hash}-${snapshot.analysis_version}-${lang}"`,
            'X-Ingredient-Snapshot-Cache': 'MISS',
        });
        if (edgeCache) {
            const cacheWrite = edgeCache.put(request, response.clone()).catch((cacheError) => {
                console.warn('[ingredient-product-snapshot] Edge cache write failed:', {
                    productKey,
                    message: cacheError instanceof Error ? cacheError.message : String(cacheError),
                });
            });
            if (deps.ctx?.waitUntil) deps.ctx.waitUntil(cacheWrite);
            else await cacheWrite;
        }
        return response;
    } catch (error) {
        console.error('[ingredient-product-snapshot] Read failed:', {
            productKey,
            message: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse({ error: 'Không thể tải phân tích thành phần đã đồng bộ.' }, 502, {
            'Cache-Control': 'no-store',
        });
    }
}

export async function handleProductIngredientSync(request, env, deps = {}) {
    const { jsonResponse, authorizeAdminEditorAccess } = deps;
    if (String(env.DATA_BACKEND || '').toLowerCase() === 'd1') {
        try {
            const session = await requireRole(env.APP_DB, request, ['admin', 'master_admin', 'doctor']);
            await requireCsrf(env.APP_DB, request, session);
        } catch (error) {
            return jsonResponse({ error: error instanceof Error ? error.message : 'Forbidden.' }, Number(error?.status || 403));
        }
    } else {
        const auth = await authorizeAdminEditorAccess(request);
        if (auth?.error) return auth.error;
    }

    const payload = await request.json().catch(() => null);
    const productIds = Array.from(new Set([
        payload?.productId,
        ...(Array.isArray(payload?.productIds) ? payload.productIds : []),
    ].map(Number).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 20);

    if (!productIds.length) {
        return jsonResponse({ error: 'productId is required.' }, 400);
    }

    if (String(env.DATA_BACKEND || '').toLowerCase() === 'd1') {
        const summary = await syncD1ProductIngredientSnapshots(env, { productIds, productLimit: productIds.length });
        if (summary.failed) return jsonResponse({ error: 'Không thể đồng bộ một số INCI sản phẩm.', ...summary }, 502);
        return jsonResponse({ synced: summary.synced, results: summary }, 200, { 'Cache-Control': 'no-store' });
    }

    const results = [];
    for (const productId of productIds) {
        try {
            results.push(await syncProductIngredientSnapshot(productId, env, deps));
        } catch (error) {
            console.error('[ingredient-product-sync] Sync failed:', {
                productId,
                message: error instanceof Error ? error.message : String(error),
            });
            return jsonResponse({
                error: 'Không thể đồng bộ INCI sản phẩm.',
                productId,
            }, 502);
        }
    }

    return jsonResponse({ synced: results.length, results }, 200, {
        'Cache-Control': 'no-store',
    });
}
