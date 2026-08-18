export const normalizeBrandMatchKey = (value?: string | null): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

export const splitBrandDescription = (description?: string | null): string[] =>
  String(description || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const getBrandDescriptionSnippet = (description?: string | null, maxLength = 180): string => {
  const firstParagraph = splitBrandDescription(description)[0] || String(description || '').trim();
  if (!firstParagraph) return '';
  return firstParagraph.length > maxLength
    ? `${firstParagraph.slice(0, maxLength - 1).trim()}...`
    : firstParagraph;
};

export const getBrandInitials = (name?: string | null): string => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'BR';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};
