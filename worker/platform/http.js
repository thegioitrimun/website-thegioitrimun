export function json(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...headers,
        },
    });
}

export function methodNotAllowed(allowed = []) {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } }, 405, {
        Allow: allowed.join(', '),
    });
}

export async function readJson(request, maxBytes = 64 * 1024) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
        throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    }

    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    }

    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw Object.assign(new Error('Invalid JSON body.'), { status: 400 });
    }
}

export function apiError(error, fallback = 'Internal Server Error') {
    const status = Number(error?.status || 500);
    const expose = status >= 400 && status < 500;
    if (!expose) {
        console.error('[api-error]', {
            fallback,
            message: String(error?.message || error || fallback).slice(0, 1000),
            code: String(error?.code || 'INTERNAL_ERROR').slice(0, 100),
        });
    }
    const message = expose ? String(error?.message || fallback) : fallback;
    const code = String(error?.code || (
        status === 400 ? 'BAD_REQUEST' :
        status === 401 ? 'UNAUTHENTICATED' :
        status === 403 ? 'FORBIDDEN' :
        status === 404 ? 'NOT_FOUND' :
        status === 409 ? 'CONFLICT' :
        status === 413 ? 'PAYLOAD_TOO_LARGE' :
        status === 429 ? 'RATE_LIMITED' :
        status === 503 ? 'SERVICE_UNAVAILABLE' :
        'INTERNAL_ERROR'
    ));
    return json({ error: { code, message } }, status);
}

export function requireD1(env, binding = 'APP_DB') {
    const db = env?.[binding];
    if (!db || typeof db.prepare !== 'function') {
        throw Object.assign(new Error(`${binding} is not configured.`), { status: 503 });
    }
    return db;
}

export function isD1Enabled(env) {
    return String(env?.DATA_BACKEND || '').toLowerCase() === 'd1';
}
