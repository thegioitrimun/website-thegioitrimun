function normalizeImagePath(value) {
    return String(value || '').trim();
}

export function resolvePublicProductImageUrl(value) {
    const normalized = normalizeImagePath(value);
    if (!normalized) return '';
    if (/^(?:https?:)?\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('/r2/')) return normalized;

    const objectPath = normalized
        .replace(/^\/+/, '')
        .replace(/^product-images\//i, '');
    if (!objectPath) return '';

    return `/r2/product-images/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

export async function primaryProductImageMap(db, items) {
    const productIds = [...new Set((items || [])
        .map((item) => Number(item?.product_id))
        .filter((id) => Number.isInteger(id) && id > 0))];
    const imageMap = new Map();

    for (let offset = 0; offset < productIds.length; offset += 80) {
        const batch = productIds.slice(offset, offset + 80);
        const placeholders = batch.map(() => '?').join(',');
        const result = await db.prepare(`
            SELECT product_id, image_path
            FROM product_images
            WHERE product_id IN (${placeholders})
            ORDER BY product_id, is_primary DESC, display_order, id
        `).bind(...batch).all();

        for (const row of result.results || []) {
            const key = String(row.product_id);
            if (!imageMap.has(key) && normalizeImagePath(row.image_path)) {
                imageMap.set(key, normalizeImagePath(row.image_path));
            }
        }
    }

    return imageMap;
}

export async function productSnapshotMap(db, items) {
    const productIds = [...new Set((items || [])
        .map((item) => Number(item?.product_id))
        .filter((id) => Number.isInteger(id) && id > 0))];
    const productMap = new Map();

    for (let offset = 0; offset < productIds.length; offset += 80) {
        const batch = productIds.slice(offset, offset + 80);
        const result = await db.prepare(`
            SELECT id, name, sku, stock_quantity
            FROM products
            WHERE id IN (${batch.map(() => '?').join(',')})
        `).bind(...batch).all();

        for (const row of result.results || []) {
            productMap.set(String(row.id), row);
        }
    }

    return productMap;
}

function isPlaceholderProductName(value) {
    return /^(?:sản phẩm|sp|product)\s*#\s*\d+$/i.test(String(value || '').trim());
}

export async function hydrateOrderItemsWithProductImages(db, items) {
    const [imageMap, productMap] = await Promise.all([
        primaryProductImageMap(db, items),
        productSnapshotMap(db, items),
    ]);

    return (items || []).map((item) => {
        const snapshotPath = normalizeImagePath(item.product_image_path);
        const imagePath = imageMap.get(String(item.product_id)) || snapshotPath || '';
        const existingProduct = item.product || {};
        const currentProduct = productMap.get(String(item.product_id)) || {};
        const snapshotName = String(item.product_name || '').trim();
        const displayName = snapshotName && !isPlaceholderProductName(snapshotName)
            ? snapshotName
            : normalizeImagePath(currentProduct.name) || snapshotName || `Sản phẩm #${item.product_id}`;
        const displaySku = normalizeImagePath(item.product_sku)
            || normalizeImagePath(currentProduct.sku)
            || normalizeImagePath(existingProduct.sku);
        const stockQuantity = currentProduct.id != null
            ? currentProduct.stock_quantity == null ? null : Number(currentProduct.stock_quantity)
            : existingProduct.stock_quantity == null ? null : Number(existingProduct.stock_quantity);

        return {
            ...item,
            product_name: displayName,
            product_sku: displaySku || null,
            resolved_product_image_path: imagePath || null,
            product: {
                ...existingProduct,
                id: item.product_id,
                name: displayName,
                sku: displaySku,
                stock_quantity: Number.isFinite(stockQuantity) ? stockQuantity : null,
                main_image_path: imagePath,
                main_image_url: resolvePublicProductImageUrl(imagePath),
            },
        };
    });
}
