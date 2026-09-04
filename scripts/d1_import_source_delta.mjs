import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const remote = process.argv.includes('--remote');
if (remote && !process.argv.includes('--confirm-remote-import')) {
    throw new Error('Remote delta import requires --confirm-remote-import.');
}
const root = process.cwd();
const sourceDir = path.resolve(process.env.D1_SOURCE_EXPORT_DIR || 'output/d1-migration/app-supabase');
const database = process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app';
const config = process.env.D1_WRANGLER_CONFIG || (remote ? '' : 'wrangler.d1.local.jsonc');
const mode = remote ? '--remote' : '--local';

function args(extra) {
    const value = ['wrangler', 'd1', 'execute', database, mode];
    if (config) value.push('--config', config);
    return [...value, ...extra];
}

function run(extra, capture = false) {
    const result = spawnSync('npx', args(extra), {
        cwd: root,
        encoding: capture ? 'utf8' : undefined,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        env: process.env,
    });
    if (result.status !== 0) {
        if (capture) process.stderr.write(`${result.stdout || ''}${result.stderr || ''}`);
        process.exit(result.status || 1);
    }
    return result.stdout || '';
}

function query(sql) {
    const payload = JSON.parse(run([`--command=${sql}`, '--json'], true) || '[]');
    return Array.isArray(payload) ? payload.flatMap((entry) => entry?.results || []) : payload?.results || [];
}

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    }
    return value;
}

function hashRow(row) {
    return createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');
}

function literal(value) {
    if (value == null) return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replaceAll("'", "''")}'`;
}

function flag(value, fallback = false) {
    if (value === undefined || value === null) return fallback ? 1 : 0;
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
    return Math.round(number(value, fallback));
}

function json(value, fallback) {
    if (value === undefined || value === null || value === '') return JSON.stringify(fallback);
    if (typeof value !== 'string') return JSON.stringify(value);
    try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
}

function insertRecord(table, record) {
    const entries = Object.entries(record).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => `"${key}"`).join(', ');
    return `INSERT INTO ${table} (${columns}) VALUES (${entries.map(([, value]) => literal(value)).join(', ')});`;
}

async function sourceRows(table) {
    try {
        const content = await readFile(path.join(sourceDir, `${table}.jsonl`), 'utf8');
        return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
        if (error?.code === 'ENOENT') throw new Error(`Missing source export: ${table}.jsonl`);
        throw error;
    }
}

