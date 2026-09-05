import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { Product, ProductCategory } from '../types';
import { CloseIcon, FilterIcon } from './icons';
import { useToast } from '../hooks/useToast';
import { useWishlist } from '../contexts/WishlistContext';
import Pagination from './Pagination';
import { normalizeBrandMatchKey } from '../src/brandUtils';
import BackIconButton from './BackIconButton';
import CategoryHeader from './product-listing/CategoryHeader';
import FilterSidebar, { type FilterOption } from './product-listing/FilterSidebar';
import MobileFilterBar from './product-listing/MobileFilterBar';
import { useBiDirectionalSticky } from '../hooks/useBiDirectionalSticky';
import ProductGrid from './product-listing/ProductGrid';
import SortControl, { type SortOption } from './product-listing/SortControl';
import type { ProductCardBadge, ProductCardItem } from './product-listing/ProductCard';
import { PRODUCTS_LISTING_PAGE_SIZE } from '../src/listingPageConfig';

interface ProductsPageProps {
  products: Product[];
  categories: ProductCategory[];
  initialCategorySlug?: string;
  initialBrandName?: string;
  initialSearchTerm?: string;
  hasFullCatalog?: boolean;
  isCatalogLoading?: boolean;
  catalogError?: string | null;
  onRetryCatalog?: () => void;
  onSelectProduct: (id: number, categorySlug?: string) => void;
  onBack: () => void;
}

type PriceFilterKey = 'all' | 'range1' | 'range2' | 'range3' | 'range4';
type SortOrder = 'default' | 'newest' | 'price-asc' | 'price-desc';
type QuickFilterKey = 'all' | 'in-stock' | 'trial' | 'bestseller';

const PRODUCTS_PER_PAGE = PRODUCTS_LISTING_PAGE_SIZE;
const TRIAL_REGEX = /(mau thu|sample|trial|mini|tester|travel size|size mini)/i;
const VOLUME_REGEX = /(\d+(?:[.,]\d+)?)\s?(ml|g|gr)/i;

const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const extractVolumeValue = (value?: string | null) => {
  const matched = String(value || '').match(VOLUME_REGEX);
  return matched ? Number(matched[1].replace(',', '.')) : null;
};

const getLocalizedField = (obj: any, field: string, language: string): string => {
  if (!obj) return '';
  if (language !== 'vi') {
    const localized = obj[`${field}_${language}`];
    if (localized) return localized;
  }
  return obj[field] || '';
};

const getLocalizedArrayField = (obj: any, field: string, language: string): string[] => {
  if (!obj) return [];
  if (language !== 'vi') {
    const localized = obj[`${field}_${language}`];
    if (Array.isArray(localized) && localized.length > 0) return localized;
  }
  return Array.isArray(obj[field]) ? obj[field] : [];
};

const isTrialProduct = (product: Product, language: string) => {
  const name = getLocalizedField(product, 'name', language);
  const description = getLocalizedField(product, 'description', language);
  const combined = normalizeText(`${name} ${description} ${product.volume || ''}`);
  if (TRIAL_REGEX.test(combined)) return true;
  const volume = extractVolumeValue(product.volume);
  return volume !== null && volume <= 15;
};

const getCompareAtPrice = (product: Product): number | null => {
  const rawComparePrice = (product as Product & { compare_at_price?: number; original_price?: number }).compare_at_price
    || (product as Product & { compare_at_price?: number; original_price?: number }).original_price;
  if (typeof rawComparePrice === 'number' && rawComparePrice > product.price) return rawComparePrice;
  return null;
};

const getProductNewness = (product: Product) => {
  const rawDate = (product as Product & { created_at?: string }).created_at;
  if (!rawDate) return 0;
  const diff = Date.now() - new Date(rawDate).getTime();
  return diff < 1000 * 60 * 60 * 24 * 45 ? 1 : 0;
};

