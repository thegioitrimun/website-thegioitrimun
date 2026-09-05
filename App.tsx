


import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useCart } from './contexts/CartContext';
import { useWishlist } from './contexts/WishlistContext';
import {
    HomeIcon, ServiceListIcon, InformationCircleIcon, MailIcon,
    BlogIcon, ChevronDownIcon, MenuIcon, LoadingIcon, ShoppingBagIcon,
    TechnologyIcon, CheckIcon, FacebookIcon, InstagramIcon, YoutubeIcon, TiktokIcon, TwitterIcon,
    SearchIcon, ArrowRightIcon
} from './components/icons';
import SettingsDropdown from './components/ThemeSwitcher';
import UserAvatar from './components/UserAvatar';
import MiniCart from './components/MiniCart';
import { AdminLayoutProvider } from './components/AdminLayoutContext';
import AdminWorkspaceLayout from './components/AdminWorkspaceLayout';
import AdminPancakeManagementPage from './components/AdminPancakeManagementPage';
import HomePageContent from './components/HomePageContent';
import FloatingContactButtons from './components/FloatingContactButtons';
import AccessibleSocialLink from './components/AccessibleSocialLink';
import PublicScrollReveal from './components/PublicScrollReveal';
import ProductDetailLoadingShell from './components/ProductDetailLoadingShell';
import type { View, UserData, Appointment, BlogPost, BlogCategory, FAQItem, Service, Doctor, AboutPageData, PatientProfile, DoctorDetail, DoctorProfile, HomepageHero, AboutContent, AboutFeature, AboutValue, SiteInfo, FooterContent, PatientDocument, AuthPageImages, Product, ProductCategory, ProductOrder, ProductOrderItem, ProductImage, PaymentSettings, ProductBrand } from './types';
import { getFallbackBlogImage } from './types';
import AnimatedSection from './components/AnimatedSection';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useMediaQuery } from './hooks/useMediaQuery';
import { applyGlobalOrganizationSchema, applyGlobalWebsiteSchema, applySeo, normalizeSeoLang, removeJsonLd, upsertJsonLd } from './src/seo';
import { buildBlogKeywordList, buildBlogSeoDescription } from './src/blogSeo';
import { FALLBACK_HOMEPAGE_HERO, HOMEPAGE_HERO_CACHE_KEY } from './src/siteDefaults';
import { installClientMonitoring, reportClientError } from './src/clientMonitoring';
import { createDeferredFunctionProxy, getSupabaseClient, loadApiModule } from './services/runtimeLoaders';
import type { AuthMode } from './components/AuthPage';
import {
    buildViewSearch,
    clearAuthRecoveryUrl,
    getAuthModeFromLocation,
    getBlogDetailPath,
    getInitialView,
    getProductCategorySlug,
    getProductDetailPath,
    isPrivateOrAdminPage,
    pathToView,
    shouldDeferInitialBootstrap,
    viewToPath,
} from './src/appRouting';
import {
    getInitialHomepageHero,
    hasDetailedBlogContent,
    hasDetailedProductPayload,
    isExpectedAbortLikeError,
    mergeBlogCatalog,
    upsertDetailedBlogPost,
} from './src/appBootstrap';
import { buildClientMetaDescription, buildClientSeoTitle, stripHtml, truncateText } from './src/appSeoUtils';
import { normalizeBrandMatchKey } from './src/brandUtils';
import { normalizeExternalUrl } from './src/socialLinks';
import type { ProductDeletionResult } from './services/api';
import {
    loadAdminBlogManagementPage,
    loadAdminDashboardPage,
    loadAdminImageLibraryPage,
    loadAdminProductImageImporterPage,
    loadAdminPharmacyManagementPage,
    loadAdminServiceManagementPage,
    loadAdminSiteManagementPage,
    loadAdminUserManagementPage,
    loadAdminVatManagementPage,
    preloadAdminWorkspace,
} from './src/adminPageLoaders';

