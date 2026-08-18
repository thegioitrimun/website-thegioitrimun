import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductBrand, ProductCategory } from '../types';
import { ArrowRightIcon, EyeIcon, ShoppingBagIcon } from './icons';
import { upsertJsonLd, removeJsonLd } from '../src/seo';
import { splitBrandDescription } from '../src/brandUtils';

interface BrandLandingPageProps {
  brand: ProductBrand;
  products: Product[];
  categories: ProductCategory[];
  onSelectProduct: (id: number, categorySlug?: string) => void;
  onBrowseBrandProducts: () => void;
  onBrowseBrandCategory: (categorySlug: string) => void;
  onBack?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const buildSeoUrl = (path: string, lang: string) => {
  if (lang.startsWith('vi')) return `https://thegioitrimun.vn${path}`;
  return `https://thegioitrimun.vn${path}?lang=${encodeURIComponent(lang)}`;
};

const BrandLandingPage: React.FC<BrandLandingPageProps> = ({
  brand,
  products,
  categories,
  onSelectProduct,
  onBrowseBrandProducts,
  onBrowseBrandCategory,
}) => {
  const { i18n } = useTranslation();

  const labels = useMemo(() => {
    const lang = i18n.language;
    if (lang.startsWith('en')) {
      return {
        eyebrow: 'Brand spotlight',
        intro: `Explore authentic skincare products from ${brand.name} at Thế Giới Trị Mụn.`,
        fallbackDescription: `${brand.name} is one of the featured dermatology skincare brands at Thế Giới Trị Mụn. Browse the current product collection and specialized categories.`,
        browseAll: 'Browse all products',
        featuredProducts: 'Featured products',
        featuredProductsHint: 'Highlight products from this brand for quick comparison.',
        categoriesTitle: 'Product categories',
        categoriesHint: 'Filter products by category.',
        productCount: 'Products',
        categoryCount: 'Categories',
        logoLabel: 'Brand logo',
        viewProduct: 'View product',
        overviewTitle: 'About the brand',
        pharmacy: 'Pharmacy',
        priceRange: 'Price range',
        products: 'products',
      };
    }
    if (lang.startsWith('ru')) {
      return {
        eyebrow: 'Бренд в фокусе',
        intro: `Изучите товары бренда ${brand.name} в Thế Giới Trị Mụn.`,
        fallbackDescription: `${brand.name} — один из представленных брендов ухода за кожей в Thế Giới Trị Mụn.`,
        browseAll: 'Все товары бренда',
        featuredProducts: 'Популярные товары',
        featuredProductsHint: 'Подборка актуальных товаров этого бренда.',
        categoriesTitle: 'Категории',
        categoriesHint: 'Фильтрация по категориям.',
        productCount: 'Товаров',
        categoryCount: 'Категорий',
        logoLabel: 'Логотип бренда',
        viewProduct: 'Открыть товар',
        overviewTitle: 'О бренде',
        pharmacy: 'Аптека',
        priceRange: 'Диапазон цен',
        products: 'товаров',
      };
    }
    if (lang.startsWith('cn') || lang.startsWith('zh')) {
      return {
        eyebrow: '品牌专题',
        intro: `查看 Thế Giới Trị Mụn 上架的 ${brand.name} 品牌产品。`,
        fallbackDescription: `${brand.name} 是 Thế Giới Trị Mụn 精选的护肤品牌之一。`,
        browseAll: '查看全部产品',
        featuredProducts: '精选产品',
        featuredProductsHint: '该品牌重点推荐产品。',
        categoriesTitle: '产品分类',
        categoriesHint: '按分类筛选产品。',
        productCount: '件商品',
        categoryCount: '个分类',
        logoLabel: '品牌标志',
        viewProduct: '查看产品',
        overviewTitle: '品牌介绍',
        pharmacy: '药房',
        priceRange: '价格区间',
        products: '件商品',
      };
    }
    return {
      eyebrow: 'Thương hiệu đối tác',
      intro: `Khám phá các sản phẩm chính hãng của ${brand.name} tại Thế Giới Trị Mụn.`,
      fallbackDescription: `${brand.name} là một trong những thương hiệu dược mỹ phẩm uy tín tại Thế Giới Trị Mụn. Bạn có thể xem nhanh danh mục và các sản phẩm tiêu biểu của thương hiệu này.`,
      browseAll: 'Xem tất cả sản phẩm',
      featuredProducts: 'Sản phẩm nổi bật',
      featuredProductsHint: 'Những sản phẩm tiêu biểu của thương hiệu được nhiều khách hàng tin dùng.',
      categoriesTitle: 'Danh mục sản phẩm',
      categoriesHint: 'Xem nhanh các nhóm sản phẩm của thương hiệu.',
      productCount: 'Sản phẩm',
      categoryCount: 'Danh mục',
      logoLabel: 'Logo thương hiệu',
      viewProduct: 'Xem sản phẩm',
      overviewTitle: 'Giới thiệu thương hiệu',
      pharmacy: 'Sản phẩm',
      priceRange: 'Khung giá',
      products: 'sản phẩm',
    };
  }, [brand.name, i18n.language]);

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const allCategoryStats = useMemo(() => {
    const counts = new Map<number, number>();
    products.forEach((product) => {
      if (!product.category_id) return;
      counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([categoryId, count]) => ({
        category: categoryMap.get(categoryId),
        count,
      }))
      .filter((entry) => Boolean(entry.category))
      .sort((a, b) => b.count - a.count);
  }, [products, categoryMap]);
  const categoryStats = useMemo(() => allCategoryStats, [allCategoryStats]);

  const showcasedProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0) || b.id - a.id)
        .slice(0, 8),
    [products]
  );

  const brandDescription = (brand.description || '').trim() || labels.fallbackDescription;
  const descriptionParagraphs = useMemo(() => splitBrandDescription(brandDescription), [brandDescription]);
  const leadParagraph = descriptionParagraphs[0] || brandDescription;
  const priceBandSummary = useMemo(() => {
    if (products.length === 0) return null;
    const prices = products.map((product) => Number(product.price || 0)).filter((price) => Number.isFinite(price));
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  }, [products]);

  useEffect(() => {
    const canonicalPath = `/thuong-hieu/${brand.slug}`;
    const canonicalUrl = buildSeoUrl(canonicalPath, i18n.language);
    const itemList = showcasedProducts.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: buildSeoUrl(`/san-pham/${categoryMap.get(product.category_id || 0)?.slug || 'khac'}/${product.slug || product.id}`, i18n.language),
      name: product.name,
    }));

    upsertJsonLd('brand-landing-jsonld', [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: buildSeoUrl('/', i18n.language) },
          { '@type': 'ListItem', position: 2, name: labels.pharmacy, item: buildSeoUrl('/san-pham', i18n.language) },
          { '@type': 'ListItem', position: 3, name: brand.name, item: canonicalUrl },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: brand.name,
        description: brandDescription,
        url: canonicalUrl,
        about: {
          '@type': 'Brand',
          name: brand.name,
          logo: brand.logo_url || undefined,
          description: brandDescription,
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: itemList,
        },
      },
    ]);

    return () => removeJsonLd('brand-landing-jsonld');
  }, [brand.slug, brand.name, brand.logo_url, brandDescription, categoryMap, i18n.language, labels.pharmacy, showcasedProducts]);

  return (
    <div className="animate-scale-in min-h-screen bg-background pb-12 text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-10">

        {/* Hero Section - Apple Glass Aesthetic */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:rounded-[36px] dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] md:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#ff7f5d]/10 blur-3xl" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
            {/* Glass Brand Logo Frame */}
            <div className="flex items-center justify-center">
              <div className="flex h-44 w-44 sm:h-52 sm:w-52 items-center justify-center rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={`${labels.logoLabel}: ${brand.name}`}
                    className="max-h-full max-w-full object-contain"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <span className="font-hero-body text-4xl font-black tracking-widest text-primary">
                    {brand.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Brand Info */}
            <div>
              <p className="section-kicker">{labels.eyebrow}</p>
              <h1 className="mt-2 font-hero-body text-2xl font-black tracking-[-0.035em] text-foreground sm:text-3xl md:text-4xl">
                {brand.name}
              </h1>
              <p className="mt-2.5 max-w-2xl font-hero-body text-xs leading-relaxed text-muted-foreground sm:text-sm sm:leading-6">
                {leadParagraph}
              </p>

              {/* Stats Pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 font-hero-body text-xs font-bold text-foreground shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span>{products.length} {labels.productCount}</span>
                </div>
                {allCategoryStats.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 font-hero-body text-xs font-bold text-foreground shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                    <span>{allCategoryStats.length} {labels.categoryCount}</span>
                  </div>
                )}
                {priceBandSummary && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 font-hero-body text-xs font-bold text-foreground shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                    <span className="text-muted-foreground">{labels.priceRange}:</span>
                    <span>{priceBandSummary}</span>
                  </div>
                )}
              </div>

              {/* CTA Action */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onBrowseBrandProducts}
                  className="btn-press inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-hero-body text-xs font-bold text-primary-foreground shadow-[0_12px_24px_-10px_rgba(27,122,109,0.5)] transition hover:brightness-110 sm:text-sm"
                >
                  <span>{labels.browseAll}</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section - Apple Glass Pills */}
        {allCategoryStats.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-col gap-1 px-1">
              <p className="section-kicker">{labels.categoriesTitle}</p>
              <h2 className="font-hero-body text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {labels.categoriesTitle}
              </h2>
              <p className="text-xs text-muted-foreground">{labels.categoriesHint}</p>
            </div>

            <div className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
              {categoryStats.map(({ category, count }) =>
                category ? (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onBrowseBrandCategory(category.slug)}
                    className="btn-press inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 font-hero-body text-xs font-bold text-foreground shadow-xs backdrop-blur-xl transition hover:border-primary/40 hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <span>{category.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary dark:bg-primary/20">{count}</span>
                  </button>
                ) : null
              )}
            </div>
          </section>
        )}

        {/* Brand Overview (if multiple paragraphs) */}
        {descriptionParagraphs.length > 1 && (
          <section className="mt-8">
            <div className="px-1">
              <p className="section-kicker">{labels.overviewTitle}</p>
              <h2 className="mt-1 font-hero-body text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {labels.overviewTitle}
              </h2>
              <div className="mt-4 space-y-3 font-hero-body text-xs leading-relaxed text-muted-foreground sm:text-sm sm:leading-6">
                {descriptionParagraphs.map((paragraph, index) => (
                  <p key={`${brand.slug}-overview-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Products Section - Apple Glass Grid */}
        {showcasedProducts.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-kicker">{labels.featuredProducts}</p>
                <h2 className="mt-1 font-hero-body text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {labels.featuredProducts}
                </h2>
                <p className="text-xs text-muted-foreground">{labels.featuredProductsHint}</p>
              </div>
              <button
                type="button"
                onClick={onBrowseBrandProducts}
                className="btn-press inline-flex items-center gap-1 self-start font-hero-body text-xs font-bold text-primary hover:underline sm:self-auto"
              >
                <span>{labels.browseAll}</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {showcasedProducts.map((product) => {
                const categorySlug = categoryMap.get(product.category_id || 0)?.slug || product.category_slug;

                return (
                  <article
                    key={product.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/90 hover:shadow-[0_20px_48px_-24px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product.id, categorySlug)}
                      className="relative block aspect-[0.95/1] w-full overflow-hidden rounded-[18px] bg-white/60 text-left dark:bg-white/5"
                    >
                      {product.images?.[0]?.image_url ? (
                        <img
                          src={product.images[0].image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBagIcon className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {product.volume ? (
                        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/60 bg-white/80 px-2.5 py-0.5 font-hero-body text-[10px] font-black text-foreground shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-black/60">
                          {product.volume}
                        </span>
                      ) : null}
                    </button>

                    <div className="mt-3 flex flex-1 flex-col justify-between">
                      <div>
                        <p className="font-hero-body text-[10px] font-black uppercase tracking-[0.2em] text-primary">{brand.name}</p>
                        <h3
                          onClick={() => onSelectProduct(product.id, categorySlug)}
                          className="mt-1 line-clamp-2 cursor-pointer font-hero-body text-xs font-bold leading-snug text-foreground transition group-hover:text-primary sm:text-sm"
                        >
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                        <p className="font-hero-body text-sm font-black tracking-tight text-foreground sm:text-base">
                          {formatCurrency(product.price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product.id, categorySlug)}
                          className="btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/80 text-foreground transition hover:border-primary/40 hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/10"
                          aria-label={`${labels.viewProduct}: ${product.name}`}
                          title={labels.viewProduct}
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default BrandLandingPage;
