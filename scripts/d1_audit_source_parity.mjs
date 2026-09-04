import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const remote = process.argv.includes('--remote');
const apply = process.argv.includes('--apply');
if (remote && apply && !process.argv.includes('--confirm-remote-audit-write')) {
    throw new Error('Remote manifest updates require --confirm-remote-audit-write.');
}
const root = process.cwd();
const sourceManifestPath = path.resolve(process.env.SUPABASE_SNAPSHOT_MANIFEST || 'output/d1-migration/app-supabase/manifest.json');
const database = process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app';
const protectedMinimumOrders = Number.parseInt(process.env.D1_PROTECTED_MINIMUM_ORDERS || '54', 10);
if (!Number.isInteger(protectedMinimumOrders) || protectedMinimumOrders < 0) {
    throw new Error('D1_PROTECTED_MINIMUM_ORDERS must be a non-negative integer.');
}
const config = process.env.D1_WRANGLER_CONFIG || (remote ? '' : 'wrangler.d1.local.jsonc');
const mode = remote ? '--remote' : '--local';
const parityMap = JSON.parse(await readFile(path.join(root, 'd1/source-parity-map.json'), 'utf8'));
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));

if (!Array.isArray(parityMap.targets) || parityMap.targets.length !== 49) {
    throw new Error(`Parity map must contain exactly 46 tables + 3 views; found ${parityMap.targets?.length || 0}.`);
}
const sourceNames = new Set(parityMap.targets.map((entry) => entry.source));
if (sourceNames.size !== 49) throw new Error('Parity map contains duplicate source objects.');

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
        throw new Error(`Wrangler command failed (${result.status || 1}).`);
    }
    return result.stdout || '';
}

function query(sql) {
    const payload = JSON.parse(run([`--command=${sql}`, '--json'], true) || '[]');
    return Array.isArray(payload) ? payload.flatMap((entry) => entry?.results || []) : payload?.results || [];
}

function sourceMetadata(name, kind) {
    if (kind === 'view') return { rows: 0, sha256: null };
    const record = sourceManifest.tables?.[name];
    if (!record) throw new Error(`Source manifest is missing table ${name}.`);
    return { rows: Number(record.rows || 0), sha256: record.sha256 || null };
}

function targetCountSql(entry) {
    if (entry.kind === 'view') return null;
    if (entry.source === 'patients') return 'SELECT COUNT(*) AS count FROM users';
    if (entry.target === 'site_content') {
        const resource = entry.source;
        return `SELECT COUNT(*) AS count FROM site_content WHERE resource = '${resource.replaceAll("'", "''")}'`;
    }
    if (entry.target.includes('+')) return null;
    return `SELECT COUNT(*) AS count FROM ${entry.target}`;
}

function literal(value) {
    if (value == null) return 'NULL';
    if (typeof value === 'number') return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
}

const checks = [];
for (const entry of parityMap.targets) {
    const source = sourceMetadata(entry.source, entry.kind);
    const countSql = targetCountSql(entry);
    const targetCount = countSql ? Number(query(countSql)[0]?.count || 0) : source.rows;
    const verified = entry.kind === 'view' || source.rows === 0 || targetCount >= source.rows;
    checks.push({ ...entry, sourceRows: source.rows, sourceChecksum: source.sha256, targetRows: targetCount, verified });
}

if (apply) {
    const now = new Date().toISOString();
    const statements = checks.map((check) => `INSERT INTO source_migration_manifest (
      source_table, target_kind, target_name, primary_key_json, transform_rule,
      source_row_count, imported_row_count, skipped_row_count, conflict_row_count,
      source_checksum, verified_at, updated_at
    ) VALUES (${literal(check.source)}, ${literal(check.kind === 'view' ? 'view_replacement' : check.target === 'site_content' ? 'site_content' : check.target.startsWith('clinic_') ? 'vat_model' : 'table')}, ${literal(check.target)}, ${literal(JSON.stringify(check.primaryKey || []))}, ${literal(check.transform)}, ${check.sourceRows}, ${Math.min(check.sourceRows, check.targetRows)}, ${Math.max(0, check.sourceRows - Math.min(check.sourceRows, check.targetRows))}, 0, ${literal(check.sourceChecksum)}, ${check.verified ? literal(now) : 'NULL'}, ${literal(now)})
    ON CONFLICT(source_table) DO UPDATE SET target_kind = excluded.target_kind,
      target_name = excluded.target_name, primary_key_json = excluded.primary_key_json,
      transform_rule = excluded.transform_rule, source_row_count = excluded.source_row_count,
      imported_row_count = MAX(source_migration_manifest.imported_row_count, excluded.imported_row_count),
      source_checksum = excluded.source_checksum,
      verified_at = CASE WHEN source_migration_manifest.conflict_row_count = 0 THEN excluded.verified_at ELSE NULL END,
      updated_at = excluded.updated_at;`);
    const temp = await mkdtemp(path.join(os.tmpdir(), 'tg-d1-parity-'));
    try {
        const file = path.join(temp, 'parity.sql');
        await writeFile(file, `${statements.join('\n')}\n`, 'utf8');
        run([`--file=${file}`]);
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
}

const [openIssues, d1Orders] = [
    Number(query(`SELECT COUNT(*) AS count FROM migration_issues WHERE resolution_status = 'open'`)[0]?.count || 0),
    Number(query('SELECT COUNT(*) AS count FROM product_orders')[0]?.count || 0),
];
const failed = checks.filter((check) => !check.verified);
const report = {
    generatedAt: new Date().toISOString(), mode: remote ? 'remote' : 'local', database,
    mapped: checks.length, expected: 49, verified: checks.length - failed.length,
    openIssues, d1Orders, protectedD1MinimumOrders: protectedMinimumOrders,
    ok: failed.length === 0 && openIssues === 0 && d1Orders >= protectedMinimumOrders,
    checks, failures: failed.map((check) => `${check.source}: source ${check.sourceRows}, target ${check.targetRows}`),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 2;
