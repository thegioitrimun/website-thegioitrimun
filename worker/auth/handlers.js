import { randomId, randomToken, sha256, verifyRs256Jwt } from '../platform/crypto.js';
import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import {
    clearOAuthStateCookie,
    createOAuthStateCookie,
    createSession,
    getOAuthStateCookie,
    getSession,
    issueGuestCsrfCookie,
    requireCsrf,
    revokeSession,
} from './session.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
function baseUrl(request, env) {
    return String(env.OAUTH_BASE_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

function providerConfig(provider, request, env) {
    const enabledProviders = String(env.OAUTH_PROVIDERS || 'google')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    if (provider !== 'google' || !enabledProviders.includes(provider)) {
        throw Object.assign(new Error('OAuth provider is disabled.'), { status: 404 });
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw Object.assign(new Error('Google OAuth is not configured.'), { status: 503 });
    }
    return {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authUrl: GOOGLE_AUTH_URL,
        tokenUrl: GOOGLE_TOKEN_URL,
        jwksUrl: GOOGLE_JWKS_URL,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        callback: `${baseUrl(request, env)}/api/auth/google/callback`,
    };
}

function safeReturnTo(value) {
    const path = String(value || '/tai-khoan').trim();
    return path.startsWith('/') && !path.startsWith('//') ? path.slice(0, 512) : '/tai-khoan';
}

async function loadOAuthCallbackBody(request) {
    if (request.method === 'POST') {
        const type = request.headers.get('content-type') || '';
        if (type.includes('application/x-www-form-urlencoded')) {
            return Object.fromEntries(new URLSearchParams(await request.text()));
        }
        return readJson(request, 16 * 1024);
    }
    return Object.fromEntries(new URL(request.url).searchParams);
}

async function exchangeCode(code, config) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        redirect_uri: config.callback,
        client_secret: config.clientSecret,
    });
    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id_token) {
        throw Object.assign(new Error('OAuth code exchange failed.'), { status: 401 });
    }
    return payload;
}

async function resolveIdentity(db, provider, claims, profile = {}) {
    const providerSubject = String(claims.sub || '').trim();
    const email = String(claims.email || '').trim().toLowerCase();
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    if (!providerSubject || !email || !emailVerified) {
        throw Object.assign(new Error('OAuth provider did not return a verified email.'), { status: 401 });
    }

    const existingIdentity = await db.prepare(`
        SELECT u.id, u.email FROM oauth_identities oi
        JOIN users u ON u.id = oi.user_id
        WHERE oi.provider = ? AND oi.provider_user_id = ?
        LIMIT 1
    `).bind(provider, providerSubject).first();
    if (existingIdentity) return existingIdentity;

    let user = await db.prepare('SELECT id, email FROM users WHERE lower(email) = ? LIMIT 1')
        .bind(email).first();
    const now = new Date().toISOString();
    if (!user) {
        const profileName = typeof profile === 'string'
            ? profile
            : [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
        user = { id: randomId(), email };
        await db.batch([
            db.prepare(`
                INSERT INTO users (id, email, email_verified, display_name, avatar_url, locale, created_at, updated_at)
                VALUES (?, ?, 1, ?, ?, 'vi', ?, ?)
            `).bind(
                user.id,
                email,
                String(profileName || claims.name || email.split('@')[0]).slice(0, 255),
                String(claims.picture || '').slice(0, 2048) || null,
                now,
                now,
            ),
            db.prepare(`
                INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                SELECT ?, id, ? FROM roles WHERE code = 'customer'
            `).bind(user.id, now),
        ]);
    }

    await db.prepare(`
        INSERT INTO oauth_identities (
            id, user_id, provider, provider_user_id, provider_email,
            provider_email_verified, profile_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
        randomId(),
        user.id,
        provider,
        providerSubject,
        email,
        JSON.stringify(claims),
        now,
        now,
    ).run();
    return user;
}

export async function handleOAuthStart(request, env, provider) {
    try {
        const db = requireD1(env);
        const config = providerConfig(provider, request, env);
        const url = new URL(request.url);
        const state = randomToken(32);
        const nonce = randomToken(24);
        const now = new Date();
        await db.prepare(`
            INSERT INTO oauth_states (id, state_hash, provider, nonce, nonce_hash, return_to, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            randomId(),
            await sha256(state),
            provider,
            nonce,
            await sha256(nonce),
            safeReturnTo(url.searchParams.get('returnTo')),
            new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
            now.toISOString(),
        ).run();

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.callback,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            nonce,
        });
        params.set('prompt', 'select_account');
        params.set('access_type', 'offline');
        const headers = new Headers({ Location: `${config.authUrl}?${params.toString()}` });
        headers.append('Set-Cookie', createOAuthStateCookie(state));
        return new Response(null, { status: 302, headers });
    } catch (error) {
        return apiError(error, 'Cannot start OAuth login.');
    }
}

