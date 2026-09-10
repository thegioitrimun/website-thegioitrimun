import React from 'react';
import type { GhtkPickAddress } from '../../../types';
import Spinner from '../../Spinner';
import {
    AdminStatusBadge,
    AdminButton,
} from '..';
import { useToast } from '../../../hooks/useToast';

export interface AdminGhtkSettingsProps {
    ghtkConnectionStatus: 'ready' | 'missing_token' | 'error' | 'unknown';
    pickAddresses: GhtkPickAddress[];
    isLoadingAddresses: boolean;
    ghtkWebhookSampleUrl: string;
    selectedAddressDetail: GhtkPickAddress | null;
    isLoadingAddressDetail: boolean;
    handleFetchPickAddresses: () => Promise<void>;
    handleViewAddressDetail: (addr: GhtkPickAddress) => void;
    setSelectedAddressDetail: (addr: GhtkPickAddress | null) => void;
}

export const AdminGhtkSettings: React.FC<AdminGhtkSettingsProps> = ({
    ghtkConnectionStatus,
    pickAddresses,
    isLoadingAddresses,
    ghtkWebhookSampleUrl,
    selectedAddressDetail,
    isLoadingAddressDetail,
    handleFetchPickAddresses,
    handleViewAddressDetail,
    setSelectedAddressDetail,
}) => {
    const { addToast } = useToast();

    const connectionBadgeTone =
        ghtkConnectionStatus === 'ready'
            ? 'emerald'
            : ghtkConnectionStatus === 'missing_token'
            ? 'amber'
            : ghtkConnectionStatus === 'error'
            ? 'rose'
            : 'slate';

    const connectionLabel =
        ghtkConnectionStatus === 'ready'
            ? 'Đã kết nối'
            : ghtkConnectionStatus === 'missing_token'
            ? 'Chưa có Token'
            : ghtkConnectionStatus === 'error'
            ? 'Lỗi kết nối'
            : 'Chưa kiểm tra';

    return (
        <div className="space-y-4">
            {/* 1. Header & Status Card */}
            <div className="admin-surface rounded-2xl sm:rounded-[1.7rem] border p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">Giao Hàng Tiết Kiệm (GHTK)</span>
                        <AdminStatusBadge tone={connectionBadgeTone} label={connectionLabel} />
                        <span className="text-xs text-muted-foreground">• {pickAddresses.length} kho lấy hàng</span>
                    </div>

                    <AdminButton
                        variant="secondary"
                        onClick={() => void handleFetchPickAddresses()}
                        disabled={isLoadingAddresses}
                        loading={isLoadingAddresses}
                    >
                        Tải lại kho
                    </AdminButton>
                </div>
            </div>

            {/* 2. Webhook Configuration Card */}
            <div className="admin-surface rounded-2xl sm:rounded-[1.7rem] border p-4 sm:p-6">
                <div className="pb-3 border-b border-border/40 mb-4">
                    <h3 className="text-base font-bold text-foreground">Webhook URL Cập nhật vận đơn tự động</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Sao chép URL này dán vào cấu hình Webhook tài khoản GHTK để đồng bộ trạng thái đơn hàng thời gian thực.
                    </p>
                </div>

                <div className="space-y-3 max-w-3xl">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-xl bg-background/40 backdrop-blur-xl border border-border/60 shadow-inner">
                        <input
                            type="text"
                            readOnly
                            value={ghtkWebhookSampleUrl}
                            className="bg-transparent flex-1 px-2.5 py-1.5 text-xs font-mono text-foreground select-all outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(ghtkWebhookSampleUrl);
                                addToast('Đã sao chép Webhook URL GHTK', { type: 'success' });
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 active:scale-95 transition-all shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                            <span>Sao chép URL</span>
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="font-semibold text-primary">Bảo mật:</span>
                        Token xác thực webhook được bảo vệ qua biến môi trường bí mật Cloudflare Worker và tự động kiểm tra chữ ký dữ liệu.
                    </p>
                </div>
            </div>

            {/* 3. Pick Addresses Card */}
            <div className="admin-surface rounded-2xl sm:rounded-[1.7rem] border p-4 sm:p-6">
                <div className="pb-3 border-b border-border/40 mb-4">
                    <h3 className="text-base font-bold text-foreground">Kho & Địa chỉ lấy hàng ({pickAddresses.length})</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Danh sách các bưu cục / kho hàng đã liên kết trên hệ thống GHTK.</p>
                </div>

                {isLoadingAddresses ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : pickAddresses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {pickAddresses.map((addr) => (
                            <div
                                key={addr.pick_address_id}
                                className={`p-4 rounded-2xl border transition-all ${
                                    addr.is_default
                                        ? 'border-primary/50 bg-primary/10 shadow-xs'
                                        : 'border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10'
                                }`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-foreground truncate">{addr.pick_name}</p>
                                            {addr.is_default && (
                                                <AdminStatusBadge tone="emerald" label="Mặc định" />
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{addr.pick_address}</p>
                                        <p className="text-xs text-muted-foreground font-mono mt-1">SĐT: {addr.pick_tel}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleViewAddressDetail(addr)}
                                        className="inline-flex items-center px-3 py-1.5 rounded-xl border border-border/60 bg-background/50 text-xs font-semibold text-primary hover:bg-card active:scale-95 transition-all shrink-0"
                                    >
                                        Chi tiết
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                        Chưa có dữ liệu kho. Nhấn nút &quot;Tải lại kho&quot; để đồng bộ từ GHTK.
                    </div>
                )}
            </div>

            {/* Address detail modal */}
            {selectedAddressDetail && (
                <div
                    className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setSelectedAddressDetail(null)}
                >
                    <div
                        className="bg-card rounded-2xl border border-border/80 shadow-2xl w-full max-w-lg m-auto animate-scale-in overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-4 border-b border-border">
                            <h3 className="text-base font-bold text-foreground">Chi tiết địa chỉ lấy hàng</h3>
                            <button
                                onClick={() => setSelectedAddressDetail(null)}
                                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            {isLoadingAddressDetail ? (
                                <div className="flex justify-center p-8"><Spinner /></div>
                            ) : (
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
                                    <dt className="font-medium text-muted-foreground">Tên điểm lấy</dt>
                                    <dd className="font-semibold text-foreground">{selectedAddressDetail.pick_name}</dd>

                                    <dt className="font-medium text-muted-foreground">Địa chỉ</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.pick_address}</dd>

                                    <dt className="font-medium text-muted-foreground">Phường/Xã</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.pick_ward}</dd>

                                    <dt className="font-medium text-muted-foreground">Quận/Huyện</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.pick_district}</dd>

                                    <dt className="font-medium text-muted-foreground">Tỉnh/Thành</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.pick_province}</dd>

                                    <dt className="font-medium text-muted-foreground">Điện thoại</dt>
                                    <dd className="font-mono text-foreground">{selectedAddressDetail.pick_tel}</dd>

                                    <dt className="font-medium text-muted-foreground">Email</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.pick_email || 'N/A'}</dd>

                                    <dt className="font-medium text-muted-foreground">Mặc định</dt>
                                    <dd className="text-foreground">{selectedAddressDetail.is_default ? 'Có' : 'Không'}</dd>
                                </dl>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminGhtkSettings;
