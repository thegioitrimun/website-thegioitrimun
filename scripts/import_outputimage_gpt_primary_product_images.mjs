#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

await loadEnvFile(path.resolve('.env'));

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.TARGET_SUPABASE_TOKEN || '';
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`).replace(/\/+$/, '');
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
const ADMIN_EMAIL = process.env.OUTPUTIMAGE_GPT_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.OUTPUTIMAGE_GPT_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '';
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
const SOURCE_DIR = process.env.OUTPUTIMAGE_GPT_DIR || '/Users/PHUC/Desktop/Automate/Outputimage_GPT';
const BACKUP_DIR = process.env.OUTPUTIMAGE_GPT_IMPORT_BACKUP_DIR || '/Users/PHUC/Desktop/product-primary-image-import-backups';
const CONCURRENCY = Math.max(1, Number(process.env.OUTPUTIMAGE_GPT_IMPORT_CONCURRENCY || '3'));
const LIMIT_PRODUCTS = Number(process.env.OUTPUTIMAGE_GPT_IMPORT_LIMIT_PRODUCTS || '0') || Infinity;
const DRY_RUN = process.env.DRY_RUN === '1';
const IMPORT_STAMP = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] != null) continue;
      let value = rawValue.trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // .env is optional when the caller exports env explicitly.
  }
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

async function runDbQuery(query) {
  if (!MGMT_TOKEN) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN or TARGET_SUPABASE_TOKEN');
  }
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
    throw new Error(`DB query failed (${res.status}): ${text.slice(0, 1200)}`);
  }
  return JSON.parse(text);
}

function restUrl(resource, query = '') {
  const suffix = query ? `?${query}` : '';
  return `${SUPABASE_URL}/rest/v1/${resource}${suffix}`;
}

async function restFetch(resource, query = '', options = {}) {
  const token = options.token || PUBLISHABLE_KEY;
  const res = await fetch(restUrl(resource, query), {
    ...options,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    throw new Error(`REST ${resource} failed (${res.status}): ${typeof payload === 'string' ? payload.slice(0, 1200) : JSON.stringify(payload).slice(0, 1200)}`);
  }
  return { data: payload, headers: res.headers };
}

async function fetchAllRows(resource, query, { token = PUBLISHABLE_KEY, pageSize = 1000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data } = await restFetch(resource, query, {
      token,
      headers: { Range: `${from}-${to}` },
    });
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function countRows(resource, query, { token = PUBLISHABLE_KEY } = {}) {
  const { headers } = await restFetch(resource, query, {
    token,
    headers: {
      Range: '0-0',
      Prefer: 'count=exact',
    },
  });
  const contentRange = headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function loginAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or OUTPUTIMAGE_GPT_ADMIN_EMAIL/OUTPUTIMAGE_GPT_ADMIN_PASSWORD');
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Admin login failed (${res.status}): ${text.slice(0, 1200)}`);
  }
  const payload = JSON.parse(text);
  if (!payload.access_token) {
    throw new Error('Admin login did not return access_token');
  }
  return payload.access_token;
}

