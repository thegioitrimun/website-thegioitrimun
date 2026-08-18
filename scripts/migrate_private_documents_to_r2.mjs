import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const confirmed = process.argv.includes('--confirm-remote-copy') || process.env.R2_CONFIRM_REMOTE_COPY === 'yes';
if (!confirmed) throw new Error('Private R2 copy requires --confirm-remote-copy or R2_CONFIRM_REMOTE_COPY=yes.');

const exportDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const sourceFile = path.join(exportDir, 'app-supabase', 'patient_uploaded_documents.jsonl');
const reportFile = path.join(exportDir, 'private-storage-copy-report.json');
const sourceUrl = process.env.APP_SUPABASE_URL || process.env.SUPABASE_URL;
const sourceKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourceBucket = process.env.SUPABASE_PRIVATE_BUCKET || 'patient-documents';
const targetBucket = process.env.PRIVATE_RECORDS_BUCKET_NAME || 'thegioitrimun-private-staging';
const configArgs = process.env.D1_WRANGLER_CONFIG ? ['--config', process.env.D1_WRANGLER_CONFIG] : [];

const rows = (await readFile(sourceFile, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
if (rows.length > 0 && (!sourceUrl || !sourceKey)) {
    throw new Error('APP_SUPABASE_URL and APP_SUPABASE_SERVICE_ROLE_KEY are required when private documents exist.');
}
const supabase = rows.length > 0
    ? createClient(sourceUrl, sourceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tg-private-r2-'));
const copied = [];
const errors = [];

try {
    for (const row of rows) {
        const objectKey = String(row.file_path || row.object_key || '').replace(/^\/+/, '');
        if (!objectKey) { errors.push({ id: row.id, error: 'missing object key' }); continue; }
        try {
            const { data, error } = await supabase.storage.from(sourceBucket).download(objectKey);
            if (error || !data) throw new Error(error?.message || 'download returned no data');
            const bytes = Buffer.from(await data.arrayBuffer());
            const checksum = createHash('sha256').update(bytes).digest('hex');
            if (row.checksum && String(row.checksum).toLowerCase() !== checksum) throw new Error('source checksum mismatch');
            const localFile = path.join(temporaryDirectory, `${createHash('sha256').update(objectKey).digest('hex')}.bin`);
            await writeFile(localFile, bytes);
            const args = ['wrangler', 'r2', 'object', 'put', `${targetBucket}/${objectKey}`, '--remote', '--force', `--file=${localFile}`,
                `--content-type=${row.mime_type || row.content_type || data.type || 'application/octet-stream'}`, ...configArgs];
            const result = spawnSync('npx', args, { cwd: process.cwd(), encoding: 'utf8', env: process.env });
            if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'wrangler upload failed').trim());

            const verifyFile = `${localFile}.verified`;
            const verifyArgs = [
                'wrangler', 'r2', 'object', 'get', `${targetBucket}/${objectKey}`,
                '--remote', `--file=${verifyFile}`, ...configArgs,
            ];
            const verifyResult = spawnSync('npx', verifyArgs, { cwd: process.cwd(), encoding: 'utf8', env: process.env });
            if (verifyResult.status !== 0) {
                throw new Error((verifyResult.stderr || verifyResult.stdout || 'wrangler verification download failed').trim());
            }
            const verifiedBytes = await readFile(verifyFile);
            const verifiedChecksum = createHash('sha256').update(verifiedBytes).digest('hex');
            if (verifiedBytes.length !== bytes.length || verifiedChecksum !== checksum) {
                throw new Error('target R2 checksum or size mismatch');
            }
            copied.push({ id: row.id, objectKey, sizeBytes: bytes.length, checksum, verified: true });
        } catch (error) {
            errors.push({ id: row.id, objectKey, error: error instanceof Error ? error.message : String(error) });
        }
    }
} finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
}

const report = {
    generatedAt: new Date().toISOString(), sourceBucket, targetBucket,
    expected: rows.filter((row) => row.file_path || row.object_key).length,
    copied: copied.length, bytes: copied.reduce((sum, item) => sum + item.sizeBytes, 0),
    verified: copied.filter((item) => item.verified).length,
    ok: errors.length === 0 && copied.length === rows.filter((row) => row.file_path || row.object_key).length,
    objects: copied, errors,
};
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ ...report, objects: undefined }, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
