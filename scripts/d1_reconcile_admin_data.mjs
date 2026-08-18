import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const apply = process.argv.includes('--apply');
const remote = !process.argv.includes('--local');
const database = process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app-staging';
const config = process.env.D1_WRANGLER_CONFIG || (remote ? 'wrangler.d1.staging.jsonc' : 'wrangler.d1.local.jsonc');
const exportDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration/app-supabase');
const reportDir = path.resolve('output/d1-reconciliation');

function runWrangler(args) {
    const result = spawnSync('npx', ['wrangler', 'd1', 'execute', database, remote ? '--remote' : '--local', '--config', config, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: process.env,
        maxBuffer: 32 * 1024 * 1024,
    });
    if (result.status !== 0) {
        throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n') || `Wrangler exited with ${result.status}`);
    }
    return result.stdout;
}

function query(sql) {
    const payload = JSON.parse(runWrangler([`--command=${sql}`, '--json']) || '[]');
    return Array.isArray(payload) ? payload.flatMap((entry) => entry?.results || []) : payload?.results || [];
}

async function readJsonLines(filename) {
    const content = await readFile(path.join(exportDir, filename), 'utf8');
    return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function sqlValue(value) {
    if (value == null) return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
}

function stableIssueId(entityType, entityId, code) {
    return createHash('sha256').update(`supabase:${entityType}:${entityId}:${code}`).digest('hex').slice(0, 32);
}

function issueSql({ entityType, entityId, code, details, status }) {
    const now = new Date().toISOString();
    return `INSERT INTO migration_issues (id, source_system, entity_type, entity_id, issue_code, details_json, resolution_status, resolved_at, created_at, updated_at)
VALUES (${sqlValue(stableIssueId(entityType, entityId, code))}, 'supabase-read-only-export', ${sqlValue(entityType)}, ${sqlValue(String(entityId))}, ${sqlValue(code)}, ${sqlValue(JSON.stringify(details))}, ${sqlValue(status)}, ${status === 'resolved' ? sqlValue(now) : 'NULL'}, ${sqlValue(now)}, ${sqlValue(now)})
ON CONFLICT(source_system, entity_type, entity_id, issue_code) DO UPDATE SET details_json = excluded.details_json, resolution_status = excluded.resolution_status, resolved_at = excluded.resolved_at, updated_at = excluded.updated_at;`;
}

const missingOrders = query(`SELECT o.id, o.order_code FROM product_orders o LEFT JOIN product_order_items i ON i.order_id = o.id GROUP BY o.id HAVING COUNT(i.id) = 0 ORDER BY o.created_at`).map((row) => String(row.id));
const missingImageProducts = query(`SELECT p.id, p.slug FROM products p LEFT JOIN product_images i ON i.product_id = p.id GROUP BY p.id HAVING COUNT(i.id) = 0 ORDER BY p.id`).map((row) => Number(row.id));
const existingProducts = new Set(query('SELECT id FROM products').map((row) => Number(row.id)));

const [sourceItems, sourceImages] = await Promise.all([
    readJsonLines('product_order_items.jsonl'),
    readJsonLines('product_images.jsonl'),
]);
const sourceItemsByOrder = Map.groupBy(sourceItems, (row) => String(row.order_id));
const sourceImagesByProduct = Map.groupBy(sourceImages, (row) => Number(row.product_id));
const statements = [];
const findings = [];

for (const orderId of missingOrders) {
    const rows = sourceItemsByOrder.get(orderId) || [];
    const validRows = rows.filter((row) => existingProducts.has(Number(row.product_id)));
    if (validRows.length === 0) {
        const details = { reason: rows.length ? 'Referenced products are absent from D1.' : 'No source rows found.', sourceRows: rows.length };
        findings.push({ entityType: 'product_order', entityId: orderId, issue: 'missing_order_items', status: 'unrecoverable', ...details });
        statements.push(issueSql({ entityType: 'product_order', entityId: orderId, code: 'missing_order_items', details, status: 'unrecoverable' }));
        continue;
    }
    for (const row of validRows) {
        statements.push(`INSERT OR IGNORE INTO product_order_items (id, order_id, product_id, product_name, product_sku, product_image_path, quantity, price_at_purchase, vat_rate, tax_amount, created_at) VALUES (${[
            row.id || randomUUID(), row.order_id, Number(row.product_id), row.product_name || '', row.product_sku || null,
            row.product_image_path || null, Number(row.quantity || 1), Number(row.price_at_purchase ?? row.price ?? 0),
            Number(row.vat_rate || 0), Number(row.tax_amount || 0), row.created_at || new Date().toISOString(),
        ].map(sqlValue).join(', ')});`);
    }
    const details = { recoveredRows: validRows.length, sourceRows: rows.length };
    findings.push({ entityType: 'product_order', entityId: orderId, issue: 'missing_order_items', status: 'resolved', ...details });
    statements.push(issueSql({ entityType: 'product_order', entityId: orderId, code: 'missing_order_items', details, status: 'resolved' }));
}

for (const productId of missingImageProducts) {
    const rows = sourceImagesByProduct.get(productId) || [];
    if (rows.length === 0) {
        const details = { reason: 'No source image row found.' };
        findings.push({ entityType: 'product', entityId: productId, issue: 'missing_product_images', status: 'unrecoverable', ...details });
        statements.push(issueSql({ entityType: 'product', entityId: productId, code: 'missing_product_images', details, status: 'unrecoverable' }));
        continue;
    }
    for (const row of rows) {
        statements.push(`INSERT OR IGNORE INTO product_images (id, product_id, image_path, alt_text, is_primary, display_order, created_at, updated_at) VALUES (${[
            row.id || randomUUID(), productId, row.image_path, row.alt_text || null, row.is_primary ? 1 : 0,
            Number(row.display_order || 0), row.created_at || new Date().toISOString(), row.updated_at || row.created_at || new Date().toISOString(),
        ].map(sqlValue).join(', ')});`);
    }
    const details = { recoveredRows: rows.length };
    findings.push({ entityType: 'product', entityId: productId, issue: 'missing_product_images', status: 'resolved', ...details });
    statements.push(issueSql({ entityType: 'product', entityId: productId, code: 'missing_product_images', details, status: 'resolved' }));
}

await mkdir(reportDir, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(':', '-');
const sqlPath = path.join(reportDir, `admin-reconciliation-${timestamp}.sql`);
const reportPath = path.join(reportDir, `admin-reconciliation-${timestamp}.json`);
await writeFile(sqlPath, `${statements.join('\n')}\n`, 'utf8');

if (apply && statements.length) runWrangler([`--file=${sqlPath}`]);

const report = {
    generatedAt: new Date().toISOString(),
    database,
    config,
    mode: remote ? 'remote' : 'local',
    applied: apply,
    source: 'Supabase read-only export',
    missingOrders: missingOrders.length,
    missingImageProducts: missingImageProducts.length,
    findings,
    sqlPath,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`);
