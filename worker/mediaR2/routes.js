import {
    handleR2ImageDelete,
    handleR2ImageList,
    handleR2ImageRead,
    handleR2ImageUpload,
} from './handlers.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandleMediaR2Route(route, deps) {
    const { request, env, path } = route;

    if (path.startsWith('/r2/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return methodNotAllowed();
        }
        return handleR2ImageRead(request, env, path, deps);
    }

    if (path === '/api/r2/upload') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleR2ImageUpload(request, env, deps);
    }

    if (path === '/api/r2/delete') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleR2ImageDelete(request, env, deps);
    }

    if (path === '/api/r2/list') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleR2ImageList(request, env, deps);
    }

    return null;
}