async function getApiKeys() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cannot fetch api keys (${res.status}): ${text.slice(0, 1200)}`);
  }

  const keys = JSON.parse(text);
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  const publishable =
    keys.find((entry) => (entry.name === 'anon' || entry.name === 'publishable') && typeof entry.api_key === 'string')?.api_key ||
    keys.find((entry) => typeof entry.api_key === 'string')?.api_key;

  if (!serviceRole || !publishable) {
    throw new Error('Could not resolve service_role / publishable keys');
  }

  return { serviceRole, publishable };
}

async function createTempAdminAccessToken(serviceRoleKey, publishableKey) {
  const email = `outputimage-gpt-primary-import-${Date.now()}@internal.thegioitrimun.vn`;
  const password = `Temp#${Math.random().toString(36).slice(2)}Aa1!`;

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
      user_metadata: { name: 'Outputimage GPT Primary Import Bot' },
    }),
  });

  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(`Cannot create temp user (${createRes.status}): ${createText.slice(0, 1200)}`);
  }

  const created = JSON.parse(createText);
  const userId = created?.id || created?.user?.id;
  if (!userId) {
    throw new Error('Cannot parse temp user id');
  }

  await runDbQuery(`
INSERT INTO public.patients (
  id,
  name,
  dob,
  phone,
  email,
  gender,
  citizen_id_number,
  nationality,
  role
)
VALUES (
  ${sqlLiteral(userId)},
  'Outputimage GPT Primary Import Bot',
  '1990-01-01',
  '0900000000',
  ${sqlLiteral(email)},
  'other',
  'OUTPUTIMAGE-GPT-PRIMARY-IMPORT',
  'Vietnam',
  'master_admin'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  dob = EXCLUDED.dob,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  gender = EXCLUDED.gender,
  citizen_id_number = EXCLUDED.citizen_id_number,
  nationality = EXCLUDED.nationality,
  role = 'master_admin';
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
    throw new Error(`Cannot login temp user (${loginRes.status}): ${loginText.slice(0, 1200)}`);
  }

  const login = JSON.parse(loginText);
  const accessToken = login?.access_token;
  if (!accessToken) {
    throw new Error('Temp user login did not return access_token');
  }

  return { userId, accessToken };
}

async function deleteTempUser(serviceRoleKey, userId) {
  if (!userId) return;
  try {
    await runDbQuery(`DELETE FROM public.patients WHERE id = ${sqlLiteral(userId)};`);
  } catch (error) {
    console.warn(`Could not delete temp import patient profile ${userId}: ${error?.message || error}`);
  }

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
    console.warn(`Could not delete temp import user ${userId}: ${res.status} ${text.slice(0, 300)}`);
  }
}

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .trim();

const coerceExtension = (value, fallback = 'webp') => {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');
  return normalized || fallback;
};

const contentTypeForExtension = (extension) => {
  const ext = coerceExtension(extension);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return `image/${ext}`;
};

function parseImageFile(fileName) {
  const match = fileName.match(/^(\d{4})-(.+?)-(\d{2})-(gallery-primary|gallery|editorial)(?:-[^.]+)?\.(webp|png|jpe?g)$/i);
  if (!match) return null;
  return {
    fileName,
    productId: Number(match[1]),
    sourceSlugPart: match[2],
    sourceOrder: Number(match[3]),
    kind: match[4].toLowerCase(),
    extension: coerceExtension(match[5]),
  };
}

function choosePrimaryCandidate(items) {
  const kindRank = { 'gallery-primary': 0, gallery: 1, editorial: 9 };
  const candidates = items.filter((item) => item.kind === 'gallery-primary' || item.kind === 'gallery');
  return [...candidates].sort((a, b) => (
    (kindRank[a.kind] ?? 99) - (kindRank[b.kind] ?? 99) ||
    a.sourceOrder - b.sourceOrder ||
    a.fileName.localeCompare(b.fileName)
  ))[0] || null;
}

function buildPrimaryPath(product, item) {
  const productSlug = normalizeText(product.slug || product.name || `product-${product.id}`);
  const base = normalizeText(path.basename(item.fileName, path.extname(item.fileName))).slice(0, 120);
  return `products/${productSlug}/primary-gpt/${IMPORT_STAMP}-${base || `product-${product.id}`}.${item.extension}`;
}

async function uploadToR2(accessToken, item) {
  const bytes = await fs.readFile(item.localPath);
  const formData = new FormData();
  formData.set('bucket', 'product-images');
  formData.set('path', item.image_path);
  formData.set('file', new File([bytes], item.fileName, { type: contentTypeForExtension(item.extension) }));

  const res = await fetch(`${SITE_BASE_URL}/api/r2/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const text = await res.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`UPLOAD_FAILED status=${res.status} ${payload?.error || text.slice(0, 500)}`);
  }
  return payload;
}

