// Cloudflare Pages Worker — SEO + Social Link Preview
// 1. Dynamic sitemap.xml from Cloudflare D1 data
// 2. Bot detection → OG meta tags for social sharing
// 3. Normal users → SPA as usual

import { maybeHandlePublicRuntimeRoute } from './worker/publicRuntime/routes.js';
import { maybeHandleMediaR2Route } from './worker/mediaR2/routes.js';
import { maybeHandleObservabilityRoute } from './worker/observability/routes.js';
import { maybeHandleAdminToolsRoute } from './worker/adminTools/routes.js';
import { maybeHandleSeoRoute } from './worker/seo/routes.js';
import { maybeHandleIngredientAnalyzerRoute } from './worker/ingredientAnalyzer/routes.js';
import { syncD1ProductIngredientSnapshots } from './worker/ingredientAnalyzer/productSync.js';
import { maybeHandleAiGatewayRoute } from './worker/aiGateway/routes.js';
import { maybeHandleOrderLookupRoute } from './worker/orderLookup/routes.js';
import { maybeHandleAuthRoute } from './worker/auth/routes.js';
import { maybeHandleD1CommerceRoute } from './worker/orders/routes.js';
import { maybeHandleGhtkRoute } from './worker/shipping/routes.js';
import { maybeHandleAppointmentRoute } from './worker/appointments/routes.js';
import { maybeHandleAccountRoute } from './worker/account/routes.js';
import { maybeHandleAdminD1Route } from './worker/adminD1/routes.js';
import { maybeHandleReviewRoute } from './worker/reviews/routes.js';
import { maybeHandleAnalyticsRoute } from './worker/analytics/routes.js';
import { maybeHandlePancakeRoute } from './worker/integrations/pancake/routes.js';
import { consumePancakeQueue, dispatchPendingPancakeSync } from './worker/integrations/pancake/outbox.js';
import { dispatchPendingNotifications, consumeNotificationQueue } from './worker/email/outbox.js';
import { consumeShippingQueue, dispatchPendingShipping } from './worker/shipping/handlers.js';
import { enqueueDueAdminReports } from './worker/reports/dispatcher.js';
import { requireCsrf, requireRole, requireSession } from './worker/auth/session.js';
import { fetchD1PublicEndpoint } from './worker/publicRuntime/d1Rest.js';

// D1 is the only production data backend. These variables remain only as
// fail-closed placeholders for historical non-D1 modules that are not part
// of the production route graph.
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
const SITE_NAME = 'Thế Giới Trị Mụn';
const BASE_URL = 'https://thegioitrimun.vn';
const CANONICAL_HOST = 'thegioitrimun.vn';
const DEFAULT_R2_IMAGE_BASE_URL = `${BASE_URL}/r2`;
const DEFAULT_SHARE_IMAGE = `${BASE_URL}/seo/og-default.jpg`;
const DEFAULT_LOGO_IMAGE = `${BASE_URL}/icons/da-lieu-nhiet-doi-phu-quoc-512.png`;
const WEBSITE_SCHEMA_ID = `${BASE_URL}#website`;
const ORGANIZATION_SCHEMA_ID = `${BASE_URL}#organization`;
let R2_IMAGE_BASE_URL = DEFAULT_R2_IMAGE_BASE_URL;
const SUPABASE_PUBLIC_OBJECT_PATH_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;
const ALLOWED_PUBLIC_IMAGE_BUCKETS = new Set([
    'site-assets',
    'avatars',
    'blog-images',
    'product-images',
    'assets',
]);
const PUBLIC_RUNTIME_RESOURCE_ALLOWLIST = new Set([
    'about_features',
    'about_page_content',
    'about_values',
    'auth_page_images',
    'blog_categories',
    'blog_posts',
    'faq_items',
    'featured_doctors',
    'featured_posts',
    'featured_services',
    'footer_content',
    'homepage_hero',
    'payment_settings',
    'procedure_steps',
    'product_brands',
    'product_categories',
    'product_images',
    'products',
    'public_blog_posts',
    'public_doctors_directory',
    'public_product_reviews',
    'services',
    'site_info',
]);
const PUBLIC_RUNTIME_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
const HOMEPAGE_CRITICAL_PUBLIC_RUNTIME_RESOURCES = new Set([
    'faq_items',
    'featured_posts',
    'featured_services',
    'homepage_hero',
    'product_brands',
    'product_categories',
    'products',
    'site_info',
]);
const PUBLIC_RUNTIME_PROXY_TIMEOUT_MS = 6500;
const PUBLIC_BOOTSTRAP_QUERY_TIMEOUT_MS = 6500;
const PUBLIC_BOOTSTRAP_HOME_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=900, stale-if-error=43200';
const PUBLIC_BOOTSTRAP_HOME_DEFERRED_CACHE_CONTROL = 'public, max-age=90, stale-while-revalidate=1800, stale-if-error=43200';
const PUBLIC_BOOTSTRAP_FULL_CACHE_CONTROL = 'public, max-age=45, stale-while-revalidate=300, stale-if-error=21600';
const PRODUCT_LIST_LITE_SELECT = 'id,slug,name,name_en,name_ru,name_cn,description,price,vat_rate,stock_quantity,low_stock_threshold,sku,is_published,is_featured,sold_count,category_id,brand,volume,origin,texture,created_at,category:product_categories(id,slug,name,name_en,name_ru,name_cn),images:product_images(id,image_path,is_primary,display_order)';
const HOMEPAGE_PRODUCT_SELECT = 'id,slug,name,price,vat_rate,is_featured,sold_count,category_id,brand,volume,ingredients,ingredients_en,ingredients_ru,ingredients_cn,images:product_images(id,image_path,is_primary,display_order),category:product_categories(id,slug,name,is_featured)';
const HOMEPAGE_SERVICE_SELECT = 'id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,benefits,benefits_en,benefits_ru,benefits_cn,icon,price,image_path,updated_at,procedure_steps(*)';
const BLOG_HOMEPAGE_SELECT = 'slug,title,summary,date,category_slug,image_path';
const HOMEPAGE_SOURCE_PRODUCT_LIMIT = 64;
const HOMEPAGE_SELECTED_PRODUCT_LIMIT = 12;
const HOMEPAGE_BRAND_LIMIT = 18;
const HOMEPAGE_FAQ_LIMIT = 6;
const HOMEPAGE_BLOG_SOURCE_LIMIT = 18;
const BOOTSTRAP_HERO_STATIC_ASSETS = {
    desktop: {
        path: 'hero/hero-desktop-v2.webp',
        url: '/hero/hero-desktop-v2.webp',
        avifPath: 'hero/hero-desktop-v2.avif',
        avifUrl: '/hero/hero-desktop-v2.avif',
    },
    tablet: {
        path: 'hero/hero-tablet-v2.webp',
        url: '/hero/hero-tablet-v2.webp',
        avifPath: 'hero/hero-tablet-v2.avif',
        avifUrl: '/hero/hero-tablet-v2.avif',
    },
    mobile: {
        path: 'hero/hero-mobile-v2.webp',
        url: '/hero/hero-mobile-v2.webp',
        avifPath: 'hero/hero-mobile-v2.avif',
        avifUrl: '/hero/hero-mobile-v2.avif',
    },
};
const BOOTSTRAP_HERO_LEGACY_PATHS = {
    desktop: 'hero-desktop-1773590349415.webp',
    tablet: 'hero-tablet-1773590352338.webp',
    mobile: 'hero-mobile-1773590354606.webp',
};
const BOOTSTRAP_FALLBACK_HOMEPAGE_HERO = {
    id: 1,
    title: 'Chăm sóc da chuyên sâu, chuẩn y khoa',
    subtitle: 'Giải pháp toàn diện được cá nhân hóa bởi đội ngũ bác sĩ chuyên khoa da liễu hàng đầu.',
    image_desktop_path: BOOTSTRAP_HERO_STATIC_ASSETS.desktop.path,
    image_desktop_url: BOOTSTRAP_HERO_STATIC_ASSETS.desktop.url,
    image_desktop_avif_url: BOOTSTRAP_HERO_STATIC_ASSETS.desktop.avifUrl,
    image_tablet_path: BOOTSTRAP_HERO_STATIC_ASSETS.tablet.path,
    image_tablet_url: BOOTSTRAP_HERO_STATIC_ASSETS.tablet.url,
    image_tablet_avif_url: BOOTSTRAP_HERO_STATIC_ASSETS.tablet.avifUrl,
    image_mobile_path: BOOTSTRAP_HERO_STATIC_ASSETS.mobile.path,
    image_mobile_url: BOOTSTRAP_HERO_STATIC_ASSETS.mobile.url,
    image_mobile_avif_url: BOOTSTRAP_HERO_STATIC_ASSETS.mobile.avifUrl,
};
const supabaseFetchFailureOnce = new Set();
let hasLoggedSupabaseConfigWarning = false;
const SEO_LANGS = ['vi', 'en', 'ru', 'cn'];
const HREFLANG_BY_LANG = {
    vi: 'vi',
    en: 'en',
    ru: 'ru',
    cn: 'zh',
};
const HTML_LANG_BY_LANG = {
    vi: 'vi',
    en: 'en',
    ru: 'ru',
    cn: 'zh-CN',
};
const OG_LOCALE_BY_LANG = {
    vi: 'vi_VN',
    en: 'en_US',
    ru: 'ru_RU',
    cn: 'zh_CN',
};
const CATEGORY_TRANSLATION_FIELDS = ['name', 'description'];
const VIETNAMESE_CHAR_REGEX = /[À-ỹĐđ]/;
const EXCLUDED_BLOG_SLUGS = new Set([
    'can-sua-lai-noi-dung-bai-viet',
    'khong-tim-thay-trang',
]);
const EXCLUDED_BLOG_SLUG_PREFIXES = [
    'tuyet-voi-duoi-day-',
];
const RESERVED_ROOT_PRODUCT_SLUGS = new Set([
    'admin',
    'api',
    'assets',
    'benh-an',
    'dat-lich',
    'dang-nhap',
    'dich-vu',
    'gio-hang',
    'hero',
    'ho-so',
    'ho-so-y-te',
    'icons',
    'kien-thuc',
    'lich-hen',
    'locales',
    'manifest',
    'nha-thuoc',
    'r2',
    'san-pham',
    'seo',
    'tai-khoan',
    'thanh-toan',
    'thuong-hieu',
    've-chung-toi',
    'yeu-thich',
]);

const BOT_USER_AGENTS = [
    'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot',
    'WhatsApp', 'TelegramBot', 'Slackbot', 'Discordbot',
    'Googlebot', 'bingbot', 'yandex', 'Baiduspider',
    'ZaloBot', 'ZaloPlatform', 'Zalo-OpenGraph', 'Zalo-Scraper', 'ZaloImage', 'ZaloPreview',
    'kakaotalk-scrap', 'PinterestBot', 'Viber',
    'redditbot', 'Embedly', 'Quora Link Preview',
    'Showyoubot', 'outbrain', 'Applebot', 'Sogou', 'ia_archiver',
    'MJ12bot', 'Semrushbot', 'DotBot', 'PetalBot'
];

function isBot(userAgent) {
    const ua = String(userAgent || '').toLowerCase();
    if (!ua) return false;

    // Direct match against known scraper / crawler bots
    if (BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()))) {
        return true;
    }

    // Specific Zalo crawler bots (excluding real human users browsing inside the Zalo in-app browser)
    if (ua.includes('zalo') && (ua.includes('bot') || ua.includes('crawler') || ua.includes('scraper') || ua.includes('platform') || ua.includes('preview') || ua.includes('opengraph'))) {
        return true;
    }

    return false;
}

function applyRuntimeConfig(env = {}) {
    const d1Only = usesD1Backend(env);
    SUPABASE_URL = d1Only
        ? ''
        : String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    SUPABASE_ANON_KEY = d1Only
        ? ''
        : String(
            env.SUPABASE_PUBLISHABLE_KEY ||
            env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            env.SUPABASE_ANON_KEY ||
            env.VITE_SUPABASE_ANON_KEY ||
            '',
        );

    const configuredR2Base = env.R2_PUBLIC_BASE_URL || env.VITE_R2_IMAGE_BASE_URL || DEFAULT_R2_IMAGE_BASE_URL;
    R2_IMAGE_BASE_URL = String(configuredR2Base).replace(/\/+$/, '');

    if (!d1Only && !hasLoggedSupabaseConfigWarning) {
        const keyLooksValid = /^sb_publishable_/i.test(String(SUPABASE_ANON_KEY || '')) || /^eyJ/i.test(String(SUPABASE_ANON_KEY || ''));
        if (!SUPABASE_URL || !keyLooksValid) {
            console.warn('[worker] Supabase runtime config may be invalid.', {
                supabaseUrl: SUPABASE_URL,
                hasPublishableKey: Boolean(SUPABASE_ANON_KEY),
                keyPreview: String(SUPABASE_ANON_KEY || '').slice(0, 14),
            });
        }
        hasLoggedSupabaseConfigWarning = true;
    }
}

function buildSupabaseRestUrl(endpoint) {
    return `${SUPABASE_URL}/rest/v1/${String(endpoint || '').replace(/^\/+/, '')}`;
}

function isAllowedPublicRuntimeResource(resource) {
    return /^[a-z0-9_]+$/i.test(resource) && PUBLIC_RUNTIME_RESOURCE_ALLOWLIST.has(resource);
}

