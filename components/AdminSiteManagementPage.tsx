import React, { useState, useEffect, useRef, useMemo } from 'react';
import type {
    AdminNavigationView,
    AdminSiteSection,
    Service,
    DoctorDetail,
    BlogPost,
    FAQItem,
    HomepageHero,
    AboutPageData,
    AboutContent,
    AboutFeature,
    AboutValue,
    SiteInfo,
    FooterContent,
    AuthPageImages,
    PaymentSettings,
    ObservabilityLogEntry,
    ObservabilityCleanupResult,
    ObservabilityLogsResponse,
    ObservabilityMetricsSummaryResponse
} from '../types';
import {
    WrenchScrewdriverIcon,
    PlusCircleIcon,
    PencilIcon,
    TrashIcon,
    SearchIcon,
    CloseIcon,
    ShieldCheckIcon,
    LoadingIcon
} from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import * as api from '../services/api';
import { ImageDropzone } from './ImageDropzone';
import { useTranslation } from 'react-i18next';
import { getExternalUrlError, normalizeFooterSocialUrls, SOCIAL_URL_FIELDS } from '../src/socialLinks';
import { AdminMobileList, AdminMobileCard } from './AdminResponsivePrimitives';

// Standard 3D WebP Icons matching AdminPharmacyManagementPage & AdminUserManagementPage
const EDIT_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp';
const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';
const ADD_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp';

