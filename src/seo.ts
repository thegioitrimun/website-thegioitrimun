export type SeoLang = 'vi' | 'en' | 'ru' | 'cn';

export const SEO_SITE_URL = 'https://thegioitrimun.vn';
export const SEO_DEFAULT_IMAGE = `${SEO_SITE_URL}/seo/og-default.jpg`;
export const SEO_DEFAULT_LOGO = `${SEO_SITE_URL}/icons/da-lieu-nhiet-doi-phu-quoc-512.png`;
export const SEO_WEBSITE_ID = `${SEO_SITE_URL}#website`;
export const SEO_ORGANIZATION_ID = `${SEO_SITE_URL}#organization`;

const OG_LOCALE_BY_LANG: Record<SeoLang, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  ru: 'ru_RU',
  cn: 'zh_CN',
};
const VIETNAMESE_CHAR_REGEX = /[À-ỹĐđ]/;

const HREFLANG_BY_LANG: Record<SeoLang, string> = {
  vi: 'vi',
  en: 'en',
  ru: 'ru',
  cn: 'zh',
};

const SUPPORTED_LANGS = Object.keys(HREFLANG_BY_LANG) as SeoLang[];

export const normalizeSeoLang = (language: string): SeoLang => {
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('ru')) return 'ru';
  if (language.startsWith('cn') || language.startsWith('zh')) return 'cn';
  return 'vi';
};

const removeElement = (selector: string) => {
  const el = document.head.querySelector(selector);
  if (el) {
    el.remove();
  }
};

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
};

const upsertLink = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
};

export const upsertJsonLd = (id: string, payload: unknown) => {
  let scriptEl = document.getElementById(id) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = id;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(payload);
};

export const removeJsonLd = (id: string) => {
  const scriptEl = document.getElementById(id);
  if (scriptEl) {
    scriptEl.remove();
  }
};

const buildAbsoluteUrl = (path: string, lang: SeoLang): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const langQuery = lang === 'vi' ? '' : `?lang=${lang}`;
  return `${SEO_SITE_URL}${cleanPath}${langQuery}`;
};

const upsertHreflangLinks = (path: string) => {
  (Object.keys(HREFLANG_BY_LANG) as SeoLang[]).forEach((lang) => {
    const hreflang = HREFLANG_BY_LANG[lang];
    const href = buildAbsoluteUrl(path, lang);
    upsertLink(`link[rel="alternate"][hreflang="${hreflang}"]`, {
      rel: 'alternate',
      hreflang,
      href,
    });
  });

  upsertLink('link[rel="alternate"][hreflang="x-default"]', {
    rel: 'alternate',
    hreflang: 'x-default',
    href: buildAbsoluteUrl(path, 'vi'),
  });
};

export interface SeoPayload {
  lang: SeoLang;
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string;
  noindex?: boolean;
  author?: string;
  imageAlt?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  price?: number;
  currency?: string;
  availability?: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock';
}

