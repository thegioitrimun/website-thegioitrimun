import { PDFDocument } from 'pdf-lib';
import { sha256, sha256Hex } from '../platform/crypto.js';
import { PancakeClient } from '../integrations/pancake/client.js';

const A5_WIDTH_PT = 148 * 72 / 25.4;
const A5_HEIGHT_PT = 210 * 72 / 25.4;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_SOURCE_PAGES = 10;
const ALLOWED_LABEL_HOST_SUFFIXES = ['.pancake.vn', '.pages.fm'];

function compactText(value, max = 1000) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeFilePart(value, fallback = 'label') {
    const normalized = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return normalized || fallback;
}

function bytesStartWith(bytes, signature) {
    if (bytes.length < signature.length) return false;
    return signature.every((value, index) => bytes[index] === value);
}

function sourceKind(bytes, contentType = '') {
    const mime = String(contentType || '').toLowerCase();
    if (bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
    if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
    if (mime.includes('application/pdf')) return 'pdf';
    if (mime.includes('image/png')) return 'png';
    if (mime.includes('image/jpeg') || mime.includes('image/jpg')) return 'jpeg';
    return null;
}

function assertAllowedLabelUrl(value) {
    let url;
    try {
        url = new URL(String(value || ''));
    } catch {
        throw Object.assign(new Error('Pancake returned an invalid SPX label URL.'), { retryable: true });
    }
    const host = url.hostname.toLowerCase();
    const allowed = url.protocol === 'https:'
        && ALLOWED_LABEL_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
    if (!allowed) {
        throw Object.assign(new Error('Pancake returned an untrusted SPX label host.'), { retryable: false });
    }
    return url;
}

function fitIntoPage(sourceWidth, sourceHeight) {
    const scale = Math.min(A5_WIDTH_PT / sourceWidth, A5_HEIGHT_PT / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return {
        width,
        height,
        x: (A5_WIDTH_PT - width) / 2,
        y: (A5_HEIGHT_PT - height) / 2,
    };
}

function isA5Page(page) {
    const { width, height } = page.getSize();
    const portrait = Math.abs(width - A5_WIDTH_PT) <= 1 && Math.abs(height - A5_HEIGHT_PT) <= 1;
    const landscape = Math.abs(width - A5_HEIGHT_PT) <= 1 && Math.abs(height - A5_WIDTH_PT) <= 1;
    return portrait || landscape;
}

export function isSpxLabelTelegramEnabled(env) {
    return String(env?.SPX_LABEL_TELEGRAM_ENABLED || '').toLowerCase() === 'true'
        && String(env?.TELEGRAM_ORDER_ALERTS_ENABLED || '').toLowerCase() === 'true';
}

export function spxShipmentFromOrder(order) {
    if (!order || typeof order !== 'object' || order.received_at_shop === true) return null;
    const partner = order.partner && typeof order.partner === 'object' ? order.partner : null;
    if (!partner) return null;
    const partnerName = compactText(partner.partner_name ?? partner.name, 120);
    if (!/(?:^|\b)(?:spx|shopee\s*xpress)(?:\b|$)/i.test(partnerName)) return null;
    const trackingCode = compactText(
        partner.extend_code ?? partner.tracking_code ?? partner.tracking_id ?? order.shipping_code,
        160,
    );
    if (!trackingCode) return null;
    return {
        provider: 'spx',
        partnerName: partnerName || 'SPX Express',
        trackingCode,
        partnerStatus: compactText(partner.partner_status ?? partner.status, 120) || 'ready',
        providerOrderId: compactText(partner.order_id ?? partner.id ?? order.id, 160) || null,
    };
}

export async function buildSpxLabelDescriptor({ env, order, previousOrder, localOrderId, orderCode, pancakeOrderId }) {
    if (!isSpxLabelTelegramEnabled(env)) return null;
    const shipment = spxShipmentFromOrder(order);
    if (!shipment) return null;
    const previousShipment = spxShipmentFromOrder(previousOrder);
    if (previousShipment?.trackingCode === shipment.trackingCode) return null;
    const trackingDigest = await sha256(`${String(pancakeOrderId)}:${shipment.trackingCode}`);
    const objectKey = `shipping-labels/spx/${safeFilePart(localOrderId, 'order')}/${trackingDigest}.pdf`;
    const filename = `SPX-${safeFilePart(orderCode, 'don-hang')}-${safeFilePart(shipment.trackingCode, 'van-don')}-A5.pdf`;
    return {
        ...shipment,
        pancakeOrderId: String(pancakeOrderId),
        localOrderId: String(localOrderId),
        orderCode: String(orderCode),
        objectKey,
        filename,
        trackingDigest,
    };
}

export function createSpxShipmentStatement(db, descriptor, now = new Date().toISOString()) {
    return db.prepare(`INSERT INTO shipping_shipments (
        id, order_id, provider, provider_order_id, tracking_code, status, status_text,
        response_json, label_object_key, created_at, updated_at
    ) VALUES (?, ?, 'spx', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
        provider = 'spx', provider_order_id = excluded.provider_order_id,
        tracking_code = excluded.tracking_code, status = excluded.status,
        status_text = excluded.status_text, response_json = excluded.response_json,
        label_object_key = COALESCE(shipping_shipments.label_object_key, excluded.label_object_key),
        updated_at = excluded.updated_at`)
        .bind(
            `spx:${descriptor.localOrderId}`,
            descriptor.localOrderId,
            descriptor.providerOrderId,
            descriptor.trackingCode,
            descriptor.partnerStatus,
            descriptor.partnerStatus,
            JSON.stringify({ source: 'pancake', partner: descriptor.partnerName }),
            descriptor.objectKey,
            now,
            now,
        );
}

export function buildSpxTelegramPayload(descriptor, env = {}) {
    const siteUrl = String(env.PUBLIC_SITE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
    return {
        document_kind: 'shipping_label',
        provider: 'spx',
        provider_label: descriptor.partnerName || 'SPX Express',
        pancake_order_id: descriptor.pancakeOrderId,
        order_id: descriptor.localOrderId,
        order_code: descriptor.orderCode,
        tracking_code: descriptor.trackingCode,
        partner_status: descriptor.partnerStatus,
        label_object_key: descriptor.objectKey,
        filename: descriptor.filename,
        paper_size: 'A5',
        admin_url: `${siteUrl}/admin/pancake-pos`,
    };
}

export async function normalizeCarrierLabelToA5(sourceBytes, contentType = '') {
    const bytes = sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes);
    if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) {
        throw Object.assign(new Error('SPX label is empty or exceeds the 20 MB limit.'), { retryable: false });
    }
    const kind = sourceKind(bytes, contentType);
    if (!kind) {
        throw Object.assign(new Error('Pancake did not return a supported PDF or image label.'), { retryable: true });
    }

    if (kind === 'pdf') {
        let source;
        try {
            source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
        } catch {
            throw Object.assign(new Error('The SPX label PDF is invalid or encrypted.'), { retryable: true });
        }
        const pages = source.getPages();
        if (!pages.length || pages.length > MAX_SOURCE_PAGES) {
            throw Object.assign(new Error('The SPX label PDF has an invalid page count.'), { retryable: false });
        }
        if (pages.every(isA5Page)) {
            return { bytes, pageCount: pages.length, sourceKind: kind, normalized: false };
        }
        const output = await PDFDocument.create();
        output.setTitle('SPX shipping label - A5');
        output.setProducer('thegioitrimun.vn');
        for (const page of pages) {
            const embedded = await output.embedPage(page);
            const fitted = fitIntoPage(embedded.width, embedded.height);
            output.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]).drawPage(embedded, fitted);
        }
        return {
            bytes: await output.save(),
            pageCount: pages.length,
            sourceKind: kind,
            normalized: true,
        };
    }

    const output = await PDFDocument.create();
    output.setTitle('SPX shipping label - A5');
    output.setProducer('thegioitrimun.vn');
    let image;
    try {
        image = kind === 'png' ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    } catch {
        throw Object.assign(new Error('The SPX label image is invalid.'), { retryable: true });
    }
    const fitted = fitIntoPage(image.width, image.height);
    output.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]).drawImage(image, fitted);
    return { bytes: await output.save(), pageCount: 1, sourceKind: kind, normalized: true };
}

