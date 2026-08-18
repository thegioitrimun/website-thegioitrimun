import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

const remote = process.argv.includes('--remote');
const confirmed = process.argv.includes('--confirm-remote-import');
const root = process.cwd();
const importDir = path.resolve(process.env.D1_IMPORT_DIR || 'output/d1-migration/sql');
const wranglerConfig = process.env.D1_WRANGLER_CONFIG || (!remote ? 'wrangler.d1.local.jsonc' : '');
const configArgs = wranglerConfig ? ['--config', wranglerConfig] : [];
const MAX_IMPORT_BYTES = 5 * 1024 * 1024 * 1024;
const databases = [
    { database: process.env.APP_D1_DATABASE_NAME || 'thegioitrimun-app', file: 'app-import.sql' },
    { database: process.env.INCI_D1_DATABASE_NAME || 'thegioitrimun-inci-runtime', file: 'inci-import.sql' },
];

if (remote && !confirmed && process.env.D1_CONFIRM_REMOTE_IMPORT !== 'yes') {
    throw new Error('Remote import requires --confirm-remote-import or D1_CONFIRM_REMOTE_IMPORT=yes.');
}

async function inspectImport(file) {
    const checksum = createHash('sha256');
    const decoder = new StringDecoder('utf8');
    const forbidden = /(?:^|\n)\s*(?:BEGIN(?:\s+(?:TRANSACTION|IMMEDIATE|EXCLUSIVE))?|COMMIT)\s*;/i;
    let tail = '';
    let hasExplicitTransaction = false;
    for await (const chunk of createReadStream(file)) {
        checksum.update(chunk);
        const text = tail + decoder.write(chunk);
        if (forbidden.test(text)) hasExplicitTransaction = true;
        tail = text.slice(-256);
    }
    const finalText = tail + decoder.end();
    if (forbidden.test(finalText)) hasExplicitTransaction = true;
    return { checksum: checksum.digest('hex'), hasExplicitTransaction };
}

for (const target of databases) {
    const file = path.join(importDir, target.file);
    const metadata = await stat(file);
    if (metadata.size > MAX_IMPORT_BYTES) {
        throw new Error(`${target.file} is larger than the D1 5 GiB import-file limit.`);
    }
    const inspection = await inspectImport(file);
    if (inspection.hasExplicitTransaction) {
        throw new Error(`${target.file} contains BEGIN/COMMIT, which is not accepted by the remote D1 importer.`);
    }
    const expectedChecksumFile = path.join(importDir, target.file.replace(/\.sql$/, '.sha256'));
    const expected = String(await readFile(expectedChecksumFile, 'utf8')).trim().split(/\s+/)[0];
    const actual = inspection.checksum;
    if (!expected || expected !== actual) throw new Error(`${target.file} checksum does not match.`);

    const args = [
        'wrangler', 'd1', 'execute', target.database,
        remote ? '--remote' : '--local',
        ...configArgs,
        `--file=${file}`,
    ];
    process.stdout.write(`${remote ? 'REMOTE' : 'LOCAL'} import ${target.file} -> ${target.database}\n`);
    const result = spawnSync('npx', args, { cwd: root, stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
}
