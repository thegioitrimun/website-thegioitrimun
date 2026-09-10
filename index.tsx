import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/i18n';
import './src/index.css';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontProvider } from './contexts/FontContext';
import { ToastProvider } from './contexts/ToastContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';

window.addEventListener('vite:preloadError', () => {
  const reloadKey = 'vite_preload_reload_ts';
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
  if (now - lastReload > 8000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

document.documentElement.setAttribute('data-build', '20260910-resilient-chunks');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ThemeProvider storageKey="iskin-clinic-theme" defaultTheme="light">
    <FontProvider storageKey="iskin-clinic-font" defaultFont="Be Vietnam Pro">
      <ToastProvider>
        <CartProvider>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </CartProvider>
      </ToastProvider>
    </FontProvider>
  </ThemeProvider>
);
