#!/usr/bin/env node

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.TARGET_SUPABASE_TOKEN || '';
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
const CONCURRENCY = Number(process.env.PRODUCT_IMAGE_MIGRATION_CONCURRENCY || '3');
const LIMIT = Number(process.env.PRODUCT_IMAGE_MIGRATION_LIMIT || '0') || Infinity;
const DELETE_OLD_OBJECTS = process.env.DELETE_OLD_OBJECTS !== '0';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!MGMT_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN or TARGET_SUPABASE_TOKEN');
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
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
  const email = `product-image-migration-${Date.now()}@internal.thegioitrimun.vn`;
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
      user_metadata: { name: 'Product Image Migration Bot' },
    }),
  });

  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(`Cannot create temp user (${createRes.status}): ${createText.slice(0, 1000)}`);
  }

  const created = JSON.parse(createText);
  const userId = created?.id || created?.user?.id;
  if (!userId) {
    throw new Error('Cannot parse temp user id');
  }

  await runDbQuery(`
UPDATE public.patients
SET role = 'master_admin',
    name = COALESCE(NULLIF(name, ''), 'Product Image Migration Bot')
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
    throw new Error('Temp user login did not return access_token');
  }

  return { userId, accessToken };
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

const uniqueSuffix = (seed) => normalizeText(seed || '').slice(0, 12);

const buildPath = (folders, fileName, extension = 'webp') => {
  const normalizedFolders = folders.map((folder) => normalizeText(folder)).filter(Boolean);
  const safeBase = normalizeText(fileName) || 'image';
  return `${normalizedFolders.join('/')}/${safeBase}.${coerceExtension(extension)}`.replace(/^\/+/, '');
};

function buildProductGalleryImagePath({ slug, name, index, suffix, extension }) {
  const productSlug = normalizeText(slug || name || 'product');
  const galleryIndex = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;
  return buildPath(
    ['products', productSlug],
    ['gallery', galleryIndex, uniqueSuffix(suffix)].filter(Boolean).join('-'),
    extension
  );
}

function getExtensionFromPath(path) {
  const normalized = String(path || '').split('?')[0].split('#')[0];
  const ext = normalized.includes('.') ? normalized.split('.').pop() : '';
  return coerceExtension(ext, 'webp');
}

function encodePath(path) {
  return String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function downloadFromR2Public(path) {
  const res = await fetch(`${SITE_BASE_URL}/r2/product-images/${encodePath(path)}`);
  if (!res.ok) {
    throw new Error(`DOWNLOAD_FAILED status=${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToR2(accessToken, path, bytes, extension) {
  const formData = new FormData();
  formData.set('bucket', 'product-images');
  formData.set('path', path);
  formData.set('file', new File([bytes], `image.${extension}`, { type: `image/${extension}` }));

  const res = await fetch(`${SITE_BASE_URL}/api/r2/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const text = await res.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`UPLOAD_FAILED status=${res.status} ${payload?.error || text.slice(0, 300)}`);
  }
}

async function deleteFromR2(accessToken, path) {
  const res = await fetch(`${SITE_BASE_URL}/api/r2/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ bucket: 'product-images', paths: [path] }),
  });

  const text = await res.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`DELETE_FAILED status=${res.status} ${payload?.error || text.slice(0, 300)}`);
  }
}

async function updateProductImagePath(id, nextPath) {
  await runDbQuery(`
UPDATE public.product_images
SET image_path = ${sqlLiteral(nextPath)}
WHERE id = ${Number(id)};
`);
}

async function main() {
  const { serviceRole, publishable } = await getApiKeys();
  let tempUserId = null;
  let accessToken = null;

  try {
    const auth = await createTempAdminAccessToken(serviceRole, publishable);
    tempUserId = auth.userId;
    accessToken = auth.accessToken;

    const products = await runDbQuery(`
SELECT id, slug, name
FROM public.products
ORDER BY id;
`);
    const productMap = new Map(products.map((product) => [product.id, product]));

    const rows = await runDbQuery(`
SELECT id, product_id, image_path, COALESCE(display_order, 999999) AS display_order, COALESCE(is_primary, false) AS is_primary
FROM public.product_images
WHERE image_path LIKE 'products/migrated/external/%'
ORDER BY product_id, COALESCE(display_order, 999999), id;
`);

    const grouped = new Map();
    for (const row of rows) {
      const current = grouped.get(row.product_id) || [];
      current.push(row);
      grouped.set(row.product_id, current);
    }

    const tasks = [];
    for (const [productId, group] of grouped.entries()) {
      const product = productMap.get(productId);
      group.forEach((row, index) => {
        tasks.push({
          rowId: row.id,
          oldPath: row.image_path,
          newPath: buildProductGalleryImagePath({
            slug: product?.slug,
            name: product?.name,
            index,
            suffix: String(row.id),
            extension: getExtensionFromPath(row.image_path),
          }),
        });
      });
    }

    const queue = tasks.slice(0, LIMIT);
    let cursor = 0;
    let migrated = 0;
    let deleted = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const currentIndex = cursor;
        cursor += 1;
        const task = queue[currentIndex];

        try {
          if (DRY_RUN) {
            console.log(`[dry-run] ${task.oldPath} -> ${task.newPath}`);
            migrated += 1;
            continue;
          }

          const bytes = await downloadFromR2Public(task.oldPath);
          await uploadToR2(accessToken, task.newPath, bytes, getExtensionFromPath(task.newPath));
          await updateProductImagePath(task.rowId, task.newPath);
          migrated += 1;

          if (DELETE_OLD_OBJECTS && task.oldPath !== task.newPath) {
            await deleteFromR2(accessToken, task.oldPath);
            deleted += 1;
          }

          if (migrated % 25 === 0 || migrated === queue.length) {
            console.log(`[product-images] migrated ${migrated}/${queue.length}`);
          }
        } catch (error) {
          failed += 1;
          console.error(`[failed] row=${task.rowId} old=${task.oldPath} new=${task.newPath} ${(error && error.message) || error}`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));

    console.log('');
    console.log(`# Product image SEO migration for ${PROJECT_REF}`);
    console.log(`- source rows (migrated_external only): ${queue.length}`);
    console.log(`- migrated: ${migrated}`);
    console.log(`- deleted old objects: ${deleted}`);
    console.log(`- failed: ${failed}`);

    if (failed > 0) process.exitCode = 2;
  } finally {
    await deleteTempUser(serviceRole, tempUserId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
