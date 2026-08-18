import { writeFile } from 'node:fs/promises';

const BASE_URL = process.env.SEO_AUDIT_BASE_URL || 'https://thegioitrimun.vn';
const OUTPUT_PATH = process.env.SEO_AUDIT_OUTPUT || 'SEO_PRODUCT_SERVICE_AUDIT.md';
const FAIL_ON_FINDINGS = process.env.SEO_AUDIT_FAIL_ON_FINDINGS === '1';
const FETCH_TIMEOUT_MS = Number(process.env.SEO_AUDIT_FETCH_TIMEOUT_MS || 20000);
const CONCURRENCY = Number(process.env.SEO_AUDIT_CONCURRENCY || 8);
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timeout after ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchHtml = async (url) => {
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-agent': GOOGLEBOT_UA,
      'accept-language': 'vi,en;q=0.9',
    },
  });
  return {
    response,
    html: await response.text(),
  };
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
};

const getAttr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'))?.[1]?.trim() || '';

const extractTitle = (html) => html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';

const extractMeta = (html, attrName, attrValue) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => getAttr(candidate, attrName).toLowerCase() === attrValue.toLowerCase());
  return tag ? getAttr(tag, 'content') : '';
};

const extractLink = (html, rel) => {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => getAttr(candidate, 'rel').toLowerCase() === rel.toLowerCase());
  return tag ? getAttr(tag, 'href') : '';
};

const normalizeUrl = (value) => {
  const parsed = new URL(value, BASE_URL);
  parsed.hash = '';
  parsed.search = '';
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
};

const objectHasType = (object, type) => {
  const rawType = object?.['@type'];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  return types.some((candidate) => String(candidate).toLowerCase() === type.toLowerCase());
};

const extractJsonLdObjects = (html) => {
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
};

const findJsonLdObject = (objects, type) => objects.find((object) => objectHasType(object, type));

const hasJsonLdType = (objects, type) => Boolean(findJsonLdObject(objects, type));

