import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductCategory, ProductReview, UserData, ProductContentBlock, BlogPost, Service, ProductBrand } from '../types';
import { getFallbackBlogImage } from '../types';
import FallbackBlogImage from './FallbackBlogImage';
import FallbackPublicImage from './FallbackPublicImage';
import { ArrowLeftIcon, ArrowRightIcon, MinusIcon, PlusIcon, StarIcon, CheckIcon, InformationCircleIcon, ShoppingBagIcon, ChevronDownIcon } from './icons';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../hooks/useToast';
import { useBiDirectionalSticky } from '../hooks/useBiDirectionalSticky';
import * as api from '../services/api';
import Spinner from './Spinner';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/free-mode';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Thumbs, FreeMode } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper/types';
import AnimatedSection from './AnimatedSection';
import MarkdownRenderer from './MarkdownRenderer';
import { IngredientAnalysisResults, IngredientQuickNotes, getAnalyzerLanguage, type AnalyzerResponse } from './IngredientAnalyzerPage';
import { sanitizeDetailFaqItems } from '../src/detailFaq';
import { getLocalizedArrayValue, getLocalizedValue, rankByTokenOverlap } from '../src/relatedContent';
import { getBrandDescriptionSnippet, normalizeBrandMatchKey } from '../src/brandUtils';
import { buildProductImageAlt } from '../src/imageSeo';
import ProductDetailLoadingShell from './ProductDetailLoadingShell';


interface ProductDetailPageProps {
    product: Product;
    allProducts: Product[];
    allCategories: ProductCategory[];
    brands: ProductBrand[];
    allBlogPosts: BlogPost[];
    allServices: Service[];
    onSelectProduct: (id: number, categorySlug?: string) => void;
    onSelectPost: (slug: string, categorySlug?: string) => void;
    onSelectService: (id: number) => void;
    onOpenBrand: (brandSlug: string) => void;
    onBrowseCategory: (categorySlug: string) => void;
    onBack: () => void;
    currentUser: UserData | null;
    focusReview?: boolean;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const splitHighlights = (value: string | undefined | null, limit = 4) =>
    String(value || '')
        .split(/[\n•|-]|(?:\.\s+)/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, limit);

const truncateTextContent = (value: string | undefined | null, maxChars: number) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    const clipped = normalized.slice(0, maxChars + 1);
    const cutoff = clipped.lastIndexOf(' ');
    const safeCutoff = cutoff > maxChars * 0.6 ? cutoff : maxChars;
    return `${clipped.slice(0, safeCutoff).trimEnd()}…`;
};

type ProductIngredientAnalysisProps = {
    ingredients: string;
    productName: string;
};

const productIngredientAnalysisCopy = (language: string) => {
    if (language?.startsWith('en')) {
        return {
            kicker: 'Ingredient analyzer',
            title: 'Analyze this product INCI list',
            description: 'The tool reads this product INCI list and checks safety score, quick notes, skin-type fit, and ingredient functions.',
            source: 'Original INCI from this product',
            summaryTitle: 'Ingredients',
            safetyScore: 'Safety score',
            recognizedShort: 'recognised',
            low: 'Low',
            moderate: 'Moderate',
            high: 'High',
            unknown: 'Unknown',
            loading: 'Analyzing this product INCI...',
            error: 'Unable to analyze this product right now. Please try again later.',
            noInci: 'This product has no INCI data yet.',
        };
    }

    return {
        kicker: 'Phân tích thành phần',
        title: 'Phân tích INCI của sản phẩm này',
        description: 'Công cụ lấy bảng INCI đang lưu trong sản phẩm để kiểm tra điểm an toàn, ghi chú nhanh, mức phù hợp theo loại da và chức năng từng thành phần.',
        source: 'INCI gốc của sản phẩm',
        summaryTitle: 'Thành phần',
        safetyScore: 'Điểm an toàn',
        recognizedShort: 'được nhận diện',
        low: 'Thấp',
        moderate: 'Trung bình',
        high: 'Cao',
        unknown: 'Chưa rõ',
        loading: 'Đang phân tích INCI của sản phẩm...',
        error: 'Chưa thể phân tích sản phẩm này lúc này. Vui lòng thử lại sau.',
        noInci: 'Sản phẩm này chưa có dữ liệu INCI.',
    };
};

type CompactIngredientSummaryProps = {
    analysis: AnalyzerResponse | null;
    isLoading: boolean;
    error: string;
    copy: ReturnType<typeof productIngredientAnalysisCopy>;
    normalizedIngredients: string;
    analyzerLang: ReturnType<typeof getAnalyzerLanguage>;
};

const CompactIngredientSummary: React.FC<CompactIngredientSummaryProps> = ({
    analysis,
    isLoading,
    error,
    copy,
    normalizedIngredients,
    analyzerLang,
}) => {
    const sidebarRef = useBiDirectionalSticky(96, 96, 32) as React.RefObject<HTMLElement>;

    return (
        <aside data-no-scroll-reveal ref={sidebarRef} style={{ top: '6rem' }} className="product-detail-ingredient-summary min-w-0 lg:sticky lg:self-start rounded-[26px] bg-[linear-gradient(180deg,rgba(245,251,249,0.96),rgba(255,255,255,0.98))] p-5 dark:bg-[linear-gradient(180deg,rgba(21,37,39,0.92),rgba(17,24,35,0.98))] md:p-6">
            <p className="section-kicker text-center">{copy.kicker}</p>
            <h3 className="mt-2 text-center text-xl font-black tracking-[-0.03em] text-foreground md:text-2xl">{copy.summaryTitle}</h3>

            {!normalizedIngredients ? (
                <p className="mt-5 text-sm font-semibold leading-7 text-muted-foreground">{copy.noInci}</p>
            ) : null}

            {normalizedIngredients && isLoading ? (
                <div className="mt-5 flex items-center gap-3 text-sm font-bold text-muted-foreground">
                    <Spinner className="h-5 w-5" />
                    <span>{copy.loading}</span>
                </div>
            ) : null}

            {normalizedIngredients && !isLoading && error ? (
                <p className="mt-5 rounded-[18px] border border-secondary/20 bg-secondary/5 p-4 text-sm font-bold leading-6 text-secondary">{error}</p>
            ) : null}

            {normalizedIngredients && !isLoading && analysis ? (
                <>
                    <div className="mt-5 flex items-center justify-center gap-4">
                        <div
                            className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full"
                            style={{ background: `conic-gradient(#299582 ${Math.max(0, Math.min(100, analysis.safety_score))}%, #dfe8ec 0)` }}
                            aria-label={`${copy.safetyScore}: ${analysis.safety_score}%`}
                        >
                            <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-center shadow-inner dark:bg-card">
                                <span className="text-xl font-black tracking-[-0.04em] text-foreground">{analysis.safety_score}%</span>
                            </div>
                        </div>
                        <div className="min-w-0 text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{copy.safetyScore}</p>
                            <p className="mt-1 text-lg font-black leading-tight text-foreground">{analysis.verdict}</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                                {analysis.summary.recognized}/{analysis.summary.total} {copy.recognizedShort}
                            </p>
                        </div>
                    </div>


                </>
            ) : null}

            {normalizedIngredients ? (
                <details className="mt-5 rounded-[18px] p-4">
                    <summary className="cursor-pointer select-none text-sm font-bold text-primary">{copy.source}</summary>
                    <MarkdownRenderer
                        content={normalizedIngredients}
                        variant="compact"
                        className="mt-3 max-w-full text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]"
                    />
                </details>
            ) : null}

            {analysis ? (
                <div className="mt-6 pt-6">
                    <IngredientAnalysisResults analysis={analysis} lang={analyzerLang} hideQuickNotes={true} variant="sidebar" />
                </div>
            ) : null}
        </aside>
    );
};

const ProductIngredientAnalysis: React.FC<ProductIngredientAnalysisProps & { analysis: AnalyzerResponse | null, isLoading: boolean, error: string, copy: any, normalizedIngredients: string, analyzerLang: string }> = ({ productName, analysis, isLoading, error, copy, normalizedIngredients, analyzerLang }) => {
    if (!normalizedIngredients) {
        return (
            <div className="rounded-[24px] border border-border bg-white p-5 text-sm font-semibold text-muted-foreground shadow-sm dark:border-white/10 dark:bg-card">
                {copy.noInci}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-none space-y-6">
            <section className="max-w-full overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(135deg,#fffaf6_0%,#ffffff_50%,#eef8ff_100%)] p-5 text-center shadow-[0_22px_60px_-50px_rgba(36,46,57,0.35)] md:p-6 md:text-left dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.85)_0%,rgba(15,23,42,0.95)_50%,rgba(15,23,42,0.85)_100%)]">
                <p className="section-kicker">{copy.kicker}</p>
                <h3 className="mt-2 !text-[1.35rem] font-bold leading-tight text-foreground md:!text-2xl">{copy.title}</h3>
                <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:mx-0 md:text-base">{copy.description}</p>
                <details className="mt-4 rounded-[20px] border border-border/80 bg-white/82 p-4 dark:border-white/10 dark:bg-white/5">
                    <summary className="cursor-pointer select-none text-sm font-bold text-primary">
                        {copy.source}
                    </summary>
                    <MarkdownRenderer
                        content={normalizedIngredients}
                        variant="compact"
                        className="mt-3 max-w-full text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]"
                    />
                </details>
                {productName ? <p className="sr-only">{productName}</p> : null}
            </section>

            {isLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-[24px] border border-border bg-white p-6 text-sm font-bold text-muted-foreground dark:border-white/10 dark:bg-card">
                    <Spinner className="h-5 w-5" />
                    {copy.loading}
                </div>
            ) : null}

            {!isLoading && error ? (
                <div className="rounded-[24px] border border-secondary/20 bg-secondary/5 p-5 text-sm font-bold text-secondary">
                    {error}
                </div>
            ) : null}

            {!isLoading && analysis ? (
                <IngredientAnalysisResults analysis={analysis} lang={analyzerLang as any} hideQuickNotes={true} />
            ) : null}
        </div>
    );
};

const buildSeoUrl = (path: string, lang: string) => {
    if (lang.startsWith('vi')) return `https://thegioitrimun.vn${path}`;
    return `https://thegioitrimun.vn${path}?lang=${encodeURIComponent(lang)}`;
};

const normalizeCompare = (value: string | undefined | null) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

