import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../types';
import { EyeIcon, HeartIcon, ShoppingBagIcon } from '../icons';
import { buildListingImageUrl, buildProductImageAlt } from '../../src/imageSeo';
import { getProductDetailPath } from '../../src/appRouting';
import { useCart } from '../../contexts/CartContext';
import { useProductRiskSummary, ProductRiskBar } from '../../src/productIngredientSummary';

export type ProductCardBadge = {
  label: string;
  tone?: 'primary' | 'neutral' | 'accent' | 'warning';
};

export interface ProductCardItem {
  product: Product;
  name: string;
  primaryBenefit: string;
  categoryName?: string;
  compareAtPrice?: number | null;
  badges: ProductCardBadge[];
  meta: string[];
}

interface ProductCardProps {
  item: ProductCardItem;
  formatCurrency: (amount: number) => string;
  isWishlisted: boolean;
  onViewProduct: () => void;
  onToggleWishlist: (event: React.MouseEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  item,
  formatCurrency,
  isWishlisted,
  onViewProduct,
  onToggleWishlist,
}) => {
  const { t, i18n } = useTranslation();
  const { product, name, compareAtPrice, badges } = item;
  const productHref = getProductDetailPath(product);
  const primaryImageUrl = buildListingImageUrl(product.images?.[0]?.image_url);
  const isOutOfStock = product.stock_quantity === 0;

  const productKey = product.slug || product.id;
  const riskSummary = useProductRiskSummary(productKey, product.ingredients, i18n.language);

  const { addToCart, openMiniCart } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1);
    openMiniCart();
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onViewProduct();
  };

  return (
    <article
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[18px] border-0 bg-white shadow-[0_10px_25px_-18px_rgba(36,46,57,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_-20px_rgba(36,46,57,0.18)] dark:bg-card dark:shadow-[0_20px_40px_-28px_rgba(4,10,24,0.52)] dark:hover:shadow-[0_28px_56px_-34px_rgba(4,10,24,0.7)] sm:rounded-[20px] md:rounded-[24px]"
    >
      <a
        href={productHref}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onViewProduct();
        }}
        className="absolute inset-0 z-[1]"
        aria-label={`${t('products.view_product', 'Xem sản phẩm')}: ${name}`}
      >
        <span className="sr-only">{t('products.view_product', 'Xem sản phẩm')}: {name}</span>
      </a>

      <div className="relative overflow-hidden bg-[#faf9f6] dark:bg-accent">
        {/* Top left badges & wishlist */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 sm:left-2.5 sm:top-2.5 sm:gap-1.5 md:left-3 md:top-3">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onToggleWishlist(event);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm backdrop-blur-xs transition hover:bg-white hover:text-foreground dark:bg-[#0f1722]/85 dark:hover:bg-card sm:h-8 sm:w-8 md:h-9 md:w-9"
            aria-label={isWishlisted ? t('products.remove_from_wishlist', 'Remove from wishlist') : t('products.add_to_wishlist')}
            title={isWishlisted ? t('products.remove_from_wishlist', 'Xóa khỏi yêu thích') : t('products.add_to_wishlist', 'Yêu thích')}
          >
            <HeartIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${isWishlisted ? 'fill-current text-rose-500' : ''}`} />
          </button>

          {badges && badges.length > 0 ? (
            <div className="flex flex-col gap-1">
              {badges.slice(0, 2).map((badge, idx) => (
                <span
                  key={idx}
                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-xs sm:px-2 sm:text-[10px] ${
                    badge.tone === 'warning'
                      ? 'bg-rose-500 text-white'
                      : badge.tone === 'accent'
                        ? 'bg-amber-500 text-white'
                        : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Top right volume tag */}
        {product.volume ? (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm backdrop-blur-xs dark:bg-[#0f1722]/90 dark:text-white sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-xs md:right-3 md:top-3">
            {product.volume}
          </span>
        ) : null}

        {primaryImageUrl ? (
          <img
            loading="lazy"
            src={primaryImageUrl}
            alt={buildProductImageAlt({
              productName: name,
              brandName: product.brand,
              context: 'listing',
            })}
            className="aspect-[0.96/1] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex aspect-[0.96/1] w-full flex-col items-center justify-center gap-3 bg-muted/55 px-4 text-center text-muted-foreground">
            <ShoppingBagIcon className="h-8 w-8" />
            <span className="text-xs font-semibold">Chưa có ảnh sản phẩm</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 xs:p-3 sm:p-4 md:p-[18px]">
        {/* Brand */}
        <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-primary truncate sm:text-[10px] md:text-[11px]">
          {product.brand || item.categoryName || 'Thế Giới Trị Mụn'}
        </p>

        {/* Title */}
        <h3 className="mt-0.5 line-clamp-2 text-[12.5px] font-bold leading-[1.36] tracking-tight text-foreground transition group-hover:text-primary xs:text-[13.5px] sm:mt-1 sm:text-[15px] md:text-[16px] min-h-[2.7em]">
          {name}
        </h3>

        {/* Thanh thành phần (Compact Ingredient Bar with Hover Info) */}
        <ProductRiskBar summary={riskSummary} className="my-1.5 sm:my-2" />

        {/* Footer: GIÁ + Action buttons */}
        <div className="mt-auto pt-2 sm:pt-3.5">
          <div className="flex items-end justify-between gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px] md:text-[11px]">
                {t('products.price_kicker', 'GIÁ')}
              </p>
              {compareAtPrice && compareAtPrice > product.price ? (
                <p className="text-[9px] font-semibold text-muted-foreground line-through sm:text-[10px] md:text-[11px]">
                  {formatCurrency(compareAtPrice)}
                </p>
              ) : null}
              <p className="mt-0.5 truncate text-[13.5px] font-black leading-none tracking-[-0.03em] text-foreground xs:text-[14.5px] sm:text-[1.2rem] md:text-[1.32rem]">
                {formatCurrency(product.price)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {/* Quick View (Only on Desktop/Tablet to prevent crowding on small mobile screens) */}
              <button
                type="button"
                onClick={handleQuickView}
                className="relative z-10 hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200/90 bg-white text-muted-foreground shadow-xs transition hover:border-stone-400 hover:text-foreground dark:border-white/15 dark:bg-card dark:text-muted-foreground dark:hover:text-foreground md:h-9 md:w-9 lg:h-10 lg:w-10"
                aria-label={`${t('products.view_product', 'Xem sản phẩm')}: ${name}`}
                title={t('products.view_product', 'Xem sản phẩm')}
              >
                <EyeIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="relative z-10 inline-flex h-7.5 w-7.5 xs:h-8 xs:w-8 items-center justify-center rounded-full bg-[#1b7a6d] text-white shadow-xs transition hover:bg-[#15665b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#209283] dark:hover:bg-[#1a786c] sm:h-9 sm:w-9 md:h-10 md:w-10"
                aria-label={t('products.add_to_cart', 'Thêm vào giỏ hàng')}
                title={t('products.add_to_cart', 'Thêm vào giỏ hàng')}
              >
                <ShoppingBagIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