const ServicesPage = lazy(() => import('./components/ServicesPage'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const FullScreenSearch = lazy(() => import('./components/FullScreenSearch'));
const ServiceDetailPage = lazy(() => import('./components/ServiceDetailPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const BlogPage = lazy(() => import('./components/BlogPage'));
const BlogPostPage = lazy(() => import('./components/BlogPostPage'));
const IngredientAnalyzerPage = lazy(() => import('./components/IngredientAnalyzerPage'));
const AdministrativeProfilePage = lazy(() => import('./components/AdministrativeProfilePage'));
const MedicalRecordsPage = lazy(() => import('./components/MedicalRecordsPage'));
const MyMedicalRecordsPage = lazy(() => import('./components/MyMedicalRecordsPage'));
const AppointmentsPage = lazy(() => import('./components/AppointmentsPage'));
const BookingPage = lazy(() => import('./components/BookingPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const BrandDirectoryPage = lazy(() => import('./components/BrandDirectoryPage'));
const BrandLandingPage = lazy(() => import('./components/BrandLandingPage'));
const CartPage = lazy(() => import('./components/CartPage'));
const CheckoutPage = lazy(() => import('./components/CheckoutPage'));
const CheckoutSuccessPage = lazy(() => import('./components/CheckoutSuccessPage'));
const OrderLookupPage = lazy(() => import('./components/OrderLookupPage'));
const WishlistPage = lazy(() => import('./components/WishlistPage'));
const AdminDashboardPage = lazy(loadAdminDashboardPage);
const AdminUserManagementPage = lazy(loadAdminUserManagementPage);
const AdminBlogManagementPage = lazy(loadAdminBlogManagementPage);
const AdminSiteManagementPage = lazy(loadAdminSiteManagementPage);
const AdminServiceManagementPage = lazy(loadAdminServiceManagementPage);
const AdminImageLibraryPage = lazy(loadAdminImageLibraryPage);
const AdminProductImageImporterPage = lazy(loadAdminProductImageImporterPage);
const AdminPharmacyManagementPage = lazy(loadAdminPharmacyManagementPage);
const AdminVatManagementPage = lazy(loadAdminVatManagementPage);
const AccountPage = lazy(() => import('./components/AccountPage'));
const OrderHistoryPage = lazy(() => import('./components/OrderHistoryPage'));
const ProductsPage = lazy(() => import('./components/ProductsPage'));
const loadProductDetailPage = () => import('./components/ProductDetailPage');
const ProductDetailPage = lazy(loadProductDetailPage);
const api = createDeferredFunctionProxy<typeof import('./services/api')>(loadApiModule);
const DEFAULT_HEADER_LOGO_URL = '/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp';
const DEFAULT_SEO_LOGO_URL = 'https://thegioitrimun.vn/icons/da-lieu-nhiet-doi-phu-quoc-512.png';
const DEFAULT_BRAND_NAME = 'Thế Giới Trị Mụn';
const HEADER_BRAND_PRIMARY = 'Da Liễu Nhiệt Đới';
const HEADER_BRAND_SECONDARY = 'Phú Quốc';
const AUTH_REQUIRED_PAGES = new Set<View['page']>([
    'account',
    'administrativeProfile',
    'medicalRecords',
    'myMedicalRecords',
    'appointments',
    'booking',
    'wishlist',
    'orderHistory',
    'adminDashboard',
    'adminUserManagement',
    'adminBlogManagement',
    'adminServiceManagement',
    'adminImageLibrary',
    'adminProductImageImporter',
    'adminPharmacyManagement',
    'adminPancakeManagement',
    'adminSiteManagement',
    'adminVatManagement',
]);

// These admin pages own their API loading and error states internally. Routing
// them through the shared bootstrap gate would leave pages with no bootstrap
// tasks stuck in the global loading state forever.
const SELF_MANAGED_ADMIN_PAGES = new Set<View['page']>([
    'adminPancakeManagement',
    'adminVatManagement',
]);

const fileToBas64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

const formatCurrency = (amount: number) => {
    if (!amount) return "Liên hệ";
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const App: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
    const shouldUseHomeOptimizedBootstrap = shouldDeferInitialBootstrap();

    // Helper to get localized content from DB records
    const getLocalized = useCallback((obj: any, field: string): string => {
        if (!obj) return '';
        const lang = i18n.language;
        if (lang !== 'vi') {
            const localizedValue = obj[`${field}_${lang}`];
            if (localizedValue) return localizedValue;
        }
        return obj[field] || '';
    }, [i18n.language]);

    const getLocalizedArray = useCallback((obj: any, field: string): string[] => {
        if (!obj) return [];
        const lang = i18n.language;
        if (lang !== 'vi') {
            const localizedValue = obj[`${field}_${lang}`];
            if (localizedValue && Array.isArray(localizedValue) && localizedValue.length > 0) return localizedValue;
        }
        return obj[field] || [];
    }, [i18n.language]);
    const { addToast } = useToast();
    const { clearCart, itemCount, isMiniCartOpen, openMiniCart, addToCart } = useCart();
    const { loadWishlist, clearWishlist } = useWishlist();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [view, setView] = useState<View>(getInitialView);
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [openFaqId, setOpenFaqId] = useState<number | null>(null);
    const [summarizingDocId, setSummarizingDocId] = useState<string | null>(null);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const isHeaderVisibleRef = useRef(true);
    const isAtTopRef = useRef(true);
    const lastScrollY = useRef(0);
    const headerScrollDelta = useRef(0);
    const headerScrollFrame = useRef<number | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        const role = currentUser?.profile.role;
        if (!['admin', 'master_admin', 'accountant'].includes(String(role))) return;
        const timerId = window.setTimeout(() => {
            if (role === 'accountant') void loadAdminVatManagementPage();
            else preloadAdminWorkspace();
        }, 50);
        return () => window.clearTimeout(timerId);
    }, [currentUser?.profile.role]);

    // Data from Supabase
    const [services, setServices] = useState<Service[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
    const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
    const [aboutData, setAboutData] = useState<AboutPageData | null>(null);
    const [homepageHero, setHomepageHero] = useState<HomepageHero | null>(getInitialHomepageHero);
    const [featuredServiceIds, setFeaturedServiceIds] = useState<number[]>([]);
    const [featuredDoctorIds, setFeaturedDoctorIds] = useState<string[]>([]);
    const [featuredPostSlugs, setFeaturedPostSlugs] = useState<string[]>([]);
    const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
    const [footerContent, setFooterContent] = useState<FooterContent | null>(null);
    const [authPageImages, setAuthPageImages] = useState<AuthPageImages | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
    const [brands, setBrands] = useState<ProductBrand[]>([]);
    const [authModeHint, setAuthModeHint] = useState<AuthMode>(() => getAuthModeFromLocation());
    const [guestCheckoutOrder, setGuestCheckoutOrder] = useState<ProductOrder | null>(null);

    useEffect(() => {
        const faviconUrl = siteInfo?.favicon_url?.trim();
        if (!faviconUrl) return;

        const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
        if (!favicon) return;

        favicon.href = faviconUrl;
        favicon.type = faviconUrl.toLowerCase().includes('.svg')
            ? 'image/svg+xml'
            : faviconUrl.toLowerCase().includes('.ico')
                ? 'image/x-icon'
                : 'image/png';
    }, [siteInfo?.favicon_url]);

    // Admin specific data
    const [allPatients, setAllPatients] = useState<PatientProfile[]>([]);
    const [doctorDetails, setDoctorDetails] = useState<DoctorDetail[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allProductOrders, setAllProductOrders] = useState<ProductOrder[]>([]);

    const isMobile = useMediaQuery('(max-width: 768px)');
    const headerLogoUrl = DEFAULT_HEADER_LOGO_URL;
    const getBrandNameBySlug = useCallback((brandSlug?: string) => {
        if (!brandSlug) return undefined;
        return brands.find((brand) => brand.slug === brandSlug)?.name;
    }, [brands]);
    const getBrandProducts = useCallback((brandName?: string) => {
        const brandKey = normalizeBrandMatchKey(brandName);
        if (!brandKey) return [];
        return products.filter((product) => normalizeBrandMatchKey(product.brand) === brandKey);
    }, [products]);
    const activeBlogPost = view.page === 'blogDetail'
        ? blogPosts.find((entry) => entry.slug === view.slug) || null
        : null;
    const activeProduct = view.page === 'productDetail'
        ? products.find((entry) => entry.id === view.id || entry.slug === String(view.id)) || null
        : null;

    const openProductDetail = useCallback((idOrSlug: number | string, options?: { categorySlug?: string; focusReview?: boolean }) => {
        const existingProduct = products.find((entry) => entry.id === idOrSlug || entry.slug === String(idOrSlug));
        const productKey = existingProduct?.slug || idOrSlug;
        void loadProductDetailPage().then((module) => (
            module.prefetchProductIngredientAnalysis(productKey, i18n.language)
        )).catch(() => undefined);
        const nextCategorySlug = options?.categorySlug || (existingProduct ? getProductCategorySlug(existingProduct, productCategories) : undefined);
        setView({
            page: 'productDetail',
            id: productKey,
            categorySlug: nextCategorySlug,
            ...(options?.focusReview ? { focusReview: true } : {}),
        });
    }, [i18n.language, productCategories, products]);

    useEffect(() => {
        if (view.page !== 'productDetail') return;
        void loadProductDetailPage().then((module) => (
            module.prefetchProductIngredientAnalysis(view.id, i18n.language)
        )).catch(() => undefined);
    }, [i18n.language, view]);

    useEffect(() => {
        document.documentElement.classList.add('app-mounted');
        installClientMonitoring();
        return () => {
            document.documentElement.classList.remove('app-mounted');
        };
    }, []);

    const handleApiError = useCallback((error: unknown, context: string) => {
        // Silently ignore AbortError from Supabase Auth lock contention (multiple tabs/rapid refresh)
        if (isExpectedAbortLikeError(error)) {
            const message = error instanceof Error ? error.message : String(error || 'Aborted');
            console.warn(`[Ignored] Aborted request in ${context}:`, message);
            return;
        }
        console.error(`Error in ${context}:`, error);
        reportClientError({
            type: 'api-error',
            message: error instanceof Error ? error.message : String(error),
            context,
            stack: error instanceof Error ? error.stack : undefined,
        });
        addToast(`Lỗi khi ${context}`, {
            type: 'error',
            description: error instanceof Error ? error.message : String(error)
        });
    }, [addToast]);
    const {
        adminModuleStates,
        blogDetailStatus,
        fetchAdminData,
        fetchAllData,
        fetchUserData,
        ensureBlogCatalogLoaded,
        ensureDoctorsLoaded,
        ensureProductCatalogLoaded,
        hasFullBlogCatalog,
        hasFullProductCatalog,
        isAboutDataHydrationLoading,
        isBlogCatalogLoading,
        isBlogDetailLoading,
        isBootstrapping,
        isDoctorsHydrationLoading,
        isLoading,
        isPaymentSettingsHydrationLoading,
        isProductCatalogLoading,
        isProductDetailLoading,
        loadBlogDetailRecord,
        productCatalogError,
        productDetailStatus,
        retryAdminModule,
        setHasFullBlogCatalog,
        setHasFullProductCatalog,
    } = useAppBootstrap({
        handleApiError,
        isSidebarOpen,
        clearWishlist,
        loadWishlist,
        shouldUseHomeOptimizedBootstrap,
        state: {
            aboutData,
            activeBlogPost,
            activeProduct,
            authPageImages,
            blogCategories,
            blogPosts,
            brands,
            currentUser,
            doctors,
            faqItems,
            paymentSettings,
            productCategories,
            products,
            view,
        },
        setters: {
            setAboutData,
            setAllPatients,
            setAllProductOrders,
            setAllProducts,
            setAuthModeHint,
            setAuthPageImages,
            setBlogCategories,
            setBlogPosts,
            setBrands,
            setCurrentUser,
            setDoctorDetails,
            setDoctors,
            setFaqItems,
            setFeaturedDoctorIds,
            setFeaturedPostSlugs,
            setFeaturedServiceIds,
            setFooterContent,
            setHomepageHero,
            setPaymentSettings,
            setProductCategories,
            setProducts,
            setServices,
            setSiteInfo,
            setView,
        },
    });

    const openBlogPost = useCallback((slug: string, categorySlug?: string) => {
        void loadBlogDetailRecord(slug);
        const existingPost = blogPosts.find((entry) => entry.slug === slug);
        setView({
            page: 'blogDetail',
            slug,
            categorySlug: categorySlug || existingPost?.category_slug,
        });
    }, [blogPosts, loadBlogDetailRecord]);

    const setHeaderVisibility = useCallback((visible: boolean) => {
        if (isHeaderVisibleRef.current === visible) return;
        isHeaderVisibleRef.current = visible;
        setIsHeaderVisible(visible);
    }, []);

    // Keep the fixed glass header from toggling on every small Safari touch scroll.
    const controlHeaderVisibility = useCallback(() => {
        const currentScrollY = window.scrollY;
        
        // Track whether we are at the top (only update state when boolean changes)
        const atTop = currentScrollY < 50;
        if (isAtTopRef.current !== atTop) {
            isAtTopRef.current = atTop;
            setIsAtTop(atTop);
        }

        const delta = currentScrollY - lastScrollY.current;
        lastScrollY.current = currentScrollY;

        if (currentScrollY <= 80) {
            headerScrollDelta.current = 0;
            setHeaderVisibility(true);
            return;
        }

        if (Math.abs(delta) < 2) return;

        const isSameDirection = Math.sign(headerScrollDelta.current) === Math.sign(delta);
        headerScrollDelta.current = isSameDirection ? headerScrollDelta.current + delta : delta;

        const hideThreshold = isMobile ? 84 : 42;
        const showThreshold = isMobile ? 56 : 28;

        if (headerScrollDelta.current > hideThreshold) {
            headerScrollDelta.current = 0;
            setHeaderVisibility(false);
            return;
        }

        if (headerScrollDelta.current < -showThreshold) {
            headerScrollDelta.current = 0;
            setHeaderVisibility(true);
        }
    }, [isMobile, setHeaderVisibility]);

    // Effect to save current view to session storage, sync URL, and set SEO tags.
    useEffect(() => {
        try {
            sessionStorage.setItem('iskin-clinic-current-view', JSON.stringify(view));
        } catch (error) {
            console.error('Could not save view to sessionStorage', error);
        }

        const currentLang = normalizeSeoLang(i18n.language);
        const targetPath = viewToPath(view, products, services, productCategories, blogPosts, blogCategories);
        const targetSearch = buildViewSearch(view, currentLang);
        const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
        const targetPathWithSearch = `${targetPath}${targetSearch}`;

        if (currentPathWithSearch !== targetPathWithSearch) {
            const nextUrl = `${targetPath}${targetSearch}`;
            if (window.location.pathname !== targetPath) {
                window.history.pushState({ view }, '', nextUrl);
            } else {
                window.history.replaceState({ view }, '', nextUrl);
            }
        }

        const localizedSeoBase = {
            vi: {
                siteName: 'Thế Giới Trị Mụn',
                homeTitle: 'Thế Giới Trị Mụn | Chăm sóc da chuyên sâu',
                homeDescription: 'Phòng khám da liễu chuyên sâu, dịch vụ trị mụn và sản phẩm chính hãng. Đặt lịch khám online nhanh chóng.',
                servicesTitle: 'Dịch vụ da liễu | Thế Giới Trị Mụn',
                productsTitle: 'Sản phẩm da liễu | Thế Giới Trị Mụn',
                blogTitle: 'Kiến thức da liễu | Thế Giới Trị Mụn',
                aboutTitle: 'Giới thiệu | Thế Giới Trị Mụn',
            },
            en: {
                siteName: 'Thế Giới Trị Mụn',
                homeTitle: 'Thế Giới Trị Mụn | Dermatology & Acne Treatment',
                homeDescription: 'Advanced dermatology clinic with acne treatment services and authentic skincare pharmacy.',
                servicesTitle: 'Dermatology Services | Thế Giới Trị Mụn',
                productsTitle: 'Skincare Pharmacy | Thế Giới Trị Mụn',
                blogTitle: 'Dermatology Knowledge Hub | Thế Giới Trị Mụn',
                aboutTitle: 'About Thế Giới Trị Mụn',
            },
            ru: {
                siteName: 'Thế Giới Trị Mụn',
                homeTitle: 'Thế Giới Trị Mụn | Дерматология и лечение акне',
                homeDescription: 'Профессиональная дерматологическая клиника: лечение акне, уход за кожей и аптечные средства.',
                servicesTitle: 'Дерматологические услуги | Thế Giới Trị Mụn',
                productsTitle: 'Аптека ухода за кожей | Thế Giới Trị Mụn',
                blogTitle: 'Блог о дерматологии | Thế Giới Trị Mụn',
                aboutTitle: 'О Thế Giới Trị Mụn',
            },
            cn: {
                siteName: 'Thế Giới Trị Mụn',
                homeTitle: 'Thế Giới Trị Mụn | 痤疮与皮肤治疗',
                homeDescription: '专业皮肤诊疗，提供祛痘服务与正规护肤产品。',
                servicesTitle: '皮肤治疗服务 | Thế Giới Trị Mụn',
                productsTitle: '护肤药房 | Thế Giới Trị Mụn',
                blogTitle: '皮肤知识专栏 | Thế Giới Trị Mụn',
                aboutTitle: '关于 Thế Giới Trị Mụn',
            },
        }[currentLang];

        const clinicName = siteInfo?.clinic_name || localizedSeoBase.siteName;
        let pageTitle = localizedSeoBase.homeTitle;
        let pageDescription = localizedSeoBase.homeDescription;
        let pageType: 'website' | 'article' | 'product' = 'website';
        let pageImage = siteInfo?.logo_light_url || siteInfo?.logo_dark_url || undefined;
        let keywords: string | undefined;
        let pageAuthor: string | undefined = clinicName;
        let publishedTime: string | undefined;
        let modifiedTime: string | undefined;
        let articleSection: string | undefined;
        let articleTags: string[] = [];
        let imageAlt: string | undefined = pageTitle;
        let productPrice: number | undefined;
        let productAvailability: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock' | undefined;
        let routeNoindex = isPrivateOrAdminPage(view.page);

        switch (view.page) {
            case 'productDetail': {
                const prod = products.find(p => p.id === view.id || p.slug === String(view.id));
                if (prod) {
                    const localizedName = getLocalized(prod, 'name');
                    const categoryName = getLocalized(productCategories.find(c => c.id === prod.category_id) || {}, 'name');
                    pageTitle = buildClientSeoTitle(localizedName, { context: categoryName, siteName: clinicName });
                    pageDescription = buildClientMetaDescription([
                        getLocalized(prod, 'description'),
                        getLocalizedArray(prod, 'key_benefits')[0],
                        getLocalized(prod, 'brand'),
                    ]) || `${localizedName} | ${clinicName}`;
                    pageType = 'product';
                    const imgUrl = prod.images?.find(i => i.is_primary)?.image_url || prod.images?.[0]?.image_url || '';
                    if (imgUrl) pageImage = imgUrl;
                    keywords = [localizedName, getLocalized(prod, 'brand'), 'dermatology product'].filter(Boolean).join(', ');
                    imageAlt = localizedName;
                    productPrice = prod.price;
                    productAvailability = prod.stock_quantity > 0
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/OutOfStock';
                }
                break;
            }
            case 'blogDetail': {
                const post = blogPosts.find(p => p.slug === view.slug);
                if (post) {
                    const localizedTitle = getLocalized(post, 'title');
                    const localizedSummary = getLocalized(post, 'summary');
                    const localizedContent = getLocalized(post, 'content');
                    const sectionName = getLocalized(blogCategories.find(c => c.slug === post.category_slug) || {}, 'name');
                    const derivedKeywords = buildBlogKeywordList({
                        metaKeywords: currentLang === 'vi' ? post.meta_keywords : '',
                        title: localizedTitle,
                        categoryName: sectionName,
                        summary: localizedSummary,
                        content: localizedContent,
                    });
                    const localSeoTags = currentLang === 'vi' ? post.local_seo_tags || [] : [];
                    const combinedKeywords = Array.from(new Set([...derivedKeywords, ...localSeoTags]));
                    pageTitle = buildClientSeoTitle(localizedTitle, { context: sectionName, siteName: clinicName });
                    pageDescription = buildBlogSeoDescription({
                        metaDescription: currentLang === 'vi' ? post.meta_description : '',
                        summary: localizedSummary,
                        content: localizedContent,
                        categoryName: sectionName,
                    }) || `${localizedTitle} | ${clinicName}`;
                    pageType = 'article';
                    if (post.image_url) pageImage = post.image_url;
                    keywords = combinedKeywords.join(', ');
                    pageAuthor = post.author?.name || clinicName;
                    publishedTime = post.date;
                    modifiedTime = post.date;
                    articleSection = sectionName || undefined;
                    articleTags = combinedKeywords;
                    imageAlt = localizedTitle;
                    if (post.canonical_url && !post.canonical_url.startsWith('https://thegioitrimun.vn')) {
                        routeNoindex = true;
                    }
                }
                break;
            }
            case 'serviceDetail': {
                const svc = services.find(s => s.id === view.id || s.slug === view.id);
                if (svc) {
                    const localizedName = getLocalized(svc, 'name');
                    pageTitle = buildClientSeoTitle(localizedName, {
                        context: getLocalizedArray(svc, 'benefits')[0] || localizedSeoBase.servicesTitle,
                        siteName: clinicName,
                    });
                    pageDescription = buildClientMetaDescription([
                        getLocalized(svc, 'description'),
                        getLocalizedArray(svc, 'benefits')[0],
                    ]) || `${localizedName} | ${clinicName}`;
                    keywords = [
                        localizedName,
                        ...(currentLang === 'vi' ? svc.local_seo_tags || [] : []),
                        'dermatology service',
                        'acne treatment',
                    ].join(', ');
                    imageAlt = localizedName;
                }
                break;
            }
            case 'services': pageTitle = localizedSeoBase.servicesTitle; break;
            case 'brands':
                pageTitle = buildClientSeoTitle(
                    currentLang === 'en'
                        ? 'Skincare brands'
                        : currentLang === 'ru'
                            ? 'Бренды ухода за кожей'
                            : currentLang === 'cn'
                                ? '护肤品牌'
                                : 'Danh mục thương hiệu',
                    { siteName: clinicName }
                );
                pageDescription = buildClientMetaDescription([
                    currentLang === 'en'
                        ? `Browse ${brands.length} brands currently distributed by ${clinicName}, with a detailed profile page and direct access to the filtered catalog.`
                        : currentLang === 'ru'
                            ? `Изучите ${brands.length} брендов, представленных в ${clinicName}, с подробным профилем и прямым переходом в каталог.`
                            : currentLang === 'cn'
                                ? `查看 ${clinicName} 当前经营的 ${brands.length} 个品牌，并直接进入品牌详情页与筛选商品列表。`
                                : `${clinicName} hiện có ${brands.length} thương hiệu với trang giới thiệu riêng và lối vào nhanh tới danh sách sản phẩm đã lọc.`,
                ]) || `${clinicName} | Thương hiệu`;
                imageAlt = currentLang === 'vi' ? 'Danh mục thương hiệu Thế Giới Trị Mụn' : pageTitle;
                routeNoindex = currentLang !== 'vi';
                break;
            case 'brandLanding': {
                const brand = brands.find((entry) => entry.slug === view.brandSlug);
                const brandProducts = getBrandProducts(brand?.name);
                const brandName = brand?.name || view.brandSlug;
                pageTitle = buildClientSeoTitle(brandName, {
                    context: currentLang === 'en'
                        ? 'Skincare brand'
                        : currentLang === 'ru'
                            ? 'Бренд ухода за кожей'
                            : currentLang === 'cn'
                                ? '护肤品牌'
                                : 'Thương hiệu dược mỹ phẩm',
                    siteName: clinicName,
                });
                pageDescription = buildClientMetaDescription([
                    brand?.description,
                    currentLang === 'en'
                        ? `${brandProducts.length} published products from ${brandName} at ${clinicName}.`
                        : currentLang === 'ru'
                            ? `${brandProducts.length} опубликованных товаров бренда ${brandName} в ${clinicName}.`
                            : currentLang === 'cn'
                                ? `${clinicName} 当前展示 ${brandName} 品牌的 ${brandProducts.length} 个产品。`
                                : `${clinicName} hiện có ${brandProducts.length} sản phẩm đang hiển thị thuộc thương hiệu ${brandName}.`,
                ]) || `${brandName} | ${clinicName}`;
                imageAlt = brandName;
                pageImage = brand?.logo_url || brandProducts[0]?.images?.[0]?.image_url || pageImage;
                keywords = [brandName, 'brand skincare', 'duoc my pham'].join(', ');
                routeNoindex = currentLang !== 'vi';
                break;
            }
            case 'products':
                if (view.searchQuery?.trim()) {
                    pageTitle = buildClientSeoTitle(
                        currentLang === 'en'
                            ? `Search: ${view.searchQuery.trim()}`
                            : currentLang === 'ru'
                                ? `Поиск: ${view.searchQuery.trim()}`
                                : currentLang === 'cn'
                                    ? `搜索：${view.searchQuery.trim()}`
                                    : `Tìm kiếm: ${view.searchQuery.trim()}`,
                        { context: localizedSeoBase.productsTitle, siteName: clinicName }
                    );
                    pageDescription = buildClientMetaDescription([
                        currentLang === 'en'
                            ? `Filtered pharmacy results for "${view.searchQuery.trim()}" at ${clinicName}.`
                            : currentLang === 'ru'
                                ? `Результаты поиска по запросу "${view.searchQuery.trim()}" в аптеке ${clinicName}.`
                                : currentLang === 'cn'
                                    ? `${clinicName} 药房中与“${view.searchQuery.trim()}”相关的筛选结果。`
                                    : `Kết quả sản phẩm theo từ khóa "${view.searchQuery.trim()}" tại ${clinicName}.`,
                    ]) || localizedSeoBase.productsTitle;
                    keywords = [view.searchQuery, 'san pham da lieu', 'skin care'].filter(Boolean).join(', ');
                    routeNoindex = true;
                } else {
                    pageTitle = localizedSeoBase.productsTitle;
                }
                break;
            case 'productsCategory': {
                const category = productCategories.find(c => c.slug === view.categorySlug);
                const categoryName = category ? getLocalized(category, 'name') : view.categorySlug;
                pageTitle = view.searchQuery?.trim()
                    ? buildClientSeoTitle(
                        currentLang === 'en'
                            ? `Search: ${view.searchQuery.trim()}`
                            : currentLang === 'ru'
                                ? `Поиск: ${view.searchQuery.trim()}`
                                : currentLang === 'cn'
                                    ? `搜索：${view.searchQuery.trim()}`
                                    : `Tìm kiếm: ${view.searchQuery.trim()}`,
                        { context: categoryName, siteName: clinicName }
                    )
                    : `${categoryName} | ${localizedSeoBase.productsTitle}`;
                pageDescription = view.searchQuery?.trim()
                    ? buildClientMetaDescription([
                        currentLang === 'en'
                            ? `Filtered product results for "${view.searchQuery.trim()}" in ${categoryName}.`
                            : currentLang === 'ru'
                                ? `Отфильтрованные товары по запросу "${view.searchQuery.trim()}" в категории ${categoryName}.`
                                : currentLang === 'cn'
                                    ? `分类 ${categoryName} 中与“${view.searchQuery.trim()}”相关的筛选产品结果。`
                                    : `Kết quả sản phẩm theo từ khóa "${view.searchQuery.trim()}" trong danh mục ${categoryName}.`,
                    ])
                    : truncateText(category ? getLocalized(category, 'description') || `${categoryName} - ${localizedSeoBase.productsTitle}` : localizedSeoBase.productsTitle);
                keywords = [categoryName, view.searchQuery, 'san pham da lieu', 'skin care'].filter(Boolean).join(', ');
                routeNoindex = routeNoindex || Boolean(view.searchQuery?.trim());
                break;
            }
            case 'blog': pageTitle = localizedSeoBase.blogTitle; break;
            case 'blogCategory': {
                const category = blogCategories.find(c => c.slug === view.categorySlug);
                const categoryName = category ? getLocalized(category, 'name') : view.categorySlug;
                pageTitle = `${categoryName} | ${localizedSeoBase.blogTitle}`;
                pageDescription = truncateText(`${categoryName} - ${localizedSeoBase.blogTitle}`);
                keywords = [categoryName, 'kien thuc da lieu', 'blog skin care'].join(', ');
                break;
            }
            case 'ingredientAnalyzer':
                pageTitle = currentLang === 'en'
                    ? `Cosmetic ingredient analyzer | ${clinicName}`
                    : `Phân tích thành phần mỹ phẩm | ${clinicName}`;
                pageDescription = currentLang === 'en'
                    ? 'Paste an INCI list to review EWG risk, quick notes, and skin-type fit. This tool does not replace dermatology advice.'
                    : 'Dán bảng thành phần mỹ phẩm để kiểm tra rủi ro EWG, ghi chú nhanh và mức phù hợp theo loại da. Công cụ không thay thế tư vấn da liễu.';
                keywords = currentLang === 'en'
                    ? 'cosmetic ingredient analyzer, INCI checker, skincare ingredients'
                    : 'phân tích thành phần mỹ phẩm, tra cứu INCI, kiểm tra thành phần skincare';
                imageAlt = pageTitle;
                break;
            case 'about': pageTitle = localizedSeoBase.aboutTitle; break;
            default: break;
        }

        applySeo({
            lang: currentLang,
            path: targetPath,
            title: pageTitle,
            description: pageDescription,
            image: pageImage,
            type: pageType,
            keywords,
            noindex: routeNoindex,
            author: pageAuthor,
            imageAlt,
            publishedTime,
            modifiedTime,
            section: articleSection,
            tags: articleTags,
            price: productPrice,
            currency: 'VND',
            availability: productAvailability,
        });

        applyGlobalOrganizationSchema(clinicName, {
            phone: footerContent?.phone || undefined,
            email: footerContent?.email || undefined,
            address: footerContent?.address || undefined,
            logoUrl: DEFAULT_SEO_LOGO_URL,
            socialUrls: [
                footerContent?.facebook_url,
                footerContent?.instagram_url,
                footerContent?.youtube_url,
                footerContent?.tiktok_url,
                footerContent?.zalo_url,
                footerContent?.messenger_url,
            ].map(normalizeExternalUrl).filter(Boolean) as string[],
        });
        applyGlobalWebsiteSchema(clinicName, currentLang);

        const localizedPageName = {
            home: currentLang === 'en' ? 'Home' : currentLang === 'ru' ? 'Главная' : currentLang === 'cn' ? '首页' : 'Trang chủ',
            services: currentLang === 'en' ? 'Services' : currentLang === 'ru' ? 'Услуги' : currentLang === 'cn' ? '服务' : 'Dịch vụ',
            brands: currentLang === 'en' ? 'Brands' : currentLang === 'ru' ? 'Бренды' : currentLang === 'cn' ? '品牌' : 'Thương hiệu',
            products: currentLang === 'en' ? 'Pharmacy' : currentLang === 'ru' ? 'Аптека' : currentLang === 'cn' ? '药房' : 'Sản phẩm',
            blog: currentLang === 'en' ? 'Blog' : currentLang === 'ru' ? 'Блог' : currentLang === 'cn' ? '知识' : 'Kiến thức',
            about: currentLang === 'en' ? 'About Us' : currentLang === 'ru' ? 'О нас' : currentLang === 'cn' ? '关于我们' : 'Về chúng tôi',
        };

        const breadcrumbByView: Partial<Record<View['page'], { name: string; item: string }[]>> = {
            services: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.services, item: `https://thegioitrimun.vn${targetPath}` },
            ],
            brands: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.brands, item: 'https://thegioitrimun.vn/thuong-hieu' },
            ],
            brandLanding: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.brands, item: 'https://thegioitrimun.vn/thuong-hieu' },
                {
                    name: brands.find((brand) => brand.slug === (view.page === 'brandLanding' ? view.brandSlug : ''))?.name || localizedPageName.brands,
                    item: `https://thegioitrimun.vn${targetPath}`,
                },
            ],
            products: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.products, item: `https://thegioitrimun.vn${targetPath}` },
            ],
            productsCategory: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.products, item: 'https://thegioitrimun.vn/san-pham' },
                {
                    name: getLocalized(productCategories.find(c => c.slug === (view.page === 'productsCategory' ? view.categorySlug : '')) || {}, 'name') || (view.page === 'productsCategory' ? view.categorySlug : localizedPageName.products),
                    item: `https://thegioitrimun.vn${targetPath}`
                },
            ],
            blog: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.blog, item: `https://thegioitrimun.vn${targetPath}` },
            ],
            blogCategory: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.blog, item: 'https://thegioitrimun.vn/kien-thuc' },
                {
                    name: getLocalized(blogCategories.find(c => c.slug === (view.page === 'blogCategory' ? view.categorySlug : '')) || {}, 'name') || (view.page === 'blogCategory' ? view.categorySlug : localizedPageName.blog),
                    item: `https://thegioitrimun.vn${targetPath}`
                },
            ],
            about: [
                { name: localizedPageName.home, item: 'https://thegioitrimun.vn/' },
                { name: localizedPageName.about, item: `https://thegioitrimun.vn${targetPath}` },
            ],
        };

        const breadcrumbItems = breadcrumbByView[view.page];
        if (breadcrumbItems && breadcrumbItems.length > 1) {
            upsertJsonLd('route-breadcrumb-jsonld', {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: breadcrumbItems.map((entry, idx) => ({
                    '@type': 'ListItem',
                    position: idx + 1,
                    name: entry.name,
                    item: entry.item,
                })),
            });
        } else {
            removeJsonLd('route-breadcrumb-jsonld');
        }

        if (view.page === 'main' && faqItems.length > 0) {
            const homeUrl = currentLang === 'vi'
                ? 'https://thegioitrimun.vn/'
                : `https://thegioitrimun.vn/?lang=${currentLang}`;
            const localizedFaq = faqItems.slice(0, 10).map((faq) => ({
                '@type': 'Question',
                name: getLocalized(faq, 'question'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: getLocalized(faq, 'answer'),
                },
            })).filter((f) => f.name && f.acceptedAnswer.text);

            if (localizedFaq.length > 0) {
                upsertJsonLd('homepage-faq-jsonld', {
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    url: homeUrl,
                    inLanguage: currentLang === 'cn' ? 'zh' : currentLang,
                    mainEntityOfPage: homeUrl,
                    publisher: {
                        '@type': 'Organization',
                        name: clinicName,
                        url: 'https://thegioitrimun.vn',
                        logo: DEFAULT_SEO_LOGO_URL,
                    },
                    mainEntity: localizedFaq,
                });
            }
        } else {
            removeJsonLd('homepage-faq-jsonld');
        }

    }, [view, products, productCategories, brands, blogPosts, blogCategories, services, faqItems, i18n.language, siteInfo, footerContent, getLocalized, getLocalizedArray, getBrandProducts]);

    // Handle browser Back/Forward buttons
    useEffect(() => {
        const handlePopState = () => {
            const newView = pathToView(window.location.pathname, window.location.search);
            const langParam = new URLSearchParams(window.location.search).get('lang');
            if (langParam && ['vi', 'en', 'ru', 'cn'].includes(langParam) && i18n.language !== langParam) {
                i18n.changeLanguage(langParam);
            }
            setView(newView);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [i18n]);

    // Reusable Navigation Interceptor
    const handleNavigate = useCallback((newView: View) => {
        setView(newView);
    }, []);

    useEffect(() => {
        const handleHeaderScroll = () => {
            if (headerScrollFrame.current !== null) return;
            headerScrollFrame.current = window.requestAnimationFrame(() => {
                headerScrollFrame.current = null;
                controlHeaderVisibility();
            });
        };

        window.addEventListener('scroll', handleHeaderScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleHeaderScroll);
            if (headerScrollFrame.current !== null) {
                window.cancelAnimationFrame(headerScrollFrame.current);
                headerScrollFrame.current = null;
            }
        };
    }, [controlHeaderVisibility]);

    useEffect(() => {
        // Only reset scroll on an actual view change, not when background data refreshes SEO state.
        if (isMobile && view.page === 'account') return;
        window.scrollTo(0, 0);
    }, [view, isMobile]);

    // Automatically redirect away from auth page if already logged in (e.g., after OAuth redirect)
    useEffect(() => {
        if (currentUser && view.page === 'auth' && authModeHint !== 'reset-password') {
            setView({ page: 'main' });
        }
    }, [currentUser, view, authModeHint]);

    // Management Handlers
    const handleUpdatePatient = async (patient: Partial<PatientProfile> & { id: string }, avatarFile: File | null) => {
        try {
            await api.saveWithRetry(() => api.updatePatient(patient, avatarFile));
            await Promise.all([
                fetchAdminData({ page: 'adminUserManagement', force: true }),
                currentUser?.profile.id === patient.id ? fetchUserData(patient.id) : Promise.resolve(),
            ]);
            addToast('Cập nhật thành công', { type: 'success', description: 'Hồ sơ người dùng đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật người dùng'); throw error; }
    };
    const handleSaveDoctorProfile = async (doctorProfile: DoctorProfile) => {
        try {
            await api.saveWithRetry(() => api.upsertDoctorProfile(doctorProfile));
            await fetchAdminData({ page: 'adminUserManagement', force: true });
            addToast('Lưu thành công', { type: 'success', description: 'Hồ sơ bác sĩ đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'lưu hồ sơ bác sĩ'); }
    };
    const handleDeleteDoctorProfile = async (doctorId: string) => {
        if (window.confirm('Bạn có chắc muốn xoá hồ sơ bác sĩ này? Hành động này sẽ hạ vai trò của họ xuống thành khách hàng.')) {
            try {
                await api.saveWithRetry(() => api.deleteDoctorProfile(doctorId));
                await fetchAdminData({ page: 'adminUserManagement', force: true });
                addToast('Xóa thành công', { type: 'success', description: 'Hồ sơ bác sĩ đã được xóa.' });
            } catch (error) { handleApiError(error, 'xoá hồ sơ bác sĩ'); }
        }
    };
    const handleLoadPostDetail = useCallback(async (slug: string): Promise<BlogPost | null> => {
        const posts = await api.getAdminBlogPosts({ force: true });
        return posts.find((post) => post.slug === slug) || null;
    }, []);

    const handleSavePost = async (post: BlogPost, imageFile: File | null): Promise<BlogPost | null> => {
        try {
            await api.saveWithRetry(() => api.savePost(post, imageFile));
            const adminPosts = await api.getAdminBlogPosts({ force: true });
            const fullPost = adminPosts.find((entry) => entry.slug === post.slug) || null;
            setBlogPosts(adminPosts);
            setHasFullBlogCatalog(true);
            addToast('Lưu bài viết thành công', { type: 'success' });
            return fullPost;
        } catch (error) { handleApiError(error, 'lưu bài viết'); throw error; }
    };
    const handleDeletePost = async (slug: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa bài viết "${slug}" không?`)) {
            try {
                const postToDelete = blogPosts.find(p => p.slug === slug);
                if (!postToDelete) throw new Error("Post not found");
                await api.saveWithRetry(() => api.deletePost(slug, postToDelete.image_path));
                setBlogPosts(await api.getAdminBlogPosts({ force: true }));
                setHasFullBlogCatalog(true);
                addToast('Xóa thành công', { type: 'success', description: `Bài viết "${slug}" đã được xóa.` });
            } catch (error) { handleApiError(error, 'xoá bài viết'); }
        }
    };
    const handleSaveCategory = async (blogCategory: BlogCategory) => {
        try {
            await api.saveWithRetry(() => api.saveCategory(blogCategory));
            setBlogCategories(await api.getAdminBlogCategories({ force: true }));
            addToast('Lưu chuyên mục thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu chuyên mục'); throw error; }
    };
    const handleDeleteCategory = async (slug: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa chuyên mục "${slug}" không?`)) {
            try {
                await api.saveWithRetry(() => api.deleteCategory(slug));
                setBlogCategories(await api.getAdminBlogCategories({ force: true }));
                addToast('Xóa thành công', { type: 'success', description: `Chuyên mục "${slug}" đã được xóa.` });
            } catch (error) { handleApiError(error, 'xoá chuyên mục'); }
        }
    };
    const handleSaveFaq = async (faq: FAQItem) => {
        try {
            await api.saveWithRetry(() => api.saveFaq(faq), { retryNetwork: Boolean(faq.id && faq.id > 0) });
            setFaqItems((await api.getAdminSiteSnapshot({ force: true })).faqItems);
            addToast('Lưu FAQ thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu FAQ'); throw error; }
    };
    const handleDeleteFaq = async (id: number) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa câu hỏi này không?`)) {
            try {
                await api.saveWithRetry(() => api.deleteFaq(id));
                setFaqItems((await api.getAdminSiteSnapshot({ force: true })).faqItems);
                addToast('Xóa FAQ thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá FAQ'); }
        }
    };
    const handleUpdateHomepageHero = async (hero: Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_tablet_url' | 'image_mobile_url'>, files: { desktop?: File, tablet?: File, mobile?: File }) => {
        try {
            const updatedHero = await api.saveWithRetry(() => api.updateHomepageHero(hero, files));
            setHomepageHero(updatedHero);
            try {
                window.localStorage.setItem(HOMEPAGE_HERO_CACHE_KEY, JSON.stringify(updatedHero));
            } catch {
                // Ignore localStorage write failures.
            }
            addToast('Cập nhật thành công', { type: 'success', description: 'Hero section đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật hero section'); throw error; }
    };
    const handleUpdateFeaturedServices = async (ids: number[]) => {
        try {
            await api.saveWithRetry(() => api.updateFeaturedServices(ids));
            setFeaturedServiceIds(ids);
            addToast('Cập nhật thành công', { type: 'success', description: 'Danh sách dịch vụ nổi bật đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật dịch vụ nổi bật'); throw error; }
    };
    const handleUpdateFeaturedDoctors = async (ids: string[]) => {
        try {
            await api.saveWithRetry(() => api.updateFeaturedDoctors(ids));
            setFeaturedDoctorIds(ids);
            addToast('Cập nhật thành công', { type: 'success', description: 'Danh sách bác sĩ nổi bật đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật bác sĩ nổi bật'); throw error; }
    };
    const handleUpdateFeaturedPosts = async (slugs: string[]) => {
        try {
            await api.saveWithRetry(() => api.updateFeaturedPosts(slugs));
            setFeaturedPostSlugs(slugs);
            addToast('Cập nhật thành công', { type: 'success', description: 'Danh sách bài viết nổi bật đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật bài viết nổi bật'); throw error; }
    };
    const handleSaveService = async (service: Partial<Service>, imageFile: File | null) => {
        try {
            await api.saveWithRetry(() => api.saveService(service, imageFile), { retryNetwork: Boolean(service.id) });
            setServices(await api.getAdminServices({ force: true }));
            addToast('Lưu dịch vụ thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu dịch vụ'); }
    };
    const handleDeleteService = async (id: number) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa dịch vụ này không?`)) {
            try {
                await api.saveWithRetry(() => api.deleteService(id));
                setServices(await api.getAdminServices({ force: true }));
                addToast('Xóa dịch vụ thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá dịch vụ'); }
        }
    };
    const handleUpdateAboutContent = async (content: Partial<AboutContent>, imageFile: File | null) => {
        try {
            await api.saveWithRetry(() => api.updateAboutContent(content, imageFile));
            setAboutData((await api.getAdminSiteSnapshot({ force: true })).aboutData);
            addToast('Cập nhật thành công', { type: 'success', description: 'Nội dung trang Giới thiệu đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật nội dung trang Giới thiệu'); throw error; }
    };
    const handleSaveAboutFeature = async (feature: Partial<AboutFeature>) => {
        try {
            await api.saveWithRetry(() => api.saveAboutFeature(feature), { retryNetwork: Boolean(feature.id) });
            setAboutData((await api.getAdminSiteSnapshot({ force: true })).aboutData);
            addToast('Lưu thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu mục Lý do chọn chúng tôi'); throw error; }
    };
    const handleDeleteAboutFeature = async (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa mục này không?')) {
            try {
                await api.saveWithRetry(() => api.deleteAboutFeature(id));
                setAboutData((await api.getAdminSiteSnapshot({ force: true })).aboutData);
                addToast('Xóa thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá mục Lý do chọn chúng tôi'); }
        }
    };
    const handleSaveAboutValue = async (value: Partial<AboutValue>) => {
        try {
            await api.saveWithRetry(() => api.saveAboutValue(value), { retryNetwork: Boolean(value.id) });
            setAboutData((await api.getAdminSiteSnapshot({ force: true })).aboutData);
            addToast('Lưu thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu giá trị cốt lõi'); throw error; }
    };
    const handleDeleteAboutValue = async (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa giá trị cốt lõi này không?')) {
            try {
                await api.saveWithRetry(() => api.deleteAboutValue(id));
                setAboutData((await api.getAdminSiteSnapshot({ force: true })).aboutData);
                addToast('Xóa thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá giá trị cốt lõi'); }
        }
    };
    const handleUpdateSiteInfo = async (info: Partial<SiteInfo>, files: { light?: File, dark?: File, favicon?: File }) => {
        try {
            const updatedInfo = await api.saveWithRetry(() => api.updateSiteInfo(info, files));
            setSiteInfo(updatedInfo);
            addToast('Cập nhật thành công', { type: 'success', description: 'Thông tin trang đã được cập nhật.' });
        } catch (error) {
            handleApiError(error, 'cập nhật thông tin trang');
            throw error; // Re-throw to allow caller to handle UI state
        }
    };
    const handleUpdateFooterContent = async (content: Partial<FooterContent>) => {
        try {
            const updatedContent = await api.saveWithRetry(() => api.updateFooterContent(content));
            setFooterContent(updatedContent);
            addToast('Cập nhật thành công', { type: 'success', description: 'Nội dung footer đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật nội dung footer'); throw error; }
    };
    const handleUpdateAuthPageImages = async (file: File | null) => {
        try {
            const updatedImages = await api.saveWithRetry(() => api.updateAuthPageImages(file));
            setAuthPageImages(updatedImages);
            addToast('Cập nhật thành công', { type: 'success', description: 'Ảnh trang đăng nhập đã được cập nhật.' });
        } catch (error) {
            handleApiError(error, 'cập nhật ảnh trang đăng nhập');
            throw error;
        }
    };
    const handleUpdatePaymentSettings = async (settings: PaymentSettings) => {
        try {
            const updatedSettings = await api.saveWithRetry(() => api.updatePaymentSettings(settings));
            setPaymentSettings(updatedSettings);
            addToast('Cập nhật thành công', { type: 'success', description: 'Thông tin thanh toán đã được cập nhật.' });
        } catch (error) { handleApiError(error, 'cập nhật thông tin thanh toán'); throw error; }
    };
    const handleSaveProduct = async (product: Partial<Product>, imagesToDelete: ProductImage[]): Promise<Product> => {
        try {
            const savedProduct = await api.saveWithRetry(() => api.saveProduct(product, imagesToDelete), { retryNetwork: Boolean(product.id) });
            void api.clearPublicProductCatalogCache();
            const mergeProductIntoCatalog = (catalog: Product[], nextProduct: Product) =>
                [...catalog.filter((item) => item.id !== nextProduct.id), nextProduct]
                    .sort((left, right) => left.name.localeCompare(right.name, 'vi'));

            setAllProducts((current) => mergeProductIntoCatalog(current, savedProduct));
            setProducts((current) =>
                savedProduct.is_published
                    ? mergeProductIntoCatalog(current, savedProduct)
                    : current.filter((item) => item.id !== savedProduct.id)
            );

            addToast('Lưu sản phẩm thành công', {
                type: 'success',
                description: 'Danh sách đã cập nhật ngay từ bản ghi vừa lưu, không cần tải lại toàn bộ catalog.',
            });
            return savedProduct;
        } catch (error) { handleApiError(error, 'lưu sản phẩm'); throw error; }
    };

    const handleBulkUpdateProducts = async (updates: Partial<Product>[]) => {
        if (!updates.length) return;
        try {
            for (const update of updates) {
                await api.saveWithRetry(() => api.saveProduct(update, []), { retryNetwork: Boolean(update.id) });
            }
            void api.clearPublicProductCatalogCache();
            const allProductsData = await api.getAllProducts({ force: true });
            const publicProductsData = allProductsData.filter((product) => product.is_published && !product.archived_at);
            setAllProducts(allProductsData);
            setProducts(publicProductsData);
            setHasFullProductCatalog(true);
        } catch (error) {
            handleApiError(error, 'cập nhật hàng loạt sản phẩm');
            throw error;
        }
    };

    const handleBulkDeleteProducts = async (productIds: number[]) => {
        if (!productIds.length) return { deletedCount: 0, archivedCount: 0 };
        try {
            const results: ProductDeletionResult[] = [];
            for (const productId of productIds) {
                results.push(await api.saveWithRetry(() => api.deleteProduct(productId)));
            }
            void api.clearPublicProductCatalogCache();
            const allProductsData = await api.getAllProducts({ force: true });
            const publicProductsData = allProductsData.filter((product) => product.is_published && !product.archived_at);
            setAllProducts(allProductsData);
            setProducts(publicProductsData);
            setHasFullProductCatalog(true);
            return {
                deletedCount: results.filter((result) => result.outcome === 'deleted').length,
                archivedCount: results.filter((result) => result.outcome === 'archived').length,
            };
        } catch (error) {
            handleApiError(error, 'xóa hàng loạt sản phẩm');
            throw error;
        }
    };

    const handleDeleteProduct = async (productId: number) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm này không?`)) {
            try {
                const result = await api.saveWithRetry(() => api.deleteProduct(productId));
                void api.clearPublicProductCatalogCache();
                setAllProducts((current) => current.filter((product) => product.id !== productId));
                setProducts((current) => current.filter((product) => product.id !== productId));
                addToast(
                    result.outcome === 'archived' ? 'Đã lưu trữ sản phẩm' : 'Xóa sản phẩm thành công',
                    {
                        type: 'success',
                        description: result.outcome === 'archived'
                            ? 'Sản phẩm đã có đơn hàng nên được ẩn khỏi catalog, giữ nguyên lịch sử giao dịch.'
                            : undefined,
                    }
                );
            } catch (error) { handleApiError(error, 'xoá sản phẩm'); }
        }
    };

    const handleSaveProductCategory = async (category: Partial<ProductCategory>) => {
        try {
            await api.saveWithRetry(() => api.saveProductCategory(category), { retryNetwork: Boolean(category.id) });
            setProductCategories(await api.getAdminProductCategories({ force: true }));
            addToast('Lưu chuyên mục thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu chuyên mục sản phẩm'); }
    };

    const handleDeleteProductCategory = async (categoryId: number) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa chuyên mục này không? Các sản phẩm thuộc chuyên mục sẽ không bị xóa.`)) {
            try {
                await api.saveWithRetry(() => api.deleteProductCategory(categoryId));
                setProductCategories(await api.getAdminProductCategories({ force: true }));
                addToast('Xóa chuyên mục thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá chuyên mục sản phẩm'); }
        }
    };

    const handleSaveBrand = async (brand: Partial<ProductBrand>, imageFile: File | null) => {
        try {
            // If editing an existing brand, check if name changed
            let oldBrandName: string | null = null;
            if (brand.id) {
                const existingBrand = brands.find(b => b.id === brand.id);
                if (existingBrand && existingBrand.name !== brand.name) {
                    oldBrandName = existingBrand.name;
                }
            }

            await api.saveWithRetry(() => api.saveBrand(brand, imageFile), { retryNetwork: Boolean(brand.id) });
            setBrands(await api.getAdminProductBrands({ force: true }));

            // If brand name changed, update all products that have the old brand name
            if (oldBrandName && brand.name) {
                const productsToUpdate = products.filter(p => p.brand === oldBrandName);
                if (productsToUpdate.length > 0) {
                    await api.updateProductsBrandName(oldBrandName, brand.name);
                    // Refresh products in local state
                    setProducts(prev => prev.map(p =>
                        p.brand === oldBrandName ? { ...p, brand: brand.name! } : p
                    ));
                    // Also refresh admin products if loaded
                    setAllProducts(prev => prev.map(p =>
                        p.brand === oldBrandName ? { ...p, brand: brand.name! } : p
                    ));
                    addToast(`Đã cập nhật tên thương hiệu cho ${productsToUpdate.length} sản phẩm`, { type: 'info' });
                }
            }

            addToast('Lưu thương hiệu thành công', { type: 'success' });
        } catch (error) { handleApiError(error, 'lưu thương hiệu'); throw error; }
    };

    const handleDeleteBrand = async (brandId: number, logoPath?: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa thương hiệu này không?`)) {
            try {
                await api.saveWithRetry(() => api.deleteBrand(brandId, logoPath));
                setBrands(await api.getAdminProductBrands({ force: true }));
                addToast('Xóa thương hiệu thành công', { type: 'success' });
            } catch (error) { handleApiError(error, 'xoá thương hiệu'); }
        }
    };

    const handleLogout = async () => {
        try {
            await api.logout();
            setCurrentUser(null);
            setAllPatients([]);
            setDoctorDetails([]);
            clearWishlist();
            setView({ page: 'main' });
            addToast('Đăng xuất thành công', { type: 'info' });
        } catch (error) { handleApiError(error, 'đăng xuất'); }
    };

    const handleUploadDocument = useCallback(async (file: File) => {
        if (!currentUser) return;
        try {
            await api.uploadDocument(currentUser.profile.id, file);
            await fetchUserData(currentUser.profile.id);
            addToast('Tải lên thành công', { type: 'success', description: `Tệp "${file.name}" đã được tải lên.` });
        } catch (error) {
            handleApiError(error, 'tải lên tài liệu');
        }
    }, [currentUser, fetchUserData, addToast]);

    const handleDeleteDocument = useCallback(async (docId: string, filePath: string) => {
        if (!currentUser) return;
        if (window.confirm('Bạn có chắc chắn muốn xóa tệp này không?')) {
            try {
                await api.deleteDocument(docId, filePath);
                await fetchUserData(currentUser.profile.id);
                addToast('Xóa thành công', { type: 'success', description: 'Tài liệu đã được xóa.' });
            } catch (error) {
                handleApiError(error, 'xóa tài liệu');
            }
        }
    }, [currentUser, fetchUserData, addToast]);

    const handleGenerateSummary = useCallback(async (doc: PatientDocument) => {
        if (!currentUser) return;
        setSummarizingDocId(doc.id);
        try {
            let blob: Blob;
            if (api.isD1BackendEnabled()) {
                const response = await fetch(doc.public_url || `/api/account/documents/${encodeURIComponent(doc.id)}/download`, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error('Không thể tải hồ sơ private để phân tích.');
                blob = await response.blob();
            } else {
                const supabase = await getSupabaseClient();
                const { data, error: downloadError } = await supabase.storage
                    .from('patient-documents')
                    .download(doc.file_path);
                if (downloadError || !data) throw downloadError || new Error('Không tải được hồ sơ.');
                blob = data;
            }

            const base64Content = await fileToBas64(blob);
            addToast('Đang tạo tóm tắt...', { type: 'info', description: 'AI đang phân tích tài liệu của bạn.' });
            const geminiService = await import('./services/geminiService');
            const summary = await geminiService.summarizeDocument(base64Content, doc.mime_type);

            await api.updateDocumentSummary(doc.id, summary);
            await fetchUserData(currentUser.profile.id);
            addToast('Tạo tóm tắt thành công!', { type: 'success' });
        } catch (error) {
            handleApiError(error, 'tạo tóm tắt AI');
        } finally {
            setSummarizingDocId(null);
        }
    }, [currentUser, fetchUserData, addToast]);

    const handleNavLinkClick = (action: () => void, href?: string) => {
        action();
        if (href?.startsWith('#') && href.length > 1) {
            setTimeout(() => {
                const element = document.getElementById(decodeURIComponent(href.slice(1)));
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 50);
        }
    };

    const onRequestBooking = (serviceId?: number) => {
        if (currentUser) {
            if (doctors.length === 0) {
                void ensureDoctorsLoaded();
            }
            setView({ page: 'booking', serviceId });
        } else {
            addToast('Vui lòng đăng nhập', { type: 'info', description: 'Bạn cần đăng nhập để đặt lịch hẹn.' });
            setView({ page: 'auth' });
        }
    };

    const handleBookingComplete = async (newAppointmentData: Omit<Appointment, 'id' | 'status'>) => {
        if (!currentUser) return;
        try {
            const createdAppointment = await api.createAppointment(currentUser.profile.id, newAppointmentData, {
                name: currentUser.profile.name,
                email: currentUser.profile.email,
                phone: currentUser.profile.phone,
                locale: i18n.language,
            });
            setCurrentUser(prev => {
                if (!prev || prev.profile.id !== currentUser.profile.id) return prev;
                return {
                    ...prev,
                    appointments: [createdAppointment, ...prev.appointments.filter(app => app.id !== createdAppointment.id)],
                };
            });
            try {
                await fetchUserData(currentUser.profile.id);
            } catch (refreshError) {
                console.warn('Could not refresh user data after appointment creation:', refreshError);
            }
            addToast('Đặt lịch thành công!', { type: 'success', description: 'Lịch hẹn của bạn đang chờ xác nhận.' });
            setView({ page: 'appointments' });
        } catch (error) { handleApiError(error, 'tạo lịch hẹn'); }
    };

    const handleAddToCart = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        addToCart(product, 1);
        addToast(`Đã thêm ${product.name}`, { type: 'success', description: 'Sản phẩm đã được thêm vào giỏ hàng.' });
    };

    const handleCheckoutSuccess = async (createdOrder?: ProductOrder | null) => {
        if (currentUser && createdOrder) {
            setGuestCheckoutOrder(null);
            setCurrentUser(prev => {
                if (!prev || prev.profile.id !== currentUser.profile.id) return prev;
                return {
                    ...prev,
                    product_orders: [createdOrder, ...prev.product_orders.filter(order => order.id !== createdOrder.id)],
                };
            });
            try {
                await fetchUserData(currentUser.profile.id);
            } catch (refreshError) {
                console.warn('Could not refresh user data after order creation:', refreshError);
            }
        }
        addToast('Đặt hàng thành công!', { type: 'success', description: 'Cảm ơn bạn đã mua hàng. Chúng tôi sẽ sớm liên hệ để xác nhận.' });
        clearCart();
        if (currentUser) {
            setView({ page: 'orderHistory' });
            return;
        }
        setGuestCheckoutOrder(createdOrder || null);
        setView({ page: 'checkoutSuccess' });
    };

    const handleOpenSearch = useCallback(() => {
        setIsSearchOpen(true);
        if (!hasFullBlogCatalog) void ensureBlogCatalogLoaded();
    }, [ensureBlogCatalogLoaded, hasFullBlogCatalog]);

    const navLinks = [
        { name: t('nav.home'), href: "#home", icon: <HomeIcon className="w-6 h-6" />, action: () => setView({ page: 'main' }) },
        { name: t('nav.services'), href: "#", icon: <ServiceListIcon className="w-6 h-6" />, action: () => setView({ page: 'services' }) },
        { name: t('nav.about'), href: "#", icon: <InformationCircleIcon className="w-6 h-6" />, action: () => setView({ page: 'about' }) },
        { name: t('nav.pharmacy'), href: "#", icon: <ShoppingBagIcon className="w-6 h-6" />, action: () => setView({ page: 'products' }) },
        { name: t('nav.ingredient_analyzer'), href: "#", icon: <TechnologyIcon className="w-6 h-6" />, action: () => setView({ page: 'ingredientAnalyzer' }) },
        { name: t('nav.knowledge'), href: "#", icon: <BlogIcon className="w-6 h-6" />, action: () => setView({ page: 'blog' }) },
        { name: t('nav.contact'), href: "#contact", icon: <MailIcon className="w-6 h-6" />, action: () => setView({ page: 'main' }) },
    ];

    const renderRouteLoading = () => view.page === 'productDetail'
        ? <ProductDetailLoadingShell />
        : (
            <div className="min-h-[60vh] flex items-center justify-center">
                <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
            </div>
        );

    const renderContent = () => {
        if (isLoading || (isBootstrapping && !['main', 'auth', 'productDetail', 'ingredientAnalyzer', 'orderLookup', 'products', 'productsCategory'].includes(view.page))) {
            return (
                <div className="flex justify-center items-center min-h-screen">
                    <LoadingIcon className="w-16 h-16 text-primary animate-spin" />
                </div>
            );
        }

        const requiresAuthForCurrentView = view.page !== 'auth' && AUTH_REQUIRED_PAGES.has(view.page);

        if (view.page === 'auth' || (!currentUser && requiresAuthForCurrentView)) {
            const postAuthView = view.page === 'auth' ? { page: 'main' as const } : view;
            return <AuthPage onAuthSuccess={() => {
                setAuthModeHint('login');
                addToast('Đăng nhập thành công!', { type: 'success', description: 'Chào mừng bạn trở lại.' });
                setView(postAuthView);
            }} authImages={authPageImages} initialMode={authModeHint} onRecoveryComplete={() => {
                setAuthModeHint('login');
                clearAuthRecoveryUrl();
                addToast('Cập nhật mật khẩu thành công!', { type: 'success' });
                setView(postAuthView);
            }} />;
        }

        if (currentUser) {
            const isContentCreator = ['admin', 'master_admin'].includes(currentUser.profile.role);
            const isAdmin = ['admin', 'master_admin'].includes(currentUser.profile.role);
            const isVatStaff = ['accountant', 'master_admin'].includes(currentUser.profile.role);
            switch (view.page) {
                case 'account':
                    return <AccountPage user={currentUser} onNavigate={setView as any} onLogout={handleLogout} />;
                case 'administrativeProfile': return <AdministrativeProfilePage patient={currentUser.profile} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} onUpdateProfile={handleUpdatePatient} />;
                case 'medicalRecords':
                    if (doctors.length === 0 && isDoctorsHydrationLoading) return renderRouteLoading();
                    return <MedicalRecordsPage records={currentUser.medical_records} doctors={doctors} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} />;
                case 'myMedicalRecords': return <MyMedicalRecordsPage user={currentUser} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} onUpload={handleUploadDocument} onDelete={handleDeleteDocument} onGenerateSummary={handleGenerateSummary} summarizingDocId={summarizingDocId} />;
                case 'appointments':
                    if (doctors.length === 0 && isDoctorsHydrationLoading) return renderRouteLoading();
                    return <AppointmentsPage appointments={currentUser.appointments} services={services} doctors={doctors} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} onRequestBooking={() => onRequestBooking()} />;
                case 'orderHistory': return <OrderHistoryPage orders={currentUser.product_orders} onNavigate={setView} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} />;
                case 'booking':
                    if (doctors.length === 0 && isDoctorsHydrationLoading) return renderRouteLoading();
                    return <BookingPage services={services} doctors={doctors} onBack={() => setView({ page: 'main' })} onComplete={handleBookingComplete} initialServiceId={view.serviceId} />;
                case 'wishlist':
                    if (!hasFullProductCatalog || isProductCatalogLoading) {
                        return (
                            <div className="min-h-[60vh] flex items-center justify-center">
                                <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
                            </div>
                        );
                    }
                    return <WishlistPage allProducts={products} onSelectProduct={(id) => openProductDetail(id)} onNavigate={setView} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} />;
            }

            if (view.page.startsWith('admin')) {
                const renderAdminView = () => {
                    switch (view.page) {
                        case 'adminDashboard':
                    if (isAdmin) return <AdminDashboardPage initialPanel={view.section} onNavigate={(page) => setView(page)} onBack={() => setView(isMobile ? { page: 'account' } : { page: 'main' })} productOrders={allProductOrders} services={services} doctors={doctorDetails} />;
                    setView({ page: 'main' }); return null;
                case 'adminUserManagement':
                    if (isAdmin) return <AdminUserManagementPage allPatients={allPatients} doctorDetails={doctorDetails} initialSection={view.section} onUpdatePatient={handleUpdatePatient} onSaveDoctorProfile={handleSaveDoctorProfile} onDeleteDoctorProfile={handleDeleteDoctorProfile} onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;
                    setView({ page: 'main' }); return null;
                case 'adminBlogManagement':
                    if (isContentCreator) {
                        return <AdminBlogManagementPage currentUser={currentUser} posts={blogPosts} categories={blogCategories} initialSection={view.section} onSavePost={handleSavePost} onLoadPostDetail={handleLoadPostDetail} onDeletePost={handleDeletePost} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminServiceManagement':
                    if (isAdmin) {
                        return <AdminServiceManagementPage services={services} onSaveService={handleSaveService} onDeleteService={handleDeleteService} onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminImageLibrary':
                    if (isAdmin) {
                        return <AdminImageLibraryPage onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminProductImageImporter':
                    if (isAdmin) {
                        return <AdminProductImageImporterPage onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminPharmacyManagement':
                    if (isAdmin) {
                        return <AdminPharmacyManagementPage
                            products={allProducts}
                            categories={productCategories}
                            brands={brands}
                            productOrders={allProductOrders}
                            initialSection={view.section}
                            initialAction={view.action}
                            initialOrderId={view.orderId}
                            initialOrderChannel={view.orderChannel}
                            initialOrderPreset={view.orderPreset}
                            initialProductFilter={view.productFilter}
                            onUpdateOrders={setAllProductOrders}
                            onSaveProduct={handleSaveProduct}
                            onBulkUpdateProducts={handleBulkUpdateProducts}
                            onDeleteProduct={handleDeleteProduct}
                            onBulkDeleteProducts={handleBulkDeleteProducts}
                            onSaveCategory={handleSaveProductCategory}
                            onDeleteCategory={handleDeleteProductCategory}
                            onSaveBrand={handleSaveBrand}
                            onDeleteBrand={handleDeleteBrand}
                            onNavigate={setView}
                            onBack={() => setView({ page: 'adminDashboard' })}
                        />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminPancakeManagement':
                    if (isAdmin) {
                        return <AdminPancakeManagementPage />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminVatManagement':
                    if (isVatStaff) {
                        return <AdminVatManagementPage currentRole={currentUser.profile.role} />;
                    }
                    setView({ page: 'main' }); return null;
                case 'adminSiteManagement':
                    if (!isAdmin) {
                        setView({ page: 'main' }); return null;
                    }
                    if (!aboutData || !siteInfo || !footerContent || !authPageImages || !paymentSettings) {
                        return renderRouteLoading();
                    }
                    return <AdminSiteManagementPage
                        allServices={services}
                        allDoctors={doctorDetails}
                        allPosts={blogPosts}
                        faqItems={faqItems}
                        homepageHero={homepageHero}
                        featuredServiceIds={featuredServiceIds}
                        featuredDoctorIds={featuredDoctorIds}
                        featuredPostSlugs={featuredPostSlugs}
                        onUpdateHomepageHero={handleUpdateHomepageHero}
                        onUpdateFeaturedServices={handleUpdateFeaturedServices}
                        onUpdateFeaturedDoctors={handleUpdateFeaturedDoctors}
                        onUpdateFeaturedPosts={handleUpdateFeaturedPosts}
                        onSaveFaq={handleSaveFaq}
                        onDeleteFaq={handleDeleteFaq}
                        aboutData={aboutData}
                        onUpdateAboutContent={handleUpdateAboutContent}
                        onSaveAboutFeature={handleSaveAboutFeature}
                        onDeleteAboutFeature={handleDeleteAboutFeature}
                        onSaveAboutValue={handleSaveAboutValue}
                        onDeleteAboutValue={handleDeleteAboutValue}
                        siteInfo={siteInfo}
                        footerContent={footerContent}
                        onUpdateSiteInfo={handleUpdateSiteInfo}
                        onUpdateFooterContent={handleUpdateFooterContent}
                        authPageImages={authPageImages}
                        onUpdateAuthPageImages={handleUpdateAuthPageImages}
                        paymentSettings={paymentSettings}
                        onUpdatePaymentSettings={handleUpdatePaymentSettings}
                        initialSection={view.section}
                        initialAction={view.action}
                        onNavigate={setView}
                        onBack={() => setView({ page: 'adminDashboard' })}
                    />;
            }
        };

        const adminModuleState = adminModuleStates[view.page] || { status: 'idle', error: null, refreshing: false };
        const adminContent = SELF_MANAGED_ADMIN_PAGES.has(view.page)
            ? renderAdminView()
            : adminModuleState.status === 'idle' || adminModuleState.status === 'loading'
                ? renderRouteLoading()
                : adminModuleState.status === 'error'
                    ? (
                    <div className="mx-auto flex min-h-[52vh] w-full max-w-3xl items-center justify-center px-4 py-10">
                        <div className="w-full rounded-[1.5rem] border border-red-200 bg-card p-6 text-center shadow-sm">
                            <h2 className="text-xl font-bold text-foreground">Không thể tải dữ liệu quản trị</h2>
                            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                {adminModuleState.error || 'Kết nối dữ liệu tạm thời không khả dụng.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => { void retryAdminModule(view.page); }}
                                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                Thử tải lại
                            </button>
                        </div>
                    </div>
                    )
                    : renderAdminView();

        return (
            <AdminLayoutProvider>
                <AdminWorkspaceLayout
                    currentPage={(view.page === 'adminPharmacyManagement' && view.section === 'orders' ? 'adminDashboard' : view.page) as any}
                    currentRole={currentUser.profile.role}
                    onNavigate={setView}
                    onBack={() => setView(currentUser.profile.role === 'accountant' ? { page: 'account' } : { page: 'adminDashboard' })}
                >
                    {adminContent}
                </AdminWorkspaceLayout>
            </AdminLayoutProvider>
        );
    }

        } // Close if (currentUser)

        switch (view.page) {
            case 'account':
                if (isMobile) return <AccountPage user={currentUser} onNavigate={setView as any} onLogout={handleLogout} />;
                setView({ page: 'main' }); return null;
            case 'services': return <ServicesPage services={services} onSelectService={(id) => setView({ page: 'serviceDetail', id })} onBack={() => setView({ page: 'main' })} />;
            case 'serviceDetail':
                const service = services.find(s => s.id === view.id || s.slug === view.id);
                if (!service) return <ServicesPage services={services} onSelectService={(id) => setView({ page: 'serviceDetail', id })} onBack={() => setView({ page: 'main' })} />;
                return <ServiceDetailPage service={service} allServices={services} allProducts={products} allBlogPosts={blogPosts} onSelectService={(id) => setView({ page: 'serviceDetail', id })} onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })} onSelectPost={openBlogPost} onBack={() => setView({ page: 'services' })} onRequestBooking={() => onRequestBooking(service.id)} />;
            case 'about':
                if (!aboutData && isAboutDataHydrationLoading) return renderRouteLoading();
                if (!aboutData) return null;
                if (doctors.length === 0 && isDoctorsHydrationLoading) return renderRouteLoading();
                return <AboutPage aboutData={aboutData} doctors={doctors} onBack={() => setView({ page: 'main' })} onGoToServices={() => setView({ page: 'services' })} />;
            case 'blog':
                if (!hasFullBlogCatalog || isBlogCatalogLoading) {
                    return renderRouteLoading();
                }
                return <BlogPage posts={blogPosts} categories={blogCategories} onSelectPost={openBlogPost} onPrefetchPost={(slug) => { void loadBlogDetailRecord(slug); }} onBack={() => setView({ page: 'main' })} />;
            case 'blogCategory':
                if (!hasFullBlogCatalog || isBlogCatalogLoading) {
                    return (
                        <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    );
                }
                return <BlogPage posts={blogPosts} categories={blogCategories} initialCategorySlug={view.categorySlug} onSelectPost={openBlogPost} onPrefetchPost={(slug) => { void loadBlogDetailRecord(slug); }} onBack={() => setView({ page: 'blog' })} />;
            case 'blogDetail':
                if (!activeBlogPost && (isBlogDetailLoading || isBootstrapping || blogDetailStatus === 'idle' || blogDetailStatus === 'loading')) {
                    return (
                        <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    );
                }
                if (!activeBlogPost) {
                    return <BlogPage posts={blogPosts} categories={blogCategories} onSelectPost={openBlogPost} onPrefetchPost={(slug) => { void loadBlogDetailRecord(slug); }} onBack={() => setView({ page: 'main' })} />;
                }
                return <BlogPostPage post={activeBlogPost} isContentLoading={!hasDetailedBlogContent(activeBlogPost)} allPosts={blogPosts} categories={blogCategories} allProducts={products} allServices={services} onSelectPost={openBlogPost} onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })} onSelectService={(id) => setView({ page: 'serviceDetail', id })} onBack={() => setView(activeBlogPost.category_slug ? { page: 'blogCategory', categorySlug: activeBlogPost.category_slug } : { page: 'blog' })} siteInfo={siteInfo} onGoToServices={() => setView({ page: 'services' })} onGoToProducts={() => setView({ page: 'products' })} />;
            case 'ingredientAnalyzer':
                return <IngredientAnalyzerPage />;
            case 'brands':
                if (!hasFullProductCatalog || isProductCatalogLoading) {
                    return (
                        <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    );
                }
                return (
                    <BrandDirectoryPage
                        brands={brands}
                        products={products}
                        onOpenBrand={(brandSlug) => setView({ page: 'brandLanding', brandSlug })}
                        onBrowseBrandProducts={(brandSlug) => setView({ page: 'products', brandSlug })}
                        onBack={() => setView({ page: 'main' })}
                    />
                );
            case 'brandLanding': {
                if (!hasFullProductCatalog || isProductCatalogLoading) {
                    return (
                        <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingIcon className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    );
                }
                const brand = brands.find((entry) => entry.slug === view.brandSlug);
                if (!brand) {
                    return (
                        <div className="container mx-auto px-6 py-20">
                            <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-10 text-center">
                                <h1 className="text-3xl font-black text-foreground">Không tìm thấy thương hiệu</h1>
                                <p className="mt-4 text-muted-foreground">Slug thương hiệu này không còn tồn tại hoặc chưa được cấu hình.</p>
                                <button onClick={() => setView({ page: 'products' })} className="mt-8 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground btn-press">
                                    Về sản phẩm
                                </button>
                            </div>
                        </div>
                    );
                }
                const brandProducts = getBrandProducts(brand.name);
                return (
                    <BrandLandingPage
                        brand={brand}
                        products={brandProducts}
                        categories={productCategories}
                        onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })}
                        onBrowseBrandProducts={() => setView({ page: 'products', brandSlug: brand.slug })}
                        onBrowseBrandCategory={(categorySlug) => setView({ page: 'productsCategory', categorySlug, brandSlug: brand.slug })}
                        onBack={() => setView({ page: 'brands' })}
                    />
                );
            }
            case 'products':
                return <ProductsPage products={products} categories={productCategories} initialBrandName={getBrandNameBySlug(view.brandSlug)} initialSearchTerm={view.searchQuery} hasFullCatalog={hasFullProductCatalog} isCatalogLoading={isBootstrapping || isProductCatalogLoading} catalogError={productCatalogError} onRetryCatalog={() => { void fetchAllData({ background: true }); }} onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })} onBack={() => setView({ page: 'main' })} />;
            case 'productsCategory':
                return <ProductsPage products={products} categories={productCategories} initialCategorySlug={view.categorySlug} initialBrandName={getBrandNameBySlug(view.brandSlug)} initialSearchTerm={view.searchQuery} hasFullCatalog={hasFullProductCatalog} isCatalogLoading={isBootstrapping || isProductCatalogLoading} catalogError={productCatalogError} onRetryCatalog={() => { void fetchAllData({ background: true }); }} onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })} onBack={() => setView({ page: 'products', brandSlug: view.brandSlug, searchQuery: view.searchQuery })} />;
            case 'productDetail': {
                if (!hasDetailedProductPayload(activeProduct) && (isProductDetailLoading || productDetailStatus === 'idle' || productDetailStatus === 'loading')) {
                    return renderRouteLoading();
                }
                if (!hasDetailedProductPayload(activeProduct)) return <ProductsPage products={products} categories={productCategories} onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })} onBack={() => setView({ page: 'main' })} />;
                return <ProductDetailPage
                    product={activeProduct}
                    allProducts={products}
                    allCategories={productCategories}
                    brands={brands}
                    allBlogPosts={blogPosts}
                    allServices={services}
                    onSelectProduct={(id, categorySlug) => openProductDetail(id, { categorySlug })}
                    onSelectPost={openBlogPost}
                    onSelectService={(id) => setView({ page: 'serviceDetail', id })}
                    onOpenBrand={(brandSlug) => setView({ page: 'brandLanding', brandSlug })}
                    onBrowseCategory={(categorySlug) => setView({ page: 'productsCategory', categorySlug })}
                    onBack={() => setView(view.categorySlug ? { page: 'productsCategory', categorySlug: view.categorySlug } : { page: 'products' })}
                    currentUser={currentUser}
                    focusReview={Boolean(view.page === 'productDetail' && view.focusReview)}
                />;
            }
            case 'cart': return <CartPage onNavigate={handleNavigate} />;
            case 'checkout':
                if (!paymentSettings && isPaymentSettingsHydrationLoading) return renderRouteLoading();
                return <CheckoutPage onCheckoutSuccess={handleCheckoutSuccess} currentUser={currentUser} paymentSettings={paymentSettings} onBack={() => setView({ page: 'cart' })} />;
            case 'checkoutSuccess':
                return <CheckoutSuccessPage order={guestCheckoutOrder} onContinueShopping={() => setView({ page: 'products' })} onBackToHome={() => setView({ page: 'main' })} onLookupOrders={() => setView({ page: 'orderLookup' })} />;
            case 'orderLookup':
                return <OrderLookupPage onBackToHome={() => setView({ page: 'main' })} onGoToProducts={() => setView({ page: 'products' })} />;
            case 'booking': return <AuthPage onAuthSuccess={() => setView({ page: 'booking' })} authImages={authPageImages} initialMode={authModeHint} onRecoveryComplete={() => {
                setAuthModeHint('login');
                clearAuthRecoveryUrl();
                setView({ page: 'main' });
            }} />;
            case 'main':
            default:
                const matchedFeaturedServices = featuredServiceIds.length > 0
                    ? services.filter((service) => featuredServiceIds.includes(Number(service.id)))
                    : [];
                const featuredServices = matchedFeaturedServices.length > 0
                    ? matchedFeaturedServices
                    : services.slice(0, 3);
                const featuredPosts = blogPosts.filter(p => featuredPostSlugs.includes(p.slug));
                return (
                    <HomePageContent
                        homepageHero={homepageHero}
                        brands={brands}
                        products={products}
                        productCategories={productCategories}
                        blogCategories={blogCategories}
                        featuredPosts={featuredPosts}
                        featuredServices={featuredServices}
                        faqItems={faqItems}
                        openFaqId={openFaqId}
                        onToggleFaq={setOpenFaqId}
                        onSetView={setView}
                        onAddToCart={handleAddToCart}
                        onRequestBooking={() => onRequestBooking()}
                        getLocalized={getLocalized}
                        t={t}
                    />
                );
        }
    }

    const isAdminView = view.page.startsWith('admin');
    const isHomePage = view.page === 'main';
    const isHomeInvertedHeader = isHomePage && isAtTop;
    const contentTransitionClass = ['blog', 'blogCategory', 'productDetail'].includes(view.page) ? '' : 'animate-fade-in-page';
    const contentKey = isAdminView
        ? 'admin-workspace'
        : view.page + ((view as any).id || (view as any).slug || '');

    return (
        <div className="bg-background text-foreground transition-colors duration-300">
            {!isAdminView ? (
                <Suspense fallback={null}>
                    <FullScreenSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} products={products} services={services} blogPosts={blogPosts} hasFullProductCatalog={hasFullProductCatalog} isProductCatalogLoading={isProductCatalogLoading} onNavigate={handleNavigate} />
                    <MiniCart onNavigate={handleNavigate} />
                    <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} navLinks={navLinks} onNavLinkClick={handleNavLinkClick} currentUser={currentUser} services={services} doctors={doctors} isDoctorsLoading={isDoctorsHydrationLoading} onBookingComplete={handleBookingComplete} onGoToAuth={() => setView({ page: 'auth' })} onLogout={handleLogout} onGoToAccount={() => setView({ page: 'account' })} />
                </Suspense>
            ) : null}

            {!isAdminView ? (
            <header className={`fixed inset-x-0 top-0 z-50 will-change-transform transition-transform duration-300 motion-reduce:transition-none ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="container relative mx-auto px-3 pt-2.5 sm:px-4 sm:pt-3 lg:px-6 lg:pt-4">
                    <div className={`relative flex min-h-[64px] items-center justify-between gap-2 rounded-[30px] px-3 py-2.5 transition-all duration-500 ease-in-out sm:min-h-[68px] sm:px-4 lg:min-h-[78px] lg:px-5 lg:py-4 ${
                        isAtTop
                            ? 'border border-transparent bg-transparent shadow-none'
                            : 'border border-white/65 bg-[rgba(255,255,255,0.72)] shadow-[0_20px_44px_-34px_rgba(36,46,57,0.16)] backdrop-blur-md dark:border-white/10 dark:bg-[rgba(15,23,34,0.78)] dark:shadow-[0_24px_52px_-38px_rgba(4,10,24,0.58)] lg:bg-[rgba(255,255,255,0.65)] lg:shadow-[0_26px_56px_-34px_rgba(36,46,57,0.18)] lg:dark:bg-[rgba(15,23,34,0.74)] lg:dark:shadow-[0_30px_64px_-38px_rgba(4,10,24,0.64)]'
                    }`}>
                        <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] transition-opacity duration-500 ease-in-out ${isAtTop ? 'opacity-0' : 'opacity-100'}`}>
                            <div className="absolute -left-6 top-0 h-24 w-24 rounded-full bg-[#ff7f5d]/12 blur-2xl"></div>
                            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#35b7a5]/12 blur-2xl dark:bg-[#35b7a5]/15"></div>
                        </div>
                        <div className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2.5 lg:gap-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className={`rounded-full p-2 transition-colors duration-500 hover:bg-accent hover:text-primary focus:outline-none btn-press lg:hidden ${
                                    isHomeInvertedHeader
                                        ? 'text-slate-900 dark:text-slate-900'
                                        : 'text-foreground dark:text-white'
                                }`}
                                aria-label={t('common.open_menu')}
                            >
                                <span className="sr-only">{t('common.open_menu')}</span>
                                <MenuIcon className="w-6 h-6" />
                            </button>

                            <a href="#" onClick={(e) => { e.preventDefault(); handleNavLinkClick(() => setView({ page: 'main' }), '#home'); }} className="flex min-w-0 items-center gap-2 lg:max-w-[340px] lg:gap-3">
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] transition-all duration-500 lg:h-12 lg:w-12 lg:rounded-[20px] ${
                                    isHomeInvertedHeader
                                        ? 'bg-white/90 border border-slate-200/70 shadow-sm'
                                        : 'bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(255,237,226,0.48))] shadow-[0_16px_30px_-24px_rgba(255,127,93,0.3)] dark:bg-[linear-gradient(145deg,rgba(19,29,42,0.76),rgba(16,39,46,0.52))] dark:shadow-[0_20px_36px_-24px_rgba(4,10,24,0.62)]'
                                }`}>
                                    <img
                                        loading="eager"
                                        decoding="async"
                                        width="96"
                                        height="96"
                                        src={headerLogoUrl}
                                        alt="Da Liễu Nhiệt Đới Phú Quốc Logo"
                                        className="h-9 w-9 object-contain lg:h-10 lg:w-10"
                                    />
                                </span>
                                <div className="min-w-0 flex flex-col items-center text-center leading-[1.15]">
                                    <span className={`block whitespace-nowrap font-['Playfair_Display',_serif] text-[11px] font-black tracking-[-0.01em] transition-colors duration-500 sm:text-[13px] lg:text-[15px] ${
                                        isHomeInvertedHeader
                                            ? 'text-slate-900 dark:text-slate-900'
                                            : 'text-foreground dark:text-white'
                                    }`}>
                                        Thế Giới <span className="text-[#ef4444] dark:text-[#f87171] animate-doll-jump cursor-pointer" title="Trị">Trị</span> Mụn
                                    </span>
                                    <span className={`mt-0.5 block whitespace-nowrap font-sans text-[8.5px] font-bold tracking-[0.06em] transition-colors duration-500 sm:text-[9.5px] lg:text-[11px] ${
                                        isHomeInvertedHeader
                                            ? 'text-slate-700 dark:text-slate-700'
                                            : 'text-foreground/80 dark:text-slate-300'
                                    }`}>
                                        Da Liễu <span className="text-[#1b7a6d] dark:text-[#35b7a5] font-bold">Phú Quốc</span>
                                    </span>
                                </div>
                            </a>
                        </div>

                        <nav className="relative z-10 hidden lg:flex items-center gap-1 rounded-full bg-transparent px-2 py-1.5">
                            {navLinks.map(link => {
                                const isLinkActive = (view.page === 'main' && link.href === '#home') || (view.page === 'services' && link.name === t('nav.services')) || (view.page === 'about' && link.name === t('nav.about')) || ((view.page === 'products' || view.page === 'productsCategory' || view.page === 'brands' || view.page === 'brandLanding') && link.name === t('nav.pharmacy')) || ((view.page === 'blog' || view.page === 'blogCategory') && link.name === t('nav.knowledge'));
                                return (
                                    <button
                                        key={link.name}
                                        onClick={() => handleNavLinkClick(link.action, link.href)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-500 ${
                                            isLinkActive
                                                ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                                                : isHomeInvertedHeader
                                                ? 'text-slate-800 hover:text-primary dark:text-slate-800 dark:hover:text-primary'
                                                : 'text-foreground/78 hover:text-primary dark:text-white/80 dark:hover:text-white'
                                        }`}
                                    >
                                        {link.name}
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="relative z-10 flex items-center gap-2">
                            <div className={`inline-flex items-center gap-1 rounded-full bg-transparent px-1.5 py-1.5 transition-colors duration-500 sm:px-2 ${
                                isHomeInvertedHeader ? 'text-slate-800 dark:text-slate-900' : 'text-foreground/78 dark:text-white/85'
                            }`}>
                                <button onClick={handleOpenSearch} className={`utility-trigger btn-press ${isSearchOpen ? 'is-active' : ''}`} aria-label="Tìm kiếm">
                                    <SearchIcon className="utility-trigger-icon" />
                                </button>
                                <div className={`utility-divider hidden lg:block transition-colors duration-500 ${isHomeInvertedHeader ? 'bg-slate-300 dark:bg-slate-400' : ''}`} />
                                <div className="hidden lg:block">
                                    <LanguageSwitcher />
                                </div>
                                <div className="hidden xl:block">
                                    <SettingsDropdown />
                                </div>
                                <div className={`utility-divider hidden lg:block transition-colors duration-500 ${isHomeInvertedHeader ? 'bg-slate-300 dark:bg-slate-400' : ''}`} />
                                <div className="hidden lg:block">
                                    <UserAvatar user={currentUser} onGoToAuth={() => setView({ page: 'auth' })} onLogout={handleLogout} onNavigate={(page) => setView(page as any)} />
                                </div>
                                <button onClick={openMiniCart} className={`utility-trigger relative btn-press ${isMiniCartOpen ? 'is-active' : ''}`} aria-label="Giỏ hàng">
                                    <ShoppingBagIcon className="utility-trigger-icon" />
                                    {itemCount > 0 && (
                                        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button onClick={() => onRequestBooking()} className="hidden min-h-[48px] whitespace-nowrap items-center rounded-full bg-secondary/92 px-5 text-sm font-bold text-secondary-foreground shadow-[0_18px_40px_-28px_rgba(255,127,93,0.46)] transition-all-smooth hover:-translate-y-0.5 hover:brightness-95 lg:inline-flex btn-press">
                                {t('nav.book_appointment')}
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            ) : null}

            <main className={`min-h-screen ${isAdminView || view.page === 'main' ? '' : 'pt-24 md:pt-28'}`}>
                {isAdminView ? (
                    <div key={contentKey} className={contentTransitionClass}>
                        <Suspense fallback={
                            <div className="flex justify-center items-center min-h-[40vh]">
                                <LoadingIcon className="w-10 h-10 text-primary animate-spin" />
                            </div>
                        }>
                            {renderContent()}
                        </Suspense>
                    </div>
                ) : (
                    <PublicScrollReveal routeKey={contentKey}>
                        <div key={contentKey} className={contentTransitionClass}>
                            <Suspense fallback={view.page === 'productDetail' ? <ProductDetailLoadingShell /> : (
                                <div className="flex justify-center items-center min-h-[40vh]">
                                    <LoadingIcon className="w-10 h-10 text-primary animate-spin" />
                                </div>
                            )}>
                                {renderContent()}
                            </Suspense>
                        </div>
                    </PublicScrollReveal>
                )}
            </main>

            {!isAdminView ? (
            <footer id="footer" className="relative overflow-hidden border-t border-border/70 bg-white text-foreground transition-colors duration-300 dark:border-white/10 dark:bg-[linear-gradient(180deg,#0a111b_0%,#0d1623_52%,#0d1e24_100%)]">
                <div className="container relative mx-auto px-6 py-16 md:py-20">
                    <AnimatedSection className="overflow-hidden rounded-[36px] border border-border bg-white/76 p-8 shadow-[0_30px_72px_-42px_rgba(36,46,57,0.18)] backdrop-blur dark:border-white/10 dark:bg-[#111a27]/78 dark:shadow-[0_34px_76px_-42px_rgba(4,10,24,0.72)] md:p-10 lg:p-12">
                        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                            <div className="text-center lg:text-left">
                                <p className="section-kicker">Thế Giới Trị Mụn</p>
                                <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-foreground md:text-5xl">{t('cta.title')}</h2>
                                <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">{t('cta.subtitle')}</p>
                            </div>
                            <div className="rounded-[30px] bg-[linear-gradient(135deg,rgba(255,127,93,0.12),rgba(53,183,165,0.08),rgba(255,255,255,0.92))] p-6 text-center dark:bg-[linear-gradient(135deg,rgba(255,127,93,0.08),rgba(53,183,165,0.1),rgba(15,25,38,0.94))] md:p-7 lg:text-left">
                                <p className="text-sm leading-7 text-foreground/82">
                                    {getLocalized(footerContent, 'about_text') || 'Thế Giới Trị Mụn kết nối clinic, homecare và kiến thức trong một hành trình chăm da rõ ràng hơn.'}
                                </p>
                                <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                                    <button onClick={() => onRequestBooking()} className="inline-flex min-h-[50px] items-center rounded-full bg-secondary px-7 text-sm font-bold text-secondary-foreground shadow-[0_18px_40px_-28px_rgba(255,127,93,0.45)] transition hover:-translate-y-0.5 hover:brightness-95 btn-press">{t('cta.button')}</button>
                                    <button onClick={() => handleNavLinkClick(() => setView({ page: 'products' }), '/san-pham')} className="inline-flex min-h-[50px] items-center rounded-full border border-border bg-white px-7 text-sm font-bold text-foreground transition hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-card dark:hover:border-primary/40 btn-press">{t('nav.pharmacy')}</button>
                                </div>
                            </div>
                        </div>
                    </AnimatedSection>

                    {footerContent ? <div id="contact" className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
                        <div>
                            <h3 className="text-xl font-bold text-foreground mb-4 font-heading">{siteInfo?.clinic_name || "Thế Giới Trị Mụn"}</h3>
                            <p className="text-muted-foreground">{getLocalized(footerContent, 'about_text')}</p>
                            <div className="flex flex-wrap items-center gap-2.5 mt-5">
                                <AccessibleSocialLink 
                                    href={footerContent.facebook_url || 'https://facebook.com/thegioimun'} 
                                    network="Facebook" 
                                    siteName={siteInfo?.clinic_name || 'Thế Giới Trị Mụn'} 
                                    className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-[14px] bg-[#1877F2] text-white shadow-[0_4px_12px_rgba(24,119,242,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(24,119,242,0.45)] hover:scale-105 active:scale-95 btn-press"
                                >
                                    <FacebookIcon className="h-5 w-5 fill-current" />
                                </AccessibleSocialLink>

                                <AccessibleSocialLink 
                                    href={footerContent.instagram_url || 'https://instagram.com'} 
                                    network="Instagram" 
                                    siteName={siteInfo?.clinic_name || 'Thế Giới Trị Mụn'} 
                                    className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-[14px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-[0_4px_12px_rgba(220,39,67,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(220,39,67,0.45)] hover:scale-105 active:scale-95 btn-press"
                                >
                                    <InstagramIcon className="h-5 w-5 stroke-current" />
                                </AccessibleSocialLink>

                                <AccessibleSocialLink 
                                    href={footerContent.youtube_url || 'https://youtube.com'} 
                                    network="YouTube" 
                                    siteName={siteInfo?.clinic_name || 'Thế Giới Trị Mụn'} 
                                    className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-[14px] bg-[#FF0000] text-white shadow-[0_4px_12px_rgba(255,0,0,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(255,0,0,0.45)] hover:scale-105 active:scale-95 btn-press"
                                >
                                    <YoutubeIcon className="h-5 w-5 fill-current" />
                                </AccessibleSocialLink>

                                <AccessibleSocialLink 
                                    href={(footerContent as any).twitter_url || 'https://x.com'} 
                                    network="X (Twitter)" 
                                    siteName={siteInfo?.clinic_name || 'Thế Giới Trị Mụn'} 
                                    className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-[14px] bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:scale-105 active:scale-95 dark:bg-white dark:text-black dark:shadow-[0_4px_12px_rgba(255,255,255,0.15)] dark:hover:shadow-[0_8px_20px_rgba(255,255,255,0.25)] btn-press"
                                >
                                    <TwitterIcon className="h-4 w-4 fill-current" />
                                </AccessibleSocialLink>

                                <AccessibleSocialLink 
                                    href={footerContent.tiktok_url || 'https://tiktok.com'} 
                                    network="TikTok" 
                                    siteName={siteInfo?.clinic_name || 'Thế Giới Trị Mụn'} 
                                    className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-[14px] bg-[#010101] text-white border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,242,234,0.25)] hover:scale-105 active:scale-95 dark:border-white/20 btn-press"
                                >
                                    <TiktokIcon className="h-4.5 w-4.5 fill-current" />
                                </AccessibleSocialLink>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-4">{t('footer.quick_links')}</h3>
                            <ul className="space-y-2 text-muted-foreground">
                                {navLinks.filter(l => l.name !== t('nav.home')).map(link => (
                                    <li key={link.name}><button onClick={() => handleNavLinkClick(link.action, link.href)} className="hover:text-primary transition-all-smooth">{link.name}</button></li>
                                ))}
                                <li><button onClick={() => handleNavLinkClick(() => setView({ page: 'orderLookup' }), '/tra-cuu-don-hang')} className="hover:text-primary transition-all-smooth">{t('orders.lookup_short_cta')}</button></li>
                                <li><button onClick={() => handleNavLinkClick(() => setView({ page: 'main' }), '#faq')} className="hover:text-primary transition-all-smooth">FAQ</button></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-4">{t('footer.contact')}</h3>
                            <p className="mb-2 text-muted-foreground">{footerContent.address}</p>
                            <p className="mb-2 text-muted-foreground">Email: {footerContent.email}</p>
                            <p className="text-muted-foreground">Phone: {footerContent.phone}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-4">{t('footer.hours')}</h3>
                            <p className="mb-2 text-muted-foreground">{footerContent.working_hours_weekday}</p>
                            <p className="text-muted-foreground">{footerContent.working_hours_weekend}</p>
                        </div>
                    </div> : null}
                    {footerContent ? (
                        <div className="mt-8 border-t border-border/70 pt-6 text-center text-muted-foreground">
                            <p>{getLocalized(footerContent, 'copyright_text')}</p>
                        </div>
                    ) : null}
                </div>
            </footer>
            ) : null}

            {!isAdminView ? <FloatingContactButtons footerContent={footerContent} /> : null}
        </div>
    );
};

export default App;
