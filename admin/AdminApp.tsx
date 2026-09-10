import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { AdminLayoutProvider } from '../components/AdminLayoutContext';
import AdminWorkspaceLayout from '../components/AdminWorkspaceLayout';
import { AdminLoginPage } from './AdminLoginPage';
import ThemePicker from '../components/ThemePicker';
import * as api from '../services/api';
import { pathToView, viewToPath } from '../src/appRouting';
import {
  loadAdminDashboardPage,
  loadAdminPharmacyManagementPage,
  loadAdminSiteManagementPage,
  loadAdminUserManagementPage,
  loadAdminBlogManagementPage,
  loadAdminServiceManagementPage,
  loadAdminImageLibraryPage,
  loadAdminProductImageImporterPage,
  loadAdminPancakeManagementPage,
  loadAdminVatManagementPage,
} from '../src/adminPageLoaders';
import type {
  AdminNavigationView,
  UserData,
  Product,
  ProductCategory,
  ProductBrand,
  ProductOrder,
  ProductImage,
  Service,
  DoctorDetail,
  DoctorProfile,
  BlogPost,
  BlogCategory,
  PatientProfile,
  AboutPageData,
  AboutContent,
  SiteInfo,
  FooterContent,
  AuthPageImages,
  PaymentSettings,
  FAQItem,
  HomepageHero,
  AboutFeature,
  AboutValue,
  View,
} from '../types';
import { HomeIcon, LogoutIcon } from '../components/icons';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'unauthorized'; user: UserData }
  | { status: 'authenticated'; user: UserData };

