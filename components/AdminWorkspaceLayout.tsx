import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminLayoutConfig, useAdminLayoutDispatch } from './AdminLayoutContext';
import type { AdminNavigationView } from '../types';
import AnimatedSection from './AnimatedSection';
import {
  MenuIcon,
  CloseIcon,
  ArrowRightIcon,
  BlogIcon,
  CameraIcon,
  CogIcon,
  DocumentDuplicateIcon,
  ServiceListIcon,
  ShoppingBagIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from './icons';
import BackIconButton from './BackIconButton';
import { preloadAdminPage } from '../src/adminPageLoaders';

type AdminWorkspacePage = AdminNavigationView['page'];

type AdminWorkspaceLayoutProps = {
  currentPage: AdminWorkspacePage;
  onBack: () => void;
  onNavigate: (page: AdminNavigationView) => void;
  children: React.ReactNode;
};

type AdminWorkspaceTabItem<T extends string> = {
  key: T;
  label: string;
};

const moduleConfig: Array<{
  page: AdminWorkspacePage;
  label: string;
  mobileLabel?: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    page: 'adminDashboard',
    label: 'Dashboard',
    mobileLabel: 'Dashboard',
    description: 'Tổng quan KPI và vận hành.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/dashboard.webp" alt="Dashboard" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminPharmacyManagement',
    label: 'Sản phẩm',
    mobileLabel: 'Sản phẩm',
    description: 'Catalog và kho sản phẩm.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/don-hang.webp" alt="Đơn hàng" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminPancakeManagement',
    label: 'Pancake POS',
    mobileLabel: 'Pancake',
    description: 'Điều khiển đồng bộ D1 sang Pancake.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Pancake POS" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminBlogManagement',
    label: 'Kiến thức',
    mobileLabel: 'Kiến thức',
    description: 'Bài viết và chuyên mục SEO.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/kien-thuc.webp" alt="Kiến thức" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminServiceManagement',
    label: 'Dịch vụ',
    mobileLabel: 'Dịch vụ',
    description: 'Quản lý dịch vụ clinic.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/dich-vu.webp" alt="Dịch vụ" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminImageLibrary',
    label: 'Hình ảnh',
    mobileLabel: 'Ảnh',
    description: 'Thư viện R2 cho icon và ảnh sản phẩm.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="Hình ảnh" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminUserManagement',
    label: 'Người dùng',
    mobileLabel: 'Người dùng',
    description: 'Tài khoản và phân quyền.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/nguoi-dung.webp" alt="Người dùng" className="h-7 w-7 object-contain" />,
  },
  {
    page: 'adminSiteManagement',
    label: 'Nội dung site',
    mobileLabel: 'Nội dung',
    description: 'Giao diện và thông tin.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/noi-dung-site.webp" alt="Nội dung site" className="h-7 w-7 object-contain" />,
  },
];

