#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykcrngqhyinczmvwduox.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc';
const FETCH_TIMEOUT_MS = Number(process.env.SEO_CONTENT_AUDIT_FETCH_TIMEOUT_MS || '20000');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const OUTPUT_PATH = process.env.SEO_CONTENT_AUDIT_OUTPUT || 'SEO_CONTENT_QUALITY_AUDIT.md';
const FAIL_ON_FINDINGS = process.env.SEO_CONTENT_AUDIT_FAIL_ON_FINDINGS === '1';
const FAIL_LEVEL = String(process.env.SEO_CONTENT_AUDIT_FAIL_LEVEL || 'critical').toLowerCase();
const BLOG_MIN_WORDS = Number(process.env.SEO_CONTENT_BLOG_MIN_WORDS || '600');
const PRODUCT_MIN_WORDS = Number(process.env.SEO_CONTENT_PRODUCT_MIN_WORDS || '260');
const PRODUCT_MIN_FAQ = Number(process.env.SEO_CONTENT_PRODUCT_MIN_FAQ || '2');
const BLOG_MIN_INTERNAL_LINKS = Number(process.env.SEO_CONTENT_BLOG_MIN_INTERNAL_LINKS || '3');

const EXCLUDED_BLOG_SLUGS = new Set([
  'can-sua-lai-noi-dung-bai-viet',
  'khong-tim-thay-trang',
]);
const EXCLUDED_BLOG_SLUG_PREFIXES = ['tuyet-voi-duoi-day-'];
const SITE_URL = 'https://thegioitrimun.vn';
const INTERNAL_PREFIXES = ['/san-pham', '/dich-vu', '/kien-thuc', '/thuong-hieu'];
const ISSUE_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const fetchWithTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Fetch timeout after ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VERBOSE = process.env.SEO_CONTENT_AUDIT_VERBOSE === '1';

async function fetchPageWithRetry(buildQuery, from, to, attempt = 0) {
  try {
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    const maxRetries = 4;
    if (attempt < maxRetries) {
      const delay = Math.min(8000, 750 * (attempt + 1));
      await sleep(delay);
      return fetchPageWithRetry(buildQuery, from, to, attempt + 1);
    }
    throw error;
  }
}

async function fetchPaged(label, buildQuery, pageSize = 200) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await fetchPageWithRetry(buildQuery, offset, offset + pageSize - 1);
    rows.push(...page);
    if (VERBOSE) {
      console.log(`[DEBUG] ${label}: fetched ${rows.length} rows`);
    }
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTextArray(value) {
  const items = normalizeArray(value);
  return items.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean);
}

function normalizeFaqItems(value) {
  return normalizeArray(value)
    .map((entry) => ({
      question: normalizeString(entry?.question),
      answer: normalizeString(entry?.answer),
    }))
    .filter((entry) => entry.question && entry.answer);
}

function normalizeContentBlocks(value) {
  return normalizeArray(value).filter((entry) => entry && typeof entry === 'object');
}

