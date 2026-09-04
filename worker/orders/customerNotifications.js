import { createOutboxStatement } from '../email/outboxRecord.js';
import {
    buildOrderAutomationPayload,
    createDeplaoJobStatement,
    isDeplaoAutomationEnabled,
} from '../integrations/deplao/records.js';
import { buildOrderEmailPayload, isValidOrderEmail } from './notificationPayload.js';

export function isValidOrderPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
}

export function appendPosCustomerNotificationStatements(statements, db, env, {
    eventType,
    order,
    items = [],
    now = new Date().toISOString(),
    emailExtra = {},
    automationExtra = {},
}) {
    if (!['order.created', 'order.paid'].includes(eventType)) {
        throw new Error(`Unsupported POS customer notification event: ${eventType}`);
    }

    let emailOutboxCreated = false;
    let zaloJobCreated = false;
    const email = String(order?.customer_email || '').trim().toLowerCase();
    if (isValidOrderEmail(email)) {
        statements.push(createOutboxStatement(db, {
            eventType,
            aggregateType: 'order',
            aggregateId: order.id,
            audience: 'customer',
            recipientEmail: email,
            locale: order.locale || 'vi',
            payload: buildOrderEmailPayload(order, items, emailExtra, env),
            idempotencyKey: `customer/${eventType}/${order.id}`,
            now,
        }));
        emailOutboxCreated = true;
    }

    if (isValidOrderPhone(order?.customer_phone) && isDeplaoAutomationEnabled(env)) {
        const payload = buildOrderAutomationPayload(order, items, {
            event_type: eventType,
            ...automationExtra,
        }, env);
        statements.push(createDeplaoJobStatement(db, {
            eventType,
            orderId: order.id,
            orderCode: order.order_code,
            idempotencyKey: `deplao/${eventType}/${order.id}`,
            payload,
            now,
        }));
        zaloJobCreated = true;
    }

    return { emailOutboxCreated, zaloJobCreated };
}
