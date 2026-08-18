import assert from 'node:assert/strict';
import test from 'node:test';

import { maybeHandleIngredientAnalyzerRoute } from '../worker/ingredientAnalyzer/routes.js';
import {
    handleProductIngredientSnapshot,
    syncD1ProductIngredientSnapshots,
} from '../worker/ingredientAnalyzer/productSync.js';

const jsonResponse = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
});

const snapshot = {
    source_product_id: 42,
    slug: 'san-pham-thu-nghiem',
    inci_hash: 'abc123',
    analysis_version: 1,
    source_updated_at: '2026-08-03T00:00:00.000Z',
    synced_at: '2026-08-03T00:01:00.000Z',
    analysis_by_lang: {
        vi: {
            safety_score: 92,
            verdict: 'Tốt',
            summary: { total: 3, recognized: 3, unrecognized: 0, recognition_rate: 100 },
        },
    },
};

test('product ingredient snapshot returns precomputed analysis with edge cache headers', async () => {
    let requestedUrl = '';
    const response = await handleProductIngredientSnapshot(
        new Request('https://example.test/api/ingredient-analyzer/products/san-pham-thu-nghiem?lang=vi'),
        'san-pham-thu-nghiem',
        {
            INGREDIENT_SUPABASE_URL: 'https://ingredient.example.test',
            INGREDIENT_SUPABASE_SECRET_KEY: 'server-secret',
        },
        {
            jsonResponse,
            fetchImpl: async (url) => {
                requestedUrl = String(url);
                return jsonResponse([snapshot]);
            },
        },
    );

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.safety_score, 92);
    assert.equal(payload.meta.source, 'synced-product-snapshot');
    assert.equal(payload.meta.source_product_id, 42);
    assert.match(response.headers.get('cache-control') || '', /stale-while-revalidate=300/);
    assert.match(requestedUrl, /product_ingredient_snapshots/);
    assert.match(requestedUrl, /slug=eq\.san-pham-thu-nghiem/);
    assert.match(requestedUrl, /is_published=eq\.true/);
});

test('missing snapshot returns 404 so the client can use live analysis fallback', async () => {
    const response = await handleProductIngredientSnapshot(
        new Request('https://example.test/api/ingredient-analyzer/products/404?lang=vi'),
        '404',
        {
            INGREDIENT_SUPABASE_URL: 'https://ingredient.example.test',
            INGREDIENT_SUPABASE_SECRET_KEY: 'server-secret',
        },
        { jsonResponse, fetchImpl: async () => jsonResponse([]) },
    );

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('product ingredient snapshot uses the Worker edge cache after the first lookup', async () => {
    const store = new Map();
    let upstreamCalls = 0;
    const edgeCache = {
        match: async (request) => store.get(request.url)?.clone() || null,
        put: async (request, response) => store.set(request.url, response.clone()),
    };
    const request = new Request('https://example.test/api/ingredient-analyzer/products/san-pham-thu-nghiem?lang=vi');
    const deps = {
        jsonResponse,
        edgeCache,
        fetchImpl: async () => {
            upstreamCalls += 1;
            return jsonResponse([snapshot]);
        },
    };
    const env = {
        INGREDIENT_SUPABASE_URL: 'https://ingredient.example.test',
        INGREDIENT_SUPABASE_SECRET_KEY: 'server-secret',
    };

    const first = await handleProductIngredientSnapshot(request.clone(), 'san-pham-thu-nghiem', env, deps);
    const second = await handleProductIngredientSnapshot(request.clone(), 'san-pham-thu-nghiem', env, deps);

    assert.equal(first.headers.get('x-ingredient-snapshot-cache'), 'MISS');
    assert.equal(second.headers.get('x-ingredient-snapshot-cache'), 'HIT');
    assert.equal(upstreamCalls, 1);
});

test('product sync route rejects unauthenticated write-through requests', async () => {
    const denied = jsonResponse({ error: 'Unauthorized' }, 401);
    const response = await maybeHandleIngredientAnalyzerRoute({
        request: new Request('https://example.test/api/ingredient-analyzer/products/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: 42 }),
        }),
        path: '/api/ingredient-analyzer/products/sync',
        env: {},
    }, {
        jsonResponse,
        authorizeAdminEditorAccess: async () => ({ error: denied }),
    });

    assert.equal(response.status, 401);
});

test('D1 product sync prefers the editable ingredients field over the legacy inci_text field', async () => {
    let syncedInciText = '';
    const appDb = {
        prepare(sql) {
            if (sql.includes('SELECT p.id, p.inci_text, p.ingredients, p.updated_at')) {
                return {
                    bind() {
                        return {
                            all: async () => ({
                                results: [{
                                    id: 309,
                                    ingredients: 'Aqua, Glycerin',
                                    inci_text: 'Legacy narrative that must not be analyzed',
                                    updated_at: '2026-08-18T06:13:39.468Z',
                                }],
                            }),
                        };
                    },
                };
            }
            if (sql.includes('INSERT INTO product_ingredient_snapshots')) {
                return {
                    bind(...values) {
                        syncedInciText = values[1];
                        return { run: async () => ({ success: true }) };
                    },
                };
            }
            throw new Error(`Unexpected APP_DB query: ${sql}`);
        },
    };
    const inciDb = {
        prepare() {
            return {
                bind() {
                    return { all: async () => ({ results: [] }) };
                },
            };
        },
    };

    const summary = await syncD1ProductIngredientSnapshots({
        APP_DB: appDb,
        INCI_SHARD_COUNT: '1',
        INCI_DB_0: inciDb,
    }, { productIds: [309], productLimit: 1 });

    assert.equal(summary.synced, 1);
    assert.equal(summary.failed, 0);
    assert.equal(syncedInciText, 'Aqua, Glycerin');
});
