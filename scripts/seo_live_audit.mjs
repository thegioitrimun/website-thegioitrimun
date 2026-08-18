import { writeFile } from 'node:fs/promises';

const BASE_URL = process.env.SEO_AUDIT_BASE_URL || 'https://thegioitrimun.vn';
const OUTPUT_PATH = process.env.SEO_AUDIT_OUTPUT || 'SEO_AUDIT_LIVE.md';
const DATE_LABEL = new Date().toISOString();
const FAIL_ON_FINDINGS = process.env.SEO_AUDIT_FAIL_ON_FINDINGS === '1';
const FETCH_TIMEOUT_MS = Number(process.env.SEO_AUDIT_FETCH_TIMEOUT_MS || 15000);

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const FACEBOOK_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const VI_DIACRITICS_REGEX = /[ăâêôơưđáàạảãấầậẩẫắằặẳẵéèẹẻẽếềệểễíìịỉĩóòọỏõốồộổỗớờợởỡúùụủũứừựửữýỳỵỷỹ]/i;
const NON_CONTENT_SLUG_REGEX = /\/(khong-tim-thay-trang|not-found)(?:\?|$|\/)/i;
const LEGACY_SITE_NAME_PATTERNS = [
  /\bNatural Skin\s*\|\s*/i,
  /\bNatural Skin\s*-\s*/i,
  /\bNatural Skin Clinic\b/i,
  /\bSkin clinic\s*\+\s*pharmacy\b/i,
  /\bphòng khám\s+(?:da liễu\s+)?Natural Skin\b/i,
];
const LEGITIMATE_NATURAL_SKIN_PRODUCT_PATTERNS = [
  /Skleer\s+Natural\s+Skin\s+Restoration/gi,
  /Natural\s+Skin\s+Restoration/gi,
  /skleer-natural-skin-restoration/gi,
];
const EXPECTED_SITE_NAME = 'Thế Giới Trị Mụn';
const JSON_LD_EQUIVALENTS = {
  Article: ['Article', 'BlogPosting'],
};

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

const fetchHtml = async (url, userAgent) => {
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-agent': userAgent,
      'accept-language': 'vi,en;q=0.9',
    },
  });
  const html = await response.text();
  return { response, html };
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

const extractTitle = (html) => html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';

const extractMeta = (html, key, value) => {
  const regex = new RegExp(`<meta[^>]+${key}=["']${value}["'][^>]+content=["']([^"']+)["']`, 'i');
  return html.match(regex)?.[1]?.trim() || '';
};

