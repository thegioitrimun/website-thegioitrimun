import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
export const DEFAULT_BASE_URL = 'https://thegioitrimun.vn';
export const DEFAULT_SUPABASE_URL = 'https://ykcrngqhyinczmvwduox.supabase.co';
export const DEFAULT_OUTPUT_PATH = 'tmp/product-image-seo-inventory.json';

const ALLOWED_PUBLIC_IMAGE_BUCKETS = new Set([
  'site-assets',
  'avatars',
  'blog-images',
  'product-images',
  'assets',
]);

const SUPABASE_PUBLIC_OBJECT_PATH_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export async function loadDotEnv(envPath = path.resolve(process.cwd(), '.env')) {
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^(['"])([\s\S]*)\1$/, '$2');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getRuntimeConfig() {
  const baseUrl = String(process.env.SEO_AUDIT_BASE_URL || process.env.PUBLIC_SITE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';
  const r2BaseUrl = String(process.env.R2_PUBLIC_BASE_URL || process.env.VITE_R2_IMAGE_BASE_URL || `${baseUrl}/r2`).replace(/\/+$/, '');
  const fetchTimeoutMs = Number(process.env.SEO_AUDIT_FETCH_TIMEOUT_MS || 20000);
  return {
    baseUrl,
    supabaseUrl,
    supabaseKey,
    r2BaseUrl,
    fetchTimeoutMs,
  };
}

export function slugify(value, fallback = 'san-pham') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (char) => (char === 'Đ' ? 'D' : 'd'))
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

export function normalizeUrl(value, baseUrl = DEFAULT_BASE_URL) {
  const parsed = new URL(value, baseUrl);
  parsed.hash = '';
  parsed.search = '';
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
}

export function fetchWithTimeout(url, options = {}, timeoutMs = getRuntimeConfig().fetchTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

function encodeObjectPath(value) {
  return String(value || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function decodeObjectPath(value) {
  return String(value || '')
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
}

function resolveStorageReference(rawPath, fallbackBucket = 'product-images') {
  if (!rawPath) return null;
  const raw = String(rawPath).trim();
  if (!raw) return null;
  const fallback = ALLOWED_PUBLIC_IMAGE_BUCKETS.has(fallbackBucket) ? fallbackBucket : null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const supabaseMatch = parsed.pathname.match(SUPABASE_PUBLIC_OBJECT_PATH_REGEX);
      if (supabaseMatch && ALLOWED_PUBLIC_IMAGE_BUCKETS.has(decodeURIComponent(supabaseMatch[1]))) {
        return {
          bucket: decodeURIComponent(supabaseMatch[1]),
          path: decodeObjectPath(supabaseMatch[2]),
        };
      }
      const r2Match = parsed.pathname.match(/^\/r2\/([^/]+)\/(.+)$/i);
      if (r2Match && ALLOWED_PUBLIC_IMAGE_BUCKETS.has(decodeURIComponent(r2Match[1]))) {
        return {
          bucket: decodeURIComponent(r2Match[1]),
          path: decodeObjectPath(r2Match[2]),
        };
      }
    } catch {
      // Keep the original external URL below.
    }
    return { externalUrl: raw };
  }

  const cleanPath = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const r2Local = cleanPath.match(/^r2\/([^/]+)\/(.+)$/i);
  if (r2Local && ALLOWED_PUBLIC_IMAGE_BUCKETS.has(decodeURIComponent(r2Local[1]))) {
    return {
      bucket: decodeURIComponent(r2Local[1]),
      path: decodeObjectPath(r2Local[2]),
    };
  }

  const inferred = cleanPath.match(/^([^/]+)\/(.+)$/);
  if (inferred && ALLOWED_PUBLIC_IMAGE_BUCKETS.has(inferred[1])) {
    return {
      bucket: inferred[1],
      path: decodeObjectPath(inferred[2]),
    };
  }

  return {
    bucket: fallback,
    path: decodeObjectPath(cleanPath),
  };
}

export function resolveProductImageUrl(imagePath, config = getRuntimeConfig()) {
  const resolved = resolveStorageReference(imagePath, 'product-images');
  if (!resolved) return null;
  if (resolved.externalUrl) return resolved.externalUrl;
  if (!resolved.bucket || !resolved.path) return null;
  return `${config.r2BaseUrl}/${encodeURIComponent(resolved.bucket)}/${encodeObjectPath(resolved.path)}`;
}

function buildRestUrl(endpoint, config) {
  return `${config.supabaseUrl}/rest/v1/${String(endpoint || '').replace(/^\/+/, '')}`;
}

export async function supabaseRestFetch(endpoint, config = getRuntimeConfig()) {
  if (!config.supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY for Supabase REST audit.');
  }
  const response = await fetchWithTimeout(buildRestUrl(endpoint, config), {
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      Accept: 'application/json',
    },
  }, config.fetchTimeoutMs);

  if (!response.ok) {
    throw new Error(`Supabase REST failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function sortProductImages(images = []) {
  return [...images]
    .filter((image) => image?.image_path)
    .sort((a, b) => {
      if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
      const aOrder = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

function groupImagesByProductId(productImages = []) {
  const map = new Map();
  for (const image of productImages || []) {
    if (!image?.product_id) continue;
    const list = map.get(image.product_id) || [];
    list.push(image);
    map.set(image.product_id, list);
  }
  return map;
}

function buildProductUrl(product, categorySlug, config) {
  return `${config.baseUrl}/san-pham/${categorySlug || 'khac'}/${product.slug || product.id}`;
}

async function readPublicProductInventoryFromAiCatalog(config) {
  const response = await fetchWithTimeout(`${config.baseUrl}/ai/products.json`, {
    headers: {
      Accept: 'application/json',
      'user-agent': GOOGLEBOT_UA,
    },
  }, config.fetchTimeoutMs);

  if (!response.ok) {
    throw new Error(`AI product catalog unavailable: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const products = Array.isArray(payload?.products) ? payload.products : [];
  if (products.length === 0) {
    throw new Error('AI product catalog returned no products');
  }

  return products.map((product) => {
    const url = String(product.url || '').trim();
    const parsed = url ? new URL(url, config.baseUrl) : null;
    const segments = parsed ? parsed.pathname.split('/').filter(Boolean) : [];
    const categorySlug = segments[1] || product.category?.slug || 'khac';
    const slug = segments[2] || slugify(product.name);
    const canonicalUrl = parsed ? `${config.baseUrl}${parsed.pathname}` : `${config.baseUrl}/san-pham/${categorySlug}/${slug}`;
    const imageUrl = product.image || null;
    return {
      id: product.id,
      sku: product.sku || null,
      name: product.name || '',
      slug,
      brand: product.brand || null,
      category: product.category ? {
        id: null,
        slug: categorySlug,
        name: product.category.name || '',
      } : null,
      canonical_url: canonicalUrl,
      primary_image_url: imageUrl,
      primary_image_path: imageUrl,
      image_count: imageUrl ? 1 : 0,
      images: imageUrl ? [{
        id: null,
        image_path: imageUrl,
        image_url: imageUrl,
        is_primary: true,
        display_order: 0,
        role: 'primary',
      }] : [],
      price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
      availability: product.availability || null,
      updated_at: product.updated_at || null,
    };
  });
}

export async function readPublicProductInventory(config = getRuntimeConfig()) {
  if (process.env.PRODUCT_IMAGE_SEO_SOURCE !== 'supabase') {
    try {
      return await readPublicProductInventoryFromAiCatalog(config);
    } catch (error) {
      if (process.env.PRODUCT_IMAGE_SEO_SOURCE === 'ai') {
        throw error;
      }
    }
  }

  const [products, categories, productImages] = await Promise.all([
    supabaseRestFetch('products?is_published=eq.true&archived_at=is.null&select=id,slug,category_id,name,description,price,stock_quantity,brand,sku,updated_at&order=id.asc&limit=5000', config),
    supabaseRestFetch('product_categories?select=id,slug,name&order=name.asc&limit=1000', config),
    supabaseRestFetch('product_images?select=id,product_id,image_path,is_primary,display_order&order=product_id.asc,display_order.asc&limit=10000', config),
  ]);

  const categoryById = new Map((categories || []).map((category) => [category.id, category]));
  const imagesByProductId = groupImagesByProductId(productImages || []);

  return (products || []).map((product) => {
    const category = categoryById.get(product.category_id);
    const images = sortProductImages(imagesByProductId.get(product.id) || []);
    const primaryImage = images[0] || null;
    const canonicalUrl = buildProductUrl(product, category?.slug, config);
    const imageRecords = images.map((image, index) => {
      const url = resolveProductImageUrl(image.image_path, config);
      return {
        id: image.id,
        image_path: image.image_path,
        image_url: url,
        is_primary: Boolean(image.is_primary),
        display_order: image.display_order ?? index,
        role: index === 0 ? 'primary' : 'gallery',
      };
    });

    return {
      id: product.id,
      sku: product.sku || null,
      name: product.name || '',
      slug: product.slug || String(product.id),
      brand: product.brand || null,
      category: category ? {
        id: category.id,
        slug: category.slug || 'khac',
        name: category.name || '',
      } : null,
      canonical_url: canonicalUrl,
      primary_image_url: primaryImage ? resolveProductImageUrl(primaryImage.image_path, config) : null,
      primary_image_path: primaryImage?.image_path || null,
      image_count: imageRecords.length,
      images: imageRecords,
      price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
      availability: Number(product.stock_quantity || 0) > 0 ? 'in_stock' : 'out_of_stock',
      updated_at: product.updated_at || null,
    };
  });
}

export async function writeJsonFile(outputPath, value) {
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function getAttr(tag, name) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'))?.[1]?.trim() || '';
}

export function extractTitle(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
}

export function extractMeta(html, attrName, attrValue) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => getAttr(candidate, attrName).toLowerCase() === attrValue.toLowerCase());
  return tag ? getAttr(tag, 'content') : '';
}

export function extractLink(html, rel) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => getAttr(candidate, 'rel').toLowerCase() === rel.toLowerCase());
  return tag ? getAttr(tag, 'href') : '';
}

