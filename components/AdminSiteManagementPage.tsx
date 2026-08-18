import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { AdminNavigationView, AdminSiteSection, Service, DoctorDetail, BlogPost, FAQItem, HomepageHero, AboutPageData, AboutContent, AboutFeature, AboutValue, SiteInfo, FooterContent, AuthPageImages, PaymentSettings, ObservabilityLogEntry, ObservabilityCleanupResult, ObservabilityLogsResponse, ObservabilityMetricsSummaryResponse } from '../types';
import { WrenchScrewdriverIcon, PlusCircleIcon, PencilIcon, TrashIcon, SearchIcon, CloseIcon, ShieldCheckIcon, LoadingIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import * as api from '../services/api';
import { ImageDropzone } from './ImageDropzone';
import { useTranslation } from 'react-i18next';
import { getExternalUrlError, normalizeFooterSocialUrls, SOCIAL_URL_FIELDS } from '../src/socialLinks';


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
            <label htmlFor={name}>{label}</label>
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
                className={`mt-1 w-full admin-glass-input ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
            />
            {error ? <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-600">{error}</p> : null}
            {!error && hint ? <p id={hintId} className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
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
        ).slice(0, 5); // Limit to 5 suggestions
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
            {/* Display selected posts as tags */}
            <div className="flex flex-wrap gap-2 mb-2 p-2 border border-border rounded-lg min-h-[44px]">
                {selectedPosts.map(post => (
                    <span key={post.slug} className="flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-full animate-scale-in">
                        {post.title}
                        <button
                            type="button"
                            onClick={() => removePost(post.slug)}
                            className="p-0.5 rounded-full hover:bg-primary/20"
                            aria-label={t('common.delete') + ` ${post.title}`}
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </span>
                ))}
                {selectedSlugs.length === 0 && <span className="text-sm text-muted-foreground p-1.5">{t('admin.no_post_selected', 'Chưa chọn bài viết nào.')}</span>}
            </div>

            {/* Input field */}
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => { if (inputValue.trim().length > 0) setIsDropdownOpen(true); }}
                    placeholder={t('admin.search_select_post', 'Tìm kiếm và chọn bài viết...')}
                    className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md"
                />
            </div>

            {/* Suggestions dropdown */}
            {isDropdownOpen && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto animate-scale-in origin-top">
                    <ul>
                        {suggestions.map(post => (
                            <li
                                key={post.slug}
                                onClick={() => addPost(post.slug)}
                                className="p-3 hover:bg-accent cursor-pointer transition-colors"
                            >
                                <p className="font-semibold">{post.title}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">{post.summary}</p>
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
    const [activeTab, setActiveTab] = useState<AdminSiteSection>(props.initialSection || (props.initialAction === 'observability' ? 'observability' : 'branding'));
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
        { key: 'branding' as const, label: 'Branding' },
        { key: 'footer' as const, label: 'Footer' },
        { key: 'auth' as const, label: 'Auth' },
        { key: 'payment' as const, label: 'Thanh toán' },
        { key: 'homepage' as const, label: t('admin.tab_homepage', 'Trang chủ') },
        { key: 'about' as const, label: t('admin.tab_about', 'Trang Giới thiệu') },
        { key: 'faq' as const, label: t('admin.tab_faq', 'Câu hỏi thường gặp (FAQ)') },
        { key: 'observability' as const, label: 'Observability' },
    ];
    const selectableDoctors = props.allDoctors.filter(d => d.doctor_profile);
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
                title: 'Thanh toán & VietQR',
                description: 'Thông tin nhận tiền được gom thành task riêng để finance/admin chỉnh nhanh mà không cần mở cả khối site settings.',
                eyebrow: 'Payment operations',
                insights: [
                    { label: 'Bank BIN', value: props.paymentSettings?.bank_bin ? 'Đã cấu hình' : 'Thiếu', hint: 'Thông tin QR và tài khoản nhận tiền' },
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
                    onClick={() => props.onNavigate({ page: 'adminSiteManagement', section: 'homepage' })}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                    Mở trang chủ
                </button>
            ) : null}
            {activeTab !== 'observability' ? (
                <button
                    type="button"
                    onClick={() => props.onNavigate({ page: 'adminSiteManagement', section: 'observability', action: 'observability' })}
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

    // States for homepage editing
    const [heroForm, setHeroForm] = useState<Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_tablet_url' | 'image_mobile_url'>>({ title: '', subtitle: '', image_desktop_path: '', image_tablet_path: '', image_mobile_path: '' });
    const [heroImageFiles, setHeroImageFiles] = useState<{ desktop?: File, tablet?: File, mobile?: File }>({});
    const [heroPreviews, setHeroPreviews] = useState<{ desktop: string | null, tablet: string | null, mobile: string | null }>({ desktop: null, tablet: null, mobile: null });
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
    }

    const handleHeroImageSelected = (type: 'desktop' | 'tablet' | 'mobile', files: File[]) => {
        if (files[0]) {
            setHeroImageFiles(prev => ({ ...prev, [type]: files[0] }));
            setHeroPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(files[0]) }));
        }
    }

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
    }

    const handleAddNewFaq = () => {
        setEditingFaq({ id: 0, question: '', answer: '' });
        setIsNewFaq(true);
    }

    const handleSaveFaqForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFaq && editingFaq.question && editingFaq.answer) {
            props.onSaveFaq(editingFaq);
            setEditingFaq(null);
            setIsNewFaq(false);
        }
    }

    const handleAboutContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setAboutContentForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    }

    const handleAboutImageSelected = (files: File[]) => {
        if (files[0]) {
            setAboutImageFile(files[0]);
            setAboutPreview(URL.createObjectURL(files[0]));
        }
    }

    const handleSaveFeature = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFeature && editingFeature.title && editingFeature.description && editingFeature.icon) {
            props.onSaveAboutFeature(editingFeature);
            setEditingFeature(null);
        }
    }

    const handleSaveValue = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingValue && editingValue.title && editingValue.description && editingValue.icon) {
            props.onSaveAboutValue(editingValue);
            setEditingValue(null);
        }
    }

    const handleSiteInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSiteInfoForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    }

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
            // Error is handled by App.tsx
        }
    };

    const handleFooterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const value = target instanceof HTMLInputElement && target.type === 'checkbox'
            ? target.checked
            : target.value;
        setFooterForm(prev => ({ ...prev!, [target.name]: value }));
    }

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
    }

    const handleSaveAuthImage = () => {
        props.onUpdateAuthPageImages(loginImageFile);
        setLoginImageFile(null);
    }

    const handlePaymentSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPaymentSettingsForm(prev => ({ ...prev!, [e.target.name]: e.target.value }));
    }

    const loadObservability = async () => {
        setIsObservabilityLoading(true);
        setObservabilityError('');
        try {
            const [logsResponse, summaryResponse] = await Promise.all([
                api.getAdminObservabilityLogs(observabilityLimit, observabilityDays),
                api.getAdminObservabilitySummary(observabilityDays),
            ]);
            setObservabilityLogs(logsResponse.logs || []);
            setObservabilityMeta(logsResponse);
            setObservabilitySummary(summaryResponse);
            setHasLoadedObservability(true);
            if (logsResponse.retention?.days_to_keep) {
                setRetentionDays(logsResponse.retention.days_to_keep);
            }
        } catch (error: any) {
            setObservabilityError(error?.message || 'Không thể tải log runtime gần đây.');
        } finally {
            setIsObservabilityLoading(false);
        }
    };

    const handleRunCleanup = async (dryRun: boolean) => {
        setIsCleanupRunning(true);
        setObservabilityError('');
        try {
            const result = await api.runAdminObservabilityCleanup({
                daysToKeep: retentionDays,
                dryRun,
            });
            setCleanupResult(result);
            if (result.retention?.days_to_keep) {
                setRetentionDays(result.retention.days_to_keep);
            }
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
    return (
            <AnimatedSection stagger={100}>
                    {activeTab === 'branding' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.brand_logo', 'Thương hiệu & Logo')}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.clinic_name', 'Tên Clinic')}</label>
                                        <input name="clinic_name" value={siteInfoForm?.clinic_name || ''} onChange={handleSiteInfoChange} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4 items-start">
                                        <div>
                                            <label className="text-sm font-medium">{t('admin.logo_light', 'Logo (cho nền sáng)')}</label>
                                            {previews.dark && <div className="mt-2 p-2 rounded-md bg-zinc-200 border border-border inline-block"><img src={previews.dark} alt="Logo Tối" className="h-10 w-auto" /></div>}
                                            <div className="mt-2"><ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('dark', f)} className="h-24" /></div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">{t('admin.logo_dark', 'Logo (cho nền tối)')}</label>
                                            {previews.light && <div className="mt-2 p-2 rounded-md bg-zinc-800 border border-border inline-block"><img src={previews.light} alt="Logo Sáng" className="h-10 w-auto" /></div>}
                                            <div className="mt-2"><ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('light', f)} className="h-24" /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.favicon', 'Favicon')}</label>
                                        {previews.favicon && <img src={previews.favicon} alt="Favicon" className="mt-2 w-8 h-8 rounded-md border border-border" />}
                                        <div className="mt-2 max-w-xs"><ImageDropzone onFilesSelected={(f) => handleSiteInfoFileSelected('favicon', f)} className="h-24" /></div>
                                    </div>
                                </div>
                                <button onClick={handleSaveSiteInfo} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('admin.save_settings', 'Lưu cài đặt')}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'footer' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.footer_content', 'Nội dung Chân trang (Footer)')}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.short_intro', 'Giới thiệu ngắn')}</label>
                                        <textarea name="about_text" value={footerForm?.about_text || ''} onChange={handleFooterChange} rows={2} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div><label>{t('admin.address', 'Địa chỉ')}</label><input name="address" value={footerForm?.address || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.email', 'Email')}</label><input name="email" value={footerForm?.email || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.phone', 'Điện thoại')}</label><input name="phone" value={footerForm?.phone || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" /></div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label>{t('admin.working_hours_weekday', 'Giờ làm việc (Ngày thường)')}</label><input name="working_hours_weekday" value={footerForm?.working_hours_weekday || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.working_hours_weekend', 'Giờ làm việc (Cuối tuần)')}</label><input name="working_hours_weekend" value={footerForm?.working_hours_weekend || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" /></div>
                                    </div>
                                    <h4 className="text-lg font-semibold pt-2">{t('admin.social_media', 'Mạng xã hội')}</h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <SocialUrlField label="Facebook URL" name="facebook_url" value={footerForm?.facebook_url} error={footerUrlErrors.facebook_url} placeholder="https://facebook.com/thegioimun" onChange={handleFooterChange} />
                                        <SocialUrlField label="Instagram URL" name="instagram_url" value={footerForm?.instagram_url} error={footerUrlErrors.instagram_url} placeholder="https://instagram.com/ten-tai-khoan" onChange={handleFooterChange} />
                                        <SocialUrlField label="YouTube URL" name="youtube_url" value={footerForm?.youtube_url} error={footerUrlErrors.youtube_url} placeholder="https://youtube.com/@ten-kenh" onChange={handleFooterChange} />
                                        <SocialUrlField label="TikTok URL" name="tiktok_url" value={footerForm?.tiktok_url} error={footerUrlErrors.tiktok_url} placeholder="https://tiktok.com/@ten-tai-khoan" onChange={handleFooterChange} />
                                    </div>
                                    <div className="rounded-[1.5rem] border border-border bg-background p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h4 className="text-base font-bold">{t('admin.floating_contact', 'Nút chat nổi')}</h4>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {t('admin.floating_contact_desc', 'Quản lý nút Zalo và Messenger hiển thị cố định trên giao diện người dùng.')}
                                                </p>
                                            </div>
                                            <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold">
                                                <input
                                                    type="checkbox"
                                                    name="floating_contact_enabled"
                                                    checked={footerForm?.floating_contact_enabled !== false}
                                                    onChange={handleFooterChange}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                                />
                                                {t('admin.floating_contact_enabled', 'Bật nút nổi')}
                                            </label>
                                        </div>
                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                            <SocialUrlField label="Zalo URL" name="zalo_url" value={footerForm?.zalo_url} error={footerUrlErrors.zalo_url} placeholder="https://zalo.me/0934086843" hint={t('admin.zalo_url_hint', 'Để trống sẽ tự dùng số điện thoại footer nếu có.')} onChange={handleFooterChange} />
                                            <SocialUrlField label="Messenger URL" name="messenger_url" value={footerForm?.messenger_url} error={footerUrlErrors.messenger_url} placeholder="https://m.me/yourpage" hint={t('admin.messenger_url_hint', 'Để trống sẽ thử suy ra từ Facebook URL nếu có.')} onChange={handleFooterChange} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.copyright', 'Bản quyền')}</label>
                                        <input name="copyright_text" value={footerForm?.copyright_text || ''} onChange={handleFooterChange} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                </div>
                                <button onClick={handleSaveFooter} disabled={hasFooterUrlErrors} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg disabled:cursor-not-allowed disabled:opacity-50">{t('admin.save_footer_content', 'Lưu nội dung Footer')}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'auth' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.auth_page_images', 'Ảnh trang Đăng nhập')}</h3>
                                <div>
                                    <label className="text-sm font-medium">{t('admin.login_bg_image', 'Ảnh nền trang Đăng nhập')}</label>
                                    <p className="text-xs text-muted-foreground mb-2">{t('admin.login_bg_desc', 'Ảnh này sẽ hiển thị bên cạnh form đăng nhập và đăng ký.')}</p>
                                    <div className="flex items-start gap-4 mt-2">
                                        {loginPreview ?
                                            <img src={loginPreview} alt="Login background" className="w-48 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                                            : <div className="w-48 h-32 bg-muted rounded-md flex items-center justify-center text-muted-foreground">{t('admin.no_image', 'Chưa có ảnh')}</div>
                                        }
                                        <div className="flex-grow w-full"><ImageDropzone onFilesSelected={handleLoginImageSelected} className="h-32" /></div>
                                    </div>
                                </div>
                                <button onClick={handleSaveAuthImage} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('admin.save_login_image', 'Lưu Ảnh Đăng nhập')}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.payment_info', 'Thông tin Thanh toán (VietQR)')}</h3>
                                <div className="space-y-4">
                                    <div><label className="text-sm font-medium">Bank BIN (e.g., Vietcombank is 970436)</label><input name="bank_bin" value={paymentSettingsForm?.bank_bin || ''} onChange={handlePaymentSettingsChange} className="mt-1 w-full admin-glass-input" /></div>
                                    <div><label className="text-sm font-medium">{t('admin.account_number', 'Số tài khoản')}</label><input name="account_number" value={paymentSettingsForm?.account_number || ''} onChange={handlePaymentSettingsChange} className="mt-1 w-full admin-glass-input" /></div>
                                    <div><label className="text-sm font-medium">{t('admin.account_holder_name', 'Tên chủ tài khoản')}</label><input name="account_holder_name" value={paymentSettingsForm?.account_holder_name || ''} onChange={handlePaymentSettingsChange} className="mt-1 w-full admin-glass-input" /></div>
                                </div>
                                <button onClick={() => props.onUpdatePaymentSettings(paymentSettingsForm!)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('admin.save_payment_info', 'Lưu thông tin thanh toán')}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'homepage' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.hero_section', 'Hero Section')}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.main_title', 'Tiêu đề chính')}</label>
                                        <input name="title" value={heroForm.title} onChange={handleHeroFormChange} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.subtitle', 'Phụ đề')}</label>
                                        <input name="subtitle" value={heroForm.subtitle} onChange={handleHeroFormChange} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div className="pt-4 border-t border-border">
                                        <h4 className="font-semibold mb-3">Hình ảnh Responsive</h4>
                                        <div className="space-y-6">
                                            {/* Desktop Banner */}
                                            <div>
                                                <label className="text-sm font-medium">Banner Máy tính (Desktop)</label>
                                                <p className="text-xs text-muted-foreground mb-2">Kích thước gợi ý: <strong>1920x1080 px</strong> (hoặc 1440x810 px chuẩn tỷ lệ 16:9)</p>
                                                <div className="flex items-start gap-4">
                                                    {heroPreviews.desktop ? (
                                                        <img src={heroPreviews.desktop} alt="Desktop Hero" className="w-48 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                                                    ) : <div className="w-48 h-28 bg-muted rounded-md border border-border flex items-center justify-center text-xs text-muted-foreground">Chưa có ảnh</div>}
                                                    <div className="flex-grow w-full"><ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('desktop', f)} className="h-28" /></div>
                                                </div>
                                            </div>

                                            {/* Tablet Banner */}
                                            <div>
                                                <label className="text-sm font-medium">Banner Máy tính bảng (Tablet)</label>
                                                <p className="text-xs text-muted-foreground mb-2">Kích thước gợi ý: <strong>1024x1024 px</strong> (hoặc 768x1024 px chuẩn tỷ lệ 1:1, 3:4)</p>
                                                <div className="flex items-start gap-4">
                                                    {heroPreviews.tablet ? (
                                                        <img src={heroPreviews.tablet} alt="Tablet Hero" className="w-40 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                                                    ) : <div className="w-40 h-40 bg-muted rounded-md border border-border flex items-center justify-center text-xs text-muted-foreground">Chưa có ảnh</div>}
                                                    <div className="flex-grow w-full"><ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('tablet', f)} className="h-40" /></div>
                                                </div>
                                            </div>

                                            {/* Mobile Banner */}
                                            <div>
                                                <label className="text-sm font-medium">Banner Điện thoại (Mobile)</label>
                                                <p className="text-xs text-muted-foreground mb-2">Kích thước gợi ý: <strong>750x1334 px</strong> (hoặc 1080x1920 px chuẩn dọc 9:16)</p>
                                                <div className="flex items-start gap-4">
                                                    {heroPreviews.mobile ? (
                                                        <img src={heroPreviews.mobile} alt="Mobile Hero" className="w-24 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                                                    ) : <div className="w-24 h-40 bg-muted rounded-md border border-border flex items-center justify-center text-xs text-muted-foreground">Chưa có ảnh</div>}
                                                    <div className="flex-grow w-full"><ImageDropzone onFilesSelected={(f) => handleHeroImageSelected('mobile', f)} className="h-40" /></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => props.onUpdateHomepageHero(heroForm, heroImageFiles)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('common.save', 'Lưu')}</button>
                            </div>

                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.featured_services', 'Dịch vụ nổi bật trên trang chủ')}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {props.allServices.map(service => (
                                        <label key={service.id} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${localFeaturedSvcIds.includes(service.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                            <input type="checkbox" checked={localFeaturedSvcIds.includes(service.id)} onChange={() => handleServiceSelect(service.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span>{service.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <button onClick={() => props.onUpdateFeaturedServices(localFeaturedSvcIds)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('common.save', 'Lưu')}</button>
                            </div>

                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.featured_doctors', 'Bác sĩ nổi bật trên trang chủ')}</h3>
                                <p className="text-sm text-muted-foreground mb-4">{t('admin.featured_doctors_desc', 'Chỉ những người dùng có hồ sơ bác sĩ hợp lệ mới được hiển thị ở đây.')}</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {selectableDoctors.map(doctor => (
                                        <label key={doctor.id} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${localFeaturedDocIds.includes(doctor.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                            <input type="checkbox" checked={localFeaturedDocIds.includes(doctor.id)} onChange={() => handleDoctorSelect(doctor.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span>{doctor.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <button onClick={() => props.onUpdateFeaturedDoctors(localFeaturedDocIds)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('common.save', 'Lưu')}</button>
                            </div>

                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.featured_posts', 'Bài viết nổi bật trên trang chủ')}</h3>
                                <AutocompletePostSelector
                                    allPosts={props.allPosts}
                                    selectedSlugs={localFeaturedPostSlugs}
                                    onSelectionChange={setLocalFeaturedPostSlugs}
                                    t={t}
                                />
                                <button onClick={() => props.onUpdateFeaturedPosts(localFeaturedPostSlugs)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('common.save', 'Lưu')}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="space-y-8">
                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <h3 className="text-xl font-bold mb-4">{t('admin.main_content', 'Nội dung chính')}</h3>
                                <div className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label>{t('admin.page_title', 'Tiêu đề trang')}</label><input name="header_title" value={aboutContentForm.header_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.mission_vision_title', 'Tiêu đề Sứ mệnh/Tầm nhìn')}</label><input name="mission_title" value={aboutContentForm.mission_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input" /></div>
                                    </div>
                                    <div><label>{t('admin.page_subtitle', 'Phụ đề trang')}</label><textarea name="header_subtitle" value={aboutContentForm.header_subtitle} onChange={handleAboutContentChange} rows={3} className="mt-1 w-full admin-glass-input" /></div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label>{t('admin.mission_content', 'Nội dung Sứ mệnh')}</label><textarea name="mission_text" value={aboutContentForm.mission_text} onChange={handleAboutContentChange} rows={4} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.vision_content', 'Nội dung Tầm nhìn')}</label><textarea name="vision_text" value={aboutContentForm.vision_text} onChange={handleAboutContentChange} rows={4} className="mt-1 w-full admin-glass-input" /></div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label>{t('admin.core_values_title', 'Tiêu đề Giá trị cốt lõi')}</label><input name="values_title" value={aboutContentForm.values_title} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input" /></div>
                                        <div><label>{t('admin.core_values_subtitle', 'Phụ đề Giá trị cốt lõi')}</label><input name="values_subtitle" value={aboutContentForm.values_subtitle} onChange={handleAboutContentChange} className="mt-1 w-full admin-glass-input" /></div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.page_bg_image', 'Ảnh nền trang')}</label>
                                        <div className="flex items-start gap-4 mt-2">
                                            {aboutPreview && (
                                                <img src={aboutPreview} alt="About page background" className="w-48 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                                            )}
                                            <div className="flex-grow w-full"><ImageDropzone onFilesSelected={handleAboutImageSelected} className="h-32" /></div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => props.onUpdateAboutContent(aboutContentForm, aboutImageFile)} className="mt-4 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-lg">{t('common.save', 'Lưu')}</button>
                            </div>

                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">{t('admin.reasons_to_choose', 'Lý do chọn chúng tôi')}</h3>
                                    <button onClick={() => setEditingFeature({ id: '', title: '', description: '', icon: api.availableIcons[0] })} className="flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/20 transition-colors btn-press"><PlusCircleIcon className="w-5 h-5" />{t('admin.add_new', 'Thêm mới')}</button>
                                </div>
                                {editingFeature && (
                                    <form onSubmit={handleSaveFeature} className="my-4 p-4 border border-primary/50 rounded-lg bg-card space-y-4">
                                        <div><label>{t('admin.title', 'Tiêu đề')}</label><input value={editingFeature.title || ''} onChange={e => setEditingFeature(f => ({ ...f!, title: e.target.value }))} className="mt-1 w-full admin-glass-input" required /></div>
                                        <div><label>{t('admin.description', 'Mô tả')}</label><textarea value={editingFeature.description || ''} onChange={e => setEditingFeature(f => ({ ...f!, description: e.target.value }))} rows={3} className="mt-1 w-full admin-glass-input" required /></div>
                                        <div><label>{t('admin.icon', 'Icon')}</label><select value={editingFeature.icon || ''} onChange={e => setEditingFeature(f => ({ ...f!, icon: e.target.value }))} className="mt-1 w-full admin-glass-input" required>{api.availableIcons.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
                                        <div className="flex gap-2 justify-end"><button type="button" onClick={() => setEditingFeature(null)} className="bg-muted text-muted-foreground font-bold py-2 px-4 rounded-lg">{t('common.cancel', 'Hủy')}</button><button type="submit" className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg">{t('common.save', 'Lưu')}</button></div>
                                    </form>
                                )}
                                <div className="space-y-2">
                                    {props.aboutData.reasonsToChoose.map(feature => (
                                        <div key={feature.id} className="p-3 bg-muted/50 rounded-md flex justify-between items-start gap-4">
                                            <div><p className="font-semibold">{feature.title}</p><p className="text-sm text-muted-foreground">{feature.description}</p></div>
                                            <div className="flex-shrink-0 flex gap-1">
                                                <div className="relative group inline-flex">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingFeature(feature)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                        aria-label={`Chỉnh sửa ${feature.title}`}
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                        Chỉnh sửa
                                                    </span>
                                                </div>
                                                <div className="relative group inline-flex">
                                                    <button
                                                        type="button"
                                                        onClick={() => props.onDeleteAboutFeature(feature.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95"
                                                        aria-label={`Xóa ${feature.title}`}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                        Xóa
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">{t('admin.core_values', 'Giá trị cốt lõi')}</h3>
                                    <button onClick={() => setEditingValue({ id: '', title: '', description: '', icon: api.availableIcons[0] })} className="flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/20 transition-colors btn-press"><PlusCircleIcon className="w-5 h-5" />{t('admin.add_new', 'Thêm mới')}</button>
                                </div>
                                {editingValue && (
                                    <form onSubmit={handleSaveValue} className="my-4 p-4 border border-primary/50 rounded-lg bg-card space-y-4">
                                        <div><label>{t('admin.title', 'Tiêu đề')}</label><input value={editingValue.title || ''} onChange={e => setEditingValue(v => ({ ...v!, title: e.target.value }))} className="mt-1 w-full admin-glass-input" required /></div>
                                        <div><label>{t('admin.description', 'Mô tả')}</label><textarea value={editingValue.description || ''} onChange={e => setEditingValue(v => ({ ...v!, description: e.target.value }))} rows={2} className="mt-1 w-full admin-glass-input" required /></div>
                                        <div><label>{t('admin.icon', 'Icon')}</label><select value={editingValue.icon || ''} onChange={e => setEditingValue(v => ({ ...v!, icon: e.target.value }))} className="mt-1 w-full admin-glass-input" required>{api.availableIcons.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
                                        <div className="flex gap-2 justify-end"><button type="button" onClick={() => setEditingValue(null)} className="bg-muted text-muted-foreground font-bold py-2 px-4 rounded-lg">{t('common.cancel', 'Hủy')}</button><button type="submit" className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg">{t('common.save', 'Lưu')}</button></div>
                                    </form>
                                )}
                                <div className="space-y-2">
                                    {props.aboutData.coreValues.map(value => (
                                        <div key={value.id} className="p-3 bg-muted/50 rounded-md flex justify-between items-start gap-4">
                                            <div><p className="font-semibold">{value.title}</p></div>
                                            <div className="flex-shrink-0 flex gap-1">
                                                <div className="relative group inline-flex">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingValue(value)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                        aria-label={`Chỉnh sửa ${value.title}`}
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                        Chỉnh sửa
                                                    </span>
                                                </div>
                                                <div className="relative group inline-flex">
                                                    <button
                                                        type="button"
                                                        onClick={() => props.onDeleteAboutValue(value.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95"
                                                        aria-label={`Xóa ${value.title}`}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                        Xóa
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'faq' && (
                        <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">{t('admin.manage_faq', 'Quản lý FAQ')}</h3>
                                <button onClick={handleAddNewFaq} className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors btn-press">
                                    <PlusCircleIcon className="w-5 h-5" />
                                    <span>{t('admin.add_faq', 'Thêm FAQ')}</span>
                                </button>
                            </div>

                            {editingFaq && (
                                <div className="mt-4 p-4 border border-primary/50 rounded-lg bg-card">
                                    <h4 className="font-bold mb-2">{isNewFaq ? t('admin.add_new_faq', 'Thêm FAQ mới') : t('admin.edit_faq', 'Chỉnh sửa FAQ')}</h4>
                                    <form onSubmit={handleSaveFaqForm} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium">{t('admin.question', 'Câu hỏi')}</label>
                                            <input type="text" value={editingFaq?.question || ''} onChange={e => setEditingFaq(f => f ? { ...f, question: e.target.value } : null)} className="mt-1 w-full admin-glass-input" required />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">{t('admin.answer', 'Trả lời')}</label>
                                            <textarea value={editingFaq?.answer || ''} onChange={e => setEditingFaq(f => f ? { ...f, answer: e.target.value } : null)} rows={4} className="mt-1 w-full admin-glass-input" required></textarea>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button type="button" onClick={() => setEditingFaq(null)} className="bg-muted text-muted-foreground font-bold py-2 px-4 rounded-lg">{t('common.cancel', 'Hủy')}</button>
                                            <button type="submit" className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg">{t('common.save', 'Lưu')}</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="mt-4 space-y-2">
                                {props.faqItems.map(faq => (
                                    <div key={faq.id} className="p-3 bg-muted/50 rounded-md flex justify-between items-start gap-4">
                                        <div>
                                            <p className="font-semibold">{faq.question}</p>
                                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                        </div>
                                        <div className="flex-shrink-0 flex gap-1">
                                            <div className="relative group inline-flex">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditFaq(faq)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                    aria-label={`Chỉnh sửa câu hỏi ${faq.question}`}
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                    Chỉnh sửa
                                                </span>
                                            </div>
                                            <div className="relative group inline-flex">
                                                <button
                                                    type="button"
                                                    onClick={() => props.onDeleteFaq(faq.id)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95"
                                                    aria-label={`Xóa câu hỏi ${faq.question}`}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                    Xóa
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'observability' && (
                        <div className="space-y-6">
                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
                                <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.42)]">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                                                    <ShieldCheckIcon className="h-6 w-6" />
                                                </span>
                                                <div>
                                                    <h3 className="text-xl font-bold">Observability runtime</h3>
                                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                        Theo dõi log lỗi, cache hit/miss, upstream timeout và p95 của public worker mà không cần vào R2 dashboard.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-4">
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Log đang xem</p>
                                                    <p className="mt-2 text-2xl font-bold">{observabilityLogs.length}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Dữ liệu gần đây từ production.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Request đã đo</p>
                                                    <p className="mt-2 text-2xl font-bold">{observabilitySummary?.totals.request_count ?? 0}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Tổng sample GET public trong cửa sổ đang xem.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cache hit</p>
                                                    <p className="mt-2 text-2xl font-bold">{formatMetricPercent(observabilitySummary?.totals.cache_hit_rate)}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Hit rate tổng của bootstrap và public rest.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">P95 public</p>
                                                    <p className="mt-2 text-2xl font-bold">{formatMetricDuration(observabilitySummary?.totals.p95_ms)}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Latency thực tế toàn bộ public endpoint.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3 md:col-span-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Upstream timeout</p>
                                                    <p className="mt-2 text-2xl font-bold">{formatMetricPercent(observabilitySummary?.totals.upstream_timeout_rate)}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Tỷ lệ request public bị timeout khi chạm upstream.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3 md:col-span-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Auto retention</p>
                                                    <p className="mt-2 text-2xl font-bold">{observabilityMeta?.retention?.days_to_keep ?? retentionDays}d</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">Cleanup áp dụng cho cả log lỗi lẫn metric request.</p>
                                                </div>
                                                <div className="rounded-2xl border border-border bg-background px-4 py-3 md:col-span-4">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Metrics scan</p>
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        Metrics scan: <span className="font-semibold text-foreground">{observabilitySummary?.scanned_objects ?? 0}</span> object
                                                        {' '}• prefix: <span className="font-semibold text-foreground">{observabilitySummary?.scanned_prefixes ?? 0}</span>
                                                        {' '}• sample còn sâu hơn: <span className="font-semibold text-foreground">{observabilitySummary?.has_more ? 'Có' : 'Không'}</span>
                                                        {' '}• cập nhật: <span className="font-semibold text-foreground">{formatAdminTimestamp(observabilitySummary?.generated_at || null)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid w-full gap-3 md:max-w-md md:grid-cols-2">
                                            <label className="rounded-2xl border border-border bg-background px-4 py-3">
                                                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Khoảng ngày</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={30}
                                                    value={observabilityDays}
                                                    onChange={(e) => setObservabilityDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
                                                    className="mt-2 w-full admin-glass-input"
                                                />
                                            </label>
                                            <label className="rounded-2xl border border-border bg-background px-4 py-3">
                                                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Số log</span>
                                                <input
                                                    type="number"
                                                    min={5}
                                                    max={100}
                                                    step={5}
                                                    value={observabilityLimit}
                                                    onChange={(e) => setObservabilityLimit(Math.max(5, Math.min(100, Number(e.target.value) || 20)))}
                                                    className="mt-2 w-full admin-glass-input"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={loadObservability}
                                                disabled={isObservabilityLoading || isCleanupRunning}
                                                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isObservabilityLoading ? 'Đang tải log...' : 'Làm mới log'}
                                            </button>
                                            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                                                <p className="font-semibold text-foreground">Lần cleanup gần nhất</p>
                                                <p className="mt-2">{formatAdminTimestamp(observabilityMeta?.retention?.last_run_at || cleanupResult?.retention?.last_run_at || null)}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.2em]">{observabilityMeta?.retention?.last_status || cleanupResult?.retention?.last_status || 'idle'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {observabilityError ? (
                                        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                            {observabilityError}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.42)]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-xl font-bold">Retention & cleanup</h3>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                Dọn cả `monitoring-errors/` và `monitoring-metrics/` bằng dry-run trước khi xóa thật.
                                            </p>
                                        </div>
                                        {isCleanupRunning ? <LoadingIcon className="h-5 w-5 animate-spin text-primary" /> : null}
                                    </div>

                                    <label className="mt-4 block rounded-2xl border border-border bg-background px-4 py-3">
                                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Giữ log trong</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={90}
                                            value={retentionDays}
                                            onChange={(e) => setRetentionDays(Math.max(1, Math.min(90, Number(e.target.value) || 14)))}
                                            className="mt-2 w-full admin-glass-input"
                                        />
                                    </label>

                                    <div className="mt-4 grid gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleRunCleanup(true)}
                                            disabled={isCleanupRunning || isObservabilityLoading}
                                            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Phân tích trước
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRunCleanup(false)}
                                            disabled={isCleanupRunning || isObservabilityLoading}
                                            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Xóa log cũ
                                        </button>
                                    </div>

                                    <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                                        <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                            <p className="font-semibold text-foreground">Auto cleanup</p>
                                            <p className="mt-2">Worker sẽ tự chạy nền nếu quá 12 giờ chưa dọn retention.</p>
                                        </div>
                                        {cleanupResult ? (
                                            <div className="rounded-2xl border border-border bg-background px-4 py-3">
                                                <p className="font-semibold text-foreground">
                                                    {cleanupResult.dry_run ? 'Kết quả dry-run' : 'Kết quả cleanup'}
                                                </p>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    <p>Cutoff: <span className="font-medium text-foreground">{formatAdminTimestamp(cleanupResult.cutoff_iso)}</span></p>
                                                    <p>Matched: <span className="font-medium text-foreground">{cleanupResult.matched_count}</span></p>
                                                    <p>Deleted: <span className="font-medium text-foreground">{cleanupResult.deleted_count}</span></p>
                                                    <p>Scanned: <span className="font-medium text-foreground">{cleanupResult.scanned_objects}</span></p>
                                                </div>
                                                {cleanupResult.deleted_keys_sample.length > 0 ? (
                                                    <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5">
                                                        {cleanupResult.deleted_keys_sample.slice(0, 3).map((key) => (
                                                            <p key={key} className="truncate">{key}</p>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.42)]">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold">Hiệu năng public endpoint</h3>
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            Sắp theo p95 giảm dần để thấy endpoint nào đang chậm thật, kể cả khi lỗi chưa bùng ra thành exception.
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Lần ghi nhận gần nhất:{' '}
                                        <span className="font-medium text-foreground">{formatAdminTimestamp(observabilitySummary?.totals.last_seen_at || null)}</span>
                                    </div>
                                </div>

                                {isObservabilityLoading ? (
                                    <div className="mt-6 flex min-h-[180px] items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-border bg-background text-muted-foreground">
                                        <LoadingIcon className="h-5 w-5 animate-spin" />
                                        <span>Đang tổng hợp metric endpoint...</span>
                                    </div>
                                ) : !observabilitySummary || observabilitySummary.endpoints.length === 0 ? (
                                    <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-background px-5 py-10 text-center text-muted-foreground">
                                        Chưa có metric request public nào trong cửa sổ đang chọn.
                                    </div>
                                ) : (
                                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                                        {observabilitySummary.endpoints.map((metric) => (
                                            <div key={metric.endpoint} className="rounded-[1.4rem] border border-border bg-background px-4 py-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                                                            {metric.resource || 'public-endpoint'}
                                                        </p>
                                                        <p className="mt-2 break-all text-base font-semibold text-foreground">{metric.endpoint}</p>
                                                        <p className="mt-2 text-sm text-muted-foreground">
                                                            {metric.request_count} request • cache hit {formatMetricPercent(metric.cache_hit_rate)} • timeout {formatMetricPercent(metric.upstream_timeout_rate)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                                                        <p className="font-semibold uppercase tracking-[0.2em]">Last seen</p>
                                                        <p className="mt-2">{formatAdminTimestamp(metric.last_seen_at)}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-2xl border border-border bg-card px-3 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">P95</p>
                                                        <p className="mt-2 text-xl font-bold text-foreground">{formatMetricDuration(metric.p95_ms)}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-border bg-card px-3 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">P50</p>
                                                        <p className="mt-2 text-xl font-bold text-foreground">{formatMetricDuration(metric.p50_ms)}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-border bg-card px-3 py-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Max</p>
                                                        <p className="mt-2 text-xl font-bold text-foreground">{formatMetricDuration(metric.max_ms)}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                                    <p>Error rate: <span className="font-medium text-foreground">{formatMetricPercent(metric.error_rate)}</span></p>
                                                    <p>Partial response: <span className="font-medium text-foreground">{formatMetricPercent(metric.partial_rate)}</span></p>
                                                    <p>Cache hit/miss: <span className="font-medium text-foreground">{metric.cache_hits}/{metric.cache_misses}</span></p>
                                                    <p>Timeout count: <span className="font-medium text-foreground">{metric.upstream_timeouts}</span></p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.42)]">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold">Log gần đây</h3>
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            Ưu tiên lỗi client, upstream 5xx, timeout runtime và cleanup thủ công gần nhất.
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Prefix quét: <span className="font-medium text-foreground">{observabilityMeta?.scanned_prefixes ?? 0}</span>
                                        {' '}• còn log sâu hơn: <span className="font-medium text-foreground">{observabilityMeta?.has_more ? 'Có' : 'Không'}</span>
                                    </div>
                                </div>

                                {isObservabilityLoading ? (
                                    <div className="mt-6 flex min-h-[180px] items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-border bg-background text-muted-foreground">
                                        <LoadingIcon className="h-5 w-5 animate-spin" />
                                        <span>Đang tải log runtime...</span>
                                    </div>
                                ) : observabilityLogs.length === 0 ? (
                                    <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-background px-5 py-10 text-center text-muted-foreground">
                                        Chưa có log nào trong cửa sổ đang chọn.
                                    </div>
                                ) : (
                                    <div className="mt-6 space-y-4">
                                        {observabilityLogs.map((entry) => (
                                            <div key={entry.key} className="rounded-[1.4rem] border border-border bg-background px-4 py-4">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                                                                {entry.channel}
                                                            </span>
                                                            {entry.status ? (
                                                                <span className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                                    {entry.status}
                                                                </span>
                                                            ) : null}
                                                            <span className="text-xs text-muted-foreground">{formatAdminTimestamp(entry.recorded_at)}</span>
                                                        </div>
                                                        <p className="mt-3 text-base font-semibold text-foreground">{summarizeObservabilityEntry(entry)}</p>
                                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                            {entry.path ? <p>Path: <span className="font-medium text-foreground">{entry.path}</span></p> : null}
                                                            {entry.resource ? <p>Resource: <span className="font-medium text-foreground">{entry.resource}</span></p> : null}
                                                            {entry.context ? <p>Context: <span className="font-medium text-foreground">{entry.context}</span></p> : null}
                                                            {entry.href ? <p className="truncate">Href: <span className="font-medium text-foreground">{entry.href}</span></p> : null}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:max-w-sm">
                                                        <p className="font-semibold uppercase tracking-[0.2em]">Key</p>
                                                        <p className="mt-2 break-all">{entry.key}</p>
                                                    </div>
                                                </div>

                                                {(entry.details || entry.stack || entry.body_preview) ? (
                                                    <details className="mt-4 rounded-2xl border border-border bg-card px-4 py-3">
                                                        <summary className="cursor-pointer text-sm font-semibold text-foreground">Xem chi tiết kỹ thuật</summary>
                                                        <div className="mt-3 space-y-3 text-xs leading-6 text-muted-foreground">
                                                            {entry.details ? <pre className="whitespace-pre-wrap break-words rounded-xl bg-background px-3 py-2">{entry.details}</pre> : null}
                                                            {entry.body_preview ? <pre className="whitespace-pre-wrap break-words rounded-xl bg-background px-3 py-2">{entry.body_preview}</pre> : null}
                                                            {entry.stack ? <pre className="whitespace-pre-wrap break-words rounded-xl bg-background px-3 py-2">{entry.stack}</pre> : null}
                                                        </div>
                                                    </details>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
            </AnimatedSection>
    );
};

export default AdminSiteManagementPage;
