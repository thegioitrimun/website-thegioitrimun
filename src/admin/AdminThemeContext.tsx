import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { getOrCreateAdminPortalHost } from '../../components/admin/AdminPortalHost';
import './adminTheme.css';

type Mode = 'light' | 'dark';
const Context = createContext<{ mode: Mode; toggle: () => void } | null>(null);
export const useAdminTheme = () => useContext(Context);
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try { return localStorage.getItem('tgtm-admin-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useLayoutEffect(() => {
    const host = getOrCreateAdminPortalHost();
    host.dataset.adminTheme = mode;
    host.classList.toggle('dark', mode === 'dark');
  }, [mode]);
  const toggle = () => setMode(previous => {
    const next = previous === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('tgtm-admin-theme', next); } catch { /* Session-only when storage is unavailable. */ }
    return next;
  });
  return <Context.Provider value={{ mode, toggle }}><div className={`admin-theme-root ${mode === 'dark' ? 'dark' : ''}`} data-admin-theme={mode}>{children}</div></Context.Provider>;
}
