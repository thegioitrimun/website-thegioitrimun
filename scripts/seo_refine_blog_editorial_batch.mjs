#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildMetaDescription,
  countWords,
  normalizeString,
  runQuery,
  sqlString,
} from './lib/seo_batch_shared.mjs';

const OUTPUT_PATH = process.env.BLOG_SEO_EDITORIAL_OUTPUT || 'BLOG_SEO_EDITORIAL_REPORT.md';
const DRY_RUN = process.env.BLOG_SEO_EDITORIAL_DRY_RUN === '1';

const EDITORIAL_OVERRIDES = {
  'dau-than-kinh-toa-nhung-dieu-ban-can-biet-ve-trieu-chung-bien-chung-va-cach-cham-soc': {
    title: 'Đau thần kinh tọa: triệu chứng, biến chứng và cách chăm sóc',
    summary:
      'Đau thần kinh tọa gây đau lan từ thắt lưng xuống mông và chân, ảnh hưởng rõ đến sinh hoạt hằng ngày. Bài viết giúp bạn nhận biết triệu chứng, biến chứng và cách chăm sóc đúng để giảm đau, hạn chế tái phát.',
    metaDescription:
      'Đau thần kinh tọa gây đau lan từ thắt lưng xuống mông và chân. Tìm hiểu triệu chứng, biến chứng và cách chăm sóc đúng để giảm đau, hạn chế tái phát.',
  },
  'ban-chan-veo-hieu-dung-de-giup-be': {
    title: 'Bàn chân vẹo ở trẻ: dấu hiệu và hướng điều trị sớm',
  },
  'benh-gut-co-an-duoc-dau-phu-khong': {
    title: 'Bệnh gút có ăn được đậu phụ không và ăn sao cho đúng?',
  },
  'benh-gut-co-an-duoc-dua-khong': {
    title: 'Bệnh gút có ăn được dứa không và cần lưu ý gì?',
  },
  'benh-vienm-got-chan-tim-hienu-nguyenn-nhuon-trienu-chzhong-va-cach-dieu-tri-hi-qu': {
    title: 'Viêm gót chân: nguyên nhân, triệu chứng và cách điều trị',
    summary:
      'Viêm gót chân có thể gây đau nhói khi mới bước xuống giường hoặc sau khi đứng lâu. Bài viết giải thích nguyên nhân, triệu chứng thường gặp và hướng điều trị để giảm đau, phục hồi vận động.',
    metaDescription:
      'Viêm gót chân gây đau nhói khi bước đi hoặc đứng lâu. Tìm hiểu nguyên nhân, triệu chứng thường gặp và hướng điều trị để giảm đau, phục hồi vận động.',
    leadHeadingMatch: 'BỆNH VIÊM GÓT CHÂN: TÌM HIỂU NGUYÊN NHÂN, TRIỆU CHỨNG VÀ CÁCH ĐIỀU TRỊ HIỆU QUẢ',
  },
  'bi-gout-co-uong-bia-duoc-khong': {
    title: 'Bị gout có uống bia được không và cần kiêng thế nào?',
  },
  'bi-gut-co-an-oc-duoc-khong': {
    title: 'Bị gút có ăn ốc được không và nên ăn thế nào?',
  },
  'bi-gut-co-uong-ca-phe-duoc-khong': {
    title: 'Bị gút có uống cà phê được không và cần lưu ý gì?',
  },
  'che-do-an-khoa-hoc-cho-nguoi-benh-gut-goi-y-thuc-don-7-ngay-giup-ho-tro-kiem-soat-benh': {
    title: 'Thực đơn 7 ngày cho người bệnh gút: ăn sao để dễ kiểm soát',
  },
  'di-tat-dinh-ngon-o-tre-nhung-dieu-can-biet-ve-nguyen-nhan-dau-hieu-va-cach-dieu-tri': {
    title: 'Dị tật dính ngón ở trẻ: dấu hiệu, nguyên nhân và điều trị',
  },
  'nguoi-benh-gut-an-muop-duoc-khong': {
    title: 'Người bệnh gút ăn mướp được không và có lợi gì?',
  },
  'nhiem-trung-hat-tophi-o-nguoi-benh-gout-dau-hieu-nguy-hiem-va-cach-phong-tranh': {
    title: 'Nhiễm trùng hạt tophi: dấu hiệu nguy hiểm và phòng tránh',
  },
  'thoat-vi-dia-dem-cot-song-co-hieu-ro-nguyen-nhan-dau-hieu-va-cac-phuong-phap-dieu-tri-hien-nay': {
    title: 'Thoát vị đĩa đệm cột sống cổ: dấu hiệu và hướng điều trị',
  },
  'trat-khop-hang-bao-lau-thi-khoi': {
    title: 'Trật khớp háng bao lâu thì khỏi và hồi phục ra sao?',
  },
  'viem-khop-cung-chau-nhung-bai-tap-giup-ban-cai-thien-con-dau-va-song-thoai-mai-hon': {
    title: 'Viêm khớp cùng chậu: bài tập giúp giảm đau và dễ vận động',
  },
  'viem-mang-nao-mo-cau-benh-dang-hoanh-hanh-tai-phu-quoc': {
    title: 'Viêm màng não mô cầu ở Phú Quốc: dấu hiệu và phòng ngừa',
  },
  'voi-hoa-cot-song-la-gi': {
    title: 'Vôi hóa cột sống là gì? Dấu hiệu, nguyên nhân và điều trị',
  },
  '5-du-hiu-nhn-bit-bnh-no-m-cu-trong-6-gi-du': {
    appendix: [
      '## Khi nào cần đưa người bệnh đi cấp cứu?',
      '',
      'Nếu người bệnh sốt cao đột ngột kèm đau đầu dữ dội, ban xuất huyết, nôn nhiều, lừ đừ hoặc khó đánh thức, không nên chờ theo dõi tại nhà. Hãy đưa người bệnh đến cơ sở y tế hoặc gọi cấp cứu ngay vì nhiễm não mô cầu có thể chuyển nặng chỉ trong vài giờ. Can thiệp sớm giúp bác sĩ đánh giá, dùng kháng sinh và xử trí biến chứng kịp thời.',
    ].join('\n'),
  },
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateOverride(slug, override) {
  if (override.title) {
    const titleLength = override.title.length;
    if (titleLength < 35 || titleLength > 78) {
      throw new Error(`${slug}: title length ${titleLength} is outside 35-78 chars`);
    }
  }

  if (override.summary) {
    const summaryLength = override.summary.length;
    if (summaryLength < 110 || summaryLength > 220) {
      throw new Error(`${slug}: summary length ${summaryLength} is outside 110-220 chars`);
    }
  }

  if (override.metaDescription) {
    const metaLength = override.metaDescription.length;
    if (metaLength < 120 || metaLength > 170) {
      throw new Error(`${slug}: meta description length ${metaLength} is outside 120-170 chars`);
    }
  }
}

function replaceLeadTitle(content, oldTitle, newTitle, leadHeadingMatch) {
  let next = String(content || '');
  const replacements = [
    {
      regex: new RegExp(`^#\\s+${escapeRegExp(oldTitle)}\\s*$`, 'm'),
      value: `# ${newTitle}`,
    },
    {
      regex: new RegExp(`^\\*\\*${escapeRegExp(oldTitle)}\\*\\*\\s*$`, 'm'),
      value: `**${newTitle}**`,
    },
  ];

  if (leadHeadingMatch) {
    replacements.push({
      regex: new RegExp(`^\\*\\*${escapeRegExp(leadHeadingMatch)}\\*\\*\\s*$`, 'm'),
      value: `**${newTitle}**`,
    });
  }

  for (const replacement of replacements) {
    if (replacement.regex.test(next)) {
      next = next.replace(replacement.regex, replacement.value);
    }
  }

  return next;
}

function insertAppendix(content, appendix) {
  if (!appendix) return String(content || '');
  const source = String(content || '').trim();
  const trimmedAppendix = appendix.trim();
  const appendixHeading = trimmedAppendix.split('\n')[0];

  if (source.includes(appendixHeading)) return source;

  const startMarker = '<!-- seo-autofix:start -->';
  if (source.includes(startMarker)) {
    return source.replace(startMarker, `${trimmedAppendix}\n\n${startMarker}`).trim();
  }

  return [source, trimmedAppendix].filter(Boolean).join('\n\n').trim();
}

function buildPayload(post, override) {
  validateOverride(post.slug, override);

  const next = {
    title: normalizeString(post.title),
    summary: normalizeString(post.summary),
    meta_description: normalizeString(post.meta_description),
    content: normalizeString(post.content),
  };
  const changes = [];

  if (override.title && override.title !== next.title) {
    next.content = replaceLeadTitle(next.content, next.title, override.title, override.leadHeadingMatch);
    next.title = override.title;
    changes.push('title');
  }

  if (override.summary && override.summary !== next.summary) {
    next.summary = override.summary;
    changes.push('summary');
  }

  if (override.metaDescription && override.metaDescription !== next.meta_description) {
    next.meta_description = override.metaDescription;
    changes.push('meta_description');
  } else if (override.summary && !override.metaDescription) {
    const nextMeta = buildMetaDescription(next.summary, next.content, next.title);
    if (nextMeta && nextMeta !== next.meta_description) {
      next.meta_description = nextMeta;
      changes.push('meta_description');
    }
  }

  if (override.appendix) {
    const nextContent = insertAppendix(next.content, override.appendix);
    if (nextContent !== next.content) {
      next.content = nextContent;
      changes.push('content');
    }
  }

  return {
    changed: changes.length > 0,
    changes,
    payload: next,
    wordCount: countWords(next.content),
  };
}

async function fetchPosts() {
  const slugs = Object.keys(EDITORIAL_OVERRIDES)
    .map((slug) => sqlString(slug))
    .join(', ');

  return runQuery(`
    select slug, title, summary, meta_description, content
    from public.blog_posts
    where slug in (${slugs})
    order by slug asc;
  `);
}

async function applyUpdate(post, payload) {
  await runQuery(`
    update public.blog_posts
    set
      title = ${sqlString(payload.title)},
      summary = ${sqlString(payload.summary)},
      meta_description = ${sqlString(payload.meta_description || null)},
      content = ${sqlString(payload.content)},
      updated_at = now()
    where slug = ${sqlString(post.slug)};
  `);
}

function buildReport(results) {
  const changed = results.filter((item) => item.changed);
  const lines = [];
  lines.push('# Blog SEO Editorial Refinement Report');
  lines.push('');
  lines.push(`- Generated at: \`${new Date().toISOString()}\``);
  lines.push(`- Dry run: **${DRY_RUN ? 'yes' : 'no'}**`);
  lines.push(`- Audited rows: **${results.length}**`);
  lines.push(`- Changed rows: **${changed.length}**`);
  lines.push('');
  lines.push('| slug | changes | title_len | summary_len | meta_len | words |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (const item of results) {
    lines.push(
      `| ${item.slug} | ${item.changes.join(', ') || 'none'} | ${item.titleLength} | ${item.summaryLength} | ${item.metaLength} | ${item.wordCount} |`,
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const posts = await fetchPosts();
  const results = [];

  for (const post of posts) {
    const override = EDITORIAL_OVERRIDES[post.slug];
    if (!override) continue;

    const result = buildPayload(post, override);
    results.push({
      slug: post.slug,
      changed: result.changed,
      changes: result.changes,
      titleLength: result.payload.title.length,
      summaryLength: result.payload.summary.length,
      metaLength: result.payload.meta_description.length,
      wordCount: result.wordCount,
    });

    if (!DRY_RUN && result.changed) {
      await applyUpdate(post, result.payload);
    }
  }

  const report = buildReport(results);
  const outputPath = path.resolve(OUTPUT_PATH);
  await fs.writeFile(outputPath, report, 'utf8');
  console.log(JSON.stringify({
    audited: results.length,
    changed: results.filter((item) => item.changed).length,
    dryRun: DRY_RUN,
    output: outputPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