const definitions = [
    {
        source: 'catalog_seo_events', target: 'catalog_seo_events', hasSourceHash: true, id: (row) => String(row.id),
        insert: (row, hash) => `INSERT INTO catalog_seo_events (id, entity_type, entity_id, action, source_table, product_id, payload_json, created_at, processed_at, source_hash) VALUES (${literal(Number(row.id))}, ${literal(row.entity_type)}, ${literal(row.entity_id)}, ${literal(row.action)}, ${literal(row.source_table)}, ${literal(row.product_id == null ? null : Number(row.product_id))}, ${literal(JSON.stringify(row.payload || {}))}, ${literal(row.created_at)}, ${literal(row.processed_at)}, ${literal(hash)});`,
    },
    {
        source: 'product_ingredient_sync_events', target: 'product_ingredient_sync_events', hasSourceHash: true, id: (row) => String(row.id),
        insert: (row, hash) => `INSERT INTO product_ingredient_sync_events (id, product_id, action, source_updated_at, created_at, processed_at, attempt_count, last_error, source_hash) VALUES (${literal(Number(row.id))}, ${literal(Number(row.product_id))}, ${literal(row.action)}, ${literal(row.source_updated_at)}, ${literal(row.created_at)}, ${literal(row.processed_at)}, ${literal(Number(row.attempt_count || 0))}, ${literal(row.last_error)}, ${literal(hash)});`,
    },
    {
        source: 'product_generation_jobs', target: 'product_generation_jobs', hasSourceHash: true, id: (row) => String(row.id),
        insert: (row, hash) => `INSERT INTO product_generation_jobs (id, input_name, normalized_slug, status, generated_payload_json, validation_warnings_json, model, product_id, created_by, approved_by, approved_at, created_at, updated_at, source_hash) VALUES (${literal(row.id)}, ${literal(row.input_name)}, ${literal(row.normalized_slug)}, ${literal(row.status)}, ${literal(JSON.stringify(row.generated_payload || {}))}, ${literal(JSON.stringify(row.validation_warnings || []))}, ${literal(row.model)}, ${literal(row.product_id == null ? null : Number(row.product_id))}, NULL, NULL, ${literal(row.approved_at)}, ${literal(row.created_at)}, ${literal(row.updated_at)}, ${literal(hash)});`,
    },
    {
        source: 'admin_report_schedules', target: 'admin_report_schedules', id: (row) => String(row.id),
        insert: (row) => insertRecord('admin_report_schedules', {
            id: String(row.id), name: row.name, preset: row.preset || '30d', frequency: row.frequency || 'daily',
            day_of_week: row.day_of_week == null ? null : integer(row.day_of_week), hour_local: integer(row.hour_local, 8),
            minute_local: integer(row.minute_local), timezone: row.timezone || 'Asia/Ho_Chi_Minh',
            recipients_json: json(row.recipients, []), enabled: flag(row.enabled, true), next_run_at: row.next_run_at,
            last_sent_at: row.last_sent_at, last_error_at: row.last_error_at, last_error_message: row.last_error_message,
            created_by: null, updated_by: null, created_at: row.created_at, updated_at: row.updated_at || row.created_at,
        }),
    },
    {
        source: 'discount_codes', target: 'discount_codes', id: (row) => String(row.id),
        naturalColumns: ['code'], naturalKey: (row) => String(row.code || '').trim().toLowerCase(),
        insert: (row) => insertRecord('discount_codes', {
            id: String(row.id), code: row.code,
            type: ['fixed', 'amount'].includes(String(row.type || '').toLowerCase()) ? 'fixed_amount' : (row.type || 'percentage'),
            value: number(row.value), min_purchase_amount: Math.max(0, integer(row.min_purchase_amount)),
            max_discount_amount: row.max_discount_amount == null ? null : Math.max(0, integer(row.max_discount_amount)),
            starts_at: row.starts_at, ends_at: row.ends_at, usage_limit: row.usage_limit == null ? null : integer(row.usage_limit),
            usage_limit_per_user: row.usage_limit_per_user == null ? null : integer(row.usage_limit_per_user),
            usage_count: Math.max(0, integer(row.usage_count)), is_active: flag(row.is_active, true),
            created_at: row.created_at, updated_at: row.updated_at || row.created_at, description: row.description,
        }),
    },
    {
        source: 'funnel_events', target: 'funnel_events', id: (row) => String(row.id),
        insert: (row) => insertRecord('funnel_events', {
            id: String(row.id), event_name: String(row.event_name || 'legacy.unknown').slice(0, 80),
            user_id: row.user_id == null ? null : String(row.user_id), session_id: String(row.session_id || `legacy-${row.id}`).slice(0, 128),
            path: row.path ? String(row.path).slice(0, 512) : null, metadata_json: json(row.metadata, {}), created_at: row.created_at,
        }),
    },
    {
        source: 'products', target: 'products', id: (row) => String(row.id),
        naturalColumns: ['slug'], naturalKey: (row) => String(row.slug || '').trim().toLowerCase(),
        insert: (row) => insertRecord('products', {
            id: integer(row.id), slug: row.slug, sku: row.sku, category_id: row.category_id == null ? null : integer(row.category_id),
            brand: row.brand, name: row.name, name_en: row.name_en, name_ru: row.name_ru, name_cn: row.name_cn,
            description: row.description, description_en: row.description_en, description_ru: row.description_ru, description_cn: row.description_cn,
            long_description: json(row.long_description, []), long_description_en: json(row.long_description_en, []),
            long_description_ru: json(row.long_description_ru, []), long_description_cn: json(row.long_description_cn, []),
            usage_instructions: row.usage_instructions, usage_instructions_en: row.usage_instructions_en,
            usage_instructions_ru: row.usage_instructions_ru, usage_instructions_cn: row.usage_instructions_cn,
            ingredients: row.ingredients, ingredients_en: row.ingredients_en, ingredients_ru: row.ingredients_ru, ingredients_cn: row.ingredients_cn,
            inci_text: row.inci_text || row.ingredients, key_benefits_json: json(row.key_benefits, []),
            key_benefits_en_json: json(row.key_benefits_en, []), key_benefits_ru_json: json(row.key_benefits_ru, []),
            key_benefits_cn_json: json(row.key_benefits_cn, []), skin_types_json: json(row.skin_types, []), faq_items_json: json(row.faq_items, []),
            precautions: row.precautions, precautions_en: row.precautions_en, precautions_ru: row.precautions_ru, precautions_cn: row.precautions_cn,
            price: Math.max(0, integer(row.price)), vat_rate: Math.max(0, number(row.vat_rate)), stock_quantity: Math.max(0, integer(row.stock_quantity)),
            low_stock_threshold: Math.max(0, integer(row.low_stock_threshold)), volume: row.volume, origin: row.origin, origin_en: row.origin_en,
            origin_ru: row.origin_ru, origin_cn: row.origin_cn, texture: row.texture, texture_en: row.texture_en, texture_ru: row.texture_ru,
            texture_cn: row.texture_cn, expiry_date: row.expiry_date, sold_count: Math.max(0, integer(row.sold_count)),
            is_published: flag(row.is_published), is_featured: flag(row.is_featured), archived_at: row.archived_at,
            source_updated_at: row.updated_at, created_at: row.created_at, updated_at: row.updated_at || row.created_at,
        }),
    },
    {
        source: 'product_images', target: 'product_images', id: (row) => String(row.id),
        naturalColumns: ['product_id', 'image_path'],
        naturalKey: (row) => `${String(row.product_id)}\u0000${String(row.image_path || row.image_url || '')}`,
        insert: (row) => insertRecord('product_images', {
            id: String(row.id), product_id: integer(row.product_id), image_path: row.image_path || row.image_url,
            alt_text: row.alt_text, is_primary: flag(row.is_primary), display_order: integer(row.display_order),
            created_at: row.created_at, updated_at: row.updated_at || row.created_at,
        }),
    },
];

