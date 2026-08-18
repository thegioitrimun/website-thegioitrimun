#!/usr/bin/env node

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const limit = Number(process.env.BLOG_TRANSLATE_LIMIT || 10);
const repairResidueMode = process.env.BLOG_TRANSLATE_REPAIR_RESIDUE === '1';
const fetchTimeoutMs = Number(process.env.BLOG_TRANSLATE_FETCH_TIMEOUT_MS || 20000);
const minLocaleWords = Number(process.env.BLOG_TRANSLATE_MIN_WORDS || 180);
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

const TARGETS = [
  { key: 'en', googleLang: 'en' },
  { key: 'ru', googleLang: 'ru' },
  { key: 'cn', googleLang: 'zh-CN' },
];
const EXCLUDED_BLOG_SLUGS = [
  'khong-tim-thay-trang',
  'can-sua-lai-noi-dung-bai-viet',
];
const EXCLUDED_BLOG_SLUG_PREFIXES = [
  'tuyet-voi-duoi-day-',
];
const VI_MARK_REGEX = /[ăâêôơưđáàạảãấầậẩẫắằặẳẵéèẹẻẽếềệểễíìịỉĩóòọỏõốồộổỗớờợởỡúùụủũứừựửữýỳỵỷỹ]/i;

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function runQuery(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    throw new Error(`Supabase Management API error ${res.status}`);
  }

  return JSON.parse(text);
}

function splitLongBlock(text, maxLen = 1600) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf('. ', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function chunkMarkdown(text, maxLen = 1600) {
  const blocks = text.split(/\n\n+/).flatMap((block) => splitLongBlock(block, maxLen));
  const chunks = [];
  let current = '';

  for (const block of blocks) {
    if (!block) continue;
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxLen && current) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!res.ok) {
    throw new Error(`Translate API failed ${res.status}`);
  }

  const data = await res.json();
  return (data?.[0] || []).map((part) => part?.[0] || '').join('').trim();
}

async function translateMarkdown(text, targetLang) {
  if (!text) return '';
  const chunks = chunkMarkdown(text);
  const translated = [];
  for (const chunk of chunks) {
    translated.push(await retryTranslateChunk(chunk, targetLang));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return translated.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function retryTranslateChunk(text, targetLang, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await translateChunk(text, targetLang);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function repairVietnameseResidue(text, targetLang) {
  if (!text || !VI_MARK_REGEX.test(text)) return text;

  const paragraphs = text.split(/\n\n+/);
  const repaired = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;
    if (VI_MARK_REGEX.test(paragraph)) {
      repaired.push(await retryTranslateChunk(paragraph, targetLang));
      await new Promise((resolve) => setTimeout(resolve, 150));
    } else {
      repaired.push(paragraph);
    }
  }
  return repaired.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchBacklogPosts() {
  const query = `
    SELECT slug, title, summary, content,
      title_en, title_ru, title_cn,
      summary_en, summary_ru, summary_cn,
      content_en, content_ru, content_cn,
      date
    FROM public.blog_posts
    WHERE slug NOT IN (${EXCLUDED_BLOG_SLUGS.map(sqlString).join(', ')})
      AND ${EXCLUDED_BLOG_SLUG_PREFIXES.map((prefix) => `slug NOT LIKE ${sqlString(`${prefix}%`)}`).join(' AND ')}
      AND coalesce(title, '') NOT ILIKE 'Tuyệt vời! Dưới đây%'
    ORDER BY date DESC NULLS LAST, slug ASC
    LIMIT ${Math.max(Number(limit), 500)};
  `;
  const rows = await runQuery(query);
  return rows.filter((post) => {
    return TARGETS.some((target) => localeNeedsBackfill(post, target.key));
  }).slice(0, Number(limit));
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

function localeNeedsBackfill(post, localeKey) {
  const title = String(post[`title_${localeKey}`] || '').trim();
  const summary = String(post[`summary_${localeKey}`] || '').trim();
  const content = String(post[`content_${localeKey}`] || '').trim();
  if (!title || !summary || countWords(content) < minLocaleWords) return true;
  if (repairResidueMode && VI_MARK_REGEX.test(content)) return true;
  return false;
}

function buildUpdateQuery(post, translations) {
  return `
    UPDATE public.blog_posts
    SET
      title_en = COALESCE(${sqlString(translations.title_en)}, title_en),
      title_ru = COALESCE(${sqlString(translations.title_ru)}, title_ru),
      title_cn = COALESCE(${sqlString(translations.title_cn)}, title_cn),
      summary_en = COALESCE(${sqlString(translations.summary_en)}, summary_en),
      summary_ru = COALESCE(${sqlString(translations.summary_ru)}, summary_ru),
      summary_cn = COALESCE(${sqlString(translations.summary_cn)}, summary_cn),
      content_en = COALESCE(${sqlString(translations.content_en)}, content_en),
      content_ru = COALESCE(${sqlString(translations.content_ru)}, content_ru),
      content_cn = COALESCE(${sqlString(translations.content_cn)}, content_cn),
      updated_at = now()
    WHERE slug = ${sqlString(post.slug)};
  `;
}

async function main() {
  const backlog = await fetchBacklogPosts();
  const processed = [];

  for (let index = 0; index < backlog.length; index += 1) {
    const post = backlog[index];
    if ((index + 1) % 10 === 0 || index === 0) {
      console.log(`[INFO] Blog locale backfill progress ${index + 1}/${backlog.length}: ${post.slug}`);
    }
    const translations = {};
    console.log(`Translating ${post.slug} ...`);
    for (const target of TARGETS) {
      const titleKey = `title_${target.key}`;
      const summaryKey = `summary_${target.key}`;
      const contentKey = `content_${target.key}`;
      const shouldBackfillLocale = localeNeedsBackfill(post, target.key);

      if (shouldBackfillLocale) {
        translations[titleKey] = await retryTranslateChunk(post.title, target.googleLang);
        translations[summaryKey] = await retryTranslateChunk(post.summary || '', target.googleLang);
        translations[contentKey] = await translateMarkdown(post.content || '', target.googleLang);
        translations[contentKey] = await repairVietnameseResidue(translations[contentKey], target.googleLang);
      } else {
        translations[titleKey] = post[titleKey];
        translations[summaryKey] = post[summaryKey];
        translations[contentKey] = post[contentKey];
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await runQuery(`BEGIN; ${buildUpdateQuery(post, translations)} COMMIT;`);
    processed.push({
      slug: post.slug,
      translatedLocales: TARGETS.map((target) => target.key),
    });
  }

  const coverage = await runQuery(`
    SELECT
      (SELECT count(*)::int FROM public.blog_posts WHERE slug NOT IN (${EXCLUDED_BLOG_SLUGS.map(sqlString).join(', ')}) AND title_en IS NOT NULL AND summary_en IS NOT NULL AND content_en IS NOT NULL) AS blogs_en_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE slug NOT IN (${EXCLUDED_BLOG_SLUGS.map(sqlString).join(', ')}) AND title_ru IS NOT NULL AND summary_ru IS NOT NULL AND content_ru IS NOT NULL) AS blogs_ru_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE slug NOT IN (${EXCLUDED_BLOG_SLUGS.map(sqlString).join(', ')}) AND title_cn IS NOT NULL AND summary_cn IS NOT NULL AND content_cn IS NOT NULL) AS blogs_cn_ready;
  `);

  console.log(JSON.stringify({
    translatedCount: processed.length,
    processed,
    coverage: coverage[0] || {},
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
