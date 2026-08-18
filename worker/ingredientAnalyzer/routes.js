import { handleIngredientAnalyze } from './handlers.js';
import {
    handleProductIngredientSnapshot,
    handleProductIngredientSync,
} from './productSync.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandleIngredientAnalyzerRoute(route, deps = {}) {
    const { request, path } = route;

    if (path === '/api/ingredient-analyzer/products/sync') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'POST') return methodNotAllowed();
        return handleProductIngredientSync(request, deps.env || route.env || {}, deps);
    }

    const productSnapshotMatch = path.match(/^\/api\/ingredient-analyzer\/products\/([^/]+)$/);
    if (productSnapshotMatch) {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method !== 'GET') return methodNotAllowed();
        return handleProductIngredientSnapshot(
            request,
            decodeURIComponent(productSnapshotMatch[1]),
            deps.env || route.env || {},
            { ...deps, ctx: route.ctx },
        );
    }

    if (path !== '/api/ingredient-analyzer/analyze') return null;

    if (request.method === 'OPTIONS') return noContent();
    if (request.method !== 'POST') return methodNotAllowed();

    return handleIngredientAnalyze(request, deps.env || route.env || {}, deps);
}
