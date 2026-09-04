import type { AuthMode } from '../components/AuthPage';
import type { BlogCategory, BlogPost, Product, ProductCategory, Service, View } from '../types';

export const getProductCategorySlug = (product: Product, categories: ProductCategory[] = []): string => {
    const directCategory = Array.isArray(product.category) ? product.category[0] : product.category;
    if (directCategory?.slug) return directCategory.slug;
    if (product.category_slug) return product.category_slug;
    const category = categories.find(c => c.id === product.category_id);
    return category?.slug || 'khac';
};

export const getProductDetailPath = (product: Product, categories: ProductCategory[] = []): string => {
    const categorySlug = getProductCategorySlug(product, categories);
    const productSlug = product.slug || product.id;
    return `/san-pham/${categorySlug}/${productSlug}`;
};

export const getBlogCategorySlug = (post: BlogPost, categories: BlogCategory[] = []): string => {
    const category = categories.find(c => c.slug === post.category_slug);
    return category?.slug || post.category_slug || 'tong-hop';
};

export const getBlogDetailPath = (post: BlogPost, categories: BlogCategory[] = []): string => {
    const categorySlug = getBlogCategorySlug(post, categories);
    return `/kien-thuc/${categorySlug}/${post.slug}`;
};

export const getAuthModeFromLocation = (): AuthMode => {
    if (typeof window === 'undefined') return 'login';
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const authType = hashParams.get('type') || searchParams.get('type');
    return authType === 'recovery' ? 'reset-password' : 'login';
};

export const clearAuthRecoveryUrl = () => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete('type');
    const search = searchParams.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);
};

export const viewToPath = (
    view: View,
    products: Product[] = [],
    services: Service[] = [],
    productCategories: ProductCategory[] = [],
    posts: BlogPost[] = [],
    blogCategories: BlogCategory[] = [],
): string => {
    switch (view.page) {
        case 'main': return '/';
        case 'services': return '/dich-vu';
        case 'serviceDetail': {
            const svc = services.find(s => s.id === view.id || s.slug === view.id);
            return `/dich-vu/${svc?.slug || view.id}`;
        }
        case 'about': return '/ve-chung-toi';
        case 'blog': return '/kien-thuc';
        case 'blogCategory': return `/kien-thuc/${view.categorySlug}`;
        case 'blogDetail': {
            const post = posts.find(p => p.slug === view.slug);
            if (post) return getBlogDetailPath(post, blogCategories);
            return `/kien-thuc/${view.categorySlug || 'tong-hop'}/${view.slug}`;
        }
        case 'ingredientAnalyzer': return '/phan-tich-thanh-phan';
        case 'brands': return '/thuong-hieu';
        case 'brandLanding': return `/thuong-hieu/${view.brandSlug}`;
        case 'products': return '/san-pham';
        case 'productsCategory': return `/san-pham/${view.categorySlug}`;
        case 'productDetail': {
            const prod = products.find(p => p.id === view.id || p.slug === String(view.id));
            if (prod) return getProductDetailPath(prod, productCategories);
            return `/san-pham/${view.categorySlug || 'khac'}/${view.id}`;
        }
        case 'cart': return '/gio-hang';
        case 'checkout': return '/thanh-toan';
        case 'checkoutSuccess': return '/dat-hang-thanh-cong';
        case 'orderLookup': return '/tra-cuu-don-hang';
        case 'wishlist': return '/yeu-thich';
        case 'account': return '/tai-khoan';
        case 'administrativeProfile': return '/ho-so';
        case 'medicalRecords': return '/benh-an';
        case 'myMedicalRecords': return '/ho-so-y-te';
        case 'appointments': return '/lich-hen';
        case 'booking': return view.serviceId ? `/dat-lich/${view.serviceId}` : '/dat-lich';
        case 'auth': return '/dang-nhap';
        case 'orderHistory': return '/don-hang';
        case 'adminDashboard': return '/admin';
        case 'adminUserManagement': return view.section === 'roles' ? '/admin/nguoi-dung/roles' : '/admin/nguoi-dung';
        case 'adminBlogManagement': return view.section ? `/admin/blog/${view.section}` : '/admin/blog';
        case 'adminServiceManagement': return '/admin/dich-vu';
        case 'adminImageLibrary': return '/admin/hinh-anh';
        case 'adminProductImageImporter': return '/admin/gan-anh-san-pham';
        case 'adminPancakeManagement': return '/admin/pancake-pos';
        case 'adminVatManagement': return '/admin/ke-toan-vat';
        case 'adminPharmacyManagement': {
            if (view.action === 'order-detail' && view.orderId) {
                return `/admin/don-hang/${view.orderId}`;
            }
            if (view.section === 'orders') {
                return '/admin/don-hang';
            }
            return view.section ? `/admin/nha-thuoc/${view.section}` : '/admin/nha-thuoc';
        }
        case 'adminSiteManagement': return view.section ? `/admin/noi-dung/${view.section}` : '/admin/noi-dung';
        default: return '/';
    }
};

