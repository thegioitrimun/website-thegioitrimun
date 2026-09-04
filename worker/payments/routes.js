import { methodNotAllowed } from '../platform/http.js';
import {
    handleSepayPaymentStatus,
    handleSepayPublicConfiguration,
    handleSepayWebhook,
} from './sepay.js';

export async function maybeHandleSepayRoute({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;

    if (path === '/api/webhooks/sepay' || path === '/api/payments/sepay/webhook') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return handleSepayWebhook(request, env);
    }

    if (path === '/api/payments/sepay/config') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleSepayPublicConfiguration(request, env);
    }

    const statusMatch = path.match(/^\/api\/payments\/sepay\/orders\/([^/]+)\/status$/);
    if (statusMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return handleSepayPaymentStatus(request, env, decodeURIComponent(statusMatch[1]));
    }
    return null;
}