export function extractJsonLdObjects(html) {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const objects = [];

  const collect = (payload) => {
    if (!payload) return;
    if (Array.isArray(payload)) {
      payload.forEach(collect);
      return;
    }
    if (typeof payload !== 'object') return;
    objects.push(payload);
    if (payload['@graph']) collect(payload['@graph']);
  };

  for (const script of scripts) {
    try {
      collect(JSON.parse(script[1]));
    } catch {
      objects.push({ '@type': 'MalformedJsonLd' });
    }
  }

  return objects;
}

export function objectHasType(object, type) {
  const rawType = object?.['@type'];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  return types.some((candidate) => String(candidate || '').toLowerCase() === type.toLowerCase());
}

export function findJsonLdObject(objects, type) {
  return objects.find((object) => objectHasType(object, type));
}

export function summarizeInventory(products) {
  const missingPrimaryImage = products.filter((product) => !product.primary_image_url);
  const duplicatePrimaryImageMap = new Map();
  for (const product of products) {
    if (!product.primary_image_url) continue;
    const list = duplicatePrimaryImageMap.get(product.primary_image_url) || [];
    list.push(product);
    duplicatePrimaryImageMap.set(product.primary_image_url, list);
  }
  const duplicatePrimaryImages = [...duplicatePrimaryImageMap.values()].filter((list) => list.length > 1);

  return {
    product_count: products.length,
    products_with_primary_image: products.length - missingPrimaryImage.length,
    products_without_primary_image: missingPrimaryImage.length,
    duplicate_primary_image_groups: duplicatePrimaryImages.length,
    missing_primary_image_samples: missingPrimaryImage.slice(0, 20).map((product) => ({
      id: product.id,
      name: product.name,
      canonical_url: product.canonical_url,
    })),
    duplicate_primary_image_samples: duplicatePrimaryImages.slice(0, 10).map((list) => ({
      image_url: list[0]?.primary_image_url,
      products: list.map((product) => ({
        id: product.id,
        name: product.name,
        canonical_url: product.canonical_url,
      })),
    })),
  };
}