export const AdminWorkspaceTabs = <T extends string>({
  items,
  activeKey,
  onChange,
  className = '',
}: {
  items: Array<AdminWorkspaceTabItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
}) => {
  return (
    <div className={`rounded-[1.15rem] border border-border bg-card/95 p-1.5 shadow-sm ${className}`.trim()}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:flex xl:min-w-max xl:flex-wrap">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`w-full rounded-2xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all md:px-4 xl:w-auto xl:rounded-full xl:text-center ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-background hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AdminWorkspaceLayout: React.FC<AdminWorkspaceLayoutProps> = ({
  currentPage,
  onBack,
  onNavigate,
  children,
}) => {
  const config = useAdminLayoutConfig();
  const setSidebarConfig = useAdminLayoutDispatch();
  const {
    title = '',
    description = '',
    icon = null,
    eyebrow = 'Admin workspace',
    actions = null,
    insights = [],
    taskItems = [],
    activeTaskKey = '',
    hideHeader = false,
    unwrappedContent = false,
  } = config;
  const [isTemporarilyCollapsed, setIsTemporarilyCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  React.useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  const activeModule = moduleConfig.find((item) => item.page === currentPage) || moduleConfig[0];
  const renderModuleButton = (item: (typeof moduleConfig)[number], compact = false, isMobileDrawer = false) => {
    const isActive = item.page === currentPage;
    const compactLabel = item.mobileLabel || item.label;

    return (
      <div key={item.page} className="flex flex-col">
        <button
          type="button"
          onPointerEnter={() => void preloadAdminPage(item.page)}
          onPointerDown={() => void preloadAdminPage(item.page)}
          onFocus={() => void preloadAdminPage(item.page)}
          onClick={() => {
            if (!isActive) setSidebarConfig({});
            onNavigate({ page: item.page });
          }}
          title={item.label}
          aria-label={item.label}
          className={`group flex items-center gap-3 rounded-2xl text-left transition-all w-full ${
            compact
              ? 'min-h-[78px] flex-col items-start justify-center px-3 py-3'
              : 'px-3 py-3'
          } ${
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-transparent text-foreground'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center transition-transform group-hover:scale-110">
            {item.icon}
          </span>
          <span className={compact ? 'min-w-0 w-full' : `min-w-0 flex-1 whitespace-nowrap transition-opacity duration-300 ${isMobileDrawer ? 'opacity-100' : `opacity-0 ${!isTemporarilyCollapsed ? 'group-hover/sidebar:opacity-100' : ''}`}`}>
            <span className={`block truncate font-bold ${compact ? 'text-xs leading-5' : 'text-sm'}`}>{compact ? compactLabel : item.label}</span>
            {!compact ? (
              <span className={`mt-0.5 block truncate text-xs leading-5 ${
                isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
              }`}>
                {item.description}
              </span>
            ) : null}
          </span>

        </button>

        {isActive && !compact && !isMobileDrawer && taskItems && taskItems.length > 0 && (
          <div className={`grid transition-all duration-300 ${!isTemporarilyCollapsed ? 'grid-rows-[0fr] opacity-0 mt-0 group-hover/sidebar:grid-rows-[1fr] group-hover/sidebar:opacity-100 group-hover/sidebar:mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
            <div className="overflow-hidden">
              <div className="ml-4 flex flex-col space-y-1 border-l-2 border-border/50 pl-3 whitespace-nowrap">
                {taskItems.map((task) => {
                  const isTaskActive = task.key === activeTaskKey;
                  return (
                    <button
                      key={task.key}
                      type="button"
                      onClick={() => {
                        if (task.onClick) {
                          task.onClick();
                        } else if (task.view) {
                          onNavigate(task.view);
                        }
                      }}
                      className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all ${
                        isTaskActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={task.hint || task.label}
                    >
                      {task.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen animate-scale-in bg-[linear-gradient(135deg,#ffecee_0%,#fff3e6_20%,#fffbea_40%,#ecfdf5_60%,#eff6ff_80%,#f5f3ff_100%)] dark:bg-[linear-gradient(135deg,#2e1010_0%,#2e1f10_20%,#2e2910_40%,#102e1f_60%,#101f2e_80%,#1f102e_100%)] text-foreground transition-colors duration-300">
      <div className="mx-auto max-w-[1680px] px-3 pb-10 pt-3 sm:px-4 md:px-6 lg:py-6 xl:px-8">
        {/* COMPACT MOBILE HEADER */}
        <div className="sticky top-0 z-30 -mx-3 mb-4 border-b border-white/40 dark:border-white/10 bg-white/95 dark:bg-black/90 px-3 py-2.5 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.05)] md:-mx-6 md:px-6 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-2 shadow-sm transition-transform hover:scale-105"
            >
              <img src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp" alt="The Gioi Tri Mun" className="h-6 w-auto object-contain" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-black text-foreground">{activeModule.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MOBILE DRAWER */}
        {typeof document !== 'undefined' && createPortal(
          <div
            className={`fixed inset-0 z-[100] transition-opacity duration-300 lg:hidden ${
              isMobileDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 ${
                isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div
              className={`absolute bottom-0 right-0 top-0 w-[280px] max-w-[80vw] overflow-y-auto bg-card p-4 shadow-2xl transition-transform duration-300 ease-in-out ${
                isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/admin.webp" alt="Admin" className="h-7 w-7 object-contain" />
                  </div>
                  <h2 className="text-lg font-black text-foreground">Menu</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-foreground hover:bg-muted"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {moduleConfig.map((item) => (
                  <div key={item.page} onClick={() => setIsMobileDrawerOpen(false)}>
                    {renderModuleButton(item, false, true)}
                  </div>
                ))}
              </nav>
            </div>
          </div>,
          document.body
        )}

        <div className="grid gap-5 lg:grid-cols-[76px_minmax(0,1fr)] xl:gap-7 2xl:grid-cols-[76px_minmax(0,1fr)]">
          <AnimatedSection className="hidden lg:block lg:sticky lg:top-6 lg:self-start group/sidebar z-40">
            <aside 
              onMouseLeave={() => setIsTemporarilyCollapsed(false)}
              className={`w-[76px] overflow-hidden bg-white/95 dark:bg-black/90 transition-[width] duration-300 ease-in-out rounded-[1.5rem] backdrop-blur-2xl p-2 shadow-lg ${!isTemporarilyCollapsed ? 'group-hover/sidebar:w-[248px] xl:group-hover/sidebar:w-[268px]' : ''}`}
            >
              <div className="mb-3 flex items-center gap-3 rounded-[1.15rem] p-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <img src="https://thegioitrimun.vn/r2/assets/admin-icons/admin.webp" alt="Admin" className="h-8 w-8 object-contain" />
                </div>
                <div className={`min-w-0 flex-1 whitespace-nowrap opacity-0 transition-opacity duration-300 ${!isTemporarilyCollapsed ? 'group-hover/sidebar:opacity-100' : ''}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Admin</p>
                  <h2 className="mt-1 truncate text-lg font-black text-foreground">Điều hướng</h2>
                </div>
              </div>

              <nav className="space-y-1">
                {moduleConfig.map((item) => renderModuleButton(item))}
              </nav>

            </aside>
          </AnimatedSection>

          <div className={unwrappedContent ? "min-w-0" : "min-w-0 rounded-[1.7rem]"}>
            {!hideHeader ? (
              <AnimatedSection className="mb-4 lg:mb-0">

                {taskItems && taskItems.length > 0 ? (
                  <div className="lg:hidden rounded-2xl border border-border/80 bg-background/85 p-1.5">
                    <div className="flex snap-x overflow-x-auto hide-scrollbar gap-1.5 pb-0.5 xl:flex-wrap xl:overflow-visible">
                      {taskItems.map((item) => {
                        const isActive = item.key === activeTaskKey;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              if (item.onClick) {
                                item.onClick();
                              } else if (item.view) {
                                onNavigate(item.view);
                              }
                            }}
                            className={`shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-semibold transition-all xl:w-auto ${
                              isActive
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border/50 bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                            title={item.hint || item.label}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </AnimatedSection>
            ) : null}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkspaceLayout;