const readSitemapUrls = async () => {
  const response = await fetchWithTimeout(`${BASE_URL}/sitemap.xml`, {
    headers: { 'user-agent': GOOGLEBOT_UA },
  });
  if (!response.ok) {
    throw new Error(`Unable to read sitemap.xml: HTTP ${response.status}`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
};

const classifyUrl = (url) => {
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean);
  return { pathname, segments };
};

const isProductDetailUrl = (url) => {
  const { pathname, segments } = classifyUrl(url);
  return pathname.startsWith('/san-pham/') && segments.length === 3;
};

const isServiceDetailUrl = (url) => {
  const { pathname, segments } = classifyUrl(url);
  return pathname.startsWith('/dich-vu/') && segments.length === 2;
};

const auditProduct = ({ html, objects }) => {
  const notes = [];
  const product = findJsonLdObject(objects, 'Product');
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;

  if (!product) notes.push('Missing Product JSON-LD');
  if (product && !product.name) notes.push('Product JSON-LD missing name');
  if (product && !product.image) notes.push('Product JSON-LD missing image');
  if (!offer) notes.push('Product JSON-LD missing Offer');
  if (offer && offer.priceCurrency !== 'VND') notes.push(`Offer priceCurrency is ${offer.priceCurrency || '-'}`);
  if (offer && !offer.price) notes.push('Offer missing price');
  if (offer && !offer.availability) notes.push('Offer missing availability');
  if (!extractMeta(html, 'property', 'product:price:amount')) notes.push('Missing product:price:amount meta');

  return notes;
};

const auditService = ({ objects }) => {
  const notes = [];
  const procedure = findJsonLdObject(objects, 'MedicalProcedure');
  const provider = procedure?.provider;

  if (!procedure) notes.push('Missing MedicalProcedure JSON-LD');
  if (procedure && !procedure.name) notes.push('MedicalProcedure JSON-LD missing name');
  if (procedure && !procedure.image) notes.push('MedicalProcedure JSON-LD missing image');
  if (procedure && !provider) notes.push('MedicalProcedure JSON-LD missing provider');
  if (provider && !objectHasType(provider, 'MedicalClinic')) notes.push('MedicalProcedure provider is not MedicalClinic');

  return notes;
};

const auditUrl = async (url, kind) => {
  try {
    const { response, html } = await fetchHtml(url);
    const title = extractTitle(html);
    const description = extractMeta(html, 'name', 'description');
    const robots = extractMeta(html, 'name', 'robots');
    const xRobots = response.headers.get('x-robots-tag') || '';
    const canonical = extractLink(html, 'canonical');
    const ogTitle = extractMeta(html, 'property', 'og:title');
    const ogImage = extractMeta(html, 'property', 'og:image');
    const objects = extractJsonLdObjects(html);
    const notes = [];

    if (response.status !== 200) notes.push(`HTTP ${response.status}`);
    if (!title) notes.push('Missing title');
    if (!description) notes.push('Missing meta description');
    if (!canonical) notes.push('Missing canonical');
    if (canonical && normalizeUrl(canonical) !== normalizeUrl(url)) notes.push(`Canonical mismatch: ${canonical}`);
    if (canonical && normalizeUrl(canonical) === normalizeUrl(BASE_URL)) notes.push('Canonical points to homepage');
    if (robots.toLowerCase().includes('noindex')) notes.push('Meta robots noindex');
    if (xRobots.toLowerCase().includes('noindex')) notes.push('X-Robots-Tag noindex');
    if (!ogTitle) notes.push('Missing og:title');
    if (!ogImage) notes.push('Missing og:image');
    if (!hasJsonLdType(objects, 'WebPage')) notes.push('Missing WebPage JSON-LD');
    if (!hasJsonLdType(objects, 'BreadcrumbList')) notes.push('Missing BreadcrumbList JSON-LD');
    if (!/<h1\b[^>]*>/i.test(html)) notes.push('Missing H1');

    if (kind === 'product') notes.push(...auditProduct({ html, objects }));
    if (kind === 'service') notes.push(...auditService({ objects }));

    return {
      kind,
      url,
      status: response.status,
      title,
      canonical,
      jsonLdTypes: [...new Set(objects.flatMap((object) => Array.isArray(object['@type']) ? object['@type'] : [object['@type']]).filter(Boolean))],
      notes,
    };
  } catch (error) {
    return {
      kind,
      url,
      status: 'ERR',
      title: '',
      canonical: '',
      jsonLdTypes: [],
      notes: [error instanceof Error ? error.message : String(error)],
    };
  }
};

const renderFindingsTable = (rows) => {
  if (rows.length === 0) return '_No blocking findings._';
  const header = '| Kind | URL | HTTP | Findings |\n| --- | --- | --- | --- |';
  const body = rows.map((row) => `| ${row.kind} | [${new URL(row.url).pathname}](${row.url}) | ${row.status} | ${row.notes.join('; ')} |`).join('\n');
  return `${header}\n${body}`;
};

const main = async () => {
  const sitemapUrls = await readSitemapUrls();
  const productUrls = sitemapUrls.filter(isProductDetailUrl);
  const serviceUrls = sitemapUrls.filter(isServiceDetailUrl);
  const targets = [
    ...productUrls.map((url) => ({ url, kind: 'product' })),
    ...serviceUrls.map((url) => ({ url, kind: 'service' })),
  ];

  const results = await mapWithConcurrency(targets, CONCURRENCY, (target) => auditUrl(target.url, target.kind));
  const blocking = results.filter((row) => row.notes.length > 0);
  const productBlocking = blocking.filter((row) => row.kind === 'product');
  const serviceBlocking = blocking.filter((row) => row.kind === 'service');
  const productOk = productUrls.length - productBlocking.length;
  const serviceOk = serviceUrls.length - serviceBlocking.length;

  const report = `# Product + Service SEO Sitemap Audit

- Base URL: [${BASE_URL}](${BASE_URL})
- Generated at: \`${new Date().toISOString()}\`
- Googlebot UA: \`${GOOGLEBOT_UA}\`
- Product detail URLs in sitemap: \`${productUrls.length}\`
- Service detail URLs in sitemap: \`${serviceUrls.length}\`
- Product URLs OK: \`${productOk}/${productUrls.length}\`
- Service URLs OK: \`${serviceOk}/${serviceUrls.length}\`
- Blocking findings: \`${blocking.length}\`

## Blocking Findings

${renderFindingsTable(blocking)}

## Coverage

| Type | URLs | OK | Findings |
| --- | ---: | ---: | ---: |
| Products | ${productUrls.length} | ${productOk} | ${productBlocking.length} |
| Services | ${serviceUrls.length} | ${serviceOk} | ${serviceBlocking.length} |
`;

  await writeFile(OUTPUT_PATH, report, 'utf8');
  console.log(`SEO product/service audit written to ${OUTPUT_PATH}`);
  console.log(`Products OK: ${productOk}/${productUrls.length}`);
  console.log(`Services OK: ${serviceOk}/${serviceUrls.length}`);
  console.log(`Blocking findings: ${blocking.length}`);

  if (FAIL_ON_FINDINGS && blocking.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
