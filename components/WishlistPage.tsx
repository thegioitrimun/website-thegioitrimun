import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, View } from '../types';
import { HeartIcon, ShoppingBagIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../hooks/useToast';
import BackIconButton from './BackIconButton';

interface WishlistPageProps {
  allProducts: Product[];
  onSelectProduct: (id: number) => void;
  onNavigate: (view: View) => void;
  onBack: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const WishlistPage: React.FC<WishlistPageProps> = ({ allProducts, onSelectProduct, onNavigate, onBack }) => {
  const { t, i18n } = useTranslation();
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { addToast } = useToast();

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const v = obj[`${field}_${lang}`];
      if (v) return v;
    }
    return obj[field] || '';
  };

  const wishlistedProducts = useMemo(() => {
    return allProducts.filter(p => wishlist.has(p.id));
  }, [allProducts, wishlist]);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
    addToast(`${t('wishlist.added_to_cart')} ${getLocalized(product, 'name')}`, { type: 'success' });
  };

  const handleRemoveFromWishlist = (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    removeFromWishlist(productId);
    addToast(t('wishlist.removed'), { type: 'info' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Top Header Card */}
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-inner">
                <HeartIcon className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('wishlist.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('wishlist.subtitle')}</p>
              </div>
            </div>
            {wishlistedProducts.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {wishlistedProducts.length} {t('common.products', 'sản phẩm')}
              </span>
            )}
          </div>
        </AnimatedSection>

        {/* Product Grid / Empty State */}
        {wishlistedProducts.length === 0 ? (
          <AnimatedSection>
            <div className="text-center py-16 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 mx-1 sm:mx-0">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-inner mb-4">
                <HeartIcon className="w-8 h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{t('wishlist.empty')}</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">{t('wishlist.empty_desc')}</p>
              <button
                onClick={() => onNavigate({ page: 'products' })}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground backdrop-blur-xl px-6 py-2.5 text-sm font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 btn-press"
              >
                {t('cart.explore')}
              </button>
            </div>
          </AnimatedSection>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
            {wishlistedProducts.map((product, index) => (
              <AnimatedSection key={product.id} className="flex flex-col self-stretch" stagger={index * 40}>
                <div
                  onClick={() => onSelectProduct(product.id)}
                  className="group relative rounded-2xl border border-white/70 bg-card/85 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full overflow-hidden bg-muted/20">
                    <img
                      src={product.images?.[0]?.image_url || 'https://placehold.co/400x400'}
                      alt={getLocalized(product, 'name')}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFromWishlist(e, product.id)}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-background/80 hover:bg-background backdrop-blur-md text-rose-500 shadow-sm transition-all btn-press z-10"
                      aria-label={`${t('common.delete')} ${getLocalized(product, 'name')}`}
                      title={t('common.delete')}
                    >
                      <HeartIcon className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between gap-2.5">
                    <h3 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {getLocalized(product, 'name')}
                    </h3>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                      <p className="text-xs sm:text-base font-bold text-primary">
                        {formatCurrency(product.price)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(e, product)}
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all duration-200 shadow-xs btn-press disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={`${t('products.add_to_cart')} ${getLocalized(product, 'name')}`}
                        title={t('products.add_to_cart')}
                        disabled={product.stock_quantity === 0}
                      >
                        <ShoppingBagIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