function getPublicRuntimeCacheControl(resource) {
    if (HOMEPAGE_CRITICAL_PUBLIC_RUNTIME_RESOURCES.has(resource)) {
        return 'public, max-age=180, stale-while-revalidate=1800, stale-if-error=86400';
    }
    if (resource === 'blog_posts' || resource === 'public_blog_posts' || resource === 'services') {
        return 'public, max-age=120, stale-while-revalidate=900, stale-if-error=43200';
    }
    return PUBLIC_RUNTIME_CACHE_CONTROL;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function escapeXml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function stripHtml(str) {
    if (!str) return '';
    return String(str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeBrandMatchKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[’'`]/g, '')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function splitBrandDescription(description) {
    return String(description || '')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}

function hasMeaningfulValue(value) {
    if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry));
    if (value === null || value === undefined) return false;
    return stripHtml(String(value)).length > 0;
}

function truncateText(str, maxLength = 155) {
    const normalized = stripHtml(str);
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function dedupeTextParts(parts) {
    const seen = new Set();
    return parts.filter((part) => {
        const normalized = stripHtml(part).toLowerCase();
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

function filterArticleTagsForLang(tags, lang) {
    if (!Array.isArray(tags) || tags.length === 0) return [];
    if (lang === 'vi') return tags.filter(Boolean);
    return tags.filter((tag) => tag && !VIETNAMESE_CHAR_REGEX.test(tag));
}

function isExcludedBlogSlug(slug) {
    const normalized = String(slug || '').trim();
    return EXCLUDED_BLOG_SLUGS.has(normalized) || EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function buildMetaDescription(parts, maxLength = 155) {
    const deduped = dedupeTextParts(
        (parts || [])
            .map((part) => stripHtml(part))
            .filter(Boolean)
    );

    if (deduped.length === 0) return '';

    const joined = deduped.join(' ');
    if (joined.length <= maxLength) return joined;

    const bulletJoined = deduped.join(' • ');
    if (bulletJoined.length <= maxLength) return bulletJoined;

    return truncateText(joined, maxLength);
}

function parseKeywordList(value = '') {
    return dedupeTextParts(
        String(value || '')
            .split(',')
            .map((entry) => stripHtml(entry).trim())
            .filter(Boolean)
    );
}

function normalizeMarkdownishSource(input) {
    return String(input || '')
        .replace(/<\/?(p|div|section|article|h[1-6]|ul|ol|blockquote)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<\/li>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\r/g, '\n');
}

function extractMarkdownishHeadings(input, limit = 4) {
    const headings = [];
    for (const rawLine of normalizeMarkdownishSource(input).split('\n')) {
        const trimmed = rawLine.trim();
        const match = trimmed.match(/^#{1,6}\s+(.+)$/);
        if (!match) continue;
        const text = cleanupMarkdownishText(match[1]);
        if (text) headings.push(text);
    }
    return dedupeTextParts(headings).slice(0, limit);
}

function buildArticleExcerpt(input, maxLength = 240) {
    const paragraphs = [];
    const fallbackLines = [];

    for (const rawLine of normalizeMarkdownishSource(input).split('\n')) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const cleaned = cleanupMarkdownishText(
            trimmed
                .replace(/^#{1,6}\s+/, '')
                .replace(/^[-*]\s+/, '')
                .replace(/^\d+\.\s+/, '')
        );
        if (!cleaned) continue;
        fallbackLines.push(cleaned);
        if (!/^#{1,6}\s+/.test(trimmed) && !/^[-*]\s+/.test(trimmed) && !/^\d+\.\s+/.test(trimmed) && cleaned.length >= 40) {
            paragraphs.push(cleaned);
        }
    }

    const source = paragraphs.length > 0 ? paragraphs : fallbackLines;
    return truncateText(source.join(' '), maxLength);
}

function buildArticleBodyExcerpt(input, maxLength = 1800) {
    return truncateText(cleanupMarkdownishText(input).replace(/\n+/g, ' '), maxLength);
}

function buildBlogSeoDescription({ metaDescription, summary, content, categoryName, maxLength = 155 }) {
    const explicitMeta = cleanupMarkdownishText(metaDescription || '');
    if (explicitMeta.length >= 120 && explicitMeta.length <= 170) return explicitMeta;

    const generated = buildMetaDescription([
        summary,
        buildArticleExcerpt(content, 240),
        categoryName,
    ], maxLength);

    if (generated.length >= 110) return generated;

    return buildMetaDescription([
        explicitMeta,
        summary,
        buildArticleExcerpt(content, 240),
        categoryName,
    ], maxLength);
}

function buildBlogKeywordTerms({ metaKeywords, title, categoryName, summary, content, limit = 12 }) {
    return dedupeTextParts([
        ...parseKeywordList(metaKeywords),
        title,
        categoryName,
        ...extractMarkdownishHeadings(content, 4),
        cleanupMarkdownishText(summary || '').length <= 90 ? summary : '',
    ])
        .filter((entry) => entry.length >= 2 && entry.length <= 90)
        .slice(0, limit);
}

function buildImageTitle(...parts) {
    return truncateText(dedupeTextParts(parts).join(' - '), 110);
}

function formatCurrencyVnd(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function escapeAttr(str) {
    return escapeHtml(String(str || ''));
}

function cleanupMarkdownishText(input) {
    return String(input || '')
        .replace(/<\/?(p|div|section|article|h[1-6]|ul|ol)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\r/g, '')
        .trim();
}

function renderMarkdownishHtml(input, options = {}) {
    const maxBlocks = options.maxBlocks || Infinity;
    const text = cleanupMarkdownishText(input);
    if (!text) return '';

    const lines = text.split('\n');
    const blocks = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length === 0) return;
        blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
        listItems = [];
    };

    for (const rawLine of lines) {
        if (blocks.length >= maxBlocks) break;
        const line = rawLine.trim();
        if (!line) {
            flushList();
            continue;
        }

        const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
        if (listMatch) {
            listItems.push(listMatch[1].trim());
            continue;
        }

        flushList();

        if (/^###\s+/.test(line)) {
            blocks.push(`<h3>${escapeHtml(line.replace(/^###\s+/, '').trim())}</h3>`);
        } else if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
            blocks.push(`<h2>${escapeHtml(line.replace(/^##?\s+/, '').trim())}</h2>`);
        } else {
            blocks.push(`<p>${escapeHtml(line)}</p>`);
        }
    }

    flushList();
    return blocks.slice(0, maxBlocks).join('\n');
}

function renderTextList(items) {
    const filtered = (items || []).map((item) => stripHtml(item)).filter(Boolean);
    if (filtered.length === 0) return '';
    return `<ul>${filtered.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function splitHighlights(value, limit = 4) {
    return String(value || '')
        .split(/[\n•|-]|(?:\.\s+)/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, limit);
}

function buildKeywordString(parts = [], limit = 12) {
    return dedupeTextParts(flattenTextParts(parts).map((part) => stripHtml(part)).filter(Boolean))
        .slice(0, limit)
        .join(', ');
}

function toDateOnly(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

function pickLatestDate(values = [], fallback = null) {
    const normalized = values.map(toDateOnly).filter(Boolean).sort();
    return normalized.length > 0 ? normalized[normalized.length - 1] : fallback;
}

function buildWebPageJsonLd({ canonicalUrl, title, description, image, imageAlt, lang = 'vi', breadcrumbId }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: HREFLANG_BY_LANG[lang] || HREFLANG_BY_LANG.vi,
        isPartOf: {
            '@id': WEBSITE_SCHEMA_ID,
        },
        ...(image ? {
            primaryImageOfPage: {
                '@type': 'ImageObject',
                url: image,
                ...(imageAlt ? { caption: imageAlt } : {}),
            },
        } : {}),
        ...(breadcrumbId ? {
            breadcrumb: {
                '@id': breadcrumbId,
            },
        } : {}),
    };
}

function buildFaqJsonLd(items = [], options = {}) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const lang = normalizeSeoLang(options.lang || 'vi');
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        ...(options.url ? {
            url: options.url,
            mainEntityOfPage: options.url,
        } : {}),
        inLanguage: HREFLANG_BY_LANG[lang] || HREFLANG_BY_LANG.vi,
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
}

function renderFaqItemsHtml(items = []) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items
        .map((item) => `<article><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`)
        .join('');
}

function normalizeDetailFaqItems(items = []) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({
            question: stripHtml(item?.question || '').trim(),
            answer: stripHtml(item?.answer || '').trim(),
        }))
        .filter((item) => item.question && item.answer);
}

function toAbsoluteUrl(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_URL}${cleanPath}`;
}

function normalizeSeoLang(value) {
    if (!value) return 'vi';
    const lang = String(value).toLowerCase();
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ru')) return 'ru';
    if (lang.startsWith('cn') || lang.startsWith('zh')) return 'cn';
    return 'vi';
}

function buildAbsoluteUrl(path, lang = 'vi') {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (lang === 'vi') return `${BASE_URL}${cleanPath}`;
    return `${BASE_URL}${cleanPath}?lang=${encodeURIComponent(lang)}`;
}

function buildCanonicalRedirectUrl(url, path, lang = 'vi') {
    const nextUrl = new URL(url.toString());
    nextUrl.pathname = path.startsWith('/') ? path : `/${path}`;
    if (normalizeSeoLang(lang) === 'vi') {
        nextUrl.searchParams.delete('lang');
    } else {
        nextUrl.searchParams.set('lang', normalizeSeoLang(lang));
    }
    return nextUrl.toString();
}

function getLegacyRootProductSlug(path) {
    const match = String(path || '').match(/^\/([^/.]+)\/?$/);
    if (!match) return null;

    let slug = match[1];
    try {
        slug = decodeURIComponent(slug);
    } catch {}

    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (!normalizedSlug || RESERVED_ROOT_PRODUCT_SLUGS.has(normalizedSlug)) {
        return null;
    }

    return slug;
}

function getTextMatchVariants(value) {
    const raw = String(value || '').trim();
    const variants = [];
    const push = (candidate) => {
        const normalized = String(candidate || '').trim();
        if (!normalized || variants.includes(normalized)) return;
        variants.push(normalized);
    };

    push(raw);
    try { push(decodeURIComponent(raw)); } catch {}
    try {
        const encoded = encodeURIComponent(raw);
        push(encoded);
        push(encoded.toLowerCase());
        const doubleEncoded = encodeURIComponent(encoded);
        push(doubleEncoded);
        push(doubleEncoded.toLowerCase());
    } catch {}

    return variants;
}

async function fetchFirstByVariants({ table, field, value, select, extraFilters = '', dataFetch = supabaseFetch }) {
    for (const candidate of getTextMatchVariants(value)) {
        const data = await dataFetch(`${table}?${field}=eq.${candidate}${extraFilters}&select=${select}&limit=1`);
        if (data?.[0]) return data[0];
    }
    return null;
}

function normalizeAlternateLangs(langs = SEO_LANGS) {
    const ordered = [];
    for (const lang of ['vi', ...(langs || [])]) {
        const normalized = normalizeSeoLang(lang);
        if (!ordered.includes(normalized)) ordered.push(normalized);
    }
    return ordered;
}

function getAlternateUrls(path, langs = SEO_LANGS) {
    return normalizeAlternateLangs(langs).map((lang) => ({
        lang,
        hreflang: HREFLANG_BY_LANG[lang],
        href: buildAbsoluteUrl(path, lang),
    }));
}

function renderAlternateLinks(path, langs = SEO_LANGS) {
    const links = getAlternateUrls(path, langs)
        .map(({ hreflang, href }) => `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}">`)
        .join('\n  ');
    return `${links}\n  <link rel="alternate" hreflang="x-default" href="${escapeHtml(buildAbsoluteUrl(path, 'vi'))}">`;
}

function renderOgLocaleAlternateTags(lang, langs = SEO_LANGS) {
    return normalizeAlternateLangs(langs)
        .filter((candidate) => candidate !== lang)
        .map((candidate) => `<meta property="og:locale:alternate" content="${OG_LOCALE_BY_LANG[candidate]}">`)
        .join('\n  ');
}

function getLocalizedField(record, field, lang = 'vi') {
    if (!record) return '';
    if (lang !== 'vi') {
        const localized = record[`${field}_${lang}`];
        if (localized) return String(localized);
    }
    return String(record[field] || '');
}

function getLocalizedArray(record, field, lang = 'vi') {
    if (!record) return [];
    if (lang !== 'vi') {
        const localized = record[`${field}_${lang}`];
        if (Array.isArray(localized) && localized.length > 0) return localized;
    }
    return Array.isArray(record[field]) ? record[field] : [];
}

function getLocalizedLabel(translations, lang = 'vi') {
    return translations[lang] || translations.vi;
}

function hasLocalizedField(record, field, lang = 'vi') {
    if (!record) return false;
    if (lang === 'vi') return hasMeaningfulValue(record[field]);
    return hasMeaningfulValue(record[`${field}_${lang}`]);
}

function getStrictLocalizedField(record, field, lang = 'vi') {
    if (!record) return '';
    if (lang === 'vi') return String(record[field] || '');
    return String(record[`${field}_${lang}`] || '');
}

function getStrictLocalizedArray(record, field, lang = 'vi') {
    if (!record) return [];
    if (lang === 'vi') return Array.isArray(record[field]) ? record[field] : [];
    const localized = record[`${field}_${lang}`];
    return Array.isArray(localized) ? localized : [];
}

function hasAllLocalizedFields(record, fields = [], lang = 'vi') {
    return fields.every((field) => hasLocalizedField(record, field, lang));
}

function getAvailableLangs(record, fields = []) {
    if (!record || fields.length === 0) return ['vi'];
    return normalizeAlternateLangs(
        SEO_LANGS.filter((lang) => lang === 'vi' || fields.some((field) => hasLocalizedField(record, field, lang)))
    );
}

function getAvailableLangsRequiringAll(record, requiredFields = []) {
    if (!record || requiredFields.length === 0) return ['vi'];
    return normalizeAlternateLangs(
        SEO_LANGS.filter((lang) => lang === 'vi' || hasAllLocalizedFields(record, requiredFields, lang))
    );
}

function resolveSupportedLang(requestedLang, availableLangs) {
    const normalizedRequested = normalizeSeoLang(requestedLang);
    const supported = normalizeAlternateLangs(availableLangs);
    if (supported.includes(normalizedRequested)) return normalizedRequested;
    return 'vi';
}

function filterRecordsByRequiredLocale(records = [], lang = 'vi', requiredFields = []) {
    if (normalizeSeoLang(lang) === 'vi' || requiredFields.length === 0) return records || [];
    return (records || []).filter((record) => hasAllLocalizedFields(record, requiredFields, lang));
}

const INTERNAL_LINK_STOPWORDS = new Set([
    'va', 'voi', 'cho', 'la', 'cua', 'the', 'and', 'for', 'to', 'da', 'duoc',
    'nhung', 'mot', 'cac', 'trong', 'khi', 'sau', 'truoc', 'this', 'that', 'from', 'with',
]);

function normalizeSearchText(text) {
    return stripHtml(String(text || ''))
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeSearchText(text) {
    return normalizeSearchText(text)
        .split(' ')
        .filter((token) => token.length > 2 && !INTERNAL_LINK_STOPWORDS.has(token));
}

function flattenTextParts(parts = []) {
    return (parts || []).flatMap((part) => {
        if (Array.isArray(part)) return part.map((entry) => String(entry || ''));
        return [String(part || '')];
    });
}

function buildTokenSet(parts = []) {
    return new Set(tokenizeSearchText(flattenTextParts(parts).join(' ')));
}

function rankRecordsByTokenOverlap(records = [], options = {}) {
    const {
        lang = 'vi',
        limit = 4,
        sourceParts = [],
        getItemParts = () => [],
        getExtraScore = () => 0,
        requiredFields = [],
        minScore = 1,
        tieBreaker = null,
    } = options;

    const sourceTokens = buildTokenSet(sourceParts);

    return filterRecordsByRequiredLocale(records, lang, requiredFields)
        .map((record, index) => {
            const itemTokens = new Set(tokenizeSearchText(flattenTextParts(getItemParts(record)).join(' ')));
            let score = Number(getExtraScore(record) || 0);
            itemTokens.forEach((token) => {
                if (sourceTokens.has(token)) score += 1;
            });
            return { record, score, index };
        })
        .filter(({ score }) => score >= minScore)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (typeof tieBreaker === 'function') {
                const diff = tieBreaker(a.record, b.record);
                if (diff !== 0) return diff;
            }
            return a.index - b.index;
        })
        .slice(0, limit)
        .map(({ record }) => record);
}

function isInternalUrl(url) {
    return typeof url === 'string' && url.startsWith(BASE_URL);
}

function buildSeoTitle(primary, options = {}) {
    const { context, siteName = SITE_NAME, maxLength = 65 } = options;
    const parts = [stripHtml(primary), stripHtml(context)].filter(Boolean);
    let left = parts.join(' | ');
    const full = `${left} | ${siteName}`;
    if (full.length <= maxLength) return full;

    if (context) {
        left = stripHtml(primary);
    }
    const compact = `${left} | ${siteName}`;
    if (compact.length <= maxLength) return compact;

    const availablePrimaryLength = Math.max(10, maxLength - (` | ${siteName}`).length);
    return `${truncateText(left, availablePrimaryLength)} | ${siteName}`;
}

function buildRobotsContent(noindex = false) {
    return noindex
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
}

function withRobotsHeader(response, robotsContent) {
    const nextHeaders = new Headers(response.headers);
    nextHeaders.set('X-Robots-Tag', robotsContent);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: nextHeaders,
    });
}

function isPrivatePath(path) {
    return [
        /^\/admin(?:\/|$)/,
        /^\/tai-khoan(?:\/|$)/,
        /^\/ho-so(?:\/|$)/,
        /^\/benh-an(?:\/|$)/,
        /^\/ho-so-y-te(?:\/|$)/,
        /^\/thanh-toan(?:\/|$)/,
        /^\/dang-nhap(?:\/|$)/,
        /^\/gio-hang(?:\/|$)/,
        /^\/yeu-thich(?:\/|$)/,
        /^\/lich-hen(?:\/|$)/,
        /^\/dat-lich(?:\/|$)/,
        /^\/don-hang(?:\/|$)/,
        /^\/dat-hang-thanh-cong(?:\/|$)/,
        /^\/tra-cuu-don-hang(?:\/|$)/,
    ].some((pattern) => pattern.test(path));
}

function generateNoindexPage(path, lang = 'vi') {
    const title = getLocalizedLabel({
        vi: 'Trang riêng tư',
        en: 'Private page',
        ru: 'Закрытая страница',
        cn: '私有页面',
    }, lang);
    const description = getLocalizedLabel({
        vi: 'Trang này không được lập chỉ mục tìm kiếm.',
        en: 'This page should not be indexed by search engines.',
        ru: 'Эта страница не должна индексироваться поисковыми системами.',
        cn: '该页面不应被搜索引擎收录。',
    }, lang);

    return new Response(`<!DOCTYPE html>
<html lang="${HTML_LANG_BY_LANG[lang]}">
<head>
  ${renderSeoHead({
        lang,
        path,
        title: `${title} | ${SITE_NAME}`,
        description,
        canonicalUrl: buildAbsoluteUrl(path, lang),
        noindex: true,
    })}
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
  </main>
</body>
</html>`, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'X-Robots-Tag': buildRobotsContent(true),
            'Cache-Control': 'private, no-store',
        },
    });
}

