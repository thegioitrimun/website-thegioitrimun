

import React from 'react';
import {
    supabase,
    ensureSessionFresh,
    refreshSessionSafely,
    checkSupabaseAuthHealth,
    recoverSupabaseAfterResume,
    isSupabaseAuthError,
    isSupabaseRetryableError,
} from './supabaseClient';

type SaveWithRetryOptions = {
    retryNetwork?: boolean;
}

export async function saveWithRetry<T>(saveFn: () => Promise<T>, options: SaveWithRetryOptions = {}): Promise<T> {
    const retryNetwork = options.retryNetwork ?? true;
    try {
        await ensureSessionFresh();
        return await saveFn();
    } catch (err: any) {
        console.error("[saveWithRetry] Caught error on first attempt:", err);
        if (isSupabaseAuthError(err)) {
            console.log("[saveWithRetry] JWT error, attempting refreshSession...");
            try {
                await refreshSessionSafely();
            } catch (refreshErr) {
                console.error("[saveWithRetry] refreshSession threw error:", refreshErr);
            }
            console.log("[saveWithRetry] Calling saveFn again...");
            return await saveFn();
        }
        if (isSupabaseRetryableError(err)) {
            console.warn("[saveWithRetry] Retryable network/Safari resume error, recovering Supabase session and retrying once...");
            try {
                await recoverSupabaseAfterResume({ force: true, reason: 'save-retry' });
                await ensureSessionFresh({ force: true });
            } catch (recoverErr) {
                console.error("[saveWithRetry] Recovery before retry failed:", recoverErr);
            }
            if (!retryNetwork) {
                throw new Error('Kết nối Safari vừa được phục hồi. Để tránh tạo dữ liệu trùng, vui lòng kiểm tra lại danh sách rồi bấm lưu lại nếu thay đổi chưa xuất hiện.');
            }
            return await saveFn();
        }
        console.log("[saveWithRetry] Not a JWT error. Rethrowing immediately.");
        throw err;
    }
}
import type {
    Service, Doctor, BlogPost, BlogCategory, FAQItem,
    UserData, Appointment, PatientProfile, AboutPageData, MedicalRecord,
    DoctorDetail, DoctorProfile, HomepageHero, AboutContent, AboutFeature, AboutValue,
    SiteInfo, FooterContent, PatientDocument, AuthPageImages, ProcedureStep,
    Product, ProductCategory, ProductReview, ProductImage, DiscountCode, ProductOrderItem,
    ProductOrder, CartItem, PaymentSettings, GhtkTrackingEvent, GhtkPickAddress,
    GhtkPickAddressDetail, ProductBrand, CheckoutPricingQuote, OrderStatusHistory,
    OrderPaymentLog, OrderRefundLog, OrderFulfillmentStatus, OrderPaymentMethod,
    OrderPaymentStatus, TaxProfile, TaxRate, AdminDashboardKpiSnapshot,
    AdminDashboardTimeseriesPoint, AdminInventoryMetrics, AdminCustomerMetric,
    AdminDashboardAlert, AdminTopProductMetric, AdminServicePerformanceMetric,
    AdminAppointmentDrilldown, AdminBulkOrderTransitionResult, AdminReportSchedule,
    AdminReportPreset, AdminReportFrequency, ObservabilityLogsResponse,
    ObservabilityMetricsSummaryResponse, ObservabilityCleanupResult, AdminEditorDraftRecord, AdminEditorDraftResponse,
    AdminEditorDraftDeleteResult, ProductContentReviewListResponse,
    ProductContentReviewRecord, ProductContentReviewStatus, ProductContentIssue,
    ProductContentReviewUpsertResponse
} from '../types';
import { isPlaceholderOrderProductName } from '../src/orderItemPresentation';
import { normalizeFooterSocialUrls } from '../src/socialLinks';
import { adminDataProvider } from '../src/admin/AdminDataProvider';
import { getFallbackBlogImage } from '../types';
import { FALLBACK_HOMEPAGE_HERO, LEGACY_HOMEPAGE_HERO_PATHS, OPTIMIZED_HOMEPAGE_HERO_ASSETS } from '../src/siteDefaults';
import { sanitizeDetailFaqItems } from '../src/detailFaq';
import { normalizeLocalSeoTags } from '../worker/seo/localSeoTags.js';
import {
    getFallbackAboutPageData,
    getFallbackAuthPageImages,
    getFallbackBlogCategories,
    getFallbackBlogPostBySlug,
    getFallbackBlogPosts,
    getFallbackBlogPostsLite,
    getFallbackBrands,
    getFallbackDoctors,
    getFallbackFaqItems,
    getFallbackFeaturedBlogPostsLite,
    getFallbackFeaturedDoctorIds,
    getFallbackFeaturedPostSlugs,
    getFallbackFeaturedServiceIds,
    getFallbackFooterContent,
    getFallbackHomepageHero,
    getFallbackPaymentSettings,
    getFallbackProductByIdOrSlug,
    getFallbackProductCategories,
    getFallbackProducts,
    getFallbackServiceImageUrl,
    getFallbackServices,
    getFallbackSiteInfo,
    isKnownMissingServiceImagePath,
} from '../src/fallbackPublicData';
import {
    buildBlogCoverImagePath,
    buildBrandLogoImagePath,
    buildProductContentImagePath,
    buildProductGalleryImagePath,
    buildServiceCoverImagePath,
    buildServiceStepImagePath,
    buildSiteAssetImagePath,
} from '../src/imageSeo';
import { isExpectedPageLifecycleAbort } from '../src/browserLifecycle';
import {
    AcneIcon, SkincareIcon, ScarIcon, RejuvenateIcon, LaserIcon, LiftingIcon,
    TeamIcon, TechnologyIcon, PersonalizedCareIcon, CheckIcon, HeartIcon,
    ShieldCheckIcon, LightBulbIcon
} from '../components/icons';

// Icon Mapping
const iconMap: { [key: string]: React.FC<{ className?: string }> } = {
    'AcneIcon': AcneIcon,
    'SkincareIcon': SkincareIcon,
    'ScarIcon': ScarIcon,
    'RejuvenateIcon': RejuvenateIcon,
    'LaserIcon': LaserIcon,
    'LiftingIcon': LiftingIcon,
    'TeamIcon': TeamIcon,
    'TechnologyIcon': TechnologyIcon,
    'PersonalizedCareIcon': PersonalizedCareIcon,
    'CheckIcon': CheckIcon,
    'HeartIcon': HeartIcon,
    'ShieldCheckIcon': ShieldCheckIcon,
    'LightBulbIcon': LightBulbIcon,
};

export const availableIcons = Object.keys(iconMap);

export const getIcon = (iconName: string, props?: { className?: string }) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? React.createElement(IconComponent, props) : null;
};

export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const USE_D1_API = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase() === 'd1';
export const isD1BackendEnabled = (): boolean => USE_D1_API;
let d1CsrfToken: string | null = null;

function invalidateAdminMutationPath(path: string, method: string): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
    let pathname = path;
    try {
        pathname = new URL(path, window.location.origin).pathname;
    } catch {
        // Relative API paths are already suitable for the prefix checks below.
    }

    const resources = new Set<string>();
    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/r2/')) {
        resources.add('system-operations');
    }
    if (pathname.startsWith('/api/admin/products')) resources.add('products');
    if (pathname.startsWith('/api/admin/product-categories')) resources.add('product-categories');
    if (pathname.startsWith('/api/admin/product-brands')) {
        resources.add('product-brands');
        resources.add('products');
    }
    if (pathname.startsWith('/api/admin/orders')) resources.add('orders');
    if (pathname.startsWith('/api/admin/services')) resources.add('services');
    if (pathname.startsWith('/api/admin/appointments')) resources.add('appointments');
    if (pathname.startsWith('/api/admin/blog-posts')) resources.add('blog-posts');
    if (pathname.startsWith('/api/admin/blog-categories')) resources.add('blog-categories');
    if (pathname.startsWith('/api/admin/users')) {
        resources.add('users');
        resources.add('user-detail');
    }
    if (pathname.startsWith('/api/admin/medical-records')) resources.add('user-detail');
    if (pathname.startsWith('/api/admin/site-content/')) {
        const resource = decodeURIComponent(pathname.split('/')[4] || '');
        if (resource) resources.add(`site-content:${resource}`);
        resources.add('site-snapshot');
    }
    if (pathname.startsWith('/api/r2/') || pathname.startsWith('/api/admin/media-assets')) {
        resources.add('media-assets');
        resources.add('site-snapshot');
    }
    if (pathname.startsWith('/api/admin/discount-codes')) resources.add('discount-codes');
    if (pathname.startsWith('/api/admin/tax-')) resources.add('tax');
    if (pathname.startsWith('/api/admin/report-schedules')) {
        resources.add('report-schedules');
        resources.add('system-operations');
    }

    resources.forEach((resource) => adminDataProvider.invalidate(resource));
}

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const value = part.trim();
        if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
    }
    return null;
}

async function getD1CsrfToken(): Promise<string> {
    if (d1CsrfToken) return d1CsrfToken;
    const sessionToken = readCookie('tg_csrf');
    if (sessionToken) {
        d1CsrfToken = sessionToken;
        return sessionToken;
    }
    const guestToken = readCookie('tg_guest_csrf');
    if (guestToken) {
        d1CsrfToken = guestToken;
        return guestToken;
    }
    const response = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.csrfToken) {
        throw new Error(payload?.error || 'Không thể khởi tạo phiên bảo mật.');
    }
    d1CsrfToken = payload.csrfToken;
    return d1CsrfToken;
}

async function d1ApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = String(init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        headers.set('X-CSRF-Token', await getD1CsrfToken());
        if (!headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(path, { ...init, method, headers, credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 403) d1CsrfToken = null;
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || payload?.message;
        throw new Error(message || `API request failed (${response.status}).`);
    }
    invalidateAdminMutationPath(path, method);
    return payload as T;
}

type AdminListMeta = {
    page: number;
    pageSize: number;
    total: number;
    revision?: string;
    cursor?: string | null;
    truncated?: boolean;
};

type AdminListResponse<T> = {
    data?: T[];
    meta?: AdminListMeta;
    [legacyKey: string]: unknown;
};

const adminRows = <T>(payload: AdminListResponse<T>, legacyKey: string): T[] => {
    if (Array.isArray(payload.data)) return payload.data;
    const legacy = payload[legacyKey];
    return Array.isArray(legacy) ? legacy as T[] : [];
};

async function readAllAdminPages<T>(
    path: string,
    legacyKey: string,
    options: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
    const pageSize = Math.max(1, Math.min(500, options.pageSize ?? 500));
    const maxPages = Math.max(1, options.maxPages ?? 50);
    const rows: T[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('pageSize', String(pageSize));
        const payload = await d1ApiFetch<AdminListResponse<T>>(`${url.pathname}${url.search}`);
        const pageRows = adminRows(payload, legacyKey);
        rows.push(...pageRows);
        const total = Number(payload.meta?.total ?? rows.length);
        if (pageRows.length < pageSize || rows.length >= total) break;
    }
    return rows;
}

export const invalidateAdminData = (resource?: string): void => adminDataProvider.invalidate(resource);

async function saveD1SiteContent<T>(resource: string, items: unknown[], replace = false): Promise<T[]> {
    const payload = await d1ApiFetch<{ items: T[] }>(`/api/admin/site-content/${encodeURIComponent(resource)}`, {
        method: 'POST',
        body: JSON.stringify({ items, replace }),
    });
    return payload.items || [];
}

export async function getAdminSiteContent<T>(resource: string, options: { force?: boolean } = {}): Promise<T[]> {
    if (!USE_D1_API) return [];
    return adminDataProvider.read(`site-content:${resource}`, async () => {
        const payload = await d1ApiFetch<{ items: T[] }>(`/api/admin/site-content/${encodeURIComponent(resource)}`);
        return payload.items || [];
    }, { force: options.force, maxAgeMs: 45_000 });
}

async function deleteD1SiteContent(resource: string, key: string | number): Promise<void> {
    await d1ApiFetch<{ ok: boolean }>(`/api/admin/site-content/${encodeURIComponent(resource)}/${encodeURIComponent(String(key))}`, { method: 'DELETE' });
}

const getFileExtension = (file: File | Blob, fallback = 'webp'): string => {
    const fromType = String((file as File).type || '')
        .replace(/^image\//, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    if (fromType) return fromType;

    const fileName = 'name' in file ? String(file.name || '') : '';
    const fromName = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const normalized = fromName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized || fallback;
};

const generateSlug = (value: string | undefined | null): string =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');

const ANALYTICS_SESSION_KEY = 'iskin-funnel-session-id';
const EXCLUDED_BLOG_SLUGS = new Set([
    'can-sua-lai-noi-dung-bai-viet',
    'khong-tim-thay-trang',
]);
const EXCLUDED_BLOG_SLUG_PREFIXES = [
    'tuyet-voi-duoi-day-',
];
export type PublicImageBucket = 'site-assets' | 'avatars' | 'blog-images' | 'product-images' | 'assets';
const PUBLIC_IMAGE_BUCKETS = new Set<PublicImageBucket>([
    'site-assets',
    'avatars',
    'blog-images',
    'product-images',
    'assets',
]);
export type PublicImageAssetRecord = {
    key: string;
    bucket: PublicImageBucket;
    path: string;
    public_url: string;
    uploaded_at: string | null;
    uploaded_by: string | null;
    content_type: string | null;
    size: number;
    etag: string | null;
    usage?: {
        count: number;
        types: string[];
        references?: Array<{ label: string; id: string }>;
    } | null;
};

export type PublicImageLibraryResponse = {
    items: PublicImageAssetRecord[];
    cursor: string | null;
    truncated: boolean;
};
const IMAGE_STORAGE_PROVIDER = (import.meta.env.VITE_IMAGE_STORAGE_PROVIDER || 'r2').toLowerCase();
const R2_IMAGE_BASE_URL = (import.meta.env.VITE_R2_IMAGE_BASE_URL || '/r2').replace(/\/+$/, '');
const SUPABASE_PUBLIC_OBJECT_PATH_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;
const R2_PUBLIC_PATH_REGEX = /^\/?r2\/([^/]+)\/(.+)$/i;
const DEFAULT_PRODUCT_VAT_RATE = 0.1;
const PUBLIC_RUNTIME_API_BASE = '/api/public/rest';
const PUBLIC_RUNTIME_TIMEOUT_MS = 6500;
const PUBLIC_RUNTIME_CACHE_MAX_ENTRIES = 80;
const PUBLIC_RUNTIME_LOCAL_CACHE_PREFIX = 'iskin-public-runtime-v1';
const PUBLIC_RUNTIME_LOCAL_CACHE_MAX_BYTES = 1_250_000;
const PUBLIC_BOOTSTRAP_API_PATH = '/api/public/bootstrap';
const PUBLIC_BOOTSTRAP_LOCAL_CACHE_PREFIX = 'iskin-public-bootstrap-v5';
const PUBLIC_BOOTSTRAP_TIMEOUT_MS = 6500;
const PUBLIC_BOOTSTRAP_RETRY_TIMEOUT_MS = 10000;
const PUBLIC_BOOTSTRAP_RETRY_DELAY_MS = 250;
const PUBLIC_BOOTSTRAP_FRESH_TTL_BY_MODE: Record<'home' | 'home_deferred' | 'full', number> = {
    home: 60 * 1000,
    home_deferred: 90 * 1000,
    full: 45 * 1000,
};
const PUBLIC_BOOTSTRAP_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const ADMIN_WORKER_TIMEOUT_MS = 20000;
// D1 responses are already cached at Cloudflare's edge. Replaying a browser
// localStorage catalog creates a visible stale/fake phase before the real D1
// snapshot arrives, so D1 builds always read the network snapshot directly.
const SHOULD_USE_PUBLIC_BOOTSTRAP_LOCAL_CACHE = !import.meta.env.DEV && !USE_D1_API;

export type PublicBootstrapMode = 'home' | 'home_deferred' | 'full';
export type PublicBootstrapSource = 'network' | 'cache' | 'fallback';
export type PublicBootstrapPayload = {
    mode: PublicBootstrapMode;
    generatedAt: string;
    partial: boolean;
    source: PublicBootstrapSource;
    services: Service[];
    doctors: Doctor[];
    blogCategories: BlogCategory[];
    faqItems: FAQItem[];
    featuredDoctorIds: string[];
    featuredPostSlugs: string[];
    aboutData: AboutPageData | null;
    homepageHero: HomepageHero;
    featuredServiceIds: number[];
    siteInfo: SiteInfo;
    footerContent: FooterContent;
    authPageImages: AuthPageImages | null;
    productCategories: ProductCategory[];
    paymentSettings: PaymentSettings | null;
    brands: ProductBrand[];
    blogPosts: BlogPost[];
    products: Product[];
};

type PublicBootstrapCacheEntry = {
    cachedAt: number;
    payload: PublicBootstrapPayload;
};

type PublicRuntimeLocalCacheEntry<T = unknown> = {
    cachedAt: number;
    payload: T;
};

const publicRuntimeMemoryCache = new Map<string, { expiresAt: number; payload: unknown }>();
const publicRuntimeInFlight = new Map<string, Promise<unknown>>();
const SHOULD_USE_PUBLIC_RUNTIME_LOCAL_CACHE = !import.meta.env.DEV && !USE_D1_API;

const logPublicFallback = (scope: string, error: unknown) => {
    if (isExpectedPageLifecycleAbort(error)) {
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[api:fallback] ${scope}: ${message}`);
};

const clonePublicRuntimePayload = <T,>(payload: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(payload);
    }
    return JSON.parse(JSON.stringify(payload)) as T;
};

const waitForRetryDelay = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

const isRetryablePublicBootstrapError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error || '');
    const name = error instanceof Error ? error.name : '';
    return (
        name === 'AbortError'
        || /timed out|abort|network|fetch failed|load failed|temporar|timeout|503|502|504/i.test(message)
    );
};

const prunePublicRuntimeCache = () => {
    const now = Date.now();
    for (const [key, value] of publicRuntimeMemoryCache.entries()) {
        if (value.expiresAt <= now) {
            publicRuntimeMemoryCache.delete(key);
        }
    }

    while (publicRuntimeMemoryCache.size > PUBLIC_RUNTIME_CACHE_MAX_ENTRIES) {
        const oldestKey = publicRuntimeMemoryCache.keys().next().value;
        if (!oldestKey) break;
        publicRuntimeMemoryCache.delete(oldestKey);
    }
}

const getPublicRuntimeCacheTtlMs = (endpoint: string): number => {
    const resource = String(endpoint || '').split('?')[0].replace(/^\/+/, '');
    if (['site_info', 'footer_content', 'homepage_hero', 'payment_settings', 'auth_page_images'].includes(resource)) {
        return 5 * 60 * 1000;
    }
    if (resource === 'faq_items') {
        return 2 * 60 * 1000;
    }
    if (resource === 'products' || resource === 'public_blog_posts' || resource === 'blog_posts' || resource === 'product_brands') {
        return endpoint.includes('limit=1') || endpoint.includes('eq.')
            ? 45 * 1000
            : 90 * 1000;
    }
    return 60 * 1000;
};

const getPublicRuntimeResourceName = (endpoint: string): string =>
    String(endpoint || '').split('?')[0].replace(/^\/+/, '');

const shouldUsePublicRuntimeLocalCache = (endpoint: string): boolean => {
    const resource = getPublicRuntimeResourceName(endpoint);
    if (resource !== 'products') return false;
    return !endpoint.includes('limit=1') && !/[?&](?:id|slug)=eq\./.test(endpoint);
};

const getPublicRuntimeLocalStorageKey = (endpoint: string): string =>
    `${PUBLIC_RUNTIME_LOCAL_CACHE_PREFIX}:${endpoint}`;

const readPublicRuntimeLocalCache = <T,>(endpoint: string): T | null => {
    if (!SHOULD_USE_PUBLIC_RUNTIME_LOCAL_CACHE || typeof window === 'undefined' || !shouldUsePublicRuntimeLocalCache(endpoint)) return null;
    try {
        const raw = window.localStorage.getItem(getPublicRuntimeLocalStorageKey(endpoint));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PublicRuntimeLocalCacheEntry<T>;
        if (!parsed || typeof parsed.cachedAt !== 'number' || parsed.payload == null) return null;
        if (Date.now() - parsed.cachedAt > getPublicRuntimeCacheTtlMs(endpoint)) {
            window.localStorage.removeItem(getPublicRuntimeLocalStorageKey(endpoint));
            return null;
        }
        return clonePublicRuntimePayload(parsed.payload);
    } catch {
        return null;
    }
};

const writePublicRuntimeLocalCache = <T,>(endpoint: string, payload: T) => {
    if (!SHOULD_USE_PUBLIC_RUNTIME_LOCAL_CACHE || typeof window === 'undefined' || !shouldUsePublicRuntimeLocalCache(endpoint)) return;
    try {
        const record: PublicRuntimeLocalCacheEntry<T> = {
            cachedAt: Date.now(),
            payload: clonePublicRuntimePayload(payload),
        };
        const serialized = JSON.stringify(record);
        if (serialized.length > PUBLIC_RUNTIME_LOCAL_CACHE_MAX_BYTES) return;
        window.localStorage.setItem(getPublicRuntimeLocalStorageKey(endpoint), serialized);
    } catch {
        // Ignore quota and privacy-mode storage failures.
    }
};

export function clearPublicProductCatalogCache() {
    for (const key of Array.from(publicRuntimeMemoryCache.keys())) {
        if (getPublicRuntimeResourceName(key) === 'products') {
            publicRuntimeMemoryCache.delete(key);
        }
    }

    if (typeof window === 'undefined') return;
    try {
        const prefix = `${PUBLIC_RUNTIME_LOCAL_CACHE_PREFIX}:products?`;
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
            const key = window.localStorage.key(index);
            if (key?.startsWith(prefix)) {
                window.localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore storage access failures.
    }
}

const getPublicBootstrapLocalStorageKey = (mode: PublicBootstrapMode): string => `${PUBLIC_BOOTSTRAP_LOCAL_CACHE_PREFIX}:${mode}`;

const hasMeaningfulPublicBootstrapPayload = (
    mode: PublicBootstrapMode,
    payload?: Partial<PublicBootstrapPayload> | null,
): boolean => {
    if (!payload || payload.partial || payload.source === 'fallback') return false;
    if (!payload.homepageHero || !payload.siteInfo || !payload.footerContent) return false;
    if (!Array.isArray(payload.blogCategories) || !Array.isArray(payload.productCategories)) return false;

    const servicesHaveStepArrays = Array.isArray(payload.services)
        && payload.services.every((service) => Array.isArray(service?.procedure_steps));

    if (mode === 'home') {
        return Array.isArray(payload.services)
            && payload.services.length > 0
            && servicesHaveStepArrays
            && Array.isArray(payload.products)
            && payload.products.length > 0
            && Array.isArray(payload.featuredServiceIds);
    }

    if (mode === 'home_deferred') {
        return Array.isArray(payload.brands)
            && payload.brands.length > 0
            && Array.isArray(payload.blogPosts)
            && payload.blogPosts.length > 0
            && Array.isArray(payload.faqItems)
            && Array.isArray(payload.featuredPostSlugs);
    }

    return Array.isArray(payload.services)
        && payload.services.length > 0
        && servicesHaveStepArrays
        && Array.isArray(payload.products)
        && payload.products.length > 0
        && Array.isArray(payload.brands)
        && payload.brands.length > 0
        && Array.isArray(payload.blogPosts)
        && payload.blogPosts.length > 0;
};

const buildPublicBootstrapUrl = (mode: PublicBootstrapMode): string => {
    const url = new URL(PUBLIC_BOOTSTRAP_API_PATH, window.location.origin);
    url.searchParams.set('mode', mode);
    return `${url.pathname}${url.search}`;
};

const readPublicBootstrapCache = (mode: PublicBootstrapMode): PublicBootstrapCacheEntry | null => {
    if (!SHOULD_USE_PUBLIC_BOOTSTRAP_LOCAL_CACHE) return null;
    if (typeof window === 'undefined') return null;
    try {
        const storageKey = getPublicBootstrapLocalStorageKey(mode);
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PublicBootstrapCacheEntry;
        if (!parsed || typeof parsed.cachedAt !== 'number' || !parsed.payload) return null;
        if (!hasMeaningfulPublicBootstrapPayload(mode, parsed.payload)) {
            window.localStorage.removeItem(storageKey);
            return null;
        }
        if (Date.now() - parsed.cachedAt > PUBLIC_BOOTSTRAP_STALE_TTL_MS) {
            window.localStorage.removeItem(storageKey);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const writePublicBootstrapCache = (mode: PublicBootstrapMode, payload: PublicBootstrapPayload) => {
    if (!SHOULD_USE_PUBLIC_BOOTSTRAP_LOCAL_CACHE) return;
    if (typeof window === 'undefined') return;
    if (payload.partial) {
        try {
            window.localStorage.removeItem(getPublicBootstrapLocalStorageKey(mode));
        } catch {
            // Ignore localStorage write failures.
        }
        return;
    }
    try {
        if (!hasMeaningfulPublicBootstrapPayload(mode, payload)) {
            window.localStorage.removeItem(getPublicBootstrapLocalStorageKey(mode));
            return;
        }
        const record: PublicBootstrapCacheEntry = {
            cachedAt: Date.now(),
            payload: clonePublicRuntimePayload(payload),
        };
        window.localStorage.setItem(getPublicBootstrapLocalStorageKey(mode), JSON.stringify(record));
    } catch {
        // Ignore localStorage quota and serialization failures.
    }
};

const withPublicReadFallback = async <T>(
    scope: string,
    fetcher: () => Promise<T>,
    fallback: () => T | Promise<T>,
): Promise<T> => {
    try {
        return await fetcher();
    } catch (error) {
        logPublicFallback(scope, error);
        if (USE_D1_API) throw error;
        return await fallback();
    }
};

const withSessionReadRetry = async <T>(scope: string, reader: () => Promise<T>): Promise<T> => {
    try {
        await ensureSessionFresh();
        return await reader();
    } catch (error: any) {
        if (isSupabaseAuthError(error)) {
            await refreshSessionSafely();
            await ensureSessionFresh({ force: true });
            return await reader();
        }

        if (isSupabaseRetryableError(error)) {
            try {
                await recoverSupabaseAfterResume({ force: true, reason: `${scope}-read-retry` });
                await ensureSessionFresh({ force: true });
            } catch {
                // The retry below is still worthwhile even if recovery fails.
            }
            return await reader();
        }

        throw error;
    }
};

const buildPublicRuntimeRestUrl = (endpoint: string): string => {
    const [resourcePart, ...searchParts] = String(endpoint || '').split('?');
    const resource = resourcePart.replace(/^\/+/, '');
    const url = new URL(`${PUBLIC_RUNTIME_API_BASE}/${resource}`, window.location.origin);
    if (searchParts.length > 0) {
        url.search = searchParts.join('?');
    }
    return `${url.pathname}${url.search}`;
};

const fetchPublicRuntimeRest = async <T>(endpoint: string): Promise<T> => {
    if (typeof window === 'undefined') {
        throw new Error('Public runtime API is only available in the browser.');
    }

    const cacheKey = endpoint;
    const now = Date.now();
    const cached = publicRuntimeMemoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return clonePublicRuntimePayload(cached.payload as T);
    }

    const localCached = readPublicRuntimeLocalCache<T>(endpoint);
    if (localCached) {
        publicRuntimeMemoryCache.set(cacheKey, {
            expiresAt: Date.now() + getPublicRuntimeCacheTtlMs(endpoint),
            payload: clonePublicRuntimePayload(localCached),
        });
        prunePublicRuntimeCache();
        return localCached;
    }

    const inFlight = publicRuntimeInFlight.get(cacheKey);
    if (inFlight) {
        return clonePublicRuntimePayload(await inFlight as T);
    }

    const requestPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            controller.abort(new DOMException('Public runtime request timed out', 'AbortError'));
        }, PUBLIC_RUNTIME_TIMEOUT_MS);

        try {
            const response = await fetch(buildPublicRuntimeRestUrl(endpoint), {
                method: 'GET',
                credentials: 'omit',
                headers: {
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                if (cached) {
                    return clonePublicRuntimePayload(cached.payload as T);
                }
                throw new Error(`Public runtime ${response.status}: ${errorText.slice(0, 240) || response.statusText}`);
            }

            const payload = await response.json() as T;
            publicRuntimeMemoryCache.set(cacheKey, {
                expiresAt: Date.now() + getPublicRuntimeCacheTtlMs(endpoint),
                payload: clonePublicRuntimePayload(payload),
            });
            writePublicRuntimeLocalCache(endpoint, payload);
            prunePublicRuntimeCache();
            return payload;
        } catch (error) {
            if (cached) {
                return clonePublicRuntimePayload(cached.payload as T);
            }
            throw error;
        } finally {
            publicRuntimeInFlight.delete(cacheKey);
            window.clearTimeout(timeoutId);
        }
    })();

    publicRuntimeInFlight.set(cacheKey, requestPromise as Promise<unknown>);
    return clonePublicRuntimePayload(await requestPromise);
};

const fetchPublicRuntimeMaybeSingle = async <T>(endpoint: string): Promise<T | null> => {
    const data = await fetchPublicRuntimeRest<T | T[] | null>(endpoint);
    if (Array.isArray(data)) {
        return data[0] ?? null;
    }
    return data ?? null;
};

const buildFallbackPublicBootstrap = (mode: PublicBootstrapMode): PublicBootstrapPayload => {
    const useSafeHomepageFallback = mode !== 'full';
    const featuredPostSlugs = getFallbackFeaturedPostSlugs();
    const productCategories = getFallbackProductCategories();

    return {
        mode,
        generatedAt: new Date().toISOString(),
        partial: true,
        source: 'fallback',
        services: useSafeHomepageFallback ? [] : getFallbackServices(),
        doctors: useSafeHomepageFallback ? [] : getFallbackDoctors(),
        blogCategories: useSafeHomepageFallback ? [] : getFallbackBlogCategories(),
        faqItems: useSafeHomepageFallback ? [] : getFallbackFaqItems(),
        featuredDoctorIds: useSafeHomepageFallback ? [] : getFallbackFeaturedDoctorIds(),
        featuredPostSlugs: useSafeHomepageFallback ? [] : featuredPostSlugs,
        aboutData: mode === 'full' ? getFallbackAboutPageData() : null,
        homepageHero: getFallbackHomepageHero(),
        featuredServiceIds: useSafeHomepageFallback ? [] : getFallbackFeaturedServiceIds(),
        siteInfo: getFallbackSiteInfo(),
        footerContent: getFallbackFooterContent(),
        authPageImages: mode === 'full' ? getFallbackAuthPageImages() : null,
        productCategories: useSafeHomepageFallback ? [] : productCategories,
        paymentSettings: mode === 'full' ? getFallbackPaymentSettings() : null,
        brands: useSafeHomepageFallback ? [] : getFallbackBrands(),
        blogPosts: useSafeHomepageFallback
            ? []
            : mode === 'full'
            ? getFallbackBlogPostsLite()
            : getFallbackFeaturedBlogPostsLite(featuredPostSlugs),
        products: useSafeHomepageFallback ? [] : getFallbackProducts({ detailLoaded: false }),
    };
};

const resolvePublicBootstrapRecoveryBase = (
    mode: PublicBootstrapMode,
    cachedPayload?: PublicBootstrapPayload | null,
): PublicBootstrapPayload => {
    if (cachedPayload && cachedPayload.mode === mode && !cachedPayload.partial) {
        return clonePublicRuntimePayload(cachedPayload);
    }
    return buildFallbackPublicBootstrap(mode);
};

const normalizePublicBootstrapPayload = (
    mode: PublicBootstrapMode,
    candidate: Partial<PublicBootstrapPayload> | null | undefined,
    source: PublicBootstrapSource,
    cachedPayload?: PublicBootstrapPayload | null,
): PublicBootstrapPayload => {
    const fallback = resolvePublicBootstrapRecoveryBase(mode, cachedPayload);
    const blogCategories = Array.isArray(candidate?.blogCategories) ? candidate.blogCategories : fallback.blogCategories;
    const featuredPostSlugs = Array.isArray(candidate?.featuredPostSlugs) ? candidate.featuredPostSlugs : fallback.featuredPostSlugs;
    const productCategories = Array.isArray(candidate?.productCategories)
        ? candidate.productCategories
        : USE_D1_API
            ? []
            : fallback.productCategories;
    const fallbackBlogPosts = mode === 'full'
        ? getFallbackBlogPostsLite()
        : getFallbackFeaturedBlogPostsLite(featuredPostSlugs);
    const fallbackProducts: Product[] = [];

    const payload: PublicBootstrapPayload = {
        mode,
        generatedAt: typeof candidate?.generatedAt === 'string' ? candidate.generatedAt : fallback.generatedAt,
        partial: Boolean(candidate?.partial),
        source,
        services: Array.isArray(candidate?.services) ? candidate.services : fallback.services,
        doctors: Array.isArray(candidate?.doctors) ? candidate.doctors : fallback.doctors,
        blogCategories,
        faqItems: Array.isArray(candidate?.faqItems) ? candidate.faqItems : fallback.faqItems,
        featuredDoctorIds: Array.isArray(candidate?.featuredDoctorIds) ? candidate.featuredDoctorIds : fallback.featuredDoctorIds,
        featuredPostSlugs,
        aboutData: candidate?.aboutData ?? (mode === 'full' ? fallback.aboutData : null),
        homepageHero: candidate?.homepageHero || fallback.homepageHero,
        featuredServiceIds: Array.isArray(candidate?.featuredServiceIds) ? candidate.featuredServiceIds : fallback.featuredServiceIds,
        siteInfo: candidate?.siteInfo || fallback.siteInfo,
        footerContent: candidate?.footerContent || fallback.footerContent,
        authPageImages: candidate?.authPageImages ?? (mode === 'full' ? fallback.authPageImages : null),
        productCategories,
        paymentSettings: candidate?.paymentSettings ?? (mode === 'full' ? fallback.paymentSettings : null),
        brands: Array.isArray(candidate?.brands) ? candidate.brands : USE_D1_API ? [] : fallback.brands,
        blogPosts: Array.isArray(candidate?.blogPosts) ? candidate.blogPosts : USE_D1_API ? [] : fallbackBlogPosts,
        products: Array.isArray(candidate?.products) ? candidate.products : fallbackProducts,
    };

    const isMissingServiceStepData = (mode === 'home' || mode === 'full')
        && payload.services.some((service) => !Array.isArray(service?.procedure_steps));

    const expectsCoreServices = mode === 'full' || mode === 'home';
    const expectsDoctorData = mode === 'full';
    const expectsAboutData = mode === 'full';
    const expectsDeferredCollections = mode === 'full' || mode === 'home_deferred';

    const isPartial = payload.partial
        || (expectsCoreServices && !Array.isArray(candidate?.services))
        || isMissingServiceStepData
        || (expectsDoctorData && !Array.isArray(candidate?.doctors))
        || !Array.isArray(candidate?.blogCategories)
        || (expectsDeferredCollections && !Array.isArray(candidate?.faqItems))
        || (expectsDoctorData && !Array.isArray(candidate?.featuredDoctorIds))
        || (expectsDeferredCollections && !Array.isArray(candidate?.featuredPostSlugs))
        || (expectsAboutData && !candidate?.aboutData)
        || !candidate?.homepageHero
        || (expectsCoreServices && !Array.isArray(candidate?.featuredServiceIds))
        || !candidate?.siteInfo
        || !candidate?.footerContent
        || (mode === 'full' && !candidate?.authPageImages)
        || !Array.isArray(candidate?.productCategories)
        || (mode === 'full' && !candidate?.paymentSettings)
        || (expectsDeferredCollections && !Array.isArray(candidate?.brands))
        || (expectsDeferredCollections && !Array.isArray(candidate?.blogPosts))
        || (expectsCoreServices && !Array.isArray(candidate?.products));

    return {
        ...payload,
        partial: isPartial,
    };
};

export async function getPublicBootstrap(mode: PublicBootstrapMode = 'home'): Promise<PublicBootstrapPayload> {
    const cacheEntry = readPublicBootstrapCache(mode);
    const freshTtlMs = PUBLIC_BOOTSTRAP_FRESH_TTL_BY_MODE[mode];
    if (cacheEntry && Date.now() - cacheEntry.cachedAt <= freshTtlMs) {
        return {
            ...clonePublicRuntimePayload(cacheEntry.payload),
            source: 'cache',
        };
    }

    if (typeof window === 'undefined') {
        return buildFallbackPublicBootstrap(mode);
    }

    const fetchBootstrapOnce = async (timeoutMs: number): Promise<PublicBootstrapPayload> => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            controller.abort(new DOMException('Public bootstrap request timed out', 'AbortError'));
        }, timeoutMs);

        try {
            const response = await fetch(buildPublicBootstrapUrl(mode), {
                method: 'GET',
                credentials: 'omit',
                headers: {
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Public bootstrap ${response.status}: ${errorText.slice(0, 240) || response.statusText}`);
            }

            const rawPayload = await response.json() as Partial<PublicBootstrapPayload>;
            const payload = normalizePublicBootstrapPayload(mode, rawPayload, 'network', cacheEntry?.payload || null);
            writePublicBootstrapCache(mode, payload);
            return payload;
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    try {
        return await fetchBootstrapOnce(PUBLIC_BOOTSTRAP_TIMEOUT_MS);
    } catch (error) {
        let finalError = error;
        if (isRetryablePublicBootstrapError(error)) {
            try {
                await waitForRetryDelay(PUBLIC_BOOTSTRAP_RETRY_DELAY_MS);
                return await fetchBootstrapOnce(PUBLIC_BOOTSTRAP_RETRY_TIMEOUT_MS);
            } catch (retryError) {
                finalError = retryError;
            }
        }

        if (cacheEntry) {
            return {
                ...clonePublicRuntimePayload(cacheEntry.payload),
                source: 'cache',
                partial: true,
            };
        }
        logPublicFallback(`getPublicBootstrap:${mode}`, finalError);
        if (USE_D1_API) throw finalError;
        return buildFallbackPublicBootstrap(mode);
    }
}

const getAnalyticsSessionId = (): string => {
    if (typeof window === 'undefined') return 'server';
    const existing = window.localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) return existing;
    const nextId = generateUUID();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, nextId);
    return nextId;
};

