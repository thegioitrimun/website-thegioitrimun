import {
  GOOGLEBOT_UA,
  fetchWithTimeout,
  getRuntimeConfig,
  loadDotEnv,
} from './lib/productImageSeoCatalog.mjs';

await loadDotEnv();

const config = getRuntimeConfig();
const FAIL_ON_FINDINGS = process.env.SEO_AUDIT_FAIL_ON_FINDINGS === '1';

async function fetchText(pathname, accept = '*/*') {
  const url = `${config.baseUrl}${pathname}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-agent': GOOGLEBOT_UA,
      accept,
    },
  }, config.fetchTimeoutMs);
  return {
    url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    text: await response.text(),
  };
}

function readXmlLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function summarizeProductSitemap(result) {
  const locs = readXmlLocs(result.text);
  const productLocs = locs.filter((url) => {
    try {
      const segments = new URL(url).pathname.split('/').filter(Boolean);
      return segments[0] === 'san-pham' && segments.length === 3;
    } catch {
      return false;
    }
  });
  const notes = [];
  if (result.status !== 200) notes.push(`HTTP ${result.status}`);
  if (!result.contentType.includes('xml')) notes.push(`Unexpected content-type: ${result.contentType}`);
  if (productLocs.length === 0) notes.push('No product detail URLs found');
  if (locs.some((url) => /thegioitrimun\.vn\/?$/.test(url) && productLocs.includes(url))) {
    notes.push('Product sitemap contains homepage as product URL');
  }
  return {
    endpoint: '/sitemap-products.xml',
    locCount: locs.length,
    productLocCount: productLocs.length,
    notes,
  };
}

function summarizeImageSitemap(result) {
  const locs = readXmlLocs(result.text);
  const imageCount = countMatches(result.text, /<image:image>/g);
  const imageLocCount = countMatches(result.text, /<image:loc>/g);
  const notes = [];
  if (result.status !== 200) notes.push(`HTTP ${result.status}`);
  if (!result.contentType.includes('xml')) notes.push(`Unexpected content-type: ${result.contentType}`);
  if (locs.length === 0) notes.push('No URL entries found');
  if (imageCount === 0 || imageLocCount === 0) notes.push('No image sitemap entries found');
  if (/\/seo\/og-default|\/icons\/natural-skin/i.test(result.text)) notes.push('Image sitemap appears to include generic site image');
  return {
    endpoint: '/sitemap-images.xml',
    locCount: locs.length,
    imageCount,
    imageLocCount,
    notes,
  };
}

function summarizeMerchantFeed(result) {
  const itemCount = countMatches(result.text, /<item>/g);
  const linkCount = countMatches(result.text, /<g:link>/g);
  const imageLinkCount = countMatches(result.text, /<g:image_link>/g);
  const homepageProductLinks = [...result.text.matchAll(/<g:link>([^<]+)<\/g:link>/g)]
    .map((match) => match[1])
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.pathname === '/' || parsed.pathname === '';
      } catch {
        return false;
      }
    });
  const notes = [];
  if (result.status !== 200) notes.push(`HTTP ${result.status}`);
  if (!result.contentType.includes('xml')) notes.push(`Unexpected content-type: ${result.contentType}`);
  if (itemCount === 0) notes.push('No product feed items found');
  if (linkCount !== itemCount) notes.push(`Product feed link count mismatch: ${linkCount}/${itemCount}`);
  if (imageLinkCount !== itemCount) notes.push(`Product feed image count mismatch: ${imageLinkCount}/${itemCount}`);
  if (homepageProductLinks.length > 0) notes.push(`${homepageProductLinks.length} product feed links point to homepage`);
  return {
    endpoint: '/feeds/google-products.xml',
    itemCount,
    linkCount,
    imageLinkCount,
    notes,
  };
}

function summarizeAiProducts(result) {
  const notes = [];
  let payload = null;
  try {
    payload = JSON.parse(result.text);
  } catch {
    notes.push('Invalid JSON');
  }
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const productsWithImage = products.filter((product) => product.image).length;
  const homepageUrls = products.filter((product) => {
    try {
      const parsed = new URL(product.url);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  });
  if (result.status !== 200) notes.push(`HTTP ${result.status}`);
  if (!result.contentType.includes('json')) notes.push(`Unexpected content-type: ${result.contentType}`);
  if (products.length === 0) notes.push('No AI product records found');
  if (productsWithImage === 0) notes.push('No AI product images found');
  if (homepageUrls.length > 0) notes.push(`${homepageUrls.length} AI product URLs point to homepage`);
  return {
    endpoint: '/ai/products.json',
    productCount: products.length,
    productsWithImage,
    notes,
  };
}

function summarizeLlmsText(result) {
  const notes = [];
  if (result.status !== 200) notes.push(`HTTP ${result.status}`);
  if (!result.contentType.includes('text/plain')) notes.push(`Unexpected content-type: ${result.contentType}`);
  if (!result.text.includes('/ai/products.json')) notes.push('llms.txt missing product catalog pointer');
  if (!result.text.includes('/feeds/google-products.xml')) notes.push('llms.txt missing product feed pointer');
  return {
    endpoint: '/llms.txt',
    length: result.text.length,
    notes,
  };
}

const [
  productSitemap,
  imageSitemap,
  merchantFeed,
  aiProducts,
  llmsText,
] = await Promise.all([
  fetchText('/sitemap-products.xml', 'application/xml'),
  fetchText('/sitemap-images.xml', 'application/xml'),
  fetchText('/feeds/google-products.xml', 'application/xml'),
  fetchText('/ai/products.json', 'application/json'),
  fetchText('/llms.txt', 'text/plain'),
]);

const results = [
  summarizeProductSitemap(productSitemap),
  summarizeImageSitemap(imageSitemap),
  summarizeMerchantFeed(merchantFeed),
  summarizeAiProducts(aiProducts),
  summarizeLlmsText(llmsText),
];

const findings = results.filter((result) => result.notes.length > 0);
console.log(JSON.stringify({
  baseUrl: config.baseUrl,
  generatedAt: new Date().toISOString(),
  results,
  findingCount: findings.length,
}, null, 2));

if (FAIL_ON_FINDINGS && findings.length > 0) {
  process.exitCode = 2;
}
