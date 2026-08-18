import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from '../icons';
import ProductCard, { type ProductCardItem } from './ProductCard';

type EmptySuggestion = {
  id: string;
  label: string;
  onClick: () => void;
};

interface ProductGridProps {
  items: ProductCardItem[];
  formatCurrency: (amount: number) => string;
  isWishlisted: (productId: number) => boolean;
  onViewProduct: (item: ProductCardItem) => void;
  onToggleWishlist: (event: React.MouseEvent, item: ProductCardItem) => void;
  onClearFilters: () => void;
  emptySuggestions: EmptySuggestion[];
  isLoading?: boolean;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  items,
  formatCurrency,
  isWishlisted,
  onViewProduct,
  onToggleWishlist,
  onClearFilters,
  emptySuggestions,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`product-skeleton-${index}`} className="overflow-hidden rounded-[18px] border-0 bg-white shadow-[0_12px_26px_-22px_rgba(36,46,57,0.1)] dark:bg-card md:rounded-[28px]">
            <div className="aspect-[0.92/1] animate-pulse bg-[linear-gradient(135deg,rgba(53,183,165,0.12),rgba(255,127,93,0.1),rgba(255,255,255,1))] dark:bg-[linear-gradient(135deg,rgba(53,183,165,0.16),rgba(12,28,42,0.92),rgba(17,24,39,0.98))]" />
            <div className="space-y-3 p-4 md:p-5">
              <div className="h-3 w-16 animate-pulse rounded-full bg-accent/70" />
              <div className="h-6 w-full animate-pulse rounded-full bg-accent/70" />
              <div className="h-6 w-4/5 animate-pulse rounded-full bg-accent/70" />
              <div className="flex items-end justify-between gap-3 pt-2">
                <div className="space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded-full bg-accent/60" />
                  <div className="h-7 w-24 animate-pulse rounded-full bg-accent/70" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-full bg-accent/70" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-[30px] border border-border bg-[linear-gradient(135deg,#fff4eb_0%,#ffffff_48%,#f2fff8_100%)] px-6 py-12 text-center shadow-[0_24px_52px_-36px_rgba(36,46,57,0.16)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(13,23,34,1)_0%,rgba(15,26,38,1)_50%,rgba(12,35,37,1)_100%)] dark:shadow-[0_28px_58px_-34px_rgba(4,10,24,0.62)] md:px-10 md:py-16">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <SearchIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-foreground">{t('products.no_products')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          {t('products.no_products_hint', 'Hãy nới bớt bộ lọc hoặc mở sang một nhóm sản phẩm khác để quay lại nhịp duyệt nhanh.')}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/92"
          >
            {t('products.clear_filters')}
          </button>
          {emptySuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={suggestion.onClick}
              className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-card dark:hover:border-primary/40"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <ProductCard
          key={item.product.id}
          item={item}
          formatCurrency={formatCurrency}
          isWishlisted={isWishlisted(item.product.id)}
          onViewProduct={() => onViewProduct(item)}
          onToggleWishlist={(event) => onToggleWishlist(event, item)}
        />
      ))}
    </div>
  );
};

export default ProductGrid;