const normalizeStoragePath = (path: string): string =>
    String(path || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();

const decodeStoragePath = (path: string): string =>
    normalizeStoragePath(path)
        .split('/')
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .join('/');

const encodeStoragePath = (path: string): string =>
    normalizeStoragePath(path)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

const isPublicImageBucket = (bucket: string): bucket is PublicImageBucket => {
    return PUBLIC_IMAGE_BUCKETS.has(bucket as PublicImageBucket);
};

const shouldUseR2ForBucket = (bucket: string): bucket is PublicImageBucket => {
    return IMAGE_STORAGE_PROVIDER === 'r2' && isPublicImageBucket(bucket);
};

const buildR2PublicImageUrl = (bucket: PublicImageBucket, path: string): string => {
    const base = R2_IMAGE_BASE_URL || '/r2';
    return `${base}/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
};

type ResolvedImagePath = {
    bucket?: PublicImageBucket;
    path?: string;
    externalUrl?: string;
};

const resolveImagePath = (rawPath: string | undefined | null, fallbackBucket?: string): ResolvedImagePath | null => {
    if (!rawPath) return null;
    const raw = String(rawPath).trim();
    if (!raw) return null;

    const fallback = isPublicImageBucket(String(fallbackBucket || ''))
        ? (fallbackBucket as PublicImageBucket)
        : undefined;

    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);

            const supabaseMatch = parsed.pathname.match(SUPABASE_PUBLIC_OBJECT_PATH_REGEX);
            if (supabaseMatch) {
                const maybeBucket = decodeURIComponent(supabaseMatch[1]);
                if (isPublicImageBucket(maybeBucket)) {
                    return {
                        bucket: maybeBucket,
                        path: decodeStoragePath(supabaseMatch[2]),
                    };
                }
            }

            const r2Match = parsed.pathname.match(/^\/r2\/([^/]+)\/(.+)$/i);
            if (r2Match) {
                const maybeBucket = decodeURIComponent(r2Match[1]);
                if (isPublicImageBucket(maybeBucket)) {
                    return {
                        bucket: maybeBucket,
                        path: decodeStoragePath(r2Match[2]),
                    };
                }
            }
        } catch {
            // keep as external URL
        }
        return { externalUrl: raw };
    }

    const cleanPath = normalizeStoragePath(raw);
    if (!cleanPath) return null;

    const r2Local = cleanPath.match(R2_PUBLIC_PATH_REGEX);
    if (r2Local) {
        const maybeBucket = decodeURIComponent(r2Local[1]);
        if (isPublicImageBucket(maybeBucket)) {
            return {
                bucket: maybeBucket,
                path: decodeStoragePath(r2Local[2]),
            };
        }
    }

    const inferred = cleanPath.match(/^([^/]+)\/(.+)$/);
    if (inferred && isPublicImageBucket(inferred[1])) {
        return {
            bucket: inferred[1] as PublicImageBucket,
            path: decodeStoragePath(inferred[2]),
        };
    }

    return { bucket: fallback, path: decodeStoragePath(cleanPath) };
};

const getSessionAccessToken = async (): Promise<string> => {
    await ensureSessionFresh();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(`Không thể lấy session đăng nhập: ${error.message}`);

    let token = data.session?.access_token || '';
    if (!token) {
        await refreshSessionSafely();
        const { data: refreshedData, error: refreshedError } = await supabase.auth.getSession();
        if (refreshedError) {
            throw new Error(`Phiên đăng nhập đã hết hạn: ${refreshedError.message}`);
        }
        token = refreshedData.session?.access_token || '';
    }

    if (!token) throw new Error('Bạn cần đăng nhập lại để tải ảnh lên hệ thống mới.');
    return token;
};

const fetchAdminWorkerJson = async <T>(input: string, init: RequestInit = {}): Promise<T> => {
    const token = USE_D1_API ? '' : await getSessionAccessToken();
    const controller = new AbortController();
    const incomingSignal = init.signal;
    const abortFromIncomingSignal = () => controller.abort(incomingSignal?.reason);
    const timeoutId = window.setTimeout(() => {
        controller.abort(new DOMException('Admin worker request timed out', 'AbortError'));
    }, ADMIN_WORKER_TIMEOUT_MS);

    if (incomingSignal) {
        if (incomingSignal.aborted) {
            abortFromIncomingSignal();
        } else {
            incomingSignal.addEventListener('abort', abortFromIncomingSignal, { once: true });
        }
    }

    const method = String(init.method || 'GET').toUpperCase();
    let response: Response;
    try {
        const headers = new Headers(init.headers || {});
        headers.set('Accept', 'application/json');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (USE_D1_API && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            headers.set('X-CSRF-Token', await getD1CsrfToken());
        }
        response = await fetch(input, {
            ...init,
            credentials: 'same-origin',
            headers,
            signal: controller.signal,
        });
    } finally {
        window.clearTimeout(timeoutId);
        incomingSignal?.removeEventListener?.('abort', abortFromIncomingSignal);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || payload?.message;
        throw new Error(message || `Worker admin API ${response.status}`);
    }
    if (USE_D1_API) invalidateAdminMutationPath(input, method);
    return payload as T;
};

async function uploadToSupabaseStorage(bucket: PublicImageBucket, normalizedPath: string, file: File): Promise<{ path: string }> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(normalizedPath, file, { cacheControl: '31536000', upsert: true });

    if (error || !data?.path) {
        throw new Error(error?.message || 'Không thể tải ảnh lên storage.');
    }

    return { path: data.path };
}

const shouldFallbackToSupabaseStorage = (status: number, errorMessage: string): boolean => {
    if (status === 404 || status === 405 || status === 503) return true;
    const message = String(errorMessage || '').toLowerCase();
    return (
        message.includes('r2 binding') ||
        message.includes('not found') ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network error')
    );
};

async function uploadPublicImageToR2(bucket: PublicImageBucket, normalizedPath: string, file: File): Promise<{ path: string; public_url?: string }> {
    const uploadToR2 = async (token = '') => {
        const formData = new FormData();
        formData.set('bucket', bucket);
        formData.set('path', normalizedPath);
        formData.set('file', file, file.name);

        const headers = new Headers();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (USE_D1_API) headers.set('X-CSRF-Token', await getD1CsrfToken());
        const response = await fetch('/api/r2/upload', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        return { response, payload };
    };

    const firstToken = USE_D1_API ? '' : await getSessionAccessToken();
    let { response, payload } = await uploadToR2(firstToken);

    if (!USE_D1_API && !response.ok && response.status === 401) {
        const firstMessage = String(payload?.error || '').toLowerCase();
        if (firstMessage.includes('invalid access token') || firstMessage.includes('missing bearer token')) {
            await refreshSessionSafely();
            const { data: refreshedData } = await supabase.auth.getSession();
            if (refreshedData.session?.access_token) {
                ({ response, payload } = await uploadToR2(refreshedData.session.access_token));
            }
        }
    }

    if (!response.ok || !payload?.path) {
        const uploadError = new Error(payload?.error || 'Không thể tải ảnh lên R2.');
        (uploadError as Error & { status?: number }).status = response.status;
        throw uploadError;
    }

    return {
        path: payload.path,
        public_url: payload.public_url,
    };
}

async function uploadPublicImage(bucket: PublicImageBucket, path: string, file: File): Promise<{ path: string }> {
    const resolved = resolveImagePath(path, bucket);
    const normalizedPath = normalizeStoragePath(resolved?.path || path);

    if (shouldUseR2ForBucket(bucket)) {
        try {
            const result = await uploadPublicImageToR2(bucket, normalizedPath, file);
            if (!result?.path) {
                throw new Error('Không thể tải ảnh lên R2.');
            }
            return { path: result.path };
        } catch (error: any) {
            const message = error?.message || String(error);
            const status = typeof error?.status === 'number' ? error.status : 0;
            if (!USE_D1_API && status === 401) {
                console.warn(`[uploadPublicImage] R2 auth mismatch (${status}). Falling back to Supabase storage for ${bucket}.`);
                return uploadToSupabaseStorage(bucket, normalizedPath, file);
            }
            if (!USE_D1_API && shouldFallbackToSupabaseStorage(status, message)) {
                console.warn(`[uploadPublicImage] R2 unavailable (${status || 'network'}). Falling back to Supabase storage for ${bucket}.`);
                return uploadToSupabaseStorage(bucket, normalizedPath, file);
            }
            throw error;
        }
    }

    return uploadToSupabaseStorage(bucket, normalizedPath, file);
}

async function removePublicImages(bucket: PublicImageBucket, paths: string[]): Promise<void> {
    const validPaths = Array.from(
        new Set(
            paths
                .map((path) => resolveImagePath(path, bucket))
                .filter(
                    (resolved): resolved is ResolvedImagePath =>
                        Boolean(resolved?.path) &&
                        !resolved?.externalUrl &&
                        (!resolved?.bucket || resolved.bucket === bucket)
                )
                .map((resolved) => normalizeStoragePath(resolved.path as string))
                .filter(Boolean)
        )
    );

    if (validPaths.length === 0) return;

    if (shouldUseR2ForBucket(bucket)) {
        const token = USE_D1_API ? '' : await getSessionAccessToken();
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (USE_D1_API) headers.set('X-CSRF-Token', await getD1CsrfToken());
        const response = await fetch('/api/r2/delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify({ bucket, paths: validPaths }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === 'string'
                ? payload.error
                : payload?.error?.message;
            throw new Error(message || 'Không thể xóa ảnh khỏi R2.');
        }
        return;
    }

    const { error } = await supabase.storage.from(bucket).remove(validPaths);
    if (error) throw new Error(error.message);
}

export async function uploadPublicAsset(bucket: PublicImageBucket, path: string, file: File): Promise<{ path: string }> {
    return uploadPublicImage(bucket, path, file);
}

export async function uploadPublicAssetToR2(bucket: PublicImageBucket, path: string, file: File): Promise<{ path: string; public_url?: string }> {
    const resolved = resolveImagePath(path, bucket);
    const normalizedPath = normalizeStoragePath(resolved?.path || path);

    if (!shouldUseR2ForBucket(bucket)) {
        throw new Error('R2 hiện chưa được bật cho bucket này.');
    }

    return uploadPublicImageToR2(bucket, normalizedPath, file);
}

export async function listPublicAssets(
    bucket: PublicImageBucket,
    options: { prefix?: string; cursor?: string | null; limit?: number } = {}
): Promise<PublicImageLibraryResponse> {
    if (!shouldUseR2ForBucket(bucket)) {
        throw new Error('Thư viện này chỉ hỗ trợ bucket đang chạy trên Cloudflare R2.');
    }

    if (USE_D1_API) {
        const search = new URLSearchParams({
            bucket,
            prefix: options.prefix || '',
            pageSize: String(options.limit || 60),
        });
        if (options.cursor) search.set('cursor', options.cursor);
        const payload = await d1ApiFetch<AdminListResponse<PublicImageAssetRecord>>(`/api/admin/media-assets?${search.toString()}`);
        return {
            items: adminRows(payload, 'items'),
            cursor: payload.meta?.cursor || null,
            truncated: Boolean(payload.meta?.truncated),
        };
    }

    return fetchAdminWorkerJson<PublicImageLibraryResponse>('/api/r2/list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bucket,
            prefix: options.prefix || '',
            cursor: options.cursor || null,
            limit: options.limit || 60,
        }),
    });
}

export async function removePublicAssets(bucket: PublicImageBucket, paths: string[]): Promise<void> {
    return removePublicImages(bucket, paths);
}

export async function trackFunnelEvent(
    eventName: string,
    metadata: Record<string, unknown> = {},
    userId?: string | null
) {
    try {
        const sessionId = getAnalyticsSessionId();
        if (USE_D1_API) {
            await d1ApiFetch<{ ok: boolean }>('/api/analytics/funnel', {
                method: 'POST',
                body: JSON.stringify({
                    eventName,
                    sessionId,
                    path: typeof window !== 'undefined' ? window.location.pathname : null,
                    metadata,
                }),
            });
            return;
        }
        await supabase.from('funnel_events').insert({
            event_name: eventName,
            user_id: userId || null,
            session_id: sessionId,
            path: typeof window !== 'undefined' ? window.location.pathname : null,
            metadata,
        });
    } catch (error) {
        // Analytics is best-effort and must never break checkout/user actions.
        console.warn('Could not track funnel event:', error);
    }
}

const convertImageToFormat = (
    file: File,
    options: {
        targetSizeKB?: number;
        maxDimension?: number;
        mimeType: string;
        extension: string;
        startQuality: number;
        minQuality: number;
        fallbackToOriginal?: boolean;
    }
): Promise<File | null> => {
    return new Promise((resolve) => {
        // Don't convert non-images, GIFs (to preserve animation)
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
            resolve(options.fallbackToOriginal === false ? null : file);
            return;
        }

        const targetSize = (options.targetSizeKB || 200) * 1024;
        const maxDimension = options.maxDimension || 2200;
        const minDimension = 640;
        const { mimeType, extension, startQuality, minQuality } = options;

        if (file.type === mimeType && file.size <= targetSize) {
            resolve(file);
            return;
        }

        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(options.fallbackToOriginal === false ? null : file);
                return;
            }

            const naturalWidth = image.naturalWidth || image.width;
            const naturalHeight = image.naturalHeight || image.height;
            if (!naturalWidth || !naturalHeight) {
                URL.revokeObjectURL(url);
                resolve(options.fallbackToOriginal === false ? null : file);
                return;
            }

            const initialScale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
            let renderWidth = Math.max(1, Math.round(naturalWidth * initialScale));
            let renderHeight = Math.max(1, Math.round(naturalHeight * initialScale));
            let currentQuality = startQuality;
            let attempt = 0;

            const compress = () => {
                attempt += 1;
                canvas.width = renderWidth;
                canvas.height = renderHeight;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.type !== mimeType) {
                            URL.revokeObjectURL(url);
                            resolve(options.fallbackToOriginal === false ? null : file);
                            return;
                        }

                        const longestEdge = Math.max(renderWidth, renderHeight);
                        if (blob.size <= targetSize || attempt >= 20 || (currentQuality <= minQuality && longestEdge <= minDimension)) {
                            URL.revokeObjectURL(url);
                            const filename = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                            const modernFile = new File([blob], `${filename}.${extension}`, {
                                type: mimeType,
                                lastModified: Date.now(),
                            });
                            resolve(modernFile);
                            return;
                        }

                        if (currentQuality > minQuality) {
                            currentQuality = Math.max(minQuality, currentQuality - 0.08);
                            compress();
                            return;
                        }

                        if (longestEdge > minDimension) {
                            const downscaleFactor = Math.max(minDimension / longestEdge, 0.85);
                            renderWidth = Math.max(1, Math.round(renderWidth * downscaleFactor));
                            renderHeight = Math.max(1, Math.round(renderHeight * downscaleFactor));
                            currentQuality = startQuality;
                            compress();
                            return;
                        }

                        URL.revokeObjectURL(url);
                        resolve(options.fallbackToOriginal === false ? null : file);
                    },
                    mimeType,
                    currentQuality
                );
            };

            compress(); // Start the compression loop
        };

        image.onerror = (error) => {
            URL.revokeObjectURL(url);
            resolve(options.fallbackToOriginal === false ? null : file);
        };

        image.src = url;
    });
};

export const convertImageToWebP = async (file: File, options: { targetSizeKB?: number; maxDimension?: number } = {}): Promise<File> => {
    return (await convertImageToFormat(file, {
        ...options,
        mimeType: 'image/webp',
        extension: 'webp',
        startQuality: 0.82,
        minQuality: 0.32,
        fallbackToOriginal: true,
    })) || file;
};

export const convertImageToAvif = (file: File, options: { targetSizeKB?: number; maxDimension?: number } = {}): Promise<File | null> => {
    return convertImageToFormat(file, {
        ...options,
        mimeType: 'image/avif',
        extension: 'avif',
        startQuality: 0.56,
        minQuality: 0.18,
        fallbackToOriginal: false,
    });
};

const HOMEPAGE_HERO_STATIC_URLS = new Map<string, string>([
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.url],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.url],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.url],
]);

const HOMEPAGE_HERO_STATIC_AVIF_URLS = new Map<string, string>([
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.avifUrl],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.avifUrl],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.path, OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.avifUrl],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.avifPath, OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.avifUrl],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.avifPath, OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.avifUrl],
    [OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.avifPath, OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.avifUrl],
]);

const HOMEPAGE_HERO_LEGACY_REPLACEMENTS = new Map<string, string>([
    [LEGACY_HOMEPAGE_HERO_PATHS.desktop, OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.url],
    [LEGACY_HOMEPAGE_HERO_PATHS.tablet, OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.url],
    [LEGACY_HOMEPAGE_HERO_PATHS.mobile, OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.url],
]);

const HOMEPAGE_HERO_LEGACY_AVIF_REPLACEMENTS = new Map<string, string>([
    [LEGACY_HOMEPAGE_HERO_PATHS.desktop, OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.avifUrl],
    [LEGACY_HOMEPAGE_HERO_PATHS.tablet, OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.avifUrl],
    [LEGACY_HOMEPAGE_HERO_PATHS.mobile, OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.avifUrl],
]);

function normalizeHomepageHeroImagePath(value?: string | null): string {
    return String(value || '')
        .trim()
        .replace(/^https?:\/\/[^/]+\//i, '')
        .replace(/^\/+/, '')
        .replace(/^r2\/site-assets\//, '')
        .replace(/^storage\/v1\/object\/public\/site-assets\//, '');
}

async function resolveHomepageHeroImageUrl(path: string | undefined, fallbackUrl: string): Promise<string> {
    const normalizedPath = normalizeHomepageHeroImagePath(path);
    if (!normalizedPath) return fallbackUrl;

    const staticUrl = HOMEPAGE_HERO_STATIC_URLS.get(normalizedPath);
    if (staticUrl) return staticUrl;

    const legacyReplacement = HOMEPAGE_HERO_LEGACY_REPLACEMENTS.get(normalizedPath);
    if (legacyReplacement) return legacyReplacement;

    return (await getPublicUrl('site-assets', normalizedPath)) || fallbackUrl;
}

async function resolveHomepageHeroAvifUrl(path: string | undefined, fallbackUrl: string): Promise<string> {
    const normalizedPath = normalizeHomepageHeroImagePath(path);
    if (!normalizedPath) return fallbackUrl;

    const staticUrl = HOMEPAGE_HERO_STATIC_AVIF_URLS.get(normalizedPath);
    if (staticUrl) return staticUrl;

    const legacyReplacement = HOMEPAGE_HERO_LEGACY_AVIF_REPLACEMENTS.get(normalizedPath);
    if (legacyReplacement) return legacyReplacement;

    if (/^hero-(desktop|tablet|mobile)-/i.test(normalizedPath) && normalizedPath.endsWith('.webp')) {
        const avifPath = normalizedPath.replace(/\.webp$/i, '.avif');
        return (await getPublicUrl('site-assets', avifPath)) || fallbackUrl;
    }

    if (normalizedPath.endsWith('.avif')) {
        return (await getPublicUrl('site-assets', normalizedPath)) || fallbackUrl;
    }

    return fallbackUrl;
}


// --- Data Fetching ---

export async function getServices(): Promise<Service[]> {
    return withPublicReadFallback('getServices', async () => {
        const servicesData = await fetchPublicRuntimeRest<any[]>('services?select=*,procedure_steps(*)&order=id.asc');

        const servicesWithUrls = await Promise.all(
            servicesData.map(async (service, index) => {
                const serviceFallbackImageUrl = getFallbackServiceImageUrl(service.id || index + 1);
                if (service.image_path && !isKnownMissingServiceImagePath(service.image_path)) {
                    service.image_url = (await getPublicUrl('site-assets', service.image_path)) || serviceFallbackImageUrl;
                } else {
                    service.image_url = serviceFallbackImageUrl;
                }
                if (service.procedure_steps && service.procedure_steps.length > 0) {
                    service.procedure_steps = await Promise.all(
                        service.procedure_steps.map(async (step: ProcedureStep) => {
                            if (step.image_path) {
                                step.image_url = await getPublicUrl('site-assets', step.image_path);
                            }
                            return step;
                        })
                    );
                    service.procedure_steps.sort(
                        (a: ProcedureStep, b: ProcedureStep) =>
                            Number(a.step_number || 0) - Number(b.step_number || 0)
                    );
                } else {
                    service.procedure_steps = [];
                }
                return service as Service;
            })
        );

        return servicesWithUrls;
    }, () => getFallbackServices());
}

export async function getAdminServices(options: { force?: boolean } = {}): Promise<Service[]> {
    if (!USE_D1_API) return getServices();
    return adminDataProvider.read('services', async () => {
        const rows = await readAllAdminPages<any>('/api/admin/services?include=steps', 'services');
        return Promise.all(rows.map(async (service, index) => {
            const fallback = getFallbackServiceImageUrl(service.id || index + 1);
            const procedureSteps = await Promise.all((service.procedure_steps || []).map(async (step: ProcedureStep) => ({
                ...step,
                image_url: step.image_path ? await getPublicUrl('site-assets', step.image_path) : step.image_url,
            })));
            return {
                ...service,
                image_url: service.image_path
                    ? (await getPublicUrl('site-assets', service.image_path)) || fallback
                    : fallback,
                procedure_steps: procedureSteps.sort((a, b) => Number(a.step_number || 0) - Number(b.step_number || 0)),
            } as Service;
        }));
    }, { force: options.force, maxAgeMs: 45_000 });
}

export async function getDoctors(): Promise<Doctor[]> {
    return withPublicReadFallback('getDoctors', async () => {
        const doctorsData = await fetchPublicRuntimeRest<any[]>('public_doctors_directory?select=*');

        const doctorsWithUrls: Doctor[] = await Promise.all(
            doctorsData.map(async (d) => {
                const docProfile = Array.isArray(d.doctors) ? d.doctors[0] : d.doctors;
                let avatarUrl = '';
                if (d.avatar_path) {
                    avatarUrl = (await getPublicUrl('avatars', d.avatar_path)) || '';
                }
                return {
                    id: d.id,
                    name: d.name,
                    avatar_path: d.avatar_path,
                    avatar_url: avatarUrl,
                    job_title: d.job_title || docProfile?.job_title || 'Bác sĩ Chuyên khoa',
                    specialization: d.specialization || docProfile?.specialization || 'Chuyên khoa Da liễu',
                    description: d.homepage_description || docProfile?.homepage_description || 'Bác sĩ tại Thế Giới Trị Mụn',
                    job_title_en: d.job_title_en || docProfile?.job_title_en,
                    job_title_ru: d.job_title_ru || docProfile?.job_title_ru,
                    job_title_cn: d.job_title_cn || docProfile?.job_title_cn,
                    specialization_en: d.specialization_en || docProfile?.specialization_en,
                    specialization_ru: d.specialization_ru || docProfile?.specialization_ru,
                    specialization_cn: d.specialization_cn || docProfile?.specialization_cn,
                    description_en: d.homepage_description_en || docProfile?.homepage_description_en,
                    description_ru: d.homepage_description_ru || docProfile?.homepage_description_ru,
                    description_cn: d.homepage_description_cn || docProfile?.homepage_description_cn,
                };
            })
        );
        return doctorsWithUrls;
    }, () => getFallbackDoctors());
}

export async function getBlogPosts(): Promise<BlogPost[]> {
    return withPublicReadFallback('getBlogPosts', async () => {
        const postsData = await fetchPublicRuntimeRest<any[]>('public_blog_posts?select=*&order=date.desc');

        const postsWithUrls = await Promise.all(
            postsData
            .filter((p) => {
                const normalized = String(p.slug || '').trim();
                return !EXCLUDED_BLOG_SLUGS.has(normalized) && !EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
            })
            .map(async (p) => {
                const author = Array.isArray(p.author)
                    ? p.author[0]
                    : (p.author || (p.author_name ? {
                        id: p.author_public_id || p.author_id,
                        name: p.author_name,
                        avatar_path: p.author_avatar_path,
                    } : null));

                if (author && author.avatar_path && !author.avatar_url) {
                    author.avatar_url = await getPublicUrl('avatars', author.avatar_path);
                }

                if (p.image_path && !p.image_url) {
                    p.image_url = await getPublicUrl('blog-images', p.image_path);
                }
                if (!p.image_url) {
                    p.image_url = getFallbackBlogImage(String(p.slug || 'blog'));
                }

                return { ...p, author };
            })
        );

        return postsWithUrls;
    }, () => getFallbackBlogPosts());
}

export async function getAdminBlogPosts(options: { force?: boolean } = {}): Promise<BlogPost[]> {
    if (!USE_D1_API) return getBlogPosts();
    return adminDataProvider.read('blog-posts', async () => {
        const rows = await readAllAdminPages<any>('/api/admin/blog-posts', 'posts');
        return Promise.all(rows
            .filter((post) => !EXCLUDED_BLOG_SLUGS.has(String(post.slug || '').trim()))
            .map(async (post) => ({
                ...post,
                image_url: post.image_path
                    ? (await getPublicUrl('blog-images', post.image_path)) || getFallbackBlogImage(String(post.slug || 'blog'))
                    : getFallbackBlogImage(String(post.slug || 'blog')),
                author: post.author || (post.author_name ? {
                    id: post.author_id,
                    name: post.author_name,
                } : null),
            } as BlogPost)));
    }, { force: options.force, maxAgeMs: 45_000 });
}

const BLOG_LIST_SELECT = 'slug,title,summary,title_en,title_ru,title_cn,summary_en,summary_ru,summary_cn,meta_description,meta_keywords,canonical_url,local_seo_tags,date,category_slug,image_path,author_id,author_public_id,author_name,author_avatar_path';
const BLOG_BASE_LIST_SELECT = 'slug,title,summary,title_en,title_ru,title_cn,summary_en,summary_ru,summary_cn,meta_description,meta_keywords,canonical_url,local_seo_tags,date,category_slug,image_path,author_id';
const BLOG_HOMEPAGE_SELECT = 'slug,title,summary,date,category_slug,image_path';
const BLOG_BASE_SELECT = '*, author:patients(id, name, avatar_path)';

const hydrateBlogPostRecord = async (postData: any, detailLoaded: boolean): Promise<BlogPost | null> => {
    if (!postData) return null;

    const normalized = String(postData.slug || '').trim();
    if (EXCLUDED_BLOG_SLUGS.has(normalized) || EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return null;
    }

    const author = Array.isArray(postData.author)
        ? postData.author[0]
        : (postData.author || (postData.author_name ? {
            id: postData.author_public_id || postData.author_id,
            name: postData.author_name,
            avatar_path: postData.author_avatar_path,
        } : null));

    if (author && author.avatar_path && !author.avatar_url) {
        author.avatar_url = await getPublicUrl('avatars', author.avatar_path);
    }
    if (postData.image_path && !postData.image_url) {
        postData.image_url = await getPublicUrl('blog-images', postData.image_path);
    }
    if (!postData.image_url) {
        postData.image_url = getFallbackBlogImage(String(postData.slug || 'blog'));
    }

    return {
        ...postData,
        detail_loaded: detailLoaded,
        author,
    } as BlogPost;
};

const fetchBlogPostFromBaseTable = async (slug: string): Promise<BlogPost | null> => {
    try {
        const runtimeData = await fetchPublicRuntimeMaybeSingle<any>(`blog_posts?select=${encodeURIComponent(BLOG_BASE_SELECT)}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
        return hydrateBlogPostRecord(runtimeData || null, true);
    } catch {
        const fallbackResult = await supabase
            .from('blog_posts')
            .select(BLOG_BASE_SELECT)
            .eq('slug', slug)
            .maybeSingle();

        if (fallbackResult.error) throw new Error(`Error fetching post detail: ${fallbackResult.error.message}`);
        return hydrateBlogPostRecord(fallbackResult.data || null, true);
    }
};

