import { fetchProductImagesForProducts } from './productImages.js';

const PRODUCT_FEED_SELECT = [
    'id',
    'slug',
    'name',
    'description',
    'price',
    'stock_quantity',
    'category_id',
    'brand',
    'sku',
    'updated_at',
].join(',');

const PRODUCT_IMAGE_SELECT = 'id,product_id,image_path,is_primary,display_order';

function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function truncatePlainText(value, maxLength = 5000) {
    const normalized = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pickRepresentativeImages(images = []) {
    return [...(images || [])]
        .filter((image) => image?.image_path)
        .sort((a, b) => {
            if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
            const aOrder = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
            const bOrder = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return Number(a.id || 0) - Number(b.id || 0);
        });
}

function buildProductPath(product, categorySlug) {
    return `/san-pham/${categorySlug || 'khac'}/${product.slug || product.id}`;
}

function groupImagesByProductId(productImages = []) {
    const map = new Map();
    for (const image of productImages || []) {
        if (!image?.product_id) continue;
        const images = map.get(image.product_id) || [];
        images.push(image);
        map.set(image.product_id, images);
    }
    return map;
}

export async function maybeHandleMerchantFeedRoute(route, deps) {
    const { path } = route;
    if (path !== '/feeds/google-products.xml') return null;

    const {
        BASE_URL,
        SITE_NAME,
        supabaseFetch,
        getStorageUrl,
        escapeXml,
    } = deps;

    const [products, categories] = await Promise.all([
        supabaseFetch(`products?is_published=eq.true&archived_at=is.null&select=${PRODUCT_FEED_SELECT}&order=id.asc`),
        supabaseFetch('product_categories?select=id,slug,name&order=name.asc'),
    ]);
    const productImages = await fetchProductImagesForProducts((products || []).map((product) => product.id), supabaseFetch, PRODUCT_IMAGE_SELECT);

    const categoryById = new Map((categories || []).map((category) => [category.id, category]));
    const imagesByProductId = groupImagesByProductId(productImages || []);

    const items = (products || [])
        .map((product) => {
            const price = normalizeNumber(product.price);
            const images = pickRepresentativeImages(imagesByProductId.get(product.id) || []);
            const primaryImage = images[0];
            if (!price || !primaryImage?.image_path) return '';

            const category = categoryById.get(product.category_id);
            const productPath = buildProductPath(product, category?.slug);
            const productUrl = `${BASE_URL}${productPath}`;
            const title = truncatePlainText(product.name || product.slug || `Sản phẩm ${product.id}`, 150);
            const description = truncatePlainText(product.description || title, 5000);
            const brand = truncatePlainText(product.brand || SITE_NAME, 70);
            const availability = normalizeNumber(product.stock_quantity) > 0 ? 'in_stock' : 'out_of_stock';
            const imageLink = getStorageUrl(primaryImage.image_path, 'product-images');
            const additionalImages = images.slice(1, 11)
                .map((image) => getStorageUrl(image.image_path, 'product-images'))
                .filter(Boolean)
                .map((url) => `    <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`)
                .join('\n');

            return `  <item>
    <g:id>${escapeXml(String(product.sku || product.id))}</g:id>
    <g:title>${escapeXml(title)}</g:title>
    <g:description>${escapeXml(description)}</g:description>
    <g:link>${escapeXml(productUrl)}</g:link>
    <g:image_link>${escapeXml(imageLink)}</g:image_link>
${additionalImages ? `${additionalImages}\n` : ''}    <g:availability>${availability}</g:availability>
    <g:price>${Math.round(price)} VND</g:price>
    <g:brand>${escapeXml(brand)}</g:brand>
    <g:condition>new</g:condition>
    <g:product_type>${escapeXml(category?.name || 'Sản phẩm chăm sóc da')}</g:product_type>
  </item>`;
        })
        .filter(Boolean)
        .join('\n');

    const updatedAt = new Date().toUTCString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${escapeXml(`${SITE_NAME} - Google product feed`)}</title>
  <link>${escapeXml(`${BASE_URL}/san-pham`)}</link>
  <description>${escapeXml(`Danh mục sản phẩm công khai của ${SITE_NAME}`)}</description>
  <lastBuildDate>${escapeXml(updatedAt)}</lastBuildDate>
${items}
</channel>
</rss>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml;charset=UTF-8',
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
            'X-Robots-Tag': 'noindex, follow',
            'X-Product-Feed-Items': String((items.match(/<item>/g) || []).length),
        },
    });
}
