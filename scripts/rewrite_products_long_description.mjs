#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykcrngqhyinczmvwduox.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc';

const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '';

const DRY_RUN = process.env.PRODUCT_LONGDESC_REWRITE_DRY_RUN === '1';
const ONLY_PUBLISHED = process.env.PRODUCT_LONGDESC_REWRITE_ONLY_PUBLISHED === '1';
const LIMIT = Number(process.env.PRODUCT_LONGDESC_REWRITE_LIMIT || '0') || Infinity;
const PAGE_SIZE = Number(process.env.PRODUCT_LONGDESC_REWRITE_PAGE_SIZE || '25');
const CONCURRENCY = Number(process.env.PRODUCT_LONGDESC_REWRITE_CONCURRENCY || '2');

const SKIN_TYPES = [
  'Da thường',
  'Da khô',
  'Da dầu',
  'Da hỗn hợp',
  'Da nhạy cảm',
  'Da mụn',
];

function assertConfig() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing SUPABASE_ADMIN_EMAIL/E2E_ADMIN_EMAIL or SUPABASE_ADMIN_PASSWORD/E2E_ADMIN_PASSWORD');
  }
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
  return normalizeArray(value)
    .map((entry) => normalizeString(typeof entry === 'string' ? entry : ''))
    .filter(Boolean);
}

function normalizeFaqItems(value) {
  return normalizeArray(value)
    .map((entry) => ({
      question: normalizeString(entry?.question),
      answer: normalizeString(entry?.answer),
    }))
    .filter((entry) => entry.question && entry.answer);
}

function detectProductType(name) {
  const s = normalizeString(name).toLowerCase();
  if (!s) return 'skincare';
  if (/(vien uong|viên uống|capsule|tablet|siro|syrup|dietary supplement|supplement)/i.test(s)) return 'supplement';
  if (/(sua rua mat|sữa rửa mặt|cleanser)/i.test(s)) return 'cleanser';
  if (/(toner|lotion|nước hoa hồng)/i.test(s)) return 'toner';
  if (/(serum|tinh chat|tinh chất)/i.test(s)) return 'serum';
  if (/(kem|cream|creme)/i.test(s)) return 'cream';
  if (/(gel)/i.test(s)) return 'gel';
  if (/(mat na|mặt nạ|mask)/i.test(s)) return 'mask';
  if (/(chong nang|chống nắng|sunscreen|spf\\s*\\d+)/i.test(s)) return 'sunscreen';
  return 'skincare';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function stableHash(value) {
  const s = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pickVariant(seed, variants, fallback = '') {
  if (!Array.isArray(variants) || variants.length === 0) return fallback;
  const idx = stableHash(seed) % variants.length;
  return variants[idx] || fallback;
}

function extractVolume(name) {
  const s = normalizeString(name);
  if (!s) return '';
  const match = s.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|mg|mcg|µg|iu)\b/i);
  if (!match) return '';
  const amount = match[1].replace(',', '.');
  return `${amount}${match[2].toLowerCase()}`;
}

function extractHighlightedIngredientsFromName(name) {
  const s = normalizeString(name).toLowerCase();
  if (!s) return [];
  const candidates = [
    { key: 'retinal', label: 'Retinal' },
    { key: 'retinol', label: 'Retinol' },
    { key: 'niacinamide', label: 'Niacinamide' },
    { key: 'vitamin c', label: 'Vitamin C' },
    { key: 'hyaluronic', label: 'Hyaluronic Acid' },
    { key: 'bha', label: 'BHA' },
    { key: 'aha', label: 'AHA' },
    { key: 'salicylic', label: 'Salicylic Acid' },
    { key: 'azelaic', label: 'Azelaic Acid' },
    { key: 'tranexamic', label: 'Tranexamic Acid' },
    { key: 'ceramide', label: 'Ceramide' },
    { key: 'panthenol', label: 'Panthenol (B5)' },
    { key: 'peptide', label: 'Peptides' },
    { key: 'collagen', label: 'Collagen' },
    { key: 'manuka', label: 'Manuka Honey' },
    { key: 'bee venom', label: 'Bee Venom' },
    { key: 'probiotic', label: 'Probiotics' },
  ];
  return candidates.filter((c) => s.includes(c.key)).map((c) => c.label);
}