async function fetchOfficialLabel(env, payload) {
    const client = new PancakeClient(env);
    const result = await client.getShippingDocumentUrls(payload.pancake_order_id, 'SHIPPING_LABEL');
    const labelUrl = Array.isArray(result?.data) ? result.data.find(Boolean) : null;
    if (!labelUrl) {
        throw Object.assign(new Error('Pancake has not produced the SPX shipping label yet.'), { retryable: true });
    }
    let url = assertAllowedLabelUrl(labelUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('SPX label download timed out.'), client.config.timeoutMs);
    try {
        let response = null;
        for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
            response = await fetch(url, {
                signal: controller.signal,
                redirect: 'manual',
                headers: { Accept: 'application/pdf,image/png,image/jpeg' },
            });
            if (![301, 302, 303, 307, 308].includes(response.status)) break;
            const location = response.headers.get('location');
            if (!location || redirectCount === 4) {
                throw Object.assign(new Error('Pancake label download exceeded the redirect limit.'), { retryable: true });
            }
            url = assertAllowedLabelUrl(new URL(location, url).toString());
        }
        if (!response.ok) {
            throw Object.assign(new Error(`Pancake label download returned HTTP ${response.status}.`), {
                retryable: response.status === 408 || response.status === 429 || response.status >= 500,
            });
        }
        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > MAX_SOURCE_BYTES) {
            throw Object.assign(new Error('SPX label exceeds the 20 MB limit.'), { retryable: false });
        }
        const source = new Uint8Array(await response.arrayBuffer());
        return normalizeCarrierLabelToA5(source, response.headers.get('content-type') || '');
    } catch (error) {
        if (error?.retryable !== undefined) throw error;
        throw Object.assign(new Error(controller.signal.aborted
            ? 'SPX label download timed out.'
            : 'Could not download the SPX label from Pancake.'), { retryable: true });
    } finally {
        clearTimeout(timeout);
    }
}

