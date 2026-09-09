import React, { useState } from 'react';
import type { ProductCategory } from '../../../types';
import {
    AdminToolbar,
    AdminDataTable,
    AdminColumn,
    AdminPagination,
    AdminStatusBadge,
    AdminButton,
    AdminIconButton,
} from '..';
import { GlassMenuPopover } from '../../GlassInputs';

const generateSlug = (title: string) =>
    title
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

export interface AdminProductCategoryListProps {
    categories: ProductCategory[];
    filteredCategories: ProductCategory[];
    categorySearchQuery: string;
    setCategorySearchQuery: (query: string) => void;
    categoryFilter: 'all' | 'featured';
    setCategoryFilter: React.Dispatch<React.SetStateAction<'all' | 'featured'>>;

    isCategoryFormVisible: boolean;
    setIsCategoryFormVisible: (visible: boolean) => void;
    editingCategoryId: number | null;
    setEditingCategoryId: (id: number | null) => void;

    newCategoryName: string;
    setNewCategoryName: (name: string) => void;
    newCategorySlug: string;
    setNewCategorySlug: (slug: string) => void;
    newCategoryIsFeatured: boolean;
    setNewCategoryIsFeatured: (featured: boolean) => void;

    editCategoryName: string;
    setEditCategoryName: (name: string) => void;
    editCategorySlug: string;
    setEditCategorySlug: (slug: string) => void;
    editCategoryIsFeatured: boolean;
    setEditCategoryIsFeatured: (featured: boolean) => void;

    handleStartEditCategory: (cat: ProductCategory) => void;
    handleCancelEditCategory: () => void;
    handleAddNewCategory: (e: React.FormEvent) => void;
    handleSaveEditCategory: (e: React.FormEvent) => void;

    onSaveCategory: (cat: Partial<ProductCategory>) => Promise<any> | void;
    onDeleteCategory: (id: number) => Promise<any> | void;

    handleExportCategories: () => void;
    handleImportFile: (event: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'category') => void;
    handleDownloadCategoryTemplate: () => void;
}

