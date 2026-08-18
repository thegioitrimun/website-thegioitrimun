const normalizeText = (value: string | undefined | null): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .trim();

const cleanText = (value: string | undefined | null): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const coerceExtension = (value: string | undefined | null, fallback = 'webp'): string => {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');
  return normalized || fallback;
};

const uniqueSuffix = (seed?: string): string => normalizeText(seed || '').slice(0, 8);

const buildPath = (folders: Array<string | undefined | null>, fileName: string, extension = 'webp'): string => {
  const normalizedFolders = folders
    .map((folder) => normalizeText(folder))
    .filter(Boolean);

  const safeBase = normalizeText(fileName) || 'image';
  return `${normalizedFolders.join('/')}/${safeBase}.${coerceExtension(extension)}`.replace(/^\/+/, '');
};

const joinLabelParts = (...parts: Array<string | undefined | null>): string =>
  parts
    .map((part) => cleanText(part))
    .filter(Boolean)
    .filter((part, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
    .join(' - ');

export const buildProductGalleryImagePath = (options: {
  slug?: string | null;
  name?: string | null;
  index?: number;
  suffix?: string;
  extension?: string;
}) => {
  const productSlug = normalizeText(options.slug || options.name || 'product');
  const galleryIndex = typeof options.index === 'number' ? String(options.index + 1).padStart(2, '0') : null;
  const suffix = uniqueSuffix(options.suffix);
  return buildPath(
    ['products', productSlug],
    ['gallery', galleryIndex, suffix].filter(Boolean).join('-'),
    options.extension
  );
};

export const buildProductContentImagePath = (options: {
  slug?: string | null;
  name?: string | null;
  index?: number;
  suffix?: string;
  extension?: string;
}) => {
  const productSlug = normalizeText(options.slug || options.name || 'product');
  const detailIndex = typeof options.index === 'number' ? String(options.index + 1).padStart(2, '0') : null;
  const suffix = uniqueSuffix(options.suffix);
  return buildPath(
    ['products', productSlug, 'details'],
    ['detail', detailIndex, suffix].filter(Boolean).join('-'),
    options.extension
  );
};

export const buildBlogCoverImagePath = (options: {
  slug?: string | null;
  title?: string | null;
  categorySlug?: string | null;
  extension?: string;
}) => {
  const postSlug = normalizeText(options.slug || options.title || 'blog-post');
  return buildPath(['blog', options.categorySlug || 'tong-hop', postSlug], 'cover', options.extension);
};

export const buildServiceCoverImagePath = (options: {
  slug?: string | null;
  name?: string | null;
  extension?: string;
}) => {
  const serviceSlug = normalizeText(options.slug || options.name || 'service');
  return buildPath(['services', serviceSlug], 'cover', options.extension);
};

export const buildServiceStepImagePath = (options: {
  slug?: string | null;
  name?: string | null;
  stepNumber?: number | null;
  suffix?: string;
  extension?: string;
}) => {
  const serviceSlug = normalizeText(options.slug || options.name || 'service');
  const stepSegment = typeof options.stepNumber === 'number' && Number.isFinite(options.stepNumber)
    ? String(options.stepNumber).padStart(2, '0')
    : null;
  const suffix = uniqueSuffix(options.suffix);
  return buildPath(
    ['services', serviceSlug, 'steps'],
    ['step', stepSegment, suffix].filter(Boolean).join('-'),
    options.extension
  );
};

export const buildBrandLogoImagePath = (options: {
  slug?: string | null;
  name?: string | null;
  extension?: string;
}) => {
  const brandSlug = normalizeText(options.slug || options.name || 'brand');
  return buildPath(['brands', brandSlug], 'logo', options.extension);
};

export const buildSiteAssetImagePath = (options: {
  area: 'branding' | 'about' | 'auth' | 'hero';
  siteName?: string | null;
  variant: string;
  extension?: string;
}) => {
  const siteSlug = normalizeText(options.siteName || 'natural-skin');
  return buildPath(['site', options.area, siteSlug], options.variant, options.extension);
};

export const buildProductImageAlt = (options: {
  productName: string;
  brandName?: string | null;
  categoryName?: string | null;
  context?: 'gallery' | 'listing' | 'detail' | 'thumbnail';
  index?: number;
}) => {
  const contextLabelMap = {
    gallery: 'Hình sản phẩm',
    listing: 'Ảnh sản phẩm',
    detail: 'Hình chi tiết sản phẩm',
    thumbnail: 'Ảnh xem nhanh sản phẩm',
  } as const;
  const contextLabel = contextLabelMap[options.context || 'gallery'];
  const sequence = typeof options.index === 'number' ? `ảnh ${options.index + 1}` : null;
  return joinLabelParts(
    options.productName,
    options.brandName,
    options.categoryName,
    contextLabel,
    sequence
  );
};

export const buildListingImageUrl = (imageUrl: string | undefined | null): string | undefined => {
  const rawUrl = cleanText(imageUrl);
  if (!rawUrl) return undefined;

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://thegioitrimun.vn';
    const url = new URL(rawUrl, baseUrl);
    url.searchParams.set('seo_context', 'listing-thumb');
    url.searchParams.set('w', '480');
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}seo_context=listing-thumb&w=480`;
  }
};

export const buildBlogImageAlt = (options: {
  title: string;
  categoryName?: string | null;
  context?: 'cover' | 'listing';
}) => {
  const contextLabel = options.context === 'listing' ? 'Ảnh bài viết' : 'Ảnh minh họa bài viết';
  return joinLabelParts(options.title, options.categoryName, contextLabel);
};

export const buildServiceImageAlt = (options: {
  serviceName: string;
  stepTitle?: string | null;
  stepNumber?: number | null;
  context?: 'cover' | 'step' | 'listing';
}) => {
  if (options.context === 'step') {
    return joinLabelParts(
      options.serviceName,
      options.stepTitle,
      typeof options.stepNumber === 'number' ? `Bước ${options.stepNumber}` : null,
      'Hình quy trình điều trị'
    );
  }
  const contextLabel = options.context === 'listing' ? 'Ảnh dịch vụ' : 'Hình đại diện dịch vụ';
  return joinLabelParts(options.serviceName, contextLabel);
};

export const buildBrandLogoAlt = (brandName: string, siteName = 'Thế Giới Trị Mụn') =>
  joinLabelParts(brandName, 'Logo thương hiệu', siteName);

export const buildImageSeoTitle = (...parts: Array<string | undefined | null>) => joinLabelParts(...parts);
