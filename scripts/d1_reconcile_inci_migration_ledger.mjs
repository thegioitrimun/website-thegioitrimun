import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const remote = process.argv.includes('--remote');
const apply = process.argv.includes('--apply');
if (remote && apply && !process.argv.includes('--confirm-remote-ledger')) {
    throw new Error('Remote INCI ledger reconciliation requires --confirm-remote-ledger.');
}
const root = process.cwd();
const config = process.env.D1_WRANGLER_CONFIG || (remote ? '' : 'wrangler.d1.local.jsonc');
const shards = String(process.env.INCI_D1_SHARDS || 'thegioitrimun-inci-shard-00,thegioitrimun-inci-shard-01')
    .split(',').map((value) => value.trim()).filter(Boolean);
if (shards.length !== 2) throw new Error('Exactly two INCI shard databases are required.');
const expectedTables = new Set([
    'schema_migrations', 'ingredients', 'ingredient_aliases', 'ingredient_functions',
    'ingredient_function_links', 'ingredient_skin_effects', 'analyzer_rules',
    'ingredient_search_terms', 'ingredient_source_records', 'ingredient_shard_metadata',
    'ingredient_source_record_chunks',
]);
const migrationDir = path.join(root, 'd1/inci/migrations');
const migrationFiles = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
const migrations = await Promise.all(migrationFiles.map(async (file) => ({
    version: file.replace(/\.sql$/, ''),
    checksum: createHash('sha256').update(await readFile(path.join(migrationDir, file), 'utf8')).digest('hex'),
})));

function wranglerArgs(database, extra) {
    const args = ['wrangler', 'd1', 'execute', database, remote ? '--remote' : '--local'];
    if (config) args.push('--config', config);
    return [...args, ...extra];
}

function run(database, extra, capture = false) {
    const result = spawnSync('npx', wranglerArgs(database, extra), {
        cwd: root,
        encoding: capture ? 'utf8' : undefined,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: process.env,
    });
    if (result.status !== 0) {
        if (capture) process.stderr.write(`${result.stdout || ''}${result.stderr || ''}`);
        throw new Error(`${database}: wrangler failed (${result.status || 1}).`);
    }
    return result.stdout || '';
}

function query(database, sql) {
    const payload = JSON.parse(run(database, [`--command=${sql}`, '--json'], true) || '[]');
    return Array.isArray(payload) ? payload.flatMap((entry) => entry?.results || []) : payload?.results || [];
}

const inspections = [];
for (const shard of shards) {
    const tableRows = query(shard, `SELECT type, name, COALESCE(sql, '') AS sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`);
    const tableNames = new Set(tableRows.map((row) => row.name));
    const missingTables = [...expectedTables].filter((name) => !tableNames.has(name));
    const ingredients = Number(query(shard, 'SELECT COUNT(*) AS count FROM ingredients')[0]?.count || 0);
    const searchTerms = Number(query(shard, 'SELECT COUNT(*) AS count FROM ingredient_search_terms')[0]?.count || 0);
    const foreignKeyErrors = Number(query(shard, 'SELECT COUNT(*) AS count FROM pragma_foreign_key_check')[0]?.count || 0);
    const integrity = remote ? 'verified-on-restored-export' : String(query(shard, 'PRAGMA integrity_check')[0]?.integrity_check || 'unknown');
    const schemaChecksum = createHash('sha256').update(JSON.stringify(tableRows)).digest('hex');
    const columns = query(shard, `SELECT name FROM pragma_table_info('ingredients')`).map((row) => row.name);
    const requiredColumns = ['id', 'inci_name', 'inci_name_norm', 'flags_json', 'source_json', 'created_at', 'updated_at'];
    const missingColumns = requiredColumns.filter((name) => !columns.includes(name));
    const localIntegrityOkay = remote || integrity === 'ok';
    const baseSchemaMatches = missingTables.length === 0 && missingColumns.length === 0
        && ingredients === 6525 && searchTerms >= ingredients && foreignKeyErrors === 0 && localIntegrityOkay;
    inspections.push({ shard, baseSchemaMatches, schemaChecksum, ingredients, searchTerms, foreignKeyErrors, integrity, missingTables, missingColumns });
}

const schemaChecksumsMatch = new Set(inspections.map((row) => row.schemaChecksum)).size === 1;
const report = [];
for (const inspection of inspections) {
    const { shard } = inspection;
    const schemaMatches = inspection.baseSchemaMatches && schemaChecksumsMatch;
    if (!schemaMatches) {
        report.push({ ...inspection, schemaMatches, schemaChecksumsMatch, ledgerUpdated: false });
        continue;
    }
    const existingLedger = query(shard, 'SELECT version, checksum FROM schema_migrations ORDER BY version');
    const checksumMismatch = migrations.find((migration) => {
        const existing = existingLedger.find((row) => row.version === migration.version);
        return existing && existing.checksum !== migration.checksum;
    });
    if (checksumMismatch) {
        report.push({ ...inspection, schemaMatches, schemaChecksumsMatch, ledgerUpdated: false, ledgerMatches: false, checksumMismatch: checksumMismatch.version });
        continue;
    }
    if (apply) {
        const statements = migrations.map((migration) => `INSERT OR IGNORE INTO schema_migrations (version, checksum, applied_at)
          VALUES ('${migration.version}', '${migration.checksum}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`);
        const temp = await mkdtemp(path.join(os.tmpdir(), 'tg-inci-ledger-'));
        try {
            const file = path.join(temp, 'ledger.sql');
            await writeFile(file, `${statements.join('\n')}\n`, 'utf8');
            run(shard, [`--file=${file}`]);
        } finally {
            await rm(temp, { recursive: true, force: true });
        }
    }
    const ledger = query(shard, 'SELECT version, checksum FROM schema_migrations ORDER BY version');
    const ledgerMatches = migrations.every((migration) => ledger.some((row) => row.version === migration.version && row.checksum === migration.checksum));
    report.push({ ...inspection, schemaMatches, schemaChecksumsMatch, ledgerUpdated: apply, ledgerMatches, ledgerRows: ledger.length });
}

const ok = report.every((row) => row.schemaMatches && (!apply || row.ledgerMatches));
process.stdout.write(`${JSON.stringify({ ok, mode: remote ? 'remote' : 'local', apply, migrations, shards: report }, null, 2)}\n`);
if (!ok) process.exitCode = 2;