const fetchPublicBlogPostDetailViaRuntime = async (slug: string): Promise<BlogPost | null> => {
    const publicPostData = await fetchPublicRuntimeMaybeSingle<any>(`public_blog_posts?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const hydratedPublicPost = await hydrateBlogPostRecord(publicPostData, true);
    if (hydratedPublicPost && String(hydratedPublicPost.content || '').trim().length > 0) {
        return hydratedPublicPost;
    }

    const runtimeData = await fetchPublicRuntimeMaybeSingle<any>(`blog_posts?select=${encodeURIComponent(BLOG_BASE_SELECT)}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    return hydrateBlogPostRecord(runtimeData || null, true);
};

export async function getBlogPostsLite(): Promise<BlogPost[]> {
    return withPublicReadFallback('getBlogPostsLite', async () => {
        const postsData = await fetchPublicRuntimeRest<any[]>(`public_blog_posts?select=${encodeURIComponent(BLOG_LIST_SELECT)}&order=date.desc`);

        const postsWithUrls = await Promise.all(
            postsData
                .filter((p) => {
                    const normalized = String(p.slug || '').trim();
                    return !EXCLUDED_BLOG_SLUGS.has(normalized) && !EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
                })
                .map(async (p) => {
                    const author = Array.isArray(p.author)
                        ? p.author[0]
                        : (p.author || (p.author_name ? {
                            id: p.author_public_id || p.author_id,
                            name: p.author_name,
                            avatar_path: p.author_avatar_path,
                        } : null));

                    if (author && author.avatar_path && !author.avatar_url) {
                        author.avatar_url = await getPublicUrl('avatars', author.avatar_path);
                    }

                    if (p.image_path && !p.image_url) {
                        p.image_url = await getPublicUrl('blog-images', p.image_path);
                    }
                    if (!p.image_url) {
                        p.image_url = getFallbackBlogImage(String(p.slug || 'blog'));
                    }

                    return {
                        ...p,
                        content: '',
                        detail_loaded: false,
                        author,
                    } as BlogPost;
                })
        );

        return postsWithUrls;
    }, () => getFallbackBlogPostsLite());
}

export async function getFeaturedBlogPostsLite(featuredSlugs: string[]): Promise<BlogPost[]> {
    if (!featuredSlugs.length) return [];

    return withPublicReadFallback('getFeaturedBlogPostsLite', async () => {
        const allPosts = await fetchPublicRuntimeRest<any[]>(`public_blog_posts?select=${encodeURIComponent(BLOG_HOMEPAGE_SELECT)}&order=date.desc`);
        const postsData = allPosts.filter((post) => featuredSlugs.includes(post.slug));

        const featuredOrder = new Map(featuredSlugs.map((slug, index) => [slug, index]));
        const postsWithUrls = await Promise.all(
            postsData
                .filter((p) => {
                    const normalized = String(p.slug || '').trim();
                    return !EXCLUDED_BLOG_SLUGS.has(normalized) && !EXCLUDED_BLOG_SLUG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
                })
                .sort((a, b) => (featuredOrder.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (featuredOrder.get(b.slug) ?? Number.MAX_SAFE_INTEGER))
                .map(async (p) => {
                    if (p.image_path && !p.image_url) {
                        p.image_url = await getPublicUrl('blog-images', p.image_path);
                    }
                    if (!p.image_url) {
                        p.image_url = getFallbackBlogImage(String(p.slug || 'blog'));
                    }

                    return {
                        ...p,
                        summary: p.summary || '',
                        content: '',
                        detail_loaded: false,
                        author: null,
                    } as BlogPost;
                })
        );

        return postsWithUrls;
    }, () => getFallbackFeaturedBlogPostsLite(featuredSlugs));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    return withPublicReadFallback('getBlogPostBySlug', async () => fetchPublicBlogPostDetailViaRuntime(slug), () => getFallbackBlogPostBySlug(slug));
}

export async function getBlogPostBySlugAdmin(slug: string): Promise<BlogPost | null> {
    if (USE_D1_API) {
        const posts = await getAdminBlogPosts();
        return posts.find((post) => post.slug === slug) || null;
    }
    return withPublicReadFallback('getBlogPostBySlugAdmin', async () => fetchBlogPostFromBaseTable(slug), () => getFallbackBlogPostBySlug(slug));
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
    return withPublicReadFallback('getBlogCategories', async () => {
        return await fetchPublicRuntimeRest<BlogCategory[]>('blog_categories?select=*&order=name.asc');
    }, () => getFallbackBlogCategories());
}

export async function getAdminBlogCategories(options: { force?: boolean } = {}): Promise<BlogCategory[]> {
    if (!USE_D1_API) return getBlogCategories();
    return adminDataProvider.read('blog-categories', () => readAllAdminPages<BlogCategory>(
        '/api/admin/blog-categories',
        'categories',
    ), { force: options.force, maxAgeMs: 45_000 });
}

export async function getFaqItems(): Promise<FAQItem[]> {
    return withPublicReadFallback('getFaqItems', async () => {
        return await fetchPublicRuntimeRest<FAQItem[]>('faq_items?select=*&order=id.asc');
    }, () => getFallbackFaqItems());
}

export async function getProductCategories(): Promise<ProductCategory[]> {
    return withPublicReadFallback('getProductCategories', async () => {
        return await fetchPublicRuntimeRest<ProductCategory[]>('product_categories?select=*&order=name.asc');
    }, () => getFallbackProductCategories());
}

export async function getAdminProductCategories(options: { force?: boolean } = {}): Promise<ProductCategory[]> {
    if (!USE_D1_API) return getProductCategories();
    return adminDataProvider.read('product-categories', () => readAllAdminPages<ProductCategory>(
        '/api/admin/product-categories',
        'categories',
    ), { force: options.force, maxAgeMs: 45_000 });
}

async function processProductsWithImages(
    productsData: any[],
    options: { maxImagesPerProduct?: number } = {},
): Promise<Product[]> {
    const productsWithUrls = await Promise.all(
        productsData.map(async (p) => {
            const categoryRecord = Array.isArray(p.category) ? p.category[0] : p.category;
            if (p.images && p.images.length > 0) {
                p.images.sort((a: ProductImage, b: ProductImage) => {
                    if (a.is_primary && !b.is_primary) return -1;
                    if (!a.is_primary && b.is_primary) return 1;
                    return Number(a.display_order || 0) - Number(b.display_order || 0);
                });
                const selectedImages = options.maxImagesPerProduct
                    ? p.images.slice(0, options.maxImagesPerProduct)
                    : p.images;
                p.images = await Promise.all(
                    selectedImages.map(async (img: ProductImage) => {
                        img.image_url = await getPublicUrl('product-images', img.image_path);
                        return img;
                    })
                );
            } else {
                p.images = [];
            }
            if (p.long_description && p.long_description.length > 0) {
                p.long_description = await Promise.all(
                    p.long_description.map(async (block: any) => {
                        if (block.type === 'image' && block.image_path) {
                            block.image_url = await getPublicUrl('product-images', block.image_path);
                        }
                        return block;
                    })
                )
            }
            return {
                ...p,
                category: categoryRecord || p.category,
                category_slug: categoryRecord?.slug || p.category_slug || undefined,
                price: Number(p.price || 0),
                vat_rate: p.vat_rate != null ? Number(p.vat_rate) : DEFAULT_PRODUCT_VAT_RATE,
                stock_quantity: Number(p.stock_quantity || 0),
                low_stock_threshold: p.low_stock_threshold != null ? Number(p.low_stock_threshold) : undefined,
                sold_count: p.sold_count != null ? Number(p.sold_count) : undefined,
            } as Product;
        })
    );
    return productsWithUrls;
}

export async function getProducts(): Promise<Product[]> {
    return withPublicReadFallback('getProducts', async () => {
        const select = '*, category:product_categories(*), images:product_images(*)';
        const rows = await fetchPublicRuntimeRest<any[]>(`products?select=${encodeURIComponent(select)}&is_published=eq.true&archived_at=is.null&order=name.asc`);
        const products = await processProductsWithImages(rows);
        return products.map((product) => ({ ...product, detail_loaded: true }));
    }, () => getFallbackProducts({ detailLoaded: true }));
}

export async function getProductsLite(): Promise<Product[]> {
    return withPublicReadFallback('getProductsLite', async () => {
        const rows = await fetchPublicRuntimeRest<any[]>(`products?select=${encodeURIComponent(PRODUCT_LIST_LITE_SELECT)}&is_published=eq.true&archived_at=is.null&images.is_primary=eq.true&images.order=display_order.asc&order=name.asc`);
        const products = await processProductsWithImages(rows, { maxImagesPerProduct: 1 });
        return products.map((product) => ({ ...product, detail_loaded: false }));
    }, () => getFallbackProducts({ detailLoaded: false }));
}

const PRODUCT_LIST_LITE_SELECT = 'id,slug,name,name_en,name_ru,name_cn,description,price,vat_rate,stock_quantity,low_stock_threshold,sku,is_published,is_featured,sold_count,category_id,brand,volume,origin,texture,created_at,category:product_categories(id,slug,name,name_en,name_ru,name_cn),images:product_images(id,image_path,is_primary,display_order)';
const PRODUCT_SEARCH_CATALOG_SELECT = 'id,slug,name,name_en,name_ru,name_cn,price,stock_quantity,brand,category:product_categories(id,slug,name,name_en,name_ru,name_cn),images:product_images(id,image_path,is_primary,display_order)';
const HOMEPAGE_PRODUCT_SELECT = 'id,slug,name,price,vat_rate,is_featured,sold_count,category_id,brand,volume,ingredients,ingredients_en,ingredients_ru,ingredients_cn,images:product_images(id,image_path,is_primary,display_order)';

export async function getProductSearchCatalog(): Promise<Product[]> {
    return withPublicReadFallback('getProductSearchCatalog', async () => {
        const rows = await fetchPublicRuntimeRest<any[]>(`products?select=${encodeURIComponent(PRODUCT_SEARCH_CATALOG_SELECT)}&is_published=eq.true&archived_at=is.null&images.is_primary=eq.true&images.order=display_order.asc&order=name.asc`);
        const products = await processProductsWithImages(rows, { maxImagesPerProduct: 1 });
        return products.map((product) => ({ ...product, detail_loaded: false }));
    }, () => getFallbackProducts({ detailLoaded: false }).map((product) => ({
        ...product,
        detail_loaded: false as const,
        images: product.images?.slice(0, 1) || [],
    })));
}

export async function getHomepageProductsLite(featuredCategoryIds: number[] = []): Promise<Product[]> {
    return withPublicReadFallback('getHomepageProductsLite', async () => {
        const mergedRows: any[] = [];
        const seenIds = new Set<number>();
        const select = `${HOMEPAGE_PRODUCT_SELECT},category:product_categories(id,slug,name,is_featured)`;
        const sourceRows = await fetchPublicRuntimeRest<any[]>(`products?select=${encodeURIComponent(select)}&is_published=eq.true&archived_at=is.null&order=id.desc&limit=64`);

        const productGroups = [
            sourceRows.filter((row) => row.is_featured).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).slice(0, 10),
            [...sourceRows].sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0)).slice(0, 10),
            [...sourceRows].sort((a, b) => Number(b.id || 0) - Number(a.id || 0)).slice(0, 10),
            ...featuredCategoryIds.map((categoryId) =>
                sourceRows
                    .filter((row) => Number(row.category_id) === Number(categoryId))
                    .sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0))
                    .slice(0, 10)
            ),
        ];

        for (const group of productGroups) {
            for (const row of group || []) {
                if (!row || seenIds.has(row.id)) continue;
                seenIds.add(row.id);
                mergedRows.push(row);
            }
        }

        const products = await processProductsWithImages(mergedRows);
        return products.map((product) => ({ ...product, detail_loaded: false }));
    }, () => []);
}

export async function getProductByIdOrSlug(idOrSlug: number | string): Promise<Product | null> {
    return withPublicReadFallback('getProductByIdOrSlug', async () => {
        const isNumeric = typeof idOrSlug === 'number' || /^\d+$/.test(String(idOrSlug));
        const select = '*, category:product_categories(*), images:product_images(*)';
        const row = await fetchPublicRuntimeMaybeSingle<any>(
            isNumeric
                ? `products?select=${encodeURIComponent(select)}&id=eq.${Number(idOrSlug)}&is_published=eq.true&archived_at=is.null&limit=1`
                : `products?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(String(idOrSlug))}&is_published=eq.true&archived_at=is.null&limit=1`
        );

        if (!row) return null;
        const [product] = await processProductsWithImages([row]);
        return product ? { ...product, detail_loaded: true } : null;
    }, () => getFallbackProductByIdOrSlug(idOrSlug));
}

export async function getAllProducts(options: { force?: boolean } = {}): Promise<Product[]> { // For admin
    if (USE_D1_API) {
        return adminDataProvider.read('products', async () => {
            const products = await readAllAdminPages<any>('/api/admin/products', 'products');
            return processProductsWithImages(products);
        }, { force: options.force, maxAgeMs: 30_000 });
    }
    return withSessionReadRetry('getAllProducts', async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*, category:product_categories(*), images:product_images(*)')
            .is('archived_at', null)
            .order('name')
            .order('display_order', { referencedTable: 'product_images' });

        if (error) throw new Error(`Error fetching all products: ${error.message}`);
        return processProductsWithImages(data || []);
    });
}


async function getPublicUrl(bucket: string, path: string | undefined | null): Promise<string | undefined> {
    const resolved = resolveImagePath(path, bucket);
    if (!resolved) return undefined;
    if (resolved.externalUrl) return resolved.externalUrl;
    if (!resolved.path) return undefined;

    const effectiveBucket = resolved.bucket || bucket;
    if (shouldUseR2ForBucket(effectiveBucket)) {
        return buildR2PublicImageUrl(effectiveBucket, resolved.path);
    }

    const { data } = supabase.storage.from(effectiveBucket).getPublicUrl(resolved.path);
    if (data.publicUrl) return data.publicUrl;
    return undefined;
}

export async function getHomepageHero(): Promise<HomepageHero> {
    return withPublicReadFallback('getHomepageHero', async () => {
        let data = await fetchPublicRuntimeMaybeSingle<any>('homepage_hero?select=*&limit=1');

        if (!data) {
            data = { ...FALLBACK_HOMEPAGE_HERO };
        }

        data.image_desktop_url = await resolveHomepageHeroImageUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_url || '');
        data.image_desktop_avif_url = await resolveHomepageHeroAvifUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_avif_url || '');
        data.image_tablet_url = await resolveHomepageHeroImageUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_url || '');
        data.image_tablet_avif_url = await resolveHomepageHeroAvifUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_avif_url || '');
        data.image_mobile_url = await resolveHomepageHeroImageUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_url || '');
        data.image_mobile_avif_url = await resolveHomepageHeroAvifUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_avif_url || '');

        return {
            ...FALLBACK_HOMEPAGE_HERO,
            ...data,
            image_desktop_url: data.image_desktop_url || FALLBACK_HOMEPAGE_HERO.image_desktop_url,
            image_desktop_avif_url: data.image_desktop_avif_url || FALLBACK_HOMEPAGE_HERO.image_desktop_avif_url,
            image_tablet_url: data.image_tablet_url || FALLBACK_HOMEPAGE_HERO.image_tablet_url,
            image_tablet_avif_url: data.image_tablet_avif_url || FALLBACK_HOMEPAGE_HERO.image_tablet_avif_url,
            image_mobile_url: data.image_mobile_url || FALLBACK_HOMEPAGE_HERO.image_mobile_url,
            image_mobile_avif_url: data.image_mobile_avif_url || FALLBACK_HOMEPAGE_HERO.image_mobile_avif_url,
        };
    }, () => getFallbackHomepageHero());
}

export async function getFeaturedServiceIds(): Promise<number[]> {
    return withPublicReadFallback('getFeaturedServiceIds', async () => {
        const data = await fetchPublicRuntimeRest<Array<{ service_id: number }>>('featured_services?select=service_id');
        return (data || []).map((item) => item.service_id);
    }, () => getFallbackFeaturedServiceIds());
}


export async function getFeaturedDoctorIds(): Promise<string[]> {
    return withPublicReadFallback('getFeaturedDoctorIds', async () => {
        const data = await fetchPublicRuntimeRest<Array<{ doctor_id: string }>>('featured_doctors?select=doctor_id');
        return (data || []).map((item) => item.doctor_id);
    }, () => getFallbackFeaturedDoctorIds());
}

