import { writeFile } from 'node:fs/promises';
import {
  extractJsonLdObjects,
  extractLink,
  extractMeta,
  extractTitle,
  findJsonLdObject,
  GOOGLEBOT_UA,
  fetchWithTimeout,
  getRuntimeConfig,
  loadDotEnv,
  normalizeUrl,
  readPublicProductInventory,
} from './lib/productImageSeoCatalog.mjs';

await loadDotEnv();

const config = getRuntimeConfig();
const MAX_PRODUCTS = Number(process.env.SEO_PRODUCT_AUDIT_MAX_PRODUCTS || 40);
const CONCURRENCY = Number(process.env.SEO_AUDIT_CONCURRENCY || 6);
const OUTPUT_PATH = process.env.SEO_PRODUCT_AUDIT_OUTPUT || 'SEO_GOOGLEBOT_PRODUCT_IMAGE_AUDIT.md';
const FAIL_ON_FINDINGS = process.env.SEO_AUDIT_FAIL_ON_FINDINGS === '1';
const isLocalBaseUrl = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(config.baseUrl);
const EXPECTED_CANONICAL_BASE_URL = String(
  process.env.SEO_EXPECTED_CANONICAL_BASE_URL || (isLocalBaseUrl ? 'https://thegioitrimun.vn' : config.baseUrl),
).replace(/\/+$/, '');

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchHtml(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-agent': GOOGLEBOT_UA,
      'accept-language': 'vi,en;q=0.9',
    },
  }, config.fetchTimeoutMs);
  return {
    response,
    html: await response.text(),
  };
}

function normalizeImageUrl(value) {
  if (!value) return '';
  const parsed = new URL(value, config.baseUrl);
  parsed.hash = '';
  return parsed.toString();
}

function productImageMatches(expected, actual) {
  if (!expected || !actual) return false;
  const expectedUrl = normalizeImageUrl(expected);
  const actualUrl = normalizeImageUrl(actual);
  if (expectedUrl === actualUrl) return true;
  return new URL(expectedUrl).pathname === new URL(actualUrl).pathname;
}

async function auditProduct(product) {
  const notes = [];
  try {
    const { response, html } = await fetchHtml(product.canonical_url);
    const title = extractTitle(html);
    const canonical = extractLink(html, 'canonical');
    const imageSrc = extractLink(html, 'image_src');
    const ogUrl = extractMeta(html, 'property', 'og:url');
    const ogImage = extractMeta(html, 'property', 'og:image');
    const objects = extractJsonLdObjects(html);
    const productJsonLd = findJsonLdObject(objects, 'Product');
    const productPath = new URL(product.canonical_url, config.baseUrl).pathname;
    const expectedCanonicalUrl = `${EXPECTED_CANONICAL_BASE_URL}${productPath}`;
    const normalizedExpectedUrl = normalizeUrl(expectedCanonicalUrl, EXPECTED_CANONICAL_BASE_URL);

    if (response.status !== 200) notes.push(`HTTP ${response.status}`);
    if (!title) notes.push('Missing <title>');
    if (!canonical) notes.push('Missing canonical');
    if (canonical && normalizeUrl(canonical, config.baseUrl) !== normalizedExpectedUrl) {
      notes.push(`Canonical mismatch: ${canonical}`);
    }
    if (canonical && normalizeUrl(canonical, config.baseUrl) === normalizeUrl(config.baseUrl, config.baseUrl)) {
      notes.push('Canonical points to homepage');
    }
    if (!ogUrl) notes.push('Missing og:url');
    if (ogUrl && normalizeUrl(ogUrl, config.baseUrl) !== normalizedExpectedUrl) {
      notes.push(`og:url mismatch: ${ogUrl}`);
    }
    if (!ogImage) notes.push('Missing og:image');
    if (ogImage && /og-default|seo\/og-default|hero/i.test(ogImage) && product.primary_image_url) {
      notes.push(`og:image looks generic: ${ogImage}`);
    }
    if (product.primary_image_url && ogImage && !productImageMatches(product.primary_image_url, ogImage)) {
      notes.push(`og:image does not match primary product image: ${ogImage}`);
    }
    if (!imageSrc) notes.push('Missing rel=image_src');
    if (product.primary_image_url && imageSrc && !productImageMatches(product.primary_image_url, imageSrc)) {
      notes.push(`image_src does not match primary product image: ${imageSrc}`);
    }
    if (!productJsonLd) notes.push('Missing Product JSON-LD');
    if (productJsonLd && !productJsonLd.name) notes.push('Product JSON-LD missing name');
    if (productJsonLd && !productJsonLd.image) notes.push('Product JSON-LD missing image');
    if (productJsonLd?.url && normalizeUrl(productJsonLd.url, config.baseUrl) !== normalizedExpectedUrl) {
      notes.push(`Product JSON-LD url mismatch: ${productJsonLd.url}`);
    }
    if (!product.primary_image_url) notes.push('DB product has no primary image candidate');

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      url: product.canonical_url,
      status: response.status,
      title,
      canonical,
      ogUrl,
      ogImage,
      imageSrc,
      expectedImage: product.primary_image_url,
      notes,
    };
  } catch (error) {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      url: product.canonical_url,
      status: 'ERR',
      title: '',
      canonical: '',
      ogUrl: '',
      ogImage: '',
      imageSrc: '',
      expectedImage: product.primary_image_url,
      notes: [error instanceof Error ? error.message : String(error)],
    };
  }
}

