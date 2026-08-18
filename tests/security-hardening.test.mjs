import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handleR2ImageUpload } from '../worker/mediaR2/handlers.js';
import { handleGuestOrderLookup, handleGuestOrderOtpRequest } from '../worker/orderLookup/handlers.js';

const root = new URL('../', import.meta.url);
const textFile = (path) => readFile(new URL(path, root), 'utf8');
const jsonResponse = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
});

const uploadDeps = {
    jsonResponse,
    authorizeImageMutation: async () => ({ user: { id: 'admin-1' }, role: 'admin' }),
    isAllowedPublicBucket: (bucket) => bucket === 'product-images',
    normalizeObjectPath: (path) => String(path || '').replace(/^\/+/, ''),
    getStorageUrl: (path, bucket) => `/r2/${bucket}/${path}`,
};

function uploadRequest(file, path = file.name) {
    const form = new FormData();
    form.set('bucket', 'product-images');
    form.set('path', path);
    form.set('file', file);
    return new Request('https://example.test/api/r2/images/upload', { method: 'POST', body: form });
}

test('R2 upload rejects forged image MIME before storage', async () => {
    let putCalled = false;
    const env = {
        R2_IMAGES: { put: async () => { putCalled = true; } },
        IMAGES: {},
    };
    const file = new File(['<svg onload="alert(1)"></svg>'], 'attack.png', { type: 'image/png' });
    const response = await handleR2ImageUpload(uploadRequest(file), env, uploadDeps);

    assert.equal(response.status, 415);
    assert.equal(putCalled, false);
});

test('R2 upload fails closed when the re-encoder binding is missing', async () => {
    const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngHeader], 'sample.png', { type: 'image/png' });
    const response = await handleR2ImageUpload(uploadRequest(file), {
        R2_IMAGES: { put: async () => assert.fail('must not store unsanitized bytes') },
    }, uploadDeps);

    assert.equal(response.status, 503);
});

test('R2 upload stores only re-encoded WebP bytes and metadata', async () => {
    const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    let stored = null;
    const env = {
        IMAGES: {
            input: () => ({
                output: async () => ({ response: () => new Response(webp, { status: 200 }) }),
            }),
        },
        R2_IMAGES: {
            put: async (key, bytes, options) => { stored = { key, bytes, options }; },
        },
    };
    const file = new File([pngHeader], 'sample.png', { type: 'image/png' });
    const response = await handleR2ImageUpload(uploadRequest(file), env, uploadDeps);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.path, 'sample.webp');
    assert.equal(stored.key, 'product-images/sample.webp');
    assert.equal(stored.options.httpMetadata.contentType, 'image/webp');
    assert.equal(stored.options.customMetadata.sanitized, 'true');
    assert.equal(new Uint8Array(stored.bytes)[0], 0x52);
});

test('Guest order lookup requires rate limiting and a server secret', async () => {
    const request = new Request('https://example.test/api/orders/guest-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: 'DF07ABC', phone: '0901234567', otp: '123456' }),
    });
    const missingLimiter = await handleGuestOrderLookup(request.clone(), {}, {
        jsonResponse,
        SUPABASE_URL: 'https://project.supabase.co',
    });
    assert.equal(missingLimiter.status, 503);

    const missingSecret = await handleGuestOrderLookup(request.clone(), {
        ORDER_LOOKUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
        ORDER_LOOKUP_SMS_ENABLED: 'true',
    }, {
        jsonResponse,
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'publishable-key',
    });
    assert.equal(missingSecret.status, 503);
});

test('Guest order lookup fails closed until SMS OTP is configured', async () => {
    let fetchCalled = false;
    const request = new Request('https://example.test/api/orders/guest-lookup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: 'DF07ABC', phone: '0901234567' }),
    });
    const response = await handleGuestOrderOtpRequest(request, {
        ORDER_LOOKUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
        ORDER_LOOKUP_SMS_ENABLED: 'false',
    }, {
        jsonResponse,
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'publishable-key',
        fetchImpl: async () => { fetchCalled = true; },
    });

    assert.equal(response.status, 503);
    assert.equal(fetchCalled, false);
});

