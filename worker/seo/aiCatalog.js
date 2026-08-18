import { fetchProductImagesForProducts } from './productImages.js';

const AI_PRODUCT_SELECT = [
    'id',
    'slug',
    'name',
    'description',
    'price',
    'stock_quantity',
    'category_id',
    'brand',
    'sku',
    'volume',
    'origin',
    'texture',
    'usage_instructions',
    'ingredients',
    'key_benefits',
    'skin_types',
    'precautions',
    'updated_at',
].join(',');

const AI_SERVICE_SELECT = [
    'id',
    'slug',
    'name',
    'description',
    'benefits',
    'price',
    'image_path',
    'local_seo_tags',
    'updated_at',
].join(',');

const AI_PRODUCT_IMAGE_SELECT = 'id,product_id,image_path,is_primary,display_order';

function cleanText(value, maxLength = 1200) {
    const normalized = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function cleanArray(value, maxItems = 12, maxItemLength = 180) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => cleanText(item, maxItemLength))
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizePrice(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getLatestUpdatedAt(records = []) {
    const timestamps = (records || [])
        .map((record) => record?.updated_at ? Date.parse(record.updated_at) : NaN)
        .filter((value) => Number.isFinite(value));
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toISOString();
}

function sortProductImages(images = []) {
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

function buildJsonResponse(payload, maxAge = 900) {
    return new Response(JSON.stringify(payload, null, 2), {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=86400`,
            'X-Robots-Tag': 'noindex, follow',
        },
    });
}

function buildProductUrl(BASE_URL, product, categorySlug) {
    return `${BASE_URL}/san-pham/${categorySlug || 'khac'}/${product.slug || product.id}`;
}

export async function maybeHandleAiCatalogRoute(route, deps) {
    const { path } = route;
    if (!path.startsWith('/ai/')) return null;

    const {
        BASE_URL,
        SITE_NAME,
        DEFAULT_LOGO_IMAGE,
        supabaseFetch,
        getStorageUrl,
    } = deps;

    if (path === '/ai/products.json') {
        const [products, categories] = await Promise.all([
            supabaseFetch(`products?is_published=eq.true&archived_at=is.null&select=${AI_PRODUCT_SELECT}&order=name.asc`),
            supabaseFetch('product_categories?select=id,slug,name,description&order=name.asc'),
        ]);
        const productImages = await fetchProductImagesForProducts((products || []).map((product) => product.id), supabaseFetch, AI_PRODUCT_IMAGE_SELECT);

        const categoryById = new Map((categories || []).map((category) => [category.id, category]));
        const imagesByProductId = groupImagesByProductId(productImages || []);
        const records = (products || []).map((product) => {
            const category = categoryById.get(product.category_id);
            const images = sortProductImages(imagesByProductId.get(product.id) || []);
            const primaryImage = images[0]?.image_path ? getStorageUrl(images[0].image_path, 'product-images') : null;
            return {
                id: product.id,
                sku: product.sku || null,
                name: cleanText(product.name, 220),
                brand: cleanText(product.brand, 120) || null,
                url: buildProductUrl(BASE_URL, product, category?.slug),
                image: primaryImage,
                price: normalizePrice(product.price),
                currency: 'VND',
                availability: Number(product.stock_quantity || 0) > 0 ? 'in_stock' : 'out_of_stock',
                category: category ? {
                    name: cleanText(category.name, 160),
                    slug: category.slug || null,
                } : null,
                short_description: cleanText(product.description, 600),
                ingredients: cleanText(product.ingredients, 1000) || null,
                usage: cleanText(product.usage_instructions, 1000) || null,
                benefits: cleanArray(product.key_benefits, 10),
                skin_types: cleanArray(product.skin_types, 8),
                warnings: cleanText(product.precautions, 1000) || null,
                volume: cleanText(product.volume, 80) || null,
                origin: cleanText(product.origin, 120) || null,
                texture: cleanText(product.texture, 160) || null,
                updated_at: product.updated_at || null,
            };
        });

        return buildJsonResponse({
            generated_at: new Date().toISOString(),
            data_version: getLatestUpdatedAt(products),
            source: `${BASE_URL}/san-pham`,
            record_count: records.length,
            products: records,
        }, 300);
    }

    if (path === '/ai/services.json') {
        const services = await supabaseFetch(`services?select=${AI_SERVICE_SELECT}&order=id.asc`);
        const records = (services || []).map((service) => ({
            id: service.id,
            name: cleanText(service.name, 220),
            url: `${BASE_URL}/dich-vu/${service.slug || service.id}`,
            image: service.image_path ? getStorageUrl(service.image_path, 'site-assets') : null,
            price: normalizePrice(service.price),
            currency: normalizePrice(service.price) ? 'VND' : null,
            short_description: cleanText(service.description, 700),
            benefits: cleanArray(service.benefits, 12),
            local_search_tags: cleanArray(service.local_seo_tags, 12),
            booking_url: `${BASE_URL}/dat-lich`,
            updated_at: service.updated_at || null,
        }));

        return buildJsonResponse({
            generated_at: new Date().toISOString(),
            data_version: getLatestUpdatedAt(services),
            source: `${BASE_URL}/dich-vu`,
            record_count: records.length,
            services: records,
        }, 300);
    }

    if (path === '/ai/site-profile.json') {
        const siteRows = await supabaseFetch('site_info?select=*&limit=1');
        const siteInfo = Array.isArray(siteRows) ? siteRows[0] : null;
        return buildJsonResponse({
            generated_at: new Date().toISOString(),
            name: SITE_NAME,
            alternate_names: ['Thế Giới Trị Mụn', 'Da Liễu Nhiệt Đới Phú Quốc'],
            url: BASE_URL,
            logo: DEFAULT_LOGO_IMAGE,
            public_description: cleanText(siteInfo?.clinic_description || siteInfo?.description || 'Website da liễu, dịch vụ chăm sóc da và sản phẩm hỗ trợ chăm sóc da tại Phú Quốc.', 600),
            specialties: [
                'Da liễu',
                'Trị mụn',
                'Chăm sóc da',
                'Sản phẩm chăm sóc da',
                'Dịch vụ da liễu tại Phú Quốc',
            ],
            public_catalogs: {
                products: `${BASE_URL}/ai/products.json`,
                services: `${BASE_URL}/ai/services.json`,
                sitemap: `${BASE_URL}/sitemap.xml`,
                product_feed: `${BASE_URL}/feeds/google-products.xml`,
            },
            privacy_note: 'Catalog này chỉ chứa dữ liệu công khai, không chứa thông tin khách hàng, đơn hàng hoặc dữ liệu quản trị.',
        }, 3600);
    }

    return null;
}
