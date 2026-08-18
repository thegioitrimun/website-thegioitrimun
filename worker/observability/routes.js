import {
    handleAdminObservabilityCleanup,
    handleAdminObservabilityLogs,
    handleAdminObservabilitySummary,
} from './handlers.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandleObservabilityRoute(route, deps) {
    const { request, env, ctx, path } = route;

    if (path === '/api/admin/observability/logs') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'GET') return methodNotAllowed();
        return handleAdminObservabilityLogs(request, env, ctx, deps);
    }

    if (path === '/api/admin/observability/summary') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'GET') return methodNotAllowed();
        return handleAdminObservabilitySummary(request, env, ctx, deps);
    }

    if (path === '/api/admin/observability/cleanup') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleAdminObservabilityCleanup(request, env, deps);
    }

    return null;
}
