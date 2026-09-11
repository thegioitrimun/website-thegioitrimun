import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminLayoutConfig, useAdminLayoutDispatch } from './AdminLayoutContext';
import AnimatedSection from './AnimatedSection';
import {
  MenuIcon,
  CloseIcon,
  ArrowRightIcon,
  BlogIcon,
  CameraIcon,
  CogIcon,
  ServiceListIcon,
  ShoppingBagIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  HomeIcon,
  LogoutIcon,
} from './icons';
import BackIconButton from './BackIconButton';
import { preloadAdminPage } from '../src/adminPageLoaders';
import type { AdminNavigationView, UserData } from '../types';

type AdminWorkspacePage = AdminNavigationView['page'];

type AdminWorkspaceLayoutProps = {
  currentPage: AdminWorkspacePage;
  currentRole: 'customer' | 'doctor' | 'accountant' | 'admin' | 'master_admin';
  onBack: () => void;
  onNavigate: (page: AdminNavigationView) => void;
  children: React.ReactNode;
  currentUser?: UserData;
  onLogout?: () => void;
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
    page: 'adminVatManagement',
    label: 'Kế toán VAT',
    mobileLabel: 'VAT',
    description: 'Bảng kê, kỳ thuế và hồ sơ nộp.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1789005613591-Untitled-design-13.webp" alt="Kế toán VAT" className="h-7 w-7 object-contain" />,
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
  currentRole,
  onBack,
  onNavigate,
  children,
  currentUser,
  onLogout,
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

  const visibleModules = moduleConfig.filter((item) => {
    if (currentRole === 'master_admin') return true;
    if (!['admin', 'accountant'].includes(currentRole)) return false;
    if (currentRole === 'accountant') return item.page === 'adminVatManagement';
    return item.page !== 'adminVatManagement';
  });
  const activeModule = visibleModules.find((item) => item.page === currentPage) || visibleModules[0] || moduleConfig[0];
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
    <div className="min-h-screen animate-scale-in bg-slate-50/80 dark:bg-[#0b0f17] text-foreground transition-colors duration-300">
      <div className="mx-auto max-w-[1680px] px-3 sm:px-4 md:px-6 lg:py-6 xl:px-8 pt-0 sm:pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
        {/* COMPACT MOBILE HEADER */}
        <div className="sticky top-0 z-30 -mx-3 mb-4 border-b border-white/40 dark:border-white/10 bg-white/95 dark:bg-[#0b0f17]/95 px-3 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2.5 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.05)] md:-mx-6 md:px-6 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-2 shadow-sm transition-transform hover:scale-105"
            >
              <img src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.svg" alt="The Gioi Tri Mun" className="h-6 w-auto object-contain dark:hidden" />
              <img src="/icons/da-lieu-nhiet-doi-phu-quoc-logo-dark.svg" alt="The Gioi Tri Mun" className="h-6 w-auto object-contain hidden dark:block" />
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
              className={`absolute bottom-0 right-0 top-0 w-[280px] max-w-[80vw] overflow-y-auto bg-card p-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] shadow-2xl transition-transform duration-300 ease-in-out ${
                isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Compact User Header replacing Menu */}
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                {currentUser ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden border border-primary/30 shadow-xs">
                      {currentUser.profile?.avatar_url ? (
                        <img src={currentUser.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (currentUser.profile?.name || currentUser.profile?.email || 'A').charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-foreground leading-tight truncate">
                        {currentUser.profile?.name || 'Quản trị viên'}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                        {currentRole}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/admin.webp" alt="Admin" className="h-7 w-7 object-contain" />
                    <span className="font-bold text-sm text-foreground">Menu</span>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-border/80 bg-background/80 px-2.5 text-xs font-semibold text-foreground hover:text-primary transition-all shadow-xs"
                    title="Mở website khách hàng ở tab mới"
                  >
                    <HomeIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden xs:inline">Website</span>
                  </a>
                  {onLogout ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        onLogout();
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Đăng xuất"
                    >
                      <LogoutIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <nav className="space-y-1">
                {visibleModules.map((item) => (
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
              className={`w-[76px] overflow-hidden bg-white/95 dark:bg-black/90 transition-[width] duration-300 ease-in-out rounded-[1.5rem] backdrop-blur-2xl p-2 shadow-lg flex flex-col justify-between min-h-[calc(100vh-3rem)] ${!isTemporarilyCollapsed ? 'group-hover/sidebar:w-[248px] xl:group-hover/sidebar:w-[268px]' : ''}`}
            >
              <div>
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
                  {visibleModules.map((item) => renderModuleButton(item))}
                </nav>
              </div>

              {/* Desktop User Footer in Sidebar */}
              {currentUser ? (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <div className={`flex items-center rounded-xl p-1 transition-all duration-300 ${!isTemporarilyCollapsed ? 'justify-center group-hover/sidebar:justify-start group-hover/sidebar:gap-2.5' : 'justify-center'}`}>
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden border border-primary/30 shadow-xs">
                      {currentUser.profile?.avatar_url ? (
                        <img src={currentUser.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (currentUser.profile?.name || currentUser.profile?.email || 'A').charAt(0)
                      )}
                    </div>
                    <div className={`min-w-0 flex-1 whitespace-nowrap transition-all duration-300 ${!isTemporarilyCollapsed ? 'hidden group-hover/sidebar:block' : 'hidden'}`}>
                      <p className="text-xs font-bold text-foreground truncate leading-none">
                        {currentUser.profile?.name || 'Quản trị viên'}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">
                        {currentRole}
                      </p>
                    </div>
                    {onLogout ? (
                      <button
                        type="button"
                        onClick={onLogout}
                        className={`shrink-0 p-1.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors ${!isTemporarilyCollapsed ? 'hidden group-hover/sidebar:inline-flex' : 'hidden'}`}
                        title="Đăng xuất"
                      >
                        <LogoutIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className={`mt-2 flex items-center px-1 overflow-hidden transition-all duration-300 ${!isTemporarilyCollapsed ? 'hidden group-hover/sidebar:flex' : 'hidden'}`}>
                    <a
                      href="/"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-background hover:text-primary transition-all shadow-xs"
                      title="Mở website khách hàng ở tab mới"
                    >
                      <HomeIcon className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate">Xem Website</span>
                    </a>
                  </div>
                </div>
              ) : null}

            </aside>
          </AnimatedSection>

          <div className={unwrappedContent ? "min-w-0" : "min-w-0 rounded-[1.7rem]"}>
            {!hideHeader ? (
              <AnimatedSection className="mb-4 lg:mb-0">

                {taskItems && taskItems.length > 0 ? (
                  <div className="lg:hidden bg-transparent mb-3.5">
                    <div className="flex items-center overflow-x-auto hide-scrollbar gap-1.5 px-0.5 pb-1 -mx-0.5 overscroll-x-contain">
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
                            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                              isActive
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                                : 'border-border/60 bg-card/90 text-muted-foreground hover:bg-muted hover:text-foreground'
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