export async function getSpxA5Label(env, payload) {
    if (!env.PRIVATE_RECORDS) {
        throw Object.assign(new Error('Private R2 is not configured for SPX labels.'), { retryable: true });
    }
    const objectKey = compactText(payload?.label_object_key, 500);
    if (!objectKey || !objectKey.startsWith('shipping-labels/spx/')) {
        throw Object.assign(new Error('SPX label storage key is invalid.'), { retryable: false });
    }
    const cached = await env.PRIVATE_RECORDS.get(objectKey);
    if (cached) {
        const bytes = new Uint8Array(await cached.arrayBuffer());
        if (!bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
            throw Object.assign(new Error('Cached SPX label is not a valid PDF.'), { retryable: false });
        }
        return { bytes, objectKey, cached: true };
    }

    const normalized = await fetchOfficialLabel(env, payload);
    const digest = await sha256Hex(normalized.bytes);
    await env.PRIVATE_RECORDS.put(objectKey, normalized.bytes, {
        httpMetadata: { contentType: 'application/pdf', contentDisposition: `attachment; filename="${safeFilePart(payload.filename, 'SPX-A5')}.pdf"` },
        customMetadata: {
            sha256: digest,
            provider: 'spx',
            paperSize: 'A5',
            pageCount: String(normalized.pageCount),
            normalized: String(normalized.normalized),
        },
    });
    if (env.APP_DB && payload.order_id) {
        await env.APP_DB.prepare(`UPDATE shipping_shipments SET label_object_key = ?, updated_at = ?
            WHERE order_id = ? AND provider = 'spx'`)
            .bind(objectKey, new Date().toISOString(), payload.order_id).run();
    }
    return { ...normalized, objectKey, cached: false };
}

export const SPX_A5_SIZE_POINTS = Object.freeze({ width: A5_WIDTH_PT, height: A5_HEIGHT_PT });
