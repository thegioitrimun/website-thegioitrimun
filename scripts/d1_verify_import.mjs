import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

const remote = process.argv.includes('--remote');
const root = process.cwd();
const exportDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const appDatabase = process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app';
const inciDatabase = process.env.INCI_D1_DATABASE_NAME || 'thegioitrimun-inci-runtime';
const wranglerConfig = process.env.D1_WRANGLER_CONFIG || (!remote ? 'wrangler.d1.local.jsonc' : '');
const includeRawIngredientSourceRecords = String(process.env.D1_INCLUDE_RAW_INGREDIENT_SOURCE_RECORDS || '').toLowerCase() === 'yes';
const configArgs = wranglerConfig ? ['--config', wranglerConfig] : [];

function query(database, sql) {
    const result = spawnSync('npx', ['wrangler', 'd1', 'execute', database, remote ? '--remote' : '--local', ...configArgs, `--command=${sql}`, '--json'], {
        cwd: root,
        encoding: 'utf8',
        env: process.env,
    });
    if (result.status !== 0) {
        process.stderr.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        process.exit(result.status || 1);
    }
    const payload = JSON.parse(result.stdout || '[]');
    return (Array.isArray(payload) ? payload.flatMap((entry) => entry?.results || []) : payload?.results || [])[0] || {};
}

async function sourceRows(source, table) {
    const content = await readFile(path.join(exportDir, source, `${table}.jsonl`), 'utf8');
    return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function countSourceRows(source, table) {
    const input = createReadStream(path.join(exportDir, source, `${table}.jsonl`), { encoding: 'utf8' });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let count = 0;
    for await (const line of lines) if (line) count += 1;
    return count;
}

function normalizeIngredientName(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function ingredientSourceMetrics() {
    const input = createReadStream(path.join(exportDir, 'inci-supabase', 'ingredients.jsonl'), { encoding: 'utf8' });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    const normalizedNames = new Set();
    let rows = 0;
    for await (const line of lines) {
        if (!line) continue;
        const row = JSON.parse(line);
        rows += 1;
        normalizedNames.add(normalizeIngredientName(row.inci_name || row.id));
    }
    return { rows, canonical: normalizedNames.size };
}

const mappings = [
    ['patients', 'users'], ['product_categories', 'product_categories'], ['product_brands', 'product_brands'],
    ['products', 'products'], ['product_images', 'product_images'], ['product_orders', 'product_orders'],
    ['product_order_items', 'product_order_items'], ['product_reviews', 'product_reviews'], ['user_wishlist', 'wishlists'],
    ['services', 'services'], ['procedure_steps', 'procedure_steps'], ['appointments', 'appointments'],
    ['medical_records', 'medical_records'], ['patient_uploaded_documents', 'private_documents'],
    ['funnel_events', 'funnel_events'],
    ['blog_categories', 'blog_categories'], ['blog_posts', 'blog_posts'],
];
const errors = [];
const checks = [];

for (const [sourceTable, targetTable] of mappings) {
    const source = await sourceRows('app-supabase', sourceTable);
    const expected = sourceTable === 'patient_uploaded_documents'
        ? source.filter((row) => (row.file_path || row.object_key) && (row.patient_id || row.owner_user_id)).length
        : source.length;
    const actual = Number(query(appDatabase, `SELECT COUNT(*) AS count FROM ${targetTable}`).count || 0);
    checks.push({ source: sourceTable, target: targetTable, expected, actual });
    if (expected !== actual) errors.push(`${sourceTable} -> ${targetTable}: ${expected} != ${actual}`);
}

const sourceOrders = await sourceRows('app-supabase', 'product_orders');
const expectedOrderTotal = sourceOrders.reduce((sum, row) => sum + Number(row.total_price ?? row.grand_total ?? 0), 0);
const actualOrderTotal = Number(query(appDatabase, 'SELECT COALESCE(SUM(total_price), 0) AS total FROM product_orders').total || 0);
checks.push({ metric: 'order_total', expected: expectedOrderTotal, actual: actualOrderTotal });
if (expectedOrderTotal !== actualOrderTotal) errors.push(`order total: ${expectedOrderTotal} != ${actualOrderTotal}`);

const sourceItems = await sourceRows('app-supabase', 'product_order_items');
const expectedQuantity = sourceItems.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
const actualQuantity = Number(query(appDatabase, 'SELECT COALESCE(SUM(quantity), 0) AS total FROM product_order_items').total || 0);
checks.push({ metric: 'order_item_quantity', expected: expectedQuantity, actual: actualQuantity });
if (expectedQuantity !== actualQuantity) errors.push(`order item quantity: ${expectedQuantity} != ${actualQuantity}`);

const sourceIngredientMetrics = await ingredientSourceMetrics();
const actualIngredients = Number(query(inciDatabase, 'SELECT COUNT(*) AS count FROM ingredients').count || 0);
checks.push({ source: 'ingredients', target: 'ingredients', expected: sourceIngredientMetrics.canonical, actual: actualIngredients });
if (sourceIngredientMetrics.canonical !== actualIngredients) errors.push(`canonical ingredients: ${sourceIngredientMetrics.canonical} != ${actualIngredients}`);
const actualIngredientSources = Number(query(inciDatabase, 'SELECT COUNT(*) AS count FROM ingredient_source_records').count || 0);
const expectedIngredientSources = includeRawIngredientSourceRecords ? sourceIngredientMetrics.rows : 0;
checks.push({ source: 'ingredients raw archive', target: 'ingredient_source_records', expected: expectedIngredientSources, actual: actualIngredientSources });
if (expectedIngredientSources !== actualIngredientSources) errors.push(`ingredient source rows: ${expectedIngredientSources} != ${actualIngredientSources}`);

for (const [database, name] of [[appDatabase, 'app'], [inciDatabase, 'inci']]) {
    const foreignKeyRows = query(database, 'SELECT COUNT(*) AS count FROM pragma_foreign_key_check').count;
    checks.push({ metric: `${name}_foreign_key_errors`, expected: 0, actual: Number(foreignKeyRows || 0) });
    if (Number(foreignKeyRows || 0) !== 0) errors.push(`${name}: foreign key errors detected`);
}

const report = { generatedAt: new Date().toISOString(), mode: remote ? 'remote' : 'local', ok: errors.length === 0, checks, errors };
await writeFile(path.join(exportDir, `verification-${remote ? 'remote' : 'local'}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