function createBreadcrumbJsonLd(items, id = null) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        ...(id ? { '@id': id } : {}),
        itemListElement: items.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.name,
            item: entry.item,
        })),
    };
}

function renderSeoHead({
    lang = 'vi',
    path,
    title,
    description,
    canonicalUrl,
    image = DEFAULT_SHARE_IMAGE,
    imageAlt,
    type = 'website',
    noindex = false,
    keywords,
    author,
    publishedTime,
    modifiedTime,
    section,
    tags = [],
    price,
    currency = 'VND',
    availability,
    jsonLd = null,
    alternateLangs = SEO_LANGS,
}) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeImage = escapeHtml(image || DEFAULT_SHARE_IMAGE);
    const safeCanonical = escapeHtml(canonicalUrl);
    const shouldEmitAlternates = path && isInternalUrl(canonicalUrl);
    const alternates = shouldEmitAlternates ? renderAlternateLinks(path, alternateLangs) : '';
    const alternateLocales = renderOgLocaleAlternateTags(lang, alternateLangs);
    const robotsContent = buildRobotsContent(noindex);
    const jsonLdPayload = Array.isArray(jsonLd) ? jsonLd.filter(Boolean) : (jsonLd ? [jsonLd] : []);
    const jsonLdScript = jsonLdPayload.length > 0
        ? `<script type="application/ld+json">${JSON.stringify(jsonLdPayload.length === 1 ? jsonLdPayload[0] : jsonLdPayload)}</script>`
        : '';
    const articleTags = filterArticleTagsForLang(tags, lang);
    const articleMeta = type === 'article'
        ? [
            author ? `<meta property="article:author" content="${escapeHtml(author)}">` : '',
            publishedTime ? `<meta property="article:published_time" content="${escapeHtml(publishedTime)}">` : '',
            modifiedTime ? `<meta property="article:modified_time" content="${escapeHtml(modifiedTime)}">` : '',
            section ? `<meta property="article:section" content="${escapeHtml(section)}">` : '',
            articleTags.length > 0 ? `<meta property="article:tag" content="${escapeHtml(articleTags.join(', '))}">` : '',
        ].filter(Boolean).join('\n  ')
        : '';
    const productMeta = type === 'product'
        ? [
            typeof price === 'number' ? `<meta property="product:price:amount" content="${escapeHtml(String(price))}">` : '',
            typeof price === 'number' ? `<meta property="product:price:currency" content="${escapeHtml(currency)}">` : '',
            availability ? `<meta property="product:availability" content="${escapeHtml(availability)}">` : '',
        ].filter(Boolean).join('\n  ')
        : '';

    return `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  <meta name="robots" content="${robotsContent}">
  <meta name="googlebot" content="${robotsContent}">
  ${author ? `<meta name="author" content="${escapeHtml(author)}">` : ''}
  <link rel="canonical" href="${safeCanonical}">
  ${image ? `<link rel="image_src" href="${safeImage}">` : ''}
  ${alternates}
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  ${imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">` : ''}
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="${OG_LOCALE_BY_LANG[lang]}">
  ${modifiedTime ? `<meta property="og:updated_time" content="${escapeHtml(modifiedTime)}">` : ''}
  ${alternateLocales}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  ${imageAlt ? `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">` : ''}
  ${articleMeta}
  ${productMeta}
  ${jsonLdScript}`.trim();
}

function encodeObjectPath(path) {
    return String(path)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function decodeObjectPath(path) {
    return String(path)
        .split('/')
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .join('/');
}

function isAllowedPublicBucket(bucket) {
    return ALLOWED_PUBLIC_IMAGE_BUCKETS.has(String(bucket || '').trim());
}

function resolveStorageReference(rawPath, fallbackBucket) {
    if (!rawPath) return null;
    const raw = String(rawPath).trim();
    if (!raw) return null;

    const fallback = isAllowedPublicBucket(fallbackBucket) ? String(fallbackBucket) : null;

    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);

            const supabaseMatch = parsed.pathname.match(SUPABASE_PUBLIC_OBJECT_PATH_REGEX);
            if (supabaseMatch) {
                const bucket = decodeURIComponent(supabaseMatch[1]);
                if (isAllowedPublicBucket(bucket)) {
                    return {
                        bucket,
                        path: decodeObjectPath(supabaseMatch[2]),
                    };
                }
            }

            const r2Match = parsed.pathname.match(/^\/r2\/([^/]+)\/(.+)$/i);
            if (r2Match) {
                const bucket = decodeURIComponent(r2Match[1]);
                if (isAllowedPublicBucket(bucket)) {
                    return {
                        bucket,
                        path: decodeObjectPath(r2Match[2]),
                    };
                }
            }
        } catch {
            // keep external URL
        }

        return { externalUrl: raw };
    }

    const cleanPath = raw.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath) return null;

    const r2Local = cleanPath.match(/^r2\/([^/]+)\/(.+)$/i);
    if (r2Local) {
        const bucket = decodeURIComponent(r2Local[1]);
        if (isAllowedPublicBucket(bucket)) {
            return {
                bucket,
                path: decodeObjectPath(r2Local[2]),
            };
        }
    }

    const inferred = cleanPath.match(/^([^/]+)\/(.+)$/);
    if (inferred && isAllowedPublicBucket(inferred[1])) {
        return {
            bucket: inferred[1],
            path: decodeObjectPath(inferred[2]),
        };
    }

    return { bucket: fallback, path: decodeObjectPath(cleanPath) };
}

function getStorageUrl(path, bucket) {
    const resolved = resolveStorageReference(path, bucket);
    if (!resolved) return null;
    if (resolved.externalUrl) return resolved.externalUrl;

    const objectPath = String(resolved.path || '').replace(/^\/+/, '');
    if (!objectPath) return null;

    if (resolved.bucket && isAllowedPublicBucket(resolved.bucket)) {
        return `${R2_IMAGE_BASE_URL}/${encodeURIComponent(resolved.bucket)}/${encodeObjectPath(objectPath)}`;
    }

    if (bucket) {
        return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(String(bucket))}/${encodeObjectPath(objectPath)}`;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${encodeObjectPath(objectPath)}`;
}

function normalizeBootstrapHomepageHeroImagePath(value) {
    return String(value || '')
        .trim()
        .replace(/^https?:\/\/[^/]+\//i, '')
        .replace(/^\/+/, '')
        .replace(/^r2\/site-assets\//, '')
        .replace(/^storage\/v1\/object\/public\/site-assets\//, '');
}

function resolveBootstrapHomepageHeroImageUrl(path, fallbackUrl) {
    const normalizedPath = normalizeBootstrapHomepageHeroImagePath(path);
    if (!normalizedPath) return fallbackUrl;

    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.desktop.path) return BOOTSTRAP_HERO_STATIC_ASSETS.desktop.url;
    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.tablet.path) return BOOTSTRAP_HERO_STATIC_ASSETS.tablet.url;
    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.mobile.path) return BOOTSTRAP_HERO_STATIC_ASSETS.mobile.url;
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.desktop) return BOOTSTRAP_HERO_STATIC_ASSETS.desktop.url;
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.tablet) return BOOTSTRAP_HERO_STATIC_ASSETS.tablet.url;
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.mobile) return BOOTSTRAP_HERO_STATIC_ASSETS.mobile.url;

    return getStorageUrl(normalizedPath, 'site-assets') || fallbackUrl;
}

function resolveBootstrapHomepageHeroAvifUrl(path, fallbackUrl) {
    const normalizedPath = normalizeBootstrapHomepageHeroImagePath(path);
    if (!normalizedPath) return fallbackUrl;

    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.desktop.path || normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.desktop.avifPath) {
        return BOOTSTRAP_HERO_STATIC_ASSETS.desktop.avifUrl;
    }
    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.tablet.path || normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.tablet.avifPath) {
        return BOOTSTRAP_HERO_STATIC_ASSETS.tablet.avifUrl;
    }
    if (normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.mobile.path || normalizedPath === BOOTSTRAP_HERO_STATIC_ASSETS.mobile.avifPath) {
        return BOOTSTRAP_HERO_STATIC_ASSETS.mobile.avifUrl;
    }
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.desktop) return BOOTSTRAP_HERO_STATIC_ASSETS.desktop.avifUrl;
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.tablet) return BOOTSTRAP_HERO_STATIC_ASSETS.tablet.avifUrl;
    if (normalizedPath === BOOTSTRAP_HERO_LEGACY_PATHS.mobile) return BOOTSTRAP_HERO_STATIC_ASSETS.mobile.avifUrl;

    if (/^hero-(desktop|tablet|mobile)-/i.test(normalizedPath) && normalizedPath.endsWith('.webp')) {
        return getStorageUrl(normalizedPath.replace(/\.webp$/i, '.avif'), 'site-assets') || fallbackUrl;
    }

    if (normalizedPath.endsWith('.avif')) {
        return getStorageUrl(normalizedPath, 'site-assets') || fallbackUrl;
    }

    return fallbackUrl;
}

function mapServiceRecord(record) {
    const service = {
        ...record,
        image_url: record?.image_path ? getStorageUrl(record.image_path, 'site-assets') : undefined,
        procedure_steps: Array.isArray(record?.procedure_steps)
            ? record.procedure_steps
                .map((step) => ({
                    ...step,
                    image_url: step?.image_path ? getStorageUrl(step.image_path, 'site-assets') : undefined,
                }))
                .sort((a, b) => Number(a.step_number || 0) - Number(b.step_number || 0))
            : [],
    };
    return service;
}

function mapDoctorRecord(record) {
    const profile = Array.isArray(record?.doctors) ? record.doctors[0] : record?.doctors;
    return {
        id: record?.id,
        name: record?.name,
        avatar_path: record?.avatar_path,
        avatar_url: record?.avatar_path ? getStorageUrl(record.avatar_path, 'avatars') || '' : '',
        job_title: record?.job_title || profile?.job_title || 'Bác sĩ Chuyên khoa',
        specialization: record?.specialization || profile?.specialization || 'Chuyên khoa Da liễu',
        description: record?.homepage_description || profile?.homepage_description || 'Bác sĩ tại Thế Giới Trị Mụn',
        job_title_en: record?.job_title_en || profile?.job_title_en,
        job_title_ru: record?.job_title_ru || profile?.job_title_ru,
        job_title_cn: record?.job_title_cn || profile?.job_title_cn,
        specialization_en: record?.specialization_en || profile?.specialization_en,
        specialization_ru: record?.specialization_ru || profile?.specialization_ru,
        specialization_cn: record?.specialization_cn || profile?.specialization_cn,
        description_en: record?.homepage_description_en || profile?.homepage_description_en,
        description_ru: record?.homepage_description_ru || profile?.homepage_description_ru,
        description_cn: record?.homepage_description_cn || profile?.homepage_description_cn,
    };
}

function mapBlogLiteRecord(record) {
    if (!record) return null;
    const normalizedSlug = String(record.slug || '').trim();
    if (!normalizedSlug) return null;
    if (EXCLUDED_BLOG_SLUGS.has(normalizedSlug) || EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalizedSlug.startsWith(prefix))) {
        return null;
    }

    return {
        ...record,
        slug: normalizedSlug,
        summary: record.summary || '',
        content: '',
        detail_loaded: false,
        author: null,
        image_url: record.image_url || getResolvedBlogImageUrl(record),
    };
}

function mapProductLiteRecord(record) {
    const categoryRecord = Array.isArray(record?.category) ? record.category[0] : record?.category;
    const images = Array.isArray(record?.images)
        ? record.images
            .map((image) => ({
                ...image,
                image_url: image?.image_path ? getStorageUrl(image.image_path, 'product-images') : undefined,
            }))
            .sort((a, b) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;
                const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
                if (orderDiff !== 0) return orderDiff;
                return Number(a.id || 0) - Number(b.id || 0);
            })
        : [];

    return {
        ...record,
        category: categoryRecord || record?.category,
        category_slug: categoryRecord?.slug || record?.category_slug || undefined,
        images,
        price: Number(record?.price || 0),
        vat_rate: record?.vat_rate != null ? Number(record.vat_rate) : 0.1,
        stock_quantity: Number(record?.stock_quantity || 0),
        sold_count: record?.sold_count != null ? Number(record.sold_count) : undefined,
        detail_loaded: false,
    };
}

function selectHomepageProductRows(sourceRows, featuredCategoryIds, limit = HOMEPAGE_SELECTED_PRODUCT_LIMIT) {
    const mergedRows = [];
    const seenIds = new Set();
    const categoryIds = Array.isArray(featuredCategoryIds)
        ? featuredCategoryIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];

    const groups = [
        sourceRows.filter((row) => row?.is_featured).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))).slice(0, 10),
        [...sourceRows].sort((a, b) => Number(b?.sold_count || 0) - Number(a?.sold_count || 0)).slice(0, 10),
        [...sourceRows].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0)).slice(0, 10),
        ...categoryIds.map((categoryId) =>
            sourceRows
                .filter((row) => Number(row?.category_id) === categoryId)
                .sort((a, b) => Number(b?.sold_count || 0) - Number(a?.sold_count || 0))
                .slice(0, 10)
        ),
    ];

    for (const group of groups) {
        for (const row of group || []) {
            if (!row || seenIds.has(row.id)) continue;
            seenIds.add(row.id);
            mergedRows.push(row);
            if (mergedRows.length >= limit) {
                return mergedRows;
            }
        }
    }

    return mergedRows;
}

function mapBrandRecord(record) {
    return {
        ...record,
        logo_url: record?.logo_path ? getStorageUrl(record.logo_path, 'site-assets') : undefined,
    };
}

function mapSiteInfoRecord(record) {
    if (!record) return null;
    return {
        ...record,
        logo_light_url: record.logo_light_path ? getStorageUrl(record.logo_light_path, 'site-assets') : undefined,
        logo_dark_url: record.logo_dark_path ? getStorageUrl(record.logo_dark_path, 'site-assets') : undefined,
        favicon_url: record.favicon_path ? getStorageUrl(record.favicon_path, 'site-assets') : undefined,
    };
}

function mapAuthPageImageRecord(record) {
    if (!record) return null;
    return {
        ...record,
        login_image_url: record.login_image_path ? getStorageUrl(record.login_image_path, 'site-assets') : undefined,
    };
}

function mapAboutPageData(contentRecord, featureRows, valueRows) {
    if (!contentRecord && (!Array.isArray(featureRows) || featureRows.length === 0) && (!Array.isArray(valueRows) || valueRows.length === 0)) {
        return null;
    }

    return {
        content: contentRecord
            ? {
                ...contentRecord,
                image_url: contentRecord.image_path ? getStorageUrl(contentRecord.image_path, 'site-assets') : undefined,
            }
            : null,
        reasonsToChoose: Array.isArray(featureRows) ? featureRows : [],
        coreValues: Array.isArray(valueRows) ? valueRows : [],
    };
}

function mapHomepageHeroRecord(record) {
    if (!record) return null;

    return {
        ...BOOTSTRAP_FALLBACK_HOMEPAGE_HERO,
        ...record,
        image_desktop_url: resolveBootstrapHomepageHeroImageUrl(record.image_desktop_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_desktop_url),
        image_desktop_avif_url: resolveBootstrapHomepageHeroAvifUrl(record.image_desktop_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_desktop_avif_url),
        image_tablet_url: resolveBootstrapHomepageHeroImageUrl(record.image_tablet_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_tablet_url),
        image_tablet_avif_url: resolveBootstrapHomepageHeroAvifUrl(record.image_tablet_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_tablet_avif_url),
        image_mobile_url: resolveBootstrapHomepageHeroImageUrl(record.image_mobile_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_mobile_url),
        image_mobile_avif_url: resolveBootstrapHomepageHeroAvifUrl(record.image_mobile_path, BOOTSTRAP_FALLBACK_HOMEPAGE_HERO.image_mobile_avif_url),
    };
}

function getPublicBootstrapCacheControl(mode, partial) {
    if (partial) {
        return 'no-store, max-age=0';
    }
    if (mode === 'home_deferred') {
        return PUBLIC_BOOTSTRAP_HOME_DEFERRED_CACHE_CONTROL;
    }
    return mode === 'full'
        ? PUBLIC_BOOTSTRAP_FULL_CACHE_CONTROL
        : PUBLIC_BOOTSTRAP_HOME_CACHE_CONTROL;
}

async function readEdgeCache(request) {
    if (request.method !== 'GET') return null;
    return caches.default.match(new Request(request.url, { method: 'GET' }));
}

async function writeEdgeCache(request, response, ctx) {
    if (request.method !== 'GET' || response.status !== 200) return;
    ctx.waitUntil(caches.default.put(new Request(request.url, { method: 'GET' }), response.clone()));
}

const FALLBACK_BLOG_IMAGE_COUNT = 82;

function getFallbackBlogImageUrl(slug = 'blog') {
    const source = String(slug || 'blog');
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = source.charCodeAt(index) + ((hash << 5) - hash);
    }
    const imageIndex = (Math.abs(hash) % FALLBACK_BLOG_IMAGE_COUNT) + 1;
    return `${BASE_URL}/images/blog%20images/Blog%20Image%20${imageIndex}.webp`;
}

function getResolvedBlogImageUrl(post) {
    if (post?.image_path) {
        return getStorageUrl(post.image_path, 'blog-images');
    }
    return getFallbackBlogImageUrl(post?.slug || 'blog');
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            ...extraHeaders,
        },
    });
}

const SECURITY_RESPONSE_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'X-XSS-Protection': '0',
};

function withSecurityHeaders(response) {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
        headers.set(name, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function sanitizeMonitorValue(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).slice(0, 4000);
}

const MONITORING_PREFIX = 'monitoring-errors/';
const MONITORING_METRIC_PREFIX = 'monitoring-metrics/';
const MONITORING_META_PREFIX = `${MONITORING_PREFIX}_meta/`;
const MONITORING_RETENTION_STATE_KEY = `${MONITORING_META_PREFIX}retention-state.json`;
const DEFAULT_MONITORING_RETENTION_DAYS = 14;
const DEFAULT_MONITORING_RECENT_DAYS = 7;
const DEFAULT_MONITORING_LOG_LIMIT = 20;
const DEFAULT_PUBLIC_METRIC_SAMPLE_RATE = 1;
const MAX_MONITORING_RETENTION_DAYS = 90;
const MAX_MONITORING_RECENT_DAYS = 30;
const MAX_MONITORING_LOG_LIMIT = 100;
const MAX_MONITORING_SCAN_OBJECTS = 500;
const MAX_MONITORING_METRIC_SCAN_OBJECTS = 4000;
const MONITORING_RETENTION_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MONITORING_RETENTION_KICKOFF_INTERVAL_MS = 30 * 60 * 1000;
let lastMonitoringRetentionKickoffAt = 0;

function clampInteger(value, min, max, fallback) {
    const numeric = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function getMonitoringRetentionDays(env) {
    return clampInteger(env?.MONITORING_RETENTION_DAYS, 1, MAX_MONITORING_RETENTION_DAYS, DEFAULT_MONITORING_RETENTION_DAYS);
}

function getPublicMetricSampleRate(env) {
    const rate = Number(env?.PUBLIC_METRIC_SAMPLE_RATE);
    if (!Number.isFinite(rate)) return DEFAULT_PUBLIC_METRIC_SAMPLE_RATE;
    return Math.max(0, Math.min(1, rate));
}

function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, deltaDays) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + deltaDays);
    return next;
}

function getMonitoringDayPrefix(date, prefix = MONITORING_PREFIX) {
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${prefix}${yyyy}/${mm}/${dd}/`;
}

