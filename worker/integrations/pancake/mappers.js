function integer(value, fallback = 0) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(value, max = 1000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function pancakeProductSku(product) {
    return compactText(product?.sku, 120) || `WEB-${product?.id}`;
}

export function normalizePancakePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
    return digits.slice(0, 20);
}

export function pancakeCustomerEntityId(phone) {
    return `phone:${normalizePancakePhone(phone)}`;
}

function absoluteImageUrl(path, env) {
    const value = String(path || '').trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const origin = String(env?.PUBLIC_SITE_URL || env?.OAUTH_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
    const r2Base = String(env?.R2_PUBLIC_BASE_URL || `${origin}/r2`).replace(/\/+$/, '');
    if (value.startsWith('/r2/')) return `${origin}${value}`;
    if (value.startsWith('/')) return `${origin}${value}`;
    // Database image paths are stored relative to the product-images R2 bucket.
    // Keep the bucket in the public URL so Pancake can fetch the actual object.
    return `${r2Base}/product-images/${value.replace(/^\/+/, '')}`;
}

function productWeight(product, env) {
    const explicit = integer(product?.weight_grams ?? product?.weight, 0);
    if (explicit > 0) return explicit;
    const volumeMatch = String(product?.volume || '').match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|ml)/i);
    if (volumeMatch) return Math.max(1, Math.round(Number(volumeMatch[1].replace(',', '.'))));
    return Math.max(1, integer(env?.PANCAKE_DEFAULT_WEIGHT_GRAMS, 100));
}

export function mapProductToPancake(product, env, existingLink = null) {
    const sku = pancakeProductSku(product);
    const images = (Array.isArray(product?.images) ? product.images : [])
        .sort((left, right) => Number(right.is_primary || 0) - Number(left.is_primary || 0) || Number(left.display_order || 0) - Number(right.display_order || 0))
        .map((image) => absoluteImageUrl(image.image_path, env))
        .filter(Boolean)
        .slice(0, 20);
    const weight = productWeight(product, env);
    const variation = {
        ...(existingLink?.pancake_variation_id ? { id: existingLink.pancake_variation_id } : {}),
        fields: [],
        images,
        retail_price: Math.max(0, integer(product?.price)),
        price_at_counter: Math.max(0, integer(product?.price)),
        weight,
        barcode: compactText(product?.barcode || product?.sku, 120) || sku,
        custom_id: sku,
        is_hidden: !Boolean(product?.is_published) || Boolean(product?.archived_at),
    };
    return {
        name: compactText(product?.name, 500),
        note: compactText(product?.description, 2000),
        note_product: compactText(product?.description, 2000),
        weight,
        custom_id: sku,
        is_published: Boolean(product?.is_published) && !product?.archived_at,
        keyword: [product?.brand, product?.name, sku].map((item) => compactText(item, 500)).filter(Boolean).join('|'),
        variations: [variation],
    };
}

export function mapCustomerToPancake(order, { forUpdate = false } = {}) {
    const phone = normalizePancakePhone(order?.customer_phone);
    const fullAddress = [
        order?.shipping_street,
        order?.shipping_ward,
        order?.shipping_district,
        order?.shipping_province,
    ].map((item) => compactText(item, 255)).filter(Boolean).join(', ');
    const address = {
        full_address: fullAddress,
        full_name: compactText(order?.customer_name, 255),
        phone_number: phone,
    };
    if (forUpdate) {
        return {
            name: compactText(order?.customer_name, 255),
            phone_numbers: [phone],
            emails: order?.customer_email ? [compactText(order.customer_email, 320)] : [],
            shop_customer_address: [address],
        };
    }
    return {
        name: compactText(order?.customer_name, 255),
        phoneNumber: phone,
        createType: 'force',
        last_order_at: Math.floor(Date.parse(order?.created_at || new Date().toISOString()) / 1000),
        shop_customer_address: [address],
    };
}

const PANCAKE_ORDER_STATUS = Object.freeze({
    pending: 17,
    processing: 1,
    shipped: 2,
    completed: 3,
    cancelled: 6,
    refunded: 5,
});

export function mapOrderToPancake(order, productLinks, customerId, env) {
    const fullAddress = [
        order.shipping_street,
        order.shipping_ward,
        order.shipping_district,
        order.shipping_province,
    ].map((item) => compactText(item, 255)).filter(Boolean).join(', ');
    const items = (order.order_items || []).map((item) => {
        const link = productLinks.get(String(item.product_id));
        if (!link?.pancake_variation_id) throw new Error(`Pancake variation is missing for product ${item.product_id}.`);
        return {
            product_id: String(link.pancake_entity_id),
            variation_id: String(link.pancake_variation_id),
            quantity: Math.max(1, integer(item.quantity, 1)),
            variation_info: {
                id: String(link.pancake_variation_id),
                product_id: String(link.pancake_entity_id),
                name: compactText(item.product_name, 500),
                retail_price: Math.max(0, integer(item.price_at_purchase)),
                images: item.product_image_path ? [absoluteImageUrl(item.product_image_path, env)].filter(Boolean) : [],
            },
        };
    });
    const grandTotal = Math.max(0, integer(order.grand_total ?? order.total_price));
    const payload = {
        shop_id: Number.isFinite(Number(env.PANCAKE_SHOP_ID)) ? Number(env.PANCAKE_SHOP_ID) : env.PANCAKE_SHOP_ID,
        custom_id: compactText(order.order_code || order.id, 120),
        bill_full_name: compactText(order.customer_name, 255),
        bill_phone_number: normalizePancakePhone(order.customer_phone),
        bill_email: compactText(order.customer_email, 320),
        status: PANCAKE_ORDER_STATUS[order.status] ?? 17,
        items,
        shipping_address: {
            address: compactText(order.shipping_street, 500),
            full_address: fullAddress,
            new_full_address: fullAddress,
            full_name: compactText(order.customer_name, 255),
            phone_number: normalizePancakePhone(order.customer_phone),
            district_name: compactText(order.shipping_district, 255),
            province_name: compactText(order.shipping_province, 255),
            country_code: '84',
        },
        shipping_fee: Math.max(0, integer(order.shipping_fee)),
        customer_pay_fee: integer(order.shipping_fee) > 0,
        is_free_shipping: integer(order.shipping_fee) <= 0,
        total_discount: Math.max(0, integer(order.discount_amount)),
        tax: Math.max(0, integer(order.tax_amount) + integer(order.shipping_tax_amount)),
        total_price: Math.max(0, integer(order.subtotal_price)),
        total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        note: compactText(order.notes, 2000),
        note_print: compactText(order.notes, 2000),
        received_at_shop: false,
        is_from_ecommerce: true,
        order_currency: String(order.currency || 'VND'),
        customer: customerId ? { id: String(customerId), name: compactText(order.customer_name, 255) } : undefined,
    };
    if (env.PANCAKE_WAREHOUSE_ID) payload.warehouse_id = String(env.PANCAKE_WAREHOUSE_ID);
    if (order.payment_method === 'cod') payload.cod = grandTotal;
    else if (order.payment_status === 'paid') payload.transfer_money = grandTotal;
    return payload;
}

export function pancakeStatusName(status) {
    return Object.entries(PANCAKE_ORDER_STATUS).find(([, value]) => value === status)?.[0] || 'pending';
}
