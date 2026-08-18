import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { AdminNavigationView } from '../types';

export type AdminTaskItem = {
  key: string;
  label: string;
  hint?: string;
  view?: AdminNavigationView; // Make view optional since we might only use onClick
  onClick?: () => void;
};

export type SidebarConfig = {
  taskItems?: AdminTaskItem[];
  activeTaskKey?: string;
  hideHeader?: boolean;
  unwrappedContent?: boolean;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  insights?: Array<{
    label: string;
    value: string;
    hint?: string;
  }>;
};

type SetSidebarConfig = (config: Partial<SidebarConfig>) => void;

const AdminLayoutConfigContext = createContext<SidebarConfig>({});
const AdminLayoutDispatchContext = createContext<SetSidebarConfig>(() => {});

export const useAdminLayoutConfig = () => useContext(AdminLayoutConfigContext);
export const useAdminLayoutDispatch = () => useContext(AdminLayoutDispatchContext);

export const AdminLayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SidebarConfig>({});

  const setSidebarConfig = useCallback((newConfig: Partial<SidebarConfig>) => {
    setConfig(prev => {
      const next = { ...newConfig } as SidebarConfig;
      const prevKeys = Object.keys(prev) as Array<keyof SidebarConfig>;
      const nextKeys = Object.keys(next) as Array<keyof SidebarConfig>;
      const isUnchanged = prevKeys.length === nextKeys.length
        && nextKeys.every((key) => next[key] === prev[key]);

      return isUnchanged ? prev : next;
    });
  }, []);

  return (
    <AdminLayoutDispatchContext.Provider value={setSidebarConfig}>
      <AdminLayoutConfigContext.Provider value={config}>
        {children}
      </AdminLayoutConfigContext.Provider>
    </AdminLayoutDispatchContext.Provider>
  );
};
