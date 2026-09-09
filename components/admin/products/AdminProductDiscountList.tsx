import React, { useState } from 'react';
import type { DiscountCode } from '../../../types';
import Spinner from '../../Spinner';
import {
    AdminToolbar,
    AdminDataTable,
    AdminColumn,
    AdminPagination,
    AdminStatusBadge,
    AdminButton,
    AdminIconButton,
} from '..';
import { GlassFilterButton, GlassMenuPopover } from '../../GlassInputs';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export interface AdminProductDiscountListProps {
    discountCodes: DiscountCode[];
    filteredDiscountCodes: DiscountCode[];
    discountSummary: {
        total: number;
        active: number;
        inactive: number;
        expiringSoon: number;
    };
    discountSearchQuery: string;
    setDiscountSearchQuery: (query: string) => void;
    discountFilter: 'all' | 'active' | 'inactive' | 'percentage' | 'fixed_amount';
    setDiscountFilter: React.Dispatch<React.SetStateAction<'all' | 'active' | 'inactive' | 'percentage' | 'fixed_amount'>>;

    isDiscountFormVisible: boolean;
    setIsDiscountFormVisible: (visible: boolean) => void;
    editingDiscountId: string | null;
    discountForm: {
        code: string;
        description: string;
        type: DiscountCode['type'];
        value: string;
        min_purchase_amount: string;
        max_discount_amount: string;
        usage_limit: string;
        usage_limit_per_user: string;
        starts_at: string;
        ends_at: string;
        is_active: boolean;
    };
    setDiscountForm: React.Dispatch<React.SetStateAction<{
        code: string;
        description: string;
        type: DiscountCode['type'];
        value: string;
        min_purchase_amount: string;
        max_discount_amount: string;
        usage_limit: string;
        usage_limit_per_user: string;
        starts_at: string;
        ends_at: string;
        is_active: boolean;
    }>>;

    isSavingDiscountCode: boolean;
    isLoadingDiscountCodes: boolean;
    deletingDiscountId: string | null;

    handleStartEditDiscount: (discount: DiscountCode) => void;
    resetDiscountForm: () => void;
    handleSaveDiscountCode: (e: React.FormEvent) => Promise<void>;
    handleDeleteDiscountCode: (discount: DiscountCode) => Promise<void>;
    loadDiscountCodes: () => Promise<void>;
}

