import { queryD1PublicResource } from './d1Rest.js';

export async function handlePublicRuntimeRest(request, env, ctx, deps) {
    const {
        readEdgeCache,
        queuePublicMetricEvent,
        isAllowedPublicRuntimeResource,
        jsonResponse,
        getPublicRuntimeCacheControl,
        writeEdgeCache,
    } = deps;

    const startedAt = Date.now();
    const cachedResponse = await readEdgeCache(request);
    if (cachedResponse) {
        const cachedUrl = new URL(request.url);
        const cachedResource = decodeURIComponent(cachedUrl.pathname.replace(/^\/api\/public\/rest\//, '').replace(/\/+$/, ''));
        if (request.method !== 'HEAD') {
            queuePublicMetricEvent(env, ctx, {
                endpoint: `/api/public/rest/${cachedResource}`,
                resource: cachedResource,
                cache_status: 'hit',
                response_status: cachedResponse.status,
                duration_ms: Date.now() - startedAt,
                partial: false,
                upstream_timeout: false,
            });
        }
        return request.method === 'HEAD'
            ? new Response(null, { status: cachedResponse.status, headers: cachedResponse.headers })
            : cachedResponse;
    }

    const url = new URL(request.url);
    const resource = decodeURIComponent(url.pathname.replace(/^\/api\/public\/rest\//, '').replace(/\/+$/, ''));
    if (!isAllowedPublicRuntimeResource(resource)) {
        return jsonResponse({ error: 'Not Found' }, 404, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    if (!env.APP_DB) return jsonResponse({ error: 'APP_DB is not configured.' }, 503, { 'Cache-Control': 'no-store' });
    try {
        const rows = await queryD1PublicResource(env.APP_DB, resource, url.searchParams);
        const response = jsonResponse(rows, 200, {
            'Cache-Control': getPublicRuntimeCacheControl(resource),
            'X-Robots-Tag': 'noindex, nofollow',
            'Vary': 'Accept-Encoding',
        });
        await writeEdgeCache(request, response, ctx);
        queuePublicMetricEvent(env, ctx, {
            endpoint: `/api/public/rest/${resource}`,
            resource,
            cache_status: 'miss',
            response_status: 200,
            duration_ms: Date.now() - startedAt,
            partial: false,
            upstream_timeout: false,
        });
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers: response.headers });
        return response;
    } catch (error) {
        console.error('[d1-public-runtime] Request failed:', {
            resource,
            message: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse({ error: 'Public runtime unavailable' }, 502, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }
}

export async function handleClientMonitor(request, env, ctx, deps) {
    const {
        jsonResponse,
        writePrivateMonitorEvent,
        maybeRunMonitoringRetention,
        sanitizeMonitorValue,
    } = deps;
    let payload = null;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    console.error('[client-monitor]', {
        type: payload?.type || 'unknown',
        message: payload?.message || 'No message',
        context: payload?.context || '',
        path: payload?.path || '',
        href: payload?.href || '',
        source: payload?.source || '',
        stack: String(payload?.stack || '').slice(0, 1200),
        details: String(payload?.details || '').slice(0, 1200),
    });

    await writePrivateMonitorEvent(env, 'client-error', {
        type: sanitizeMonitorValue(payload?.type || 'unknown'),
        message: sanitizeMonitorValue(payload?.message || 'No message'),
        context: sanitizeMonitorValue(payload?.context || ''),
        path: sanitizeMonitorValue(payload?.path || ''),
        href: sanitizeMonitorValue(payload?.href || ''),
        source: sanitizeMonitorValue(payload?.source || ''),
        user_agent: sanitizeMonitorValue(payload?.userAgent || request.headers.get('user-agent') || ''),
        cf_ray: sanitizeMonitorValue(request.headers.get('cf-ray') || ''),
        stack: sanitizeMonitorValue(payload?.stack || ''),
        details: sanitizeMonitorValue(payload?.details || ''),
    });
    maybeRunMonitoringRetention(env, ctx, 'client-monitor');

    return new Response(null, {
        status: 204,
        headers: {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        },
    });
}