function inferBenefitsFromName(name) {
  const s = normalizeString(name).toLowerCase();
  const benefits = new Set();

  if (/(mun|mụn|acne|klenzit|adapalene|benzoyl)/i.test(s)) {
    benefits.add('Hỗ trợ giảm mụn và làm thông thoáng lỗ chân lông');
    benefits.add('Giảm cảm giác viêm đỏ, hạn chế tái phát theo routine');
  }
  if (/(duong am|dưỡng ẩm|hydrating|moistur)/i.test(s)) {
    benefits.add('Cấp ẩm và củng cố hàng rào bảo vệ da');
    benefits.add('Giảm khô căng, giúp da mềm mượt hơn');
  }
  if (/(chong nang|chống nắng|sunscreen|spf\\s*\\d+)/i.test(s)) {
    benefits.add('Bảo vệ da khỏi tia UV, hỗ trợ ngăn sạm nám');
    benefits.add('Giúp duy trì hiệu quả các treatment trong routine');
  }
  if (/(lao hoa|lão hóa|anti-?aging|retinol|retinal|peptide|collagen)/i.test(s)) {
    benefits.add('Hỗ trợ cải thiện độ đàn hồi và nếp nhăn li ti');
    benefits.add('Giúp bề mặt da mịn và đều màu hơn theo thời gian');
  }
  if (/(trang|sang da|sáng da|bright|glow|tranexamic|vitamin c|niacinamide)/i.test(s)) {
    benefits.add('Hỗ trợ làm sáng và cải thiện da xỉn màu');
    benefits.add('Giúp đều màu, giảm thâm sau mụn theo lộ trình');
  }
  if (/(tay te bao chet|tẩy tế bào chết|aha|bha|salicylic|glycolic|lactic)/i.test(s)) {
    benefits.add('Hỗ trợ làm sạch sâu và giảm bít tắc');
    benefits.add('Cải thiện bề mặt da thô ráp, hỗ trợ giảm mụn ẩn');
  }
  if (/(nhay cam|nhạy cảm|soothing|calm|cica|panthenol)/i.test(s)) {
    benefits.add('Làm dịu da và giảm kích ứng nhẹ');
    benefits.add('Hỗ trợ phục hồi sau khi da chịu tác động từ môi trường');
  }
  if (/(nam|nám|melasma|tan nhang|tàn nhang|dark spot|spot correct|tranexamic|arbutin|kojic)/i.test(s)) {
    benefits.add('Hỗ trợ cải thiện thâm nám và đốm nâu theo lộ trình');
    benefits.add('Giúp bề mặt da đều màu và rạng rỡ hơn');
  }
  if (/(vitamin d|dd cream)/i.test(s)) {
    benefits.add('Hỗ trợ lớp nền mịn và tự nhiên khi dùng hằng ngày');
  }

  if (benefits.size === 0) {
    benefits.add('Bổ sung vào routine chăm sóc hằng ngày theo nhu cầu thực tế');
    benefits.add('Hỗ trợ duy trì làn da khỏe và cảm giác dễ chịu khi dùng đúng cách');
  }

  return Array.from(benefits).slice(0, 5);
}

function inferSkinTypes(productType, name) {
  if (productType === 'supplement') return [];
  const s = normalizeString(name).toLowerCase();
  const types = new Set();
  if (/(mun|mụn|acne)/i.test(s)) types.add('Da mụn');
  if (/(nhay cam|nhạy cảm|soothing|calm)/i.test(s)) types.add('Da nhạy cảm');
  if (/(duong am|dưỡng ẩm|hydrating|moistur)/i.test(s)) types.add('Da khô');
  if (/(kiem dau|kiềm dầu|oil control|bha|salicylic)/i.test(s)) types.add('Da dầu');

  if (types.size === 0) {
    types.add('Da thường');
    types.add('Da hỗn hợp');
  }

  return Array.from(types)
    .filter((t) => SKIN_TYPES.includes(t))
    .slice(0, 4);
}

