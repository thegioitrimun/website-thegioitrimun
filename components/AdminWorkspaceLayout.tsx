import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAdminLayoutConfig, useAdminLayoutDispatch } from './AdminLayoutContext';
import AnimatedSection from './AnimatedSection';
import {
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

const canElementScrollHorizontally = (target: EventTarget | null, direction: 'left' | 'right'): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    if (el.dataset.adminTabBar === 'true') {
      return false;
    }
    const tagName = el.tagName.toLowerCase();
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      el.getAttribute('role') === 'slider' ||
      el.dataset.noSwipe === 'true'
    ) {
      return true;
    }
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 10) {
      if (direction === 'left' && el.scrollLeft + el.clientWidth < el.scrollWidth - 10) {
        return true;
      }
      if (direction === 'right' && el.scrollLeft > 10) {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
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

  // Auto-hide mobile header on scroll down, reveal on scroll up (matching thegioitrimun.vn navbar behavior)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const isAtTopRef = useRef(true);
  const lastScrollY = useRef(0);
  const headerScrollDelta = useRef(0);
  const headerScrollFrame = useRef<number | null>(null);

  const setHeaderVisibility = useCallback((visible: boolean) => {
    if (isHeaderVisibleRef.current === visible) return;
    isHeaderVisibleRef.current = visible;
    setIsHeaderVisible(visible);
  }, []);

  const controlHeaderVisibility = useCallback(() => {
    const currentScrollY = window.scrollY;

    // Track whether we are at the top (under 50px)
    const atTop = currentScrollY < 50;
    if (isAtTopRef.current !== atTop) {
      isAtTopRef.current = atTop;
      setIsAtTop(atTop);
    }

    const delta = currentScrollY - lastScrollY.current;
    lastScrollY.current = currentScrollY;

    // Always keep header visible when near top of the page
    if (currentScrollY <= 80) {
      headerScrollDelta.current = 0;
      setHeaderVisibility(true);
      return;
    }

    // Ignore micro touch vibrations
    if (Math.abs(delta) < 2) return;

    const isSameDirection = Math.sign(headerScrollDelta.current) === Math.sign(delta);
    headerScrollDelta.current = isSameDirection ? headerScrollDelta.current + delta : delta;

    const hideThreshold = 84;
    const showThreshold = 56;

    if (headerScrollDelta.current > hideThreshold) {
      headerScrollDelta.current = 0;
      setHeaderVisibility(false);
      return;
    }

    if (headerScrollDelta.current < -showThreshold) {
      headerScrollDelta.current = 0;
      setHeaderVisibility(true);
    }
  }, [setHeaderVisibility]);

  useEffect(() => {
    lastScrollY.current = typeof window !== 'undefined' ? window.scrollY : 0;

    const handleScroll = () => {
      if (headerScrollFrame.current !== null) return;
      headerScrollFrame.current = window.requestAnimationFrame(() => {
        headerScrollFrame.current = null;
        if (!isMobileDrawerOpen) {
          controlHeaderVisibility();
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (headerScrollFrame.current !== null) {
        window.cancelAnimationFrame(headerScrollFrame.current);
        headerScrollFrame.current = null;
      }
    };
  }, [controlHeaderVisibility, isMobileDrawerOpen]);

  // Keep header visible when switching page or task
  useEffect(() => {
    setHeaderVisibility(true);
    headerScrollDelta.current = 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastScrollY.current = scrollY;
    const atTop = scrollY < 50;
    isAtTopRef.current = atTop;
    setIsAtTop(atTop);
  }, [currentPage, activeTaskKey, setHeaderVisibility]);

  useEffect(() => {
    if (isMobileDrawerOpen) {
      setHeaderVisibility(true);
    }
  }, [isMobileDrawerOpen, setHeaderVisibility]);

  const touchStartRef = useRef<{ x: number; y: number; time: number; target: EventTarget | null } | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active tab into view in horizontal tab bar
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTaskKey]);

  const selectTab = useCallback((item: (typeof taskItems)[number]) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.view) {
      onNavigate(item.view);
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch (_) {
        // ignore
      }
    }
  }, [onNavigate]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isMobileDrawerOpen) return;
    if (!taskItems || taskItems.length <= 1) return;
    const touch = e.touches[0];
    if (!touch) return;

    // Ignore if touch started too close to the screen edges (e.g. iOS back gesture)
    if (touch.clientX < 20 || touch.clientX > window.innerWidth - 20) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      target: e.target,
    };
  }, [isMobileDrawerOpen, taskItems]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !taskItems || taskItems.length <= 1) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const startTarget = touchStartRef.current.target;
    touchStartRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Require intentional horizontal swipe (min 50px, under 600ms, X dominance over Y)
    if (absX < 50 || deltaTime > 600 || absX <= absY * 1.5) {
      return;
    }

    const direction = deltaX < 0 ? 'left' : 'right';

    if (canElementScrollHorizontally(startTarget, direction)) {
      return;
    }

    const currentIndex = taskItems.findIndex((item) => item.key === activeTaskKey);
    if (currentIndex === -1) return;

    if (direction === 'left' && currentIndex < taskItems.length - 1) {
      // Swipe left -> Next tab
      selectTab(taskItems[currentIndex + 1]);
    } else if (direction === 'right' && currentIndex > 0) {
      // Swipe right -> Previous tab
      selectTab(taskItems[currentIndex - 1]);
    }
  }, [activeTaskKey, selectTab, taskItems]);

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
    <div className="min-h-screen animate-fade-in bg-slate-50/80 dark:bg-[#0b0f17] text-foreground transition-colors duration-300">
      <div className="mx-auto max-w-[1680px] px-3 sm:px-4 md:px-6 lg:py-6 xl:px-8 pt-0 sm:pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
        {/* FLOATING GLASS MOBILE NAVBAR (MATCHING THEGIOITRIMUN.VN NAVBAR) */}
        <div className={`sticky top-0 z-30 mb-3 pt-[max(env(safe-area-inset-top,0px),0.5rem)] lg:hidden will-change-transform transition-transform duration-300 motion-reduce:transition-none ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className={`relative flex min-h-[58px] sm:min-h-[64px] items-center justify-between gap-2 rounded-[28px] sm:rounded-[30px] px-2.5 py-2 sm:px-4 sm:py-2.5 transition-all duration-500 ease-in-out ${
            isAtTop
              ? 'border border-white/60 bg-[rgba(255,255,255,0.78)] shadow-[0_12px_36px_-20px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.78)] dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.5)]'
              : 'border border-white/75 bg-[rgba(255,255,255,0.92)] shadow-[0_20px_44px_-24px_rgba(36,46,57,0.18)] backdrop-blur-2xl dark:border-white/15 dark:bg-[rgba(15,23,42,0.92)] dark:shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)]'
          }`}>
            {/* Ambient Gradient Orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] sm:rounded-[30px]">
              <div className="absolute -left-6 top-0 h-24 w-24 rounded-full bg-[#ff7f5d]/14 blur-2xl"></div>
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#35b7a5]/14 blur-2xl dark:bg-[#35b7a5]/18"></div>
            </div>

            {/* Left Cluster: Brand Logo */}
            <div className="relative z-10 flex items-center shrink-0 w-10">
              <button
                type="button"
                onClick={onBack}
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-[14px] sm:rounded-[16px] bg-white dark:bg-[#15202e] border border-slate-200/80 dark:border-white/10 shadow-xs transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                title="Về tổng quan Admin"
              >
                <img
                  loading="eager"
                  decoding="async"
                  width="96"
                  height="96"
                  alt="TGTM Admin Logo"
                  className="block h-7 w-7 sm:h-8 sm:w-8 object-contain dark:hidden"
                  src="/icons/admin-logo.svg"
                />
                <img
                  loading="eager"
                  decoding="async"
                  width="96"
                  height="96"
                  alt="TGTM Admin Logo"
                  className="hidden h-7 w-7 sm:h-8 sm:w-8 object-contain dark:block"
                  src="/icons/admin-logo-dark.svg"
                />
              </button>
            </div>

            {/* Center: Active Module Title */}
            <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center px-1 text-center">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="btn-press flex max-w-full items-center justify-center bg-transparent border-0 shadow-none p-1 focus:outline-none cursor-pointer transition-transform active:scale-95"
                title="Chuyển phân hệ quản trị"
              >
                <span className="truncate max-w-[200px] xs:max-w-[250px] sm:max-w-none font-['Playfair_Display',_serif] text-[12px] sm:text-[13.5px] font-black uppercase tracking-[0.08em] text-foreground dark:text-white transition-colors">
                  {activeModule.label}
                </span>
              </button>
            </div>

            {/* Right Cluster: User Avatar with Gradient Ring & Online Dot */}
            <div className="relative z-10 flex items-center justify-end shrink-0 w-10">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full p-0.5 bg-gradient-to-tr from-[#ff7f5d]/50 via-primary/40 to-teal-400/50 shadow-xs transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                  title={currentUser.profile?.name || 'Admin'}
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden bg-white dark:bg-[#131d2a] border border-white/40 dark:border-white/10">
                    {currentUser.profile?.avatar_url ? (
                      <img src={currentUser.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-bold text-xs uppercase text-primary">
                        {(currentUser.profile?.name || currentUser.profile?.email || 'A').charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f1724]"></span>
                </button>
              ) : (
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/10 text-muted-foreground hover:text-primary transition-all shadow-xs"
                  title="Mở website khách hàng ở tab mới"
                >
                  <HomeIcon className="h-4 w-4 text-primary" />
                </a>
              )}
            </div>
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
                    <img src="/icons/admin-logo.svg" alt="Admin" className="h-7 w-7 object-contain dark:hidden" />
                    <img src="/icons/admin-logo-dark.svg" alt="Admin" className="hidden h-7 w-7 object-contain dark:block" />
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
                <div className={`mb-3 flex items-center rounded-[1.15rem] p-2 transition-all duration-300 ${!isTemporarilyCollapsed ? 'justify-center group-hover/sidebar:justify-start group-hover/sidebar:gap-3' : 'justify-center'}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <img src="/icons/admin-logo.svg" alt="Admin" className="h-8 w-8 object-contain dark:hidden" />
                    <img src="/icons/admin-logo-dark.svg" alt="Admin" className="hidden h-8 w-8 object-contain dark:block" />
                  </div>
                  <div className={`min-w-0 flex-1 whitespace-nowrap transition-all duration-300 ${!isTemporarilyCollapsed ? 'hidden group-hover/sidebar:block opacity-0 group-hover/sidebar:opacity-100' : 'hidden'}`}>
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

          <div
            className={unwrappedContent ? "min-w-0" : "min-w-0 rounded-[1.7rem]"}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'pan-y' }}
          >
            {!hideHeader ? (
              <AnimatedSection className="mb-4 lg:mb-0">

                {taskItems && taskItems.length > 0 ? (
                  <div className="lg:hidden bg-transparent mb-3.5">
                    <div
                      data-admin-tab-bar="true"
                      className="flex items-center overflow-x-auto hide-scrollbar gap-1.5 px-0.5 pb-1 -mx-0.5 overscroll-x-contain"
                    >
                      {taskItems.map((item) => {
                        const isActive = item.key === activeTaskKey;
                        return (
                          <button
                            key={item.key}
                            ref={isActive ? activeTabRef : undefined}
                            type="button"
                            onClick={() => selectTab(item)}
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
