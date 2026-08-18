#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { runQuery } from './lib/seo_batch_shared.mjs';

const OUTPUT_PATH = process.env.BLOG_EDITORIAL_AUDIT_OUTPUT || 'BLOG_EDITORIAL_AUDIT.md';
const JSON_OUTPUT_PATH = process.env.BLOG_EDITORIAL_AUDIT_JSON || 'output/audits/blog-editorial-audit.json';

const OFF_TOPIC_TITLE_REGEX =
  /(xương khớp|gout|gút|thoát vị|vẹo cột sống|viêm khớp|thần kinh tọa|khớp háng|cột sống|màng não mô cầu|tophi|axit uric|purin|loạn sản khớp háng|trật khớp háng|vôi hóa|acid uric|não mô cầu|bàn chân|chân chữ|chân vòng kiềng|chân bẹt|bàn chân khoèo|bàn chân rũ|bắp chân|gót chân|gãy xương|ghép xương|đau lưng|đau cổ|đau vai gáy|cổ tay|khớp gối|cẳng cơ|căng cơ|trật khớp|bong gân|dị tật|đĩa đệm|ngón tay|ngón chân|chấn thương|phục hồi chức năng|vật lý trị liệu|gù lưng|huyết áp cao|de quervain|dải chậu chày|khô khớp|tràn dịch khớp|trượt đốt sống|ung thư xương|viêm bao gân|viêm bao hoạt dịch|viêm cơ|achilles|thay khớp gối|tiêm gân|viêm gót chân)/i;
const MARKETING_TITLE_REGEX =
  /(quà tặng|ưu đãi|khuyến mãi|giải thưởng|dời địa chỉ|địa chỉ trị mụn|phòng khám natural skin|bao nhiêu tiền.*natural skin|giá .*natural skin|tiết kiệm 1\/2 chi phí|cải tiến phương pháp|chiếu ánh sáng vàng tại natural skin)/i;
const BRANDED_TITLE_REGEX = /natural skin/i;
const COMMERCE_HEAVY_TITLE_REGEX =
  /(^top\s*\d+|^review\b|được yêu thích|được ưa chuộng|nên mua|bác sĩ khuyên dùng|bán chạy|nào tốt|hiệu quả nên mua|đánh giá cao|tin dùng năm|phổ biến 20\d{2}|top \d+)/i;
const CTA_CONTENT_REGEX = /(đặt lịch|đặt hẹn|liên hệ|gọi ngay|đến khám|khách hàng|quý khách|trên toàn hệ thống)/i;
const TESTIMONIAL_CONTENT_REGEX = /(mình đã|chia sẻ về hành trình|sinh viên,|tp\.hcm|bình dương|quận bình thạnh)/i;
const BRANDING_CONTENT_REGEX = /(natural skin|phòng khám da liễu natural skin|chi nhánh|võ oanh|điện biên phủ)/i;
const PROMO_CONTENT_REGEX = /(quà tặng|ưu đãi|khuyến mãi|giải thưởng|số lượng giới hạn|thông tin chương trình|căn cứ pháp lý|thông báo số)/i;

function countWords(source) {
  return String(source || '')
    .replace(/[#>*_~`-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function countHeadings(markdown) {
  return String(markdown || '')
    .split('\n')
    .filter((line) => /^#{1,6}\s+/.test(line.trim())).length;
}

function classifyRow(row) {
  const issues = [];
  const title = String(row.title || '').trim();
  const content = String(row.content || '').trim();
  const summary = String(row.summary || '').trim();
  const meta = String(row.meta_description || '').trim();

  if (OFF_TOPIC_TITLE_REGEX.test(title)) issues.push('off_topic');
  if (MARKETING_TITLE_REGEX.test(title)) issues.push('marketing_page');
  if (BRANDED_TITLE_REGEX.test(title)) issues.push('branded_title');
  if (COMMERCE_HEAVY_TITLE_REGEX.test(title)) issues.push('commerce_heavy_title');
  if (CTA_CONTENT_REGEX.test(content)) issues.push('cta_copy');
  if (TESTIMONIAL_CONTENT_REGEX.test(content)) issues.push('testimonial_copy');
  if (BRANDING_CONTENT_REGEX.test(content)) issues.push('branding_copy');
  if (PROMO_CONTENT_REGEX.test(content)) issues.push('promo_copy');

  const headingCount = countHeadings(content);
  const wordCount = countWords(content);
  if (headingCount === 0) issues.push('missing_heading_structure');
  if (wordCount < 350) issues.push('thin_content');
  if (summary.length < 110 || summary.length > 220) issues.push('summary_length');
  if (meta.length < 120 || meta.length > 170) issues.push('meta_length');

  let action = 'keep';
  if (issues.includes('off_topic') || issues.includes('marketing_page')) {
    action = 'remove';
  } else if (
    issues.includes('branding_copy') ||
    issues.includes('cta_copy') ||
    issues.includes('testimonial_copy') ||
    issues.includes('promo_copy') ||
    issues.includes('commerce_heavy_title')
  ) {
    action = 'rewrite';
  }

  return {
    slug: row.slug,
    title,
    action,
    issues,
    diagnostics: {
      headingCount,
      wordCount,
      summaryLength: summary.length,
      metaLength: meta.length,
    },
  };
}

function buildMarkdown(rows) {
  const remove = rows.filter((row) => row.action === 'remove');
  const rewrite = rows.filter((row) => row.action === 'rewrite');
  const issueCounts = new Map();

  for (const row of rows) {
    for (const issue of row.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    }
  }

  const lines = [];
  lines.push('# Blog Editorial Audit');
  lines.push('');
  lines.push(`- Generated at: \`${new Date().toISOString()}\``);
  lines.push(`- Audited posts: **${rows.length}**`);
  lines.push(`- Remove backlog: **${remove.length}**`);
  lines.push(`- Rewrite backlog: **${rewrite.length}**`);
  lines.push('');
  lines.push('## Issue Counts');
  lines.push('');
  lines.push('| issue | count |');
  lines.push('| --- | ---: |');
  for (const [issue, count] of [...issueCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| ${issue} | ${count} |`);
  }
  lines.push('');
  lines.push('## Remove Backlog');
  lines.push('');
  lines.push('| slug | title | issues |');
  lines.push('| --- | --- | --- |');
  for (const row of remove) {
    lines.push(`| ${row.slug} | ${row.title.replace(/\|/g, '\\|')} | ${row.issues.join(', ')} |`);
  }
  lines.push('');
  lines.push('## Rewrite Backlog');
  lines.push('');
  lines.push('| slug | title | issues | headings | words |');
  lines.push('| --- | --- | --- | ---: | ---: |');
  for (const row of rewrite.slice(0, 120)) {
    lines.push(`| ${row.slug} | ${row.title.replace(/\|/g, '\\|')} | ${row.issues.join(', ')} | ${row.diagnostics.headingCount} | ${row.diagnostics.wordCount} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const rows = await runQuery(`
    select slug, title, summary, meta_description, content
    from public.blog_posts
    where coalesce(slug, '') <> ''
    order by date desc nulls last, slug asc;
  `);

  const result = rows.map(classifyRow);
  const markdown = buildMarkdown(result);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(JSON_OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
  await fs.writeFile(JSON_OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');

  const removeCount = result.filter((row) => row.action === 'remove').length;
  const rewriteCount = result.filter((row) => row.action === 'rewrite').length;
  console.log(JSON.stringify({
    audited: result.length,
    removeCount,
    rewriteCount,
    output: OUTPUT_PATH,
    jsonOutput: JSON_OUTPUT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
