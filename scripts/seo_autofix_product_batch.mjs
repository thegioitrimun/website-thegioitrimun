#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeContentBlocks,
  normalizeFaqItems,
  normalizeString,
  normalizeTextArray,
  runQuery,
  sleep,
  sqlJson,
  sqlString,
  translateText,
  uniqBy,
} from './lib/seo_batch_shared.mjs';

const OUTPUT_PATH = process.env.PRODUCT_SEO_AUTOFIX_OUTPUT || 'PRODUCT_SEO_AUTOFIX_REPORT.md';
const LIMIT = Number(process.env.PRODUCT_SEO_AUTOFIX_LIMIT || '400');
const DRY_RUN = process.env.PRODUCT_SEO_AUTOFIX_DRY_RUN === '1';
const TARGETS = [
  { key: 'en', lang: 'en' },
  { key: 'ru', lang: 'ru' },
  { key: 'cn', lang: 'zh-CN' },
];

function sqlTextArray(values) {
  if (!Array.isArray(values) || values.length === 0) return 'NULL';
  return `ARRAY[${values.map((value) => sqlString(value)).join(', ')}]::text[]`;
}

function asJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildProductMarkdown(product) {
  const benefits = normalizeTextArray(product.key_benefits);
  const skinTypes = normalizeTextArray(product.skin_types);
  const lines = [];
  lines.push('## Tổng quan sản phẩm');
  lines.push(normalizeString(product.description) || `${product.name} là sản phẩm được xây dựng để hỗ trợ nhu cầu chăm sóc chuyên sâu trong routine hằng ngày.`);
  lines.push('');
  lines.push('## Công dụng nổi bật');
  if (benefits.length > 0) {
    for (const benefit of benefits.slice(0, 5)) lines.push(`- ${benefit}`);
  } else {
    lines.push(`- ${product.name} phù hợp để bổ sung vào routine chăm sóc da theo nhu cầu thực tế.`);
    lines.push(`- Có thể cân nhắc khi người dùng cần một giải pháp từ thương hiệu ${product.brand || 'Thế Giới Trị Mụn'}.`);
  }
  lines.push('');
  lines.push('## Hướng dẫn sử dụng');
  lines.push(normalizeString(product.usage_instructions) || 'Sử dụng theo hướng dẫn chuyên môn hoặc theo routine hiện tại của người dùng. Nếu da nhạy cảm, nên tăng tần suất từ từ và theo dõi phản ứng của da.');
  lines.push('');
  lines.push('## Thành phần và điểm cần lưu ý');
  lines.push(normalizeString(product.ingredients) || 'Tham khảo thành phần chi tiết trên bao bì sản phẩm hoặc trong phần tư vấn chuyên sâu khi cần xây dựng routine cá nhân hóa.');
  lines.push('');
  lines.push('## Loại da và trải nghiệm kết cấu');
  if (skinTypes.length > 0) {
    lines.push(`- Loại da phù hợp: ${skinTypes.join(', ')}.`);
  }
  if (normalizeString(product.texture)) {
    lines.push(`- Kết cấu: ${product.texture}.`);
  }
  if (normalizeString(product.origin)) {
    lines.push(`- Xuất xứ tham khảo: ${product.origin}.`);
  }
  if (normalizeString(product.brand)) {
    lines.push(`- Thương hiệu: ${product.brand}.`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildFaq(product) {
  const existing = normalizeFaqItems(product.faq_items);
  if (existing.length >= 3) return existing;

  const benefits = normalizeTextArray(product.key_benefits);
  const skinTypes = normalizeTextArray(product.skin_types);
  const generated = [
    {
      question: `${product.name} phù hợp với ai?`,
      answer: skinTypes.length > 0
        ? `${product.name} phù hợp cho ${skinTypes.join(', ')}. Người dùng nên đối chiếu thêm tình trạng da, routine hiện tại và mục tiêu chăm sóc để chọn đúng tần suất sử dụng.`
        : `${product.name} phù hợp với người dùng đang tìm một giải pháp chăm sóc chuyên sâu từ ${product.brand || 'Thế Giới Trị Mụn'}. Nếu da đang nhạy cảm hoặc có treatment mạnh, nên dùng theo lộ trình tăng dần.`,
    },
    {
      question: `Cách dùng ${product.name} như thế nào?`,
      answer: normalizeString(product.usage_instructions)
        || `Sử dụng ${product.name} theo hướng dẫn đi kèm trên bao bì hoặc theo routine đã được tư vấn. Khi mới bắt đầu, nên dùng với tần suất thấp rồi tăng dần để theo dõi khả năng dung nạp của da.`,
    },
    {
      question: `${product.name} có điểm nổi bật nào?`,
      answer: benefits.length > 0
        ? `${product.name} được quan tâm nhờ các điểm nổi bật như ${benefits.slice(0, 3).join(', ')}.`
        : `${product.name} là sản phẩm tập trung vào nhu cầu chăm sóc da chuyên sâu, phù hợp để ghép với routine hiện tại khi cần tăng hiệu quả điều trị hoặc duy trì kết quả.`,
    },
    {
      question: `Thành phần hoặc nguồn gốc của ${product.name} có gì cần lưu ý?`,
      answer: [normalizeString(product.ingredients), normalizeString(product.origin) ? `Xuất xứ tham khảo: ${product.origin}.` : '']
        .filter(Boolean)
        .join(' ')
        || `Người dùng nên kiểm tra bảng thành phần đầy đủ trên bao bì và ưu tiên patch test nếu da dễ kích ứng.`,
    },
  ];

  return uniqBy([...existing, ...generated], (item) => item.question).slice(0, 4);
}

function ensureLongDescription(product, galleryImages) {
  const blocks = normalizeContentBlocks(product.long_description);
  const textBlocks = blocks.filter((block) => block.type === 'text' && normalizeString(block.content));
  const imageBlocks = blocks.filter((block) => block.type === 'image' && normalizeString(block.image_path));
  const nextBlocks = [...blocks];
  let changed = false;

  if (textBlocks.length === 0) {
    nextBlocks.unshift({ type: 'text', content: buildProductMarkdown(product) });
    changed = true;
  }

  if (imageBlocks.length === 0) {
    const galleryImage = galleryImages.find((item) => normalizeString(item.image_path));
    if (galleryImage) {
      nextBlocks.push({
        type: 'image',
        image_path: galleryImage.image_path,
        caption: `Hình minh họa ${product.name}`,
      });
      changed = true;
    }
  }

  return { changed, blocks: nextBlocks };
}

async function translateLocale(product, localeKey, targetLang) {
  const benefits = normalizeTextArray(product.key_benefits);
  const translatedBenefits = [];
  for (const benefit of benefits) {
    const translatedBenefit = await translateText(benefit, targetLang);
    if (normalizeString(translatedBenefit)) translatedBenefits.push(normalizeString(translatedBenefit));
    await sleep(80);
  }
  return {
    [`name_${localeKey}`]: normalizeString(await translateText(product.name, targetLang)),
    [`description_${localeKey}`]: normalizeString(await translateText(product.description, targetLang)),
    [`usage_instructions_${localeKey}`]: normalizeString(await translateText(product.usage_instructions, targetLang)),
    [`ingredients_${localeKey}`]: normalizeString(await translateText(product.ingredients, targetLang)),
    [`key_benefits_${localeKey}`]: translatedBenefits,
    [`origin_${localeKey}`]: normalizeString(await translateText(product.origin, targetLang)),
    [`texture_${localeKey}`]: normalizeString(await translateText(product.texture, targetLang)),
  };
}

function localeNeedsBackfill(product, localeKey) {
  const hasName = normalizeString(product[`name_${localeKey}`]);
  const hasDescription = normalizeString(product[`description_${localeKey}`]);
  const hasSupport = normalizeString(product[`usage_instructions_${localeKey}`])
    || normalizeString(product[`ingredients_${localeKey}`])
    || normalizeTextArray(product[`key_benefits_${localeKey}`]).length > 0;
  return !(hasName && hasDescription && hasSupport);
}

async function fetchProducts() {
  return runQuery(`
    with gallery as (
      select
        pi.product_id,
        json_agg(
          json_build_object(
            'id', pi.id,
            'image_path', pi.image_path,
            'display_order', coalesce(pi.display_order, 999999),
            'is_primary', coalesce(pi.is_primary, false)
          )
          order by coalesce(pi.display_order, 999999), pi.id
        ) as images
      from public.product_images pi
      group by pi.product_id
    )
    select
      p.id,
      p.slug,
      p.name,
      p.description,
      p.long_description,
      p.usage_instructions,
      p.ingredients,
      p.key_benefits,
      p.skin_types,
      p.origin,
      p.texture,
      p.brand,
      p.faq_items,
      p.name_en,
      p.name_ru,
      p.name_cn,
      p.description_en,
      p.description_ru,
      p.description_cn,
      p.usage_instructions_en,
      p.usage_instructions_ru,
      p.usage_instructions_cn,
      p.ingredients_en,
      p.ingredients_ru,
      p.ingredients_cn,
      p.key_benefits_en,
      p.key_benefits_ru,
      p.key_benefits_cn,
      p.origin_en,
      p.origin_ru,
      p.origin_cn,
      p.texture_en,
      p.texture_ru,
      p.texture_cn,
      coalesce(gallery.images, '[]'::json) as gallery_images
    from public.products p
    left join gallery on gallery.product_id = p.id
    where coalesce(p.is_published, false) = true
    order by p.id asc
    limit ${LIMIT};
  `);
}

async function applyProductUpdate(product, payload) {
  const assignments = [];
  const fields = [
    'faq_items',
    'long_description',
    'name_en', 'name_ru', 'name_cn',
    'description_en', 'description_ru', 'description_cn',
    'usage_instructions_en', 'usage_instructions_ru', 'usage_instructions_cn',
    'ingredients_en', 'ingredients_ru', 'ingredients_cn',
    'key_benefits_en', 'key_benefits_ru', 'key_benefits_cn',
    'origin_en', 'origin_ru', 'origin_cn',
    'texture_en', 'texture_ru', 'texture_cn',
  ];

  for (const field of fields) {
    if (!(field in payload)) continue;
    const value = payload[field];
    if (field.startsWith('key_benefits_') && Array.isArray(value)) {
      assignments.push(`${field} = ${sqlTextArray(value)}`);
    } else if (Array.isArray(value) || (value && typeof value === 'object')) {
      assignments.push(`${field} = ${sqlJson(value)}`);
    } else {
      assignments.push(`${field} = ${sqlString(value || null)}`);
    }
  }
  assignments.push('updated_at = now()');

  if (assignments.length > 1) {
    await runQuery(`
      update public.products
      set ${assignments.join(',\n          ')}
      where id = ${Number(product.id)};
    `);
  }

  if (Array.isArray(payload.gallery_inserts) && payload.gallery_inserts.length > 0) {
    const values = payload.gallery_inserts
      .map((item) => `(${Number(product.id)}, ${sqlString(item.image_path)}, ${Number(item.display_order)}, false)`)
      .join(',\n        ');
    await runQuery(`
      insert into public.product_images (product_id, image_path, display_order, is_primary)
      values
        ${values}
      on conflict (product_id, image_path) do nothing;
    `);
  }
}

function buildReport(results) {
  const changed = results.filter((item) => item.changed);
  const lines = [];
  lines.push('# Product SEO Autofix Report');
  lines.push('');
  lines.push(`- Generated at: \`${new Date().toISOString()}\``);
  lines.push(`- Dry run: **${DRY_RUN ? 'yes' : 'no'}**`);
  lines.push(`- Audited rows: **${results.length}**`);
  lines.push(`- Changed rows: **${changed.length}**`);
  lines.push('');
  lines.push('| slug | changes | locales_backfilled | faq | gallery_inserts | long_description_blocks |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of changed.slice(0, 80)) {
    lines.push(`| ${item.slug} | ${item.changes.join(', ')} | ${item.locales.join(', ')} | ${item.faqCount} | ${item.galleryInserts} | ${item.longDescriptionBlocks} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const products = await fetchProducts();
  const results = [];

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    if ((index + 1) % 20 === 0 || index === 0) {
      console.log(`[INFO] Product SEO autofix progress ${index + 1}/${products.length}: ${product.slug}`);
    }
    const galleryImages = asJsonArray(product.gallery_images);
    const payload = {};
    const changes = [];
    const localeChanges = [];

    const faqItems = buildFaq(product);
    if (JSON.stringify(faqItems) !== JSON.stringify(normalizeFaqItems(product.faq_items))) {
      payload.faq_items = faqItems;
      changes.push('faq_items');
    }

    const longDescription = ensureLongDescription(product, galleryImages);
    if (longDescription.changed) {
      payload.long_description = longDescription.blocks;
      changes.push('long_description');
    }

    const existingGalleryPaths = new Set(galleryImages.map((item) => normalizeString(item.image_path)).filter(Boolean));
    const longDescriptionBlocks = normalizeContentBlocks(payload.long_description ?? product.long_description);
    const longDescriptionImagePaths = uniqBy(
      longDescriptionBlocks
        .filter((block) => block.type === 'image' && normalizeString(block.image_path))
        .map((block) => normalizeString(block.image_path)),
      (item) => item,
    );

    const galleryInserts = [];
    let nextDisplayOrder = galleryImages.length > 0
      ? Math.max(...galleryImages.map((item) => Number(item.display_order || 0))) + 1
      : 1;
    for (const imagePath of longDescriptionImagePaths) {
      if (existingGalleryPaths.has(imagePath)) continue;
      galleryInserts.push({ image_path: imagePath, display_order: nextDisplayOrder });
      existingGalleryPaths.add(imagePath);
      nextDisplayOrder += 1;
    }
    if (galleryInserts.length > 0) {
      payload.gallery_inserts = galleryInserts;
      changes.push('gallery_from_long_description');
    }

    for (const target of TARGETS) {
      if (!localeNeedsBackfill(product, target.key)) continue;
      const translatedFields = await translateLocale(product, target.key, target.lang);
      for (const [field, value] of Object.entries(translatedFields)) {
        if (Array.isArray(value)) {
          if (value.length > 0) payload[field] = value;
        } else if (normalizeString(value)) {
          payload[field] = value;
        }
      }
      localeChanges.push(target.key);
      changes.push(`locale_${target.key}`);
      await sleep(150);
    }

    const changed = changes.length > 0;
    if (changed && !DRY_RUN) {
      await applyProductUpdate(product, payload);
      await sleep(150);
    }

    results.push({
      slug: product.slug,
      changed,
      changes,
      locales: localeChanges,
      faqCount: normalizeFaqItems(payload.faq_items ?? product.faq_items).length,
      galleryInserts: Array.isArray(payload.gallery_inserts) ? payload.gallery_inserts.length : 0,
      longDescriptionBlocks: normalizeContentBlocks(payload.long_description ?? product.long_description).length,
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
