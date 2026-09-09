import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAdminLayoutConfig, useAdminLayoutDispatch } from './AdminLayoutContext';
import type { AdminNavigationView, View, UserRole } from '../types';
import {
  MenuIcon,
  CloseIcon,
  DocumentDuplicateIcon,
  ChevronRightIcon,
} from './icons';
import { preloadAdminPage } from '../src/adminPageLoaders';
import {
  ADMIN_NAV_REGISTRY,
  resolveActiveAdminModule,
  resolveAdminPageTitle,
  type AdminNavModule,
} from '../src/admin/adminNavRegistry';

export type AdminWorkspacePage = AdminNavigationView['page'];

export interface AdminWorkspaceLayoutProps {
  currentPage?: AdminWorkspacePage;
  currentView?: AdminNavigationView | View;
  currentRole: UserRole;
  onBack: () => void;
  onNavigate: (view: AdminNavigationView) => void;
  children: React.ReactNode;
}

export interface AdminWorkspaceTabItem<T extends string> {
  key: T;
  label: string;
}

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
    <div className={`rounded-2xl border border-border/70 bg-white/70 dark:bg-card/90 p-1.5 shadow-2xs backdrop-blur-md ${className}`.trim()}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:flex xl:min-w-max xl:flex-wrap">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`w-full rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition-all select-none md:px-4 xl:w-auto xl:rounded-full xl:text-center ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
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
  currentPage = 'adminDashboard',
  currentView,
  currentRole,
  onBack,
  onNavigate,
  children,
}) => {
  const config = useAdminLayoutConfig();
  const setSidebarConfig = useAdminLayoutDispatch();
  const {
    title = '',
    taskItems = [],
    activeTaskKey = '',
    hideHeader = false,
    unwrappedContent = false,
  } = config;

  // Active state resolution using central registry
  const effectiveView: AdminNavigationView | View = currentView || { page: currentPage };
  const activeModule = resolveActiveAdminModule(effectiveView, currentRole);
  const resolvedPageTitle = resolveAdminPageTitle(effectiveView, title);

  // Navigation states
  const [isDesktopMenuPanelOpen, setIsDesktopMenuPanelOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const menuTriggerButtonRef = useRef<HTMLButtonElement>(null);

  // Permitted modules according to user role
  const visibleModules = ADMIN_NAV_REGISTRY.filter((mod) =>
    mod.allowedRoles.includes(currentRole)
  );

  // Handle ESC key to close open panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDesktopMenuPanelOpen(false);
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside to close desktop overlay panel
  useEffect(() => {
    if (!isDesktopMenuPanelOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(e.target as Node) &&
        menuTriggerButtonRef.current &&
        !menuTriggerButtonRef.current.contains(e.target as Node)
      ) {
        setIsDesktopMenuPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDesktopMenuPanelOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  const renderModuleIcon = (mod: AdminNavModule, className = 'h-7 w-7') => {
    if (mod.iconUrl) {
      return (
        <img
          src={mod.iconUrl}
          alt={mod.label}
          className={`${className} object-contain`}
          loading="lazy"
        />
      );
    }
    if (mod.icon) return mod.icon;
    return <DocumentDuplicateIcon className={className} />;
  };

  return (
    <div className="admin-theme-root min-h-screen bg-[linear-gradient(135deg,#ffecee_0%,#fff3e6_20%,#fffbea_40%,#ecfdf5_60%,#eff6ff_80%,#f5f3ff_100%)] dark:bg-[linear-gradient(135deg,#0b1320_0%,#0d1726_50%,#09101a_100%)] text-foreground font-sans transition-colors duration-150">
      <div className="mx-auto max-w-[1680px] px-3 pb-10 pt-2 sm:px-4 md:px-6 lg:py-6 xl:px-8">
        {/* COMPACT MOBILE HEADER (56px) */}
        <div className="sticky top-0 z-30 -mx-3 mb-4 h-14 border-b border-white/60 dark:border-white/10 bg-white/90 dark:bg-[#0f1722]/95 px-3 backdrop-blur-xl shadow-xs md:-mx-6 md:px-6 lg:hidden flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Về trang trước"
            className="inline-flex h-9 items-center justify-center rounded-full bg-card px-2.5 shadow-2xs transition-transform active:scale-95"
          >
            <img
              src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.svg"
              alt="Thế Giới Trị Mụn"
              className="h-6 w-auto object-contain dark:hidden"
            />
            <img
              src="/icons/da-lieu-nhiet-doi-phu-quoc-logo-dark.svg"
              alt="Thế Giới Trị Mụn"
              className="h-6 w-auto object-contain hidden dark:block"
            />
          </button>

          <div className="min-w-0 flex-1 text-center px-2">
            <h2 className="truncate text-sm font-bold text-foreground font-heading">
              {resolvedPageTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Mở menu quản trị"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground shadow-2xs active:scale-95"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>

        {/* MOBILE DRAWER (320px) */}
        {typeof document !== 'undefined' &&
          createPortal(
            <div
              className={`fixed inset-0 z-[100] lg:hidden transition-opacity duration-200 ${
                isMobileDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="Menu quản trị"
            >
              <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200 ${
                  isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => setIsMobileDrawerOpen(false)}
              />

              <div
                className={`absolute bottom-0 right-0 top-0 w-[320px] max-w-[88vw] overflow-y-auto bg-card/95 dark:bg-[#0f1722]/98 backdrop-blur-2xl p-4 shadow-2xl border-l border-border/60 transition-transform duration-200 ease-out flex flex-col ${
                  isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
              >
                <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/70">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <img
                        src="https://thegioitrimun.vn/r2/assets/admin-icons/admin.webp"
                        alt="Admin"
                        className="h-6 w-6 object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground font-heading">
                        Quản trị hệ thống
                      </h2>
                      <p className="text-[11px] text-muted-foreground">Thế Giới Trị Mụn</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    aria-label="Đóng menu"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {visibleModules.map((mod) => {
                    const isModActive = mod.id === activeModule.id;
                    return (
                      <div key={mod.id} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => {
                            setSidebarConfig({});
                            onNavigate(mod.defaultView);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
                            isModActive
                              ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                              : 'text-foreground hover:bg-muted/60 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                              {renderModuleIcon(mod, 'h-6 w-6')}
                            </span>
                            <span className="truncate text-sm">{mod.label}</span>
                          </div>
                          {mod.subItems.length > 1 && (
                            <ChevronRightIcon
                              className={`h-4 w-4 shrink-0 transition-transform opacity-70 ${
                                isModActive ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </button>

                        {/* Sub-items in mobile drawer */}
                        {isModActive && mod.subItems && mod.subItems.length > 0 && (
                          <div className="ml-5 mt-1 flex flex-col space-y-1 border-l-2 border-primary/30 pl-3.5 py-1">
                            {mod.subItems.map((sub) => {
                              const isSubActive =
                                'section' in sub.view &&
                                'section' in (effectiveView as any) &&
                                sub.view.section === (effectiveView as any).section;
                              return (
                                <button
                                  key={sub.key}
                                  type="button"
                                  onClick={() => {
                                    onNavigate(sub.view);
                                    setIsMobileDrawerOpen(false);
                                  }}
                                  className={`rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold transition-all ${
                                    isSubActive
                                      ? 'bg-primary/15 text-primary dark:text-emerald-300 font-bold'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                  }`}
                                >
                                  {sub.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </div>,
            document.body
          )}

        {/* DESKTOP WORKSPACE GRID (76px Rail + Content) */}
        <div className="grid gap-5 lg:grid-cols-[76px_minmax(0,1fr)] xl:gap-7">
          {/* DESKTOP FIXED-WIDTH RAIL (76px) */}
          <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start z-40">
            <div className="relative">
              <div className="w-[76px] shrink-0 bg-white/80 dark:bg-[rgba(15,23,34,0.92)] backdrop-blur-xl rounded-2xl md:rounded-[24px] border border-white/70 dark:border-white/10 p-2 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] flex flex-col items-center gap-2">
                {/* Header Menu Toggle Button */}
                <button
                  ref={menuTriggerButtonRef}
                  type="button"
                  onClick={() => setIsDesktopMenuPanelOpen(!isDesktopMenuPanelOpen)}
                  title={isDesktopMenuPanelOpen ? 'Đóng menu đầy đủ' : 'Mở menu đầy đủ (268px)'}
                  aria-label="Menu quản trị đầy đủ"
                  aria-expanded={isDesktopMenuPanelOpen}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                    isDesktopMenuPanelOpen
                      ? 'bg-primary/15 text-primary ring-2 ring-primary/30'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <img
                    src="https://thegioitrimun.vn/r2/assets/admin-icons/admin.webp"
                    alt="Admin"
                    className="h-8 w-8 object-contain transition-transform hover:scale-110"
                  />
                </button>

                <div className="h-px w-8 bg-border/70 dark:bg-white/10 my-0.5" />

                {/* 10 Navigation Module Icon Buttons */}
                <nav className="flex flex-col items-center gap-1.5 w-full">
                  {visibleModules.map((mod) => {
                    const isModActive = mod.id === activeModule.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onPointerEnter={() => void preloadAdminPage(mod.defaultView.page as any)}
                        onFocus={() => void preloadAdminPage(mod.defaultView.page as any)}
                        onClick={() => {
                          setSidebarConfig({});
                          onNavigate(mod.defaultView);
                          setIsDesktopMenuPanelOpen(false);
                        }}
                        title={mod.label}
                        aria-label={mod.label}
                        className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                          isModActive
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <span className="flex items-center justify-center transition-transform group-hover:scale-110">
                          {renderModuleIcon(mod, 'h-6 w-6')}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* ACTIVE OVERLAY PANEL (268px) - Positioned next to Rail without displacing layout */}
              {isDesktopMenuPanelOpen && (
                <div
                  ref={desktopMenuRef}
                  className="absolute left-[84px] top-0 z-50 w-[268px] overflow-hidden rounded-2xl md:rounded-[24px] border border-white/80 dark:border-white/15 bg-white/98 dark:bg-[rgba(15,23,34,0.98)] backdrop-blur-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  role="menu"
                  aria-label="Danh sách module quản trị"
                >
                  <div className="flex items-center justify-between px-2 pb-2.5 mb-1.5 border-b border-border/70">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        Hệ thống
                      </p>
                      <h3 className="text-sm font-black text-foreground font-heading">
                        Điều hướng Quản trị
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDesktopMenuPanelOpen(false)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      aria-label="Đóng"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-[calc(100vh-140px)] overflow-y-auto space-y-1 pr-0.5">
                    {visibleModules.map((mod) => {
                      const isModActive = mod.id === activeModule.id;
                      return (
                        <div key={mod.id} className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => {
                              setSidebarConfig({});
                              onNavigate(mod.defaultView);
                              setIsDesktopMenuPanelOpen(false);
                            }}
                            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                              isModActive
                                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                : 'text-foreground hover:bg-muted/60 font-medium'
                            }`}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                              {renderModuleIcon(mod, 'h-5 w-5')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold leading-tight">{mod.label}</p>
                              <p
                                className={`truncate text-[10px] ${
                                  isModActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                }`}
                              >
                                {mod.description}
                              </p>
                            </div>
                          </button>

                          {/* Sub-items in flyout panel */}
                          {isModActive && mod.subItems && mod.subItems.length > 0 && (
                            <div className="ml-4 my-1 flex flex-col space-y-0.5 border-l-2 border-primary/40 pl-2.5">
                              {mod.subItems.map((sub) => {
                                const isSubActive =
                                  'section' in sub.view &&
                                  'section' in (effectiveView as any) &&
                                  sub.view.section === (effectiveView as any).section;
                                return (
                                  <button
                                    key={sub.key}
                                    type="button"
                                    onClick={() => {
                                      onNavigate(sub.view);
                                      setIsDesktopMenuPanelOpen(false);
                                    }}
                                    className={`rounded-lg px-2 py-1 text-left text-xs font-medium transition-all ${
                                      isSubActive
                                        ? 'bg-primary/15 text-primary dark:text-emerald-300 font-bold'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                    }`}
                                  >
                                    {sub.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className={unwrappedContent ? 'min-w-0' : 'min-w-0'}>
            {!hideHeader && taskItems && taskItems.length > 0 ? (
              <div className="mb-4 lg:hidden">
                <div className="flex snap-x overflow-x-auto gap-1.5 pb-1 scrollbar-none">
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
                        className={`shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkspaceLayout;
