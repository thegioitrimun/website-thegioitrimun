#!/usr/bin/env node

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
const VI_MARK_REGEX = /[ăâêôơưđáàạảãấầậẩẫắằặẳẵéèẹẻẽếềệểễíìịỉĩóòọỏõốồộổỗớờợởỡúùụủũứừựửữýỳỵỷỹ]/i;
const MIN_LENGTH_BY_LOCALE = { en: 1200, ru: 1200, cn: 650 };
const EXCLUDED_BLOG_SLUGS = [
  'khong-tim-thay-trang',
  'can-sua-lai-noi-dung-bai-viet',
];
const EXCLUDED_BLOG_SLUG_PREFIXES = [
  'tuyet-voi-duoi-day-',
];
const PLACEHOLDER_CONTENT_PATTERNS = [
  /i understand your request/i,
  /tôi hiểu yêu cầu/i,
  /trang bạn tìm kiếm/i,
  /page (you are looking for|not found)/i,
  /không tìm thấy trang/i,
  /placeholder/i,
  /tuyệt vời! dưới đây/i,
];
const SLUG_LENGTH_WARNING = 160;

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

async function runQuery(query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    throw new Error(`Supabase Management API error ${res.status}`);
  }
  return JSON.parse(text);
}

async function main() {
  const rows = await runQuery(`
    SELECT slug, title_en, title_ru, title_cn, summary_en, summary_ru, summary_cn, content_en, content_ru, content_cn
    FROM public.blog_posts
    WHERE slug NOT IN (${EXCLUDED_BLOG_SLUGS.map((slug) => `'${slug}'`).join(', ')})
      AND ${EXCLUDED_BLOG_SLUG_PREFIXES.map((prefix) => `slug NOT LIKE '${prefix.replace(/'/g, "''")}%'`).join(' AND ')}
      AND (
        title_en IS NOT NULL OR title_ru IS NOT NULL OR title_cn IS NOT NULL OR
        content_en IS NOT NULL OR content_ru IS NOT NULL OR content_cn IS NOT NULL
      )
    ORDER BY date DESC NULLS LAST, slug ASC;
  `);

  const findings = [];

  for (const row of rows) {
    if ((row.slug || '').length > SLUG_LENGTH_WARNING) {
      findings.push({ slug: row.slug, locale: 'all', issue: 'slug_too_long', length: row.slug.length });
    }
    for (const locale of ['en', 'ru', 'cn']) {
      const title = row[`title_${locale}`] || '';
      const summary = row[`summary_${locale}`] || '';
      const content = row[`content_${locale}`] || '';
      if (!title || !summary || !content) {
        findings.push({ slug: row.slug, locale, issue: 'missing_fields' });
        continue;
      }
      if (VI_MARK_REGEX.test(content) || VI_MARK_REGEX.test(summary) || VI_MARK_REGEX.test(title)) {
        findings.push({ slug: row.slug, locale, issue: 'contains_vietnamese_residue' });
      }
      if (PLACEHOLDER_CONTENT_PATTERNS.some((pattern) => pattern.test(`${title}\n${summary}\n${content}`))) {
        findings.push({ slug: row.slug, locale, issue: 'placeholder_content' });
      }
      if (content.length < MIN_LENGTH_BY_LOCALE[locale]) {
        findings.push({ slug: row.slug, locale, issue: 'content_too_short', length: content.length });
      }
    }
  }

  const summary = findings.reduce((acc, item) => {
    acc[item.issue] = (acc[item.issue] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    auditedRows: rows.length,
    findingsCount: findings.length,
    summary,
    findings: findings.slice(0, 80),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
