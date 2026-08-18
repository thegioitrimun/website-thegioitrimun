import type { PublicBootstrapPayload } from '../services/api';
import type { BlogPost, HomepageHero, Product } from '../types';
import { isExpectedPageLifecycleAbort } from './browserLifecycle';
import { FALLBACK_HOMEPAGE_HERO, HOMEPAGE_HERO_CACHE_KEY } from './siteDefaults';

export const mergeBlogCatalog = (currentPosts: BlogPost[], nextPosts: BlogPost[]): BlogPost[] => {
    const currentBySlug = new Map(currentPosts.map((post) => [post.slug, post]));
    const nextSlugs = new Set(nextPosts.map((post) => post.slug));

    const merged = nextPosts.map((post) => {
        const existing = currentBySlug.get(post.slug);
        if (!existing) return post;
        return existing.detail_loaded ? { ...post, ...existing } : { ...existing, ...post };
    });

    for (const post of currentPosts) {
        if (post.detail_loaded && !nextSlugs.has(post.slug)) {
            merged.unshift(post);
        }
    }

    return merged;
};

export const upsertDetailedBlogPost = (currentPosts: BlogPost[], detailedPost: BlogPost): BlogPost[] => {
    const existingIndex = currentPosts.findIndex((entry) => entry.slug === detailedPost.slug);
    if (existingIndex === -1) return [detailedPost, ...currentPosts];
    const next = [...currentPosts];
    next[existingIndex] = { ...next[existingIndex], ...detailedPost };
    return next;
};

export const mergeProductCatalog = (currentProducts: Product[], nextProducts: Product[]): Product[] => {
    const currentById = new Map(currentProducts.map((product) => [product.id, product]));
    const nextIds = new Set(nextProducts.map((product) => product.id));

    const merged = nextProducts.map((product) => {
        const existing = currentById.get(product.id);
        if (!existing) return product;
        return existing.detail_loaded ? { ...product, ...existing } : { ...existing, ...product };
    });

    for (const product of currentProducts) {
        if (product.detail_loaded && !nextIds.has(product.id)) {
            merged.unshift(product);
        }
    }

    return merged;
};

export type RouteEntityStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export const hasDetailedBlogContent = (post?: BlogPost | null): post is BlogPost => {
    return Boolean(post?.detail_loaded && String(post.content || '').trim().length > 0);
};

export const hasDetailedProductPayload = (product?: Product | null): product is Product => {
    return Boolean(product?.detail_loaded);
};

export const hasHomeDeferredPayloadContent = (payload?: Partial<PublicBootstrapPayload> | null): boolean => {
    if (!payload) return false;
    return Boolean(
        payload.brands?.length
        || payload.blogPosts?.length
        || payload.faqItems?.length
        || payload.featuredPostSlugs?.length
    );
};

export const isCoreBootstrapDegraded = (payload: PublicBootstrapPayload): boolean => {
    const expectsCoreCollections = payload.mode === 'home' || payload.mode === 'full';
    const hasMissingServiceStepData = payload.services.some((service) => !Array.isArray(service?.procedure_steps));
    const hasMissingServices = expectsCoreCollections && payload.services.length === 0;
    const hasMissingProducts = expectsCoreCollections && payload.products.length === 0;
    return payload.source === 'fallback'
        || hasMissingServiceStepData
        || hasMissingServices
        || hasMissingProducts
        || payload.partial;
};

export const isDeferredBootstrapDegraded = (payload: PublicBootstrapPayload): boolean => {
    return payload.source === 'fallback'
        || (payload.partial && !hasHomeDeferredPayloadContent(payload));
};

export const getInitialHomepageHero = (): HomepageHero => {
    if (typeof window === 'undefined') return FALLBACK_HOMEPAGE_HERO;
    try {
        const cached = window.localStorage.getItem(HOMEPAGE_HERO_CACHE_KEY);
        if (!cached) return FALLBACK_HOMEPAGE_HERO;
        const parsed = JSON.parse(cached) as HomepageHero;
        if (!parsed?.image_desktop_url && !parsed?.image_desktop_path) {
            return FALLBACK_HOMEPAGE_HERO;
        }
        return {
            ...FALLBACK_HOMEPAGE_HERO,
            ...parsed,
        };
    } catch {
        return FALLBACK_HOMEPAGE_HERO;
    }
};

export const isExpectedAbortLikeError = (error: unknown): boolean => {
    if (isExpectedPageLifecycleAbort(error)) return true;
    const message = error instanceof Error ? error.message : String(error || '');
    const name = error instanceof Error ? error.name : '';
    return name === 'AbortError' || /lock broken|fetch is aborted|request aborted|aborted/i.test(message);
};
