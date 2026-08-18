import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, CalendarPlusIcon, CheckCircleIcon, EyeIcon, FilterIcon, LaserIcon, ServiceListIcon, ShieldCheckIcon, ShoppingBagIcon, SparklesIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import FallbackBlogImage from './FallbackBlogImage';
import FallbackPublicImage from './FallbackPublicImage';
import { type BlogCategory, type BlogPost, type FAQItem, type HomepageHero, type Product, type ProductBrand, type ProductCategory, type Service, type View } from '../types';
import { scheduleDeferredTask } from '../src/browserIdle';
import { buildBlogImageAlt, buildProductImageAlt, buildServiceImageAlt } from '../src/imageSeo';

interface HomePageContentProps {
    homepageHero: HomepageHero | null;
    brands: ProductBrand[];
    products: Product[];
    productCategories: ProductCategory[];
    blogCategories: BlogCategory[];
    featuredPosts: BlogPost[];
    featuredServices: Service[];
    faqItems: FAQItem[];
    openFaqId: number | null;
    onToggleFaq: (id: number | null) => void;
    onSetView: (view: View) => void;
    onAddToCart: (e: React.MouseEvent, product: Product) => void;
    onRequestBooking: () => void;
    getLocalized: (obj: any, field: string) => string;
    t: (key: string) => string;
}

type HomePageCopy = {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroPrimary: string;
    heroSecondary: string;
    servicesKicker: string;
    servicesTitle: string;
    servicesSubtitle: string;
    trustPillar1Title: string;
    trustPillar1Desc: string;
    trustPillar2Title: string;
    trustPillar2Desc: string;
    trustPillar3Title: string;
    trustPillar3Desc: string;
    trustPillar4Title: string;
    trustPillar4Desc: string;
    productsKicker: string;
    productsTitle: string;
    productsSubtitle: string;
    bestSellerTitle: string;
    brandsKicker: string;
    brandsTitle: string;
    brandsSubtitle: string;
    blogKicker: string;
    blogTitle: string;
    blogSubtitle: string;
    faqKicker: string;
    faqTitle: string;
    faqSubtitle: string;
    brandButton: string;
    productsButton: string;
    servicesButton: string;
    blogButton: string;
    viewProduct: string;
    readMore: string;
    bookNow: string;
};

const CINEMATIC_HERO_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

type HomepageAnalyzerLanguage = 'vi' | 'en';
type HomepageRiskBandKey = 'score-1-2' | 'score-3-4' | 'score-5' | 'score-6' | 'score-7-10' | 'unknown';
type HomepageRiskSummaryStatus = 'loading' | 'ready' | 'empty' | 'error';

type HomepageRiskSegment = {
    key: HomepageRiskBandKey;
    label: string;
    color: string;
    count: number;
    basis: string;
    displayPercent?: string;
};

type HomepageRiskSummary = {
    status: HomepageRiskSummaryStatus;
    total: number;
    segments: HomepageRiskSegment[];
};

type HomepageAnalyzerResponse = {
    summary?: { total?: number };
    ingredients?: Array<{ ewg_score?: string | null }>;
};

const HOMEPAGE_RISK_BANDS: Array<{ key: HomepageRiskBandKey; label: string; color: string }> = [
    { key: 'score-1-2', label: 'EWG 1–2', color: 'rgb(130, 230, 111)' },
    { key: 'score-3-4', label: 'EWG 3–4', color: 'rgb(172, 235, 112)' },
    { key: 'score-5', label: 'EWG 5', color: 'rgb(217, 239, 98)' },
    { key: 'score-6', label: 'EWG 6', color: 'rgb(240, 223, 85)' },
    { key: 'score-7-10', label: 'EWG 7–10', color: 'rgb(244, 141, 98)' },
    { key: 'unknown', label: 'Chưa rõ', color: 'rgb(188, 190, 192)' },
];

const EMPTY_HOMEPAGE_RISK_SUMMARY: HomepageRiskSummary = {
    status: 'empty',
    total: 0,
    segments: [],
};

const LOADING_HOMEPAGE_RISK_SUMMARY: HomepageRiskSummary = {
    status: 'loading',
    total: 0,
    segments: [],
};

const normalizeHomepageAnalyzerLanguage = (language: string): HomepageAnalyzerLanguage => language?.startsWith('en') ? 'en' : 'vi';

const getHomepageEwgMax = (score: string | null | undefined) => {
    const values = String(score || '').match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    return values.length ? Math.max(...values) : null;
};

const getHomepageRiskBand = (score: number | null): HomepageRiskBandKey => {
    if (score === null) return 'unknown';
    if (score <= 2) return 'score-1-2';
    if (score <= 4) return 'score-3-4';
    if (score === 5) return 'score-5';
    if (score === 6) return 'score-6';
    return 'score-7-10';
};

const buildHomepageRiskSummary = (analysis: HomepageAnalyzerResponse | null): HomepageRiskSummary => {
    const ingredients = Array.isArray(analysis?.ingredients) ? analysis.ingredients : [];
    const counts = Object.fromEntries(HOMEPAGE_RISK_BANDS.map((band) => [band.key, 0])) as Record<HomepageRiskBandKey, number>;
    ingredients.forEach((ingredient) => {
        counts[getHomepageRiskBand(getHomepageEwgMax(ingredient.ewg_score))] += 1;
    });

    const total = Math.max(Number(analysis?.summary?.total) || 0, ingredients.length);
    const counted = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total > counted) counts.unknown += total - counted;
    if (!total) return EMPTY_HOMEPAGE_RISK_SUMMARY;

    return {
        status: 'ready',
        total,
        segments: HOMEPAGE_RISK_BANDS
            .filter((band) => counts[band.key] > 0)
            .map((band) => ({
                ...band,
                count: counts[band.key],
                basis: `${(counts[band.key] / total) * 100}%`,
                displayPercent: `${Math.round((counts[band.key] / total) * 100)}%`,
            })),
    };
};

const homepageRiskCache = new Map<string, HomepageRiskSummary>();
const homepageRiskRequests = new Map<string, Promise<HomepageRiskSummary>>();

const getHomepageRiskCacheKey = (productKey: string | number, ingredients: string, language: HomepageAnalyzerLanguage) =>
    `${language}:${String(productKey).trim()}:${ingredients}`;

async function requestHomepageRiskSummary(
    productKey: string | number,
    ingredients: string,
    language: HomepageAnalyzerLanguage,
): Promise<HomepageRiskSummary> {
    const normalizedIngredients = String(ingredients || '').trim();
    if (!normalizedIngredients) return EMPTY_HOMEPAGE_RISK_SUMMARY;

    const cacheKey = getHomepageRiskCacheKey(productKey, normalizedIngredients, language);
    const cached = homepageRiskCache.get(cacheKey);
    if (cached) return cached;
    const pending = homepageRiskRequests.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
        let analysis: HomepageAnalyzerResponse | null = null;
        try {
            const snapshotResponse = await fetch(
                `/api/ingredient-analyzer/products/${encodeURIComponent(String(productKey))}?lang=${encodeURIComponent(language)}`,
                { headers: { Accept: 'application/json' } },
            );
            if (snapshotResponse.ok) {
                analysis = await snapshotResponse.json() as HomepageAnalyzerResponse;
            }
        } catch {
            // Fall back to analyzing the product's current INCI below.
        }

        if (!analysis) {
            const rawResponse = await fetch('/api/ingredient-analyzer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inciText: normalizedIngredients, lang: language }),
            });
            const payload = await rawResponse.json().catch(() => null) as HomepageAnalyzerResponse | { error?: string } | null;
            if (!rawResponse.ok) throw new Error(payload && 'error' in payload ? payload.error || 'Ingredient analysis failed.' : 'Ingredient analysis failed.');
            analysis = payload as HomepageAnalyzerResponse;
        }

        const summary = buildHomepageRiskSummary(analysis);
        homepageRiskCache.set(cacheKey, summary);
        return summary;
    })().finally(() => {
        homepageRiskRequests.delete(cacheKey);
    });

    homepageRiskRequests.set(cacheKey, request);
    return request;
}

