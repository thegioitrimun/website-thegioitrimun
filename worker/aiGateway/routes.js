import { handleAiGenerate } from './handlers.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandleAiGatewayRoute(route, deps = {}) {
    const { request, path } = route;

    if (path !== '/api/ai/generate') return null;
    if (request.method === 'OPTIONS') return noContent();
    if (request.method !== 'POST') return methodNotAllowed();

    return handleAiGenerate(request, route.env || {}, deps);
}
