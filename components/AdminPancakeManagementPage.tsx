import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import type { PancakeIntegrationStatus, PancakeSyncSettingKey } from '../services/api';
import { useToast } from '../hooks/useToast';
import {
  CheckCircleIcon,
  CogIcon,
  LoadingIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
} from './icons';
import { useAdminLayoutDispatch } from './AdminLayoutContext';

type ToggleDefinition = {
  key: PancakeSyncSettingKey;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const childToggles: ToggleDefinition[] = [
  {
    key: 'productsEnabled',
    title: 'Sản phẩm',
    description: 'Tên, SKU, giá, hình ảnh, biến thể và trạng thái hiển thị.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-20.webp" alt="Sản phẩm" className="h-6 w-6 object-contain" />,
  },
  {
    key: 'inventoryEnabled',
    title: 'Kho hàng',
    description: 'Số lượng tồn theo sản phẩm, biến thể và kho Pancake đã cấu hình.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-24.webp" alt="Kho hàng" className="h-6 w-6 object-contain" />,
  },
  {
    key: 'customersEnabled',
    title: 'Khách hàng',
    description: 'Đối chiếu theo số điện thoại, kèm email và địa chỉ khi có.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644972-Untitled-26.webp" alt="Khách hàng" className="h-6 w-6 object-contain" />,
  },
  {
    key: 'ordersEnabled',
    title: 'Đơn hàng',
    description: 'Mã đơn, mặt hàng, thuế, vận chuyển, thanh toán và trạng thái.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-22.webp" alt="Đơn hàng" className="h-6 w-6 object-contain" />,
  },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}> = ({ checked, disabled, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-60 ${
      checked
        ? 'justify-end border-primary bg-primary'
        : 'justify-start border-border/60 bg-card/30 backdrop-blur-md'
    }`}
  >
    <span className="block h-6 w-6 rounded-full bg-white shadow-sm transition-transform" />
  </button>
);

const AdminPancakeManagementPage: React.FC = () => {
  const setSidebarConfig = useAdminLayoutDispatch();
  const { addToast } = useToast();
  const [status, setStatus] = useState<PancakeIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      setStatus(await api.getPancakeIntegrationStatus());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái Pancake.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const activeSyncCount = useMemo(() => {
    if (!status?.settings.masterEnabled) return 0;
    return childToggles.filter((item) => status.settings[item.key]).length;
  }, [status]);

  const connected = useMemo(() => {
    if (!status) return false;
    return (
      status.config.enabled &&
      status.config.apiKeyConfigured &&
      status.config.shopConfigured &&
      status.config.warehouseConfigured &&
      status.config.queueConfigured
    );
  }, [status]);

  useEffect(() => {
    setSidebarConfig({
      eyebrow: 'TÍCH HỢP PANCAKE',
      title: 'Pancake POS',
      description: 'Điều khiển đồng bộ một chiều từ website D1 sang Pancake POS.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Pancake POS" className="h-8 w-8 object-contain" />,
      insights: [
        { label: 'Luồng hoạt động', value: `${activeSyncCount}/4`, hint: 'luồng dữ liệu D1' },
        { label: 'Đang chờ outbox', value: String(status?.queueSummary.pending || 0), hint: 'tác vụ trong hàng đợi' },
        { label: 'Trạng thái kết nối', value: connected ? 'Sẵn sàng' : 'Chưa đủ config', hint: status?.config.shopId ? `Shop #${status.config.shopId}` : 'Cần kiểm tra env' },
      ],
    });
  }, [activeSyncCount, connected, setSidebarConfig, status]);

  const updateSetting = async (key: PancakeSyncSettingKey) => {
    if (!status || busyKey) return;
    setBusyKey(key);
    const nextValue = !status.settings[key];
    try {
      const settings = await api.updatePancakeSyncSettings({ [key]: nextValue });
      setStatus((current) => (current ? { ...current, settings } : current));
      await loadStatus();
      addToast('Đã cập nhật đồng bộ Pancake', {
        description: `${nextValue ? 'Đã bật' : 'Đã tắt'} ${
          key === 'masterEnabled'
            ? 'đồng bộ toàn hệ thống'
            : childToggles.find((item) => item.key === key)?.title.toLowerCase()
        }.`,
        type: 'success',
      });
    } catch (updateError) {
      addToast('Không thể cập nhật công tắc', {
        description: updateError instanceof Error ? updateError.message : 'Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const testConnection = async () => {
    setBusyKey('connection');
    try {
      const result = await api.testPancakeConnection();
      addToast('Kết nối Pancake hoạt động', {
        description:
          result.configuredWarehouseFound === false
            ? 'Kết nối được nhưng chưa tìm thấy kho đã cấu hình.'
            : `Đã nhận ${result.warehouseCount} kho từ Pancake.`,
        type: result.configuredWarehouseFound === false ? 'info' : 'success',
      });
    } catch (connectionError) {
      addToast('Kết nối Pancake thất bại', {
        description: connectionError instanceof Error ? connectionError.message : 'Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const runManualSync = async (kind: 'products' | 'inventory' | 'customers' | 'orders') => {
    if (!window.confirm('Tác vụ này dùng cho bảo trì/backfill và có thể đồng bộ nhiều bản ghi. Tiếp tục?')) return;
    setBusyKey(`manual-${kind}`);
    try {
      const result =
        kind === 'products'
          ? await api.syncProductsToPancake()
          : kind === 'inventory'
          ? await api.syncInventoryToPancake()
          : kind === 'customers'
          ? await api.syncCustomersToPancake()
          : await api.syncOrdersToPancake();
      await loadStatus();
      addToast('Đã tạo tác vụ đồng bộ', {
        description: `${result.queued} tác vụ đã được đưa vào hàng đợi.`,
        type: 'success',
      });
    } catch (syncError) {
      addToast('Không thể đồng bộ thủ công', {
        description: syncError instanceof Error ? syncError.message : 'Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (isLoading && !status) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-36 animate-pulse rounded-[1.7rem] border border-border/40 bg-card/20 backdrop-blur-xl" />
        <div className="h-80 animate-pulse rounded-[1.7rem] border border-border/40 bg-card/20 backdrop-blur-xl" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="rounded-[1.7rem] border border-destructive/30 bg-destructive/10 backdrop-blur-xl p-8 text-center shadow-sm">
        <XCircleIcon className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Không thể tải Pancake POS</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  if (!status) return null;

  const manualActions = [
    {
      kind: 'products' as const,
      label: 'Đồng bộ sản phẩm',
      desc: 'Quét toàn bộ sản phẩm D1 và đẩy sang Pancake.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-20.webp" alt="Sản phẩm" className="h-6 w-6 object-contain" />,
      enabled: status.settings.masterEnabled && status.settings.productsEnabled,
    },
    {
      kind: 'inventory' as const,
      label: 'Đồng bộ tồn kho',
      desc: 'Cập nhật số lượng tồn kho theo kho Pancake.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-24.webp" alt="Kho hàng" className="h-6 w-6 object-contain" />,
      enabled: status.settings.masterEnabled && status.settings.inventoryEnabled,
    },
    {
      kind: 'customers' as const,
      label: 'Đồng bộ khách hàng',
      desc: 'Cập nhật danh sách khách hàng và số điện thoại.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644972-Untitled-26.webp" alt="Khách hàng" className="h-6 w-6 object-contain" />,
      enabled: status.settings.masterEnabled && status.settings.customersEnabled,
    },
    {
      kind: 'orders' as const,
      label: 'Đồng bộ đơn hàng',
      desc: 'Đẩy các đơn hàng mới/thay đổi sang Pancake.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-22.webp" alt="Đơn hàng" className="h-6 w-6 object-contain" />,
      enabled: status.settings.masterEnabled && status.settings.ordersEnabled,
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* HERO BANNER - Transparent Glassmorphism */}
      <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl px-5 py-6 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">TÍCH HỢP HỆ THỐNG</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">Pancake POS Integration</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
          Quản lý luồng đồng bộ dữ liệu một chiều từ website D1 sang Pancake POS, kiểm tra kết nối hệ thống và điều phối hàng đợi outbox.
        </p>
      </div>

      {/* CONNECTION STATUS CARD */}
      <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">TRẠNG THÁI KẾT NỐI</p>
            <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Kênh đồng bộ & Kết nối Pancake</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                connected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {connected ? 'Kết nối sẵn sàng' : 'Chưa cấu hình đủ'}
            </span>
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/20 backdrop-blur-md px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-all hover:bg-card/40 hover:border-primary/45 hover:text-primary disabled:opacity-60"
            >
              {busyKey === 'connection' ? <LoadingIcon className="h-4 w-4 animate-spin" /> : <CogIcon className="h-4 w-4" />}
              Kiểm tra kết nối
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm hover:bg-card/25 transition-all">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Shop ID</p>
            <p className="mt-2 truncate text-base font-bold text-foreground">{status.config.shopId || 'Chưa cấu hình'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Định danh cửa hàng Pancake</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm hover:bg-card/25 transition-all">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Warehouse ID</p>
            <p className="mt-2 truncate text-base font-bold text-foreground">{status.config.warehouseId || 'Chưa cấu hình'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Kho hàng mặc định đồng bộ</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm hover:bg-card/25 transition-all">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cloudflare Queue</p>
            <p className="mt-2 truncate text-base font-bold text-foreground">
              {status.config.queueConfigured ? 'Đã kết nối' : 'Chưa cấu hình'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Hàng đợi xử lý ngầm (PANCAKE_QUEUE)</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm hover:bg-card/25 transition-all">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Hướng đồng bộ</p>
            <p className="mt-2 truncate text-base font-bold text-primary">Website → Pancake</p>
            <p className="mt-1 text-xs text-muted-foreground">Đồng bộ một chiều từ D1</p>
          </div>
        </div>
      </section>

      {/* SYNC CONTROLS CARD */}
      <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">CẤU HÌNH ĐỒNG BỘ</p>
            <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Công tắc luồng dữ liệu</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bật công tắc giúp tự động đưa các thay đổi dữ liệu từ D1 vào hàng đợi đồng bộ.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/20 backdrop-blur-md px-4 py-2 shadow-sm">
            <span className="text-xs font-bold text-foreground">Đồng bộ toàn hệ thống</span>
            <Toggle
              checked={status.settings.masterEnabled}
              disabled={busyKey !== null}
              label="Đồng bộ toàn hệ thống"
              onChange={() => void updateSetting('masterEnabled')}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {childToggles.map((item) => {
            const selected = status.settings[item.key];
            const effective = status.settings.masterEnabled && selected;
            return (
              <div
                key={item.key}
                className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-5 shadow-sm transition-all hover:bg-card/25 hover:border-primary/30"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${
                          effective ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            effective
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                              : selected
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              : 'bg-muted/30 text-muted-foreground'
                          }`}
                        >
                          {effective ? 'Đang chạy' : selected ? 'Chờ công tắc tổng' : 'Đang tắt'}
                        </span>
                      </div>
                    </div>
                    <Toggle
                      checked={selected}
                      disabled={busyKey !== null}
                      label={`Đồng bộ ${item.title}`}
                      onChange={() => void updateSetting(item.key)}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>

                {/* VISUAL ACCENT BAR - Synchronized with Dashboard progress bars */}
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        effective ? 'w-full bg-primary' : selected ? 'w-1/2 bg-amber-500' : 'w-0 bg-muted/40'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUEUE & WEBHOOK GRID - 2 COLUMNS */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* CARD 3: QUEUE OUTBOX */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:p-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">HÀNG ĐỢI OUTBOX</p>
                <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Queue & Lỗi đồng bộ</h2>
              </div>
              <span className="rounded-full border border-border/60 bg-card/20 backdrop-blur-md px-3 py-1 text-xs font-semibold text-muted-foreground">
                Lần cuối: {formatDateTime(status.lastCompleted?.completed_at)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Đang chờ', value: status.queueSummary.pending, color: 'text-primary' },
                { label: 'Tạm dừng', value: status.queueSummary.paused, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Đang retry', value: status.queueSummary.retrying, color: 'text-sky-600 dark:text-sky-400' },
                {
                  label: 'Lỗi / Blocked',
                  value: (status.queueSummary.failed || 0) + (status.queueSummary.blocked || 0),
                  color: 'text-[#e97862]',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-3.5 text-center shadow-sm hover:bg-card/25 transition-all">
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4 space-y-2 text-sm">
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">Bản ghi hoàn thành gần nhất</span>
              <span className="font-semibold text-foreground">{formatDateTime(status.lastCompleted?.completed_at)}</span>
            </div>
            <div className="flex justify-between items-start gap-4">
              <span className="text-muted-foreground shrink-0">Thông báo lỗi gần nhất</span>
              <span className={`text-right font-semibold truncate ${status.lastError ? 'text-[#e97862]' : 'text-foreground'}`}>
                {status.lastError?.last_error || 'Không có lỗi ghi nhận'}
              </span>
            </div>
          </div>
        </section>

        {/* CARD 4: WEBHOOK */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:p-7 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">WEBHOOK & REVERSE SYNC</p>
            <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Kênh nhận tín hiệu từ Pancake</h2>
            <div className="mt-5 rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm flex items-start gap-3.5">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <CogIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-foreground">
                  {status.webhook.configured ? 'Đã có secret, chưa bật xử lý ngược' : 'Webhook chưa cấu hình'}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Route tiếp nhận tín hiệu sẵn sàng tại <code className="rounded bg-card/40 border border-border/40 px-1.5 py-0.5 font-mono text-xs">{status.webhook.endpoint}</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
            Hệ thống hiện hoạt động theo chế độ một chiều (Website → Pancake). Các webhook tiếp nhận từ Pancake chỉ được lưu nhật ký xác thực.
          </div>
        </section>
      </div>

      {/* CARD 5: MANUAL ACTIONS & BACKFILL */}
      <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-border/40 md:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">TÁC VỤ THỦ CÔNG</p>
        <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Bảo trì & Backfill dữ liệu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sử dụng các công cụ này để quét và đẩy lại dữ liệu hiện có từ D1 sang Pancake POS khi cần thiết.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {manualActions.map((action) => (
            <div
              key={action.kind}
              className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card/15 backdrop-blur-xl p-4 shadow-sm transition-all hover:bg-card/25 hover:border-primary/30"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    {action.icon}
                  </span>
                  <h3 className="font-bold text-foreground text-sm">{action.label}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{action.desc}</p>
              </div>

              <button
                type="button"
                disabled={!action.enabled || busyKey !== null}
                onClick={() => void runManualSync(action.kind)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-border/60 bg-card/20 backdrop-blur-md px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-all hover:bg-card/40 hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyKey === `manual-${action.kind}` ? <LoadingIcon className="h-3.5 w-3.5 animate-spin" /> : null}
                {action.label}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPancakeManagementPage;