function useHomepageProductRiskSummaries(
    products: Product[],
    getLocalized: (obj: any, field: string) => string,
    language: string,
) {
    const analyzerLanguage = normalizeHomepageAnalyzerLanguage(language);
    const productEntries = useMemo(
        () => products.map((product) => {
            const ingredients = String(getLocalized(product, 'ingredients') || product.ingredients || '').trim();
            const productKey = product.slug || product.id;
            return {
                cacheKey: getHomepageRiskCacheKey(productKey, ingredients, analyzerLanguage),
                productKey,
                ingredients,
            };
        }),
        [analyzerLanguage, getLocalized, products],
    );
    const [summaries, setSummaries] = useState<Record<string, HomepageRiskSummary>>({});

    useEffect(() => {
        let cancelled = false;
        const initialSummaries: Record<string, HomepageRiskSummary> = {};
        const pendingEntries = [] as typeof productEntries;

        productEntries.forEach((entry) => {
            if (!entry.ingredients) {
                initialSummaries[entry.cacheKey] = EMPTY_HOMEPAGE_RISK_SUMMARY;
                return;
            }
            const cached = homepageRiskCache.get(entry.cacheKey);
            if (cached) initialSummaries[entry.cacheKey] = cached;
            else {
                initialSummaries[entry.cacheKey] = LOADING_HOMEPAGE_RISK_SUMMARY;
                pendingEntries.push(entry);
            }
        });
        setSummaries(initialSummaries);

        if (pendingEntries.length > 0) {
            Promise.all(pendingEntries.map(async (entry) => {
                try {
                    return [entry.cacheKey, await requestHomepageRiskSummary(entry.productKey, entry.ingredients, analyzerLanguage)] as const;
                } catch {
                    return [entry.cacheKey, { status: 'error', total: 0, segments: [] } as HomepageRiskSummary] as const;
                }
            })).then((resolvedEntries) => {
                if (cancelled) return;
                setSummaries((current) => ({ ...current, ...Object.fromEntries(resolvedEntries) }));
            });
        }

        return () => {
            cancelled = true;
        };
    }, [analyzerLanguage, productEntries]);

    return { summaries, analyzerLanguage };
}

function HomepageProductRiskBar({ summary }: { summary: HomepageRiskSummary }) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ left: 0 });

    const isReady = summary.status === 'ready' && summary.segments.length > 0;
    const isLoading = summary.status === 'loading';

    const handleMouseEnter = (index: number, e: React.MouseEvent<HTMLSpanElement>) => {
        const segEl = e.currentTarget;
        const parent = segEl.parentElement?.parentElement;
        if (parent) {
            const parentRect = parent.getBoundingClientRect();
            const segRect = segEl.getBoundingClientRect();
            const center = segRect.left + segRect.width / 2 - parentRect.left;
            setTooltipPos({ left: center });
        }
        setHoveredIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    return (
        <div
            className="relative mt-2.5 w-full"
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="flex h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-[#e9eef1] dark:bg-stone-700 shadow-inner"
                role="img"
                aria-label={isReady ? `Phân bố EWG theo ${summary.total} thành phần` : isLoading ? 'Đang phân tích INCI' : 'Thanh thành phần'}
            >
                {isReady ? (
                    summary.segments.map((segment, index) => {
                        const isHovered = hoveredIndex === index;
                        const hasHover = hoveredIndex !== null;
                        return (
                            <span
                                key={`${segment.key}-${index}`}
                                style={{
                                    width: segment.basis,
                                    backgroundColor: segment.color,
                                }}
                                onMouseEnter={(e) => handleMouseEnter(index, e)}
                                className={`h-full cursor-pointer transition-all duration-200 first:rounded-l-full last:rounded-r-full transform-gpu ${
                                    hasHover
                                        ? isHovered
                                            ? 'scale-y-125 z-10 brightness-110 shadow-xs ring-1 ring-white/50'
                                            : 'opacity-50'
                                        : 'opacity-100'
                                }`}
                            />
                        );
                    })
                ) : isLoading ? (
                    <span className="h-full w-full animate-pulse rounded-full bg-primary/25" />
                ) : (
                    <span className="h-full w-full rounded-full bg-[#c2c8ce] dark:bg-stone-700" />
                )}
            </div>

            {/* Interactive Floating Tooltip on Hover (Rounded % & Positioned Above Bar) */}
            {isReady && hoveredIndex !== null && summary.segments[hoveredIndex] && (
                <div
                    className="pointer-events-none absolute bottom-full mb-2 z-50 -translate-x-1/2 rounded-lg bg-[#18202f]/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-xl backdrop-blur-md border border-white/15 whitespace-nowrap animate-fade-in transition-all duration-150"
                    style={{ left: `${Math.max(50, Math.min(tooltipPos.left, 180))}px` }}
                >
                    <div className="flex items-center gap-1.5 leading-none">
                        <span
                            className="h-2 w-2 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: summary.segments[hoveredIndex].color }}
                        />
                        <span>{summary.segments[hoveredIndex].label}</span>
                        <span className="text-white/70 font-medium">
                            : {summary.segments[hoveredIndex].count} ({summary.segments[hoveredIndex].displayPercent || `${Math.round((summary.segments[hoveredIndex].count / summary.total) * 100)}%`})
                        </span>
                    </div>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#18202f]/95" />
                </div>
            )}
        </div>
    );
}