function buildAudienceHints(productType, name) {
  const s = normalizeString(name).toLowerCase();
  if (productType === 'supplement') {
    return [
      'Người cần bổ sung theo mục tiêu dinh dưỡng và lối sống',
      'Người muốn hỗ trợ sức khỏe tổng thể theo thời gian',
    ];
  }
  const hints = [];
  if (/(mun|mụn|acne)/i.test(s)) hints.push('Da dễ lên mụn, lỗ chân lông dễ bít tắc');
  if (/(nam|nám|tan nhang|tàn nhang|dark spot)/i.test(s)) hints.push('Da xỉn màu, thâm nám hoặc đốm nâu');
  if (/(nhay cam|nhạy cảm|soothing|calm|cica|panthenol)/i.test(s)) hints.push('Da nhạy cảm, dễ kích ứng nhẹ');
  if (/(lao hoa|lão hóa|anti-?aging|retinol|retinal|peptide)/i.test(s)) hints.push('Da có dấu hiệu lão hóa, thiếu đàn hồi');
  if (/(chong nang|chống nắng|sunscreen|spf\\s*\\d+)/i.test(s)) hints.push('Người cần chống nắng hằng ngày để bảo vệ da');
  if (hints.length === 0) hints.push('Người muốn tối ưu routine chăm sóc da hằng ngày');
  return hints.slice(0, 4);
}