test('Guest order data is returned only after a valid SMS OTP for the same phone', async () => {
    const calls = [];
    const request = new Request('https://example.test/api/orders/guest-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: 'DF07ABC', phone: '0901234567', otp: '123456' }),
    });
    const response = await handleGuestOrderLookup(request, {
        ORDER_LOOKUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
        ORDER_LOOKUP_SMS_ENABLED: 'true',
        SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
    }, {
        jsonResponse,
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'publishable-key',
        fetchImpl: async (url) => {
            calls.push(url);
            if (url.endsWith('/auth/v1/verify')) {
                return jsonResponse({ user: { phone: '+84901234567' } });
            }
            return jsonResponse([{ order_code: 'DF07ABC' }]);
        },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ order_code: 'DF07ABC' }]);
    assert.equal(calls.length, 2);
    assert.match(calls[0], /\/auth\/v1\/verify$/);
    assert.match(calls[1], /lookup_guest_product_order_secure$/);
});

test('Guest order lookup rejects missing OTP before any upstream request', async () => {
    let fetchCalled = false;
    const request = new Request('https://example.test/api/orders/guest-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: 'DF07ABC', phone: '0901234567' }),
    });
    const response = await handleGuestOrderLookup(request, {
        ORDER_LOOKUP_RATE_LIMITER: { limit: async () => ({ success: true }) },
        ORDER_LOOKUP_SMS_ENABLED: 'true',
        SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
    }, {
        jsonResponse,
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'publishable-key',
        fetchImpl: async () => { fetchCalled = true; },
    });

    assert.equal(response.status, 400);
    assert.equal(fetchCalled, false);
});

test('Security-critical source invariants stay enforced', async () => {
    const [markdown, migration, headers, geminiClient, geminiDraftFunction, backupScript, packageJson, wranglerConfig, orderRoutes, orderClient] = await Promise.all([
        textFile('components/MarkdownRenderer.tsx'),
        textFile('supabase/migrations/20260722161909_security_hardening_guest_orders_and_product_brands.sql'),
        textFile('public/_headers'),
        textFile('services/geminiService.ts'),
        textFile('supabase/functions/generate-product-draft/index.ts'),
        textFile('scripts/create_full_system_backup.sh'),
        textFile('package.json'),
        textFile('wrangler.jsonc'),
        textFile('worker/orderLookup/routes.js'),
        textFile('services/api.ts'),
    ]);

    assert.match(markdown, /DOMPurify\.sanitize/);
    assert.match(markdown, /markdownRenderer\.html\s*=\s*\(\)\s*=>\s*''/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.lookup_guest_product_order_secure\(text, text\) TO service_role/);
    assert.match(migration, /WITH CHECK \(\(SELECT public\.is_admin\(\)\)\)/);
    assert.match(headers, /Content-Security-Policy:/);
    assert.match(headers, /Strict-Transport-Security:/);
    assert.match(geminiClient, /\/api\/ai\/generate/);
    assert.doesNotMatch(geminiClient, /VITE_GEMINI_API_KEY|generativelanguage\.googleapis\.com/);
    assert.match(geminiDraftFunction, /Deno\.env\.get\('GEMINI_API_KEY'\)/);
    assert.match(geminiDraftFunction, /supabaseAdmin\.auth\.getUser\(token\)/);
    assert.match(geminiDraftFunction, /ALLOWED_ROLES\.has/);
    assert.doesNotMatch(geminiDraftFunction, /VITE_GEMINI_API_KEY/);
    assert.match(backupScript, /--exclude='\.\/\.env'/);
    assert.match(backupScript, /--exclude='\.\/\.wrangler'/);
    assert.match(packageJson, /wrangler deploy --config wrangler\.d1\.production\.jsonc/);
    assert.match(wranglerConfig, /"run_worker_first": true/);
    assert.match(wranglerConfig, /"thegioitrimun\.vn\/\*"/);
    assert.match(wranglerConfig, /"www\.thegioitrimun\.vn\/\*"/);
    assert.match(wranglerConfig, /"ORDER_LOOKUP_SMS_ENABLED": "false"/);
    assert.match(orderRoutes, /\/api\/orders\/guest-lookup\/request-otp/);
    assert.match(orderClient, /requestGuestProductOrderOtp/);
    assert.match(orderClient, /otp: String\(otp/);
});
