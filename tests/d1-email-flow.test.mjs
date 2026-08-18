import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const exists = async (file) => {
  try {
    await access(new URL(file, root));
    return true;
  } catch {
    return false;
  }
};

test('frontend does not invoke retired transactional email functions', async () => {
  const api = await read('services/api.ts');
  assert.doesNotMatch(api, /order-email-notification|appointment-email-notification|admin-scheduled-report/);
  assert.doesNotMatch(api, /api\.resend\.com|RESEND_API_KEY/);
});

test('orders and appointments create D1 notification outbox events', async () => {
  const orders = await read('worker/orders/handlers.js');
  const appointments = await read('worker/appointments/handlers.js');
  const outbox = await read('worker/email/outboxRecord.js');

  assert.match(orders, /order\.created/);
  assert.match(appointments, /appointment\.created/);
  assert.match(outbox, /INSERT OR IGNORE INTO notification_outbox/i);
  assert.match(outbox, /idempotency_key/i);
});

test('D1 outbox is dispatched through Queue and SMTP sockets', async () => {
  const outbox = await read('worker/email/outbox.js');
  const mailer = await read('worker/email/smtpMailer.js');
  const scheduler = await read('workers/admin-report-scheduler/index.mjs');

  assert.match(outbox, /NOTIFICATION_QUEUE/);
  assert.match(outbox, /notification_outbox/i);
  assert.match(outbox, /consumeNotificationQueue/);
  assert.match(mailer, /cloudflare:sockets/);
  assert.match(mailer, /secureTransport:\s*['"]on['"]/);
  assert.match(scheduler, /dispatchPendingNotifications/);
  assert.doesNotMatch(scheduler, /supabase|resend/i);
});

test('retired Supabase email functions are absent from the deploy source', async () => {
  for (const file of [
    'supabase/functions/order-email-notification/index.ts',
    'supabase/functions/appointment-email-notification/index.ts',
    'supabase/functions/admin-scheduled-report/index.ts',
  ]) {
    assert.equal(await exists(file), false, `${file} must stay retired`);
  }
});

test('D1 runtime is same-origin and does not expose Supabase connectivity', async () => {
  const worker = await read('_worker.js');
  const headers = await read('public/_headers');

  assert.doesNotMatch(worker, /https?:\/\/[^\s"']+\.supabase\.co/i);
  assert.doesNotMatch(worker, /connect-src[^\n]*supabase/i);
  assert.doesNotMatch(headers, /supabase/i);
  assert.match(worker, /function usesD1Backend/);
});
