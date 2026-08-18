const MAX_META_DESCRIPTION_LENGTH = 160;
const IDEAL_META_DESCRIPTION_MIN = 120;
const IDEAL_META_DESCRIPTION_MAX = 170;

const stripHtml = (text: string): string => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncateText = (text: string, maxLength: number) => {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const normalizeMarkdownishSource = (input: string) =>
  String(input || '')
    .replace(/<\/?(p|div|section|article|h[1-6]|ul|ol|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r/g, '\n');

const normalizeInlineMarkdown = (input: string) =>
  stripHtml(input)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const dedupeTextParts = (parts: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  return parts
    .map((part) => normalizeInlineMarkdown(String(part || '')))
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildMetaDescription = (parts: Array<string | undefined | null>, maxLength = MAX_META_DESCRIPTION_LENGTH) => {
  const deduped = dedupeTextParts(parts);
  if (deduped.length === 0) return '';

  const joined = deduped.join(' ');
  if (joined.length <= maxLength) return joined;

  const bulletJoined = deduped.join(' • ');
  if (bulletJoined.length <= maxLength) return bulletJoined;

  return truncateText(joined, maxLength);
};

const parseKeywordList = (metaKeywords?: string | null) =>
  dedupeTextParts(
    String(metaKeywords || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

type SemanticLine = {
  text: string;
  isHeading: boolean;
  isList: boolean;
};

const getSemanticLines = (content?: string | null): SemanticLine[] =>
  normalizeMarkdownishSource(String(content || ''))
    .split('\n')
    .map((raw) => {
      const trimmed = raw.trim();
      const isHeading = /^#{1,6}\s+/.test(trimmed);
      const isList = /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
      const text = normalizeInlineMarkdown(
        trimmed
          .replace(/^#{1,6}\s+/, '')
          .replace(/^[-*]\s+/, '')
          .replace(/^\d+\.\s+/, '')
      );

      return { text, isHeading, isList };
    })
    .filter((entry) => entry.text);

export const extractBlogHeadings = (content?: string | null, limit = 4) =>
  dedupeTextParts(
    getSemanticLines(content)
      .filter((entry) => entry.isHeading)
      .map((entry) => entry.text)
  ).slice(0, limit);

export const extractBlogExcerpt = (content?: string | null, maxLength = 220) => {
  const lines = getSemanticLines(content);
  const preferredParagraphs = lines
    .filter((entry) => !entry.isHeading && !entry.isList && entry.text.length >= 40)
    .map((entry) => entry.text);
  const fallbackText = lines.map((entry) => entry.text);
  const source = preferredParagraphs.length > 0 ? preferredParagraphs : fallbackText;
  return truncateText(source.join(' '), maxLength);
};

export const buildBlogArticleBodyExcerpt = (content?: string | null, maxLength = 1800) =>
  truncateText(getSemanticLines(content).map((entry) => entry.text).join(' '), maxLength);

export const countBlogWords = (content?: string | null) =>
  getSemanticLines(content)
    .flatMap((entry) => entry.text.split(/\s+/))
    .filter(Boolean).length;

export const buildBlogSeoDescription = ({
  metaDescription,
  summary,
  content,
  categoryName,
}: {
  metaDescription?: string | null;
  summary?: string | null;
  content?: string | null;
  categoryName?: string | null;
}) => {
  const explicitMetaDescription = normalizeInlineMarkdown(String(metaDescription || ''));
  if (
    explicitMetaDescription.length >= IDEAL_META_DESCRIPTION_MIN
    && explicitMetaDescription.length <= IDEAL_META_DESCRIPTION_MAX
  ) {
    return explicitMetaDescription;
  }

  const generated = buildMetaDescription([
    summary,
    extractBlogExcerpt(content, 240),
    categoryName,
  ]);

  if (generated.length >= 110) return generated;

  return buildMetaDescription([
    explicitMetaDescription,
    summary,
    extractBlogExcerpt(content, 240),
    categoryName,
  ]);
};

export const buildBlogKeywordList = ({
  metaKeywords,
  title,
  categoryName,
  summary,
  content,
  limit = 10,
}: {
  metaKeywords?: string | null;
  title?: string | null;
  categoryName?: string | null;
  summary?: string | null;
  content?: string | null;
  limit?: number;
}) =>
  dedupeTextParts([
    ...parseKeywordList(metaKeywords),
    title,
    categoryName,
    ...extractBlogHeadings(content, 4),
    normalizeInlineMarkdown(String(summary || '')).length <= 90 ? summary : '',
  ])
    .filter((entry) => entry.length >= 2 && entry.length <= 90)
    .slice(0, limit);
