import { methodNotAllowed } from '../platform/http.js';
import {
    addWishlistProduct,
    deletePrivateDocument,
    downloadPrivateDocument,
    getAccountData,
    getAccountProfile,
    removeWishlistProduct,
    updatePrivateDocumentSummary,
    updateAccountProfile,
    uploadPrivateDocument,
} from './handlers.js';

export async function maybeHandleAccountRoute(route) {
    const { request, env, path } = route;
    if (!path.startsWith('/api/account/')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (path === '/api/account/profile') {
        if (request.method === 'GET') return getAccountProfile(request, env);
        if (request.method === 'PATCH') return updateAccountProfile(request, env);
        return methodNotAllowed(['GET', 'PATCH']);
    }
    const wishlistMatch = path.match(/^\/api\/account\/wishlist\/(\d+)$/);
    if (wishlistMatch) {
        if (request.method === 'POST') return addWishlistProduct(request, env, wishlistMatch[1]);
        if (request.method === 'DELETE') return removeWishlistProduct(request, env, wishlistMatch[1]);
        return methodNotAllowed(['POST', 'DELETE']);
    }
    if (path === '/api/account/me') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getAccountData(request, env);
    }
    if (path === '/api/account/documents') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return uploadPrivateDocument(request, env);
    }
    const documentMatch = path.match(/^\/api\/account\/documents\/([^/]+)\/download$/);
    if (documentMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return downloadPrivateDocument(request, env, decodeURIComponent(documentMatch[1]));
    }
    const documentItemMatch = path.match(/^\/api\/account\/documents\/([^/]+)$/);
    if (documentItemMatch) {
        const documentId = decodeURIComponent(documentItemMatch[1]);
        if (request.method === 'DELETE') return deletePrivateDocument(request, env, documentId);
        if (request.method === 'PATCH') return updatePrivateDocumentSummary(request, env, documentId);
        return methodNotAllowed(['DELETE', 'PATCH']);
    }
    return null;
}