function countWords(text) {
  const clean = String(text || '')
    .replace(/[`*_#>\[\]\(\)!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 0;
  return clean.split(' ').filter(Boolean).length;
}

function buildUsageInstructions(productType, name) {
  const safeName = normalizeString(name) || 'sản phẩm';
  if (productType === 'supplement') {
    return `Dùng ${safeName} theo hướng dẫn trên bao bì hoặc theo tư vấn chuyên môn. Không tự ý tăng liều. Nếu đang mang thai/cho con bú hoặc có bệnh nền, nên tham khảo ý kiến chuyên gia trước khi dùng.`;
  }
  if (productType === 'cleanser') {
    return `Làm ướt mặt, lấy một lượng vừa đủ ${safeName}, tạo bọt nhẹ và massage 30-60 giây. Rửa sạch và tiếp tục các bước toner/serum/kem dưỡng.`;
  }
  if (productType === 'toner') {
    return `Sau khi làm sạch, thấm ${safeName} ra bông tẩy trang hoặc vỗ trực tiếp lên da. Tiếp tục serum/kem dưỡng. Dùng sáng và tối.`;
  }
  if (productType === 'serum') {
    return `Sau khi làm sạch và cân bằng da, lấy 2-3 giọt ${safeName} thoa đều toàn mặt. Khóa ẩm bằng kem dưỡng. Dùng 1-2 lần/ngày tùy mức độ phù hợp của da.`;
  }
  if (productType === 'sunscreen') {
    return `Thoa ${safeName} trước khi ra nắng 15-20 phút. Dặm lại mỗi 2-3 giờ hoặc sau khi đổ mồ hôi/tiếp xúc nước.`;
  }
  if (productType === 'mask') {
    return `Dùng ${safeName} 1-3 lần/tuần tùy nhu cầu. Thoa đều, để theo thời gian khuyến nghị trên bao bì rồi rửa sạch/để qua đêm (tùy loại).`;
  }
  if (productType === 'gel') {
    return `Thoa một lớp mỏng ${safeName} lên vùng da cần chăm sóc. Có thể dùng 1-2 lần/ngày. Nếu da nhạy cảm, tăng tần suất từ từ để theo dõi khả năng dung nạp.`;
  }
  return `Sử dụng ${safeName} theo hướng dẫn trên bao bì hoặc routine hiện tại. Nếu da nhạy cảm, nên patch test và tăng tần suất từ từ.`;
}

function buildPrecautions(productType) {
  if (productType === 'supplement') {
    return 'Đọc kỹ hướng dẫn sử dụng. Ngưng dùng nếu có dấu hiệu không dung nạp. Sản phẩm không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.';
  }
  return 'Patch test trước khi dùng. Tránh vùng mắt và vết thương hở. Nếu kích ứng kéo dài, ngưng sử dụng và tham khảo ý kiến chuyên gia.';
}

function buildShortDescription(product, generated) {
  const name = normalizeString(product.name) || 'Sản phẩm';
  const type = generated.productType;
  const volume = generated.volume || normalizeString(product.volume);
  const benefit = generated.key_benefits?.[0] || 'Hỗ trợ chăm sóc theo nhu cầu thực tế';

  const suffix = volume ? ` (${volume})` : '';

  const templates = type === 'supplement'
    ? [
      `${name}${suffix}: ${benefit}. Dùng theo hướng dẫn để hỗ trợ cơ thể theo thời gian.`,
      `${name}${suffix} giúp ${benefit.toLowerCase()}. Phù hợp bổ sung vào thói quen hằng ngày.`,
    ]
    : [
      `${name}${suffix}: ${benefit}. Phù hợp dùng hằng ngày theo routine.`,
      `${name}${suffix} hỗ trợ ${benefit.toLowerCase()}. Kết hợp dưỡng ẩm và chống nắng để tối ưu.`,
    ];

  const picked = pickVariant(product.slug || name, templates, `${name}${suffix}: ${benefit}.`);
  return picked.length > 180 ? `${picked.slice(0, 177).trimEnd()}...` : picked;
}

function buildLongDescriptionMarkdown(product, generated) {
  const name = normalizeString(product.name);
  const brand = normalizeString(product.brand);
  const type = generated.productType;
  const volume = generated.volume || normalizeString(product.volume);
  const texture = generated.texture || normalizeString(product.texture);
  const origin = normalizeString(product.origin);
  const skinTypes = generated.skin_types;
  const benefits = generated.key_benefits;
  const usage = generated.usage_instructions;
  const ingredients = generated.ingredients;
  const audience = generated.audience_hints || [];

  const lines = [];
  lines.push('## Tổng quan');
  lines.push(
    pickVariant(
      product.slug || name,
      [
        generated.description || '',
        `${name} là lựa chọn phù hợp để bổ sung vào routine chăm sóc hằng ngày theo nhu cầu thực tế.`,
        `${name} được thiết kế để hỗ trợ mục tiêu chăm sóc da theo lộ trình, ưu tiên trải nghiệm dùng hằng ngày.`,
      ].filter(Boolean),
      generated.description || `${name} là lựa chọn phù hợp để bổ sung vào routine chăm sóc hằng ngày.`,
    ),
  );
  lines.push('');

  lines.push('## Dành cho ai');
  for (const hint of audience.slice(0, 4)) {
    lines.push(`- ${hint}`);
  }
  lines.push('');

  lines.push('## Điểm nổi bật');
  for (const benefit of benefits.slice(0, 6)) {
    lines.push(`- ${benefit}`);
  }
  lines.push('');

  lines.push('## Cách dùng gợi ý');
  lines.push(usage);
  lines.push('');

  lines.push('## Thành phần/hoạt chất tham khảo');
  if (ingredients) {
    lines.push(ingredients);
  } else {
    lines.push('Tham khảo bảng thành phần chi tiết trên bao bì sản phẩm để đảm bảo chính xác.');
  }
  lines.push('');

  if (type !== 'supplement') {
    lines.push('## Thông tin nhanh');
    if (skinTypes.length > 0) {
      lines.push(`- Loại da: ${skinTypes.join(', ')}.`);
    }
    if (texture) {
      lines.push(`- Kết cấu: ${texture}.`);
    }
    if (volume) {
      lines.push(`- Dung tích/khối lượng: ${volume}.`);
    }
    if (brand) {
      lines.push(`- Thương hiệu: ${brand}.`);
    }
    if (origin) {
      lines.push(`- Xuất xứ (tham khảo): ${origin}.`);
    }
    lines.push('');
  }

  lines.push('## Lưu ý');
  lines.push(buildPrecautions(type));
  lines.push('');

  lines.push('## Gợi ý kết hợp routine');
  if (type === 'supplement') {
    lines.push('Kết hợp chế độ sinh hoạt lành mạnh, ngủ đủ giấc và dinh dưỡng cân bằng để tối ưu hiệu quả theo thời gian.');
  } else {
    lines.push('Ưu tiên làm sạch dịu nhẹ, dưỡng ẩm đủ và chống nắng đầy đủ (ban ngày). Nếu đang dùng treatment mạnh, tăng dần tần suất và theo dõi phản ứng da.');
  }

  if (brand) {
    const brandSlug = slugify(brand);
    if (brandSlug) {
      lines.push('');
      lines.push(`Xem thêm các sản phẩm của thương hiệu [${brand}](/thuong-hieu/${brandSlug}).`);
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildFaqItems(product, generated) {
  const name = normalizeString(product.name) || 'Sản phẩm';
  const type = generated.productType;
  const benefits = generated.key_benefits || [];
  const skinTypes = generated.skin_types || [];
  const usage = generated.usage_instructions || '';
  const ingredients = generated.ingredients || '';

  const items = [];
  items.push({
    question: `${name} phù hợp với ai?`,
    answer: type === 'supplement'
      ? `${name} phù hợp cho người cần bổ sung theo mục tiêu dinh dưỡng. Nên đọc hướng dẫn trên bao bì và tham khảo ý kiến chuyên môn nếu có bệnh nền, đang dùng thuốc hoặc đang mang thai/cho con bú.`
      : (skinTypes.length > 0
        ? `${name} phù hợp cho ${skinTypes.join(', ')}. Nên bắt đầu với tần suất thấp nếu da nhạy cảm hoặc đang trong giai đoạn treatment.`
        : `${name} phù hợp để bổ sung vào routine chăm sóc hằng ngày theo nhu cầu thực tế.`),
  });
  items.push({
    question: `Cách dùng ${name} như thế nào?`,
    answer: usage || `Sử dụng ${name} theo hướng dẫn trên bao bì hoặc theo routine hiện tại. Nếu mới bắt đầu, tăng tần suất từ từ để theo dõi khả năng dung nạp.`,
  });
  items.push({
    question: `${name} có điểm nổi bật nào?`,
    answer: benefits.length > 0
      ? `${name} thường được chọn để: ${benefits.slice(0, 3).join('; ')}.`
      : `${name} hỗ trợ chăm sóc theo nhu cầu thực tế và giúp routine ổn định hơn khi dùng đúng cách.`,
  });
  items.push({
    question: `Cần lưu ý gì khi dùng ${name}?`,
    answer: type === 'supplement'
      ? 'Sản phẩm không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh. Không tự ý tăng liều. Ngưng dùng nếu có dấu hiệu không dung nạp.'
      : `Patch test trước khi dùng. Tránh vùng mắt và vết thương hở. ${ingredients ? 'Đối chiếu bảng thành phần trên bao bì nếu da dễ kích ứng.' : 'Nếu da dễ kích ứng, nên đối chiếu bảng thành phần trên bao bì.'}`,
  });
  return items;
}

function buildGeneratedFields(product) {
  const productType = detectProductType(product.name);
  const volume = extractVolume(product.name);
  const highlighted = extractHighlightedIngredientsFromName(product.name);
  const inferredBenefits = inferBenefitsFromName(product.name);
  const inferredSkinTypes = inferSkinTypes(productType, product.name);
  const existingBenefits = normalizeTextArray(product.key_benefits);
  const existingSkinTypes = normalizeTextArray(product.skin_types);
  const keyBenefits = existingBenefits.length > 0 ? existingBenefits : inferredBenefits;
  const skinTypes = existingSkinTypes.length > 0 ? existingSkinTypes : inferredSkinTypes;
  const audienceHints = buildAudienceHints(productType, product.name);
  const inferredUsage = buildUsageInstructions(productType, product.name);
  const usage = normalizeString(product.usage_instructions) || inferredUsage;

  const ingredients = (() => {
    const existing = normalizeString(product.ingredients);
    if (existing) return existing;
    if (highlighted.length > 0) {
      return `Thành phần/hoạt chất nổi bật (theo tên sản phẩm): ${highlighted.join(', ')}. Vui lòng đối chiếu bảng thành phần trên bao bì để đảm bảo chính xác.`;
    }
    return '';
  })();

  const texture = (() => {
    if (normalizeString(product.texture)) return '';
    if (productType === 'serum') return 'Serum';
    if (productType === 'cream') return 'Kem';
    if (productType === 'gel') return 'Gel';
    if (productType === 'mask') return 'Mặt nạ';
    if (productType === 'sunscreen') return 'Kem chống nắng';
    return '';
  })();

  const description = (() => {
    const existing = normalizeString(product.description);
    // Keep curated descriptions when they are already usable.
    if (countWords(existing) >= 12) return existing;
    return buildShortDescription(product, { productType, key_benefits: keyBenefits, volume });
  })();

  return {
    productType,
    description,
    usage_instructions: usage,
    ingredients,
    key_benefits: keyBenefits,
    skin_types: skinTypes,
    audience_hints: audienceHints,
    volume: normalizeString(product.volume) || volume,
    texture: normalizeString(product.texture) || texture,
    origin: normalizeString(product.origin),
    precautions: normalizeString(product.precautions) || buildPrecautions(productType),
    faq_items: buildFaqItems(product, { productType, key_benefits: keyBenefits, skin_types: skinTypes, usage_instructions: usage, ingredients }),
  };
}

function normalizeLongDescription(value) {
  const blocks = normalizeArray(value);
  return blocks
    .map((entry) => (entry && typeof entry === 'object' ? entry : null))
    .filter(Boolean);
}

function buildNextLongDescription(product, generated) {
  const blocks = normalizeLongDescription(product.long_description);
  const images = blocks.filter((block) => block.type === 'image' && normalizeString(block.image_path));
  const markdown = buildLongDescriptionMarkdown(product, generated);
  return [{ type: 'text', content: markdown }, ...images];
}

async function fetchPage(supabase, from, to, onlyPublished) {
  let query = supabase
    .from('products')
    .select('slug,name,description,long_description,usage_instructions,ingredients,key_benefits,skin_types,volume,texture,origin,precautions,faq_items,brand,price,is_published')
    .order('slug', { ascending: true })
    .range(from, to);
  if (onlyPublished) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) throw new Error(`Could not read products: ${error.message}`);
  return data || [];
}

async function fetchAllProducts(supabase, onlyPublished) {
  const rows = [];
  let offset = 0;
  while (rows.length < LIMIT) {
    const page = await fetchPage(supabase, offset, offset + PAGE_SIZE - 1, onlyPublished);
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows.slice(0, LIMIT);
}

async function runPool(items, concurrency, workerFn) {
  const queue = items.slice();
  const results = [];
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      results.push(await workerFn(next));
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  assertConfig();

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authError) throw new Error(`Admin sign-in failed: ${authError.message}`);

  try {
    const products = await fetchAllProducts(supabase, ONLY_PUBLISHED);

    let updated = 0;
    let skipped = 0;
    const failures = [];

    await runPool(products, CONCURRENCY, async (product) => {
      const generated = buildGeneratedFields(product);
      const nextLongDescription = buildNextLongDescription(product, generated);

      const payload = {
        description: generated.description || normalizeString(product.description),
        usage_instructions: generated.usage_instructions || normalizeString(product.usage_instructions),
        // Never wipe ingredients: only backfill when missing.
        ingredients: normalizeString(product.ingredients) ? normalizeString(product.ingredients) : (generated.ingredients || ''),
        key_benefits: generated.key_benefits,
        skin_types: generated.skin_types,
        volume: generated.volume || normalizeString(product.volume),
        texture: generated.texture || normalizeString(product.texture),
        origin: normalizeString(product.origin),
        precautions: generated.precautions || normalizeString(product.precautions),
        long_description: nextLongDescription,
      };

      const existingFaq = normalizeFaqItems(product.faq_items);
      if (existingFaq.length < 2 && Array.isArray(generated.faq_items)) {
        payload.faq_items = generated.faq_items;
      }

      // Never touch price or brand.
      delete payload.price;
      delete payload.brand;

      if (DRY_RUN) {
        updated += 1;
        return;
      }

      const { error } = await supabase.from('products').update(payload).eq('slug', product.slug);
      if (error) {
        failures.push({ slug: product.slug, error: error.message });
        return;
      }
      updated += 1;
    });

    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      onlyPublished: ONLY_PUBLISHED,
      total: products.length,
      updated,
      skipped,
      failuresCount: failures.length,
      failures: failures.slice(0, 12),
    }, null, 2));

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await supabase.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
