#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { runQuery, sqlString } from './lib/seo_batch_shared.mjs';

const AUDIT_JSON_PATH = process.env.BLOG_EDITORIAL_AUDIT_JSON || 'output/audits/blog-editorial-audit.json';
const OUTPUT_DIR = process.env.BLOG_EDITORIAL_CLEANUP_OUTPUT_DIR || 'output/audits';
const DRY_RUN = process.env.BLOG_EDITORIAL_CLEANUP_DRY_RUN === '1';

const SECTION_HEADINGS_TO_DROP = [
  'Hành Trình Từ Da Mụn Nặng Đến Nỗ Lực Phục Hồi',
  'An tâm điều trị cùng đội ngũ Bác sĩ chuyên khoa',
  'Thông tin chương trình',
  'Lưu ý quan trọng',
];

const TESTIMONIAL_HEADING_REGEX = /^##\s+[A-ZÀ-Ỹ][\p{L}]+(?:\s+[A-ZÀ-Ỹ][\p{L}]+){1,3}\s*:/u;

function cleanTitle(title) {
  return String(title || '')
    .replace(/^\[Giải Đáp\]\s*/i, '')
    .replace(/\bNatural Skin\b/gi, '')
    .replace(/\bBác Sĩ\s+Natural Skin\b/gi, 'Bác sĩ da liễu')
    .replace(/\bBác Sĩ Da Liễu Natural Skin\b/gi, 'Bác sĩ da liễu')
    .replace(/\bBác sĩ khuyên dùng\b/gi, '')
    .replace(/\bđược yêu thích(?: hiện nay)?\b/gi, '')
    .replace(/\bGiải pháp từ\s*$/i, '')
    .replace(/^TOP\s+/i, '')
    .replace(/^Review\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\?/g, '?')
    .replace(/\s+,/g, ',')
    .trim();
}

function cleanShortText(value) {
  return String(value || '')
    .replace(/\bNatural Skin\b/gi, 'bác sĩ da liễu')
    .replace(/mời bạn(?: đọc)?(?: cùng)? xem ngay bài viết sau đây\.?/giu, '')
    .replace(/mời bạn(?: cùng)? tìm hiểu(?: ngay)?\.?/giu, '')
    .replace(/xem ngay để tránh những tổn thương không đáng có!?/giu, '')
    .replace(/tìm hiểu nguyên nhân và cách điều trị hiệu quả\.?/giu, '')
    .replace(/tìm hiểu cách rửa mặt đúng chuẩn cho da mụn ngay\.?/giu, '')
    .replace(/không thể bỏ qua\b/giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function shouldDropParagraph(paragraph) {
  const text = String(paragraph || '').trim();
  if (!text) return true;
  if (SECTION_HEADINGS_TO_DROP.some((heading) => text === `## ${heading}`)) return true;
  if (TESTIMONIAL_HEADING_REGEX.test(text)) return true;
  if (/đã điều trị thành công tại natural skin/i.test(text)) return true;
  if (/sinh viên,\s*(tp\.?hcm|bình dương)|nvvp/i.test(text)) return true;
  if (/^“|^"/.test(text)) return true;
  if (/theo mình đánh giá|sau \d+\s*tháng điều trị|cải thiện (?:được )?\d+%|hành trình phục hồi làn da/i.test(text)) return true;
  if (/đặt lịch|đặt hẹn|liên hệ với natural skin|quà tặng|ưu đãi|khuyến mãi|giải thưởng|thông tin chương trình|căn cứ pháp lý|trên toàn hệ thống/i.test(text)) return true;
  if (/võ oanh|điện biên phủ|chi nhánh bình thạnh|quận bình thạnh/i.test(text)) return true;
  if (/^90% người trị mụn thất bại/i.test(text)) return true;
  if (/khảo sát của natural skin|khảo sát của bác sĩ da liễu/i.test(text)) return true;
  return false;
}

function cleanParagraph(paragraph) {
  return String(paragraph || '')
    .replace(/\bNatural Skin\b/gi, 'bác sĩ da liễu')
    .replace(/xem ngay để tránh những tổn thương không đáng có!?/giu, '')
    .replace(/mời bạn(?: đọc)? xem ngay bài viết sau đây\.?/giu, '')
    .replace(/mời bạn(?: cùng)? tìm hiểu(?: ngay)?\.?/giu, '')
    .replace(/để hiểu rõ hơn[^.]*bài viết sau đây\.?/giu, '')
    .replace(/cùng tìm hiểu[^.]*\./giu, '')
    .replace(/tìm hiểu[^.]*ngay\.?/giu, '')
    .replace(/xem ngay\.?/giu, '')
    .replace(/bài viết dưới đây(?: sẽ)?/giu, '')
    .replace(/không thể bỏ qua\b/giu, 'nên tham khảo')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanContent(content) {
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const nextBlocks = [];
  for (const block of blocks) {
    if (shouldDropParagraph(block)) continue;
    const cleaned = cleanParagraph(block);
    if (!cleaned) continue;
    nextBlocks.push(cleaned);
  }

  return nextBlocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
  const raw = await fs.readFile(AUDIT_JSON_PATH, 'utf8');
  const auditRows = JSON.parse(raw);
  const rewriteRows = auditRows.filter((row) => row.action === 'rewrite');
  const slugs = rewriteRows.map((row) => String(row.slug || '').trim()).filter(Boolean);

  if (slugs.length === 0) {
    console.log(JSON.stringify({ dryRun: DRY_RUN, updated: 0 }, null, 2));
    return;
  }

  const slugSql = slugs.map(sqlString).join(', ');
  const posts = await runQuery(`
    select slug, title, summary, meta_description, content
    from public.blog_posts
    where slug in (${slugSql})
    order by slug asc;
  `);

  const changed = [];
  for (const post of posts) {
    const next = {
      title: cleanTitle(post.title),
      summary: cleanShortText(post.summary),
      meta_description: cleanShortText(post.meta_description),
      content: cleanContent(post.content),
    };

    const delta = [];
    if (next.title !== post.title) delta.push('title');
    if (next.summary !== (post.summary || '')) delta.push('summary');
    if (next.meta_description !== (post.meta_description || '')) delta.push('meta_description');
    if (next.content !== (post.content || '')) delta.push('content');
    if (delta.length === 0) continue;

    changed.push({
      slug: post.slug,
      changes: delta,
      before: post,
      after: next,
    });

    if (!DRY_RUN) {
      await runQuery(`
        update public.blog_posts
        set
          title = ${sqlString(next.title)},
          summary = ${sqlString(next.summary)},
          meta_description = ${sqlString(next.meta_description)},
          content = ${sqlString(next.content)},
          updated_at = now()
        where slug = ${sqlString(post.slug)};
      `);
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUTPUT_DIR, `blog-editorial-cleanup-${timestamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(changed, null, 2), 'utf8');

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    updated: changed.length,
    reportPath,
    sample: changed.slice(0, 20).map((item) => ({ slug: item.slug, changes: item.changes })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
