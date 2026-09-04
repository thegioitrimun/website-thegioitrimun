const encoder = new TextEncoder();

function toBase64Url(bytes) {
    let binary = '';
    const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (const byte of array) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32) {
    const value = new Uint8Array(bytes);
    crypto.getRandomValues(value);
    return toBase64Url(value);
}

export function randomId() {
    return crypto.randomUUID();
}

export async function sha256(value) {
    return toBase64Url(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

export async function sha256Hex(value) {
    const source = value instanceof ArrayBuffer
        ? value
        : ArrayBuffer.isView(value)
            ? value
            : encoder.encode(String(value));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', source));
    return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret, value) {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(String(secret || '')),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = new Uint8Array(await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(String(value ?? '')),
    ));
    return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function importAesKey(secret) {
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(String(secret || '')));
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(value, secret, context = '') {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await importAesKey(secret);
    const ciphertext = await crypto.subtle.encrypt({
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(String(context || '')),
    }, key, encoder.encode(String(value ?? '')));
    return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptText(value, secret, context = '') {
    const [encodedIv, encodedCiphertext] = String(value || '').split('.');
    if (!encodedIv || !encodedCiphertext) throw new Error('Malformed encrypted value.');
    const key = await importAesKey(secret);
    const plaintext = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv: fromBase64Url(encodedIv),
        additionalData: encoder.encode(String(context || '')),
    }, key, fromBase64Url(encodedCiphertext));
    return new TextDecoder().decode(plaintext);
}

export function decodeJwt(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('Malformed JWT.');
    return {
        header: JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]))),
        payload: JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))),
        signingInput: encoder.encode(`${parts[0]}.${parts[1]}`),
        signature: fromBase64Url(parts[2]),
    };
}

const jwksCache = new Map();

async function getJwks(url) {
    const cached = jwksCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.keys;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Cannot load OAuth signing keys (${response.status}).`);
    const payload = await response.json();
    const keys = Array.isArray(payload.keys) ? payload.keys : [];
    jwksCache.set(url, { keys, expiresAt: Date.now() + 60 * 60 * 1000 });
    return keys;
}

export async function verifyRs256Jwt(token, options) {
    const decoded = decodeJwt(token);
    if (decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('Unsupported JWT signature.');
    const keys = await getJwks(options.jwksUrl);
    const jwk = keys.find((candidate) => candidate.kid === decoded.header.kid && candidate.kty === 'RSA');
    if (!jwk) throw new Error('OAuth signing key was not found.');
    const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
    );
    const valid = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        key,
        decoded.signature,
        decoded.signingInput,
    );
    if (!valid) throw new Error('Invalid OAuth token signature.');

    const now = Math.floor(Date.now() / 1000);
    const payload = decoded.payload;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(options.audience)) throw new Error('Invalid OAuth audience.');
    if (options.issuer) {
        const issuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
        if (!issuers.includes(payload.iss)) throw new Error('Invalid OAuth issuer.');
    }
    if (!payload.exp || Number(payload.exp) <= now - 30) throw new Error('OAuth token has expired.');
    if (payload.iat && Number(payload.iat) > now + 120) throw new Error('Invalid OAuth issue time.');
    if (options.nonce && payload.nonce !== options.nonce) throw new Error('Invalid OAuth nonce.');
    return payload;
}

function pemToBytes(pem) {
    const base64 = String(pem || '')
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function signEs256Jwt(header, payload, privateKeyPem) {
    const encodedHeader = toBase64Url(encoder.encode(JSON.stringify(header)));
    const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const signingInput = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToBytes(privateKeyPem),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput);
    return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

export function timingSafeEqual(left, right) {
    const a = encoder.encode(String(left || ''));
    const b = encoder.encode(String(right || ''));
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
    return mismatch === 0;
}