function extractMonitoringDateFromKey(key) {
    const match = String(key || '').match(/^monitoring-(?:errors|metrics)\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (!match) return null;
    const [, yyyy, mm, dd] = match;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function getRecentMonitoringPrefixes(days, prefix = MONITORING_PREFIX) {
    const prefixes = [];
    const today = startOfUtcDay(new Date());
    for (let offset = 0; offset < days; offset += 1) {
        prefixes.push(getMonitoringDayPrefix(addUtcDays(today, -offset), prefix));
    }
    return prefixes;
}

async function readMonitoringRetentionState(env) {
    if (!env?.R2_IMAGES) return null;
    try {
        const object = await env.R2_IMAGES.get(MONITORING_RETENTION_STATE_KEY);
        if (!object) return null;
        const raw = await object.text();
        const parsed = JSON.parse(raw);
        return {
            last_run_at: parsed?.last_run_at || null,
            last_reason: parsed?.last_reason || null,
            last_status: parsed?.last_status || 'idle',
            days_to_keep: clampInteger(parsed?.days_to_keep, 1, MAX_MONITORING_RETENTION_DAYS, getMonitoringRetentionDays(env)),
            matched_count: Number(parsed?.matched_count || 0),
            deleted_count: Number(parsed?.deleted_count || 0),
            deleted_keys_sample: Array.isArray(parsed?.deleted_keys_sample) ? parsed.deleted_keys_sample.slice(0, 10) : [],
            error_message: parsed?.error_message || null,
        };
    } catch (error) {
        console.error('[worker] Failed to read monitoring retention state:', error);
        return null;
    }
}

async function writeMonitoringRetentionState(env, payload) {
    if (!env?.R2_IMAGES) return null;
    const state = {
        last_run_at: payload?.last_run_at || null,
        last_reason: payload?.last_reason || null,
        last_status: payload?.last_status || 'idle',
        days_to_keep: clampInteger(payload?.days_to_keep, 1, MAX_MONITORING_RETENTION_DAYS, getMonitoringRetentionDays(env)),
        matched_count: Number(payload?.matched_count || 0),
        deleted_count: Number(payload?.deleted_count || 0),
        deleted_keys_sample: Array.isArray(payload?.deleted_keys_sample) ? payload.deleted_keys_sample.slice(0, 10) : [],
        error_message: payload?.error_message || null,
    };
    await env.R2_IMAGES.put(MONITORING_RETENTION_STATE_KEY, JSON.stringify(state, null, 2), {
        httpMetadata: {
            contentType: 'application/json;charset=UTF-8',
            cacheControl: 'no-store',
        },
    });
    return state;
}

async function writeMonitorEvent(env, prefix, channel, payload) {
    if (!env?.R2_IMAGES) return;
    try {
        const now = new Date();
        const yyyy = String(now.getUTCFullYear());
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        const stamp = now.toISOString().replace(/[:.]/g, '-');
        const randomId = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        const safeChannel = String(channel || 'unknown').replace(/[^a-z0-9/_-]+/gi, '-');
        const key = `${prefix}${yyyy}/${mm}/${dd}/${safeChannel}/${stamp}-${randomId}.json`;
        await env.R2_IMAGES.put(
            key,
            JSON.stringify({
                recorded_at: now.toISOString(),
                channel: safeChannel,
                ...payload,
            }, null, 2),
            {
                httpMetadata: {
                    contentType: 'application/json;charset=UTF-8',
                    cacheControl: 'no-store',
                },
            }
        );
    } catch (error) {
        console.error('[worker] Failed to persist monitor event:', error);
    }
}

async function writePrivateMonitorEvent(env, channel, payload) {
    return writeMonitorEvent(env, MONITORING_PREFIX, channel, payload);
}

async function writePrivateMetricEvent(env, channel, payload) {
    return writeMonitorEvent(env, MONITORING_METRIC_PREFIX, channel, payload);
}

async function listRecentMonitoringLogs(env, options = {}) {
    const limit = clampInteger(options?.limit, 1, MAX_MONITORING_LOG_LIMIT, DEFAULT_MONITORING_LOG_LIMIT);
    const days = clampInteger(options?.days, 1, MAX_MONITORING_RECENT_DAYS, DEFAULT_MONITORING_RECENT_DAYS);
    const prefixes = getRecentMonitoringPrefixes(days);
    const descriptors = [];
    let scannedObjects = 0;
    let hasMore = false;

    for (const prefix of prefixes) {
        let cursor = undefined;
        do {
            const listed = await env.R2_IMAGES.list({
                prefix,
                cursor,
                limit: 1000,
            });
            cursor = listed.truncated ? listed.cursor : undefined;
            scannedObjects += listed.objects.length;
            for (const object of listed.objects) {
                descriptors.push({
                    key: object.key,
                    uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
                });
            }
            if (scannedObjects >= MAX_MONITORING_SCAN_OBJECTS) {
                hasMore = true;
                cursor = undefined;
                break;
            }
        } while (cursor);

        if (hasMore) break;
    }

    const sorted = descriptors
        .sort((a, b) => String(b.key).localeCompare(String(a.key)))
        .slice(0, limit);

    const logs = [];
    for (const descriptor of sorted) {
        const object = await env.R2_IMAGES.get(descriptor.key);
        if (!object) continue;
        try {
            const payload = JSON.parse(await object.text());
            logs.push({
                key: descriptor.key,
                recorded_at: payload?.recorded_at || descriptor.uploaded || new Date().toISOString(),
                channel: payload?.channel || 'unknown',
                type: payload?.type || '',
                message: payload?.message || '',
                context: payload?.context || '',
                path: payload?.path || '',
                href: payload?.href || '',
                resource: payload?.resource || '',
                source: payload?.source || '',
                status: payload?.status || undefined,
                cf_ray: payload?.cf_ray || '',
                user_agent: payload?.user_agent || '',
                body_preview: payload?.body_preview || '',
                details: payload?.details || '',
                stack: payload?.stack || '',
            });
        } catch (error) {
            logs.push({
                key: descriptor.key,
                recorded_at: descriptor.uploaded || new Date().toISOString(),
                channel: 'invalid-json',
                message: `Could not parse log payload: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }

    return {
        logs,
        limit,
        days,
        scanned_prefixes: prefixes.length,
        scanned_objects: scannedObjects,
        has_more: hasMore,
        retention: await readMonitoringRetentionState(env),
    };
}

function toFiniteMetricNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toMetricInteger(value) {
    const numeric = toFiniteMetricNumber(value);
    return numeric === null ? null : Math.max(0, Math.round(numeric));
}

function createObservabilityMetricAccumulator(endpoint = '', resource = '') {
    return {
        endpoint,
        resource,
        request_count: 0,
        cache_hits: 0,
        cache_misses: 0,
        upstream_timeouts: 0,
        error_count: 0,
        partial_count: 0,
        last_seen_at: null,
        durations: [],
    };
}

function updateObservabilityMetricAccumulator(accumulator, payload) {
    accumulator.request_count += 1;
    if (payload?.cache_status === 'hit') {
        accumulator.cache_hits += 1;
    }
    if (payload?.cache_status === 'miss') {
        accumulator.cache_misses += 1;
    }
    if (payload?.upstream_timeout) {
        accumulator.upstream_timeouts += 1;
    }
    if (payload?.partial) {
        accumulator.partial_count += 1;
    }

    const responseStatus = toMetricInteger(payload?.response_status ?? payload?.status);
    if (responseStatus !== null && responseStatus >= 500) {
        accumulator.error_count += 1;
    }

    const durationMs = toMetricInteger(payload?.duration_ms);
    if (durationMs !== null) {
        accumulator.durations.push(durationMs);
    }

    const recordedAt = String(payload?.recorded_at || '').trim();
    if (recordedAt && (!accumulator.last_seen_at || recordedAt > accumulator.last_seen_at)) {
        accumulator.last_seen_at = recordedAt;
    }
}

function calculatePercent(numerator, denominator) {
    if (!denominator) return 0;
    return Number(((numerator / denominator) * 100).toFixed(1));
}

function calculatePercentile(sortedValues, percentile) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
    const bounded = Math.max(0, Math.min(1, Number(percentile) || 0));
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil(sortedValues.length * bounded) - 1)
    );
    return sortedValues[index];
}

function finalizeObservabilityMetricAccumulator(accumulator) {
    const durations = accumulator.durations
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    const requestCount = accumulator.request_count;
    return {
        endpoint: accumulator.endpoint || undefined,
        resource: accumulator.resource || undefined,
        request_count: requestCount,
        cache_hits: accumulator.cache_hits,
        cache_misses: accumulator.cache_misses,
        cache_hit_rate: calculatePercent(accumulator.cache_hits, requestCount),
        upstream_timeouts: accumulator.upstream_timeouts,
        upstream_timeout_rate: calculatePercent(accumulator.upstream_timeouts, requestCount),
        error_count: accumulator.error_count,
        error_rate: calculatePercent(accumulator.error_count, requestCount),
        partial_count: accumulator.partial_count,
        partial_rate: calculatePercent(accumulator.partial_count, requestCount),
        p50_ms: calculatePercentile(durations, 0.5),
        p95_ms: calculatePercentile(durations, 0.95),
        max_ms: durations.length > 0 ? durations[durations.length - 1] : null,
        last_seen_at: accumulator.last_seen_at,
    };
}

async function listRecentMonitoringMetricSummary(env, options = {}) {
    const days = clampInteger(options?.days, 1, MAX_MONITORING_RECENT_DAYS, DEFAULT_MONITORING_RECENT_DAYS);
    const prefixes = getRecentMonitoringPrefixes(days, MONITORING_METRIC_PREFIX);
    const descriptors = [];
    let scannedObjects = 0;
    let hasMore = false;

    for (const prefix of prefixes) {
        let cursor = undefined;
        do {
            const listed = await env.R2_IMAGES.list({
                prefix,
                cursor,
                limit: 1000,
            });
            cursor = listed.truncated ? listed.cursor : undefined;
            scannedObjects += listed.objects.length;
            for (const object of listed.objects) {
                descriptors.push({
                    key: object.key,
                    uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
                });
            }
            if (scannedObjects >= MAX_MONITORING_METRIC_SCAN_OBJECTS) {
                hasMore = true;
                cursor = undefined;
                break;
            }
        } while (cursor);

        if (hasMore) break;
    }

    const totals = createObservabilityMetricAccumulator();
    const endpointAccumulators = new Map();

    const sortedDescriptors = descriptors.sort((a, b) => String(b.key).localeCompare(String(a.key)));
    for (const descriptor of sortedDescriptors) {
        const object = await env.R2_IMAGES.get(descriptor.key);
        if (!object) continue;

        try {
            const payload = JSON.parse(await object.text());
            const endpoint = String(payload?.endpoint || '').trim();
            if (!endpoint) continue;

            payload.recorded_at = payload?.recorded_at || descriptor.uploaded || null;
            updateObservabilityMetricAccumulator(totals, payload);

            if (!endpointAccumulators.has(endpoint)) {
                endpointAccumulators.set(
                    endpoint,
                    createObservabilityMetricAccumulator(endpoint, String(payload?.resource || '').trim())
                );
            }
            updateObservabilityMetricAccumulator(endpointAccumulators.get(endpoint), payload);
        } catch (error) {
            console.warn('[worker] Failed to parse monitoring metric event:', error);
        }
    }

    const endpoints = Array.from(endpointAccumulators.values())
        .map(finalizeObservabilityMetricAccumulator)
        .sort((a, b) => {
            const p95Diff = (b.p95_ms || 0) - (a.p95_ms || 0);
            if (p95Diff !== 0) return p95Diff;
            const timeoutDiff = b.upstream_timeouts - a.upstream_timeouts;
            if (timeoutDiff !== 0) return timeoutDiff;
            return b.request_count - a.request_count;
        });

    return {
        generated_at: new Date().toISOString(),
        days,
        scanned_prefixes: prefixes.length,
        scanned_objects: scannedObjects,
        has_more: hasMore,
        totals: finalizeObservabilityMetricAccumulator(totals),
        endpoints,
    };
}

function queuePublicMetricEvent(env, ctx, payload) {
    if (!env?.R2_IMAGES || !ctx?.waitUntil) return;
    const sampleRate = getPublicMetricSampleRate(env);
    if (sampleRate <= 0) return;
    if (sampleRate < 1 && Math.random() > sampleRate) return;

    const durationMs = toMetricInteger(payload?.duration_ms);
    const responseStatus = toMetricInteger(payload?.response_status);
    const upstreamTimeoutCount = toMetricInteger(payload?.upstream_timeout_count);
    const missingSourceCount = toMetricInteger(payload?.missing_source_count);

    ctx.waitUntil(writePrivateMetricEvent(env, 'public-endpoint/request', {
        endpoint: sanitizeMonitorValue(payload?.endpoint || ''),
        resource: sanitizeMonitorValue(payload?.resource || ''),
        mode: sanitizeMonitorValue(payload?.mode || ''),
        cache_status: sanitizeMonitorValue(payload?.cache_status || ''),
        response_status: responseStatus === null ? undefined : responseStatus,
        duration_ms: durationMs === null ? undefined : durationMs,
        upstream_timeout: Boolean(payload?.upstream_timeout),
        upstream_timeout_count: upstreamTimeoutCount === null ? undefined : upstreamTimeoutCount,
        partial: Boolean(payload?.partial),
        missing_source_count: missingSourceCount === null ? undefined : missingSourceCount,
        missing_sources: sanitizeMonitorValue(payload?.missing_sources || ''),
        timed_out_sources: sanitizeMonitorValue(payload?.timed_out_sources || ''),
        sample_rate: sampleRate,
    }));

    if (Date.now() - lastMonitoringRetentionKickoffAt >= MONITORING_RETENTION_KICKOFF_INTERVAL_MS) {
        lastMonitoringRetentionKickoffAt = Date.now();
        maybeRunMonitoringRetention(env, ctx, 'public-metric-sampled');
    }
}

async function deleteMonitoringKeys(env, keys) {
    const batchSize = 50;
    for (let index = 0; index < keys.length; index += batchSize) {
        const chunk = keys.slice(index, index + batchSize);
        await Promise.all(chunk.map((key) => env.R2_IMAGES.delete(key)));
    }
}

async function cleanupMonitoringLogs(env, options = {}) {
    const daysToKeep = clampInteger(options?.daysToKeep, 1, MAX_MONITORING_RETENTION_DAYS, getMonitoringRetentionDays(env));
    const dryRun = Boolean(options?.dryRun);
    const reason = String(options?.reason || 'manual');
    const keepFrom = startOfUtcDay(addUtcDays(new Date(), -(daysToKeep - 1)));
    const matchedKeys = [];
    let scannedObjects = 0;
    const prefixesToScan = [MONITORING_PREFIX, MONITORING_METRIC_PREFIX];

    for (const prefix of prefixesToScan) {
        let cursor = undefined;
        do {
            const listed = await env.R2_IMAGES.list({
                prefix,
                cursor,
                limit: 1000,
            });
            cursor = listed.truncated ? listed.cursor : undefined;
            for (const object of listed.objects) {
                scannedObjects += 1;
                if (object.key.startsWith(MONITORING_META_PREFIX)) continue;
                const objectDate = extractMonitoringDateFromKey(object.key);
                if (objectDate && objectDate < keepFrom) {
                    matchedKeys.push(object.key);
                }
            }
        } while (cursor);
    }

    if (!dryRun && matchedKeys.length > 0) {
        await deleteMonitoringKeys(env, matchedKeys);
    }

    const retention = !dryRun
        ? await writeMonitoringRetentionState(env, {
            last_run_at: new Date().toISOString(),
            last_reason: reason,
            last_status: 'completed',
            days_to_keep: daysToKeep,
            matched_count: matchedKeys.length,
            deleted_count: dryRun ? 0 : matchedKeys.length,
            deleted_keys_sample: matchedKeys.slice(0, 10),
            error_message: null,
        })
        : (await readMonitoringRetentionState(env)) || {
            last_run_at: null,
            last_reason: null,
            last_status: 'idle',
            days_to_keep: daysToKeep,
            matched_count: 0,
            deleted_count: 0,
            deleted_keys_sample: [],
            error_message: null,
        };

    return {
        dry_run: dryRun,
        days_to_keep: daysToKeep,
        cutoff_iso: keepFrom.toISOString(),
        scanned_prefixes: prefixesToScan.length,
        scanned_objects: scannedObjects,
        matched_count: matchedKeys.length,
        deleted_count: dryRun ? 0 : matchedKeys.length,
        deleted_keys_sample: matchedKeys.slice(0, 10),
        retention,
    };
}

function maybeRunMonitoringRetention(env, ctx, reason = 'implicit') {
    if (!env?.R2_IMAGES || !ctx?.waitUntil) return;
    ctx.waitUntil((async () => {
        const existing = await readMonitoringRetentionState(env);
        const lastRunAt = existing?.last_run_at ? Date.parse(existing.last_run_at) : 0;
        if (Number.isFinite(lastRunAt) && lastRunAt > 0 && Date.now() - lastRunAt < MONITORING_RETENTION_INTERVAL_MS) {
            return;
        }

        try {
            await writeMonitoringRetentionState(env, {
                last_run_at: new Date().toISOString(),
                last_reason: reason,
                last_status: 'running',
                days_to_keep: getMonitoringRetentionDays(env),
                matched_count: existing?.matched_count || 0,
                deleted_count: existing?.deleted_count || 0,
                deleted_keys_sample: existing?.deleted_keys_sample || [],
                error_message: null,
            });
            await cleanupMonitoringLogs(env, {
                daysToKeep: getMonitoringRetentionDays(env),
                dryRun: false,
                reason,
            });
        } catch (error) {
            await writeMonitoringRetentionState(env, {
                last_run_at: new Date().toISOString(),
                last_reason: reason,
                last_status: 'failed',
                days_to_keep: getMonitoringRetentionDays(env),
                matched_count: existing?.matched_count || 0,
                deleted_count: existing?.deleted_count || 0,
                deleted_keys_sample: existing?.deleted_keys_sample || [],
                error_message: sanitizeMonitorValue(error instanceof Error ? error.message : String(error)),
            });
        }
    })());
}

function readBearerToken(request) {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.toLowerCase().startsWith('bearer ')) return null;
    return auth.slice(7).trim() || null;
}

async function getAuthenticatedUser(token) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) return null;
    return res.json();
}

async function getCurrentUserRole(token, userId) {
    const endpoint = `${SUPABASE_URL}/rest/v1/patients?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`;
    const res = await fetch(endpoint, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.role || null;
}

function usesD1Backend(env) {
    return String(env?.DATA_BACKEND || '').toLowerCase() === 'd1';
}

function createPublicDataFetch(env) {
    if (!usesD1Backend(env)) return supabaseFetch;
    return async (endpoint) => {
        const result = await fetchD1PublicEndpoint(env, endpoint);
        return result.data;
    };
}

function d1AuthResult(session, allowedRoles = []) {
    const role = session.roles.find((candidate) => allowedRoles.includes(candidate))
        || session.roles[0]
        || 'customer';
    return {
        user: {
            id: session.user_id,
            email: session.email,
            name: session.display_name,
            avatar_url: session.avatar_url,
        },
        role,
        session,
    };
}

async function authorizeRequestByRole(request, allowedRoles, env) {
    if (usesD1Backend(env)) {
        try {
            const session = await requireRole(env.APP_DB, request, allowedRoles);
            if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
                await requireCsrf(env.APP_DB, request, session);
            }
            return d1AuthResult(session, allowedRoles);
        } catch (error) {
            return {
                error: jsonResponse(
                    { error: error instanceof Error ? error.message : 'Authentication failed.' },
                    Number(error?.status || 401),
                ),
            };
        }
    }

    const token = readBearerToken(request);
    if (!token) return { error: jsonResponse({ error: 'Missing bearer token.' }, 401) };

    const user = await getAuthenticatedUser(token);
    if (!user?.id) return { error: jsonResponse({ error: 'Invalid access token.' }, 401) };

    const role = await getCurrentUserRole(token, user.id);
    if (!allowedRoles.includes(role)) {
        return { error: jsonResponse({ error: 'Forbidden: insufficient role.' }, 403) };
    }

    return { user, role };
}

async function authorizeAuthenticatedRequest(request, env) {
    if (usesD1Backend(env)) {
        try {
            const session = await requireSession(env.APP_DB, request);
            if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
                await requireCsrf(env.APP_DB, request, session);
            }
            return d1AuthResult(session);
        } catch (error) {
            return {
                error: jsonResponse(
                    { error: error instanceof Error ? error.message : 'Authentication failed.' },
                    Number(error?.status || 401),
                ),
            };
        }
    }

    const token = readBearerToken(request);
    if (!token) return { error: jsonResponse({ error: 'Missing bearer token.' }, 401) };

    const user = await getAuthenticatedUser(token);
    if (!user?.id) return { error: jsonResponse({ error: 'Invalid access token.' }, 401) };

    return { user };
}

async function authorizeImageMutation(request, env) {
    return authorizeRequestByRole(request, ['admin', 'master_admin', 'doctor'], env);
}

async function authorizeObservabilityAccess(request, env) {
    return authorizeRequestByRole(request, ['admin', 'master_admin'], env);
}

async function authorizeAdminEditorAccess(request, env) {
    return authorizeRequestByRole(request, ['admin', 'master_admin'], env);
}

function normalizeObjectPath(value) {
    const path = String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();
    if (!path || path.includes('..')) return null;
    return path;
}

const ADMIN_EDITOR_DRAFTS_PREFIX = 'admin-editor-drafts/';
const MAX_ADMIN_EDITOR_DRAFT_BYTES = 2 * 1024 * 1024;
const PRODUCT_CONTENT_REVIEWS_PREFIX = 'admin-product-content-reviews/';
const MAX_PRODUCT_CONTENT_REVIEW_BYTES = 256 * 1024;
const PRODUCT_CONTENT_REVIEW_STATUSES = new Set([
    'needs_review',
    'in_review',
    'rewrite_requested',
    'approved',
]);

function buildAdminEditorDraftObjectKey(userId, draftKey) {
    const rawKey = String(draftKey || '').trim();
    if (!rawKey || rawKey.length > 180 || rawKey.includes('..')) return null;
    return `${ADMIN_EDITOR_DRAFTS_PREFIX}${userId}/${encodeURIComponent(rawKey)}.json`;
}

function parseDraftSavedAt(value) {
    const parsed = new Date(String(value || ''));
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
}

function buildAdminDraftResponse(draftKey, payload) {
    return {
        draft: payload ? {
            draft_key: draftKey,
            saved_at: payload.saved_at || new Date().toISOString(),
            data: payload.data ?? null,
            updated_by: payload.updated_by || '',
            source: 'server',
        } : null,
    };
}

function buildProductContentReviewObjectKey(productId) {
    const normalizedId = Number(productId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) return null;
    return `${PRODUCT_CONTENT_REVIEWS_PREFIX}${normalizedId}.json`;
}

function normalizeProductContentReviewIssues(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((issue) => ({
            code: String(issue?.code || '').trim().slice(0, 120),
            field: String(issue?.field || '').trim().slice(0, 80),
            severity: issue?.severity === 'blocker' ? 'blocker' : 'warning',
            message: String(issue?.message || '').trim().slice(0, 500),
        }))
        .filter((issue) => issue.code && issue.field && issue.message)
        .slice(0, 24);
}

function normalizeProductContentReviewRecord(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const productId = Number(payload.product_id);
    if (!Number.isInteger(productId) || productId <= 0) return null;
    const reviewStatus = PRODUCT_CONTENT_REVIEW_STATUSES.has(payload.review_status)
        ? payload.review_status
        : 'needs_review';

    return {
        product_id: productId,
        review_status: reviewStatus,
        review_notes: String(payload.review_notes || '').trim().slice(0, 4000),
        rewrite_brief: String(payload.rewrite_brief || '').trim().slice(0, 4000),
        audit_score: Math.max(0, Math.min(100, Math.round(Number(payload.audit_score || 0)))),
        blocker_count: Math.max(0, Math.min(50, Math.round(Number(payload.blocker_count || 0)))),
        warning_count: Math.max(0, Math.min(50, Math.round(Number(payload.warning_count || 0)))),
        issues: normalizeProductContentReviewIssues(payload.issues),
        content_signature: String(payload.content_signature || '').trim().slice(0, 160),
        reviewed_at: parseDraftSavedAt(payload.reviewed_at),
        reviewed_by: String(payload.reviewed_by || '').trim(),
        reviewed_by_label: String(payload.reviewed_by_label || '').trim().slice(0, 255),
        updated_at: parseDraftSavedAt(payload.updated_at || payload.reviewed_at),
    };
}

function parseProductContentReviewIds(url) {
    const rawIds = String(url.searchParams.get('productIds') || url.searchParams.get('productId') || '')
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    return Array.from(new Set(rawIds)).slice(0, 120);
}

async function supabaseFetch(endpoint, options = {}) {
    const result = await supabaseFetchWithMeta(endpoint, options);
    return result.data;
}

async function supabaseFetchWithMeta(endpoint, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort('supabase fetch timeout');
    }, timeoutMs);
    try {
        const response = await fetch(buildSupabaseRestUrl(endpoint), {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            if (!supabaseFetchFailureOnce.has(endpoint)) {
                supabaseFetchFailureOnce.add(endpoint);
                const errorText = await response.text().catch(() => '');
                console.error('[worker] Supabase fetch failed:', {
                    endpoint,
                    status: response.status,
                    body: errorText.slice(0, 500),
                });
            }
            return {
                data: null,
                status: response.status,
                duration_ms: Date.now() - startedAt,
                timed_out: false,
                error_message: `Supabase responded with status ${response.status}`,
            };
        }
        return {
            data: await response.json(),
            status: response.status,
            duration_ms: Date.now() - startedAt,
            timed_out: false,
            error_message: '',
        };
    } catch (error) {
        if (!supabaseFetchFailureOnce.has(endpoint)) {
            supabaseFetchFailureOnce.add(endpoint);
            console.error('[worker] Supabase fetch threw:', {
                endpoint,
                message: error instanceof Error ? error.message : String(error),
            });
        }
        const didTimeout = timedOut || (error instanceof Error && error.name === 'AbortError');
        return {
            data: null,
            status: didTimeout ? 504 : undefined,
            duration_ms: Date.now() - startedAt,
            timed_out: didTimeout,
            error_message: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============================================================
// OG HTML — For social sharing bots
// ============================================================
function generateOGHtml({
    title,
    description,
    image,
    canonicalUrl,
    path,
    lang = 'vi',
    type = 'website',
    imageAlt,
    noindex = false,
    keywords,
    author,
    publishedTime,
    modifiedTime,
    section,
    tags,
    price,
    currency,
    availability,
    jsonLd = null,
    alternateLangs = SEO_LANGS,
}) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeCanonicalUrl = escapeHtml(canonicalUrl);

    return new Response(`<!DOCTYPE html>
<html lang="${HTML_LANG_BY_LANG[lang]}">
<head>
  ${renderSeoHead({
        lang,
        path,
        title,
        description,
        canonicalUrl,
        image,
        imageAlt,
        type,
        noindex,
        keywords,
        author,
        publishedTime,
        modifiedTime,
        section,
        tags,
        price,
        currency,
        availability,
        jsonLd,
        alternateLangs,
    })}
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDesc}</p>
    <p>Trang chuẩn: <a href="${safeCanonicalUrl}">${safeCanonicalUrl}</a></p>
  </main>
</body>
</html>`, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'X-Robots-Tag': buildRobotsContent(noindex),
            'Cache-Control': 'public, max-age=300',
        }
    });
}

function renderPrerenderLinkItems(items = []) {
    const cards = items
        .filter((item) => item?.href && item?.label)
        .map((item) => {
            const href = escapeAttr(item.href);
            const label = escapeHtml(item.label);
            const description = item.description ? `<p>${escapeHtml(item.description)}</p>` : '';
            const meta = item.meta ? `<p><small>${escapeHtml(item.meta)}</small></p>` : '';
            const image = item.image
                ? `<a href="${href}"><img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.imageAlt || item.label)}" loading="lazy" decoding="async"></a>`
                : '';
            return `<li><article>${image}<h3><a href="${href}">${label}</a></h3>${meta}${description}</article></li>`;
        })
        .join('');

    if (!cards) return '';
    return `<ul>${cards}</ul>`;
}

function renderFactList(facts = []) {
    const rows = facts
        .filter((fact) => fact?.label && fact?.value)
        .map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`)
        .join('');
    if (!rows) return '';
    return `<section><h2>Thông tin chính</h2><dl>${rows}</dl></section>`;
}

function renderContentSections(sections = []) {
    return sections
        .filter((section) => section?.title && (section.html || (section.links || []).length > 0))
        .map((section) => {
            const description = section.description ? `<p>${escapeHtml(section.description)}</p>` : '';
            const html = section.html || '';
            const links = renderPrerenderLinkItems(section.links || []);
            return `<section><h2>${escapeHtml(section.title)}</h2>${description}${html}${links}</section>`;
        })
        .join('');
}

function generatePrerenderListHtml({
    lang = 'vi',
    title,
    description,
    path,
    heading,
    intro,
    sections,
    image = DEFAULT_SHARE_IMAGE,
    imageAlt,
    noindex = false,
    breadcrumbItems = [],
    jsonLd = null,
    alternateLangs = SEO_LANGS,
}) {
    const canonicalUrl = buildAbsoluteUrl(path, lang);
    const breadcrumbId = breadcrumbItems.length > 1 ? `${canonicalUrl}#breadcrumb` : null;
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeHeading = escapeHtml(heading);
    const safeIntro = escapeHtml(intro || '');

    const sectionHtml = (sections || [])
        .map((section) => {
            const safeSectionTitle = escapeHtml(section.title || '');
            const sectionDescription = section.description ? `<p>${escapeHtml(section.description)}</p>` : '';
            const linksHtml = renderPrerenderLinkItems(section.links || []);
            return `<section><h2>${safeSectionTitle}</h2>${sectionDescription}${linksHtml}</section>`;
        })
        .join('');

    const schemaPayload = [];
    if (breadcrumbItems.length > 1) {
        schemaPayload.push(createBreadcrumbJsonLd(breadcrumbItems, breadcrumbId));
    }
    schemaPayload.push(buildWebPageJsonLd({
        canonicalUrl,
        title,
        description,
        image,
        imageAlt: imageAlt || heading,
        lang,
        breadcrumbId,
    }));
    if (jsonLd) {
        if (Array.isArray(jsonLd)) {
            schemaPayload.push(...jsonLd);
        } else {
            schemaPayload.push(jsonLd);
        }
    }

    return new Response(`<!DOCTYPE html>
<html lang="${HTML_LANG_BY_LANG[lang]}">
<head>
  ${renderSeoHead({
        lang,
        path,
        title,
        description,
        canonicalUrl,
        image,
        imageAlt,
        type: 'website',
        noindex,
        jsonLd: schemaPayload,
        alternateLangs,
    })}
</head>
<body>
  <main>
    <h1>${safeHeading}</h1>
    <p>${safeIntro}</p>
    ${image ? `<figure><img src="${escapeAttr(image)}" alt="${escapeAttr(imageAlt || heading)}" loading="eager" decoding="async"><figcaption>${escapeHtml(imageAlt || heading)}</figcaption></figure>` : ''}
    ${sectionHtml}
  </main>
</body>
</html>`, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'X-Robots-Tag': buildRobotsContent(noindex),
            'Cache-Control': 'public, max-age=600',
        }
    });
}

