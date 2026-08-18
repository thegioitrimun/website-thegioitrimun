const STOPWORDS = new Set([
  'va', 'voi', 'cho', 'la', 'cua', 'the', 'and', 'for', 'the', 'to', 'da', 'duoc',
  'nhung', 'mot', 'cac', 'trong', 'khi', 'sau', 'truoc', 'this', 'that', 'from', 'with',
]);

export const normalizeSearchText = (text: string): string =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeSearchText = (text: string): string[] =>
  normalizeSearchText(text)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

export const getLocalizedValue = (obj: any, field: string, lang = 'vi'): string => {
  if (!obj) return '';
  if (lang !== 'vi') {
    const localized = obj[`${field}_${lang}`];
    if (localized) return String(localized);
  }
  return String(obj[field] || '');
};

export const getLocalizedArrayValue = (obj: any, field: string, lang = 'vi'): string[] => {
  if (!obj) return [];
  if (lang !== 'vi') {
    const localized = obj[`${field}_${lang}`];
    if (Array.isArray(localized) && localized.length > 0) return localized;
  }
  return Array.isArray(obj[field]) ? obj[field] : [];
};

const hasLocalizedValue = (obj: any, field: string, lang = 'vi'): boolean => {
  const value = lang === 'vi' ? obj?.[field] : obj?.[`${field}_${lang}`];
  if (Array.isArray(value)) return value.some((entry) => String(entry || '').trim().length > 0);
  return String(value || '').trim().length > 0;
};

export const hasAllLocalizedValues = (obj: any, fields: string[], lang = 'vi'): boolean =>
  fields.every((field) => hasLocalizedValue(obj, field, lang));

const flattenTextParts = (parts: Array<string | string[] | null | undefined>): string[] =>
  parts.flatMap((part) => {
    if (Array.isArray(part)) return part.map((entry) => String(entry || ''));
    return [String(part || '')];
  });

const buildTokenSet = (parts: Array<string | string[] | null | undefined>): Set<string> =>
  new Set(tokenizeSearchText(flattenTextParts(parts).join(' ')));

interface RankByTokenOverlapOptions<T> {
  items: T[];
  lang?: string;
  limit?: number;
  sourceParts: Array<string | string[] | null | undefined>;
  getItemParts: (item: T) => Array<string | string[] | null | undefined>;
  getExtraScore?: (item: T) => number;
  requiredFields?: string[];
  sortTieBreaker?: (a: T, b: T) => number;
  minScore?: number;
}

export function rankByTokenOverlap<T>({
  items,
  lang = 'vi',
  limit = 4,
  sourceParts,
  getItemParts,
  getExtraScore,
  requiredFields = [],
  sortTieBreaker,
  minScore = 1,
}: RankByTokenOverlapOptions<T>): T[] {
  const sourceTokens = buildTokenSet(sourceParts);

  return items
    .filter((item) => requiredFields.length === 0 || hasAllLocalizedValues(item, requiredFields, lang))
    .map((item, index) => {
      const itemTokens = new Set(tokenizeSearchText(flattenTextParts(getItemParts(item)).join(' ')));
      let score = getExtraScore?.(item) || 0;
      itemTokens.forEach((token) => {
        if (sourceTokens.has(token)) score += 1;
      });
      return { item, score, index };
    })
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (sortTieBreaker) {
        const diff = sortTieBreaker(a.item, b.item);
        if (diff !== 0) return diff;
      }
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}
