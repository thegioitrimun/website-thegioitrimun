import assert from 'node:assert/strict';
import test from 'node:test';

import { hmacSha256Hex } from '../worker/platform/crypto.js';
import {
    buildSepayQrUrl,
    createSepayStatusToken,
    extractSepayPaymentReference,
    handleSepayPaymentStatus,
    handleSepayWebhook,
    verifySepayWebhookAuthentication,
} from '../worker/payments/sepay.js';

const SECRET = 'test-sepay-hmac-secret-with-at-least-32-characters';
const REFERENCE = 'TGTMABCDEF123456';

function createSepayDb() {
    const order = {
        id: 'order-1',
        order_code: 'TG20260820-ABCDEF12',
        status: 'pending',
        fulfillment_status: 'pending',
        payment_method: 'bank_transfer',
        payment_status: 'unpaid',
        payment_provider: 'sepay',
        payment_reference: REFERENCE,
        payment_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        paid_at: null,
        grand_total: 250000,
        total_price: 250000,
        subtotal_price: 220000,
        shipping_fee: 30000,
        customer_name: 'Khách hàng',
        customer_phone: '0901234567',
        customer_email: 'buyer@example.com',
        locale: 'vi',
        shipping_street: '1 Đường A',
        shipping_ward: 'Phường B',
        shipping_district: '',
        shipping_province: 'TP Hồ Chí Minh',
    };
    const state = {
        order,
        transactions: new Map(),
        paymentLog: { status: 'unpaid', transaction_ref: null, paid_at: null, metadata_json: '{}' },
        statusHistory: [],
        outbox: [],
        batchCount: 0,
    };

    function statement(sql) {
        return {
            sql,
            values: [],
            bind(...values) { this.values = values; return this; },
            async first() {
                if (/FROM site_content/i.test(sql)) {
                    return { payload_json: JSON.stringify({
                        bank_bin: '970436',
                        account_number: '1027290930',
                        account_holder_name: 'HO VI DAI PHUC',
                    }) };
                }
                if (/FROM sepay_transactions/i.test(sql)) {
                    return state.transactions.has(String(this.values[0])) ? { sepay_id: String(this.values[0]) } : null;
                }
                if (/FROM product_orders\s+WHERE payment_reference/i.test(sql)) {
                    return this.values[0] === state.order.payment_reference ? { ...state.order } : null;
                }
                if (/FROM product_orders WHERE id/i.test(sql)) {
                    return this.values[0] === state.order.id ? { ...state.order } : null;
                }
                return null;
            },
            async all() {
                if (/FROM product_order_items/i.test(sql)) {
                    return { results: [{
                        id: 'item-1', order_id: state.order.id, product_id: 10,
                        product_name: 'Gel trị mụn', product_sku: 'GEL-10', quantity: 1,
                        price_at_purchase: 220000, vat_rate: 0, tax_amount: 0,
                        created_at: new Date().toISOString(),
                    }] };
                }
                return { results: [] };
            },
            async run() {
                if (/INSERT INTO sepay_transactions/i.test(sql)) {
                    const [sepayId, orderId, paymentReference, gateway, accountNumber, subAccount,
                        transferType, amount, accumulated, transactionDate, referenceCode, content,
                        description, status, reason, payloadJson, receivedAt, processedAt] = this.values;
                    if (state.transactions.has(String(sepayId))) {
                        throw new Error('UNIQUE constraint failed: sepay_transactions.sepay_id');
                    }
                    state.transactions.set(String(sepayId), {
                        sepayId, orderId, paymentReference, gateway, accountNumber, subAccount,
                        transferType, amount, accumulated, transactionDate, referenceCode, content,
                        description, status, reason, payloadJson, receivedAt, processedAt,
                    });
                    return { meta: { changes: 1 } };
                }
                if (/UPDATE product_orders SET payment_status = 'paid'/i.test(sql)) {
                    if (state.order.payment_status !== 'unpaid') return { meta: { changes: 0 } };
                    state.order.paid_at = this.values[0];
                    state.order.status = this.values[1];
                    state.order.fulfillment_status = state.order.fulfillment_status === 'pending' ? 'processing' : state.order.fulfillment_status;
                    state.order.payment_status = 'paid';
                    return { meta: { changes: 1 } };
                }
                if (/UPDATE order_payment_logs/i.test(sql)) {
                    state.paymentLog = {
                        status: 'paid', transaction_ref: this.values[0], paid_at: this.values[1], metadata_json: this.values[2],
                    };
                    return { meta: { changes: 1 } };
                }
                if (/INSERT INTO order_status_history/i.test(sql)) {
                    state.statusHistory.push(this.values);
                    return { meta: { changes: 1 } };
                }
                if (/INSERT OR IGNORE INTO notification_outbox/i.test(sql)) {
                    state.outbox.push({
                        eventType: this.values[1],
                        payload: JSON.parse(this.values[7]),
                        idempotencyKey: this.values[8],
                    });
                    return { meta: { changes: 1 } };
                }
                return { meta: { changes: 1 } };
            },
        };
    }

    return {
        state,
        prepare: statement,
        async batch(statements) {
            state.batchCount += 1;
            const results = [];
            for (const current of statements) results.push(await current.run());
            return results;
        },
    };
}