const zeroRowSchemaMappings = [
    ['contact_page_content', 'site_content'], ['testimonials', 'site_content'],
    ['discount_code_usages', 'discount_redemptions'], ['invoices', 'clinic_invoices'],
    ['performed_services', 'clinic_performed_services'], ['prescribed_medications', 'clinic_prescribed_medications'],
];

const statements = ['PRAGMA foreign_keys = ON;'];
const report = [];
let conflictCount = 0;
for (const definition of definitions) {
    const rows = await sourceRows(definition.source);
    const selectedColumns = [
        'id',
        ...(definition.hasSourceHash ? ['source_hash'] : []),
        ...(definition.naturalColumns || []),
    ];
    const targetRows = query(`SELECT ${[...new Set(selectedColumns)].join(', ')} FROM ${definition.target}`);
    const existing = new Map(targetRows.map((row) => [String(row.id), definition.hasSourceHash ? String(row.source_hash || '') : null]));
    const existingByNaturalKey = definition.naturalKey
        ? new Map(targetRows.map((row) => [definition.naturalKey(row), String(row.id)]))
        : new Map();
    let inserted = 0;
    let skipped = 0;
    let naturalKeyMatched = 0;
    let conflicts = 0;
    for (const row of rows) {
        const id = definition.id(row);
        const hash = hashRow(row);
        if (!existing.has(id) && definition.naturalKey && existingByNaturalKey.has(definition.naturalKey(row))) {
            skipped += 1;
            naturalKeyMatched += 1;
        } else if (!existing.has(id)) {
            statements.push(definition.insert(row, hash));
            inserted += 1;
        } else if (!definition.hasSourceHash || existing.get(id) === hash) {
            skipped += 1;
        } else {
            const now = new Date().toISOString();
            statements.push(`INSERT INTO migration_issues (id, source_system, entity_type, entity_id, issue_code, details_json, resolution_status, created_at, updated_at) VALUES (${literal(crypto.randomUUID())}, 'supabase', ${literal(definition.source)}, ${literal(id)}, 'SOURCE_TARGET_CHECKSUM_MISMATCH', ${literal(JSON.stringify({ sourceHash: hash, targetHash: existing.get(id) }))}, 'open', ${literal(now)}, ${literal(now)}) ON CONFLICT(source_system, entity_type, entity_id, issue_code) DO UPDATE SET details_json = excluded.details_json, resolution_status = 'open', updated_at = excluded.updated_at;`);
            conflicts += 1;
            conflictCount += 1;
        }
    }
    const manifestChecksum = createHash('sha256').update(rows.map((row) => JSON.stringify(canonical(row))).join('\n')).digest('hex');
    const transformRule = definition.naturalKey
        ? `insert-only delta; preserve D1 row matched by ${definition.naturalColumns.join('+')}`
        : 'insert-only delta with source_hash';
    statements.push(`INSERT INTO source_migration_manifest (source_table, target_kind, target_name, primary_key_json, transform_rule, source_row_count, imported_row_count, skipped_row_count, conflict_row_count, source_checksum, verified_at, updated_at) VALUES (${literal(definition.source)}, 'table', ${literal(definition.target)}, '["id"]', ${literal(transformRule)}, ${rows.length}, ${inserted}, ${skipped}, ${conflicts}, ${literal(manifestChecksum)}, ${conflicts ? 'NULL' : literal(new Date().toISOString())}, ${literal(new Date().toISOString())}) ON CONFLICT(source_table) DO UPDATE SET source_row_count = excluded.source_row_count, imported_row_count = source_migration_manifest.imported_row_count + excluded.imported_row_count, skipped_row_count = excluded.skipped_row_count, conflict_row_count = excluded.conflict_row_count, source_checksum = excluded.source_checksum, verified_at = excluded.verified_at, updated_at = excluded.updated_at;`);
    report.push({ source: definition.source, target: definition.target, sourceRows: rows.length, inserted, skipped, naturalKeyMatched, conflicts });
}

