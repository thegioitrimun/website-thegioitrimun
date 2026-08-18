#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.TARGET_SUPABASE_TOKEN || '';
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://thegioitrimun.vn').replace(/\/+$/, '');
const SOURCE_DIR = process.env.PICTURE_OUTPUT_DIR || '/Users/PHUC/Desktop/Picture Output';
const BACKUP_DIR = process.env.PICTURE_IMPORT_BACKUP_DIR || '/Users/PHUC/Desktop/product-image-import-backups';
const CONCURRENCY = Math.max(1, Number(process.env.PICTURE_IMPORT_CONCURRENCY || '3'));
const LIMIT_PRODUCTS = Number(process.env.PICTURE_IMPORT_LIMIT_PRODUCTS || '0') || Infinity;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!MGMT_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN or TARGET_SUPABASE_TOKEN');
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
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
    throw new Error(`DB query failed (${res.status}): ${text.slice(0, 1200)}`);
  }
  return JSON.parse(text);
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
  const email = `picture-output-import-${Date.now()}@internal.thegioitrimun.vn`;
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
      user_metadata: { name: 'Picture Output Import Bot' },
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
  'Picture Output Import Bot',
  '1990-01-01',
  '0900000000',
  ${sqlLiteral(email)},
  'other',
  'PICTURE-OUTPUT-IMPORT',
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

  await verifyTempUserRole(publishableKey, accessToken, userId);

  return { userId, accessToken };
}

async function verifyTempUserRole(publishableKey, accessToken, userId) {
  const roleRes = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/patients?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const roleText = await roleRes.text();
  if (!roleRes.ok) {
    throw new Error(`Temp user cannot read patients role (${roleRes.status}): ${roleText.slice(0, 1200)}`);
  }

  const rows = JSON.parse(roleText);
  const role = rows?.[0]?.role || null;
  if (role !== 'master_admin') {
    throw new Error(`Temp user role verification failed. Expected master_admin, got ${role || 'null'}.`);
  }
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
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return `image/${ext}`;
};

