import type {
  DetailFaqEntry,
  Product,
  ProductContentAudit,
  ProductContentBlock,
  ProductContentIssue,
  ProductContentReviewRecord,
  ProductContentReviewStatus,
} from '../types';

const BOILERPLATE_PATTERNS = [
  /công thức dermocosmetic ưu tiên hiệu quả/i,
  /khả năng ghép routine/i,
  /phù hợp với nhiều loại da/i,
  /hỗ trợ cải thiện làn da/i,
  /an toàn và lành tính/i,
];

const normalizeText = (value: unknown): string =>
  String(value || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeLineList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
};

const normalizeFaqItems = (value: unknown): DetailFaqEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      question: normalizeText((item as DetailFaqEntry | undefined)?.question),
      answer: normalizeText((item as DetailFaqEntry | undefined)?.answer),
    }))
    .filter((item) => item.question && item.answer);
};

const normalizeContentBlocks = (value: unknown): ProductContentBlock[] => {
  if (!Array.isArray(value)) return [];
  const normalizedBlocks: Array<ProductContentBlock | null> = value.map((block) => {
      if (!block || typeof block !== 'object') return null;
      const typed = block as ProductContentBlock;
      if (typed.type === 'text') {
        return { type: 'text', content: normalizeText(typed.content) } satisfies ProductContentBlock;
      }
      if (typed.type === 'image') {
        return {
          type: 'image',
          image_path: normalizeText(typed.image_path),
          caption: normalizeText(typed.caption),
        } satisfies ProductContentBlock;
      }
      return null;
    });

  return normalizedBlocks.filter((block): block is ProductContentBlock => Boolean(block));
};

const extractLongDescriptionText = (blocks: ProductContentBlock[]): string =>
  blocks
    .map((block) => {
      if (block.type === 'text') return normalizeText(block.content);
      if (block.type === 'image' && block.caption) return normalizeText(block.caption);
      return '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();

const simpleHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `pc_${(hash >>> 0).toString(16)}`;
};

export const buildProductContentSignature = (product: Partial<Product>): string => {
  const normalizedPayload = {
    name: normalizeText(product.name),
    description: normalizeText(product.description),
    key_benefits: normalizeLineList(product.key_benefits),
    skin_types: normalizeLineList(product.skin_types),
    ingredients: normalizeText(product.ingredients),
    usage_instructions: normalizeText(product.usage_instructions),
    precautions: normalizeText(product.precautions),
    faq_items: normalizeFaqItems(product.faq_items),
    long_description: normalizeContentBlocks(product.long_description),
  };

  return simpleHash(JSON.stringify(normalizedPayload));
};

const pushIssue = (
  issues: ProductContentIssue[],
  severity: ProductContentIssue['severity'],
  field: string,
  code: string,
  message: string,
) => {
  issues.push({ severity, field, code, message });
};

const countBoilerplateMatches = (...values: string[]) => {
  const haystack = values.filter(Boolean).join(' \n ').toLowerCase();
  return BOILERPLATE_PATTERNS.reduce((count, pattern) => count + (pattern.test(haystack) ? 1 : 0), 0);
};

export const auditProductContent = (product: Partial<Product>): ProductContentAudit => {
  const issues: ProductContentIssue[] = [];
  const name = normalizeText(product.name);
  const description = normalizeText(product.description);
  const ingredients = normalizeText(product.ingredients);
  const usage = normalizeText(product.usage_instructions);
  const precautions = normalizeText(product.precautions);
  const keyBenefits = normalizeLineList(product.key_benefits);
  const faqItems = normalizeFaqItems(product.faq_items);
  const longDescriptionBlocks = normalizeContentBlocks(product.long_description);
  const longDescriptionText = extractLongDescriptionText(longDescriptionBlocks);

  let score = 100;

  if (name.length < 18) {
    pushIssue(issues, 'warning', 'name', 'name_too_short', 'Tên sản phẩm đang quá ngắn, khó scan đúng công dụng và quy cách.');
    score -= 6;
  }

  if (description.length < 90) {
    pushIssue(issues, 'blocker', 'description', 'description_missing_depth', 'Mô tả ngắn đang quá mỏng; cần 1-2 câu đủ concern, công dụng chính và ngữ cảnh dùng.');
    score -= 18;
  } else if (description.length > 240) {
    pushIssue(issues, 'warning', 'description', 'description_too_long', 'Mô tả ngắn đang quá dài; nên rút lại để merchandiser và SEO scan nhanh.');
    score -= 8;
  }

  if (keyBenefits.length < 2) {
    pushIssue(issues, 'blocker', 'key_benefits', 'benefits_missing', 'Cần ít nhất 2 lợi ích chính rõ ràng để listing và trang chi tiết không bị generic.');
    score -= 16;
  } else if (keyBenefits.length < 3) {
    pushIssue(issues, 'warning', 'key_benefits', 'benefits_thin', 'Nên có tối thiểu 3 lợi ích chính để reviewer đánh giá công dụng rõ hơn.');
    score -= 6;
  }

  if (keyBenefits.some((item) => item.length < 10)) {
    pushIssue(issues, 'warning', 'key_benefits', 'benefits_generic', 'Một số lợi ích quá ngắn hoặc quá chung chung, nên viết lại cụ thể hơn.');
    score -= 6;
  }

  if (ingredients.length < 40) {
    pushIssue(issues, 'blocker', 'ingredients', 'ingredients_missing', 'Phần thành phần đang thiếu hoặc quá sơ sài; cần nêu hoạt chất/chất nổi bật có ý nghĩa.');
    score -= 14;
  }

  if (usage.length < 40) {
    pushIssue(issues, 'blocker', 'usage_instructions', 'usage_missing', 'Hướng dẫn sử dụng đang thiếu; cần đủ bước dùng và tần suất cơ bản.');
    score -= 14;
  }

  if (precautions.length < 24) {
    pushIssue(issues, 'warning', 'precautions', 'precautions_thin', 'Lưu ý/cảnh báo còn mỏng; nên ghi rõ điều cần tránh, nhóm da cần cân nhắc hoặc thời điểm dùng.');
    score -= 6;
  }

  if (longDescriptionText.length < 220) {
    pushIssue(issues, 'blocker', 'long_description', 'long_description_too_short', 'Mô tả dài chưa đủ chiều sâu để lên product detail và SEO.');
    score -= 18;
  }

  const textBlockCount = longDescriptionBlocks.filter((block) => block.type === 'text' && normalizeText(block.content).length > 0).length;
  if (textBlockCount === 0) {
    pushIssue(issues, 'blocker', 'long_description', 'long_description_no_text_blocks', 'Mô tả dài chưa có block text thực sự; hiện chưa đủ để reviewer duyệt.');
    score -= 16;
  }

  if (faqItems.length < 2) {
    pushIssue(issues, 'warning', 'faq_items', 'faq_missing', 'FAQ còn ít; nên có ít nhất 2 câu hỏi để xử lý objection cơ bản khi mua.');
    score -= 4;
  }

  const boilerplateMatches = countBoilerplateMatches(description, longDescriptionText, keyBenefits.join(' • '));
  if (boilerplateMatches > 0) {
    pushIssue(issues, 'warning', 'content', 'boilerplate_copy', 'Nội dung còn dấu hiệu boilerplate/generic; nên viết lại theo đúng sản phẩm thay vì dùng copy mẫu.');
    score -= 8;
  }

  const blocker_count = issues.filter((issue) => issue.severity === 'blocker').length;
  const warning_count = issues.filter((issue) => issue.severity === 'warning').length;
  const summary =
    blocker_count > 0
      ? `${blocker_count} lỗi cần sửa trước khi duyệt${warning_count > 0 ? `, thêm ${warning_count} điểm nên rà lại` : ''}.`
      : warning_count > 0
        ? `${warning_count} điểm nên rà lại trước khi publish.`
        : 'Nội dung đủ gọn và có thể đưa vào bước duyệt cuối.';

  return {
    score: Math.max(0, Math.min(100, score)),
    blocker_count,
    warning_count,
    issues,
    summary,
    content_signature: buildProductContentSignature(product),
  };
};

export const getProductContentReviewLabel = (
  status: ProductContentReviewStatus,
  options: { stale?: boolean } = {},
): string => {
  if (options.stale) return 'Cần duyệt lại';
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'in_review') return 'Đang duyệt';
  if (status === 'rewrite_requested') return 'Cần viết lại';
  return 'Cần duyệt';
};

