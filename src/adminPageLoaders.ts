import type { AdminNavigationView } from '../types';
import type { ComponentType } from 'react';
import AdminPancakeManagementPage from '../components/AdminPancakeManagementPage';

type AdminWorkspacePage = AdminNavigationView['page'];
type AdminPageModule = { default: ComponentType<any> };
type AdminPageLoader = () => Promise<AdminPageModule>;

const once = (loader: AdminPageLoader): AdminPageLoader => {
  if (import.meta.env.DEV) {
    return loader;
  }
  let request: Promise<AdminPageModule> | null = null;
  return () => {
    if (!request) {
      request = loader().catch((error) => {
        // Let a later navigation retry after a transient chunk/network failure.
        request = null;
        throw error;
      });
    }
    return request;
  };
};

export const loadAdminDashboardPage = once(() => import('../components/AdminDashboardPage'));
export const loadAdminUserManagementPage = once(() => import('../components/AdminUserManagementPage'));
export const loadAdminBlogManagementPage = once(() => import('../components/AdminBlogManagementPage'));
export const loadAdminSiteManagementPage = once(() => import('../components/AdminSiteManagementPage'));
export const loadAdminServiceManagementPage = once(() => import('../components/AdminServiceManagementPage'));
export const loadAdminImageLibraryPage = once(() => import('../components/AdminImageLibraryPage'));
export const loadAdminProductImageImporterPage = once(() => import('../components/AdminProductImageImporterPage'));
export const loadAdminPharmacyManagementPage = once(() => import('../components/AdminPharmacyManagementPage'));
export const loadAdminVatManagementPage = once(() => import('../components/AdminVatManagementPage'));
export const loadAdminPancakeManagementPage: AdminPageLoader = () => Promise.resolve({
  default: AdminPancakeManagementPage,
});

const adminPageLoaders: Record<AdminWorkspacePage, AdminPageLoader> = {
  adminDashboard: loadAdminDashboardPage,
  adminUserManagement: loadAdminUserManagementPage,
  adminBlogManagement: loadAdminBlogManagementPage,
  adminSiteManagement: loadAdminSiteManagementPage,
  adminServiceManagement: loadAdminServiceManagementPage,
  adminImageLibrary: loadAdminImageLibraryPage,
  adminProductImageImporter: loadAdminProductImageImporterPage,
  adminPharmacyManagement: loadAdminPharmacyManagementPage,
  adminPancakeManagement: loadAdminPancakeManagementPage,
  adminVatManagement: loadAdminVatManagementPage,
};

export const preloadAdminPage = (page: AdminWorkspacePage) => adminPageLoaders[page]();

export const preloadAdminWorkspace = () => {
  Object.values(adminPageLoaders).forEach((loader) => {
    void loader().catch(() => undefined);
  });
};
