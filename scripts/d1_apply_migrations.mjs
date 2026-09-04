import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const remote = process.argv.includes('--remote');
const root = process.cwd();
const wranglerConfig = process.env.D1_WRANGLER_CONFIG || (!remote ? 'wrangler.d1.local.jsonc' : '');
const target = String(process.env.D1_MIGRATION_TARGET || 'all').toLowerCase();
const onlyVersion = String(process.env.D1_MIGRATION_ONLY || '').trim();
const inciNames = String(process.env.INCI_D1_DATABASE_NAMES || process.env.INCI_D1_DATABASE_NAME || 'thegioitrimun-inci-runtime')
    .split(',').map((value) => value.trim()).filter(Boolean);
const databases = [
    { name: process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app', dir: 'd1/app/migrations' },
    ...inciNames.map((name) => ({ name, dir: 'd1/inci/migrations' })),
].filter((database) => target === 'all' || (target === 'app' ? database.dir.includes('/app/') : database.dir.includes('/inci/')));

function wranglerArgs(database, mode, operationArgs) {
    const args = ['wrangler', 'd1', 'execute', database, mode];
    if (wranglerConfig) args.push('--config', wranglerConfig);
    return [...args, ...operationArgs];
}

function runWrangler(database, operationArgs, { capture = false, allowFailure = false } = {}) {
    const mode = remote ? '--remote' : '--local';
    const result = spawnSync('npx', wranglerArgs(database, mode, operationArgs), {
        cwd: root,
        encoding: capture ? 'utf8' : undefined,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        env: process.env,
    });
    if (result.status !== 0 && !allowFailure) {
        if (capture) {
            process.stderr.write(result.stdout || '');
            process.stderr.write(result.stderr || '');
        }
        process.exit(result.status || 1);
    }
    return result;
}

function parseWranglerRows(output) {
    try {
        const payload = JSON.parse(output || '[]');
        if (Array.isArray(payload)) return payload.flatMap((entry) => entry?.results || []);
        return payload?.results || [];
    } catch {
        return [];
    }
}

function getAppliedMigration(database, version) {
    const escapedVersion = version.replaceAll("'", "''");
    const result = runWrangler(database, [
        `--command=SELECT version, checksum FROM schema_migrations WHERE version = '${escapedVersion}' LIMIT 1`,
        '--json',
    ], { capture: true, allowFailure: true });
    if (result.status !== 0) return null;
    return parseWranglerRows(result.stdout)[0] || null;
}

for (const database of databases) {
    const directory = path.join(root, database.dir);
    const files = (await readdir(directory))
        .filter((file) => file.endsWith('.sql') && (!onlyVersion || file.replace(/\.sql$/, '') === onlyVersion))
        .sort();
    if (onlyVersion && files.length !== 1) throw new Error(`${database.name}: migration ${onlyVersion} was not found in ${database.dir}.`);
    for (const file of files) {
        const absolute = path.join(directory, file);
        const sql = await readFile(absolute, 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        const version = file.replace(/\.sql$/, '');
        const applied = getAppliedMigration(database.name, version);
        if (applied) {
            if (applied.checksum !== checksum) {
                throw new Error(`${database.name}.${version} checksum changed after it was applied.`);
            }
            process.stdout.write(`${database.name}.${version}: already applied\n`);
            continue;
        }

        const record = `INSERT OR REPLACE INTO schema_migrations(version, checksum, applied_at) VALUES ('${version.replaceAll("'", "''")}', '${checksum}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`;
        const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tg-d1-migration-'));
        const combinedFile = path.join(temporaryDirectory, file);
        try {
            await writeFile(combinedFile, `${sql.trim()}\n${record}\n`, 'utf8');
            runWrangler(database.name, [`--file=${combinedFile}`]);
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
        process.stdout.write(`${database.name}.${version}: applied\n`);
    }
}
