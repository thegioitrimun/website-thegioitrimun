import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createECDH, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import ece from 'http_ece';

// Resolve the runtime through Wrangler so this exercises the deployed Workers engine.
const wranglerRequire = createRequire(import.meta.resolve('wrangler'));
const { Miniflare } = wranglerRequire('miniflare');
const { build } = wranglerRequire('esbuild');

test('native Workers fetch sends encrypted push and refuses to follow provider redirects', async () => {
    const vapid = webpush.generateVAPIDKeys();
    const client = createECDH('prime256v1'); client.generateKeys();
    const auth = randomBytes(16);
    const subscription = { endpoint: 'https://web.push.apple.com/runtime-test', keys: {
        p256dh: client.getPublicKey().toString('base64url'), auth: auth.toString('base64url'),
    } };
    const payload = { title: 'Runtime test', unread: 2 };
    const bundle = await build({
        stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
            import { sendPush } from './worker/adminPush/push.js';
            export default { async fetch(request, env) {
                try { return Response.json({status: await sendPush(env, ${JSON.stringify(subscription)}, ${JSON.stringify(payload)})}); }
                catch(error) { return Response.json({error:error.message}, {status:500}); }
            } };` },
        bundle: true, platform: 'node', format: 'esm', write: false,
    });
    let replyStatus = 201;
    const calls = [];
    const runtime = new Miniflare({
        modules: true, script: bundle.outputFiles[0].text,
        compatibilityDate: '2025-09-27', compatibilityFlags: ['nodejs_compat'],
        bindings: { ADMIN_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey, ADMIN_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey },
        outboundService: async request => {
            calls.push(request.url);
            assert.equal(request.url, subscription.endpoint);
            assert.equal(request.method, 'POST');
            assert.match(request.headers.get('authorization'), /^vapid t=/);
            const decoded = ece.decrypt(Buffer.from(await request.arrayBuffer()), {
                version: 'aes128gcm', privateKey: client, authSecret: auth,
            });
            assert.deepEqual(JSON.parse(decoded.toString()), payload);
            return new Response(null, { status: replyStatus, headers: replyStatus === 307 ? { Location: 'https://attacker.test/' } : {} });
        },
    });
    try {
        let response = await runtime.dispatchFetch('http://localhost/');
        assert.deepEqual(await response.json(), { status: 201 });
        replyStatus = 307;
        response = await runtime.dispatchFetch('http://localhost/');
        assert.deepEqual(await response.json(), { status: 307 });
        assert.equal(calls.length, 2);
    } finally { await runtime.dispose(); }
});
