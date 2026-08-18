import { syncProductIngredientSnapshot } from '../worker/ingredientAnalyzer/productSync.js';

const sourceUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const sourceKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || '',
);
const ingredientUrl = String(process.env.INGREDIENT_SUPABASE_URL || '').replace(/\/+$/, '');
const ingredientKey = String(
    process.env.INGREDIENT_SUPABASE_SECRET_KEY
    || process.env.INGREDIENT_SUPABASE_KEY
    || '',
);

if (!sourceUrl || !sourceKey || !ingredientUrl || !ingredientKey) {
    throw new Error('Missing product or ingredient Supabase environment variables.');
}

const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const concurrencyArg = process.argv.find((value) => value.startsWith('--concurrency='));
const maxProducts = Math.max(1, Number(limitArg?.split('=')[1] || 1000));
const concurrency = Math.max(1, Math.min(4, Number(concurrencyArg?.split('=')[1] || 2)));
const select = [
    'id', 'slug', 'sku', 'name', 'name_en', 'name_ru', 'name_cn',
    'ingredients', 'ingredients_en', 'ingredients_ru', 'ingredients_cn',
    'brand', 'category_id', 'is_published', 'archived_at', 'created_at', 'updated_at',
].join(',');

async function fetchPublishedProducts() {
    const products = [];
    for (let offset = 0; products.length < maxProducts; offset += 500) {
        const url = new URL('/rest/v1/products', `${sourceUrl}/`);
        url.searchParams.set('select', select);
        url.searchParams.set('is_published', 'eq.true');
        url.searchParams.set('archived_at', 'is.null');
        url.searchParams.set('order', 'id.asc');
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('limit', String(Math.min(500, maxProducts - products.length)));
        const response = await fetch(url, {
            headers: {
                apikey: sourceKey,
                Authorization: `Bearer ${sourceKey}`,
                Accept: 'application/json',
            },
        });
        const rows = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(rows?.message || `Product Supabase responded with ${response.status}.`);
        }
        products.push(...(rows || []));
        if (!rows?.length || rows.length < 500) break;
    }
    return products.slice(0, maxProducts);
}

const products = await fetchPublishedProducts();
let cursor = 0;
let completed = 0;
const failures = [];

async function worker() {
    while (cursor < products.length) {
        const index = cursor;
        cursor += 1;
        const product = products[index];
        try {
            await syncProductIngredientSnapshot(product.id, {
                INGREDIENT_SUPABASE_URL: ingredientUrl,
                INGREDIENT_SUPABASE_SECRET_KEY: ingredientKey,
                PRODUCT_SOURCE_PROJECT: 'thegioitrimun.vn',
            }, { product });
        } catch (error) {
            failures.push({
                productId: product.id,
                slug: product.slug,
                message: error instanceof Error ? error.message : String(error),
            });
        }
        completed += 1;
        if (completed % 10 === 0 || completed === products.length) {
            console.log(`[ingredient-sync] ${completed}/${products.length} products processed; ${failures.length} failed.`);
        }
    }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length) {
    console.error('[ingredient-sync] Backfill failures:', failures);
    process.exitCode = 1;
} else {
    console.log(`[ingredient-sync] Backfill completed for ${products.length} published products.`);
}
