import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/i18n';
import '../src/index.css';
import AdminApp from './AdminApp';
import { ThemeProvider } from '../contexts/ThemeContext';
import { FontProvider } from '../contexts/FontContext';
import { ToastProvider } from '../contexts/ToastContext';

const rootElement = document.getElementById('admin-root');
if (!rootElement) {
  throw new Error("Could not find root element '#admin-root' to mount TGTM Admin");
}

document.documentElement.setAttribute('data-admin-app', 'true');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ThemeProvider storageKey="iskin-clinic-theme" defaultTheme="dark">
    <FontProvider storageKey="iskin-clinic-font" defaultFont="Be Vietnam Pro">
      <ToastProvider>
        <AdminApp />
      </ToastProvider>
    </FontProvider>
  </ThemeProvider>
);
