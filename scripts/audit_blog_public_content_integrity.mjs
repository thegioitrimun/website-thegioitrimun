#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const minLength = Number(process.env.BLOG_AUDIT_MIN_CONTENT_LEN || 4000);
const outPath = process.env.BLOG_AUDIT_OUT || 'BLOG_CONTENT_AUDIT.md';

const EXCLUDED_BLOG_SLUGS = [
  'can-sua-lai-noi-dung-bai-viet',
  'khong-tim-thay-trang',
];
const EXCLUDED_BLOG_SLUG_PREFIXES = [
  'tuyet-voi-duoi-day-',
];

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

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
    throw new Error(`Supabase Management API error ${res.status}: ${text.slice(0, 1000)}`);
  }

  return JSON.parse(text);
}

function normalizeInt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildIssueList(row) {
  const issues = [];
  const baseContentLen = normalizeInt(row.base_content_len);
  const publicContentLen = normalizeInt(row.public_content_len);
  const baseSummaryLen = normalizeInt(row.base_summary_len);
  const publicSummaryLen = normalizeInt(row.public_summary_len);

  if (!row.public_slug) issues.push('missing_public_row');
  if (baseContentLen > 0 && publicContentLen === 0) issues.push('public_content_empty');
  if (baseSummaryLen > 0 && publicSummaryLen === 0) issues.push('public_summary_empty');
  if (row.base_category_slug !== row.public_category_slug) issues.push('category_mismatch');
  if (row.base_title !== row.public_title) issues.push('title_mismatch');
  if (baseContentLen > 0 && publicContentLen > 0 && Math.abs(baseContentLen - publicContentLen) > 200) {
    issues.push('content_length_mismatch');
  }

  return issues;
}

function toMarkdown(summary, findings) {
  const lines = [];
  lines.push(`# Blog Content Audit`);
  lines.push('');
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Project: \`${projectRef}\``);
  lines.push(`- Min content length audited: \`${minLength}\``);
  lines.push(`- Long posts audited: \`${summary.audited}\``);
  lines.push(`- Findings: \`${summary.findings}\``);
  lines.push('');

  if (findings.length === 0) {
    lines.push(`No mismatches found between \`blog_posts\` and \`public_blog_posts\` for long articles.`);
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  lines.push(`| Slug | Base len | Public len | Issues |`);
  lines.push(`| --- | ---: | ---: | --- |`);
  for (const finding of findings) {
    lines.push(`| ${finding.slug} | ${finding.base_content_len} | ${finding.public_content_len} | ${finding.issues.join(', ')} |`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const exclusionSql = [
    `slug NOT IN (${EXCLUDED_BLOG_SLUGS.map(sqlString).join(', ')})`,
    ...EXCLUDED_BLOG_SLUG_PREFIXES.map((prefix) => `slug NOT LIKE ${sqlString(`${prefix}%`)}`),
  ].join(' AND ');

  const rows = await runQuery(`
    WITH base AS (
      SELECT
        slug,
        title AS base_title,
        category_slug AS base_category_slug,
        length(coalesce(summary, ''))::int AS base_summary_len,
        length(coalesce(content, ''))::int AS base_content_len
      FROM public.blog_posts
      WHERE ${exclusionSql}
        AND length(coalesce(content, '')) >= ${minLength}
    ),
    public_view AS (
      SELECT
        slug AS public_slug,
        title AS public_title,
        category_slug AS public_category_slug,
        length(coalesce(summary, ''))::int AS public_summary_len,
        length(coalesce(content, ''))::int AS public_content_len
      FROM public.public_blog_posts
    )
    SELECT
      base.slug,
      base.base_title,
      base.base_category_slug,
      base.base_summary_len,
      base.base_content_len,
      public_view.public_slug,
      public_view.public_title,
      public_view.public_category_slug,
      public_view.public_summary_len,
      public_view.public_content_len
    FROM base
    LEFT JOIN public_view
      ON public_view.public_slug = base.slug
    ORDER BY base.base_content_len DESC, base.slug ASC;
  `);

  const findings = rows
    .map((row) => ({
      ...row,
      issues: buildIssueList(row),
    }))
    .filter((row) => row.issues.length > 0);

  const summary = {
    audited: rows.length,
    findings: findings.length,
  };

  const markdown = toMarkdown(summary, findings);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, 'utf8');

  console.log(`[INFO] Audited ${summary.audited} long posts`);
  console.log(`[INFO] Findings: ${summary.findings}`);
  console.log(`[INFO] Report written to ${outPath}`);

  if (findings.length > 0) {
    for (const finding of findings.slice(0, 20)) {
      console.log(`- ${finding.slug}: ${finding.issues.join(', ')}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
