import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowRightIcon,
    CheckIcon,
    ChevronDownIcon,
    InformationCircleIcon,
    LoadingIcon,
    SearchIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from './icons';
import { useBiDirectionalSticky } from '../hooks/useBiDirectionalSticky';

export type AnalyzerLanguage = 'vi' | 'en';
export type EwgBucket = 'low' | 'moderate' | 'high' | 'unknown';

export interface AnalyzerIngredient {
    position: number;
    raw_name: string;
    recognized: boolean;
    id: string | null;
    url?: string;
    inci_name: string;
    vi_name?: string;
    ewg_score: string | null;
    ewg_bucket: EwgBucket;
    cir_rating?: string;
    functions: string[];
    description?: string;
    flags?: Record<string, boolean>;
}

export interface AnalyzerEffect {
    label: string;
    icon?: string;
    count: number;
    ingredients: string[];
    negative?: boolean;
}

export interface AnalyzerSkinRow {
    label: string;
    icon?: string;
    good: string[];
    bad: string[];
    score: number;
}

export interface AnalyzerCheck {
    label: string;
    passed: boolean;
    title: string;
}

export interface AnalyzerResponse {
    summary: {
        total: number;
        recognized: number;
        unrecognized: number;
        recognition_rate: number;
    };
    safety_score: number;
    verdict: string;
    quick_checks: Record<string, AnalyzerCheck>;
    ewg: Record<EwgBucket, number>;
    effects: AnalyzerEffect[];
    skin: AnalyzerSkinRow[];
    ingredients: AnalyzerIngredient[];
    concerns: Array<{ id: string; inci_name: string; ewg_score?: string | null; reasons: string[] }>;
    unrecognized: string[];
    meta?: {
        source?: string;
        matched_rows?: number;
        lang?: string;
    };
}

const DEMO_INCI = 'Water, Glycerin, Butylene Glycol, Sodium Hyaluronate, Centella Asiatica Extract, Alcohol Denat., Phenoxyethanol, Retinyl Palmitate';

const copy = {
    vi: {
        title: 'Phân tích thành phần mỹ phẩm',
        subtitle: 'Dán bảng thành phần INCI để kiểm tra mức rủi ro EWG, ghi chú nhanh và mức phù hợp theo loại da.',
        disclaimer: 'Công cụ này hỗ trợ đọc thành phần, không thay thế tư vấn của bác sĩ da liễu.',
        placeholder: 'Ví dụ: Water, Glycerin, Butylene Glycol, Sodium Hyaluronate...',
        analyze: 'Phân tích ngay',
        sample: 'Dùng mẫu thử',
        clear: 'Xóa',
        safety: 'Độ an toàn',
        recognized: 'thành phần được nhận diện',
        riskDistribution: 'Đánh giá nguy cơ theo từng thành phần',
        totalIngredients: 'Tổng thành phần',
        tapDetails: 'Chạm để xem chi tiết',
        low: 'Thấp',
        moderate: 'Trung bình',
        high: 'Cao',
        unknown: 'Chưa rõ',
        quickNotes: 'Ghi chú nhanh',
        effects: 'Tác dụng & thành phần đáng chú ý',
        skin: 'Phù hợp với loại da',
        skinHint: 'chạm vào loại da để xem thành phần',
        estimated: 'ước tính từ chức năng thành phần',
        ingredientList: 'Danh sách thành phần',
        lowerHazard: 'Nguy cơ thấp',
        higherHazard: 'Nguy cơ cao',
        all: 'Tất cả',
        concernTitle: 'Thành phần cần lưu ý',
        noConcerns: 'Chưa có thành phần rủi ro cao nổi bật.',
        noFilterResults: 'Không có thành phần trong nhóm này.',
        good: 'Tốt',
        bad: 'Cần lưu ý',
        goodFor: 'Tốt cho',
        cautionFor: 'Cần lưu ý cho',
        notSuitableFor: 'Không phù hợp cho',
        fungalAcneNote: 'Cần lưu ý với mụn nấm',
        dryingAlcoholNote: 'Cồn khô',
        fragranceNote: 'Hương liệu',
        highEwgNote: 'EWG cao',
        total: 'tổng',
        functions: 'Chức năng mỹ phẩm',
        notes: 'Ghi chú',
        ewg: 'EWG',
        cir: 'CIR',
        ingredient: 'Tên thành phần & chức năng mỹ phẩm',
        failed: 'Cần lưu ý',
        passed: 'Đạt',
        notRecognized: 'Chưa nhận diện',
        errorFallback: 'Không thể phân tích lúc này. Vui lòng thử lại sau.',
        emptyError: 'Vui lòng nhập bảng thành phần cần phân tích.',
    },
    en: {
        title: 'Cosmetic ingredient analyzer',
        subtitle: 'Paste an INCI list to review EWG risk, quick notes, and skin-type fit.',
        disclaimer: 'This tool helps read ingredients and does not replace dermatology advice.',
        placeholder: 'Example: Water, Glycerin, Butylene Glycol, Sodium Hyaluronate...',
        analyze: 'Analyze',
        sample: 'Use sample',
        clear: 'Clear',
        safety: 'Safety',
        recognized: 'ingredients recognised',
        riskDistribution: 'Ingredient risk distribution',
        totalIngredients: 'Total ingredients',
        tapDetails: 'Tap for details',
        low: 'Low',
        moderate: 'Moderate',
        high: 'High',
        unknown: 'Unknown',
        quickNotes: 'Quick notes',
        effects: 'Notable effects & ingredients',
        skin: 'Ingredients related to skin types',
        skinHint: 'tap a skin type to see which ingredients',
        estimated: 'estimated from ingredient functions',
        ingredientList: 'Ingredients list',
        lowerHazard: 'Lower hazard',
        higherHazard: 'Higher hazard',
        all: 'All',
        concernTitle: 'Ingredients to review',
        noConcerns: 'No major high-risk ingredients found.',
        noFilterResults: 'No ingredients in this group.',
        good: 'Good',
        bad: 'Bad',
        goodFor: 'Good for',
        cautionFor: 'Caution for',
        notSuitableFor: 'Bad for',
        fungalAcneNote: 'Fungal acne caution',
        dryingAlcoholNote: 'Drying alcohol',
        fragranceNote: 'Fragrance',
        highEwgNote: 'High EWG',
        total: 'total',
        functions: 'Cosmetic functions',
        notes: 'Notes',
        ewg: 'EWG',
        cir: 'CIR',
        ingredient: 'Ingredient name & cosmetic functions',
        failed: 'Review',
        passed: 'Pass',
        notRecognized: 'Not recognised',
        errorFallback: 'Unable to analyze right now. Please try again later.',
        emptyError: 'Please enter an ingredient list to analyze.',
    },
};

const riskColors: Record<EwgBucket, string> = {
    low: '#7bd96b',
    moderate: '#f5bf5c',
    high: '#ec6370',
    unknown: '#c2c8ce',
};

