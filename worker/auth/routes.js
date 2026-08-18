import {
    handleLogout,
    handleCsrf,
    handleOAuthCallback,
    handleOAuthStart,
    handleSession,
} from './handlers.js';
import { methodNotAllowed } from '../platform/http.js';

export async function maybeHandleAuthRoute(route) {
    const { request, env, path } = route;
    if (!path.startsWith('/api/auth/')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (/^\/api\/auth\/apple\/(start|callback)$/.test(path)) {
        return new Response(JSON.stringify({ error: 'OAuth provider is disabled.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    const start = path.match(/^\/api\/auth\/(google)\/start$/);
    if (start) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleOAuthStart(request, env, start[1]);
    }
    const callback = path.match(/^\/api\/auth\/(google)\/callback$/);
    if (callback) {
        if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
        return handleOAuthCallback(request, env, callback[1]);
    }
    if (path === '/api/auth/session') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleSession(request, env);
    }
    if (path === '/api/auth/logout') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return handleLogout(request, env);
    }
    if (path === '/api/auth/csrf') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleCsrf();
    }
    return null;
}
