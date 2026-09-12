import { createPublicCache, finalizePublicCacheResponse } from './cache.js';
import {
    handleClientMonitor,
    handlePublicRuntimeRest,
} from './handlers.js';
import { handlePublicBootstrap } from './bootstrap.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandlePublicRuntimeRoute(route, deps) {
    const { request, env, ctx, path } = route;

    if (path.startsWith('/api/public/rest/')) {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
        return finalizePublicCacheResponse(await handlePublicRuntimeRest(request, env, ctx, { ...deps, ...createPublicCache(env) }));
    }

    if (path === '/api/public/bootstrap') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'GET') return methodNotAllowed();
        return finalizePublicCacheResponse(await handlePublicBootstrap(request, env, ctx, { ...deps, ...createPublicCache(env) }));
    }

    if (path === '/api/monitor/client-error') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleClientMonitor(request, env, ctx, deps);
    }

    return null;
}
