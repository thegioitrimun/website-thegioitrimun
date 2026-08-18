import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductBrand } from '../types';
import { ArrowRightIcon, SearchIcon } from './icons';
import { getBrandDescriptionSnippet, getBrandInitials, normalizeBrandMatchKey } from '../src/brandUtils';

interface BrandDirectoryPageProps {
  brands: ProductBrand[];
  products: Product[];
  onOpenBrand: (brandSlug: string) => void;
  onBrowseBrandProducts: (brandSlug: string) => void;
  onBack?: () => void;
}

type BrandFilterMode = 'all' | 'profile' | 'active';

const BrandDirectoryPage: React.FC<BrandDirectoryPageProps> = ({
  brands,
  products,
  onOpenBrand,
  onBrowseBrandProducts,
}) => {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<BrandFilterMode>('all');

  const labels = useMemo(() => {
    const lang = i18n.language;
    if (lang.startsWith('en')) {
      return {
        eyebrow: 'Brand directory',
        title: 'Authentic Skincare Brands',
        intro: 'Explore curated dermatology and clinical skincare brands at Thế Giới Trị Mụn.',
        totalBrands: 'brands',
        totalProducts: 'products',
        openProfile: 'Brand profile',
        browseProducts: 'View products',
        products: 'products',
        back: 'Back',
        searchPlaceholder: 'Search brand or product...',
        allFilter: 'All',
        profileFilter: 'With profile',
        activeFilter: 'Most stocked',
        noMatchTitle: 'No matching brand found',
        noMatchBody: 'Try a broader keyword or reset filters to see all brands.',
        reset: 'Reset filters',
      };
    }
    if (lang.startsWith('ru')) {
      return {
        eyebrow: 'Каталог брендов',
        title: 'Оригинальные бренды',
        intro: 'Каталог дерматологических брендов ухода за кожей в Thế Giới Trị Mụn.',
        totalBrands: 'брендов',
        totalProducts: 'товаров',
        openProfile: 'О бренде',
        browseProducts: 'Смотреть товары',
        products: 'товаров',
        back: 'Назад',
        searchPlaceholder: 'Поиск по бренду или товару...',
        allFilter: 'Все',
        profileFilter: 'С профилем',
        activeFilter: 'Больше товаров',
        noMatchTitle: 'Подходящий бренд не найден',
        noMatchBody: 'Попробуйте другой запрос или сбросьте фильтры.',
        reset: 'Сбросить фильтры',
      };
    }
    if (lang.startsWith('cn') || lang.startsWith('zh')) {
      return {
        eyebrow: '品牌目录',
        title: '正品护肤品牌',
        intro: '探索 Thế Giới Trị Mụn 精选的皮肤科与药妆品牌。',
        totalBrands: '个品牌',
        totalProducts: '件商品',
        openProfile: '品牌介绍',
        browseProducts: '查看产品',
        products: '件商品',
        back: '返回',
        searchPlaceholder: '搜索品牌或产品...',
        allFilter: '全部',
        profileFilter: '有简介',
        activeFilter: '商品较多',
        noMatchTitle: '未找到匹配品牌',
        noMatchBody: '可以尝试更宽泛的关键词，或重置筛选条件。',
        reset: '重置筛选',
      };
    }
    return {
      eyebrow: 'Danh mục thương hiệu',
      title: 'Thương hiệu dược mỹ phẩm',
      intro: 'Khám phá các thương hiệu da liễu và dược mỹ phẩm chính hãng được tuyển chọn tại Thế Giới Trị Mụn.',
      totalBrands: 'thương hiệu',
      totalProducts: 'sản phẩm',
      openProfile: 'Hồ sơ thương hiệu',
      browseProducts: 'Xem sản phẩm',
      products: 'sản phẩm',
      back: 'Quay lại',
      searchPlaceholder: 'Tìm tên thương hiệu hoặc sản phẩm...',
      allFilter: 'Tất cả',
      profileFilter: 'Có hồ sơ',
      activeFilter: 'Nhiều sản phẩm',
      noMatchTitle: 'Không tìm thấy thương hiệu',
      noMatchBody: 'Hãy thử từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ danh mục.',
      reset: 'Đặt lại bộ lọc',
    };
  }, [i18n.language]);

  const brandRows = useMemo(() => {
    const publishedProducts = products.filter((product) => product.is_published !== false);
    return brands
      .map((brand) => {
        const brandKey = normalizeBrandMatchKey(brand.name);
        const brandProducts = publishedProducts.filter((product) => normalizeBrandMatchKey(product.brand) === brandKey);
        return {
          ...brand,
          productCount: brandProducts.length,
          sampleProducts: brandProducts.slice(0, 2),
          snippet: getBrandDescriptionSnippet(brand.description, 140),
        };
      })
      .filter((brand) => brand.productCount > 0 || brand.logo_url || brand.description)
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, 'vi'));
  }, [brands, products]);

  const stats = useMemo(
    () => ({
      totalBrands: brandRows.length,
      totalProducts: brandRows.reduce((sum, brand) => sum + brand.productCount, 0),
    }),
    [brandRows]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredBrandRows = useMemo(() => {
    return brandRows.filter((brand) => {
      if (filterMode === 'profile' && !(brand.description || '').trim()) return false;
      if (filterMode === 'active' && brand.productCount < 3) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        brand.name,
        brand.description || '',
        brand.sampleProducts.map((product) => product.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [brandRows, filterMode, normalizedQuery]);

  const filterButtons: Array<{ key: BrandFilterMode; label: string }> = [
    { key: 'all', label: labels.allFilter },
    { key: 'profile', label: labels.profileFilter },
    { key: 'active', label: labels.activeFilter },
  ];

  return (
    <div className="animate-scale-in min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-10">
        {/* Hero Banner - Apple Glass Aesthetic */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:rounded-[36px] dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-primary/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-[#ff7f5d]/10 blur-3xl" />

          <div className="relative z-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="section-kicker">{labels.eyebrow}</p>
                <h1 className="mt-2.5 font-hero-body text-2xl font-black tracking-[-0.035em] text-foreground sm:text-3xl md:text-4xl">
                  {labels.title}
                </h1>
                <p className="mt-2 max-w-xl font-hero-body text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {labels.intro}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 font-hero-body text-xs font-bold text-foreground shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span>{stats.totalBrands} {labels.totalBrands}</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{stats.totalProducts} {labels.totalProducts}</span>
                </span>
              </div>
            </div>

            {/* Apple Glass Search & Segmented Filter Bar */}
            <div className="mt-6 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={labels.searchPlaceholder}
                  className="w-full rounded-full border border-white/60 bg-white/80 py-2.5 pl-11 pr-9 font-hero-body text-sm font-medium text-foreground placeholder:text-muted-foreground/70 shadow-xs backdrop-blur-xl transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/10"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-full border border-white/60 bg-white/60 p-1 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => setFilterMode(btn.key)}
                    className={`btn-press rounded-full px-4 py-1.5 font-hero-body text-xs font-bold transition-all duration-200 ${
                      filterMode === btn.key
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Brand Grid Section */}
        <section className="mt-8">
          {filteredBrandRows.length === 0 ? (
            <div className="rounded-[28px] border border-white/60 bg-white/70 px-6 py-12 text-center shadow-xs backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] md:px-10">
              <h2 className="font-hero-body text-xl font-bold text-foreground">{labels.noMatchTitle}</h2>
              <p className="mx-auto mt-2 max-w-md font-hero-body text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {labels.noMatchBody}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilterMode('all');
                }}
                className="btn-press mt-5 inline-flex items-center rounded-full bg-primary px-5 py-2.5 font-hero-body text-xs font-bold text-primary-foreground shadow-xs transition hover:brightness-110"
              >
                {labels.reset}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBrandRows.map((brand) => {
                const hasProfile = Boolean((brand.description || '').trim());

                return (
                  <article
                    key={brand.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/60 bg-white/70 p-5 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/90 hover:shadow-[0_20px_48px_-24px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.5)] dark:hover:border-primary/40 dark:hover:bg-white/10"
                  >
                    <div>
                      {/* Top Row: Logo & Product Count Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/60 bg-white/90 p-2 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                          {brand.logo_url ? (
                            <img
                              src={brand.logo_url}
                              alt={brand.name}
                              loading="lazy"
                              decoding="async"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="font-hero-body text-base font-black tracking-wider text-primary">
                              {getBrandInitials(brand.name)}
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-hero-body text-[11px] font-bold text-primary dark:bg-primary/20">
                          {brand.productCount} {labels.products}
                        </span>
                      </div>

                      {/* Brand Name */}
                      <h2 className="mt-3.5 line-clamp-1 font-hero-body text-base font-black tracking-[-0.02em] text-foreground transition group-hover:text-primary">
                        {brand.name}
                      </h2>

                      {/* Short Description Snippet */}
                      <p className="mt-1 line-clamp-2 font-hero-body text-xs leading-relaxed text-muted-foreground">
                        {brand.snippet || `${brand.name} — Thương hiệu dược mỹ phẩm uy tín tại Thế Giới Trị Mụn.`}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
                      <button
                        type="button"
                        onClick={() => onBrowseBrandProducts(brand.slug)}
                        className="btn-press flex flex-1 items-center justify-between rounded-full bg-primary/10 px-3.5 py-2 font-hero-body text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground dark:bg-primary/20 dark:hover:bg-primary dark:hover:text-primary-foreground"
                      >
                        <span>{labels.browseProducts}</span>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </button>

                      {hasProfile && (
                        <button
                          type="button"
                          onClick={() => onOpenBrand(brand.slug)}
                          className="btn-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/70 text-muted-foreground transition hover:border-primary/40 hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                          title={labels.openProfile}
                          aria-label={`${labels.openProfile}: ${brand.name}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.75}
                            stroke="currentColor"
                            className="h-4 w-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BrandDirectoryPage;