function generateDetailPrerenderHtml({
    lang = 'vi',
    path,
    title,
    description,
    heading,
    intro,
    image = DEFAULT_SHARE_IMAGE,
    imageAlt,
    canonicalUrl,
    type = 'website',
    noindex = false,
    breadcrumbItems = [],
    jsonLd = null,
    facts = [],
    sections = [],
    keywords,
    author,
    publishedTime,
    modifiedTime,
    section,
    tags = [],
    price,
    currency = 'VND',
    availability,
    alternateLangs = SEO_LANGS,
}) {
    const schemaPayload = [];
    const breadcrumbId = breadcrumbItems.length > 1 ? `${canonicalUrl}#breadcrumb` : null;
    if (breadcrumbItems.length > 1) {
        schemaPayload.push(createBreadcrumbJsonLd(breadcrumbItems, breadcrumbId));
    }
    schemaPayload.push(buildWebPageJsonLd({
        canonicalUrl,
        title,
        description,
        image,
        imageAlt: imageAlt || heading,
        lang,
        breadcrumbId,
    }));
    if (jsonLd) {
        if (Array.isArray(jsonLd)) schemaPayload.push(...jsonLd);
        else schemaPayload.push(jsonLd);
    }

    return new Response(`<!DOCTYPE html>
<html lang="${HTML_LANG_BY_LANG[lang]}">
<head>
  ${renderSeoHead({
        lang,
        path,
        title,
        description,
        canonicalUrl,
        image,
        imageAlt,
        type,
        noindex,
        keywords,
        author,
        publishedTime,
        modifiedTime,
        section,
        tags,
        price,
        currency,
        availability,
        jsonLd: schemaPayload,
        alternateLangs,
    })}
</head>
<body>
  <main>
    <article>
      <header>
        <h1>${escapeHtml(heading)}</h1>
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ''}
      </header>
      ${image ? `<figure><img src="${escapeAttr(image)}" alt="${escapeAttr(imageAlt || heading)}" loading="eager" decoding="async"><figcaption>${escapeHtml(imageAlt || heading)}</figcaption></figure>` : ''}
      ${renderFactList(facts)}
      ${renderContentSections(sections)}
      <footer>
        <p>Trang chuẩn: <a href="${escapeAttr(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></p>
      </footer>
    </article>
  </main>
</body>
</html>`, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'X-Robots-Tag': buildRobotsContent(noindex),
            'Cache-Control': 'public, max-age=300',
        },
    });
}