const CinematicHeroVideo: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        const handlePlaying = () => setIsPlaying(true);
        video.addEventListener('playing', handlePlaying);

        // Pause video decoding when hero section is not visible to free GPU / CPU cycles during scroll
        let observer: IntersectionObserver | null = null;
        if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
            observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        void video.play().catch(() => undefined);
                    } else {
                        video.pause();
                    }
                },
                { threshold: 0.05 }
            );
            observer.observe(video);
        } else {
            void video.play().catch(() => undefined);
        }

        return () => {
            video.removeEventListener('playing', handlePlaying);
            if (observer) observer.disconnect();
        };
    }, []);

    return (
        <video
            ref={videoRef}
            data-testid="homepage-hero-image"
            className={`pointer-events-none absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
                isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
            src={CINEMATIC_HERO_VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
        />
    );
};

const warmedHomepageMediaSources = new Set<string>();

const normalizeHomepageMediaSource = (src?: string | null) => String(src || '').trim();
const isHomepageMediaWarm = (src?: string | null) => {
    const normalizedSource = normalizeHomepageMediaSource(src);
    return normalizedSource.length > 0 && warmedHomepageMediaSources.has(normalizedSource);
};

const preloadHomepageImage = (src: string) =>
    new Promise<void>((resolve) => {
        const normalizedSource = normalizeHomepageMediaSource(src);
        if (!normalizedSource || typeof window === 'undefined') {
            resolve();
            return;
        }

        if (warmedHomepageMediaSources.has(normalizedSource)) {
            resolve();
            return;
        }

        const image = new Image();
        let settled = false;

        const finish = (shouldMarkWarm = false) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timerHandle);
            if (shouldMarkWarm) {
                warmedHomepageMediaSources.add(normalizedSource);
            }
            resolve();
        };

        const timerHandle = window.setTimeout(() => finish(false), 2600);
        image.onload = () => {
            if (typeof image.decode === 'function') {
                image
                    .decode()
                    .then(() => finish(true))
                    .catch(() => finish(true));
                return;
            }
            finish(true);
        };
        image.onerror = () => finish(false);
        image.decoding = 'async';
        image.src = normalizedSource;

        if (image.complete && image.naturalWidth > 0) {
            finish(true);
        }
    });

const useWarmImageSet = (sources: string[]) => {
    const normalizedSources = useMemo(
        () => Array.from(new Set(sources.map((source) => normalizeHomepageMediaSource(source)).filter(Boolean))),
        [sources]
    );
    const sourceKey = normalizedSources.join('|');
    const [isReady, setIsReady] = useState(
        normalizedSources.length === 0 || normalizedSources.every((source) => isHomepageMediaWarm(source))
    );

    useEffect(() => {
        const pendingSources = normalizedSources.filter((source) => !isHomepageMediaWarm(source));
        if (pendingSources.length === 0) {
            setIsReady(true);
            return;
        }

        let cancelled = false;
        let revealTimer: number | null = null;

        setIsReady(false);

        const startWarmup = async () => {
            revealTimer = window.setTimeout(() => {
                if (!cancelled) {
                    setIsReady(true);
                }
            }, 2400);

            await Promise.all(pendingSources.map(preloadHomepageImage));
            if (!cancelled) {
                if (revealTimer !== null) {
                    window.clearTimeout(revealTimer);
                }
                setIsReady(true);
            }
        };

        const cancelDeferred = scheduleDeferredTask(startWarmup, {
            delayMs: 120,
            timeout: 800,
        });

        return () => {
            cancelled = true;
            cancelDeferred();
            if (revealTimer !== null) {
                window.clearTimeout(revealTimer);
            }
        };
    }, [sourceKey, normalizedSources]);

    return isReady;
};

interface HomepageMediaImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'className'> {
    containerClassName?: string;
    imageClassName?: string;
    placeholderClassName?: string;
    groupReady: boolean;
    fallbackSrc?: string;
}

const HomepageMediaImage: React.FC<HomepageMediaImageProps> = ({
    containerClassName = '',
    imageClassName = '',
    placeholderClassName = '',
    groupReady,
    fallbackSrc = '/seo/og-default.jpg',
    onLoad,
    onError,
    src,
    alt,
    ...props
}) => {
    const normalizedFallbackSrc = normalizeHomepageMediaSource(fallbackSrc) || '/seo/og-default.jpg';
    const initialSrc = normalizeHomepageMediaSource(src) || normalizedFallbackSrc;
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [currentSrc, setCurrentSrc] = useState(initialSrc);
    const [isLoaded, setIsLoaded] = useState(() => isHomepageMediaWarm(initialSrc));

    useEffect(() => {
        const nextSrc = normalizeHomepageMediaSource(src) || normalizedFallbackSrc;
        setCurrentSrc(nextSrc);
        setIsLoaded(isHomepageMediaWarm(nextSrc));
    }, [src, normalizedFallbackSrc]);

    useEffect(() => {
        const node = imageRef.current;
        if (node?.complete && node.naturalWidth > 0) {
            setIsLoaded(true);
        }
    }, [currentSrc]);

    const showImage = groupReady && isLoaded;

    return (
        <div className={`relative overflow-hidden ${containerClassName}`}>
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(53,183,165,0.12),rgba(255,127,93,0.09),rgba(255,255,255,0.94))] transition-opacity duration-300 ${showImage ? 'opacity-0' : 'opacity-100'} ${placeholderClassName}`.trim()}
            />
            <FallbackPublicImage
                {...props}
                ref={imageRef}
                src={currentSrc}
                fallbackSrc={normalizedFallbackSrc}
                alt={alt}
                onLoad={(event) => {
                    const loadedSrc = normalizeHomepageMediaSource(event.currentTarget.currentSrc || currentSrc);
                    if (loadedSrc) {
                        warmedHomepageMediaSources.add(loadedSrc);
                    }
                    setIsLoaded(true);
                    onLoad?.(event);
                }}
                onError={(event) => {
                    if (currentSrc !== normalizedFallbackSrc) {
                        setCurrentSrc(normalizedFallbackSrc);
                        setIsLoaded(false);
                    } else {
                        setIsLoaded(true);
                    }
                    onError?.(event);
                }}
                className={`${imageClassName} transition-opacity duration-500 ${showImage ? 'opacity-100' : 'opacity-0'}`.trim()}
            />
        </div>
    );
};

