import { handleGuestOrderLookup, handleGuestOrderOtpRequest } from './handlers.js';

const noContent = () => new Response(null, { status: 204 });
const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405 });

export async function maybeHandleOrderLookupRoute(route, deps = {}) {
    const { request, path } = route;
    const isLookup = path === '/api/orders/guest-lookup';
    const isOtpRequest = path === '/api/orders/guest-lookup/request-otp';
    if (!isLookup && !isOtpRequest) return null;
    if (request.method === 'OPTIONS') return noContent();
    if (request.method !== 'POST') return methodNotAllowed();
    return isOtpRequest
        ? handleGuestOrderOtpRequest(request, route.env || {}, deps)
        : handleGuestOrderLookup(request, route.env || {}, deps);
}