export const buildViewSearch = (view: View, lang: string): string => {
    const searchParams = new URLSearchParams();

    if (lang !== 'vi') {
        searchParams.set('lang', lang);
    }

    if ((view.page === 'products' || view.page === 'productsCategory') && view.brandSlug) {
        searchParams.set('brand', view.brandSlug);
    }

    if ((view.page === 'products' || view.page === 'productsCategory') && view.searchQuery?.trim()) {
        searchParams.set('q', view.searchQuery.trim());
    }

    if (view.page === 'adminPharmacyManagement' && view.action && view.action !== 'order-detail') {
        searchParams.set('action', view.action);
    }

    if (view.page === 'adminPharmacyManagement' && view.action === 'new-order' && view.orderChannel) {
        searchParams.set('channel', view.orderChannel);
    }

    if (view.page === 'adminDashboard' && view.section && view.section !== 'overview') {
        searchParams.set('panel', view.section);
    }

    if (view.page === 'adminPharmacyManagement' && view.orderPreset && view.orderPreset !== 'all') {
        searchParams.set('preset', view.orderPreset);
    }

    if (view.page === 'adminPharmacyManagement' && view.productFilter && view.productFilter !== 'all') {
        searchParams.set('inventory', view.productFilter);
    }

    if (view.page === 'adminSiteManagement' && view.action) {
        searchParams.set('action', view.action);
    }

    const search = searchParams.toString();
    return search ? `?${search}` : '';
};