const PRODUCT_VOLUME_REGEX = /(\d+(?:[.,]\d+)?)\s?(ml|g|gr|kg|l|pcs|mieng|miếng|vien|viên)/i;

type VolumeDetails = {
    value: number | null;
    unit: string;
    label: string;
};

const extractVolumeDetails = (productName: string, volume?: string | null): VolumeDetails => {
    const rawVolume = String(volume || '').trim();
    const source = rawVolume || productName;
    const matched = source.match(PRODUCT_VOLUME_REGEX);

    if (!matched) {
        return {
            value: null,
            unit: '',
            label: rawVolume,
        };
    }

    return {
        value: Number(matched[1].replace(',', '.')),
        unit: matched[2].toLowerCase(),
        label: rawVolume || `${matched[1]}${matched[2]}`,
    };
};

type TrialProfile = {
    isTrial: boolean;
    badge: string;
    usageEstimate: string;
    volumeDetails: VolumeDetails;
};

type TrialProfileCopy = {
    badgeTrial: string;
    badgeDetail: string;
    usageEstimateSmall: string;
    usageEstimateMedium: string;
    usageEstimateLarge: string;
};

const getDateLocale = (language: string) => {
    if (language.startsWith('ru')) return 'ru-RU';
    if (language.startsWith('cn') || language.startsWith('zh')) return 'zh-CN';
    if (language.startsWith('en')) return 'en-US';
    return 'vi-VN';
};

const inferTrialProfile = (productName: string, description: string, volume: string | null | undefined, copy: TrialProfileCopy): TrialProfile => {
    const normalized = normalizeCompare(`${productName} ${description} ${volume || ''}`);
    const volumeDetails = extractVolumeDetails(productName, volume);
    const hasTrialKeyword = /(mau thu|sample|trial|mini|travel size|tester|size mini)/i.test(normalized);
    const looksLikeTrialSize =
        Number.isFinite(volumeDetails.value) &&
        volumeDetails.value !== null &&
        ['ml', 'g', 'gr'].includes(volumeDetails.unit) &&
        volumeDetails.value <= 15;

    const isTrial = hasTrialKeyword || looksLikeTrialSize;

    let usageEstimate = '';
    if (volumeDetails.value !== null && ['ml', 'g', 'gr'].includes(volumeDetails.unit)) {
        if (volumeDetails.value <= 7) usageEstimate = copy.usageEstimateSmall;
        else if (volumeDetails.value <= 15) usageEstimate = copy.usageEstimateMedium;
        else if (volumeDetails.value <= 30) usageEstimate = copy.usageEstimateLarge;
    }

    return {
        isTrial,
        badge: isTrial ? copy.badgeTrial : copy.badgeDetail,
        usageEstimate,
        volumeDetails,
    };
};

type DetailFaqItem = {
    question: string;
    answer: string;
};

const StarRating: React.FC<{ rating: number; className?: string }> = ({ rating, className = "w-5 h-5" }) => {
    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className={`${className} ${i < Math.round(rating) ? "text-yellow-400" : "text-gray-300"}`} />
            ))}
        </div>
    );
};

// --- Review Components ---