const quickCheckIcons: Record<string, string> = {
    paraben_free: '/ingredient-assets/paraben-16d7c414aafce144a46ada3b8936e35050c649c862e924f98ea7456487940a87.png.webp',
    sulfate_free: '/ingredient-assets/Sulfate-4180eaf83f345a8039a62de294418d3b7825a8caad933b9165cf21bc1e635309.png',
    alcohol_free: '/ingredient-assets/Alcohol-9612c0e4eb199638c20f33c5698d8bba5c9868c71ff5fa34ab28d58b7c2aded5.png',
    silicone_free: '/ingredient-assets/Silicone-46ef373bf64d9a4f2b3e5518c40df82da0ace864c32a5fecd2ee755047a63c14.png',
    fungal_acne_safe: '/ingredient-assets/Fungal Acne-303132951c23041148bf8b470a73587ff7bbe32d056a2d7abcbc40636e9fd1cb.png',
    eu_allergen_free: '/ingredient-assets/allergens-e08632c125092eef6eeb3b5815b923140498b1464bb0c18c2f3798960541914e.png.webp',
    fragrance_free: '/ingredient-assets/9976718.png.webp',
};

const badSkinIcons: Record<string, string> = {
    'Da khô': '/ingredient-assets/Bad for Dry Skin-4ae6694f0184400041f697185175d3ed0b65cbbfb87c8b2161a198692633abaf.png',
    'Da dầu': '/ingredient-assets/Bad for Oily Skin-17953d1fed3bb5b7a3913e46e38252ea2bfd4cfe0ed929e0eb5105f98241e9f9.png',
    'Da nhạy cảm': '/ingredient-assets/Bad for Sensitive Skin-9030c363dfaffc8431fca55737f9ac531d6739542a9417d7aa993c16016a2d91.png',
};

const cirTone: Record<string, string> = {
    A: 'bg-[#8ddbd8] text-white shadow-[inset_-2px_-2px_0_rgba(38,104,112,0.16)]',
    B: 'bg-[#8f9df9] text-white shadow-[inset_-2px_-2px_0_rgba(45,52,128,0.18)]',
    C: 'bg-[#f5bf5c] text-white shadow-[inset_-2px_-2px_0_rgba(145,88,19,0.18)]',
    D: 'bg-[#ec6370] text-white shadow-[inset_-2px_-2px_0_rgba(130,34,47,0.18)]',
};

export function getAnalyzerLanguage(language: string): AnalyzerLanguage {
    return language?.startsWith('en') ? 'en' : 'vi';
}

const getLang = getAnalyzerLanguage;

function cx(...parts: Array<string | false | undefined>) {
    return parts.filter(Boolean).join(' ');
}

function ewgScoreValue(score: string | null | undefined) {
    const values = String(score || '').match(/\d+/g)?.map(Number) || [];
    return values.length ? Math.max(...values) : null;
}

function ewgScoreValues(score: string | null | undefined) {
    return String(score || '').match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
}

function functionCategoryFor(value: string, lang: 'vi' | 'en') {
    const text = String(value || '').toLowerCase();
    const make = (key: string, vi: string, en: string) => ({ key, label: lang === 'en' ? en : vi });
    if (/(dưỡng da|bảo vệ da|skin conditioning|skin protecting|condition)/i.test(text)) return make('skin-conditioning', 'Dưỡng da', 'Skin Conditioning');
    if (/(độ nhớt|độ sệt|làm đặc|tăng độ sệt|tạo gel|viscosity|thickening|thickener|gel)/i.test(text)) return make('viscosity', 'Điều chỉnh độ nhớt', 'Viscosity Controlling');
    if (/(hương liệu|chất tạo mùi|fragrance|perfuming|flavor)/i.test(text)) return make('fragrance', 'Hương liệu', 'Fragrance');
    if (/(giữ ẩm|humectant|moisturizing)/i.test(text)) return make('humectant', 'Chất giữ ẩm', 'Humectant');
    if (/(hấp thụ uv|bộ lọc uv|chống nắng|uv absorber|uv filter|sunscreen)/i.test(text)) return make('uv-absorber', 'Hấp thụ UV', 'UV Absorber');
    if (/(làm mềm|dưỡng da - làm mềm da|làm mềm dẻo|emollient|softening)/i.test(text)) return make('emollient', 'Làm mềm', 'Emollient');
    if (/(làm mờ|opacifying|opacifier)/i.test(text)) return make('opacifying', 'Làm mờ', 'Opacifying');
    if (/(dung môi|solvent)/i.test(text)) return make('solvent', 'Dung môi', 'Solvent');
    if (/(nhũ hóa|nhũ hóa - hoạt động bề mặt|emulsifying|emulsion)/i.test(text)) return make('emulsifying', 'Nhũ hóa', 'Emulsifying');
    if (/(chất hoạt động bề mặt|surfactant)/i.test(text)) return make('surfactant', 'Hoạt động bề mặt', 'Surfactant');
    if (/(khử mùi|deodorant|antiperspirant)/i.test(text)) return make('deodorant', 'Chất khử mùi', 'Deodorant');
    if (/(mặt nạ|mask)/i.test(text)) return make('mask', 'Mặt nạ', 'Mask');
    return make(normalizeFunctionKey(value), value, value);
}

function normalizeFunctionKey(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
}

function functionKeysForIngredient(item: AnalyzerIngredient, lang: 'vi' | 'en') {
    const keys = new Set<string>();
    item.functions.forEach((functionName) => {
        keys.add(functionCategoryFor(functionName, lang).key);
    });
    return keys;
}

function displayFunctionLabel(key: string, lang: 'vi' | 'en', fallback?: string) {
    const labelsByKey: Record<string, { vi: string; en: string }> = {
        'skin-conditioning': { vi: 'Dưỡng da', en: 'Skin Conditioning' },
        viscosity: { vi: 'Điều chỉnh độ nhớt', en: 'Viscosity Controlling' },
        fragrance: { vi: 'Hương liệu', en: 'Fragrance' },
        humectant: { vi: 'Chất giữ ẩm', en: 'Humectant' },
        'uv-absorber': { vi: 'Hấp thụ UV', en: 'UV Absorber' },
        emollient: { vi: 'Làm mềm', en: 'Emollient' },
        opacifying: { vi: 'Làm mờ', en: 'Opacifying' },
        solvent: { vi: 'Dung môi', en: 'Solvent' },
        emulsifying: { vi: 'Nhũ hóa', en: 'Emulsifying' },
        surfactant: { vi: 'Hoạt động bề mặt', en: 'Surfactant' },
        deodorant: { vi: 'Chất khử mùi', en: 'Deodorant' },
        mask: { vi: 'Mặt nạ', en: 'Mask' },
    };
    return labelsByKey[key]?.[lang] || fallback || key;
}

function skinNoteLabel(prefix: string, skinLabel: string, lang: 'vi' | 'en') {
    return `${prefix} ${displaySkinLabel(skinLabel, lang)}`;
}

