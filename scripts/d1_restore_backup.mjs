import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import path from 'node:path';

const args = process.argv.slice(2);
const confirmed = args.includes('--confirm-remote-restore');
const keepFilteredFile = args.includes('--keep-filtered-file');
const databaseName = readArg('--database') || process.env.D1_RESTORE_DATABASE_NAME;
const databaseId = readArg('--database-id') || process.env.D1_RESTORE_DATABASE_ID;
const sourceFile = path.resolve(readArg('--file') || process.env.D1_RESTORE_FILE || '');
const expectedSha256 = (readArg('--sha256') || process.env.D1_RESTORE_SHA256 || '').toLowerCase();
const maxStatementBytes = Number(process.env.D1_RESTORE_MAX_STATEMENT_BYTES || 90_000);
const skippedTables = new Set([
    ...readArgs('--skip-table'),
    ...String(process.env.D1_RESTORE_SKIP_TABLES || '').split(','),
].map((value) => value.trim()).filter(Boolean));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!confirmed) throw new Error('Remote restore requires --confirm-remote-restore.');
if (!databaseName || !databaseId || !sourceFile) {
    throw new Error('--database, --database-id and --file are required.');
}
if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
}
if (!Number.isFinite(maxStatementBytes) || maxStatementBytes < 10_000) {
    throw new Error('D1_RESTORE_MAX_STATEMENT_BYTES must be at least 10000.');
}

function readArg(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : '';
}

function readArgs(name) {
    return args.flatMap((value, index) => value === name && args[index + 1] ? [args[index + 1]] : []);
}

function referencedMutationTable(statement) {
    return statement.match(/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+"?([A-Za-z0-9_]+)"?/i)?.[1] || '';
}

async function sha256File(file) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

function parseInsertStatement(statement) {
    const match = statement.match(/^INSERT INTO\s+"([^"]+)"\s+\(([^)]+)\)\s+VALUES\s*\(/i);
    if (!match) throw new Error('Oversized SQL statement is not a supported INSERT statement.');
    const table = match[1];
    const columns = [...match[2].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    const valuesStart = match[0].length;
    const values = [];
    let index = valuesStart;

    while (index < statement.length) {
        while (/\s/.test(statement[index] || '')) index += 1;
        if (statement[index] === ')') break;

        if (statement[index] === "'") {
            index += 1;
            let value = '';
            while (index < statement.length) {
                if (statement[index] !== "'") {
                    value += statement[index];
                    index += 1;
                    continue;
                }
                if (statement[index + 1] === "'") {
                    value += "'";
                    index += 2;
                    continue;
                }
                index += 1;
                break;
            }
            values.push(value);
        } else {
            const tokenStart = index;
            while (index < statement.length && statement[index] !== ',' && statement[index] !== ')') index += 1;
            const token = statement.slice(tokenStart, index).trim();
            values.push(/^null$/i.test(token) ? null : Number.isFinite(Number(token)) ? Number(token) : token);
        }

        while (/\s/.test(statement[index] || '')) index += 1;
        if (statement[index] === ',') index += 1;
    }

    if (!columns.length || columns.length !== values.length) {
        throw new Error(`Cannot parse oversized INSERT for ${table}: ${columns.length} columns, ${values.length} values.`);
    }
    return { table, columns, values };
}

async function writeFilteredImport() {
    const sourceStats = await stat(sourceFile);
    if (!sourceStats.size) throw new Error('Restore source file is empty.');
    const actualSha256 = await sha256File(sourceFile);
    if (expectedSha256 && actualSha256 !== expectedSha256) {
        throw new Error(`Restore checksum mismatch: expected ${expectedSha256}, received ${actualSha256}.`);
    }

    const outputDir = path.resolve('output/d1-restore');
    await mkdir(outputDir, { recursive: true });
    const filteredFile = path.join(outputDir, `${databaseName}-${Date.now()}.sql`);
    const output = createWriteStream(filteredFile, { encoding: 'utf8' });
    const oversized = [];
    let skippedStatements = 0;
    const lines = createInterface({ input: createReadStream(sourceFile, { encoding: 'utf8' }), crlfDelay: Infinity });

    for await (const line of lines) {
        if (skippedTables.has(referencedMutationTable(line))) {
            skippedStatements += 1;
            continue;
        }
        if (Buffer.byteLength(line, 'utf8') > maxStatementBytes) {
            oversized.push(parseInsertStatement(line));
            continue;
        }
        if (!output.write(`${line}\n`)) await once(output, 'drain');
    }
    output.end();
    await once(output, 'finish');
    return { actualSha256, filteredFile, oversized, skippedStatements, sourceBytes: sourceStats.size };
}

function runWranglerImport(filteredFile) {
    const result = spawnSync('npx', [
        'wrangler', 'd1', 'execute', databaseName,
        '--remote', '--file', filteredFile, '--yes',
    ], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) throw new Error(`Wrangler restore failed with exit code ${result.status || 1}.`);
}

async function insertParameterized(record) {
    const quotedColumns = record.columns.map((column) => `"${column.replaceAll('"', '""')}"`).join(',');
    const placeholders = record.values.map(() => '?').join(',');
    const sql = `INSERT INTO "${record.table.replaceAll('"', '""')}" (${quotedColumns}) VALUES (${placeholders})`;
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params: record.values }),
        },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
        const detail = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
        throw new Error(`Parameterized restore failed for ${record.table}: ${detail}`);
    }
}

const prepared = await writeFilteredImport();
try {
    runWranglerImport(prepared.filteredFile);
    for (const record of prepared.oversized) await insertParameterized(record);
} finally {
    if (!keepFilteredFile) await rm(prepared.filteredFile, { force: true });
}

process.stdout.write(`${JSON.stringify({
    ok: true,
    databaseName,
    databaseId,
    sourceFile,
    sourceBytes: prepared.sourceBytes,
    sourceSha256: prepared.actualSha256,
    skippedTables: [...skippedTables],
    skippedStatements: prepared.skippedStatements,
    oversizedStatementsRestored: prepared.oversized.length,
}, null, 2)}\n`);