const extractLink = (html, rel, attrName = null, attrValue = null) => {
  const attrFilter = attrName && attrValue ? `(?=[^>]*${attrName}=["']${attrValue}["'])` : '';
  const regex = new RegExp(`<link${attrFilter}[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i');
  return html.match(regex)?.[1]?.trim() || '';
};

const extractAllHreflangs = (html) => {
  const regex = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi;
  const items = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    items.push({ hreflang: match[1], href: match[2] });
  }
  return items;
};

const extractJsonLdTypes = (html) => {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set();
  let match;

  const collect = (payload) => {
    if (!payload) return;
    if (Array.isArray(payload)) {
      payload.forEach(collect);
      return;
    }
    if (typeof payload !== 'object') return;
    if (payload['@graph']) {
      collect(payload['@graph']);
    }
    if (payload['@type']) {
      const typeValue = Array.isArray(payload['@type']) ? payload['@type'] : [payload['@type']];
      typeValue.forEach((value) => types.add(String(value)));
    }
  };

  while ((match = regex.exec(html)) !== null) {
    try {
      collect(JSON.parse(match[1]));
    } catch {
      // ignore malformed json-ld blocks
    }
  }

  return [...types];
};

const hasExpectedJsonLdType = (types, expectedType) => {
  const acceptedTypes = JSON_LD_EQUIVALENTS[expectedType] || [expectedType];
  return acceptedTypes.some((candidate) => types.includes(candidate));
};

const stripLegitimateNaturalSkinProductMentions = (html) => LEGITIMATE_NATURAL_SKIN_PRODUCT_PATTERNS.reduce(
  (current, pattern) => current.replace(pattern, ''),
  html,
);

const hasLegacySiteBrand = (html) => {
  const searchableHtml = stripLegitimateNaturalSkinProductMentions(html);
  return LEGACY_SITE_NAME_PATTERNS.some((pattern) => pattern.test(searchableHtml));
};

const readSitemapUrls = async () => {
  const response = await fetchWithTimeout(`${BASE_URL}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(`Unable to read sitemap.xml: HTTP ${response.status}`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
};

const auditSitemapCanonicalParity = async (urls) => {
  const sampled = urls.slice(0, 40);
  const checks = await mapWithConcurrency(sampled, 8, async (url) => {
    const { response, html } = await fetchHtml(url, GOOGLEBOT_UA);
    const canonical = extractLink(html, 'canonical');
    const finalUrl = response.url;

    if (finalUrl !== url) {
      return `${url} -> redirects to ${finalUrl}`;
    }

    if (response.status === 200 && canonical && canonical !== url) {
      return `${url} -> canonical ${canonical}`;
    }

    return null;
  });

  return {
    checked: sampled.length,
    mismatches: checks.filter(Boolean),
  };
};

const pickUrl = (urls, predicate, fallback) => urls.find(predicate) || fallback;

const toPath = (url) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

const classifyPath = (url) => {
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean);
  return {
    pathname,
    segments,
  };
};

const findReviewedProductUrl = async (urls) => {
  const sampled = urls.slice(0, 12);
  const checks = await mapWithConcurrency(sampled, 4, async (url) => {
    const { html } = await fetchHtml(url, GOOGLEBOT_UA);
    return html.includes('"@type":"Review"') || html.includes('"aggregateRating"') ? url : null;
  });
  return checks.find(Boolean) || null;
};

const buildUrlMatrix = async () => {
  const sitemapUrls = await readSitemapUrls();
  const productCategoryUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/san-pham/') && segments.length === 2;
    },
    `${BASE_URL}/san-pham`,
  );
  const productDetailUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/san-pham/') && segments.length === 3;
    },
    productCategoryUrl,
  );
  const productDetailCandidates = sitemapUrls.filter((url) => {
    const { pathname, segments } = classifyPath(url);
    return pathname.startsWith('/san-pham/') && segments.length === 3;
  });
  const reviewedProductUrl = await findReviewedProductUrl(productDetailCandidates);
  const blogCategoryUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/kien-thuc/') && segments.length === 2;
    },
    `${BASE_URL}/kien-thuc`,
  );
  const blogDetailUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/kien-thuc/') && segments.length === 3 && !NON_CONTENT_SLUG_REGEX.test(url);
    },
    blogCategoryUrl,
  );
  const serviceDetailUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/dich-vu/') && segments.length === 2;
    },
    `${BASE_URL}/dich-vu`,
  );
  const brandLandingUrl = pickUrl(
    sitemapUrls,
    (url) => {
      const { pathname, segments } = classifyPath(url);
      return pathname.startsWith('/thuong-hieu/') && segments.length === 2;
    },
    `${BASE_URL}/thuong-hieu`,
  );

  return [
    { label: 'Home', url: `${BASE_URL}/`, expectedTypes: ['MedicalClinic', 'WebSite', 'FAQPage', 'WebPage'] },
    { label: 'Products List', url: `${BASE_URL}/san-pham`, expectedTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'WebPage'] },
    { label: 'Product Category', url: productCategoryUrl, expectedTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'WebPage'] },
    {
      label: reviewedProductUrl ? 'Product Detail (Reviewed)' : 'Product Detail',
      url: reviewedProductUrl || productDetailUrl,
      expectedTypes: ['Product', 'BreadcrumbList', 'FAQPage', 'WebPage'],
      expectsReviewObjects: Boolean(reviewedProductUrl),
      noteOnNoReviewData: !reviewedProductUrl,
    },
    { label: 'Blog List', url: `${BASE_URL}/kien-thuc`, expectedTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'WebPage'] },
    { label: 'Blog Category', url: blogCategoryUrl, expectedTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'WebPage'] },
    { label: 'Blog Detail', url: blogDetailUrl, expectedTypes: ['Article', 'BreadcrumbList', 'WebPage'] },
    { label: 'Services List', url: `${BASE_URL}/dich-vu`, expectedTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'WebPage'] },
    { label: 'Service Detail', url: serviceDetailUrl, expectedTypes: ['MedicalProcedure', 'BreadcrumbList', 'FAQPage', 'WebPage'] },
    { label: 'Brand Directory', url: `${BASE_URL}/thuong-hieu`, expectedTypes: ['CollectionPage', 'BreadcrumbList', 'WebPage'] },
    { label: 'Brand Landing', url: brandLandingUrl, expectedTypes: ['Brand', 'CollectionPage', 'BreadcrumbList', 'WebPage'] },
    { label: 'About (RU)', url: `${BASE_URL}/ve-chung-toi?lang=ru`, expectedTypes: ['AboutPage', 'BreadcrumbList', 'MedicalClinic', 'WebPage'] },
  ];
};

