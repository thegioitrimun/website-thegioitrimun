import React, { useState } from 'react';
import type { TaxProfile, TaxRate } from '../../../types';
import Spinner from '../../Spinner';
import {
    AdminDataTable,
    AdminColumn,
    AdminStatusBadge,
    AdminButton,
    AdminIconButton,
} from '..';

export interface TaxProfileFormState {
    code: string;
    name: string;
    tax_mode: TaxProfile['tax_mode'];
    default_rate: string;
    applies_to_shipping: boolean;
    currency: string;
    is_active: boolean;
    is_default: boolean;
    starts_at: string;
    ends_at: string;
}

export interface TaxRateFormState {
    tax_profile_id: string;
    province: string;
    district: string;
    rate: string;
    applies_to_shipping: 'inherit' | 'true' | 'false';
    currency: string;
    priority: string;
    is_active: boolean;
    starts_at: string;
    ends_at: string;
}

export interface AdminProductTaxSettingsProps {
    taxProfiles: TaxProfile[];
    allTaxRates: (TaxRate & { profile_code?: string; profile_name?: string })[];
    taxSummary: {
        totalProfiles: number;
        activeProfiles: number;
        defaultProfileName: string;
        totalOverrides: number;
    };
    isLoadingTaxSettings: boolean;
    isSavingTaxProfile: boolean;
    isSavingTaxRate: boolean;
    editingTaxProfileId: string | null;
    editingTaxRateId: string | null;
    deletingTaxProfileId: string | null;
    deletingTaxRateId: string | null;

    taxProfileForm: TaxProfileFormState;
    setTaxProfileForm: React.Dispatch<React.SetStateAction<TaxProfileFormState>>;
    taxRateForm: TaxRateFormState;
    setTaxRateForm: React.Dispatch<React.SetStateAction<TaxRateFormState>>;

    loadTaxSettings: () => Promise<void>;
    resetTaxProfileForm: () => void;
    resetTaxRateForm: (profileId?: string) => void;
    handleStartEditTaxProfile: (profile: TaxProfile) => void;
    handleStartEditTaxRate: (rate: TaxRate) => void;
    handleSaveTaxProfile: (e: React.FormEvent) => Promise<void>;
    handleSaveTaxRate: (e: React.FormEvent) => Promise<void>;
    handleDeleteTaxProfile: (profile: TaxProfile) => Promise<void>;
    handleDeleteTaxRate: (rate: TaxRate) => Promise<void>;
}

