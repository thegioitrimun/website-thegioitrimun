import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { buildOrderAutomationPayload } from '../worker/integrations/deplao/records.js';
import { appendPosCustomerNotificationStatements } from '../worker/orders/customerNotifications.js';
import { dispatchPendingTelegram, renderTelegramAlert, splitTelegramMessage } from '../worker/integrations/deplao/telegram.js';
import {
  buildDeplaoCanonicalRequest,
  maintainDeplaoAutomation,
  maybeHandleDeplaoRoute,
} from '../worker/integrations/deplao/routes.js';

const DEVICE_ID = 'deplao-test-device';
const DEVICE_SECRET = 'test-shared-secret-with-more-than-24-chars';

function signedMachineRequest(path, payload = {}, nonce = randomBytes(12).toString('hex')) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const canonical = buildDeplaoCanonicalRequest({ timestamp, nonce, method: 'POST', path, bodyHash });
  const signature = createHmac('sha256', DEVICE_SECRET).update(canonical).digest('hex');
  return new Request(`https://thegioitrimun.vn${path}`, {
    method: 'POST', body,
    headers: {
      'Content-Type': 'application/json',
      'X-Deplao-Device': DEVICE_ID,
      'X-Deplao-Timestamp': timestamp,
      'X-Deplao-Nonce': nonce,
      'X-Deplao-Signature': signature,
    },
  });
}

test('order automation payload contains customer, item, payment and lookup data', () => {
  const payload = buildOrderAutomationPayload({
    id: 'order-1', order_code: 'TG001', customer_name: 'Khách A', customer_phone: '0900000000',
    shipping_street: '1 Đường A', shipping_ward: 'Phường B', shipping_province: 'TP.HCM',
    grand_total: 250000, payment_method: 'bank_transfer', payment_provider: 'sepay', payment_status: 'unpaid',
  }, [{ product_id: 1, product_name: 'Sữa rửa mặt', quantity: 2, price_at_purchase: 100000 }], {
    event_type: 'order.created', created_at: '2026-08-20T00:00:00.000Z',
  }, {});
  assert.equal(payload.order_code, 'TG001');
  assert.equal(payload.items[0].line_total, 200000);
  assert.equal(payload.shipping_address, '1 Đường A, Phường B, TP.HCM');
  assert.equal(payload.lookup_url, 'https://thegioitrimun.vn/tra-cuu-don-hang');
});

test('POS customer notifications create one email and one Zalo job with shared idempotency keys', () => {
  const boundStatements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          boundStatements.push({ sql, params });
          return { sql, params };
        },
      };
    },
  };
  const order = {
    id: 'pos-order-1', order_code: 'TG-POS-1', order_channel: 'pos', locale: 'vi',
    customer_name: 'Khách POS', customer_phone: '0912345678', customer_email: 'pos@example.com',
    payment_method: 'cash', payment_status: 'paid', paid_at: '2026-08-25T01:00:00.000Z',
    subtotal_price: 150000, taxable_amount: 150000, tax_amount: 0,
    grand_total: 150000, total_price: 150000, currency: 'VND',
  };
  const result = appendPosCustomerNotificationStatements([], db, {
    DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
  }, {
    eventType: 'order.created', order,
    items: [{ product_id: 1, product_name: 'Gel POS', quantity: 1, price_at_purchase: 150000 }],
    now: '2026-08-25T01:00:00.000Z',
  });

  assert.deepEqual(result, { emailOutboxCreated: true, zaloJobCreated: true });
  const email = boundStatements.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO notification_outbox'));
  const zalo = boundStatements.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO deplao_automation_jobs'));
  assert.ok(email);
  assert.equal(email.params[1], 'order.created');
  assert.equal(email.params[5], 'pos@example.com');
  assert.equal(email.params[8], 'customer/order.created/pos-order-1');
  assert.equal(JSON.parse(email.params[7]).payment_status, 'paid');
  assert.ok(zalo);
  assert.equal(zalo.params[1], 'order.created');
  assert.equal(zalo.params[4], 'deplao/order.created/pos-order-1');
  assert.equal(boundStatements.some(({ params }) => params.includes('order.paid')), false);
});

