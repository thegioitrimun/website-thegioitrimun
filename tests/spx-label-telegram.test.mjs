import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, rgb } from 'pdf-lib';
import { PancakeClient } from '../worker/integrations/pancake/client.js';
import { renderTelegramAlert, sendTelegramDocument } from '../worker/integrations/deplao/telegram.js';
import {
  SPX_A5_SIZE_POINTS,
  buildSpxLabelDescriptor,
  getSpxA5Label,
  normalizeCarrierLabelToA5,
  spxShipmentFromOrder,
} from '../worker/shipping/spxLabel.js';

async function makeCarrierPdf(width = 283.46, height = 425.2) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  page.drawRectangle({ x: 12, y: 12, width: width - 24, height: height - 24, borderWidth: 2, borderColor: rgb(0, 0, 0) });
  page.drawText('SPX TEST LABEL', { x: 30, y: height - 50, size: 18 });
  return new Uint8Array(await pdf.save());
}

test('SPX shipment detector only accepts online Shopee Xpress orders with a tracking code', () => {
  assert.deepEqual(spxShipmentFromOrder({
    received_at_shop: false,
    partner: {
      partner_name: 'Shopee Xpress',
      extend_code: 'SPXVN123',
      partner_status: 'request_received',
    },
  }), {
    provider: 'spx',
    partnerName: 'Shopee Xpress',
    trackingCode: 'SPXVN123',
    partnerStatus: 'request_received',
    providerOrderId: null,
  });
  assert.equal(spxShipmentFromOrder({ received_at_shop: true, partner: { partner_name: 'Shopee Xpress', extend_code: 'SPX1' } }), null);
  assert.equal(spxShipmentFromOrder({ received_at_shop: false, partner: { partner_name: 'GHTK', extend_code: 'GHTK1' } }), null);
  assert.equal(spxShipmentFromOrder({ received_at_shop: false, partner: { partner_name: 'Shopee Xpress' } }), null);
});

test('SPX label descriptor is enabled explicitly and only on a new tracking transition', async () => {
  const env = { SPX_LABEL_TELEGRAM_ENABLED: 'true', TELEGRAM_ORDER_ALERTS_ENABLED: 'true' };
  const order = {
    received_at_shop: false,
    partner: { partner_name: 'SPX Express', extend_code: 'SPXVN456', partner_status: 'request_received' },
  };
  const descriptor = await buildSpxLabelDescriptor({
    env, order, previousOrder: null, localOrderId: 'local-1', orderCode: 'TG-1', pancakeOrderId: '987',
  });
  assert.equal(descriptor.trackingCode, 'SPXVN456');
  assert.match(descriptor.objectKey, /^shipping-labels\/spx\/local-1\/.+\.pdf$/);
  assert.match(descriptor.filename, /^SPX-TG-1-SPXVN456-A5\.pdf$/);
  assert.equal(await buildSpxLabelDescriptor({
    env, order, previousOrder: order, localOrderId: 'local-1', orderCode: 'TG-1', pancakeOrderId: '987',
  }), null);
  assert.equal(await buildSpxLabelDescriptor({
    env: { ...env, SPX_LABEL_TELEGRAM_ENABLED: 'false' },
    order, previousOrder: null, localOrderId: 'local-1', orderCode: 'TG-1', pancakeOrderId: '987',
  }), null);
});

test('carrier PDF is preserved inside an exact A5 page without cropping', async () => {
  const source = await makeCarrierPdf();
  const normalized = await normalizeCarrierLabelToA5(source, 'application/pdf');
  assert.equal(normalized.normalized, true);
  const output = await PDFDocument.load(normalized.bytes);
  assert.equal(output.getPageCount(), 1);
  const size = output.getPage(0).getSize();
  assert.ok(Math.abs(size.width - SPX_A5_SIZE_POINTS.width) < 0.01);
  assert.ok(Math.abs(size.height - SPX_A5_SIZE_POINTS.height) < 0.01);
});

