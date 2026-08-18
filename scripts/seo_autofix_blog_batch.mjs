#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildBlogPath,
  buildBrandPath,
  buildManagedSeoBlock,
  buildMetaDescription,
  buildMetaKeywords,
  buildProductPath,
  buildServicePath,
  classifyInternalLinks,
  countHeadings,
  normalizeString,
  replaceManagedSeoBlock,
  runQuery,
  scoreTokenOverlap,
  sleep,
  sqlString,
  toMarkdownLinks,
  uniqBy,
} from './lib/seo_batch_shared.mjs';

const OUTPUT_PATH = process.env.BLOG_SEO_AUTOFIX_OUTPUT || 'BLOG_SEO_AUTOFIX_REPORT.md';
const LIMIT = Number(process.env.BLOG_SEO_AUTOFIX_LIMIT || '500');
const DRY_RUN = process.env.BLOG_SEO_AUTOFIX_DRY_RUN === '1';
const EXCLUDED_BLOG_SLUGS = new Set(['can-sua-lai-noi-dung-bai-viet', 'khong-tim-thay-trang']);
const EXCLUDED_BLOG_SLUG_PREFIXES = ['tuyet-voi-duoi-day-'];

function isExcluded(slug) {
  return EXCLUDED_BLOG_SLUGS.has(slug) || EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

function buildSourceText(post) {
  return [post.title, post.summary, post.content, post.category_slug].filter(Boolean).join('\n\n');
}

function buildSummary(title, content, existingSummary) {
  const candidate = buildMetaDescription(existingSummary, content, title);
  if (!candidate) return '';
  return candidate.length > 180 ? `${candidate.slice(0, 177).trimEnd()}...` : candidate;
}

function pickTopMatches(sourceText, items, getParts, limit, extraScore = () => 0) {
  return items
    .map((item) => ({
      item,
      score: scoreTokenOverlap(sourceText, getParts(item)) + extraScore(item),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function ensureOverviewHeading(content) {
  const source = String(content || '').trim();
  if (!source) return source;
  if (countHeadings(source) > 0) return source;
  return `## Tổng quan\n\n${source}`.trim();
}

function buildManagedSections(post, relatedBlogs, relatedProducts, relatedServices, relatedBrands) {
  const articleLinks = uniqBy([
    post.category_slug
      ? {
          label: `Xem toàn bộ bài viết trong chuyên mục ${post.category_slug.replace(/-/g, ' ')}`,
          href: `/kien-thuc/${post.category_slug}`,
        }
      : null,
    ...relatedBlogs.slice(0, 3).map((item) => ({
      label: item.title,
      href: buildBlogPath(item.category_slug, item.slug),
    })),
    {
      label: 'Mở thư viện kiến thức da liễu',
      href: '/kien-thuc',
    },
  ].filter(Boolean), (item) => item.href).slice(0, 4);

  const commerceLinks = uniqBy([
    ...relatedProducts.slice(0, 2).map((item) => ({
      label: item.name,
      href: buildProductPath(item),
    })),
    ...relatedServices.slice(0, 2).map((item) => ({
      label: item.name,
      href: buildServicePath(item),
    })),
    ...relatedBrands.slice(0, 1).map((item) => ({
      label: item.name,
      href: buildBrandPath(item),
    })),
    {
      label: 'Nhà thuốc da liễu',
      href: '/san-pham',
    },
    {
      label: 'Dịch vụ điều trị và chăm sóc da',
      href: '/dich-vu',
    },
    {
      label: 'Danh mục thương hiệu',
      href: '/thuong-hieu',
    },
  ].filter(Boolean), (item) => item.href).slice(0, 5);

  return buildManagedSeoBlock([
    '## Đọc thêm trong cùng chủ đề',
    'Mở rộng cụm nội dung liên quan để người đọc đi tiếp theo đúng hướng và giúp bot hiểu rõ hơn ngữ cảnh của bài viết này.',
    ...toMarkdownLinks(articleLinks),
    '## Gợi ý đi tiếp sang dịch vụ và nhà thuốc',
    'Nếu cần chuyển từ tìm hiểu sang hành động, bạn có thể đi tiếp sang các lối vào điều trị, sản phẩm và thương hiệu dưới đây.',
    ...toMarkdownLinks(commerceLinks),
  ]);
}

function buildUpdatePayload(post, lookup) {
  const next = {
    image_path: normalizeString(post.image_path),
    summary: normalizeString(post.summary),
    meta_description: normalizeString(post.meta_description),
    meta_keywords: normalizeString(post.meta_keywords),
    content: normalizeString(post.content),
  };
  const changes = [];

  if (!next.summary || next.summary.length < 110 || next.summary.length > 220) {
    const nextSummary = buildSummary(post.title, post.content, next.summary);
    if (nextSummary && nextSummary !== next.summary) {
      next.summary = nextSummary;
      changes.push('summary');
    }
  }

  if (!next.meta_description || next.meta_description.length < 120 || next.meta_description.length > 170) {
    const metaDescription = buildMetaDescription(next.summary, post.content, post.title);
    if (metaDescription) {
      next.meta_description = metaDescription;
      changes.push('meta_description');
    }
  }

  if (!next.meta_keywords) {
    next.meta_keywords = buildMetaKeywords(post.title, post.category_slug, post.summary);
    if (next.meta_keywords) changes.push('meta_keywords');
  }

  let content = ensureOverviewHeading(next.content);
  const sourceText = buildSourceText({ ...post, content });

  const relatedBlogs = uniqBy(
    pickTopMatches(
      sourceText,
      lookup.blogs.filter((item) => item.slug !== post.slug),
      (item) => [item.title, item.summary, item.category_slug],
      3,
      (item) => item.category_slug === post.category_slug ? 3 : 0,
    ),
    (item) => item.slug,
  );
  const relatedProducts = uniqBy(
    pickTopMatches(sourceText, lookup.products, (item) => [item.name, item.description, item.brand, item.category_slug], 2),
    (item) => item.slug,
  );
  const relatedServices = uniqBy(
    pickTopMatches(sourceText, lookup.services, (item) => [item.name, item.description], 2),
    (item) => item.slug,
  );
  const relatedBrands = uniqBy(
    pickTopMatches(sourceText, lookup.brands, (item) => [item.name, item.description], 1),
    (item) => item.slug,
  );

  const managedBlock = buildManagedSections(post, relatedBlogs, relatedProducts, relatedServices, relatedBrands);
  const nextContent = replaceManagedSeoBlock(content, managedBlock);
  const linkStats = classifyInternalLinks(nextContent);

  if (nextContent !== next.content) {
    next.content = nextContent;
    changes.push('content_structure_links');
  }

  return {
    changed: changes.length > 0,
    changes,
    payload: next,
    diagnostics: {
      headings: countHeadings(next.content),
      internalLinks: linkStats.total,
      commerceLinks: linkStats.products + linkStats.services + linkStats.brands,
    },
  };
}

async function fetchData() {
  const [blogs, products, services, brands] = await Promise.all([
    runQuery(`
      select slug, title, summary, content, image_path, meta_description, meta_keywords, category_slug, date
      from public.blog_posts
      order by date desc, slug asc
      limit ${LIMIT};
    `),
    runQuery(`
      select p.slug, p.name, p.description, p.brand, pc.slug as category_slug
      from public.products p
      left join public.product_categories pc on pc.id = p.category_id
      where coalesce(p.is_published, false) = true
      order by p.id asc;
    `),
    runQuery(`
      select slug, name, description
      from public.services
      order by id asc;
    `),
    runQuery(`
      select slug, name, coalesce(description, '') as description
      from public.product_brands
      where coalesce(slug, '') <> ''
      order by name asc;
    `),
  ]);

  return { blogs, products, services, brands };
}

async function applyUpdate(post, payload) {
  const query = `
    update public.blog_posts
    set
      summary = ${sqlString(payload.summary)},
      content = ${sqlString(payload.content)},
      image_path = ${sqlString(payload.image_path)},
      meta_description = ${sqlString(payload.meta_description || null)},
      meta_keywords = ${sqlString(payload.meta_keywords || null)},
      updated_at = now()
    where slug = ${sqlString(post.slug)};
  `;
  await runQuery(query);
}

function buildReport(results) {
  const changed = results.filter((item) => item.changed);
  const lines = [];
  lines.push('# Blog SEO Autofix Report');
  lines.push('');
  lines.push(`- Generated at: \`${new Date().toISOString()}\``);
  lines.push(`- Dry run: **${DRY_RUN ? 'yes' : 'no'}**`);
  lines.push(`- Audited rows: **${results.length}**`);
  lines.push(`- Changed rows: **${changed.length}**`);
  lines.push('');
  lines.push('| slug | changes | headings | internal_links | commerce_links |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const item of changed.slice(0, 80)) {
    lines.push(`| ${item.slug} | ${item.changes.join(', ')} | ${item.headings} | ${item.internalLinks} | ${item.commerceLinks} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const lookup = await fetchData();
  const blogRows = lookup.blogs.filter((row) => {
    const slug = normalizeString(row.slug);
    return slug && !isExcluded(slug);
  });

  const results = [];
  for (let index = 0; index < blogRows.length; index += 1) {
    const post = blogRows[index];
    if ((index + 1) % 20 === 0 || index === 0) {
      console.log(`[INFO] Blog SEO autofix progress ${index + 1}/${blogRows.length}: ${post.slug}`);
    }
    const next = buildUpdatePayload(post, lookup);
    if (next.changed && !DRY_RUN) {
      await applyUpdate(post, next.payload);
      await sleep(120);
    }
    results.push({
      slug: post.slug,
      changed: next.changed,
      changes: next.changes,
      ...next.diagnostics,
    });
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, buildReport(results), 'utf8');

  const changed = results.filter((item) => item.changed).length;
  console.log(JSON.stringify({ audited: results.length, changed, dryRun: DRY_RUN, output: OUTPUT_PATH }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
