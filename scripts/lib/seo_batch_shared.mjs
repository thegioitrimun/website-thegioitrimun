const SITE_URL = 'https://thegioitrimun.vn';

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
export const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

export function requireAccessToken() {
  if (!ACCESS_TOKEN) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  }
}

export async function runQuery(query) {
  requireAccessToken();
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API error ${response.status}: ${text.slice(0, 1200)}`);
  }

  return JSON.parse(text);
}

export function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeArray(value) {
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

export function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

export function normalizeTextArray(value) {
  return normalizeArray(value)
    .map((entry) => normalizeString(typeof entry === 'string' ? entry : ''))
    .filter(Boolean);
}

export function normalizeFaqItems(value) {
  return normalizeArray(value)
    .map((entry) => ({
      question: normalizeString(entry?.question),
      answer: normalizeString(entry?.answer),
    }))
    .filter((entry) => entry.question && entry.answer);
}

export function normalizeContentBlocks(value) {
  return normalizeArray(value)
    .map((entry) => normalizeObject(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function stripMarkdown(source) {
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

export function countWords(source) {
  const cleaned = stripMarkdown(source);
  if (!cleaned) return 0;
  const hanCharacters = cleaned.match(/\p{Script=Han}/gu) || [];
  const withoutHan = cleaned.replace(/\p{Script=Han}/gu, ' ');
  const spacedTokens = withoutHan.split(/\s+/).filter(Boolean).length;
  const hanUnits = Math.ceil(hanCharacters.length / 2);
  return spacedTokens + hanUnits;
}

export function countHeadings(markdown) {
  return String(markdown || '')
    .split('\n')
    .filter((line) => /^#{1,6}\s+/.test(line.trim()))
    .length;
}

export function extractLinks(markdown) {
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

export function normalizeHref(href) {
  if (!href) return '';
  if (href.startsWith(SITE_URL)) {
    return href.slice(SITE_URL.length) || '/';
  }
  return href;
}

export function classifyInternalLinks(markdown) {
  const links = extractLinks(markdown).map(normalizeHref);
  const internal = links.filter((href) => href.startsWith('/'));
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

export function tokenize(source) {
  return Array.from(new Set(
    slugify(stripMarkdown(source))
      .split('-')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  ));
}

export function scoreTokenOverlap(sourceText, candidateParts) {
  const sourceTokens = tokenize(sourceText);
  if (sourceTokens.length === 0) return 0;

  const candidateTokens = new Set(tokenize(candidateParts.filter(Boolean).join(' ')));
  if (candidateTokens.size === 0) return 0;

  let score = 0;
  for (const token of sourceTokens) {
    if (candidateTokens.has(token)) score += 1;
  }
  return score;
}

export function buildMetaDescription(summary, content, fallbackTitle = '') {
  const summaryText = normalizeString(summary).replace(/\s+/g, ' ');
  if (summaryText.length >= 120 && summaryText.length <= 170) return summaryText;

  const contentText = stripMarkdown(content).replace(/\s+/g, ' ').trim();
  const base = summaryText || contentText || fallbackTitle;
  const trimmed = base.slice(0, 155).trim();
  return trimmed.length < base.length ? `${trimmed.replace(/[,:;\-\s]+$/g, '')}...` : trimmed;
}

export function buildMetaKeywords(...parts) {
  const tokens = tokenize(parts.join(' '));
  return tokens.slice(0, 8).join(', ');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = Number(process.env.SEO_AUTOFIX_FETCH_TIMEOUT_MS || '20000')) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function translateChunk(text, targetLang, attempt = 0) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  let response;
  try {
    response = await fetchWithTimeout(url, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    });
  } catch (error) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return translateChunk(text, targetLang, attempt + 1);
    }
    throw error;
  }

  if (!response.ok) {
    if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
      await sleep(500 * (attempt + 1));
      return translateChunk(text, targetLang, attempt + 1);
    }
    throw new Error(`Translate API failed ${response.status}`);
  }

  const data = await response.json();
  return (data?.[0] || []).map((part) => part?.[0] || '').join('').trim();
}

export async function translateText(text, targetLang) {
  const clean = normalizeString(text);
  if (!clean) return '';
  return translateChunk(clean, targetLang);
}

export function replaceManagedSeoBlock(content, nextBlock) {
  const startMarker = '<!-- seo-autofix:start -->';
  const endMarker = '<!-- seo-autofix:end -->';
  const source = String(content || '').trim();
  const withoutManaged = source.includes(startMarker) && source.includes(endMarker)
    ? source.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g'), '').trim()
    : source;

  const merged = [withoutManaged, nextBlock.trim()].filter(Boolean).join('\n\n');
  return merged.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildManagedSeoBlock(markdownSections) {
  return [
    '<!-- seo-autofix:start -->',
    ...markdownSections,
    '<!-- seo-autofix:end -->',
  ].join('\n\n');
}

export function toMarkdownLinks(items) {
  return items.map((item) => `- [${item.label}](${item.href})`);
}

export function buildBlogPath(categorySlug, slug) {
  return `/kien-thuc/${slugify(categorySlug || 'tong-hop')}/${slug}`;
}

export function buildProductPath(product) {
  const categorySlug = slugify(product.category_slug || product.category_name || 'san-pham');
  return `/san-pham/${categorySlug}/${product.slug}`;
}

export function buildServicePath(service) {
  return `/dich-vu/${service.slug}`;
}

export function buildBrandPath(brand) {
  return `/thuong-hieu/${brand.slug}`;
}

export function parseTranslatedSections(text) {
  const labels = ['NAME', 'DESCRIPTION', 'USAGE', 'INGREDIENTS', 'BENEFITS', 'ORIGIN', 'TEXTURE', 'SKIN_TYPES'];
  const result = {};
  const source = String(text || '');
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const next = labels[index + 1];
    const pattern = next
      ? new RegExp(`__${label}__\\n([\\s\\S]*?)\\n__${next}__`, 'i')
      : new RegExp(`__${label}__\\n([\\s\\S]*)$`, 'i');
    const match = source.match(pattern);
    result[label] = match ? match[1].trim() : '';
  }
  return result;
}

export function splitBulletLines(value) {
  return String(value || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export function uniqBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export function buildBlogCoverFallbackUrl(categorySlug = '') {
  const slug = slugify(categorySlug);
  const file = slug.includes('mun') || slug.includes('da')
    ? 'blog-cover-skin-care.jpg'
    : slug.includes('cong-nghe') || slug.includes('tham-my')
      ? 'blog-cover-technology.jpg'
      : slug.includes('co-xuong-khop') || slug.includes('suc-khoe')
        ? 'blog-cover-health.jpg'
        : 'blog-cover-default.jpg';
  return `${SITE_URL}/seo/${file}`;
}
