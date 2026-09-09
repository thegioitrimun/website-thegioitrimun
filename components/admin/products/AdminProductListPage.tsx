import React, { useState } from 'react';
import type { Product, ProductCategory, ProductBrand, ProductImage } from '../../../types';
import Spinner from '../../Spinner';
import {
    AdminToolbar,
    AdminFilterPanel,
    AdminDataTable,
    AdminColumn,
    AdminSelectionBar,
    AdminPagination,
    AdminStatusBadge,
    AdminButton,
    AdminIconButton,
} from '..';
import { AdminMobileList, AdminMobileCard } from '../AdminMobileList';
import { GlassMenuPopover } from '../../GlassInputs';

const PRODUCT_INVENTORY_FILTER_TABS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'Tất cả' },
    { key: 'in_stock', label: 'Còn hàng' },
    { key: 'low_stock', label: 'Cảnh báo tồn' },
    { key: 'out_of_stock', label: 'Hết hàng' },
    { key: 'featured', label: 'Nổi bật' },
    { key: 'hidden', label: 'Đang ẩn' },
    { key: 'expiring_soon', label: 'Cận hạn' },
    { key: 'missing_sku', label: 'Thiếu SKU' },
];

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export interface AdminProductListPageProps {
    products: Product[];
    categories: ProductCategory[];
    brands: ProductBrand[];
    categoryNameById: Map<number, string>;
    inventoryCounts: Record<string, number>;

    searchQuery: string;
    setSearchQuery: (query: string) => void;
    inventoryFilter: string;
    navigateToProductFilter: (filterKey: string) => void;
    selectedCategoryId: string;
    setSelectedCategoryId: (categoryId: string) => void;
    selectedBrand: string;
    setSelectedBrand: (brand: string) => void;
    productSortColumn: 'id' | 'name' | 'price' | 'status';
    productSortDirection: 'asc' | 'desc';
    setProductSortColumn: (col: 'id' | 'name' | 'price' | 'status') => void;
    setProductSortDirection: (dir: 'asc' | 'desc') => void;

    currentProducts: Product[];
    filteredProducts: Product[];
    productsCurrentPage: number;
    totalProductPages: number;
    setProductsCurrentPage: (page: number) => void;

    selectedProductIds: number[];
    toggleProductSelection: (id: number) => void;
    toggleSelectProducts: (ids: number[], select: boolean) => void;
    setSelectedProductIds: (ids: number[]) => void;

    bulkAction: string;
    setBulkAction: (action: any) => void;
    bulkCategoryId: string;
    setBulkCategoryId: (catId: string) => void;
    bulkBrandName: string;
    setBulkBrandName: (brand: string) => void;
    bulkNumericValue: string;
    setBulkNumericValue: (val: string) => void;
    handleApplyBulkAction: (productsToApply: Product[]) => Promise<void>;
    isApplyingBulkAction: boolean;

    handleAddNewProduct: () => void;
    handleEditProduct: (product: Product) => void;
    onDeleteProduct: (productId: number) => void;

    handleSyncProductToPancake: (product: Product) => Promise<void>;
    handleSyncProductsToPancake: () => Promise<void>;
    isSyncingPancakeProducts: boolean;
    syncingPancakeProductId: number | null;

    handleExportProducts: () => void;
    productFileInputRef: React.RefObject<HTMLInputElement>;
    handleImportFile: (event: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'category') => void;
    isImporting: boolean;
    handleDownloadProductTemplate: () => void;

    getInventoryStatusInfo: (product: Product) => { text?: string; label?: string; color: string; isExpired?: boolean; isNearExpiry?: boolean; badgeTone?: 'success' | 'amber' | 'rose' | 'slate' };
    getEffectiveContentReviewForProduct: (product: Product) => any;
    getQuickDraft: (product: Product) => any;
    isQuickDraftDirty: (product: Product) => boolean;
    updateQuickDraftField: (product: Product, field: any, value: string) => void;
    handleSaveQuickDraft: (product: Product) => Promise<void>;
    resetQuickDraft: (productId: number) => void;
    savingQuickProductId: number | null;

    editingPriceId: number | null;
    setEditingPriceId: (id: number | null) => void;
    onSaveProduct: (product: Partial<Product>, imagesToDelete: ProductImage[]) => Promise<Product>;
}

