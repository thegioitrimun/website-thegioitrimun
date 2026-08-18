const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const MAX_SAMPLES = Number(process.env.IMAGE_SEO_AUDIT_MAX_SAMPLES || '50');
const FAIL_ON_FINDINGS = process.env.IMAGE_SEO_AUDIT_FAIL_ON_FINDINGS === '1';

if (!ACCESS_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN');
}

const SEO_PATH_PATTERNS = {
  productGallery: /^products\/[a-z0-9-]+\/gallery(?:-\d{2})?(?:-[a-z0-9-]+)?\.[a-z0-9]+$/i,
  productContent: /^products\/[a-z0-9-]+\/details\/detail(?:-\d{2})?(?:-[a-z0-9-]+)?\.[a-z0-9]+$/i,
  blogCover: /^blog\/[a-z0-9-]+\/[a-z0-9-]+\/cover\.[a-z0-9]+$/i,
  serviceCover: /^services\/[a-z0-9-]+\/cover\.[a-z0-9]+$/i,
  serviceStep: /^services\/[a-z0-9-]+\/steps\/step(?:-\d{2})?(?:-[a-z0-9-]+)?\.[a-z0-9]+$/i,
  brandLogo: /^brands\/[a-z0-9-]+\/logo\.[a-z0-9]+$/i,
  siteAsset: /^site\/(?:branding|about|auth|hero)\/[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/i,
};

async function getServiceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Cannot read api-keys: ${response.status} ${await response.text()}`);
  }

  const keys = await response.json();
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  if (!serviceRole) {
    throw new Error('service_role key not found');
  }
  return serviceRole;
}

async function restFetch(path, serviceRole) {
  const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });

  if (!response.ok) {
    throw new Error(`REST ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function normalizePath(path) {
  return String(path || '').trim().replace(/^\/+/, '').replace(/\\/g, '/');
}

function evaluatePath(path, pattern) {
  const normalized = normalizePath(path);
  if (!normalized) {
    return { ok: false, reason: 'missing-path', path: normalized };
  }
  if (pattern.test(normalized)) {
    return { ok: true, reason: 'seo-friendly', path: normalized };
  }
  if (/[0-9]{11,}/.test(normalized)) {
    return { ok: false, reason: 'timestamp-like', path: normalized };
  }
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(normalized)) {
    return { ok: false, reason: 'uuid-like', path: normalized };
  }
  return { ok: false, reason: 'non-standard-path', path: normalized };
}

function pushAuditRecord(results, scope, owner, path, pattern) {
  const evaluation = evaluatePath(path, pattern);
  results.push({
    scope,
    owner,
    path: evaluation.path,
    ok: evaluation.ok,
    reason: evaluation.reason,
  });
}

function summarizeScope(records) {
  const total = records.length;
  const healthy = records.filter((record) => record.ok).length;
  const legacy = total - healthy;
  return { total, healthy, legacy };
}

