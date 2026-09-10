import React, { useEffect, useState } from 'react';
import type { AdminNavigationView, View, UserRole } from '../types';
import { MenuIcon, DocumentDuplicateIcon } from './icons';
import { preloadAdminPage } from '../src/adminPageLoaders';
import { ADMIN_NAV_REGISTRY, resolveActiveAdminModule, resolveAdminPageTitle, isAdminSubItemActive, type AdminNavModule } from '../src/admin/adminNavRegistry';
import { AdminThemeProvider, useAdminTheme } from '../src/admin/AdminThemeContext';
import { AdminDialog } from './admin/AdminDialog';
import { AdminSectionTabs } from './admin/AdminSectionTabs';

export type AdminWorkspacePage = AdminNavigationView['page'];
export interface AdminWorkspaceLayoutProps {
  currentPage?: AdminWorkspacePage;
  currentView?: View;
  currentRole: UserRole;
  onBack: () => void;
  onNavigate: (view: AdminNavigationView) => void;
  children: React.ReactNode;
}
export interface AdminWorkspaceTabItem<T extends string> { key: T; label: string }
export const AdminWorkspaceTabs = AdminSectionTabs;

function ModuleIcon({ module }: { module: AdminNavModule }) {
  const [failed, setFailed] = useState(false);
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
    {module.iconUrl && !failed ? <img src={module.iconUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" onError={() => setFailed(true)} /> : <DocumentDuplicateIcon className="h-6 w-6" />}
  </span>;
}
function Workspace({ currentPage = 'adminDashboard', currentView, currentRole, onBack, onNavigate, children }: AdminWorkspaceLayoutProps) {
  const view: View = currentView || { page: currentPage };
  const module = resolveActiveAdminModule(view, currentRole);
  const title = resolveAdminPageTitle(view);
  const modules = ADMIN_NAV_REGISTRY.filter(item => item.allowedRoles.includes(currentRole));
  const [menu, setMenu] = useState<'desktop' | 'mobile' | null>(null);
  const theme = useAdminTheme();
  const routeKey = JSON.stringify(view);
  useEffect(() => { setMenu(null); }, [routeKey]);
  const navigate = (next: AdminNavigationView) => { setMenu(null); onNavigate(next); };
  const prefetch = (next: AdminNavigationView) => { void preloadAdminPage(next.page).catch(() => undefined); };
  const tabs = module.subItems;
  const activeTab = tabs.find(item => isAdminSubItemActive(view, item.view))?.key || '';
  return <div data-admin-workspace="true" className="min-h-screen" style={{ background: 'var(--admin-gradient)' }}>
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/50 px-3 lg:hidden" style={{ background: 'var(--admin-overlay)' }}>
      <button type="button" onClick={onBack} aria-label="Về tổng quan" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
        <img src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.svg" alt="" width={36} height={30} />
      </button>
      <span className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</span>
      <button type="button" onClick={() => setMenu('mobile')} aria-label="Mở menu quản trị" aria-expanded={menu === 'mobile'} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted"><MenuIcon className="h-5 w-5" /></button>
    </header>
    <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-5 px-3 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:grid-cols-[76px_minmax(0,1fr)] lg:px-6 lg:py-6 xl:px-8">
      <aside className="sticky top-6 hidden h-[calc(100dvh-48px)] w-[76px] flex-col items-center gap-2 rounded-[28px] py-3 lg:flex admin-surface" aria-label="Điều hướng quản trị">
        <button type="button" onClick={() => setMenu('desktop')} aria-expanded={menu === 'desktop'} aria-label="Mở menu quản trị" title="Mở menu quản trị" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-muted"><MenuIcon className="h-5 w-5" /></button>
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1 py-1" aria-label="Module quản trị">
          {modules.map(item => <button key={item.id} type="button" aria-label={item.label} title={item.label} aria-current={module.id === item.id ? 'page' : undefined}
            onClick={() => navigate(item.defaultView)} onMouseEnter={() => prefetch(item.defaultView)} onFocus={() => prefetch(item.defaultView)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${module.id === item.id ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted'}`}><ModuleIcon module={item} /></button>)}
        </nav>
        <button type="button" onClick={theme?.toggle} aria-label={theme?.mode === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'} title={theme?.mode === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'} className="h-11 w-11 shrink-0 rounded-xl hover:bg-muted">{theme?.mode === 'light' ? '☾' : '☀'}</button>
      </aside>
      <main className="min-w-0 space-y-3 lg:space-y-5" aria-label={title}>
        <h1 className="sr-only text-xl font-bold leading-7 lg:not-sr-only">{title}</h1>
        {tabs.length > 1 && <AdminSectionTabs items={tabs} activeKey={activeTab} onChange={key => { const tab = tabs.find(item => item.key === key); if (tab) navigate(tab.view); }} />}
        <div className="admin-module-content">{children}</div>
      </main>
    </div>
    <AdminDialog open={menu !== null} onClose={() => setMenu(null)} title="Menu quản trị"
      placement={menu === 'desktop' ? 'desktop-menu' : 'mobile-menu'}>
      <nav className="space-y-3" aria-label="Tất cả module">
        {modules.map(item => <div key={item.id}>
          <button type="button" onClick={() => navigate(item.defaultView)} onMouseEnter={() => prefetch(item.defaultView)} onFocus={() => prefetch(item.defaultView)} aria-current={item.id === module.id ? 'page' : undefined}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-semibold ${item.id === module.id ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}><ModuleIcon module={item} />{item.label}</button>
          {item.subItems.length > 1 && <div className="ml-5 mt-1 border-l border-border pl-3">{item.subItems.map(sub => <button type="button" key={sub.key} onClick={() => navigate(sub.view)} aria-current={isAdminSubItemActive(view, sub.view) ? 'page' : undefined} className={`block min-h-9 w-full rounded-lg px-2 py-2 text-left text-xs ${isAdminSubItemActive(view, sub.view) ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted'}`}>{sub.label}</button>)}</div>}
        </div>)}
      </nav>
      <button type="button" onClick={theme?.toggle} className="mt-4 min-h-11 w-full rounded-xl border border-border px-3">{theme?.mode === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'}</button>
    </AdminDialog>
  </div>;
}
export default function AdminWorkspaceLayout(props: AdminWorkspaceLayoutProps) { return <AdminThemeProvider><Workspace {...props} /></AdminThemeProvider>; }
