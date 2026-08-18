#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PROJECT_REF = process.env.TARGET_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const MGMT_TOKEN =
  process.env.TARGET_SUPABASE_TOKEN ||
  process.env.SUPABASE_MANAGEMENT_TOKEN ||
  '';
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
const MAX_ITEMS = Number(process.env.MAX_ITEMS || '0') || Infinity;
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const TARGET_SIZE_BYTES = Number(process.env.TARGET_SIZE_BYTES || `${200 * 1024}`);

if (!MGMT_TOKEN) {
  console.error('Missing TARGET_SUPABASE_TOKEN (or SUPABASE_MANAGEMENT_TOKEN).');
  process.exit(1);
}

const HTTP_IMAGE_TARGETS = [
  {
    table: 'product_images',
    pkColumn: 'id',
    pathColumn: 'image_path',
    bucket: 'product-images',
    pathBuilder: (row, hash) => `products/migrated/external/${hash}.webp`,
  },
  {
    table: 'patients',
    pkColumn: 'id',
    pathColumn: 'avatar_path',
    bucket: 'avatars',
    pathBuilder: (row, hash) => `${row.id}/avatar-migrated-${hash}.webp`,
  },
];

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlValue(value) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return String(value);
  return sqlLiteral(value);
}

async function runDbQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DB query failed (${res.status}): ${text.slice(0, 1000)}`);
  }
  return JSON.parse(text);
}

async function getApiKeys() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cannot fetch api keys (${res.status}): ${text.slice(0, 1000)}`);
  }

  const keys = JSON.parse(text);
  const serviceRole = keys.find((k) => k.name === 'service_role' && typeof k.api_key === 'string')?.api_key;
  const publishable =
    keys.find((k) => (k.name === 'anon' || k.name === 'publishable') && typeof k.api_key === 'string')?.api_key ||
    keys.find((k) => typeof k.api_key === 'string')?.api_key;

  if (!serviceRole || !publishable) {
    throw new Error('Could not resolve service_role / publishable keys.');
  }
  return { serviceRole, publishable };
}

async function createTempAdminAccessToken(serviceRoleKey, publishableKey) {
  const email = `r2-migration-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@internal.thegioitrimun.vn`;
  const password = `Temp#${crypto.randomBytes(12).toString('hex')}`;

  const createRes = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'R2 Migration Bot' },
    }),
  });

  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(`Cannot create temp user (${createRes.status}): ${createText.slice(0, 1000)}`);
  }

  const created = JSON.parse(createText);
  const userId = created?.id || created?.user?.id;
  if (!userId) {
    throw new Error(`Cannot parse temp user id from response: ${createText.slice(0, 300)}`);
  }

  await runDbQuery(`
UPDATE public.patients
SET role = 'master_admin',
    name = COALESCE(NULLIF(name, ''), 'R2 Migration Bot')
WHERE id = ${sqlLiteral(userId)};
`);

  const loginRes = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const loginText = await loginRes.text();
  if (!loginRes.ok) {
    throw new Error(`Cannot login temp user (${loginRes.status}): ${loginText.slice(0, 1000)}`);
  }

  const login = JSON.parse(loginText);
  const accessToken = login?.access_token;
  if (!accessToken) {
    throw new Error('Temp user login did not return access_token.');
  }

  return { userId, email, accessToken };
}

async function deleteTempUser(serviceRoleKey, userId) {
  if (!userId) return;
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Could not delete temp migration user ${userId}: ${res.status} ${text.slice(0, 300)}`);
  }
}

async function collectHttpCandidates() {
  const rows = [];
  for (const target of HTTP_IMAGE_TARGETS) {
    const query = `
SELECT
  ${target.pkColumn} AS id,
  ${target.pathColumn} AS source_url
FROM public.${target.table}
WHERE ${target.pathColumn} ~* '^https?://'
ORDER BY ${target.pkColumn};
`;
    const data = await runDbQuery(query);
    for (const row of data) {
      rows.push({
        ...row,
        table: target.table,
        pkColumn: target.pkColumn,
        pathColumn: target.pathColumn,
        bucket: target.bucket,
        pathBuilder: target.pathBuilder,
      });
    }
  }
  return rows.slice(0, MAX_ITEMS);
}

async function downloadBytes(sourceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'thegioitrimun-r2-migrator/1.0' },
    });

    if (!res.ok) {
      throw new Error(`download status=${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(timeout);
  }
}