const HomePageContent: React.FC<HomePageContentProps> = ({
    homepageHero,
    brands,
    products,
    productCategories,
    blogCategories,
    featuredPosts,
    featuredServices,
    faqItems,
    openFaqId,
    onToggleFaq,
    onSetView,
    onAddToCart,
    onRequestBooking,
    getLocalized,
}) => {
    const { i18n, t } = useTranslation();
    const isEn = Boolean(i18n.language?.startsWith('en'));

    const featuredProducts = useMemo(() => {
        const picked = products.filter((product) => product.is_featured);
        return (picked.length > 0 ? picked : products).slice(0, 4);
    }, [products]);

    const bestSellers = useMemo(
        () => [...products].sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 4),
        [products]
    );

    const featuredBrandRows = useMemo(() => {
        const withProducts = brands
            .map((brand) => ({
                ...brand,
                productCount: products.filter((product) => (product.brand || '').trim().toLowerCase() === brand.name.trim().toLowerCase()).length,
            }))
            .filter((brand) => brand.productCount > 0 || brand.logo_url);
        return withProducts.slice(0, 18);
    }, [brands, products]);

    const featuredPostsList = useMemo(() => featuredPosts.slice(0, 6), [featuredPosts]);
    const leadPost = featuredPostsList[0] || null;
    const sidePosts = featuredPostsList.slice(1, 6);
    const hasFeaturedServices = featuredServices.length > 0;
    const hasProductShowcase = bestSellers.length > 0 || featuredProducts.length > 0;
    const categoryNameMap = useMemo(
        () => new Map(blogCategories.map((category) => [category.slug, getLocalized(category, 'name')])),
        [blogCategories, getLocalized]
    );
    const { summaries: homepageRiskSummaries, analyzerLanguage: homepageAnalyzerLanguage } =
        useHomepageProductRiskSummaries(featuredProducts, getLocalized, i18n.language);

    const heroDesktopImage =
        homepageHero?.image_desktop_url ||
        homepageHero?.image_tablet_url ||
        homepageHero?.image_mobile_url ||
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80';
    const heroTabletImage = homepageHero?.image_tablet_url || heroDesktopImage;
    const heroMobileImage = homepageHero?.image_mobile_url || heroDesktopImage;

    const homepageProductImageSources = useMemo(
        () =>
            Array.from(
                new Set(
                    [...bestSellers, ...featuredProducts]
                        .map((product) => product.images?.[0]?.image_url || '')
                        .filter(Boolean)
                )
            ),
        [bestSellers, featuredProducts]
    );

    const homepageBrandLogoSources = useMemo(
        () =>
            Array.from(
                new Set(
                    featuredBrandRows
                        .map((brand) => brand.logo_url || '')
                        .filter(Boolean)
                )
            ),
        [featuredBrandRows]
    );

    const homepageServiceImageSources = useMemo(
        () =>
            Array.from(
                new Set(
                    featuredServices
                        .map((service) => service.image_url || '')
                        .filter(Boolean)
                )
            ),
        [featuredServices]
    );

    const homepageCommerceMediaSources = useMemo(
        () => Array.from(new Set([...homepageProductImageSources, ...homepageBrandLogoSources])),
        [homepageBrandLogoSources, homepageProductImageSources]
    );

    const areHomepageCommerceMediaReady = useWarmImageSet(homepageCommerceMediaSources);
    const areHomepageServiceMediaReady = useWarmImageSet(homepageServiceImageSources);

    const copy = useMemo<HomePageCopy>(() => {
        const lang = i18n.language;
        if (lang.startsWith('en')) {
            return {
                heroEyebrow: 'Dermatology clinic + modern skincare store',
                heroTitle: 'Treatment, products, and skincare guidance in one clear flow.',
                heroSubtitle: 'A lighter storefront built to help people choose faster and feel surer on every screen.',
                heroPrimary: 'Book consultation',
                heroSecondary: 'Open pharmacy',
                servicesKicker: 'Treatment first',
                servicesTitle: 'Start with the treatment path that matches what the skin actually needs',
                servicesSubtitle: 'Each service card focuses on concern, next step, and booking readiness.',
                trustPillar1Title: '100% Clinical Standards',
                trustPillar1Desc: 'Personalized treatment protocols formulated directly by certified dermatologists.',
                trustPillar2Title: 'Transparent Formulations',
                trustPillar2Desc: '100% authentic cosmeceuticals with verified INCI and EWG safety ratings.',
                trustPillar3Title: 'FDA & CE Approved Tech',
                trustPillar3Desc: 'Advanced medical skincare equipment adhering to strict clinical safety protocols.',
                trustPillar4Title: '1-on-1 Continuous Care',
                trustPillar4Desc: 'Dedicated medical follow-ups throughout your recovery and maintenance journey.',
                productsKicker: 'Pharmacy spotlight',
                productsTitle: 'Open products that feel easy to compare and easy to trust',
                productsSubtitle: 'Featured skincare, trial sizes, and homecare essentials are surfaced first.',
                bestSellerTitle: 'Popular picks people open most',
                brandsKicker: 'Brand wall',
                brandsTitle: 'A cleaner brand wall built for quick recognition',
                brandsSubtitle: 'Jump straight into a brand when you already know what you trust.',
                blogKicker: 'Knowledge',
                blogTitle: 'Read before you buy, treat, or change a routine',
                blogSubtitle: 'A lighter editorial layout helps people compare topics in seconds.',
                faqKicker: 'Before you start',
                faqTitle: 'Short answers before time, skin, or budget are committed',
                faqSubtitle: 'The FAQ stays practical and sits at the end as decision support.',
                brandButton: 'See all brands',
                productsButton: 'Browse pharmacy',
                servicesButton: 'Explore services',
                blogButton: 'Open all articles',
                viewProduct: 'View product',
                readMore: 'Read more',
                bookNow: 'Book now',
            };
        }
        if (lang.startsWith('ru')) {
            return {
                heroEyebrow: 'Дерматологическая клиника и современный skincare store',
                heroTitle: 'Treatment, продукты и знания о коже собраны в один понятный путь.',
                heroSubtitle: 'Интерфейс стал легче, чтобы быстрее выбирать и легче ориентироваться на любом экране.',
                heroPrimary: 'Записаться на консультацию',
                heroSecondary: 'Открыть аптеку',
                servicesKicker: 'Сначала лечение',
                servicesTitle: 'Начните с treatment-маршрута, который подходит именно вашей коже',
                servicesSubtitle: 'Каждая карточка услуги сразу показывает проблему, вектор и следующий шаг.',
                trustPillar1Title: '100% Медицинский стандарт',
                trustPillar1Desc: 'Индивидуальные протоколы лечения от опытных врачей-дерматологов.',
                trustPillar2Title: 'Прозрачный состав',
                trustPillar2Desc: 'Оригинальная космецевтика с проверкой INCI и оценкой безопасности EWG.',
                trustPillar3Title: 'Оборудование FDA / CE',
                trustPillar3Desc: 'Современные медицинские технологии и строгие стандарты стерильности.',
                trustPillar4Title: 'Сопровождение 1 на 1',
                trustPillar4Desc: 'Постоянный контроль специалиста на протяжении всего курса восстановления.',
                productsKicker: 'Аптечный блок',
                productsTitle: 'Товары, которые легче сравнивать и выбирать',
                productsSubtitle: 'Верхняя полка теперь отдана skincare, пробникам и домашней поддержке.',
                bestSellerTitle: 'Популярные позиции',
                brandsKicker: 'Бренды',
                brandsTitle: 'Бренд-стена для быстрого узнавания',
                brandsSubtitle: 'Если вы уже знаете бренд, переходите к нему сразу.',
                blogKicker: 'Знания',
                blogTitle: 'Сначала прочитать, потом менять routine или treatment',
                blogSubtitle: 'Editorial-блок стал легче и лучше сканируется на ходу.',
                faqKicker: 'Перед стартом',
                faqTitle: 'Короткие ответы до того, как тратить время, кожу и бюджет',
                faqSubtitle: 'FAQ остаётся чистым и практичным финальным блоком.',
                brandButton: 'Все бренды',
                productsButton: 'Открыть аптеку',
                servicesButton: 'Смотреть услуги',
                blogButton: 'Все статьи',
                viewProduct: 'Открыть товар',
                readMore: 'Читать',
                bookNow: 'Записаться',
            };
        }
        if (lang.startsWith('cn') || lang.startsWith('zh')) {
            return {
                heroEyebrow: '皮肤诊疗与现代护肤商店',
                heroTitle: '把疗程、药房与护肤知识收进一个更清晰的路径里。',
                heroSubtitle: '整体界面更轻，让用户在任何屏幕上都能更快理解并做决定。',
                heroPrimary: '预约咨询',
                heroSecondary: '进入药房',
                servicesKicker: '先看疗程',
                servicesTitle: '先从真正匹配皮肤问题的疗程开始',
                servicesSubtitle: '每张卡片都优先说明问题、方向和下一步。',
                trustPillar1Title: '100% 医疗标准',
                trustPillar1Desc: '由专业皮肤科医生直接定制的个性化治疗方案。',
                trustPillar2Title: '成分透明安全',
                trustPillar2Desc: '100% 正品药妆，提供 INCI 成分分析与 EWG 安全评级。',
                trustPillar3Title: 'FDA / CE 认证科技',
                trustPillar3Desc: '采用先进皮肤医疗设备，严格遵循无菌安全规范。',
                trustPillar4Title: '1 对 1 全程跟踪',
                trustPillar4Desc: '专业医护团队在整个皮肤恢复与日常维稳中密切跟踪。',
                productsKicker: '药房精选',
                productsTitle: '产品更好扫读，也更容易比较',
                productsSubtitle: '上方先展示更值得先打开的护肤品、试用装和居家支持产品。',
                bestSellerTitle: '当前更受关注的产品',
                brandsKicker: '品牌墙',
                brandsTitle: '更容易识别的品牌展示',
                brandsSubtitle: '已经知道品牌时，可以直接进入对应商品。',
                blogKicker: '知识内容',
                blogTitle: '在购买、治疗或调整 routine 前先读懂',
                blogSubtitle: '知识模块现在更轻、更快，也更容易浏览。',
                faqKicker: '开始之前',
                faqTitle: '先把关键问题说清楚，再决定下一步',
                faqSubtitle: 'FAQ 作为最后一段，只保留真正影响决策的信息。',
                brandButton: '查看全部品牌',
                productsButton: '打开药房',
                servicesButton: '查看服务',
                blogButton: '全部文章',
                viewProduct: '查看产品',
                readMore: '阅读全文',
                bookNow: '立即预约',
            };
        }
        return {
            heroEyebrow: 'Clinic da liễu và storefront chăm sóc da hiện đại',
            heroTitle: 'Dịch vụ, sản phẩm và kiến thức đi chung trong một hành trình gọn hơn.',
            heroSubtitle: 'Mọi thứ được rút về phần cốt lõi để người dùng hiểu nhanh và chọn nhanh hơn.',
            heroPrimary: 'Đặt lịch tư vấn',
            heroSecondary: 'Xem sản phẩm',
            servicesKicker: '',
            servicesTitle: 'Dịch vụ chuyên nghiệp',
            servicesSubtitle: 'Mỗi dịch vụ được cá nhân hoá từng cá thể.',
            trustPillar1Title: '100% Chuẩn Y Khoa',
            trustPillar1Desc: 'Phác đồ điều trị cá nhân hóa trực tiếp bởi Bác sĩ Chuyên khoa Da liễu.',
            trustPillar2Title: 'Dược Mỹ Phẩm Minh Bạch',
            trustPillar2Desc: 'Bảng thành phần INCI rõ ràng, kiểm tra mức độ an toàn chuẩn EWG.',
            trustPillar3Title: 'Công Nghệ FDA / CE',
            trustPillar3Desc: 'Trang thiết bị trị liệu hiện đại, đảm bảo an toàn và vô khuẩn tuyệt đối.',
            trustPillar4Title: 'Đồng Hành 1 - 1',
            trustPillar4Desc: 'Bác sĩ & đội ngũ chuyên môn theo dõi sát sao suốt liệu trình hồi phục da.',
            productsKicker: 'Sản phẩm nổi bật',
            productsTitle: 'Những sản phẩm được lựa chọn kĩ lưỡng bỡi các chuyên gia da liễu',
            productsSubtitle: '',
            bestSellerTitle: 'Nhóm đang được mở nhiều và mua nhiều',
            brandsKicker: 'Thương Hiệu',
            brandsTitle: 'Phân phối chính hãng các thương hiệu',
            brandsSubtitle: '',
            blogKicker: 'Kiến thức da liễu',
            blogTitle: 'Tạp chí sức khoẻ chọn lọc',
            blogSubtitle: '',
            faqKicker: 'Trước khi bắt đầu',
            faqTitle: 'Khi bạn hỏi và bác sĩ trả lời',
            faqSubtitle: '',
            brandButton: 'Xem tất cả thương hiệu',
            productsButton: 'Xem sản phẩm',
            servicesButton: 'Xem toàn bộ dịch vụ',
            blogButton: 'Mở toàn bộ kiến thức',
            viewProduct: 'Xem sản phẩm',
            readMore: 'Đọc thêm',
            bookNow: 'Đặt lịch ngay',
        };
    }, [i18n.language]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    const openProduct = (product: Product) => {
        const categorySlug =
            product.category?.slug ||
            product.category_slug ||
            productCategories.find((category) => category.id === product.category_id)?.slug ||
            'khac';
        onSetView({ page: 'productDetail', id: product.id, categorySlug });
    };

    const openService = (service: Service) => onSetView({ page: 'serviceDetail', id: service.id });
    const openPost = (post: BlogPost) => onSetView({ page: 'blogDetail', slug: post.slug, categorySlug: post.category_slug });

const HOMEPAGE_ANALYZER_SAMPLES = [
    {
        id: 'b5',
        titleVi: '🌿 Serum B5 Rau Má Phục Hồi',
        titleEn: '🌿 B5 & Centella Soothing Serum',
        inci: 'Water, Centella Asiatica Extract, Panthenol, Glycerin, Butylene Glycol, Niacinamide, Sodium Hyaluronate, Madecassoside, Allantoin, Carbomer, 1,2-Hexanediol',
    },
    {
        id: 'bha',
        titleVi: '🍃 Serum BHA 2% Giảm Mụn & Dầu',
        titleEn: '🍃 2% BHA Salicylic Acne Serum',
        inci: 'Aqua, Propanediol, Salicylic Acid, Zinc PCA, Niacinamide, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Sodium Hydroxide, Hyaluronic Acid, Phenoxyethanol',
    },
    {
        id: 'retinol',
        titleVi: '✨ Serum Retinol 0.5% & Peptide',
        titleEn: '✨ 0.5% Retinol & Peptide Youth Serum',
        inci: 'Water, Squalane, Caprylic/Capric Triglyceride, Retinol, Ceramide NP, Palmitoyl Tripeptide-1, Tocopherol, Polysorbate 20, Ethylhexylglycerin',
    },
];

const HomepageIngredientAnalyzerSection: React.FC<{
    onSetView: (view: View) => void;
    isEn: boolean;
}> = ({ onSetView, isEn }) => {
    const [inciInput, setInciInput] = useState('');
    const [selectedSample, setSelectedSample] = useState<string | null>(null);

    const handleSelectSample = (sample: typeof HOMEPAGE_ANALYZER_SAMPLES[number]) => {
        setSelectedSample(sample.id);
        setInciInput(sample.inci);
    };

    const handleAnalyze = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const text = (inciInput || HOMEPAGE_ANALYZER_SAMPLES[0].inci).trim();
        try {
            sessionStorage.setItem('ingredient_analyzer_query', text);
        } catch {
            // ignore
        }
        onSetView({ page: 'ingredientAnalyzer' });
    };

    return (
        <section id="phan-tich-thanh-phan" data-scroll-reveal="off" className="relative px-4 py-10 md:px-6 md:py-16">
            <div className="container mx-auto">
                <div className="mb-8 flex flex-col gap-4 text-center lg:text-left lg:mb-10">
                    <div className="max-w-4xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary dark:bg-primary/20">
                            <SparklesIcon className="h-3.5 w-3.5" />
                            <span>{isEn ? 'INCI Lookup' : 'Tra cứu INCI'}</span>
                        </div>
                        <h2 className="section-title mt-3 font-hero-title text-3xl font-black tracking-[-0.035em] text-foreground sm:text-4xl lg:text-5xl">
                            {isEn ? 'Cosmetic Ingredient Safety Analysis' : 'Phân tích bảng thành phần mỹ phẩm'}
                        </h2>
                        <p className="section-subtitle mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {isEn
                                ? 'Instantly review safety scores under EWG guidelines, flag drying alcohols, fragrances, and test skin-type compatibility before use.'
                                : 'Kiểm tra nhanh mức độ an toàn theo tiêu chuẩn quốc tế EWG, phát hiện cồn khô, hương liệu và đánh giá độ phù hợp với 5 loại da trước khi sử dụng.'}
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-[32px] border-0 bg-white/70 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:bg-[rgba(15,23,42,0.65)] dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)] md:p-8 lg:p-10">
                    <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div>
                            <form onSubmit={handleAnalyze} className="space-y-4">
                                <div className="relative">
                                    <textarea
                                        value={inciInput}
                                        onChange={(e) => {
                                            setInciInput(e.target.value);
                                            setSelectedSample(null);
                                        }}
                                        rows={4}
                                        placeholder={isEn
                                            ? "Paste or type cosmetics INCI here... E.g. Water, Niacinamide, Glycerin, Salicylic Acid, Centella Asiatica Extract, Retinol..."
                                            : "Dán hoặc gõ bảng thành phần mỹ phẩm (INCI) tại đây... Ví dụ: Water, Niacinamide, Glycerin, Salicylic Acid, Centella Asiatica Extract, Retinol, Sodium Hyaluronate..."}
                                        className="w-full resize-none rounded-[22px] border-0 bg-black/[0.03] p-4 text-sm font-medium leading-relaxed text-foreground placeholder:text-muted-foreground/70 shadow-inner backdrop-blur-md focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary/25 dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground">
                                        {isEn ? 'Try sample:' : 'Thử mẫu nhanh:'}
                                    </span>
                                    {HOMEPAGE_ANALYZER_SAMPLES.map((sample) => (
                                        <button
                                            key={sample.id}
                                            type="button"
                                            onClick={() => handleSelectSample(sample)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 btn-press ${
                                                selectedSample === sample.id
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'border-0 bg-black/[0.04] text-foreground hover:bg-black/[0.07] hover:text-primary dark:bg-white/[0.07] dark:hover:bg-white/[0.12]'
                                            }`}
                                        >
                                            {isEn ? sample.titleEn : sample.titleVi}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                                    <button
                                        type="submit"
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-[0_12px_28px_-8px_rgba(27,122,109,0.45)] transition hover:brightness-105 active:scale-95 btn-press"
                                    >
                                        <SparklesIcon className="h-4 w-4" />
                                        <span>{isEn ? 'Analyze Now' : 'Phân tích ngay'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-2">
                            <div className="rounded-[18px] sm:rounded-[20px] border-0 bg-white/60 p-2.5 sm:p-4 shadow-xs backdrop-blur-md dark:bg-white/[0.05] dark:shadow-none">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                        <ShieldCheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{isEn ? 'EWG Score 1–10' : 'Thang điểm EWG 1–10'}</h4>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{isEn ? 'Safety risk levels' : 'Phân loại an toàn & lành tính'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[18px] sm:rounded-[20px] border-0 bg-white/60 p-2.5 sm:p-4 shadow-xs backdrop-blur-md dark:bg-white/[0.05] dark:shadow-none">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                                        <SparklesIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{isEn ? '5 Skin-Type Fit' : 'Độ phù hợp 5 loại da'}</h4>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{isEn ? 'Oily, Dry, Sensitive' : 'Da dầu mụn, khô & nhạy cảm'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[18px] sm:rounded-[20px] border-0 bg-white/60 p-2.5 sm:p-4 shadow-xs backdrop-blur-md dark:bg-white/[0.05] dark:shadow-none">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                                        <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{isEn ? 'Allergen Flags' : 'Cảnh báo kích ứng'}</h4>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{isEn ? 'Alcohol, Fragrance, Fungal' : 'Phát hiện cồn khô, hương liệu'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[18px] sm:rounded-[20px] border-0 bg-white/60 p-2.5 sm:p-4 shadow-xs backdrop-blur-md dark:bg-white/[0.05] dark:shadow-none">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                                        <LaserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{isEn ? 'CIR Standards' : 'Chuẩn Y khoa CIR'}</h4>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{isEn ? '50,000+ INCI database' : 'Dữ liệu 50.000+ thành phần'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

    return (
        <div className="homepage-cinematic bg-background text-foreground">
            <section
                id="home"
                data-testid="homepage-hero-picture"
                className="relative min-h-[100svh] w-full overflow-hidden bg-background text-foreground"
            >
                <CinematicHeroVideo />
                <div aria-hidden="true" className="homepage-hero-gradient pointer-events-none absolute inset-0 z-[1]" />
                <div aria-hidden="true" className="homepage-hero-focus pointer-events-none absolute inset-0 z-[1]" />

                <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-5 pb-14 pt-28 text-center sm:px-6 sm:pb-20 sm:pt-32">
                    <h1
                        data-testid="homepage-hero-title"
                        className="homepage-hero-copy max-w-6xl animate-fade-rise text-balance font-['Playfair_Display',_serif] text-[clamp(2rem,7vw,6.75rem)] font-[700] leading-[0.95] tracking-[-0.02em] normal-case text-foreground"
                    >
                        <span className="block mb-3 sm:mb-5">Thế Giới <em className="font-black not-italic text-red-500">Trị</em> Mụn</span>
                        <span className="block">Da Liễu <em className="font-black not-italic text-primary">Phú Quốc</em></span>
                    </h1>
                    <p className="homepage-hero-copy mt-7 max-w-3xl animate-fade-rise-delay font-sans text-[15px] font-medium leading-relaxed text-foreground sm:mt-8 sm:text-lg">
                        <span className="block">“{t('hero.home_quote')}”</span>
                        <span className="mt-1.5 block text-sm font-semibold text-muted-foreground sm:text-base">{t('hero.home_quote_author')}</span>
                    </p>
                    <button
                        type="button"
                        onClick={onRequestBooking}
                        className="mt-10 inline-flex min-h-14 items-center gap-3 rounded-full border border-white/40 bg-white/20 backdrop-blur-2xl px-10 py-4 font-sans text-[15px] font-bold text-foreground shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/30 hover:border-white/60 hover:shadow-[0_18px_48px_rgba(0,0,0,0.2)] focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-4 focus:ring-offset-background animate-fade-rise-delay-2 sm:mt-12 sm:px-12 sm:text-base dark:bg-white/10 dark:border-white/15 dark:hover:bg-white/20"
                    >
                        Begin Journey
                    </button>
                </div>
            </section>

            {hasProductShowcase && (
                <section className="overflow-hidden px-4 py-10 md:px-6 md:py-14">
                        <div className="container mx-auto">
                            <AnimatedSection className="grid gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-start min-w-0">
                                    <div className="min-w-0 text-center lg:text-left">
                                        <p className="section-kicker">{copy.productsKicker}</p>
                                        <h2 className="section-title mt-4">{copy.productsTitle}</h2>
                                        {copy.productsSubtitle ? <p className="section-subtitle mt-3">{copy.productsSubtitle}</p> : null}

                                        {productCategories.length > 0 ? (
                                            <div className="no-scrollbar mt-6 -mx-4 flex items-center gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 md:flex-wrap">
                                                {productCategories.slice(0, 10).map((category) => (
                                                    <button
                                                        key={category.id}
                                                        type="button"
                                                        onClick={() => onSetView({ page: 'productsCategory', categorySlug: category.slug })}
                                                        className="btn-press inline-flex shrink-0 whitespace-nowrap items-center rounded-full border border-white/60 bg-white/70 px-4 py-2 font-hero-body text-xs sm:text-sm font-semibold text-foreground shadow-xs backdrop-blur-xl transition hover:border-primary/40 hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                                    >
                                                        {getLocalized(category, 'name')}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}

                                        <div className="mt-10 rounded-[30px] border border-white/10 bg-slate-900/80 backdrop-blur-2xl p-5 text-white shadow-[0_30px_70px_-35px_rgba(0,0,0,0.6)] md:p-6 dark:bg-[rgba(15,23,42,0.85)]">
                                            <p className="font-hero-body text-[11px] font-black uppercase tracking-[0.26em] text-white/70">{copy.bestSellerTitle}</p>
                                            <div className="mt-4 grid gap-3">
                                                {bestSellers.map((product) => (
                                                    <button
                                                        key={`best-${product.id}`}
                                                        type="button"
                                                        onClick={() => openProduct(product)}
                                                        className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-md p-3 text-left transition hover:bg-white/10"
                                                    >
                                                        <HomepageMediaImage
                                                            groupReady={areHomepageCommerceMediaReady}
                                                            loading="eager"
                                                            decoding="async"
                                                            src={product.images?.[0]?.image_url || 'https://placehold.co/160x160'}
                                                            fallbackSrc="https://placehold.co/160x160"
                                                            alt={buildProductImageAlt({ productName: getLocalized(product, 'name'), brandName: product.brand, context: 'listing' })}
                                                            containerClassName="h-14 w-14 shrink-0 rounded-[14px] bg-white/10 overflow-hidden"
                                                            imageClassName="h-14 w-14 rounded-[14px] object-cover"
                                                            placeholderClassName="rounded-[14px]"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="line-clamp-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">{product.brand || 'Thế Giới Trị Mụn'}</p>
                                                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{getLocalized(product, 'name')}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {featuredProducts.map((product, index) => {
                                            const productIngredients = String(getLocalized(product, 'ingredients') || product.ingredients || '').trim();
                                            const productKey = product.slug || product.id;
                                            const productRiskCacheKey = getHomepageRiskCacheKey(productKey, productIngredients, homepageAnalyzerLanguage);
                                            const productRiskSummary = homepageRiskSummaries[productRiskCacheKey] || LOADING_HOMEPAGE_RISK_SUMMARY;

                                            return (
                                            <AnimatedSection key={product.id} stagger={index * 45}>
                                                <article className="group homepage-editorial-card flex h-full flex-col overflow-hidden text-card-foreground">
                                                    <button
                                                        type="button"
                                                        onClick={() => openProduct(product)}
                                                        className="relative block aspect-[0.94/1] overflow-hidden bg-muted/40"
                                                    >
                                                        <HomepageMediaImage
                                                            groupReady={areHomepageCommerceMediaReady}
                                                            loading="eager"
                                                            decoding="async"
                                                            src={product.images?.[0]?.image_url || 'https://placehold.co/700x800'}
                                                            fallbackSrc="https://placehold.co/700x800"
                                                            alt={buildProductImageAlt({ productName: getLocalized(product, 'name'), brandName: product.brand, context: 'listing' })}
                                                            containerClassName="h-full w-full"
                                                            imageClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                                        />
                                                        {product.volume ? (
                                                            <span className="absolute right-3 top-3 rounded-full border border-white/60 bg-white/80 px-3 py-1 font-hero-body text-xs font-black text-foreground shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-black/60">
                                                                {product.volume}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                    <div className="flex flex-1 flex-col p-5">
                                                        <p className="font-hero-body text-[11px] font-black uppercase tracking-[0.2em] text-primary">{product.brand || 'Thế Giới Trị Mụn'}</p>
                                                        <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-foreground">
                                                            {getLocalized(product, 'name')}
                                                        </h3>
                                                        <HomepageProductRiskBar summary={productRiskSummary} />
                                                        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                                                            <div>
                                                                <p className="font-hero-body text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Giá</p>
                                                                <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-foreground">{formatCurrency(product.price)}</p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        openProduct(product);
                                                                    }}
                                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/80 text-foreground transition hover:border-primary/40 hover:text-primary hover:bg-white dark:border-white/10 dark:bg-white/10 btn-press"
                                                                    aria-label={`${copy.viewProduct}: ${getLocalized(product, 'name')}`}
                                                                    title={copy.viewProduct}
                                                                >
                                                                    <EyeIcon className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => onAddToCart(event, product)}
                                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_rgba(27,122,109,0.45)] transition hover:brightness-110 btn-press"
                                                                    aria-label={`Add ${getLocalized(product, 'name')}`}
                                                                >
                                                                    <ShoppingBagIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            </AnimatedSection>
                                            );
                                        })}
                                    </div>
                                </AnimatedSection>
                        </div>
                    </section>
            )}

            {/* Cosmetic & Ingredient Analyzer Section */}
            <HomepageIngredientAnalyzerSection onSetView={onSetView} isEn={Boolean(i18n.language?.startsWith('en'))} />

            {hasFeaturedServices && (
                <section className="px-4 py-10 md:px-6 md:py-14">
                        <div className="container mx-auto">
                            <AnimatedSection className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-5xl text-center lg:text-left">
                                    {copy.servicesKicker ? (
                                        <>
                                            <p className="section-kicker">{copy.servicesKicker}</p>
                                            <h2 className="section-title mt-4">{copy.servicesTitle}</h2>
                                            {copy.servicesSubtitle ? <p className="section-subtitle mt-3">{copy.servicesSubtitle}</p> : null}
                                        </>
                                    ) : (
                                        <>
                                            <p className="section-kicker">{copy.servicesTitle}</p>
                                            {copy.servicesSubtitle ? <h2 className="section-title mt-4">{copy.servicesSubtitle}</h2> : null}
                                        </>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSetView({ page: 'services' })}
                                    className="homepage-outline-button btn-press"
                                >
                                    {copy.servicesButton}
                                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                                </button>
                            </AnimatedSection>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {featuredServices.slice(0, 3).map((service, index) => (
                                    <AnimatedSection key={service.id} stagger={index * 60}>
                                        <button
                                            type="button"
                                            onClick={() => openService(service)}
                                            className="group homepage-editorial-card flex h-full w-full flex-col overflow-hidden text-left"
                                        >
                                            <div className="relative aspect-[16/10] overflow-hidden">
                                                <HomepageMediaImage
                                                    groupReady={areHomepageServiceMediaReady}
                                                    loading="eager"
                                                    decoding="async"
                                                    src={service.image_url || 'https://placehold.co/900x1000'}
                                                    fallbackSrc="https://placehold.co/900x1000"
                                                    alt={buildServiceImageAlt({ serviceName: getLocalized(service, 'name'), context: 'listing' })}
                                                    containerClassName="h-full w-full"
                                                    imageClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/42 to-transparent" />
                                                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-black/60 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary shadow-xs backdrop-blur-xl">
                                                    <ServiceListIcon className="h-4 w-4" />
                                                    {index === 0 ? 'Hero service' : 'Treatment'}
                                                </span>
                                            </div>
                                            <div className="flex flex-1 flex-col p-5">
                                                <h3 className="font-hero-body text-xl font-black leading-tight tracking-[-0.035em] text-foreground transition group-hover:text-primary md:text-2xl">
                                                    {getLocalized(service, 'name')}
                                                </h3>
                                                <p className="mt-3 line-clamp-3 flex-1 font-hero-body text-sm leading-6 text-muted-foreground">
                                                    {getLocalized(service, 'description')}
                                                </p>
                                                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                                                    <span className="font-hero-body text-sm font-semibold text-primary">
                                                        {service.price ? formatCurrency(service.price) : copy.bookNow}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    </AnimatedSection>
                                ))}
                            </div>
                        </div>
                    </section>
            )}

            {/* Clinical Trust & Standard Highlights */}
            <section className="px-4 py-4 md:px-6 md:py-6">
                <div className="container mx-auto">
                    <AnimatedSection>
                        <div className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] md:p-8 lg:p-10">
                            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />

                            <div className="relative z-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
                                <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                                        <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-hero-body text-sm font-black tracking-[-0.02em] text-foreground sm:text-base">
                                            {copy.trustPillar1Title}
                                        </h3>
                                        <p className="mt-1 font-hero-body text-[11px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-5 lg:text-[13px]">
                                            {copy.trustPillar1Desc}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                                        <SparklesIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-hero-body text-sm font-black tracking-[-0.02em] text-foreground sm:text-base">
                                            {copy.trustPillar2Title}
                                        </h3>
                                        <p className="mt-1 font-hero-body text-[11px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-5 lg:text-[13px]">
                                            {copy.trustPillar2Desc}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                                        <LaserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-hero-body text-sm font-black tracking-[-0.02em] text-foreground sm:text-base">
                                            {copy.trustPillar3Title}
                                        </h3>
                                        <p className="mt-1 font-hero-body text-[11px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-5 lg:text-[13px]">
                                            {copy.trustPillar3Desc}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20 sm:h-12 sm:w-12 sm:rounded-2xl">
                                        <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-hero-body text-sm font-black tracking-[-0.02em] text-foreground sm:text-base">
                                            {copy.trustPillar4Title}
                                        </h3>
                                        <p className="mt-1 font-hero-body text-[11px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-5 lg:text-[13px]">
                                            {copy.trustPillar4Desc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </section>

            {featuredBrandRows.length > 0 && (
                <section className="px-4 py-10 md:px-6 md:py-14">
                        <div className="container mx-auto">
                            <AnimatedSection className="homepage-section-shell p-6 md:p-10 lg:p-14">
                                <div className="mx-auto max-w-3xl text-center">
                                    <p className="section-kicker">{copy.brandsKicker}</p>
                                    <h2 className="section-title mt-4">{copy.brandsTitle}</h2>
                                    {copy.brandsSubtitle ? (
                                        <p className="section-subtitle mt-3">{copy.brandsSubtitle}</p>
                                    ) : null}
                                </div>
                                <div className="mt-10 flex flex-wrap justify-center gap-2 md:gap-3">
                                    {featuredBrandRows.map((brand) => (
                                        <button
                                            key={brand.id}
                                            type="button"
                                            onClick={() => onSetView({ page: 'brandLanding', brandSlug: brand.slug })}
                                            className="group relative aspect-[1.45/1] w-[calc(25%-6px)] md:w-[calc(25%-9px)] lg:w-[calc(16.666%-10px)] 2xl:w-[calc(11.111%-10.6px)] overflow-hidden rounded-2xl md:rounded-[22px] border border-white/60 bg-white/80 backdrop-blur-xl shadow-xs transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.15]"
                                        >
                                            {brand.logo_url ? (
                                                <HomepageMediaImage
                                                    groupReady={areHomepageCommerceMediaReady}
                                                    loading="eager"
                                                    decoding="async"
                                                    src={brand.logo_url}
                                                    fallbackSrc="/seo/og-default.jpg"
                                                    alt={brand.name}
                                                    containerClassName="!absolute inset-0 flex items-center justify-center bg-white"
                                                    imageClassName="h-full w-full object-contain transition duration-500 group-hover:scale-[1.025]"
                                                    placeholderClassName="rounded-[23px]"
                                                />
                                            ) : (
                                                <span className="text-sm font-black tracking-[0.18em] text-primary">{brand.name.slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-10 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => onSetView({ page: 'brands' })}
                                        className="homepage-primary-button btn-press"
                                    >
                                        {copy.brandButton}
                                    </button>
                                </div>
                            </AnimatedSection>
                        </div>
                    </section>
            )}

            {leadPost && (
                <section className="px-4 py-10 md:px-6 md:py-14">
                        <div className="container mx-auto">
                            <AnimatedSection className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-5xl text-center lg:text-left">
                                    <p className="section-kicker">{copy.blogKicker}</p>
                                    <h2 className="section-title mt-4">{copy.blogTitle}</h2>
                                    {copy.blogSubtitle ? (
                                        <p className="section-subtitle mt-3">{copy.blogSubtitle}</p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSetView({ page: 'blog' })}
                                    className="homepage-outline-button btn-press"
                                >
                                    {copy.blogButton}
                                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                                </button>
                            </AnimatedSection>

                            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                                <AnimatedSection stagger={60}>
                                    <button
                                        type="button"
                                        onClick={() => openPost(leadPost)}
                                        className="group homepage-editorial-card flex h-full w-full flex-col overflow-hidden text-left"
                                    >
                                        <div className="relative aspect-[1.4/1] overflow-hidden">
                                            <FallbackBlogImage
                                                loading="lazy"
                                                slug={leadPost.slug}
                                                src={leadPost.image_url}
                                                alt={buildBlogImageAlt({
                                                    title: getLocalized(leadPost, 'title'),
                                                    categoryName: categoryNameMap.get(leadPost.category_slug),
                                                    context: 'listing',
                                                })}
                                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                            />
                                            <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/60">
                                                {categoryNameMap.get(leadPost.category_slug) || 'Knowledge'}
                                            </span>
                                        </div>
                                        <div className="flex flex-1 flex-col p-6 md:p-8">
                                            <h3 className="font-hero-body text-2xl font-black leading-tight tracking-[-0.045em] text-foreground md:text-[2.85rem]">
                                                {getLocalized(leadPost, 'title')}
                                            </h3>
                                            <p className="mt-5 flex-1 font-hero-body text-sm leading-7 text-muted-foreground md:text-base">
                                                {getLocalized(leadPost, 'summary')}
                                            </p>
                                            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                                                <p className="font-hero-body text-sm font-semibold text-muted-foreground">{leadPost.author?.name || 'Thế Giới Trị Mụn'}</p>
                                                <span className="inline-flex items-center gap-2 font-hero-body text-sm font-bold text-foreground">
                                                    {copy.readMore}
                                                    <EyeIcon className="h-4 w-4" />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </AnimatedSection>

                                <div className="grid gap-4">
                                    {sidePosts.map((post, index) => (
                                        <AnimatedSection key={post.slug} stagger={100 + index * 40}>
                                            <button
                                                type="button"
                                                onClick={() => openPost(post)}
                                            className="group homepage-editorial-card flex w-full items-center gap-4 overflow-hidden p-4 text-left"
                                            >
                                                <FallbackBlogImage
                                                    loading="lazy"
                                                    slug={post.slug}
                                                    src={post.image_url}
                                                    alt={buildBlogImageAlt({
                                                        title: getLocalized(post, 'title'),
                                                        categoryName: categoryNameMap.get(post.category_slug),
                                                        context: 'listing',
                                                    })}
                                                    className="h-24 w-24 rounded-[18px] object-cover md:h-28 md:w-28 shadow-xs"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                                                        {categoryNameMap.get(post.category_slug) || 'Knowledge'}
                                                    </p>
                                                    <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-foreground">
                                                        {getLocalized(post, 'title')}
                                                    </h3>
                                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                                        {getLocalized(post, 'summary')}
                                                    </p>
                                                </div>
                                            </button>
                                        </AnimatedSection>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
            )}

            {faqItems.length > 0 && (
                <section className="px-4 py-10 md:px-6 md:py-14">
                        <div className="container mx-auto">
                            <AnimatedSection className="homepage-section-shell grid gap-8 p-6 md:p-10 lg:grid-cols-[0.88fr_1.12fr] lg:p-14">
                                <div className="text-center lg:text-left">
                                    <p className="section-kicker">{copy.faqKicker}</p>
                                    <h2 className="section-title mt-4">{copy.faqTitle}</h2>
                                    {copy.faqSubtitle ? (
                                        <p className="section-subtitle mt-4">{copy.faqSubtitle}</p>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={onRequestBooking}
                                        className="mt-8 homepage-primary-button btn-press"
                                    >
                                        {copy.heroPrimary}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {faqItems.slice(0, 5).map((faq) => (
                                        <div key={faq.id} className="overflow-hidden rounded-[24px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-xs dark:border-white/10 dark:bg-[rgba(15,23,42,0.6)]">
                                            <button
                                                type="button"
                                                onClick={() => onToggleFaq(openFaqId === faq.id ? null : faq.id)}
                                                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                                            >
                                                <span className="font-hero-body text-sm font-black leading-6 text-foreground md:text-base">
                                                    {getLocalized(faq, 'question')}
                                                </span>
                                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary backdrop-blur-md dark:bg-primary/20">
                                                    <ArrowRightIcon className={`h-4 w-4 rotate-90 transition ${openFaqId === faq.id ? 'translate-y-0.5 rotate-[270deg]' : ''}`} />
                                                </span>
                                            </button>
                                            <div
                                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                                                    openFaqId === faq.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                                }`}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className="border-t border-border/60 px-5 py-4 font-hero-body text-sm leading-7 text-muted-foreground">
                                                        {getLocalized(faq, 'answer')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AnimatedSection>
                        </div>
                    </section>
            )}
        </div>
    );
};

export default HomePageContent;