export const pathToView = (pathname: string, search = ''): View => {
    const path = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
    const segments = path.split('/').filter(Boolean);
    const searchParams = new URLSearchParams(search);
    const brandSlug = searchParams.get('brand') || undefined;

    if (segments.length === 0) return { page: 'main' };

    const first = segments[0];
    const second = segments[1];
    const third = segments[2];

    switch (first) {
        case 've-chung-toi': return { page: 'about' };
        case 'dich-vu':
            if (second) return { page: 'serviceDetail', id: second };
            return { page: 'services' };
        case 'kien-thuc':
            if (third) return { page: 'blogDetail', categorySlug: second, slug: third };
            if (second) {
                if (second === 'tong-hop') return { page: 'blog' };
                return { page: 'blogCategory', categorySlug: second };
            }
            return { page: 'blog' };
        case 'phan-tich-thanh-phan': return { page: 'ingredientAnalyzer' };
        case 'thuong-hieu':
            if (second) return { page: 'brandLanding', brandSlug: second };
            return { page: 'brands' };
        case 'san-pham':
            if (third) return { page: 'productDetail', categorySlug: second, id: third };
            if (second) {
                if (second === 'khac') return { page: 'products', brandSlug };
                return { page: 'productsCategory', categorySlug: second, brandSlug };
            }
            return { page: 'products', brandSlug };
        case 'gio-hang': return { page: 'cart' };
        case 'thanh-toan': return { page: 'checkout' };
        case 'dat-hang-thanh-cong': return { page: 'checkoutSuccess' };
        case 'tra-cuu-don-hang': return { page: 'orderLookup' };
        case 'yeu-thich': return { page: 'wishlist' };
        case 'tai-khoan': return { page: 'account' };
        case 'ho-so': return { page: 'administrativeProfile' };
        case 'benh-an': return { page: 'medicalRecords' };
        case 'ho-so-y-te': return { page: 'myMedicalRecords' };
        case 'lich-hen': return { page: 'appointments' };
        case 'dat-lich':
            if (second) {
                const sid = parseInt(second, 10);
                if (!isNaN(sid)) return { page: 'booking', serviceId: sid };
            }
            return { page: 'booking' };
        case 'dang-nhap': return { page: 'auth' };
        case 'don-hang': return { page: 'orderHistory' };
        case 'admin':
            if (!second) {
                const panel = searchParams.get('panel');
                return {
                    page: 'adminDashboard',
                    section: panel === 'overview' || panel === 'customers' || panel === 'appointments' || panel === 'reports'
                        ? panel
                        : undefined,
                };
            }
            switch (second) {
                case 'nguoi-dung': {
                    const section = third || searchParams.get('section');
                    return {
                        page: 'adminUserManagement',
                        section: section === 'roles' ? 'roles' : 'doctors',
                    };
                }
                case 'blog': {
                    const section = third || searchParams.get('section');
                    return {
                        page: 'adminBlogManagement',
                        section: section === 'posts' || section === 'seo_queue' || section === 'image_queue' || section === 'categories'
                            ? section
                            : undefined,
                    };
                }
                case 'dich-vu': return { page: 'adminServiceManagement' };
                case 'hinh-anh': return { page: 'adminImageLibrary' };
                case 'gan-anh-san-pham': return { page: 'adminProductImageImporter' };
                case 'pancake-pos': return { page: 'adminPancakeManagement' };
                case 'ke-toan-vat': return { page: 'adminVatManagement' };
                case 'nha-thuoc': {
                    const action = searchParams.get('action');
                    const section = third || searchParams.get('section');
                    const preset = searchParams.get('preset');
                    const inventory = searchParams.get('inventory');
                    return {
                        page: 'adminPharmacyManagement',
                        section: section === 'products' || section === 'categories' || section === 'brands' || section === 'discounts' || section === 'taxes' || section === 'orders' || section === 'ghtk_settings'
                            ? section
                            : undefined,
                        action: action === 'new-product' ? 'new-product' : action === 'new-order' ? 'new-order' : undefined,
                        orderChannel: searchParams.get('channel') === 'pos' ? 'pos' : searchParams.get('channel') === 'online' ? 'online' : undefined,
                        orderPreset: preset === 'priority_queue' || preset === 'shipping_handover' || preset === 'bank_transfer_followup' || preset === 'refund_attention' || preset === 'today_watch' || preset === 'all'
                            ? preset
                            : undefined,
                        productFilter: inventory === 'all' || inventory === 'in_stock' || inventory === 'low_stock' || inventory === 'out_of_stock' || inventory === 'hidden' || inventory === 'featured' || inventory === 'near_expiry' || inventory === 'no_sku'
                            ? inventory
                            : undefined,
                    };
                }
                case 'noi-dung': {
                    const action = searchParams.get('action');
                    const section = third || searchParams.get('section');
                    return {
                        page: 'adminSiteManagement',
                        section: section === 'branding' || section === 'footer' || section === 'auth' || section === 'payment' || section === 'homepage' || section === 'about' || section === 'faq' || section === 'observability'
                            ? section
                            : (action === 'observability' ? 'observability' : undefined),
                        action: action === 'observability' ? 'observability' : undefined,
                    };
                }
                case 'don-hang': {
                    if (third) {
                        return { page: 'adminPharmacyManagement', section: 'orders', action: 'order-detail', orderId: third };
                    }
                    const preset = searchParams.get('preset');
                    const action = searchParams.get('action');
                    const channel = searchParams.get('channel');
                    return {
                        page: 'adminPharmacyManagement',
                        section: 'orders',
                        action: action === 'new-order' ? 'new-order' : undefined,
                        orderChannel: channel === 'pos' ? 'pos' : channel === 'online' ? 'online' : undefined,
                        orderPreset: preset === 'priority_queue' || preset === 'shipping_handover' || preset === 'bank_transfer_followup' || preset === 'refund_attention' || preset === 'today_watch' || preset === 'all'
                            ? preset
                            : undefined,
                    };
                }
                default: return { page: 'adminDashboard' };
            }
        default: return { page: 'main' };
    }
};

export const getInitialView = (): View => {
    const urlView = pathToView(window.location.pathname, window.location.search);
    if (urlView.page !== 'main' || window.location.pathname === '/') {
        return urlView;
    }
    try {
        const savedView = sessionStorage.getItem('iskin-clinic-current-view');
        if (savedView) return JSON.parse(savedView);
    } catch (error) {
        console.error('Could not parse saved view from sessionStorage', error);
    }
    return { page: 'main' };
};

export const shouldDeferInitialBootstrap = () => {
    if (typeof window === 'undefined') return false;
    // Only the homepage may progressively hydrate secondary, real content.
    // Data-heavy routes must wait for one complete backend snapshot so filters,
    // cards and detail content never render from different catalog versions.
    return pathToView(window.location.pathname).page === 'main';
};

export const isPrivateOrAdminPage = (page: View['page']) => {
    return [
        'cart',
        'checkout',
        'checkoutSuccess',
        'orderLookup',
        'wishlist',
        'account',
        'administrativeProfile',
        'medicalRecords',
        'myMedicalRecords',
        'appointments',
        'booking',
        'auth',
        'orderHistory',
        'adminDashboard',
        'adminUserManagement',
        'adminBlogManagement',
        'adminServiceManagement',
        'adminImageLibrary',
        'adminProductImageImporter',
        'adminPancakeManagement',
        'adminPharmacyManagement',
        'adminSiteManagement',
    ].includes(page);
};