export async function getFeaturedPostSlugs(): Promise<string[]> {
    return withPublicReadFallback('getFeaturedPostSlugs', async () => {
        const data = await fetchPublicRuntimeRest<Array<{ post_slug: string }>>('featured_posts?select=post_slug');
        return (data || []).map((item) => item.post_slug);
    }, () => getFallbackFeaturedPostSlugs());
}

export async function getAboutPageData(): Promise<AboutPageData> {
    return withPublicReadFallback('getAboutPageData', async () => {
        let finalContent: any | null = null;
        let featuresData: any[] = [];
        let valuesData: any[] = [];
        const [runtimeContent, runtimeFeatures, runtimeValues] = await Promise.all([
            fetchPublicRuntimeMaybeSingle<any>('about_page_content?select=*&limit=1'),
            fetchPublicRuntimeRest<any[]>('about_features?select=*&order=display_order.asc'),
            fetchPublicRuntimeRest<any[]>('about_values?select=*&order=display_order.asc'),
        ]);
        finalContent = runtimeContent;
        featuresData = runtimeFeatures || [];
        valuesData = runtimeValues || [];

        if (!finalContent) {
            finalContent = {
                id: 1,
                header_title: 'Câu chuyện về Thế Giới Trị Mụn',
                header_subtitle: 'Chúng tôi tin rằng một làn da khỏe đẹp là nền tảng của sự tự tin. Tại Thế Giới Trị Mụn, chúng tôi kết hợp chuyên môn y khoa sâu sắc với công nghệ tiên tiến để mang đến những giải pháp chăm sóc da hiệu quả và an toàn nhất.',
                image_path: 'default-about.jpg',
                mission_title: 'Sứ mệnh & Tầm nhìn',
                mission_text: "Sứ mệnh của Thế Giới Trị Mụn là mang lại các giải pháp chăm sóc da toàn diện, an toàn và hiệu quả nhất, dựa trên nền tảng y học chứng cứ. Chúng tôi cam kết đồng hành cùng khách hàng trên hành trình chinh phục một làn da khỏe đẹp và một sự tự tin trọn vẹn.",
                vision_text: "Trở thành phòng khám da liễu thẩm mỹ hàng đầu Việt Nam, là biểu tượng của sự uy tín, chuyên nghiệp và tận tâm, nơi mọi khách hàng đều tìm thấy phiên bản tốt nhất của chính mình.",
                values_title: 'Giá trị cốt lõi',
                values_subtitle: 'Kim chỉ nam cho mọi hoạt động của chúng tôi.'
            };
        }

        finalContent.image_url = await getPublicUrl('site-assets', finalContent.image_path);

        return {
            content: finalContent,
            reasonsToChoose: featuresData || [],
            coreValues: valuesData || [],
        };
    }, () => getFallbackAboutPageData());
}

export async function getSiteInfo(): Promise<SiteInfo> {
    return withPublicReadFallback('getSiteInfo', async () => {
        let data = await fetchPublicRuntimeMaybeSingle<any>('site_info?select=*&limit=1');

        if (!data) {
            data = {
                id: 1,
                clinic_name: 'Thế Giới Trị Mụn',
                logo_light_path: '',
                logo_dark_path: '',
                favicon_path: ''
            };
        }

        data.logo_light_url = await getPublicUrl('site-assets', data.logo_light_path);
        data.logo_dark_url = await getPublicUrl('site-assets', data.logo_dark_path);
        data.favicon_url = await getPublicUrl('site-assets', data.favicon_path);

        return data;
    }, () => getFallbackSiteInfo());
}

export async function getFooterContent(): Promise<FooterContent> {
    return withPublicReadFallback('getFooterContent', async () => {
        const data = await fetchPublicRuntimeMaybeSingle<FooterContent>('footer_content?select=*&limit=1');
        if (data) return data;
        return {
            about_text: 'Phòng khám chuyên khoa Da liễu. Mang đến vẻ đẹp và sự tự tin cho bạn.',
            address: '123 Đường Sức Khỏe, Quận 1, TP. HCM',
            phone: '(028) 3456 7890',
            email: 'contact@thegioitrimun.vn',
            working_hours_weekday: 'Thứ 2 - Thứ 6: 9:00 - 20:00',
            working_hours_weekend: 'Thứ 7 - Chủ Nhật: 9:00 - 18:00',
            copyright_text: `© ${new Date().getFullYear()} Thế Giới Trị Mụn. Bản quyền đã được bảo hộ.`,
            zalo_url: '',
            messenger_url: '',
            floating_contact_enabled: true,
        };
    }, () => getFallbackFooterContent());
}

export async function getAuthPageImages(): Promise<AuthPageImages> {
    return withPublicReadFallback('getAuthPageImages', async () => {
        let data: any = null;
        try {
            data = await fetchPublicRuntimeMaybeSingle<any>('auth_page_images?select=id,login_image_path&limit=1');
        } catch (error) {
            if (USE_D1_API) throw error;
            const directResult = await supabase
                .from('auth_page_images')
                .select('id,login_image_path')
                .limit(1)
                .maybeSingle();

            if (directResult.error) {
                throw new Error(`Error fetching auth page images: ${directResult.error.message}`);
            }

            data = directResult.data;
        }

        if (!data) {
            data = {
                id: 1,
                login_image_path: '', // Default path can be empty
            };
        }

        (data as AuthPageImages).login_image_url = await getPublicUrl('site-assets', data.login_image_path);
        return data as AuthPageImages;
    }, () => getFallbackAuthPageImages());
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
    return withPublicReadFallback('getPaymentSettings', async () => {
        const data = await fetchPublicRuntimeMaybeSingle<PaymentSettings>('payment_settings?select=*&limit=1');
        if (data) return data;
        return {
            id: 1,
            bank_bin: '',
            account_number: '',
            account_holder_name: ''
        };
    }, () => getFallbackPaymentSettings());
}

export type AdminSiteSnapshot = {
    aboutData: AboutPageData;
    authPageImages: AuthPageImages;
    faqItems: FAQItem[];
    featuredDoctorIds: string[];
    featuredPostSlugs: string[];
    featuredServiceIds: number[];
    footerContent: FooterContent;
    homepageHero: HomepageHero;
    paymentSettings: PaymentSettings;
    siteInfo: SiteInfo;
};

export async function getAdminSiteSnapshot(options: { force?: boolean } = {}): Promise<AdminSiteSnapshot> {
    if (!USE_D1_API) {
        const [aboutData, authPageImages, faqItems, featuredDoctorIds, featuredPostSlugs,
            featuredServiceIds, footerContent, homepageHero, paymentSettings, siteInfo] = await Promise.all([
            getAboutPageData(), getAuthPageImages(), getFaqItems(), getFeaturedDoctorIds(), getFeaturedPostSlugs(),
            getFeaturedServiceIds(), getFooterContent(), getHomepageHero(), getPaymentSettings(), getSiteInfo(),
        ]);
        return { aboutData, authPageImages, faqItems, featuredDoctorIds, featuredPostSlugs, featuredServiceIds, footerContent, homepageHero, paymentSettings, siteInfo };
    }

    return adminDataProvider.read('site-snapshot', async () => {
        const [aboutContent, aboutFeatures, aboutValues, authImages, faqItems, featuredDoctors,
            featuredPosts, featuredServices, footerRows, heroRows, paymentRows, siteRows] = await Promise.all([
            getAdminSiteContent<any>('about_page_content', { force: options.force }),
            getAdminSiteContent<AboutFeature>('about_features', { force: options.force }),
            getAdminSiteContent<AboutValue>('about_values', { force: options.force }),
            getAdminSiteContent<AuthPageImages>('auth_page_images', { force: options.force }),
            getAdminSiteContent<FAQItem>('faq_items', { force: options.force }),
            getAdminSiteContent<any>('featured_doctors', { force: options.force }),
            getAdminSiteContent<any>('featured_posts', { force: options.force }),
            getAdminSiteContent<any>('featured_services', { force: options.force }),
            getAdminSiteContent<FooterContent>('footer_content', { force: options.force }),
            getAdminSiteContent<HomepageHero>('homepage_hero', { force: options.force }),
            getAdminSiteContent<PaymentSettings>('payment_settings', { force: options.force }),
            getAdminSiteContent<SiteInfo>('site_info', { force: options.force }),
        ]);

        const aboutFallback = getFallbackAboutPageData();
        const aboutRecord: any = aboutContent[0] || aboutFallback.content;
        aboutRecord.image_url = aboutRecord.image_path ? await getPublicUrl('site-assets', aboutRecord.image_path) : aboutRecord.image_url;
        const siteInfo = { ...getFallbackSiteInfo(), ...(siteRows[0] || {}) } as SiteInfo;
        siteInfo.logo_light_url = await getPublicUrl('site-assets', siteInfo.logo_light_path);
        siteInfo.logo_dark_url = await getPublicUrl('site-assets', siteInfo.logo_dark_path);
        siteInfo.favicon_url = await getPublicUrl('site-assets', siteInfo.favicon_path);
        const authPageImages = { ...getFallbackAuthPageImages(), ...(authImages[0] || {}) } as AuthPageImages;
        authPageImages.login_image_url = await getPublicUrl('site-assets', authPageImages.login_image_path);
        const rawHero = { ...FALLBACK_HOMEPAGE_HERO, ...(heroRows[0] || {}) } as HomepageHero;
        const homepageHero = {
            ...rawHero,
            image_desktop_url: await resolveHomepageHeroImageUrl(rawHero.image_desktop_path, rawHero.image_desktop_url || ''),
            image_desktop_avif_url: await resolveHomepageHeroAvifUrl(rawHero.image_desktop_path, rawHero.image_desktop_avif_url || ''),
            image_tablet_url: await resolveHomepageHeroImageUrl(rawHero.image_tablet_path, rawHero.image_tablet_url || ''),
            image_tablet_avif_url: await resolveHomepageHeroAvifUrl(rawHero.image_tablet_path, rawHero.image_tablet_avif_url || ''),
            image_mobile_url: await resolveHomepageHeroImageUrl(rawHero.image_mobile_path, rawHero.image_mobile_url || ''),
            image_mobile_avif_url: await resolveHomepageHeroAvifUrl(rawHero.image_mobile_path, rawHero.image_mobile_avif_url || ''),
        } as HomepageHero;

        return {
            aboutData: {
                content: aboutRecord,
                reasonsToChoose: aboutFeatures.length ? aboutFeatures : aboutFallback.reasonsToChoose,
                coreValues: aboutValues.length ? aboutValues : aboutFallback.coreValues,
            },
            authPageImages,
            faqItems,
            featuredDoctorIds: featuredDoctors.map((item) => String(item.doctor_id ?? item.id)).filter(Boolean),
            featuredPostSlugs: featuredPosts.map((item) => String(item.post_slug ?? item.slug ?? item.id)).filter(Boolean),
            featuredServiceIds: featuredServices.map((item) => Number(item.service_id ?? item.id)).filter((id) => Number.isFinite(id) && id > 0),
            footerContent: { ...getFallbackFooterContent(), ...(footerRows[0] || {}) } as FooterContent,
            homepageHero,
            paymentSettings: { ...getFallbackPaymentSettings(), ...(paymentRows[0] || {}) } as PaymentSettings,
            siteInfo,
        };
    }, { force: options.force, maxAgeMs: 45_000 });
}

// --- User Data ---

export async function getUserProfile(userId: string): Promise<PatientProfile> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ profile: PatientProfile }>('/api/account/profile');
        if (payload.profile.id !== userId) throw new Error('Phiên tài khoản không khớp.');
        return payload.profile;
    }
    return withSessionReadRetry('getUserProfile', async () => {
        const profileResult = await supabase
            .from('patients')
            .select('*')
            .eq('id', userId)
            .single();
        if (profileResult.error) throw new Error(profileResult.error.message);
        const profile: PatientProfile = profileResult.data;
        profile.avatar_url = await getPublicUrl('avatars', profile.avatar_path);
        return profile;
    });
}

export async function getUserData(userId: string): Promise<UserData | null> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<UserData>('/api/account/me');
        if (payload.profile.id !== userId) throw new Error('Phiên tài khoản không khớp.');
        payload.product_orders = (payload.product_orders || []).map(normalizeProductOrderRow);
        return payload;
    }
    const profile = await getUserProfile(userId);

    const appointmentsResult = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', userId);
    if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
    const appointments: Appointment[] = appointmentsResult.data || [];

    const medicalRecordsResult = await supabase
        .from('medical_records')
        .select(`*, services:performed_services(*), prescriptions:prescribed_medications(*), invoice:invoices(*)`)
        .eq('patient_id', userId);
    if (medicalRecordsResult.error) throw new Error(medicalRecordsResult.error.message);

    const medical_records: any[] = medicalRecordsResult.data || [];
    const finalMedicalRecords: MedicalRecord[] = medical_records.map((r: any) => ({ ...r, invoice: Array.isArray(r.invoice) ? r.invoice[0] : r.invoice }));

    const documentsResult = await supabase
        .from('patient_uploaded_documents')
        .select('*')
        .eq('patient_id', userId)
        .order('created_at', { ascending: false });
    if (documentsResult.error) throw new Error(documentsResult.error.message);
    const documents: PatientDocument[] = documentsResult.data || [];
    for (const doc of documents) {
        doc.public_url = await getPublicUrl('patient-documents', doc.file_path);
    }

    const wishlistResult = await supabase
        .from('user_wishlist')
        .select('product_id')
        .eq('user_id', userId);
    if (wishlistResult.error) throw new Error(wishlistResult.error.message);
    const wishlist: number[] = (wishlistResult.data || []).map(item => item.product_id);

    const ordersResult = await supabase
        .from('product_orders')
        .select(`
            *,
            order_items:product_order_items (
                *,
                product:products (
                    id,
                    name,
                    images:product_images (
                        image_path
                    )
                )
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (ordersResult.error) throw new Error(ordersResult.error.message);
    const product_orders: any[] = ordersResult.data || [];

    // Process product orders to add main image URL
    for (const order of product_orders) {
        if (order.order_items) {
            for (const item of order.order_items) {
                if (item.product && item.product.images && item.product.images.length > 0) {
                    item.product.main_image_url = await getPublicUrl('product-images', item.product.images[0].image_path);
                    delete item.product.images; // Clean up, not needed in UI
                }
            }
        }
    }

    return {
        profile,
        appointments,
        medical_records: finalMedicalRecords,
        documents,
        wishlist,
        product_orders: product_orders.map(normalizeProductOrderRow),
        detail_loaded: true,
    };
}

export async function getUserWishlistProductIds(userId: string): Promise<number[]> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<UserData>('/api/account/me');
        if (payload.profile.id !== userId) throw new Error('Phiên tài khoản không khớp.');
        return payload.wishlist || [];
    }
    return withSessionReadRetry('getUserWishlistProductIds', async () => {
        const wishlistResult = await supabase
            .from('user_wishlist')
            .select('product_id')
            .eq('user_id', userId);

        if (wishlistResult.error) throw new Error(wishlistResult.error.message);
        return (wishlistResult.data || []).map((item) => item.product_id);
    });
}

export async function getAllPatients(options: { force?: boolean } = {}): Promise<PatientProfile[]> {
    if (USE_D1_API) {
        return adminDataProvider.read('users', () => readAllAdminPages<PatientProfile>(
            '/api/admin/users',
            'users',
        ), { force: options.force, maxAgeMs: 30_000 });
    }
    return withSessionReadRetry('getAllPatients', async () => {
        const { data, error } = await supabase.from('patients').select('*').order('name');
        if (error) throw new Error(error.message);
        return data || [];
    });
}

export type AdminUserDetail = {
    user: PatientProfile;
    orders: ProductOrder[];
    appointments: Appointment[];
    medicalRecords: MedicalRecord[];
    documents: PatientDocument[];
};

export async function getAdminUserDetail(userId: string, options: { force?: boolean } = {}): Promise<AdminUserDetail> {
    if (!USE_D1_API) {
        const user = (await getAllPatients()).find((item) => item.id === userId);
        if (!user) throw new Error('Không tìm thấy người dùng.');
        return { user, orders: [], appointments: [], medicalRecords: [], documents: [] };
    }
    return adminDataProvider.read(`user-detail:${userId}`, async () => {
        const payload = await d1ApiFetch<any>(`/api/admin/users/${encodeURIComponent(userId)}`);
        return {
            user: payload.user,
            orders: (payload.orders || []).map(normalizeProductOrderRow),
            appointments: payload.appointments || [],
            medicalRecords: payload.medicalRecords || [],
            documents: payload.documents || [],
        };
    }, { force: options.force, maxAgeMs: 20_000 });
}

export async function getAdminAppointments(options: { force?: boolean } = {}): Promise<Appointment[]> {
    if (!USE_D1_API) return [];
    return adminDataProvider.read('appointments', () => readAllAdminPages<Appointment>(
        '/api/admin/appointments',
        'appointments',
    ), { force: options.force, maxAgeMs: 20_000 });
}

export type AdminSystemCapabilities = {
    features: Record<string, boolean | string[]>;
    counts: Record<string, number>;
    tables: string[];
};

export async function getAdminSystemCapabilities(options: { force?: boolean } = {}): Promise<AdminSystemCapabilities> {
    if (!USE_D1_API) return { features: { database: false }, counts: {}, tables: [] };
    return adminDataProvider.read('system-capabilities', async () => {
        const payload = await d1ApiFetch<{ data: AdminSystemCapabilities }>('/api/admin/system/capabilities');
        return payload.data;
    }, { force: options.force, maxAgeMs: 60_000 });
}

export type AdminSystemOperations = {
    auditLog: Array<Record<string, any>>;
    migrationIssues: Array<Record<string, any>>;
    notificationOutbox: Array<Record<string, any>>;
    shippingOutbox: Array<Record<string, any>>;
    shipments: Array<Record<string, any>>;
    reportSchedules: Array<Record<string, any>>;
    integrations: Record<string, { enabled: boolean; status: string }>;
};

export async function getAdminSystemOperations(options: { force?: boolean } = {}): Promise<AdminSystemOperations> {
    const empty: AdminSystemOperations = {
        auditLog: [], migrationIssues: [], notificationOutbox: [], shippingOutbox: [],
        shipments: [], reportSchedules: [], integrations: {},
    };
    if (!USE_D1_API) return empty;
    return adminDataProvider.read('system-operations', async () => {
        const payload = await d1ApiFetch<{ data: AdminSystemOperations }>('/api/admin/system/operations');
        return payload.data || empty;
    }, { force: options.force, maxAgeMs: 20_000 });
}

export async function getDoctorDetails(options: { force?: boolean } = {}): Promise<DoctorDetail[]> {
    if (USE_D1_API) {
        return adminDataProvider.read('doctor-details', async () => {
            const [users, doctorProfiles] = await Promise.all([
                getAllPatients({ force: options.force }),
                getAdminSiteContent<DoctorProfile>('doctors', { force: options.force }),
            ]);
            const doctors = new Map(doctorProfiles.map((profile) => [String(profile.id), profile]));
            return users.filter((profile) => ['doctor', 'admin', 'master_admin'].includes(profile.role))
                .map((profile) => ({ ...profile, doctor_profile: doctors.get(profile.id) || null }));
        }, { force: options.force, maxAgeMs: 30_000 });
    }
    return withSessionReadRetry('getDoctorDetails', async () => {
        const { data, error } = await supabase
            .from('patients')
            .select(`
                *,
                doctor_profile:doctors(*)
            `)
            .in('role', ['doctor', 'admin', 'master_admin']);

        if (error) throw new Error(`Error fetching doctor details: ${error.message}`);

        const doctorDetailsData: any[] = data || [];
        return (doctorDetailsData).map(p => ({
            ...p,
            doctor_profile: Array.isArray(p.doctor_profile) ? p.doctor_profile[0] : p.doctor_profile
        }));
    });
}


// --- Authentication ---
export async function login(email: string, pass: string) {
    if (USE_D1_API) {
        throw new Error('Đăng nhập bằng mật khẩu đã được thay bằng Google OAuth.');
    }
    const result = await supabase.auth.signInWithPassword({ email, password: pass });
    if (result.error) throw new Error(result.error.message);
}

export async function loginWithOAuth(provider: 'google') {
    if (USE_D1_API) {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const returnTo = currentPath.startsWith('/dang-nhap') ? '/tai-khoan' : currentPath;
        window.location.assign(`/api/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`);
        return;
    }
    const result = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin,
        }
    });
    if (result.error) throw new Error(result.error.message);
}

export async function register({ email, password, name }: { email: string, password: string, name: string }) {
    if (USE_D1_API) {
        void email; void password; void name;
        throw new Error('Tài khoản mới được tạo bằng Google OAuth.');
    }
    // A temporary, basic DOB is required by the schema. User should update it later.
    const tempDob = '1990-01-01';

    const result = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                dob: tempDob,
            }
        }
    });
    if (result.error) throw new Error(result.error.message);
}


export async function logout() {
    if (USE_D1_API) {
        await d1ApiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
        d1CsrfToken = null;
        return;
    }
    const result = await supabase.auth.signOut();
    if (result.error) throw new Error(result.error.message);
}

export async function forgotPassword(email: string) {
    if (USE_D1_API) {
        void email;
        throw new Error('Tài khoản OAuth không sử dụng mật khẩu trên website.');
    }
    const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // URL to redirect to after password reset
    });
    if (result.error) throw new Error(result.error.message);
}

export async function updatePassword(password: string) {
    if (USE_D1_API) {
        void password;
        throw new Error('Tài khoản OAuth không sử dụng mật khẩu trên website.');
    }
    const result = await supabase.auth.updateUser({ password });
    if (result.error) throw new Error(result.error.message);
}

export async function isAuthServiceAvailable(): Promise<boolean> {
    if (USE_D1_API) {
        try {
            await d1ApiFetch<{ user: unknown | null }>('/api/auth/session');
            return true;
        } catch {
            return false;
        }
    }
    return checkSupabaseAuthHealth();
}

export type D1AuthSessionUser = {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    phone: string | null;
    locale: 'vi' | 'en' | 'ru' | 'cn';
    roles: string[];
};

export async function getCurrentAuthSession(): Promise<D1AuthSessionUser | null> {
    if (!USE_D1_API) return null;
    const payload = await d1ApiFetch<{ user: D1AuthSessionUser | null }>('/api/auth/session');
    return payload.user;
}


// --- Data Mutation (Admin) ---

export async function saveService(service: Partial<Service>, imageFile: File | null) {
    // 1. Handle image upload
    const serviceSlug = generateSlug(service.slug || service.name);
    if (!serviceSlug) {
        throw new Error('Service slug is required.');
    }

    const serviceData = {
        ...service,
        slug: serviceSlug,
        faq_items: sanitizeDetailFaqItems(service.faq_items),
        local_seo_tags: normalizeLocalSeoTags(service.local_seo_tags),
    };
    delete (serviceData as any).image_url;

    if (imageFile) {
        const webpFile = await convertImageToWebP(imageFile);
        // If updating and there's an old image, delete it.
        if (service.id && service.image_path) {
            try {
                await removePublicImages('site-assets', [service.image_path]);
            } catch (removeError: any) {
                console.warn('Could not remove old service image:', removeError?.message || removeError);
            }
        }
        const filePath = buildServiceCoverImagePath({
            slug: serviceSlug,
            name: service.name,
            extension: getFileExtension(webpFile),
        });
        const uploaded = await uploadPublicImage('site-assets', filePath, webpFile);
        serviceData.image_path = uploaded.path;
    }

    // 2. Separate procedure_steps from the main service data
    const { procedure_steps, ...serviceDataToSave } = serviceData;

    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ service: Service }>('/api/admin/services', {
            method: 'POST',
            body: JSON.stringify({ service: { ...serviceDataToSave, procedure_steps: procedure_steps || [] } }),
        });
        return payload.service;
    }

    // 3. Upsert the main service data (name, desc, price etc.) to get an ID
    const { data: savedService, error: serviceError } = await supabase
        .from('services')
        .upsert(serviceDataToSave, { onConflict: 'id' })
        .select()
        .single();

    if (serviceError) throw new Error(`Error saving service: ${serviceError.message}`);

    const serviceId = savedService.id;

    // 4. Delete old steps for this service to ensure a clean slate
    const { error: deleteError } = await supabase
        .from('procedure_steps')
        .delete()
        .eq('service_id', serviceId);

    if (deleteError) {
        console.warn(`Could not delete old steps for service ${serviceId}: ${deleteError.message}`);
    }

    // 5. If there are new steps, insert them
    if (procedure_steps && procedure_steps.length > 0) {
        const stepsToInsert = procedure_steps.map(step => {
            const { id, image_url, ...rest } = step;
            return {
                ...rest,
                service_id: serviceId,
            };
        });

        const { error: insertError } = await supabase
            .from('procedure_steps')
            .insert(stepsToInsert);

        if (insertError) throw new Error(`Error saving procedure steps: ${insertError.message}`);
    }
}


export async function deleteService(id: number) {
    if (USE_D1_API) {
        await d1ApiFetch(`/api/admin/services/${id}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

function buildBlogPostMutationPayload(post: BlogPost) {
    return {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        content: post.content,
        title_en: post.title_en || null,
        title_ru: post.title_ru || null,
        title_cn: post.title_cn || null,
        summary_en: post.summary_en || null,
        summary_ru: post.summary_ru || null,
        summary_cn: post.summary_cn || null,
        content_en: post.content_en || null,
        content_ru: post.content_ru || null,
        content_cn: post.content_cn || null,
        author_id: post.author_id,
        date: post.date,
        category_slug: post.category_slug,
        image_path: post.image_path || '',
        meta_description: post.meta_description || null,
        meta_keywords: post.meta_keywords || null,
        canonical_url: post.canonical_url || null,
        local_seo_tags: normalizeLocalSeoTags(post.local_seo_tags),
    };
}

export async function savePost(post: BlogPost, imageFile: File | null) {
    const postDataToSave = buildBlogPostMutationPayload(post);

    if (imageFile) {
        const webpFile = await convertImageToWebP(imageFile);
        const filePath = buildBlogCoverImagePath({
            slug: post.slug,
            title: post.title,
            categorySlug: post.category_slug,
            extension: getFileExtension(webpFile),
        });
        const uploaded = await uploadPublicImage('blog-images', filePath, webpFile);
        postDataToSave.image_path = uploaded.path;
    }

    if (USE_D1_API) {
        await d1ApiFetch('/api/admin/blog-posts', { method: 'POST', body: JSON.stringify({ post: postDataToSave }) });
        return;
    }
    const { error } = await supabase.from('blog_posts').upsert(postDataToSave, { onConflict: 'slug' });
    if (error) throw new Error(error.message);
}
export async function deletePost(slug: string, imagePath: string) {
    if (USE_D1_API) {
        await d1ApiFetch(`/api/admin/blog-posts/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        if (imagePath) await removePublicImages('blog-images', [imagePath]).catch(() => undefined);
        return;
    }
    const { error: dbError } = await supabase.from('blog_posts').delete().eq('slug', slug);
    if (dbError) throw new Error(dbError.message);

    if (imagePath) {
        try {
            await removePublicImages('blog-images', [imagePath]);
        } catch (storageError: any) {
            console.error(`Could not delete storage object ${imagePath}:`, storageError?.message || storageError);
        }
    }
}

function buildBlogCategoryMutationPayload(category: BlogCategory) {
    const name = String(category.name || '').trim();
    const slug = generateSlug(category.slug || category.name);
    if (!name) {
        throw new Error('Tên chuyên mục không được để trống.');
    }
    if (!slug) {
        throw new Error('Slug chuyên mục không hợp lệ.');
    }

    return {
        slug,
        name,
        name_en: String(category.name_en || '').trim() || null,
        name_ru: String(category.name_ru || '').trim() || null,
        name_cn: String(category.name_cn || '').trim() || null,
    };
}

export async function saveCategory(category: BlogCategory) {
    if (USE_D1_API) {
        await d1ApiFetch('/api/admin/blog-categories', { method: 'POST', body: JSON.stringify({ category: buildBlogCategoryMutationPayload(category) }) });
        return;
    }
    const result = await supabase
        .from('blog_categories')
        .upsert(buildBlogCategoryMutationPayload(category), { onConflict: 'slug' });
    if (result.error) throw new Error(result.error.message);
}
export async function deleteCategory(slug: string) {
    if (USE_D1_API) {
        await d1ApiFetch(`/api/admin/blog-categories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        return;
    }
    const result = await supabase.from('blog_categories').delete().eq('slug', slug);
    if (result.error) throw new Error(result.error.message);
}
export async function saveFaq(faq: FAQItem) {
    if (USE_D1_API) {
        await saveD1SiteContent<FAQItem>('faq_items', [faq]);
        return;
    }
    const { id, ...faqData } = faq;
    const result = await supabase.from('faq_items').upsert(faq.id > 0 ? faq : faqData);
    if (result.error) throw new Error(result.error.message);
}
export async function deleteFaq(id: number) {
    if (USE_D1_API) {
        await deleteD1SiteContent('faq_items', id);
        return;
    }
    const result = await supabase.from('faq_items').delete().eq('id', id);
    if (result.error) throw new Error(result.error.message);
}

async function uploadHomepageHeroAssets(
    variant: 'desktop' | 'tablet' | 'mobile',
    file: File,
    options: { webpTargetKB: number; avifTargetKB: number; maxDimension: number }
) {
    const baseFileName = `hero-${variant}-${Date.now()}`;
    const webpFile = await convertImageToWebP(file, {
        targetSizeKB: options.webpTargetKB,
        maxDimension: options.maxDimension,
    });
    const webpPath = `${baseFileName}.webp`;
    const uploadedWebp = await uploadPublicImage('site-assets', webpPath, webpFile);

    const avifFile = await convertImageToAvif(file, {
        targetSizeKB: options.avifTargetKB,
        maxDimension: options.maxDimension,
    });
    if (avifFile) {
        await uploadPublicImage('site-assets', `${baseFileName}.avif`, avifFile);
    }

    return uploadedWebp.path;
}

export async function updateHomepageHero(hero: Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_desktop_avif_url' | 'image_tablet_url' | 'image_tablet_avif_url' | 'image_mobile_url' | 'image_mobile_avif_url'>, files: { desktop?: File, tablet?: File, mobile?: File }) {
    const heroToSave = { ...hero };

    if (files.desktop) {
        heroToSave.image_desktop_path = await uploadHomepageHeroAssets('desktop', files.desktop, {
            webpTargetKB: 240,
            avifTargetKB: 160,
            maxDimension: 1280,
        });
    }

    if (files.tablet) {
        heroToSave.image_tablet_path = await uploadHomepageHeroAssets('tablet', files.tablet, {
            webpTargetKB: 180,
            avifTargetKB: 120,
            maxDimension: 960,
        });
    }

    if (files.mobile) {
        heroToSave.image_mobile_path = await uploadHomepageHeroAssets('mobile', files.mobile, {
            webpTargetKB: 120,
            avifTargetKB: 80,
            maxDimension: 640,
        });
    }

    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<HomepageHero>('homepage_hero', [{ id: 1, ...heroToSave }], true);
        const data: any = saved || { id: 1, ...heroToSave };
        data.image_desktop_url = await resolveHomepageHeroImageUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_url || '');
        data.image_desktop_avif_url = await resolveHomepageHeroAvifUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_avif_url || '');
        data.image_tablet_url = await resolveHomepageHeroImageUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_url || '');
        data.image_tablet_avif_url = await resolveHomepageHeroAvifUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_avif_url || '');
        data.image_mobile_url = await resolveHomepageHeroImageUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_url || '');
        data.image_mobile_avif_url = await resolveHomepageHeroAvifUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_avif_url || '');
        return data as HomepageHero;
    }
    const { data, error } = await supabase
        .from('homepage_hero')
        .upsert({ id: 1, ...heroToSave }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw new Error(error.message);

    data.image_desktop_url = await resolveHomepageHeroImageUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_url || '');
    data.image_desktop_avif_url = await resolveHomepageHeroAvifUrl(data.image_desktop_path, FALLBACK_HOMEPAGE_HERO.image_desktop_avif_url || '');
    data.image_tablet_url = await resolveHomepageHeroImageUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_url || '');
    data.image_tablet_avif_url = await resolveHomepageHeroAvifUrl(data.image_tablet_path, FALLBACK_HOMEPAGE_HERO.image_tablet_avif_url || '');
    data.image_mobile_url = await resolveHomepageHeroImageUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_url || '');
    data.image_mobile_avif_url = await resolveHomepageHeroAvifUrl(data.image_mobile_path, FALLBACK_HOMEPAGE_HERO.image_mobile_avif_url || '');
    return data;
}

