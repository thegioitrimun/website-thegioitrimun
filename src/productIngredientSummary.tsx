import React, { useEffect, useMemo, useState } from 'react';

export type ProductRiskBandKey = 'score-1-2' | 'score-3-4' | 'score-5' | 'score-6' | 'score-7-10' | 'unknown';
export type ProductRiskSummaryStatus = 'loading' | 'ready' | 'empty' | 'error';

export type ProductRiskSegment = {
    key: ProductRiskBandKey;
    label: string;
    color: string;
    count: number;
    basis: string;
};

export type ProductRiskSummary = {
    status: ProductRiskSummaryStatus;
    total: number;
    safety_score?: number;
    segments: ProductRiskSegment[];
    raw_ingredients_text?: string;
    summary_text?: string;
};

export type ProductAnalyzerResponse = {
    summary?: { total?: number; recognized?: number; unrecognized?: number };
    safety_score?: number;
    verdict?: string;
    ewg?: { low?: number; moderate?: number; high?: number; unknown?: number };
    ingredients?: Array<{
        raw_name?: string;
        inci_name?: string;
        ewg_score?: string | null;
        ewg_bucket?: 'low' | 'moderate' | 'high' | 'unknown';
    }>;
};

export const PRODUCT_RISK_BANDS: Array<{ key: ProductRiskBandKey; label: string; color: string }> = [
    { key: 'score-1-2', label: 'EWG 1–2', color: '#7bd96b' },
    { key: 'score-3-4', label: 'EWG 3–4', color: '#aceb70' },
    { key: 'score-5', label: 'EWG 5', color: '#d9ef62' },
    { key: 'score-6', label: 'EWG 6', color: '#f0df55' },
    { key: 'score-7-10', label: 'EWG 7–10', color: '#ec6370' },
    { key: 'unknown', label: 'Chưa rõ', color: '#c2c8ce' },
];

export const EMPTY_PRODUCT_RISK_SUMMARY: ProductRiskSummary = {
    status: 'empty',
    total: 0,
    segments: [],
};

export const LOADING_PRODUCT_RISK_SUMMARY: ProductRiskSummary = {
    status: 'loading',
    total: 0,
    segments: [],
};

export const normalizeAnalyzerLanguage = (language: string): 'vi' | 'en' =>
    language?.startsWith('en') ? 'en' : 'vi';

export const getEwgMax = (score: string | null | undefined): number | null => {
    const values = String(score || '').match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    return values.length ? Math.max(...values) : null;
};

export const getRiskBand = (score: number | null): ProductRiskBandKey => {
    if (score === null) return 'unknown';
    if (score <= 2) return 'score-1-2';
    if (score <= 4) return 'score-3-4';
    if (score === 5) return 'score-5';
    if (score === 6) return 'score-6';
    return 'score-7-10';
};

export const buildProductRiskSummary = (analysis: ProductAnalyzerResponse | null, rawIngredients = ''): ProductRiskSummary => {
    const ingredients = Array.isArray(analysis?.ingredients) ? analysis.ingredients : [];
    const counts = Object.fromEntries(PRODUCT_RISK_BANDS.map((band) => [band.key, 0])) as Record<ProductRiskBandKey, number>;

    ingredients.forEach((ingredient) => {
        const score = getEwgMax(ingredient.ewg_score);
        counts[getRiskBand(score)] += 1;
    });

    const total = Math.max(Number(analysis?.summary?.total) || 0, ingredients.length);
    const counted = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total > counted) counts.unknown += total - counted;
    if (!total) return EMPTY_PRODUCT_RISK_SUMMARY;

    const segments = PRODUCT_RISK_BANDS
        .filter((band) => counts[band.key] > 0)
        .map((band) => ({
            ...band,
            count: counts[band.key],
            basis: `${Math.round((counts[band.key] / total) * 100)}%`,
        }));

    const summary_text = segments.map((s) => `${s.label}: ${s.count} (${s.basis})`).join(' • ');

    return {
        status: 'ready',
        total,
        safety_score: analysis?.safety_score,
        segments,
        raw_ingredients_text: rawIngredients,
        summary_text,
    };
};

const productRiskCache = new Map<string, ProductRiskSummary>();
const productRiskRequests = new Map<string, Promise<ProductRiskSummary>>();

export const getProductRiskCacheKey = (productKey: string | number, ingredients: string, language: 'vi' | 'en') =>
    `${language}:${String(productKey).trim()}:${String(ingredients).trim()}`;

