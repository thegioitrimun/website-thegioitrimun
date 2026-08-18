import {
  fetchWithTimeout,
  getRuntimeConfig,
  loadDotEnv,
} from './lib/productImageSeoCatalog.mjs';

await loadDotEnv();

const config = getRuntimeConfig();
const FAIL_ON_FINDINGS = process.env.SEO_AUDIT_FAIL_ON_FINDINGS === '1';
const FEED_PATH = '/feeds/google-products.xml';

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${escapeRegExp(tag)}>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function getAllTags(block, tag) {
  return [...block.matchAll(new RegExp(`<${escapeRegExp(tag)}>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, 'gi'))]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
}

function isProductDetailUrl(value) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[0] === 'san-pham' && segments.length >= 3;
  } catch {
    return false;
  }
}

function auditItem(item, index) {
  const requiredTags = [
    'g:id',
    'g:title',
    'g:description',
    'g:link',
    'g:image_link',
    'g:availability',
    'g:price',
    'g:brand',
    'g:condition',
  ];
  const values = Object.fromEntries(requiredTags.map((tag) => [tag, getTag(item, tag)]));
  const notes = [];

  for (const tag of requiredTags) {
    if (!values[tag]) notes.push(`missing ${tag}`);
  }

  if (values['g:link']) {
    try {
      const parsed = new URL(values['g:link']);
      if (parsed.protocol !== 'https:') notes.push('product link is not HTTPS');
      if (parsed.hostname !== new URL(config.baseUrl).hostname) notes.push(`product link host mismatch: ${parsed.hostname}`);
      if (parsed.pathname === '/' || !isProductDetailUrl(values['g:link'])) notes.push(`product link is not a product detail URL: ${parsed.pathname}`);
    } catch {
      notes.push('invalid product link');
    }
  }

  if (values['g:image_link']) {
    try {
      const parsed = new URL(values['g:image_link']);
      if (parsed.protocol !== 'https:') notes.push('image link is not HTTPS');
      if (/\/icons\/|\/seo\/og-default|\/hero|placeholder/i.test(parsed.pathname)) notes.push(`image link looks generic: ${parsed.pathname}`);
    } catch {
      notes.push('invalid image link');
    }
  }

  if (values['g:price'] && !/^\d+\s+VND$/i.test(values['g:price'])) {
    notes.push(`invalid price format: ${values['g:price']}`);
  }

  if (values['g:availability'] && !/^(in_stock|out_of_stock|preorder|backorder)$/i.test(values['g:availability'])) {
    notes.push(`invalid availability: ${values['g:availability']}`);
  }

  const additionalImages = getAllTags(item, 'g:additional_image_link');
  for (const imageUrl of additionalImages) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== 'https:') notes.push(`additional image is not HTTPS: ${parsed.pathname}`);
    } catch {
      notes.push('invalid additional image link');
    }
  }

  return {
    index,
    id: values['g:id'] || null,
    title: values['g:title'] || null,
    link: values['g:link'] || null,
    image: values['g:image_link'] || null,
    additionalImageCount: additionalImages.length,
    notes,
  };
}

const url = `${config.baseUrl}${FEED_PATH}`;
const response = await fetchWithTimeout(url, {
  headers: {
    Accept: 'application/xml,text/xml,*/*',
    'user-agent': 'Mozilla/5.0 (compatible; TheGioiTriMunSeoAudit/1.0)',
  },
}, config.fetchTimeoutMs);
const text = await response.text();

const itemBlocks = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
const rows = itemBlocks.map((item, index) => auditItem(item, index + 1));
const ids = new Map();
for (const row of rows) {
  if (!row.id) continue;
  ids.set(row.id, (ids.get(row.id) || 0) + 1);
}
const duplicateIds = [...ids.entries()]
  .filter(([, count]) => count > 1)
  .map(([id, count]) => ({ id, count }));

const notes = [];
if (response.status !== 200) notes.push(`HTTP ${response.status}`);
const contentType = response.headers.get('content-type') || '';
if (!contentType.includes('xml')) notes.push(`unexpected content-type: ${contentType}`);
if (itemBlocks.length === 0) notes.push('no <item> entries found');
if (duplicateIds.length > 0) notes.push(`${duplicateIds.length} duplicate product IDs`);

const itemFindings = rows.filter((row) => row.notes.length > 0);
const summary = {
  url,
  generatedAt: new Date().toISOString(),
  status: response.status,
  contentType,
  itemCount: itemBlocks.length,
  itemsWithFindings: itemFindings.length,
  duplicateIds,
  notes,
  sampleFindings: itemFindings.slice(0, 30),
};

console.log(JSON.stringify(summary, null, 2));

if (FAIL_ON_FINDINGS && (notes.length > 0 || itemFindings.length > 0 || duplicateIds.length > 0)) {
  process.exitCode = 2;
}