async function signedWebhookRequest(payload, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
    const raw = JSON.stringify(payload);
    const signature = await hmacSha256Hex(secret, `${timestamp}.${raw}`);
    return new Request('https://example.test/api/webhooks/sepay', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-SePay-Timestamp': String(timestamp),
            'X-SePay-Signature': `sha256=${signature}`,
        },
        body: raw,
    });
}

function incomingPayload(overrides = {}) {
    return {
        id: 92704,
        gateway: 'Vietcombank',
        transactionDate: '2026-08-20 10:30:00',
        accountNumber: '1027290930',
        subAccount: '',
        code: REFERENCE,
        content: `${REFERENCE} thanh toan don hang`,
        transferType: 'in',
        description: 'KHACH HANG chuyen tien',
        transferAmount: 250000,
        accumulated: 5000000,
        referenceCode: 'FT260820ABC123',
        ...overrides,
    };
}

test('SePay QR URL carries the immutable amount and payment reference', () => {
    const url = new URL(buildSepayQrUrl({
        bank_code: '970436',
        account_number: '1027290930',
        account_holder_name: 'HỒ VĨ ĐẠI PHÚC',
        description_prefix: '',
    }, 250000, REFERENCE));
    assert.equal(url.origin, 'https://vietqr.app');
    assert.equal(url.searchParams.get('bank'), '970436');
    assert.equal(url.searchParams.get('amount'), '250000');
    assert.equal(url.searchParams.get('des'), REFERENCE);
    assert.equal(url.searchParams.get('template'), 'compact');
});

test('SePay reference uses the code field and safely falls back to transfer content', () => {
    assert.equal(extractSepayPaymentReference({ code: REFERENCE, content: '' }), REFERENCE);
    assert.equal(extractSepayPaymentReference({ code: null, content: `Thanh toan ${REFERENCE} ngay` }), REFERENCE);
    assert.equal(extractSepayPaymentReference({ code: 'OTHER123', content: 'khong co ma don' }), null);
});

test('SePay HMAC verifies raw body and rejects expired signatures', async () => {
    const payload = incomingPayload();
    const request = await signedWebhookRequest(payload);
    const raw = await request.clone().text();
    assert.equal(await verifySepayWebhookAuthentication(request, raw, { SEPAY_WEBHOOK_SECRET: SECRET }), 'hmac');

    const expiredTimestamp = Math.floor(Date.now() / 1000) - 301;
    const expired = await signedWebhookRequest(payload, SECRET, expiredTimestamp);
    await assert.rejects(
        () => verifySepayWebhookAuthentication(expired, raw, { SEPAY_WEBHOOK_SECRET: SECRET }),
        (error) => error?.status === 401,
    );
});

test('valid SePay webhook atomically marks the matching order paid and is idempotent', async () => {
    const db = createSepayDb();
    const env = { DATA_BACKEND: 'd1', APP_DB: db, SEPAY_WEBHOOK_SECRET: SECRET };
    const payload = incomingPayload();
    const response = await handleSepayWebhook(await signedWebhookRequest(payload), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(db.state.order.payment_status, 'paid');
    assert.equal(db.state.order.status, 'processing');
    assert.equal(db.state.order.fulfillment_status, 'processing');
    assert.equal(db.state.paymentLog.status, 'paid');
    assert.equal(db.state.transactions.get('92704').status, 'matched');
    assert.equal(db.state.statusHistory.length, 1);
    const paidEmail = db.state.outbox.find((entry) => entry.eventType === 'order.paid');
    assert.ok(paidEmail);
    assert.equal(paidEmail.payload.payment_status, 'paid');
    assert.equal(paidEmail.payload.transaction_ref, 'FT260820ABC123');
    assert.match(paidEmail.idempotencyKey, /^customer\/order\.paid\//);

    const replay = await handleSepayWebhook(await signedWebhookRequest(payload), env);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), { success: true });
    assert.equal(db.state.transactions.size, 1);
    assert.equal(db.state.batchCount, 1);
});

test('underpayment is recorded but never marks the order paid', async () => {
    const db = createSepayDb();
    const env = { DATA_BACKEND: 'd1', APP_DB: db, SEPAY_WEBHOOK_SECRET: SECRET };
    const response = await handleSepayWebhook(await signedWebhookRequest(incomingPayload({
        id: 92705,
        transferAmount: 249999,
    })), env);
    assert.equal(response.status, 200);
    assert.equal(db.state.order.payment_status, 'unpaid');
    assert.equal(db.state.transactions.get('92705').status, 'amount_mismatch');
    assert.equal(db.state.batchCount, 0);
});

test('payment status requires the order-scoped token', async () => {
    const db = createSepayDb();
    const env = { DATA_BACKEND: 'd1', APP_DB: db, SEPAY_WEBHOOK_SECRET: SECRET };
    const denied = await handleSepayPaymentStatus(new Request('https://example.test/status'), env, db.state.order.id);
    assert.equal(denied.status, 401);

    const token = await createSepayStatusToken(env, db.state.order.id);
    const allowed = await handleSepayPaymentStatus(new Request('https://example.test/status', {
        headers: { 'X-Payment-Token': token },
    }), env, db.state.order.id);
    assert.equal(allowed.status, 200);
    const payload = await allowed.json();
    assert.equal(payload.payment.reference, REFERENCE);
    assert.equal(payload.payment.status, 'unpaid');
    assert.equal(payload.payment.amount, 250000);
});