// ============================================================
// Route Handlers (with JSON-LD Structured Data)
// ============================================================

async function getProductByIdOrSlug(idOrSlug, dataFetch = supabaseFetch) {
    // Support both numeric ID and slug
    const isNumeric = /^\d+$/.test(idOrSlug);
    if (isNumeric) {
        const data = await dataFetch(`products?id=eq.${idOrSlug}&is_published=eq.true&archived_at=is.null&select=${PRODUCT_CANONICAL_SELECT}&limit=1`);
        return data?.[0] || null;
    }

    return fetchFirstByVariants({
        table: 'products',
        field: 'slug',
        value: idOrSlug,
        extraFilters: '&is_published=eq.true&archived_at=is.null',
        select: PRODUCT_CANONICAL_SELECT,
        dataFetch,
    });
}

const PRODUCT_CANONICAL_SELECT = 'id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,long_description,price,stock_quantity,category_id,sku,usage_instructions,usage_instructions_en,usage_instructions_ru,usage_instructions_cn,ingredients,ingredients_en,ingredients_ru,ingredients_cn,key_benefits,key_benefits_en,key_benefits_ru,key_benefits_cn,skin_types,origin,origin_en,origin_ru,origin_cn,texture,texture_en,texture_ru,texture_cn,precautions,precautions_en,precautions_ru,precautions_cn,brand,vat_rate,faq_items,category:product_categories(slug)';

const LEGACY_PRODUCT_TOKEN_STOPWORDS = new Set([
    ...INTERNAL_LINK_STOPWORDS,
    'acid',
    'anti',
    'care',
    'chinh',
    'cream',
    'dich',
    'dung',
    'duong',
    'gel',
    'hang',
    'kem',
    'mat',
    'mun',
    'nam',
    'nuoc',
    'sau',
    'serum',
    'sua',
    'tri',
    'trang',
]);

const LEGACY_PRODUCT_HINT_TOKENS = new Set([
    'acid',
    'adapalene',
    'alhydran',
    'balm',
    'bioderma',
    'bot',
    'capsule',
    'capsules',
    'care',
    'cleanser',
    'cream',
    'differin',
    'dich',
    'dung',
    'duong',
    'gel',
    'hemptuary',
    'intelderm',
    'kem',
    'klenzit',
    'lotion',
    'mask',
    'mat',
    'moisturiser',
    'moisturizer',
    'mun',
    'nam',
    'niacinamide',
    'nuoc',
    'oil',
    'peel',
    'posay',
    'probiotics',
    'roche',
    'serum',
    'spray',
    'sua',
    'sunscreen',
    'tablet',
    'tablets',
    'tay',
    'theraphyto',
    'toner',
    'tranexamic',
    'tri',
    'trang',
    'vitamin',
]);

function getLegacyProductCandidateTokens(legacySlug) {
    const rawTokens = tokenizeSearchText(String(legacySlug || '').replace(/-/g, ' '));
    const preferredTokens = rawTokens
        .filter((token) => token.length > 3 && !/^\d+$/.test(token) && !LEGACY_PRODUCT_TOKEN_STOPWORDS.has(token));
    const fallbackTokens = rawTokens
        .filter((token) => token.length > 3 && !/^\d+$/.test(token));
    const tokens = preferredTokens.length > 0 ? preferredTokens : fallbackTokens;
    return [...new Set(tokens)]
        .sort((a, b) => b.length - a.length)
        .slice(0, 6);
}

async function getLegacyProductByTokenMatch(legacySlug, dataFetch = supabaseFetch) {
    const tokens = getLegacyProductCandidateTokens(legacySlug);
    if (!tokens.length) return null;

    const candidatesById = new Map();
    for (const token of tokens) {
        const rows = await dataFetch(
            `products?is_published=eq.true&archived_at=is.null&select=${PRODUCT_CANONICAL_SELECT}&or=(slug.ilike.*${token}*,name.ilike.*${token}*)&limit=24`,
        );
        for (const row of rows || []) {
            if (row?.id !== undefined && row?.id !== null) {
                candidatesById.set(row.id, row);
            }
        }
    }

    const candidates = [...candidatesById.values()];
    if (!candidates.length) return null;

    const minScore = tokens.length >= 5 ? 3 : 2;
    return rankRecordsByTokenOverlap(candidates, {
        sourceParts: [String(legacySlug || '').replace(/-/g, ' ')],
        getItemParts: (product) => [
            product.slug,
            product.name,
            product.brand,
            product.description,
        ],
        limit: 1,
        minScore,
    })[0] || null;
}

function isLikelyLegacyProductSlug(legacySlug) {
    const tokens = tokenizeSearchText(String(legacySlug || '').replace(/-/g, ' '));
    return tokens.some((token) => LEGACY_PRODUCT_HINT_TOKENS.has(token) || /[0-9]/.test(token));
}