function parseImageFile(fileName) {
  const match = fileName.match(/^(\d{4})-(.+?)-(\d{2})-(gallery-primary|gallery|editorial)\.(webp|png|jpe?g)$/i);
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

function buildGalleryPath(product, item, displayOrder) {
  const productSlug = normalizeText(product.slug || product.name || `product-${product.id}`);
  const suffix = item.kind === 'gallery-primary' ? 'primary' : 'picture-output';
  return `products/${productSlug}/gallery-${String(displayOrder).padStart(2, '0')}-${suffix}.${item.extension}`;
}

function buildEditorialPath(product, item, editorialOrder) {
  const productSlug = normalizeText(product.slug || product.name || `product-${product.id}`);
  return `products/${productSlug}/details/detail-${String(editorialOrder).padStart(2, '0')}-picture-output.${item.extension}`;
}

function sortItems(items) {
  const kindRank = { 'gallery-primary': 0, gallery: 1, editorial: 2 };
  return [...items].sort((a, b) => (
    (kindRank[a.kind] ?? 99) - (kindRank[b.kind] ?? 99) ||
    a.sourceOrder - b.sourceOrder ||
    a.fileName.localeCompare(b.fileName)
  ));
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function updateLongDescriptionImages(product, editorialRows) {
  if (!editorialRows.length) return { next: product.long_description, changed: false, replaced: 0, appended: 0 };

  const blocks = Array.isArray(product.long_description) ? [...product.long_description] : [];
  const existingImagePaths = new Set(
    blocks
      .filter((block) => isObject(block) && block.type === 'image' && block.image_path)
      .map((block) => block.image_path)
  );
  const newImageBlocks = editorialRows
    .filter((row) => !existingImagePaths.has(row.image_path))
    .map((row) => ({
      type: 'image',
      caption: `Hình minh họa ${product.name}`,
      image_path: row.image_path,
    }));

  if (!newImageBlocks.length) {
    return { next: blocks, changed: false, replaced: 0, appended: 0 };
  }

  const firstImageIndex = blocks.findIndex((block) => isObject(block) && block.type === 'image');
  const insertAt = firstImageIndex >= 0 ? firstImageIndex : blocks.length;
  const next = [
    ...blocks.slice(0, insertAt),
    ...newImageBlocks,
    ...blocks.slice(insertAt),
  ];

  return { next, changed: true, replaced: 0, appended: newImageBlocks.length };
}

function planMergedGalleryMutations(existingImages, galleryRows) {
  const existingByProduct = new Map();
  for (const row of existingImages) {
    const productId = Number(row.product_id);
    const rows = existingByProduct.get(productId) || [];
    rows.push(row);
    existingByProduct.set(productId, rows);
  }

  const plannedByProduct = new Map();
  for (const row of galleryRows) {
    const productId = Number(row.product_id);
    const rows = plannedByProduct.get(productId) || [];
    rows.push(row);
    plannedByProduct.set(productId, rows);
  }

  const rowsToInsert = [];
  const rowsToUpdate = [];
  const productIds = [...new Set([...plannedByProduct.keys(), ...existingByProduct.keys()])].sort((a, b) => a - b);

  for (const productId of productIds) {
    const plannedRows = (plannedByProduct.get(productId) || [])
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    const existingRows = (existingByProduct.get(productId) || [])
      .sort((a, b) => (
        Number(a.display_order || 0) - Number(b.display_order || 0) ||
        Number(a.id || 0) - Number(b.id || 0)
      ));
    const existingByPath = new Map(existingRows.map((row) => [row.image_path, row]));
    const plannedPathSet = new Set(plannedRows.map((row) => row.image_path));

    plannedRows.forEach((row, index) => {
      const nextDisplayOrder = index + 1;
      const existing = existingByPath.get(row.image_path);
      if (existing?.id) {
        rowsToUpdate.push({
          id: existing.id,
          product_id: productId,
          image_path: row.image_path,
          display_order: nextDisplayOrder,
          is_primary: !!row.is_primary,
        });
        return;
      }
      rowsToInsert.push({
        ...row,
        display_order: nextDisplayOrder,
        is_primary: !!row.is_primary,
      });
    });

    const preservedRows = existingRows.filter((row) => !plannedPathSet.has(row.image_path));
    preservedRows.forEach((row, index) => {
      if (!row.id) return;
      rowsToUpdate.push({
        id: row.id,
        product_id: productId,
        image_path: row.image_path,
        display_order: plannedRows.length + index + 1,
        is_primary: false,
      });
    });
  }

  return { rowsToInsert, rowsToUpdate };
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
  const backupPath = path.join(BACKUP_DIR, `picture-output-product-images-${PROJECT_REF}-${timestamp}.json`);
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

  const products = await runDbQuery(`
SELECT id, slug, name, long_description
FROM public.products
ORDER BY id;
`);
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  const grouped = new Map();
  const unmatched = [];
  for (const item of parsed) {
    const product = productMap.get(item.productId);
    if (!product) {
      unmatched.push(item);
      continue;
    }
    const group = grouped.get(item.productId) || [];
    group.push(item);
    grouped.set(item.productId, group);
  }

  const selectedProductIds = [...grouped.keys()].sort((a, b) => a - b).slice(0, LIMIT_PRODUCTS);
  const productIdList = selectedProductIds.join(',');
  if (!selectedProductIds.length) {
    throw new Error('No matching product image files found.');
  }

  const existingImages = await runDbQuery(`
SELECT *
FROM public.product_images
WHERE product_id IN (${productIdList})
ORDER BY product_id, COALESCE(display_order, 999999), id;
`);

  const uploadItems = [];
  const galleryRows = [];
  const editorialByProduct = new Map();

  for (const productId of selectedProductIds) {
    const product = productMap.get(productId);
    const items = sortItems(grouped.get(productId) || []);
    const galleryItems = items.filter((item) => item.kind === 'gallery-primary' || item.kind === 'gallery');
    const editorialItems = items.filter((item) => item.kind === 'editorial');
    let displayOrder = 1;
    const primarySourceOrder = galleryItems.find((item) => item.kind === 'gallery-primary')?.sourceOrder ?? galleryItems[0]?.sourceOrder ?? null;

    for (const item of galleryItems) {
      const imagePath = buildGalleryPath(product, item, displayOrder);
      const row = {
        product_id: productId,
        image_path: imagePath,
        display_order: displayOrder,
        is_primary: item.sourceOrder === primarySourceOrder,
        fileName: item.fileName,
        localPath: item.localPath,
        extension: item.extension,
      };
      galleryRows.push(row);
      uploadItems.push(row);
      displayOrder += 1;
    }

    let editorialOrder = 1;
    const editorialRows = [];
    for (const item of editorialItems) {
      const imagePath = buildEditorialPath(product, item, editorialOrder);
      const row = {
        product_id: productId,
        image_path: imagePath,
        display_order: editorialOrder,
        is_primary: false,
        fileName: item.fileName,
        localPath: item.localPath,
        extension: item.extension,
      };
      editorialRows.push(row);
      uploadItems.push(row);
      editorialOrder += 1;
    }
    if (editorialRows.length) {
      editorialByProduct.set(productId, editorialRows);
    }
  }

  const longDescriptionUpdates = [];
  for (const [productId, editorialRows] of editorialByProduct.entries()) {
    const product = productMap.get(productId);
    const update = updateLongDescriptionImages(product, editorialRows);
    if (update.changed) {
      longDescriptionUpdates.push({
        product_id: productId,
        next_long_description: update.next,
        replaced: update.replaced,
        appended: update.appended,
      });
    }
  }

  const backup = {
    created_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    source_dir: SOURCE_DIR,
    site_base_url: SITE_BASE_URL,
    dry_run: DRY_RUN,
    product_ids: selectedProductIds,
    files_total: files.length,
    parsed_files: parsed.length,
    unmatched_files: unmatched.map(({ localPath, ...item }) => item),
    existing_product_images: existingImages,
    existing_long_descriptions: products
      .filter((product) => editorialByProduct.has(Number(product.id)))
      .map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        long_description: product.long_description,
      })),
    planned_gallery_rows: galleryRows.map(({ localPath, ...row }) => row),
    planned_long_description_updates: longDescriptionUpdates.map((item) => ({
      product_id: item.product_id,
      replaced: item.replaced,
      appended: item.appended,
    })),
  };
  const backupPath = await writeBackup(backup);

  console.log('# Picture Output product image import');
  console.log(`- project: ${PROJECT_REF}`);
  console.log(`- source: ${SOURCE_DIR}`);
  console.log(`- backup: ${backupPath}`);
  console.log(`- files total: ${files.length}`);
  console.log(`- parsed image files: ${parsed.length}`);
  console.log(`- matched products: ${selectedProductIds.length}`);
  console.log(`- unmatched files: ${unmatched.length}`);
  console.log(`- gallery rows planned: ${galleryRows.length}`);
  console.log(`- editorial uploads planned: ${uploadItems.length - galleryRows.length}`);
  console.log(`- long_description updates planned: ${longDescriptionUpdates.length}`);

  if (DRY_RUN) {
    console.log('- dry run: no upload or DB mutation executed');
    return;
  }

  const { serviceRole, publishable } = await getApiKeys();
  let tempUserId = null;

  try {
    const auth = await createTempAdminAccessToken(serviceRole, publishable);
    tempUserId = auth.userId;

    console.log(`[upload] starting ${uploadItems.length} objects with concurrency=${CONCURRENCY}`);
    const uploadResult = await runUploadQueue(auth.accessToken, uploadItems);
    if (uploadResult.failed.length) {
      throw new Error(`Upload failed for ${uploadResult.failed.length} object(s). DB was not changed. Backup: ${backupPath}`);
    }

    const galleryMutations = planMergedGalleryMutations(existingImages, galleryRows);
    console.log(`[db] merging product_images rows; insert=${galleryMutations.rowsToInsert.length}, update=${galleryMutations.rowsToUpdate.length}`);

    const insertChunkSize = 120;
    for (let i = 0; i < galleryMutations.rowsToInsert.length; i += insertChunkSize) {
      const chunk = galleryMutations.rowsToInsert.slice(i, i + insertChunkSize);
      const values = chunk.map((row) => `(${Number(row.product_id)}, ${sqlLiteral(row.image_path)}, ${Number(row.display_order)}, ${row.is_primary ? 'true' : 'false'})`).join(',\n');
      await runDbQuery(`
INSERT INTO public.product_images (product_id, image_path, display_order, is_primary)
VALUES
${values};
`);
      console.log(`[db] inserted new gallery rows ${Math.min(i + insertChunkSize, galleryMutations.rowsToInsert.length)}/${galleryMutations.rowsToInsert.length}`);
    }

    for (let i = 0; i < galleryMutations.rowsToUpdate.length; i += insertChunkSize) {
      const chunk = galleryMutations.rowsToUpdate.slice(i, i + insertChunkSize);
      const values = chunk.map((row) => `(${Number(row.id)}, ${Number(row.display_order)}, ${row.is_primary ? 'true' : 'false'})`).join(',\n');
      await runDbQuery(`
UPDATE public.product_images AS pi
SET
  display_order = patch.display_order,
  is_primary = patch.is_primary
FROM (VALUES
${values}
) AS patch(id, display_order, is_primary)
WHERE pi.id = patch.id;
`);
      console.log(`[db] updated existing gallery rows ${Math.min(i + insertChunkSize, galleryMutations.rowsToUpdate.length)}/${galleryMutations.rowsToUpdate.length}`);
    }

    for (const update of longDescriptionUpdates) {
      await runDbQuery(`
UPDATE public.products
SET long_description = ${sqlJsonb(update.next_long_description)}
WHERE id = ${Number(update.product_id)};
`);
    }
    if (longDescriptionUpdates.length) {
      console.log(`[db] updated long_description ${longDescriptionUpdates.length}/${longDescriptionUpdates.length}`);
    }

    const after = await runDbQuery(`
SELECT
  (SELECT COUNT(*)::int FROM public.product_images WHERE product_id IN (${productIdList})) AS product_image_rows,
  (SELECT COUNT(DISTINCT product_id)::int FROM public.product_images WHERE product_id IN (${productIdList})) AS products_with_images,
  (SELECT COUNT(*)::int FROM public.product_images WHERE product_id IN (${productIdList}) AND is_primary = true) AS primary_rows;
`);
    console.log('');
    console.log('# Import complete');
    console.log(`- uploaded objects: ${uploadResult.uploaded}`);
    console.log(`- DB product_images rows now: ${after[0]?.product_image_rows}`);
    console.log(`- products with images now: ${after[0]?.products_with_images}`);
    console.log(`- primary rows now: ${after[0]?.primary_rows}`);
    console.log(`- backup: ${backupPath}`);
  } finally {
    await deleteTempUser(serviceRole, tempUserId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
