import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const root = process.cwd();
const local = process.argv.includes('--local');
const dryRun = process.argv.includes('--dry-run');
const confirmed = process.argv.includes('--confirm-remote-backup');
const mode = local ? '--local' : '--remote';
const config = process.env.D1_WRANGLER_CONFIG || (local ? 'wrangler.d1.local.jsonc' : 'wrangler.d1.production.jsonc');
const bucket = String(process.env.D1_BACKUP_BUCKET || '').trim();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dayPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
const objectPrefix = String(process.env.D1_BACKUP_PREFIX || `d1-backups/${dayPrefix}/${timestamp}`).replace(/^\/+|\/+$/g, '');
const outputDir = path.resolve(process.env.D1_BACKUP_OUTPUT_DIR || `output/d1-backups/${timestamp}`);
const maxR2PartBytes = Number(process.env.D1_BACKUP_PART_BYTES || 250 * 1024 * 1024);
const reuseExports = String(process.env.D1_BACKUP_REUSE_EXPORTS || '').toLowerCase() === 'yes';
const databases = [
    { key: 'app', name: process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app' },
    { key: 'inci', name: process.env.INCI_D1_DATABASE_NAME || 'thegioitrimun-inci-runtime' },
];

if (!local && !confirmed && process.env.D1_CONFIRM_REMOTE_BACKUP !== 'yes') {
    throw new Error('Remote backup requires --confirm-remote-backup or D1_CONFIRM_REMOTE_BACKUP=yes.');
}
if (!dryRun && !bucket) throw new Error('D1_BACKUP_BUCKET is required unless --dry-run is used.');

function run(args) {
    const result = spawnSync('npx', ['wrangler', ...args], { cwd: root, stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
}

async function sha256File(file) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

async function upload(file, key, contentType) {
    if (dryRun) return;
    run([
        'r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--config', config,
        '--file', file, '--content-type', contentType, '--force',
    ]);
}

async function splitForUpload(file, baseName, sizeBytes) {
    if (sizeBytes <= maxR2PartBytes) {
        return [{ file, name: baseName, bytes: sizeBytes, sha256: await sha256File(file) }];
    }

    const partCount = Math.ceil(sizeBytes / maxR2PartBytes);
    const parts = [];
    for (let index = 0; index < partCount; index += 1) {
        const start = index * maxR2PartBytes;
        const end = Math.min(sizeBytes, start + maxR2PartBytes) - 1;
        const suffix = String(index + 1).padStart(4, '0');
        const name = `${baseName}.part-${suffix}-of-${String(partCount).padStart(4, '0')}`;
        const partFile = path.join(outputDir, name);
        await pipeline(createReadStream(file, { start, end }), createWriteStream(partFile));
        const partStats = await stat(partFile);
        parts.push({
            file: partFile,
            name,
            bytes: partStats.size,
            sha256: await sha256File(partFile),
        });
    }
    return parts;
}

await mkdir(outputDir, { recursive: true });
const entries = [];
for (const database of databases) {
    const file = path.join(outputDir, `${database.key}.sql`);
    let fileStats = null;
    if (reuseExports) {
        try {
            fileStats = await stat(file);
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    if (!fileStats?.size) {
        run([
            'd1', 'export', database.name, mode, '--config', config,
            '--output', file, '--skip-confirmation',
        ]);
        fileStats = await stat(file);
    }
    if (!fileStats.size) throw new Error(`${database.name} export is empty.`);
    const entry = {
        database: database.name,
        file: path.basename(file),
        bytes: fileStats.size,
        sha256: await sha256File(file),
    };
    const uploadParts = await splitForUpload(file, path.basename(file), fileStats.size);
    entry.parts = uploadParts.map((part) => ({
        file: part.name,
        bytes: part.bytes,
        sha256: part.sha256,
        objectKey: `${objectPrefix}/${part.name}`,
    }));
    if (entry.parts.length === 1) entry.objectKey = entry.parts[0].objectKey;
    entries.push(entry);
    for (const part of uploadParts) {
        await upload(part.file, `${objectPrefix}/${part.name}`, 'application/sql');
    }
}

const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: local ? 'local' : 'remote',
    config,
    bucket: dryRun ? null : bucket,
    objectPrefix,
    entries,
};
const manifestFile = path.join(outputDir, 'manifest.json');
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await upload(manifestFile, `${objectPrefix}/manifest.json`, 'application/json');
process.stdout.write(`${JSON.stringify({ ok: true, dryRun, outputDir, ...manifest }, null, 2)}\n`);