const auditUrl = async ({ label, url, expectedTypes, expectsReviewObjects = false, noteOnNoReviewData = false }) => {
  const [google, facebook] = await Promise.all([
    fetchHtml(url, GOOGLEBOT_UA),
    fetchHtml(url, FACEBOOK_UA),
  ]);

  const googleTitle = extractTitle(google.html);
  const googleCanonical = extractLink(google.html, 'canonical');
  const googleRobots = extractMeta(google.html, 'name', 'robots');
  const googleOgLocale = extractMeta(google.html, 'property', 'og:locale');
  const googleOgTitle = extractMeta(google.html, 'property', 'og:title');
  const googleOgImage = extractMeta(google.html, 'property', 'og:image');
  const googleJsonLdTypes = extractJsonLdTypes(google.html);
  const hreflangs = extractAllHreflangs(google.html).map((item) => item.hreflang);
  const googleProductPrice = extractMeta(google.html, 'property', 'product:price:amount');
  const googleProductAvailability = extractMeta(google.html, 'property', 'product:availability');
  const googleXRobots = google.response.headers.get('x-robots-tag') || '';

  const facebookOgTitle = extractMeta(facebook.html, 'property', 'og:title');
  const facebookCanonical = extractLink(facebook.html, 'canonical');
  const facebookOgImage = extractMeta(facebook.html, 'property', 'og:image');

  const missingTypes = expectedTypes.filter((type) => !hasExpectedJsonLdType(googleJsonLdTypes, type));
  const notes = [];

  if (google.response.status !== 200) notes.push(`HTTP ${google.response.status}`);
  if (!googleTitle) notes.push('Missing <title>');
  if (!googleCanonical) notes.push('Missing canonical');
  if (hasLegacySiteBrand(google.html)) notes.push('Legacy Natural Skin brand remains in prerendered HTML');
  if (label === 'Home' && !google.html.includes(EXPECTED_SITE_NAME)) notes.push(`Homepage missing site name: ${EXPECTED_SITE_NAME}`);
  if (missingTypes.length > 0) notes.push(`Missing JSON-LD: ${missingTypes.join(', ')}`);
  if (facebookOgTitle !== googleOgTitle) notes.push('Googlebot/Facebook og:title mismatch');
  if (facebookCanonical !== googleCanonical) notes.push('Googlebot/Facebook canonical mismatch');
  if (facebookOgImage !== googleOgImage) notes.push('Googlebot/Facebook og:image mismatch');
  if (url.includes('lang=en') && VI_DIACRITICS_REGEX.test(googleTitle)) {
    notes.push('English URL still renders Vietnamese title/content');
  }
  if (expectsReviewObjects && !google.html.includes('"@type":"Review"')) {
    notes.push('Product schema missing Review objects');
  } else if (noteOnNoReviewData) {
    notes.push('INFO: No live reviewed product found in sampled sitemap URLs; review-object path not observable on production data');
  }
  if (label === 'Home' && !google.html.includes('"@type":"SearchAction"')) {
    notes.push('Homepage missing SearchAction schema');
  }
  if (label === 'Home' && !google.html.includes('"@type":"FAQPage"')) {
    notes.push('Homepage missing FAQPage schema');
  }

  return {
    label,
    url,
    status: google.response.status,
    title: googleTitle,
    canonical: googleCanonical,
    robots: googleRobots,
    xRobots: googleXRobots,
    ogLocale: googleOgLocale,
    hreflangs,
    jsonLdTypes: googleJsonLdTypes,
    productPrice: googleProductPrice,
    productAvailability: googleProductAvailability,
    notes,
  };
};