interface AdminSiteManagementPageProps {
    allServices: Service[];
    allDoctors: DoctorDetail[];
    allPosts: BlogPost[];
    faqItems: FAQItem[];
    homepageHero: HomepageHero | null;
    featuredServiceIds: number[];
    featuredDoctorIds: string[];
    featuredPostSlugs: string[];
    onUpdateHomepageHero: (hero: Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_tablet_url' | 'image_mobile_url'>, files: { desktop?: File, tablet?: File, mobile?: File }) => void;
    onUpdateFeaturedServices: (ids: number[]) => void;
    onUpdateFeaturedDoctors: (ids: string[]) => void;
    onUpdateFeaturedPosts: (slugs: string[]) => void;
    onSaveFaq: (faq: FAQItem) => void;
    onDeleteFaq: (id: number) => void;
    aboutData: AboutPageData;
    onUpdateAboutContent: (content: Partial<AboutContent>, imageFile: File | null) => void;
    onSaveAboutFeature: (feature: Partial<AboutFeature>) => void;
    onDeleteAboutFeature: (id: string) => void;
    onSaveAboutValue: (value: Partial<AboutValue>) => void;
    onDeleteAboutValue: (id: string) => void;
    siteInfo: SiteInfo;
    footerContent: FooterContent;
    onUpdateSiteInfo: (info: Partial<SiteInfo>, files: { light?: File, dark?: File, favicon?: File }) => void;
    onUpdateFooterContent: (content: Partial<FooterContent>) => Promise<void> | void;
    authPageImages: AuthPageImages;
    onUpdateAuthPageImages: (file: File | null) => void;
    paymentSettings: PaymentSettings;
    onUpdatePaymentSettings: (settings: PaymentSettings) => void;
    initialSection?: AdminSiteSection;
    initialAction?: 'observability';
    onNavigate: (page: AdminNavigationView) => void;
    onBack: () => void;
}

interface SocialUrlFieldProps {
    label: string;
    name: string;
    value?: string;
    error?: string;
    placeholder: string;
    hint?: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const SocialUrlField: React.FC<SocialUrlFieldProps> = ({
    label,
    name,
    value,
    error,
    placeholder,
    hint,
    onChange,
}) => {
    const errorId = `${name}-error`;
    const hintId = `${name}-hint`;
    return (
        <div>
            <label htmlFor={name} className="text-xs sm:text-sm font-medium text-foreground">{label}</label>
            <input
                id={name}
                name={name}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : hint ? hintId : undefined}
                className={`mt-1 w-full admin-glass-input text-xs sm:text-sm ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
            />
            {error ? <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
            {!error && hint ? <p id={hintId} className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
    );
};

const AutocompletePostSelector: React.FC<{
    allPosts: BlogPost[];
    selectedSlugs: string[];
    onSelectionChange: (slugs: string[]) => void;
    t: any;
}> = ({ allPosts, selectedSlugs, onSelectionChange, t }) => {
    const [inputValue, setInputValue] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedPosts = useMemo(() => {
        return selectedSlugs
            .map(slug => allPosts.find(p => p.slug === slug))
            .filter((p): p is BlogPost => p !== undefined);
    }, [selectedSlugs, allPosts]);

    const suggestions = useMemo(() => {
        if (!inputValue.trim()) return [];
        const lowerCaseInput = inputValue.toLowerCase();
        return allPosts.filter(
            post =>
                !selectedSlugs.includes(post.slug) &&
                post.title.toLowerCase().includes(lowerCaseInput)
        ).slice(0, 5);
    }, [inputValue, allPosts, selectedSlugs]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
    };

    useEffect(() => {
        if (inputValue.trim().length > 0 && suggestions.length > 0) {
            setIsDropdownOpen(true);
        } else {
            setIsDropdownOpen(false);
        }
    }, [suggestions, inputValue]);

    const addPost = (slug: string) => {
        onSelectionChange([...selectedSlugs, slug]);
        setInputValue('');
        setIsDropdownOpen(false);
    };

    const removePost = (slug: string) => {
        onSelectionChange(selectedSlugs.filter(s => s !== slug));
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div className="flex flex-wrap gap-1.5 mb-2 p-2 border border-border/70 rounded-xl bg-background/40 min-h-[44px]">
                {selectedPosts.map(post => (
                    <span key={post.slug} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-lg border border-primary/20 animate-scale-in">
                        <span className="truncate max-w-[200px] sm:max-w-[320px]">{post.title}</span>
                        <button
                            type="button"
                            onClick={() => removePost(post.slug)}
                            className="p-0.5 rounded-full hover:bg-primary/20"
                            aria-label={t('common.delete') + ` ${post.title}`}
                        >
                            <CloseIcon className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {selectedSlugs.length === 0 && <span className="text-xs text-muted-foreground p-1">{t('admin.no_post_selected', 'Chưa chọn bài viết nào.')}</span>}
            </div>

            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => { if (inputValue.trim().length > 0) setIsDropdownOpen(true); }}
                    placeholder={t('admin.search_select_post', 'Tìm kiếm và chọn bài viết...')}
                    className="w-full pl-9 pr-4 py-2 border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none"
                />
            </div>

            {isDropdownOpen && suggestions.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-popover/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-scale-in origin-top">
                    <ul className="divide-y divide-border/40">
                        {suggestions.map(post => (
                            <li
                                key={post.slug}
                                onClick={() => addPost(post.slug)}
                                className="p-3 hover:bg-accent/70 cursor-pointer transition-colors"
                            >
                                <p className="font-semibold text-xs sm:text-sm text-foreground">{post.title}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{post.summary}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const formatAdminTimestamp = (value?: string | null) => {
    if (!value) return 'Chưa có dữ liệu';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(parsed);
};

const summarizeObservabilityEntry = (entry: ObservabilityLogEntry) => {
    return entry.message || entry.resource || entry.type || entry.channel || 'Sự kiện không có mô tả';
};

const formatMetricPercent = (value?: number | null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0%';
    return `${numeric.toFixed(1)}%`;
};

const formatMetricDuration = (value?: number | null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 'n/a';
    return `${Math.round(numeric)} ms`;
};

const AdminSiteManagementPage: React.FC<AdminSiteManagementPageProps> = (props) => {
    const { t } = useTranslation();
    const setSidebarConfig = useAdminLayoutDispatch();
    const [activeTab, setActiveTab] = useState<AdminSiteSection>(
        props.initialSection || (props.initialAction === 'observability' ? 'observability' : 'branding')
    );
    const [faqSearchQuery, setFaqSearchQuery] = useState('');
    const [observabilityLogs, setObservabilityLogs] = useState<ObservabilityLogEntry[]>([]);
    const [observabilityMeta, setObservabilityMeta] = useState<ObservabilityLogsResponse | null>(null);
    const [observabilitySummary, setObservabilitySummary] = useState<ObservabilityMetricsSummaryResponse | null>(null);
    const [observabilityError, setObservabilityError] = useState('');
    const [isObservabilityLoading, setIsObservabilityLoading] = useState(false);
    const [observabilityDays, setObservabilityDays] = useState(7);
    const [observabilityLimit, setObservabilityLimit] = useState(20);
    const [hasLoadedObservability, setHasLoadedObservability] = useState(false);
    const [retentionDays, setRetentionDays] = useState(14);
    const [cleanupResult, setCleanupResult] = useState<ObservabilityCleanupResult | null>(null);
    const [isCleanupRunning, setIsCleanupRunning] = useState(false);

    // States for homepage editing
    const [heroForm, setHeroForm] = useState<Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_tablet_url' | 'image_mobile_url'>>({
        title: '',
        subtitle: '',
        image_desktop_path: '',
        image_tablet_path: '',
        image_mobile_path: ''
    });
    const [heroImageFiles, setHeroImageFiles] = useState<{ desktop?: File, tablet?: File, mobile?: File }>({});
    const [heroPreviews, setHeroPreviews] = useState<{ desktop: string | null, tablet: string | null, mobile: string | null }>({
        desktop: null,
        tablet: null,
        mobile: null
    });
    const [localFeaturedSvcIds, setLocalFeaturedSvcIds] = useState(props.featuredServiceIds);
    const [localFeaturedDocIds, setLocalFeaturedDocIds] = useState(props.featuredDoctorIds);
    const [localFeaturedPostSlugs, setLocalFeaturedPostSlugs] = useState(props.featuredPostSlugs);

    // States for FAQ editing
    const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
    const [isNewFaq, setIsNewFaq] = useState(false);

    // States for About Page editing
    const [aboutContentForm, setAboutContentForm] = useState<AboutContent>(props.aboutData.content);
    const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
    const [aboutPreview, setAboutPreview] = useState<string | null>(null);
    const [editingFeature, setEditingFeature] = useState<Partial<AboutFeature> | null>(null);
    const [editingValue, setEditingValue] = useState<Partial<AboutValue> | null>(null);

    // States for General Settings
    const [siteInfoForm, setSiteInfoForm] = useState(props.siteInfo);
    const [siteInfoFiles, setSiteInfoFiles] = useState<{ light?: File, dark?: File, favicon?: File }>({});
    const [footerForm, setFooterForm] = useState(props.footerContent);
    const [loginImageFile, setLoginImageFile] = useState<File | null>(null);
    const [loginPreview, setLoginPreview] = useState<string | null>(null);
    const [paymentSettingsForm, setPaymentSettingsForm] = useState(props.paymentSettings);

    const [previews, setPreviews] = useState({ light: '', dark: '', favicon: '' });

    const currentTabLabel = activeTab === 'branding'
        ? 'Branding'
        : activeTab === 'footer'
            ? 'Footer'
            : activeTab === 'auth'
                ? 'Auth'
                : activeTab === 'payment'
                    ? 'Thanh toán'
        : activeTab === 'homepage'
            ? 'Trang chủ'
            : activeTab === 'about'
                ? 'Giới thiệu'
                : activeTab === 'faq'
                    ? 'FAQ'
                    : 'Observability';

    const workspaceInsights = [
        { label: 'Tabs cấu hình', value: '8', hint: 'Branding, footer, auth, payment, trang chủ, giới thiệu, FAQ và quan sát lỗi' },
        { label: 'FAQ / logs', value: activeTab === 'observability' ? String(observabilityLogs.length) : String(props.faqItems.length), hint: activeTab === 'observability' ? 'Số log đang hiển thị trong cửa sổ gần đây' : `${props.allServices.length} dịch vụ • ${props.allPosts.length} bài viết` },
        { label: 'Màn hiện tại', value: currentTabLabel, hint: 'Mọi chỉnh sửa site content và runtime guard được gom vào một module duy nhất' },
    ];

    const siteTabs = [
        { key: 'branding' as const, label: 'Branding', icon: '🏷️' },
        { key: 'footer' as const, label: 'Footer & Liên hệ', icon: '📄' },
        { key: 'auth' as const, label: 'Đăng nhập (Auth)', icon: '🔐' },
        { key: 'payment' as const, label: 'Thanh toán (SePay)', icon: '💳' },
        { key: 'homepage' as const, label: t('admin.tab_homepage', 'Trang chủ'), icon: '🏠' },
        { key: 'about' as const, label: t('admin.tab_about', 'Trang Giới thiệu'), icon: 'ℹ️' },
        { key: 'faq' as const, label: t('admin.tab_faq', 'Câu hỏi thường gặp (FAQ)'), icon: '❓' },
        { key: 'observability' as const, label: 'Observability', icon: '🛡️' },
    ];

    const selectableDoctors = props.allDoctors.filter(d => d.doctor_profile);

    const handleTabChange = (tabKey: AdminSiteSection) => {
        setActiveTab(tabKey);
        props.onNavigate({
            page: 'adminSiteManagement',
            section: tabKey,
            ...(tabKey === 'observability' ? { action: 'observability' as const } : {})
        });
    };

    const siteTaskItems = siteTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        view: { page: 'adminSiteManagement', section: tab.key, ...(tab.key === 'observability' ? { action: 'observability' as const } : {}) } as AdminNavigationView,
    }));

    const sectionMeta = useMemo(() => {
        if (activeTab === 'branding') {
            return {
                title: 'Branding hệ thống',
                description: 'Logo, favicon và clinic name được tách thành một queue riêng để cập nhật nhận diện mà không phải đi qua footer, auth hoặc payment.',
                eyebrow: 'Brand operations',
                insights: [
                    { label: 'Clinic name', value: props.siteInfo?.clinic_name ? 'Đã cấu hình' : 'Chưa có', hint: 'Logo sáng, logo tối và favicon nằm chung một task' },
                    { label: 'Màn hiện tại', value: 'Branding', hint: 'Nhóm chỉnh nhận diện hệ thống' },
                    { label: 'Site asset', value: String(props.allPosts.length), hint: `${props.allServices.length} dịch vụ • ${props.allPosts.length} bài viết dùng nhận diện này` },
                ],
            };
        }

        if (activeTab === 'footer') {
            return {
                title: 'Footer & liên hệ',
                description: 'Footer được tách khỏi branding để chỉnh contact, working hours, social links và copyright nhanh hơn.',
                eyebrow: 'Footer operations',
                insights: [
                    { label: 'Liên hệ', value: props.footerContent?.phone ? 'Đã cấu hình' : 'Thiếu', hint: 'Địa chỉ, email, điện thoại và social links' },
                    { label: 'Màn hiện tại', value: 'Footer', hint: 'Tách khỏi auth và payment' },
                    { label: 'Site info', value: props.footerContent?.email ? 'Đang dùng' : 'Cần rà', hint: 'Dùng cho chân trang công khai' },
                ],
            };
        }

        if (activeTab === 'auth') {
            return {
                title: 'Auth artwork',
                description: 'Ảnh trang đăng nhập được tách riêng để đổi trải nghiệm auth mà không chạm vào homepage hoặc footer.',
                eyebrow: 'Auth experience',
                insights: [
                    { label: 'Ảnh auth', value: props.authPageImages?.login_image_url ? 'Đã có' : 'Chưa có', hint: 'Ảnh này dùng cho login/register screen' },
                    { label: 'Màn hiện tại', value: 'Auth', hint: 'Task riêng cho login artwork' },
                    { label: 'Homepage hero', value: props.homepageHero ? 'Đã có' : 'Chưa có', hint: 'Auth artwork tách khỏi hero' },
                ],
            };
        }

        if (activeTab === 'payment') {
            return {
                title: 'Thanh toán & SePay',
                description: 'Thông tin nhận tiền được gom thành task riêng để finance/admin chỉnh nhanh mà không cần mở cả khối site settings.',
                eyebrow: 'Payment operations',
                insights: [
                    { label: 'Ngân hàng SePay', value: props.paymentSettings?.bank_bin ? 'Đã cấu hình' : 'Thiếu', hint: 'QR động và tài khoản nhận tiền qua SePay' },
                    { label: 'Màn hiện tại', value: 'Thanh toán', hint: 'Tách khỏi branding và footer' },
                    { label: 'Footer link', value: props.footerContent?.phone ? 'Sẵn sàng' : 'Thiếu contact', hint: 'Nên giữ contact đồng bộ với payment' },
                ],
            };
        }

        if (activeTab === 'homepage') {
            return {
                title: 'Quản trị trang chủ',
                description: 'Tách riêng homepage khỏi phần site settings chung để chỉnh hero, block nổi bật, dịch vụ và bài viết mà không lẫn với logo, footer hay FAQ.',
                eyebrow: 'Homepage operations',
                insights: [
                    { label: 'Hero', value: props.homepageHero ? 'Đã cấu hình' : 'Chưa có', hint: `${props.featuredServiceIds.length} dịch vụ • ${props.featuredPostSlugs.length} bài viết nổi bật` },
                    { label: 'Bác sĩ nổi bật', value: String(props.featuredDoctorIds.length), hint: `${selectableDoctors.length} hồ sơ bác sĩ hợp lệ` },
                    { label: 'Màn hiện tại', value: 'Trang chủ', hint: 'Task-level route qua shell admin mới' },
                ],
            };
        }

        if (activeTab === 'about') {
            return {
                title: 'Quản trị trang giới thiệu',
                description: 'Khối about được giữ riêng để quản lý nội dung thương hiệu, mission/vision, lý do chọn và giá trị cốt lõi mà không trộn với homepage.',
                eyebrow: 'Brand narrative',
                insights: [
                    { label: 'Reasons', value: String(props.aboutData.reasonsToChoose.length), hint: `${props.aboutData.coreValues.length} giá trị cốt lõi` },
                    { label: 'Nội dung chính', value: 'Đang dùng', hint: 'Header, mission, vision, values và ảnh nền' },
                    { label: 'Màn hiện tại', value: 'Giới thiệu', hint: 'Tách khỏi FAQ và general settings' },
                ],
            };
        }

        if (activeTab === 'faq') {
            return {
                title: 'Quản lý FAQ',
                description: 'FAQ được tách riêng để thêm, sửa, xóa câu hỏi nhanh và không bị lẫn với các form nội dung khác của site.',
                eyebrow: 'FAQ operations',
                insights: [
                    { label: 'FAQ', value: String(props.faqItems.length), hint: 'Toàn bộ câu hỏi công khai trên website' },
                    { label: 'Màn hiện tại', value: 'FAQ', hint: 'Form tạo mới và danh sách nằm trong cùng task' },
                    { label: 'Site content', value: String(props.allPosts.length), hint: `${props.allServices.length} dịch vụ • ${props.allPosts.length} bài viết` },
                ],
            };
        }

        if (activeTab === 'observability') {
            return {
                title: 'Observability',
                description: 'Tab này giữ riêng runtime health, log lỗi client và cleanup retention để đội vận hành không cần rời khỏi admin khi theo dõi lỗi.',
                eyebrow: 'Runtime monitoring',
                insights: [
                    { label: 'Logs hiện tại', value: String(observabilityLogs.length), hint: `Cửa sổ ${observabilityDays} ngày • limit ${observabilityLimit}` },
                    { label: 'Retention', value: `${retentionDays} ngày`, hint: cleanupResult ? `Đã xóa ${cleanupResult.deleted_count} log` : 'Có thể cleanup thủ công ngay trong tab' },
                    { label: 'Màn hiện tại', value: 'Observability', hint: observabilityError || 'Theo dõi lỗi public runtime và admin' },
                ],
            };
        }

        return {
            title: t('admin.site_management_title', 'Quản lý Trang'),
            description: t('admin.site_management_desc', 'Tùy chỉnh nội dung hiển thị trên trang web'),
            eyebrow: activeTab === 'branding' ? 'Site operations' : currentTabLabel,
            insights: workspaceInsights,
        };
    }, [
        activeTab,
        props.homepageHero,
        props.featuredServiceIds.length,
        props.featuredPostSlugs.length,
        props.featuredDoctorIds.length,
        selectableDoctors.length,
        props.aboutData.reasonsToChoose.length,
        props.aboutData.coreValues.length,
        props.faqItems.length,
        props.allPosts.length,
        props.allServices.length,
        observabilityLogs.length,
        observabilityDays,
        observabilityLimit,
        retentionDays,
        cleanupResult,
        observabilityError,
        currentTabLabel,
        workspaceInsights,
        t,
    ]);

    const workspaceActions = (
        <div className="flex flex-wrap justify-end gap-2">
            {activeTab !== 'homepage' ? (
                <button
                    type="button"
                    onClick={() => handleTabChange('homepage')}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                    Mở trang chủ
                </button>
            ) : null}
            {activeTab !== 'observability' ? (
                <button
                    type="button"
                    onClick={() => handleTabChange('observability')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>Mở observability</span>
                </button>
            ) : null}
        </div>
    );

    useEffect(() => {
        setSidebarConfig({
            title: sectionMeta.title,
            description: sectionMeta.description,
            icon: <WrenchScrewdriverIcon className="w-8 h-8" />,
            eyebrow: sectionMeta.eyebrow,
            insights: sectionMeta.insights,
            taskItems: siteTaskItems,
            activeTaskKey: activeTab,
            actions: workspaceActions,
        });
    }, [setSidebarConfig, sectionMeta, siteTaskItems, activeTab, workspaceActions]);

    const footerUrlErrors = useMemo(() => {
        const errors: Record<string, string> = {};
        for (const field of SOCIAL_URL_FIELDS) {
            errors[field] = getExternalUrlError(footerForm?.[field as keyof FooterContent]);
        }
        return errors;
    }, [footerForm]);

    const hasFooterUrlErrors = Object.values(footerUrlErrors).some(Boolean);

    useEffect(() => {
        if (props.homepageHero) {
            const { image_desktop_url, image_tablet_url, image_mobile_url, ...rest } = props.homepageHero;
            setHeroForm(rest as any);
            setHeroPreviews({
                desktop: image_desktop_url || null,
                tablet: image_tablet_url || null,
                mobile: image_mobile_url || null
            });
        }
        setLocalFeaturedSvcIds(props.featuredServiceIds);
        setLocalFeaturedDocIds(props.featuredDoctorIds);
        setLocalFeaturedPostSlugs(props.featuredPostSlugs);
        if (props.aboutData) {
            setAboutContentForm(props.aboutData.content);
            setAboutPreview(props.aboutData.content.image_url || null);
        }
        if (props.siteInfo) {
            setSiteInfoForm(props.siteInfo);
            setPreviews({
                light: props.siteInfo.logo_light_url || '',
                dark: props.siteInfo.logo_dark_url || '',
                favicon: props.siteInfo.favicon_url || '',
            });
        }
        if (props.footerContent) setFooterForm(props.footerContent);
        setLoginImageFile(null);
        setLoginPreview(props.authPageImages?.login_image_url || null);
        if (props.paymentSettings) setPaymentSettingsForm(props.paymentSettings);
    }, [props]);

    const handleHeroFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHeroForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleHeroImageSelected = (type: 'desktop' | 'tablet' | 'mobile', files: File[]) => {
        if (files[0]) {
            setHeroImageFiles(prev => ({ ...prev, [type]: files[0] }));
            setHeroPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(files[0]) }));
        }
    };

    const handleServiceSelect = (id: number) => {
        setLocalFeaturedSvcIds(prev =>
            prev.includes(id) ? prev.filter(svcId => svcId !== id) : [...prev, id]
        );
    };

    const handleDoctorSelect = (id: string) => {
        setLocalFeaturedDocIds(prev =>
            prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
        );
    };

    const handleEditFaq = (faq: FAQItem) => {
        setEditingFaq(faq);
        setIsNewFaq(false);
    };

    const handleAddNewFaq = () => {
        setEditingFaq({ id: 0, question: '', answer: '' });
        setIsNewFaq(true);
    };

    const handleSaveFaqForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFaq && editingFaq.question && editingFaq.answer) {
            props.onSaveFaq(editingFaq);
            setEditingFaq(null);
            setIsNewFaq(false);
        }
    };

    const handleAboutContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setAboutContentForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    };

    const handleAboutImageSelected = (files: File[]) => {
        if (files[0]) {
            setAboutImageFile(files[0]);
            setAboutPreview(URL.createObjectURL(files[0]));
        }
    };

    const handleSaveFeature = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFeature && editingFeature.title && editingFeature.description && editingFeature.icon) {
            props.onSaveAboutFeature(editingFeature);
            setEditingFeature(null);
        }
    };

    const handleSaveValue = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingValue && editingValue.title && editingValue.description && editingValue.icon) {
            props.onSaveAboutValue(editingValue);
            setEditingValue(null);
        }
    };

    const handleSiteInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSiteInfoForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    };

    const handleSiteInfoFileSelected = (fileType: 'light' | 'dark' | 'favicon', files: File[]) => {
        if (files.length > 0) {
            const file = files[0];
            setSiteInfoFiles(prev => ({ ...prev, [fileType]: file }));
            setPreviews(prev => ({ ...prev, [fileType]: URL.createObjectURL(file) }));
        }
    };

    const handleSaveSiteInfo = async () => {
        try {
            await props.onUpdateSiteInfo(siteInfoForm!, siteInfoFiles);
            setSiteInfoFiles({});
        } catch (err) {
            // Handled globally
        }
    };

    const handleFooterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const value = target instanceof HTMLInputElement && target.type === 'checkbox'
            ? target.checked
            : target.value;
        setFooterForm(prev => ({ ...prev!, [target.name]: value }));
    };

    const handleSaveFooter = async () => {
        if (!footerForm || hasFooterUrlErrors) return;
        const normalizedFooter = normalizeFooterSocialUrls(footerForm) as FooterContent;
        setFooterForm(normalizedFooter);
        await props.onUpdateFooterContent(normalizedFooter);
    };

    const handleLoginImageSelected = (files: File[]) => {
        if (files[0]) {
            setLoginImageFile(files[0]);
            setLoginPreview(URL.createObjectURL(files[0]));
        }
    };

    const handleSaveAuthImage = () => {
        props.onUpdateAuthPageImages(loginImageFile);
        setLoginImageFile(null);
    };

    const handlePaymentSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPaymentSettingsForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    };

    const loadObservability = async () => {
        setIsObservabilityLoading(true);
        setObservabilityError('');
        try {
            const [logsResponse, summaryResponse] = await Promise.all([
                api.getAdminObservabilityLogs(observabilityLimit, observabilityDays),
                api.getAdminObservabilitySummary(observabilityDays),
            ]);
            setObservabilityLogs(logsResponse.logs);
            setObservabilityMeta(logsResponse);
            setObservabilitySummary(summaryResponse);
            setHasLoadedObservability(true);
        } catch (error: any) {
            setObservabilityError(error?.message || 'Không thể tải dữ liệu observability.');
        } finally {
            setIsObservabilityLoading(false);
        }
    };

    const handleRunCleanup = async (dryRun: boolean) => {
        setIsCleanupRunning(true);
        setObservabilityError('');
        try {
            const result = await api.runAdminObservabilityCleanup({ daysToKeep: retentionDays, dryRun });
            setCleanupResult(result);
            await loadObservability();
        } catch (error: any) {
            setObservabilityError(error?.message || 'Không thể chạy cleanup log runtime.');
        } finally {
            setIsCleanupRunning(false);
        }
    };

    useEffect(() => {
        if (props.initialSection) {
            setActiveTab(props.initialSection);
            return;
        }
        if (props.initialAction === 'observability') {
            setActiveTab('observability');
            return;
        }
        setActiveTab('branding');
    }, [props.initialSection, props.initialAction]);

    useEffect(() => {
        if (activeTab === 'observability' && !hasLoadedObservability && !isObservabilityLoading) {
            loadObservability();
        }
    }, [activeTab, hasLoadedObservability, isObservabilityLoading]);

    // Filter FAQs by search query
    const filteredFaqs = useMemo(() => {
        if (!faqSearchQuery.trim()) return props.faqItems;
        const q = faqSearchQuery.toLowerCase().trim();
        return props.faqItems.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
    }, [props.faqItems, faqSearchQuery]);

    return (
        <AnimatedSection stagger={100}>
            <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">

                {/* CARD 1: Header & Preset Pills Navigation (Apple Glass Standard) */}
                <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0 transition-all relative z-20">
                    {/* Row 1: Horizontal scrollable preset pills (Desktop only, hidden on mobile) */}
                    <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {siteTabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            let badge: string | number | null = null;
                            if (tab.key === 'faq') badge = props.faqItems.length;
                            if (tab.key === 'homepage') badge = localFeaturedSvcIds.length + localFeaturedDocIds.length + localFeaturedPostSlugs.length;
                            if (tab.key === 'about') badge = props.aboutData.reasonsToChoose.length + props.aboutData.coreValues.length;
                            if (tab.key === 'observability' && observabilityLogs.length > 0) badge = observabilityLogs.length;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleTabChange(tab.key)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-xs'
                                            : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    <span className="text-xs">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    {badge !== null && (
                                        <span
                                            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                                isActive
                                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                                    : 'bg-muted text-foreground'
                                            }`}
                                        >
                                            {badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Row 2: Contextual Toolbar depending on current section */}
                    <div className="lg:mt-2.5 lg:pt-2.5 lg:border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                        {activeTab === 'faq' ? (
                            <>
                                <div className="relative flex-1 min-w-[200px] max-w-md">
                                    <input
                                        type="text"
                                        value={faqSearchQuery}
                                        onChange={(e) => setFaqSearchQuery(e.target.value)}
                                        placeholder="Tìm theo câu hỏi hoặc câu trả lời..."
                                        className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                    />
                                    <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                    {faqSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setFaqSearchQuery('')}
                                            className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                                        >
                                            <CloseIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddNewFaq}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 shrink-0"
                                >
                                    <img src={ADD_ICON} alt="" className="w-4 h-4 object-contain" />
                                    <span>{t('admin.add_faq', 'Thêm FAQ')}</span>
                                </button>
                            </>
                        ) : activeTab === 'about' ? (
                            <div className="flex flex-wrap items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {props.aboutData.reasonsToChoose.length} lý do chọn • {props.aboutData.coreValues.length} giá trị cốt lõi
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingFeature({ id: '', title: '', description: '', icon: api.availableIcons[0] })}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
                                    >
                                        <img src={ADD_ICON} alt="" className="w-3.5 h-3.5 object-contain" />
                                        <span>Thêm lý do</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingValue({ id: '', title: '', description: '', icon: api.availableIcons[0] })}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
                                    >
                                        <img src={ADD_ICON} alt="" className="w-3.5 h-3.5 object-contain" />
                                        <span>Thêm giá trị</span>
                                    </button>
                                </div>
                            </div>
                        ) : activeTab === 'homepage' ? (
                            <div className="flex flex-wrap items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {localFeaturedSvcIds.length} dịch vụ • {localFeaturedDocIds.length} bác sĩ • {localFeaturedPostSlugs.length} bài viết nổi bật
                                </span>
                                <button
                                    type="button"
                                    onClick={() => props.onNavigate({ page: 'adminSiteManagement', section: 'homepage' })}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
                                >
                                    <span>Xem trên web</span>
                                </button>
                            </div>
                        ) : activeTab === 'branding' ? (
                            <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Tên thương hiệu:</span>
                                    <span className="text-xs font-bold text-foreground">{siteInfoForm?.clinic_name || 'Chưa đặt'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveSiteInfo}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    <span>{t('admin.save_settings', 'Lưu cài đặt')}</span>
                                </button>
                            </div>
                        ) : activeTab === 'footer' ? (
                            <div className="flex items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">
                                    Hotline: <strong className="text-foreground">{footerForm?.phone || 'Chưa có'}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSaveFooter}
                                    disabled={hasFooterUrlErrors}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <span>{t('admin.save_footer_content', 'Lưu nội dung Footer')}</span>
                                </button>
                            </div>
                        ) : activeTab === 'auth' ? (
                            <div className="flex items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">Ảnh nền đăng nhập & đăng ký</span>
                                <button
                                    type="button"
                                    onClick={handleSaveAuthImage}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    <span>{t('admin.save_login_image', 'Lưu Ảnh Đăng nhập')}</span>
                                </button>
                            </div>
                        ) : activeTab === 'payment' ? (
                            <div className="flex items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">
                                    VietQR: <strong className="text-foreground">{paymentSettingsForm?.bank_name || 'Chưa cấu hình'}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdatePaymentSettings(paymentSettingsForm!)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    <span>{t('admin.save_payment_info', 'Lưu thông tin thanh toán')}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between w-full gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {observabilityLogs.length} logs gần đây • Cửa sổ {observabilityDays} ngày
                                </span>
                                <button
                                    type="button"
                                    onClick={loadObservability}
                                    disabled={isObservabilityLoading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isObservabilityLoading ? 'Đang tải...' : 'Làm mới log'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CARD 2: Main Section Content (Apple Glass Standard) */}
                {activeTab === 'branding' && (
                    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                        <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🏷️</span>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branding hệ thống</p>
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.brand_logo', 'Thương hiệu & Logo')}</h3>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveSiteInfo}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                {t('admin.save_settings', 'Lưu cài đặt')}
                            </button>
                        </div>
                        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.clinic_name', 'Tên Clinic')}</label>
                                <input
                                    name="clinic_name"
                                    value={siteInfoForm?.clinic_name || ''}
                                    onChange={handleSiteInfoChange}
                                    className="mt-1 w-full admin-glass-input text-xs sm:text-sm"
                                    placeholder="Ví dụ: iSkin Clinic"
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 items-start">
                                <div className="rounded-xl border border-border/60 bg-background/30 p-3.5">
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.logo_light', 'Logo (cho nền sáng)')}</label>
                                    <p className="text-[11px] text-muted-foreground mb-2">Dùng cho giao diện nền trắng sáng.</p>
                                    {previews.dark && (
                                        <div className="mb-2 p-2.5 rounded-xl bg-zinc-200 border border-border inline-block shadow-xs">
                                            <img src={previews.dark} alt="Logo Tối" className="h-10 w-auto object-contain" />
                                        </div>
                                    )}
                                    <ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('dark', f)} className="h-24" />
                                </div>

                                <div className="rounded-xl border border-border/60 bg-background/30 p-3.5">
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.logo_dark', 'Logo (cho nền tối)')}</label>
                                    <p className="text-[11px] text-muted-foreground mb-2">Dùng cho giao diện nền tối / Dark Mode.</p>
                                    {previews.light && (
                                        <div className="mb-2 p-2.5 rounded-xl bg-zinc-800 border border-border inline-block shadow-xs">
                                            <img src={previews.light} alt="Logo Sáng" className="h-10 w-auto object-contain" />
                                        </div>
                                    )}
                                    <ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('light', f)} className="h-24" />
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-background/30 p-3.5">
                                <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.favicon', 'Favicon')}</label>
                                <p className="text-[11px] text-muted-foreground mb-2">Biểu tượng tab trình duyệt (tỷ lệ 1:1, .png hoặc .ico).</p>
                                <div className="flex items-center gap-3">
                                    {previews.favicon && (
                                        <img src={previews.favicon} alt="Favicon" className="w-10 h-10 rounded-xl border border-border object-contain bg-background p-1" />
                                    )}
                                    <div className="flex-1 max-w-sm">
                                        <ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('favicon', f)} className="h-20" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveSiteInfo}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('admin.save_settings', 'Lưu cài đặt')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'footer' && (
                    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                        <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">📄</span>
                                <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.footer_content', 'Nội dung Chân trang (Footer)')}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveFooter}
                                disabled={hasFooterUrlErrors}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {t('admin.save_footer_content', 'Lưu nội dung Footer')}
                            </button>
                        </div>
                        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.short_intro', 'Giới thiệu ngắn')}</label>
                                <textarea
                                    name="about_text"
                                    value={footerForm?.about_text || ''}
                                    onChange={handleFooterChange}
                                    rows={2}
                                    className="mt-1 w-full admin-glass-input text-xs sm:text-sm"
                                    placeholder="Đôi dòng giới thiệu hiển thị dưới logo chân trang..."
                                />
                            </div>

                            <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.address', 'Địa chỉ')}</label>
                                    <input name="address" value={footerForm?.address || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.email', 'Email')}</label>
                                    <input name="email" value={footerForm?.email || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.phone', 'Điện thoại')}</label>
                                    <input name="phone" value={footerForm?.phone || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.working_hours_weekday', 'Giờ làm việc (Ngày thường)')}</label>
                                    <input name="working_hours_weekday" value={footerForm?.working_hours_weekday || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.working_hours_weekend', 'Giờ làm việc (Cuối tuần)')}</label>
                                    <input name="working_hours_weekend" value={footerForm?.working_hours_weekend || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-border/40">
                                <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3">{t('admin.social_media', 'Mạng xã hội')}</h4>
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    <SocialUrlField label="Facebook URL" name="facebook_url" value={footerForm?.facebook_url} error={footerUrlErrors.facebook_url} placeholder="https://facebook.com/thegioimun" onChange={handleFooterChange} />
                                    <SocialUrlField label="Instagram URL" name="instagram_url" value={footerForm?.instagram_url} error={footerUrlErrors.instagram_url} placeholder="https://instagram.com/ten-tai-khoan" onChange={handleFooterChange} />
                                    <SocialUrlField label="YouTube URL" name="youtube_url" value={footerForm?.youtube_url} error={footerUrlErrors.youtube_url} placeholder="https://youtube.com/@ten-kenh" onChange={handleFooterChange} />
                                    <SocialUrlField label="TikTok URL" name="tiktok_url" value={footerForm?.tiktok_url} error={footerUrlErrors.tiktok_url} placeholder="https://tiktok.com/@ten-tai-khoan" onChange={handleFooterChange} />
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-background/30 p-3.5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.floating_contact', 'Nút chat nổi')}</h4>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            {t('admin.floating_contact_desc', 'Quản lý nút Zalo và Messenger hiển thị cố định trên giao diện người dùng.')}
                                        </p>
                                    </div>
                                    <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            name="floating_contact_enabled"
                                            checked={footerForm?.floating_contact_enabled !== false}
                                            onChange={handleFooterChange}
                                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                        />
                                        <span>{t('admin.floating_contact_enabled', 'Bật nút nổi')}</span>
                                    </label>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <SocialUrlField label="Zalo URL" name="zalo_url" value={footerForm?.zalo_url} error={footerUrlErrors.zalo_url} placeholder="https://zalo.me/0934086843" hint={t('admin.zalo_url_hint', 'Để trống sẽ tự dùng số điện thoại footer nếu có.')} onChange={handleFooterChange} />
                                    <SocialUrlField label="Messenger URL" name="messenger_url" value={footerForm?.messenger_url} error={footerUrlErrors.messenger_url} placeholder="https://m.me/yourpage" hint={t('admin.messenger_url_hint', 'Để trống sẽ thử suy ra từ Facebook URL nếu có.')} onChange={handleFooterChange} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.copyright', 'Bản quyền')}</label>
                                <input name="copyright_text" value={footerForm?.copyright_text || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveFooter}
                                    disabled={hasFooterUrlErrors}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {t('admin.save_footer_content', 'Lưu nội dung Footer')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'auth' && (
                    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                        <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🔐</span>
                                <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.auth_page_images', 'Ảnh trang Đăng nhập')}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveAuthImage}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                {t('admin.save_login_image', 'Lưu Ảnh Đăng nhập')}
                            </button>
                        </div>
                        <div className="p-3.5 sm:p-6 space-y-4">
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.login_bg_image', 'Ảnh nền trang Đăng nhập')}</label>
                                <p className="text-xs text-muted-foreground mb-3">{t('admin.login_bg_desc', 'Ảnh này sẽ hiển thị bên cạnh form đăng nhập và đăng ký.')}</p>
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    {loginPreview ? (
                                        <div className="w-full sm:w-56 h-36 rounded-xl overflow-hidden border border-border shrink-0 shadow-xs">
                                            <img src={loginPreview} alt="Login background" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-full sm:w-56 h-36 bg-muted/50 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                                            {t('admin.no_image', 'Chưa có ảnh')}
                                        </div>
                                    )}
                                    <div className="flex-grow w-full">
                                        <ImageDropzone onFilesSelected={handleLoginImageSelected} className="h-36" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveAuthImage}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('admin.save_login_image', 'Lưu Ảnh Đăng nhập')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payment' && (
                    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                        <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">💳</span>
                                <div>
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.payment_info', 'Thông tin thanh toán SePay')}</h3>
                                    <p className="text-[10px] text-muted-foreground">QR VietQR tự động qua cổng SePay</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => props.onUpdatePaymentSettings(paymentSettingsForm!)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                {t('admin.save_payment_info', 'Lưu thông tin thanh toán')}
                            </button>
                        </div>
                        <div className="p-3.5 sm:p-6 space-y-4">
                            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">Mã ngân hàng / BIN trên SePay</label>
                                    <input name="bank_bin" value={paymentSettingsForm?.bank_bin || ''} onChange={handlePaymentSettingsChange} placeholder="Ví dụ: 970436 hoặc Vietcombank" className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">Tên ngân hàng hiển thị</label>
                                    <input name="bank_name" value={paymentSettingsForm?.bank_name || ''} onChange={handlePaymentSettingsChange} placeholder="Ví dụ: Vietcombank" className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.account_number', 'Số tài khoản')}</label>
                                    <input name="account_number" value={paymentSettingsForm?.account_number || ''} onChange={handlePaymentSettingsChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.account_holder_name', 'Tên chủ tài khoản')}</label>
                                    <input name="account_holder_name" value={paymentSettingsForm?.account_holder_name || ''} onChange={handlePaymentSettingsChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs sm:text-sm font-medium text-foreground">Tiền tố nội dung riêng của ngân hàng (nếu có)</label>
                                    <input name="sepay_description_prefix" value={paymentSettingsForm?.sepay_description_prefix || ''} onChange={handlePaymentSettingsChange} placeholder="Để trống; VietinBank cá nhân dùng SEVQR" className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    <p className="mt-1 text-[11px] text-muted-foreground">Mã nhận diện đơn TGTM… luôn được hệ thống tự thêm phía sau.</p>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => props.onUpdatePaymentSettings(paymentSettingsForm!)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('admin.save_payment_info', 'Lưu thông tin thanh toán')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'homepage' && (
                    <div className="space-y-4">
                        {/* 1. Hero Section */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🖼️</span>
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.hero_section', 'Hero Section')}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdateHomepageHero(heroForm, heroImageFiles)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('common.save', 'Lưu')}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-6 space-y-4">
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.main_title', 'Tiêu đề chính')}</label>
                                        <input name="title" value={heroForm.title} onChange={handleHeroFormChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.subtitle', 'Phụ đề')}</label>
                                        <input name="subtitle" value={heroForm.subtitle} onChange={handleHeroFormChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border/40">
                                    <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3">Hình ảnh Responsive</h4>
                                    <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
                                        {/* Desktop */}
                                        <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold text-foreground">Máy tính (Desktop)</span>
                                                <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">16:9</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mb-2">1920x1080 px</p>
                                            {heroPreviews.desktop ? (
                                                <img src={heroPreviews.desktop} alt="Desktop Hero" className="w-full h-28 rounded-lg object-cover border border-border mb-2" />
                                            ) : (
                                                <div className="w-full h-28 bg-muted/40 rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground mb-2">Chưa có ảnh</div>
                                            )}
                                            <ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('desktop', f)} className="h-20" />
                                        </div>

                                        {/* Tablet */}
                                        <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold text-foreground">Máy tính bảng (Tablet)</span>
                                                <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">1:1 / 3:4</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mb-2">1024x1024 px</p>
                                            {heroPreviews.tablet ? (
                                                <img src={heroPreviews.tablet} alt="Tablet Hero" className="w-full h-28 rounded-lg object-cover border border-border mb-2" />
                                            ) : (
                                                <div className="w-full h-28 bg-muted/40 rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground mb-2">Chưa có ảnh</div>
                                            )}
                                            <ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('tablet', f)} className="h-20" />
                                        </div>

                                        {/* Mobile */}
                                        <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold text-foreground">Điện thoại (Mobile)</span>
                                                <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">9:16</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mb-2">750x1334 px</p>
                                            {heroPreviews.mobile ? (
                                                <img src={heroPreviews.mobile} alt="Mobile Hero" className="w-full h-28 rounded-lg object-cover border border-border mb-2" />
                                            ) : (
                                                <div className="w-full h-28 bg-muted/40 rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground mb-2">Chưa có ảnh</div>
                                            )}
                                            <ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('mobile', f)} className="h-20" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Featured Services */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.featured_services', 'Dịch vụ nổi bật trên trang chủ')}</h3>
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                        {localFeaturedSvcIds.length} đã chọn
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdateFeaturedServices(localFeaturedSvcIds)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('common.save', 'Lưu')}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                    {props.allServices.map(service => {
                                        const isChecked = localFeaturedSvcIds.includes(service.id);
                                        return (
                                            <label
                                                key={service.id}
                                                className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all active:scale-98 ${
                                                    isChecked
                                                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                                                        : 'border-border/60 bg-background/40 hover:bg-muted/30 text-foreground'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleServiceSelect(service.id)}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary shrink-0"
                                                />
                                                <span className="text-xs truncate">{service.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 3. Featured Doctors */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.featured_doctors', 'Bác sĩ nổi bật trên trang chủ')}</h3>
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                        {localFeaturedDocIds.length} đã chọn
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdateFeaturedDoctors(localFeaturedDocIds)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('common.save', 'Lưu')}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                    {selectableDoctors.map(doctor => {
                                        const isChecked = localFeaturedDocIds.includes(doctor.id);
                                        return (
                                            <label
                                                key={doctor.id}
                                                className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all active:scale-98 ${
                                                    isChecked
                                                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                                                        : 'border-border/60 bg-background/40 hover:bg-muted/30 text-foreground'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleDoctorSelect(doctor.id)}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold truncate">{doctor.name}</p>
                                                    {doctor.doctor_profile?.specialization && (
                                                        <p className="text-[10px] text-muted-foreground truncate">{doctor.doctor_profile.specialization}</p>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 4. Featured Posts */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.featured_posts', 'Bài viết nổi bật trên trang chủ')}</h3>
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                        {localFeaturedPostSlugs.length} đã chọn
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdateFeaturedPosts(localFeaturedPostSlugs)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('common.save', 'Lưu')}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-5">
                                <AutocompletePostSelector
                                    allPosts={props.allPosts}
                                    selectedSlugs={localFeaturedPostSlugs}
                                    onSelectionChange={setLocalFeaturedPostSlugs}
                                    t={t}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="space-y-4">
                        {/* 1. Main About Content */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">ℹ️</span>
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.main_content', 'Nội dung chính')}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => props.onUpdateAboutContent(aboutContentForm, aboutImageFile)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    {t('common.save', 'Lưu')}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-6 space-y-4">
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.page_title', 'Tiêu đề trang')}</label>
                                        <input name="header_title" value={aboutContentForm.header_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.mission_vision_title', 'Tiêu đề Sứ mệnh/Tầm nhìn')}</label>
                                        <input name="mission_title" value={aboutContentForm.mission_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.page_subtitle', 'Phụ đề trang')}</label>
                                    <textarea name="header_subtitle" value={aboutContentForm.header_subtitle} onChange={handleAboutContentChange} rows={2} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.mission_content', 'Nội dung Sứ mệnh')}</label>
                                        <textarea name="mission_text" value={aboutContentForm.mission_text} onChange={handleAboutContentChange} rows={3} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.vision_content', 'Nội dung Tầm nhìn')}</label>
                                        <textarea name="vision_text" value={aboutContentForm.vision_text} onChange={handleAboutContentChange} rows={3} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.core_values_title', 'Tiêu đề Giá trị cốt lõi')}</label>
                                        <input name="values_title" value={aboutContentForm.values_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.core_values_subtitle', 'Phụ đề Giá trị cốt lõi')}</label>
                                        <input name="values_subtitle" value={aboutContentForm.values_subtitle} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs sm:text-sm font-medium text-foreground">{t('admin.page_bg_image', 'Ảnh nền trang')}</label>
                                    <div className="flex flex-col sm:flex-row items-start gap-4 mt-2">
                                        {aboutPreview ? (
                                            <img src={aboutPreview} alt="About page background" className="w-full sm:w-48 h-28 rounded-xl object-cover border border-border shrink-0 shadow-xs" />
                                        ) : (
                                            <div className="w-full sm:w-48 h-28 bg-muted/40 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">Chưa có ảnh</div>
                                        )}
                                        <div className="flex-grow w-full"><ImageDropzone onFilesSelected={handleAboutImageSelected} className="h-28" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Reasons to Choose Us */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.reasons_to_choose', 'Lý do chọn chúng tôi')}</h3>
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                        {props.aboutData.reasonsToChoose.length} mục
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingFeature({ id: '', title: '', description: '', icon: api.availableIcons[0] })}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    <img src={ADD_ICON} alt="" className="w-3.5 h-3.5 object-contain" />
                                    <span>{t('admin.add_new', 'Thêm mới')}</span>
                                </button>
                            </div>

                            {editingFeature && (
                                <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border/40">
                                    <form onSubmit={handleSaveFeature} className="p-4 border border-primary/40 rounded-xl bg-card shadow-sm space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.title', 'Tiêu đề')}</label>
                                            <input value={editingFeature.title || ''} onChange={e => setEditingFeature(f => ({ ...f!, title: e.target.value }))} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.description', 'Mô tả')}</label>
                                            <textarea value={editingFeature.description || ''} onChange={e => setEditingFeature(f => ({ ...f!, description: e.target.value }))} rows={2} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.icon', 'Icon')}</label>
                                            <select value={editingFeature.icon || ''} onChange={e => setEditingFeature(f => ({ ...f!, icon: e.target.value }))} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required>
                                                {api.availableIcons.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 justify-end pt-1">
                                            <button type="button" onClick={() => setEditingFeature(null)} className="rounded-xl border border-border/70 bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">{t('common.cancel', 'Hủy')}</button>
                                            <button type="submit" className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90">{t('common.save', 'Lưu')}</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Mobile List View */}
                            <AdminMobileList className="p-0 divide-y divide-border/25 lg:hidden">
                                {props.aboutData.reasonsToChoose.map(feature => (
                                    <AdminMobileCard key={feature.id} className="px-3 py-2.5 transition-colors hover:bg-muted/20">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs sm:text-sm font-bold text-foreground">{feature.title}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingFeature(feature)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                    aria-label={`Chỉnh sửa ${feature.title}`}
                                                >
                                                    <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Xóa lý do "${feature.title}"?`)) props.onDeleteAboutFeature(feature.id);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                    aria-label={`Xóa ${feature.title}`}
                                                >
                                                    <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    </AdminMobileCard>
                                ))}
                            </AdminMobileList>

                            {/* Desktop View */}
                            <div className="hidden lg:block p-3 sm:p-5">
                                <div className="divide-y divide-border/40">
                                    {props.aboutData.reasonsToChoose.map(feature => (
                                        <div key={feature.id} className="py-3 flex justify-between items-start gap-4 hover:bg-muted/20 px-2 rounded-xl transition-colors">
                                            <div>
                                                <p className="font-bold text-sm text-foreground">{feature.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                                            </div>
                                            <div className="flex-shrink-0 flex gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingFeature(feature)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                    title={`Chỉnh sửa ${feature.title}`}
                                                >
                                                    <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Xóa lý do "${feature.title}"?`)) props.onDeleteAboutFeature(feature.id);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                    title={`Xóa ${feature.title}`}
                                                >
                                                    <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. Core Values */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.core_values', 'Giá trị cốt lõi')}</h3>
                                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                        {props.aboutData.coreValues.length} mục
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingValue({ id: '', title: '', description: '', icon: api.availableIcons[0] })}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                >
                                    <img src={ADD_ICON} alt="" className="w-3.5 h-3.5 object-contain" />
                                    <span>{t('admin.add_new', 'Thêm mới')}</span>
                                </button>
                            </div>

                            {editingValue && (
                                <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border/40">
                                    <form onSubmit={handleSaveValue} className="p-4 border border-primary/40 rounded-xl bg-card shadow-sm space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.title', 'Tiêu đề')}</label>
                                            <input value={editingValue.title || ''} onChange={e => setEditingValue(v => ({ ...v!, title: e.target.value }))} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.description', 'Mô tả')}</label>
                                            <textarea value={editingValue.description || ''} onChange={e => setEditingValue(v => ({ ...v!, description: e.target.value }))} rows={2} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-foreground">{t('admin.icon', 'Icon')}</label>
                                            <select value={editingValue.icon || ''} onChange={e => setEditingValue(v => ({ ...v!, icon: e.target.value }))} className="mt-1 w-full admin-glass-input text-xs sm:text-sm" required>
                                                {api.availableIcons.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 justify-end pt-1">
                                            <button type="button" onClick={() => setEditingValue(null)} className="rounded-xl border border-border/70 bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">{t('common.cancel', 'Hủy')}</button>
                                            <button type="submit" className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90">{t('common.save', 'Lưu')}</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Mobile List View */}
                            <AdminMobileList className="p-0 divide-y divide-border/25 lg:hidden">
                                {props.aboutData.coreValues.map(value => (
                                    <AdminMobileCard key={value.id} className="px-3 py-2.5 transition-colors hover:bg-muted/20">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs sm:text-sm font-bold text-foreground">{value.title}</p>
                                                {value.description && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{value.description}</p>}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingValue(value)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                    aria-label={`Chỉnh sửa ${value.title}`}
                                                >
                                                    <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Xóa giá trị "${value.title}"?`)) props.onDeleteAboutValue(value.id);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                    aria-label={`Xóa ${value.title}`}
                                                >
                                                    <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    </AdminMobileCard>
                                ))}
                            </AdminMobileList>

                            {/* Desktop View */}
                            <div className="hidden lg:block p-3 sm:p-5">
                                <div className="divide-y divide-border/40">
                                    {props.aboutData.coreValues.map(value => (
                                        <div key={value.id} className="py-3 flex justify-between items-start gap-4 hover:bg-muted/20 px-2 rounded-xl transition-colors">
                                            <div>
                                                <p className="font-bold text-sm text-foreground">{value.title}</p>
                                                {value.description && <p className="text-xs text-muted-foreground mt-0.5">{value.description}</p>}
                                            </div>
                                            <div className="flex-shrink-0 flex gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingValue(value)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                    title={`Chỉnh sửa ${value.title}`}
                                                >
                                                    <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Xóa giá trị "${value.title}"?`)) props.onDeleteAboutValue(value.id);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                    title={`Xóa ${value.title}`}
                                                >
                                                    <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'faq' && (
                    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                        <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">❓</span>
                                <h3 className="text-xs sm:text-sm font-bold text-foreground">{t('admin.manage_faq', 'Quản lý FAQ')}</h3>
                                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                                    {filteredFaqs.length} / {props.faqItems.length} câu hỏi
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddNewFaq}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                <img src={ADD_ICON} alt="" className="w-3.5 h-3.5 object-contain" />
                                <span>{t('admin.add_faq', 'Thêm FAQ')}</span>
                            </button>
                        </div>

                        {editingFaq && (
                            <div className="p-3.5 sm:p-5 bg-muted/20 border-b border-border/40">
                                <div className="p-4 border border-primary/40 rounded-xl bg-card shadow-sm">
                                    <h4 className="font-bold text-xs sm:text-sm text-foreground mb-3">
                                        {isNewFaq ? t('admin.add_new_faq', 'Thêm FAQ mới') : t('admin.edit_faq', 'Chỉnh sửa FAQ')}
                                    </h4>
                                    <form onSubmit={handleSaveFaqForm} className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-foreground">{t('admin.question', 'Câu hỏi')}</label>
                                            <input
                                                type="text"
                                                value={editingFaq?.question || ''}
                                                onChange={e => setEditingFaq(f => f ? { ...f, question: e.target.value } : null)}
                                                className="mt-1 w-full admin-glass-input text-xs sm:text-sm"
                                                placeholder="Ví dụ: Liệu trình trị mụn bao lâu thì có hiệu quả?"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-foreground">{t('admin.answer', 'Trả lời')}</label>
                                            <textarea
                                                value={editingFaq?.answer || ''}
                                                onChange={e => setEditingFaq(f => f ? { ...f, answer: e.target.value } : null)}
                                                rows={4}
                                                className="mt-1 w-full admin-glass-input text-xs sm:text-sm"
                                                placeholder="Nội dung giải đáp chi tiết cho khách hàng..."
                                                required
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={() => { setEditingFaq(null); setIsNewFaq(false); }}
                                                className="rounded-xl border border-border/70 bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {t('common.cancel', 'Hủy')}
                                            </button>
                                            <button
                                                type="submit"
                                                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                                            >
                                                {t('common.save', 'Lưu')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {filteredFaqs.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-xs sm:text-sm">
                                {faqSearchQuery ? 'Không tìm thấy câu hỏi phù hợp.' : 'Chưa có câu hỏi FAQ nào.'}
                            </div>
                        ) : (
                            <>
                                {/* Mobile List View */}
                                <AdminMobileList className="p-0 divide-y divide-border/25 lg:hidden">
                                    {filteredFaqs.map((faq, idx) => (
                                        <AdminMobileCard key={faq.id} className="px-3 py-2.5 sm:p-3.5 transition-colors hover:bg-muted/20">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 font-mono text-[10px] font-bold text-muted-foreground mt-0.5">
                                                    #{idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                                        {faq.question}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                        {faq.answer}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditFaq(faq)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                        aria-label={`Chỉnh sửa câu hỏi ${faq.question}`}
                                                        title={`Chỉnh sửa câu hỏi ${faq.question}`}
                                                    >
                                                        <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm(`Bạn có chắc muốn xóa câu hỏi "${faq.question}"?`)) {
                                                                props.onDeleteFaq(faq.id);
                                                            }
                                                        }}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                        aria-label={`Xóa câu hỏi ${faq.question}`}
                                                        title={`Xóa câu hỏi ${faq.question}`}
                                                    >
                                                        <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                    </button>
                                                </div>
                                            </div>
                                        </AdminMobileCard>
                                    ))}
                                </AdminMobileList>

                                {/* Desktop Table View */}
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-left text-xs sm:text-sm">
                                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                                            <tr>
                                                <th className="w-12 px-4 py-3 text-center">#</th>
                                                <th className="w-[35%] px-4 py-3 font-semibold">Câu hỏi</th>
                                                <th className="px-4 py-3 font-semibold">Câu trả lời</th>
                                                <th className="w-24 px-4 py-3 font-semibold text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {filteredFaqs.map((faq, idx) => (
                                                <tr key={faq.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                                                        #{idx + 1}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-foreground align-top">
                                                        {faq.question}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground leading-relaxed align-top">
                                                        {faq.answer}
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-top">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditFaq(faq)}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-primary/10 transition-all active:scale-95"
                                                                title={`Chỉnh sửa câu hỏi ${faq.question}`}
                                                                aria-label={`Chỉnh sửa câu hỏi ${faq.question}`}
                                                            >
                                                                <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (window.confirm(`Bạn có chắc muốn xóa câu hỏi "${faq.question}"?`)) {
                                                                        props.onDeleteFaq(faq.id);
                                                                    }
                                                                }}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card/60 border border-border/60 hover:bg-destructive/10 transition-all active:scale-95"
                                                                title={`Xóa câu hỏi ${faq.question}`}
                                                                aria-label={`Xóa câu hỏi ${faq.question}`}
                                                            >
                                                                <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'observability' && (
                    <div className="space-y-4">
                        {/* Top Metrics Overview */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-xl bg-primary/10 p-2 text-primary">
                                        <ShieldCheckIcon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-bold text-foreground">Observability runtime</h3>
                                        <p className="text-[10px] text-muted-foreground">Giám sát sức khỏe Worker & API public</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadObservability}
                                    disabled={isObservabilityLoading}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isObservabilityLoading ? 'Đang tải...' : 'Làm mới'}
                                </button>
                            </div>
                            <div className="p-3.5 sm:p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Log đang xem</p>
                                        <p className="mt-1 text-xl font-extrabold text-foreground">{observabilityLogs.length}</p>
                                        <p className="text-[10px] text-muted-foreground">Dữ liệu gần đây</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request đã đo</p>
                                        <p className="mt-1 text-xl font-extrabold text-foreground">{observabilitySummary?.totals.request_count ?? 0}</p>
                                        <p className="text-[10px] text-muted-foreground">Tổng sample GET public</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cache hit</p>
                                        <p className="mt-1 text-xl font-extrabold text-foreground">{formatMetricPercent(observabilitySummary?.totals.cache_hit_rate)}</p>
                                        <p className="text-[10px] text-muted-foreground">Tỷ lệ hit tổng</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P95 public</p>
                                        <p className="mt-1 text-xl font-extrabold text-foreground">{formatMetricDuration(observabilitySummary?.totals.p95_ms)}</p>
                                        <p className="text-[10px] text-muted-foreground">Latency thực tế</p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-border/40 grid gap-2.5 sm:grid-cols-3">
                                    <label className="rounded-xl border border-border/60 bg-background/40 p-2.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Khoảng ngày</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={observabilityDays}
                                            onChange={(e) => setObservabilityDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
                                            className="mt-1 w-full admin-glass-input text-xs"
                                        />
                                    </label>
                                    <label className="rounded-xl border border-border/60 bg-background/40 p-2.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Số log</span>
                                        <input
                                            type="number"
                                            min={5}
                                            max={100}
                                            step={5}
                                            value={observabilityLimit}
                                            onChange={(e) => setObservabilityLimit(Math.max(5, Math.min(100, Number(e.target.value) || 20)))}
                                            className="mt-1 w-full admin-glass-input text-xs"
                                        />
                                    </label>
                                    <div className="flex items-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleRunCleanup(true)}
                                            disabled={isCleanupRunning || isObservabilityLoading}
                                            className="flex-1 rounded-xl border border-border/60 bg-background/60 p-2.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            Phân tích
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRunCleanup(false)}
                                            disabled={isCleanupRunning || isObservabilityLoading}
                                            className="flex-1 rounded-xl bg-destructive px-3 py-2.5 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            Dọn log
                                        </button>
                                    </div>
                                </div>

                                {observabilityError && (
                                    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                                        {observabilityError}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Logs List */}
                        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                            <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
                                <h3 className="text-xs sm:text-sm font-bold text-foreground">Log gần đây</h3>
                                <span className="text-[10px] text-muted-foreground">
                                    Prefix: {observabilityMeta?.scanned_prefixes ?? 0}
                                </span>
                            </div>

                            {isObservabilityLoading ? (
                                <div className="p-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <LoadingIcon className="h-4 w-4 animate-spin text-primary" />
                                    <span>Đang tải log runtime...</span>
                                </div>
                            ) : observabilityLogs.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground">
                                    Chưa có log nào trong cửa sổ đang chọn.
                                </div>
                            ) : (
                                <AdminMobileList className="p-0 divide-y divide-border/25">
                                    {observabilityLogs.map((entry) => (
                                        <AdminMobileCard key={entry.key} className="px-3.5 py-3 transition-colors hover:bg-muted/20">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                                        {entry.channel}
                                                    </span>
                                                    {entry.status && (
                                                        <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                                            {entry.status}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground">{formatAdminTimestamp(entry.recorded_at)}</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">{entry.key}</span>
                                            </div>
                                            <p className="mt-2 text-xs sm:text-sm font-semibold text-foreground">
                                                {summarizeObservabilityEntry(entry)}
                                            </p>
                                            {(entry.details || entry.stack || entry.body_preview) && (
                                                <details className="mt-2 text-[11px] text-muted-foreground">
                                                    <summary className="cursor-pointer font-semibold hover:text-foreground">Chi tiết kỹ thuật</summary>
                                                    <pre className="mt-1.5 p-2 rounded-lg bg-background/60 text-[10px] overflow-x-auto whitespace-pre-wrap max-h-40">
                                                        {entry.details || entry.stack || entry.body_preview}
                                                    </pre>
                                                </details>
                                            )}
                                        </AdminMobileCard>
                                    ))}
                                </AdminMobileList>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AnimatedSection>
    );
};

export default AdminSiteManagementPage;