function buildLegacyProductSearchRedirectUrl(url, legacySlug, lang = 'vi') {
    const nextUrl = new URL(url.toString());
    const searchTerm = tokenizeSearchText(String(legacySlug || '').replace(/-/g, ' ')).join(' ')
        || String(legacySlug || '').replace(/-/g, ' ').trim();

    nextUrl.pathname = '/san-pham';
    nextUrl.search = '';
    if (searchTerm) nextUrl.searchParams.set('tu-khoa', searchTerm);
    if (normalizeSeoLang(lang) !== 'vi') {
        nextUrl.searchParams.set('lang', normalizeSeoLang(lang));
    }
    return nextUrl.toString();
}

async function getCategorySlugById(categoryId, dataFetch = supabaseFetch) {
    if (categoryId === null || categoryId === undefined || categoryId === '') return 'khac';
    const data = await dataFetch(`product_categories?id=eq.${categoryId}&select=slug&limit=1`);
    return data?.[0]?.slug || 'khac';
}

async function getProductCategoryById(categoryId, dataFetch = supabaseFetch) {
    if (categoryId === null || categoryId === undefined || categoryId === '') return null;
    const data = await dataFetch(`product_categories?id=eq.${categoryId}&select=id,slug,name,name_en,name_ru,name_cn,description&limit=1`);
    return data?.[0] || null;
}

async function getBlogCategoryBySlug(categorySlug, dataFetch = supabaseFetch) {
    if (!categorySlug) return null;
    const data = await dataFetch(`blog_categories?slug=eq.${encodeURIComponent(categorySlug)}&select=slug,name,name_en,name_ru,name_cn&limit=1`);
    return data?.[0] || null;
}

async function getProductImages(productId, dataFetch = supabaseFetch) {
    if (!productId) return [];
    return (await dataFetch(`product_images?product_id=eq.${productId}&select=id,image_path,is_primary,display_order&order=is_primary.desc&order=display_order.asc&order=id.asc`)) || [];
}

async function getProductCategories(dataFetch = supabaseFetch) {
    return (await dataFetch('product_categories?select=id,name,name_en,name_ru,name_cn,description,slug&order=name.asc')) || [];
}

async function getProductBrands(dataFetch = supabaseFetch) {
    return (await dataFetch('product_brands?select=id,slug,name,description,logo_path&order=name.asc')) || [];
}

async function getProductList(limit = 24, categoryId = null, options = {}, dataFetch = supabaseFetch) {
    const { lang = 'vi', translationRequired = false } = options;
    const categoryFilter = categoryId === null || categoryId === undefined ? '' : `&category_id=eq.${categoryId}`;
    const requestedLang = normalizeSeoLang(lang);
    const fetchLimit = translationRequired && requestedLang !== 'vi'
        ? Math.max(limit * 12, 500)
        : limit;
    const rows = (await dataFetch(`products?is_published=eq.true&archived_at=is.null${categoryFilter}&select=id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,category_id,brand,category:product_categories(slug),images:product_images(image_path,is_primary,display_order)&order=id.desc&limit=${fetchLimit}`)) || [];
    if (!translationRequired || requestedLang === 'vi') return rows.slice(0, limit);
    return filterRecordsByRequiredLocale(rows, requestedLang, ['name', 'description']).slice(0, limit);
}

async function getProductsByBrandName(brandName, limit = 24, options = {}, dataFetch = supabaseFetch) {
    const { lang = 'vi', translationRequired = false } = options;
    const requestedLang = normalizeSeoLang(lang);
    const fetchLimit = translationRequired && requestedLang !== 'vi' ? 500 : 350;
    const rows = (await dataFetch(`products?is_published=eq.true&archived_at=is.null&select=id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,category_id,brand,images:product_images(image_path,is_primary,display_order),sold_count&order=sold_count.desc.nullslast,id.desc&limit=${fetchLimit}`)) || [];
    const brandKey = normalizeBrandMatchKey(brandName);
    const matchedRows = rows.filter((row) => normalizeBrandMatchKey(row.brand) === brandKey);
    if (!translationRequired || requestedLang === 'vi') return matchedRows.slice(0, limit);
    return filterRecordsByRequiredLocale(matchedRows, requestedLang, ['name', 'description']).slice(0, limit);
}

function getActiveBrandRows(brands, products) {
    const productsByBrandKey = products.reduce((acc, product) => {
        const brandKey = normalizeBrandMatchKey(product.brand);
        if (!brandKey) return acc;
        const current = acc.get(brandKey) || [];
        current.push(product);
        acc.set(brandKey, current);
        return acc;
    }, new Map());

    return brands
        .map((brand) => {
            const brandProducts = productsByBrandKey.get(normalizeBrandMatchKey(brand.name)) || [];
            return {
                ...brand,
                productCount: brandProducts.length,
                products: brandProducts,
            };
        })
        .filter((brand) => brand.productCount > 0);
}

async function getBlogCategories(dataFetch = supabaseFetch) {
    return (await dataFetch('blog_categories?select=slug,name,name_en,name_ru,name_cn&order=name.asc')) || [];
}

async function getBlogList(limit = 20, categorySlug = null, options = {}, dataFetch = supabaseFetch) {
    const { lang = 'vi', translationRequired = false } = options;
    const categoryFilter = categorySlug ? `&category_slug=eq.${encodeURIComponent(categorySlug)}` : '';
    const requestedLang = normalizeSeoLang(lang);
    const fetchLimit = translationRequired && requestedLang !== 'vi'
        ? Math.max(limit * 12, 500)
        : limit;
    const rows = (await dataFetch(`public_blog_posts?select=slug,title,title_en,title_ru,title_cn,summary,summary_en,summary_ru,summary_cn,meta_description,meta_keywords,canonical_url,local_seo_tags,date,category_slug,image_path&order=date.desc&limit=${fetchLimit}${categoryFilter}`)) || [];
    const visibleRows = rows.filter((row) => !isExcludedBlogSlug(row.slug));
    if (!translationRequired || requestedLang === 'vi') return visibleRows.slice(0, limit);
    return filterRecordsByRequiredLocale(visibleRows, requestedLang, ['title', 'summary']).slice(0, limit);
}

async function getServiceList(limit = 20, dataFetch = supabaseFetch) {
    return (await dataFetch(`services?select=id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,image_path,benefits,benefits_en,benefits_ru,benefits_cn,local_seo_tags&order=id.asc&limit=${limit}`)) || [];
}

async function getAboutContent(dataFetch = supabaseFetch) {
    const data = await dataFetch('about_page_content?select=header_title,header_title_en,header_title_ru,header_title_cn,header_subtitle,header_subtitle_en,header_subtitle_ru,header_subtitle_cn&limit=1');
    return data?.[0] || null;
}

async function getDoctors(limit = 6, dataFetch = supabaseFetch) {
    let doctorsData = await dataFetch(`public_doctors_directory?select=id,name,avatar_path,job_title,job_title_en,job_title_ru,job_title_cn,specialization,specialization_en,specialization_ru,specialization_cn,homepage_description,homepage_description_en,homepage_description_ru,homepage_description_cn&limit=${limit}`);

    if (!Array.isArray(doctorsData) || doctorsData.length === 0) {
        doctorsData = await dataFetch(`patients?select=id,name,avatar_path,doctors(job_title,job_title_en,job_title_ru,job_title_cn,specialization,specialization_en,specialization_ru,specialization_cn,homepage_description,homepage_description_en,homepage_description_ru,homepage_description_cn)&role=in.(doctor,admin,master_admin)&limit=${limit}`);
    }

    return (doctorsData || [])
        .map((row) => {
            const profile = Array.isArray(row.doctors) ? row.doctors[0] : row.doctors;
            return {
                id: row.id,
                name: row.name,
                avatar_path: row.avatar_path,
                job_title: row.job_title || profile?.job_title || '',
                job_title_en: row.job_title_en || profile?.job_title_en || '',
                job_title_ru: row.job_title_ru || profile?.job_title_ru || '',
                job_title_cn: row.job_title_cn || profile?.job_title_cn || '',
                specialization: row.specialization || profile?.specialization || '',
                specialization_en: row.specialization_en || profile?.specialization_en || '',
                specialization_ru: row.specialization_ru || profile?.specialization_ru || '',
                specialization_cn: row.specialization_cn || profile?.specialization_cn || '',
                homepage_description: row.homepage_description || profile?.homepage_description || '',
                homepage_description_en: row.homepage_description_en || profile?.homepage_description_en || '',
                homepage_description_ru: row.homepage_description_ru || profile?.homepage_description_ru || '',
                homepage_description_cn: row.homepage_description_cn || profile?.homepage_description_cn || '',
            };
        })
        .filter((doctor) => doctor.name);
}

async function getFaqItems(limit = 10, dataFetch = supabaseFetch) {
    return (await dataFetch(`faq_items?select=question,question_en,question_ru,question_cn,answer,answer_en,answer_ru,answer_cn&order=id.asc&limit=${limit}`)) || [];
}

async function getProductReviewSchemaData(productId, dataFetch = supabaseFetch) {
    const reviews = await dataFetch(`public_product_reviews?product_id=eq.${productId}&verified_purchase=is.true&select=rating,title,comment,created_at,author_name,verified_purchase&order=created_at.desc&limit=5`);
    if (!reviews || reviews.length === 0) {
        return { aggregate: null, reviews: [] };
    }
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return {
        aggregate: {
            ratingValue: (total / reviews.length).toFixed(1),
            reviewCount: reviews.length,
        },
        reviews: reviews
            .filter((review) => review.comment || review.title)
            .map((review) => ({
                '@type': 'Review',
                author: {
                    '@type': 'Person',
                    name: review.author_name || 'Khách hàng',
                },
                datePublished: review.created_at || undefined,
                name: review.title || undefined,
                reviewBody: review.comment || undefined,
                reviewRating: {
                    '@type': 'Rating',
                    ratingValue: Number(review.rating || 0),
                    bestRating: 5,
                    worstRating: 1,
                },
            })),
    };
}

function getPrimaryProductImageUrl(images = []) {
    if (!Array.isArray(images) || images.length === 0) return null;
    const sorted = [...images].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return Number(a.id || 0) - Number(b.id || 0);
    });
    const path = sorted[0]?.image_path;
    return path ? getStorageUrl(path, 'product-images') : null;
}

function getListingImageUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
        const url = new URL(String(imageUrl), BASE_URL);
        url.searchParams.set('seo_context', 'listing-thumb');
        url.searchParams.set('w', '480');
        return url.toString();
    } catch {
        return imageUrl;
    }
}

async function getBlogPostBySlug(slug, dataFetch = supabaseFetch) {
    if (isExcludedBlogSlug(slug)) return null;
    return fetchFirstByVariants({
        table: 'public_blog_posts',
        field: 'slug',
        value: slug,
        select: 'slug,title,title_en,title_ru,title_cn,summary,summary_en,summary_ru,summary_cn,content,content_en,content_ru,content_cn,meta_description,meta_keywords,canonical_url,local_seo_tags,image_path,date,author_id,author_public_id,author_name,author_avatar_path,category_slug',
        dataFetch,
    });
}

async function getServiceByIdOrSlug(idOrSlug, dataFetch = supabaseFetch) {
    const isNumeric = /^\d+$/.test(String(idOrSlug));
    const select = 'id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,long_description,long_description_en,long_description_ru,long_description_cn,benefits,benefits_en,benefits_ru,benefits_cn,local_seo_tags,image_path,price,faq_items,procedure_steps(id,step_number,title,title_en,title_ru,title_cn,description,description_en,description_ru,description_cn,image_path)';
    let service = null;
    if (isNumeric) {
        const data = await dataFetch(`services?id=eq.${idOrSlug}&select=${select}&limit=1`);
        service = data?.[0] || null;
    } else {
        service = await fetchFirstByVariants({
            table: 'services',
            field: 'slug',
            value: idOrSlug,
            select,
            dataFetch,
        });
    }
    if (service?.procedure_steps) {
        service.procedure_steps = [...service.procedure_steps].sort((a, b) => (a.step_number || 0) - (b.step_number || 0));
    }
    return service;
}

function buildStockLabel(stockQuantity, lang = 'vi') {
    return Number(stockQuantity || 0) > 0
        ? getLocalizedLabel({ vi: 'Còn hàng', en: 'In stock', ru: 'В наличии', cn: '有库存' }, lang)
        : getLocalizedLabel({ vi: 'Tạm hết hàng', en: 'Out of stock', ru: 'Нет в наличии', cn: '暂时缺货' }, lang);
}

function buildKeywordTerms({ metaKeywords = '', title = '', categoryName = '', summary = '', content = '' } = {}) {
    const directKeywords = String(metaKeywords || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const derivedTokens = tokenizeSearchText([
        title,
        categoryName,
        summary,
        stripHtml(content || '').slice(0, 2000),
    ].join(' '))
        .filter((token) => token.length >= 3);

    const unique = [];
    const push = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        if (unique.some((item) => item.toLowerCase() === normalized.toLowerCase())) return;
        unique.push(normalized);
    };

    directKeywords.forEach(push);
    derivedTokens.forEach(push);
    return unique.slice(0, 18);
}

function buildReviewSection(reviewSchemaData, lang = 'vi') {
    if (!reviewSchemaData?.aggregate && (!reviewSchemaData?.reviews || reviewSchemaData.reviews.length === 0)) return null;
    const summaryBits = [];
    if (reviewSchemaData.aggregate) {
        summaryBits.push(
            getLocalizedLabel({
                vi: `Đánh giá trung bình ${reviewSchemaData.aggregate.ratingValue}/5 từ ${reviewSchemaData.aggregate.reviewCount} lượt nhận xét.`,
                en: `Average rating ${reviewSchemaData.aggregate.ratingValue}/5 from ${reviewSchemaData.aggregate.reviewCount} reviews.`,
                ru: `Средняя оценка ${reviewSchemaData.aggregate.ratingValue}/5 по ${reviewSchemaData.aggregate.reviewCount} отзывам.`,
                cn: `平均评分 ${reviewSchemaData.aggregate.ratingValue}/5，共 ${reviewSchemaData.aggregate.reviewCount} 条评价。`,
            }, lang)
        );
    }

    const reviewsHtml = (reviewSchemaData.reviews || [])
        .slice(0, 3)
        .map((review) => {
            const title = review.name ? `<h3>${escapeHtml(review.name)}</h3>` : '';
            const body = review.reviewBody ? `<p>${escapeHtml(review.reviewBody)}</p>` : '';
            const meta = `<p><small>${escapeHtml(review.author?.name || review.author?.['name'] || 'Khách hàng')} • ${escapeHtml(String(review.reviewRating?.ratingValue || ''))}/5</small></p>`;
            return `<article>${title}${meta}${body}</article>`;
        })
        .join('');

    return {
        title: getLocalizedLabel({ vi: 'Đánh giá khách hàng', en: 'Customer reviews', ru: 'Отзывы клиентов', cn: '用户评价' }, lang),
        html: `${summaryBits.length > 0 ? `<p>${escapeHtml(summaryBits.join(' '))}</p>` : ''}${reviewsHtml}`,
    };
}

function getProductPathByCategorySlug(categorySlug, slugOrId) {
    return `/san-pham/${categorySlug || 'khac'}/${slugOrId}`;
}

function getBlogPathByCategorySlug(categorySlug, slug) {
    return `/kien-thuc/${categorySlug || 'tong-hop'}/${slug}`;
}

