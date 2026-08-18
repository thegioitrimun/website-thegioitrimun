import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthMode } from '../components/AuthPage';
import {
    getBlogCategorySlug,
    getProductCategorySlug,
} from '../src/appRouting';
import {
    hasDetailedBlogContent,
    hasDetailedProductPayload,
    hasHomeDeferredPayloadContent,
    isCoreBootstrapDegraded,
    isDeferredBootstrapDegraded,
    mergeBlogCatalog,
    mergeProductCatalog,
    type RouteEntityStatus,
    upsertDetailedBlogPost,
} from '../src/appBootstrap';
import { isExpectedPageLifecycleAbort } from '../src/browserLifecycle';
import { scheduleDeferredTask } from '../src/browserIdle';
import { reportClientError } from '../src/clientMonitoring';
import { HOMEPAGE_HERO_CACHE_KEY } from '../src/siteDefaults';
import { createDeferredFunctionProxy, loadApiModule } from '../services/runtimeLoaders';
import type { PublicBootstrapPayload } from '../services/api';
import type {
    AboutPageData,
    AuthPageImages,
    BlogCategory,
    BlogPost,
    Doctor,
    DoctorDetail,
    FAQItem,
    FooterContent,
    HomepageHero,
    PatientProfile,
    PaymentSettings,
    Product,
    ProductBrand,
    ProductCategory,
    ProductOrder,
    Service,
    SiteInfo,
    UserData,
    View,
} from '../types';
import { useAuthHydration } from './useAuthHydration';

const api = createDeferredFunctionProxy<typeof import('../services/api')>(loadApiModule);

type AppDataState = {
    aboutData: AboutPageData | null;
    activeBlogPost: BlogPost | null;
    activeProduct: Product | null;
    authPageImages: AuthPageImages | null;
    blogCategories: BlogCategory[];
    blogPosts: BlogPost[];
    brands: ProductBrand[];
    currentUser: UserData | null;
    doctors: Doctor[];
    faqItems: FAQItem[];
    paymentSettings: PaymentSettings | null;
    productCategories: ProductCategory[];
    products: Product[];
    view: View;
};

type AppDataSetters = {
    setAboutData: Dispatch<SetStateAction<AboutPageData | null>>;
    setAllPatients: Dispatch<SetStateAction<PatientProfile[]>>;
    setAllProductOrders: Dispatch<SetStateAction<ProductOrder[]>>;
    setAllProducts: Dispatch<SetStateAction<Product[]>>;
    setAuthModeHint: Dispatch<SetStateAction<AuthMode>>;
    setAuthPageImages: Dispatch<SetStateAction<AuthPageImages | null>>;
    setBlogCategories: Dispatch<SetStateAction<BlogCategory[]>>;
    setBlogPosts: Dispatch<SetStateAction<BlogPost[]>>;
    setBrands: Dispatch<SetStateAction<ProductBrand[]>>;
    setCurrentUser: Dispatch<SetStateAction<UserData | null>>;
    setDoctorDetails: Dispatch<SetStateAction<DoctorDetail[]>>;
    setDoctors: Dispatch<SetStateAction<Doctor[]>>;
    setFaqItems: Dispatch<SetStateAction<FAQItem[]>>;
    setFeaturedDoctorIds: Dispatch<SetStateAction<string[]>>;
    setFeaturedPostSlugs: Dispatch<SetStateAction<string[]>>;
    setFeaturedServiceIds: Dispatch<SetStateAction<number[]>>;
    setFooterContent: Dispatch<SetStateAction<FooterContent | null>>;
    setHomepageHero: Dispatch<SetStateAction<HomepageHero | null>>;
    setPaymentSettings: Dispatch<SetStateAction<PaymentSettings | null>>;
    setProductCategories: Dispatch<SetStateAction<ProductCategory[]>>;
    setProducts: Dispatch<SetStateAction<Product[]>>;
    setServices: Dispatch<SetStateAction<Service[]>>;
    setSiteInfo: Dispatch<SetStateAction<SiteInfo | null>>;
    setView: Dispatch<SetStateAction<View>>;
};

type UseAppBootstrapArgs = {
    handleApiError: (error: unknown, context: string) => void;
    isSidebarOpen: boolean;
    clearWishlist: () => void;
    loadWishlist: (wishlist: number[]) => void;
    shouldUseHomeOptimizedBootstrap: boolean;
    state: AppDataState;
    setters: AppDataSetters;
};

const ACCOUNT_DETAIL_VIEWS = new Set<View['page']>([
    'account',
    'administrativeProfile',
    'medicalRecords',
    'myMedicalRecords',
    'appointments',
    'wishlist',
    'orderHistory',
]);

const PRIVILEGED_ROLES = new Set(['admin', 'master_admin']);

export type AdminModuleLoadState = {
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    refreshing: boolean;
};

const createIdleAdminModuleState = (): AdminModuleLoadState => ({
    status: 'idle',
    error: null,
    refreshing: false,
});

const createLiteUserData = (profile: UserData['profile'], previous?: UserData | null): UserData => ({
    profile,
    appointments: previous?.detail_loaded ? previous.appointments : [],
    medical_records: previous?.detail_loaded ? previous.medical_records : [],
    documents: previous?.detail_loaded ? previous.documents : [],
    wishlist: previous?.detail_loaded ? previous.wishlist : [],
    product_orders: previous?.detail_loaded ? previous.product_orders : [],
    detail_loaded: Boolean(previous?.detail_loaded),
});

