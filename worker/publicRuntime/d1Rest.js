const SIMPLE_TABLES = new Map([
    ['blog_categories', 'blog_categories'],
    ['product_categories', 'product_categories'],
    ['product_brands', 'product_brands'],
    ['product_images', 'product_images'],
]);

const FILTER_COLUMNS = new Set(['id', 'slug', 'product_id', 'category_id', 'is_published', 'is_featured', 'verified_purchase', 'status', 'archived_at']);
const ORDER_COLUMNS = new Set(['id', 'name', 'created_at', 'updated_at', 'published_at', 'display_order', 'date', 'price', 'sold_count']);

function boolish(value) {
    if (value === true || value === 1 || value === '1' || value === 'true') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false') return 0;
    return value;
}

function buildWhere(searchParams, prefix = '') {
    const clauses = [];
    const bindings = [];
    for (const column of FILTER_COLUMNS) {
        const raw = searchParams.get(column);
        if (!raw) continue;
        if (raw.startsWith('eq.')) {
            clauses.push(`${prefix}${column} = ?`);
            bindings.push(boolish(raw.slice(3)));
        } else if (raw === 'is.null') {
            clauses.push(`${prefix}${column} IS NULL`);
        } else if (raw === 'not.is.null') {
            clauses.push(`${prefix}${column} IS NOT NULL`);
        } else if (raw.startsWith('in.(') && raw.endsWith(')')) {
            const values = raw.slice(4, -1).split(',').map((value) => value.replace(/^"|"$/g, '')).slice(0, 100);
            if (values.length) {
                clauses.push(`${prefix}${column} IN (${values.map(() => '?').join(',')})`);
                bindings.push(...values.map(boolish));
            }
        }
    }
    return { clauses, bindings };
}

function orderLimit(searchParams, aliases = {}, prefix = '') {
    const rawOrder = String(searchParams.get('order') || '').split(',')[0];
    const [requested, direction] = rawOrder.split('.');
    const safeColumn = ORDER_COLUMNS.has(requested) ? (aliases[requested] || requested) : '';
    const resolved = safeColumn ? `${prefix}${safeColumn}` : '';
    const order = resolved ? ` ORDER BY ${resolved} ${direction === 'desc' ? 'DESC' : 'ASC'}` : '';
    const limitValue = Number(searchParams.get('limit') || 500);
    return { order, limit: Math.max(1, Math.min(1000, Number.isFinite(limitValue) ? Math.floor(limitValue) : 500)) };
}

function parseJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

const D1_IN_QUERY_BATCH_SIZE = 80;

async function queryRowsByIds(db, {
    table,
    idColumn,
    ids,
    orderBy = '',
}) {
    const rows = [];
    for (let offset = 0; offset < ids.length; offset += D1_IN_QUERY_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + D1_IN_QUERY_BATCH_SIZE);
        const result = await db.prepare(
            `SELECT * FROM ${table} WHERE ${idColumn} IN (${batch.map(() => '?').join(',')})${orderBy}`,
        ).bind(...batch).all();
        rows.push(...(result.results || []));
    }
    return rows;
}

function mapProductJson(row) {
    return {
        ...row,
        long_description: parseJson(row.long_description, row.long_description || []),
        key_benefits: parseJson(row.key_benefits_json, []),
        key_benefits_en: parseJson(row.key_benefits_en_json, []),
        key_benefits_ru: parseJson(row.key_benefits_ru_json, []),
        key_benefits_cn: parseJson(row.key_benefits_cn_json, []),
        skin_types: parseJson(row.skin_types_json, []),
        faq_items: parseJson(row.faq_items_json, []),
    };
}

