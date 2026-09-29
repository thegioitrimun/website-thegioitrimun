import useOverlayMotion from './motion/useOverlayMotion';
import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useId } from 'react';
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
    isBlogCatalogLoading?: boolean;
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
    isBlogCatalogLoading = false,
    onNavigate,
}) => {
    const { t, i18n } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCatalog, setSearchCatalog] = useState<Product[]>([]);
    const [isSearchCatalogLoading, setIsSearchCatalogLoading] = useState(false);
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const inputRef = useRef<HTMLInputElement>(null);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [activeSection, setActiveSection] = useState<'products' | 'services' | 'blogPosts'>('products');
    const [visibleLimit, setVisibleLimit] = useState(12);
    const id = useId();

    const getLocalized = (obj: any, field: string): string => {
        if (!obj) return '';
        const lang = i18n.language;
        if (lang !== 'vi') {
            const v = obj[`${field}_${lang}`];
            if (v) return v;
        }
        return obj[field] || '';
    };

    const overlay = useOverlayMotion(isOpen, onClose);
    useEffect(() => {
        if (!overlay.mounted) { setSearchTerm(''); setActiveSection('products'); }
    }, [overlay.mounted]);
    useEffect(() => { setVisibleLimit(8); }, [deferredSearchTerm]);

    useEffect(() => {
        if (!isOpen || hasFullProductCatalog || searchCatalog.length > 0) return;

        let isActive = true;
        setIsSearchCatalogLoading(true);
        void api.getProductSearchCatalog()
            .then((catalog) => {
                if (isActive) setSearchCatalog(catalog);
            })
            .catch(() => { /* Keep the available product results if the catalog request fails. */ })
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
            .map(({ item }) => item);

        const filteredBlogPosts = blogSearchIndex
            .filter(({ text }) => searchTokens.every((token) => text.includes(token)))
            .map(({ item }) => item);

        return { products: filteredProducts, services: filteredServices, blogPosts: filteredBlogPosts };
    }, [blogSearchIndex, deferredSearchTerm, productSearchIndex, serviceSearchIndex]);

    const handleNavigate = (view: View) => {
        onNavigate(view);
        onClose();
    };
    const hasQuery = Boolean(searchTerm.trim());
    const sections = [
        { key: 'products', label: t('nav.products'), count: searchResults.products.length, loading: !hasFullProductCatalog && (isSearchCatalogLoading || isProductCatalogLoading) },
        { key: 'services', label: t('nav.services'), count: searchResults.services.length, loading: false },
        { key: 'blogPosts', label: t('nav.knowledge'), count: searchResults.blogPosts.length, loading: isBlogCatalogLoading },
    ] as const;
    const itemClass = 'flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
    const renderItems = (section: typeof sections[number]['key']) => {
        if (section === 'products') return searchResults.products.slice(0, visibleLimit).map(product => (
            <li key={product.id}>
                <button type="button" onClick={() => handleNavigate({ page: 'productDetail', id: product.slug || product.id, categorySlug: product.category?.slug || product.category_slug })} className={itemClass}>
                    <img src={product.images?.[0]?.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-muted object-cover" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2">{getLocalized(product, 'name')}</p>
                        <p className="mt-0.5 text-xs font-semibold text-primary">{formatCurrency(product.price)}</p>
                    </div>
                </button>
            </li>
        ));
        if (section === 'services') return searchResults.services.slice(0, visibleLimit).map(service => (
            <li key={service.id}>
                <button type="button" onClick={() => handleNavigate({ page: 'serviceDetail', id: service.id })} className={itemClass}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{api.getIcon(service.icon, { className: 'h-5 w-5' })}</div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2">{getLocalized(service, 'name')}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{getLocalized(service, 'description')}</p>
                    </div>
                </button>
            </li>
        ));
        return searchResults.blogPosts.slice(0, visibleLimit).map(post => (
            <li key={post.slug}>
                <button type="button" onClick={() => handleNavigate({ page: 'blogDetail', slug: post.slug, categorySlug: post.category_slug })} className={itemClass}>
                    <img src={post.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-muted object-cover" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2">{getLocalized(post, 'title')}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{getLocalized(post, 'summary')}</p>
                    </div>
                </button>
            </li>
        ));
    };

    if (!overlay.mounted) return null;

    return (
        <div ref={overlay.ref} data-open={overlay.visible} aria-hidden={!isOpen} aria-label={t('common.search_placeholder')} className="site-overlay fixed inset-0 z-[100]" role="dialog" aria-modal="true">
            <div className="site-overlay-backdrop absolute inset-0 !bg-background" onClick={onClose}></div>
            <div className="site-search-panel container relative z-10 mx-auto px-2 py-0 h-full flex flex-col">
                {/* Header */}
                <header className="flex-shrink-0 flex items-center justify-between pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-3">
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            data-overlay-autofocus="true"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('common.search_placeholder')}
                            className="w-full bg-transparent border-0 pl-12 pr-4 py-2.5 text-base sm:text-lg outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        />
                    </div>
                    <button aria-label={t('common.close')} onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>

                {!isDesktop && (
                    <div role="tablist" aria-label={t('common.search_placeholder')} className="mb-3 grid shrink-0 grid-cols-3 border-b border-border">
                        {sections.map((section, index) => (
                            <button key={section.key} id={`${id}-tab-${section.key}`} type="button" role="tab" aria-selected={activeSection === section.key} aria-controls={`${id}-panel-${section.key}`} tabIndex={activeSection === section.key ? 0 : -1}
                                onClick={() => setActiveSection(section.key)}
                                onKeyDown={event => {
                                    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
                                    if (next < 0) return;
                                    event.preventDefault();
                                    setActiveSection(sections[next].key);
                                    document.getElementById(`${id}-tab-${sections[next].key}`)?.focus();
                                }}
                                className={`flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap border-b-2 px-1 py-1.5 text-xs sm:text-sm font-semibold ${activeSection === section.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                                {section.label}
                                {hasQuery && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{section.count}</span>}
                            </button>
                        ))}
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),1rem)] lg:overflow-hidden">
                    <div className="grid min-h-0 grid-cols-1 lg:h-full lg:grid-cols-3 lg:divide-x lg:divide-border" data-search-columns>
                        {sections.map(section => (
                            <section key={section.key} id={`${id}-panel-${section.key}`} data-search-section={section.key} hidden={!isDesktop && activeSection !== section.key}
                                role={isDesktop ? 'region' : 'tabpanel'} aria-labelledby={isDesktop ? `${id}-heading-${section.key}` : `${id}-tab-${section.key}`} aria-busy={section.loading}
                                className={`${!isDesktop && activeSection !== section.key ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col lg:px-3 lg:first:pl-0 lg:last:pr-0`}>
                                <div className="mb-2 hidden shrink-0 items-center justify-between gap-2 border-b border-border pb-2 lg:flex">
                                    <h2 id={`${id}-heading-${section.key}`} className="text-sm sm:text-base font-bold tracking-tight">{section.label}</h2>
                                    {hasQuery && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">{section.count}</span>}
                                </div>
                                <div className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
                                    {section.loading && <p role="status" className="px-2 py-2 text-xs text-muted-foreground">{t('common.loading', 'Đang tải...')}</p>}
                                    {!hasQuery ? <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground">{t('common.start_search')}</p> : section.count === 0 && !section.loading ? <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground">{t('common.no_results')} “{searchTerm.trim()}”.</p> : null}
                                    <ul className="space-y-0.5">{renderItems(section.key)}</ul>
                                    {section.count > visibleLimit && (
                                        <button type="button" onClick={() => setVisibleLimit(limit => limit + 12)} className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">{t('common.load_more', 'Xem thêm')}</button>
                                    )}
                                    {section.key === 'products' && section.count > 0 && (
                                        <button type="button" onClick={() => handleNavigate({ page: 'products', searchQuery: searchTerm.trim() })} className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">
                                            {t('search.view_all_product_results', { count: section.count, defaultValue: `Xem tất cả ${section.count} sản phẩm` })}
                                        </button>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullScreenSearch;