export const useAppBootstrap = ({
    handleApiError,
    isSidebarOpen,
    clearWishlist,
    loadWishlist,
    shouldUseHomeOptimizedBootstrap,
    state,
    setters,
}: UseAppBootstrapArgs) => {
    const {
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
    } = state;
    const {
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
    } = setters;

    const [isLoading, setIsLoading] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isBlogDetailLoading, setIsBlogDetailLoading] = useState(false);
    const [isProductDetailLoading, setIsProductDetailLoading] = useState(false);
    const [blogDetailStatus, setBlogDetailStatus] = useState<RouteEntityStatus>('idle');
    const [productDetailStatus, setProductDetailStatus] = useState<RouteEntityStatus>('idle');
    const [hasFullBlogCatalog, setHasFullBlogCatalog] = useState(false);
    const [hasFullProductCatalog, setHasFullProductCatalog] = useState(false);
    const [hasFullBrandCatalog, setHasFullBrandCatalog] = useState(false);
    const [hasHomeDeferredContent, setHasHomeDeferredContent] = useState(false);
    const [isBlogCatalogLoading, setIsBlogCatalogLoading] = useState(false);
    const [isProductCatalogLoading, setIsProductCatalogLoading] = useState(false);
    const [productCatalogError, setProductCatalogError] = useState<string | null>(null);
    const [isBrandCatalogLoading, setIsBrandCatalogLoading] = useState(false);
    const [isDoctorsHydrationLoading, setIsDoctorsHydrationLoading] = useState(false);
    const [isAboutDataHydrationLoading, setIsAboutDataHydrationLoading] = useState(false);
    const [isPaymentSettingsHydrationLoading, setIsPaymentSettingsHydrationLoading] = useState(false);
    const [adminModuleStates, setAdminModuleStates] = useState<Record<string, AdminModuleLoadState>>({});

    const deferInitialBootstrapRef = useRef(shouldUseHomeOptimizedBootstrap);
    const bootstrapRecoveryTimerRef = useRef<number | null>(null);
    const bootstrapRecoveryAttemptsRef = useRef(0);
    const homeDeferredRecoveryTimerRef = useRef<number | null>(null);
    const homeDeferredRecoveryAttemptsRef = useRef(0);
    const homeDeferredPromiseRef = useRef<Promise<PublicBootstrapPayload | null> | null>(null);
    const doctorsPromiseRef = useRef<Promise<Doctor[]> | null>(null);
    const aboutDataPromiseRef = useRef<Promise<AboutPageData | null> | null>(null);
    const paymentSettingsPromiseRef = useRef<Promise<PaymentSettings | null> | null>(null);
    const authPageImagesPromiseRef = useRef<Promise<AuthPageImages | null> | null>(null);
    const blogCatalogPromiseRef = useRef<Promise<BlogPost[]> | null>(null);
    const productCatalogPromiseRef = useRef<Promise<Product[]> | null>(null);
    const brandCatalogPromiseRef = useRef<Promise<ProductBrand[]> | null>(null);
    const userDataPromiseRef = useRef(new Map<string, Promise<void>>());
    const blogDetailPromiseRef = useRef(new Map<string, Promise<BlogPost | null>>());
    const productDetailPromiseRef = useRef(new Map<string, Promise<Product | null>>());
    const adminModulePromiseRef = useRef(new Map<string, Promise<void>>());
    const adminPrefetchRef = useRef(new Set<string>());

    const fetchAdminData = useCallback(async (options: { page?: View['page']; force?: boolean } = {}) => {
        const page = options.page || view.page;
        if (!page.startsWith('admin')) return;

        const moduleKey = page;
        const existingRequest = adminModulePromiseRef.current.get(moduleKey);
        if (existingRequest && !options.force) return existingRequest;

        type AdminTask = {
            key: string;
            label: string;
            run: () => Promise<unknown>;
            apply?: (data: any) => void;
        };
        const tasks: AdminTask[] = [];
        const add = (task: AdminTask) => tasks.push(task);
        const force = Boolean(options.force);

        const addUsers = () => {
            add({ key: 'patients', label: 'danh sách người dùng', run: () => api.getAllPatients({ force }), apply: setAllPatients });
            add({ key: 'doctor-details', label: 'hồ sơ bác sĩ', run: () => api.getDoctorDetails({ force }), apply: setDoctorDetails });
        };
        const addProducts = () => add({
            key: 'products', label: 'danh sách sản phẩm', run: () => api.getAllProducts({ force }), apply: setAllProducts,
        });
        const addOrders = () => add({
            key: 'product-orders', label: 'đơn hàng sản phẩm', run: () => api.getAllProductOrders({ force }), apply: setAllProductOrders,
        });
        const addServices = () => add({
            key: 'services', label: 'dịch vụ và liệu trình', run: () => api.getAdminServices({ force }), apply: setServices,
        });
        const addCapabilities = () => add({
            key: 'system-capabilities', label: 'trạng thái hệ thống', run: () => api.getAdminSystemCapabilities({ force }),
        });

        switch (page) {
            case 'adminDashboard':
                addOrders();
                addServices();
                add({ key: 'doctor-details', label: 'hồ sơ bác sĩ', run: () => api.getDoctorDetails({ force }), apply: setDoctorDetails });
                add({ key: 'appointments', label: 'lịch hẹn', run: () => api.getAdminAppointments({ force }) });
                addCapabilities();
                break;
            case 'adminUserManagement':
                addUsers();
                break;
            case 'adminBlogManagement':
                add({ key: 'blog-posts', label: 'bài viết', run: () => api.getAdminBlogPosts({ force }), apply: (data: BlogPost[]) => {
                    setBlogPosts(data);
                    setHasFullBlogCatalog(true);
                } });
                add({ key: 'blog-categories', label: 'chuyên mục kiến thức', run: () => api.getAdminBlogCategories({ force }), apply: setBlogCategories });
                break;
            case 'adminServiceManagement':
                addServices();
                add({ key: 'appointments', label: 'lịch hẹn', run: () => api.getAdminAppointments({ force }) });
                break;
            case 'adminImageLibrary':
                addCapabilities();
                break;
            case 'adminProductImageImporter':
                addProducts();
                addCapabilities();
                break;
            case 'adminPharmacyManagement':
                addProducts();
                addOrders();
                add({ key: 'product-categories', label: 'chuyên mục sản phẩm', run: () => api.getAdminProductCategories({ force }), apply: setProductCategories });
                add({ key: 'product-brands', label: 'thương hiệu', run: () => api.getAdminProductBrands({ force }), apply: setBrands });
                addCapabilities();
                break;
            case 'adminSiteManagement':
                addServices();
                add({ key: 'doctor-details', label: 'hồ sơ bác sĩ', run: () => api.getDoctorDetails({ force }), apply: setDoctorDetails });
                add({ key: 'blog-posts', label: 'bài viết', run: () => api.getAdminBlogPosts({ force }), apply: (data: BlogPost[]) => {
                    setBlogPosts(data);
                    setHasFullBlogCatalog(true);
                } });
                add({ key: 'blog-categories', label: 'chuyên mục kiến thức', run: () => api.getAdminBlogCategories({ force }), apply: setBlogCategories });
                add({
                    key: 'site-snapshot',
                    label: 'nội dung website',
                    run: () => api.getAdminSiteSnapshot({ force }),
                    apply: (snapshot: Awaited<ReturnType<typeof api.getAdminSiteSnapshot>>) => {
                        setAboutData(snapshot.aboutData);
                        setAuthPageImages(snapshot.authPageImages);
                        setFaqItems(snapshot.faqItems);
                        setFeaturedDoctorIds(snapshot.featuredDoctorIds);
                        setFeaturedPostSlugs(snapshot.featuredPostSlugs);
                        setFeaturedServiceIds(snapshot.featuredServiceIds);
                        setFooterContent(snapshot.footerContent);
                        setHomepageHero(snapshot.homepageHero);
                        setPaymentSettings(snapshot.paymentSettings);
                        setSiteInfo(snapshot.siteInfo);
                    },
                });
                addCapabilities();
                break;
            default:
                break;
        }

        if (!tasks.length) return;

        const request = (async () => {
            setAdminModuleStates((current) => {
                const previous = current[moduleKey] || createIdleAdminModuleState();
                return {
                    ...current,
                    [moduleKey]: {
                        status: previous.status === 'ready' ? 'ready' : 'loading',
                        error: null,
                        refreshing: previous.status === 'ready',
                    },
                };
            });

            const settled = await Promise.allSettled(tasks.map((task) => task.run()));
            const failures: string[] = [];

            settled.forEach((result, index) => {
                const task = tasks[index];
                if (result.status === 'fulfilled') {
                    task.apply?.(result.value);
                    return;
                }
                if (isExpectedPageLifecycleAbort(result.reason)) return;

                const message = result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason || 'Unknown admin module error');
                failures.push(`${task.label}: ${message}`);
                reportClientError({
                    type: 'api-error',
                    message,
                    context: `tải module quản trị:${moduleKey}:${task.key}`,
                    stack: result.reason instanceof Error ? result.reason.stack : undefined,
                });
            });

            setAdminModuleStates((current) => ({
                ...current,
                [moduleKey]: failures.length
                    ? { status: 'error', error: failures.join(' | '), refreshing: false }
                    : { status: 'ready', error: null, refreshing: false },
            }));
        })().finally(() => {
            if (adminModulePromiseRef.current.get(moduleKey) === request) {
                adminModulePromiseRef.current.delete(moduleKey);
            }
        });

        adminModulePromiseRef.current.set(moduleKey, request);
        return request;
    }, [
        setAboutData, setAllPatients, setAllProductOrders, setAllProducts, setAuthPageImages,
        setBlogCategories, setBlogPosts, setBrands, setDoctorDetails, setFaqItems,
        setFeaturedDoctorIds, setFeaturedPostSlugs, setFeaturedServiceIds, setFooterContent,
        setHomepageHero, setPaymentSettings, setProductCategories, setServices, setSiteInfo, view.page,
    ]);

    const recoverHomepageServices = useCallback(async (payload: PublicBootstrapPayload) => {
        const expectsCoreCollections = payload.mode === 'home' || payload.mode === 'full';
        if (!expectsCoreCollections) return;

        const hasMatchedFeaturedServices = payload.featuredServiceIds.length === 0
            || payload.services.some((service) => payload.featuredServiceIds.includes(Number(service.id)));

        if (payload.services.length > 0 && hasMatchedFeaturedServices) {
            return;
        }

        try {
            const [freshServices, freshFeaturedServiceIds] = await Promise.all([
                api.getServices(),
                api.getFeaturedServiceIds(),
            ]);

            if (freshServices.length > 0) {
                setServices(freshServices);
            }

            if (freshFeaturedServiceIds.length > 0 || payload.featuredServiceIds.length === 0) {
                setFeaturedServiceIds(freshFeaturedServiceIds);
            }
        } catch (error) {
            console.warn('Homepage services recovery could not be loaded:', error);
        }
    }, [setFeaturedServiceIds, setServices]);

    const fetchAllData = useCallback(async (options?: { background?: boolean }) => {
        const shouldBlockRender = !options?.background;
        const requestedMode = deferInitialBootstrapRef.current ? 'home' : 'full';
        setIsBootstrapping(true);
        if (requestedMode === 'full') {
            setProductCatalogError(null);
        }
        if (shouldBlockRender) {
            setIsLoading(true);
        }
        try {
            const bootstrapData = await api.getPublicBootstrap(requestedMode);

            setServices(bootstrapData.services);
            setDoctors(bootstrapData.doctors);
            setBlogPosts(bootstrapData.blogPosts);
            setBlogCategories(bootstrapData.blogCategories);
            setFaqItems(bootstrapData.faqItems);
            setFeaturedDoctorIds(bootstrapData.featuredDoctorIds);
            setFeaturedPostSlugs(bootstrapData.featuredPostSlugs);
            setAboutData(bootstrapData.aboutData);
            setHomepageHero(bootstrapData.homepageHero);
            try {
                window.localStorage.setItem(HOMEPAGE_HERO_CACHE_KEY, JSON.stringify(bootstrapData.homepageHero));
            } catch {
                // Ignore localStorage write failures.
            }
            setFeaturedServiceIds(bootstrapData.featuredServiceIds);
            setSiteInfo(bootstrapData.siteInfo);
            setFooterContent(bootstrapData.footerContent);
            setAuthPageImages(bootstrapData.authPageImages);
            setProducts(bootstrapData.products);
            setProductCategories(bootstrapData.productCategories);
            setPaymentSettings(bootstrapData.paymentSettings);
            setBrands(bootstrapData.brands);
            const isCompleteFullBootstrap = bootstrapData.mode === 'full'
                && !bootstrapData.partial
                && bootstrapData.source !== 'fallback';
            setHasFullBlogCatalog(isCompleteFullBootstrap);
            setHasFullProductCatalog(isCompleteFullBootstrap);
            setHasFullBrandCatalog(isCompleteFullBootstrap);
            if (isCompleteFullBootstrap) {
                setProductCatalogError(null);
            }
            setHasHomeDeferredContent(bootstrapData.mode === 'full' || hasHomeDeferredPayloadContent(bootstrapData));
            void recoverHomepageServices(bootstrapData);

            const shouldRetryDegradedBootstrap = isCoreBootstrapDegraded(bootstrapData);

            if (bootstrapRecoveryTimerRef.current !== null) {
                window.clearTimeout(bootstrapRecoveryTimerRef.current);
                bootstrapRecoveryTimerRef.current = null;
            }

            if (shouldRetryDegradedBootstrap && bootstrapRecoveryAttemptsRef.current < 2) {
                bootstrapRecoveryAttemptsRef.current += 1;
                const nextDelayMs = bootstrapRecoveryAttemptsRef.current === 1 ? 1200 : 2400;
                bootstrapRecoveryTimerRef.current = window.setTimeout(() => {
                    bootstrapRecoveryTimerRef.current = null;
                    void fetchAllData({ background: true });
                }, nextDelayMs);
            } else if (!shouldRetryDegradedBootstrap) {
                bootstrapRecoveryAttemptsRef.current = 0;
            }
        } catch (error) {
            if (requestedMode === 'full') {
                setHasFullProductCatalog(false);
                setProductCatalogError(error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.');
            }
            handleApiError(error, 'tải dữ liệu ban đầu');
        } finally {
            setIsBootstrapping(false);
            if (shouldBlockRender) {
                setIsLoading(false);
            }
        }
    }, [
        handleApiError,
        setAboutData,
        setAuthPageImages,
        setBlogCategories,
        setBlogPosts,
        setBrands,
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
        recoverHomepageServices,
        setServices,
        setSiteInfo,
    ]);

    const fetchUserData = useCallback(async (userId: string, options?: { forceFull?: boolean }) => {
        const requestKey = `${userId}:${options?.forceFull ? 'full' : 'auto'}`;
        const pendingRequest = userDataPromiseRef.current.get(requestKey);
        if (pendingRequest) {
            return pendingRequest;
        }

        const promise = (async () => {
            try {
                const profile = await api.getUserProfile(userId);
                const isPrivilegedUser = PRIVILEGED_ROLES.has(profile.role);

                if (isPrivilegedUser && !options?.forceFull) {
                    setCurrentUser((previous) => createLiteUserData(profile, previous?.profile.id === userId ? previous : null));
                    return;
                }

                const userData = await api.getUserData(userId);
                setCurrentUser(userData);
                if (userData?.wishlist) {
                    loadWishlist(userData.wishlist);
                }
            } catch (error) {
                if (isExpectedPageLifecycleAbort(error)) {
                    return;
                }
                handleApiError(error, 'tải dữ liệu người dùng');
            } finally {
                userDataPromiseRef.current.delete(requestKey);
            }
        })();

        userDataPromiseRef.current.set(requestKey, promise);
        return promise;
    }, [handleApiError, loadWishlist, setCurrentUser]);

    const mergeHomeDeferredPayload = useCallback((payload: PublicBootstrapPayload) => {
        if (payload.blogCategories.length > 0) {
            setBlogCategories((prev) => prev.length > 0 ? prev : payload.blogCategories);
        }
        if (payload.faqItems.length > 0) {
            setFaqItems((prev) => prev.length > 0 ? prev : payload.faqItems);
        }
        if (payload.featuredPostSlugs.length > 0) {
            setFeaturedPostSlugs((prev) => prev.length > 0 ? prev : payload.featuredPostSlugs);
        }
        if (payload.blogPosts.length > 0) {
            setBlogPosts((prev) => mergeBlogCatalog(prev, payload.blogPosts));
        }
        if (payload.brands.length > 0) {
            setBrands((prev) => prev.length > 0 ? prev : payload.brands);
        }
        if (hasHomeDeferredPayloadContent(payload)) {
            setHasHomeDeferredContent(true);
        }
    }, [setBlogCategories, setBlogPosts, setBrands, setFaqItems, setFeaturedPostSlugs]);



    const ensureHomeDeferredContentLoaded = useCallback(async () => {
        if (!deferInitialBootstrapRef.current || hasHomeDeferredContent) {
            return null;
        }
        if (homeDeferredPromiseRef.current) {
            return homeDeferredPromiseRef.current;
        }

        const promise = api.getPublicBootstrap('home_deferred')
            .then((payload) => {
                mergeHomeDeferredPayload(payload);

                if (homeDeferredRecoveryTimerRef.current !== null) {
                    window.clearTimeout(homeDeferredRecoveryTimerRef.current);
                    homeDeferredRecoveryTimerRef.current = null;
                }

                if (isDeferredBootstrapDegraded(payload) && homeDeferredRecoveryAttemptsRef.current < 2) {
                    homeDeferredRecoveryAttemptsRef.current += 1;
                    const nextDelayMs = homeDeferredRecoveryAttemptsRef.current === 1 ? 1400 : 2800;
                    homeDeferredRecoveryTimerRef.current = window.setTimeout(() => {
                        homeDeferredRecoveryTimerRef.current = null;
                        void ensureHomeDeferredContentLoaded();
                    }, nextDelayMs);
                } else if (hasHomeDeferredPayloadContent(payload)) {
                    homeDeferredRecoveryAttemptsRef.current = 0;
                }

                return payload;
            })
            .catch((error) => {
                console.warn('Deferred homepage payload could not be loaded:', error);
                reportClientError({
                    type: 'api-error',
                    message: error instanceof Error ? error.message : String(error),
                    context: 'tải nội dung homepage mở rộng',
                    stack: error instanceof Error ? error.stack : undefined,
                });
                return null;
            })
            .finally(() => {
                homeDeferredPromiseRef.current = null;
            });

        homeDeferredPromiseRef.current = promise;
        return promise;
    }, [hasHomeDeferredContent, mergeHomeDeferredPayload]);

    const ensureDoctorsLoaded = useCallback(async () => {
        if (doctors.length > 0) return doctors;
        if (doctorsPromiseRef.current) return doctorsPromiseRef.current;

        setIsDoctorsHydrationLoading(true);
        const promise = api.getDoctors()
            .then((data) => {
                setDoctors(data);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải danh sách bác sĩ');
                return [];
            })
            .finally(() => {
                doctorsPromiseRef.current = null;
                setIsDoctorsHydrationLoading(false);
            });

        doctorsPromiseRef.current = promise;
        return promise;
    }, [doctors, handleApiError, setDoctors]);

    const ensureAboutDataLoaded = useCallback(async () => {
        if (aboutData) return aboutData;
        if (aboutDataPromiseRef.current) return aboutDataPromiseRef.current;

        setIsAboutDataHydrationLoading(true);
        const promise = api.getAboutPageData()
            .then((data) => {
                setAboutData(data);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải nội dung giới thiệu');
                return null;
            })
            .finally(() => {
                aboutDataPromiseRef.current = null;
                setIsAboutDataHydrationLoading(false);
            });

        aboutDataPromiseRef.current = promise;
        return promise;
    }, [aboutData, handleApiError, setAboutData]);

    const ensurePaymentSettingsLoaded = useCallback(async () => {
        if (paymentSettings) return paymentSettings;
        if (paymentSettingsPromiseRef.current) return paymentSettingsPromiseRef.current;

        setIsPaymentSettingsHydrationLoading(true);
        const promise = api.getPaymentSettings()
            .then((data) => {
                setPaymentSettings(data);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải cấu hình thanh toán');
                return null;
            })
            .finally(() => {
                paymentSettingsPromiseRef.current = null;
                setIsPaymentSettingsHydrationLoading(false);
            });

        paymentSettingsPromiseRef.current = promise;
        return promise;
    }, [handleApiError, paymentSettings, setPaymentSettings]);

    const ensureAuthPageImagesLoaded = useCallback(async () => {
        if (authPageImages) return authPageImages;
        if (authPageImagesPromiseRef.current) return authPageImagesPromiseRef.current;

        const promise = api.getAuthPageImages()
            .then((data) => {
                setAuthPageImages(data);
                return data;
            })
            .catch((error) => {
                console.warn('Could not load auth page images:', error);
                return null;
            })
            .finally(() => {
                authPageImagesPromiseRef.current = null;
            });

        authPageImagesPromiseRef.current = promise;
        return promise;
    }, [authPageImages, setAuthPageImages]);

    const ensureBlogCatalogLoaded = useCallback(async () => {
        if (hasFullBlogCatalog) return blogPosts;
        if (blogCatalogPromiseRef.current) return blogCatalogPromiseRef.current;

        setIsBlogCatalogLoading(true);
        const promise = api.getBlogPostsLite()
            .then((data) => {
                setBlogPosts((prev) => mergeBlogCatalog(prev, data));
                setHasFullBlogCatalog(true);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải danh sách bài viết');
                setHasFullBlogCatalog(true);
                return [];
            })
            .finally(() => {
                blogCatalogPromiseRef.current = null;
                setIsBlogCatalogLoading(false);
            });

        blogCatalogPromiseRef.current = promise;
        return promise;
    }, [blogPosts, handleApiError, hasFullBlogCatalog, setBlogPosts]);

    const ensureProductCatalogLoaded = useCallback(async () => {
        if (hasFullProductCatalog) return products;
        if (productCatalogPromiseRef.current) return productCatalogPromiseRef.current;

        setIsProductCatalogLoading(true);
        setProductCatalogError(null);
        const promise = api.getProductsLite()
            .then((data) => {
                setProducts((prev) => mergeProductCatalog(prev, data));
                setHasFullProductCatalog(true);
                setProductCatalogError(null);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải danh sách sản phẩm');
                setHasFullProductCatalog(false);
                setProductCatalogError(error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.');
                return [];
            })
            .finally(() => {
                productCatalogPromiseRef.current = null;
                setIsProductCatalogLoading(false);
            });

        productCatalogPromiseRef.current = promise;
        return promise;
    }, [handleApiError, hasFullProductCatalog, products, setProducts]);

    const ensureBrandCatalogLoaded = useCallback(async () => {
        if (hasFullBrandCatalog) return brands;
        if (brandCatalogPromiseRef.current) return brandCatalogPromiseRef.current;

        setIsBrandCatalogLoading(true);
        const promise = api.getBrands()
            .then((data) => {
                setBrands(data);
                setHasFullBrandCatalog(true);
                return data;
            })
            .catch((error) => {
                handleApiError(error, 'tải danh sách thương hiệu');
                return [];
            })
            .finally(() => {
                brandCatalogPromiseRef.current = null;
                setIsBrandCatalogLoading(false);
            });

        brandCatalogPromiseRef.current = promise;
        return promise;
    }, [brands, handleApiError, hasFullBrandCatalog, setBrands]);

    const loadBlogDetailRecord = useCallback(async (slug: string, options?: { admin?: boolean }): Promise<BlogPost | null> => {
        const cacheKey = `${options?.admin ? 'admin' : 'public'}:${slug}`;
        const existing = blogPosts.find((entry) => entry.slug === slug);
        if (hasDetailedBlogContent(existing)) {
            return existing;
        }

        const inFlight = blogDetailPromiseRef.current.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        const promise = (options?.admin ? api.getBlogPostBySlugAdmin(slug) : api.getBlogPostBySlug(slug))
            .then((fullPost) => {
                if (hasDetailedBlogContent(fullPost)) {
                    setBlogPosts((prev) => upsertDetailedBlogPost(prev, fullPost));
                    setHasFullBlogCatalog(true);
                }
                return fullPost;
            })
            .finally(() => {
                blogDetailPromiseRef.current.delete(cacheKey);
            });

        blogDetailPromiseRef.current.set(cacheKey, promise);
        return promise;
    }, [blogPosts, setBlogPosts]);

    const loadProductDetailRecord = useCallback(async (idOrSlug: number | string): Promise<Product | null> => {
        const cacheKey = String(idOrSlug);
        const existing = products.find((entry) => entry.id === idOrSlug || entry.slug === String(idOrSlug));
        if (hasDetailedProductPayload(existing)) {
            return existing;
        }

        const inFlight = productDetailPromiseRef.current.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        const promise = api.getProductByIdOrSlug(idOrSlug)
            .then((fullProduct) => {
                if (hasDetailedProductPayload(fullProduct)) {
                    setProducts((prev) => {
                        const existingIndex = prev.findIndex((entry) => entry.id === fullProduct.id || entry.slug === fullProduct.slug);
                        if (existingIndex === -1) return [fullProduct, ...prev];
                        const next = [...prev];
                        next[existingIndex] = { ...next[existingIndex], ...fullProduct };
                        return next;
                    });
                }
                return fullProduct;
            })
            .finally(() => {
                productDetailPromiseRef.current.delete(cacheKey);
            });

        productDetailPromiseRef.current.set(cacheKey, promise);
        return promise;
    }, [products, setProducts]);

    useEffect(() => {
        const cancel = scheduleDeferredTask(
            () => fetchAllData({ background: true }),
            { immediate: true, timeout: 900 },
        );
        return cancel;
    }, [fetchAllData]);

    useEffect(() => {
        return () => {
            if (bootstrapRecoveryTimerRef.current !== null) {
                window.clearTimeout(bootstrapRecoveryTimerRef.current);
                bootstrapRecoveryTimerRef.current = null;
            }
            if (homeDeferredRecoveryTimerRef.current !== null) {
                window.clearTimeout(homeDeferredRecoveryTimerRef.current);
                homeDeferredRecoveryTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!deferInitialBootstrapRef.current) return;
        if (view.page !== 'main') return;
        if (isBootstrapping || hasHomeDeferredContent) return;

        const cancel = scheduleDeferredTask(
            () => {
                void ensureHomeDeferredContentLoaded();
            },
            { delayMs: 480, timeout: 1400 },
        );
        return cancel;
    }, [ensureHomeDeferredContentLoaded, hasHomeDeferredContent, isBootstrapping, view.page]);

    const clearAuthUserState = useCallback(() => {
        setCurrentUser(null);
        clearWishlist();
    }, [clearWishlist, setCurrentUser]);

    const handlePasswordRecovery = useCallback(() => {
        setAuthModeHint('reset-password');
        setView({ page: 'auth' });
    }, [setAuthModeHint, setView]);

    useAuthHydration({
        deferInitialBootstrap: deferInitialBootstrapRef.current,
        fetchUserData,
        clearAuthUserState,
        handlePasswordRecovery,
        setAuthModeHint,
    });

    useEffect(() => {
        const needsFullBlogCatalog = [
            'blog',
            'blogCategory',
            'serviceDetail',
            'blogDetail',
        ].includes(view.page);

        const needsFullProductCatalog = [
            'brands',
            'brandLanding',
            'products',
            'productsCategory',
            'wishlist',
            'serviceDetail',
            'blogDetail',
        ].includes(view.page);
        const needsFullBrandCatalog = [
            'brands',
            'brandLanding',
            'productDetail',
            'products',
            'productsCategory',
        ].includes(view.page);

        if (!isBootstrapping && needsFullBlogCatalog && !hasFullBlogCatalog) {
            void ensureBlogCatalogLoaded();
        }
        if (!isBootstrapping && needsFullProductCatalog && !hasFullProductCatalog) {
            void ensureProductCatalogLoaded();
        }
        if (!isBootstrapping && needsFullBrandCatalog && !hasFullBrandCatalog && !isBrandCatalogLoading) {
            void ensureBrandCatalogLoaded();
        }
    }, [
        ensureBlogCatalogLoaded,
        ensureBrandCatalogLoaded,
        ensureProductCatalogLoaded,
        hasFullBlogCatalog,
        hasFullBrandCatalog,
        hasFullProductCatalog,
        isBrandCatalogLoading,
        isBootstrapping,
        view.page,
    ]);

    useEffect(() => {
        const needsDoctors = [
            'about',
            'booking',
            'appointments',
            'medicalRecords',
            'myMedicalRecords',
        ].includes(view.page);

        if (needsDoctors && doctors.length === 0 && !isDoctorsHydrationLoading) {
            void ensureDoctorsLoaded();
        }

        if (view.page === 'about' && !aboutData && !isAboutDataHydrationLoading) {
            void ensureAboutDataLoaded();
        }

        if (view.page === 'checkout' && !paymentSettings && !isPaymentSettingsHydrationLoading) {
            void ensurePaymentSettingsLoaded();
        }

        if (view.page === 'auth' && !authPageImages) {
            void ensureAuthPageImagesLoaded();
        }

        if (isSidebarOpen && currentUser && doctors.length === 0 && !isDoctorsHydrationLoading) {
            void ensureDoctorsLoaded();
        }
    }, [
        aboutData,
        authPageImages,
        currentUser,
        doctors.length,
        ensureAboutDataLoaded,
        ensureAuthPageImagesLoaded,
        ensureDoctorsLoaded,
        ensurePaymentSettingsLoaded,
        isAboutDataHydrationLoading,
        isDoctorsHydrationLoading,
        isPaymentSettingsHydrationLoading,
        isSidebarOpen,
        paymentSettings,
        view.page,
    ]);

    useEffect(() => {
        if (!currentUser || !PRIVILEGED_ROLES.has(currentUser.profile.role) || !view.page.startsWith('admin')) {
            return;
        }
        void fetchAdminData({ page: view.page });
    }, [currentUser, fetchAdminData, view.page]);

    useEffect(() => {
        if (!view.page.startsWith('admin') || adminModuleStates[view.page]?.status !== 'ready') return;
        if (adminPrefetchRef.current.has(view.page)) return;
        adminPrefetchRef.current.add(view.page);

        const adjacentModules: Partial<Record<View['page'], View['page'][]>> = {
            adminDashboard: ['adminPharmacyManagement', 'adminServiceManagement'],
            adminPharmacyManagement: ['adminImageLibrary'],
            adminUserManagement: ['adminSiteManagement'],
            adminBlogManagement: ['adminSiteManagement'],
            adminServiceManagement: ['adminDashboard'],
            adminSiteManagement: ['adminBlogManagement'],
        };
        const modules = adjacentModules[view.page] || [];
        if (!modules.length) return;

        return scheduleDeferredTask(() => {
            modules.forEach((page) => { void fetchAdminData({ page }); });
        }, { delayMs: 900, timeout: 1800 });
    }, [adminModuleStates, fetchAdminData, view.page]);

    useEffect(() => {
        if (view.page !== 'blogDetail') {
            setBlogDetailStatus('idle');
            setIsBlogDetailLoading(false);
            return;
        }

        if (hasDetailedBlogContent(activeBlogPost)) {
            setBlogDetailStatus('ready');
            setIsBlogDetailLoading(false);
            return;
        }

        let cancelled = false;
        setBlogDetailStatus('loading');
        setIsBlogDetailLoading(true);

        const loadBlogDetail = async () => {
            try {
                const fullPost = await loadBlogDetailRecord(view.slug);
                if (cancelled) return;

                if (hasDetailedBlogContent(fullPost)) {
                    setBlogDetailStatus('ready');
                } else {
                    setBlogDetailStatus('missing');
                }
            } catch (error) {
                if (!cancelled) {
                    handleApiError(error, 'tải chi tiết bài viết');
                    setBlogDetailStatus('error');
                }
            } finally {
                if (!cancelled) setIsBlogDetailLoading(false);
            }
        };

        void loadBlogDetail();
        return () => {
            cancelled = true;
        };
    }, [activeBlogPost, handleApiError, loadBlogDetailRecord, view.page, view.page === 'blogDetail' ? view.slug : null]);

    useEffect(() => {
        if (view.page !== 'productDetail') {
            setProductDetailStatus('idle');
            setIsProductDetailLoading(false);
            return;
        }

        if (hasDetailedProductPayload(activeProduct)) {
            setProductDetailStatus('ready');
            setIsProductDetailLoading(false);
            return;
        }

        let cancelled = false;
        setProductDetailStatus('loading');
        setIsProductDetailLoading(true);

        const loadProductDetail = async () => {
            try {
                const fullProduct = await loadProductDetailRecord(view.id);
                if (cancelled) return;

                if (hasDetailedProductPayload(fullProduct)) {
                    setProductDetailStatus('ready');
                } else {
                    setProductDetailStatus('missing');
                }
            } catch (error) {
                if (!cancelled) {
                    handleApiError(error, 'tải chi tiết sản phẩm');
                    setProductDetailStatus('error');
                }
            } finally {
                if (!cancelled) setIsProductDetailLoading(false);
            }
        };

        void loadProductDetail();
        return () => {
            cancelled = true;
        };
    }, [activeProduct, handleApiError, loadProductDetailRecord, view.page, view.page === 'productDetail' ? view.id : null]);

    const currentProductDetailId = view.page === 'productDetail' ? view.id : null;
    const currentProductDetailCategorySlug = view.page === 'productDetail' ? view.categorySlug : null;
    const currentBlogDetailCategorySlug = view.page === 'blogDetail' ? view.categorySlug : null;

    useEffect(() => {
        if (view.page !== 'productDetail' || !activeProduct) return;

        const canonicalCategorySlug = getProductCategorySlug(activeProduct, productCategories);
        const canonicalId = activeProduct.slug || activeProduct.id;
        const needsCategoryFix = view.categorySlug !== canonicalCategorySlug;
        const needsIdFix = String(view.id) !== String(canonicalId);

        if (!needsCategoryFix && !needsIdFix) return;

        setView((prev) => {
            if (prev.page !== 'productDetail') return prev;
            return {
                ...prev,
                id: canonicalId,
                categorySlug: canonicalCategorySlug,
            };
        });
    }, [activeProduct, currentProductDetailCategorySlug, currentProductDetailId, productCategories, setView, view]);

    useEffect(() => {
        if (view.page !== 'blogDetail' || !activeBlogPost) return;

        const canonicalCategorySlug = getBlogCategorySlug(activeBlogPost, blogCategories);
        if (view.categorySlug === canonicalCategorySlug) return;

        setView((prev) => {
            if (prev.page !== 'blogDetail') return prev;
            return {
                ...prev,
                categorySlug: canonicalCategorySlug,
            };
        });
    }, [activeBlogPost, blogCategories, currentBlogDetailCategorySlug, setView, view]);

    useEffect(() => {
        if (!currentUser || currentUser.detail_loaded || !ACCOUNT_DETAIL_VIEWS.has(view.page)) {
            return;
        }

        void fetchUserData(currentUser.profile.id, { forceFull: true });
    }, [currentUser, fetchUserData, view.page]);

    return {
        adminModuleStates,
        deferInitialBootstrap: deferInitialBootstrapRef.current,
        fetchAdminData,
        fetchAllData,
        fetchUserData,
        ensureAboutDataLoaded,
        ensureAuthPageImagesLoaded,
        ensureBlogCatalogLoaded,
        ensureDoctorsLoaded,
        ensureHomeDeferredContentLoaded,
        ensurePaymentSettingsLoaded,
        ensureProductCatalogLoaded,
        hasFullBlogCatalog,
        hasFullProductCatalog,
        hasHomeDeferredContent,
        isAboutDataHydrationLoading,
        isBlogCatalogLoading,
        isBlogDetailLoading,
        isBootstrapping,
        isDoctorsHydrationLoading,
        isLoading,
        isPaymentSettingsHydrationLoading,
        isProductCatalogLoading,
        isProductDetailLoading,
        blogDetailStatus,
        loadBlogDetailRecord,
        loadProductDetailRecord,
        productDetailStatus,
        productCatalogError,
        retryAdminModule: (page: View['page']) => fetchAdminData({ page, force: true }),
        setHasFullBlogCatalog,
        setHasFullProductCatalog,
    };
};
