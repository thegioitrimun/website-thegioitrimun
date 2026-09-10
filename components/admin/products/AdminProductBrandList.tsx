import { AdminDesktopOnly } from '../AdminResponsive';
import React, { useState } from 'react';
import type { ProductBrand } from '../../../types';
import Spinner from '../../Spinner';
import {
    AdminToolbar,
    AdminDataTable,
    AdminColumn,
    AdminPagination,
    AdminButton,
    AdminIconButton,
} from '..';

const generateSlug = (title: string) =>
    title
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

export interface AdminProductBrandListProps {
    brands: ProductBrand[];
    filteredBrands: ProductBrand[];
    brandSearchQuery: string;
    setBrandSearchQuery: (query: string) => void;

    isBrandFormVisible: boolean;
    setIsBrandFormVisible: (visible: boolean) => void;
    editingBrandId: number | null;
    editingBrand: ProductBrand | null;
    isSavingBrand: boolean;

    newBrandName: string;
    setNewBrandName: (name: string) => void;
    newBrandSlug: string;
    setNewBrandSlug: (slug: string) => void;
    newBrandDescription: string;
    setNewBrandDescription: (desc: string) => void;
    newBrandImage: File | null;
    setNewBrandImage: (file: File | null) => void;
    newBrandPreviewUrl: string | null;
    setNewBrandPreviewUrl?: (url: string | null) => void;

    editBrandName: string;
    setEditBrandName: (name: string) => void;
    editBrandSlug: string;
    setEditBrandSlug: (slug: string) => void;
    editBrandDescription: string;
    setEditBrandDescription: (desc: string) => void;
    editBrandImage: File | null;
    setEditBrandImage: (file: File | null) => void;
    editBrandPreviewUrl: string | null;
    setEditBrandPreviewUrl?: (url: string | null) => void;

    handleStartEditBrand: (brand: ProductBrand) => void;
    handleCancelEditBrand: () => void;
    handleAddNewBrand: (e: React.FormEvent) => Promise<void>;
    handleSaveEditBrand: () => Promise<void>;
    onDeleteBrand: (brandId: number) => Promise<void> | void;
}