function stripMarkdown(source) {
  return String(source || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[\-*+_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(source) {
  const cleaned = stripMarkdown(source);
  if (!cleaned) return 0;
  const hanCharacters = cleaned.match(/\p{Script=Han}/gu) || [];
  const withoutHan = cleaned.replace(/\p{Script=Han}/gu, ' ');
  const spacedTokens = withoutHan.split(/\s+/).filter(Boolean).length;
  const hanUnits = Math.ceil(hanCharacters.length / 2);
  return spacedTokens + hanUnits;
}

function countHeadings(markdown) {
  return String(markdown || '').split('\n').filter((line) => /^#{1,6}\s+/.test(line.trim())).length;
}

function extractLinks(markdown) {
  const content = String(markdown || '');
  const urls = [];
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (match[1]) urls.push(match[1].trim());
  }
  for (const match of content.matchAll(/href=["']([^"']+)["']/gi)) {
    if (match[1]) urls.push(match[1].trim());
  }
  return urls;
}

function normalizeHref(href) {
  if (!href) return '';
  if (href.startsWith(SITE_URL)) {
    return href.slice(SITE_URL.length) || '/';
  }
  return href;
}

function classifyInternalLinks(markdown) {
  const links = extractLinks(markdown).map(normalizeHref);
  const internal = links.filter((href) => href.startsWith('/') || href.startsWith(SITE_URL));
  const counts = {
    total: internal.length,
    products: 0,
    services: 0,
    blog: 0,
    brands: 0,
  };

  for (const href of internal) {
    if (href.startsWith('/san-pham')) counts.products += 1;
    if (href.startsWith('/dich-vu')) counts.services += 1;
    if (href.startsWith('/kien-thuc')) counts.blog += 1;
    if (href.startsWith('/thuong-hieu')) counts.brands += 1;
  }

  return counts;
}

function addIssue(issues, severity, code, detail) {
  issues.push({ severity, code, detail });
}

function computeScore(issues) {
  const penalties = { critical: 25, high: 12, medium: 5, low: 2 };
  return Math.max(0, 100 - issues.reduce((sum, issue) => sum + (penalties[issue.severity] || 0), 0));
}

function scoreBucket(score) {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'watch';
  if (score >= 55) return 'weak';
  return 'critical-backlog';
}

function localeCoverage(locales) {
  return ['en', 'ru', 'cn'].filter((locale) => locales[locale]).length;
}

function assessBlogPost(row) {
  const issues = [];
  const slug = normalizeString(row.slug);
  const title = normalizeString(row.title);
  const summary = normalizeString(row.summary);
  const content = normalizeString(row.content);
  const metaDescription = normalizeString(row.meta_description);
  const categorySlug = normalizeString(row.category_slug);
  const imagePath = normalizeString(row.image_path);
  const canonicalUrl = normalizeString(row.canonical_url);
  const authorId = normalizeString(row.author_id);

  const titleLength = title.length;
  const summaryLength = summary.length;
  const metaLength = metaDescription.length;
  const wordCount = countWords(content);
  const headingCount = countHeadings(content);
  const internalLinks = classifyInternalLinks(content);

  const locales = {
    en: Boolean(normalizeString(row.title_en) && normalizeString(row.summary_en) && countWords(row.content_en) >= 180),
    ru: Boolean(normalizeString(row.title_ru) && normalizeString(row.summary_ru) && countWords(row.content_ru) >= 180),
    cn: Boolean(normalizeString(row.title_cn) && normalizeString(row.summary_cn) && countWords(row.content_cn) >= 180),
  };

  if (!slug) addIssue(issues, 'critical', 'missing_slug', 'Bài viết không có slug.');
  if (!title) addIssue(issues, 'critical', 'missing_title', 'Bài viết không có tiêu đề.');
  if (!categorySlug) addIssue(issues, 'critical', 'missing_category', 'Bài viết chưa có chuyên mục.');
  if (!content || wordCount < 250) addIssue(issues, 'critical', 'thin_body', `Nội dung quá mỏng (${wordCount} từ).`);
  if (title && (titleLength < 35 || titleLength > 78)) {
    addIssue(issues, 'medium', 'weak_title_length', `Tiêu đề dài ${titleLength} ký tự.`);
  }
  if (!summary || summaryLength < 110) {
    addIssue(issues, 'high', 'weak_summary', `Tóm tắt ngắn (${summaryLength} ký tự).`);
  } else if (summaryLength > 220) {
    addIssue(issues, 'medium', 'summary_too_long', `Tóm tắt dài ${summaryLength} ký tự.`);
  }

  if (!metaDescription) {
    addIssue(issues, 'high', 'missing_meta_description', 'Thiếu meta description riêng.');
  } else if (metaLength < 120 || metaLength > 170) {
    addIssue(issues, 'medium', 'weak_meta_description_length', `Meta description dài ${metaLength} ký tự.`);
  }

  if (wordCount < BLOG_MIN_WORDS) {
    addIssue(issues, wordCount < 400 ? 'high' : 'medium', 'body_below_target', `Nội dung dưới ngưỡng mục tiêu ${BLOG_MIN_WORDS} từ.`);
  }
  if (headingCount === 0) {
    addIssue(issues, 'high', 'missing_heading_structure', 'Bài viết không có heading markdown.');
  } else if (headingCount < 3) {
    addIssue(issues, 'medium', 'shallow_heading_structure', `Bài viết chỉ có ${headingCount} heading.`);
  }

  if (internalLinks.total === 0) {
    addIssue(issues, 'high', 'missing_internal_links', 'Bài viết không có internal links.');
  } else if (internalLinks.total < BLOG_MIN_INTERNAL_LINKS) {
    addIssue(issues, 'medium', 'low_internal_links', `Bài viết chỉ có ${internalLinks.total} internal links.`);
  }
  if (internalLinks.products + internalLinks.services + internalLinks.brands === 0) {
    addIssue(issues, 'high', 'missing_commerce_links', 'Bài viết chưa dẫn traffic sang sản phẩm/dịch vụ/thương hiệu.');
  }
  if (!authorId) {
    addIssue(issues, 'medium', 'missing_author', 'Bài viết chưa gắn tác giả.');
  }
  if (canonicalUrl && !canonicalUrl.includes(SITE_URL)) {
    addIssue(issues, 'medium', 'external_canonical', 'Canonical đang trỏ ra ngoài domain chính.');
  }

  for (const locale of ['en', 'ru', 'cn']) {
    if (!locales[locale]) {
      addIssue(issues, 'medium', `missing_locale_${locale}`, `Thiếu bộ dịch SEO usable cho locale ${locale}.`);
    }
  }

  const score = computeScore(issues);
  return {
    type: 'blog',
    identifier: slug,
    title: title || slug,
    score,
    bucket: scoreBucket(score),
    issueCount: issues.length,
    issues,
    diagnostics: {
      wordCount,
      headingCount,
      internalLinks: internalLinks.total,
      commerceLinks: internalLinks.products + internalLinks.services + internalLinks.brands,
      localeCoverage: localeCoverage(locales),
      metaLength,
      summaryLength,
    },
  };
}

function assessProduct(row) {
  const issues = [];
  const slug = normalizeString(row.slug);
  const name = normalizeString(row.name);
  const description = normalizeString(row.description);
  const usageInstructions = normalizeString(row.usage_instructions);
  const ingredients = normalizeString(row.ingredients);
  const origin = normalizeString(row.origin);
  const texture = normalizeString(row.texture);
  const brand = normalizeString(row.brand);

  const longDescriptionBlocks = normalizeContentBlocks(row.long_description);
  const textBlocks = longDescriptionBlocks
    .filter((block) => block.type === 'text')
    .map((block) => normalizeString(block.content));
  const imageBlocks = longDescriptionBlocks.filter((block) => block.type === 'image' && normalizeString(block.image_path));
  const faqItems = normalizeFaqItems(row.faq_items);
  const keyBenefits = normalizeTextArray(row.key_benefits);
  const skinTypes = normalizeTextArray(row.skin_types);
  const imageCount = Number(row.image_count || 0);

  const supportingWords = countWords([
    description,
    usageInstructions,
    ingredients,
    keyBenefits.join(' '),
    textBlocks.join(' '),
  ].join('\n\n'));

  const locales = {
    en: Boolean(normalizeString(row.name_en) && normalizeString(row.description_en) && (countWords(row.usage_instructions_en) > 10 || countWords(row.ingredients_en) > 10 || normalizeTextArray(row.key_benefits_en).length > 0)),
    ru: Boolean(normalizeString(row.name_ru) && normalizeString(row.description_ru) && (countWords(row.usage_instructions_ru) > 10 || countWords(row.ingredients_ru) > 10 || normalizeTextArray(row.key_benefits_ru).length > 0)),
    cn: Boolean(normalizeString(row.name_cn) && normalizeString(row.description_cn) && (countWords(row.usage_instructions_cn) > 10 || countWords(row.ingredients_cn) > 10 || normalizeTextArray(row.key_benefits_cn).length > 0)),
  };

  if (!slug) addIssue(issues, 'critical', 'missing_slug', 'Sản phẩm không có slug.');
  if (!name) addIssue(issues, 'critical', 'missing_name', 'Sản phẩm không có tên.');
  if (!description || countWords(description) < 12) addIssue(issues, 'critical', 'thin_description', 'Mô tả ngắn của sản phẩm quá mỏng.');
  if (imageCount === 0) addIssue(issues, 'critical', 'missing_gallery_images', 'Sản phẩm không có ảnh gallery.');

  if (imageCount === 1) addIssue(issues, 'high', 'single_image_only', 'Sản phẩm chỉ có 1 ảnh.');
  if (supportingWords < PRODUCT_MIN_WORDS) {
    addIssue(issues, supportingWords < 140 ? 'high' : 'medium', 'thin_supporting_content', `Tổng nội dung hỗ trợ chỉ có ${supportingWords} từ.`);
  }
  if (longDescriptionBlocks.length === 0) {
    addIssue(issues, 'high', 'missing_long_description', 'Thiếu long description có cấu trúc.');
  } else if (textBlocks.length === 0) {
    addIssue(issues, 'high', 'missing_long_description_text', 'Long description chưa có block text.');
  }
  if (imageBlocks.length === 0) {
    addIssue(issues, 'medium', 'missing_long_description_media', 'Long description chưa có block ảnh bổ trợ.');
  }
  if (!usageInstructions) addIssue(issues, 'high', 'missing_usage_instructions', 'Thiếu hướng dẫn sử dụng.');
  if (!ingredients) addIssue(issues, 'high', 'missing_ingredients', 'Thiếu thành phần.');
  if (keyBenefits.length === 0) addIssue(issues, 'high', 'missing_key_benefits', 'Thiếu lợi ích chính.');
  if (faqItems.length === 0) {
    addIssue(issues, 'high', 'missing_product_faq', 'Sản phẩm chưa có FAQ riêng.');
  } else if (faqItems.length < PRODUCT_MIN_FAQ) {
    addIssue(issues, 'medium', 'low_product_faq_coverage', `Sản phẩm mới có ${faqItems.length} FAQ.`);
  }
  if (!brand) addIssue(issues, 'medium', 'missing_brand', 'Thiếu thương hiệu.');
  if (!origin) addIssue(issues, 'medium', 'missing_origin', 'Thiếu xuất xứ.');
  if (!texture) addIssue(issues, 'low', 'missing_texture', 'Thiếu texture sản phẩm.');
  if (skinTypes.length === 0) addIssue(issues, 'medium', 'missing_skin_types', 'Thiếu nhóm da phù hợp.');

  for (const locale of ['en', 'ru', 'cn']) {
    if (!locales[locale]) {
      addIssue(issues, 'medium', `missing_locale_${locale}`, `Thiếu bộ dịch SEO usable cho locale ${locale}.`);
    }
  }

  const score = computeScore(issues);
  return {
    type: 'product',
    identifier: slug || String(row.id || ''),
    title: name || slug,
    score,
    bucket: scoreBucket(score),
    issueCount: issues.length,
    issues,
    diagnostics: {
      imageCount,
      faqCount: faqItems.length,
      longDescriptionBlocks: longDescriptionBlocks.length,
      longDescriptionImageBlocks: imageBlocks.length,
      supportingWords,
      localeCoverage: localeCoverage(locales),
    },
  };
}

function sortIssues(issues) {
  return [...issues].sort((a, b) => {
    const severityDelta = (ISSUE_ORDER[a.severity] ?? 99) - (ISSUE_ORDER[b.severity] ?? 99);
    return severityDelta !== 0 ? severityDelta : a.code.localeCompare(b.code);
  });
}

function summarizeIssueCounts(items) {
  const counts = new Map();
  for (const item of items) {
    for (const issue of item.issues) {
      const key = `${issue.severity}:${issue.code}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [severity, code] = key.split(':');
      return { severity, code, count };
    })
    .sort((a, b) => {
      const severityDelta = (ISSUE_ORDER[a.severity] ?? 99) - (ISSUE_ORDER[b.severity] ?? 99);
      return severityDelta !== 0 ? severityDelta : b.count - a.count;
    });
}

function countSeverity(items, severity) {
  return items.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === severity).length, 0);
}

function table(rows, headers) {
  if (!rows.length) return '_No rows_';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${headers.map((header) => String(row[header] ?? '')).join(' | ')} |`);
  }
  return lines.join('\n');
}

function buildReport(products, blogs) {
  const productIssues = summarizeIssueCounts(products);
  const blogIssues = summarizeIssueCounts(blogs);
  const allItems = [...products, ...blogs];
  const criticalBacklog = allItems.filter((item) => item.bucket === 'critical-backlog');
  const weakestProducts = [...products].sort((a, b) => a.score - b.score || b.issueCount - a.issueCount).slice(0, 20);
  const weakestBlogs = [...blogs].sort((a, b) => a.score - b.score || b.issueCount - a.issueCount).slice(0, 20);

  const lines = [];
  lines.push('# SEO Content Quality Audit');
  lines.push('');
  lines.push(`- Generated at: \`${new Date().toISOString()}\``);
  lines.push(`- Project ref: \`${PROJECT_REF}\``);
  lines.push(`- Product pages audited: **${products.length}**`);
  lines.push(`- Blog posts audited: **${blogs.length}**`);
  lines.push(`- Critical issues: **${countSeverity(allItems, 'critical')}**`);
  lines.push(`- High issues: **${countSeverity(allItems, 'high')}**`);
  lines.push(`- Medium issues: **${countSeverity(allItems, 'medium')}**`);
  lines.push(`- Critical backlog items: **${criticalBacklog.length}**`);
  lines.push('');
  lines.push('## Release Rule');
  lines.push('');
  lines.push('- `critical`: không nên publish hoặc cần sửa ngay vì chặn index/CTR/content depth.');
  lines.push('- `high`: nên vào backlog sprint hiện tại vì ảnh hưởng trực tiếp tới long-tail SEO và internal traffic.');
  lines.push('- `medium`: tối ưu tăng dần để nâng mặt bằng chất lượng và coverage locale.');
  lines.push('');
  lines.push('## Product Quality');
  lines.push('');
  lines.push(table([
    {
      audited: products.length,
      strong: products.filter((item) => item.bucket === 'strong').length,
      watch: products.filter((item) => item.bucket === 'watch').length,
      weak: products.filter((item) => item.bucket === 'weak').length,
      critical_backlog: products.filter((item) => item.bucket === 'critical-backlog').length,
    },
  ], ['audited', 'strong', 'watch', 'weak', 'critical_backlog']));
  lines.push('');
  lines.push(table(productIssues.slice(0, 12), ['severity', 'code', 'count']));
  lines.push('');
  lines.push('### Weakest Published Products');
  lines.push('');
  lines.push(table(
    weakestProducts.map((item) => ({
      slug: item.identifier,
      score: item.score,
      bucket: item.bucket,
      images: item.diagnostics.imageCount,
      faq: item.diagnostics.faqCount,
      words: item.diagnostics.supportingWords,
      locales: item.diagnostics.localeCoverage,
      top_issues: sortIssues(item.issues).slice(0, 3).map((issue) => issue.code).join(', '),
    })),
    ['slug', 'score', 'bucket', 'images', 'faq', 'words', 'locales', 'top_issues'],
  ));
  lines.push('');
  lines.push('## Blog Quality');
  lines.push('');
  lines.push(table([
    {
      audited: blogs.length,
      strong: blogs.filter((item) => item.bucket === 'strong').length,
      watch: blogs.filter((item) => item.bucket === 'watch').length,
      weak: blogs.filter((item) => item.bucket === 'weak').length,
      critical_backlog: blogs.filter((item) => item.bucket === 'critical-backlog').length,
    },
  ], ['audited', 'strong', 'watch', 'weak', 'critical_backlog']));
  lines.push('');
  lines.push(table(blogIssues.slice(0, 12), ['severity', 'code', 'count']));
  lines.push('');
  lines.push('### Weakest Blog Posts');
  lines.push('');
  lines.push(table(
    weakestBlogs.map((item) => ({
      slug: item.identifier,
      score: item.score,
      bucket: item.bucket,
      words: item.diagnostics.wordCount,
      headings: item.diagnostics.headingCount,
      internal_links: item.diagnostics.internalLinks,
      commerce_links: item.diagnostics.commerceLinks,
      locales: item.diagnostics.localeCoverage,
      top_issues: sortIssues(item.issues).slice(0, 3).map((issue) => issue.code).join(', '),
    })),
    ['slug', 'score', 'bucket', 'words', 'headings', 'internal_links', 'commerce_links', 'locales', 'top_issues'],
  ));
  lines.push('');
  lines.push('## Operational Priorities');
  lines.push('');
  lines.push('1. Sửa toàn bộ `critical` trước khi đẩy thêm indexation hoặc social distribution.');
  lines.push('2. Với blog, ưu tiên bổ sung internal links sang `/san-pham`, `/dich-vu`, `/thuong-hieu` để tăng traffic nội bộ và intent commerce.');
  lines.push('3. Với sản phẩm, ưu tiên FAQ riêng, gallery >= 2 ảnh, long description có cả text và image blocks.');
  lines.push('4. Dùng report này cùng với `qa:seo`, `qa:blog-content`, `seo:audit-image-paths` để khóa cả kỹ thuật lẫn editorial SEO.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const [productImages, productRows, blogRows] = await Promise.all([
    fetchPaged(
      'product_images',
      () => supabase.from('product_images').select('product_id').not('product_id', 'is', null),
      1000,
    ),
    fetchPaged(
      'products',
      () => supabase
        .from('products')
        .select([
          'id',
          'slug',
          'name',
          'description',
          'long_description',
          'usage_instructions',
          'ingredients',
          'key_benefits',
          'skin_types',
          'origin',
          'texture',
          'brand',
          'faq_items',
          'is_published',
          'name_en',
          'name_ru',
          'name_cn',
          'description_en',
          'description_ru',
          'description_cn',
          'usage_instructions_en',
          'usage_instructions_ru',
          'usage_instructions_cn',
          'ingredients_en',
          'ingredients_ru',
          'ingredients_cn',
          'key_benefits_en',
          'key_benefits_ru',
          'key_benefits_cn',
        ].join(','))
        .eq('is_published', true)
        .order('id', { ascending: true }),
      250,
    ),
    fetchPaged(
      'blog_posts',
      () => supabase
        .from('blog_posts')
        .select([
          'slug',
          'title',
          'summary',
          'content',
          'title_en',
          'title_ru',
          'title_cn',
          'summary_en',
          'summary_ru',
          'summary_cn',
          'content_en',
          'content_ru',
          'content_cn',
          'author_id',
          'date',
          'category_slug',
          'image_path',
          'meta_description',
          'meta_keywords',
          'canonical_url',
        ].join(','))
        .order('date', { ascending: false })
        .order('slug', { ascending: true }),
      120,
    ),
  ]);

  const imageCountByProductId = new Map();
  for (const row of productImages) {
    const id = row?.product_id;
    if (id == null) continue;
    imageCountByProductId.set(id, (imageCountByProductId.get(id) || 0) + 1);
  }

  const productRowsWithCounts = productRows.map((row) => ({
    ...row,
    image_count: imageCountByProductId.get(row.id) || 0,
  }));

  const products = productRowsWithCounts.map(assessProduct);
  const blogs = blogRows
    .filter((row) => {
      const slug = normalizeString(row.slug);
      return slug && !EXCLUDED_BLOG_SLUGS.has(slug) && !EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
    })
    .map(assessBlogPost);

  const report = buildReport(products, blogs);
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, report, 'utf8');

  const criticalItems = [...products, ...blogs].filter((item) => item.issues.some((issue) => issue.severity === 'critical'));
  const highItems = [...products, ...blogs].filter((item) => item.issues.some((issue) => issue.severity === 'high'));

  console.log(`[INFO] Products audited: ${products.length}`);
  console.log(`[INFO] Blog posts audited: ${blogs.length}`);
  console.log(`[INFO] Critical backlog items: ${criticalItems.length}`);
  console.log(`[INFO] High-priority items: ${highItems.length}`);
  console.log(`[INFO] Report written to ${OUTPUT_PATH}`);

  if (FAIL_ON_FINDINGS) {
    const shouldFail = FAIL_LEVEL === 'high'
      ? highItems.length > 0 || criticalItems.length > 0
      : criticalItems.length > 0;

    if (shouldFail) {
      console.error(`[FAIL] SEO content audit found ${criticalItems.length} critical items and ${highItems.length} high-priority items.`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
