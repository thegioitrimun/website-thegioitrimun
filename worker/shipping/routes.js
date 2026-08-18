import { methodNotAllowed } from '../platform/http.js';
import {
    enqueueShipment,
    handleFee,
    handleLabel,
    handlePickAddresses,
    handleTrack,
    handleWebhook,
} from './handlers.js';

export async function maybeHandleGhtkRoute(route) {
    const { request, env, path } = route;
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    if (!path.startsWith('/api/shipping/ghtk/') && path !== '/api/webhooks/ghtk') return null;
    if (path === '/api/webhooks/ghtk') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return handleWebhook(request, env);
    }
    if (path === '/api/shipping/ghtk/fee') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return handleFee(request, env);
    }
    if (path === '/api/shipping/ghtk/create') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueShipment(request, env, 'create');
    }
    if (path === '/api/shipping/ghtk/cancel') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueShipment(request, env, 'cancel');
    }
    if (path === '/api/shipping/ghtk/refresh') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return enqueueShipment(request, env, 'refresh');
    }
    if (path === '/api/shipping/ghtk/pick-addresses') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handlePickAddresses(request, env);
    }
    const pickMatch = path.match(/^\/api\/shipping\/ghtk\/pick-addresses\/([^/]+)$/);
    if (pickMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handlePickAddresses(request, env, decodeURIComponent(pickMatch[1]));
    }
    const trackMatch = path.match(/^\/api\/shipping\/ghtk\/orders\/([^/]+)$/);
    if (trackMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleTrack(request, env, decodeURIComponent(trackMatch[1]));
    }
    const labelMatch = path.match(/^\/api\/shipping\/ghtk\/orders\/([^/]+)\/label$/);
    if (labelMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleLabel(request, env, decodeURIComponent(labelMatch[1]));
    }
    return null;
}