export const AdminProductListPage: React.FC<AdminProductListPageProps> = ({
    products,
    categories,
    brands,
    categoryNameById,
    inventoryCounts,

    searchQuery,
    setSearchQuery,
    inventoryFilter,
    navigateToProductFilter,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedBrand,
    setSelectedBrand,
    productSortColumn,
    productSortDirection,
    setProductSortColumn,
    setProductSortDirection,

    currentProducts,
    filteredProducts,
    productsCurrentPage,
    totalProductPages,
    setProductsCurrentPage,

    selectedProductIds,
    toggleProductSelection,
    toggleSelectProducts,
    setSelectedProductIds,

    bulkAction,
    setBulkAction,
    bulkCategoryId,
    setBulkCategoryId,
    bulkBrandName,
    setBulkBrandName,
    bulkNumericValue,
    setBulkNumericValue,
    handleApplyBulkAction,
    isApplyingBulkAction,

    handleAddNewProduct,
    handleEditProduct,
    onDeleteProduct,

    handleSyncProductToPancake,
    handleSyncProductsToPancake,
    isSyncingPancakeProducts,
    syncingPancakeProductId,

    handleExportProducts,
    productFileInputRef,
    handleImportFile,
    isImporting,
    handleDownloadProductTemplate,

    getInventoryStatusInfo,
    getEffectiveContentReviewForProduct,
    getQuickDraft,
    isQuickDraftDirty,
    updateQuickDraftField,
    handleSaveQuickDraft,
    resetQuickDraft,
    savingQuickProductId,

    editingPriceId,
    setEditingPriceId,
    onSaveProduct,
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [openMobileMenuProductId, setOpenMobileMenuProductId] = useState<number | null>(null);

    const currentProductIds = currentProducts.map((p) => p.id);
    const selectedProducts = products.filter((product) => selectedProductIds.includes(product.id));
    const allCurrentPageSelected =
        currentProductIds.length > 0 && currentProductIds.every((id) => selectedProductIds.includes(id));
    const isSomeSelected =
        currentProductIds.some((id) => selectedProductIds.includes(id)) && !allCurrentPageSelected;

    const isFilterActive =
        selectedCategoryId !== 'all' ||
        selectedBrand !== 'all' ||
        inventoryFilter !== 'all' ||
        productSortColumn !== 'id' ||
        productSortDirection !== 'desc';

    const activeFilterCount =
        (selectedCategoryId !== 'all' ? 1 : 0) +
        (selectedBrand !== 'all' ? 1 : 0) +
        (inventoryFilter !== 'all' ? 1 : 0) +
        (productSortColumn !== 'id' || productSortDirection !== 'desc' ? 1 : 0);

    const resetFilters = () => {
        navigateToProductFilter('all');
        setSelectedCategoryId('all');
        setSelectedBrand('all');
        setProductSortColumn('id');
        setProductSortDirection('desc');
        setSearchQuery('');
    };

    const columns: AdminColumn<Product>[] = [
        {
            id: 'product',
            label: 'Sản phẩm',
            width: '46%',
            sortable: true,
            sortDirection: productSortColumn === 'name' ? productSortDirection : null,
            onSort: () => {
                if (productSortColumn === 'name') {
                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                    setProductSortColumn('name');
                    setProductSortDirection('asc');
                }
            },
            render: (p) => {
                const categoryName = categoryNameById.get(p.category_id || 0) || 'Chưa gắn chuyên mục';
                const isDirty = isQuickDraftDirty(p);
                return (
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="group/img-preview relative shrink-0">
                            <img
                                src={p.images?.[0]?.image_url || 'https://placehold.co/80x80?text=SP'}
                                alt={p.name}
                                className="h-11 w-11 shrink-0 rounded-xl border border-border/80 bg-muted/20 object-cover shadow-xs transition-all duration-200 group-hover/img-preview:scale-105 group-hover/img-preview:border-primary/60 group-hover/img-preview:shadow-md cursor-pointer"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=SP';
                                }}
                            />
                            {/* Hover enlarged preview */}
                            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-[100] hidden group-hover/img-preview:block w-[208px] min-w-[208px] max-w-[208px] rounded-2xl border border-border/80 bg-popover p-2 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] transition-all animate-in fade-in zoom-in-95">
                                <img
                                    src={p.images?.[0]?.image_url || 'https://placehold.co/240x240?text=SP'}
                                    alt={p.name}
                                    className="h-48 w-48 min-w-[192px] max-w-none rounded-xl object-cover bg-muted border border-border/40 block"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://placehold.co/240x240?text=SP';
                                    }}
                                />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p
                                    className="truncate text-sm font-bold leading-6 text-foreground cursor-pointer hover:text-primary transition-colors"
                                    title={p.name}
                                    onClick={() => handleEditProduct(p)}
                                >
                                    {p.name}
                                </p>
                                {isDirty && (
                                    <AdminStatusBadge tone="amber" label="Chưa lưu" />
                                )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                ID: {p.id} • {p.brand || 'Chưa gắn brand'} • {categoryName}
                                {p.volume ? ` • ${p.volume}` : ''}
                                {p.origin ? ` • ${p.origin}` : ''}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'price',
            label: 'Giá bán',
            width: '18%',
            sortable: true,
            sortDirection: productSortColumn === 'price' ? productSortDirection : null,
            onSort: () => {
                if (productSortColumn === 'price') {
                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                    setProductSortColumn('price');
                    setProductSortDirection('asc');
                }
            },
            render: (p) => {
                const draft = getQuickDraft(p);
                return editingPriceId === p.id ? (
                    <input
                        autoFocus
                        type="number"
                        min={0}
                        step={1000}
                        value={draft.price}
                        onChange={(e) => updateQuickDraftField(p, 'price', e.target.value)}
                        onBlur={() => setEditingPriceId(null)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Giá"
                    />
                ) : (
                    <div
                        className="cursor-text rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-muted/50 transition-colors"
                        onClick={() => setEditingPriceId(p.id)}
                        title="Nhấn để sửa nhanh giá"
                    >
                        {formatCurrency(Number(draft.price) || 0)}
                    </div>
                );
            },
        },
        {
            id: 'stock',
            label: 'Tồn kho',
            width: '14%',
            sortable: true,
            sortDirection: productSortColumn === 'status' ? productSortDirection : null,
            onSort: () => {
                if (productSortColumn === 'status') {
                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                    setProductSortColumn('status');
                    setProductSortDirection('asc');
                }
            },
            render: (p) => {
                const statusInfo = getInventoryStatusInfo(p);
                return (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-foreground">
                            {p.stock_quantity ?? 0}
                        </span>
                        <AdminStatusBadge tone={statusInfo.badgeTone || (statusInfo.isExpired ? 'rose' : statusInfo.isNearExpiry ? 'amber' : 'emerald')} label={statusInfo.label || statusInfo.text || ''} />
                    </div>
                );
            },
        },
        {
            id: 'visibility',
            label: 'Hiển thị',
            width: '10%',
            align: 'center',
            render: (p) => (
                <div className="flex items-center justify-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => void onSaveProduct({ ...p, is_published: !p.is_published }, [])}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                            p.is_published
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400'
                                : 'border-border bg-background text-muted-foreground hover:border-rose-200 hover:text-rose-700'
                        }`}
                        title={p.is_published ? 'Đang hiện trên Web. Nhấn để Ẩn' : 'Đang ẩn trên Web. Nhấn để Hiện'}
                    >
                        <img
                            src={
                                p.is_published
                                    ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp'
                                    : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp'
                            }
                            alt={p.is_published ? 'Hiện' : 'Ẩn'}
                            className="h-4 w-4 object-contain"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() => void onSaveProduct({ ...p, is_featured: !p.is_featured }, [])}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                            p.is_featured
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400'
                                : 'border-border bg-background text-muted-foreground hover:border-amber-200 hover:text-amber-700'
                        }`}
                        title={p.is_featured ? 'Gỡ nổi bật' : 'Đánh dấu nổi bật'}
                    >
                        <img
                            src={
                                p.is_featured
                                    ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp'
                                    : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720160138-unstar.webp'
                            }
                            alt={p.is_featured ? 'Nổi bật' : 'Không nổi bật'}
                            className="h-4 w-4 object-contain"
                        />
                    </button>
                </div>
            ),
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '12%',
            align: 'right',
            render: (p) => {
                const isDirty = isQuickDraftDirty(p);
                const isSavingThis = savingQuickProductId === p.id;
                return (
                    <div className="flex items-center justify-end gap-1.5">
                        {isDirty && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => void handleSaveQuickDraft(p)}
                                    disabled={isSavingThis}
                                    className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isSavingThis ? <Spinner className="h-3 w-3" /> : 'Lưu'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => resetQuickDraft(p.id)}
                                    className="inline-flex h-7 items-center justify-center rounded-lg border border-border px-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                    Hủy
                                </button>
                            </>
                        )}
                        <AdminIconButton
                            label="Sửa đầy đủ"
                            icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="h-4 w-4 object-contain" />}
                            onClick={() => handleEditProduct(p)}
                        />
                        <AdminIconButton
                            label="Đồng bộ Pancake"
                            icon={
                                syncingPancakeProductId === p.id ? (
                                    <Spinner className="h-4 w-4 text-primary" />
                                ) : (
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="" className="h-4 w-4 object-contain" />
                                )
                            }
                            onClick={() => void handleSyncProductToPancake(p)}
                            disabled={syncingPancakeProductId === p.id}
                        />
                        <AdminIconButton
                            label="Xóa sản phẩm"
                            variant="destructive"
                            icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="h-4 w-4 object-contain" />}
                            onClick={() => onDeleteProduct(p.id)}
                        />
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">
            {/* 1. AdminToolbar */}
            <AdminToolbar
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Tìm theo tên sản phẩm hoặc SKU..."
                filterActive={isFilterActive}
                filterCount={activeFilterCount}
                filterOpen={showFilters}
                onToggleFilter={() => setShowFilters(!showFilters)}
                actions={
                    <div className="flex items-center gap-2">
                        <div className="relative shrink-0" data-product-actions-menu>
                            <button
                                type="button"
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-background/50 active:scale-95 shrink-0 ${
                                    showActionsMenu
                                        ? 'bg-background/60 text-primary ring-1 ring-primary/50'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Tiện ích: Xuất/Nhập Excel, Đồng bộ Pancake"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                </svg>
                            </button>

                            <GlassMenuPopover
                                isOpen={showActionsMenu}
                                onClose={() => setShowActionsMenu(false)}
                                widthClass="w-56"
                                topClass="top-full mt-1.5"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActionsMenu(false);
                                        handleExportProducts();
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                >
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                    <span>Xuất file Excel</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActionsMenu(false);
                                        productFileInputRef.current?.click();
                                    }}
                                    disabled={isImporting}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left disabled:opacity-50"
                                >
                                    {isImporting ? (
                                        <Spinner className="w-4 h-4 text-primary shrink-0" />
                                    ) : (
                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                    )}
                                    <span>Nhập từ file Excel</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActionsMenu(false);
                                        handleDownloadProductTemplate();
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                >
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                    <span>Tải mẫu file Excel</span>
                                </button>

                                <div className="my-1 border-t border-border/50" />

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowActionsMenu(false);
                                        void handleSyncProductsToPancake();
                                    }}
                                    disabled={isSyncingPancakeProducts}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors text-left disabled:opacity-50"
                                    title={selectedProductIds.length > 0 ? `Đồng bộ ${selectedProductIds.length} sản phẩm đã chọn với Pancake` : 'Đồng bộ toàn bộ sản phẩm đang hoạt động với Pancake'}
                                >
                                    {isSyncingPancakeProducts ? (
                                        <Spinner className="w-4 h-4 text-primary shrink-0" />
                                    ) : (
                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                    )}
                                    <span>Đồng bộ Pancake</span>
                                </button>
                            </GlassMenuPopover>
                        </div>

                        <AdminButton
                            variant="primary"
                            icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />}
                            onClick={handleAddNewProduct}
                        >
                            Thêm mới
                        </AdminButton>

                        <input
                            type="file"
                            ref={productFileInputRef}
                            onChange={(e) => handleImportFile(e, 'product')}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                    </div>
                }
            />

            {/* 2. AdminFilterPanel */}
            <AdminFilterPanel
                isOpen={showFilters}
                onReset={resetFilters}
                activeFilterCount={activeFilterCount}
                summaryText={
                    isFilterActive
                        ? `Tìm thấy ${filteredProducts.length} sản phẩm khớp bộ lọc (trong tổng số ${products.length} SKU)`
                        : undefined
                }
            >
                {/* Presets row */}
                <div className="col-span-full flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {PRODUCT_INVENTORY_FILTER_TABS.map((btn) => {
                        const count = inventoryCounts[btn.key] || 0;
                        const isActive = inventoryFilter === btn.key;
                        return (
                            <button
                                key={btn.key}
                                type="button"
                                onClick={() => navigateToProductFilter(btn.key)}
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                        : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <span>{btn.label}</span>
                                {count > 0 && (
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                                : 'bg-muted text-foreground'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 3 Select dropdowns */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Chuyên mục</label>
                    <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full admin-glass-input text-xs"
                    >
                        <option value="all">Tất cả chuyên mục ({categories.length})</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Thương hiệu</label>
                    <select
                        value={selectedBrand}
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full admin-glass-input text-xs"
                    >
                        <option value="all">Tất cả thương hiệu ({brands.length})</option>
                        {brands.map((b) => (
                            <option key={b.id} value={b.name}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Sắp xếp</label>
                    <select
                        value={`${productSortColumn}_${productSortDirection}`}
                        onChange={(e) => {
                            const [col, dir] = e.target.value.split('_') as [
                                'id' | 'name' | 'price' | 'status',
                                'asc' | 'desc',
                            ];
                            setProductSortColumn(col);
                            setProductSortDirection(dir);
                        }}
                        className="w-full admin-glass-input text-xs"
                    >
                        <option value="id_desc">Sắp xếp: Mới nhất</option>
                        <option value="name_asc">Tên: A → Z</option>
                        <option value="name_desc">Tên: Z → A</option>
                        <option value="price_asc">Giá: Thấp đến cao</option>
                        <option value="price_desc">Giá: Cao đến thấp</option>
                        <option value="status_asc">Theo trạng thái kho</option>
                    </select>
                </div>
            </AdminFilterPanel>

            {/* 3. AdminDataTable (Desktop >= 1024px) */}
            <div className="hidden lg:block">
                <AdminDataTable
                    columns={columns}
                    data={currentProducts}
                    rowKey={(p) => p.id}
                    selectedKeys={selectedProductIds}
                    onToggleSelect={(id) => toggleProductSelection(Number(id))}
                    onToggleSelectAll={(select) => toggleSelectProducts(currentProductIds, select)}
                    isAllSelected={allCurrentPageSelected}
                    isSomeSelected={isSomeSelected}
                    emptyMessage="Không có sản phẩm nào khớp bộ lọc hiện tại."
                    onRowClick={(p) => handleEditProduct(p)}
                />
            </div>

            {/* 4. AdminMobileList (Mobile < 1024px) */}
            <div className="block lg:hidden">
                <AdminMobileList>
                    {currentProducts.length === 0 ? (
                        <AdminMobileCard className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
                            <p className="text-base font-bold text-foreground">Không có sản phẩm nào khớp bộ lọc.</p>
                            <p className="mt-1 text-xs text-muted-foreground">Thử đổi từ khóa hoặc bộ lọc danh mục.</p>
                        </AdminMobileCard>
                    ) : (
                        currentProducts.map((p) => {
                            const statusInfo = getInventoryStatusInfo(p);
                            const isDirty = isQuickDraftDirty(p);
                            const isSavingThis = savingQuickProductId === p.id;
                            const isSelected = selectedProductIds.includes(p.id);
                            const isMenuOpen = openMobileMenuProductId === p.id;
                            const categoryName = categoryNameById.get(p.category_id || 0) || 'Chưa gắn chuyên mục';

                            return (
                                <AdminMobileCard
                                    key={p.id}
                                    className={`relative transition-all ${
                                        isSelected ? 'border-primary/35 bg-primary/[0.04]' : ''
                                    }`}
                                >
                                    {isMenuOpen && (
                                        <div
                                            className="fixed inset-0 z-40 bg-transparent"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMobileMenuProductId(null);
                                            }}
                                        />
                                    )}

                                    <div className="relative z-10 flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleProductSelection(p.id)}
                                            className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-primary"
                                            aria-label={`Chọn sản phẩm ${p.name}`}
                                        />

                                        <div className="relative shrink-0">
                                            <img
                                                src={p.images?.[0]?.image_url || 'https://placehold.co/100x100?text=SP'}
                                                alt={p.name}
                                                className="h-20 w-20 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl object-cover shadow-xs"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=SP';
                                                }}
                                            />
                                            {p.is_featured ? (
                                                <span
                                                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-xs"
                                                    title="Sản phẩm nổi bật"
                                                >
                                                    <img
                                                        src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp"
                                                        alt="Nổi bật"
                                                        className="h-3 w-3 object-contain"
                                                    />
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-1">
                                                <p
                                                    className="line-clamp-2 text-sm font-bold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors"
                                                    title={p.name}
                                                    onClick={() => handleEditProduct(p)}
                                                >
                                                    {p.name}
                                                </p>

                                                <div className="relative shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMobileMenuProductId((prev) =>
                                                                prev === p.id ? null : p.id,
                                                            );
                                                        }}
                                                        aria-label={`Thao tác cho ${p.name}`}
                                                        className={`relative z-50 flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                                                            isMenuOpen
                                                                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                                                : 'border-border/70 bg-card/40 backdrop-blur-xl text-muted-foreground hover:bg-card/80 hover:text-foreground'
                                                        }`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                                                        </svg>
                                                    </button>

                                                    {isMenuOpen && (
                                                        <div
                                                            className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-white/70 bg-card/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:border-white/10"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenMobileMenuProductId(null);
                                                                    handleEditProduct(p);
                                                                }}
                                                                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                                            >
                                                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="h-4 w-4 object-contain" />
                                                                <span>Sửa sản phẩm</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenMobileMenuProductId(null);
                                                                    void handleSyncProductToPancake(p);
                                                                }}
                                                                disabled={syncingPancakeProductId === p.id}
                                                                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                                                            >
                                                                {syncingPancakeProductId === p.id ? (
                                                                    <Spinner className="h-4 w-4" />
                                                                ) : (
                                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Đồng bộ" className="h-4 w-4 object-contain" />
                                                                )}
                                                                <span>Đồng bộ Pancake</span>
                                                            </button>

                                                            <div className="my-1 border-t border-border/50" />

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenMobileMenuProductId(null);
                                                                    onDeleteProduct(p.id);
                                                                }}
                                                                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                                                            >
                                                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-4 w-4 object-contain" />
                                                                <span>Xóa sản phẩm</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                {p.brand || 'Chưa có Brand'} • {categoryName}{p.volume ? ` • ${p.volume}` : ''}
                                            </p>

                                            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
                                                <span className="text-sm font-black text-primary">
                                                    {formatCurrency(Number(p.price) || 0)}
                                                </span>
                                                <span className={`text-xs font-medium ${p.stock_quantity <= 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                    Kho: <strong className="text-foreground">{p.stock_quantity || 0}</strong>
                                                </span>
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/30 pt-1.5">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <AdminStatusBadge
                                                        tone={p.is_published ? 'emerald' : 'slate'}
                                                        label={p.is_published ? 'Hiện web' : 'Ẩn web'}
                                                    />
                                                    {statusInfo.badgeTone === 'rose' && (
                                                        <AdminStatusBadge tone="rose" label="Hết hàng" />
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    SKU: {p.sku || '-'} • #{p.id}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {isDirty && (
                                        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                                            <span className="font-semibold">Có thay đổi nhanh chưa lưu</span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSaveQuickDraft(p)}
                                                    disabled={isSavingThis}
                                                    className="inline-flex h-6.5 items-center gap-1 rounded-lg bg-primary px-2 text-[11px] font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                                                >
                                                    {isSavingThis ? <Spinner className="h-3 w-3" /> : 'Lưu'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => resetQuickDraft(p.id)}
                                                    className="inline-flex h-6.5 items-center rounded-lg border border-border/70 bg-background/60 px-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </AdminMobileCard>
                            );
                        })
                    )}
                </AdminMobileList>
            </div>

            {/* 5. Smart Floating Selection Bar */}
            <AdminSelectionBar
                selectedCount={selectedProductIds.length}
                totalCount={filteredProducts.length}
                onClearSelection={() => setSelectedProductIds([])}
                actions={
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <select
                            value={bulkAction}
                            onChange={(e) => setBulkAction(e.target.value)}
                            className="h-8 rounded-xl border border-border/70 bg-card/90 px-2 sm:px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                        >
                            <option value="publish">Hiện trên web</option>
                            <option value="unpublish">Ẩn khỏi web</option>
                            <option value="feature">Đánh dấu Nổi bật</option>
                            <option value="unfeature">Bỏ Nổi bật</option>
                            <option value="set_category">Đổi chuyên mục...</option>
                            <option value="set_brand">Đổi thương hiệu...</option>
                            <option value="adjust_stock">Chỉnh kho (+/-)...</option>
                            <option value="set_low_threshold">Mức cảnh báo tồn...</option>
                            <option value="set_vat_rate">Chỉnh % VAT...</option>
                            <option value="delete">Xóa sản phẩm</option>
                        </select>

                        {bulkAction === 'set_category' && (
                            <select
                                value={bulkCategoryId}
                                onChange={(e) => setBulkCategoryId(e.target.value)}
                                className="h-8 rounded-xl border border-border/70 bg-card/90 px-2 sm:px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer max-w-[140px] sm:max-w-none"
                            >
                                <option value="all">Chọn chuyên mục</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {bulkAction === 'set_brand' && (
                            <select
                                value={bulkBrandName}
                                onChange={(e) => setBulkBrandName(e.target.value)}
                                className="h-8 rounded-xl border border-border/70 bg-card/90 px-2 sm:px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer max-w-[140px] sm:max-w-none"
                            >
                                <option value="all">Chọn thương hiệu</option>
                                <option value="__none__">Không thương hiệu</option>
                                {brands.map((brand) => (
                                    <option key={brand.id} value={brand.name}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {(bulkAction === 'adjust_stock' ||
                            bulkAction === 'set_low_threshold' ||
                            bulkAction === 'set_vat_rate') && (
                            <input
                                type="number"
                                value={bulkNumericValue}
                                onChange={(e) => setBulkNumericValue(e.target.value)}
                                placeholder={
                                    bulkAction === 'adjust_stock'
                                        ? '+/- số'
                                        : bulkAction === 'set_vat_rate'
                                        ? '% VAT'
                                        : 'Tồn kho'
                                }
                                className="h-8 w-20 sm:w-24 rounded-xl border border-border/70 bg-card/90 px-2 sm:px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        )}

                        <button
                            type="button"
                            onClick={() => void handleApplyBulkAction(selectedProducts)}
                            disabled={isApplyingBulkAction || selectedProductIds.length === 0}
                            className="inline-flex h-8 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                        >
                            {isApplyingBulkAction ? <Spinner className="w-3.5 h-3.5" /> : 'Áp dụng'}
                        </button>
                    </div>
                }
            />

            {/* 6. AdminPagination */}
            <AdminPagination
                currentPage={productsCurrentPage}
                totalPages={totalProductPages}
                totalItems={filteredProducts.length}
                pageSize={30}
                onPageChange={setProductsCurrentPage}
            />
        </div>
    );
};

export default AdminProductListPage;
