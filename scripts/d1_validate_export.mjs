import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const maxProjectedBytes = Number(process.env.D1_MAX_PROJECTED_BYTES || 8 * 1024 ** 3);
const projectionMultiplier = Number(process.env.D1_SIZE_MULTIPLIER || 2.75);
const errors = [];
const warnings = [];

const required = {
    'app-supabase': ['patients', 'products', 'product_images', 'product_orders', 'product_order_items', 'services', 'appointments'],
    'inci-supabase': ['ingredients', 'ingredient_search_terms'],
};

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

async function readRows(source, table) {
    const file = path.join(root, source, `${table}.jsonl`);
    const content = await readFile(file, 'utf8');
    return {
        content,
        rows: content.split(/\r?\n/).filter(Boolean).map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`${source}.${table} line ${index + 1}: ${error.message}`);
            }
        }),
        bytes: Buffer.byteLength(content),
    };
}

function missingReferences(children, childKey, parents, parentKey = 'id') {
    const parentIds = new Set(parents.map((row) => String(row[parentKey])).filter(Boolean));
    return children
        .filter((row) => row[childKey] !== null && row[childKey] !== undefined && !parentIds.has(String(row[childKey])))
        .slice(0, 20)
        .map((row) => String(row[childKey]));
}

const report = {
    generatedAt: new Date().toISOString(),
    limits: { maxProjectedBytes, projectionMultiplier },
    sources: {},
    relationships: {},
    errors,
    warnings,
};

for (const source of Object.keys(required)) {
    const manifestPath = path.join(root, source, 'manifest.json');
    let manifest;
    try {
        manifest = await readJson(manifestPath);
    } catch (error) {
        errors.push(`${source}: missing or invalid manifest (${error.message})`);
        continue;
    }

    let rawBytes = 0;
    const tables = {};
    for (const [table, metadata] of Object.entries(manifest.tables || {})) {
        if (metadata?.error) {
            const message = `${source}.${table}: source export failed (${metadata.error})`;
            if (required[source].includes(table)) errors.push(message);
            else warnings.push(message);
            continue;
        }
        try {
            const file = path.join(root, source, `${table}.jsonl`);
            const content = await readFile(file, 'utf8');
            const bytes = (await stat(file)).size;
            const rows = content.split(/\r?\n/).filter(Boolean).length;
            const sha256 = createHash('sha256').update(content).digest('hex');
            rawBytes += bytes;
            tables[table] = { rows, bytes, sha256 };
            if (rows !== Number(metadata.rows)) errors.push(`${source}.${table}: row count ${rows} != manifest ${metadata.rows}`);
            if (sha256 !== metadata.sha256) errors.push(`${source}.${table}: checksum mismatch`);
        } catch (error) {
            errors.push(`${source}.${table}: missing export file (${error.message})`);
        }
    }

    for (const table of required[source]) {
        if (!tables[table]) errors.push(`${source}.${table}: required table was not exported successfully`);
    }
    const projectedBytes = Math.ceil(rawBytes * projectionMultiplier);
    if (projectedBytes > maxProjectedBytes) {
        errors.push(`${source}: projected D1 size ${projectedBytes} exceeds safety limit ${maxProjectedBytes}`);
    }
    report.sources[source] = { rawBytes, projectedBytes, tables };
}

if (!errors.some((message) => message.startsWith('app-supabase'))) {
    const [patients, products, images, orders, items, services, appointments] = await Promise.all([
        readRows('app-supabase', 'patients'),
        readRows('app-supabase', 'products'),
        readRows('app-supabase', 'product_images'),
        readRows('app-supabase', 'product_orders'),
        readRows('app-supabase', 'product_order_items'),
        readRows('app-supabase', 'services'),
        readRows('app-supabase', 'appointments'),
    ]);
    const checks = {
        productImagesToProducts: missingReferences(images.rows, 'product_id', products.rows),
        orderItemsToOrders: missingReferences(items.rows, 'order_id', orders.rows),
        orderItemsToProducts: missingReferences(items.rows, 'product_id', products.rows),
        appointmentsToServices: missingReferences(appointments.rows, 'service_id', services.rows),
        appointmentsToPatients: missingReferences(
            appointments.rows.filter((row) => row.patient_id || row.user_id).map((row) => ({ ...row, resolved_user_id: row.patient_id || row.user_id })),
            'resolved_user_id',
            patients.rows,
        ),
    };
    report.relationships.app = checks;
    for (const [name, values] of Object.entries(checks)) {
        if (values.length) errors.push(`app-supabase.${name}: missing references ${values.join(', ')}`);
    }
}

if (!errors.some((message) => message.startsWith('inci-supabase'))) {
    const [ingredients, terms] = await Promise.all([
        readRows('inci-supabase', 'ingredients'),
        readRows('inci-supabase', 'ingredient_search_terms'),
    ]);
    const missing = missingReferences(terms.rows, 'ingredient_id', ingredients.rows);
    report.relationships.inci = { searchTermsToIngredients: missing };
    if (missing.length) errors.push(`inci-supabase.searchTermsToIngredients: missing references ${missing.join(', ')}`);
}

report.ok = errors.length === 0;
await writeFile(path.join(root, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
