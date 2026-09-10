import React from 'react';
import type { AdminNavigationView, View, UserRole } from '../../types';

export type AdminModuleId =
  | 'overview'
  | 'orders'
  | 'products'
  | 'pancake'
  | 'vat'
  | 'knowledge'
  | 'services'
  | 'media'
  | 'users'
  | 'site';

export interface AdminNavSubItem {
  key: string;
  label: string;
  view: AdminNavigationView;
}

export interface AdminNavModule {
  id: AdminModuleId;
  label: string;
  mobileLabel?: string;
  description: string;
  iconUrl?: string;
  icon?: React.ReactNode;
  defaultView: AdminNavigationView;
  allowedRoles: UserRole[];
  subItems: AdminNavSubItem[];
  isActive: (view: AdminNavigationView | View) => boolean;
  getPageTitle: (view: AdminNavigationView | View) => string;
}

export const ADMIN_NAV_REGISTRY: AdminNavModule[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    mobileLabel: 'Tổng quan',
    description: 'Chỉ số KPI, khách hàng, lịch hẹn và báo cáo.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/dashboard.webp',
    defaultView: { page: 'adminDashboard', section: 'overview' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'overview', label: 'Tổng quan', view: { page: 'adminDashboard', section: 'overview' } },
      { key: 'customers', label: 'Khách hàng', view: { page: 'adminDashboard', section: 'customers' } },
      { key: 'appointments', label: 'Lịch hẹn', view: { page: 'adminDashboard', section: 'appointments' } },
      { key: 'reports', label: 'Báo cáo', view: { page: 'adminDashboard', section: 'reports' } },
    ],
    isActive: (view) => view.page === 'adminDashboard',
    getPageTitle: (view) => {
      if (view.page === 'adminDashboard') {
        const sec = view.section;
        if (sec === 'customers') return 'Khách hàng';
        if (sec === 'appointments') return 'Lịch hẹn';
        if (sec === 'reports') return 'Báo cáo';
        return 'Tổng quan';
      }
      return 'Tổng quan';
    },
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    mobileLabel: 'Đơn hàng',
    description: 'Danh sách và xử lý đơn hàng Online/POS.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/don-hang.webp',
    defaultView: { page: 'adminPharmacyManagement', section: 'orders' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'orders', label: 'Danh sách đơn', view: { page: 'adminPharmacyManagement', section: 'orders' } },
      {
        key: 'new-online',
        label: 'Tạo đơn Online',
        view: { page: 'adminPharmacyManagement', section: 'orders', action: 'new-order', orderChannel: 'online' },
      },
      {
        key: 'new-pos',
        label: 'Tạo đơn POS',
        view: { page: 'adminPharmacyManagement', section: 'orders', action: 'new-order', orderChannel: 'pos' },
      },
    ],
    isActive: (view) =>
      view.page === 'adminPharmacyManagement' && view.section === 'orders',
    getPageTitle: (view) => {
      if (view.page === 'adminPharmacyManagement' && view.section === 'orders') {
        if (view.action === 'order-detail') {
          return `Chi tiết Đơn hàng #${view.orderId || ''}`.trim();
        }
        if (view.action === 'new-order') {
          return view.orderChannel === 'pos' ? 'Tạo đơn hàng POS' : 'Tạo đơn hàng Online';
        }
        return 'Quản lý Đơn hàng';
      }
      return 'Đơn hàng';
    },
  },
  {
    id: 'products',
    label: 'Sản phẩm',
    mobileLabel: 'Sản phẩm',
    description: 'Catalog sản phẩm, chuyên mục, thương hiệu, thuế và tồn kho.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-20.webp',
    defaultView: { page: 'adminPharmacyManagement', section: 'products' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'products', label: 'Sản phẩm', view: { page: 'adminPharmacyManagement', section: 'products' } },
      { key: 'categories', label: 'Chuyên mục', view: { page: 'adminPharmacyManagement', section: 'categories' } },
      { key: 'brands', label: 'Thương hiệu', view: { page: 'adminPharmacyManagement', section: 'brands' } },
      { key: 'discounts', label: 'Mã giảm giá', view: { page: 'adminPharmacyManagement', section: 'discounts' } },
      { key: 'taxes', label: 'Thuế bán hàng', view: { page: 'adminPharmacyManagement', section: 'taxes' } },
      { key: 'ghtk_settings', label: 'Giao hàng', view: { page: 'adminPharmacyManagement', section: 'ghtk_settings' } },
      { key: 'image_importer', label: 'Gắn ảnh hàng loạt', view: { page: 'adminProductImageImporter' } },
    ],
    isActive: (view) =>
      (view.page === 'adminPharmacyManagement' && view.section !== 'orders') ||
      view.page === 'adminProductImageImporter',
    getPageTitle: (view) => {
      if (view.page === 'adminProductImageImporter') return 'Gắn ảnh sản phẩm hàng loạt';
      if (view.page === 'adminPharmacyManagement') {
        const sec = view.section;
        if (sec === 'categories') return 'Chuyên mục Sản phẩm';
        if (sec === 'brands') return 'Thương hiệu Sản phẩm';
        if (sec === 'discounts') return 'Mã giảm giá & Khuyến mãi';
        if (sec === 'taxes') return 'Cấu hình Thuế bán hàng';
        if (sec === 'ghtk_settings') return 'Cấu hình Giao hàng';
        return 'Danh mục Sản phẩm';
      }
      return 'Sản phẩm';
    },
  },
  {
    id: 'pancake',
    label: 'Pancake POS',
    mobileLabel: 'Pancake',
    description: 'Kết nối và luồng đồng bộ D1 sang Pancake POS.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp',
    defaultView: { page: 'adminPancakeManagement' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'connection', label: 'Kết nối', view: { page: 'adminPancakeManagement', section: 'connection' } },
      { key: 'sync_streams', label: 'Luồng đồng bộ', view: { page: 'adminPancakeManagement', section: 'sync_streams' } },
      { key: 'queue_webhook', label: 'Hàng đợi & Webhook', view: { page: 'adminPancakeManagement', section: 'queue_webhook' } },
      { key: 'manual_sync', label: 'Đồng bộ thủ công', view: { page: 'adminPancakeManagement', section: 'manual_sync' } },
      { key: 'deplao', label: 'Deplao Zalo', view: { page: 'adminPancakeManagement', section: 'deplao' } },
    ],
    isActive: (view) => view.page === 'adminPancakeManagement',
    getPageTitle: () => 'Đồng bộ Pancake POS',
  },
  {
    id: 'vat',
    label: 'Kế toán VAT',
    mobileLabel: 'VAT',
    description: 'Hóa đơn bán ra, mua vào, kỳ kê khai và đối soát thuế.',
    defaultView: { page: 'adminVatManagement' },
    allowedRoles: ['master_admin', 'accountant'],
    subItems: [
      { key: 'overview', label: 'Tổng quan', view: { page: 'adminVatManagement', section: 'overview' } },
      { key: 'sales', label: 'Hóa đơn Bán ra', view: { page: 'adminVatManagement', section: 'sales' } },
      { key: 'purchases', label: 'Hóa đơn Mua vào', view: { page: 'adminVatManagement', section: 'purchases' } },
      { key: 'periods', label: 'Kỳ kê khai', view: { page: 'adminVatManagement', section: 'periods' } },
      { key: 'adjustments', label: 'Điều chỉnh', view: { page: 'adminVatManagement', section: 'adjustments' } },
      { key: 'rules', label: 'Quy tắc VAT', view: { page: 'adminVatManagement', section: 'rules' } },
      { key: 'entity', label: 'Pháp nhân', view: { page: 'adminVatManagement', section: 'entity' } },
      { key: 'migration', label: 'Đối soát D1', view: { page: 'adminVatManagement', section: 'migration' } },
    ],
    isActive: (view) => view.page === 'adminVatManagement',
    getPageTitle: () => 'Sổ sách Kế toán VAT',
  },
  {
    id: 'knowledge',
    label: 'Kiến thức',
    mobileLabel: 'Kiến thức',
    description: 'Bài viết cẩm nang, SEO và chuyên mục bài viết.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/kien-thuc.webp',
    defaultView: { page: 'adminBlogManagement' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'posts', label: 'Bài viết', view: { page: 'adminBlogManagement', section: 'posts' } },
      { key: 'seo_queue', label: 'Hàng đợi SEO', view: { page: 'adminBlogManagement', section: 'seo_queue' } },
      { key: 'image_queue', label: 'Thiếu ảnh bìa', view: { page: 'adminBlogManagement', section: 'image_queue' } },
      { key: 'categories', label: 'Chuyên mục', view: { page: 'adminBlogManagement', section: 'categories' } },
    ],
    isActive: (view) => view.page === 'adminBlogManagement',
    getPageTitle: () => 'Quản lý Bài viết & SEO',
  },
  {
    id: 'services',
    label: 'Dịch vụ',
    mobileLabel: 'Dịch vụ',
    description: 'Danh mục dịch vụ điều trị và chăm sóc da clinic.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/dich-vu.webp',
    defaultView: { page: 'adminServiceManagement' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'services', label: 'Danh sách dịch vụ', view: { page: 'adminServiceManagement' } },
    ],
    isActive: (view) => view.page === 'adminServiceManagement',
    getPageTitle: () => 'Quản lý Dịch vụ Phòng khám',
  },
  {
    id: 'media',
    label: 'Hình ảnh',
    mobileLabel: 'Ảnh',
    description: 'Thư viện hình ảnh Cloudflare R2 cho website.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp',
    defaultView: { page: 'adminImageLibrary' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'library', label: 'Thư viện ảnh', view: { page: 'adminImageLibrary' } },
    ],
    isActive: (view) => view.page === 'adminImageLibrary',
    getPageTitle: () => 'Thư viện Hình ảnh R2',
  },
  {
    id: 'users',
    label: 'Người dùng',
    mobileLabel: 'Người dùng',
    description: 'Tài khoản người dùng, bác sĩ và phân quyền vai trò.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/nguoi-dung.webp',
    defaultView: { page: 'adminUserManagement' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'doctors', label: 'Bác sĩ', view: { page: 'adminUserManagement', section: 'doctors' } },
      { key: 'roles', label: 'Tài khoản & phân quyền', view: { page: 'adminUserManagement', section: 'roles' } },
    ],
    isActive: (view) => view.page === 'adminUserManagement',
    getPageTitle: () => 'Quản trị Người dùng & Phân quyền',
  },
  {
    id: 'site',
    label: 'Nội dung site',
    mobileLabel: 'Nội dung',
    description: 'Thương hiệu, chân trang, trang chủ, thanh toán và giám sát hệ thống.',
    iconUrl: 'https://thegioitrimun.vn/r2/assets/admin-icons/noi-dung-site.webp',
    defaultView: { page: 'adminSiteManagement' },
    allowedRoles: ['master_admin', 'admin'],
    subItems: [
      { key: 'branding', label: 'Thương hiệu', view: { page: 'adminSiteManagement', section: 'branding' } },
      { key: 'footer', label: 'Chân trang', view: { page: 'adminSiteManagement', section: 'footer' } },
      { key: 'auth', label: 'Đăng nhập', view: { page: 'adminSiteManagement', section: 'auth' } },
      { key: 'payment', label: 'Thanh toán', view: { page: 'adminSiteManagement', section: 'payment' } },
      { key: 'homepage', label: 'Trang chủ', view: { page: 'adminSiteManagement', section: 'homepage' } },
      { key: 'about', label: 'Giới thiệu', view: { page: 'adminSiteManagement', section: 'about' } },
      { key: 'faq', label: 'FAQ', view: { page: 'adminSiteManagement', section: 'faq' } },
      { key: 'observability', label: 'Theo dõi hệ thống', view: { page: 'adminSiteManagement', section: 'observability' } },
    ],
    isActive: (view) => view.page === 'adminSiteManagement',
    getPageTitle: () => 'Nội dung Website & Cài đặt',
  },
];

