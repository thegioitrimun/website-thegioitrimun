import { Buffer } from 'node:buffer';
import { buildPushPayload } from '@block65/webcrypto-web-push';

export function validateSubscription(value) {
    const invalid = () => { throw Object.assign(new Error('Đăng ký thông báo không hợp lệ.'), { status: 400 }); };
    let endpoint;
    try { endpoint = new URL(value?.endpoint); } catch { return invalid(); }
    // Endpoints are browser-generated capabilities, never arbitrary outbound URLs.
    const host = endpoint.hostname;
    const allowed = host === 'web.push.apple.com' || host.endsWith('.web.push.apple.com')
        || host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
        || host.endsWith('.updates.push.services.mozilla.com');
    if (!allowed || endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password
        || endpoint.hash || endpoint.href.length > 2048) return invalid();
    for (const [name, length] of [['p256dh', 65], ['auth', 16]]) {
        const key = value?.keys?.[name];
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(key)
            || Buffer.from(key, 'base64url').length !== length) return invalid();
    }
    if (Buffer.from(value.keys.p256dh, 'base64url')[0] !== 4) return invalid();
    return { endpoint: endpoint.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}

export function pushConfigured(env) {
    return Boolean(env.ADMIN_PUSH_VAPID_PUBLIC_KEY && env.ADMIN_PUSH_VAPID_PRIVATE_KEY);
}

export async function buildPushRequest(env, subscription, payload) {
    const validated = validateSubscription(subscription);
    const request = await buildPushPayload({ data: payload, options: { ttl: 86400, urgency: 'high' } }, validated, {
        subject: 'https://thegioitrimun.vn/admin',
        publicKey: env.ADMIN_PUSH_VAPID_PUBLIC_KEY,
        privateKey: env.ADMIN_PUSH_VAPID_PRIVATE_KEY,
    });
    return { ...request, endpoint: validated.endpoint };
}

export async function sendPush(env, subscription, payload, transport = fetch) {
    let details;
    try { details = await buildPushRequest(env, subscription, payload); }
    catch (error) { error.pushStage = 'encryption'; throw error; }
    // fetch works on Workers; no Node HTTP transport or following redirects to other hosts.
    let response;
    try { response = await transport(details.endpoint, {
        method: details.method, headers: details.headers, body: details.body,
        redirect: 'error', signal: AbortSignal.timeout(10000),
    }); } catch (error) { error.pushStage = 'transport'; throw error; }
    if (response.body) await response.body.cancel();
    return response.status;
}