export async function updateFeaturedServices(ids: number[]) {
    if (USE_D1_API) {
        await saveD1SiteContent('featured_services', ids.map((id) => ({ id: String(id), service_id: id })), true);
        return;
    }
    await supabase.from('featured_services').delete().neq('service_id', 0);
    if (ids.length > 0) {
        const { error } = await supabase.from('featured_services').insert(ids.map(id => ({ service_id: id })));
        if (error) throw new Error(error.message);
    }
}

export async function updateFeaturedDoctors(ids: string[]) {
    if (USE_D1_API) {
        await saveD1SiteContent('featured_doctors', ids.map((id) => ({ id, doctor_id: id })), true);
        return;
    }
    await supabase.from('featured_doctors').delete().neq('doctor_id', 'dummy-uuid-to-delete-all');
    if (ids.length > 0) {
        const result = await supabase.from('featured_doctors').insert(ids.map(id => ({ doctor_id: id })));
        if (result.error) throw new Error(result.error.message);
    }
}
export async function updateFeaturedPosts(slugs: string[]) {
    if (USE_D1_API) {
        await saveD1SiteContent('featured_posts', slugs.map((postSlug) => ({ id: postSlug, post_slug: postSlug })), true);
        return;
    }
    await supabase.from('featured_posts').delete().neq('post_slug', 'dummy-slug-to-delete-all');
    if (slugs.length > 0) {
        const result = await supabase.from('featured_posts').insert(slugs.map(slug => ({ post_slug: slug })));
        if (result.error) throw new Error(result.error.message);
    }
}

export async function updatePatient(patient: Partial<PatientProfile> & { id: string }, avatarFile: File | null) {
    const { id, ...updateData } = patient;
    delete (updateData as any).avatar_url; // Don't save the URL itself

    if (avatarFile) {
        const webpFile = await convertImageToWebP(avatarFile);
        const oldAvatarPath = patient.avatar_path || null;
        const filePath = `${id}/avatar-${Date.now()}.webp`;
        const uploaded = await uploadPublicImage('avatars', filePath, webpFile);
        updateData.avatar_path = uploaded.path;
        if (oldAvatarPath) {
            try {
                await removePublicImages('avatars', [oldAvatarPath]);
            } catch (removeError: any) {
                console.warn('Could not remove old avatar:', removeError?.message || removeError);
            }
        }
    }

    if (USE_D1_API) {
        const current = await getCurrentAuthSession();
        if (current?.id === id) {
            const payload = await d1ApiFetch<{ profile: PatientProfile }>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(updateData) });
            return payload.profile;
        }
        await d1ApiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updateData) });
        const users = await getAllPatients();
        const saved = users.find((entry) => entry.id === id);
        if (!saved) throw new Error('Không tìm thấy người dùng sau khi cập nhật.');
        return saved;
    }

    const { data, error } = await supabase
        .from('patients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function upsertDoctorProfile(doctorProfile: DoctorProfile) {
    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<DoctorProfile>('doctors', [doctorProfile]);
        return saved;
    }
    const { data, error } = await supabase
        .from('doctors')
        .upsert(doctorProfile, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteDoctorProfile(doctorId: string) {
    if (USE_D1_API) {
        await deleteD1SiteContent('doctors', doctorId);
        return;
    }
    const { error } = await supabase.from('doctors').delete().eq('id', doctorId);
    if (error) throw new Error(error.message);
}

export async function updateAboutContent(content: Partial<AboutContent>, imageFile: File | null) {
    const contentToSave = { ...content };
    delete (contentToSave as any).image_url;

    if (imageFile) {
        const webpFile = await convertImageToWebP(imageFile);
        const filePath = buildSiteAssetImagePath({
            area: 'about',
            siteName: 'Thế Giới Trị Mụn',
            variant: 'cover',
            extension: getFileExtension(webpFile),
        });
        const uploaded = await uploadPublicImage('site-assets', filePath, webpFile);
        contentToSave.image_path = uploaded.path;
    }

    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<AboutContent>('about_page_content', [{ id: 1, ...contentToSave }], true);
        return saved;
    }
    const { data, error } = await supabase
        .from('about_page_content')
        .upsert({ id: 1, ...contentToSave }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function saveAboutFeature(feature: Partial<AboutFeature>) {
    const featureToSave = { ...feature };
    if (!featureToSave.id) {
        featureToSave.id = featureToSave.title?.toLowerCase().replace(/đ/g, 'd').replace(/ /g, '-').replace(/[^\w-]+/g, '') || `feature-${Date.now()}`;
    }
    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<AboutFeature>('about_features', [featureToSave]);
        return saved;
    }
    const { data, error } = await supabase.from('about_features').upsert(featureToSave, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteAboutFeature(id: string) {
    if (USE_D1_API) { await deleteD1SiteContent('about_features', id); return; }
    const { error } = await supabase.from('about_features').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export async function saveAboutValue(value: Partial<AboutValue>) {
    const valueToSave = { ...value };
    if (!valueToSave.id) {
        valueToSave.id = valueToSave.title?.toLowerCase().replace(/đ/g, 'd').replace(/ /g, '-').replace(/[^\w-]+/g, '') || `value-${Date.now()}`;
    }
    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<AboutValue>('about_values', [valueToSave]);
        return saved;
    }
    const { data, error } = await supabase.from('about_values').upsert(valueToSave, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteAboutValue(id: string) {
    if (USE_D1_API) { await deleteD1SiteContent('about_values', id); return; }
    const { error } = await supabase.from('about_values').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export async function updateSiteInfo(info: Partial<SiteInfo>, files: { light?: File, dark?: File, favicon?: File }) {
    const infoToSave = { ...info };
    delete (infoToSave as any).logo_light_url;
    delete (infoToSave as any).logo_dark_url;
    delete (infoToSave as any).favicon_url;

    if (files.light) {
        const webpFile = await convertImageToWebP(files.light);
        const filePath = buildSiteAssetImagePath({
            area: 'branding',
            siteName: info.clinic_name || 'Thế Giới Trị Mụn',
            variant: 'logo-light',
            extension: getFileExtension(webpFile),
        });
        const uploaded = await uploadPublicImage('site-assets', filePath, webpFile);
        infoToSave.logo_light_path = uploaded.path;
    }
    if (files.dark) {
        const webpFile = await convertImageToWebP(files.dark);
        const filePath = buildSiteAssetImagePath({
            area: 'branding',
            siteName: info.clinic_name || 'Thế Giới Trị Mụn',
            variant: 'logo-dark',
            extension: getFileExtension(webpFile),
        });
        const uploaded = await uploadPublicImage('site-assets', filePath, webpFile);
        infoToSave.logo_dark_path = uploaded.path;
    }
    if (files.favicon) {
        const filePath = buildSiteAssetImagePath({
            area: 'branding',
            siteName: info.clinic_name || 'Thế Giới Trị Mụn',
            variant: 'favicon',
            extension: getFileExtension(files.favicon, 'png'),
        });
        const uploaded = await uploadPublicImage('site-assets', filePath, files.favicon);
        infoToSave.favicon_path = uploaded.path;
    }

    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<SiteInfo>('site_info', [{ id: 1, ...infoToSave }], true);
        const data: any = saved;
        data.logo_light_url = await getPublicUrl('site-assets', data.logo_light_path);
        data.logo_dark_url = await getPublicUrl('site-assets', data.logo_dark_path);
        data.favicon_url = await getPublicUrl('site-assets', data.favicon_path);
        return data;
    }
    const { data, error } = await supabase.from('site_info').upsert({ id: 1, ...infoToSave }, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);

    data.logo_light_url = await getPublicUrl('site-assets', data.logo_light_path);
    data.logo_dark_url = await getPublicUrl('site-assets', data.logo_dark_path);
    data.favicon_url = await getPublicUrl('site-assets', data.favicon_path);

    return data;
}

export async function updateFooterContent(content: Partial<FooterContent>) {
    const normalizedContent = normalizeFooterSocialUrls(content);
    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<FooterContent>('footer_content', [{ id: 1, ...normalizedContent }], true);
        return saved;
    }
    const { data, error } = await supabase.from('footer_content').upsert({ id: 1, ...normalizedContent }, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateAuthPageImages(loginImageFile: File | null): Promise<AuthPageImages> {
    if (!loginImageFile) {
        return getAuthPageImages();
    }

    const webpFile = await convertImageToWebP(loginImageFile);
    const filePath = buildSiteAssetImagePath({
        area: 'auth',
        siteName: 'Thế Giới Trị Mụn',
        variant: 'login-visual',
        extension: getFileExtension(webpFile),
    });
    const uploaded = await uploadPublicImage('site-assets', filePath, webpFile);

    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<AuthPageImages>('auth_page_images', [{ id: 1, login_image_path: uploaded.path }], true);
        const data: any = saved;
        data.login_image_url = await getPublicUrl('site-assets', data.login_image_path);
        return data;
    }
    const { data, error } = await supabase.from('auth_page_images').upsert({ id: 1, login_image_path: uploaded.path }, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);

    data.login_image_url = await getPublicUrl('site-assets', data.login_image_path);
    return data;
}

export async function updatePaymentSettings(settings: PaymentSettings) {
    if (USE_D1_API) {
        const [saved] = await saveD1SiteContent<PaymentSettings>('payment_settings', [{ ...settings, id: 1 }], true);
        return saved;
    }
    const { data, error } = await supabase.from('payment_settings').upsert({ id: 1, ...settings }, { onConflict: 'id' }).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function uploadSingleProductImage(
    file: File,
    options?: { productSlug?: string; productName?: string; imageIndex?: number; suffix?: string }
): Promise<{ image_path: string }> {
    const webpFile = await convertImageToWebP(file, { targetSizeKB: 200 });
    const filePath = buildProductGalleryImagePath({
        slug: options?.productSlug,
        name: options?.productName,
        index: options?.imageIndex,
        suffix: options?.suffix || generateUUID().slice(0, 8),
        extension: getFileExtension(webpFile),
    });

    const uploaded = await uploadPublicImage('product-images', filePath, webpFile);
    return { image_path: uploaded.path };
}

export type ProductGalleryImportRow = {
    product_id: number;
    image_path: string;
    display_order: number;
    is_primary?: boolean;
};

export async function appendProductGalleryImages(rows: ProductGalleryImportRow[]): Promise<void> {
    if (!rows.length) return;

    if (USE_D1_API) {
        await fetchAdminWorkerJson('/api/admin/products/gallery/append', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
        });
        return;
    }

    await saveWithRetry(async () => {
        const payload = rows.map((row) => ({
            product_id: Number(row.product_id),
            image_path: String(row.image_path),
            display_order: Number(row.display_order),
            is_primary: row.is_primary === true,
        }));
        const { error } = await supabase
            .from('product_images')
            .upsert(payload, {
                onConflict: 'product_id,image_path',
                ignoreDuplicates: true,
            });

        if (error) throw new Error(`Không thể ghi ảnh vào gallery sản phẩm: ${error.message}`);
    });
}

export async function promoteProductGalleryImages(
    selections: Array<{ product_id: number; image_path: string }>
): Promise<void> {
    if (!selections.length) return;

    if (USE_D1_API) {
        await fetchAdminWorkerJson('/api/admin/products/gallery/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selections }),
        });
        return;
    }

    await saveWithRetry(async () => {
        for (const selection of selections) {
            const productId = Number(selection.product_id);
            const imagePath = String(selection.image_path);
            const { data: promoted, error: promoteError } = await supabase
                .from('product_images')
                .update({ is_primary: true })
                .eq('product_id', productId)
                .eq('image_path', imagePath)
                .select('id')
                .limit(1)
                .maybeSingle();

            if (promoteError || !promoted) {
                throw new Error(`Không thể đặt ảnh đại diện mới cho sản phẩm ${productId}: ${promoteError?.message || 'không tìm thấy ảnh'}`);
            }

            const { error: demoteError } = await supabase
                .from('product_images')
                .update({ is_primary: false })
                .eq('product_id', productId)
                .eq('is_primary', true)
                .neq('image_path', imagePath);

            if (demoteError) {
                throw new Error(`Không thể gỡ ảnh đại diện cũ của sản phẩm ${productId}: ${demoteError.message}`);
            }
        }
    });
}

export async function saveProduct(
    productData: Partial<Product>,
    imagesToDelete: ProductImage[]
): Promise<Product> {
    // 1. Save core product data
    const { category, category_slug, detail_loaded, images, ...productCoreData } = productData;
    const vatRate = Number(productCoreData.vat_rate ?? DEFAULT_PRODUCT_VAT_RATE);
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
        throw new Error('VAT sản phẩm phải nằm trong khoảng từ 0% đến 100%.');
    }
    const productPayload = {
        ...productCoreData,
        faq_items: sanitizeDetailFaqItems(productCoreData.faq_items),
        vat_rate: Number(vatRate.toFixed(6)),
    };

    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ product: Product; deletedImagePaths?: string[] }>('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: { ...productPayload, images }, imagesToDelete }),
        });
        if (response.deletedImagePaths?.length) {
            try {
                await removePublicImages('product-images', response.deletedImagePaths);
            } catch (storageError) {
                console.warn('Product saved but obsolete images could not be removed from R2:', storageError);
            }
        }
        const productId = Number(response.product?.id || productPayload.id || 0);
        void fetchAdminWorkerJson<{ synced: number }>('/api/ingredient-analyzer/products/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
            keepalive: true,
        }).catch((syncError) => console.warn(`Product ${productId} saved; INCI snapshot will be retried:`, syncError));
        const [processed] = await processProductsWithImages([response.product]);
        return { ...(processed || response.product), detail_loaded: true } as Product;
    }
    let savedProduct;
    let productError;

    if (productPayload.id) {
        // Update existing product
        const { data, error } = await supabase
            .from('products')
            .update(productPayload)
            .eq('id', productPayload.id)
            .select()
            .single();
        savedProduct = data;
        productError = error;
    } else {
        // Insert new product
        let insertData = await supabase
            .from('products')
            .insert([productPayload])
            .select()
            .single();

        // Handle unique constraint violation on slug (Postgres error 23505 / PGRST 409)
        if (insertData.error && (insertData.error.code === '23505' || insertData.error.message.includes('duplicate key'))) {
            console.warn("Duplicate slug detected, appending random suffix and retrying...");
            const newSlug = `${productPayload.slug}-${Math.random().toString(36).substring(2, 7)}`;
            insertData = await supabase
                .from('products')
                .insert([{ ...productPayload, slug: newSlug }])
                .select()
                .single();
        }

        savedProduct = insertData.data;
        productError = insertData.error;
    }

    if (productError) throw new Error(`Error saving product core data: ${productError.message}`);
    const productId = savedProduct.id;

    // 2. Handle image deletions
    if (imagesToDelete.length > 0) {
        const imageIdsToDelete = imagesToDelete.map(img => img.id);
        const imagePathsToDelete = imagesToDelete.map(img => img.image_path);
        const { error: dbDeleteError } = await supabase.from('product_images').delete().in('id', imageIdsToDelete);
        if (dbDeleteError) throw new Error(`Error deleting images from DB: ${dbDeleteError.message}`);
        try {
            await removePublicImages('product-images', imagePathsToDelete);
        } catch (storageDeleteError: any) {
            console.warn(`Could not delete some images from storage: ${storageDeleteError?.message || storageDeleteError}`);
        }
    }

    // 3. Handle image additions and updates by separating new from existing
    if (images && images.length > 0) {
        const newImages = images
            .filter(img => !img.id || img.id <= 0)
            .map(({ id, product_id, image_url, ...rest }) => ({ // Remove client-side id and image_url before insert
                ...rest,
                product_id: productId,
            }));

        const existingImages = images
            .filter(img => img.id && img.id > 0)
            .map(({ image_url, ...img }) => ({ ...img, product_id: productId }));

        // Insert new images without an ID, letting the DB generate it
        if (newImages.length > 0) {
            const { error: insertError } = await supabase.from('product_images').insert(newImages);
            if (insertError) throw new Error(`Error inserting new product images: ${insertError.message}`);
        }

        // Upsert existing images to update order or other properties
        if (existingImages.length > 0) {
            const { error: upsertError } = await supabase.from('product_images').upsert(existingImages);
            if (upsertError) throw new Error(`Error updating existing product images: ${upsertError.message}`);
        }
    }

    const { data: latestRow, error: latestError } = await supabase
        .from('products')
        .select('*, category:product_categories(*), images:product_images(*)')
        .eq('id', productId)
        .maybeSingle();

    if (latestError) {
        console.warn('Product saved but admin refetch failed:', latestError.message);
    }

    void fetchAdminWorkerJson<{ synced: number }>('/api/ingredient-analyzer/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
        keepalive: true,
    }).catch((syncError) => {
        // The database queue remains the durable repair path if this immediate
        // write-through request is interrupted by navigation or connectivity.
        console.warn(`Product ${productId} saved; INCI snapshot will be retried in the background:`, syncError);
    });

    if (latestRow) {
        const [latestProduct] = await processProductsWithImages([latestRow]);
        if (latestProduct) {
            return { ...latestProduct, detail_loaded: true };
        }
    }

    console.warn('Product saved but no latest row was returned; falling back to the saved snapshot.', { productId });

    const fallbackCategory = category && typeof category === 'object' ? category : null;
    const fallbackRow = {
        ...savedProduct,
        category: fallbackCategory,
        category_slug: fallbackCategory?.slug || category_slug || savedProduct?.category_slug || undefined,
        images: Array.isArray(images) ? images : [],
        long_description: Array.isArray(productPayload.long_description) ? productPayload.long_description : [],
    };
    const [fallbackProduct] = await processProductsWithImages([fallbackRow]);

    if (fallbackProduct) {
        return { ...fallbackProduct, detail_loaded: true };
    }

    return {
        ...(savedProduct as Product),
        category: fallbackCategory || undefined,
        category_slug: fallbackCategory?.slug || category_slug || savedProduct?.category_slug || undefined,
        images: [],
        detail_loaded: true,
        price: Number(savedProduct?.price || 0),
        vat_rate: savedProduct?.vat_rate != null ? Number(savedProduct.vat_rate) : DEFAULT_PRODUCT_VAT_RATE,
        stock_quantity: Number(savedProduct?.stock_quantity || 0),
    } as Product;
}


export type ProductDeletionOutcome = 'deleted' | 'archived';

export interface ProductDeletionResult {
    product_id: number;
    outcome: ProductDeletionOutcome;
    image_paths: string[];
}

export async function deleteProduct(productId: number): Promise<ProductDeletionResult> {
    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ result: ProductDeletionResult }>(`/api/admin/products/${productId}`, {
            method: 'DELETE',
        });
        const result = response.result;
        if (result.outcome === 'deleted' && result.image_paths.length) {
            try {
                await removePublicImages('product-images', result.image_paths);
            } catch (storageError) {
                console.warn(`Could not delete all product images for ${productId}:`, storageError);
            }
        }
        return result;
    }
    const { data, error } = await supabase
        .rpc('admin_delete_or_archive_product', { p_product_id: productId })
        .single();

    if (error) throw new Error(`Error deleting product from DB: ${error.message}`);
    if (!data) throw new Error('Error deleting product from DB: Invalid response from server.');

    const rpcData = data as {
        product_id?: unknown;
        outcome?: unknown;
        image_paths?: unknown;
    };
    if (rpcData.outcome !== 'deleted' && rpcData.outcome !== 'archived') {
        throw new Error('Error deleting product from DB: Invalid outcome from server.');
    }

    const result: ProductDeletionResult = {
        product_id: Number(rpcData.product_id),
        outcome: rpcData.outcome,
        image_paths: Array.isArray(rpcData.image_paths)
            ? rpcData.image_paths.filter((path): path is string => typeof path === 'string')
            : [],
    };

    if (result.outcome === 'deleted' && result.image_paths.length > 0) {
        try {
            await removePublicImages('product-images', result.image_paths);
        } catch (storageError: any) {
            console.warn(`Could not delete all product storage objects for product ${productId}:`, storageError?.message || storageError);
        }
    }

    void fetchAdminWorkerJson<{ synced: number }>('/api/ingredient-analyzer/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
        keepalive: true,
    }).catch((syncError) => {
        console.warn(`Product ${productId} changed; INCI snapshot cleanup will be retried in the background:`, syncError);
    });

    return result;
}

export interface PancakeProductSyncResult {
    queued: number;
    requested?: number;
    dispatch?: {
        skipped?: boolean;
        queued?: number;
        reason?: string;
    };
}

export interface PancakeSyncSettings {
    masterEnabled: boolean;
    productsEnabled: boolean;
    inventoryEnabled: boolean;
    customersEnabled: boolean;
    ordersEnabled: boolean;
    updatedBy: string | null;
    updatedAt: string | null;
}

export type PancakeSyncSettingKey =
    | 'masterEnabled'
    | 'productsEnabled'
    | 'inventoryEnabled'
    | 'customersEnabled'
    | 'ordersEnabled';

export interface PancakeQueueSummary {
    total: number;
    pending: number;
    paused: number;
    queued: number;
    processing: number;
    retrying: number;
    failed: number;
    blocked?: number;
    completed?: number;
}

export interface PancakeIntegrationStatus {
    config: {
        enabled: boolean;
        apiKeyConfigured: boolean;
        shopConfigured: boolean;
        warehouseConfigured: boolean;
        shopId: string | null;
        warehouseId: string | null;
        queueConfigured: boolean;
        baseUrl: string;
        direction: 'website_to_pancake';
        sourceOfTruth: 'website_d1';
        resources: string[];
    };
    settings: PancakeSyncSettings;
    outbox: Array<{ entity_type: string; status: string; count: number }>;
    queueSummary: PancakeQueueSummary;
    links: Array<Record<string, unknown>>;
    lastCompleted: { entity_type: string; entity_id: string; completed_at: string } | null;
    lastError: { entity_type: string; entity_id: string; status: string; last_error: string; updated_at: string } | null;
    webhook: { configured: boolean; processingEnabled: boolean; endpoint: string };
}

export interface PancakeConnectionTestResult {
    ok: boolean;
    warehouseCount: number;
    configuredWarehouseFound: boolean | null;
}

export async function getPancakeIntegrationStatus(): Promise<PancakeIntegrationStatus> {
    return fetchAdminWorkerJson<PancakeIntegrationStatus>('/api/admin/integrations/pancake/status');
}