export async function requestProductRiskSummary(
    productKey: string | number,
    ingredients: string,
    language: 'vi' | 'en' = 'vi',
): Promise<ProductRiskSummary> {
    const normalizedIngredients = String(ingredients || '').trim();
    if (!normalizedIngredients) return EMPTY_PRODUCT_RISK_SUMMARY;

    const cacheKey = getProductRiskCacheKey(productKey, normalizedIngredients, language);
    const cached = productRiskCache.get(cacheKey);
    if (cached) return cached;
    const pending = productRiskRequests.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
        let analysis: ProductAnalyzerResponse | null = null;
        try {
            const snapshotResponse = await fetch(
                `/api/ingredient-analyzer/products/${encodeURIComponent(String(productKey))}?lang=${encodeURIComponent(language)}`,
                { headers: { Accept: 'application/json' } },
            );
            if (snapshotResponse.ok) {
                analysis = await snapshotResponse.json() as ProductAnalyzerResponse;
            }
        } catch {
            // Live fallback below
        }

        if (!analysis) {
            const rawResponse = await fetch('/api/ingredient-analyzer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inciText: normalizedIngredients, lang: language }),
            });
            const payload = await rawResponse.json().catch(() => null) as ProductAnalyzerResponse | { error?: string } | null;
            if (!rawResponse.ok) throw new Error(payload && 'error' in payload ? payload.error || 'Ingredient analysis failed.' : 'Ingredient analysis failed.');
            analysis = payload as ProductAnalyzerResponse;
        }

        const summary = buildProductRiskSummary(analysis, normalizedIngredients);
        productRiskCache.set(cacheKey, summary);
        return summary;
    })().finally(() => {
        productRiskRequests.delete(cacheKey);
    });

    productRiskRequests.set(cacheKey, request);
    return request;
}

export function useProductRiskSummary(
    productKey: string | number,
    ingredients?: string | null,
    language = 'vi',
) {
    const analyzerLang = normalizeAnalyzerLanguage(language);
    const normalizedIngredients = String(ingredients || '').trim();
    const cacheKey = getProductRiskCacheKey(productKey, normalizedIngredients, analyzerLang);

    const [summary, setSummary] = useState<ProductRiskSummary>(() => {
        if (!normalizedIngredients) return EMPTY_PRODUCT_RISK_SUMMARY;
        return productRiskCache.get(cacheKey) || LOADING_PRODUCT_RISK_SUMMARY;
    });

    useEffect(() => {
        if (!normalizedIngredients) {
            setSummary(EMPTY_PRODUCT_RISK_SUMMARY);
            return;
        }

        const cached = productRiskCache.get(cacheKey);
        if (cached) {
            setSummary(cached);
            return;
        }

        let isMounted = true;
        setSummary(LOADING_PRODUCT_RISK_SUMMARY);

        requestProductRiskSummary(productKey, normalizedIngredients, analyzerLang)
            .then((res) => {
                if (isMounted) setSummary(res);
            })
            .catch(() => {
                if (isMounted) setSummary({ status: 'error', total: 0, segments: [] });
            });

        return () => {
            isMounted = false;
        };
    }, [analyzerLang, cacheKey, normalizedIngredients, productKey]);

    return summary;
}

export const ProductRiskBar: React.FC<{
    summary: ProductRiskSummary;
    className?: string;
}> = ({ summary, className = '' }) => {
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
            className={`relative mt-2.5 w-full ${className}`}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="flex h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-[#e9eef1] dark:bg-stone-700 shadow-inner"
                role="img"
                aria-label={
                    isReady && summary.summary_text
                        ? `Phân bố EWG (${summary.total} thành phần): ${summary.summary_text}`
                        : summary.status === 'loading'
                        ? 'Đang phân tích bảng thành phần INCI'
                        : 'Thanh thành phần'
                }
            >
                {isReady ? (
                    summary.segments.map((seg, index) => {
                        const isHovered = hoveredIndex === index;
                        const hasHover = hoveredIndex !== null;
                        return (
                            <span
                                key={`${seg.key}-${index}`}
                                style={{
                                    width: seg.basis,
                                    backgroundColor: seg.color,
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

            {/* Interactive Floating Tooltip on Hover (Positioned Above Bar) */}
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
                            : {summary.segments[hoveredIndex].count} ({summary.segments[hoveredIndex].basis})
                        </span>
                    </div>
                    {/* Small pointer arrow */}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#18202f]/95" />
                </div>
            )}
        </div>
    );
};