test('POS customer notifications skip missing phone and malformed optional email', () => {
  const boundStatements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          boundStatements.push({ sql, params });
          return { sql, params };
        },
      };
    },
  };
  const result = appendPosCustomerNotificationStatements([], db, {
    DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
  }, {
    eventType: 'order.created',
    order: {
      id: 'pos-order-2', order_code: 'TG-POS-2', customer_name: 'Khách lẻ',
      customer_phone: '', customer_email: 'khong-hop-le', payment_status: 'unpaid',
    },
    now: '2026-08-25T01:00:00.000Z',
  });
  assert.deepEqual(result, { emailOutboxCreated: false, zaloJobCreated: false });
  assert.equal(boundStatements.length, 0);
});

test('POS customer notifications independently support email-only and Zalo-only contacts', () => {
  const runCase = (order) => {
    const boundStatements = [];
    const db = {
      prepare(sql) {
        return {
          bind(...params) {
            boundStatements.push({ sql, params });
            return { sql, params };
          },
        };
      },
    };
    const result = appendPosCustomerNotificationStatements([], db, {
      DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
    }, {
      eventType: 'order.created',
      order: {
        id: order.id, order_code: order.id, customer_name: 'Khách POS',
        payment_status: 'unpaid', ...order,
      },
      now: '2026-08-25T01:00:00.000Z',
    });
    return { result, boundStatements };
  };

  const emailOnly = runCase({ id: 'email-only', customer_email: 'email@example.com', customer_phone: '' });
  assert.deepEqual(emailOnly.result, { emailOutboxCreated: true, zaloJobCreated: false });
  assert.equal(emailOnly.boundStatements.length, 1);

  const zaloOnly = runCase({ id: 'zalo-only', customer_email: '', customer_phone: '0912345678' });
  assert.deepEqual(zaloOnly.result, { emailOutboxCreated: false, zaloJobCreated: true });
  assert.equal(zaloOnly.boundStatements.length, 1);
});

test('Telegram HTML is escaped and long alerts are split below the safe limit', () => {
  const rendered = renderTelegramAlert('order.created', {
    order_code: '<TG&1>', customer_name: 'A < B', customer_phone: '0900', shipping_address: 'X & Y',
    items: Array.from({ length: 80 }, (_, index) => ({ name: `Sản phẩm ${index}`, quantity: 1, line_total: 1000 })),
    total: 80000, currency: 'VND', payment_method: 'cod', payment_status: 'unpaid', admin_url: 'https://example.com',
  });
  assert.match(rendered, /&lt;TG&amp;1&gt;/);
  assert.doesNotMatch(rendered, /<TG&1>/);
  const chunks = splitTelegramMessage(rendered, 800);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 800));
});

test('Pancake Telegram alerts identify the channel and render one escaped lifecycle change summary', () => {
  const created = renderTelegramAlert('pancake.order.created', {
    channel_label: 'Pancake POS', pancake_order_id: '<987>', order_code: 'PC-987',
    customer_name: 'Khách & Quầy', customer_phone: '0912345678',
    items: [{ name: 'Gel <mụn>', quantity: 1, line_total: 150000 }],
    total: 150000, currency: 'VND', order_status: 'completed',
    payment_method: 'cash', payment_status: 'paid', admin_url: 'https://thegioitrimun.vn/admin/pancake-pos',
  });
  assert.match(created, /GIAO DỊCH PANCAKE MỚI/);
  assert.match(created, /Pancake POS/);
  assert.match(created, /&lt;987&gt;/);
  assert.match(created, /Gel &lt;mụn&gt;/);
  assert.doesNotMatch(created, /<987>/);

  const changed = renderTelegramAlert('pancake.order.changed', {
    channel_label: 'Pancake Online', pancake_order_id: '987', order_code: 'PC-987',
    customer_name: 'Khách A', total: 150000, currency: 'VND',
    order_status: 'cancelled', payment_status: 'unpaid',
    changes: [
      { field: 'status', label: 'Trạng thái đơn', from: 'processing', to: 'cancelled', kind: 'text' },
      { field: 'grand_total', label: 'Tổng tiền', from: 120000, to: 150000, kind: 'money' },
    ],
    admin_url: 'https://thegioitrimun.vn/admin/pancake-pos',
  });
  assert.match(changed, /PANCAKE — ĐƠN ĐÃ HỦY/);
  assert.match(changed, /Đang xử lý → Đã hủy/);
  assert.match(changed, /120\.000 VND → 150\.000 VND/);
  assert.match(changed, /Mở đơn trên trang quản trị/);
});