export const AdminApp: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  // --- Auth State ---
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });

  // --- View & Navigation State ---
  const parseCurrentAdminView = useCallback((): AdminNavigationView => {
    const parsed = pathToView(window.location.pathname, window.location.search);
    if (parsed.page.startsWith('admin') && parsed.page !== 'administrativeProfile') {
      return parsed as AdminNavigationView;
    }
    return { page: 'adminDashboard' };
  }, []);

  const [view, setViewInternal] = useState<AdminNavigationView>(parseCurrentAdminView);

  const setView = useCallback((nextView: View | AdminNavigationView) => {
    const adminNavView = nextView.page.startsWith('admin')
      ? (nextView as AdminNavigationView)
      : { page: 'adminDashboard' as const };

    setViewInternal(adminNavView);
    const targetUrl = viewToPath(adminNavView as any);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setViewInternal(parseCurrentAdminView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseCurrentAdminView]);

  // --- Check Auth on mount ---
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const session = await api.getCurrentAuthSession();
        if (!session || !session.id) {
          if (isMounted) setAuthState({ status: 'unauthenticated' });
          return;
        }

        const userData = await api.getUserData(session.id);
        if (!userData || !userData.profile) {
          if (isMounted) setAuthState({ status: 'unauthenticated' });
          return;
        }

        const role = userData.profile.role;
        const isAllowed = ['admin', 'master_admin', 'accountant'].includes(role);

        if (!isAllowed) {
          if (isMounted) setAuthState({ status: 'unauthorized', user: userData });
        } else {
          if (isMounted) setAuthState({ status: 'authenticated', user: userData });
        }
      } catch (err) {
        console.error('Failed to verify admin auth:', err);
        if (isMounted) setAuthState({ status: 'unauthenticated' });
      }
    };

    void checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      setAuthState({ status: 'unauthenticated' });
      addToast('Đã đăng xuất khỏi phiên quản trị', { type: 'info' });
    } catch (err: any) {
      addToast('Lỗi khi đăng xuất', { type: 'error', description: err?.message });
    }
  };

  // --- Data State for Modules ---
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [allProductOrders, setAllProductOrders] = useState<ProductOrder[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [doctorDetails, setDoctorDetails] = useState<DoctorDetail[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
  const [allPatients, setAllPatients] = useState<PatientProfile[]>([]);
  const [aboutData, setAboutData] = useState<AboutPageData | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [footerContent, setFooterContent] = useState<FooterContent | null>(null);
  const [authPageImages, setAuthPageImages] = useState<AuthPageImages | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [homepageHero, setHomepageHero] = useState<HomepageHero | null>(null);
  const [featuredServiceIds, setFeaturedServiceIds] = useState<number[]>([]);
  const [featuredDoctorIds, setFeaturedDoctorIds] = useState<string[]>([]);
  const [featuredPostSlugs, setFeaturedPostSlugs] = useState<string[]>([]);

  const [moduleLoading, setModuleLoading] = useState<Record<string, boolean>>({});

  // Lazy components loader (must be declared at top-level before any early return)
  const [LazyComponent, setLazyComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (authState.status !== 'authenticated') return;
    let isCancelled = false;

    const loadComponent = async () => {
      let moduleLoader;
      switch (view.page) {
        case 'adminDashboard': moduleLoader = loadAdminDashboardPage; break;
        case 'adminPharmacyManagement': moduleLoader = loadAdminPharmacyManagementPage; break;
        case 'adminSiteManagement': moduleLoader = loadAdminSiteManagementPage; break;
        case 'adminUserManagement': moduleLoader = loadAdminUserManagementPage; break;
        case 'adminBlogManagement': moduleLoader = loadAdminBlogManagementPage; break;
        case 'adminServiceManagement': moduleLoader = loadAdminServiceManagementPage; break;
        case 'adminImageLibrary': moduleLoader = loadAdminImageLibraryPage; break;
        case 'adminProductImageImporter': moduleLoader = loadAdminProductImageImporterPage; break;
        case 'adminPancakeManagement': moduleLoader = loadAdminPancakeManagementPage; break;
        case 'adminVatManagement': moduleLoader = loadAdminVatManagementPage; break;
        default: moduleLoader = loadAdminDashboardPage; break;
      }

      try {
        const mod = await moduleLoader();
        if (!isCancelled) {
          setLazyComponent(() => mod.default);
        }
      } catch (err) {
        console.error('Failed to load admin module chunk:', err);
      }
    };

    void loadComponent();
    return () => {
      isCancelled = true;
    };
  }, [view.page, authState.status]);

  // --- Load Module Data On-Demand ---
  const loadModuleData = useCallback(async (page: AdminNavigationView['page']) => {
    if (moduleLoading[page]) return;

    setModuleLoading((prev) => ({ ...prev, [page]: true }));
    try {
      switch (page) {
        case 'adminDashboard': {
          const [orders, srvs, docs] = await Promise.all([
            api.getAllProductOrders({ force: false }),
            api.getAdminServices({ force: false }),
            api.getDoctorDetails({ force: false }),
          ]);
          setAllProductOrders(orders);
          setServices(srvs);
          setDoctorDetails(docs);
          break;
        }
        case 'adminPharmacyManagement': {
          const [prods, cats, brs, orders] = await Promise.all([
            api.getAllProducts({ force: false }),
            api.getAdminProductCategories({ force: false }),
            api.getAdminProductBrands({ force: false }),
            api.getAllProductOrders({ force: false }),
          ]);
          setAllProducts(prods);
          setProductCategories(cats);
          setBrands(brs);
          setAllProductOrders(orders);
          break;
        }
        case 'adminSiteManagement': {
          const [snapshot, srvs, docs, posts] = await Promise.all([
            api.getAdminSiteSnapshot({ force: false }),
            api.getAdminServices({ force: false }),
            api.getDoctorDetails({ force: false }),
            api.getAdminBlogPosts({ force: false }),
          ]);
          setAboutData(snapshot.aboutData);
          setAuthPageImages(snapshot.authPageImages);
          setFaqItems(snapshot.faqItems);
          setFeaturedDoctorIds(snapshot.featuredDoctorIds);
          setFeaturedPostSlugs(snapshot.featuredPostSlugs);
          setFeaturedServiceIds(snapshot.featuredServiceIds);
          setFooterContent(snapshot.footerContent);
          setHomepageHero(snapshot.homepageHero);
          setPaymentSettings(snapshot.paymentSettings);
          setServices(srvs);
          setDoctorDetails(docs);
          setBlogPosts(posts);
          break;
        }
        case 'adminUserManagement': {
          const [patients, docs] = await Promise.all([
            api.getAllPatients({ force: false }),
            api.getDoctorDetails({ force: false }),
          ]);
          setAllPatients(patients);
          setDoctorDetails(docs);
          break;
        }
        case 'adminBlogManagement': {
          const [posts, cats] = await Promise.all([
            api.getAdminBlogPosts({ force: false }),
            api.getAdminBlogCategories({ force: false }),
          ]);
          setBlogPosts(posts);
          setBlogCategories(cats);
          break;
        }
        case 'adminServiceManagement': {
          const srvs = await api.getAdminServices({ force: false });
          setServices(srvs);
          break;
        }
        case 'adminProductImageImporter': {
          const prods = await api.getAllProducts({ force: false });
          setAllProducts(prods);
          break;
        }
        default:
          break;
      }
    } catch (error: any) {
      console.error(`Error loading data for ${page}:`, error);
      addToast(`Không thể tải dữ liệu phân hệ ${page}`, {
        type: 'error',
        description: error?.message,
      });
    } finally {
      setModuleLoading((prev) => ({ ...prev, [page]: false }));
    }
  }, [moduleLoading, addToast]);

  useEffect(() => {
    if (authState.status === 'authenticated') {
      void loadModuleData(view.page);
    }
  }, [view.page, authState.status, loadModuleData]);

  // --- Data Mutation Handlers ---
  const handleSaveProduct = async (product: Partial<Product>, imagesToDelete: ProductImage[]): Promise<Product> => {
    try {
      const saved = await api.saveWithRetry(() => api.saveProduct(product, imagesToDelete));
      void api.clearPublicProductCatalogCache();
      setAllProducts((current) =>
        [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      );
      addToast('Lưu sản phẩm thành công', { type: 'success' });
      return saved;
    } catch (err: any) {
      addToast('Lỗi khi lưu sản phẩm', { type: 'error', description: err?.message });
      throw err;
    }
  };

  const handleBulkUpdateProducts = async (updates: Partial<Product>[]) => {
    if (!updates.length) return;
    try {
      for (const update of updates) {
        await api.saveWithRetry(() => api.saveProduct(update, []));
      }
      void api.clearPublicProductCatalogCache();
      const updated = await api.getAllProducts({ force: true });
      setAllProducts(updated);
      addToast('Cập nhật hàng loạt sản phẩm thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật hàng loạt', { type: 'error', description: err?.message });
      throw err;
    }
  };

  const handleBulkDeleteProducts = async (productIds: number[]) => {
    if (!productIds.length) return { deletedCount: 0, archivedCount: 0 };
    try {
      const results = [];
      for (const id of productIds) {
        results.push(await api.saveWithRetry(() => api.deleteProduct(id)));
      }
      void api.clearPublicProductCatalogCache();
      setAllProducts((current) => current.filter((item) => !productIds.includes(item.id)));
      const deletedCount = results.filter((r) => r.outcome === 'deleted').length;
      const archivedCount = results.filter((r) => r.outcome === 'archived').length;
      addToast(`Đã xóa ${deletedCount} và lưu trữ ${archivedCount} sản phẩm`, { type: 'success' });
      return { deletedCount, archivedCount };
    } catch (err: any) {
      addToast('Lỗi khi xóa hàng loạt', { type: 'error', description: err?.message });
      throw err;
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
    try {
      const result = await api.saveWithRetry(() => api.deleteProduct(productId));
      void api.clearPublicProductCatalogCache();
      setAllProducts((current) => current.filter((item) => item.id !== productId));
      addToast(result.outcome === 'archived' ? 'Đã lưu trữ sản phẩm' : 'Xóa sản phẩm thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa sản phẩm', { type: 'error', description: err?.message });
    }
  };

  const handleSaveProductCategory = async (category: Partial<ProductCategory>) => {
    try {
      await api.saveWithRetry(() => api.saveProductCategory(category));
      setProductCategories(await api.getAdminProductCategories({ force: true }));
      addToast('Lưu chuyên mục thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu chuyên mục', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteProductCategory = async (categoryId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chuyên mục này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteProductCategory(categoryId));
      setProductCategories((current) => current.filter((item) => item.id !== categoryId));
      addToast('Xóa chuyên mục thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa chuyên mục', { type: 'error', description: err?.message });
    }
  };

  const handleSaveBrand = async (brand: Partial<ProductBrand>, imageFile: File | null) => {
    try {
      await api.saveWithRetry(() => api.saveBrand(brand, imageFile));
      setBrands(await api.getAdminProductBrands({ force: true }));
      addToast('Lưu thương hiệu thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu thương hiệu', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteBrand = async (brandId: number, logoPath?: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thương hiệu này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteBrand(brandId, logoPath));
      setBrands((current) => current.filter((item) => item.id !== brandId));
      addToast('Xóa thương hiệu thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa thương hiệu', { type: 'error', description: err?.message });
    }
  };

  const handleSaveService = async (service: Partial<Service>, imageFile: File | null) => {
    try {
      await api.saveWithRetry(() => api.saveService(service, imageFile));
      setServices(await api.getAdminServices({ force: true }));
      addToast('Lưu dịch vụ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu dịch vụ', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteService(serviceId));
      setServices((current) => current.filter((s) => s.id !== serviceId));
      addToast('Xóa dịch vụ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa dịch vụ', { type: 'error', description: err?.message });
    }
  };

  const handleSaveDoctorProfile = async (doctorProfile: DoctorProfile) => {
    try {
      await api.saveWithRetry(() => api.upsertDoctorProfile(doctorProfile));
      setDoctorDetails(await api.getDoctorDetails({ force: true }));
      addToast('Lưu hồ sơ bác sĩ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu bác sĩ', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteDoctorProfile = async (doctorId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa hồ sơ bác sĩ này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteDoctorProfile(doctorId));
      setDoctorDetails((current) => current.filter((d) => d.id !== doctorId));
      addToast('Xóa hồ sơ bác sĩ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa bác sĩ', { type: 'error', description: err?.message });
    }
  };

  const handleUpdatePatient = async (patient: Partial<PatientProfile> & { id: string }, avatarFile: File | null) => {
    try {
      await api.saveWithRetry(() => api.updatePatient(patient, avatarFile));
      const updatedList = await api.getAllPatients({ force: true });
      setAllPatients(updatedList);
      addToast('Cập nhật hồ sơ người dùng thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật người dùng', { type: 'error', description: err?.message });
    }
  };

  const handleSavePost = async (post: BlogPost, imageFile: File | null): Promise<BlogPost | null> => {
    try {
      await api.saveWithRetry(() => api.savePost(post, imageFile));
      const posts = await api.getAdminBlogPosts({ force: true });
      setBlogPosts(posts);
      addToast('Lưu bài viết thành công', { type: 'success' });
      return posts.find((p) => p.slug === post.slug) || null;
    } catch (err: any) {
      addToast('Lỗi lưu bài viết', { type: 'error', description: err?.message });
      throw err;
    }
  };

  const handleLoadPostDetail = async (slug: string): Promise<BlogPost | null> => {
    const posts = await api.getAdminBlogPosts({ force: true });
    return posts.find((p) => p.slug === slug) || null;
  };

  const handleDeletePost = async (slug: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài viết "${slug}" không?`)) return;
    try {
      const postToDelete = blogPosts.find((p) => p.slug === slug);
      await api.saveWithRetry(() => api.deletePost(slug, postToDelete?.image_path));
      setBlogPosts(await api.getAdminBlogPosts({ force: true }));
      addToast('Xóa bài viết thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa bài viết', { type: 'error', description: err?.message });
    }
  };

  const handleSaveCategory = async (category: BlogCategory) => {
    try {
      await api.saveWithRetry(() => api.saveCategory(category));
      setBlogCategories(await api.getAdminBlogCategories({ force: true }));
      addToast('Lưu chuyên mục thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu chuyên mục', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteCategory = async (slug: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chuyên mục "${slug}" này?`)) return;
    try {
      await api.saveWithRetry(() => api.deleteCategory(slug));
      setBlogCategories((current) => current.filter((c) => c.slug !== slug));
      addToast('Xóa chuyên mục thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa chuyên mục', { type: 'error', description: err?.message });
    }
  };

  // Site Management Handlers
  const handleUpdateHomepageHero = async (
    hero: Omit<HomepageHero, 'id' | 'image_desktop_url' | 'image_tablet_url' | 'image_mobile_url'>,
    files: { desktop?: File; tablet?: File; mobile?: File }
  ) => {
    try {
      const updatedHero = await api.saveWithRetry(() => api.updateHomepageHero(hero, files));
      setHomepageHero(updatedHero);
      addToast('Cập nhật Hero thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật Hero', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateFeaturedServices = async (ids: number[]) => {
    try {
      await api.saveWithRetry(() => api.updateFeaturedServices(ids));
      setFeaturedServiceIds(ids);
      addToast('Cập nhật dịch vụ nổi bật thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật dịch vụ nổi bật', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateFeaturedDoctors = async (ids: string[]) => {
    try {
      await api.saveWithRetry(() => api.updateFeaturedDoctors(ids));
      setFeaturedDoctorIds(ids);
      addToast('Cập nhật bác sĩ nổi bật thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật bác sĩ nổi bật', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateFeaturedPosts = async (slugs: string[]) => {
    try {
      await api.saveWithRetry(() => api.updateFeaturedPosts(slugs));
      setFeaturedPostSlugs(slugs);
      addToast('Cập nhật bài viết nổi bật thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật bài viết nổi bật', { type: 'error', description: err?.message });
    }
  };

  const handleSaveFaq = async (faq: FAQItem) => {
    try {
      await api.saveWithRetry(() => api.saveFaq(faq));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setFaqItems(snap.faqItems);
      addToast('Lưu câu hỏi FAQ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu FAQ', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteFaq = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteFaq(id));
      setFaqItems((current) => current.filter((f) => f.id !== id));
      addToast('Xóa câu hỏi FAQ thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa FAQ', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateAboutContent = async (content: Partial<AboutContent>, imageFile: File | null) => {
    try {
      await api.saveWithRetry(() => api.updateAboutContent(content, imageFile));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setAboutData(snap.aboutData);
      addToast('Cập nhật trang giới thiệu thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật giới thiệu', { type: 'error', description: err?.message });
    }
  };

  const handleSaveAboutFeature = async (feature: Partial<AboutFeature>) => {
    try {
      await api.saveWithRetry(() => api.saveAboutFeature(feature));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setAboutData(snap.aboutData);
      addToast('Lưu đặc điểm nổi bật thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu đặc điểm', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteAboutFeature = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa đặc điểm này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteAboutFeature(id));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setAboutData(snap.aboutData);
      addToast('Xóa đặc điểm thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa đặc điểm', { type: 'error', description: err?.message });
    }
  };

  const handleSaveAboutValue = async (value: Partial<AboutValue>) => {
    try {
      await api.saveWithRetry(() => api.saveAboutValue(value));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setAboutData(snap.aboutData);
      addToast('Lưu giá trị cốt lõi thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi lưu giá trị', { type: 'error', description: err?.message });
    }
  };

  const handleDeleteAboutValue = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa giá trị này?')) return;
    try {
      await api.saveWithRetry(() => api.deleteAboutValue(id));
      const snap = await api.getAdminSiteSnapshot({ force: true });
      setAboutData(snap.aboutData);
      addToast('Xóa giá trị thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi xóa giá trị', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateSiteInfo = async (info: Partial<SiteInfo>, files: { light?: File; dark?: File; favicon?: File }) => {
    try {
      const updated = await api.saveWithRetry(() => api.updateSiteInfo(info, files));
      setSiteInfo(updated);
      addToast('Cập nhật thông tin phòng khám thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật thông tin', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateFooterContent = async (content: Partial<FooterContent>) => {
    try {
      const updated = await api.saveWithRetry(() => api.updateFooterContent(content));
      setFooterContent(updated);
      addToast('Cập nhật chân trang thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật chân trang', { type: 'error', description: err?.message });
    }
  };

  const handleUpdateAuthPageImages = async (file: File | null) => {
    try {
      const updated = await api.saveWithRetry(() => api.updateAuthPageImages(file));
      setAuthPageImages(updated);
      addToast('Cập nhật ảnh đăng nhập thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cập nhật ảnh đăng nhập', { type: 'error', description: err?.message });
    }
  };

  const handleUpdatePaymentSettings = async (settings: PaymentSettings) => {
    try {
      const updated = await api.saveWithRetry(() => api.updatePaymentSettings(settings));
      setPaymentSettings(updated);
      addToast('Cập nhật cài đặt thanh toán thành công', { type: 'success' });
    } catch (err: any) {
      addToast('Lỗi cài đặt thanh toán', { type: 'error', description: err?.message });
    }
  };

  // --- Render Authentication Guards ---
  if (authState.status === 'loading') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Đang khởi tạo TGTM Workspace...
        </p>
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    return <AdminLoginPage />;
  }

  if (authState.status === 'unauthorized') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-card p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-4">
            <LogoutIcon className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Truy cập bị từ chối</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tài khoản <span className="font-semibold text-foreground">{authState.user.profile.email}</span> không có quyền truy cập hệ thống quản trị.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-all hover:opacity-90"
            >
              Quay lại website
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border px-6 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = authState.user;
  const currentRole = currentUser.profile.role;

  // --- Render Active Page Content ---
  const renderActiveModule = () => {
    if (!LazyComponent) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Đang tải phân hệ...</span>
          </div>
        </div>
      );
    }

    const Comp = LazyComponent;

    switch (view.page) {
      case 'adminDashboard':
        return <Comp currentUser={currentUser} orders={allProductOrders} onNavigate={setView} />;

      case 'adminPharmacyManagement':
        return (
          <Comp
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
          />
        );

      case 'adminSiteManagement':
        if (!aboutData || !siteInfo || !footerContent || !authPageImages || !paymentSettings) {
          return (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Đang đồng bộ dữ liệu giao diện...</span>
              </div>
            </div>
          );
        }
        return (
          <Comp
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
          />
        );

      case 'adminUserManagement':
        return (
          <Comp
            allPatients={allPatients}
            doctorDetails={doctorDetails}
            initialSection={view.section}
            onUpdatePatient={handleUpdatePatient}
            onSaveDoctorProfile={handleSaveDoctorProfile}
            onDeleteDoctorProfile={handleDeleteDoctorProfile}
            onNavigate={setView}
            onBack={() => setView({ page: 'adminDashboard' })}
          />
        );

      case 'adminBlogManagement':
        return (
          <Comp
            currentUser={currentUser}
            posts={blogPosts}
            categories={blogCategories}
            initialSection={view.section}
            onSavePost={handleSavePost}
            onLoadPostDetail={handleLoadPostDetail}
            onDeletePost={handleDeletePost}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onNavigate={setView}
            onBack={() => setView({ page: 'adminDashboard' })}
          />
        );

      case 'adminServiceManagement':
        return (
          <Comp
            services={services}
            onSaveService={handleSaveService}
            onDeleteService={handleDeleteService}
            onNavigate={setView}
            onBack={() => setView({ page: 'adminDashboard' })}
          />
        );

      case 'adminImageLibrary':
        return <Comp onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;

      case 'adminProductImageImporter':
        return <Comp onNavigate={setView} onBack={() => setView({ page: 'adminDashboard' })} />;

      case 'adminPancakeManagement':
        return <Comp />;

      case 'adminVatManagement':
        return <Comp currentRole={currentRole} />;

      default:
        return null;
    }
  };

  return (
    <AdminLayoutProvider>
      <AdminWorkspaceLayout
        currentPage={(view.page === 'adminPharmacyManagement' && view.section === 'orders' ? 'adminDashboard' : view.page) as any}
        currentRole={currentRole}
        onNavigate={setView}
        onBack={() => setView({ page: 'adminDashboard' })}
      >
        {/* Custom Header Toolbar for Admin App */}
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background hover:text-primary transition-all shadow-xs"
              title="Mở website khách hàng ở tab mới"
            >
              <HomeIcon className="h-4 w-4 text-primary" />
              <span>Xem Website</span>
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemePicker />

            <div className="flex items-center gap-2 pl-2 border-l border-border/60">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden border border-primary/30">
                {currentUser.profile.avatar_url ? (
                  <img src={currentUser.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (currentUser.profile.name || currentUser.profile.email || 'A').charAt(0)
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-foreground leading-none">{currentUser.profile.name || 'Quản trị viên'}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">{currentRole}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Đăng xuất"
              >
                <LogoutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {renderActiveModule()}
      </AdminWorkspaceLayout>
    </AdminLayoutProvider>
  );
};

export default AdminApp;
