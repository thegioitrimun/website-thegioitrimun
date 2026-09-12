// Cache bodies at the edge; check one primary D1 row before selecting a version.
// Database triggers cover admin writes, checkout and Pancake/queue writes alike.
export const PUBLIC_BROWSER_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';
const CATALOG = new Set(['products', 'product_images']);
const TAXONOMY = new Set(['product_categories', 'product_brands']);

export function publicCachePolicy(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/public/bootstrap') {
        return { scopes: ['catalog', 'taxonomy', 'content'], ttl: url.searchParams.get('mode') === 'home_deferred' ? 1800 : 180 };
    }
    if (url.pathname.startsWith('/api/ingredient-analyzer/products/')) {
        return { scopes: ['ingredients'], ttl: 900 };
    }
    const resource = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    if (CATALOG.has(resource)) return { scopes: ['catalog'], ttl: 180 };
    if (TAXONOMY.has(resource)) return { scopes: ['taxonomy'], ttl: 1800 };
    if (resource === 'public_product_reviews') return { scopes: ['reviews'], ttl: 300 };
    return { scopes: ['content'], ttl: 1800 };
}

export function finalizePublicCacheResponse(response) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', response.ok ? PUBLIC_BROWSER_CACHE_CONTROL : 'no-store');
    // All shared caching is explicitly managed below, after the revision check.
    headers.set('CDN-Cache-Control', 'no-store');
    if (!headers.has('X-Public-Cache')) headers.set('X-Public-Cache', 'BYPASS');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function createPublicCache(env, cache = globalThis.caches?.default) {
    const keys = new Map();
    async function keyFor(request) {
        if (!['GET', 'HEAD'].includes(request.method) || !env.APP_DB || !cache) return null;
        if (!keys.has(request.url)) {
            keys.set(request.url, (async () => {
                try {
                    const version = await env.APP_DB.prepare(`SELECT catalog, taxonomy, content, reviews, ingredients
                        FROM public_cache_versions WHERE id = 1`).first();
                    if (!version) return null;
                    const policy = publicCachePolicy(request);
                    const url = new URL(request.url);
                    // Do not fragment cache entries by marketing attribution.
                    for (const name of [...url.searchParams.keys()]) {
                        if (/^utm_/i.test(name) || ['fbclid', 'gclid'].includes(name)) url.searchParams.delete(name);
                    }
                    url.searchParams.set('__public_cache', `v1:${policy.scopes.map(scope => `${scope}:${version[scope]}`).join(':')}`);
                    url.searchParams.sort();
                    return { request: new Request(url, { method: 'GET' }), ...policy };
                } catch (error) {
                    console.warn('[public-cache] Revision unavailable; bypassing cache:', error.message);
                    return null;
                }
            })());
        }
        return keys.get(request.url);
    }
    return {
        async readEdgeCache(request) {
            const key = await keyFor(request);
            if (!key) return null;
            try {
                const hit = await cache.match(key.request);
                if (!hit) return null;
                const headers = new Headers(hit.headers);
                headers.set('X-Public-Cache', 'HIT');
                return new Response(hit.body, { status: hit.status, headers });
            } catch { return null; }
        },
        async writeEdgeCache(request, response, ctx) {
            if (request.method !== 'GET' || response.status !== 200 || response.headers.has('Set-Cookie')
                || /no-store|private/.test(response.headers.get('Cache-Control') || '')) return;
            const key = await keyFor(request);
            response.headers.set('X-Public-Cache', key ? 'MISS' : 'BYPASS');
            if (!key) return;
            response.headers.set('X-Public-Cache-TTL', String(key.ttl));
            const headers = new Headers(response.headers);
            headers.set('Cache-Control', `public, max-age=${key.ttl}`);
            headers.delete('CDN-Cache-Control');
            headers.delete('Set-Cookie');
            const copy = new Response(response.clone().body, { status: 200, headers });
            const write = cache.put(key.request, copy).catch(error => {
                console.warn('[public-cache] Cache write failed:', error.message);
            });
            if (ctx?.waitUntil) ctx.waitUntil(write);
            else await write;
        },
    };
}
