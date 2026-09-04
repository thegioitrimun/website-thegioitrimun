import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const config = process.env.D1_WRANGLER_CONFIG || 'wrangler.d1.production.jsonc';
const temp = await mkdtemp(path.join(os.tmpdir(), 'tg-d1-worker-audit-'));
const forbidden = [
    ['Supabase hostname', /\.supabase\.co/i],
    ['Supabase service credential', /SUPABASE_(?:SERVICE_ROLE|SECRET|ANON|PUBLISHABLE)_KEY/],
    ['Supabase URL binding', /(?:VITE_)?SUPABASE_URL/],
    ['PostgREST network path', /\/rest\/v1\//],
    ['Supabase Auth network path', /\/auth\/v1\//],
];

async function filesBelow(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const output = [];
    for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) output.push(...await filesBelow(absolute));
        else output.push(absolute);
    }
    return output;
}

try {
    const result = spawnSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', temp, '--config', config], {
        cwd: root,
        encoding: 'utf8',
        env: process.env,
    });
    if (result.status !== 0) {
        process.stderr.write(`${result.stdout || ''}${result.stderr || ''}`);
        throw new Error(`Wrangler dry-run failed (${result.status || 1}).`);
    }
    const bundleFiles = (await filesBelow(temp)).filter((file) => /\.(?:js|mjs|cjs)$/i.test(file));
    if (!bundleFiles.length) throw new Error('Wrangler dry-run did not produce a JavaScript bundle.');
    const findings = [];
    for (const file of bundleFiles) {
        const source = await readFile(file, 'utf8');
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) findings.push({ file: path.relative(temp, file), label });
        }
    }
    if (findings.length) {
        process.stderr.write(`${JSON.stringify({ ok: false, config, findings }, null, 2)}\n`);
        process.exitCode = 2;
    } else {
        process.stdout.write(`${JSON.stringify({ ok: true, config, bundleFiles: bundleFiles.map((file) => path.relative(temp, file)) }, null, 2)}\n`);
    }
} finally {
    await rm(temp, { recursive: true, force: true });
}
