import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const appUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const appKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const inciUrl = String(process.env.INGREDIENT_SUPABASE_URL || '').replace(/\/+$/, '');
const inciKey = process.env.INGREDIENT_SUPABASE_SECRET_KEY || process.env.INGREDIENT_SUPABASE_KEY || '';

if (!appUrl || !appKey || !inciUrl || !inciKey) {
    throw new Error('Missing Supabase migration source variables. Load them from a local secret environment file.');
}

const APP_TABLES = [
    'patients',
    'product_categories', 'product_brands', 'products', 'product_images', 'discount_codes',
    'product_orders', 'product_order_items', 'order_status_history', 'order_payments', 'order_refunds',
    'product_reviews', 'user_wishlist',
    'services', 'procedure_steps', 'appointments', 'medical_records', 'patient_uploaded_documents',
    'blog_categories', 'blog_posts', 'featured_posts', 'featured_services', 'featured_doctors',
    'doctors', 'faq_items', 'homepage_hero', 'site_info', 'footer_content', 'auth_page_images',
    'about_page_content', 'about_features', 'about_values', 'payment_settings',
    'tax_profiles', 'tax_rates', 'admin_report_schedules',
    'funnel_events',
];
const INCI_TABLES = ['ingredients', 'ingredient_search_terms'];

async function fetchAll(baseUrl, key, table) {
    const rows = [];
    const pageSize = table === 'ingredients' ? 100 : (table === 'ingredient_search_terms' ? 500 : 1000);
    for (let offset = 0; ; offset += pageSize) {
        const url = new URL(`/rest/v1/${table}`, `${baseUrl}/`);
        url.searchParams.set('select', '*');
        url.searchParams.set('limit', String(pageSize));
        url.searchParams.set('offset', String(offset));
        let response = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
            if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
        }
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`${table}: ${response.status} ${body.slice(0, 300)}`);
        }
        const page = await response.json();
        rows.push(...page);
        if (page.length < pageSize) break;
    }
    return rows;
}

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
}

async function exportSource(source, baseUrl, key, tables) {
    const manifest = { source, generatedAt: new Date().toISOString(), tables: {} };
    await mkdir(path.join(outputDir, source), { recursive: true });
    for (const table of tables) {
        try {
            const rows = await fetchAll(baseUrl, key, table);
            const content = `${rows.map((row) => JSON.stringify(canonical(row))).join('\n')}${rows.length ? '\n' : ''}`;
            const checksum = createHash('sha256').update(content).digest('hex');
            await writeFile(path.join(outputDir, source, `${table}.jsonl`), content, 'utf8');
            manifest.tables[table] = { rows: rows.length, sha256: checksum };
            process.stdout.write(`${source}.${table}: ${rows.length}\n`);
        } catch (error) {
            manifest.tables[table] = { error: error instanceof Error ? error.message : String(error) };
            process.stderr.write(`${source}.${table}: skipped (${manifest.tables[table].error})\n`);
        }
    }
    await writeFile(path.join(outputDir, source, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}

await mkdir(outputDir, { recursive: true });
const manifests = await Promise.all([
    exportSource('app-supabase', appUrl, appKey, APP_TABLES),
    exportSource('inci-supabase', inciUrl, inciKey, INCI_TABLES),
]);
await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sources: manifests }, null, 2), 'utf8');
