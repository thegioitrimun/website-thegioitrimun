import { methodNotAllowed } from '../platform/http.js';
import {
    createAdminOrder,
    createOrder,
    getProductWithIngredientSnapshot,
    quoteAdminOrder,
    quoteOrderTotals,
    refundOrder,
    validateDiscountCode,
    updateOrderStatus,
} from './handlers.js';

export async function maybeHandleD1CommerceRoute(route) {
    const { request, env, path } = route;
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;

    if (path === '/api/admin/orders/quote') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return quoteAdminOrder(request, env);
    }

    if (path === '/api/admin/orders' && request.method === 'POST') {
        return createAdminOrder(request, env);
    }

    if (path === '/api/orders') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return createOrder(request, env);
    }

    if (path === '/api/checkout/quote') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return quoteOrderTotals(request, env);
    }

    if (path === '/api/discount-codes/validate') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return validateDiscountCode(request, env);
    }

    const statusMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
    if (statusMatch) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return updateOrderStatus(request, env, decodeURIComponent(statusMatch[1]));
    }

    const refundMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
    if (refundMatch) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return refundOrder(request, env, decodeURIComponent(refundMatch[1]));
    }

    const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getProductWithIngredientSnapshot(request, env, decodeURIComponent(productMatch[1]));
    }
    return null;
}