async function main() {
  const serviceRole = await getServiceRoleKey();
  const [
    productImages,
    products,
    blogPosts,
    services,
    procedureSteps,
    brands,
    siteInfoRows,
    authRows,
    aboutRows,
    heroRows,
  ] = await Promise.all([
    restFetch('product_images?select=product_id,image_path', serviceRole),
    restFetch('products?select=id,slug,name,long_description', serviceRole),
    restFetch('blog_posts?select=slug,title,category_slug,image_path', serviceRole),
    restFetch('services?select=id,slug,name,image_path', serviceRole),
    restFetch('procedure_steps?select=service_id,step_number,id,image_path', serviceRole),
    restFetch('product_brands?select=slug,name,logo_path', serviceRole),
    restFetch('site_info?select=clinic_name,logo_light_path,logo_dark_path,favicon_path', serviceRole),
    restFetch('auth_page_images?select=login_image_path', serviceRole),
    restFetch('about_page_content?select=image_path', serviceRole),
    restFetch('homepage_hero?select=image_desktop_path,image_tablet_path,image_mobile_path', serviceRole),
  ]);

  const results = [];

  for (const image of productImages || []) {
    pushAuditRecord(results, 'product_gallery', `product:${image.product_id}`, image.image_path, SEO_PATH_PATTERNS.productGallery);
  }

  for (const product of products || []) {
    const blocks = Array.isArray(product.long_description) ? product.long_description : [];
    blocks
      .filter((block) => block?.type === 'image' && block.image_path)
      .forEach((block, index) => {
        pushAuditRecord(
          results,
          'product_content',
          `product:${product.slug || product.id}:block:${index + 1}`,
          block.image_path,
          SEO_PATH_PATTERNS.productContent
        );
      });
  }

  for (const post of blogPosts || []) {
    pushAuditRecord(results, 'blog_cover', `blog:${post.slug}`, post.image_path, SEO_PATH_PATTERNS.blogCover);
  }

  const serviceSlugMap = new Map((services || []).map((service) => [service.id, service.slug || service.id]));

  for (const service of services || []) {
    pushAuditRecord(results, 'service_cover', `service:${service.slug || service.id}`, service.image_path, SEO_PATH_PATTERNS.serviceCover);
  }

  for (const step of procedureSteps || []) {
    if (!step?.image_path) continue;
    const serviceSlug = serviceSlugMap.get(step.service_id) || step.service_id;
    pushAuditRecord(
      results,
      'service_step',
      `service:${serviceSlug}:step:${step.step_number || step.id}`,
      step.image_path,
      SEO_PATH_PATTERNS.serviceStep
    );
  }

  for (const brand of brands || []) {
    pushAuditRecord(results, 'brand_logo', `brand:${brand.slug || brand.name}`, brand.logo_path, SEO_PATH_PATTERNS.brandLogo);
  }

  for (const row of siteInfoRows || []) {
    pushAuditRecord(results, 'site_asset', 'site:logo_light', row.logo_light_path, SEO_PATH_PATTERNS.siteAsset);
    pushAuditRecord(results, 'site_asset', 'site:logo_dark', row.logo_dark_path, SEO_PATH_PATTERNS.siteAsset);
    pushAuditRecord(results, 'site_asset', 'site:favicon', row.favicon_path, SEO_PATH_PATTERNS.siteAsset);
  }

  for (const row of authRows || []) {
    pushAuditRecord(results, 'site_asset', 'site:auth_login', row.login_image_path, SEO_PATH_PATTERNS.siteAsset);
  }

  for (const row of aboutRows || []) {
    pushAuditRecord(results, 'site_asset', 'site:about_cover', row.image_path, SEO_PATH_PATTERNS.siteAsset);
  }

  for (const row of heroRows || []) {
    pushAuditRecord(results, 'site_asset', 'site:hero_desktop', row.image_desktop_path, SEO_PATH_PATTERNS.siteAsset);
    pushAuditRecord(results, 'site_asset', 'site:hero_tablet', row.image_tablet_path, SEO_PATH_PATTERNS.siteAsset);
    pushAuditRecord(results, 'site_asset', 'site:hero_mobile', row.image_mobile_path, SEO_PATH_PATTERNS.siteAsset);
  }

  const byScope = new Map();
  for (const record of results) {
    const current = byScope.get(record.scope) || [];
    current.push(record);
    byScope.set(record.scope, current);
  }

  console.log(`# Image SEO path audit for ${PROJECT_REF}`);
  console.log('');
  let legacyTotal = 0;
  for (const [scope, records] of [...byScope.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { total, healthy, legacy } = summarizeScope(records);
    legacyTotal += legacy;
    console.log(`- ${scope}: ${healthy}/${total} SEO-friendly, ${legacy} legacy`);
  }

  console.log('');
  const samples = results.filter((record) => !record.ok).slice(0, MAX_SAMPLES);
  if (samples.length === 0) {
    console.log('No legacy image paths found.');
    return;
  }

  console.log(`Legacy samples (${samples.length}/${results.filter((record) => !record.ok).length}):`);
  for (const sample of samples) {
    console.log(`- [${sample.scope}] ${sample.owner} :: ${sample.reason} :: ${sample.path || '(empty)'}`);
  }

  if (legacyTotal > 0 && FAIL_ON_FINDINGS) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