test('Pancake client requests the official shipping-label document endpoint', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: new URL(url), init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ success: true, data: ['https://content.pancake.vn/label.pdf'] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = new PancakeClient({ PANCAKE_API_KEY: 'secret', PANCAKE_SHOP_ID: '123' });
  const result = await client.getShippingDocumentUrls('987', 'SHIPPING_LABEL');
  assert.equal(result.success, true);
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.url.pathname, '/api/v1/shops/123/products/get_logistics_shipping_document');
  assert.equal(captured.url.searchParams.get('document_type'), 'SHIPPING_LABEL');
  assert.equal(captured.url.searchParams.get('api_key'), 'secret');
  assert.deepEqual(captured.body, { params: [{ order_id: '987' }] });
});

test('official Pancake label is normalized once and cached in private R2', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const source = await makeCarrierPdf();
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://pos.pages.fm/api/v1/')) {
      return new Response(JSON.stringify({ success: true, data: ['https://content.pancake.vn/spx-label'] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(source, { headers: { 'Content-Type': 'application/pdf' } });
  };
  let stored = null;
  const r2 = {
    async get(key) {
      if (!stored || stored.key !== key) return null;
      return { arrayBuffer: async () => stored.bytes.buffer.slice(stored.bytes.byteOffset, stored.bytes.byteOffset + stored.bytes.byteLength) };
    },
    async put(key, bytes, options) { stored = { key, bytes: new Uint8Array(bytes), options }; },
  };
  const db = {
    prepare() {
      return { bind() { return { run: async () => ({ meta: { changes: 1 } }) }; } };
    },
  };
  const env = {
    PANCAKE_API_KEY: 'secret', PANCAKE_SHOP_ID: '123', PRIVATE_RECORDS: r2, APP_DB: db,
  };
  const payload = {
    pancake_order_id: '987', order_id: 'local-1',
    label_object_key: 'shipping-labels/spx/local-1/hash.pdf', filename: 'SPX-TG-1-A5.pdf',
  };
  const first = await getSpxA5Label(env, payload);
  assert.equal(first.cached, false);
  assert.equal(stored.options.httpMetadata.contentType, 'application/pdf');
  const second = await getSpxA5Label(env, payload);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 2);
});

test('SPX label download rejects redirects outside trusted Pancake hosts', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (String(url).startsWith('https://pos.pages.fm/api/v1/')) {
      return new Response(JSON.stringify({ success: true, data: ['https://content.pancake.vn/spx-label'] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 302, headers: { Location: 'https://example.com/private.pdf' } });
  };
  await assert.rejects(() => getSpxA5Label({
    PANCAKE_API_KEY: 'secret', PANCAKE_SHOP_ID: '123',
    PRIVATE_RECORDS: { get: async () => null },
  }, {
    pancake_order_id: '987', order_id: 'local-1',
    label_object_key: 'shipping-labels/spx/local-1/hash.pdf', filename: 'SPX-TG-1-A5.pdf',
  }), /untrusted SPX label host/);
  assert.equal(calls, 2);
});

test('Telegram sends the A5 label as a document with an escaped print caption', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 321 } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const caption = renderTelegramAlert('pancake.spx.label.ready', {
    order_code: '<TG&1>', tracking_code: 'SPX123', provider_label: 'Shopee Xpress',
    admin_url: 'https://thegioitrimun.vn/admin/pancake-pos',
  });
  assert.match(caption, /&lt;TG&amp;1&gt;/);
  assert.match(caption, /PDF A5/);
  const messageId = await sendTelegramDocument({ TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_ADMIN_CHAT_ID: 'chat-id' }, {
    bytes: await makeCarrierPdf(SPX_A5_SIZE_POINTS.width, SPX_A5_SIZE_POINTS.height),
    filename: 'SPX-TG-1-A5.pdf', caption,
  });
  assert.equal(messageId, 321);
  assert.equal(captured.url, 'https://api.telegram.org/botbot-token/sendDocument');
  assert.equal(captured.init.method, 'POST');
  assert.ok(captured.init.body instanceof FormData);
  assert.equal(captured.init.body.get('chat_id'), 'chat-id');
  assert.equal(captured.init.body.get('parse_mode'), 'HTML');
  assert.equal(captured.init.body.get('document').name, 'SPX-TG-1-A5.pdf');
});