async function products(db, params) {
    const { clauses, bindings } = buildWhere(params, 'p.');
    const textSearch = String(params.get('or') || '').match(/^\(slug\.ilike\.\*([^*]+)\*,name\.ilike\.\*\1\*\)$/i);
    if (textSearch?.[1]) {
        clauses.push('(p.slug LIKE ? COLLATE NOCASE OR p.name LIKE ? COLLATE NOCASE)');
        const pattern = `%${decodeURIComponent(textSearch[1])}%`;
        bindings.push(pattern, pattern);
    }
    const { order, limit } = orderLimit(params, {}, 'p.');
    const result = await db.prepare(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
        FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}${order} LIMIT ?`)
        .bind(...bindings, limit).all();
    const rows = result.results || [];
    if (!rows.length) return rows;
    const imageRows = await queryRowsByIds(db, {
        table: 'product_images',
        idColumn: 'product_id',
        ids: rows.map((row) => row.id),
        orderBy: ' ORDER BY is_primary DESC, display_order, id',
    });
    const images = new Map();
    for (const image of imageRows) {
        const list = images.get(image.product_id) || [];
        list.push(image);
        images.set(image.product_id, list);
    }
    return rows.map((row) => ({
        ...mapProductJson(row),
        is_published: Boolean(row.is_published),
        is_featured: Boolean(row.is_featured),
        images: images.get(row.id) || [],
        category: row.category_id ? { id: row.category_id, slug: row.category_slug, name: row.category_name } : null,
    }));
}

async function services(db, params) {
    const { clauses, bindings } = buildWhere(params, 's.');
    const { order, limit } = orderLimit(params, {}, 's.');
    const result = await db.prepare(`SELECT s.* FROM services s ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}${order} LIMIT ?`)
        .bind(...bindings, limit).all();
    const rows = result.results || [];
    if (!rows.length) return rows;
    const steps = await db.prepare(`SELECT * FROM procedure_steps WHERE service_id IN (${rows.map(() => '?').join(',')}) ORDER BY service_id, step_number`)
        .bind(...rows.map((row) => row.id)).all();
    const byService = new Map();
    for (const step of steps.results || []) {
        const list = byService.get(step.service_id) || [];
        list.push(step);
        byService.set(step.service_id, list);
    }
    return rows.map((row) => ({
        ...row,
        is_published: Boolean(row.is_published), is_featured: Boolean(row.is_featured),
        benefits: parseJson(row.benefits_json, []),
        benefits_en: parseJson(row.benefits_en_json, []),
        benefits_ru: parseJson(row.benefits_ru_json, []),
        benefits_cn: parseJson(row.benefits_cn_json, []),
        faq_items: parseJson(row.faq_items_json, []),
        local_seo_tags: parseJson(row.local_seo_tags_json, []),
        procedure_steps: byService.get(row.id) || [],
    }));
}

async function blogPosts(db, params) {
    const clauses = [`status = 'published'`];
    const bindings = [];
    const slug = params.get('slug');
    if (slug?.startsWith('eq.')) { clauses.push('slug = ?'); bindings.push(slug.slice(3)); }
    const categorySlug = params.get('category_slug');
    if (categorySlug?.startsWith('eq.')) { clauses.push('category_slug = ?'); bindings.push(categorySlug.slice(3)); }
    const { order, limit } = orderLimit(params, { date: 'published_at' });
    const result = await db.prepare(`SELECT *, published_at AS date FROM blog_posts WHERE ${clauses.join(' AND ')}${order} LIMIT ?`)
        .bind(...bindings, limit).all();
    return (result.results || []).map((row) => ({
        ...row,
        local_seo_tags: parseJson(row.local_seo_tags_json, []),
    }));
}

async function siteContent(db, resource, params) {
    const limit = Math.max(1, Math.min(1000, Number(params.get('limit') || 500)));
    const result = await db.prepare(`SELECT resource_key, payload_json FROM site_content
        WHERE resource = ? AND is_published = 1 ORDER BY resource_key LIMIT ?`).bind(resource, limit).all();
    return (result.results || []).map((row) => ({ id: row.resource_key, ...parseJson(row.payload_json, {}) }));
}

async function productReviews(db, params) {
    const { clauses, bindings } = buildWhere(params, 'r.');
    clauses.push('r.is_published = 1');
    const { order, limit } = orderLimit(params, {}, 'r.');
    const result = await db.prepare(`
        SELECT r.*, COALESCE(u.display_name, 'Khách hàng') AS author_name
        FROM product_reviews r LEFT JOIN users u ON u.id = r.user_id
        WHERE ${clauses.join(' AND ')}${order} LIMIT ?
    `).bind(...bindings, limit).all();
    return (result.results || []).map((row) => ({
        ...row,
        verified_purchase: Boolean(row.verified_purchase),
        is_published: Boolean(row.is_published),
    }));
}

export async function queryD1PublicResource(db, resource, searchParams) {
    if (resource === 'products') return products(db, searchParams);
    if (resource === 'services') return services(db, searchParams);
    if (resource === 'blog_posts' || resource === 'public_blog_posts') return blogPosts(db, searchParams);
    if (resource === 'public_product_reviews') return productReviews(db, searchParams);
    if (resource === 'featured_services') {
        const result = await db.prepare('SELECT id AS service_id FROM services WHERE is_published = 1 AND is_featured = 1 ORDER BY id').all();
        return result.results || [];
    }
    if (resource === 'public_doctors_directory') return siteContent(db, 'doctors', searchParams);
    const table = SIMPLE_TABLES.get(resource);
    if (table) {
        const { clauses, bindings } = buildWhere(searchParams);
        const { order, limit } = orderLimit(searchParams);
        const result = await db.prepare(`SELECT * FROM ${table}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}${order} LIMIT ?`)
            .bind(...bindings, limit).all();
        return (result.results || []).map((row) => ({
            ...row,
            ...(Object.hasOwn(row, 'is_published') ? { is_published: Boolean(row.is_published) } : {}),
            ...(Object.hasOwn(row, 'is_featured') ? { is_featured: Boolean(row.is_featured) } : {}),
            ...(Object.hasOwn(row, 'is_active') ? { is_active: Boolean(row.is_active) } : {}),
        }));
    }
    return siteContent(db, resource, searchParams);
}

export async function fetchD1PublicEndpoint(env, endpoint) {
    try {
        const parsed = new URL(endpoint, 'https://d1.local/');
        const resource = parsed.pathname.replace(/^\/+/, '');
        return { data: await queryD1PublicResource(env.APP_DB, resource, parsed.searchParams), timed_out: false };
    } catch (error) {
        console.error('[d1-public-runtime] Query failed:', { endpoint, message: error instanceof Error ? error.message : String(error) });
        return { data: null, timed_out: false };
    }
}
