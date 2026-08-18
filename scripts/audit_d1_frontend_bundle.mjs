import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { existsSync } from 'node:fs';

const rawDist = path.resolve(process.env.D1_FRONTEND_DIST || 'dist');
const dist = existsSync(path.join(rawDist, 'client', 'assets')) ? path.join(rawDist, 'client') : rawDist;
const assets = path.join(dist, 'assets');
const files = (await readdir(assets)).filter((file) => /\.(?:js|mjs)$/i.test(file));
const findings = [];
const forbidden = [
    { label: 'Supabase hostname', pattern: /\.supabase\.co/i },
    { label: 'Supabase SDK package', pattern: /@supabase\/supabase-js/i },
    { label: 'Supabase auth client', pattern: /GoTrueClient|SupabaseClient/i },
    { label: 'Resend API', pattern: /api\.resend\.com|RESEND_API_KEY/i },
    { label: 'Legacy transactional email function', pattern: /order-email-notification|appointment-email-notification|admin-scheduled-report/i },
];

for (const file of files) {
    if (/vendor-supabase/i.test(file)) findings.push(`${file}: Supabase vendor chunk exists`);
    const source = await readFile(path.join(assets, file), 'utf8');
    for (const rule of forbidden) {
        if (rule.pattern.test(source)) findings.push(`${file}: ${rule.label}`);
    }
}

const html = await readFile(path.join(dist, 'index.html'), 'utf8');
if (/\.supabase\.co/i.test(html)) findings.push('index.html: Supabase hostname');

const report = { generatedAt: new Date().toISOString(), ok: findings.length === 0, files: files.length, findings };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