export const AdminProductDiscountList: React.FC<AdminProductDiscountListProps> = ({
    discountCodes,
    filteredDiscountCodes,
    discountSummary,
    discountSearchQuery,
    setDiscountSearchQuery,
    discountFilter,
    setDiscountFilter,

    isDiscountFormVisible,
    setIsDiscountFormVisible,
    editingDiscountId,
    discountForm,
    setDiscountForm,

    isSavingDiscountCode,
    isLoadingDiscountCodes,
    deletingDiscountId,

    handleStartEditDiscount,
    resetDiscountForm,
    handleSaveDiscountCode,
    handleDeleteDiscountCode,
    loadDiscountCodes,
}) => {
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 30;

    const totalPages = Math.ceil(filteredDiscountCodes.length / pageSize) || 1;
    const paginatedDiscounts = filteredDiscountCodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const isFormOpen = isDiscountFormVisible || Boolean(editingDiscountId);

    const getDiscountStatus = (d: DiscountCode): { tone: 'emerald' | 'sky' | 'amber' | 'slate'; label: string } => {
        if (!d.is_active) return { tone: 'slate', label: 'Đang tắt' };
        const now = new Date().getTime();
        if (d.starts_at && new Date(d.starts_at).getTime() > now) {
            return { tone: 'sky', label: 'Sắp diễn ra' };
        }
        if (d.ends_at && new Date(d.ends_at).getTime() < now) {
            return { tone: 'amber', label: 'Hết hạn' };
        }
        return { tone: 'emerald', label: 'Còn hiệu lực' };
    };

    const columns: AdminColumn<DiscountCode>[] = [
        {
            id: 'code',
            label: 'Mã voucher',
            width: '24%',
            render: (d) => (
                <div>
                    <span className="font-mono text-xs font-black text-foreground">{d.code}</span>
                    {d.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{d.description}</p>
                    )}
                </div>
            ),
        },
        {
            id: 'value',
            label: 'Mức giảm',
            width: '18%',
            render: (d) => (
                <div>
                    <span className="text-xs font-bold text-primary">
                        {d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}
                    </span>
                    {d.max_discount_amount ? (
                        <p className="text-[10px] text-muted-foreground">Tối đa {formatCurrency(d.max_discount_amount)}</p>
                    ) : null}
                </div>
            ),
        },
        {
            id: 'condition',
            label: 'Điều kiện',
            width: '18%',
            render: (d) => (
                <div className="text-xs">
                    <p className="text-muted-foreground">Đơn tối thiểu: <span className="font-semibold text-foreground">{formatCurrency(d.min_purchase_amount || 0)}</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Mỗi khách: {d.usage_limit_per_user ?? 'Không giới hạn'}</p>
                </div>
            ),
        },
        {
            id: 'usage',
            label: 'Lượt dùng',
            width: '14%',
            render: (d) => (
                <span className="text-xs font-semibold text-foreground">
                    {d.usage_count ?? 0} {d.usage_limit ? `/ ${d.usage_limit}` : '/ ∞'}
                </span>
            ),
        },
        {
            id: 'status',
            label: 'Trạng thái',
            width: '14%',
            render: (d) => {
                const status = getDiscountStatus(d);
                return <AdminStatusBadge tone={status.tone} label={status.label} />;
            },
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '12%',
            align: 'right',
            render: (d) => (
                <div className="flex items-center justify-end gap-1">
                    <AdminIconButton
                        label="Sửa mã"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => handleStartEditDiscount(d)}
                    />
                    <AdminIconButton
                        label="Xóa mã"
                        variant="destructive"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => void handleDeleteDiscountCode(d)}
                        disabled={deletingDiscountId === d.id}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            {isFormOpen ? (
                <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
                    <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-5">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <button
                                type="button"
                                onClick={resetDiscountForm}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                                title="Quay lại danh sách mã giảm giá"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <div>
                                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Mã giảm giá</p>
                                <h3 className="text-xl sm:text-2xl font-black text-foreground">
                                    {editingDiscountId ? `Cập nhật mã: ${discountForm.code}` : 'Tạo mã giảm giá mới'}
                                </h3>
                            </div>
                        </div>
                        <AdminButton variant="secondary" onClick={resetDiscountForm}>
                            Hủy
                        </AdminButton>
                    </div>

                    <form onSubmit={handleSaveDiscountCode} className="space-y-4 max-w-2xl">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Mã giảm giá <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={discountForm.code}
                                onChange={(e) => setDiscountForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                                className="w-full admin-glass-input font-mono uppercase text-sm font-bold"
                                placeholder="VD: ISKIN10"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Loại giảm</label>
                                <select
                                    value={discountForm.type}
                                    onChange={(e) =>
                                        setDiscountForm((prev) => ({
                                            ...prev,
                                            type: e.target.value as DiscountCode['type'],
                                            max_discount_amount: e.target.value === 'fixed_amount' ? '' : prev.max_discount_amount,
                                        }))
                                    }
                                    className="w-full admin-glass-input"
                                >
                                    <option value="percentage">Theo phần trăm (%)</option>
                                    <option value="fixed_amount">Theo số tiền (VND)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    Giá trị giảm <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step={discountForm.type === 'percentage' ? 0.01 : 1000}
                                    value={discountForm.value}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, value: e.target.value }))}
                                    className="w-full admin-glass-input"
                                    placeholder={discountForm.type === 'percentage' ? '10' : '50000'}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Đơn tối thiểu (VND)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={discountForm.min_purchase_amount}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, min_purchase_amount: e.target.value }))}
                                    className="w-full admin-glass-input"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Giảm tối đa (VND)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={discountForm.max_discount_amount}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, max_discount_amount: e.target.value }))}
                                    className="w-full admin-glass-input"
                                    placeholder={discountForm.type === 'percentage' ? 'Không bắt buộc' : 'Không áp dụng'}
                                    disabled={discountForm.type !== 'percentage'}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Giới hạn tổng lượt</label>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={discountForm.usage_limit}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, usage_limit: e.target.value }))}
                                    className="w-full admin-glass-input"
                                    placeholder="Để trống = không giới hạn"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Giới hạn mỗi khách</label>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={discountForm.usage_limit_per_user}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, usage_limit_per_user: e.target.value }))}
                                    className="w-full admin-glass-input"
                                    placeholder="Để trống = không giới hạn"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Bắt đầu hiệu lực</label>
                                <input
                                    type="datetime-local"
                                    value={discountForm.starts_at}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                                    className="w-full admin-glass-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Kết thúc hiệu lực</label>
                                <input
                                    type="datetime-local"
                                    value={discountForm.ends_at}
                                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, ends_at: e.target.value }))}
                                    className="w-full admin-glass-input"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Mô tả chương trình</label>
                            <textarea
                                value={discountForm.description}
                                onChange={(e) => setDiscountForm((prev) => ({ ...prev, description: e.target.value }))}
                                className="w-full admin-glass-input min-h-20 text-xs"
                                placeholder="Ví dụ: Áp dụng chiến dịch ưu đãi hè..."
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                id="discount_is_active"
                                type="checkbox"
                                checked={discountForm.is_active}
                                onChange={(e) => setDiscountForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="discount_is_active" className="text-sm font-semibold cursor-pointer select-none">
                                Kích hoạt mã giảm giá ngay
                            </label>
                        </div>

                        <div className="flex items-center gap-3 pt-3">
                            <AdminButton
                                variant="primary"
                                type="submit"
                                loading={isSavingDiscountCode}
                            >
                                {editingDiscountId ? 'Cập nhật mã' : 'Tạo mã giảm giá'}
                            </AdminButton>
                            <AdminButton
                                variant="secondary"
                                type="button"
                                onClick={resetDiscountForm}
                            >
                                Hủy
                            </AdminButton>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    <AdminToolbar
                        searchValue={discountSearchQuery}
                        onSearchChange={setDiscountSearchQuery}
                        searchPlaceholder="Tìm theo mã code, mô tả..."
                        filterActive={discountFilter !== 'all'}
                        filterCount={discountFilter !== 'all' ? 1 : 0}
                        filterOpen={showFilterMenu}
                        onToggleFilter={() => setShowFilterMenu(!showFilterMenu)}
                        actions={
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0">
                                    <GlassFilterButton
                                        onClick={() => setShowFilterMenu((prev) => !prev)}
                                        isActive={discountFilter !== 'all'}
                                        title={
                                            discountFilter === 'all'
                                                ? 'Lọc mã giảm giá'
                                                : discountFilter === 'active'
                                                ? 'Đang lọc: Đang bật'
                                                : discountFilter === 'inactive'
                                                ? 'Đang lọc: Đang tắt'
                                                : discountFilter === 'percentage'
                                                ? 'Đang lọc: Theo %'
                                                : 'Đang lọc: Theo tiền'
                                        }
                                    />

                                    <GlassMenuPopover
                                        isOpen={showFilterMenu}
                                        onClose={() => setShowFilterMenu(false)}
                                        selectedValue={discountFilter}
                                        onSelect={(val) => { setShowFilterMenu(false); setDiscountFilter(val as any); }}
                                        items={[
                                            { value: 'all', label: 'Tất cả', count: discountCodes.length },
                                            { value: 'active', label: 'Đang bật', count: discountSummary.active },
                                            { value: 'inactive', label: 'Đang tắt', count: discountSummary.inactive },
                                            {
                                                value: 'percentage',
                                                label: 'Theo %',
                                                count: discountCodes.filter((d) => d.type === 'percentage').length,
                                            },
                                            {
                                                value: 'fixed_amount',
                                                label: 'Theo tiền (VND)',
                                                count: discountCodes.filter((d) => d.type === 'fixed_amount').length,
                                            },
                                        ]}
                                    />
                                </div>

                                <AdminIconButton
                                    label="Tải lại danh sách"
                                    icon={<Spinner className={isLoadingDiscountCodes ? 'w-4 h-4' : 'hidden'} />}
                                    onClick={() => void loadDiscountCodes()}
                                    disabled={isLoadingDiscountCodes}
                                />

                                <AdminButton
                                    variant="primary"
                                    icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />}
                                    onClick={() => {
                                        resetDiscountForm();
                                        setIsDiscountFormVisible(true);
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
                            data={paginatedDiscounts}
                            rowKey={(d) => d.id || d.code}
                            emptyMessage="Chưa có mã giảm giá nào phù hợp."
                            onRowClick={(d) => handleStartEditDiscount(d)}
                        />
                    </div>

                    {/* Mobile List View */}
                    <div className="block lg:hidden">
                        <div className="rounded-2xl border border-white/70 bg-card/85 backdrop-blur-2xl dark:border-white/10 divide-y divide-border/40 overflow-hidden">
                            {paginatedDiscounts.length === 0 ? (
                                <div className="p-6 text-center text-xs text-muted-foreground">
                                    Chưa có mã giảm giá nào phù hợp.
                                </div>
                            ) : (
                                paginatedDiscounts.map((discount) => {
                                    const status = getDiscountStatus(discount);
                                    return (
                                        <article key={discount.id || discount.code} className="py-2.5 px-3 transition-colors hover:bg-muted/10">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <span className="font-mono text-xs font-black text-foreground">{discount.code}</span>
                                                    {discount.description && (
                                                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{discount.description}</p>
                                                    )}
                                                </div>
                                                <AdminStatusBadge tone={status.tone} label={status.label} />
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                                                <div>
                                                    <span className="text-muted-foreground">Loại: </span>
                                                    <span className="font-bold">
                                                        {discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Đã dùng: </span>
                                                    <span className="font-bold">
                                                        {discount.usage_count ?? 0}
                                                        {discount.usage_limit ? ` / ${discount.usage_limit}` : ' / ∞'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Đơn min: </span>
                                                    <span className="font-bold">{formatCurrency(discount.min_purchase_amount || 0)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Mỗi khách: </span>
                                                    <span className="font-bold">{discount.usage_limit_per_user ?? '∞'}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 flex items-center justify-end gap-1 pt-1.5 border-t border-border/30">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEditDiscount(discount)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-foreground hover:bg-card border border-border/60 active:scale-95"
                                                >
                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="h-3.5 w-3.5 object-contain" />
                                                    Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteDiscountCode(discount)}
                                                    disabled={deletingDiscountId === discount.id}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-destructive hover:bg-destructive/10 border border-destructive/30 active:scale-95 disabled:opacity-50"
                                                >
                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-3.5 w-3.5 object-contain" />
                                                    Xóa
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <AdminPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredDiscountCodes.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
};

export default AdminProductDiscountList;
