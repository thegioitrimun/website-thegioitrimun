import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, View } from '../types';
import { HeartIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../hooks/useToast';
import { ShoppingBagIcon } from './icons';
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
  }

  return (
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-6 py-12">
        <AnimatedSection className="mb-12">
          <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('wishlist.title')}</h1>
          <p className="text-lg text-muted-foreground mt-2">{t('wishlist.subtitle')}</p>
        </AnimatedSection>

        {wishlistedProducts.length === 0 ? (
          <AnimatedSection>
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <HeartIcon className="w-20 h-20 mx-auto text-muted-foreground/50" />
              <h2 className="mt-6 text-2xl font-semibold text-muted-foreground">{t('wishlist.empty')}</h2>
              <p className="mt-2 text-muted-foreground">{t('wishlist.empty_desc')}</p>
              <button onClick={() => onNavigate({ page: 'products' })} className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-md hover:shadow-lg transform hover:-translate-y-1 btn-press">
                {t('cart.explore')}
              </button>
            </div>
          </AnimatedSection>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-stretch">
            {wishlistedProducts.map((product, index) => (
              <AnimatedSection key={product.id} className="flex flex-col self-stretch" stagger={index * 50}>
                <div
                  onClick={() => onSelectProduct(product.id)}
                  className="group bg-card text-card-foreground rounded-xl shadow-lg overflow-hidden flex-1 transform transition-all-smooth hover:-translate-y-2 hover:shadow-2xl cursor-pointer border border-border flex flex-col h-full"
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    <img src={product.images?.[0]?.image_url || 'https://placehold.co/400x400'} alt={getLocalized(product, 'name')} className="absolute w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    <button
                      onClick={(e) => handleRemoveFromWishlist(e, product.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-card/70 backdrop-blur-sm text-red-500 hover:bg-card transition-all-smooth btn-press"
                      aria-label={`${t('common.delete')} ${getLocalized(product, 'name')}`}
                    >
                      <HeartIcon className="w-6 h-6 fill-current" />
                    </button>
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-bold text-foreground mb-2 flex-grow">{getLocalized(product, 'name')}</h3>
                    <div className="flex justify-between items-center mt-auto">
                      <p className="text-lg font-semibold text-primary">{formatCurrency(product.price)}</p>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all-smooth btn-press"
                        aria-label={`${t('products.add_to_cart')} ${getLocalized(product, 'name')}`}
                        title={t('products.add_to_cart')}
                        disabled={product.stock_quantity === 0}
                      >
                        <ShoppingBagIcon className="w-5 h-5" />
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