export const applySeo = (payload: SeoPayload) => {
  const {
    lang,
    path,
    title,
    description,
    image = SEO_DEFAULT_IMAGE,
    type = 'website',
    keywords,
    noindex = false,
    author,
    imageAlt,
    publishedTime,
    modifiedTime,
    section,
    tags = [],
    price,
    currency = 'VND',
    availability,
  } = payload;
  const articleTags = lang === 'vi' ? tags.filter(Boolean) : tags.filter((tag) => tag && !VIETNAMESE_CHAR_REGEX.test(tag));

  const canonicalUrl = buildAbsoluteUrl(path, lang);
  const robotsContent = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  document.title = title;

  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  if (keywords) {
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
  } else {
    removeElement('meta[name="keywords"]');
  }
  if (author) {
    upsertMeta('meta[name="author"]', { name: 'author', content: author });
  } else {
    removeElement('meta[name="author"]');
  }
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: robotsContent,
  });
  upsertMeta('meta[name="googlebot"]', {
    name: 'googlebot',
    content: robotsContent,
  });

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
  upsertMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: image });
  if (imageAlt) {
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: imageAlt });
  } else {
    removeElement('meta[property="og:image:alt"]');
  }
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Thế Giới Trị Mụn' });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: OG_LOCALE_BY_LANG[lang] });
  if (modifiedTime) {
    upsertMeta('meta[property="og:updated_time"]', { property: 'og:updated_time', content: modifiedTime });
  } else {
    removeElement('meta[property="og:updated_time"]');
  }

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  if (imageAlt) {
    upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: imageAlt });
  } else {
    removeElement('meta[name="twitter:image:alt"]');
  }

  if (type === 'article') {
    if (author) {
      upsertMeta('meta[property="article:author"]', { property: 'article:author', content: author });
    } else {
      removeElement('meta[property="article:author"]');
    }

    if (publishedTime) {
      upsertMeta('meta[property="article:published_time"]', { property: 'article:published_time', content: publishedTime });
    } else {
      removeElement('meta[property="article:published_time"]');
    }

    if (modifiedTime) {
      upsertMeta('meta[property="article:modified_time"]', { property: 'article:modified_time', content: modifiedTime });
    } else {
      removeElement('meta[property="article:modified_time"]');
    }

    if (section) {
      upsertMeta('meta[property="article:section"]', { property: 'article:section', content: section });
    } else {
      removeElement('meta[property="article:section"]');
    }

    if (articleTags.length > 0) {
      upsertMeta('meta[property="article:tag"]', { property: 'article:tag', content: articleTags.join(', ') });
    } else {
      removeElement('meta[property="article:tag"]');
    }
  } else {
    removeElement('meta[property="article:author"]');
    removeElement('meta[property="article:published_time"]');
    removeElement('meta[property="article:modified_time"]');
    removeElement('meta[property="article:section"]');
    removeElement('meta[property="article:tag"]');
  }

  if (type === 'product') {
    if (typeof price === 'number' && Number.isFinite(price)) {
      upsertMeta('meta[property="product:price:amount"]', { property: 'product:price:amount', content: String(price) });
      upsertMeta('meta[property="product:price:currency"]', { property: 'product:price:currency', content: currency });
    } else {
      removeElement('meta[property="product:price:amount"]');
      removeElement('meta[property="product:price:currency"]');
    }

    if (availability) {
      upsertMeta('meta[property="product:availability"]', { property: 'product:availability', content: availability });
    } else {
      removeElement('meta[property="product:availability"]');
    }
  } else {
    removeElement('meta[property="product:price:amount"]');
    removeElement('meta[property="product:price:currency"]');
    removeElement('meta[property="product:availability"]');
  }

  upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  upsertHreflangLinks(path);

  SUPPORTED_LANGS
    .filter((alternateLang) => alternateLang !== lang)
    .forEach((alternateLang) => {
      upsertMeta(`meta[property="og:locale:alternate"][content="${OG_LOCALE_BY_LANG[alternateLang]}"]`, {
        property: 'og:locale:alternate',
        content: OG_LOCALE_BY_LANG[alternateLang],
      });
    });
};

export const applyGlobalOrganizationSchema = (
  clinicName: string,
  options: {
    phone?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
    socialUrls?: string[];
  } = {},
) => {
  const {
    phone,
    email,
    address,
    logoUrl = SEO_DEFAULT_LOGO,
    socialUrls = [],
  } = options;
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    '@id': SEO_ORGANIZATION_ID,
    name: clinicName,
    url: SEO_SITE_URL,
    logo: logoUrl,
    medicalSpecialty: 'Dermatology',
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam',
    },
    availableLanguage: SUPPORTED_LANGS.map((entry) => HREFLANG_BY_LANG[entry]),
    currenciesAccepted: 'VND',
    paymentAccepted: ['Cash', 'Bank Transfer'],
    contactPoint: phone
      ? {
          '@type': 'ContactPoint',
          telephone: phone,
          contactType: 'customer service',
          availableLanguage: SUPPORTED_LANGS.map((entry) => HREFLANG_BY_LANG[entry]),
        }
      : undefined,
    email: email || undefined,
    address: address
      ? {
          '@type': 'PostalAddress',
          streetAddress: address,
          addressCountry: 'VN',
        }
      : undefined,
    sameAs: socialUrls.filter(Boolean),
  };

  upsertJsonLd('org-jsonld', orgLd);
};

export const applyGlobalWebsiteSchema = (siteName: string, lang: SeoLang = 'vi') => {
  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SEO_WEBSITE_ID,
    name: siteName,
    url: SEO_SITE_URL,
    inLanguage: SUPPORTED_LANGS.map((entry) => HREFLANG_BY_LANG[entry]),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SEO_SITE_URL}/san-pham?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@id': SEO_ORGANIZATION_ID,
    },
    availableLanguage: HREFLANG_BY_LANG[lang],
  };

  upsertJsonLd('website-jsonld', websiteLd);
};
