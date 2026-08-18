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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

document.documentElement.setAttribute('data-build', '20260316-hotfix-asset-cache');

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