interface ReviewFormProps {
    productId: number;
    userId: string;
    onReviewSubmitted: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ productId, userId, onReviewSubmitted }) => {
    const { t } = useTranslation();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            addToast(t('products.review_select_rating', 'Vui lòng chọn số sao'), { type: 'error' });
            return;
        }
        setIsSubmitting(true);
        try {
            await api.createProductReview({
                product_id: productId,
                user_id: userId,
                rating,
                title,
                comment
            });
            addToast(t('products.review_submit_success', 'Gửi đánh giá thành công!'), { type: 'success' });
            onReviewSubmitted();
            setRating(0);
            setTitle('');
            setComment('');
        } catch (error: any) {
            addToast(t('products.review_submit_error', 'Lỗi khi gửi đánh giá'), { type: 'error', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mt-8 bg-card p-6 rounded-lg border border-border">
            <h4 className="font-bold text-lg mb-4">{t('products.review_form_title', 'Viết đánh giá của bạn')}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t('products.review_overall', 'Đánh giá chung')}</label>
                    <div className="flex items-center">
                        {[...Array(5)].map((_, index) => {
                            const starValue = index + 1;
                            return (
                                <button
                                    type="button"
                                    key={starValue}
                                    onMouseEnter={() => setHoverRating(starValue)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(starValue)}
                                    className="p-1"
                                    aria-label={t('products.review_star_aria', { count: starValue, defaultValue: `Đánh giá ${starValue} sao` })}
                                >
                                    <StarIcon className={`w-6 h-6 transition-colors ${(hoverRating || rating) >= starValue ? 'text-yellow-400' : 'text-gray-300'}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <label htmlFor="review-title" className="block text-sm font-medium mb-1">{t('products.review_title_label', 'Tiêu đề đánh giá')}</label>
                    <input id="review-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full admin-glass-input" placeholder={t('products.review_title_placeholder', 'Sản phẩm tuyệt vời!')} />
                </div>
                <div>
                    <label htmlFor="review-comment" className="block text-sm font-medium mb-1">{t('products.review_comment_label', 'Nội dung đánh giá')}</label>
                    <textarea id="review-comment" value={comment} onChange={e => setComment(e.target.value)} rows={4} className="w-full admin-glass-input" placeholder={t('products.review_comment_placeholder', 'Chia sẻ cảm nhận của bạn về sản phẩm...')}></textarea>
                </div>
                <button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors btn-press disabled:bg-muted">
                    {isSubmitting ? <Spinner className="w-5 h-5" /> : t('products.review_submit', 'Gửi đánh giá')}
                </button>
            </form>
        </div>
    );
};

interface ReviewsSectionProps {
    reviews: ProductReview[];
    verifiedReviewCount: number;
    isLoading: boolean;
    product: Product;
    currentUser: UserData | null;
    canReview: boolean | null;
    isCheckingEligibility: boolean;
    onReviewSubmitted: () => void;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({
    reviews,
    verifiedReviewCount,
    isLoading,
    product,
    currentUser,
    canReview,
    isCheckingEligibility,
    onReviewSubmitted,
}) => {
    const { t, i18n } = useTranslation();
    const hasUserReviewed = currentUser && reviews.some(r => r.user_id === currentUser.profile.id);

    return (
        <div id="reviews-section">
            {isLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
            ) : reviews.length === 0 ? (
                <p className="text-muted-foreground">{t('products.no_reviews', 'Chưa có đánh giá nào cho sản phẩm này.')}</p>
            ) : (
                <div className="space-y-6">
                    {reviews.map(review => (
                        <div key={review.id} className="flex items-start gap-4 pb-6 border-b border-border last:border-b-0">
                            <img src={review.author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.author.name)}&background=random`} alt={review.author.name} className="w-12 h-12 rounded-full object-cover" />
                            <div>
                                <div className="flex items-center gap-4 mb-1">
                                    <span className="font-semibold text-foreground">{review.author.name}</span>
                                    {review.verified_purchase && (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                            {t('products.verified_purchase', 'Đã mua hàng')}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString(getDateLocale(i18n.language))}</span>
                                </div>
                                <StarRating rating={review.rating} />
                                <h4 className="font-semibold text-foreground mt-2">{review.title}</h4>
                                <p className="text-muted-foreground mt-1">{review.comment}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {verifiedReviewCount > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                    {t('products.verified_review_note', 'Structured data chỉ dùng các đánh giá gắn với đơn mua đã xác minh.')}
                </p>
            )}

            {currentUser && !hasUserReviewed && canReview && (
                <ReviewForm productId={product.id} userId={currentUser.profile.id} onReviewSubmitted={onReviewSubmitted} />
            )}
            {currentUser && hasUserReviewed && (
                <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                    {t('products.review_thanks', 'Cảm ơn bạn đã đánh giá sản phẩm này!')}
                </div>
            )}
            {currentUser && !hasUserReviewed && !isCheckingEligibility && canReview === false && (
                <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm">
                    {t('products.review_purchase_required', 'Chỉ khách hàng đã hoàn tất đơn mua sản phẩm này mới có thể viết đánh giá.')}
                </div>
            )}
            {currentUser && !hasUserReviewed && isCheckingEligibility && (
                <div className="mt-8 flex justify-center py-4"><Spinner /></div>
            )}
            {!currentUser && (
                <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                    {t('products.review_login_prompt_prefix', 'Vui lòng')} <span className="font-semibold text-primary">{t('common.login').toLowerCase()}</span> {t('products.review_login_prompt_suffix', 'để viết đánh giá.')}
                </div>
            )}
        </div>
    );
};

const StructuredContent: React.FC<{ blocks: ProductContentBlock[]; productName: string; brandName?: string | null }> = ({ blocks, productName, brandName }) => {
    return (
        <div className="product-detail-structured-content space-y-8 md:space-y-10">
            {blocks.map((block, index) => {
                if (block.type === 'text') {
                    return <MarkdownRenderer key={index} content={block.content} />;
                }
                if (block.type === 'image') {
                    return (
                        <figure key={index} className="product-detail-structured-figure -mx-10 overflow-visible bg-transparent shadow-none md:mx-0 md:overflow-hidden md:rounded-[28px] md:border md:border-border md:bg-card md:shadow-[0_24px_45px_-38px_rgba(32,26,14,0.42)]">
                            <FallbackPublicImage
                                src={block.image_url}
                                alt={block.caption || buildProductImageAlt({
                                    productName,
                                    brandName,
                                    context: 'detail',
                                    index,
                                })}
                                loading="lazy"
                                sizes="(max-width: 767px) 100vw, (max-width: 1023px) 92vw, 900px"
                                className="h-auto w-full rounded-none border-0 bg-transparent object-contain"
                            />
                            {block.caption && (
                                <figcaption className="px-2 pt-3 text-center text-sm leading-7 text-muted-foreground italic md:text-[15px]">{block.caption}</figcaption>
                            )}
                        </figure>
                    );
                }
                return null;
            })}
        </div>
    );
};


const ProductImageGallery: React.FC<{ product: Product; productName: string }> = ({ product, productName }) => {
    const [thumbsSwiper, setThumbsSwiper] = useState<SwiperCore | null>(null);

    const hasImages = product.images && product.images.length > 0;
    if (!hasImages) {
        return (
            <div className="flex aspect-square w-full items-center justify-center rounded-[30px] border border-border bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_58%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--accent)/0.34))] shadow-[0_28px_70px_-42px_rgba(41,33,21,0.42)]">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-border/80 bg-white/90 text-primary shadow-sm dark:border-white/10 dark:bg-card">
                    <ShoppingBagIcon className="h-12 w-12" />
                </div>
            </div>
        )
    }

    return (
        <div className="product-gallery flex w-full flex-col gap-4 select-none lg:gap-5">
            <div className="product-gallery-main relative -mx-4 overflow-hidden bg-transparent shadow-none md:mx-0 md:rounded-[30px] md:bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_56%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--accent)/0.34))] md:shadow-[0_28px_72px_-40px_rgba(41,33,21,0.46)]">
                <Swiper
                    modules={[Navigation, Thumbs]}
                    spaceBetween={10}
                    navigation
                    thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                    className="product-gallery-swiper group aspect-square w-full overflow-hidden rounded-none bg-transparent shadow-none md:rounded-[30px] md:shadow-sm lg:aspect-[0.96/1]"
                >
                    {product.images?.map((image, index) => (
                        <SwiperSlide key={`main-${image.id}`} className="h-full w-full overflow-hidden rounded-none bg-transparent md:rounded-[30px]">
                            <FallbackPublicImage
                                src={image.image_url}
                                alt={buildProductImageAlt({
                                    productName,
                                    brandName: product.brand,
                                    context: 'gallery',
                                    index,
                                })}
                                loading={index === 0 ? 'eager' : 'lazy'}
                                sizes="(max-width: 767px) 100vw, (max-width: 1023px) 58vw, 720px"
                                className="h-full w-full cursor-crosshair object-cover transition-opacity duration-500 [filter:drop-shadow(0_18px_30px_rgba(36,46,57,0.2))_drop-shadow(0_-18px_30px_rgba(36,46,57,0.12))]"
                            />
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {product.images && product.images.length > 1 && (
                <div className="product-gallery-thumbs w-full">
                    <Swiper
                        onSwiper={setThumbsSwiper}
                        modules={[FreeMode, Thumbs]}
                        freeMode={true}
                        watchSlidesProgress
                        breakpoints={{
                            0: { slidesPerView: 4.25, spaceBetween: 8 },
                            640: { slidesPerView: 4.8, spaceBetween: 10 },
                            1024: { slidesPerView: 5.5, spaceBetween: 12 }
                        }}
                        className="w-full py-1"
                    >
                        {product.images?.map((image, index) => (
                            <SwiperSlide key={`thumb-${image.id}`} className="aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-transparent bg-transparent opacity-60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100 swiper-slide-thumb-active:border-primary swiper-slide-thumb-active:opacity-100">
                                <FallbackPublicImage
                                    src={image.image_url}
                                    alt={buildProductImageAlt({
                                        productName,
                                        brandName: product.brand,
                                        context: 'thumbnail',
                                        index,
                                    })}
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    sizes="(max-width: 767px) 24vw, 120px"
                                    className="h-full w-full object-cover pointer-events-none"
                                />
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            )}
        </div>
    );
}

const ingredientAnalysisCache = new Map<string, AnalyzerResponse>();
const ingredientAnalysisRequests = new Map<string, Promise<AnalyzerResponse>>();
const productIngredientSnapshotCache = new Map<string, AnalyzerResponse>();
const productIngredientSnapshotRequests = new Map<string, Promise<AnalyzerResponse | null>>();

const getProductIngredientSnapshotCacheKey = (
    productKey: number | string,
    analyzerLang: ReturnType<typeof getAnalyzerLanguage>,
    sourceVersion = '',
) => `${analyzerLang}:${String(productKey).trim()}:${String(sourceVersion || '').trim()}`;

export function prefetchProductIngredientAnalysis(
    productKey: number | string,
    language = 'vi',
    sourceVersion = '',
): Promise<AnalyzerResponse | null> {
    const normalizedProductKey = String(productKey || '').trim();
    if (!normalizedProductKey) return Promise.resolve(null);

    const analyzerLang = getAnalyzerLanguage(language);
    const normalizedSourceVersion = String(sourceVersion || '').trim();
    const cacheKey = getProductIngredientSnapshotCacheKey(normalizedProductKey, analyzerLang, normalizedSourceVersion);
    const cached = productIngredientSnapshotCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const pending = productIngredientSnapshotRequests.get(cacheKey);
    if (pending) return pending;

    const versionQuery = normalizedSourceVersion
        ? `&v=${encodeURIComponent(normalizedSourceVersion)}`
        : '';
    const request = fetch(
        `/api/ingredient-analyzer/products/${encodeURIComponent(normalizedProductKey)}?lang=${encodeURIComponent(analyzerLang)}${versionQuery}`,
        { headers: { Accept: 'application/json' } },
    ).then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(payload?.error || 'Unable to load the synced ingredient analysis.');
        }
        const analysis = payload as AnalyzerResponse;
        productIngredientSnapshotCache.set(cacheKey, analysis);
        return analysis;
    }).finally(() => {
        productIngredientSnapshotRequests.delete(cacheKey);
    });

    productIngredientSnapshotRequests.set(cacheKey, request);
    return request;
}

function requestRawIngredientAnalysis(
    normalizedIngredients: string,
    analyzerLang: ReturnType<typeof getAnalyzerLanguage>,
) {
    const cacheKey = `${analyzerLang}:${normalizedIngredients}`;
    const cached = ingredientAnalysisCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const pending = ingredientAnalysisRequests.get(cacheKey);
    if (pending) return pending;

    const request = fetch('/api/ingredient-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inciText: normalizedIngredients, lang: analyzerLang }),
    }).then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || 'Unable to analyze this product right now.');
        }
        const analysis = payload as AnalyzerResponse;
        ingredientAnalysisCache.set(cacheKey, analysis);
        return analysis;
    }).finally(() => {
        ingredientAnalysisRequests.delete(cacheKey);
    });

    ingredientAnalysisRequests.set(cacheKey, request);
    return request;
}

function useProductIngredientAnalysis(
    productKey: number | string,
    ingredients?: string | null,
    sourceVersion?: string | null,
) {
    const { i18n } = useTranslation();
    const analyzerLang = getAnalyzerLanguage(i18n.language);
    const copy = productIngredientAnalysisCopy(i18n.language);
    const normalizedIngredients = useMemo(() => String(ingredients || '').trim(), [ingredients]);
    const normalizedProductKey = String(productKey || '').trim();
    const normalizedSourceVersion = String(sourceVersion || '').trim();
    const snapshotCacheKey = getProductIngredientSnapshotCacheKey(normalizedProductKey, analyzerLang, normalizedSourceVersion);
    const rawCacheKey = `${analyzerLang}:${normalizedIngredients}`;
    const cachedAnalysis = normalizedIngredients
        ? productIngredientSnapshotCache.get(snapshotCacheKey)
            || ingredientAnalysisCache.get(rawCacheKey)
            || null
        : null;
    const [analysis, setAnalysis] = useState<AnalyzerResponse | null>(() => cachedAnalysis);
    const [isLoading, setIsLoading] = useState(() => Boolean(normalizedIngredients && !cachedAnalysis));
    const [hasSettled, setHasSettled] = useState(() => !normalizedIngredients || Boolean(cachedAnalysis));
    const [error, setError] = useState('');

    useEffect(() => {
        if (!normalizedIngredients) {
            setAnalysis(null);
            setError('');
            setIsLoading(false);
            setHasSettled(true);
            return;
        }

        let isMounted = true;

        const analyzeProductIngredients = async () => {
            const cached = productIngredientSnapshotCache.get(snapshotCacheKey)
                || ingredientAnalysisCache.get(rawCacheKey);
            if (cached) {
                setAnalysis(cached);
                setError('');
                setIsLoading(false);
                setHasSettled(true);
                return;
            }

            setAnalysis(null);
            setIsLoading(true);
            setHasSettled(false);
            setError('');
            try {
                let payload: AnalyzerResponse | null = null;
                try {
                    payload = await prefetchProductIngredientAnalysis(normalizedProductKey, i18n.language, normalizedSourceVersion);
                } catch (snapshotError) {
                    console.warn('[product-ingredient-analysis] Synced snapshot unavailable; using live fallback.', snapshotError);
                }
                if (!payload) {
                    payload = await requestRawIngredientAnalysis(normalizedIngredients, analyzerLang);
                }
                if (isMounted) {
                    setAnalysis(payload);
                }
            } catch (err) {
                if (isMounted) {
                    setAnalysis(null);
                    setError(err instanceof Error ? err.message : copy.error);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setHasSettled(true);
                }
            }
        };

        analyzeProductIngredients();

        return () => {
            isMounted = false;
        };
    }, [analyzerLang, copy.error, i18n.language, normalizedIngredients, normalizedProductKey, normalizedSourceVersion, rawCacheKey, snapshotCacheKey]);

    return { analysis, isLoading, hasSettled, error, copy, normalizedIngredients, analyzerLang };
}

const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
    product,
    allProducts,
    allCategories,
    brands,
    allBlogPosts,
    allServices,
    onSelectProduct,
    onSelectPost,
    onSelectService,
    onOpenBrand,
    onBack,
    currentUser,
    focusReview = false,
}) => {
    const { t, i18n } = useTranslation();
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState('usage');
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [canReview, setCanReview] = useState<boolean | null>(null);
    const [isCheckingReviewEligibility, setIsCheckingReviewEligibility] = useState(false);
    const [isMobileDescriptionExpanded, setIsMobileDescriptionExpanded] = useState(false);
    const [hasInitialLoadDeadlineElapsed, setHasInitialLoadDeadlineElapsed] = useState(false);

    const localizedIngredientsRaw = getLocalizedValue(product, 'ingredients', i18n.language);
    const ingredientSourceVersion = product.updated_at || product.source_updated_at || '';
    const { analysis: ingredientAnalysis, isLoading: isLoadingIngredientAnalysis, hasSettled: hasIngredientAnalysisSettled, error: ingredientAnalysisError, copy: ingredientAnalysisCopy, normalizedIngredients, analyzerLang } = useProductIngredientAnalysis(product.slug || product.id, localizedIngredientsRaw, ingredientSourceVersion);
    const primaryImageUrl = product.images?.find((image) => image.is_primary)?.image_url || product.images?.[0]?.image_url || '';
    const [isPrimaryImageReady, setIsPrimaryImageReady] = useState(() => !primaryImageUrl);

    const { addToCart } = useCart();
    const { addToast } = useToast();

    const getLocalized = (obj: any, field: string): string => getLocalizedValue(obj, field, i18n.language);
    const getLocalizedArray = (obj: any, field: string): string[] => getLocalizedArrayValue(obj, field, i18n.language);
    const localizedName = getLocalized(product, 'name');
    const localizedDescription = getLocalized(product, 'description');
    const localizedIngredients = getLocalized(product, 'ingredients');
    const localizedUsage = getLocalized(product, 'usage_instructions');
    const localizedPrecautions = getLocalized(product, 'precautions');
    const localizedOrigin = getLocalized(product, 'origin');
    const localizedTexture = getLocalized(product, 'texture');
    const localizedKeyBenefits = getLocalizedArray(product, 'key_benefits');
    const trialProfileCopy = useMemo<TrialProfileCopy>(() => ({
        badgeTrial: t('products.badge_trial_detail', 'Mẫu thử / Trial size'),
        badgeDetail: t('products.badge_detail', 'Dermocosmetic detail'),
        usageEstimateSmall: t('products.usage_estimate_small', 'Khoảng 2-4 lần dùng'),
        usageEstimateMedium: t('products.usage_estimate_medium', 'Khoảng 4-7 lần dùng'),
        usageEstimateLarge: t('products.usage_estimate_large', 'Khoảng 7-14 lần dùng'),
    }), [t]);
    const trialProfile = useMemo(
        () => inferTrialProfile(localizedName, localizedDescription, product.volume, trialProfileCopy),
        [localizedDescription, localizedName, product.volume, trialProfileCopy]
    );
    const heroSummary = useMemo(() => {
        if (localizedDescription) return truncateTextContent(localizedDescription, 250);
        if (trialProfile.isTrial) {
            return truncateTextContent(
                t('products.hero_summary_trial', 'Phiên bản mẫu thử để khách hàng test texture, độ hợp da và cảm giác sử dụng trước khi chuyển sang size lớn.'),
                250
            );
        }
        return truncateTextContent(
            t('products.hero_summary_default', 'Trang chi tiết này được sắp lại theo hướng mua hàng rõ ràng hơn để khách xem nắm nhanh công dụng, cách dùng và bước tiếp theo trong routine.'),
            250
        );
    }, [localizedDescription, t, trialProfile.isTrial]);

    const category = allCategories.find(c => c.id === product.category_id);
    const matchedBrand = useMemo(
        () => brands.find((brand) => normalizeBrandMatchKey(brand.name) === normalizeBrandMatchKey(product.brand)) || null,
        [brands, product.brand]
    );
    const brandPanelCopy = useMemo(() => {
        const lang = i18n.language;
        if (lang.startsWith('en')) {
            return {
                label: 'Brand',
                viewBrand: 'Open brand page',
                fallback: `${product.brand} currently has products published at Thế Giới Trị Mụn.`,
            };
        }
        if (lang.startsWith('ru')) {
            return {
                label: 'Бренд',
                viewBrand: 'Открыть страницу бренда',
                fallback: `${product.brand} сейчас представлен товарами на Thế Giới Trị Mụn.`,
            };
        }
        if (lang.startsWith('cn') || lang.startsWith('zh')) {
            return {
                label: '品牌',
                viewBrand: '查看品牌介绍',
                fallback: `${product.brand} 当前在 Thế Giới Trị Mụn 已有上架商品。`,
            };
        }
        return {
            label: 'Thương hiệu',
            viewBrand: 'Xem hồ sơ thương hiệu',
            fallback: `${product.brand} hiện đang có các sản phẩm được phân phối trên Thế Giới Trị Mụn.`,
        };
    }, [i18n.language, product.brand]);
    const brandSnippet = useMemo(
        () => getBrandDescriptionSnippet(matchedBrand?.description, 220) || brandPanelCopy.fallback,
        [matchedBrand?.description, brandPanelCopy.fallback]
    );
    const detailCopy = useMemo(() => {
        const lang = i18n.language;
        if (lang.startsWith('en')) {
            return {
                audienceTitle: 'Best suited for',
                ingredientsTitle: 'Highlighted ingredients',
                usageTitle: 'Quick usage guidance',
                stockTitle: 'Stock status',
                stockIn: 'In stock',
                stockOut: 'Out of stock',
                quickFactsTitle: 'Quick product facts',
                tabKicker: 'Detailed product brief',
                faqKicker: 'Pre-purchase clarity',
                faqTitle: 'Questions buyers usually ask before checkout',
                faqSubtitle: 'These questions help buyers understand usage, ingredients, and key notes before checkout.',
                faqSubtitleManaged: 'These answers are maintained by the team specifically for this product.',
                faqSuitableQuestion: 'Who is this product best suited for?',
                faqSuitableLead: 'This product currently aligns best with',
                faqIngredientsQuestion: 'What ingredients or highlights stand out?',
                faqIngredientsLead: 'The current product profile highlights',
                faqUsageQuestion: 'How should it be used in a routine?',
                faqUsageLead: 'A quick usage direction from the current profile is',
                faqPrecautionsQuestion: 'Are there precautions before use?',
                faqTextureQuestion: 'What are the texture and origin details?',
            };
        }
        if (lang.startsWith('ru')) {
            return {
                audienceTitle: 'Кому подходит',
                ingredientsTitle: 'Ключевые ингредиенты',
                usageTitle: 'Как использовать',
                stockTitle: 'Наличие',
                stockIn: 'В наличии',
                stockOut: 'Нет в наличии',
                quickFactsTitle: 'Коротко о продукте',
                tabKicker: 'Подробная карточка товара',
                faqKicker: 'Перед покупкой',
                faqTitle: 'Частые вопросы перед добавлением в корзину',
                faqSubtitle: 'Этот FAQ помогает быстро понять, как использовать продукт, какие у него особенности и на что обратить внимание перед покупкой.',
                faqSubtitleManaged: 'Эти ответы команда поддерживает отдельно именно для этого продукта.',
                faqSuitableQuestion: 'Кому лучше всего подходит этот продукт?',
                faqSuitableLead: 'Сейчас продукт в первую очередь подходит для',
                faqIngredientsQuestion: 'Какие ингредиенты и акценты выделены?',
                faqIngredientsLead: 'В карточке сейчас выделены',
                faqUsageQuestion: 'Как использовать продукт в рутине?',
                faqUsageLead: 'Краткая рекомендация по применению сейчас выглядит так',
                faqPrecautionsQuestion: 'Есть ли меры предосторожности?',
                faqTextureQuestion: 'Какая у продукта текстура и происхождение?',
            };
        }
        if (lang.startsWith('cn') || lang.startsWith('zh')) {
            return {
                audienceTitle: '更适合哪些人',
                ingredientsTitle: '重点成分',
                usageTitle: '快速用法',
                stockTitle: '库存状态',
                stockIn: '现货',
                stockOut: '缺货',
                quickFactsTitle: '产品重点信息',
                tabKicker: '更详细的产品说明',
                faqKicker: '购买前问题',
                faqTitle: '下单前最常见的几个问题',
                faqSubtitle: '这些问答帮助你在购买前快速了解用法、成分重点和需要注意的地方。',
                faqSubtitleManaged: '这些问答由团队单独维护，专门用于这款产品。',
                faqSuitableQuestion: '这款产品更适合哪些人群？',
                faqSuitableLead: '根据当前资料，这款产品更适合',
                faqIngredientsQuestion: '产品有哪些重点成分或亮点？',
                faqIngredientsLead: '当前产品资料重点强调',
                faqUsageQuestion: '在日常护理中应如何使用？',
                faqUsageLead: '当前资料给出的快速用法是',
                faqPrecautionsQuestion: '使用前有什么需要注意？',
                faqTextureQuestion: '产品的质地和产地是什么？',
            };
        }
        return {
            audienceTitle: 'Phù hợp với ai',
            ingredientsTitle: 'Thành phần nổi bật',
            usageTitle: 'Cách dùng nhanh',
            stockTitle: 'Tình trạng kho',
            stockIn: 'Còn hàng',
            stockOut: 'Hết hàng',
            quickFactsTitle: 'Thông tin nhanh',
            tabKicker: 'Hồ sơ sản phẩm chi tiết',
            faqKicker: 'Hỏi nhanh trước khi mua',
            faqTitle: 'Các câu hỏi thường xuất hiện trước khi chốt đơn',
            faqSubtitle: 'Các câu hỏi dưới đây giúp bạn hiểu nhanh cách dùng, thành phần và lưu ý trước khi mua.',
            faqSubtitleManaged: 'FAQ này được đội ngũ cập nhật riêng cho sản phẩm để thông tin hiển thị nhất quán hơn.',
            faqSuitableQuestion: 'Sản phẩm này phù hợp với ai?',
            faqSuitableLead: 'Hiện sản phẩm phù hợp nhất với',
            faqIngredientsQuestion: 'Thành phần hoặc điểm nổi bật của sản phẩm là gì?',
            faqIngredientsLead: 'Những điểm nổi bật đang được nhấn mạnh gồm',
            faqUsageQuestion: 'Nên dùng sản phẩm như thế nào trong routine?',
            faqUsageLead: 'Cách dùng nhanh từ hồ sơ hiện tại là',
            faqPrecautionsQuestion: 'Có lưu ý gì trước khi dùng không?',
            faqTextureQuestion: 'Kết cấu và xuất xứ của sản phẩm ra sao?',
        };
    }, [i18n.language]);
    const audienceHighlights = useMemo(() => {
        const skinTypes = getLocalizedArray(product, 'skin_types');
        if (skinTypes.length > 0) return skinTypes.slice(0, 4);
        const benefits = getLocalizedArray(product, 'key_benefits');
        return benefits.slice(0, 4);
    }, [product, i18n.language]);
    const ingredientHighlights = useMemo(
        () => splitHighlights(localizedIngredients, 4),
        [localizedIngredients]
    );
    const usageHighlights = useMemo(
        () => splitHighlights(localizedUsage, 3),
        [localizedUsage]
    );
    const managedProductFaqs = useMemo<DetailFaqItem[]>(
        () => (i18n.language.startsWith('vi') ? sanitizeDetailFaqItems(product.faq_items) : []),
        [product.faq_items, i18n.language]
    );
    const derivedProductFaqs = useMemo<DetailFaqItem[]>(() => {
        const faqItems: DetailFaqItem[] = [];

        if (audienceHighlights.length > 0 || localizedDescription) {
            faqItems.push({
                question: detailCopy.faqSuitableQuestion,
                answer: audienceHighlights.length > 0
                    ? `${detailCopy.faqSuitableLead} ${audienceHighlights.join(', ')}.`
                    : localizedDescription,
            });
        }

        if (ingredientHighlights.length > 0 || localizedIngredients) {
            faqItems.push({
                question: detailCopy.faqIngredientsQuestion,
                answer: ingredientHighlights.length > 0
                    ? `${detailCopy.faqIngredientsLead} ${ingredientHighlights.join(', ')}.`
                    : localizedIngredients,
            });
        }

        if (usageHighlights.length > 0 || localizedUsage) {
            faqItems.push({
                question: detailCopy.faqUsageQuestion,
                answer: usageHighlights.length > 0
                    ? `${detailCopy.faqUsageLead} ${usageHighlights.join(', ')}.`
                    : localizedUsage,
            });
        }

        if (localizedPrecautions) {
            faqItems.push({
                question: detailCopy.faqPrecautionsQuestion,
                answer: localizedPrecautions,
            });
        }

        if (localizedTexture || localizedOrigin) {
            const answer = [localizedTexture, localizedOrigin].filter(Boolean).join(' • ');
            if (answer) {
                faqItems.push({
                    question: detailCopy.faqTextureQuestion,
                    answer,
                });
            }
        }

        return faqItems.slice(0, 5);
    }, [
        audienceHighlights,
        detailCopy,
        ingredientHighlights,
        localizedDescription,
        localizedIngredients,
        localizedOrigin,
        localizedPrecautions,
        localizedTexture,
        localizedUsage,
    ]);
    const productFaqs = managedProductFaqs.length > 0 ? managedProductFaqs : derivedProductFaqs;
    const faqSubtitleText = managedProductFaqs.length > 0 ? detailCopy.faqSubtitleManaged : detailCopy.faqSubtitle;
    const relatedProducts = useMemo(() => {
        return rankByTokenOverlap<Product>({
            items: allProducts.filter((candidate) => candidate.id !== product.id && candidate.is_published),
            lang: i18n.language,
            limit: 8,
            sourceParts: [
                getLocalized(product, 'name'),
                getLocalized(product, 'description'),
                getLocalized(product, 'ingredients'),
                getLocalizedArray(product, 'key_benefits'),
                getLocalizedArray(product, 'skin_types'),
                product.brand || '',
            ],
            getItemParts: (candidate) => [
                getLocalized(candidate, 'name'),
                getLocalized(candidate, 'description'),
                candidate.brand || '',
            ],
            getExtraScore: (candidate) => {
                let score = 0;
                if (candidate.category_id === product.category_id) score += 5;
                if (product.brand && candidate.brand && normalizeBrandMatchKey(candidate.brand) === normalizeBrandMatchKey(product.brand)) score += 3;
                return score;
            },
            sortTieBreaker: (a, b) => b.id - a.id,
        });
    }, [allProducts, product, i18n.language]);
    const fullSizeCandidate = useMemo(() => {
        const currentVolume = trialProfile.volumeDetails;
        return relatedProducts.find((candidate) => {
            if (candidate.category_id !== product.category_id) return false;
            if (product.brand && candidate.brand && normalizeBrandMatchKey(candidate.brand) !== normalizeBrandMatchKey(product.brand)) return false;

            const candidateVolume = extractVolumeDetails(getLocalized(candidate, 'name'), candidate.volume);
            const isLargerSameUnit =
                currentVolume.value !== null &&
                candidateVolume.value !== null &&
                currentVolume.unit &&
                candidateVolume.unit === currentVolume.unit &&
                candidateVolume.value > currentVolume.value;

            return isLargerSameUnit || candidate.price > product.price;
        }) || null;
    }, [getLocalized, product.brand, product.category_id, product.price, relatedProducts, trialProfile.volumeDetails]);

    const relatedBlogPosts = useMemo(() => {
        return rankByTokenOverlap<BlogPost>({
            items: allBlogPosts,
            lang: i18n.language,
            limit: 4,
            sourceParts: [
                getLocalized(product, 'name'),
                getLocalized(product, 'description'),
                getLocalized(product, 'ingredients'),
                getLocalizedArray(product, 'key_benefits'),
                getLocalizedArray(product, 'skin_types'),
            ],
            getItemParts: (candidate) => [
                getLocalized(candidate, 'title'),
                getLocalized(candidate, 'summary'),
                candidate.category_slug || '',
            ],
            requiredFields: ['title', 'summary'],
            sortTieBreaker: (a, b) => (b.date || '').localeCompare(a.date || ''),
        });
    }, [allBlogPosts, product, i18n.language]);

    const relatedServices = useMemo(() => {
        return rankByTokenOverlap<Service>({
            items: allServices,
            lang: i18n.language,
            limit: 4,
            sourceParts: [
                getLocalized(product, 'name'),
                getLocalized(product, 'description'),
                getLocalizedArray(product, 'key_benefits'),
                getLocalizedArray(product, 'skin_types'),
            ],
            getItemParts: (candidate) => [
                getLocalized(candidate, 'name'),
                getLocalized(candidate, 'description'),
                getLocalizedArray(candidate, 'benefits'),
            ],
            requiredFields: ['name', 'description'],
            sortTieBreaker: (a, b) => a.id - b.id,
        });
    }, [allServices, product, i18n.language]);
    const heroHighlights = useMemo(() => {
        const summaryHighlights = splitHighlights(localizedDescription, 5);
        return Array.from(new Set([...localizedKeyBenefits, ...summaryHighlights])).slice(0, 5);
    }, [localizedDescription, localizedKeyBenefits]);
    const routineUpsells = useMemo(() => {
        const selected: Array<{ product: Product; label: string; note: string }> = [];
        const usedProductIds = new Set<number>();

        if (fullSizeCandidate) {
            selected.push({
                product: fullSizeCandidate,
                label: trialProfile.isTrial ? t('products.full_size_label', 'Phiên bản full size') : t('products.related_featured', 'Gợi ý nổi bật'),
                note: trialProfile.isTrial
                    ? t('products.full_size_note', 'Khi đã hợp da và muốn nâng cấp routine hằng ngày.')
                    : t('products.related_featured_note', 'Gợi ý phù hợp để mở rộng routine hiện tại.'),
            });
            usedProductIds.add(fullSizeCandidate.id);
        }

        relatedProducts.forEach((candidate) => {
            if (selected.length >= 3 || usedProductIds.has(candidate.id)) return;
            selected.push({
                product: candidate,
                label: candidate.category_id === product.category_id
                    ? t('products.related_same_concern', 'Cùng concern')
                    : t('products.related_pairing', 'Bổ sung routine'),
                note: candidate.category_id === product.category_id
                    ? t('products.related_same_concern_note', 'Dành cho khách muốn so sánh thêm trước khi chốt đơn.')
                    : t('products.related_pairing_note', 'Một bước thêm vào routine để tăng giá trị giỏ hàng.'),
            });
            usedProductIds.add(candidate.id);
        });

        return selected.slice(0, 3);
    }, [fullSizeCandidate, product.category_id, relatedProducts, t, trialProfile.isTrial]);
    const fetchReviews = async () => {
        setIsLoadingReviews(true);
        try {
            const fetchedReviews = await api.getProductReviews(product.id);
            setReviews(fetchedReviews);
        } catch (error) {
            console.error("Failed to fetch reviews", error);
            addToast('Lỗi', { type: 'error', description: 'Không thể tải đánh giá sản phẩm.' });
        } finally {
            setIsLoadingReviews(false);
        }
    };

    const checkReviewEligibility = async () => {
        if (!currentUser?.profile.id) {
            setCanReview(null);
            setIsCheckingReviewEligibility(false);
            return;
        }

        setIsCheckingReviewEligibility(true);
        try {
            const eligible = await api.canReviewProduct(product.id, currentUser.profile.id);
            setCanReview(eligible);
        } catch (error) {
            console.error("Failed to check review eligibility", error);
            setCanReview(false);
        } finally {
            setIsCheckingReviewEligibility(false);
        }
    };

    const openReviewTab = (smoothScroll = true) => {
        setActiveTab('reviews');
        if (typeof window === 'undefined') return;
        const nextUrl = `${window.location.pathname}${window.location.search}#reviews-section`;
        window.history.replaceState(window.history.state, '', nextUrl);
        window.setTimeout(() => {
            document.getElementById('reviews-section')?.scrollIntoView({
                behavior: smoothScroll ? 'smooth' : 'auto',
                block: 'start',
            });
        }, 80);
    };

    const refreshReviewState = async () => {
        await Promise.all([fetchReviews(), checkReviewEligibility()]);
    };

    const verifiedReviews = useMemo(
        () => reviews.filter((review) => review.verified_purchase),
        [reviews]
    );
    const hasUserReviewed = Boolean(currentUser && reviews.some((review) => review.user_id === currentUser.profile.id));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const syncReviewTabFromHash = () => {
            const hash = window.location.hash.replace(/^#/, '');
            if (hash === 'reviews' || hash === 'reviews-section') {
                setActiveTab('reviews');
                window.setTimeout(() => {
                    document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
            }
        };

        syncReviewTabFromHash();
        window.addEventListener('hashchange', syncReviewTabFromHash);
        return () => window.removeEventListener('hashchange', syncReviewTabFromHash);
    }, [product.id]);

    useEffect(() => {
        void refreshReviewState();
        setQuantity(1);
        setIsMobileDescriptionExpanded(false);
        setHasInitialLoadDeadlineElapsed(false);
        if (typeof window === 'undefined' || !['#reviews', '#reviews-section'].includes(window.location.hash)) {
            setActiveTab('usage');
        }
    }, [product.id, currentUser?.profile.id]);

    useEffect(() => {
        const timer = window.setTimeout(() => setHasInitialLoadDeadlineElapsed(true), 5000);
        return () => window.clearTimeout(timer);
    }, [product.id]);

    useEffect(() => {
        if (!primaryImageUrl) {
            setIsPrimaryImageReady(true);
            return undefined;
        }

        let isMounted = true;
        setIsPrimaryImageReady(false);
        const image = new Image();
        const markReady = () => {
            if (isMounted) setIsPrimaryImageReady(true);
        };
        image.onload = markReady;
        image.onerror = markReady;
        image.src = primaryImageUrl;
        if (image.complete) markReady();

        return () => {
            isMounted = false;
            image.onload = null;
            image.onerror = null;
        };
    }, [primaryImageUrl, product.id]);

    useEffect(() => {
        // --- SEO: JSON-LD Product Schema ---
        const categorySlug = allCategories.find(c => c.id === product.category_id)?.slug || 'khac';
        const categoryName = allCategories.find(c => c.id === product.category_id)?.name || 'Sản phẩm';
        const canonicalPath = `/san-pham/${categorySlug}/${product.slug || product.id}`;
        const canonicalUrl = buildSeoUrl(canonicalPath, i18n.language);

        // JSON-LD Structured Data
        const primaryImage = product.images?.find(i => i.is_primary) || product.images?.[0];
        const allImageUrls = (product.images || [])
            .map((image) => image.image_url)
            .filter(Boolean);
        const seoKeywords = Array.from(new Set([
            product.brand,
            categoryName,
            ...audienceHighlights,
            ...ingredientHighlights,
            ...localizedKeyBenefits.slice(0, 6),
        ].filter(Boolean))).slice(0, 12).join(', ');
        const additionalProperty = [
            audienceHighlights.length > 0 ? {
                "@type": "PropertyValue",
                "name": detailCopy.audienceTitle,
                "value": audienceHighlights.join(', '),
            } : null,
            ingredientHighlights.length > 0 ? {
                "@type": "PropertyValue",
                "name": detailCopy.ingredientsTitle,
                "value": ingredientHighlights.join(', '),
            } : null,
            localizedTexture ? {
                "@type": "PropertyValue",
                "name": detailCopy.faqTextureQuestion,
                "value": localizedTexture,
            } : null,
        ].filter(Boolean);
        const reviewStructuredData = verifiedReviews
            .filter(review => review.comment || review.title)
            .slice(0, 5)
            .map(review => ({
                "@type": "Review",
                "author": {
                    "@type": "Person",
                    "name": review.author.name,
                },
                "datePublished": review.created_at,
                "name": review.title || undefined,
                "reviewBody": review.comment || undefined,
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": review.rating,
                    "bestRating": "5",
                    "worstRating": "1",
                },
            }));
        const jsonLd = {
            "@context": "https://schema.org/",
            "@id": `${canonicalUrl}#product`,
            "@type": "Product",
            "name": localizedName,
            "description": localizedDescription || '',
            "image": allImageUrls.length > 0 ? allImageUrls : primaryImage?.image_url || '',
            "url": canonicalUrl,
            "inLanguage": i18n.language.startsWith('zh') || i18n.language.startsWith('cn') ? 'zh' : i18n.language,
            "sku": product.sku || undefined,
            "category": categoryName,
            "keywords": seoKeywords || undefined,
            "mainEntityOfPage": canonicalUrl,
            "itemCondition": "https://schema.org/NewCondition",
            "brand": product.brand ? {
                "@type": "Brand",
                "name": product.brand,
                ...(matchedBrand ? { "url": buildSeoUrl(`/thuong-hieu/${matchedBrand.slug}`, i18n.language) } : {}),
            } : undefined,
            ...(localizedOrigin ? {
                "countryOfOrigin": {
                    "@type": "Country",
                    "name": localizedOrigin,
                }
            } : {}),
            ...(additionalProperty.length > 0 ? {
                "additionalProperty": additionalProperty,
            } : {}),
            "offers": {
                "@type": "Offer",
                "price": product.price || 0,
                "priceCurrency": "VND",
                "availability": product.stock_quantity > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": { "@type": "Organization", "name": "Thế Giới Trị Mụn", "url": "https://thegioitrimun.vn" },
                "url": canonicalUrl,
                ...(Number.isFinite(Number(product.stock_quantity)) ? {
                    "inventoryLevel": {
                        "@type": "QuantitativeValue",
                        "value": Math.max(Number(product.stock_quantity || 0), 0),
                    },
                } : {}),
            },
            ...(verifiedReviews.length > 0 ? {
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": (verifiedReviews.reduce((a, r) => a + r.rating, 0) / verifiedReviews.length).toFixed(1),
                    "reviewCount": verifiedReviews.length,
                    "bestRating": "5",
                    "worstRating": "1"
                }
            } : {}),
            ...(reviewStructuredData.length > 0 ? {
                "review": reviewStructuredData,
            } : {}),
        };

        // BreadcrumbList Structured Data
        const breadcrumbLd = {
            "@context": "https://schema.org/",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Trang chủ",
                    "item": buildSeoUrl('/', i18n.language)
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Sản phẩm",
                    "item": buildSeoUrl('/san-pham', i18n.language)
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": categoryName,
                    "item": buildSeoUrl(`/san-pham/${categorySlug}`, i18n.language)
                },
                {
                    "@type": "ListItem",
                    "position": 4,
                    "name": localizedName,
                    "item": canonicalUrl
                }
            ]
        };

        const faqLd = productFaqs.length > 0 ? {
            "@context": "https://schema.org/",
            "@type": "FAQPage",
            "mainEntity": productFaqs.map((item) => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer,
                },
            })),
        } : null;

        const finalJsonLd = [jsonLd, breadcrumbLd, ...(faqLd ? [faqLd] : [])];

        let scriptEl = document.getElementById('product-jsonld') as HTMLScriptElement | null;
        if (!scriptEl) {
            scriptEl = document.createElement('script');
            scriptEl.id = 'product-jsonld';
            scriptEl.type = 'application/ld+json';
            document.head.appendChild(scriptEl);
        }
        scriptEl.textContent = JSON.stringify(finalJsonLd);

        return () => {
            scriptEl?.remove();
        };
    }, [
        allCategories,
        audienceHighlights,
        detailCopy,
        i18n.language,
        ingredientHighlights,
        localizedDescription,
        localizedKeyBenefits,
        localizedName,
        localizedOrigin,
        localizedTexture,
        matchedBrand,
        product,
        productFaqs,
        verifiedReviews,
    ]);

    useEffect(() => {
        if (!focusReview) return;
        openReviewTab(true);
    }, [focusReview, product.id]);

    useEffect(() => {
        void api.trackFunnelEvent(
            'view_product',
            {
                product_id: product.id,
                product_slug: product.slug,
                price: product.price,
                stock_quantity: product.stock_quantity,
                category_id: product.category_id || null,
            },
            currentUser?.profile.id || null
        );
    }, [product.id, currentUser?.profile.id]);

    const averageRating = useMemo(() => {
        if (verifiedReviews.length === 0) return 0;
        const total = verifiedReviews.reduce((acc, review) => acc + review.rating, 0);
        return total / verifiedReviews.length;
    }, [verifiedReviews]);

    const handleAddToCart = () => {
        if (quantity > 0) {
            addToCart(product, quantity);
            addToast(`${t('products.add_to_cart')}: ${quantity} x ${getLocalized(product, 'name')}`, { type: 'success' });
        }
    };

    const tabs = [
        { key: 'usage', label: t('products.usage') },
        { key: 'reviews', label: `${t('products.reviews')} (${reviews.length})` },
    ];

    const renderSectionContent = (sectionKey: string) => {
        switch (sectionKey) {
            case 'description':
                return (product.long_description && product.long_description.length > 0)
                    ? <StructuredContent blocks={product.long_description} productName={getLocalized(product, 'name')} brandName={product.brand} />
                    : <div><MarkdownRenderer content={product.description} /></div>;
            case 'ingredients': return (
                <ProductIngredientAnalysis
                    ingredients={getLocalized(product, 'ingredients') || ''}
                    productName={getLocalized(product, 'name')}
                    analysis={ingredientAnalysis}
                    isLoading={isLoadingIngredientAnalysis}
                    error={ingredientAnalysisError}
                    copy={ingredientAnalysisCopy}
                    normalizedIngredients={normalizedIngredients}
                    analyzerLang={analyzerLang}
                />
            );
            case 'usage': return (
                <div>
                    <MarkdownRenderer content={getLocalized(product, 'usage_instructions') || t('products.updating')} className="mb-8" />
                    {getLocalized(product, 'precautions') && (
                        <div className="rounded-[24px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,248,232,0.96),rgba(255,252,245,0.98))] p-5 text-amber-950 shadow-[0_24px_50px_-42px_rgba(120,82,14,0.42)] dark:border-amber-300/20 dark:bg-[linear-gradient(180deg,rgba(45,31,11,0.92),rgba(31,23,13,0.98))] dark:text-amber-100 dark:shadow-[0_28px_56px_-40px_rgba(0,0,0,0.62)]">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-300/14 dark:text-amber-200">
                                    <InformationCircleIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-black tracking-[-0.02em] text-amber-950 dark:text-amber-100">{t('products.precautions')}</h4>
                                    <p className="mt-2 text-sm leading-7 text-amber-900/90 dark:text-amber-100/88 md:text-[15px]">{getLocalized(product, 'precautions')}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
            case 'reviews':
                return (
                    <ReviewsSection
                        reviews={reviews}
                        verifiedReviewCount={verifiedReviews.length}
                        isLoading={isLoadingReviews}
                        product={product}
                        currentUser={currentUser}
                        canReview={canReview}
                        isCheckingEligibility={isCheckingReviewEligibility}
                        onReviewSubmitted={refreshReviewState}
                    />
                );
            default: return null;
        }
    };

    const isInitialProductContentLoading = !hasInitialLoadDeadlineElapsed && (
        isLoadingReviews
        || !hasIngredientAnalysisSettled
        || !isPrimaryImageReady
    );

    if (isInitialProductContentLoading) {
        return <ProductDetailLoadingShell />;
    }

    return (
        <div data-no-scroll-reveal className="product-detail-page bg-background text-foreground transition-colors duration-300">
            <div className="product-detail-shell container mx-auto md:px-6 md:pb-16 md:pt-8">
                <div className="product-detail-mobile-commerce md:hidden bg-white dark:bg-background pt-5">
                    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[13px] text-muted-foreground overflow-hidden">

                        <button onClick={onBack} className="shrink-0 transition-colors hover:text-foreground">
                            {category ? getLocalized(category, 'name') : t('products.title')}
                        </button>
                        <span className="shrink-0">/</span>
                        <span className="truncate font-medium text-foreground" title={localizedName}>
                            {localizedName.length > 40 ? localizedName.substring(0, 40).trim() + '...' : localizedName}
                        </span>
                    </nav>

                    <section className="product-mobile-media" aria-label={t('products.image_gallery', 'Hình ảnh sản phẩm')}>
                        <ProductImageGallery product={product} productName={localizedName} />
                    </section>

                    <section className="product-mobile-summary-card">
                        {product.brand && <p className="product-mobile-brand text-center">{product.brand}</p>}
                        <h1 className="product-mobile-title text-center">{localizedName}</h1>

                        <div className="product-mobile-meta-row">
                            {verifiedReviews.length > 0 ? (
                                <div className="flex items-center gap-1.5 text-amber-500">
                                    <StarRating rating={averageRating} />
                                    <span className="text-xs font-bold text-muted-foreground">{verifiedReviews.length}</span>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-muted-foreground">{t('products.no_verified_reviews', 'Chưa có review xác minh')}</span>
                            )}
                            <span className={`product-mobile-stock ${product.stock_quantity > 0 ? 'is-in-stock' : 'is-out-stock'}`}>
                                {product.stock_quantity > 0 ? detailCopy.stockIn : detailCopy.stockOut}
                            </span>
                        </div>

                        <p className="product-mobile-description">{heroSummary}</p>

                        <div className="product-mobile-price-row">
                            <p className="product-mobile-price">{formatCurrency(product.price)}</p>
                        </div>

                        <div className="product-mobile-variant-panel text-center">
                            <p className="product-mobile-panel-label text-center">{detailCopy.quickFactsTitle}</p>
                            <div className="product-mobile-chip-row justify-center">
                                {product.volume && <span className="product-mobile-chip">{product.volume}</span>}
                                {trialProfile.usageEstimate && <span className="product-mobile-chip">{trialProfile.usageEstimate}</span>}
                                {localizedOrigin && <span className="product-mobile-chip">{localizedOrigin}</span>}
                                {localizedTexture && <span className="product-mobile-chip">{localizedTexture}</span>}
                            </div>
                        </div>

                        {ingredientAnalysis?.quick_checks ? (
                            <IngredientQuickNotes analysis={ingredientAnalysis} labels={ingredientAnalysisCopy} className="!p-0 !mt-2 !mb-2 !shadow-none !bg-transparent dark:!bg-transparent !border-0 dark:!border-0" />
                        ) : null}

                        <div className="product-mobile-buybox">
                            <div className="product-mobile-qty" aria-label={t('cart.quantity', 'Số lượng')}>
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="btn-press" aria-label={t('cart.decrease')}>
                                    <MinusIcon className="h-4 w-4" />
                                </button>
                                <span>{quantity}</span>
                                <button onClick={() => setQuantity(q => Math.min(Math.max(product.stock_quantity, 1), q + 1))} className="btn-press" aria-label={t('cart.increase')}>
                                    <PlusIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <button onClick={handleAddToCart} className="product-mobile-add btn-press" disabled={product.stock_quantity === 0}>
                                <ShoppingBagIcon className="h-5 w-5" />
                                {product.stock_quantity > 0 ? t('products.add_to_cart') : t('products.out_of_stock')}
                            </button>
                        </div>


                    </section>

                    <section className="product-mobile-section product-mobile-section--description mt-6">
                        <h2 className="text-xl font-bold text-foreground mb-4 text-center">Chi tiết sản phẩm</h2>
                        


                        <div className="relative">
                            <div className={`overflow-hidden transition-all duration-500 ${!isMobileDescriptionExpanded ? 'max-h-[300px]' : ''}`}>
                                <div className="product-mobile-prose">
                                    {renderSectionContent('description')}
                                </div>
                            </div>
                            
                            {!isMobileDescriptionExpanded && (
                                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-background dark:via-background/95" />
                            )}
                            
                            <div className={`flex justify-center ${!isMobileDescriptionExpanded ? 'mt-[-1.5rem] relative z-10' : 'mt-6'}`}>
                                <button
                                    onClick={() => setIsMobileDescriptionExpanded(!isMobileDescriptionExpanded)}
                                    className="rounded-lg border border-[#e22d2d] text-[#e22d2d] bg-white px-6 py-2.5 text-sm font-semibold transition-colors active:bg-[#e22d2d]/5 dark:bg-transparent dark:border-[#ff5252] dark:text-[#ff5252]"
                                >
                                    {isMobileDescriptionExpanded ? 'Thu gọn nội dung' : 'Xem thêm nội dung'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="product-mobile-section">
                        <h2 className="text-center">{t('products.ingredients')}</h2>
                        <div className="product-mobile-prose">
                            {renderSectionContent('ingredients')}
                        </div>
                    </section>

                    <section className="product-mobile-section">
                        <h2 className="text-center">{t('products.usage')}</h2>
                        <div className="product-mobile-prose">
                            <MarkdownRenderer content={localizedUsage || t('products.updating')} />
                        </div>
                        {localizedPrecautions && (
                            <div className="product-mobile-note">
                                <InformationCircleIcon className="h-5 w-5" />
                                <p>{localizedPrecautions}</p>
                            </div>
                        )}
                    </section>

                    {relatedServices.length > 0 && (
                        <section className="product-mobile-section">
                            <p className="product-mobile-section-kicker text-center">{t('products.related_services_kicker', 'Điều trị liên quan')}</p>
                            <h2 className="text-center">{t('products.related_services', 'Dịch vụ liên quan')}</h2>
                            <div className="product-mobile-related-list">
                                {relatedServices.slice(0, 3).map((service) => (
                                    <button key={service.id} type="button" onClick={() => onSelectService(service.id)} className="product-mobile-related-item btn-press">
                                        <FallbackPublicImage
                                            loading="lazy"
                                            src={service.image_url || 'https://placehold.co/120x120'}
                                            alt={getLocalized(service, 'name')}
                                            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                                        />
                                        <span>
                                            <strong>{getLocalized(service, 'name')}</strong>
                                            <small>{getLocalized(service, 'description')}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {productFaqs.length > 0 && (
                        <section className="product-mobile-section">
                            <p className="product-mobile-section-kicker text-center">{detailCopy.faqKicker}</p>
                            <h2 className="text-center">{detailCopy.faqTitle}</h2>
                            <p className="product-mobile-section-lead">{faqSubtitleText}</p>
                            <div className="product-mobile-faq-list">
                                {productFaqs.map((item, index) => (
                                    <details key={`${item.question}-mobile-${index}`} open={index === 0} className="product-mobile-faq">
                                        <summary>
                                            <span>{item.question}</span>
                                            <ChevronDownIcon className="h-4 w-4" />
                                        </summary>
                                        <p>{item.answer}</p>
                                    </details>
                                ))}
                            </div>
                        </section>
                    )}

                    {relatedBlogPosts.length > 0 && (
                        <section className="product-mobile-section">
                            <h2 className="text-center">{t('products.related_posts', 'Bài viết liên quan')}</h2>
                            <div className="product-mobile-related-list">
                                {relatedBlogPosts.slice(0, 3).map((post) => (
                                    <button key={post.slug} type="button" onClick={() => onSelectPost(post.slug, post.category_slug)} className="product-mobile-related-item btn-press">
                                        <FallbackBlogImage
                                            loading="lazy"
                                            slug={post.slug}
                                            src={post.image_url}
                                            alt={getLocalized(post, 'title')}
                                            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                                        />
                                        <span>
                                            <strong>{getLocalized(post, 'title')}</strong>
                                            <small>{getLocalized(post, 'summary')}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="product-mobile-section">
                        <h2 className="text-center">{`${t('products.reviews')} (${reviews.length})`}</h2>
                        <div className="product-mobile-prose product-mobile-reviews">
                            {renderSectionContent('reviews')}
                        </div>
                    </section>
                </div>

                <nav aria-label="Breadcrumb" className="product-detail-breadcrumb mb-6 flex items-center gap-2 text-sm text-muted-foreground overflow-hidden md:mb-8">
                    <button onClick={onBack} className="shrink-0 transition-colors hover:text-foreground hover:underline">
                        {category ? getLocalized(category, 'name') : t('products.title')}
                    </button>
                    <span className="shrink-0">/</span>
                    <span className="truncate font-medium text-foreground" title={localizedName}>
                        {localizedName.length > 40 ? localizedName.substring(0, 40).trim() + '...' : localizedName}
                    </span>
                </nav>

                <section className="product-detail-hero grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:gap-8 xl:gap-10">
                    <div className="space-y-4">
                        <ProductImageGallery product={product} productName={localizedName} />
                    </div>

                    <div>
                        <div className="lg:sticky lg:top-24 product-detail-buy-panel surface-panel overflow-hidden p-5 md:p-7">
                            <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[2.1rem] lg:text-[2.5rem]">
                                {localizedName}
                            </h1>

                            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
                                {heroSummary}
                            </p>

                            {trialProfile.usageEstimate && (
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <span className="utility-pill px-3 py-1.5 text-xs font-semibold text-foreground">
                                        {trialProfile.usageEstimate}
                                    </span>
                                </div>
                            )}

                            <div className="mt-5 flex flex-wrap items-end gap-3">
                                <p className="text-3xl font-extrabold tracking-[-0.03em] text-primary md:text-4xl">{formatCurrency(product.price)}</p>
                                {product.volume && (
                                    <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm dark:border-white/10 dark:bg-accent">
                                        {product.volume}
                                    </span>
                                )}
                            </div>

                            {ingredientAnalysis?.quick_checks ? (
                                <IngredientQuickNotes analysis={ingredientAnalysis} labels={ingredientAnalysisCopy} className="!p-0 !mt-6 !mb-2 !shadow-none !bg-transparent dark:!bg-transparent !border-0 dark:!border-0" />
                            ) : null}

                            <div className="mt-6 p-4 md:p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                    <div className="flex items-center rounded-full border border-input bg-white p-1 shadow-sm dark:border-white/10 dark:bg-accent">
                                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="rounded-full p-2 transition-colors hover:bg-accent btn-press" aria-label={t('cart.decrease')}><MinusIcon className="h-5 w-5" /></button>
                                        <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                                        <button onClick={() => setQuantity(q => Math.min(Math.max(product.stock_quantity, 1), q + 1))} className="rounded-full p-2 transition-colors hover:bg-accent btn-press" aria-label={t('cart.increase')}><PlusIcon className="h-5 w-5" /></button>
                                    </div>
                                    <button onClick={handleAddToCart} className="flex min-h-[56px] w-full flex-1 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-black text-primary-foreground shadow-[0_20px_38px_-28px_rgba(26,51,29,0.8)] transition-all-smooth hover:-translate-y-0.5 hover:bg-primary/92 btn-press disabled:cursor-not-allowed disabled:bg-muted" disabled={product.stock_quantity === 0}>
                                        <ShoppingBagIcon className="h-5 w-5" />
                                        {product.stock_quantity > 0 ? t('products.add_to_cart') : t('products.out_of_stock')}
                                    </button>
                                </div>

                                {trialProfile.isTrial ? (
                                    <p className="mt-4 text-xs leading-6 text-muted-foreground">
                                        {t('products.sample_note', 'Mẫu thử phù hợp để kiểm tra độ hợp da, texture và trải nghiệm trước khi chuyển sang size lớn.')}
                                    </p>
                                ) : null}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5 text-sm">
                                {product.sku && <p className="text-muted-foreground">{t('products.sku_label', 'SKU')}: <span className="font-semibold text-foreground">{product.sku}</span></p>}
                                {localizedOrigin && <p className="text-muted-foreground">{t('products.origin')}: <span className="font-semibold text-foreground">{localizedOrigin}</span></p>}
                                {localizedTexture && <p className="text-muted-foreground">{t('products.texture', 'Kết cấu')}: <span className="font-semibold text-foreground">{localizedTexture}</span></p>}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="product-detail-detail-grid mt-10 grid gap-8">
                    <div className="space-y-8">
                        <section data-scroll-reveal="off" className="product-detail-content-panel surface-panel p-5 md:p-8">


                            <div className="mt-8 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(310px,1fr)] xl:gap-8">
                                <article className="product-detail-description-column min-w-0">
                                    <p className="section-kicker">{detailCopy.tabKicker}</p>
                                    <h3 className="text-xl font-black tracking-[-0.03em] text-foreground md:text-2xl">{t('products.description')}</h3>
                                    <div className="mt-5 min-w-0">
                                        {renderSectionContent('description')}
                                    </div>
                                </article>

                                <CompactIngredientSummary
                                    analysis={ingredientAnalysis}
                                    isLoading={isLoadingIngredientAnalysis}
                                    error={ingredientAnalysisError}
                                    copy={ingredientAnalysisCopy}
                                    normalizedIngredients={normalizedIngredients}
                                    analyzerLang={analyzerLang}
                                />
                            </div>

                            <div className="mt-8">
                                <nav className="-mb-px flex gap-2 overflow-x-auto pb-1 sm:gap-4" aria-label="Tabs">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`${activeTab === tab.key
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                                                } shrink-0 whitespace-nowrap rounded-t-2xl border-b-2 px-3 py-4 text-sm font-semibold transition-colors focus:outline-none`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                            <div className="py-8 md:py-10">
                                {renderSectionContent(activeTab)}
                            </div>
                        </section>

                        {relatedServices.length > 0 && (
                            <AnimatedSection>
                                <div className="surface-panel p-5 md:p-8">
                                    <p className="section-kicker">{t('products.related_services_kicker', 'Điều trị liên quan')}</p>
                                    <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground md:text-3xl">{t('products.related_services', 'Dịch vụ liên quan')}</h3>
                                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                                        {t('products.related_services_hint', 'Nếu bạn cần một phác đồ mạnh hơn sản phẩm đơn lẻ, đây là các dịch vụ có liên hệ trực tiếp với nhu cầu hiện tại.')}
                                    </p>
                                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {relatedServices.slice(0, 3).map((service) => (
                                            <button
                                                key={service.id}
                                                type="button"
                                                onClick={() => onSelectService(service.id)}
                                                className="group flex flex-col overflow-hidden rounded-[24px] bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-card"
                                            >
                                                <FallbackPublicImage
                                                    loading="lazy"
                                                    src={service.image_url || 'https://placehold.co/160x160'}
                                                    alt={getLocalized(service, 'name')}
                                                    className="aspect-[4/3] w-full shrink-0 object-cover"
                                                />
                                                <div className="min-w-0 p-5">
                                                    <p className="text-base font-black leading-tight text-foreground line-clamp-2">{getLocalized(service, 'name')}</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">{getLocalized(service, 'description')}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </AnimatedSection>
                        )}

                        {productFaqs.length > 0 && (
                            <AnimatedSection>
                                <div className="surface-panel p-5 md:p-8">
                                    <p className="section-kicker">{detailCopy.faqKicker}</p>
                                    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground md:text-3xl">{detailCopy.faqTitle}</h2>
                                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{faqSubtitleText}</p>
                                    <div className="mt-6 space-y-3">
                                        {productFaqs.map((item, index) => (
                                            <details
                                                key={`${item.question}-${index}`}
                                                open={index === 0}
                                                className="group rounded-[22px] border border-border bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-card"
                                            >
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                                                    <span className="text-sm font-black text-foreground md:text-base">{item.question}</span>
                                                    <span className="action-icon-chip h-10 w-10 shrink-0 transition-transform group-open:rotate-180">
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    </span>
                                                </summary>
                                                <p className="mt-4 pr-2 text-sm leading-7 text-muted-foreground md:text-base">{item.answer}</p>
                                            </details>
                                        ))}
                                    </div>
                                </div>
                            </AnimatedSection>
                        )}
                    </div>

                    <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                        {currentUser && !hasUserReviewed && canReview && (
                            <section className="surface-panel p-5 md:p-6">
                                <p className="text-sm font-semibold text-primary">{t('products.review_prompt_title', 'Bạn đã mua sản phẩm này')}</p>
                                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                    {t('products.review_prompt_description', 'Đánh giá thực tế của bạn giúp trang sản phẩm mạnh hơn về độ tin cậy và hỗ trợ khách hàng khác quyết định nhanh hơn.')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => openReviewTab(true)}
                                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 btn-press"
                                >
                                    <span>{t('orders.review_product', 'Viết đánh giá')}</span>
                                    <ArrowRightIcon className="h-4 w-4" />
                                </button>
                            </section>
                        )}
                    </aside>
                </div>

                {routineUpsells.length > 0 && (
                    <AnimatedSection className="product-detail-desktop-only mt-16">
                        <p className="section-kicker">{t('products.routine_upsell_kicker', 'Gợi ý mua kèm')}</p>
                        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-foreground">{t('products.routine_upsell_title', 'Mua kèm để đủ routine hoặc nâng cấp lên full size')}</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                            {t('products.routine_upsell_subtitle', 'Những lựa chọn này giúp bạn hoàn thiện routine hoặc chuyển sang dung tích lớn hơn khi đã hợp da.')}
                        </p>
                        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {routineUpsells.map(({ product: relatedProduct, label }) => (
                                <article
                                    key={relatedProduct.id}
                                    onClick={() => onSelectProduct(relatedProduct.id, relatedProduct.category?.slug || relatedProduct.category_slug)}
                                    className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[1.75rem] border-0 bg-card/60 p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.07)] backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1.5 hover:bg-card/90 hover:shadow-[0_28px_60px_-20px_rgba(41,149,130,0.2)] dark:bg-card/30 dark:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.5)] dark:hover:bg-card/50"
                                >
                                    {/* Top Area: Image + Product Meta */}
                                    <div className="flex items-center gap-3.5">
                                        {/* Product Image Square with rounded corners and shadow */}
                                        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl bg-white p-2 shadow-md dark:bg-card sm:w-28">
                                            <FallbackPublicImage
                                                loading="eager"
                                                src={relatedProduct.images?.[0]?.image_url || 'https://placehold.co/600x600'}
                                                alt={getLocalized(relatedProduct, 'name')}
                                                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </div>

                                        {/* Meta & Title */}
                                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                                            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                                                {label}
                                            </span>
                                            <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                                                {getLocalized(relatedProduct, 'name')}
                                            </h3>
                                            <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                                                {[relatedProduct.brand, relatedProduct.volume].filter(Boolean).join(' • ')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bottom: Price + Action Button */}
                                    <div className="mt-4 flex items-center justify-between pt-1">
                                        <p className="text-base font-black text-foreground transition-colors group-hover:text-primary">
                                            {formatCurrency(relatedProduct.price)}
                                        </p>
                                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md">
                                            <span>{t('products.view_product', 'Xem sản phẩm')}</span>
                                            <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </AnimatedSection>
                )}

                {relatedBlogPosts.length > 0 && (
                    <AnimatedSection className="product-detail-desktop-only mt-12">
                        <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground">{t('products.related_posts', 'Bài viết liên quan')}</h3>
                        <p className="mb-6 mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                            {t('products.related_posts_hint', 'Các bài này bổ sung bối cảnh điều trị, hướng dẫn dùng và giải thích thêm về vấn đề da mà sản phẩm đang hỗ trợ.')}
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {relatedBlogPosts.slice(0, 3).map(post => (
                                <article
                                    key={post.slug}
                                    onClick={() => onSelectPost(post.slug, post.category_slug)}
                                    className="editorial-card group overflow-hidden cursor-pointer"
                                >
                                    <div className="aspect-[1.4/1] overflow-hidden bg-white dark:bg-accent">
                                        <FallbackBlogImage loading="lazy" slug={post.slug} src={post.image_url} alt={getLocalized(post, 'title')} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-sm font-black line-clamp-2 transition-colors group-hover:text-primary">{getLocalized(post, 'title')}</h4>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </AnimatedSection>
                )}

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/96 px-4 py-3 backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{detailCopy.stockTitle}</p>
                            <p className="mt-1 text-base font-black text-primary">{formatCurrency(product.price)}</p>
                        </div>
                        <div className="flex items-center rounded-full border border-input bg-white p-1 shadow-sm dark:border-white/10 dark:bg-accent">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.decrease')}><MinusIcon className="w-4 h-4" /></button>
                            <span className="w-9 text-center text-sm font-semibold">{quantity}</span>
                            <button onClick={() => setQuantity(q => Math.min(Math.max(product.stock_quantity, 1), q + 1))} className="p-2 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.increase')}><PlusIcon className="w-4 h-4" /></button>
                        </div>
                        <button onClick={handleAddToCart} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_16px_34px_-26px_rgba(26,51,29,0.82)] transition-all-smooth hover:bg-primary/92 btn-press disabled:bg-muted disabled:cursor-not-allowed" disabled={product.stock_quantity === 0}>
                            {product.stock_quantity > 0 ? t('products.add_to_cart') : t('products.out_of_stock')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;
