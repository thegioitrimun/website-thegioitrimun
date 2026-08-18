import {
    handleAdminEditorDraftDelete,
    handleAdminEditorDraftRead,
    handleAdminEditorDraftUpsert,
    handleAdminProductContentReviewRead,
    handleAdminProductContentReviewUpsert,
} from './handlers.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = (allowed = []) => new Response(JSON.stringify({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' },
}), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: allowed.join(', ') },
});

export async function maybeHandleAdminToolsRoute(route, deps) {
    const { request, env, path } = route;

    if (path === '/api/admin/editor-drafts') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method === 'GET') return handleAdminEditorDraftRead(request, env, deps);
        if (request.method === 'POST') return handleAdminEditorDraftUpsert(request, env, deps);
        if (request.method === 'DELETE') return handleAdminEditorDraftDelete(request, env, deps);
        return methodNotAllowed(['GET', 'POST', 'DELETE']);
    }

    if (path === '/api/admin/product-content-reviews') {
        if (request.method === 'OPTIONS') return noContent();
        if (request.method === 'GET') return handleAdminProductContentReviewRead(request, env, deps);
        if (request.method === 'POST') return handleAdminProductContentReviewUpsert(request, env, deps);
        return methodNotAllowed(['GET', 'POST']);
    }

    return null;
}