async function auditListing(pathname, sampleProducts) {
  const url = `${config.baseUrl}${pathname}`;
  try {
    const { response, html } = await fetchHtml(url);
    const productLinks = [...new Set(html.match(/\/san-pham\/[^"' <>()]+\/[^"' <>()]+/g) || [])];
    const sampleLinks = sampleProducts
      .slice(0, 12)
      .filter((product) => html.includes(new URL(product.canonical_url).pathname));
    const imageContextCount = (html.match(/seo_context=listing-thumb|product-images/gi) || []).length;
    const notes = [];
    if (response.status !== 200) notes.push(`HTTP ${response.status}`);
    if (productLinks.length === 0) notes.push('No product detail links found in rendered listing HTML');
    if (imageContextCount === 0) notes.push('No product image markers found in rendered listing HTML');
    return {
      url,
      status: response.status,
      productLinkCount: productLinks.length,
      productLinksFound: sampleLinks.length,
      imageContextCount,
      notes,
    };
  } catch (error) {
    return {
      url,
      status: 'ERR',
      productLinksFound: 0,
      imageContextCount: 0,
      notes: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function renderFindings(rows) {
  if (!rows.length) return '_No blocking findings._';
  const header = '| Product | URL | HTTP | Findings |\n| --- | --- | --- | --- |';
  const body = rows.map((row) => {
    const path = new URL(row.url).pathname;
    return `| ${row.name || row.id} | [${path}](${row.url}) | ${row.status} | ${row.notes.join('; ')} |`;
  }).join('\n');
  return `${header}\n${body}`;
}

const inventory = await readPublicProductInventory(config);
const sorted = inventory
  .filter((product) => product.canonical_url)
  .sort((a, b) => {
    if (!!a.primary_image_url !== !!b.primary_image_url) return a.primary_image_url ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });
const sample = MAX_PRODUCTS > 0 ? sorted.slice(0, MAX_PRODUCTS) : sorted;

const [productResults, listingResults] = await Promise.all([
  mapWithConcurrency(sample, CONCURRENCY, auditProduct),
  Promise.all([
    auditListing('/', sample),
    auditListing('/san-pham', sample),
  ]),
]);

const blockingProducts = productResults.filter((row) => row.notes.length > 0);
const blockingListings = listingResults.filter((row) => row.notes.length > 0);
const report = `# Googlebot Product Image SEO Audit

- Base URL: [${config.baseUrl}](${config.baseUrl})
- Expected canonical base URL: [${EXPECTED_CANONICAL_BASE_URL}](${EXPECTED_CANONICAL_BASE_URL})
- Generated at: \`${new Date().toISOString()}\`
- Googlebot UA: \`${GOOGLEBOT_UA}\`
- Products in DB inventory: \`${inventory.length}\`
- Product detail pages checked: \`${productResults.length}\`
- Product detail pages OK: \`${productResults.length - blockingProducts.length}/${productResults.length}\`
- Listing pages OK: \`${listingResults.length - blockingListings.length}/${listingResults.length}\`
- Blocking findings: \`${blockingProducts.length + blockingListings.length}\`

## Product Findings

${renderFindings(blockingProducts)}

## Listing Findings

${blockingListings.length
  ? blockingListings.map((row) => `- [${new URL(row.url).pathname}](${row.url}): ${row.notes.join('; ')}`).join('\n')
  : '_No listing findings._'}

## Checked Products

${productResults.map((row) => `- ${row.notes.length ? 'FAIL' : 'OK'} ${row.name}: ${row.url}`).join('\n')}
`;

await writeFile(OUTPUT_PATH, report, 'utf8');
console.log(JSON.stringify({
  outputPath: OUTPUT_PATH,
  baseUrl: config.baseUrl,
  productsChecked: productResults.length,
  productFindings: blockingProducts.length,
  listingFindings: blockingListings.length,
}, null, 2));

if (FAIL_ON_FINDINGS && (blockingProducts.length > 0 || blockingListings.length > 0)) {
  process.exitCode = 2;
}