export const getProductContentReviewTone = (
  status: ProductContentReviewStatus,
  options: { stale?: boolean } = {},
): string => {
  if (options.stale) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'in_review') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'rewrite_requested') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-border bg-background text-muted-foreground';
};

export const resolveProductContentReview = (
  review: ProductContentReviewRecord | null | undefined,
  audit: ProductContentAudit,
) => {
  const isStale = Boolean(review && review.content_signature && review.content_signature !== audit.content_signature);
  const effectiveStatus: ProductContentReviewStatus = review && !isStale ? review.review_status : 'needs_review';
  const canPublish = effectiveStatus === 'approved' && !isStale && audit.blocker_count === 0;
  const publishBlockedReason = (() => {
    if (canPublish) return '';
    if (isStale) return 'Nội dung đã thay đổi sau lần duyệt gần nhất. Hãy lưu nháp rồi reviewer duyệt lại trước khi publish.';
    if (audit.blocker_count > 0) return audit.summary;
    if (effectiveStatus === 'in_review') {
      return 'Sản phẩm đang ở bước reviewer kiểm tra nội dung. Bạn vẫn có thể lưu nháp trong lúc chờ duyệt.';
    }
    if (effectiveStatus === 'rewrite_requested') {
      return 'Reviewer đã yêu cầu viết lại nội dung trước khi publish. Bạn vẫn có thể tiếp tục lưu nháp.';
    }
    return 'Sản phẩm chưa được reviewer duyệt. Bạn vẫn có thể lưu nháp trước; chỉ bật publish sau khi trạng thái là Đã duyệt.';
  })();

  return {
    audit,
    review: review || null,
    isStale,
    effectiveStatus,
    canPublish,
    publishBlockedReason,
    label: getProductContentReviewLabel(effectiveStatus, { stale: isStale }),
    tone: getProductContentReviewTone(effectiveStatus, { stale: isStale }),
  };
};
