import { randomToken, sha256, timingSafeEqual } from '../platform/crypto.js';

const SESSION_COOKIE = 'tg_session';
const CSRF_COOKIE = 'tg_csrf';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function parseCookies(request) {
    const values = {};
    for (const part of String(request.headers.get('Cookie') || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        values[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    }
    return values;
}

function cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'Secure', `SameSite=${options.sameSite || 'Lax'}`];
    if (options.httpOnly !== false) parts.push('HttpOnly');
    if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
    return parts.join('; ');
}

export async function createSession(db, userId, request) {
    const token = randomToken(32);
    const csrf = randomToken(24);
    const tokenHash = await sha256(token);
    const csrfHash = await sha256(csrf);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
    await db.prepare(`
        INSERT INTO sessions (id, user_id, token_hash, csrf_hash, user_agent_hash, ip_hash, expires_at, created_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        crypto.randomUUID(),
        userId,
        tokenHash,
        csrfHash,
        await sha256(String(request.headers.get('User-Agent') || 'unknown')),
        await sha256(request.headers.get('CF-Connecting-IP') || 'unknown'),
        expiresAt,
        now.toISOString(),
        now.toISOString(),
    ).run();
    return {
        token,
        csrf,
        headers: [
            cookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
            cookie(CSRF_COOKIE, csrf, { maxAge: SESSION_TTL_SECONDS, httpOnly: false, sameSite: 'Strict' }),
        ],
    };
}

export async function getSession(db, request, { touch = false } = {}) {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (!token) return null;
    const row = await db.prepare(`
        SELECT s.id AS session_id, s.user_id, s.csrf_hash, s.expires_at,
               u.email, u.display_name, u.avatar_url, u.phone, u.locale, u.disabled_at,
               COALESCE(GROUP_CONCAT(r.code), 'customer') AS role_codes
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
        GROUP BY s.id, u.id
        LIMIT 1
    `).bind(await sha256(token), new Date().toISOString()).first();
    if (!row || row.disabled_at) return null;
    if (touch) {
        await db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), row.session_id).run();
    }
    return {
        ...row,
        roles: String(row.role_codes || 'customer').split(',').filter(Boolean),
    };
}

export async function requireSession(db, request) {
    const session = await getSession(db, request, { touch: true });
    if (!session) throw Object.assign(new Error('Authentication required.'), { status: 401 });
    return session;
}

export async function requireRole(db, request, allowedRoles) {
    const session = await requireSession(db, request);
    if (!session.roles.some((role) => allowedRoles.includes(role))) {
        throw Object.assign(new Error('Forbidden.'), { status: 403 });
    }
    return session;
}

export async function requireCsrf(db, request, session) {
    const cookies = parseCookies(request);
    const header = request.headers.get('X-CSRF-Token') || '';
    if (!header || !cookies[CSRF_COOKIE] || !timingSafeEqual(header, cookies[CSRF_COOKIE])) {
        throw Object.assign(new Error('Invalid CSRF token.'), { status: 403 });
    }
    if (!timingSafeEqual(await sha256(header), session.csrf_hash)) {
        throw Object.assign(new Error('Invalid CSRF token.'), { status: 403 });
    }
}

export async function revokeSession(db, request) {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) {
        await db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
            .bind(new Date().toISOString(), await sha256(token)).run();
    }
    return [
        cookie(SESSION_COOKIE, '', { maxAge: 0 }),
        cookie(CSRF_COOKIE, '', { maxAge: 0, httpOnly: false, sameSite: 'Strict' }),
    ];
}

export function getOAuthStateCookie(request) {
    return parseCookies(request).tg_oauth_state || '';
}

export function createOAuthStateCookie(value) {
    return cookie('tg_oauth_state', value, { maxAge: 600, sameSite: 'Lax' });
}

export function clearOAuthStateCookie() {
    return cookie('tg_oauth_state', '', { maxAge: 0, sameSite: 'Lax' });
}

export function issueGuestCsrfCookie() {
    const token = randomToken(24);
    return {
        token,
        header: cookie('tg_guest_csrf', token, {
            maxAge: 60 * 60 * 2,
            httpOnly: false,
            sameSite: 'Strict',
        }),
    };
}

export function requireGuestCsrf(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) {
        throw Object.assign(new Error('Invalid request origin.'), { status: 403 });
    }
    const cookieToken = parseCookies(request).tg_guest_csrf || '';
    const headerToken = request.headers.get('X-CSRF-Token') || '';
    if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
        throw Object.assign(new Error('Invalid CSRF token.'), { status: 403 });
    }
}