async function runUploadQueue(accessToken, uploadItems) {
  let cursor = 0;
  let uploaded = 0;
  const failed = [];
  let stopped = false;

  const worker = async () => {
    while (!stopped && cursor < uploadItems.length) {
      const index = cursor;
      cursor += 1;
      const item = uploadItems[index];
      try {
        await uploadToR2(accessToken, item);
        uploaded += 1;
        if (uploaded % 25 === 0 || uploaded === uploadItems.length) {
          console.log(`[upload] ${uploaded}/${uploadItems.length}`);
        }
      } catch (error) {
        failed.push({ item, error: error?.message || String(error) });
        console.error(`[upload failed] product=${item.product_id} file=${item.fileName} ${error?.message || error}`);
        stopped = true;
        cursor = uploadItems.length;
        break;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { uploaded, failed };
}

async function writeBackup(backup) {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `outputimage-gpt-primary-images-${PROJECT_REF}-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  return backupPath;
}

async function main() {
  const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const parsed = files
    .map((fileName) => parseImageFile(fileName))
    .filter(Boolean)
    .map((item) => ({ ...item, localPath: path.join(SOURCE_DIR, item.fileName) }));

  const products = await fetchAllRows('products', 'select=id,slug,name&order=id.asc');
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  const grouped = new Map();
  const unmatched = [];
  for (const item of parsed) {
    const product = productMap.get(item.productId);
    if (!product) {
      unmatched.push({ reason: 'product_id_not_found', ...item });
      continue;
    }
    const group = grouped.get(item.productId) || [];
    group.push(item);
    grouped.set(item.productId, group);
  }

  const skipped = [];
  const plannedRows = [];
  const selectedProductIds = [...grouped.keys()].sort((a, b) => a - b).slice(0, LIMIT_PRODUCTS);
  for (const productId of selectedProductIds) {
    const product = productMap.get(productId);
    const items = grouped.get(productId) || [];
    const primaryCandidate = choosePrimaryCandidate(items);
    if (!primaryCandidate) {
      skipped.push({
        product_id: productId,
        reason: 'no_gallery_or_gallery_primary_file',
        file_count: items.length,
      });
      continue;
    }
    const row = {
      product_id: productId,
      product_name: product.name,
      product_slug: product.slug,
      image_path: buildPrimaryPath(product, primaryCandidate),
      display_order: 0,
      is_primary: true,
      fileName: primaryCandidate.fileName,
      localPath: primaryCandidate.localPath,
      extension: primaryCandidate.extension,
      source_kind: primaryCandidate.kind,
      source_order: primaryCandidate.sourceOrder,
    };
    plannedRows.push(row);
  }

  if (!plannedRows.length) {
    throw new Error('No product primary images planned.');
  }

  const productIdList = plannedRows.map((row) => Number(row.product_id)).join(',');
  const productIdFilter = `(${productIdList})`;
  const existingImages = await fetchAllRows(
    'product_images',
    `select=id,product_id,image_path,display_order,is_primary&product_id=in.${encodeURIComponent(productIdFilter)}&order=product_id.asc,display_order.asc,id.asc`
  );
  const totalProductImagesBefore = await countRows('product_images', 'select=id');
  const before = [{
    total_product_images: totalProductImagesBefore,
    selected_product_images: existingImages.length,
    selected_primary_rows: existingImages.filter((row) => row.is_primary === true).length,
  }];

  const backup = {
    created_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    source_dir: SOURCE_DIR,
    site_base_url: SITE_BASE_URL,
    dry_run: DRY_RUN,
    files_total: files.length,
    parsed_files: parsed.length,
    products_with_files: grouped.size,
    products_planned: plannedRows.length,
    unmatched_files: unmatched.map(({ localPath, ...item }) => item),
    skipped_products: skipped,
    existing_product_images: existingImages,
    planned_primary_rows: plannedRows.map(({ localPath, ...row }) => row),
    before: before[0] || null,
  };
  const backupPath = await writeBackup(backup);

  console.log('# Outputimage GPT primary product image import');
  console.log(`- project: ${PROJECT_REF}`);
  console.log(`- source: ${SOURCE_DIR}`);
  console.log(`- site upload endpoint: ${SITE_BASE_URL}/api/r2/upload`);
  console.log(`- backup: ${backupPath}`);
  console.log(`- files total: ${files.length}`);
  console.log(`- parsed image files: ${parsed.length}`);
  console.log(`- products with files: ${grouped.size}`);
  console.log(`- products planned: ${plannedRows.length}`);
  console.log(`- unmatched files: ${unmatched.length}`);
  console.log(`- skipped products: ${skipped.length}`);
  console.log(`- existing product_images total before: ${before[0]?.total_product_images}`);
  console.log(`- selected product_images before: ${before[0]?.selected_product_images}`);
  console.log(`- selected primary rows before: ${before[0]?.selected_primary_rows}`);
  console.log(`- dry run: ${DRY_RUN ? 'yes' : 'no'}`);

  if (DRY_RUN) {
    console.log('- no upload or DB mutation executed');
    return;
  }

  const adminAccessToken = await loginAdmin();

  console.log(`[upload] starting ${plannedRows.length} objects with concurrency=${CONCURRENCY}`);
  const uploadResult = await runUploadQueue(adminAccessToken, plannedRows);
    if (uploadResult.failed.length) {
      throw new Error(`Upload failed for ${uploadResult.failed.length} object(s). DB was not changed. Backup: ${backupPath}`);
    }

  const insertChunkSize = 100;
  for (let i = 0; i < plannedRows.length; i += insertChunkSize) {
    const chunk = plannedRows.slice(i, i + insertChunkSize).map((row) => ({
      product_id: Number(row.product_id),
      image_path: row.image_path,
      display_order: 0,
      is_primary: true,
    }));
    await restFetch('product_images', '', {
      token: adminAccessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    console.log(`[db] inserted primary rows ${Math.min(i + insertChunkSize, plannedRows.length)}/${plannedRows.length}`);
  }

  const oldPrimaryIds = existingImages
    .filter((row) => row.is_primary === true && Number.isFinite(Number(row.id)))
    .map((row) => Number(row.id));
  for (let i = 0; i < oldPrimaryIds.length; i += insertChunkSize) {
    const chunk = oldPrimaryIds.slice(i, i + insertChunkSize);
    await restFetch('product_images', `id=in.${encodeURIComponent(`(${chunk.join(',')})`)}`, {
      token: adminAccessToken,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ is_primary: false }),
    });
    console.log(`[db] disabled old primary rows ${Math.min(i + insertChunkSize, oldPrimaryIds.length)}/${oldPrimaryIds.length}`);
  }

  const afterImages = await fetchAllRows(
    'product_images',
    `select=id,product_id,image_path,display_order,is_primary&product_id=in.${encodeURIComponent(productIdFilter)}&order=product_id.asc,display_order.asc,id.asc`,
    { token: adminAccessToken }
  );
  const totalProductImagesAfter = await countRows('product_images', 'select=id', { token: adminAccessToken });
  const primaryRowsAfter = afterImages.filter((row) => row.is_primary === true);
  const after = [{
    total_product_images: totalProductImagesAfter,
    selected_product_images: afterImages.length,
    selected_primary_rows: primaryRowsAfter.length,
    selected_products_with_primary: new Set(primaryRowsAfter.map((row) => Number(row.product_id))).size,
  }];

    console.log('');
    console.log('# Import complete');
    console.log(`- uploaded objects: ${uploadResult.uploaded}`);
    console.log(`- inserted primary image rows: ${plannedRows.length}`);
    console.log(`- total product_images before/after: ${before[0]?.total_product_images} -> ${after[0]?.total_product_images}`);
    console.log(`- selected product_images before/after: ${before[0]?.selected_product_images} -> ${after[0]?.selected_product_images}`);
    console.log(`- selected primary rows after: ${after[0]?.selected_primary_rows}`);
    console.log(`- selected products with primary after: ${after[0]?.selected_products_with_primary}/${plannedRows.length}`);
    console.log(`- backup: ${backupPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