export const AdminProductCategoryList: React.FC<AdminProductCategoryListProps> = ({
    categories,
    filteredCategories,
    categorySearchQuery,
    setCategorySearchQuery,
    categoryFilter,
    setCategoryFilter,

    isCategoryFormVisible,
    setIsCategoryFormVisible,
    editingCategoryId,
    setEditingCategoryId,

    newCategoryName,
    setNewCategoryName,
    newCategorySlug,
    setNewCategorySlug,
    newCategoryIsFeatured,
    setNewCategoryIsFeatured,

    editCategoryName,
    setEditCategoryName,
    editCategorySlug,
    setEditCategorySlug,
    editCategoryIsFeatured,
    setEditCategoryIsFeatured,

    handleStartEditCategory,
    handleCancelEditCategory,
    handleAddNewCategory,
    handleSaveEditCategory,

    onSaveCategory,
    onDeleteCategory,

    handleExportCategories,
    handleImportFile,
    handleDownloadCategoryTemplate,
}) => {
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 30;

    const totalPages = Math.ceil(filteredCategories.length / pageSize) || 1;
    const paginatedCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const isFormOpen = isCategoryFormVisible || Boolean(editingCategoryId);

    const columns: AdminColumn<ProductCategory>[] = [
        {
            id: 'name',
            label: 'Tên chuyên mục',
            width: '45%',
            render: (cat) => (
                <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{cat.name}</span>
                    {cat.is_featured && (
                        <AdminStatusBadge tone="amber" label="Trang chủ" />
                    )}
                </div>
            ),
        },
        {
            id: 'slug',
            label: 'Slug đường dẫn',
            width: '25%',
            render: (cat) => (
                <span className="font-mono text-xs text-muted-foreground">{cat.slug}</span>
            ),
        },
        {
            id: 'featured',
            label: 'Trang chủ',
            width: '15%',
            align: 'center',
            render: (cat) => (
                <button
                    type="button"
                    onClick={() => void onSaveCategory({ ...cat, is_featured: !cat.is_featured })}
                    title={cat.is_featured ? 'Bỏ khỏi Trang Chủ' : 'Đưa lên Trang Chủ'}
                    className={`text-base transition-all active:scale-95 ${
                        cat.is_featured ? 'scale-110 text-yellow-500' : 'text-gray-300 grayscale hover:text-yellow-400'
                    }`}
                >
                    ⭐
                </button>
            ),
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '15%',
            align: 'right',
            render: (cat) => (
                <div className="flex items-center justify-end gap-1">
                    <AdminIconButton
                        label="Sửa chuyên mục"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => handleStartEditCategory(cat)}
                    />
                    <AdminIconButton
                        label="Xóa chuyên mục"
                        variant="destructive"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => void onDeleteCategory(cat.id)}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            {isFormOpen ? (
                <div className="w-full rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
                    <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-5">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <button
                                type="button"
                                onClick={handleCancelEditCategory}
                                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                                title="Quay lại danh sách chuyên mục"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <div>
                                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Chuyên mục</p>
                                <h3 className="text-lg sm:text-2xl font-black text-foreground">
                                    {editingCategoryId ? `Chỉnh sửa chuyên mục: ${editCategoryName || '...'}` : 'Thêm chuyên mục mới'}
                                </h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AdminButton variant="secondary" onClick={handleCancelEditCategory}>
                                Hủy
                            </AdminButton>
                            <AdminButton
                                variant="primary"
                                onClick={editingCategoryId ? handleSaveEditCategory : handleAddNewCategory}
                            >
                                {editingCategoryId ? 'Lưu thay đổi' : 'Tạo chuyên mục'}
                            </AdminButton>
                        </div>
                    </div>

                    <form onSubmit={editingCategoryId ? handleSaveEditCategory : handleAddNewCategory} className="space-y-4 max-w-2xl">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                                Tên chuyên mục <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={editingCategoryId ? editCategoryName : newCategoryName}
                                onChange={(e) => {
                                    if (editingCategoryId) {
                                        setEditCategoryName(e.target.value);
                                        if (!editCategorySlug) setEditCategorySlug(generateSlug(e.target.value));
                                    } else {
                                        setNewCategoryName(e.target.value);
                                        if (!newCategorySlug) setNewCategorySlug(generateSlug(e.target.value));
                                    }
                                }}
                                className="w-full admin-glass-input text-sm font-semibold"
                                placeholder="Nhập tên chuyên mục..."
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                                Slug đường dẫn (URL thân thiện SEO) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={editingCategoryId ? editCategorySlug : newCategorySlug}
                                onChange={(e) => {
                                    if (editingCategoryId) {
                                        setEditCategorySlug(e.target.value);
                                    } else {
                                        setNewCategorySlug(e.target.value);
                                    }
                                }}
                                className="w-full admin-glass-input font-mono text-xs"
                                placeholder="vi-du-slug"
                                required
                            />
                        </div>

                        <div className="rounded-2xl border border-white/60 bg-background/40 p-3.5 backdrop-blur-md dark:border-white/10">
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    id="categoryIsFeatured"
                                    checked={editingCategoryId ? editCategoryIsFeatured : newCategoryIsFeatured}
                                    onChange={(e) => {
                                        if (editingCategoryId) {
                                            setEditCategoryIsFeatured(e.target.checked);
                                        } else {
                                            setNewCategoryIsFeatured(e.target.checked);
                                        }
                                    }}
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <div className="text-xs">
                                    <p className="font-bold text-foreground flex items-center gap-1">
                                        <span>⭐ Hiển thị chuyên mục này trên Trang Chủ</span>
                                    </p>
                                    <p className="text-muted-foreground mt-0.5">
                                        Đưa chuyên mục này lên danh mục nổi bật ngoài Trang Chủ giúp khách hàng dễ duyệt sản phẩm hơn.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center gap-3 pt-3">
                            <AdminButton
                                variant="primary"
                                type="submit"
                            >
                                {editingCategoryId ? 'Lưu thay đổi' : 'Tạo chuyên mục'}
                            </AdminButton>
                            <AdminButton
                                variant="secondary"
                                type="button"
                                onClick={handleCancelEditCategory}
                            >
                                Hủy
                            </AdminButton>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <AdminToolbar
                        searchValue={categorySearchQuery}
                        onSearchChange={setCategorySearchQuery}
                        searchPlaceholder="Tìm theo tên chuyên mục, slug..."
                        filterActive={categoryFilter === 'featured'}
                        filterCount={categoryFilter === 'featured' ? 1 : 0}
                        filterOpen={categoryFilter === 'featured'}
                        onToggleFilter={() => setCategoryFilter((prev) => (prev === 'featured' ? 'all' : 'featured'))}
                        actions={
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowActionsMenu((prev) => !prev)}
                                        className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-background/50 active:scale-95 text-muted-foreground hover:text-foreground"
                                        title="Tiện ích nhập xuất Excel"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                        </svg>
                                    </button>

                                    <GlassMenuPopover
                                        isOpen={showActionsMenu}
                                        onClose={() => setShowActionsMenu(false)}
                                        widthClass="w-52"
                                        topClass="top-full mt-1.5"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                handleExportCategories();
                                            }}
                                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                        >
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                            <span>Xuất file Excel</span>
                                        </button>

                                        <label className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors">
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                            <span>Nhập từ Excel</span>
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls"
                                                onChange={(e) => {
                                                    void handleImportFile(e, 'category');
                                                    setShowActionsMenu(false);
                                                }}
                                                className="hidden"
                                            />
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                void handleDownloadCategoryTemplate();
                                            }}
                                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                        >
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-4 h-4 object-contain shrink-0" />
                                            <span>Tải file mẫu Excel</span>
                                        </button>
                                    </GlassMenuPopover>
                                </div>

                                <AdminButton
                                    variant="primary"
                                    icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />}
                                    onClick={() => {
                                        setEditingCategoryId(null);
                                        setNewCategoryName('');
                                        setNewCategorySlug('');
                                        setNewCategoryIsFeatured(false);
                                        setIsCategoryFormVisible(true);
                                    }}
                                >
                                    Thêm mới
                                </AdminButton>
                            </div>
                        }
                    />

                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                        <AdminDataTable
                            columns={columns}
                            data={paginatedCategories}
                            rowKey={(c) => c.id}
                            emptyMessage="Không tìm thấy chuyên mục nào phù hợp."
                            onRowClick={(c) => handleStartEditCategory(c)}
                        />
                    </div>

                    {/* Mobile List View */}
                    <div className="block lg:hidden">
                        <div className="rounded-2xl border border-white/70 bg-card/85 backdrop-blur-2xl dark:border-white/10 divide-y divide-border/40 overflow-hidden">
                            {paginatedCategories.length === 0 ? (
                                <div className="p-6 text-center text-xs text-muted-foreground">
                                    Không tìm thấy chuyên mục nào phù hợp.
                                </div>
                            ) : (
                                paginatedCategories.map((cat) => (
                                    <article key={cat.id} className="py-2.5 px-3 transition-colors hover:bg-muted/10">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void onSaveCategory({ ...cat, is_featured: !cat.is_featured })}
                                                    title={cat.is_featured ? 'Bỏ khỏi Trang Chủ' : 'Đưa lên Trang Chủ'}
                                                    className={`text-base transition-all active:scale-95 shrink-0 ${
                                                        cat.is_featured ? 'scale-110 text-yellow-500' : 'text-gray-300 grayscale'
                                                    }`}
                                                >
                                                    ⭐
                                                </button>
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-bold text-foreground">{cat.name}</p>
                                                    <p className="font-mono text-[11px] text-muted-foreground truncate">{cat.slug}</p>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    onClick={() => handleStartEditCategory(cat)}
                                                    className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-primary active:scale-95"
                                                    title="Sửa"
                                                >
                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-4 h-4 object-contain" />
                                                </button>
                                                <button
                                                    onClick={() => void onDeleteCategory(cat.id)}
                                                    className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive active:scale-95"
                                                    title="Xóa"
                                                >
                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-4 h-4 object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    <AdminPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredCategories.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
};

export default AdminProductCategoryList;
