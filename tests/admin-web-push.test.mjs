import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import webpush from 'web-push';
import ece from 'http_ece';
import { validateSubscription, buildPushRequest } from '../worker/adminPush/push.js';
import { dispatchAdminPush, unreadState } from '../worker/adminPush/dispatcher.js';
import { maybeHandleAdminPushRoute } from '../worker/adminPush/routes.js';
import { createSession } from '../worker/auth/session.js';

const vapid = webpush.generateVAPIDKeys();
const clientKey = createECDH('prime256v1'); clientKey.generateKeys();
const auth = randomBytes(16);
const sub = { endpoint: 'https://web.push.apple.com/test-only', keys: {
    p256dh: clientKey.getPublicKey().toString('base64url'), auth: auth.toString('base64url'),
} };
const envKeys = { ADMIN_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey, ADMIN_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey };

function database() {
    const sql = new DatabaseSync(':memory:');
    sql.exec(`PRAGMA foreign_keys=ON;
        CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT, display_name TEXT, avatar_url TEXT, phone TEXT, locale TEXT, disabled_at TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, csrf_hash TEXT, user_agent_hash TEXT, ip_hash TEXT,
            expires_at TEXT, created_at TEXT, last_seen_at TEXT, revoked_at TEXT);
        CREATE TABLE roles(id TEXT PRIMARY KEY, code TEXT);
        CREATE TABLE user_roles(user_id TEXT, role_id TEXT);
        CREATE TABLE product_orders(id TEXT PRIMARY KEY, order_code TEXT, created_at TEXT);
        INSERT INTO users(id,email) VALUES ('admin','admin@example.test'),('customer','customer@example.test');
        INSERT INTO roles VALUES ('a','admin'),('c','customer');
        INSERT INTO user_roles VALUES ('admin','a'),('customer','c');`);
    sql.exec(readFileSync(new URL('../d1/app/migrations/0022_admin_web_push.sql', import.meta.url), 'utf8'));
    const db = {
        prepare(query) {
            const statement = sql.prepare(query);
            const wrap = args => ({
                bind: (...next) => wrap(next),
                first: async () => statement.get(...args) || null,
                all: async () => ({ results: statement.all(...args) }),
                run: async () => ({ meta: statement.run(...args) }),
            });
            return wrap([]);
        },
        async batch(statements) {
            sql.exec('BEGIN');
            try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; }
            catch (e) { sql.exec('ROLLBACK'); throw e; }
        },
    };
    return { sql, db };
}

async function fixture() {
    const { db, sql } = database();
    const env = { ...envKeys, APP_DB: db };
    const adminSession = await createSession(db, 'admin', new Request('https://thegioitrimun.vn/admin'));
    const customerSession = await createSession(db, 'customer', new Request('https://thegioitrimun.vn/'));
    const route = (action, method = 'GET', body, session = adminSession, csrf = true) => {
        const path = `/api/admin/push/${action}`;
        const headers = { Cookie: session ? `tg_session=${session.token}; tg_csrf=${session.csrf}` : '' };
        if (csrf && session) headers['X-CSRF-Token'] = session.csrf;
        return maybeHandleAdminPushRoute({ env, path, request: new Request(`https://thegioitrimun.vn${path}`, {
            method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }) });
    };
    const order = (id, created = new Date().toISOString()) => sql.prepare('INSERT OR IGNORE INTO product_orders VALUES (?, ?, ?)').run(id, `TG-${id}`, created);
    return { sql, db, env, route, order, adminSession, customerSession };
}

test('Web Push payload is encrypted and signed for the browser push service', async () => {
    const payload = { title: 'Đơn hàng mới', unread: 3, url: '/admin/don-hang/order-1' };
    const details = await buildPushRequest(envKeys, sub, payload);
    assert.equal(details.headers['content-encoding'], 'aes128gcm');
    assert.match(details.headers.authorization, /^vapid t=/);
    assert.equal(details.headers.ttl, '86400');
    const decoded = ece.decrypt(Buffer.from(details.body), { version: 'aes128gcm', privateKey: clientKey, authSecret: auth });
    assert.deepEqual(JSON.parse(decoded.toString()), payload);
    assert.ok(!Buffer.from(details.body).includes(Buffer.from('Đơn hàng')));
});

test('reject arbitrary URLs, redirects disguised as hosts, malformed push keys', () => {
    for (const endpoint of ['http://web.push.apple.com/a', 'https://127.0.0.1/', 'https://web.push.apple.com.attacker.test/',
        'https://attacker.test/web.push.apple.com', 'https://user:pass@web.push.apple.com/a', 'https://web.push.apple.com:8443/a']) {
        assert.throws(() => validateSubscription({ ...sub, endpoint }), { status: 400 });
    }
    assert.throws(() => validateSubscription({ ...sub, keys: { ...sub.keys, auth: 'a' } }), { status: 400 });
    assert.equal(validateSubscription(sub).endpoint, sub.endpoint);
});

