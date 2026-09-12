import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCache, finalizePublicCacheResponse, publicCachePolicy } from '../worker/publicRuntime/cache.js';

function fixture() {
    const versions = { catalog: 1, taxonomy: 1, content: 1, reviews: 1, ingredients: 1 };
    const entries = new Map();
    let reads = 0;
    const env = { APP_DB: { prepare: () => ({ first: async () => { reads++; return { ...versions }; } }) } };
    const cache = {
        async match(request) { return entries.get(request.url)?.clone(); },
        async put(request, response) { entries.set(request.url, response.clone()); },
    };
    return { env, cache, versions, entries, get reads() { return reads; } };
}
const product = new Request('https://example.test/api/public/rest/products?limit=48&order=id.desc');
const body = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('cache hit skips body loading and uses one revision query per request', async () => {
    const f = fixture();
    const miss = createPublicCache(f.env, f.cache);
    assert.equal(await miss.readEdgeCache(product), null);
    const response = body({ price: 10 });
    await miss.writeEdgeCache(product, response);
    assert.equal(f.reads, 1);
    const hit = await createPublicCache(f.env, f.cache).readEdgeCache(product);
    assert.equal(hit.headers.get('X-Public-Cache'), 'HIT');
    assert.deepEqual(await hit.json(), { price: 10 });
    assert.equal(f.reads, 2);
    assert.equal(response.headers.get('X-Public-Cache-TTL'), '180');
});

test('catalog update invalidates products and bootstrap but preserves unrelated content', async () => {
    const f = fixture();
    const blog = new Request('https://example.test/api/public/rest/blog_posts');
    const bootstrap = new Request('https://example.test/api/public/bootstrap');
    for (const request of [product, blog, bootstrap]) await createPublicCache(f.env, f.cache).writeEdgeCache(request, body([]));
    f.versions.catalog++;
    assert.equal(await createPublicCache(f.env, f.cache).readEdgeCache(product), null);
    assert.equal(await createPublicCache(f.env, f.cache).readEdgeCache(bootstrap), null);
    assert.ok(await createPublicCache(f.env, f.cache).readEdgeCache(blog));
});

test('an in-flight old response cannot repopulate the current version after a mutation', async () => {
    const f = fixture();
    const old = createPublicCache(f.env, f.cache);
    await old.readEdgeCache(product);
    f.versions.catalog++;
    await old.writeEdgeCache(product, body({ price: 'old' }));
    assert.equal(await createPublicCache(f.env, f.cache).readEdgeCache(product), null);
});

test('canonical keys merge query order and tracking, but keep filters separate', async () => {
    const f = fixture();
    await createPublicCache(f.env, f.cache).writeEdgeCache(product, body([]));
    assert.ok(await createPublicCache(f.env, f.cache).readEdgeCache(new Request('https://example.test/api/public/rest/products?utm_source=test&order=id.desc&limit=48')));
    assert.equal(await createPublicCache(f.env, f.cache).readEdgeCache(new Request('https://example.test/api/public/rest/products?order=id.desc&limit=1')), null);
});

test('private responses, cookies, errors and failed revision reads bypass cache', async () => {
    const f = fixture();
    for (const response of [new Response('private', { headers: { 'Cache-Control': 'private' } }), new Response('cookie', { headers: { 'Set-Cookie': 'sid=x' } }), new Response('error', { status: 503 })]) {
        await createPublicCache(f.env, f.cache).writeEdgeCache(product, response);
    }
    assert.equal(f.entries.size, 0);
    const unavailable = createPublicCache({ APP_DB: { prepare: () => ({ first: async () => null }) } }, f.cache);
    await unavailable.writeEdgeCache(product, body([]));
    assert.equal(f.entries.size, 0);
});

test('browser cannot reuse a body without revision validation; edge TTL varies by resource', () => {
    const response = finalizePublicCacheResponse(body([]));
    assert.match(response.headers.get('Cache-Control'), /no-cache/);
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(publicCachePolicy(product).ttl, 180);
    assert.equal(publicCachePolicy(new Request('https://example.test/api/public/rest/blog_posts')).ttl, 1800);
    assert.equal(publicCachePolicy(new Request('https://example.test/api/ingredient-analyzer/products/1')).ttl, 900);
});

test('production D1 snapshot handler refreshes its cached analysis after a revision change', async () => {
    const { handleProductIngredientSnapshot } = await import('../worker/ingredientAnalyzer/productSyncD1.js');
    const f = fixture();
    const revisionDb = f.env.APP_DB;
    let loads = 0;
    let label = 'first';
    f.env.APP_DB = { prepare(sql) {
        if (sql.includes('public_cache_versions')) return revisionDb.prepare(sql);
        assert.match(sql, /SELECT s\.\*, p.slug/);
        return { bind: () => ({ first: async () => {
            loads++;
            return { product_id: 1, analysis_json: JSON.stringify({ label }), inci_hash: label, analyzer_version: 1 };
        } }) };
    } };
    const request = new Request('https://example.test/api/ingredient-analyzer/products/1');
    const deps = { edgeCache: f.cache, jsonResponse: (payload, status, headers) => new Response(JSON.stringify(payload), { status, headers }) };
    await handleProductIngredientSnapshot(request, '1', f.env, deps);
    const hit = await handleProductIngredientSnapshot(request, '1', f.env, deps);
    assert.equal(hit.headers.get('X-Public-Cache'), 'HIT');
    assert.equal(loads, 1);
    label = 'updated';
    f.versions.ingredients++;
    const fresh = await handleProductIngredientSnapshot(request, '1', f.env, deps);
    assert.equal((await fresh.json()).label, 'updated');
    assert.equal(loads, 2);
});
