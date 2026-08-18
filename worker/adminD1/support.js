import { sha256 } from '../platform/crypto.js';

export function boundedInteger(value, fallback, min, max) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

export function paginationFromRequest(request, defaults = {}) {
    const url = new URL(request.url);
    const page = boundedInteger(url.searchParams.get('page'), defaults.page || 1, 1, 100000);
    const pageSize = boundedInteger(url.searchParams.get('pageSize'), defaults.pageSize || 100, 1, defaults.maxPageSize || 500);
    return {
        url,
        page,
        pageSize,
        offset: (page - 1) * pageSize,
        query: String(url.searchParams.get('q') || '').trim().slice(0, 200),
    };
}

export function listPayload(data, meta, legacyKey) {
    const payload = { data, meta };
    if (legacyKey) payload[legacyKey] = data;
    return payload;
}

export function revisionValue(value) {
    return value || new Date(0).toISOString();
}

function entityFromPath(path) {
    const parts = String(path || '').split('/').filter(Boolean);
    const adminIndex = parts.indexOf('admin');
    const entityType = adminIndex >= 0 ? parts[adminIndex + 1] || 'admin' : 'admin';
    const candidate = adminIndex >= 0 ? parts[adminIndex + 2] : null;
    return {
        entityType,
        entityId: candidate && !['gallery', 'dashboard', 'site-content'].includes(candidate) ? candidate : null,
    };
}

export async function recordAdminAuditAttempt(db, request, session) {
    try {
        const url = new URL(request.url);
        const { entityType, entityId } = entityFromPath(url.pathname);
        const now = new Date().toISOString();
        await db.prepare(`INSERT INTO admin_audit_log (
            id, actor_user_id, actor_email, action, entity_type, entity_id,
            request_method, request_path, status, ip_hash, user_agent_hash,
            metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'attempted', ?, ?, '{}', ?)`)
            .bind(
                crypto.randomUUID(),
                session.user_id,
                session.email || null,
                `${request.method.toLowerCase()}:${entityType}`,
                entityType,
                entityId,
                request.method,
                url.pathname,
                await sha256(request.headers.get('CF-Connecting-IP') || 'unknown'),
                await sha256(request.headers.get('User-Agent') || 'unknown'),
                now,
            ).run();
    } catch (error) {
        // Audit availability must not turn a valid business mutation into a failed request
        // while a newly deployed migration is still propagating.
        console.warn('Admin audit log could not be written:', error instanceof Error ? error.message : error);
    }
}
