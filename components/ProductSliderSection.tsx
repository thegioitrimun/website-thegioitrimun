import React from 'react';
import { useTranslation } from 'react-i18next';
import { Product } from '../types';
import { ArrowRightIcon, ShoppingBagIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { buildListingImageUrl, buildProductImageAlt } from '../src/imageSeo';
import { getProductDetailPath } from '../src/appRouting';
import { getLocalizedValue } from '../src/relatedContent';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

interface Props {
    kicker?: string;
    title: string;
    subtitle?: string;
    products: Product[];
    setView: (view: any) => void;
    handleAddToCart: (e: React.MouseEvent, product: Product) => void;
    viewAllLink?: string;
    viewAllText?: string;
    theme?: 'default' | 'muted';
    layout?: 'slider' | 'grid';
}

export const ProductSliderSection: React.FC<Props> = ({
    kicker = 'Skin pharmacy',
    title,
    subtitle,
    products,
    setView,
    handleAddToCart,
    viewAllLink,
    viewAllText,
    theme = 'default',
    layout = 'slider'
}) => {
    const { i18n } = useTranslation();
    const getLocalized = (obj: any, field: string): string => getLocalizedValue(obj, field, i18n.language);
    const mobileProducts = products.slice(0, 4);

    if (!products || products.length === 0) return null;

    const sectionClass = theme === 'muted' ? 'bg-[linear-gradient(180deg,hsl(var(--accent)/0.2),transparent_55%)]' : 'bg-transparent';

    const renderProductCard = (product: Product) => {
        const productHref = getProductDetailPath(product);
        const productName = getLocalized(product, 'name');
        const openProduct = (event?: React.MouseEvent) => {
            if (event) {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
            }
            setView({ page: 'productDetail', id: product.slug || product.id, categorySlug: product.category?.slug || product.category_slug });
        };

        return (
        <div className="editorial-card group relative flex h-full cursor-pointer flex-col overflow-hidden">
            <a
                href={productHref}
                onClick={openProduct}
                className="absolute inset-0 z-[1]"
                aria-label={`Xem chi tiết ${productName}`}
            >
                <span className="sr-only">Xem chi tiết {productName}</span>
            </a>
            <div className="relative aspect-square w-full overflow-hidden bg-white">
                <img
                    loading="lazy"
                    src={buildListingImageUrl(product.images?.[0]?.image_url) || 'https://placehold.co/400x400'}
                    alt={buildProductImageAlt({
                        productName,
                        brandName: product.brand,
                        context: 'listing',
                    })}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {product.sold_count && product.sold_count > 0 ? (
                    <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-sm md:text-[11px]">
                        Đã bán {product.sold_count >= 1000 ? `${(product.sold_count / 1000).toFixed(1)}k` : product.sold_count}
                    </div>
                ) : null}
            </div>
            <div className="flex flex-1 flex-col p-4 md:p-5">
                <div className="min-h-[28px]">
                    {product.brand && (
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary md:text-[11px]">{product.brand}</p>
                    )}
                </div>
                <h3 className="mt-1 flex-grow text-sm font-black leading-snug text-foreground transition-colors group-hover:text-primary md:text-[1.02rem]">
                    {productName}
                </h3>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Thế Giới Trị Mụn</p>
                        <p className="mt-1 text-base font-black text-foreground md:text-lg">{formatCurrency(product.price)}</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddToCart(e, product);
                        }}
                        className="action-icon-chip relative z-10 h-11 w-11 shrink-0 btn-press"
                        aria-label={`Thêm ${product.name} vào giỏ`}
                        title="Thêm vào giỏ"
                    >
                        <ShoppingBagIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
        );
    };

    return (
        <section className={`content-auto border-t border-border/70 px-4 py-12 md:px-6 md:py-20 ${sectionClass}`}>
            <div className="container mx-auto">
                <AnimatedSection className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-3xl">
                        <p className="section-kicker">{kicker}</p>
                        <h2 className="section-title mt-3">{title}</h2>
                        {subtitle && <p className="section-subtitle mt-3">{subtitle}</p>}
                    </div>
                    {viewAllLink && viewAllText && (
                        <button
                            onClick={() => setView({ page: viewAllLink })}
                            className="hidden items-center rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary md:inline-flex btn-press dark:border-white/10 dark:bg-card dark:hover:border-primary/40"
                        >
                            {viewAllText}
                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </button>
                    )}
                </AnimatedSection>

                {layout === 'slider' ? (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:hidden">
                            {mobileProducts.map((product, index) => (
                                <AnimatedSection
                                    key={product.id}
                                    className="h-full"
                                    stagger={index * 40}
                                >
                                    {renderProductCard(product)}
                                </AnimatedSection>
                            ))}
                        </div>
                        <div className="hidden -mx-4 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 md:flex md:mx-0 md:gap-6 md:px-0">
                            {products.map((product, index) => (
                                <AnimatedSection
                                    key={product.id}
                                    className="w-[260px] flex-shrink-0 snap-start md:w-[308px]"
                                    stagger={index * 50}
                                >
                                    {renderProductCard(product)}
                                </AnimatedSection>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:hidden">
                            {mobileProducts.map((product, index) => (
                                <AnimatedSection
                                    key={product.id}
                                    className="h-full"
                                    stagger={index * 40}
                                >
                                    {renderProductCard(product)}
                                </AnimatedSection>
                            ))}
                        </div>
                        <div className="hidden md:grid md:grid-cols-4 md:gap-6 lg:grid-cols-5">
                            {products.map((product, index) => (
                                <AnimatedSection
                                    key={product.id}
                                    className={`h-full ${index >= 8 ? 'hidden lg:block' : ''}`}
                                    stagger={index * 40}
                                >
                                    {renderProductCard(product)}
                                </AnimatedSection>
                            ))}
                        </div>
                    </>
                )}

                {viewAllLink && viewAllText && (
                    <div className="mt-4 text-center md:hidden">
                        <button
                            onClick={() => setView({ page: viewAllLink })}
                            className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary btn-press dark:border-white/10 dark:bg-card dark:hover:border-primary/40"
                        >
                            {viewAllText}
                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
};