function hasCwebp() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getImageDimensions(filePath) {
  try {
    const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
    const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
    if (width > 0 && height > 0) return { width, height };
    return null;
  } catch {
    return null;
  }
}

async function convertToWebpUnderTarget(bytes, tempDir, itemKey) {
  const inputPath = path.join(tempDir, `${itemKey}.input`);
  await fs.writeFile(inputPath, bytes);

  if (!hasCwebp()) {
    throw new Error('Missing cwebp binary. Install libwebp first (brew install webp).');
  }

  const dims = getImageDimensions(inputPath);
  const attempts = [];

  // Try strict target-size encode first.
  attempts.push({ sizeMode: true, quality: null, scale: 1.0 });

  const qualities = [82, 76, 70, 64, 58, 52, 46, 40, 34, 28];
  const scales = [1.0, 0.92, 0.85, 0.78, 0.72, 0.66, 0.60];
  for (const scale of scales) {
    for (const quality of qualities) {
      attempts.push({ sizeMode: false, quality, scale });
    }
  }

  let best = null;
  let bestPath = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    const outPath = path.join(tempDir, `${itemKey}.attempt-${i}.webp`);
    const args = ['-quiet', '-mt', '-m', '6'];

    if (attempt.sizeMode) {
      args.push('-size', String(TARGET_SIZE_BYTES), '-pass', '10');
    } else if (typeof attempt.quality === 'number') {
      args.push('-q', String(attempt.quality));
    }

    if (dims && attempt.scale < 0.999) {
      const width = Math.max(1, Math.round(dims.width * attempt.scale));
      const height = Math.max(1, Math.round(dims.height * attempt.scale));
      args.push('-resize', String(width), String(height));
    }

    args.push(inputPath, '-o', outPath);

    try {
      execFileSync('cwebp', args, { stdio: ['ignore', 'ignore', 'ignore'] });
      const stat = await fs.stat(outPath);
      if (!best || stat.size < best.size) {
        best = { size: stat.size };
        bestPath = outPath;
      }
      if (stat.size <= TARGET_SIZE_BYTES) {
        const output = await fs.readFile(outPath);
        return { bytes: output, size: stat.size };
      }
    } catch {
      // Try next encoding strategy.
    }
  }

  if (bestPath && best) {
    const output = await fs.readFile(bestPath);
    return { bytes: output, size: best.size };
  }

  throw new Error('Could not convert image to WebP.');
}