export async function getPancakeSyncSettings(): Promise<PancakeSyncSettings> {
    const response = await fetchAdminWorkerJson<{ data: PancakeSyncSettings }>('/api/admin/integrations/pancake/settings');
    return response.data;
}

export async function updatePancakeSyncSettings(
    patch: Partial<Record<PancakeSyncSettingKey, boolean>>,
): Promise<PancakeSyncSettings> {
    const response = await fetchAdminWorkerJson<{ data: PancakeSyncSettings }>('/api/admin/integrations/pancake/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    return response.data;
}

export async function testPancakeConnection(): Promise<PancakeConnectionTestResult> {
    return fetchAdminWorkerJson<PancakeConnectionTestResult>('/api/admin/integrations/pancake/test', {
        method: 'POST',
    });
}

export async function syncProductsToPancake(productIds?: number[]): Promise<PancakeProductSyncResult> {
    if (!USE_D1_API) {
        throw new Error('Đồng bộ Pancake chỉ khả dụng khi website đang dùng D1.');
    }

    const normalizedProductIds = Array.from(new Set((productIds || []).map((productId) => Math.trunc(Number(productId)))))
        .filter((productId) => Number.isInteger(productId) && productId > 0)
        .slice(0, 1000);
    if (productIds && normalizedProductIds.length !== productIds.length) {
        throw new Error('Danh sách sản phẩm không hợp lệ.');
    }

    const body = normalizedProductIds.length > 0 ? { productIds: normalizedProductIds } : {};
    const response = await fetchAdminWorkerJson<PancakeProductSyncResult>('/api/admin/integrations/pancake/sync/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (Number(response.queued || 0) < 0) {
        throw new Error('Không tạo được tác vụ đồng bộ sản phẩm với Pancake.');
    }

    return response;
}

export async function syncProductToPancake(productId: number): Promise<PancakeProductSyncResult> {
    const normalizedProductId = Math.trunc(Number(productId));
    if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
        throw new Error('ID sản phẩm không hợp lệ.');
    }

    const response = await syncProductsToPancake([normalizedProductId]);
    if (Number(response.queued || 0) !== 1) {
        throw new Error('Không tạo được tác vụ đồng bộ sản phẩm với Pancake.');
    }
    return response;
}

const normalizePancakeIds = (ids: Array<string | number> | undefined, max: number): string[] => {
    const normalized = Array.from(new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))).slice(0, max);
    if (ids && normalized.length !== ids.length) throw new Error('Danh sách ID đồng bộ không hợp lệ.');
    return normalized;
};

export async function syncInventoryToPancake(productIds?: number[]): Promise<PancakeProductSyncResult> {
    const normalized = normalizePancakeIds(productIds, 1000)
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isInteger(id) && id > 0);
    if (productIds && normalized.length !== productIds.length) throw new Error('Danh sách sản phẩm không hợp lệ.');
    return fetchAdminWorkerJson<PancakeProductSyncResult>('/api/admin/integrations/pancake/sync/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized.length ? { productIds: normalized } : {}),
    });
}

export async function syncCustomersToPancake(orderIds?: string[]): Promise<PancakeProductSyncResult> {
    const normalized = normalizePancakeIds(orderIds, 500);
    return fetchAdminWorkerJson<PancakeProductSyncResult>('/api/admin/integrations/pancake/sync/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized.length ? { orderIds: normalized } : {}),
    });
}

export async function syncOrdersToPancake(orderIds?: string[]): Promise<PancakeProductSyncResult> {
    const normalized = normalizePancakeIds(orderIds, 500);
    return fetchAdminWorkerJson<PancakeProductSyncResult>('/api/admin/integrations/pancake/sync/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized.length ? { orderIds: normalized } : {}),
    });
}


export async function saveProductCategory(category: Partial<ProductCategory>) {
    if (USE_D1_API) {
        await fetchAdminWorkerJson('/api/admin/product-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category),
        });
        return;
    }
    const categoryToSave = { ...category };
    const { error } = await supabase.from('product_categories').upsert(categoryToSave, { onConflict: 'id' });
    if (error) throw new Error(`Error saving product category: ${error.message}`);
}

export async function deleteProductCategory(categoryId: number) {
    if (USE_D1_API) {
        await fetchAdminWorkerJson(`/api/admin/product-categories/${categoryId}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.from('product_categories').delete().eq('id', categoryId);
    if (error) throw new Error(error.message);
}

// --- Data Mutation (User) ---

export async function createAppointment(
    userId: string,
    appointmentData: Omit<Appointment, 'id' | 'status'>,
    contact?: { name?: string; email?: string; phone?: string; locale?: string }
): Promise<Appointment> {
    if (USE_D1_API) {
        const response = await d1ApiFetch<{ appointment: Appointment }>('/api/appointments', {
            method: 'POST',
            body: JSON.stringify({
                ...appointmentData,
                customerName: contact?.name,
                customerEmail: contact?.email,
                customerPhone: contact?.phone,
                locale: contact?.locale || 'vi',
            }),
        });
        return response.appointment;
    }
    const { data, error } = await supabase
        .from('appointments')
        .insert([{ ...appointmentData, patient_id: userId }])
        .select('*')
        .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Could not create appointment: Invalid response from server.');

    return data as Appointment;
}

const normalizeOrderPaymentMethod = (value: any): OrderPaymentMethod => {
    return value === 'bank_transfer' ? 'bank_transfer' : 'cod';
};

const normalizeOrderPaymentStatus = (value: any, fallbackStatus?: ProductOrder['status']): OrderPaymentStatus => {
    if (value === 'paid' || value === 'failed' || value === 'refunded') {
        return value;
    }
    if (fallbackStatus === 'completed') return 'paid';
    if (fallbackStatus === 'refunded') return 'refunded';
    return 'unpaid';
};

const normalizeOrderFulfillmentStatus = (
    value: any,
    fallbackStatus?: ProductOrder['status']
): OrderFulfillmentStatus => {
    if (value === 'processing' || value === 'shipped' || value === 'completed' || value === 'cancelled') {
        return value;
    }
    if (value === 'pending') return 'pending';

    if (fallbackStatus === 'processing') return 'processing';
    if (fallbackStatus === 'shipped') return 'shipped';
    if (fallbackStatus === 'completed') return 'completed';
    if (fallbackStatus === 'cancelled') return 'cancelled';
    if (fallbackStatus === 'refunded') return 'completed';
    return 'pending';
};

const orderItemImageUrl = (value: unknown): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith('/r2/')) return normalized;

    const objectPath = normalized
        .replace(/^\/+/, '')
        .replace(/^product-images\//i, '');
    if (!objectPath) return '';
    return `/r2/product-images/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
};

const normalizeProductOrderItemRow = (row: any): ProductOrderItem => {
    const currentProduct = row?.product && typeof row.product === 'object' ? row.product : {};
    const snapshotName = String(row?.product_name || '').trim();
    const productName = snapshotName && !isPlaceholderOrderProductName(snapshotName)
        ? snapshotName
        : String(currentProduct.name || snapshotName || '').trim();
    const imageSource = currentProduct.main_image_url
        || row?.resolved_product_image_path
        || row?.product_image_path
        || currentProduct.main_image_path
        || currentProduct.image_path;

    return {
        ...row,
        product_id: Number(row?.product_id || 0),
        product_name: productName || null,
        product_sku: row?.product_sku || currentProduct.sku || null,
        quantity: Number(row?.quantity || 0),
        price_at_purchase: Number(row?.price_at_purchase || 0),
        product: {
            ...currentProduct,
            id: Number(row?.product_id || currentProduct.id || 0),
            name: productName || `Sản phẩm #${Number(row?.product_id || currentProduct.id || 0)}`,
            sku: row?.product_sku || currentProduct.sku || '',
            main_image_url: orderItemImageUrl(imageSource),
        },
    };
};

const normalizeProductOrderRow = (row: any): ProductOrder => ({
    ...row,
    subtotal_price: row?.subtotal_price != null ? Number(row.subtotal_price) : undefined,
    discount_amount: row?.discount_amount != null ? Number(row.discount_amount) : undefined,
    total_price: Number(row?.total_price || 0),
    shipping_fee: row?.shipping_fee != null ? Number(row.shipping_fee) : undefined,
    shipping_net_amount: row?.shipping_net_amount != null ? Number(row.shipping_net_amount) : undefined,
    shipping_tax_rate: row?.shipping_tax_rate != null ? Number(row.shipping_tax_rate) : undefined,
    shipping_tax_amount: row?.shipping_tax_amount != null ? Number(row.shipping_tax_amount) : undefined,
    tax_rate: row?.tax_rate != null ? Number(row.tax_rate) : undefined,
    taxable_amount: row?.taxable_amount != null ? Number(row.taxable_amount) : undefined,
    tax_amount: row?.tax_amount != null ? Number(row.tax_amount) : undefined,
    grand_total: row?.grand_total != null ? Number(row.grand_total) : undefined,
    payment_method: normalizeOrderPaymentMethod(row?.payment_method),
    payment_status: normalizeOrderPaymentStatus(row?.payment_status, row?.status),
    fulfillment_status: normalizeOrderFulfillmentStatus(row?.fulfillment_status, row?.status),
    order_items: Array.isArray(row?.order_items)
        ? row.order_items.map(normalizeProductOrderItemRow)
        : undefined,
    refund_logs: Array.isArray(row?.refund_logs)
        ? row.refund_logs.map(normalizeOrderRefundLogRow)
        : undefined,
});

const normalizeOrderStatusHistoryRow = (row: any): OrderStatusHistory => ({
    id: row.id,
    order_id: row.order_id,
    from_status: row.from_status || null,
    to_status: normalizeOrderFulfillmentStatus(row.to_status),
    actor_id: row.actor_id || null,
    actor_role: row.actor_role || null,
    note: row.note || null,
    created_at: row.created_at,
});

const normalizeOrderPaymentLogRow = (row: any): OrderPaymentLog => ({
    id: row.id,
    order_id: row.order_id,
    method: normalizeOrderPaymentMethod(row.method),
    amount: Number(row.amount || 0),
    status: normalizeOrderPaymentStatus(row.status),
    transaction_ref: row.transaction_ref || null,
    paid_at: row.paid_at || null,
    metadata: row.metadata || {},
    created_at: row.created_at,
});

const normalizeOrderRefundLogRow = (row: any): OrderRefundLog => ({
    id: row.id,
    order_id: row.order_id,
    amount: Number(row.amount || 0),
    reason: row.reason || null,
    status: row.status === 'pending' || row.status === 'failed' ? row.status : 'completed',
    restocked: Boolean(row.restocked),
    refunded_at: row.refunded_at || null,
    created_by: row.created_by || null,
    created_at: row.created_at,
});

const shouldRetryWithoutPaymentMethodArg = (message: string): boolean => {
    const msg = String(message || '').toLowerCase();
    return (
        msg.includes('p_payment_method') ||
        (msg.includes('function public.create_product_order_atomic') && msg.includes('does not exist')) ||
        msg.includes('not unique')
    );
};

export async function createProductOrder(orderData: Omit<ProductOrder, 'id' | 'created_at' | 'order_code'>, items: CartItem[]): Promise<ProductOrder> {
    const cartItemsPayload = items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
    }));
    const idempotencyKey = orderData.checkout_idempotency_key?.trim() || generateUUID();
    const normalizedPaymentMethod: OrderPaymentMethod =
        orderData.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
    if (USE_D1_API) {
        const response = await d1ApiFetch<{ order: ProductOrder }>('/api/orders', {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify({
                customerName: orderData.customer_name,
                customerPhone: orderData.customer_phone,
                customerEmail: orderData.customer_email,
                locale: orderData.locale || 'vi',
                shippingStreet: orderData.shipping_street,
                shippingWard: orderData.shipping_ward,
                shippingDistrict: orderData.shipping_district,
                shippingProvince: orderData.shipping_province,
                notes: orderData.notes || null,
                shippingProvider: orderData.shipping_provider || null,
                shippingFee: orderData.shipping_fee || 0,
                estimatedDeliveryTime: orderData.estimated_delivery_time || null,
                paymentMethod: normalizedPaymentMethod,
                discountCode: orderData.discount_code || null,
                checkoutIdempotencyKey: idempotencyKey,
                items: cartItemsPayload,
            }),
        });
        return normalizeProductOrderRow(response.order);
    }
    const basePayload = {
        p_user_id: orderData.user_id || null,
        p_customer_name: orderData.customer_name.trim(),
        p_customer_phone: orderData.customer_phone.trim(),
        p_shipping_street: orderData.shipping_street.trim(),
        p_shipping_ward: orderData.shipping_ward.trim(),
        p_shipping_district: orderData.shipping_district.trim(),
        p_shipping_province: orderData.shipping_province.trim(),
        p_notes: orderData.notes?.trim() || null,
        p_shipping_provider: orderData.shipping_provider || null,
        p_shipping_fee: orderData.shipping_fee || 0,
        p_estimated_delivery_time: orderData.estimated_delivery_time || null,
        p_status: orderData.status || 'pending',
        p_discount_code: orderData.discount_code || null,
        p_checkout_idempotency_key: idempotencyKey,
        p_items: cartItemsPayload,
    };
    let data: any;
    let error: any;

    ({ data, error } = await supabase.rpc('create_product_order_atomic', {
        ...basePayload,
        p_payment_method: normalizedPaymentMethod,
    }));

    if (error && shouldRetryWithoutPaymentMethodArg(error.message || '')) {
        ({ data, error } = await supabase.rpc('create_product_order_atomic', basePayload));
    }

    if (error) throw new Error(`Could not create order: ${error.message}`);

    let createdOrder = (Array.isArray(data) ? data[0] : data) as ProductOrder | null;
    if (!createdOrder || !createdOrder.id) {
        throw new Error('Could not create order: Invalid response from server.');
    }

    const customerEmail = String(orderData.customer_email || '').trim().toLowerCase();
    const locale = ['vi', 'en', 'ru', 'cn'].includes(String(orderData.locale || '').toLowerCase())
        ? String(orderData.locale).toLowerCase()
        : 'vi';
    const contactResult = await supabase.rpc('attach_product_order_contact', {
        p_order_id: createdOrder.id,
        p_checkout_idempotency_key: idempotencyKey,
        p_customer_email: customerEmail,
        p_locale: locale,
    });
    if (contactResult.error) {
        throw new Error(`Could not attach order contact: ${contactResult.error.message}`);
    }
    const orderWithContact = Array.isArray(contactResult.data) ? contactResult.data[0] : contactResult.data;
    if (orderWithContact?.id) {
        createdOrder = orderWithContact as ProductOrder;
    }

    return normalizeProductOrderRow(createdOrder);
}

export async function requestGuestProductOrderOtp(orderCode: string, phone: string): Promise<{ channel: 'sms' | 'email' }> {
    const response = await fetch('/api/orders/guest-lookup/request-otp', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            orderCode: String(orderCode || '').trim(),
            phone: String(phone || '').trim(),
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error || 'Không thể gửi mã OTP.');
    }
    return { channel: payload?.channel === 'email' ? 'email' : 'sms' };
}

export async function lookupGuestProductOrder(orderCode: string, phone: string, otp: string): Promise<ProductOrder[]> {
    const response = await fetch('/api/orders/guest-lookup', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            orderCode: String(orderCode || '').trim(),
            phone: String(phone || '').trim(),
            otp: String(otp || '').trim(),
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error || 'Không thể tra cứu đơn hàng.');
    }

    const orders: any[] = Array.isArray(payload) ? payload : [];
    for (const order of orders) {
        if (!Array.isArray(order.order_items)) continue;
        for (const item of order.order_items) {
            const product = item.product;
            if (!product) continue;
            const imagePath = product.main_image_path || product.image_path;
            if (imagePath && !product.main_image_url) {
                product.main_image_url = await getPublicUrl('product-images', imagePath);
            }
            delete product.main_image_path;
            delete product.image_path;
        }
    }

    return orders.map(normalizeProductOrderRow);
}

export async function getAllProductOrders(options: { force?: boolean } = {}): Promise<ProductOrder[]> {
    if (USE_D1_API) {
        const orders = await adminDataProvider.read('orders', () => readAllAdminPages<any>(
            '/api/admin/orders',
            'orders',
        ), { force: options.force, maxAgeMs: 20_000 });
        for (const order of orders) {
            if (!Array.isArray(order.order_items)) continue;
            for (const item of order.order_items) {
                const product = item.product;
                if (!product) continue;
                const imagePath = product.main_image_path
                    || product.image_path
                    || item.resolved_product_image_path
                    || item.product_image_path
                    || product.main_image_url;
                const currentImage = String(product.main_image_url || '');
                if (imagePath && (!currentImage || currentImage === String(imagePath) || !/^https?:\/\//i.test(currentImage))) {
                    product.main_image_url = await getPublicUrl('product-images', imagePath) || '';
                }
                delete product.main_image_path;
                delete product.image_path;
            }
        }
        return orders.map(normalizeProductOrderRow);
    }
    return withSessionReadRetry('getAllProductOrders', async () => {
        const { data, error } = await supabase
            .from('product_orders')
            .select(`
                *,
                refund_logs:order_refunds(*),
                order_items:product_order_items (
                    *,
                    product:products (
                        id,
                        name,
                        stock_quantity,
                        images:product_images (
                            image_path
                        )
                    )
                )
            `)
            .order('created_at', { ascending: false });
        if (error) throw new Error(`Error fetching all product orders: ${error.message}`);
        const orders: any[] = Array.isArray(data) ? data : [];

        for (const order of orders) {
            if (!Array.isArray(order.order_items)) continue;
            for (const item of order.order_items) {
                const product = item.product;
                if (!product) continue;
                if (Array.isArray(product.images) && product.images.length > 0 && !product.main_image_url) {
                    product.main_image_url = await getPublicUrl('product-images', product.images[0].image_path);
                }
                delete product.images;
            }
        }

        return orders.map(normalizeProductOrderRow);
    });
}

export async function updateProductOrder(orderId: string, updates: Partial<ProductOrder>) {
    // Admin function to update an order's status or shipping code
    if (USE_D1_API) {
        if (!updates.status) {
            throw new Error('D1 chỉ cho phép cập nhật đơn hàng qua chuyển trạng thái có kiểm soát.');
        }
        return transitionOrderStatus(orderId, updates.status as OrderFulfillmentStatus);
    }
    const { data, error } = await supabase
        .from('product_orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();
    if (error) throw new Error(`Error updating product order: ${error.message}`);
    return normalizeProductOrderRow(data);
}

export async function transitionOrderStatus(
    orderId: string,
    toStatus: OrderFulfillmentStatus,
    note?: string
): Promise<ProductOrder> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ order: ProductOrder }>(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: toStatus, note }),
        });
        return normalizeProductOrderRow(payload.order);
    }
    const { data, error } = await supabase.rpc('transition_order_status', {
        p_order_id: orderId,
        p_to_status: toStatus,
        p_note: note || null,
    });

    if (error) throw new Error(error.message || 'Không thể chuyển trạng thái đơn hàng.');

    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row || !row.id) {
        throw new Error('Không nhận được dữ liệu đơn hàng sau khi chuyển trạng thái.');
    }

    return normalizeProductOrderRow(row);
}

export async function createOrderRefund(params: {
    orderId: string;
    amount: number;
    reason?: string;
    restock?: boolean;
}): Promise<ProductOrder> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ order: ProductOrder }>(`/api/admin/orders/${encodeURIComponent(params.orderId)}/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: params.amount, reason: params.reason, restock: params.restock }),
        });
        return normalizeProductOrderRow(payload.order);
    }
    const { data, error } = await supabase.rpc('create_order_refund', {
        p_order_id: params.orderId,
        p_amount: params.amount,
        p_reason: params.reason || null,
        p_restock: Boolean(params.restock),
    });

    if (error) throw new Error(error.message || 'Không thể tạo hoàn tiền.');

    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row || !row.id) {
        throw new Error('Không nhận được dữ liệu đơn hàng sau khi hoàn tiền.');
    }

    return normalizeProductOrderRow(row);
}

export async function bulkTransitionOrderStatus(params: {
    orderIds: string[];
    toStatus: OrderFulfillmentStatus;
    note?: string;
}): Promise<AdminBulkOrderTransitionResult[]> {
    const orderIds = Array.from(new Set((params.orderIds || []).filter(Boolean)));
    if (!orderIds.length) return [];

    if (USE_D1_API) {
        return Promise.all(orderIds.map(async (orderId): Promise<AdminBulkOrderTransitionResult> => {
            try {
                const order = await transitionOrderStatus(orderId, params.toStatus, params.note);
                return { order_id: orderId, ok: true, error_message: null, order_data: order };
            } catch (error) {
                return {
                    order_id: orderId,
                    ok: false,
                    error_message: error instanceof Error ? error.message : 'Không thể cập nhật trạng thái đơn hàng.',
                    order_data: null,
                };
            }
        }));
    }

    const { data, error } = await supabase.rpc('admin_bulk_transition_order_status', {
        p_order_ids: orderIds,
        p_to_status: params.toStatus,
        p_note: params.note || null,
    });

    if (error) throw new Error(error.message || 'Không thể cập nhật trạng thái đơn hàng hàng loạt.');

    return (data || []).map((row: any) => ({
        order_id: row?.order_id || '',
        ok: Boolean(row?.ok),
        error_message: row?.error_message || null,
        order_data: row?.order_data ? normalizeProductOrderRow(row.order_data) : null,
    }));
}

export async function getOrderLifecycleLogs(orderId: string): Promise<{
    statusHistory: OrderStatusHistory[];
    paymentLogs: OrderPaymentLog[];
    refundLogs: OrderRefundLog[];
}> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{
            statusHistory: any[];
            paymentLogs: any[];
            refundLogs: any[];
        }>(`/api/admin/orders/${encodeURIComponent(orderId)}/lifecycle`);
        return {
            statusHistory: (payload.statusHistory || []).map(normalizeOrderStatusHistoryRow),
            paymentLogs: (payload.paymentLogs || []).map(normalizeOrderPaymentLogRow),
            refundLogs: (payload.refundLogs || []).map(normalizeOrderRefundLogRow),
        };
    }
    const [historyRes, paymentRes, refundRes] = await Promise.all([
        supabase
            .from('order_status_history')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true }),
        supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false }),
        supabase
            .from('order_refunds')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false }),
    ]);

    if (historyRes.error) throw new Error(`Không thể tải lịch sử trạng thái: ${historyRes.error.message}`);
    if (paymentRes.error) throw new Error(`Không thể tải lịch sử thanh toán: ${paymentRes.error.message}`);
    if (refundRes.error) throw new Error(`Không thể tải lịch sử hoàn tiền: ${refundRes.error.message}`);

    return {
        statusHistory: (historyRes.data || []).map(normalizeOrderStatusHistoryRow),
        paymentLogs: (paymentRes.data || []).map(normalizeOrderPaymentLogRow),
        refundLogs: (refundRes.data || []).map(normalizeOrderRefundLogRow),
    };
}

const toMetricNumber = (value: any): number => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const toMetricInteger = (value: any): number => Math.trunc(toMetricNumber(value));

const normalizeAdminDashboardKpiSnapshotRow = (row: any): AdminDashboardKpiSnapshot => ({
    total_orders: toMetricInteger(row?.total_orders),
    paid_orders: toMetricInteger(row?.paid_orders),
    pending_orders: toMetricInteger(row?.pending_orders),
    completed_orders: toMetricInteger(row?.completed_orders),
    cancelled_orders: toMetricInteger(row?.cancelled_orders),
    refunded_orders: toMetricInteger(row?.refunded_orders),
    guest_orders: toMetricInteger(row?.guest_orders),
    gross_revenue: toMetricNumber(row?.gross_revenue),
    net_revenue: toMetricNumber(row?.net_revenue),
    discount_total: toMetricNumber(row?.discount_total),
    tax_total: toMetricNumber(row?.tax_total),
    shipping_total: toMetricNumber(row?.shipping_total),
    refund_total: toMetricNumber(row?.refund_total),
    average_order_value: toMetricNumber(row?.average_order_value),
    total_customers: toMetricInteger(row?.total_customers),
    new_customers: toMetricInteger(row?.new_customers),
    returning_customers: toMetricInteger(row?.returning_customers),
    appointments_total: toMetricInteger(row?.appointments_total),
    appointments_pending: toMetricInteger(row?.appointments_pending),
    appointments_completed: toMetricInteger(row?.appointments_completed),
    appointments_cancelled: toMetricInteger(row?.appointments_cancelled),
    service_revenue: toMetricNumber(row?.service_revenue),
});

const normalizeAdminDashboardTimeseriesRow = (row: any): AdminDashboardTimeseriesPoint => ({
    bucket_start: row?.bucket_start || '',
    total_orders: toMetricInteger(row?.total_orders),
    paid_orders: toMetricInteger(row?.paid_orders),
    gross_revenue: toMetricNumber(row?.gross_revenue),
    net_revenue: toMetricNumber(row?.net_revenue),
    refund_total: toMetricNumber(row?.refund_total),
    appointments_total: toMetricInteger(row?.appointments_total),
});

const normalizeAdminInventoryMetricsRow = (row: any): AdminInventoryMetrics => ({
    total_products: toMetricInteger(row?.total_products),
    published_products: toMetricInteger(row?.published_products),
    featured_products: toMetricInteger(row?.featured_products),
    hidden_products: toMetricInteger(row?.hidden_products),
    in_stock_products: toMetricInteger(row?.in_stock_products),
    low_stock_products: toMetricInteger(row?.low_stock_products),
    out_of_stock_products: toMetricInteger(row?.out_of_stock_products),
    near_expiry_products: toMetricInteger(row?.near_expiry_products),
    no_sku_products: toMetricInteger(row?.no_sku_products),
    inventory_estimated_value: toMetricNumber(row?.inventory_estimated_value),
});

const normalizeAdminCustomerMetricRow = (row: any): AdminCustomerMetric => ({
    patient_id: row?.patient_id,
    name: row?.name || '',
    email: row?.email || '',
    phone: row?.phone || '',
    created_at: row?.created_at,
    total_orders: toMetricInteger(row?.total_orders),
    total_spent: toMetricNumber(row?.total_spent),
    average_order_value: toMetricNumber(row?.average_order_value),
    first_order_at: row?.first_order_at || null,
    last_order_at: row?.last_order_at || null,
    total_appointments: toMetricInteger(row?.total_appointments),
    last_appointment_at: row?.last_appointment_at || null,
    orders_in_period: toMetricInteger(row?.orders_in_period),
    spent_in_period: toMetricNumber(row?.spent_in_period),
    segment: row?.segment || 'lead_only_customer',
    is_at_risk: Boolean(row?.is_at_risk),
    is_returning: Boolean(row?.is_returning),
});

const normalizeAdminDashboardAlertRow = (row: any): AdminDashboardAlert => ({
    alert_key: row?.alert_key || '',
    alert_type: row?.alert_type || '',
    severity: row?.severity || 'low',
    title: row?.title || '',
    description: row?.description || '',
    ref_type: row?.ref_type || '',
    ref_id: row?.ref_id || '',
    created_at: row?.created_at || new Date().toISOString(),
});

const normalizeAdminReportScheduleRow = (row: any): AdminReportSchedule => ({
    id: row?.id || '',
    name: row?.name || '',
    preset: row?.preset || '30d',
    frequency: row?.frequency || 'daily',
    day_of_week: row?.day_of_week === null || typeof row?.day_of_week === 'undefined' ? null : toMetricInteger(row.day_of_week),
    hour_local: toMetricInteger(row?.hour_local),
    minute_local: toMetricInteger(row?.minute_local),
    timezone: row?.timezone || 'Asia/Ho_Chi_Minh',
    recipients: Array.isArray(row?.recipients) ? row.recipients.map((value: unknown) => String(value || '').trim()).filter(Boolean) : [],
    enabled: Boolean(row?.enabled),
    next_run_at: row?.next_run_at || null,
    last_sent_at: row?.last_sent_at || null,
    last_error_at: row?.last_error_at || null,
    last_error_message: row?.last_error_message || null,
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || new Date().toISOString(),
});

const normalizeAdminTopProductMetricRow = (row: any): AdminTopProductMetric => ({
    product_id: toMetricInteger(row?.product_id),
    product_name: row?.product_name || '',
    brand: row?.brand || '',
    units_sold: toMetricInteger(row?.units_sold),
    order_count: toMetricInteger(row?.order_count),
    gross_revenue: toMetricNumber(row?.gross_revenue),
});

const normalizeAdminServicePerformanceRow = (row: any): AdminServicePerformanceMetric => ({
    service_id: toMetricInteger(row?.service_id),
    service_name: row?.service_name || '',
    appointment_count: toMetricInteger(row?.appointment_count),
    completed_count: toMetricInteger(row?.completed_count),
    cancelled_count: toMetricInteger(row?.cancelled_count),
    pending_count: toMetricInteger(row?.pending_count),
    realized_revenue: toMetricNumber(row?.realized_revenue),
});

const normalizeAdminAppointmentDrilldownRow = (row: any): AdminAppointmentDrilldown => ({
    id: row?.id || '',
    patient_id: row?.patient_id || '',
    patient_name: row?.patient_name || '',
    patient_email: row?.patient_email || '',
    patient_phone: row?.patient_phone || '',
    doctor_id: row?.doctor_id || '',
    doctor_name: row?.doctor_name || '',
    service_id: toMetricInteger(row?.service_id),
    service_name: row?.service_name || '',
    date: row?.date || '',
    time: row?.time || '',
    notes: row?.notes || '',
    status: row?.status || 'pending',
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || row?.created_at || new Date().toISOString(),
    invoice_total_amount: toMetricNumber(row?.invoice_total_amount),
    invoice_payment_status: row?.invoice_payment_status || '',
    invoice_payment_method: row?.invoice_payment_method || '',
    invoice_payment_date: row?.invoice_payment_date || null,
});

export async function getAdminDashboardKpiSnapshot(params?: {
    from?: string | null;
    to?: string | null;
}): Promise<AdminDashboardKpiSnapshot> {
    if (USE_D1_API) {
        const search = new URLSearchParams();
        if (params?.from) search.set('from', params.from);
        if (params?.to) search.set('to', params.to);
        const payload = await d1ApiFetch<{ kpi: any }>(`/api/admin/dashboard/kpi?${search.toString()}`);
        return normalizeAdminDashboardKpiSnapshotRow(payload.kpi || {});
    }
    const { data, error } = await supabase.rpc('admin_kpi_snapshot', {
        p_from: params?.from || null,
        p_to: params?.to || null,
    });

    if (error) throw new Error(`Không thể tải KPI dashboard: ${error.message}`);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Không nhận được dữ liệu KPI dashboard.');
    return normalizeAdminDashboardKpiSnapshotRow(row);
}

export async function getAdminOrdersTimeseries(params?: {
    from?: string | null;
    to?: string | null;
    granularity?: 'day' | 'week';
}): Promise<AdminDashboardTimeseriesPoint[]> {
    if (USE_D1_API) {
        const search = new URLSearchParams({ granularity: params?.granularity || 'day' });
        if (params?.from) search.set('from', params.from);
        if (params?.to) search.set('to', params.to);
        const payload = await d1ApiFetch<{ timeseries: any[] }>(`/api/admin/dashboard/timeseries?${search.toString()}`);
        return (payload.timeseries || []).map(normalizeAdminDashboardTimeseriesRow);
    }
    const { data, error } = await supabase.rpc('admin_orders_timeseries', {
        p_from: params?.from || null,
        p_to: params?.to || null,
        p_granularity: params?.granularity || 'day',
    });

    if (error) throw new Error(`Không thể tải chuỗi thời gian dashboard: ${error.message}`);
    return (data || []).map(normalizeAdminDashboardTimeseriesRow);
}

export async function getAdminInventoryMetrics(): Promise<AdminInventoryMetrics> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ inventory: any }>('/api/admin/dashboard/inventory');
        return normalizeAdminInventoryMetricsRow(payload.inventory || {});
    }
    const { data, error } = await supabase.rpc('admin_inventory_metrics');
    if (error) throw new Error(`Không thể tải chỉ số kho hàng: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Không nhận được dữ liệu kho hàng.');
    return normalizeAdminInventoryMetricsRow(row);
}

