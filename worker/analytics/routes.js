import { getSession, requireCsrf, requireGuestCsrf } from '../auth/session.js';
import { apiError, isD1Enabled, json, methodNotAllowed, readJson, requireD1 } from '../platform/http.js';

const EVENT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

function normalizePath(value) {
    const path = String(value || '').trim();
    if (!path || !path.startsWith('/')) return null;
    return path.slice(0, 512);
}

export async function maybeHandleAnalyticsRoute({ request, env, path }) {
    if (!isD1Enabled(env) || path !== '/api/analytics/funnel') return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    try {
        const db = requireD1(env);
        const session = await getSession(db, request);
        if (session) await requireCsrf(db, request, session);
        else requireGuestCsrf(request);

        const body = await readJson(request, 12 * 1024);
        const eventName = String(body.eventName || '').trim().toLowerCase();
        const sessionId = String(body.sessionId || '').trim();
        if (!EVENT_NAME_PATTERN.test(eventName)) {
            throw Object.assign(new Error('Invalid analytics event name.'), { status: 400 });
        }
        if (!SESSION_ID_PATTERN.test(sessionId)) {
            throw Object.assign(new Error('Invalid analytics session ID.'), { status: 400 });
        }

        const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? body.metadata
            : {};
        const metadataJson = JSON.stringify(metadata);
        if (new TextEncoder().encode(metadataJson).byteLength > 8 * 1024) {
            throw Object.assign(new Error('Analytics metadata is too large.'), { status: 413 });
        }

        await db.prepare(`
            INSERT INTO funnel_events (id, event_name, user_id, session_id, path, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            crypto.randomUUID(),
            eventName,
            session?.user_id || null,
            sessionId,
            normalizePath(body.path),
            metadataJson,
            new Date().toISOString(),
        ).run();

        return json({ ok: true }, 202);
    } catch (error) {
        return apiError(error, 'Could not record analytics event.');
    }
}