function displaySkinLabel(label: string, lang: 'vi' | 'en') {
    if (lang === 'vi') return label;
    const map: Record<string, string> = {
        'Da khô': 'Dry Skin',
        'Da dầu': 'Oily/Acne-Prone Skin',
        'Da nhạy cảm': 'Sensitive Skin',
    };
    return map[label] || label;
}

function skinHeading(prefix: string, label: string, lang: 'vi' | 'en') {
    return `${prefix} ${displaySkinLabel(label, lang)}`.toUpperCase();
}

function ScoreRing({ score }: { score: number }) {
    return (
        <div
            className="mx-auto grid h-32 w-32 shrink-0 place-items-center rounded-full md:mx-0 md:h-44 md:w-44"
            style={{ background: `conic-gradient(hsl(var(--primary)) ${Math.max(0, Math.min(score, 100))}%, #d8e2e7 0)` }}
            aria-label={`${score}%`}
        >
            <div className="grid h-[72%] w-[72%] place-items-center rounded-full bg-white dark:bg-[#0f1722] shadow-inner">
                <span className="text-3xl font-bold leading-none tracking-normal text-foreground md:text-5xl">{score}%</span>
            </div>
        </div>
    );
}

function RiskArc({ ewg, total, labels, compact = false }: { ewg: AnalyzerResponse['ewg']; total: number; labels: typeof copy.vi; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredSegment, setHoveredSegment] = useState<EwgBucket | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const values: Array<{ key: EwgBucket; label: string; count: number }> = [
        { key: 'low', label: labels.low, count: ewg.low || 0 },
        { key: 'moderate', label: labels.moderate, count: ewg.moderate || 0 },
        { key: 'high', label: labels.high, count: ewg.high || 0 },
        { key: 'unknown', label: labels.unknown, count: ewg.unknown || 0 },
    ];
    let offset = 0;

    return (
        <section
            className={cx(
                'max-w-full overflow-hidden text-center shadow-[0_22px_60px_-44px_rgba(36,46,57,0.45)] dark:shadow-[0_22px_60px_-44px_rgba(0,0,0,0.6)]',
                compact ? 'rounded-[22px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-4' : 'rounded-[28px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-5 md:p-8 md:text-left',
            )}
            onClick={compact ? undefined : () => setExpanded((current) => !current)}
        >
            <div className={cx('flex flex-col', compact ? 'gap-4' : 'gap-6 lg:flex-row lg:items-center lg:justify-between')}>
                <div>
                    <h2 className={cx('mx-auto max-w-xl font-bold leading-tight text-foreground', compact ? '!text-lg' : '!text-[1.35rem] md:mx-0 md:!text-3xl')}>{labels.riskDistribution}</h2>
                    <p className={cx('mt-2 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground md:hidden', compact ? 'hidden' : 'flex')}>
                        <InformationCircleIcon className="h-4 w-4" />
                        {labels.tapDetails}
                    </p>
                </div>
                <div 
                    className={cx('relative mx-auto w-full', compact ? 'max-w-[250px]' : 'max-w-[360px] lg:mx-0')}
                    onMouseLeave={() => setHoveredSegment(null)}
                >
                    <svg viewBox="0 0 264 156" className="h-auto w-full" role="img" aria-label={labels.riskDistribution}>
                        <path d="M24 132 A108 108 0 0 1 240 132" fill="none" className="stroke-[#edf2f5] dark:stroke-slate-800" strokeWidth="24" strokeLinecap="butt" pathLength="100" />
                        {values.map((item) => {
                            const percent = total ? (item.count / total) * 100 : 0;
                            const dashOffset = -offset;
                            offset += percent;
                            return percent > 0 ? (
                                <path
                                    key={item.key}
                                    d="M24 132 A108 108 0 0 1 240 132"
                                    fill="none"
                                    stroke={riskColors[item.key]}
                                    strokeWidth="24"
                                    strokeLinecap="butt"
                                    pathLength="100"
                                    strokeDasharray={`${percent} ${100 - percent}`}
                                    strokeDashoffset={dashOffset}
                                    onMouseEnter={() => setHoveredSegment(item.key)}
                                    onMouseMove={(e) => {
                                        const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                        if (rect) {
                                            setMousePos({
                                                x: e.clientX - rect.left,
                                                y: e.clientY - rect.top,
                                            });
                                        }
                                    }}
                                    opacity={hoveredSegment && hoveredSegment !== item.key ? 0.3 : 1}
                                    className="transition-opacity duration-200 cursor-crosshair"
                                />
                            ) : null;
                        })}
                    </svg>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
                        <strong className={cx('font-bold leading-none text-foreground', compact ? 'text-4xl' : 'text-5xl md:text-6xl')}>{total}</strong>
                        <span className={cx('mt-2 font-bold text-muted-foreground', compact ? 'text-sm' : 'text-base md:text-lg')}>{labels.totalIngredients}</span>
                    </div>
                    {hoveredSegment && (
                        <div 
                            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl bg-[#23272d]/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl transition-all duration-75 border border-white/10 whitespace-nowrap text-left"
                            style={{ left: mousePos.x, top: mousePos.y - 12 }}
                        >
                            {values.map(item => {
                                if (item.key === hoveredSegment) {
                                    const percent = total ? Math.round((item.count / total) * 100) : 0;
                                    const ewgScope = item.key === 'low' ? 'EWG 1-2' : item.key === 'moderate' ? 'EWG 3-6' : item.key === 'high' ? 'EWG 7-10' : '';
                                    const nameText = item.key === 'low' ? (labels.lowerHazard || 'Nguy cơ thấp') : item.key === 'high' ? (labels.higherHazard || 'Nguy cơ cao') : (labels[item.key] || item.label);
                                    return (
                                        <div key={item.key} className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: riskColors[item.key] }} />
                                                <span>
                                                    {nameText}
                                                    {ewgScope ? ` (${ewgScope})` : ''}
                                                </span>
                                            </div>
                                            <div className="text-sm font-black text-white pl-4.5">
                                                {item.count} {labels.total || 'thành phần'} <span className="text-xs font-medium text-white/70">({percent}%)</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </div>
            </div>
            {!compact && (
                <div className="hidden mt-7 gap-3 md:grid md:grid-cols-4">
                    {values.map((item) => (
                        <div key={item.key} className="flex items-center gap-3 rounded-[20px] bg-muted/55 dark:bg-white/5 dark:border dark:border-white/10 p-4">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: riskColors[item.key] }} />
                            <div>
                                <p className="text-xl font-bold text-foreground">{item.count}</p>
                                <p className="text-sm font-bold text-muted-foreground">{item.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function EwgBadge({ score, bucket }: { score: string | null; bucket: EwgBucket }) {
    const value = ewgScoreValue(score);
    const color = value === null ? riskColors.unknown : bucket === 'high' ? riskColors.high : bucket === 'moderate' ? riskColors.moderate : '#8ddbd8';
    return (
        <span className="relative inline-grid h-12 w-10 place-items-center text-base font-bold text-white">
            <svg viewBox="0 0 42 52" className="absolute inset-0 h-full w-full scale-x-[1.2]" aria-hidden="true">
                <path d="M21 2C14.2 9.5 7 18 7 29.2C7 41 13.1 50 21 50C28.9 50 35 41 35 29.2C35 18 27.8 9.5 21 2Z" fill={color} />
            </svg>
            <span className="relative">{score || '-'}</span>
        </span>
    );
}

function CirBadge({ rating }: { rating?: string }) {
    const value = String(rating || '-').trim().slice(0, 1).toUpperCase();
    const tone = cirTone[value] || 'bg-[#bfc5cc] text-white shadow-[inset_-2px_-2px_0_rgba(60,69,78,0.18)]';
    return (
        <span className={cx('inline-grid h-10 w-9 place-items-center rounded-[6px] text-lg font-bold', tone)}>
            {value || '-'}
        </span>
    );
}

function EmptyState({ labels }: { labels: typeof copy.vi }) {
    return (
        <section className="rounded-[32px] border border-dashed border-border bg-white/72 dark:bg-[#0f1722]/80 dark:border-white/15 p-8 text-center shadow-[0_22px_60px_-52px_rgba(36,46,57,0.4)] dark:shadow-[0_22px_60px_-52px_rgba(0,0,0,0.6)]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-primary/10 text-primary dark:bg-primary/20">
                <ShieldCheckIcon className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-foreground">{labels.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{labels.subtitle}</p>
        </section>
    );
}

function SkinTypeSection({ skinRows, labels, lang, compact = false }: { skinRows: AnalyzerSkinRow[]; labels: typeof copy.vi; lang: 'vi' | 'en'; compact?: boolean }) {
    const [openRows, setOpenRows] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        setOpenRows(new Set());
    }, [skinRows]);

    const toggleRow = (label: string) => {
        setOpenRows((current) => {
            const next = new Set(current);
            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }
            return next;
        });
    };

    return (
        <section className={cx('max-w-full overflow-hidden shadow-[0_22px_60px_-56px_rgba(36,46,57,0.26)] dark:shadow-[0_22px_60px_-56px_rgba(0,0,0,0.6)]', compact ? 'rounded-[22px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-4' : 'rounded-[28px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-5 md:p-8')}>
            <div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                    <h2 className={cx('w-full text-center font-bold leading-tight text-foreground', compact ? '!text-lg' : '!text-[1.35rem] md:!text-3xl')}>{labels.skin}</h2>
                </div>
                <p className={cx('mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-semibold leading-6 text-muted-foreground', compact ? 'text-xs' : 'text-sm md:justify-start md:text-left md:text-xl md:leading-7')}>
                    <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-[#62c45b]" />
                        {labels.good}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-[#e95e6a]" />
                        {labels.bad}
                    </span>
                </p>
            </div>

            <div className={cx('divide-y divide-[#e4ebef] dark:divide-white/10', compact ? 'mt-5' : 'mt-8')}>
                {skinRows.map((skinRow) => {
                    const isOpen = openRows.has(skinRow.label);
                    const goodCount = skinRow.good.length;
                    const badCount = skinRow.bad.length;
                    const total = goodCount + badCount;
                    const goodPercent = total ? Math.max(0, Math.min(100, (goodCount / total) * 100)) : 0;
                    const badPercent = total ? Math.max(0, Math.min(100, (badCount / total) * 100)) : 0;
                    const displayLabel = displaySkinLabel(skinRow.label, lang);

                    return (
                        <article key={skinRow.label} className="py-4 first:pt-0 last:pb-0">
                            <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => toggleRow(skinRow.label)}
                                aria-expanded={isOpen}
                            >
                                <div className={cx('flex min-w-0 flex-row items-center gap-2', !compact && 'sm:gap-3 md:gap-4')}>
                                    <div className={cx('flex min-w-0 shrink-0 items-center gap-2', !compact && 'sm:gap-2.5 md:w-[330px] md:gap-4')}>
                                        <span className={cx('grid shrink-0 place-items-center bg-[#edf8f6] dark:bg-[#1b7a6d]/20 dark:border dark:border-[#35b7a5]/30', compact ? 'h-9 w-9 rounded-[12px]' : 'h-9 w-9 rounded-[12px] md:h-12 md:w-12 md:rounded-[16px]')}>
                                            {skinRow.icon ? <img src={skinRow.icon} alt="" className={cx('object-contain', compact ? 'h-5 w-5' : 'h-5 w-5 md:h-7 md:w-7')} /> : <ShieldCheckIcon className={cx('text-[#76c9ff]', compact ? 'h-4 w-4' : 'h-4 w-4 md:h-6 md:w-6')} />}
                                        </span>
                                        <h3 className={cx('min-w-0 truncate font-bold text-foreground', compact ? 'max-w-20 text-[13px]' : 'text-[14px] sm:text-[15px] md:text-[19px] md:[overflow-wrap:anywhere]')}>{displayLabel}</h3>
                                    </div>

                                    <div className={cx('flex min-w-0 flex-1 items-center gap-2', !compact && 'sm:gap-3 md:gap-4')}>
                                        <div className={cx('min-w-0 flex-1 overflow-hidden rounded-full bg-[#eef2f3] dark:bg-slate-800', compact ? 'h-2' : 'h-2 md:h-4')}>
                                            {total ? (
                                                <div className="flex h-full w-full">
                                                    {goodCount ? <span className="h-full bg-[#82df70]" style={{ width: `${goodPercent}%` }} /> : null}
                                                    {badCount ? <span className="h-full bg-[#e95e6a]" style={{ width: `${badPercent}%` }} /> : null}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className={cx('shrink-0 text-right font-bold', compact ? 'w-9 text-[13px]' : 'w-10 text-[14px] sm:w-12 sm:text-[15px] md:w-20 md:text-[19px]')}>
                                            {total ? (
                                                <>
                                                    <span className="text-[#3da85a] dark:text-[#52d677]">{goodCount}</span>
                                                    <span className="mx-0.5 text-muted-foreground md:mx-1">/</span>
                                                    <span className="text-[#dc5664] dark:text-[#f87171]">{badCount}</span>
                                                </>
                                            ) : (
                                                <span className="text-sm text-muted-foreground md:text-base">—</span>
                                            )}
                                        </div>
                                        <ChevronDownIcon className={cx('shrink-0 text-muted-foreground transition-transform', compact ? 'h-4 w-4' : 'h-5 w-5 md:h-6 md:w-6', isOpen && 'rotate-180')} />
                                    </div>
                                </div>
                            </button>

                            {isOpen ? (
                                <div className={cx('mt-6 space-y-6', !compact && 'md:pl-[72px]')}>
                                    <div>
                                        <p className="text-[11.5px] font-bold uppercase tracking-normal text-[#2f855a] dark:text-emerald-400 sm:text-xs md:text-[13px]">
                                            {skinHeading(labels.goodFor, skinRow.label, lang)}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2 md:mt-3.5 md:gap-2.5">
                                            {skinRow.good.length ? skinRow.good.map((name) => (
                                                <span key={name} className="max-w-full rounded-full bg-[#e8f6ee] dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/40 px-3.5 py-1.5 text-[12.5px] font-bold leading-tight text-[#2a7448] [overflow-wrap:anywhere] sm:text-[13px] md:px-4 md:py-2 md:text-[14.5px]">
                                                    {name}
                                                </span>
                                            )) : null}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[11.5px] font-bold uppercase tracking-normal text-[#ad6f13] dark:text-amber-400 sm:text-xs md:text-[13px]">
                                            {skinHeading(labels.cautionFor, skinRow.label, lang)}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2 md:mt-3.5 md:gap-2.5">
                                            {skinRow.bad.length ? skinRow.bad.map((name) => (
                                                <span key={name} className="max-w-full rounded-full bg-[#fff0df] dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/40 px-3.5 py-1.5 text-[12.5px] font-bold leading-tight text-[#9b6413] [overflow-wrap:anywhere] sm:text-[13px] md:px-4 md:py-2 md:text-[14.5px]">
                                                    {name}
                                                </span>
                                            )) : null}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function IngredientHazardScale({ ingredients, labels }: { ingredients: AnalyzerIngredient[]; labels: typeof copy.vi }) {
    const values = ingredients.flatMap((item) => ewgScoreValues(item.ewg_score));
    const lower = values.length ? Math.min(...values) : 1;
    const higher = values.length ? Math.max(...values) : 10;
    const bucketDefinitions: Array<{ key: EwgBucket; label: string; color: string }> = [
        { key: 'low', label: labels.low, color: riskColors.low },
        { key: 'moderate', label: labels.moderate, color: riskColors.moderate },
        { key: 'high', label: labels.high, color: riskColors.high },
        { key: 'unknown', label: labels.unknown, color: riskColors.unknown },
    ];
    const counts = ingredients.reduce<Record<EwgBucket, number>>((result, item) => {
        const bucket = bucketDefinitions.some((definition) => definition.key === item.ewg_bucket) ? item.ewg_bucket : 'unknown';
        result[bucket] += 1;
        return result;
    }, { low: 0, moderate: 0, high: 0, unknown: 0 });
    const total = ingredients.length;
    const segments = bucketDefinitions
        .filter((definition) => counts[definition.key] > 0)
        .map((definition) => ({
            ...definition,
            count: counts[definition.key],
            basis: total ? `${(counts[definition.key] / total) * 100}%` : '0%',
        }));

    return (
        <div className="mt-6">
            <div className="flex h-4 overflow-hidden rounded-full bg-[#e9eef1] dark:bg-slate-800">
                {segments.map((segment) => (
                    <span
                        key={segment.key}
                        className="h-full border-r-2 border-white dark:border-slate-900 last:border-r-0"
                        style={{ backgroundColor: segment.color, flexBasis: segment.basis }}
                        title={`${segment.label}: ${segment.count}`}
                        aria-label={`${segment.label}: ${segment.count}`}
                    />
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm font-bold text-muted-foreground">
                <span>{labels.lowerHazard} ({lower})</span>
                <span>{labels.higherHazard} ({higher})</span>
            </div>
            {segments.length ? (
                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground md:justify-end">
                    {segments.map((segment) => (
                        <span key={`legend-${segment.key}`} className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                            {segment.label} ({segment.count})
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function IngredientNotes({ item, analysis, labels, lang, compact }: { item: AnalyzerIngredient; analysis: AnalyzerResponse; labels: typeof copy.vi; lang: 'vi' | 'en', compact?: boolean }) {
    const notes: Array<{ key: string; label: string; icon?: string; tone: 'good' | 'bad' | 'neutral' }> = [];
    analysis.skin.forEach((skinRow) => {
        if (skinRow.good.includes(item.inci_name)) {
            notes.push({
                key: `good-${skinRow.label}`,
                label: skinNoteLabel(labels.goodFor, skinRow.label, lang),
                icon: skinRow.icon,
                tone: 'good',
            });
        }
        if (skinRow.bad.includes(item.inci_name)) {
            notes.push({
                key: `bad-${skinRow.label}`,
                label: skinNoteLabel(labels.notSuitableFor, skinRow.label, lang),
                icon: badSkinIcons[skinRow.label] || skinRow.icon,
                tone: 'bad',
            });
        }
    });

    if (item.flags?.fungal_acne_risk) {
        notes.push({ key: 'fungal', label: labels.fungalAcneNote, icon: quickCheckIcons.fungal_acne_safe, tone: 'bad' });
    }
    if (item.flags?.drying_alcohol) {
        notes.push({ key: 'drying-alcohol', label: labels.dryingAlcoholNote, icon: quickCheckIcons.alcohol_free, tone: 'bad' });
    }
    if (item.flags?.fragrance) {
        notes.push({ key: 'fragrance', label: labels.fragranceNote, icon: quickCheckIcons.fragrance_free, tone: 'bad' });
    }
    if (item.flags?.high_ewg) {
        notes.push({ key: 'high-ewg', label: `${labels.highEwgNote} (${item.ewg_score})`, tone: 'bad' });
    }

    if (!notes.length) return null;

    return (
        <div className="flex flex-col items-end gap-2 md:items-center">
            {notes.slice(0, 4).map((note) => (
                <div key={note.key} className="group relative flex shrink-0 items-center justify-center">
                    <span className={cx(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-white dark:bg-slate-800',
                        note.tone === 'good' && 'border-[#8ddbd8] text-[#62cbbf]',
                        note.tone === 'bad' && 'border-[#f67882] text-[#f06b75]',
                        note.tone === 'neutral' && 'border-[#bfc5cc] text-[#8b96a1]',
                    )}>
                        {note.icon ? (
                            <img src={note.icon} alt={note.label} className={cx('h-7 w-7 object-contain', note.tone === 'bad' && 'opacity-80')} />
                        ) : (
                            <InformationCircleIcon className="h-6 w-6" />
                        )}
                    </span>
                    
                    <div className={cx(
                        "pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-10 w-max max-w-[200px] opacity-0 transition-opacity group-hover:opacity-100",
                        !compact && "md:left-1/2 md:right-auto md:-translate-x-1/2"
                    )}>
                        <div className="rounded-lg bg-gray-800 px-3 py-2 text-[12px] font-medium leading-tight text-white shadow-lg border border-white/10">
                            {note.label}
                        </div>
                        <div className={cx(
                            "absolute right-4 top-full border-[5px] border-transparent border-t-gray-800",
                            !compact && "md:left-1/2 md:right-auto md:-ml-[5px]"
                        )} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function IngredientQuickNotes({ analysis, labels, className }: { analysis: AnalyzerResponse; labels: any; className?: string }) {
    if (!analysis.quick_checks) return null;
    return (
        <section className={cx("max-w-full overflow-hidden p-6 md:p-8 bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 rounded-none md:rounded-[28px] shadow-[0_22px_60px_-52px_rgba(36,46,57,0.4)] dark:shadow-[0_22px_60px_-52px_rgba(0,0,0,0.6)]", className)}>
            <h2 className="text-center !text-[1.35rem] font-bold text-foreground md:text-left md:!text-3xl">{labels.quickNotes}</h2>
            <div className="mt-6 pb-6 grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
                {Object.entries(analysis.quick_checks).map(([key, check], index, arr) => {
                    const isLastOddMobile = index === arr.length - 1 && arr.length % 2 !== 0;
                    const isLastOrphanedXL = index === arr.length - 1 && arr.length % 3 === 1;

                    return (
                        <div 
                            key={key} 
                            className={cx(
                                "grid grid-cols-[1fr_28px] items-center gap-2 rounded-[16px] bg-background/50 dark:bg-white/5 dark:border dark:border-white/10 backdrop-blur-md p-3 shadow-[0_8px_20px_-8px_rgba(36,46,57,0.2)] md:grid-cols-[1fr_36px] md:gap-3 md:rounded-[18px] md:p-4",
                                isLastOddMobile ? "col-span-2 w-[calc(50%-0.25rem)] md:w-[calc(50%-0.375rem)] mx-auto xl:col-span-1 xl:w-full" : "",
                                isLastOrphanedXL ? "xl:col-start-2" : ""
                            )}
                        >
                            <span>
                                <span className="block text-[11.5px] font-bold leading-[1.35] text-foreground sm:text-xs md:text-[14.5px] md:leading-[1.4]">{check.title}</span>
                                <span className={cx('mt-0.5 block text-[9px] font-bold md:text-[11px]', check.passed ? 'text-primary' : 'text-secondary')}>{check.passed ? labels.passed : labels.failed}</span>
                            </span>
                            <span className={cx('grid h-7 w-7 place-items-center rounded-full md:h-8 md:w-8', check.passed ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'bg-secondary/10 text-secondary dark:bg-secondary/20')}>
                                {check.passed ? <CheckIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" /> : <XCircleIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function IngredientListSection({ analysis, labels, lang, compact = false }: { analysis: AnalyzerResponse; labels: typeof copy.vi; lang: 'vi' | 'en'; compact?: boolean }) {
    const [activeFilter, setActiveFilter] = useState('all');
    const functionFilters = useMemo(() => {
        const counters = new Map<string, { key: string; label: string; count: number }>();
        analysis.ingredients.forEach((item) => {
            const itemKeys = new Set<string>();
            item.functions.forEach((functionName) => {
                const category = functionCategoryFor(functionName, lang);
                if (!itemKeys.has(category.key)) {
                    const current = counters.get(category.key) || { key: category.key, label: category.label, count: 0 };
                    counters.set(category.key, { ...current, label: category.label, count: current.count + 1 });
                    itemKeys.add(category.key);
                }
            });
        });

        return Array.from(counters.values())
            .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
            .slice(0, 8);
    }, [analysis.ingredients, lang]);

    useEffect(() => {
        if (activeFilter !== 'all' && !functionFilters.some((item) => item.key === activeFilter)) {
            setActiveFilter('all');
        }
    }, [activeFilter, functionFilters]);

    const filteredIngredients = useMemo(() => {
        if (activeFilter === 'all') return analysis.ingredients;
        return analysis.ingredients.filter((item) => functionKeysForIngredient(item, lang).has(activeFilter));
    }, [activeFilter, analysis.ingredients, lang]);

    const allFilters = [
        { key: 'all', label: labels.all, count: analysis.summary.total },
        ...functionFilters.map((filter) => ({ ...filter, label: displayFunctionLabel(filter.key, lang, filter.label) })),
    ];

    return (
        <section className="space-y-7">
            <div className={cx('max-w-full overflow-hidden shadow-[0_22px_60px_-56px_rgba(36,46,57,0.18)] dark:shadow-[0_22px_60px_-56px_rgba(0,0,0,0.6)]', compact ? 'rounded-[22px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-4' : 'rounded-[28px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-6 md:p-8')}>
                <div className="flex flex-col items-center justify-center gap-3 text-center md:flex-row md:justify-between md:gap-4 md:text-left">
                    <div className="flex items-center justify-center gap-2 text-center md:justify-start md:text-left">
                        <h2 className={cx('font-bold leading-tight text-foreground', compact ? '!text-lg' : '!text-[1.35rem] md:!text-3xl')}>{labels.ingredientList}</h2>
                    </div>
                    <span className={cx('font-bold text-muted-foreground', compact ? 'text-sm' : 'text-base md:text-lg')}>{analysis.summary.total} {labels.total}</span>
                </div>

                <IngredientHazardScale ingredients={analysis.ingredients} labels={labels} />

                <div className="mt-7 flex max-w-full gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {allFilters.map((filter) => {
                        const active = activeFilter === filter.key;
                        return (
                            <button
                                key={filter.key}
                                type="button"
                                onClick={() => setActiveFilter(filter.key)}
                                aria-pressed={active}
                                className={cx(
                                    'max-w-full shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-left text-sm font-bold leading-tight transition md:px-4 md:py-2.5',
                                    active ? 'bg-[#d7efff] text-[#2786c5] dark:bg-sky-500/20 dark:text-sky-300 dark:border dark:border-sky-500/40' : 'bg-[#f3f4f5] text-[#59616b] hover:bg-[#eaf1f4] hover:text-foreground dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10',
                                )}
                            >
                                {filter.label} <span className="ml-2 text-current opacity-80">{filter.count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-full overflow-hidden rounded-[24px] border border-[#e4ebef] bg-white shadow-[0_18px_50px_-48px_rgba(36,46,57,0.32)] dark:border-white/10 dark:bg-[#0f1722]/85 dark:shadow-[0_24px_52px_-36px_rgba(0,0,0,0.6)]">
                {!compact ? <div className="hidden md:block">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e4ebef] bg-[#f7f9fa] text-xs font-bold uppercase tracking-normal text-[#606a74] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                <th className="w-32 px-10 py-5">{labels.ewg}</th>
                                <th className="w-28 px-4 py-5">{labels.cir}</th>
                                <th className="px-6 py-5">{labels.ingredient}</th>
                                <th className="w-[300px] px-8 py-5 text-center">{labels.notes}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredIngredients.length ? filteredIngredients.map((item) => (
                                <tr key={`${item.position}-${item.raw_name}`} className="border-b border-[#e9eef1] odd:bg-white even:bg-[#fbfdfe] dark:border-white/5 dark:odd:bg-transparent dark:even:bg-white/[0.02] dark:hover:bg-white/[0.04] last:border-0">
                                    <td className="px-10 py-6 align-middle"><EwgBadge score={item.ewg_score} bucket={item.ewg_bucket} /></td>
                                    <td className="px-4 py-6 align-middle"><CirBadge rating={item.cir_rating} /></td>
                                    <td className="min-w-0 px-6 py-6 align-middle">
                                        <h3 className={cx('text-[17px] font-bold leading-tight [overflow-wrap:anywhere] lg:text-[19px]', item.recognized ? 'text-[#1680c7] dark:text-sky-400' : 'text-muted-foreground')}>{item.inci_name}</h3>
                                        {item.vi_name ? <p className="mt-1.5 text-[14px] font-bold text-foreground lg:text-[15px]">{item.vi_name}</p> : null}
                                        {item.functions.length ? (
                                            <p className="mt-2 text-[13px] font-semibold leading-[1.6] text-muted-foreground [overflow-wrap:anywhere] lg:text-[14px]">
                                                ({item.functions.join(', ')})
                                            </p>
                                        ) : null}
                                    </td>
                                    <td className="px-8 py-6 align-middle"><IngredientNotes item={item} analysis={analysis} labels={labels} lang={lang} compact={false} /></td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-10 text-center text-base font-bold text-muted-foreground">{labels.noFilterResults}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div> : null}

                <div className={cx('divide-y divide-[#e4ebef] dark:divide-white/10', !compact && 'md:hidden')}>
                    <div className="flex items-center gap-3 border-b border-[#e4ebef] bg-[#f7f9fa] p-5 text-base font-bold uppercase tracking-normal text-[#606a74] md:text-lg dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="w-10 text-center">{labels.ewg}</span>
                            <span className="w-9 text-center">{labels.cir}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            {labels.ingredient}
                        </div>
                        <div className="shrink-0 text-right">
                            {labels.notes}
                        </div>
                    </div>
                    {filteredIngredients.length ? filteredIngredients.map((item) => (
                        <article key={`${item.position}-${item.raw_name}`} className="flex min-w-0 items-start gap-3 p-5 even:bg-[#fbfdfe] dark:even:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                            <div className="flex shrink-0 items-center gap-2">
                                <EwgBadge score={item.ewg_score} bucket={item.ewg_bucket} />
                                <CirBadge rating={item.cir_rating} />
                            </div>
                            
                            <div className="min-w-0 flex-1">
                                <h3 className={cx('text-[17px] font-bold leading-tight [overflow-wrap:anywhere] lg:text-[19px]', item.recognized ? 'text-[#1680c7] dark:text-sky-400' : 'text-muted-foreground')}>{item.inci_name}</h3>
                                {item.vi_name ? <p className="mt-0.5 text-[11.5px] font-bold text-foreground">{item.vi_name}</p> : null}
                                {item.functions.length ? (
                                    <p className="mt-1 text-[11px] font-semibold leading-[1.35] text-muted-foreground [overflow-wrap:anywhere]">
                                        ({item.functions.join(', ')})
                                    </p>
                                ) : null}
                            </div>
                            
                            <div className="shrink-0">
                                <IngredientNotes item={item} analysis={analysis} labels={labels} lang={lang} compact={true} />
                            </div>
                        </article>
                    )) : <p className="p-6 text-center text-sm font-bold text-muted-foreground">{labels.noFilterResults}</p>}
                </div>
            </div>
        </section>
    );
}

interface IngredientAnalysisResultsProps {
    analysis: AnalyzerResponse;
    lang: AnalyzerLanguage;
    className?: string;
    sidebarAction?: React.ReactNode;
    hideQuickNotes?: boolean;
    variant?: 'default' | 'sidebar';
}

export function IngredientAnalysisResults({ analysis, lang, className, sidebarAction, hideQuickNotes, variant = 'default' }: IngredientAnalysisResultsProps) {
    const labels = copy[lang];
    const isSidebar = variant === 'sidebar';
    const ingredientByName = useMemo(() => {
        const map = new Map<string, AnalyzerIngredient>();
        analysis.ingredients.forEach((item) => {
            map.set(item.inci_name, item);
        });
        return map;
    }, [analysis.ingredients]);

    const sidebarRef = useBiDirectionalSticky(112, 112, 32) as React.RefObject<HTMLElement>;

    return (
        <div className={cx('grid min-w-0 gap-5', !isSidebar && 'gap-6 xl:grid-cols-[minmax(0,1fr)_360px]', className)}>
            <div className="min-w-0 space-y-6">
                {!isSidebar ? <section className="max-w-full overflow-hidden rounded-none p-5 text-center shadow-[0_24px_70px_-54px_rgba(36,46,57,0.46)] md:rounded-[32px] md:p-8 md:text-left bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 dark:shadow-[0_24px_70px_-54px_rgba(0,0,0,0.7)]">
                    <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
                        <ScoreRing score={analysis.safety_score} />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-normal text-primary md:text-sm">{labels.safety}</p>
                            <h2 className="mt-2 !text-[1.55rem] font-bold leading-tight text-foreground md:!text-5xl">{analysis.verdict}</h2>
                            <p className="mt-3 text-base font-bold leading-6 text-muted-foreground md:text-lg">
                                {analysis.summary.recognized}/{analysis.summary.total} {labels.recognized}
                            </p>
                            <div className="mt-5 hidden flex-wrap justify-center gap-3 md:flex md:justify-start">
                                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary dark:bg-primary/20 dark:text-primary">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.low }} />
                                    {analysis.ewg.low || 0} {labels.low}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#fff3df] dark:bg-amber-500/15 dark:text-amber-300 px-4 py-2 text-sm font-bold text-[#986315]">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.moderate }} />
                                    {analysis.ewg.moderate || 0} {labels.moderate}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary dark:bg-secondary/20 dark:text-secondary">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.high }} />
                                    {analysis.ewg.high || 0} {labels.high}
                                </span>
                            </div>
                        </div>
                    </div>
                </section> : null}

                <RiskArc ewg={analysis.ewg} total={analysis.summary.total} labels={labels} compact={isSidebar} />

                {!hideQuickNotes && (
                    <IngredientQuickNotes analysis={analysis} labels={labels} className="rounded-none md:rounded-[28px]" />
                )}
                <SkinTypeSection skinRows={analysis.skin} labels={labels} lang={lang} compact={isSidebar} />
                {isSidebar ? (
                    <section className="max-w-full overflow-hidden rounded-[22px] bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10 p-4 shadow-[0_22px_60px_-52px_rgba(36,46,57,0.28)] dark:shadow-[0_22px_60px_-52px_rgba(0,0,0,0.6)]">
                        <h2 className="text-center !text-lg font-bold leading-tight text-foreground">{labels.effects}</h2>
                        <div className="mt-5 space-y-3">
                            {analysis.effects.map((effect) => (
                                <article key={effect.label} className="flex min-w-0 gap-3 rounded-[16px] bg-background/75 dark:bg-white/5 dark:border dark:border-white/10 p-3">
                                    <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-[15px]', effect.negative ? 'bg-secondary/10 dark:bg-secondary/20' : 'bg-primary/10 dark:bg-primary/20')}>
                                        {effect.icon ? <img src={effect.icon} alt="" className="h-7 w-7 object-contain" /> : <ShieldCheckIcon className="h-6 w-6 text-primary" />}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold leading-5 text-foreground">{effect.label}</h3>
                                        <p className="mt-1 text-xs font-bold text-muted-foreground">từ ({effect.count}) thành phần</p>
                                        <p className="mt-2 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                            {effect.ingredients.map((name) => {
                                                const item = ingredientByName.get(name);
                                                return item?.vi_name ? `${name} — ${item.vi_name}` : name;
                                            }).join(' · ')}
                                        </p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}
                <IngredientListSection analysis={analysis} labels={labels} lang={lang} compact={isSidebar} />
            </div>

            {!isSidebar ? <aside ref={sidebarRef} className="min-w-0 space-y-5 xl:sticky xl:self-start" style={{ top: '7rem' }}>
                <section className="max-w-full overflow-hidden rounded-none p-6 shadow-[0_22px_60px_-52px_rgba(36,46,57,0.4)] dark:shadow-[0_22px_60px_-52px_rgba(0,0,0,0.6)] md:rounded-[28px] md:p-8 bg-white/75 dark:bg-[#0f1722]/80 dark:border dark:border-white/10">
                    <h2 className="text-center !text-[1.35rem] font-bold leading-tight text-foreground md:!text-3xl">{labels.effects}</h2>
                    <div className="mt-6 space-y-3">
                        {analysis.effects.length ? analysis.effects.map((effect) => (
                            <article key={effect.label} className="flex min-w-0 gap-4 rounded-[18px] bg-white dark:bg-white/5 dark:border dark:border-white/10 p-4">
                                <span className={cx('grid h-14 w-14 shrink-0 place-items-center rounded-[20px]', effect.negative ? 'bg-secondary/10 dark:bg-secondary/20' : 'bg-primary/10 dark:bg-primary/20')}>
                                    {effect.icon ? <img src={effect.icon} alt="" className="h-9 w-9 object-contain" /> : <ShieldCheckIcon className="h-7 w-7 text-primary" />}
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold leading-6 text-foreground md:text-lg">{effect.label}</h3>
                                    <p className="mt-1 text-sm font-bold text-muted-foreground">từ ({effect.count}) thành phần</p>
                                    <p className="mt-3 text-[0.94rem] leading-6 text-muted-foreground [overflow-wrap:anywhere] md:text-base md:leading-7">
                                        {effect.ingredients.map((name) => {
                                            const item = ingredientByName.get(name);
                                            return item?.vi_name ? `${name} — ${item.vi_name}` : name;
                                        }).join(' · ')}
                                    </p>
                                </div>
                            </article>
                        )) : null}
                    </div>
                </section>
            </aside> : null}
        </div>
    );
}

export default function IngredientAnalyzerPage() {
    const { i18n } = useTranslation();
    const lang = getLang(i18n.language);
    const labels = copy[lang];
    const [inciText, setInciText] = useState('');
    const [analysis, setAnalysis] = useState<AnalyzerResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const runAnalysisForText = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) {
            setError(labels.emptyError);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/ingredient-analyzer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inciText: trimmed, lang: getLang(i18n.language) }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || labels.errorFallback);
            }
            setAnalysis(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : labels.errorFallback);
        } finally {
            setIsLoading(false);
        }
    };

    const submitAnalysis = async () => {
        await runAnalysisForText(inciText);
    };

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('ingredient_analyzer_query');
            if (saved && saved.trim()) {
                sessionStorage.removeItem('ingredient_analyzer_query');
                setInciText(saved);
                void runAnalysisForText(saved);
            }
        } catch {
            // ignore sessionStorage error in sandboxed iframe/browser
        }
    }, [i18n.language]);

    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,#eef8ff_48%,#fffaf6_100%)] dark:bg-[linear-gradient(180deg,hsl(var(--background))_0%,#0c1420_50%,#090f17_100%)] pb-20 pt-10 md:pt-32">
            <div className="container mx-auto px-0 md:px-6">
                <section className="overflow-hidden rounded-none p-4 shadow-[0_28px_80px_-56px_rgba(36,46,57,0.5)] dark:shadow-[0_28px_80px_-56px_rgba(0,0,0,0.7)] md:rounded-[36px] md:p-10 bg-white/65 dark:bg-[#0f1722]/80 dark:border dark:border-white/10">
                    <div className="grid gap-5 md:gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div className="text-center md:text-left">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/72 px-4 py-2 text-sm font-bold text-primary dark:bg-primary/15 dark:border-primary/30">
                                <SearchIcon className="h-4 w-4" />
                                {getLang(i18n.language) === 'en' ? 'INCI analyzer' : 'Phân tích INCI'}
                            </div>
                            <h1 className="mx-auto mt-4 max-w-2xl text-[2.25rem] font-bold leading-[0.98] tracking-normal text-foreground md:mx-0 md:mt-5 md:text-6xl md:leading-[1.05]">
                                {labels.title}
                            </h1>
                            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground md:mx-0 md:mt-5 md:text-lg md:leading-8">{labels.subtitle}</p>

                        </div>
                        <div className="rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_22px_60px_-48px_rgba(36,46,57,0.48)] dark:border-white/10 dark:bg-[rgba(15,23,34,0.75)] dark:shadow-[0_22px_60px_-48px_rgba(0,0,0,0.7)] backdrop-blur md:p-5">
                            <textarea
                                value={inciText}
                                onChange={(event) => setInciText(event.target.value)}
                                placeholder={labels.placeholder}
                                className="min-h-[190px] w-full resize-y rounded-[22px] border border-border bg-white p-5 text-base font-medium leading-7 text-foreground outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10 dark:bg-[#0b1320] dark:border-white/15 dark:text-white dark:focus:border-primary/60"
                            />
                            {error ? <p className="mt-3 text-sm font-bold text-secondary">{error}</p> : null}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={submitAnalysis}
                                    disabled={isLoading}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_18px_38px_-28px_rgba(26,51,29,0.86)] transition hover:bg-primary/92 disabled:cursor-wait disabled:opacity-70 btn-press"
                                >
                                    {isLoading ? <LoadingIcon className="h-5 w-5 animate-spin" /> : <ArrowRightIcon className="h-5 w-5" />}
                                    {labels.analyze}
                                </button>
                                <button type="button" onClick={() => setInciText(DEMO_INCI)} className="min-h-[48px] rounded-full border border-border bg-white px-5 text-sm font-bold text-foreground transition hover:border-primary/35 hover:text-primary btn-press dark:bg-white/10 dark:border-white/15 dark:text-white dark:hover:bg-white/15">
                                    {labels.sample}
                                </button>
                                <button type="button" onClick={() => { setInciText(''); setAnalysis(null); setError(''); }} className="min-h-[48px] rounded-full px-4 text-sm font-bold text-muted-foreground transition hover:text-foreground">
                                    {labels.clear}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {analysis ? (
                    <IngredientAnalysisResults
                        analysis={analysis}
                        lang={lang}
                        className="mt-8"
                    />
                ) : null}
            </div>
        </main>
    );
}