test('Telegram Queue failure leaves the durable outbox retryable for the cron fallback', async () => {
  let queueCalls = 0;
  let retryUpdate = false;
  const db = {
    prepare(sql) {
      const statement = {
        params: [],
        bind(...params) { const bound = Object.create(statement); bound.params = params; return bound; },
        async run() {
          if (sql.includes("WHERE id = ? AND status = 'queued'")) retryUpdate = true;
          return { meta: { changes: 1 } };
        },
        async all() {
          if (sql.includes('SELECT id FROM telegram_order_outbox')) return { results: [{ id: 'telegram-1' }] };
          return { results: [] };
        },
      };
      return statement;
    },
    async batch(statements) {
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  const summary = await dispatchPendingTelegram({
    APP_DB: db,
    TELEGRAM_ORDER_ALERTS_ENABLED: 'true',
    TELEGRAM_QUEUE: {
      async send() { queueCalls += 1; throw new Error('Queue unavailable'); },
    },
  });
  assert.equal(summary.queued, 0);
  assert.equal(queueCalls, 1);
  assert.equal(retryUpdate, true);
});

test('desktop and worker canonical request format is stable', () => {
  assert.equal(buildDeplaoCanonicalRequest({
    timestamp: '123', nonce: 'abc', method: 'post', path: '/api/test', bodyHash: 'deadbeef',
  }), '123\nabc\nPOST\n/api/test\ndeadbeef');
});

test('D1 migration defines durable jobs, Telegram outbox, device heartbeat and nonce replay protection', async () => {
  const sql = await readFile(new URL('../d1/app/migrations/0018_deplao_telegram_automation.sql', import.meta.url), 'utf8');
  for (const table of ['deplao_automation_jobs', 'telegram_order_outbox', 'deplao_devices', 'deplao_request_nonces']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(sql, /delivery_unknown/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
});

test('order and SePay handlers enqueue automation inside their D1 batches', async () => {
  const [orders, sepay] = await Promise.all([
    readFile(new URL('../worker/orders/handlers.js', import.meta.url), 'utf8'),
    readFile(new URL('../worker/payments/sepay.js', import.meta.url), 'utf8'),
  ]);
  assert.match(orders, /appendOrderAutomationStatements\(statements/);
  assert.match(orders, /appendPosCustomerNotificationStatements\(statements/);
  assert.match(orders, /posPaymentEmailReplacesStatusEmail/);
  assert.match(sepay, /eventType:\s*'order\.paid'/);
  assert.match(sepay, /appendOrderAutomationStatements\(statements/);
});

test('D1 integration rejects replay, reclaims expired leases, preserves ordering and expires stale jobs', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { APP_DB: 'deplao-integration-test' },
  });
  try {
    const db = await mf.getD1Database('APP_DB');
    await db.exec('CREATE TABLE product_orders (id TEXT PRIMARY KEY)');
    const migration = await readFile(new URL('../d1/app/migrations/0018_deplao_telegram_automation.sql', import.meta.url), 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
    await db.prepare('INSERT INTO product_orders (id) VALUES (?)').bind('order-1').run();

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const insertJob = (id, eventType, availableAt = now, expiresAt = future) => db.prepare(`INSERT INTO deplao_automation_jobs (
      id, event_type, order_id, order_code, idempotency_key, payload_json, status,
      attempts, available_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, 'order-1', 'TG001', ?, '{}', 'pending', 0, ?, ?, ?, ?)`)
      .bind(id, eventType, `key/${id}`, availableAt, expiresAt, now, now).run();
    await insertJob('job-created', 'order.created');
    await insertJob('job-paid', 'order.paid');

    const env = {
      APP_DB: db,
      DEPLAO_DEVICE_ID: DEVICE_ID,
      DEPLAO_DEVICE_SECRET: DEVICE_SECRET,
      DEPLAO_ORDER_AUTOMATION_ENABLED: 'true',
      TELEGRAM_ORDER_ALERTS_ENABLED: 'false',
    };
    const call = (path, request) => maybeHandleDeplaoRoute({ path, request, env });

    const replayNonce = 'fixed-replay-nonce';
    let response = await call('/api/integrations/deplao/heartbeat', signedMachineRequest(
      '/api/integrations/deplao/heartbeat', { selectedZaloConnected: true }, replayNonce,
    ));
    assert.equal(response.status, 200);
    response = await call('/api/integrations/deplao/heartbeat', signedMachineRequest(
      '/api/integrations/deplao/heartbeat', { selectedZaloConnected: true }, replayNonce,
    ));
    assert.equal(response.status, 409);

    response = await call('/api/integrations/deplao/jobs/claim', signedMachineRequest('/api/integrations/deplao/jobs/claim'));
    let claimed = await response.json();
    assert.equal(claimed.job.id, 'job-created');

    await db.prepare("UPDATE deplao_automation_jobs SET lease_expires_at = ? WHERE id = 'job-created'")
      .bind(new Date(Date.now() - 1_000).toISOString()).run();
    response = await call('/api/integrations/deplao/jobs/claim', signedMachineRequest('/api/integrations/deplao/jobs/claim'));
    claimed = await response.json();
    assert.equal(claimed.job.id, 'job-created');

    const resultPath = '/api/integrations/deplao/jobs/job-created/result';
    response = await call(resultPath, signedMachineRequest(resultPath, {
      leaseToken: claimed.job.leaseToken,
      outcome: 'completed',
      result: { accountId: 'zalo-shop' },
    }));
    assert.equal(response.status, 200);

    response = await call('/api/integrations/deplao/jobs/claim', signedMachineRequest('/api/integrations/deplao/jobs/claim'));
    claimed = await response.json();
    assert.equal(claimed.job.id, 'job-paid');

    await db.prepare("UPDATE deplao_automation_jobs SET status = 'completed', completed_at = ? WHERE id = 'job-paid'").bind(now).run();
    await insertJob('job-expired', 'order.created', new Date(Date.now() - 10_000).toISOString(), new Date(Date.now() - 1_000).toISOString());
    await maintainDeplaoAutomation(env);
    const expired = await db.prepare("SELECT status FROM deplao_automation_jobs WHERE id = 'job-expired'").first();
    assert.equal(expired.status, 'expired');

    await db.prepare('UPDATE deplao_devices SET last_seen_at = ?, offline_notified_at = NULL WHERE device_id = ?')
      .bind(new Date(Date.now() - 20 * 60 * 1000).toISOString(), DEVICE_ID).run();
    await maintainDeplaoAutomation(env);
    let device = await db.prepare('SELECT offline_notified_at FROM deplao_devices WHERE device_id = ?').bind(DEVICE_ID).first();
    assert.ok(device.offline_notified_at);

    response = await call('/api/integrations/deplao/heartbeat', signedMachineRequest(
      '/api/integrations/deplao/heartbeat', { selectedZaloConnected: true },
    ));
    assert.equal(response.status, 200);
    device = await db.prepare('SELECT offline_notified_at FROM deplao_devices WHERE device_id = ?').bind(DEVICE_ID).first();
    assert.equal(device.offline_notified_at, null);
  } finally {
    await mf.dispose();
  }
});
