import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, Service, View, BlogPost } from '../types';
import { SearchIcon, CloseIcon } from './icons';
import * as api from '../services/api';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface FullScreenSearchProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    services: Service[];
    blogPosts: BlogPost[];
    hasFullProductCatalog?: boolean;
    isProductCatalogLoading?: boolean;
    onNavigate: (view: View) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const normalizeSearchText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();


const FullScreenSearch: React.FC<FullScreenSearchProps> = ({
    isOpen,
    onClose,
    products,
    services,
    blogPosts,
    hasFullProductCatalog = true,
    isProductCatalogLoading = false,
    onNavigate,
}) => {
    const { t, i18n } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCatalog, setSearchCatalog] = useState<Product[]>([]);
    const [isSearchCatalogLoading, setIsSearchCatalogLoading] = useState(false);
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const inputRef = useRef<HTMLInputElement>(null);
    const isMobile = useMediaQuery('(max-width: 768px)');

    const getLocalized = (obj: any, field: string): string => {
        if (!obj) return '';
        const lang = i18n.language;
        if (lang !== 'vi') {
            const v = obj[`${field}_${lang}`];
            if (v) return v;
        }
        return obj[field] || '';
    };

    const [isRendered, setIsRendered] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            document.body.style.overflow = 'hidden';
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            const timer = setTimeout(() => {
                setIsRendered(false);
                document.body.style.overflow = '';
                setSearchTerm('');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Cleanup on completely unmount
    useEffect(() => {
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        if (!isOpen || hasFullProductCatalog || searchCatalog.length > 0) return;

        let isActive = true;
        setIsSearchCatalogLoading(true);
        void api.getProductSearchCatalog()
            .then((catalog) => {
                if (isActive) setSearchCatalog(catalog);
            })
            .finally(() => {
                if (isActive) setIsSearchCatalogLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [hasFullProductCatalog, isOpen, searchCatalog.length]);

    const searchableProducts = hasFullProductCatalog
        ? products
        : searchCatalog.length > 0
            ? searchCatalog
            : products;

    const productSearchIndex = useMemo(() => searchableProducts.map((product) => ({
        item: product,
        text: normalizeSearchText([
            getLocalized(product, 'name'),
            getLocalized(product, 'description'),
            product.brand || '',
            product.category?.name || '',
            ...(product.key_benefits || []),
            ...(product.skin_types || []),
        ].join(' ')),
    })), [searchableProducts, i18n.language]);

    const serviceSearchIndex = useMemo(() => services.map((service) => ({
        item: service,
        text: normalizeSearchText([
            getLocalized(service, 'name'),
            getLocalized(service, 'description'),
            ...(service.benefits || []),
        ].join(' ')),
    })), [services, i18n.language]);

    const blogSearchIndex = useMemo(() => blogPosts.map((post) => ({
        item: post,
        text: normalizeSearchText([
            getLocalized(post, 'title'),
            getLocalized(post, 'summary'),
            post.category_slug || '',
        ].join(' ')),
    })), [blogPosts, i18n.language]);

    const searchResults = useMemo(() => {
        const normalizedSearchTerm = normalizeSearchText(deferredSearchTerm.trim());
        if (!normalizedSearchTerm) {
            return { products: [], services: [], blogPosts: [] };
        }
        const searchTokens = normalizedSearchTerm
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);

        const filteredProducts = productSearchIndex
            .filter(({ text }) => searchTokens.every((token) => text.includes(token)))
            .map(({ item }) => item);

        const filteredServices = serviceSearchIndex
            .filter(({ text }) => searchTokens.every((token) => text.includes(token)))
            .slice(0, 3)
            .map(({ item }) => item);

        const filteredBlogPosts = blogSearchIndex
            .filter(({ text }) => searchTokens.every((token) => text.includes(token)))
            .slice(0, 4)
            .map(({ item }) => item);

        return { products: filteredProducts, services: filteredServices, blogPosts: filteredBlogPosts };
    }, [blogSearchIndex, deferredSearchTerm, productSearchIndex, serviceSearchIndex]);

    const visibleProducts = useMemo(
        () => searchResults.products.slice(0, isMobile ? 8 : 12),
        [isMobile, searchResults.products],
    );

    const topBrandSuggestions = useMemo(() => {
        const counts = new Map<string, number>();
        searchResults.products.forEach((product) => {
            if (!product.brand) return;
            counts.set(product.brand, (counts.get(product.brand) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 4);
    }, [searchResults.products]);

    const topConcernSuggestions = useMemo(() => {
        const counts = new Map<string, number>();
        searchResults.products.forEach((product) => {
            (product.key_benefits || []).forEach((benefit) => {
                counts.set(benefit, (counts.get(benefit) || 0) + 1);
            });
        });
        return Array.from(counts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 4);
    }, [searchResults.products]);

    const handleNavigate = (view: View) => {
        onNavigate(view);
        onClose();
    };

    const resultSummary = isMobile
        ? [
            { key: 'products', label: t('nav.products').toLowerCase(), count: searchResults.products.length },
            { key: 'blogPosts', label: t('nav.blog').toLowerCase(), count: searchResults.blogPosts.length },
            { key: 'services', label: t('nav.services').toLowerCase(), count: searchResults.services.length },
        ]
        : [
            { key: 'products', label: t('nav.products').toLowerCase(), count: searchResults.products.length },
            { key: 'services', label: t('nav.services').toLowerCase(), count: searchResults.services.length },
            { key: 'blogPosts', label: t('nav.blog').toLowerCase(), count: searchResults.blogPosts.length },
        ];

    const resultSectionOrder = isMobile
        ? ['products', 'blogPosts', 'services'] as const
        : ['products', 'services', 'blogPosts'] as const;

    const renderResultSection = (section: typeof resultSectionOrder[number]) => {
        if (section === 'products' && searchResults.products.length > 0) {
            const shouldScrollProducts = searchResults.products.length > 6;
            return (
                <div key="products" className="mb-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground">{t('nav.products')}</h2>
                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-primary">
                            {t('search.product_results_count', {
                                count: searchResults.products.length,
                                defaultValue: `${searchResults.products.length} sản phẩm`,
                            })}
                        </span>
                    </div>
                    <ul className={`space-y-2 ${shouldScrollProducts ? 'max-h-[52vh] overflow-y-auto overscroll-contain pr-1 md:max-h-[58vh] [-webkit-overflow-scrolling:touch]' : ''}`}>
                        {visibleProducts.map(p => (
                            <li key={`prod-${p.id}`}>
                                <button onClick={() => handleNavigate({ page: 'productDetail', id: p.slug || p.id, categorySlug: p.category?.slug || p.category_slug })} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-accent text-left">
                                    <img src={p.images?.[0]?.image_url} alt={getLocalized(p, 'name')} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                                    <div className="flex-grow">
                                        <p className="font-semibold">{getLocalized(p, 'name')}</p>
                                        <p className="text-sm text-primary">{formatCurrency(p.price)}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {searchResults.products.length > visibleProducts.length ? (
                        <button
                            type="button"
                            onClick={() => handleNavigate({ page: 'products', searchQuery: searchTerm.trim() })}
                            className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/5"
                        >
                            {t('search.view_all_product_results', {
                                count: searchResults.products.length,
                                defaultValue: `Xem tất cả ${searchResults.products.length} sản phẩm`,
                            })}
                        </button>
                    ) : shouldScrollProducts ? (
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                            {t('search.scroll_for_more_products', 'Cuộn trong danh sách để xem thêm sản phẩm phù hợp.')}
                        </p>
                    ) : null}
                </div>
            );
        }

        if (section === 'blogPosts' && searchResults.blogPosts.length > 0) {
            return (
                <div key="blogPosts" className="mb-6">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">{t('nav.blog')}</h2>
                    <ul className="space-y-2">
                        {searchResults.blogPosts.map(p => (
                            <li key={`post-${p.slug}`}>
                                <button onClick={() => handleNavigate({ page: 'blogDetail', slug: p.slug, categorySlug: p.category_slug })} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-accent text-left">
                                    <img src={p.image_url} alt={getLocalized(p, 'title')} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                                    <div className="flex-grow">
                                        <p className="font-semibold">{getLocalized(p, 'title')}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{getLocalized(p, 'summary')}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }

        if (section === 'services' && searchResults.services.length > 0) {
            return (
                <div key="services" className="mb-6">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">{t('nav.services')}</h2>
                    <ul className="space-y-2">
                        {searchResults.services.map(s => (
                            <li key={`serv-${s.id}`}>
                                <button onClick={() => handleNavigate({ page: 'serviceDetail', id: s.id })} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-accent text-left">
                                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary">{api.getIcon(s.icon, { className: 'w-6 h-6' })}</div>
                                    <div className="flex-grow">
                                        <p className="font-semibold">{getLocalized(s, 'name')}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{getLocalized(s, 'description')}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }

        return null;
    };

    if (!isRendered) return null;

    return (
        <div className={`fixed inset-0 z-[100] bg-transparent ${isOpen ? 'drawer-overlay-enter' : 'drawer-overlay-exit'}`} role="dialog" aria-modal="true">
            <div className={`absolute inset-0 bg-background/95`} onClick={onClose}></div>
            <div className={`container relative z-10 mx-auto px-4 h-full flex flex-col ${isOpen ? 'search-slide-in' : 'search-slide-out'}`}>
                {/* Header */}
                <header className="flex-shrink-0 flex items-center justify-between py-4">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('common.search_placeholder')}
                            className="w-full bg-transparent border-0 pl-12 pr-4 py-3 text-lg focus:ring-0"
                        />
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>

                {/* Results */}
                <div className="flex-grow overflow-y-auto pb-8">
                    {searchTerm.trim() ? (
                        <div>
                            {!isMobile && (
                                <>
                                    <div className="mb-6 rounded-2xl border border-border bg-card px-4 py-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('search.quick_overview', 'Tổng quan nhanh')}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {resultSummary.map((entry) => (
                                                <span key={entry.key} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground dark:border-white/10 dark:bg-card">
                                                    {entry.count} {entry.label}
                                                </span>
                                            ))}
                                        </div>

                                        {(topBrandSuggestions.length > 0 || topConcernSuggestions.length > 0) && (
                                            <div className="mt-4 space-y-3">
                                                {topBrandSuggestions.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('search.trending_brands', 'Thương hiệu đang nổi lên')}</p>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {topBrandSuggestions.map((brand) => (
                                                                <button
                                                                    key={brand.name}
                                                                    type="button"
                                                                    onClick={() => setSearchTerm(brand.name)}
                                                                    className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary dark:border-white/10 dark:bg-card"
                                                                >
                                                                    {brand.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {topConcernSuggestions.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('search.related_concerns', 'Vấn đề da liên quan')}</p>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {topConcernSuggestions.map((concern) => (
                                                                <button
                                                                    key={concern.name}
                                                                    type="button"
                                                                    onClick={() => setSearchTerm(concern.name)}
                                                                    className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary dark:border-white/10 dark:bg-card"
                                                                >
                                                                    {concern.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mb-6 grid gap-3 sm:grid-cols-2">
                                        <button
                                            onClick={() => handleNavigate({ page: 'products', searchQuery: searchTerm.trim() })}
                                            className="rounded-2xl border border-border bg-card px-4 py-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                        >
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('search.quick_discovery', 'Khám phá nhanh')}</p>
                                            <p className="mt-2 text-base font-bold text-foreground">{t('search.explore_products_title', 'Xem tất cả sản phẩm theo từ khóa')}</p>
                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                {t('search.explore_products_desc', {
                                                    keyword: searchTerm.trim(),
                                                    defaultValue: `Mở danh sách sản phẩm đã lọc theo "${searchTerm.trim()}" để so sánh thêm sản phẩm cùng vấn đề da.`,
                                                })}
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => handleNavigate({ page: 'blog' })}
                                            className="rounded-2xl border border-border bg-card px-4 py-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                        >
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('search.related_knowledge', 'Kiến thức liên quan')}</p>
                                            <p className="mt-2 text-base font-bold text-foreground">{t('search.open_blog_title', 'Mở thư viện bài viết')}</p>
                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                {t('search.open_blog_desc', 'Tiếp tục đọc các bài hướng dẫn, giải thích thành phần và bối cảnh điều trị liên quan đến từ khóa này.')}
                                            </p>
                                        </button>
                                    </div>
                                </>
                            )}
                            {!hasFullProductCatalog && (isSearchCatalogLoading || isProductCatalogLoading) ? (
                                <div className="mb-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
                                    {t('search.loading_product_search_catalog', 'Đang cập nhật kết quả sản phẩm...')}
                                </div>
                            ) : null}
                            {resultSectionOrder.map((section) => renderResultSection(section))}
                            {searchResults.products.length === 0 && searchResults.services.length === 0 && searchResults.blogPosts.length === 0 && !isSearchCatalogLoading && !isProductCatalogLoading && (
                                <p className="text-center text-muted-foreground py-10">{t('common.no_results')} "{searchTerm}".</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('common.start_search')}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FullScreenSearch;