export const AdminProductBrandList: React.FC<AdminProductBrandListProps> = ({
    brands,
    filteredBrands,
    brandSearchQuery,
    setBrandSearchQuery,

    isBrandFormVisible,
    setIsBrandFormVisible,
    editingBrandId,
    editingBrand,
    isSavingBrand,

    newBrandName,
    setNewBrandName,
    newBrandSlug,
    setNewBrandSlug,
    newBrandDescription,
    setNewBrandDescription,
    newBrandImage,
    setNewBrandImage,
    newBrandPreviewUrl,
    setNewBrandPreviewUrl,

    editBrandName,
    setEditBrandName,
    editBrandSlug,
    setEditBrandSlug,
    editBrandDescription,
    setEditBrandDescription,
    editBrandImage,
    setEditBrandImage,
    editBrandPreviewUrl,
    setEditBrandPreviewUrl,

    handleStartEditBrand,
    handleCancelEditBrand,
    handleAddNewBrand,
    handleSaveEditBrand,
    onDeleteBrand,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 30;

    const totalPages = Math.ceil(filteredBrands.length / pageSize) || 1;
    const paginatedBrands = filteredBrands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const isFormOpen = isBrandFormVisible || Boolean(editingBrandId);

    const getBrandInitials = (name: string) => {
        return name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'TH';
    };

    const columns: AdminColumn<ProductBrand>[] = [
        {
            id: 'brand',
            label: 'Thương hiệu',
            width: '45%',
            render: (brand) => (
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xl p-1 shadow-xs flex items-center justify-center overflow-hidden">
                        {brand.logo_url ? (
                            <img
                                src={brand.logo_url}
                                alt={brand.name}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-xs font-bold text-muted-foreground">
                                {getBrandInitials(brand.name)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{brand.name}</p>
                        <p className="font-mono text-xs text-muted-foreground truncate">{brand.slug}</p>
                    </div>
                </div>
            ),
        },
        {
            id: 'description',
            label: 'Mô tả',
            width: '40%',
            render: (brand) => (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                    {brand.description || 'Chưa có mô tả cho thương hiệu này.'}
                </p>
            ),
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '15%',
            align: 'right',
            render: (brand) => (
                <div className="flex items-center justify-end gap-1">
                    <AdminIconButton
                        label="Sửa thương hiệu"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => handleStartEditBrand(brand)}
                    />
                    <AdminIconButton
                        label="Xóa thương hiệu"
                        variant="destructive"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => void onDeleteBrand(brand.id)}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            {isFormOpen ? (
                <div className="admin-surface w-full rounded-2xl sm:rounded-[1.75rem] border p-4 sm:p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-5">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsBrandFormVisible(false);
                                    handleCancelEditBrand();
                                }}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                                title="Quay lại danh sách thương hiệu"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <div>
                                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Thương hiệu</p>
                                <h3 className="text-xl sm:text-2xl font-black text-foreground">
                                    {editingBrandId ? `Cập nhật thương hiệu: ${editBrandName || '...'}` : 'Tạo thương hiệu mới'}
                                </h3>
                            </div>
                        </div>
                        <AdminButton
                            variant="secondary"
                            onClick={() => {
                                setIsBrandFormVisible(false);
                                handleCancelEditBrand();
                            }}
                        >
                            Hủy
                        </AdminButton>
                    </div>

                    {/* Logo Preview area */}
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[1.45rem] border border-dashed p-4 sm:p-6 text-center border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card/70 to-sky-100/50 dark:to-slate-900/50 mb-5">
                        <div className="admin-surface w-28 h-28 sm:w-32 sm:h-32 rounded-[1.25rem] border overflow-hidden flex items-center justify-center p-3">
                            {editingBrandId ? (
                                editBrandPreviewUrl ? (
                                    <img src={editBrandPreviewUrl} alt="Preview logo thương hiệu" className="w-full h-full object-contain" />
                                ) : editingBrand?.logo_url ? (
                                    <img src={editingBrand.logo_url} alt={editingBrand.name} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center px-2">
                                        <p className="text-xs font-semibold text-muted-foreground">Chưa có logo</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Tải logo ở bên dưới</p>
                                    </div>
                                )
                            ) : newBrandPreviewUrl ? (
                                <img src={newBrandPreviewUrl} alt="Preview logo mới" className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-center px-2">
                                    <p className="text-xs font-semibold text-muted-foreground">Preview logo</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Logo hiển thị tại đây</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <form
                        onSubmit={(e) => {
                            if (editingBrandId) {
                                e.preventDefault();
                                void handleSaveEditBrand();
                            } else {
                                void handleAddNewBrand(e);
                            }
                        }}
                        className="space-y-4 max-w-2xl"
                    >
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Tên thương hiệu <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={editingBrandId ? editBrandName : newBrandName}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (editingBrandId) {
                                        setEditBrandName(value);
                                    } else {
                                        setNewBrandName(value);
                                        setNewBrandSlug(generateSlug(value));
                                    }
                                }}
                                className="w-full admin-glass-input"
                                placeholder="Ví dụ: La Roche-Posay"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Slug đường dẫn <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={editingBrandId ? editBrandSlug : newBrandSlug}
                                onChange={(e) => {
                                    if (editingBrandId) {
                                        setEditBrandSlug(e.target.value);
                                    } else {
                                        setNewBrandSlug(e.target.value);
                                    }
                                }}
                                className="w-full admin-glass-input font-mono text-xs"
                                placeholder="la-roche-posay"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Mô tả thương hiệu
                            </label>
                            <textarea
                                value={editingBrandId ? editBrandDescription : newBrandDescription}
                                onChange={(e) => {
                                    if (editingBrandId) {
                                        setEditBrandDescription(e.target.value);
                                    } else {
                                        setNewBrandDescription(e.target.value);
                                    }
                                }}
                                rows={3}
                                className="w-full admin-glass-input text-xs"
                                placeholder="Mô tả tóm tắt về thương hiệu, nguồn gốc, định vị..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Tải lên logo ảnh
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    if (editingBrandId) {
                                        setEditBrandImage(file);
                                        setEditBrandPreviewUrl(file ? URL.createObjectURL(file) : null);
                                    } else {
                                        setNewBrandImage(file);
                                        setNewBrandPreviewUrl(file ? URL.createObjectURL(file) : null);
                                    }
                                }}
                                className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-3">
                            <AdminButton
                                variant="primary"
                                type="submit"
                                loading={isSavingBrand}
                            >
                                {editingBrandId ? 'Lưu thay đổi' : 'Tạo thương hiệu'}
                            </AdminButton>
                            <AdminButton
                                variant="secondary"
                                type="button"
                                onClick={() => {
                                    setIsBrandFormVisible(false);
                                    handleCancelEditBrand();
                                }}
                            >
                                Hủy
                            </AdminButton>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    <AdminToolbar
                        searchValue={brandSearchQuery}
                        onSearchChange={setBrandSearchQuery}
                        searchPlaceholder="Tìm theo tên thương hiệu, slug..."
                        actions={
                            <AdminButton
                                variant="primary"
                                icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />}
                                onClick={() => {
                                    setIsBrandFormVisible(true);
                                }}
                            >
                                Thêm mới
                            </AdminButton>
                        }
                    />

                    {/* Desktop Table */}
                    <AdminDesktopOnly className="hidden lg:block">
                        <AdminDataTable
                            columns={columns}
                            data={paginatedBrands}
                            rowKey={(b) => b.id}
                            emptyMessage="Không tìm thấy thương hiệu nào phù hợp."
                            onRowClick={(b) => handleStartEditBrand(b)}
                        />
                    </AdminDesktopOnly>

                    {/* Mobile List */}
                    <div className="block lg:hidden">
                        <div className="rounded-2xl border border-white/70 bg-card/85 backdrop-blur-2xl dark:border-white/10 divide-y divide-border/40 overflow-hidden">
                            {paginatedBrands.length === 0 ? (
                                <div className="p-6 text-center text-xs text-muted-foreground">
                                    Không tìm thấy thương hiệu nào phù hợp.
                                </div>
                            ) : (
                                paginatedBrands.map((b) => (
                                    <article key={b.id} className="py-2.5 px-3 transition-colors hover:bg-muted/10">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <div className="h-10 w-10 shrink-0 rounded-xl border border-border/70 bg-card/50 p-1 flex items-center justify-center overflow-hidden">
                                                    {b.logo_url ? (
                                                        <img src={b.logo_url} alt={b.name} className="h-full w-full object-contain" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-muted-foreground">{getBrandInitials(b.name)}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-bold text-foreground">{b.name}</p>
                                                    <p className="font-mono text-[11px] text-muted-foreground truncate">{b.slug}</p>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    onClick={() => handleStartEditBrand(b)}
                                                    className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-primary active:scale-95"
                                                    title="Sửa"
                                                >
                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-4 h-4 object-contain" />
                                                </button>
                                                <button
                                                    onClick={() => void onDeleteBrand(b.id)}
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

                    <AdminPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredBrands.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
};

export default AdminProductBrandList;