export async function getAdminCustomerMetrics(params?: {
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
}): Promise<AdminCustomerMetric[]> {
    if (USE_D1_API) {
        const search = new URLSearchParams({
            limit: String(params?.limit ?? 25),
            offset: String(params?.offset ?? 0),
        });
        if (params?.from) search.set('from', params.from);
        if (params?.to) search.set('to', params.to);
        const payload = await d1ApiFetch<{ customers: any[] }>(`/api/admin/dashboard/customers?${search.toString()}`);
        return (payload.customers || []).map(normalizeAdminCustomerMetricRow);
    }
    const { data, error } = await supabase.rpc('admin_customer_metrics', {
        p_from: params?.from || null,
        p_to: params?.to || null,
        p_limit: params?.limit ?? 25,
        p_offset: params?.offset ?? 0,
    });

    if (error) throw new Error(`Không thể tải chỉ số khách hàng: ${error.message}`);
    return (data || []).map(normalizeAdminCustomerMetricRow);
}

export async function getAdminTopProducts(params?: {
    from?: string | null;
    to?: string | null;
    limit?: number;
}): Promise<AdminTopProductMetric[]> {
    if (USE_D1_API) {
        const search = new URLSearchParams({ limit: String(params?.limit ?? 10) });
        if (params?.from) search.set('from', params.from);
        if (params?.to) search.set('to', params.to);
        const payload = await d1ApiFetch<{ products: any[] }>(`/api/admin/dashboard/top-products?${search.toString()}`);
        return (payload.products || []).map(normalizeAdminTopProductMetricRow);
    }
    const { data, error } = await supabase.rpc('admin_top_products', {
        p_from: params?.from || null,
        p_to: params?.to || null,
        p_limit: params?.limit ?? 10,
    });

    if (error) throw new Error(`Không thể tải top sản phẩm: ${error.message}`);
    return (data || []).map(normalizeAdminTopProductMetricRow);
}

export async function getAdminServicePerformance(params?: {
    from?: string | null;
    to?: string | null;
    limit?: number;
}): Promise<AdminServicePerformanceMetric[]> {
    if (USE_D1_API) {
        const search = new URLSearchParams({ limit: String(params?.limit ?? 10) });
        if (params?.from) search.set('from', params.from);
        if (params?.to) search.set('to', params.to);
        const payload = await d1ApiFetch<{ services: any[] }>(`/api/admin/dashboard/services?${search.toString()}`);
        return (payload.services || []).map(normalizeAdminServicePerformanceRow);
    }
    const { data, error } = await supabase.rpc('admin_service_performance', {
        p_from: params?.from || null,
        p_to: params?.to || null,
        p_limit: params?.limit ?? 10,
    });

    if (error) throw new Error(`Không thể tải hiệu suất dịch vụ: ${error.message}`);
    return (data || []).map(normalizeAdminServicePerformanceRow);
}

export async function getAdminAppointmentsDrilldown(params?: {
    fromDate?: string | null;
    toDate?: string | null;
    status?: Appointment['status'] | 'all' | null;
    serviceId?: number | null;
    doctorId?: string | null;
    search?: string | null;
    limit?: number;
    offset?: number;
}): Promise<AdminAppointmentDrilldown[]> {
    if (USE_D1_API) {
        const search = new URLSearchParams({
            limit: String(params?.limit ?? 200),
            offset: String(params?.offset ?? 0),
        });
        if (params?.fromDate) search.set('fromDate', params.fromDate);
        if (params?.toDate) search.set('toDate', params.toDate);
        if (params?.status && params.status !== 'all') search.set('status', params.status);
        if (params?.serviceId != null) search.set('serviceId', String(params.serviceId));
        if (params?.doctorId) search.set('doctorId', params.doctorId);
        if (params?.search?.trim()) search.set('search', params.search.trim());
        const payload = await d1ApiFetch<{ appointments: any[] }>(`/api/admin/dashboard/appointments?${search.toString()}`);
        return (payload.appointments || []).map(normalizeAdminAppointmentDrilldownRow);
    }
    const { data, error } = await supabase.rpc('admin_appointments_drilldown', {
        p_from_date: params?.fromDate || null,
        p_to_date: params?.toDate || null,
        p_status: !params?.status || params.status === 'all' ? null : params.status,
        p_service_id: params?.serviceId ?? null,
        p_doctor_id: params?.doctorId ?? null,
        p_search: params?.search?.trim() || null,
        p_limit: params?.limit ?? 200,
        p_offset: params?.offset ?? 0,
    });

    if (error) throw new Error(`Không thể tải danh sách lịch hẹn quản trị: ${error.message}`);
    return (data || []).map(normalizeAdminAppointmentDrilldownRow);
}

export async function updateAdminAppointmentStatus(
    appointmentId: string,
    status: Appointment['status']
): Promise<Appointment> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ appointment: Appointment }>(`/api/admin/appointments/${encodeURIComponent(appointmentId)}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        return payload.appointment;
    }
    const { data, error } = await supabase.rpc('admin_update_appointment_status', {
        p_appointment_id: appointmentId,
        p_status: status,
    });

    if (error) throw new Error(`Không thể cập nhật trạng thái lịch hẹn: ${error.message}`);

    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row || !row.id) {
        throw new Error('Không nhận được dữ liệu lịch hẹn sau khi cập nhật.');
    }

    return row as Appointment;
}

export async function getAdminAlertFeed(limit = 25): Promise<AdminDashboardAlert[]> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ alerts: any[] }>(`/api/admin/dashboard/alerts?limit=${encodeURIComponent(String(limit))}`);
        return (payload.alerts || []).map(normalizeAdminDashboardAlertRow);
    }
    const { data, error } = await supabase.rpc('admin_alert_feed', {
        p_limit: limit,
    });

    if (error) throw new Error(`Không thể tải cảnh báo dashboard: ${error.message}`);
    return (data || []).map(normalizeAdminDashboardAlertRow);
}

export async function getAdminReportSchedules(): Promise<AdminReportSchedule[]> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ schedules: any[] }>('/api/admin/report-schedules');
        return (payload.schedules || []).map(normalizeAdminReportScheduleRow);
    }
    const { data, error } = await supabase.rpc('admin_list_report_schedules');
    if (error) throw new Error(`Không thể tải lịch gửi báo cáo: ${error.message}`);
    return (data || []).map(normalizeAdminReportScheduleRow);
}

export async function saveAdminReportSchedule(input: {
    id?: string;
    name: string;
    preset: AdminReportPreset;
    frequency: AdminReportFrequency;
    dayOfWeek?: number | null;
    hourLocal: number;
    minuteLocal?: number;
    timezone?: string;
    recipients: string[];
    enabled: boolean;
}): Promise<AdminReportSchedule> {
    const recipients = Array.from(new Set((input.recipients || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (!input.name.trim()) {
        throw new Error('Tên lịch gửi báo cáo không được để trống.');
    }
    if (!recipients.length) {
        throw new Error('Cần ít nhất một email nhận báo cáo.');
    }

    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ schedule: any }>('/api/admin/report-schedules', {
            method: 'POST',
            body: JSON.stringify({
                id: input.id,
                name: input.name.trim(),
                preset: input.preset,
                frequency: input.frequency,
                dayOfWeek: input.frequency === 'weekly' ? (input.dayOfWeek ?? 1) : null,
                hourLocal: input.hourLocal,
                minuteLocal: input.minuteLocal ?? 0,
                timezone: input.timezone?.trim() || 'Asia/Ho_Chi_Minh',
                recipients,
                enabled: Boolean(input.enabled),
            }),
        });
        return normalizeAdminReportScheduleRow(payload.schedule || {});
    }

    const { data, error } = await supabase.rpc('admin_upsert_report_schedule', {
        p_id: input.id || null,
        p_name: input.name.trim(),
        p_preset: input.preset,
        p_frequency: input.frequency,
        p_day_of_week: input.frequency === 'weekly' ? (input.dayOfWeek ?? 1) : null,
        p_hour_local: input.hourLocal,
        p_minute_local: input.minuteLocal ?? 0,
        p_timezone: input.timezone?.trim() || 'Asia/Ho_Chi_Minh',
        p_recipients: recipients,
        p_enabled: Boolean(input.enabled),
    });

    if (error) throw new Error(`Không thể lưu lịch gửi báo cáo: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Không nhận được dữ liệu lịch gửi báo cáo sau khi lưu.');
    return normalizeAdminReportScheduleRow(row);
}

export async function deleteAdminReportSchedule(id: string): Promise<void> {
    if (USE_D1_API) {
        await d1ApiFetch(`/api/admin/report-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.rpc('admin_delete_report_schedule', {
        p_id: id,
    });
    if (error) throw new Error(`Không thể xóa lịch gửi báo cáo: ${error.message}`);
}

export async function getAdminObservabilityLogs(limit = 20, days = 7): Promise<ObservabilityLogsResponse> {
    const search = new URLSearchParams({
        limit: String(Math.max(1, Math.min(100, Math.floor(limit || 20)))),
        days: String(Math.max(1, Math.min(30, Math.floor(days || 7)))),
    });
    return fetchAdminWorkerJson<ObservabilityLogsResponse>(`/api/admin/observability/logs?${search.toString()}`, {
        method: 'GET',
    });
}

export async function getAdminObservabilitySummary(days = 7): Promise<ObservabilityMetricsSummaryResponse> {
    const search = new URLSearchParams({
        days: String(Math.max(1, Math.min(30, Math.floor(days || 7)))),
    });
    return fetchAdminWorkerJson<ObservabilityMetricsSummaryResponse>(`/api/admin/observability/summary?${search.toString()}`, {
        method: 'GET',
    });
}

export async function runAdminObservabilityCleanup(params: {
    daysToKeep: number;
    dryRun?: boolean;
}): Promise<ObservabilityCleanupResult> {
    const body = {
        daysToKeep: Math.max(1, Math.min(90, Math.floor(params.daysToKeep || 14))),
        dryRun: params.dryRun !== false,
    };
    return fetchAdminWorkerJson<ObservabilityCleanupResult>('/api/admin/observability/cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

export async function getAdminEditorDraft<T>(draftKey: string): Promise<AdminEditorDraftRecord<T> | null> {
    const search = new URLSearchParams({
        draftKey: String(draftKey || '').trim(),
    });
    const response = await fetchAdminWorkerJson<AdminEditorDraftResponse<T>>(`/api/admin/editor-drafts?${search.toString()}`, {
        method: 'GET',
    });
    return response.draft;
}

export async function saveAdminEditorDraft<T>(params: {
    draftKey: string;
    savedAt?: string | null;
    data: T;
}): Promise<AdminEditorDraftRecord<T>> {
    const response = await fetchAdminWorkerJson<AdminEditorDraftResponse<T>>('/api/admin/editor-drafts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            draftKey: String(params.draftKey || '').trim(),
            savedAt: params.savedAt || new Date().toISOString(),
            data: params.data,
        }),
    });
    if (!response.draft) {
        throw new Error('Không nhận được bản nháp server sau khi lưu.');
    }
    return response.draft;
}

export async function deleteAdminEditorDraft(draftKey: string): Promise<AdminEditorDraftDeleteResult> {
    const search = new URLSearchParams({
        draftKey: String(draftKey || '').trim(),
    });
    return fetchAdminWorkerJson<AdminEditorDraftDeleteResult>(`/api/admin/editor-drafts?${search.toString()}`, {
        method: 'DELETE',
    });
}

export async function getAdminProductContentReviews(productIds: number[]): Promise<ProductContentReviewRecord[]> {
    const normalizedIds = Array.from(new Set((productIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (!normalizedIds.length) return [];

    const search = new URLSearchParams({
        productIds: normalizedIds.join(','),
    });
    const response = await fetchAdminWorkerJson<ProductContentReviewListResponse>(`/api/admin/product-content-reviews?${search.toString()}`, {
        method: 'GET',
    });
    return response.reviews || [];
}

export async function saveAdminProductContentReview(input: {
    product_id: number;
    review_status: ProductContentReviewStatus;
    review_notes?: string;
    rewrite_brief?: string;
    audit_score: number;
    blocker_count: number;
    warning_count: number;
    issues: ProductContentIssue[];
    content_signature: string;
}): Promise<ProductContentReviewRecord> {
    const response = await fetchAdminWorkerJson<ProductContentReviewUpsertResponse>('/api/admin/product-content-reviews', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            product_id: Number(input.product_id),
            review_status: input.review_status,
            review_notes: String(input.review_notes || '').trim(),
            rewrite_brief: String(input.rewrite_brief || '').trim(),
            audit_score: Number(input.audit_score) || 0,
            blocker_count: Number(input.blocker_count) || 0,
            warning_count: Number(input.warning_count) || 0,
            issues: Array.isArray(input.issues) ? input.issues : [],
            content_signature: String(input.content_signature || '').trim(),
        }),
    });
    if (!response.review) {
        throw new Error('Không nhận được dữ liệu kiểm duyệt sau khi lưu.');
    }
    return response.review;
}

// --- Patient Document Management ---

export async function uploadDocument(userId: string, file: File): Promise<PatientDocument> {
    let fileToUpload = file;
    // Conditionally convert to WebP if it's an image
    if (file.type.startsWith('image/')) {
        fileToUpload = await convertImageToWebP(file);
    }

    if (USE_D1_API) {
        const form = new FormData();
        form.set('ownerUserId', userId);
        form.set('file', fileToUpload, fileToUpload.name);
        const payload = await d1ApiFetch<{ document: PatientDocument }>('/api/account/documents', {
            method: 'POST',
            body: form,
        });
        return payload.document;
    }

    const filePath = `${userId}/${Date.now()}-${fileToUpload.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
        .from('patient-documents')
        .upload(filePath, fileToUpload, { cacheControl: '31536000', upsert: true });

    if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);

    const { data, error: dbError } = await supabase
        .from('patient_uploaded_documents')
        .insert({
            patient_id: userId,
            file_path: filePath,
            file_name: fileToUpload.name,
            mime_type: fileToUpload.type,
        })
        .select()
        .single();

    if (dbError) throw new Error(`Lỗi lưu thông tin tệp: ${dbError.message}`);

    return data;
}

export async function deleteDocument(documentId: string, filePath: string): Promise<void> {
    if (USE_D1_API) {
        await d1ApiFetch<{ ok: boolean }>(`/api/account/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
        return;
    }
    const { error: storageError } = await supabase.storage
        .from('patient-documents')
        .remove([filePath]);

    if (storageError) throw new Error(`Lỗi xóa tệp khỏi storage: ${storageError.message}`);

    const { error: dbError } = await supabase
        .from('patient_uploaded_documents')
        .delete()
        .eq('id', documentId);

    if (dbError) throw new Error(`Lỗi xóa thông tin tệp: ${dbError.message}`);
}

export async function updateDocumentSummary(documentId: string, summary: string): Promise<PatientDocument> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ document: PatientDocument }>(`/api/account/documents/${encodeURIComponent(documentId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ summary }),
        });
        return payload.document;
    }
    const { data, error } = await supabase
        .from('patient_uploaded_documents')
        .update({ ai_summary: summary })
        .eq('id', documentId)
        .select()
        .single();

    if (error) throw new Error(`Lỗi cập nhật tóm tắt AI: ${error.message}`);

    return data;
}

// --- Product Reviews ---

export async function getProductReviews(productId: number): Promise<ProductReview[]> {
    if (USE_D1_API) {
        const response = await d1ApiFetch<{ reviews: ProductReview[] }>(`/api/products/${productId}/reviews`);
        return response.reviews || [];
    }
    let reviewsData: any[] = [];
    const publicViewResult = await supabase
        .from('public_product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (publicViewResult.error) {
        const fallbackResult = await supabase
            .from('product_reviews')
            .select(`
                *,
                author:patients (name, avatar_path)
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (fallbackResult.error) throw new Error(`Error fetching product reviews: ${fallbackResult.error.message}`);
        reviewsData = fallbackResult.data || [];
    } else {
        reviewsData = publicViewResult.data || [];
    }

    const reviewsWithUrls = await Promise.all(
        reviewsData.map(async (r) => {
            const author = Array.isArray(r.author)
                ? r.author[0]
                : (r.author || {
                    name: r.author_name || 'Khách hàng',
                    avatar_path: r.author_avatar_path || '',
                });
            if (author && author.avatar_path && !author.avatar_url) {
                author.avatar_url = await getPublicUrl('avatars', author.avatar_path);
            }
            return { ...r, author };
        })
    );
    return reviewsWithUrls;
}

export async function canReviewProduct(productId: number, userId: string): Promise<boolean> {
    if (USE_D1_API) {
        const response = await d1ApiFetch<{ eligible: boolean }>(`/api/products/${productId}/reviews/eligibility`);
        return Boolean(response.eligible);
    }
    const { data, error } = await supabase.rpc('can_review_product', {
        p_product_id: productId,
        p_user_id: userId,
    });

    if (error) {
        throw new Error(`Error checking review eligibility: ${error.message}`);
    }

    return Boolean(data);
}

export async function createProductReview(review: Omit<ProductReview, 'id' | 'created_at' | 'author'>) {
    if (USE_D1_API) {
        const response = await d1ApiFetch<{ review: ProductReview }>(`/api/products/${review.product_id}/reviews`, {
            method: 'POST',
            body: JSON.stringify(review),
        });
        return response.review;
    }
    const { data, error } = await supabase
        .from('product_reviews')
        .insert(review)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') { // unique constraint violation
            throw new Error('Bạn đã đánh giá sản phẩm này rồi.');
        }
        if (error.code === '42501') {
            throw new Error('Chỉ khách hàng đã hoàn tất đơn mua mới có thể đánh giá sản phẩm này.');
        }
        throw new Error(`Error creating review: ${error.message}`);
    }
    return data;
}

// --- AI Services ---
export async function generateProductDetailsFromAI(productName: string, categories: ProductCategory[]): Promise<any> {
    const isTransientAiDraftFailure = (status?: number, message: string = '') => {
        const lower = message.toLowerCase();
        if ([
            'not configured',
            'location is not supported',
            'api key',
            'permission denied',
            'invalid argument',
        ].some((token) => lower.includes(token))) {
            return false;
        }

        if (typeof status === 'number' && [429, 500, 502, 503, 504].includes(status)) {
            return true;
        }

        return [
            'currently experiencing high demand',
            'unavailable',
            'temporarily unavailable',
            'resource exhausted',
            'try again later',
            'timeout',
            'timed out',
            'deadline exceeded',
            'overloaded',
        ].some((token) => lower.includes(token));
    };

    const buildAiDraftUserError = (status: number | undefined, message: string) => {
        const lower = message.toLowerCase();
        if (lower.includes('not configured')) {
            return new Error('Không thể tạo nội dung sản phẩm vì dịch vụ AI chưa được cấu hình trên máy chủ.');
        }
        if (lower.includes('location is not supported')) {
            return new Error('Không thể tạo nội dung sản phẩm vì Google không hỗ trợ vị trí hạ tầng đang xử lý yêu cầu.');
        }
        if (status === 401 || status === 403 || lower.includes('permission denied') || lower.includes('api key')) {
            return new Error('Không thể dùng dịch vụ AI để tạo nội dung sản phẩm vì khóa API hoặc quyền truy cập chưa hợp lệ.');
        }
        if (status === 429) {
            return new Error('Dịch vụ AI đang bị giới hạn tần suất. Vui lòng thử lại sau ít phút.');
        }
        if (isTransientAiDraftFailure(status, message)) {
            return new Error('Dịch vụ AI đang tạm quá tải hoặc phản hồi chậm. Hệ thống đã thử chuyển sang đường fallback nhưng chưa thành công. Vui lòng thử lại sau vài phút.');
        }
        if (status && status >= 400) {
            return new Error(`Không thể tạo nội dung sản phẩm do dịch vụ AI trả về lỗi ${status}. Vui lòng thử lại sau.`);
        }
        return new Error('Không thể tạo nội dung sản phẩm do dịch vụ AI gặp lỗi ngoài dự kiến. Vui lòng thử lại sau.');
    };

    const normalizeList = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            return value
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/\r?\n|,/)
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return [];
    };

    const flattenLongDescription = (value: unknown): string => {
        if (typeof value === 'string') {
            return value.trim();
        }
        if (!Array.isArray(value)) {
            return '';
        }

        return value
            .map((block) => {
                if (!block || typeof block !== 'object') return '';
                const typedBlock = block as Record<string, unknown>;
                if (typedBlock.type === 'text' && typeof typedBlock.content === 'string') {
                    return typedBlock.content.trim();
                }
                if (typedBlock.type === 'image' && typeof typedBlock.caption === 'string' && typedBlock.caption.trim()) {
                    return `![${typedBlock.caption.trim()}](${typeof typedBlock.image_path === 'string' ? typedBlock.image_path : ''})`;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n\n')
            .trim();
    };

    const normalizeDraftPayload = (payload: any) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Không nhận được dữ liệu AI hợp lệ.');
        }

        const resolvedCategorySlug =
            (typeof payload.category_slug === 'string' && payload.category_slug.trim()) ||
            categories.find((category) => category.id === payload.category_id)?.slug ||
            categories.find((category) => category.name?.toLowerCase?.() === String(payload.category_name || '').toLowerCase())?.slug ||
            '';

        return {
            description: typeof payload.description === 'string' ? payload.description.trim() : '',
            long_description: flattenLongDescription(payload.long_description),
            price: Number(payload.price) || 0,
            stock_quantity: Number(payload.stock_quantity) || 10,
            usage_instructions: typeof payload.usage_instructions === 'string' ? payload.usage_instructions.trim() : '',
            ingredients: typeof payload.ingredients === 'string' ? payload.ingredients.trim() : '',
            key_benefits: normalizeList(payload.key_benefits),
            skin_types: normalizeList(payload.skin_types),
            volume: typeof payload.volume === 'string' ? payload.volume.trim() : '',
            texture: typeof payload.texture === 'string' ? payload.texture.trim() : '',
            origin: typeof payload.origin === 'string' ? payload.origin.trim() : '',
            precautions: typeof payload.precautions === 'string' ? payload.precautions.trim() : '',
            faq_items: sanitizeDetailFaqItems(payload.faq_items),
            brand: typeof payload.brand === 'string' ? payload.brand.trim() : '',
            category_slug: resolvedCategorySlug,
            seo_title: typeof payload.seo_title === 'string' ? payload.seo_title.trim() : '',
            seo_description: typeof payload.seo_description === 'string' ? payload.seo_description.trim() : '',
            seo_keywords: typeof payload.seo_keywords === 'string' ? payload.seo_keywords.trim() : '',
        };
    };

    if (!USE_D1_API) {
        try {
            await ensureSessionFresh();

            const { data, error } = await supabase.functions.invoke('generate-product-draft', {
                body: { productName },
            });

            if (error) {
                throw error;
            }

            const payload =
                data?.draft?.generated_payload ||
                data?.draft?.payload ||
                data?.generated_payload ||
                data?.payload ||
                data?.job?.generated_payload ||
                data?.job?.payload ||
                data?.job;

            if (payload) {
                const normalizedPayload = normalizeDraftPayload(payload);
                if (normalizedPayload.faq_items.length > 0) {
                    return normalizedPayload;
                }

                try {
                    const geminiService = await import('./geminiService');
                    normalizedPayload.faq_items = await geminiService.generateProductFaqItems(productName, normalizedPayload);
                } catch (faqError) {
                    console.warn('Could not supplement product FAQ items from Gemini:', faqError);
                }

                return normalizedPayload;
            }
        } catch (error: any) {
            const functionStatus = error?.context?.status;
            let functionErrorMessage = '';

            if (error?.context && typeof error.context.text === 'function') {
                try {
                    const rawBody = await error.context.text();
                    if (rawBody) {
                        try {
                            const parsedBody = JSON.parse(rawBody);
                            functionErrorMessage = parsedBody?.error || parsedBody?.message || rawBody;
                        } catch {
                            functionErrorMessage = rawBody;
                        }
                    }
                } catch {
                    // Ignore body parsing failures and continue with generic fallback rules.
                }
            }

            if (functionStatus === 401 || functionStatus === 403) {
                throw new Error('Phiên đăng nhập quản trị đã hết hạn hoặc không đủ quyền. Vui lòng đăng nhập lại.');
            }

            if (functionErrorMessage) {
                if (isTransientAiDraftFailure(functionStatus, functionErrorMessage)) {
                    console.warn('Backend AI draft generation returned transient model overload; falling back to client Gemini service.', {
                        status: functionStatus,
                        message: functionErrorMessage,
                    });
                } else {
                    throw buildAiDraftUserError(functionStatus, functionErrorMessage);
                }
            }

            const backendMessage = typeof error?.message === 'string' ? error.message : '';
            if (backendMessage && !/failed to send a request|failed to fetch|non-2xx/i.test(backendMessage)) {
                if (isTransientAiDraftFailure(functionStatus, backendMessage)) {
                    console.warn('Backend AI draft generation failed transiently; falling back to client Gemini service.', {
                        status: functionStatus,
                        message: backendMessage,
                    });
                } else {
                    throw buildAiDraftUserError(functionStatus, backendMessage);
                }
            }

            console.warn('Backend AI draft generation unavailable, falling back to client Gemini service.', error);
        }
    }

    try {
        const geminiService = await import('./geminiService');
        const details = await geminiService.generateProductDetails(productName, categories);
        return {
            ...details,
            faq_items: sanitizeDetailFaqItems(details?.faq_items),
        };
    } catch (error) {
        console.error("API layer error calling Gemini service:", error);
        throw error; // Re-throw the error to be handled by the UI
    }
}

// --- Wishlist ---
export async function addProductToWishlist(userId: string, productId: number) {
    if (USE_D1_API) {
        const session = await getCurrentAuthSession();
        if (!session || session.id !== userId) throw new Error('Phiên tài khoản không khớp.');
        await d1ApiFetch<{ ok: boolean }>(`/api/account/wishlist/${productId}`, { method: 'POST' });
        return;
    }
    const { error } = await supabase.from('user_wishlist').insert({ user_id: userId, product_id: productId });
    if (error) throw new Error(`Error adding to wishlist: ${error.message}`);
}

export async function removeProductFromWishlist(userId: string, productId: number) {
    if (USE_D1_API) {
        const session = await getCurrentAuthSession();
        if (!session || session.id !== userId) throw new Error('Phiên tài khoản không khớp.');
        await d1ApiFetch<{ ok: boolean }>(`/api/account/wishlist/${productId}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.from('user_wishlist').delete().match({ user_id: userId, product_id: productId });
    if (error) throw new Error(`Error removing from wishlist: ${error.message}`);
}

// --- Discount Codes ---
export async function getDiscountCode(code: string, subtotal: number, userId?: string | null): Promise<DiscountCode> {
    if (USE_D1_API) {
        const search = new URLSearchParams({ code: code.trim().toUpperCase(), subtotal: String(subtotal) });
        const payload = await d1ApiFetch<{ discount: any }>(`/api/discount-codes/validate?${search.toString()}`);
        return normalizeDiscountCodeRow(payload.discount || {});
    }
    const { data, error } = await supabase.rpc('validate_discount_code', {
        p_code: code,
        p_subtotal: subtotal,
        p_user_id: userId || null,
    });

    if (error) throw new Error(error.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');

    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row || !row.code) {
        throw new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }

    return {
        code: row.code,
        type: row.type,
        value: Number(row.value || 0),
        min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : undefined,
        max_discount_amount: row.max_discount_amount != null ? Number(row.max_discount_amount) : undefined,
        preview_discount_amount: row.preview_discount_amount != null ? Number(row.preview_discount_amount) : undefined,
    };
}

const normalizeDiscountCodeRow = (row: any): DiscountCode => ({
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value || 0),
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0,
    max_discount_amount: row.max_discount_amount != null ? Number(row.max_discount_amount) : undefined,
    starts_at: row.starts_at || null,
    ends_at: row.ends_at || null,
    usage_limit: row.usage_limit ?? null,
    usage_limit_per_user: row.usage_limit_per_user ?? null,
    usage_count: row.usage_count ?? 0,
    is_active: row.is_active ?? true,
    description: row.description ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export async function getDiscountCodesAdmin(): Promise<DiscountCode[]> {
    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ discountCodes: any[] }>('/api/admin/discount-codes');
        return (response.discountCodes || []).map(normalizeDiscountCodeRow);
    }
    const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Error fetching discount codes: ${error.message}`);
    return (data || []).map(normalizeDiscountCodeRow);
}

export async function saveDiscountCodeAdmin(discountCode: Partial<DiscountCode>): Promise<DiscountCode> {
    if (!discountCode.code || !discountCode.type || discountCode.value == null) {
        throw new Error('Thiếu thông tin bắt buộc của mã giảm giá.');
    }

    const payload = {
        id: discountCode.id,
        code: discountCode.code.trim().toUpperCase(),
        type: discountCode.type,
        value: discountCode.value,
        min_purchase_amount: discountCode.min_purchase_amount ?? 0,
        max_discount_amount: discountCode.max_discount_amount ?? null,
        starts_at: discountCode.starts_at || null,
        ends_at: discountCode.ends_at || null,
        usage_limit: discountCode.usage_limit ?? null,
        usage_limit_per_user: discountCode.usage_limit_per_user ?? null,
        is_active: discountCode.is_active ?? true,
        description: discountCode.description ?? null,
    };

    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ discountCode: any }>('/api/admin/discount-codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return normalizeDiscountCodeRow(response.discountCode);
    }

    if (discountCode.id) {
        const { data, error } = await supabase
            .from('discount_codes')
            .update(payload)
            .eq('id', discountCode.id)
            .select()
            .single();

        if (error) throw new Error(`Error updating discount code: ${error.message}`);
        return normalizeDiscountCodeRow(data);
    }

    const { data, error } = await supabase
        .from('discount_codes')
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(`Error creating discount code: ${error.message}`);
    return normalizeDiscountCodeRow(data);
}

export async function deleteDiscountCodeAdmin(id: string): Promise<void> {
    if (USE_D1_API) {
        await fetchAdminWorkerJson(`/api/admin/discount-codes/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) throw new Error(`Error deleting discount code: ${error.message}`);
}

const normalizeTaxProfileRow = (row: any): TaxProfile => ({
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    tax_mode: row.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive',
    default_rate: Number(row.default_rate || 0),
    applies_to_shipping: Boolean(row.applies_to_shipping),
    currency: row.currency || 'VND',
    is_active: row.is_active ?? true,
    is_default: row.is_default ?? false,
    starts_at: row.starts_at || null,
    ends_at: row.ends_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const normalizeTaxRateRow = (row: any): TaxRate => ({
    id: row.id,
    tax_profile_id: row.tax_profile_id,
    province: row.province || null,
    district: row.district || null,
    rate: Number(row.rate || 0),
    applies_to_shipping: row.applies_to_shipping == null ? null : Boolean(row.applies_to_shipping),
    currency: row.currency || null,
    priority: Number(row.priority || 0),
    is_active: row.is_active ?? true,
    starts_at: row.starts_at || null,
    ends_at: row.ends_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export async function getTaxProfilesAdmin(): Promise<TaxProfile[]> {
    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ taxProfiles: any[] }>('/api/admin/tax-profiles');
        return (response.taxProfiles || []).map((row) => ({
            ...normalizeTaxProfileRow(row),
            rates: Array.isArray(row.rates) ? row.rates.map(normalizeTaxRateRow) : [],
        }));
    }
    const [{ data: profiles, error: profileError }, { data: rates, error: rateError }] = await Promise.all([
        supabase
            .from('tax_profiles')
            .select('*')
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true }),
        supabase
            .from('tax_rates')
            .select('*')
            .order('tax_profile_id', { ascending: true })
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true }),
    ]);

    if (profileError) throw new Error(`Error fetching tax profiles: ${profileError.message}`);
    if (rateError) throw new Error(`Error fetching tax rates: ${rateError.message}`);

    const groupedRates = new Map<string, TaxRate[]>();
    for (const row of rates || []) {
        const normalized = normalizeTaxRateRow(row);
        const bucket = groupedRates.get(normalized.tax_profile_id) || [];
        bucket.push(normalized);
        groupedRates.set(normalized.tax_profile_id, bucket);
    }

    return (profiles || []).map((row) => ({
        ...normalizeTaxProfileRow(row),
        rates: groupedRates.get(row.id) || [],
    }));
}