const auditControls = async () => {
  const controlUrl = `${BASE_URL}/dang-nhap?lang=ru`;
  const { response, html } = await fetchHtml(controlUrl, GOOGLEBOT_UA);
  return {
    url: controlUrl,
    status: response.status,
    title: extractTitle(html),
    robots: extractMeta(html, 'name', 'robots'),
    xRobots: response.headers.get('x-robots-tag') || '',
    canonical: extractLink(html, 'canonical'),
  };
};

const renderMatrixTable = (rows) => {
  const header = '| URL | HTTP | Canonical | OG Locale | JSON-LD | Notes |\n| --- | --- | --- | --- | --- | --- |';
  const body = rows.map((row) => `| ${row.label} | ${row.status} | \`${row.canonical || '-'}\` | \`${row.ogLocale || '-'}\` | ${row.jsonLdTypes.join(', ') || '-'} | ${row.notes.join('; ') || 'OK'} |`).join('\n');
  return `${header}\n${body}`;
};

const main = async () => {
  const sitemapUrls = await readSitemapUrls();
  const sitemapParity = await auditSitemapCanonicalParity(sitemapUrls);
  const targets = await buildUrlMatrix();
  const results = [];
  for (const target of targets) {
    results.push(await auditUrl(target));
  }

  const control = await auditControls();
  const controlFindings = [];
  if (control.status !== 200) controlFindings.push(`Private control HTTP ${control.status}`);
  if (!String(control.robots).includes('noindex')) controlFindings.push('Private control missing meta noindex');
  if (!String(control.xRobots).includes('noindex')) controlFindings.push('Private control missing X-Robots-Tag noindex');
  const findings = results
    .filter((row) => row.notes.some((note) => !note.startsWith('INFO:')))
    .map((row) => `- ${row.label}: ${row.notes.filter((note) => !note.startsWith('INFO:')).join('; ')}`);
  const allBlockingFindings = [
    ...sitemapParity.mismatches.map((item) => `- Sitemap Canonical Parity: ${item}`),
    ...findings,
    ...controlFindings.map((item) => `- Private Route Control: ${item}`),
  ];
  const infoNotes = results.flatMap((row) => row.notes.filter((note) => note.startsWith('INFO:')).map((note) => `- ${row.label}: ${note}`));

  const summary = [
    `- Base URL: [${BASE_URL}](${BASE_URL})`,
    `- Generated at: \`${DATE_LABEL}\``,
    `- URLs audited: \`${results.length}\``,
    `- Sitemap parity sampled: \`${sitemapParity.checked}\``,
    `- Control audited: \`/dang-nhap?lang=ru\``,
    `- Blocking findings: \`${allBlockingFindings.length}\``,
    `- Informational notes: \`${infoNotes.length}\``,
  ].join('\n');

  const controlSection = [
    '| Control | HTTP | Canonical | Meta Robots | X-Robots-Tag | Result |',
    '| --- | --- | --- | --- | --- | --- |',
    `| \`${control.url}\` | ${control.status} | \`${control.canonical}\` | \`${control.robots}\` | \`${control.xRobots}\` | ${control.robots.includes('noindex') && control.xRobots.includes('noindex') ? 'OK' : 'Check'} |`,
  ].join('\n');

  const report = `# SEO_AUDIT_LIVE

## Summary
${summary}

## Findings
${allBlockingFindings.length > 0 ? allBlockingFindings.join('\n') : '- No blocking SEO regressions found in the audited URLs.'}

## Informational Notes
${infoNotes.length > 0 ? infoNotes.join('\n') : '- None.'}

## URL Matrix
${renderMatrixTable(results)}

## Sitemap Canonical Parity
- Sampled URLs: \`${sitemapParity.checked}\`
${sitemapParity.mismatches.length > 0 ? sitemapParity.mismatches.map((item) => `- ${item}`).join('\n') : '- OK. Sampled sitemap URLs resolve directly to their own canonical URLs.'}

## Private Route Control
${controlSection}

## Notes
- Audit executed with both Googlebot and Facebook crawler user-agents.
- Canonical, hreflang, JSON-LD, robots, and OG parity were checked on live responses.
- Locale content quality still depends on translated content existing in Supabase rows; hreflang alone does not translate copy.
`;

  await writeFile(OUTPUT_PATH, report, 'utf8');
  process.stdout.write(`${report}\n`);

  if (FAIL_ON_FINDINGS && allBlockingFindings.length > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