function getServicePath(service) {
    return `/dich-vu/${service.slug || service.id}`;
}

function buildBrandFilteredCatalogUrl(brandSlug, lang = 'vi', categorySlug = null) {
    const basePath = categorySlug ? `/san-pham/${categorySlug}` : '/san-pham';
    const query = new URLSearchParams();
    if (lang !== 'vi') query.set('lang', lang);
    query.set('brand', brandSlug);
    const suffix = query.toString();
    return `${BASE_URL}${basePath}${suffix ? `?${suffix}` : ''}`;
}

async function getProductCanonicalRoute(idOrSlug, requestedLang = 'vi', dataFetch = supabaseFetch) {
    const product = await getProductByIdOrSlug(idOrSlug, dataFetch);
    if (!product) return null;
    return buildProductCanonicalRoute(product, requestedLang, dataFetch);
}

async function getLegacyProductCanonicalRoute(idOrSlug, requestedLang = 'vi', dataFetch = supabaseFetch) {
    const exactRoute = await getProductCanonicalRoute(idOrSlug, requestedLang, dataFetch);
    if (exactRoute) return exactRoute;

    const product = await getLegacyProductByTokenMatch(idOrSlug, dataFetch);
    if (!product) return null;
    return buildProductCanonicalRoute(product, requestedLang, dataFetch);
}

async function buildProductCanonicalRoute(product, requestedLang = 'vi', dataFetch = supabaseFetch) {
    const category = Array.isArray(product.category) ? product.category[0] : product.category;
    const categorySlug = category?.slug || await getCategorySlugById(product.category_id, dataFetch);
    const availableLangs = getAvailableLangsRequiringAll(product, ['name', 'description']);
    const resolvedLang = resolveSupportedLang(requestedLang, availableLangs);
    return {
        path: getProductPathByCategorySlug(categorySlug, product.slug || product.id),
        lang: resolvedLang,
        availableLangs,
        entity: product,
    };
}

async function getBlogCanonicalRoute(slug, requestedLang = 'vi', dataFetch = supabaseFetch) {
    const post = await getBlogPostBySlug(slug, dataFetch);
    if (!post) return null;
    const availableLangs = getAvailableLangsRequiringAll(post, ['title', 'summary', 'content']);
    const resolvedLang = resolveSupportedLang(requestedLang, availableLangs);
    return {
        path: getBlogPathByCategorySlug(post.category_slug, post.slug),
        lang: resolvedLang,
        availableLangs,
        entity: post,
    };
}

async function getServiceCanonicalRoute(idOrSlug, requestedLang = 'vi', dataFetch = supabaseFetch) {
    const service = await getServiceByIdOrSlug(idOrSlug, dataFetch);
    if (!service) return null;
    const availableLangs = getAvailableLangsRequiringAll(service, ['name', 'description']);
    const resolvedLang = resolveSupportedLang(requestedLang, availableLangs);
    return {
        path: getServicePath(service),
        lang: resolvedLang,
        availableLangs,
        entity: service,
    };
}

export default {
    async fetch(request, env, ctx) {
        applyRuntimeConfig(env);
        const url = new URL(request.url);
        const path = url.pathname;
        const host = url.hostname.toLowerCase();
        const seoLang = normalizeSeoLang(url.searchParams.get('lang'));
        const ua = request.headers.get('user-agent') || '';
        const botRequest = isBot(ua);
        const routeContext = { request, env, ctx, url, path, host, seoLang, botRequest };
        const publicDataFetch = createPublicDataFetch(env);

        if (path === '/favicon.ico') {
            const faviconUrl = new URL('/icons/da-lieu-nhiet-doi-phu-quoc-48.png?v=clinic-20260730', request.url);
            const faviconResponse = await env.ASSETS.fetch(new Request(faviconUrl.toString(), request));
            const faviconHeaders = new Headers(faviconResponse.headers);
            faviconHeaders.set('content-type', 'image/png');
            faviconHeaders.set('cache-control', 'public, max-age=300, must-revalidate');
            return withSecurityHeaders(new Response(faviconResponse.body, {
                status: faviconResponse.status,
                statusText: faviconResponse.statusText,
                headers: faviconHeaders,
            }));
        }

        const routeModules = [
            () => maybeHandleAuthRoute(routeContext),
            () => maybeHandleD1CommerceRoute(routeContext),
            () => maybeHandleGhtkRoute(routeContext),
            () => maybeHandleAppointmentRoute(routeContext),
            () => maybeHandleAccountRoute(routeContext),
            () => maybeHandlePancakeRoute(routeContext),
            () => maybeHandleAdminD1Route(routeContext),
            () => maybeHandleReviewRoute(routeContext),
            () => maybeHandleAnalyticsRoute(routeContext),
            () => maybeHandleMediaR2Route(routeContext, {
                jsonResponse,
                authorizeImageMutation: (authRequest) => authorizeImageMutation(authRequest, env),
                isAllowedPublicBucket,
                normalizeObjectPath,
                getStorageUrl,
                R2_IMAGE_BASE_URL,
                encodeObjectPath,
            }),
            () => maybeHandlePublicRuntimeRoute(routeContext, {
                readEdgeCache,
                queuePublicMetricEvent,
                isAllowedPublicRuntimeResource,
                jsonResponse,
                PUBLIC_RUNTIME_PROXY_TIMEOUT_MS,
                PUBLIC_BOOTSTRAP_QUERY_TIMEOUT_MS,
                PRODUCT_LIST_LITE_SELECT,
                HOMEPAGE_PRODUCT_SELECT,
                HOMEPAGE_SERVICE_SELECT,
                HOMEPAGE_SOURCE_PRODUCT_LIMIT,
                HOMEPAGE_FAQ_LIMIT,
                HOMEPAGE_BRAND_LIMIT,
                BLOG_HOMEPAGE_SELECT,
                HOMEPAGE_BLOG_SOURCE_LIMIT,
                buildSupabaseRestUrl,
                SUPABASE_ANON_KEY,
                supabaseFetchWithMeta,
                mapBlogLiteRecord,
                selectHomepageProductRows,
                mapServiceRecord,
                mapDoctorRecord,
                mapAboutPageData,
                mapHomepageHeroRecord,
                mapSiteInfoRecord,
                mapAuthPageImageRecord,
                mapBrandRecord,
                mapProductLiteRecord,
                getPublicBootstrapCacheControl,
                getPublicRuntimeCacheControl,
                writePrivateMonitorEvent,
                maybeRunMonitoringRetention,
                sanitizeMonitorValue,
                writeEdgeCache,
            }),
            () => maybeHandleObservabilityRoute(routeContext, {
                jsonResponse,
                authorizeObservabilityAccess: (authRequest) => authorizeObservabilityAccess(authRequest, env),
                maybeRunMonitoringRetention,
                clampInteger,
                MAX_MONITORING_LOG_LIMIT,
                DEFAULT_MONITORING_LOG_LIMIT,
                MAX_MONITORING_RECENT_DAYS,
                DEFAULT_MONITORING_RECENT_DAYS,
                listRecentMonitoringLogs,
                listRecentMonitoringMetricSummary,
                MAX_MONITORING_RETENTION_DAYS,
                getMonitoringRetentionDays,
                cleanupMonitoringLogs,
                writePrivateMonitorEvent,
            }),
            () => maybeHandleAdminToolsRoute(routeContext, {
                jsonResponse,
                authorizeAdminEditorAccess: (authRequest) => authorizeAdminEditorAccess(authRequest, env),
                buildAdminEditorDraftObjectKey,
                buildAdminDraftResponse,
                parseDraftSavedAt,
                MAX_ADMIN_EDITOR_DRAFT_BYTES,
                authorizeObservabilityAccess: (authRequest) => authorizeObservabilityAccess(authRequest, env),
                parseProductContentReviewIds,
                buildProductContentReviewObjectKey,
                normalizeProductContentReviewRecord,
                PRODUCT_CONTENT_REVIEW_STATUSES,
                MAX_PRODUCT_CONTENT_REVIEW_BYTES,
            }),
            () => maybeHandleIngredientAnalyzerRoute(routeContext, {
                jsonResponse,
                authorizeAdminEditorAccess: (authRequest) => authorizeAdminEditorAccess(authRequest, env),
                SUPABASE_URL,
            }),
            () => maybeHandleAiGatewayRoute(routeContext, {
                jsonResponse,
                authorizeAuthenticatedRequest: (authRequest) => authorizeAuthenticatedRequest(authRequest, env),
                authorizeRequestByRole: (authRequest, roles) => authorizeRequestByRole(authRequest, roles, env),
            }),
            () => maybeHandleOrderLookupRoute(routeContext, {
                jsonResponse,
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
                ctx,
                dispatchPendingNotifications,
            }),
            () => maybeHandleSeoRoute(routeContext, {
                BASE_URL,
                CANONICAL_HOST,
                normalizeSeoLang,
                buildCanonicalRedirectUrl,
                buildLegacyProductSearchRedirectUrl,
                buildRobotsContent,
                withRobotsHeader,
                generateNoindexPage,
                SEO_LANGS,
                getAlternateUrls,
                escapeXml,
                buildAbsoluteUrl,
                supabaseFetch: publicDataFetch,
                getResolvedBlogImageUrl,
                getAvailableLangsRequiringAll,
                getAvailableLangs,
                CATEGORY_TRANSLATION_FIELDS,
                pickLatestDate,
                toDateOnly,
                normalizeBrandMatchKey,
                HREFLANG_BY_LANG,
                ORGANIZATION_SCHEMA_ID,
                WEBSITE_SCHEMA_ID,
                DEFAULT_LOGO_IMAGE,
                DEFAULT_SHARE_IMAGE,
                SITE_NAME,
                getStorageUrl,
                buildImageTitle,
                stripHtml,
                escapeHtml,
                escapeAttr,
                filterRecordsByRequiredLocale,
                getProductBrands: () => getProductBrands(publicDataFetch),
                getProductList: (limit, categoryId, options) => getProductList(limit, categoryId, options, publicDataFetch),
                getActiveBrandRows,
                generateDetailPrerenderHtml,
                generatePrerenderListHtml,
                buildSeoTitle,
                renderMarkdownishHtml,
                formatCurrencyVnd,
                buildMetaDescription,
                splitHighlights,
                normalizeDetailFaqItems,
                buildFaqJsonLd,
                buildKeywordString,
                getProductByIdOrSlug: (idOrSlug) => getProductByIdOrSlug(idOrSlug, publicDataFetch),
                getProductImages: (productId) => getProductImages(productId, publicDataFetch),
                getProductCategoryById: (categoryId) => getProductCategoryById(categoryId, publicDataFetch),
                getBlogList: (limit, categorySlug, options) => getBlogList(limit, categorySlug, options, publicDataFetch),
                getServiceList: (limit) => getServiceList(limit, publicDataFetch),
                getFaqItems: (limit) => getFaqItems(limit, publicDataFetch),
                getDoctors: (limit) => getDoctors(limit, publicDataFetch),
                getProductCategories: () => getProductCategories(publicDataFetch),
                getLocalizedLabel,
                getLocalizedField,
                getStrictLocalizedField,
                getStrictLocalizedArray,
                getLocalizedArray,
                getPrimaryProductImageUrl,
                getListingImageUrl,
                getBlogPathByCategorySlug,
                getServicePath,
                truncateText,
                renderTextList,
                renderFaqItemsHtml,
                buildStockLabel,
                buildReviewSection,
                getProductReviewSchemaData: (productId) => getProductReviewSchemaData(productId, publicDataFetch),
                getProductPathByCategorySlug,
                getProductsByBrandName: (brandName, limit, options) => getProductsByBrandName(brandName, limit, options, publicDataFetch),
                splitBrandDescription,
                buildBrandFilteredCatalogUrl,
                getAboutContent: () => getAboutContent(publicDataFetch),
                getBlogCategories: () => getBlogCategories(publicDataFetch),
                resolveSupportedLang,
                getBlogPostBySlug: (slug) => getBlogPostBySlug(slug, publicDataFetch),
                getBlogCategoryBySlug: (slug) => getBlogCategoryBySlug(slug, publicDataFetch),
                buildBlogSeoDescription,
                buildKeywordTerms,
                rankRecordsByTokenOverlap,
                buildArticleBodyExcerpt,
                dedupeTextParts,
                extractMarkdownishHeadings,
                getServiceByIdOrSlug: (idOrSlug) => getServiceByIdOrSlug(idOrSlug, publicDataFetch),
                getLegacyRootProductSlug,
                isLikelyLegacyProductSlug,
                getLegacyProductCanonicalRoute: (idOrSlug, lang) => getLegacyProductCanonicalRoute(idOrSlug, lang, publicDataFetch),
                getProductCanonicalRoute: (idOrSlug, lang) => getProductCanonicalRoute(idOrSlug, lang, publicDataFetch),
                getServiceCanonicalRoute: (idOrSlug, lang) => getServiceCanonicalRoute(idOrSlug, lang, publicDataFetch),
                getBlogCanonicalRoute: (slug, lang) => getBlogCanonicalRoute(slug, lang, publicDataFetch),
                isPrivatePath,
                isExcludedBlogSlug,
            }),
        ];

        for (const resolveRoute of routeModules) {
            const response = await resolveRoute();
            if (response) {
                return withSecurityHeaders(response);
            }
        }

        return withSecurityHeaders(await env.ASSETS.fetch(request));
    },

    async scheduled(_controller, env, ctx) {
        applyRuntimeConfig(env);
        ctx.waitUntil(Promise.allSettled([
            syncD1ProductIngredientSnapshots(env, {
                productLimit: 30,
            }).then((summary) => {
                if (summary.synced || summary.failed) {
                    console.log('[ingredient-product-sync] Scheduled run completed:', summary);
                }
            }).catch((error) => {
                console.error('[ingredient-product-sync] Scheduled run failed:', {
                    message: error instanceof Error ? error.message : String(error),
                });
            }),
            enqueueDueAdminReports(env).then((summary) => {
                if (summary.reports) console.log('[admin-reports] Enqueued reports:', summary);
            }).then(() => dispatchPendingNotifications(env)).then((summary) => {
                if (summary.queued) console.log('[notification-outbox] Queued notifications:', summary.queued);
            }).catch((error) => {
                console.error('[notification-outbox] Dispatch failed:', {
                    message: error instanceof Error ? error.message : String(error),
                });
            }),
            dispatchPendingShipping(env).then((summary) => {
                if (summary.queued) console.log('[shipping-outbox] Queued operations:', summary.queued);
            }).catch((error) => {
                console.error('[shipping-outbox] Dispatch failed:', {
                    message: error instanceof Error ? error.message : String(error),
                });
            }),
            dispatchPendingPancakeSync(env).then((summary) => {
                if (summary.queued) console.log('[pancake-outbox] Queued operations:', summary.queued);
            }).catch((error) => {
                console.error('[pancake-outbox] Dispatch failed:', {
                    message: error instanceof Error ? error.message : String(error),
                });
            }),
        ]));
    },

    async queue(batch, env) {
        const kind = batch.messages.find((message) => message.body?.kind)?.body?.kind;
        if (kind === 'shipping') return consumeShippingQueue(batch, env);
        if (kind === 'pancake') return consumePancakeQueue(batch, env);
        return consumeNotificationQueue(batch, env);
    },
};
