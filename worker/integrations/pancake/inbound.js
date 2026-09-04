import { randomId, sha256 } from '../../platform/crypto.js';
import {
    buildOrderAutomationPayload,
    createTelegramOutboxStatement,
    isTelegramOrderAlertsEnabled,
} from '../deplao/records.js';
import { dispatchPendingTelegram } from '../deplao/telegram.js';
import { dispatchPendingNotifications } from '../../email/dispatcher.js';
import { appendPosCustomerNotificationStatements } from '../../orders/customerNotifications.js';
import {
    buildSpxLabelDescriptor,
    buildSpxTelegramPayload,
    createSpxShipmentStatement,
} from '../../shipping/spxLabel.js';
import { PancakeClient, getPancakeConfig } from './client.js';
import { normalizePancakePhone } from './mappers.js';
import { getPancakeSyncSettings, isPancakeInboundEnabled } from './settings.js';

const INBOUND_TERMINAL = new Set(['completed', 'ignored', 'failed']);

function boundedInteger(value, fallback, min, max) {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function integer(value, fallback = 0) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(value, max = 1000) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validIso(value, fallback = null) {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function stableJson(value) {
    if (value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function safelyParseJson(value, fallback = null) {
    try {
        const parsed = JSON.parse(String(value || ''));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function retryDelay(attempt) {
    return Math.min(60 * 60, 30 * Math.pow(2, Math.max(0, attempt - 1)));
}

function rowsFromPayload(payload, resourceType) {
    const plural = resourceType === 'order' ? 'orders' : 'customers';
    const singular = resourceType;
    const value = payload?.data ?? payload?.[plural] ?? payload?.[singular] ?? payload;
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    return value && typeof value === 'object' ? [value] : [];
}

function firstEntity(payload, resourceType) {
    return rowsFromPayload(payload, resourceType)[0] || null;
}

function remoteId(entity, resourceType) {
    if (resourceType === 'order') return entity?.id ?? entity?.order_id ?? entity?.system_id ?? null;
    return entity?.id ?? entity?.customer_id ?? null;
}

function remoteUpdatedAt(entity) {
    return validIso(entity?.updated_at ?? entity?.last_order_at ?? entity?.inserted_at, null);
}

function responsePageCount(payload) {
    return Math.max(1, integer(payload?.total_pages ?? payload?.meta?.total_pages, 1));
}

function customerPhones(customer) {
    const values = [
        ...(Array.isArray(customer?.phone_numbers) ? customer.phone_numbers : []),
        customer?.phone_number,
        customer?.phoneNumber,
        customer?.bill_phone_number,
    ];
    return [...new Set(values.map(normalizePancakePhone).filter(Boolean))];
}

function customerEmails(customer) {
    const values = [
        ...(Array.isArray(customer?.emails) ? customer.emails : []),
        customer?.email,
        customer?.bill_email,
    ];
    return [...new Set(values.map((value) => compactText(value, 320).toLowerCase()).filter(Boolean))];
}

function orderCustomer(order) {
    const customer = order?.customer && typeof order.customer === 'object' ? order.customer : {};
    const address = order?.shipping_address && typeof order.shipping_address === 'object'
        ? order.shipping_address
        : {};
    const phoneNumbers = [
        ...(Array.isArray(customer.phone_numbers) ? customer.phone_numbers : []),
        customer.phone_number,
        order?.bill_phone_number,
        address.phone_number,
    ].filter(Boolean);
    const emails = [
        ...(Array.isArray(customer.emails) ? customer.emails : []),
        customer.email,
        order?.bill_email,
    ].filter(Boolean);
    return {
        ...customer,
        id: customer.id ?? customer.customer_id ?? order?.customer_id ?? null,
        name: customer.name ?? order?.bill_full_name ?? address.full_name ?? 'Khách lẻ',
        phone_numbers: phoneNumbers,
        emails,
        shop_customer_address: customer.shop_customer_address ?? (Object.keys(address).length ? [address] : []),
        updated_at: customer.updated_at ?? order?.updated_at,
    };
}

function pancakeOrderStatus(order) {
    const code = integer(order?.status, 0);
    if (code === 6 || code === 7) return 'cancelled';
    if ([4, 5, 15].includes(code)) return 'refunded';
    if (code === 2) return 'shipped';
    if ([3, 16].includes(code)) return 'completed';
    if ([0, 17].includes(code)) return 'pending';
    return 'processing';
}

function pancakeFulfillmentStatus(status) {
    if (status === 'cancelled' || status === 'refunded') return 'cancelled';
    if (status === 'completed') return 'completed';
    if (status === 'shipped') return 'shipped';
    if (status === 'processing') return 'processing';
    return 'pending';
}

function paymentAmounts(order) {
    const transfer = Math.max(0, integer(order?.transfer_money));
    const cash = Math.max(0, integer(order?.cash));
    const cod = Math.max(0, integer(order?.cod));
    const alternatives = [
        order?.charged_by_card,
        order?.charged_by_momo,
        order?.charged_by_qrpay,
        order?.charged_by_vnpay,
        order?.charged_by_fundiin,
        order?.charged_by_kredivo,
    ].reduce((sum, value) => sum + Math.max(0, integer(value)), 0);
    return { transfer, cash, cod, alternatives };
}

function pancakePayment(order, channel, status) {
    const amounts = paymentAmounts(order);
    const method = channel === 'pos'
        ? (amounts.transfer > 0 || amounts.alternatives > 0 ? 'bank_transfer' : 'cash')
        : (amounts.transfer > 0 || amounts.alternatives > 0 ? 'bank_transfer' : 'cod');
    const paid = amounts.cash > 0
        || amounts.transfer > 0
        || amounts.alternatives > 0
        || integer(order?.status) === 16
        || (channel === 'pos' && status === 'completed');
    return { method, status: status === 'refunded' ? 'refunded' : paid ? 'paid' : 'unpaid' };
}

function orderChannel(order) {
    return order?.received_at_shop === true || order?.is_from_ecommerce === false ? 'pos' : 'online';
}

export function pancakeFinancials(order, channel, itemSubtotal = 0, itemDiscount = 0) {
    const subtotal = Math.max(0, integer(order?.total_price, itemSubtotal) || itemSubtotal);
    const explicitAfterItemDiscount = order?.total_price_after_sub_discount;
    const inferredItemDiscount = explicitAfterItemDiscount == null || explicitAfterItemDiscount === ''
        ? 0
        : Math.max(0, subtotal - Math.max(0, integer(explicitAfterItemDiscount)));
    const lineDiscount = Math.max(0, Math.min(subtotal, Math.max(integer(itemDiscount), inferredItemDiscount)));
    const orderDiscount = Math.max(0, Math.min(subtotal - lineDiscount, integer(order?.total_discount)));
    const discount = lineDiscount + orderDiscount;
    const tax = Math.max(0, integer(order?.tax));
    const shippingFee = channel === 'pos' ? 0 : Math.max(0, integer(order?.shipping_fee));
    const computedGrandTotal = Math.max(0, subtotal - discount + tax + shippingFee);
    return {
        subtotal_price: subtotal,
        discount_amount: discount,
        tax_amount: tax,
        shipping_fee: shippingFee,
        grand_total: computedGrandTotal,
    };
}

const CHANGE_LABELS = Object.freeze({
    order_channel: 'Kênh bán',
    status: 'Trạng thái đơn',
    payment_method: 'Phương thức thanh toán',
    payment_status: 'Trạng thái thanh toán',
    subtotal_price: 'Tạm tính',
    discount_amount: 'Giảm giá',
    tax_amount: 'Thuế',
    shipping_fee: 'Phí vận chuyển',
    grand_total: 'Tổng tiền',
});

const MONEY_CHANGE_FIELDS = new Set([
    'subtotal_price', 'discount_amount', 'tax_amount', 'shipping_fee', 'grand_total',
]);

function addChange(changes, field, previous, next) {
    const numeric = MONEY_CHANGE_FIELDS.has(field);
    const from = numeric ? integer(previous) : String(previous ?? '');
    const to = numeric ? integer(next) : String(next ?? '');
    if (from === to) return;
    changes.push({ field, label: CHANGE_LABELS[field] || field, from, to, kind: numeric ? 'money' : 'text' });
}

function pancakeOrderChanges({
    localOrder,
    previousRemote,
    channel,
    status,
    payment,
    financials,
}) {
    const changes = [];
    addChange(changes, 'status', localOrder?.status, status);
    addChange(changes, 'payment_method', localOrder?.payment_method, payment.method);
    addChange(changes, 'payment_status', localOrder?.payment_status, payment.status);
    if (!previousRemote) return changes;

    const previousChannel = orderChannel(previousRemote);
    const previousItems = remoteItems(previousRemote);
    const previousSubtotal = previousItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const previousItemDiscount = previousItems.reduce((sum, item) => sum + item.discount, 0);
    const previousFinancials = pancakeFinancials(
        previousRemote,
        previousChannel,
        previousSubtotal,
        previousItemDiscount,
    );
    addChange(changes, 'order_channel', previousChannel, channel);
    for (const field of MONEY_CHANGE_FIELDS) addChange(changes, field, previousFinancials[field], financials[field]);
    return changes;
}

function telegramItems(items) {
    return items.map((item) => ({
        product_id: item.localProductId ?? null,
        product_name: item.name,
        product_sku: item.sku,
        quantity: item.quantity,
        price_at_purchase: item.price,
        line_total: item.price * item.quantity,
    }));
}

function buildPancakeTelegramPayload({
    eventType,
    remoteOrderId,
    order,
    items,
    channel,
    status,
    payment,
    financials,
    changes = [],
    updatedAt,
}, env) {
    const payloadOrder = {
        ...order,
        status,
        payment_method: payment.method,
        payment_status: payment.status,
        payment_provider: 'pancake',
        payment_reference: `pancake:${remoteOrderId}`,
        ...financials,
        total_price: financials.grand_total,
    };
    return {
        ...buildOrderAutomationPayload(payloadOrder, telegramItems(items), {
            event_type: eventType,
            transaction_ref: `pancake:${remoteOrderId}`,
            received_amount: payment.status === 'paid' ? financials.grand_total : 0,
            created_at: updatedAt,
        }, env),
        source_system: 'pancake',
        pancake_order_id: remoteOrderId,
        order_channel: channel,
        channel_label: channel === 'pos' ? 'Pancake POS' : 'Pancake Online',
        changes,
        remote_updated_at: updatedAt,
    };
}

export function remoteItems(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const byVariation = new Map();
    for (const item of items) {
        const variation = item?.variation_info && typeof item.variation_info === 'object' ? item.variation_info : {};
        const variationId = compactText(item?.variation_id ?? variation.id, 200) || null;
        const productId = compactText(item?.product_id ?? variation.product_id, 200) || null;
        const key = variationId || `product:${productId || 'unknown'}:${byVariation.size}`;
        const quantity = Math.max(1, integer(item?.quantity, 1));
        const price = Math.max(0, integer(
            variation.retail_price ?? item?.retail_price ?? item?.price_at_purchase ?? item?.price,
            0,
        ));
        const discount = Math.max(0, integer(
            item?.total_discount,
            Math.max(0, integer(item?.discount_each_product)) * quantity,
        ));
        const existing = byVariation.get(key);
        if (existing) {
            existing.quantity += quantity;
            existing.discount += discount;
            continue;
        }
        const images = Array.isArray(variation.images) ? variation.images : [];
        byVariation.set(key, {
            productId,
            variationId,
            quantity,
            price,
            discount,
            name: compactText(variation.name ?? item?.product_name ?? item?.name, 500) || 'Sản phẩm Pancake',
            sku: compactText(variation.custom_id ?? variation.barcode ?? item?.sku, 255) || null,
            image: compactText(images[0] ?? item?.image, 2000) || null,
        });
    }
    return [...byVariation.values()];
}

async function upsertCustomer(db, customer, source = 'pancake_pos') {
    const pancakeCustomerId = remoteId(customer, 'customer');
    const phones = customerPhones(customer);
    const emails = customerEmails(customer);
    const normalizedPhone = phones[0] || null;
    const email = emails[0] || null;
    let existing = null;
    if (pancakeCustomerId) {
        existing = await db.prepare('SELECT * FROM pancake_customers WHERE pancake_customer_id = ? LIMIT 1')
            .bind(String(pancakeCustomerId)).first();
    }
    if (!existing && normalizedPhone) {
        existing = await db.prepare('SELECT * FROM pancake_customers WHERE normalized_phone = ? ORDER BY updated_at DESC LIMIT 1')
            .bind(normalizedPhone).first();
    }

    const now = new Date().toISOString();
    const id = existing?.id || randomId();
    const addresses = Array.isArray(customer?.shop_customer_address)
        ? customer.shop_customer_address
        : Array.isArray(customer?.addresses) ? customer.addresses : [];
    const name = compactText(customer?.name ?? customer?.bill_full_name, 255) || existing?.name || 'Khách lẻ';
    await db.prepare(`
        INSERT INTO pancake_customers (
            id, pancake_customer_id, normalized_phone, name, phone, email, gender,
            date_of_birth, address_json, source, linked_user_id, raw_json,
            first_seen_at, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            pancake_customer_id = COALESCE(excluded.pancake_customer_id, pancake_customers.pancake_customer_id),
            normalized_phone = COALESCE(excluded.normalized_phone, pancake_customers.normalized_phone),
            name = excluded.name,
            phone = COALESCE(excluded.phone, pancake_customers.phone),
            email = COALESCE(excluded.email, pancake_customers.email),
            gender = COALESCE(excluded.gender, pancake_customers.gender),
            date_of_birth = COALESCE(excluded.date_of_birth, pancake_customers.date_of_birth),
            address_json = CASE WHEN excluded.address_json = '[]' THEN pancake_customers.address_json ELSE excluded.address_json END,
            source = excluded.source,
            raw_json = excluded.raw_json,
            last_seen_at = excluded.last_seen_at,
            updated_at = excluded.updated_at
    `).bind(
        id,
        pancakeCustomerId == null ? null : String(pancakeCustomerId),
        normalizedPhone,
        name,
        phones[0] || existing?.phone || null,
        email,
        compactText(customer?.gender, 40) || null,
        compactText(customer?.date_of_birth, 40) || null,
        JSON.stringify(addresses),
        source,
        existing?.linked_user_id || null,
        JSON.stringify(customer || {}),
        existing?.first_seen_at || now,
        now,
        existing?.created_at || now,
        now,
    ).run();

    const localEntityId = normalizedPhone ? `phone:${normalizedPhone}` : `pancake:${String(pancakeCustomerId || id)}`;
    if (pancakeCustomerId != null) {
        await db.prepare(`
            INSERT INTO pancake_entity_links (
                entity_type, local_entity_id, pancake_entity_id, sync_status,
                last_synced_at, created_at, updated_at
            ) VALUES ('customer', ?, ?, 'synced', ?, ?, ?)
            ON CONFLICT(entity_type, local_entity_id) DO UPDATE SET
                pancake_entity_id = excluded.pancake_entity_id,
                sync_status = 'synced', last_error = NULL,
                last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at
        `).bind(localEntityId, String(pancakeCustomerId), now, now, now).run();
    }
    return { id, pancakeCustomerId: pancakeCustomerId == null ? null : String(pancakeCustomerId), normalizedPhone, name, email };
}

async function linkedProducts(db, items) {
    const ids = [...new Set(items.map((item) => item.variationId).filter(Boolean))];
    if (!ids.length) return new Map();
    const rows = await db.prepare(`SELECT local_entity_id, pancake_entity_id, pancake_variation_id
        FROM pancake_entity_links
        WHERE entity_type = 'product' AND pancake_variation_id IN (${ids.map(() => '?').join(',')})`)
        .bind(...ids).all();
    return new Map((rows.results || []).map((row) => [String(row.pancake_variation_id), row]));
}

function orderAddress(order, channel) {
    const address = order?.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : {};
    if (channel === 'pos') return { street: '', ward: '', district: '', province: '' };
    return {
        street: compactText(address.address ?? address.full_address, 500),
        ward: compactText(address.commune_name ?? address.ward_name, 255),
        district: compactText(address.district_name, 255),
        province: compactText(address.province_name, 255),
    };
}

function mapInboundOrderItems(items, links) {
    return items.map((item) => {
        const link = item.variationId ? links.get(item.variationId) : null;
        const localProductId = link && /^\d+$/.test(String(link.local_entity_id))
            ? Number(link.local_entity_id)
            : null;
        return { ...item, link, localProductId };
    });
}

function findExistingOrderItem(existingItems, item) {
    if (item.variationId) {
        const matchedVariation = existingItems.find((existing) => (
            String(existing.external_variation_id || '') === String(item.variationId)
        ));
        if (matchedVariation) return matchedVariation;
    }
    if (item.localProductId != null) {
        return existingItems.find((existing) => Number(existing.product_id) === Number(item.localProductId)) || null;
    }
    return null;
}

function appendPancakeItemSnapshotStatements(statements, db, orderId, mappedItems, existingItems, now) {
    if (!mappedItems.length) return;
    statements.push(db.prepare('DELETE FROM product_order_items WHERE order_id = ?').bind(orderId));
    for (const item of mappedItems) {
        const existing = findExistingOrderItem(existingItems, item);
        const unchangedPriceAndQuantity = existing
            && Number(existing.quantity) === Number(item.quantity)
            && Number(existing.price_at_purchase) === Number(item.price);
        statements.push(db.prepare(`INSERT INTO product_order_items (
            id, order_id, product_id, product_name, product_sku, product_image_path,
            quantity, price_at_purchase, vat_rate, tax_amount,
            external_product_id, external_variation_id, source_system, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
                existing?.id || randomId(), orderId, item.localProductId,
                item.name || existing?.product_name || 'Sản phẩm Pancake',
                item.sku || existing?.product_sku || null,
                item.image || existing?.product_image_path || null,
                item.quantity, item.price, Number(existing?.vat_rate || 0),
                unchangedPriceAndQuantity ? Number(existing?.tax_amount || 0) : 0,
                item.productId, item.variationId,
                existing?.source_system || 'pancake', existing?.created_at || now,
            ));
    }
}

async function upsertOrder(db, env, order) {
    const pancakeOrderId = remoteId(order, 'order');
    if (pancakeOrderId == null) throw Object.assign(new Error('Pancake order ID is missing.'), { retryable: false });
    const remoteOrderId = String(pancakeOrderId);
    const updatedAt = remoteUpdatedAt(order) || new Date().toISOString();
    const checksum = await sha256(stableJson(order));
    const inbound = await db.prepare('SELECT * FROM pancake_inbound_orders WHERE pancake_order_id = ? LIMIT 1')
        .bind(remoteOrderId).first();
    const channel = orderChannel(order);
    const status = pancakeOrderStatus(order);
    const fulfillmentStatus = pancakeFulfillmentStatus(status);
    const payment = pancakePayment(order, channel, status);
    const remoteOrderItems = remoteItems(order);
    const remoteItemSubtotal = remoteOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const remoteItemDiscount = remoteOrderItems.reduce((sum, item) => sum + item.discount, 0);
    const financials = pancakeFinancials(order, channel, remoteItemSubtotal, remoteItemDiscount);
    if (inbound && inbound.payload_checksum === checksum) {
        const projection = await db.prepare(`SELECT o.status, o.payment_method, o.payment_status,
                o.order_channel, o.subtotal_price, o.discount_amount, o.tax_amount,
                o.shipping_fee, o.grand_total,
                (SELECT COUNT(*) FROM product_order_items i WHERE i.order_id = o.id) AS item_count
            FROM product_orders o WHERE o.id = ? LIMIT 1`).bind(inbound.local_order_id).first();
        const projectionMatches = projection
            && String(projection.status) === status
            && String(projection.payment_method) === payment.method
            && String(projection.payment_status) === payment.status
            && String(projection.order_channel) === channel
            && integer(projection.subtotal_price) === financials.subtotal_price
            && integer(projection.discount_amount) === financials.discount_amount
            && integer(projection.tax_amount) === financials.tax_amount
            && integer(projection.shipping_fee) === financials.shipping_fee
            && integer(projection.grand_total) === financials.grand_total
            && integer(projection.item_count) === remoteOrderItems.length;
        if (projectionMatches) return { unchanged: true, orderId: inbound.local_order_id };
    }
    if (inbound?.pancake_updated_at && inbound.pancake_updated_at > updatedAt) {
        return { stale: true, orderId: inbound.local_order_id };
    }

    const customer = await upsertCustomer(db, orderCustomer(order), channel === 'pos' ? 'pancake_pos' : 'pancake_online');
    const customId = compactText(order?.custom_id, 120);
    const remoteLink = await db.prepare(`SELECT * FROM pancake_entity_links
        WHERE entity_type = 'order' AND pancake_entity_id = ? LIMIT 1`).bind(remoteOrderId).first();
    let localOrder = remoteLink
        ? await db.prepare('SELECT * FROM product_orders WHERE id = ? LIMIT 1').bind(remoteLink.local_entity_id).first()
        : null;
    if (!localOrder && customId) {
        localOrder = await db.prepare('SELECT * FROM product_orders WHERE order_code = ? LIMIT 1').bind(customId).first();
    }

    const now = new Date().toISOString();
    const rawJson = JSON.stringify(order);
    const pancakeCustomerId = customer.pancakeCustomerId;
    const productLinks = await linkedProducts(db, remoteOrderItems);
    const mappedItems = mapInboundOrderItems(remoteOrderItems, productLinks);
    const hasUnmappedItems = mappedItems.some((item) => item.localProductId == null);
    const address = orderAddress(order, channel);

    if (localOrder) {
        const existingItemsResult = await db.prepare(
            'SELECT * FROM product_order_items WHERE order_id = ? ORDER BY created_at, id',
        ).bind(localOrder.id).all();
        const existingItems = existingItemsResult.results || [];
        const previousRemote = inbound ? safelyParseJson(inbound.raw_json) : null;
        const changes = pancakeOrderChanges({
            localOrder,
            previousRemote,
            channel,
            status,
            payment,
            financials,
        });
        const spxLabel = await buildSpxLabelDescriptor({
            env,
            order,
            previousOrder: previousRemote,
            localOrderId: localOrder.id,
            orderCode: localOrder.order_code,
            pancakeOrderId: remoteOrderId,
        });
        const statements = [
            db.prepare(`UPDATE product_orders SET
                customer_name = CASE WHEN ? <> '' THEN ? ELSE customer_name END,
                customer_phone = CASE WHEN ? <> '' THEN ? ELSE customer_phone END,
                customer_email = COALESCE(?, customer_email), order_channel = ?,
                shipping_street = CASE WHEN ? <> '' THEN ? ELSE shipping_street END,
                shipping_ward = CASE WHEN ? <> '' THEN ? ELSE shipping_ward END,
                shipping_district = CASE WHEN ? <> '' THEN ? ELSE shipping_district END,
                shipping_province = CASE WHEN ? <> '' THEN ? ELSE shipping_province END,
                notes = ?, status = ?, fulfillment_status = ?, payment_method = ?, payment_status = ?,
                paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
                subtotal_price = ?, discount_amount = ?, taxable_amount = ?, tax_amount = ?,
                shipping_fee = ?, shipping_net_amount = ?, currency = ?, grand_total = ?, total_price = ?,
                updated_at = ?
                WHERE id = ?`).bind(
                customer.name, customer.name,
                customer.normalizedPhone || '', customer.normalizedPhone || '',
                customer.email, channel,
                address.street, address.street, address.ward, address.ward,
                address.district, address.district, address.province, address.province,
                compactText(order?.note_print ?? order?.note, 2000) || null,
                status, fulfillmentStatus, payment.method, payment.status,
                payment.status, updatedAt,
                financials.subtotal_price, financials.discount_amount,
                Math.max(0, financials.subtotal_price - financials.discount_amount),
                financials.tax_amount, financials.shipping_fee, financials.shipping_fee,
                compactText(order?.order_currency, 20) || localOrder.currency || 'VND',
                financials.grand_total, financials.grand_total, now, localOrder.id,
            ),
            db.prepare(`INSERT INTO pancake_entity_links (
                    entity_type, local_entity_id, pancake_entity_id, pancake_parent_id,
                    sync_status, last_synced_at, created_at, updated_at
                ) VALUES ('order', ?, ?, ?, 'synced', ?, ?, ?)
                ON CONFLICT(entity_type, local_entity_id) DO UPDATE SET
                    pancake_entity_id = excluded.pancake_entity_id,
                    pancake_parent_id = excluded.pancake_parent_id,
                    sync_status = 'synced', last_error = NULL,
                    last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at`)
                .bind(localOrder.id, remoteOrderId, pancakeCustomerId, now, now, now),
            db.prepare(`INSERT INTO pancake_inbound_orders (
                pancake_order_id, local_order_id, pancake_customer_id, pancake_updated_at,
                    payload_checksum, raw_json, import_status, first_seen_at, last_seen_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pancake_order_id) DO UPDATE SET
                    local_order_id = excluded.local_order_id,
                    pancake_customer_id = excluded.pancake_customer_id,
                    pancake_updated_at = excluded.pancake_updated_at,
                    payload_checksum = excluded.payload_checksum,
                    raw_json = excluded.raw_json,
                    import_status = excluded.import_status, last_error = NULL,
                    last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`)
                .bind(remoteOrderId, localOrder.id, pancakeCustomerId, updatedAt, checksum, rawJson,
                    hasUnmappedItems ? 'partial' : 'linked',
                    inbound?.first_seen_at || now, now, inbound?.created_at || now, now),
        ];
        appendPancakeItemSnapshotStatements(statements, db, localOrder.id, mappedItems, existingItems, now);
        if (spxLabel) {
            statements.push(
                db.prepare(`UPDATE product_orders SET shipping_provider = 'spx', shipping_code = ?, updated_at = ?
                    WHERE id = ?`).bind(spxLabel.trackingCode, now, localOrder.id),
                createSpxShipmentStatement(db, spxLabel, now),
                createTelegramOutboxStatement(db, {
                    eventType: 'pancake.spx.label.ready',
                    orderId: localOrder.id,
                    idempotencyKey: `telegram/pancake.spx.label.ready/${remoteOrderId}/${spxLabel.trackingDigest}`,
                    payload: buildSpxTelegramPayload(spxLabel, env),
                    now,
                }),
            );
        }
        if (localOrder.status !== status) {
            statements.push(db.prepare(`INSERT INTO order_status_history (
                id, order_id, from_status, to_status, actor_role, note, created_at
            ) VALUES (?, ?, ?, ?, 'integration', 'Đồng bộ trạng thái từ Pancake POS', ?)`)
                .bind(randomId(), localOrder.id, localOrder.status, status, now));
        }
        if (localOrder.payment_status !== payment.status) {
            statements.push(db.prepare(`INSERT INTO order_payment_logs (
                id, order_id, method, amount, status, transaction_ref, paid_at, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(randomId(), localOrder.id, payment.method, financials.grand_total, payment.status,
                    `pancake:${remoteOrderId}`, payment.status === 'paid' ? updatedAt : null,
                    JSON.stringify({ source: 'pancake', remoteOrderId }), now));
        }
        let customerNotification = { emailOutboxCreated: false, zaloJobCreated: false };
        const becamePaid = String(localOrder.payment_status || 'unpaid') === 'unpaid'
            && payment.status === 'paid';
        if (channel === 'pos' && becamePaid) {
            customerNotification = appendPosCustomerNotificationStatements(statements, db, env, {
                eventType: 'order.paid',
                order: {
                    ...localOrder,
                    customer_name: customer.name || localOrder.customer_name,
                    customer_phone: customer.normalizedPhone || localOrder.customer_phone,
                    customer_email: customer.email || localOrder.customer_email,
                    locale: localOrder.locale || 'vi',
                    status,
                    fulfillment_status: fulfillmentStatus,
                    payment_method: payment.method,
                    payment_status: payment.status,
                    payment_provider: 'pancake',
                    payment_reference: `pancake:${remoteOrderId}`,
                    paid_at: updatedAt,
                    ...financials,
                    total_price: financials.grand_total,
                    order_channel: channel,
                },
                items: remoteOrderItems,
                now,
                emailExtra: {
                    transaction_ref: `pancake:${remoteOrderId}`,
                },
                automationExtra: {
                    paid_at: updatedAt,
                    transaction_ref: `pancake:${remoteOrderId}`,
                    received_amount: financials.grand_total,
                },
            });
        }
        let telegramOutboxCreated = Boolean(spxLabel);
        if (changes.length && isTelegramOrderAlertsEnabled(env)) {
            const payload = buildPancakeTelegramPayload({
                eventType: 'pancake.order.changed',
                remoteOrderId,
                order: {
                    ...localOrder,
                    customer_name: customer.name || localOrder.customer_name,
                    customer_phone: customer.normalizedPhone || localOrder.customer_phone,
                    customer_email: customer.email || localOrder.customer_email,
                },
                items: remoteOrderItems,
                channel,
                status,
                payment,
                financials,
                changes,
                updatedAt,
            }, env);
            statements.push(createTelegramOutboxStatement(db, {
                eventType: 'pancake.order.changed',
                orderId: localOrder.id,
                idempotencyKey: `telegram/pancake.order.changed/${remoteOrderId}/${checksum}`,
                payload,
                now,
            }));
            telegramOutboxCreated = true;
        }
        await db.batch(statements);
        return {
            linked: true,
            orderId: localOrder.id,
            channel,
            changes,
            telegramOutboxCreated,
            ...customerNotification,
        };
    }

    const mapped = mappedItems;
    const { subtotal_price: subtotal, discount_amount: discount, tax_amount: tax,
        shipping_fee: shippingFee, grand_total: grandTotal } = financials;
    const createdAt = validIso(order?.inserted_at, now);
    const localOrderId = randomId();
    const displayId = compactText(order?.display_id ?? remoteOrderId, 100).replace(/[^a-zA-Z0-9_-]/g, '');
    const orderCode = `PC-${displayId || remoteOrderId}`.slice(0, 120);
    const spxLabel = await buildSpxLabelDescriptor({
        env,
        order,
        previousOrder: null,
        localOrderId,
        orderCode,
        pancakeOrderId: remoteOrderId,
    });
    const shouldApplyInventory = channel === 'pos' && !['cancelled', 'refunded'].includes(status);
    const statements = [
        db.prepare(`INSERT INTO product_orders (
            id, order_code, checkout_idempotency_key, user_id, customer_name, customer_phone,
            customer_email, locale, shipping_street, shipping_ward, shipping_district,
            shipping_province, notes, status, fulfillment_status, payment_method, payment_status,
            subtotal_price, discount_amount, taxable_amount, tax_amount, shipping_fee,
            shipping_net_amount, shipping_tax_rate, shipping_tax_amount, currency,
            grand_total, total_price, tax_rate, paid_at, order_channel, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'vi', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0,
            ?, ?, ?, 0, ?, ?, ?, ?)`)
            .bind(
                localOrderId, orderCode, `pancake-inbound:${getPancakeConfig(env).shopId}:${remoteOrderId}`,
                customer.name || 'Khách lẻ', customer.normalizedPhone || '', customer.email,
                address.street, address.ward, address.district, address.province,
                compactText(order?.note_print ?? order?.note, 2000) || null,
                status, fulfillmentStatus, payment.method, payment.status,
                subtotal, discount, Math.max(0, subtotal - discount), tax,
                shippingFee, shippingFee, compactText(order?.order_currency, 20) || 'VND',
                grandTotal, grandTotal, payment.status === 'paid' ? updatedAt : null,
                channel, createdAt, now,
            ),
        db.prepare(`INSERT INTO order_status_history (
            id, order_id, from_status, to_status, actor_role, note, created_at
        ) VALUES (?, ?, NULL, ?, 'integration', 'Nhập đơn từ Pancake POS', ?)`)
            .bind(randomId(), localOrderId, status, now),
        db.prepare(`INSERT INTO order_payment_logs (
            id, order_id, method, amount, status, transaction_ref, paid_at, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(randomId(), localOrderId, payment.method, grandTotal, payment.status,
                `pancake:${remoteOrderId}`, payment.status === 'paid' ? updatedAt : null,
                JSON.stringify({ source: 'pancake', remoteOrderId }), now),
        db.prepare(`INSERT INTO pancake_entity_links (
            entity_type, local_entity_id, pancake_entity_id, pancake_parent_id,
            sync_status, last_synced_at, created_at, updated_at
        ) VALUES ('order', ?, ?, ?, 'synced', ?, ?, ?)`)
            .bind(localOrderId, remoteOrderId, pancakeCustomerId, now, now, now),
        db.prepare(`INSERT INTO pancake_inbound_orders (
            pancake_order_id, local_order_id, pancake_customer_id, pancake_updated_at,
            payload_checksum, raw_json, inventory_applied_at, import_status,
            first_seen_at, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(remoteOrderId, localOrderId, pancakeCustomerId, updatedAt, checksum, rawJson,
                shouldApplyInventory ? now : null, hasUnmappedItems ? 'partial' : 'imported',
                now, now, now, now),
    ];
    if (spxLabel) {
        statements.push(
            db.prepare(`UPDATE product_orders SET shipping_provider = 'spx', shipping_code = ?, updated_at = ?
                WHERE id = ?`).bind(spxLabel.trackingCode, now, localOrderId),
            createSpxShipmentStatement(db, spxLabel, now),
            createTelegramOutboxStatement(db, {
                eventType: 'pancake.spx.label.ready',
                orderId: localOrderId,
                idempotencyKey: `telegram/pancake.spx.label.ready/${remoteOrderId}/${spxLabel.trackingDigest}`,
                payload: buildSpxTelegramPayload(spxLabel, env),
                now,
            }),
        );
    }

    for (const item of mapped) {
        statements.push(db.prepare(`INSERT INTO product_order_items (
            id, order_id, product_id, product_name, product_sku, product_image_path,
            quantity, price_at_purchase, vat_rate, tax_amount,
            external_product_id, external_variation_id, source_system, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'pancake', ?)`)
            .bind(randomId(), localOrderId, item.localProductId, item.name, item.sku, item.image,
                item.quantity, item.price, item.productId, item.variationId, now));
        if (shouldApplyInventory && item.localProductId != null) {
            statements.push(db.prepare(`UPDATE products SET
                stock_quantity = MAX(0, stock_quantity - ?),
                sold_count = sold_count + ?, updated_at = ? WHERE id = ?`)
                .bind(item.quantity, item.quantity, now, item.localProductId));
        }
    }
    let customerNotification = { emailOutboxCreated: false, zaloJobCreated: false };
    if (channel === 'pos') {
        customerNotification = appendPosCustomerNotificationStatements(statements, db, env, {
            eventType: 'order.created',
            order: {
                id: localOrderId,
                order_code: orderCode,
                customer_name: customer.name || 'Khách lẻ',
                customer_phone: customer.normalizedPhone || '',
                customer_email: customer.email,
                locale: 'vi',
                shipping_street: address.street,
                shipping_ward: address.ward,
                shipping_district: address.district,
                shipping_province: address.province,
                notes: compactText(order?.note_print ?? order?.note, 2000) || null,
                status,
                fulfillment_status: fulfillmentStatus,
                payment_method: payment.method,
                payment_status: payment.status,
                payment_provider: 'pancake',
                payment_reference: `pancake:${remoteOrderId}`,
                paid_at: payment.status === 'paid' ? updatedAt : null,
                ...financials,
                shipping_net_amount: financials.shipping_fee,
                shipping_tax_rate: 0,
                shipping_tax_amount: 0,
                total_price: financials.grand_total,
                currency: compactText(order?.order_currency, 20) || 'VND',
                tax_rate: 0,
                order_channel: channel,
                created_at: createdAt,
            },
            items: mapped,
            now,
        });
    }
    let telegramOutboxCreated = Boolean(spxLabel);
    if (isTelegramOrderAlertsEnabled(env)) {
        const payload = buildPancakeTelegramPayload({
            eventType: 'pancake.order.created',
            remoteOrderId,
            order: {
                id: localOrderId,
                order_code: orderCode,
                customer_name: customer.name || 'Khách lẻ',
                customer_phone: customer.normalizedPhone || '',
                customer_email: customer.email,
                notes: compactText(order?.note_print ?? order?.note, 2000) || null,
                currency: compactText(order?.order_currency, 20) || 'VND',
                created_at: createdAt,
            },
            items: mapped,
            channel,
            status,
            payment,
            financials,
            updatedAt,
        }, env);
        statements.push(createTelegramOutboxStatement(db, {
            eventType: 'pancake.order.created',
            orderId: localOrderId,
            idempotencyKey: `telegram/pancake.order.created/${remoteOrderId}`,
            payload,
            now,
        }));
        telegramOutboxCreated = true;
    }
    await db.batch(statements);
    return {
        imported: true,
        orderId: localOrderId,
        channel,
        partial: hasUnmappedItems,
        telegramOutboxCreated,
        ...customerNotification,
    };
}

async function processInboundEvent(db, client, env, event) {
    const parsed = JSON.parse(event.payload_json || '{}');
    let entity = firstEntity(parsed, event.resource_type);
    if (!entity || (event.resource_type === 'order' && !Array.isArray(entity.items))) {
        const payload = event.resource_type === 'order'
            ? await client.getOrder(event.remote_id)
            : await client.getCustomer(event.remote_id);
        entity = firstEntity(payload, event.resource_type) || payload;
    }
    if (!entity || remoteId(entity, event.resource_type) == null) {
        throw Object.assign(new Error(`Pancake ${event.resource_type} payload is incomplete.`), { retryable: true });
    }
    if (event.resource_type === 'customer') {
        return { customer: await upsertCustomer(db, entity, 'pancake_pos') };
    }
    return upsertOrder(db, env, entity);
}

export async function createPancakeInboundEvent(db, env, {
    resourceType,
    entity,
    source,
    receiptId = null,
    enqueue = true,
}) {
    const idValue = remoteId(entity, resourceType);
    if (idValue == null) return { accepted: false, reason: 'missing_remote_id' };
    const payloadJson = JSON.stringify(entity || {});
    const checksum = await sha256(stableJson(entity || {}));
    const updatedAt = remoteUpdatedAt(entity);
    const eventKey = `${resourceType}:${String(idValue)}:${updatedAt || 'unknown'}:${checksum}`;
    const eventId = randomId();
    const now = new Date().toISOString();
    const inserted = await db.prepare(`INSERT OR IGNORE INTO pancake_inbound_events (
        id, resource_type, remote_id, event_key, source, receipt_id, remote_updated_at,
        payload_json, status, attempts, available_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`)
        .bind(eventId, resourceType, String(idValue), eventKey, source, receiptId, updatedAt,
            payloadJson, now, now, now).run();
    if (!Number(inserted.meta?.changes || 0)) return { accepted: true, duplicate: true };
    if (enqueue && env?.PANCAKE_QUEUE) {
        try {
            await env.PANCAKE_QUEUE.send({ kind: 'pancake', inboundEventId: eventId });
            await db.prepare(`UPDATE pancake_inbound_events SET status = 'queued', queued_at = ?, updated_at = ?
                WHERE id = ? AND status = 'pending'`).bind(now, now, eventId).run();
            return { accepted: true, duplicate: false, eventId, queued: true };
        } catch (error) {
            await db.prepare('UPDATE pancake_inbound_events SET last_error = ?, updated_at = ? WHERE id = ?')
                .bind(compactText(error?.message || error, 1000), now, eventId).run();
        }
    }
    return { accepted: true, duplicate: false, eventId, queued: false };
}

export function detectPancakeWebhookEntity(payload, eventName = '') {
    const normalizedEvent = String(eventName || payload?.event || payload?.type || '').toLowerCase();
    let resourceType = normalizedEvent.includes('customer') ? 'customer'
        : normalizedEvent.includes('order') ? 'order'
        : null;
    if (!resourceType) {
        if (payload?.order || payload?.order_id || payload?.received_at_shop !== undefined || Array.isArray(payload?.items)) resourceType = 'order';
        else if (payload?.customer || payload?.customer_id || payload?.phone_numbers) resourceType = 'customer';
    }
    if (!resourceType) return null;
    const candidates = resourceType === 'order'
        ? [payload?.data, payload?.order, payload?.object, payload]
        : [payload?.data, payload?.customer, payload?.object, payload];
    for (const candidate of candidates) {
        const entity = firstEntity(candidate, resourceType);
        if (entity && remoteId(entity, resourceType) != null) return { resourceType, entity };
    }
    return null;
}

export async function dispatchPendingPancakeInbound(env, limit = 50) {
    if (!env?.APP_DB || !env?.PANCAKE_QUEUE) return { skipped: true, queued: 0 };
    const settings = await getPancakeSyncSettings(env.APP_DB);
    if (!settings.masterEnabled || !settings.inboundEnabled) return { skipped: true, queued: 0, reason: 'inbound_disabled' };
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await env.APP_DB.prepare(`UPDATE pancake_inbound_events SET status = 'retrying',
        available_at = ?, queued_at = NULL, lease_token = NULL,
        last_error = 'Inbound processing lease expired.', updated_at = ?
        WHERE status IN ('queued', 'processing') AND updated_at < ?`).bind(now, now, stale).run();
    const rows = await env.APP_DB.prepare(`SELECT id FROM pancake_inbound_events
        WHERE status IN ('pending', 'retrying') AND available_at <= ?
        ORDER BY created_at LIMIT ?`).bind(now, boundedInteger(limit, 50, 1, 100)).all();
    const ids = (rows.results || []).map((row) => row.id);
    if (!ids.length) return { skipped: false, queued: 0 };
    await env.APP_DB.batch(ids.map((id) => env.APP_DB.prepare(`UPDATE pancake_inbound_events
        SET status = 'queued', queued_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'retrying')`).bind(now, now, id)));
    try {
        await env.PANCAKE_QUEUE.sendBatch(ids.map((id) => ({ body: { kind: 'pancake', inboundEventId: id } })));
        return { skipped: false, queued: ids.length };
    } catch (error) {
        await env.APP_DB.batch(ids.map((id) => env.APP_DB.prepare(`UPDATE pancake_inbound_events
            SET status = 'retrying', queued_at = NULL, last_error = ?, updated_at = ? WHERE id = ?`)
            .bind(compactText(error?.message || error, 1000), now, id)));
        throw error;
    }
}

async function pollResource(env, client, settings, resourceType, force) {
    if (!isPancakeInboundEnabled(settings, resourceType)) return { resourceType, skipped: true, reason: 'resource_disabled' };
    const db = env.APP_DB;
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const intervalSeconds = boundedInteger(env.PANCAKE_INBOUND_POLL_SECONDS, 120, 60, 3600);
    const pageSize = boundedInteger(env.PANCAKE_INBOUND_PAGE_SIZE, 25, 1, 30);
    const overlapSeconds = boundedInteger(env.PANCAKE_INBOUND_OVERLAP_SECONDS, 120, 30, 600);
    const lookbackSeconds = boundedInteger(env.PANCAKE_INBOUND_INITIAL_LOOKBACK_SECONDS, 900, 60, 86400);
    const lagSeconds = boundedInteger(env.PANCAKE_INBOUND_LAG_SECONDS, 10, 0, 120);
    const cursor = await db.prepare('SELECT * FROM pancake_inbound_cursors WHERE resource_type = ? LIMIT 1')
        .bind(resourceType).first();
    if (!cursor) return { resourceType, skipped: true, reason: 'cursor_missing' };
    if (!force && cursor.last_polled_at && Date.parse(cursor.last_polled_at) > nowMs - intervalSeconds * 1000) {
        return { resourceType, skipped: true, reason: 'interval' };
    }
    const leaseUntil = new Date(nowMs + 55_000).toISOString();
    const claimed = await db.prepare(`UPDATE pancake_inbound_cursors SET lease_until = ?, updated_at = ?
        WHERE resource_type = ? AND (lease_until IS NULL OR lease_until <= ?)`)
        .bind(leaseUntil, now, resourceType, now).run();
    if (!Number(claimed.meta?.changes || 0)) return { resourceType, skipped: true, reason: 'leased' };

    const windowStart = cursor.cursor_timestamp || new Date(nowMs - lookbackSeconds * 1000).toISOString();
    const windowEnd = cursor.window_end_at || new Date(nowMs - lagSeconds * 1000).toISOString();
    const page = Math.max(1, integer(cursor.next_page, 1));
    try {
        const startSeconds = Math.max(0, Math.floor(Date.parse(windowStart) / 1000));
        const endSeconds = Math.max(startSeconds, Math.floor(Date.parse(windowEnd) / 1000));
        const payload = resourceType === 'order'
            ? await client.listOrdersUpdated(startSeconds, endSeconds, page, pageSize)
            : await client.listCustomersUpdated(startSeconds, endSeconds, page, pageSize);
        const rows = rowsFromPayload(payload, resourceType);
        let accepted = 0;
        let duplicates = 0;
        for (const entity of rows) {
            const result = await createPancakeInboundEvent(db, env, {
                resourceType, entity, source: force ? 'manual' : 'poll', enqueue: false,
            });
            if (result.accepted && result.duplicate) duplicates += 1;
            else if (result.accepted) accepted += 1;
        }
        const totalPages = responsePageCount(payload);
        const hasNextPage = page < totalPages;
        const nextCursor = hasNextPage
            ? windowStart
            : new Date(Math.max(0, Date.parse(windowEnd) - overlapSeconds * 1000)).toISOString();
        await db.prepare(`UPDATE pancake_inbound_cursors SET
            cursor_timestamp = ?, window_end_at = ?, next_page = ?, last_polled_at = ?,
            lease_until = NULL, consecutive_failures = 0, last_error = NULL, updated_at = ?
            WHERE resource_type = ?`).bind(
                nextCursor, hasNextPage ? windowEnd : null, hasNextPage ? page + 1 : 1,
                now, now, resourceType,
            ).run();
        return { resourceType, skipped: false, page, totalPages, received: rows.length, accepted, duplicates };
    } catch (error) {
        await db.prepare(`UPDATE pancake_inbound_cursors SET lease_until = NULL,
            consecutive_failures = consecutive_failures + 1, last_error = ?, last_polled_at = ?, updated_at = ?
            WHERE resource_type = ?`).bind(compactText(error?.message || error, 1000), now, now, resourceType).run();
        return { resourceType, skipped: false, failed: true, error: compactText(error?.message || error, 1000) };
    }
}

export async function pollPancakeInbound(env, { force = false } = {}) {
    if (!env?.APP_DB || !env?.PANCAKE_QUEUE) return { skipped: true, resources: [], dispatch: { queued: 0 } };
    if (!getPancakeConfig(env).enabled) return { skipped: true, reason: 'not_configured', resources: [] };
    const settings = await getPancakeSyncSettings(env.APP_DB);
    if (!settings.masterEnabled || !settings.inboundEnabled || (!force && !settings.inboundPollEnabled)) {
        return { skipped: true, reason: 'inbound_disabled', resources: [] };
    }
    await dispatchPendingPancakeInbound(env, 50);
    const client = new PancakeClient(env);
    const resources = [];
    for (const resourceType of ['order', 'customer']) {
        resources.push(await pollResource(env, client, settings, resourceType, force));
    }
    const dispatch = await dispatchPendingPancakeInbound(env, 50);
    return { skipped: false, resources, dispatch };
}

export async function consumePancakeInboundMessage(message, env, settings, client) {
    const eventId = message.body?.inboundEventId;
    if (!eventId) return false;
    const db = env.APP_DB;
    const event = await db.prepare('SELECT * FROM pancake_inbound_events WHERE id = ? LIMIT 1').bind(eventId).first();
    if (!event || INBOUND_TERMINAL.has(event.status)) {
        message.ack();
        return true;
    }
    if (!isPancakeInboundEnabled(settings, event.resource_type)) {
        await db.prepare(`UPDATE pancake_inbound_events SET status = 'pending', queued_at = NULL,
            lease_token = NULL, available_at = ?, updated_at = ? WHERE id = ?`)
            .bind(new Date(Date.now() + 300_000).toISOString(), new Date().toISOString(), eventId).run();
        message.ack();
        return true;
    }
    const attempt = Number(event.attempts || 0) + 1;
    const now = new Date().toISOString();
    const leaseToken = randomId();
    const claimed = await db.prepare(`UPDATE pancake_inbound_events SET
        status = 'processing', attempts = ?, lease_token = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'queued', 'retrying')`)
        .bind(attempt, leaseToken, now, eventId).run();
    if (!Number(claimed.meta?.changes || 0)) {
        message.ack();
        return true;
    }
    try {
        const result = await processInboundEvent(db, client, env, event);
        await db.prepare(`UPDATE pancake_inbound_events SET status = 'completed',
            processed_at = ?, lease_token = NULL, last_error = NULL, updated_at = ?
            WHERE id = ? AND lease_token = ?`).bind(now, now, eventId, leaseToken).run();
        if (event.receipt_id) {
            await db.prepare(`UPDATE webhook_receipts SET status = 'processed', processed_at = ?, last_error = NULL
                WHERE id = ?`).bind(now, event.receipt_id).run();
        }
        if (result?.telegramOutboxCreated) {
            try {
                await dispatchPendingTelegram(env);
            } catch (error) {
                console.error('[pancake-telegram-outbox] Immediate dispatch failed:', {
                    message: compactText(error?.message || error, 500),
                });
            }
        }
        if (result?.emailOutboxCreated) {
            try {
                await dispatchPendingNotifications(env, 20);
            } catch (error) {
                console.error('[pancake-customer-email-outbox] Immediate dispatch failed:', {
                    message: compactText(error?.message || error, 500),
                });
            }
        }
        message.ack();
        return { ...result, handled: true };
    } catch (error) {
        const maxAttempts = client.config.maxAttempts;
        const retryable = error?.retryable !== false;
        const terminal = !retryable || attempt >= maxAttempts;
        const delaySeconds = retryDelay(attempt);
        const messageText = compactText(error?.message || error, 1000);
        await db.prepare(`UPDATE pancake_inbound_events SET status = ?, available_at = ?,
            lease_token = NULL, last_error = ?, updated_at = ? WHERE id = ? AND lease_token = ?`)
            .bind(terminal ? 'failed' : 'retrying', new Date(Date.now() + delaySeconds * 1000).toISOString(),
                messageText, now, eventId, leaseToken).run();
        if (event.receipt_id) {
            await db.prepare(`UPDATE webhook_receipts SET status = ?, processed_at = ?, last_error = ? WHERE id = ?`)
                .bind(terminal ? 'failed' : 'received', terminal ? now : null, messageText, event.receipt_id).run();
        }
        if (terminal) message.ack();
        else message.retry({ delaySeconds });
        return true;
    }
}