async function uploadToR2(accessToken, bucket, objectPath, bytes) {
  const filename = objectPath.split('/').pop() || 'image.webp';
  const file = new File([bytes], filename, { type: 'image/webp' });
  const form = new FormData();
  form.set('bucket', bucket);
  form.set('path', objectPath);
  form.set('file', file, filename);

  const res = await fetch(`${SITE_BASE_URL}/api/r2/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    // keep raw text in error below
  }

  if (!res.ok || !payload?.path) {
    throw new Error(`upload failed (${res.status}): ${String(payload?.error || text).slice(0, 500)}`);
  }
  return payload.path;
}

async function updateDbPath(item, nextPath) {
  const query = `
UPDATE public.${item.table}
SET ${item.pathColumn} = ${sqlLiteral(nextPath)}
WHERE ${item.pkColumn} = ${sqlValue(item.id)};
`;
  await runDbQuery(query);
}

async function countRemainingHttpRows() {
  const rows = await runDbQuery(`
SELECT
  (SELECT COUNT(*) FROM public.product_images WHERE image_path ~* '^https?://')::int AS product_images_http,
  (SELECT COUNT(*) FROM public.patients WHERE avatar_path ~* '^https?://')::int AS patients_avatar_http;
`);
  return rows[0];
}

async function main() {
  const startedAt = new Date().toISOString();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'r2-http-migrate-'));
  const report = {
    project_ref: PROJECT_REF,
    site_base_url: SITE_BASE_URL,
    dry_run: DRY_RUN,
    started_at: startedAt,
    converted_target_bytes: TARGET_SIZE_BYTES,
    total_candidates: 0,
    migrated: 0,
    reused_existing_upload: 0,
    failed: 0,
    failures: [],
  };

  const { serviceRole, publishable } = await getApiKeys();
  const before = await countRemainingHttpRows();
  console.log('HTTP rows before migrate:', before);

  const candidates = await collectHttpCandidates();
  report.total_candidates = candidates.length;
  console.log(`Found ${candidates.length} HTTP image row(s) to migrate.`);
  if (!candidates.length) {
    report.finished_at = new Date().toISOString();
    await fs.writeFile('scripts/.r2_http_image_migration_report.json', JSON.stringify(report, null, 2));
    console.log('Nothing to migrate.');
    return;
  }

  let tempUser = null;
  const sourceToPath = new Map();

  try {
    if (!DRY_RUN) {
      tempUser = await createTempAdminAccessToken(serviceRole, publishable);
      console.log(`Using temporary migration user: ${tempUser.email}`);
    } else {
      console.log('DRY_RUN=true, skip upload/update.');
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const item = candidates[i];
      const prefix = `[${i + 1}/${candidates.length}] ${item.table}.${item.pathColumn}#${item.id}`;

      try {
        const sourceUrl = String(item.source_url).trim();
        const reuseKey = `${item.bucket}|${sourceUrl}`;

        let destinationPath = sourceToPath.get(reuseKey);
        if (!destinationPath) {
          const hash = crypto
            .createHash('sha1')
            .update(reuseKey)
            .digest('hex')
            .slice(0, 24);
          destinationPath = item.pathBuilder(item, hash);

          if (!DRY_RUN) {
            const original = await downloadBytes(sourceUrl);
            const converted = await convertToWebpUnderTarget(original, tempDir, `${i}-${hash}`);
            await uploadToR2(tempUser.accessToken, item.bucket, destinationPath, converted.bytes);
            console.log(`${prefix} uploaded -> ${destinationPath} (${converted.size} bytes)`);
          } else {
            console.log(`${prefix} would upload -> ${destinationPath}`);
          }

          sourceToPath.set(reuseKey, destinationPath);
        } else {
          report.reused_existing_upload += 1;
          console.log(`${prefix} reuse uploaded object -> ${destinationPath}`);
        }

        if (!DRY_RUN) {
          await updateDbPath(item, destinationPath);
        }
        report.migrated += 1;
      } catch (error) {
        report.failed += 1;
        report.failures.push({
          table: item.table,
          id: item.id,
          bucket: item.bucket,
          source_url: item.source_url,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`${prefix} failed:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    if (!DRY_RUN && tempUser?.userId) {
      await deleteTempUser(serviceRole, tempUser.userId);
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  const after = await countRemainingHttpRows();
  report.finished_at = new Date().toISOString();
  report.http_rows_before = before;
  report.http_rows_after = after;
  await fs.writeFile('scripts/.r2_http_image_migration_report.json', JSON.stringify(report, null, 2));

  console.log('\nMigration summary:');
  console.log(`- migrated: ${report.migrated}`);
  console.log(`- reused uploads: ${report.reused_existing_upload}`);
  console.log(`- failed: ${report.failed}`);
  console.log(`- HTTP rows before: product_images=${before.product_images_http}, patients=${before.patients_avatar_http}`);
  console.log(`- HTTP rows after:  product_images=${after.product_images_http}, patients=${after.patients_avatar_http}`);
  console.log('- report: scripts/.r2_http_image_migration_report.json');

  if (report.failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