export async function handleOAuthCallback(request, env, provider) {
    try {
        const db = requireD1(env);
        const config = providerConfig(provider, request, env);
        const body = await loadOAuthCallbackBody(request);
        const state = String(body.state || '');
        if (!state || state !== getOAuthStateCookie(request) || body.error) {
            throw Object.assign(new Error('Invalid OAuth state.'), { status: 401 });
        }
        const stateHash = await sha256(state);
        const stateRow = await db.prepare(`
            SELECT provider, nonce, return_to FROM oauth_states
            WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?
            LIMIT 1
        `).bind(stateHash, new Date().toISOString()).first();
        if (!stateRow || stateRow.provider !== provider) {
            throw Object.assign(new Error('OAuth state expired.'), { status: 401 });
        }
        await db.prepare('UPDATE oauth_states SET consumed_at = ? WHERE state_hash = ?')
            .bind(new Date().toISOString(), stateHash).run();

        const tokens = await exchangeCode(String(body.code || ''), config);
        const claims = await verifyRs256Jwt(tokens.id_token, {
            jwksUrl: config.jwksUrl,
            audience: config.clientId,
            issuer: config.issuer,
            nonce: stateRow.nonce,
        });
        const profile = body.user ? JSON.parse(String(body.user)) : {};
        const user = await resolveIdentity(db, provider, claims, profile?.name || profile);
        const session = await createSession(db, user.id, request);
        const headers = new Headers({ Location: `${baseUrl(request, env)}${safeReturnTo(stateRow.return_to)}` });
        headers.append('Set-Cookie', clearOAuthStateCookie());
        session.headers.forEach((value) => headers.append('Set-Cookie', value));
        return new Response(null, { status: 302, headers });
    } catch (error) {
        const headers = new Headers({ Location: `${baseUrl(request, env)}/dang-nhap?oauth_error=1` });
        headers.append('Set-Cookie', clearOAuthStateCookie());
        return new Response(null, { status: 302, headers });
    }
}

export async function handleSession(request, env) {
    try {
        const db = requireD1(env);
        const session = await getSession(db, request, { touch: true });
        if (!session) return json({ user: null });
        return json({
            user: {
                id: session.user_id,
                email: session.email,
                name: session.display_name,
                avatarUrl: session.avatar_url,
                phone: session.phone,
                locale: session.locale,
                roles: session.roles,
            },
        });
    } catch (error) {
        return apiError(error, 'Cannot load session.');
    }
}

export async function handleLogout(request, env) {
    try {
        const db = requireD1(env);
        const session = await getSession(db, request);
        if (session) await requireCsrf(db, request, session);
        const headers = new Headers();
        (await revokeSession(db, request)).forEach((value) => headers.append('Set-Cookie', value));
        return json({ ok: true }, 200, headers);
    } catch (error) {
        return apiError(error, 'Cannot log out.');
    }
}

export function handleCsrf() {
    const csrf = issueGuestCsrfCookie();
    const headers = new Headers();
    headers.append('Set-Cookie', csrf.header);
    return json({ csrfToken: csrf.token }, 200, headers);
}
