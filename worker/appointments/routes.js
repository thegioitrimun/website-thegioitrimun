import { methodNotAllowed } from '../platform/http.js';
import { createAppointment, updateAppointmentStatus } from './handlers.js';

export async function maybeHandleAppointmentRoute({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    if (path === '/api/appointments') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return createAppointment(request, env);
    }
    const match = path.match(/^\/api\/admin\/appointments\/([^/]+)\/status$/);
    if (match) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return updateAppointmentStatus(request, env, decodeURIComponent(match[1]));
    }
    return null;
}

