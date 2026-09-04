import { resolvePublicProductImageUrl } from '../products/orderImage.js';

export const ORDER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOrderEmail(value) {
    return ORDER_EMAIL_PATTERN.test(String(value || '').trim().toLowerCase());
}

function publicEmailImageUrl(value, env) {
    const resolved = resolvePublicProductImageUrl(value);
    if (!resolved) return '';
    if (/^https?:\/\//i.test(resolved)) return resolved;
    const origin = String(env?.PUBLIC_SITE_URL || env?.OAUTH_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
    if (resolved.startsWith('/r2/')) return `${origin}${resolved}`;
    const r2Base = String(env?.R2_PUBLIC_BASE_URL || `${origin}/r2`).replace(/\/+$/, '');
    return `${r2Base}/product-images/${resolved.replace(/^\/+/, '')}`;
}

export function buildOrderEmailPayload(order, items, extra = {}, env = {}) {
    return {
        order_id: order.id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        currency: order.currency || 'VND',
        subtotal_price: order.subtotal_price ?? order.total_price ?? 0,
        discount_amount: order.discount_amount || 0,
        taxable_amount: order.taxable_amount || 0,
        tax_amount: order.tax_amount || 0,
        shipping_fee: order.shipping_fee || 0,
        shipping_net_amount: order.shipping_net_amount ?? order.shipping_fee ?? 0,
        shipping_tax_rate: order.shipping_tax_rate || 0,
        shipping_tax_amount: order.shipping_tax_amount || 0,
        tax_rate: order.tax_rate || 0,
        grand_total: order.grand_total,
        total_price: order.total_price,
        shipping_provider: order.shipping_provider,
        shipping_address: order.shipping_address || [
            order.shipping_street,
            order.shipping_ward,
            order.shipping_district,
            order.shipping_province,
        ].filter(Boolean).join(', '),
        payment_method: order.payment_method,
        payment_status: order.payment_status || 'unpaid',
        payment_provider: order.payment_provider || null,
        payment_reference: order.payment_reference || null,
        paid_at: order.paid_at || null,
        items: (Array.isArray(items) ? items : []).map((item) => ({
            product_id: item.product_id ?? item.localProductId ?? null,
            name: item.product_name || item.name || item.product?.name || `Sản phẩm #${item.product_id ?? item.localProductId ?? ''}`,
            sku: item.product_sku || item.sku || item.product?.sku || '',
            image_url: publicEmailImageUrl(
                item.product_image_path
                || item.resolved_product_image_path
                || item.image
                || item.product?.main_image_url
                || item.product?.main_image_path,
                env,
            ),
            quantity: Number(item.quantity || 0),
            price_at_purchase: Number(item.price_at_purchase ?? item.price ?? item.unit_price ?? 0),
            line_total: Number(item.line_total ?? item.lineTotal
                ?? (Number(item.price_at_purchase ?? item.price ?? item.unit_price ?? 0) * Number(item.quantity || 0))),
            vat_rate: Number(item.vat_rate ?? item.vatRate ?? 0),
            tax_amount: Number(item.tax_amount ?? item.lineTax ?? 0),
        })),
        ...extra,
    };
}