const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  categories,
  initialCategorySlug,
  initialBrandName,
  initialSearchTerm,
  hasFullCatalog = true,
  isCatalogLoading = false,
  catalogError = null,
  onRetryCatalog,
  onSelectProduct,
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilterKey>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const sidebarRef = useBiDirectionalSticky(96, 96, 32) as React.RefObject<HTMLDivElement>;
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>('all');
  const [brandFilters, setBrandFilters] = useState<string[]>([]);
  const [skinTypeFilters, setSkinTypeFilters] = useState<string[]>([]);
  const [concernFilters, setConcernFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const { addToast } = useToast();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();

  const localized = useMemo(
    () => ({
      get: (obj: any, field: string) => getLocalizedField(obj, field, i18n.language),
      getArray: (obj: any, field: string) => getLocalizedArrayField(obj, field, i18n.language),
    }),
    [i18n.language]
  );

  const activeCategory = useMemo(
    () => (categoryFilter === 'all' ? null : categories.find((category) => category.id === categoryFilter) || null),
    [categories, categoryFilter]
  );

  const { categoryCounts, brandCounts, skinTypeCounts, concernCounts } = useMemo(() => {
    const nextCategoryCounts = new Map<number, number>();
    const nextBrandCounts = new Map<string, number>();
    const nextSkinTypeCounts = new Map<string, number>();
    const nextConcernCounts = new Map<string, number>();

    products.forEach((product) => {
      if (product.category_id) {
        nextCategoryCounts.set(product.category_id, (nextCategoryCounts.get(product.category_id) || 0) + 1);
      }

      if (product.brand) {
        nextBrandCounts.set(product.brand, (nextBrandCounts.get(product.brand) || 0) + 1);
      }

      (product.skin_types || []).forEach((skinType) => {
        nextSkinTypeCounts.set(skinType, (nextSkinTypeCounts.get(skinType) || 0) + 1);
      });

      localized.getArray(product, 'key_benefits').forEach((concern) => {
        nextConcernCounts.set(concern, (nextConcernCounts.get(concern) || 0) + 1);
      });
    });

    return {
      categoryCounts: nextCategoryCounts,
      brandCounts: nextBrandCounts,
      skinTypeCounts: nextSkinTypeCounts,
      concernCounts: nextConcernCounts,
    };
  }, [localized, products]);

  const allBrands = useMemo(() => Array.from(brandCounts.keys()).sort((a, b) => a.localeCompare(b)), [brandCounts]);
  const allSkinTypes = useMemo(() => Array.from(skinTypeCounts.keys()).sort((a, b) => a.localeCompare(b)), [skinTypeCounts]);
  const allConcerns = useMemo(() => Array.from(concernCounts.keys()).sort((a, b) => a.localeCompare(b)), [concernCounts]);

  useEffect(() => {
    if (!initialCategorySlug) {
      setCategoryFilter('all');
      return;
    }

    const category = categories.find((item) => item.slug === initialCategorySlug);
    setCategoryFilter(category ? category.id : 'all');
  }, [categories, initialCategorySlug]);

  useEffect(() => {
    if (!initialBrandName) {
      setBrandFilters([]);
      return;
    }

    const targetKey = normalizeBrandMatchKey(initialBrandName);
    const matchingBrand = allBrands.find((brand) => normalizeBrandMatchKey(brand) === targetKey);
    setBrandFilters(matchingBrand ? [matchingBrand] : []);
  }, [allBrands, initialBrandName]);

  useEffect(() => {
    setSearchTerm(initialSearchTerm || '');
  }, [initialSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [brandFilters, categoryFilter, concernFilters, deferredSearchTerm, priceFilter, quickFilter, skinTypeFilters, sortOrder]);

  useEffect(() => {
    if (!isMobileFiltersOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileFiltersOpen]);

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter(initialCategorySlug ? categoryFilter : 'all');
    setPriceFilter('all');
    setSortOrder('default');
    setQuickFilter('all');
    setBrandFilters(initialBrandName ? brandFilters.slice(0, 1) : []);
    setSkinTypeFilters([]);
    setConcernFilters([]);
  };

  const toggleMultiValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter((previous) => (previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]));
  };

  const filteredProducts = useMemo(() => {
    const queryTokens = normalizeText(deferredSearchTerm)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const processedProducts = products.filter((product) => {
      if (categoryFilter !== 'all' && product.category_id !== categoryFilter) return false;

      if (priceFilter !== 'all') {
        if (priceFilter === 'range1' && product.price >= 200000) return false;
        if (priceFilter === 'range2' && (product.price < 200000 || product.price > 500000)) return false;
        if (priceFilter === 'range3' && (product.price <= 500000 || product.price > 1000000)) return false;
        if (priceFilter === 'range4' && product.price <= 1000000) return false;
      }

      if (quickFilter === 'in-stock' && product.stock_quantity <= 0) return false;
      if (quickFilter === 'trial' && !isTrialProduct(product, i18n.language)) return false;
      if (quickFilter === 'bestseller' && !((product.sold_count || 0) >= 20 || product.is_featured)) return false;

      if (brandFilters.length > 0) {
        if (!product.brand) return false;
        const productBrandKey = normalizeBrandMatchKey(product.brand);
        if (!brandFilters.some((brand) => normalizeBrandMatchKey(brand) === productBrandKey)) return false;
      }

      if (skinTypeFilters.length > 0 && (!product.skin_types || !skinTypeFilters.some((skinType) => product.skin_types?.includes(skinType)))) {
        return false;
      }

      const localizedBenefits = localized.getArray(product, 'key_benefits');
      if (concernFilters.length > 0 && !concernFilters.some((concern) => localizedBenefits.includes(concern))) {
        return false;
      }

      if (queryTokens.length > 0) {
        const searchableText = normalizeText(
          [
            localized.get(product, 'name'),
            localized.get(product, 'description'),
            localized.get(product, 'ingredients'),
            localized.get(product, 'usage_instructions'),
            product.brand,
            product.sku,
            product.volume,
            product.origin,
            product.texture,
            ...(product.skin_types || []),
            ...localizedBenefits,
            product.category?.name,
          ].join(' ')
        );
        if (!queryTokens.every((token) => searchableText.includes(token))) return false;
      }

      return true;
    });

    processedProducts.sort((left, right) => {
      if (sortOrder === 'newest') {
        const leftTime = new Date(((left as Product & { created_at?: string }).created_at || left.id)).getTime();
        const rightTime = new Date(((right as Product & { created_at?: string }).created_at || right.id)).getTime();
        return rightTime - leftTime;
      }

      if (sortOrder === 'price-asc') return left.price - right.price;
      if (sortOrder === 'price-desc') return right.price - left.price;

      const rightScore =
        (right.is_featured ? 1000 : 0) +
        ((right.sold_count || 0) * 5) +
        (right.stock_quantity > 0 ? 25 : 0) +
        (isTrialProduct(right, i18n.language) ? 8 : 0) +
        getProductNewness(right);
      const leftScore =
        (left.is_featured ? 1000 : 0) +
        ((left.sold_count || 0) * 5) +
        (left.stock_quantity > 0 ? 25 : 0) +
        (isTrialProduct(left, i18n.language) ? 8 : 0) +
        getProductNewness(left);

      return rightScore - leftScore || right.id - left.id;
    });

    return processedProducts;
  }, [
    brandFilters,
    categoryFilter,
    concernFilters,
    deferredSearchTerm,
    i18n.language,
    localized,
    priceFilter,
    products,
    quickFilter,
    skinTypeFilters,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const pageTitle = useMemo(() => {
    if (activeCategory && initialBrandName) return `${localized.get(activeCategory, 'name')} • ${initialBrandName}`;
    if (activeCategory) return localized.get(activeCategory, 'name');
    if (brandFilters.length === 1) return brandFilters[0];
    if (deferredSearchTerm.trim()) return `Kết quả cho “${deferredSearchTerm.trim()}”`;
    return t('products.title');
  }, [activeCategory, brandFilters, deferredSearchTerm, initialBrandName, localized, t]);

  const pageDescription = useMemo(() => {
    if (activeCategory) {
      return localized.get(activeCategory, 'description') || 'Chọn nhanh theo thương hiệu, loại da và mức giá phù hợp.';
    }
    if (brandFilters.length === 1) {
      return `Các sản phẩm nổi bật của ${brandFilters[0]}.`;
    }
    if (deferredSearchTerm.trim()) {
      return 'Các sản phẩm phù hợp với từ khóa hiện tại.';
    }
    return t('products.subtitle');
  }, [activeCategory, brandFilters, deferredSearchTerm, localized, t]);

  const topCategoryChips = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          count: categoryCounts.get(category.id) || 0,
        }))
        .filter((entry) => entry.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 6)
        .map((entry) => ({
          id: `category-${entry.category.id}`,
          label: `${localized.get(entry.category, 'name')} (${entry.count})`,
          active: categoryFilter === entry.category.id,
          onClick: () => setCategoryFilter(entry.category.id),
        })),
    [categories, categoryCounts, categoryFilter, localized]
  );

  const quickFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('products.quick_filter_all', 'Tất cả') },
      { value: 'in-stock', label: t('products.quick_filter_in_stock', 'Còn hàng') },
      { value: 'trial', label: t('products.quick_filter_trial', 'Mẫu thử') },
      { value: 'bestseller', label: t('products.quick_filter_bestseller', 'Bán chạy') },
    ] satisfies Array<{ value: QuickFilterKey; label: string }>,
    [t]
  );

  const sortOptions = useMemo<SortOption[]>(
    () => [
      { value: 'default', label: t('products.sort_default', 'Sắp xếp: Phổ biến') },
      { value: 'newest', label: t('products.sort_newest', 'Mới nhất') },
      { value: 'price-asc', label: t('products.sort_price_asc', 'Giá: Thấp đến cao') },
      { value: 'price-desc', label: t('products.sort_price_desc', 'Giá: Cao đến thấp') },
    ],
    [t]
  );

  const priceOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'all', label: t('products.all_price', 'Tất cả mức giá'), count: products.length },
      { value: 'range1', label: t('products.price_under_200k', 'Dưới 200.000đ'), count: products.filter((product) => product.price < 200000).length },
      {
        value: 'range2',
        label: t('products.price_200k_500k', '200.000đ đến 500.000đ'),
        count: products.filter((product) => product.price >= 200000 && product.price <= 500000).length,
      },
      {
        value: 'range3',
        label: t('products.price_500k_1m', '500.000đ đến 1.000.000đ'),
        count: products.filter((product) => product.price > 500000 && product.price <= 1000000).length,
      },
      { value: 'range4', label: t('products.price_over_1m', 'Trên 1.000.000đ'), count: products.filter((product) => product.price > 1000000).length },
    ],
    [products, t]
  );

  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'all', label: t('products.all_products'), count: products.length },
      ...categories.map((category) => ({
        value: category.id,
        label: localized.get(category, 'name'),
        count: categoryCounts.get(category.id) || 0,
      })),
    ],
    [categories, categoryCounts, localized, products.length, t]
  );

  const brandOptions = useMemo<FilterOption[]>(
    () => allBrands.map((brand) => ({ value: brand, label: brand, count: brandCounts.get(brand) || 0 })),
    [allBrands, brandCounts]
  );

  const skinTypeOptions = useMemo<FilterOption[]>(
    () => allSkinTypes.map((skinType) => ({ value: skinType, label: skinType, count: skinTypeCounts.get(skinType) || 0 })),
    [allSkinTypes, skinTypeCounts]
  );

  const concernOptions = useMemo<FilterOption[]>(
    () => allConcerns.map((concern) => ({ value: concern, label: concern, count: concernCounts.get(concern) || 0 })),
    [allConcerns, concernCounts]
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (categoryFilter !== 'all' && activeCategory) {
      chips.push({
        id: `active-category-${activeCategory.id}`,
        label: localized.get(activeCategory, 'name'),
        onRemove: () => setCategoryFilter('all'),
      });
    }

    if (quickFilter !== 'all') {
      const label = quickFilterOptions.find((option) => option.value === quickFilter)?.label || quickFilter;
      chips.push({
        id: `quick-${quickFilter}`,
        label,
        onRemove: () => setQuickFilter('all'),
      });
    }

    if (priceFilter !== 'all') {
      const label = priceOptions.find((option) => option.value === priceFilter)?.label || priceFilter;
      chips.push({
        id: `price-${priceFilter}`,
        label,
        onRemove: () => setPriceFilter('all'),
      });
    }

    brandFilters.forEach((brand) => {
      chips.push({
        id: `brand-${brand}`,
        label: brand,
        onRemove: () => toggleMultiValue(setBrandFilters, brand),
      });
    });

    skinTypeFilters.forEach((skinType) => {
      chips.push({
        id: `skin-${skinType}`,
        label: skinType,
        onRemove: () => toggleMultiValue(setSkinTypeFilters, skinType),
      });
    });

    concernFilters.forEach((concern) => {
      chips.push({
        id: `concern-${concern}`,
        label: concern,
        onRemove: () => toggleMultiValue(setConcernFilters, concern),
      });
    });

    if (searchTerm.trim()) {
      chips.push({
        id: 'search-term',
        label: `“${searchTerm.trim()}”`,
        onRemove: () => setSearchTerm(''),
      });
    }

    return chips;
  }, [
    activeCategory,
    brandFilters,
    categoryFilter,
    concernFilters,
    localized,
    priceFilter,
    priceOptions,
    quickFilter,
    quickFilterOptions,
    searchTerm,
    skinTypeFilters,
  ]);

  const activeFilterCount = activeFilterChips.length;

  const listingItems = useMemo<ProductCardItem[]>(() => {
    return paginatedProducts.map((product) => {
      const name = localized.get(product, 'name');
      const benefits = localized.getArray(product, 'key_benefits');
      const compareAtPrice = getCompareAtPrice(product);
      const categoryName = product.category ? localized.get(product.category, 'name') : undefined;
      const meta: string[] = [];

      if (product.skin_types?.[0]) meta.push(product.skin_types[0]);
      if (product.texture) meta.push(product.texture);
      if (!product.texture && product.origin) meta.push(product.origin);

      const badges: ProductCardBadge[] = [];
      if (isTrialProduct(product, i18n.language)) badges.push({ label: t('products.badge_trial', 'Mẫu thử'), tone: 'primary' });
      if ((product.sold_count || 0) >= 20) badges.push({ label: t('products.badge_bestseller', 'Bán chạy'), tone: 'accent' });
      if (getProductNewness(product) > 0) badges.push({ label: t('products.badge_new', 'Mới'), tone: 'neutral' });
      if (product.stock_quantity > 0 && product.stock_quantity <= (product.low_stock_threshold || 5)) {
        badges.push({ label: t('products.badge_low_stock', 'Sắp hết'), tone: 'warning' });
      }
      if (compareAtPrice && compareAtPrice > product.price) {
        const discount = Math.round(((compareAtPrice - product.price) / compareAtPrice) * 100);
        badges.unshift({ label: `-${discount}%`, tone: 'warning' });
      }

        return {
          product,
          name,
          primaryBenefit:
            benefits[0] ||
          t('products.card_default_benefit', 'Công thức chăm sóc da hướng tới hiệu quả ổn định và dễ đưa vào routine hằng ngày.'),
          categoryName,
          compareAtPrice,
          badges,
        meta,
      };
    });
  }, [i18n.language, localized, paginatedProducts, t]);

  const resultsStart = filteredProducts.length === 0 ? 0 : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const resultsEnd = Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  const emptySuggestions = useMemo(
    () =>
      categories
        .filter((category) => (categoryCounts.get(category.id) || 0) > 0)
        .sort((left, right) => (categoryCounts.get(right.id) || 0) - (categoryCounts.get(left.id) || 0))
        .slice(0, 3)
        .map((category) => ({
          id: `empty-${category.id}`,
          label: localized.get(category, 'name'),
          onClick: () => setCategoryFilter(category.id),
        })),
    [categories, categoryCounts, localized]
  );

  const handleWishlistToggle = (event: React.MouseEvent, item: ProductCardItem) => {
    event.stopPropagation();
    if (isWishlisted(item.product.id)) {
      removeFromWishlist(item.product.id);
      addToast(t('products.removed_from_wishlist'), { type: 'info' });
      return;
    }

    addToWishlist(item.product);
    addToast(t('products.added_to_wishlist'), { type: 'success' });
  };

  const openProduct = (item: ProductCardItem) => {
    onSelectProduct(item.product.id, item.product.category?.slug || item.product.category_slug);
  };

  if (!hasFullCatalog) {
    return (
      <div className="bg-background text-foreground transition-colors duration-300">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          <CategoryHeader
            eyebrow={t('products.listing_eyebrow', 'Skin pharmacy')}
            title={t('products.title')}
            categoryChips={[]}
          />

          <main className="mt-6 md:mt-8">
            {catalogError && !isCatalogLoading ? (
              <section className="rounded-[24px] border border-rose-200 bg-white px-6 py-10 text-center shadow-sm dark:border-rose-400/20 dark:bg-card md:px-10 md:py-14">
                <h2 className="text-xl font-black text-foreground md:text-2xl">Không thể tải danh sách sản phẩm thật</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Dữ liệu mẫu không được sử dụng. Vui lòng tải lại catalog từ máy chủ.
                </p>
                {onRetryCatalog ? (
                  <button
                    type="button"
                    onClick={onRetryCatalog}
                    className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                  >
                    Thử tải lại
                  </button>
                ) : null}
              </section>
            ) : (
              <ProductGrid
                items={[]}
                formatCurrency={formatCurrency}
                isWishlisted={() => false}
                onViewProduct={() => undefined}
                onToggleWishlist={() => undefined}
                onClearFilters={() => undefined}
                emptySuggestions={[]}
                isLoading
              />
            )}
          </main>
        </div>
      </div>
    );
  }

  const mobileFiltersModal =
    isMobileFiltersOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100]"
            aria-labelledby="mobile-filters-title"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop with frosted blur */}
            <div
              className="absolute inset-0 bg-black/35 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
              onClick={() => setIsMobileFiltersOpen(false)}
            />

            {/* Apple Frosted Glass Bottom Sheet */}
            <div className="fixed inset-x-0 bottom-0 z-[101] max-h-[88vh] flex flex-col overflow-hidden rounded-t-[32px] border-t border-white/65 bg-[rgba(255,255,255,0.68)] shadow-[0_-24px_70px_-20px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/15 dark:bg-[rgba(15,23,34,0.72)] dark:shadow-[0_-24px_70px_-20px_rgba(0,0,0,0.75)] sheet-slide-up sm:max-w-xl sm:mx-auto">
              
              {/* Ambient Glow Bubbles (Matching Navbar) */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[32px]">
                <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-[#ff7f5d]/15 blur-3xl"></div>
                <div className="absolute -right-10 top-10 h-40 w-40 rounded-full bg-[#35b7a5]/15 blur-3xl dark:bg-[#35b7a5]/18"></div>
              </div>

              {/* Apple Grabber Handle */}
              <div className="relative z-10 mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-foreground/20"></div>

              {/* Header (Styled identically to Apple Navbar) */}
              <div className="relative z-10 flex items-center justify-between border-b border-white/45 px-5 py-3 sm:px-6 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-white/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.85),rgba(255,237,226,0.5))] shadow-xs backdrop-blur-md dark:border-white/15 dark:bg-[linear-gradient(145deg,rgba(19,29,42,0.85),rgba(16,39,46,0.6))]">
                    <FilterIcon className="h-5 w-5 text-primary" />
                  </span>
                  <div className="leading-tight">
                    <h2 id="mobile-filters-title" className="text-base font-bold text-foreground">
                      {t('products.filter_and_sort', 'Bộ lọc & Sắp xếp')}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {filteredProducts.length} sản phẩm phù hợp
                      {activeFilterCount > 0 && ` • ${activeFilterCount} đang chọn`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/50 text-muted-foreground backdrop-blur-md transition hover:bg-white hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/15"
                  aria-label="Đóng bộ lọc"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Filters Content */}
              <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:px-6 no-scrollbar">
                {/* Sort Options Section in Frosted Glass Card */}
                <div className="rounded-[22px] border border-white/50 bg-white/40 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
                  <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                    {t('products.sort_label', 'Sắp xếp theo')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {sortOptions.map((option) => {
                      const isActive = sortOrder === option.value;
                      return (
                        <button
                          key={`modal-sort-${option.value}`}
                          type="button"
                          onClick={() => setSortOrder(option.value as SortOrder)}
                          className={`rounded-full px-4 py-2.5 text-xs font-bold transition text-left backdrop-blur-md ${
                            isActive
                              ? 'border border-primary/40 bg-primary/20 text-primary shadow-xs dark:bg-primary/30 dark:border-primary/50'
                              : 'border border-white/60 bg-white/60 text-foreground hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15'
                          }`}
                        >
                          {option.label.replace('Sắp xếp: ', '')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FilterSidebar inside Apple Frosted Container */}
                <div className="rounded-[22px] border border-white/50 bg-white/40 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
                  <FilterSidebar
                    activeFilterCount={activeFilterCount}
                    selectedCategory={categoryFilter}
                    onSelectCategory={setCategoryFilter}
                    categoryOptions={categoryOptions}
                    selectedPrice={priceFilter}
                    onSelectPrice={(value) => setPriceFilter(value as PriceFilterKey)}
                    priceOptions={priceOptions}
                    selectedBrands={brandFilters}
                    onToggleBrand={(value) => toggleMultiValue(setBrandFilters, value)}
                    brandOptions={brandOptions}
                    selectedSkinTypes={skinTypeFilters}
                    onToggleSkinType={(value) => toggleMultiValue(setSkinTypeFilters, value)}
                    skinTypeOptions={skinTypeOptions}
                    selectedConcerns={concernFilters}
                    onToggleConcern={(value) => toggleMultiValue(setConcernFilters, value)}
                    concernOptions={concernOptions}
                    onClearFilters={clearFilters}
                    mode="mobile"
                  />
                </div>
              </div>

              {/* Pinned Glass Footer Bar */}
              <div className="relative z-10 border-t border-white/45 bg-[rgba(255,255,255,0.60)] p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,34,0.70)] sm:p-5">
                <div className="flex items-center gap-3">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="flex-1 rounded-full border border-white/60 bg-white/70 py-3 text-sm font-bold text-foreground backdrop-blur-md shadow-xs transition hover:bg-white active:scale-95 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20 btn-press"
                    >
                      {t('filters.clear_all', 'Xóa hết')} ({activeFilterCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="flex-1 rounded-full bg-[linear-gradient(135deg,#1b7a6d_0%,#2bb19f_100%)] py-3 text-sm font-bold text-white shadow-[0_12px_28px_-6px_rgba(27,122,109,0.5)] transition hover:brightness-105 active:scale-95 btn-press"
                  >
                    Xem {filteredProducts.length} sản phẩm
                  </button>
                </div>
              </div>

            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="animate-page-enter bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">

        <CategoryHeader
          eyebrow={t('products.listing_eyebrow', 'Skin pharmacy')}
          title={pageTitle}

          categoryChips={topCategoryChips}
        />

        <MobileFilterBar
          activeFilterCount={activeFilterCount}
          sortValue={sortOrder}
          sortOptions={sortOptions}
          onSortChange={(value) => setSortOrder(value as SortOrder)}
          onOpenFilters={() => setIsMobileFiltersOpen(true)}
        />

        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
          <aside className="hidden lg:block">
            <div ref={sidebarRef} className="sticky lg:self-start" style={{ top: '6rem' }}>
              <FilterSidebar
                activeFilterCount={activeFilterCount}
                selectedCategory={categoryFilter}
                onSelectCategory={setCategoryFilter}
                categoryOptions={categoryOptions}
                selectedPrice={priceFilter}
                onSelectPrice={(value) => setPriceFilter(value as PriceFilterKey)}
                priceOptions={priceOptions}
                selectedBrands={brandFilters}
                onToggleBrand={(value) => toggleMultiValue(setBrandFilters, value)}
                brandOptions={brandOptions}
                selectedSkinTypes={skinTypeFilters}
                onToggleSkinType={(value) => toggleMultiValue(setSkinTypeFilters, value)}
                skinTypeOptions={skinTypeOptions}
                selectedConcerns={concernFilters}
                onToggleConcern={(value) => toggleMultiValue(setConcernFilters, value)}
                concernOptions={concernOptions}
                onClearFilters={clearFilters}
              />
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-5 hidden md:block">
              <div className="rounded-[22px] border-0 bg-white/94 px-4 py-3 shadow-[0_14px_28px_-26px_rgba(36,46,57,0.12)] backdrop-blur dark:bg-[#0f1722]/94 dark:shadow-[0_18px_36px_-24px_rgba(4,10,24,0.6)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm font-semibold tracking-[-0.01em] text-foreground md:text-[15px]">
                    {filteredProducts.length > 0
                      ? `Hiển thị ${resultsStart}-${resultsEnd} trên ${filteredProducts.length} sản phẩm`
                      : 'Chưa có kết quả phù hợp'}
                  </p>
                  <div className="flex items-center gap-3 lg:min-w-[260px]">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-full border-0 bg-muted/60 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary dark:bg-accent/60"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <SortControl
                        label={t('products.sort_label', 'Sắp xếp')}
                        value={sortOrder}
                        options={sortOptions}
                        onChange={(value) => setSortOrder(value as SortOrder)}
                      />
                    </div>
                  </div>
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={chip.onRemove}
                        className="inline-flex items-center gap-2 rounded-full border-0 bg-muted/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/15 hover:text-primary dark:bg-accent"
                      >
                        <span>{chip.label}</span>
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>



            <ProductGrid
              items={listingItems}
              formatCurrency={formatCurrency}
              isWishlisted={isWishlisted}
              onViewProduct={openProduct}
              onToggleWishlist={handleWishlistToggle}
              onClearFilters={clearFilters}
              emptySuggestions={emptySuggestions}
            />

            {filteredProducts.length > 0 && (
              <div className="mt-6 md:mt-8">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </main>
        </div>

        {mobileFiltersModal}
      </div>
    </div>
  );
};

export default ProductsPage;