export function resolveActiveAdminModule(
  view: AdminNavigationView | View,
  role?: UserRole
): AdminNavModule {
  const allowed = role
    ? ADMIN_NAV_REGISTRY.filter((m) => m.allowedRoles.includes(role))
    : ADMIN_NAV_REGISTRY;

  const found = allowed.find((m) => m.isActive(view));
  return found || allowed[0] || ADMIN_NAV_REGISTRY[0];
}

export function resolveAdminPageTitle(
  view: AdminNavigationView | View,
  overrideTitle?: string
): string {
  const mod = resolveActiveAdminModule(view);
  if (mod.id === 'orders' && (!('action' in view) || !view.action)) return 'Đơn hàng';
  if ('action' in view && view.action) return mod.getPageTitle(view);
  const sub = mod.subItems.find(item => isAdminSubItemActive(view, item.view));
  return sub?.label || mod.label;
}

export function isAdminSubItemActive(view: View, target: AdminNavigationView): boolean {
  if (view.page !== target.page) return false;
  const module = ADMIN_NAV_REGISTRY.find(item => item.isActive(view));
  const section = 'section' in view ? view.section : undefined;
  const targetSection = 'section' in target ? target.section : undefined;
  const defaultSection = module && 'section' in module.defaultView ? module.defaultView.section : undefined;
  if ((section || defaultSection || module?.subItems[0]?.key) !== (targetSection || defaultSection || module?.subItems[0]?.key)) return false;
  const action = 'action' in view ? view.action : undefined;
  const targetAction = 'action' in target ? target.action : undefined;
  if (targetAction === 'new-order') return action === targetAction && 'orderChannel' in view && 'orderChannel' in target && (view.orderChannel || 'online') === target.orderChannel;
  return !targetAction && action !== 'new-order';
}