export const AdminProductTaxSettings: React.FC<AdminProductTaxSettingsProps> = ({
    taxProfiles,
    allTaxRates,
    taxSummary,
    isLoadingTaxSettings,
    isSavingTaxProfile,
    isSavingTaxRate,
    editingTaxProfileId,
    editingTaxRateId,
    deletingTaxProfileId,
    deletingTaxRateId,

    taxProfileForm,
    setTaxProfileForm,
    taxRateForm,
    setTaxRateForm,

    loadTaxSettings,
    resetTaxProfileForm,
    resetTaxRateForm,
    handleStartEditTaxProfile,
    handleStartEditTaxRate,
    handleSaveTaxProfile,
    handleSaveTaxRate,
    handleDeleteTaxProfile,
    handleDeleteTaxRate,
}) => {
    const [subTab, setSubTab] = useState<'profiles' | 'rates'>('profiles');

    const profileColumns: AdminColumn<TaxProfile>[] = [
        {
            id: 'code',
            label: 'Mã hồ sơ',
            width: '20%',
            render: (p) => (
                <div>
                    <span className="font-mono text-xs font-bold text-foreground">{p.code}</span>
                    <p className="text-xs text-muted-foreground">{p.name}</p>
                </div>
            ),
        },
        {
            id: 'rate',
            label: 'Thuế chuẩn',
            width: '15%',
            render: (p) => (
                <span className="text-xs font-bold text-primary">
                    {Math.round((p.default_rate || 0) * 100)}%
                </span>
            ),
        },
        {
            id: 'mode',
            label: 'Phương thức',
            width: '20%',
            render: (p) => (
                <span className="text-xs text-foreground font-medium">
                    {p.tax_mode === 'inclusive' ? 'Đã gồm thuế (Inclusive)' : 'Chưa gồm thuế (Exclusive)'}
                </span>
            ),
        },
        {
            id: 'status',
            label: 'Trạng thái',
            width: '25%',
            render: (p) => (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <AdminStatusBadge tone={p.is_active ? 'emerald' : 'slate'} label={p.is_active ? 'Đang bật' : 'Đang tắt'} />
                    {p.is_default && <AdminStatusBadge tone="sky" label="Mặc định" />}
                </div>
            ),
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '20%',
            align: 'right',
            render: (p) => (
                <div className="flex items-center justify-end gap-1">
                    <AdminIconButton
                        label="Sửa hồ sơ"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => handleStartEditTaxProfile(p)}
                    />
                    <AdminIconButton
                        label="Xóa hồ sơ"
                        variant="destructive"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => void handleDeleteTaxProfile(p)}
                        disabled={deletingTaxProfileId === p.id}
                    />
                </div>
            ),
        },
    ];

    const rateColumns: AdminColumn<TaxRate & { profile_code?: string; profile_name?: string }>[] = [
        {
            id: 'profile',
            label: 'Hồ sơ',
            width: '20%',
            render: (r) => (
                <span className="text-xs font-mono font-bold text-foreground">
                    {r.profile_code || r.tax_profile_id}
                </span>
            ),
        },
        {
            id: 'location',
            label: 'Địa bàn áp dụng',
            width: '25%',
            render: (r) => (
                <span className="text-xs font-bold text-foreground">
                    {r.province || 'Toàn quốc'} {r.district ? ` • ${r.district}` : ''}
                </span>
            ),
        },
        {
            id: 'rate',
            label: 'Mức thuế ghi đè',
            width: '15%',
            render: (r) => (
                <span className="text-xs font-bold text-primary">
                    {Number(r.rate) > 1 ? `${r.rate}%` : `${Math.round((r.rate || 0) * 100)}%`}
                </span>
            ),
        },
        {
            id: 'priority',
            label: 'Độ ưu tiên',
            width: '12%',
            render: (r) => (
                <span className="text-xs font-mono text-muted-foreground">
                    {r.priority ?? 0}
                </span>
            ),
        },
        {
            id: 'status',
            label: 'Trạng thái',
            width: '13%',
            render: (r) => (
                <AdminStatusBadge
                    tone={r.is_active ? 'emerald' : 'rose'}
                    label={r.is_active ? 'Đang bật' : 'Tắt'}
                />
            ),
        },
        {
            id: 'actions',
            label: 'Thao tác',
            width: '15%',
            align: 'right',
            render: (r) => (
                <div className="flex items-center justify-end gap-1">
                    <AdminIconButton
                        label="Sửa mức thuế"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => handleStartEditTaxRate(r)}
                    />
                    <AdminIconButton
                        label="Xóa mức thuế"
                        variant="destructive"
                        icon={<img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-4 h-4 object-contain" />}
                        onClick={() => void handleDeleteTaxRate(r)}
                        disabled={deletingTaxRateId === r.id}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            {/* Top Toolbar card */}
            <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSubTab('profiles')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                subTab === 'profiles'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Hồ sơ thuế ({taxProfiles.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('rates')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                subTab === 'rates'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Ghi đè tỉnh thành ({allTaxRates.length})
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <AdminButton
                            variant="secondary"
                            onClick={() => void loadTaxSettings()}
                            disabled={isLoadingTaxSettings}
                            loading={isLoadingTaxSettings}
                        >
                            Tải lại
                        </AdminButton>
                    </div>
                </div>
            </div>

            {/* Sub-tab 1: Tax Profiles */}
            {subTab === 'profiles' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Form Card */}
                    <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
                            <h3 className="text-base font-bold text-foreground">
                                {editingTaxProfileId ? 'Cập nhật hồ sơ thuế' : 'Tạo hồ sơ thuế mới'}
                            </h3>
                            {editingTaxProfileId && (
                                <AdminButton variant="secondary" onClick={resetTaxProfileForm}>
                                    Hủy sửa
                                </AdminButton>
                            )}
                        </div>

                        <form onSubmit={handleSaveTaxProfile} className="space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Mã hồ sơ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={taxProfileForm.code}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                                        className="w-full admin-glass-input font-mono uppercase"
                                        placeholder="VAT_STANDARD"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Tên hồ sơ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={taxProfileForm.name}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                                        className="w-full admin-glass-input"
                                        placeholder="VAT tiêu chuẩn"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Phương thức</label>
                                    <select
                                        value={taxProfileForm.tax_mode}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, tax_mode: e.target.value as TaxProfile['tax_mode'] }))}
                                        className="w-full admin-glass-input"
                                    >
                                        <option value="exclusive">Exclusive (Chưa gồm)</option>
                                        <option value="inclusive">Inclusive (Đã gồm)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Thuế chuẩn (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        value={taxProfileForm.default_rate}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, default_rate: e.target.value }))}
                                        className="w-full admin-glass-input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tiền tệ</label>
                                    <input
                                        type="text"
                                        value={taxProfileForm.currency}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                                        className="w-full admin-glass-input font-mono uppercase"
                                        placeholder="VND"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={taxProfileForm.is_active}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    <span>Kích hoạt hồ sơ</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={taxProfileForm.is_default}
                                        onChange={(e) => setTaxProfileForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    <span>Hồ sơ mặc định</span>
                                </label>
                            </div>

                            <div className="pt-2">
                                <AdminButton
                                    variant="primary"
                                    type="submit"
                                    loading={isSavingTaxProfile}
                                >
                                    {editingTaxProfileId ? 'Lưu hồ sơ' : 'Tạo hồ sơ'}
                                </AdminButton>
                            </div>
                        </form>
                    </div>

                    {/* Table Card */}
                    <div className="space-y-2">
                        <AdminDataTable
                            columns={profileColumns}
                            data={taxProfiles}
                            rowKey={(p) => p.id}
                            emptyMessage="Chưa có hồ sơ thuế nào."
                        />
                    </div>
                </div>
            )}

            {/* Sub-tab 2: Tax Rates (Overrides) */}
            {subTab === 'rates' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Rate Form Card */}
                    <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
                            <h3 className="text-base font-bold text-foreground">
                                {editingTaxRateId ? 'Cập nhật mức ghi đè' : 'Thêm mức ghi đè địa bàn'}
                            </h3>
                            {editingTaxRateId && (
                                <AdminButton variant="secondary" onClick={() => resetTaxRateForm()}>
                                    Hủy sửa
                                </AdminButton>
                            )}
                        </div>

                        <form onSubmit={handleSaveTaxRate} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Hồ sơ thuế áp dụng</label>
                                <select
                                    value={taxRateForm.tax_profile_id}
                                    onChange={(e) => setTaxRateForm((prev) => ({ ...prev, tax_profile_id: e.target.value }))}
                                    className="w-full admin-glass-input text-xs"
                                    required
                                >
                                    <option value="">-- Chọn hồ sơ --</option>
                                    {taxProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tỉnh / Thành</label>
                                    <input
                                        type="text"
                                        value={taxRateForm.province}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, province: e.target.value }))}
                                        className="w-full admin-glass-input"
                                        placeholder="VD: Hồ Chí Minh"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Quận / Huyện</label>
                                    <input
                                        type="text"
                                        value={taxRateForm.district}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, district: e.target.value }))}
                                        className="w-full admin-glass-input"
                                        placeholder="Để trống = toàn tỉnh"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Mức thuế (%) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        value={taxRateForm.rate}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, rate: e.target.value }))}
                                        className="w-full admin-glass-input"
                                        placeholder="10"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Độ ưu tiên</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={taxRateForm.priority}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, priority: e.target.value }))}
                                        className="w-full admin-glass-input"
                                        placeholder="100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tính ship</label>
                                    <select
                                        value={taxRateForm.applies_to_shipping}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, applies_to_shipping: e.target.value as any }))}
                                        className="w-full admin-glass-input text-xs"
                                    >
                                        <option value="inherit">Kế thừa hồ sơ</option>
                                        <option value="true">Có tính thuế ship</option>
                                        <option value="false">Không tính thuế ship</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={taxRateForm.is_active}
                                        onChange={(e) => setTaxRateForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    <span>Kích hoạt mức ghi đè</span>
                                </label>
                            </div>

                            <div className="pt-2">
                                <AdminButton
                                    variant="primary"
                                    type="submit"
                                    loading={isSavingTaxRate}
                                >
                                    {editingTaxRateId ? 'Lưu mức ghi đè' : 'Thêm mức ghi đè'}
                                </AdminButton>
                            </div>
                        </form>
                    </div>

                    {/* Rate Table Card */}
                    <div className="space-y-2">
                        <AdminDataTable
                            columns={rateColumns}
                            data={allTaxRates}
                            rowKey={(r) => r.id}
                            emptyMessage="Chưa có mức thuế ghi đè nào."
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProductTaxSettings;