test('only authenticated admins can subscribe; every mutation requires CSRF', async () => {
    const f = await fixture();
    assert.equal((await f.route('config', 'GET', undefined, null)).status, 401);
    assert.equal((await f.route('config', 'GET', undefined, f.customerSession)).status, 403);
    assert.equal((await f.route('subscription', 'PUT', sub, f.adminSession, false)).status, 403);
    assert.equal((await f.route('subscription', 'PUT', sub)).status, 200);
    assert.equal((await f.route('config')).status, 200);
});

test('new order creates atomic delivery, replay/import does not alert; read cursors cannot erase a later order', async () => {
    const f = await fixture();
    f.order('before-subscription');
    await f.route('subscription', 'PUT', sub);
    f.order('new'); f.order('new'); f.order('historical', '2020-01-01T00:00:00.000Z');
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM admin_push_deliveries').get().n, 1);
    const state = await unreadState(f.db, 'admin');
    assert.equal(state.unread, 1);
    f.order('later');
    const response = await f.route('read', 'POST', { cursor: state.cursor });
    assert.equal((await response.json()).unread, 1);
    const sent = [];
    const transport = async (url, options) => {
        assert.equal(options.redirect, 'error');
        sent.push(JSON.parse(ece.decrypt(Buffer.from(options.body), { version: 'aes128gcm', privateKey: clientKey, authSecret: auth }).toString()));
        return new Response(null, { status: 201 });
    };
    await Promise.all([dispatchAdminPush(f.env, transport), dispatchAdminPush(f.env, transport)]);
    await dispatchAdminPush(f.env, transport);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].unread, 1);
    assert.match(sent[0].url, /^\/admin\/don-hang\//);
    assert.ok(!JSON.stringify(sent).includes('customer'));
});

test('transient failures retry and expired endpoints are disabled', async () => {
    const f = await fixture();
    await f.route('subscription', 'PUT', sub); f.order('retry');
    await dispatchAdminPush(f.env, async () => new Response(null, { status: 503 }));
    assert.equal(f.sql.prepare('SELECT status FROM admin_push_deliveries').get().status, 'pending');
    f.sql.exec("UPDATE admin_push_deliveries SET next_attempt_at='2000-01-01'");
    await dispatchAdminPush(f.env, async () => new Response(null, { status: 410 }));
    assert.equal(f.sql.prepare('SELECT status FROM admin_push_deliveries').get().status, 'expired');
    assert.equal(f.sql.prepare('SELECT active FROM admin_push_subscriptions').get().active, 0);
});

test('logout, removed admin role, disabled user and unsubscribe prevent sends', async () => {
    for (const action of ['logout', 'role', 'disabled', 'unsubscribe']) {
        const f = await fixture();
        await f.route('subscription', 'PUT', sub); f.order(action);
        if (action === 'logout') f.sql.exec("UPDATE sessions SET revoked_at='2026-01-01'");
        if (action === 'role') f.sql.exec("DELETE FROM user_roles WHERE user_id='admin'");
        if (action === 'disabled') f.sql.exec("UPDATE users SET disabled_at='2026-01-01'");
        if (action === 'unsubscribe') await f.route('subscription', 'DELETE', { endpoint: sub.endpoint });
        await dispatchAdminPush(f.env, async () => { assert.fail(`Should not send after ${action}`); });
    }
});

test('service worker shows visible notifications offline, applies badge, and click opens admin only', async () => {
    const events = {}, shown = [], badges = [], opened = [];
    const self = { addEventListener: (name, fn) => { events[name] = fn; },
        registration: { showNotification: async (...args) => shown.push(args) },
        navigator: { setAppBadge: async n => badges.push(n), clearAppBadge: async () => badges.push(0) },
        location: { origin: 'https://thegioitrimun.vn' },
        clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
    };
    vm.runInNewContext(readFileSync(new URL('../public/admin/sw.js', import.meta.url), 'utf8'), {
        self, URL, AbortSignal, fetch: async () => { throw new Error('offline'); },
    });
    let done;
    events.push({ data: { json: () => ({ unread: 4, url: 'https://evil.test' }) }, waitUntil: p => { done = p; } });
    await done;
    assert.equal(shown.length, 1); assert.deepEqual(badges, [4]);
    events.notificationclick({ notification: { close() {}, data: { url: 'https://evil.test' } }, waitUntil: p => { done = p; } });
    await done;
    assert.deepEqual(opened, ['https://thegioitrimun.vn/admin/don-hang']);
    events.push({ data: { json: () => { throw new Error('invalid'); } }, waitUntil: p => { done = p; } });
    await done;
    assert.equal(shown.length, 2);
});