export async function saveTaxProfileAdmin(profile: Partial<TaxProfile>): Promise<TaxProfile> {
    if (!profile.code?.trim() || !profile.name?.trim()) {
        throw new Error('Thiếu mã hoặc tên hồ sơ thuế.');
    }

    const defaultRate = Number(profile.default_rate ?? 0);
    if (!Number.isFinite(defaultRate) || defaultRate < 0 || defaultRate > 1) {
        throw new Error('Thuế mặc định phải nằm trong khoảng từ 0% đến 100%.');
    }

    const payload = {
        id: profile.id,
        code: profile.code.trim().toUpperCase(),
        name: profile.name.trim(),
        tax_mode: profile.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive',
        default_rate: Number(defaultRate.toFixed(6)),
        applies_to_shipping: Boolean(profile.applies_to_shipping),
        currency: String(profile.currency || 'VND').trim().toUpperCase() || 'VND',
        is_active: profile.is_active ?? true,
        is_default: profile.is_default ?? false,
        starts_at: profile.starts_at || null,
        ends_at: profile.ends_at || null,
    };

    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ taxProfile: any }>('/api/admin/tax-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return normalizeTaxProfileRow(response.taxProfile);
    }

    let data: any;
    let error: any;

    if (profile.id) {
        ({ data, error } = await supabase
            .from('tax_profiles')
            .update(payload)
            .eq('id', profile.id)
            .select()
            .single());
    } else {
        ({ data, error } = await supabase
            .from('tax_profiles')
            .insert(payload)
            .select()
            .single());
    }

    if (error) throw new Error(`Error saving tax profile: ${error.message}`);

    if (payload.is_default) {
        const { error: resetDefaultError } = await supabase
            .from('tax_profiles')
            .update({ is_default: false })
            .neq('id', data.id);
        if (resetDefaultError) {
            throw new Error(`Error normalizing default tax profile: ${resetDefaultError.message}`);
        }
        const { error: ensureDefaultError } = await supabase
            .from('tax_profiles')
            .update({ is_default: true })
            .eq('id', data.id);
        if (ensureDefaultError) {
            throw new Error(`Error setting default tax profile: ${ensureDefaultError.message}`);
        }
    }

    return normalizeTaxProfileRow(data);
}

export async function deleteTaxProfileAdmin(id: string): Promise<void> {
    if (USE_D1_API) {
        await fetchAdminWorkerJson(`/api/admin/tax-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
    }
    const { data: existing, error: fetchError } = await supabase
        .from('tax_profiles')
        .select('id, is_default')
        .eq('id', id)
        .single();
    if (fetchError) throw new Error(`Error fetching tax profile: ${fetchError.message}`);

    const { error } = await supabase.from('tax_profiles').delete().eq('id', id);
    if (error) throw new Error(`Error deleting tax profile: ${error.message}`);

    if (existing?.is_default) {
        const { data: nextDefault, error: nextDefaultError } = await supabase
            .from('tax_profiles')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1);
        if (nextDefaultError) throw new Error(`Error selecting fallback default tax profile: ${nextDefaultError.message}`);

        const nextId = nextDefault?.[0]?.id;
        if (nextId) {
            const { error: promoteError } = await supabase
                .from('tax_profiles')
                .update({ is_default: true })
                .eq('id', nextId);
            if (promoteError) throw new Error(`Error promoting fallback default tax profile: ${promoteError.message}`);
        }
    }
}

export async function saveTaxRateAdmin(rate: Partial<TaxRate>): Promise<TaxRate> {
    if (!rate.tax_profile_id) {
        throw new Error('Thiếu hồ sơ thuế cho mức thuế.');
    }

    const rateValue = Number(rate.rate ?? 0);
    if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 1) {
        throw new Error('Mức thuế phải nằm trong khoảng từ 0% đến 100%.');
    }

    const priority = Number(rate.priority ?? 0);
    if (!Number.isFinite(priority) || !Number.isInteger(priority)) {
        throw new Error('Độ ưu tiên phải là số nguyên.');
    }

    const payload = {
        id: rate.id,
        tax_profile_id: rate.tax_profile_id,
        province: rate.province?.trim() || null,
        district: rate.district?.trim() || null,
        rate: Number(rateValue.toFixed(6)),
        applies_to_shipping: rate.applies_to_shipping == null ? null : Boolean(rate.applies_to_shipping),
        currency: rate.currency?.trim().toUpperCase() || null,
        priority,
        is_active: rate.is_active ?? true,
        starts_at: rate.starts_at || null,
        ends_at: rate.ends_at || null,
    };

    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ taxRate: any }>('/api/admin/tax-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return normalizeTaxRateRow(response.taxRate);
    }

    let data: any;
    let error: any;

    if (rate.id) {
        ({ data, error } = await supabase
            .from('tax_rates')
            .update(payload)
            .eq('id', rate.id)
            .select()
            .single());
    } else {
        ({ data, error } = await supabase
            .from('tax_rates')
            .insert(payload)
            .select()
            .single());
    }

    if (error) throw new Error(`Error saving tax rate: ${error.message}`);
    return normalizeTaxRateRow(data);
}

export async function deleteTaxRateAdmin(id: string): Promise<void> {
    if (USE_D1_API) {
        await fetchAdminWorkerJson(`/api/admin/tax-rates/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
    }
    const { error } = await supabase.from('tax_rates').delete().eq('id', id);
    if (error) throw new Error(`Error deleting tax rate: ${error.message}`);
}

const normalizeCheckoutPricingQuote = (row: any): CheckoutPricingQuote => ({
    tax_profile_id: row.tax_profile_id || null,
    tax_mode: row.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive',
    tax_rate: Number(row.tax_rate || 0),
    currency: row.currency || 'VND',
    subtotal: Number(row.subtotal || 0),
    discount_amount: Number(row.discount_amount || 0),
    taxable_amount: Number(row.taxable_amount || 0),
    tax_amount: Number(row.tax_amount || 0),
    shipping_net_amount: Number(row.shipping_net_amount || 0),
    shipping_tax_rate: row.shipping_tax_rate != null ? Number(row.shipping_tax_rate) : undefined,
    shipping_tax_amount: Number(row.shipping_tax_amount || 0),
    shipping_fee: Number(row.shipping_fee || 0),
    grand_total: Number(row.grand_total || 0),
});

export async function quoteProductOrderTotals(params: {
    subtotal: number;
    discount_amount?: number;
    shipping_fee?: number;
    shipping_province?: string;
    shipping_district?: string;
    items?: Array<{ product_id: number; quantity: number }>;
}): Promise<CheckoutPricingQuote> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ quote: any }>('/api/checkout/quote', {
            method: 'POST',
            body: JSON.stringify({
                subtotal: params.subtotal,
                discountAmount: params.discount_amount ?? 0,
                shippingFee: params.shipping_fee ?? 0,
                shippingProvince: params.shipping_province,
                shippingDistrict: params.shipping_district,
                items: params.items,
            }),
        });
        return normalizeCheckoutPricingQuote(payload.quote || {});
    }
    const payload = {
        p_subtotal: params.subtotal,
        p_discount_amount: params.discount_amount ?? 0,
        p_shipping_fee: params.shipping_fee ?? 0,
        p_shipping_province: params.shipping_province || null,
        p_shipping_district: params.shipping_district || null,
        p_items: params.items && params.items.length > 0 ? params.items : null,
    };
    let data: any;
    let error: any;
    ({ data, error } = await supabase.rpc('quote_product_order_totals', payload));

    const errorMessage = String(error?.message || '').toLowerCase();
    if (error && (errorMessage.includes('p_items') || errorMessage.includes('p_shipping_district'))) {
        ({ data, error } = await supabase.rpc('quote_product_order_totals', {
            p_subtotal: params.subtotal,
            p_discount_amount: params.discount_amount ?? 0,
            p_shipping_fee: params.shipping_fee ?? 0,
            p_shipping_province: params.shipping_province || null,
        }));
    }

    if (error) {
        throw new Error(error.message || 'Không thể tính tổng tiền đơn hàng.');
    }

    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row) {
        throw new Error('Không thể tính tổng tiền đơn hàng.');
    }

    return normalizeCheckoutPricingQuote(row);
}

// --- Shipping APIs ---
export async function calculateShippingFee(address: { street: string, province: string, district: string, ward: string }, items: CartItem[]): Promise<{ fee: number; estimated_delivery_time: string; }> {
    const weightInKg = items.reduce((acc, item) => acc + (item.quantity * 0.2), 0); // Assume each item is 0.2kg
    const weightInGrams = Math.round(Math.max(weightInKg, 0.1) * 1000); // GHTK requires weight in grams
    const value = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    if (USE_D1_API) {
        const data = await d1ApiFetch<{ fee: number; estimated_delivery_time?: string }>('/api/shipping/ghtk/fee', {
            method: 'POST',
            body: JSON.stringify({
                address: address.street,
                province: address.province,
                district: address.district,
                ward: address.ward,
                weight: weightInGrams,
                value: Math.round(value),
            }),
        });
        return {
            fee: Number(data.fee || 0),
            estimated_delivery_time: data.estimated_delivery_time || 'Dự kiến 2-4 ngày',
        };
    }

    const { data, error } = await supabase.functions.invoke('calculate-shipping-fee', {
        body: {
            address: address.street,
            province: address.province,
            district: address.district,
            ward: address.ward,
            weight: weightInGrams,
            value: Math.round(value)
        }
    });

    if (error) throw error;

    // The edge function returns GHTK's 'fee' object. The actual fee is the 'fee' property inside it.
    // The response also has a 'delivery' boolean, but not a date. We'll use a generic string.
    return {
        fee: data.fee,
        estimated_delivery_time: `Dự kiến 2-4 ngày`
    };
}

export async function createGhtkShipment(orderId: string): Promise<ProductOrder> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ order: ProductOrder }>('/api/shipping/ghtk/create', {
            method: 'POST',
            body: JSON.stringify({ orderId }),
        });
        return normalizeProductOrderRow(payload.order);
    }
    const { data, error } = await supabase.functions.invoke('create-ghtk-order', {
        body: { order_id: orderId }
    });

    if (error) throw error;
    return normalizeProductOrderRow(data);
}

export async function getGhtkOrderStatus(orderId: string): Promise<GhtkTrackingEvent[]> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ events: GhtkTrackingEvent[] }>(`/api/shipping/ghtk/orders/${encodeURIComponent(orderId)}`);
        return Array.isArray(payload.events) ? payload.events : [];
    }
    const { data, error } = await supabase.functions.invoke('track-ghtk-order', {
        body: { order_id: orderId }
    });

    if (error) throw error;
    return data;
}

export async function printGhtkLabel(orderId: string): Promise<void> {
    if (USE_D1_API) {
        const response = await fetch(`/api/shipping/ghtk/orders/${encodeURIComponent(orderId)}/label`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/pdf' },
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || `Could not generate label (${response.status}).`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 100);
        return;
    }
    const { data, error } = await supabase.functions.invoke('print-ghtk-label', {
        body: { order_id: orderId }
    });

    if (error) {
        // Try to parse the error for a better message
        let errorMessage = error.message;
        try {
            const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
            errorMessage = errorJson.error || errorMessage;
        } catch (e) {
            // Ignore parsing error, use original message
        }
        throw new Error(`Could not generate label: ${errorMessage}`);
    }

    if (!(data instanceof Blob)) {
        throw new Error('Received invalid data from server, expected a PDF file.');
    }

    // Create a URL for the blob and open it in a new tab
    const url = URL.createObjectURL(data);
    window.open(url, '_blank');

    // Clean up the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function cancelGhtkShipment(orderId: string): Promise<ProductOrder> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<{ order: ProductOrder }>('/api/shipping/ghtk/cancel', {
            method: 'POST',
            body: JSON.stringify({ orderId }),
        });
        return normalizeProductOrderRow(payload.order);
    }
    const { data, error } = await supabase.functions.invoke('cancel-ghtk-order', {
        body: { order_id: orderId }
    });

    if (error) {
        let errorMessage = error.message;
        try {
            // Edge functions often wrap errors in a JSON string
            const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
            errorMessage = errorJson.error || errorMessage;
        } catch (e) { /* ignore parsing error */ }
        throw new Error(`Could not cancel shipment: ${errorMessage}`);
    }

    return normalizeProductOrderRow(data);
}

export async function getGhtkPickAddresses(): Promise<GhtkPickAddress[]> {
    if (USE_D1_API) {
        const payload = await d1ApiFetch<GhtkPickAddress[] | { items: GhtkPickAddress[] }>('/api/shipping/ghtk/pick-addresses');
        return Array.isArray(payload) ? payload : (payload.items || []);
    }
    const { data, error } = await supabase.functions.invoke('get-ghtk-pick-addresses');
    if (error) {
        let errorMessage = error.message;
        try {
            const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
            errorMessage = errorJson.error || errorMessage;
        } catch (e) { /* ignore */ }
        throw new Error(`Could not fetch pick addresses: ${errorMessage}`);
    }
    return data;
}

export async function getGhtkPickAddressDetail(addressId: string): Promise<GhtkPickAddressDetail> {
    if (USE_D1_API) {
        return d1ApiFetch<GhtkPickAddressDetail>(`/api/shipping/ghtk/pick-addresses/${encodeURIComponent(addressId)}`);
    }
    const { data, error } = await supabase.functions.invoke('get-ghtk-pick-address-detail', {
        body: { pick_address_id: addressId }
    });
    if (error) {
        let errorMessage = error.message;
        try {
            const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
            errorMessage = errorJson.error || errorMessage;
        } catch (e) { /* ignore */ }
        throw new Error(`Could not fetch pick address detail: ${errorMessage}`);
    }
    return data;
}
// --- Product Brands ---
export async function getBrands(): Promise<ProductBrand[]> {
    return withPublicReadFallback('getBrands', async () => {
        const data = await fetchPublicRuntimeRest<any[]>('product_brands?select=*&order=name.asc');

        return Promise.all(data.map(async brand => ({
            ...brand,
            logo_url: brand.logo_path ? await getPublicUrl('site-assets', brand.logo_path) : undefined
        })));
    }, () => getFallbackBrands());
}

export async function getAdminProductBrands(options: { force?: boolean } = {}): Promise<ProductBrand[]> {
    if (!USE_D1_API) return getBrands();
    return adminDataProvider.read('product-brands', async () => {
        const rows = await readAllAdminPages<any>('/api/admin/product-brands', 'brands');
        return Promise.all(rows.map(async (brand) => ({
            ...brand,
            logo_url: brand.logo_path ? await getPublicUrl('site-assets', brand.logo_path) : undefined,
        } as ProductBrand)));
    }, { force: options.force, maxAgeMs: 45_000 });
}

export async function saveBrand(brand: Partial<ProductBrand>, imageFile: File | null): Promise<ProductBrand> {
    let previousLogoPath = brand.logo_path || undefined;

    if (!USE_D1_API && !previousLogoPath && brand.id) {
        const existingBrandResult = await supabase
            .from('product_brands')
            .select('logo_path')
            .eq('id', brand.id)
            .maybeSingle();
        if (!existingBrandResult.error) {
            previousLogoPath = existingBrandResult.data?.logo_path || undefined;
        }
    }

    let nextLogoPath = previousLogoPath;
    if (imageFile) {
        const processedFile = await convertImageToWebP(imageFile, { targetSizeKB: 200, maxDimension: 1400 });
        const uploadPath = buildBrandLogoImagePath({
            slug: brand.slug,
            name: brand.name,
            extension: getFileExtension(processedFile),
        });
        const uploaded = await uploadPublicImage('site-assets', uploadPath, processedFile);
        nextLogoPath = uploaded.path;
    }

    const payload: Partial<ProductBrand> = { ...brand };
    if (nextLogoPath) {
        payload.logo_path = nextLogoPath;
    } else {
        delete payload.logo_path;
    }

    if (USE_D1_API) {
        const response = await fetchAdminWorkerJson<{ brand: ProductBrand }>('/api/admin/product-brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (imageFile && previousLogoPath && nextLogoPath && previousLogoPath !== nextLogoPath) {
            try {
                await removePublicImages('site-assets', [previousLogoPath]);
            } catch (removeError) {
                console.warn('Could not remove old brand logo:', removeError);
            }
        }
        const savedBrand = response.brand;
        savedBrand.logo_url = savedBrand.logo_path ? await getPublicUrl('site-assets', savedBrand.logo_path) : undefined;
        return savedBrand;
    }

    const { data, error } = await supabase
        .from('product_brands')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        console.error("Error saving brand:", error);
        throw new Error(error.message || JSON.stringify(error));
    }

    if (imageFile && previousLogoPath && nextLogoPath && previousLogoPath !== nextLogoPath) {
        try {
            await removePublicImages('site-assets', [previousLogoPath]);
        } catch (removeError) {
            console.warn('Could not remove old brand logo:', removeError);
        }
    }

    const savedBrand = data as ProductBrand;
    savedBrand.logo_url = savedBrand.logo_path
        ? await getPublicUrl('site-assets', savedBrand.logo_path)
        : undefined;
    return savedBrand;
}

export async function updateProductsBrandName(oldName: string, newName: string): Promise<void> {
    if (USE_D1_API) {
        await fetchAdminWorkerJson('/api/admin/product-brands/rename-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldName, newName }),
        });
        return;
    }
    const { error } = await supabase
        .from('products')
        .update({ brand: newName })
        .eq('brand', oldName);

    if (error) {
        console.error("Error updating products brand name:", error);
        throw new Error(error.message || JSON.stringify(error));
    }
}

export async function deleteBrand(id: number, logoPath?: string): Promise<void> {
    if (logoPath) {
        try {
            await removePublicImages('site-assets', [logoPath]);
        } catch (error) {
            console.warn('Could not remove brand logo from storage:', error);
        }
    }

    if (USE_D1_API) {
        await fetchAdminWorkerJson(`/api/admin/product-brands/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
        return;
    }

    const { error } = await supabase
        .from('product_brands')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