for (const [source, target] of zeroRowSchemaMappings) {
    const rows = await sourceRows(source);
    if (rows.length) throw new Error(`${source} now contains ${rows.length} rows; add an explicit lossless transformer before cutover.`);
    statements.push(`INSERT INTO source_migration_manifest (source_table, target_kind, target_name, primary_key_json, transform_rule, source_row_count, imported_row_count, skipped_row_count, conflict_row_count, source_checksum, verified_at, updated_at) VALUES (${literal(source)}, ${target === 'site_content' ? "'site_content'" : target.startsWith('clinic_') ? "'vat_model'" : "'table'"}, ${literal(target)}, '["id"]', 'schema ready; source empty at migration snapshot', 0, 0, 0, 0, ${literal(createHash('sha256').update('').digest('hex'))}, ${literal(new Date().toISOString())}, ${literal(new Date().toISOString())}) ON CONFLICT(source_table) DO UPDATE SET source_row_count = 0, conflict_row_count = 0, verified_at = excluded.verified_at, updated_at = excluded.updated_at;`);
    report.push({ source, target, sourceRows: 0, inserted: 0, skipped: 0, conflicts: 0 });
}

const temp = await mkdtemp(path.join(os.tmpdir(), 'tg-d1-source-delta-'));
try {
    const sqlFile = path.join(temp, 'delta.sql');
    await writeFile(sqlFile, `${statements.join('\n')}\n`, 'utf8');
    run([`--file=${sqlFile}`]);
} finally {
    await rm(temp, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({ ok: conflictCount === 0, mode: remote ? 'remote' : 'local', database, report }, null, 2)}\n`);
if (conflictCount) process.exitCode = 2;
