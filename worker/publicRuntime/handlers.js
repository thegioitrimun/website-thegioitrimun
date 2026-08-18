import { queryD1PublicResource } from './d1Rest.js';

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
    }
    return value;
}

async function checksum(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function shadowEnabled(env) {
    return Boolean(env?.APP_DB) && String(env?.D1_SHADOW_READ || '').toLowerCase() === 'true';
}

function summarizeShadowRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return {
        count: list.length,
        keys: list.slice(0, 20).map((row, index) => String(row?.id ?? row?.slug ?? row?.code ?? index)),
    };
}

async function comparePublicShadowRead(env, resource, searchParams, sourceResponse) {
    const sourceRows = await sourceResponse.json();
    const targetRows = await queryD1PublicResource(env.APP_DB, resource, searchParams);
    const [sourceChecksum, targetChecksum] = await Promise.all([checksum(sourceRows), checksum(targetRows)]);
    if (sourceChecksum === targetChecksum) return;

    const entityKey = `${resource}?${searchParams.toString()}`.slice(0, 500);
    await env.APP_DB.prepare(`
        INSERT INTO shadow_read_diffs (
            id, resource_name, entity_key, source_checksum, target_checksum, diff_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
        crypto.randomUUID(),
        resource,
        entityKey,
        sourceChecksum,
        targetChecksum,
        JSON.stringify({ source: summarizeShadowRows(sourceRows), target: summarizeShadowRows(targetRows) }),
        new Date().toISOString(),
    ).run();
}

export async function handlePublicRuntimeRest(request, env, ctx, deps) {
    const {
        readEdgeCache,
        queuePublicMetricEvent,
        isAllowedPublicRuntimeResource,
        jsonResponse,
        PUBLIC_RUNTIME_PROXY_TIMEOUT_MS,
        buildSupabaseRestUrl,
        SUPABASE_ANON_KEY,
        getPublicRuntimeCacheControl,
        writePrivateMonitorEvent,
        maybeRunMonitoringRetention,
        sanitizeMonitorValue,
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

    if (String(env.DATA_BACKEND || '').toLowerCase() === 'd1') {
        if (!env.APP_DB) return jsonResponse({ error: 'APP_DB is not configured.' }, 503, { 'Cache-Control': 'no-store' });
        try {
            const rows = await queryD1PublicResource(env.APP_DB, resource, url.searchParams);
            const response = jsonResponse(rows, 200, {
                'Cache-Control': getPublicRuntimeCacheControl(resource),
                'X-Robots-Tag': 'noindex, nofollow',
                'Vary': 'Accept-Encoding',
            });
            await writeEdgeCache(request, response, ctx);
            return response;
        } catch (error) {
            console.error('[d1-public-runtime] Request failed:', { resource, message: error instanceof Error ? error.message : String(error) });
            return jsonResponse({ error: 'Public runtime unavailable' }, 502, { 'Cache-Control': 'no-store' });
        }
    }

    const endpoint = url.search ? `${resource}?${url.searchParams.toString()}` : resource;
    const metricEndpoint = `/api/public/rest/${resource}`;
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort('public runtime proxy timeout');
    }, PUBLIC_RUNTIME_PROXY_TIMEOUT_MS);

    try {
        const response = await fetch(buildSupabaseRestUrl(endpoint), {
            method: request.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', response.ok ? getPublicRuntimeCacheControl(resource) : 'no-store');
        headers.set('X-Robots-Tag', 'noindex, nofollow');
        headers.set('Vary', 'Accept-Encoding');
        if (!headers.get('Content-Type')) {
            headers.set('Content-Type', 'application/json;charset=UTF-8');
        }

        if (!response.ok && response.status >= 500) {
            const cloned = response.clone();
            const bodyPreview = await cloned.text().catch(() => '');
            await writePrivateMonitorEvent(env, 'public-runtime/upstream-5xx', {
                resource,
                search: sanitizeMonitorValue(url.search),
                status: response.status,
                body_preview: sanitizeMonitorValue(bodyPreview),
            });
            maybeRunMonitoringRetention(env, ctx, 'public-runtime-upstream-5xx');
        }

        if (request.method === 'HEAD') {
            return new Response(null, { status: response.status, headers });
        }

        if (request.method === 'GET' && response.ok && shadowEnabled(env)) {
            const shadowTask = comparePublicShadowRead(env, resource, url.searchParams, response.clone()).catch((shadowError) => {
                console.error('[d1-shadow-read] Comparison failed:', {
                    resource,
                    message: shadowError instanceof Error ? shadowError.message : String(shadowError),
                });
            });
            if (ctx?.waitUntil) ctx.waitUntil(shadowTask);
        }

        const outgoing = new Response(response.body, { status: response.status, headers });
        await writeEdgeCache(request, outgoing, ctx);
        queuePublicMetricEvent(env, ctx, {
            endpoint: metricEndpoint,
            resource,
            cache_status: 'miss',
            response_status: response.status,
            duration_ms: Date.now() - startedAt,
            partial: false,
            upstream_timeout: false,
        });
        return outgoing;
    } catch (error) {
        const didTimeout = timedOut || (error instanceof Error && error.name === 'AbortError');
        console.error('[worker] Public runtime proxy failed:', {
            resource,
            search: url.search,
            message: error instanceof Error ? error.message : String(error),
        });
        await writePrivateMonitorEvent(env, 'public-runtime/exception', {
            resource,
            search: sanitizeMonitorValue(url.search),
            message: sanitizeMonitorValue(error instanceof Error ? error.message : String(error)),
            stack: sanitizeMonitorValue(error instanceof Error ? error.stack : ''),
        });
        if (request.method !== 'HEAD') {
            queuePublicMetricEvent(env, ctx, {
                endpoint: metricEndpoint,
                resource,
                cache_status: 'miss',
                response_status: 502,
                duration_ms: Date.now() - startedAt,
                partial: false,
                upstream_timeout: didTimeout,
            });
        }
        maybeRunMonitoringRetention(env, ctx, 'public-runtime-exception');
        return jsonResponse({ error: 'Public runtime unavailable' }, 502, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    } finally {
        clearTimeout(timeoutId);
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
