import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import type { DeplaoAutomationStatus, PancakeIntegrationStatus, PancakeSyncSettingKey } from '../services/api';
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

type PancakeTab = 'connection' | 'sync_streams' | 'queue_webhook' | 'manual_sync' | 'deplao';

const pancakeTabs: Array<{ key: PancakeTab; label: string; hint: string }> = [
  { key: 'connection', label: 'Kết nối & Kênh', hint: 'Shop ID, Kho, Cloudflare Queue' },
  { key: 'sync_streams', label: 'Công tắc luồng', hint: 'Sản phẩm, tồn kho, khách hàng, đơn hàng' },
  { key: 'queue_webhook', label: 'Hàng đợi & Webhook', hint: 'Queue outbox, Webhook inbound' },
  { key: 'manual_sync', label: 'Bảo trì & Backfill', hint: 'Đồng bộ thủ công từng thực thể' },
  { key: 'deplao', label: 'Deplao Zalo', hint: 'Đơn hàng → Telegram → Zalo' },
];

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
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-20.webp" alt="Sản phẩm" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />,
  },
  {
    key: 'inventoryEnabled',
    title: 'Kho hàng',
    description: 'Số lượng tồn theo sản phẩm, biến thể và kho Pancake đã cấu hình.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-24.webp" alt="Kho hàng" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />,
  },
  {
    key: 'customersEnabled',
    title: 'Khách hàng',
    description: 'Đối chiếu theo số điện thoại, kèm email và địa chỉ khi có.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644972-Untitled-26.webp" alt="Khách hàng" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />,
  },
  {
    key: 'ordersEnabled',
    title: 'Đơn hàng',
    description: 'Mã đơn, mặt hàng, thuế, vận chuyển, thanh toán và trạng thái.',
    icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-22.webp" alt="Đơn hàng" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />,
  },
];

const inboundToggles: ToggleDefinition[] = [
  {
    key: 'inboundEnabled',
    title: 'Nhận dữ liệu từ Pancake',
    description: 'Công tắc tổng cho luồng Pancake POS → website D1.',
    icon: <CogIcon className="h-4.5 w-4.5" />,
  },
  {
    key: 'inboundOrdersEnabled',
    title: 'Nhận đơn POS',
    description: 'Nhập đơn tại quầy, trạng thái, thanh toán và snapshot mặt hàng.',
    icon: <ShoppingBagIcon className="h-4.5 w-4.5" />,
  },
  {
    key: 'inboundCustomersEnabled',
    title: 'Nhận khách tại quầy',
    description: 'Lưu hồ sơ khách độc lập, không bắt buộc có tài khoản website.',
    icon: <UsersIcon className="h-4.5 w-4.5" />,
  },
  {
    key: 'inboundPollEnabled',
    title: 'Polling dự phòng',
    description: 'Mỗi nhịp chỉ đọc tối đa một trang thay đổi để tránh quá tải API.',
    icon: <LoadingIcon className="h-4.5 w-4.5" />,
  },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

// Apple iOS Standard Switch Toggle
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
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-50 ${
      checked ? 'bg-primary' : 'bg-muted/70 dark:bg-muted/50'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// Deplao Automation Section (Apple Glass Standard)
const DeplaoAutomationPanel: React.FC = () => {
  const { addToast } = useToast();
  const [automation, setAutomation] = useState<DeplaoAutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setAutomation(await api.getDeplaoAutomationStatus());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái Telegram/Zalo.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const jobCounts = useMemo(
    () => new Map((automation?.jobs || []).map((row) => [row.status, Number(row.count || 0)])),
    [automation?.jobs],
  );
  const device = automation?.devices?.[0] || null;
  const deviceOnline = Boolean(device && Date.now() - Date.parse(device.last_seen_at) < 3 * 60 * 1000);
  const pending = ['pending', 'leased', 'waiting_friend', 'retrying']
    .reduce((total, key) => total + (jobCounts.get(key) || 0), 0);

  const retry = async (jobId: string) => {
    if (retryingId) return;
    setRetryingId(jobId);
    try {
      await api.retryDeplaoAutomationJob(jobId);
      addToast('Đã đưa job Zalo trở lại hàng đợi.', { type: 'success' });
      await load(true);
    } catch (retryError) {
      addToast(retryError instanceof Error ? retryError.message : 'Không thể chạy lại job.', { type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. Glass Header Card */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              automation?.config.automationEnabled
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
            }`}>
              <span className={`h-2 w-2 rounded-full ${automation?.config.automationEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Automation: {automation?.config.automationEnabled ? 'Đang bật' : 'Đang tắt'}</span>
            </span>

            <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              deviceOnline
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
            }`}>
              <span className={`h-2 w-2 rounded-full ${deviceOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>Thiết bị: {deviceOnline ? 'Online' : 'Offline'}</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
              <span>Job chờ:</span>
              <strong className={pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}>{pending}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 text-xs font-bold text-foreground shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0"
            title="Làm mới dữ liệu Deplao"
          >
            {loading ? <LoadingIcon className="h-3.5 w-3.5 animate-spin" /> : <WrenchScrewdriverIcon className="h-3.5 w-3.5" />}
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-600 dark:text-red-400 mx-1 sm:mx-0 backdrop-blur-xl">
          {error}
        </div>
      ) : null}

      {/* 2. Main Content Card */}
      <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 md:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
        <div>
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">ĐƠN HÀNG → TELEGRAM → ZALO</p>
          <h2 className="mt-1 text-lg sm:text-xl font-bold text-foreground">Deplao Order Automation</h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            D1 giữ job trong 7 ngày. Máy Deplao chủ động lấy việc khi online, không cần mở cổng hoặc Cloudflare Tunnel.
          </p>
        </div>

        {/* 5 Glass Stat Cards */}
        <div className="mt-4 sm:mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
          {[
            { label: 'Automation', value: automation?.config.automationEnabled ? 'Đang bật' : 'Đang tắt', ok: automation?.config.automationEnabled },
            { label: 'Telegram Bot', value: automation?.config.telegramEnabled ? 'Đang bật' : 'Đang tắt', ok: automation?.config.telegramEnabled },
            { label: 'Thiết bị Deplao', value: deviceOnline ? 'Online' : 'Offline', ok: deviceOnline },
            { label: 'Tài khoản Zalo', value: device?.selected_zalo_connected ? 'Đã kết nối' : 'Chưa kết nối', ok: Boolean(device?.selected_zalo_connected) },
            { label: 'Job đang chờ', value: String(pending), ok: pending === 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 shadow-2xs flex flex-col justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-bold ${item.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {item.ok ? <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" /> : <XCircleIcon className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{item.value}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Jobs List (Desktop Table + Mobile Cards) */}
        <div className="mt-5 rounded-2xl border border-white/60 dark:border-white/10 bg-background/30 backdrop-blur-xl overflow-hidden shadow-2xs">
          <div className="border-b border-border/40 bg-muted/20 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Lịch sử Job gần nhất</span>
            {device ? (
              <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                Heartbeat: {formatDateTime(device.last_seen_at)} · App v{device.app_version || '1.0'}
              </span>
            ) : null}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/10 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-4 py-3">Đơn hàng</th>
                  <th className="px-3 py-3">Sự kiện</th>
                  <th className="px-3 py-3">Trạng thái & Lần thử</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(automation?.recentJobs || []).slice(0, 12).map((job) => {
                  const canRetry = ['failed', 'delivery_unknown', 'expired'].includes(job.status);
                  return (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-foreground">{job.order_code}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(job.created_at)}</p>
                        {job.last_error ? <p className="mt-1 line-clamp-1 text-[11px] text-rose-600 dark:text-rose-400">{job.last_error}</p> : null}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[11px]">{job.event_type}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          job.status === 'completed'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : job.status === 'failed'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        }`}>
                          {job.status} · {job.attempts}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canRetry ? (
                          <button
                            type="button"
                            disabled={retryingId !== null}
                            onClick={() => void retry(job.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-bold text-foreground shadow-2xs backdrop-blur-md hover:bg-muted active:scale-95 disabled:opacity-50"
                          >
                            {retryingId === job.id ? 'Đang chạy…' : 'Chạy lại'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (padding py-2.5 px-3) */}
          <div className="md:hidden divide-y divide-border/30">
            {(automation?.recentJobs || []).slice(0, 12).map((job) => {
              const canRetry = ['failed', 'delivery_unknown', 'expired'].includes(job.status);
              return (
                <div key={job.id} className="p-3 space-y-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground">{job.order_code}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      job.status === 'completed'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : job.status === 'failed'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    }`}>
                      {job.status} ({job.attempts})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono">{job.event_type}</span>
                    <span>{formatDateTime(job.created_at)}</span>
                  </div>
                  {job.last_error ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">{job.last_error}</p>
                  ) : null}
                  {canRetry ? (
                    <div className="pt-1 text-right">
                      <button
                        type="button"
                        disabled={retryingId !== null}
                        onClick={() => void retry(job.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/50 px-3 py-1 text-xs font-bold text-foreground shadow-2xs backdrop-blur-md hover:bg-muted active:scale-95 disabled:opacity-50"
                      >
                        {retryingId === job.id ? 'Đang chạy…' : 'Chạy lại'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!loading && !(automation?.recentJobs || []).length ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Chưa có job automation nào trong hệ thống.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Main Page Component
const AdminPancakeManagementPage: React.FC = () => {
  const setSidebarConfig = useAdminLayoutDispatch();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<PancakeTab>('connection');
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

  // Synchronize sidebar layout and mobile task tabs with AdminWorkspaceLayout
  useEffect(() => {
    setSidebarConfig({
      eyebrow: 'TÍCH HỢP PANCAKE',
      title: 'Pancake POS',
      description: 'Điều khiển đồng bộ hai chiều giữa website D1 và Pancake POS.',
      icon: <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Pancake POS" className="h-8 w-8 object-contain" />,
      insights: [
        { label: 'Luồng hoạt động', value: `${activeSyncCount}/4`, hint: 'luồng dữ liệu D1' },
        { label: 'Đang chờ outbox', value: String(status?.queueSummary.pending || 0), hint: 'tác vụ trong hàng đợi' },
        { label: 'Trạng thái kết nối', value: connected ? 'Sẵn sàng' : 'Chưa đủ config', hint: status?.config.shopId ? `Shop #${status.config.shopId}` : 'Cần kiểm tra env' },
      ],
      taskItems: pancakeTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        hint: tab.hint,
        onClick: () => setActiveTab(tab.key),
      })),
      activeTaskKey: activeTab,
    });
  }, [activeSyncCount, connected, setSidebarConfig, status, activeTab]);

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
            : [...childToggles, ...inboundToggles].find((item) => item.key === key)?.title.toLowerCase()
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

  const runInboundPoll = async () => {
    setBusyKey('inbound-poll');
    try {
      const result = await api.pollPancakeInbound();
      await loadStatus();
      const accepted = (result.poll.resources || []).reduce((total, row) => total + Number(row.accepted || 0), 0);
      addToast('Đã kiểm tra thay đổi từ Pancake', {
        description: `${accepted} thay đổi mới, ${Number(result.dispatch?.queued || 0)} tác vụ đã vào hàng đợi.`,
        type: 'success',
      });
    } catch (pollError) {
      addToast('Không thể nhận dữ liệu từ Pancake', {
        description: pollError instanceof Error ? pollError.message : 'Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (isLoading && !status) {
    return (
      <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0" aria-busy="true">
        <div className="h-16 animate-pulse rounded-2xl border border-white/60 bg-card/40 backdrop-blur-xl mx-1 sm:mx-0" />
        <div className="h-80 animate-pulse rounded-2xl sm:rounded-[1.75rem] border border-white/60 bg-card/40 backdrop-blur-2xl mx-1 sm:mx-0" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="rounded-2xl sm:rounded-[1.75rem] border border-destructive/30 bg-card/85 backdrop-blur-2xl p-6 sm:p-8 text-center shadow-lg -mx-3 sm:mx-0 mx-1 sm:mx-0">
        <XCircleIcon className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Không thể tải Pancake POS</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95"
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
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* ===================== TAB 1: KẾT NỐI & KÊNH POS ===================== */}
      {activeTab === 'connection' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Glass Toolbar Card */}
          <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  connected
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{connected ? 'Kết nối sẵn sàng' : 'Chưa đủ cấu hình'}</span>
                </span>

                <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Shop ID:</span>
                  <strong className="text-foreground">{status.config.shopId || 'Chưa có'}</strong>
                </span>

                <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Kho:</span>
                  <strong className="text-foreground truncate max-w-[120px]">{status.config.warehouseId || 'Chưa có'}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void testConnection()}
                  disabled={busyKey !== null}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {busyKey === 'connection' ? <LoadingIcon className="h-3.5 w-3.5 animate-spin" /> : <CogIcon className="h-3.5 w-3.5" />}
                  <span>Kiểm tra kết nối</span>
                </button>

                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  disabled={isLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 text-muted-foreground hover:text-foreground shrink-0"
                  title="Tải lại trạng thái"
                >
                  <WrenchScrewdriverIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Glass Content Card */}
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">TRẠNG THÁI KẾT NỐI & HẠ TẦNG</p>
              <h2 className="mt-1 text-lg sm:text-xl font-bold text-foreground">Kênh đồng bộ Pancake POS</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Đồng bộ hai chiều giữa cơ sở dữ liệu Cloudflare D1 và hệ thống Pancake POS qua hàng đợi ngầm Cloudflare Queue.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shop ID</p>
                <p className="mt-2 truncate text-base sm:text-lg font-bold text-foreground">{status.config.shopId || 'Chưa cấu hình'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Định danh cửa hàng trên Pancake</p>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Warehouse ID</p>
                <p className="mt-2 truncate text-base sm:text-lg font-bold text-foreground">{status.config.warehouseId || 'Chưa cấu hình'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Kho hàng mặc định tiếp nhận tồn kho</p>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cloudflare Queue</p>
                <p className="mt-2 truncate text-base sm:text-lg font-bold text-foreground">
                  {status.config.queueConfigured ? 'Đã kích hoạt' : 'Chưa kết nối'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Hàng đợi ngầm PANCAKE_QUEUE</p>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hướng đồng bộ</p>
                <p className="mt-2 truncate text-base sm:text-lg font-bold text-primary">Website ↔ Pancake POS</p>
                <p className="mt-1 text-xs text-muted-foreground">Hai chiều, chống lặp theo remote ID</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/60 dark:border-white/10 bg-background/30 backdrop-blur-xl p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Endpoint API Pancake POS</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">https://pos.pages.fm/api/v1</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span>API Key Configured</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: CÔNG TẮC LUỒNG DỮ LIỆU ===================== */}
      {activeTab === 'sync_streams' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Glass Toolbar Card */}
          <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  status.settings.masterEnabled
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${status.settings.masterEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>Toàn hệ thống: {status.settings.masterEnabled ? 'Bật' : 'Tắt'}</span>
                </span>

                <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Luồng bật:</span>
                  <strong className="text-foreground">{activeSyncCount}/4</strong>
                </span>

                <span className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Inbound POS:</span>
                  <strong className={status.settings.inboundEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                    {status.settings.inboundEnabled ? 'Đang bật' : 'Tắt'}
                  </strong>
                </span>
              </div>

              {/* Master Switch on Toolbar */}
              <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 backdrop-blur-md px-3 py-1.5 shadow-2xs shrink-0">
                <span className="text-xs font-bold text-foreground">Công tắc tổng</span>
                <Toggle
                  checked={status.settings.masterEnabled}
                  disabled={busyKey !== null}
                  label="Đồng bộ toàn hệ thống"
                  onChange={() => void updateSetting('masterEnabled')}
                />
              </div>
            </div>
          </div>

          {/* Glass Content Card */}
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">LUỒNG ĐẨY DỮ LIỆU (WEBSITE D1 → PANCAKE POS)</p>
              <h2 className="mt-1 text-lg sm:text-xl font-bold text-foreground">Cấu hình luồng thực thể</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Bật công tắc giúp tự động đưa các biến động dữ liệu từ website D1 vào hàng đợi đồng bộ sang Pancake POS.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {childToggles.map((item) => {
                const selected = status.settings[item.key];
                const effective = status.settings.masterEnabled && selected;
                return (
                  <div
                    key={item.key}
                    className="flex flex-col justify-between rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 sm:p-5 shadow-2xs transition-all hover:bg-background/60"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                            effective ? 'bg-primary/15' : 'bg-muted/40'
                          }`}>
                            {item.icon}
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground">{item.title}</h3>
                            <span
                              className={`mt-0.5 inline-block rounded-full px-2 py-0.2 text-[10px] sm:text-[11px] font-bold ${
                                effective
                                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                  : selected
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                  : 'bg-muted/40 text-muted-foreground'
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

                      <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>

                    {/* Progress Bar Accent */}
                    <div className="mt-4 pt-3 border-t border-border/40">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
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
          </div>
        </div>
      )}

      {/* ===================== TAB 3: HÀNG ĐỢI & WEBHOOK ===================== */}
      {activeTab === 'queue_webhook' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Glass Toolbar Card */}
          <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Đang chờ:</span>
                  <strong className="text-primary">{status.queueSummary.pending}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Tạm dừng:</span>
                  <strong className="text-amber-600 dark:text-amber-400">{status.queueSummary.paused}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Retry:</span>
                  <strong className="text-sky-600 dark:text-sky-400">{status.queueSummary.retrying}</strong>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md">
                  <span>Lỗi/Block:</span>
                  <strong className="text-rose-600 dark:text-rose-400">
                    {(status.queueSummary.failed || 0) + (status.queueSummary.blocked || 0)}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                disabled={busyKey !== null || !status.settings.masterEnabled || !status.settings.inboundEnabled}
                onClick={() => void runInboundPoll()}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50 shrink-0"
              >
                {busyKey === 'inbound-poll' ? <LoadingIcon className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Đồng bộ ngược ngay</span>
              </button>
            </div>
          </div>

          {/* 2 Column Content Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
            {/* Column 1: Queue Outbox */}
            <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 sm:pb-4">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">HÀNG ĐỢI OUTBOX</p>
                    <h2 className="mt-1 text-base sm:text-lg font-bold text-foreground">Queue & Trạng thái gửi</h2>
                  </div>
                  <span className="rounded-xl border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur-md">
                    Lần cuối: {formatDateTime(status.lastCompleted?.completed_at)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Đang chờ', value: status.queueSummary.pending, color: 'text-primary' },
                    { label: 'Tạm dừng', value: status.queueSummary.paused, color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Đang retry', value: status.queueSummary.retrying, color: 'text-sky-600 dark:text-sky-400' },
                    {
                      label: 'Lỗi / Block',
                      value: (status.queueSummary.failed || 0) + (status.queueSummary.blocked || 0),
                      color: 'text-rose-600 dark:text-rose-400',
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 text-center shadow-2xs">
                      <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>{item.value}</p>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-border/40 pt-4 space-y-2 text-xs">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-muted-foreground">Bản ghi hoàn thành gần nhất</span>
                  <span className="font-semibold text-foreground">{formatDateTime(status.lastCompleted?.completed_at)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground shrink-0">Thông báo lỗi gần nhất</span>
                  <span className={`text-right font-semibold truncate ${status.lastError ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                    {status.lastError?.last_error || 'Không có lỗi ghi nhận'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Webhook & Reverse Sync */}
            <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex flex-col justify-between">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">WEBHOOK & REVERSE SYNC</p>
                <h2 className="mt-1 text-base sm:text-lg font-bold text-foreground">Pancake POS → Website D1</h2>

                <div className="mt-4 rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 sm:p-4 shadow-2xs flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CogIcon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-foreground">
                      {status.webhook.processingEnabled
                        ? 'Webhook đang xử lý đồng bộ ngược'
                        : status.webhook.configured ? 'Webhook đang chờ công tắc inbound' : 'Webhook chưa cấu hình'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground break-all">
                      Route tiếp nhận: <code className="rounded bg-muted/40 border border-border/40 px-1 py-0.5 font-mono">{status.webhook.endpoint}</code>
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {inboundToggles.map((item) => {
                    const selected = status.settings[item.key];
                    const effective = status.settings.masterEnabled && selected;
                    return (
                      <div key={item.key} className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${effective ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'}`}>
                              {item.icon}
                            </span>
                            <p className="truncate text-xs font-bold text-foreground">{item.title}</p>
                          </div>
                          <Toggle
                            checked={selected}
                            disabled={busyKey !== null}
                            label={item.title}
                            onChange={() => void updateSetting(item.key)}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground leading-normal line-clamp-2">{item.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-border/40 pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Chu kỳ Poll: {status.inbound.pollSeconds}s · Giới hạn: {status.inbound.pageSize} bản ghi/nguồn/nhịp · Lần cuối:{' '}
                  {formatDateTime(status.inbound.cursors.find((row) => row.resource_type === 'order')?.last_polled_at)}
                </p>
                {status.inbound.lastError ? (
                  <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    Lỗi gần nhất: {status.inbound.lastError.last_error}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: BẢO TRÌ & BACKFILL ===================== */}
      {activeTab === 'manual_sync' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Glass Toolbar Card */}
          <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <span>Quét & Backfill dữ liệu thủ công</span>
              </span>
              <span className="text-xs text-muted-foreground">4 luồng hỗ trợ</span>
            </div>
          </div>

          {/* Glass Content Card */}
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">TÁC VỤ THỦ CÔNG</p>
              <h2 className="mt-1 text-lg sm:text-xl font-bold text-foreground">Bảo trì & Đẩy lại dữ liệu D1</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Sử dụng các công cụ này để quét và đẩy lại dữ liệu hiện có từ website D1 sang Pancake POS khi cần đối soát hoặc bù đắp sự cố mạng.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {manualActions.map((action) => (
                <div
                  key={action.kind}
                  className="flex flex-col justify-between rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs transition-all hover:bg-background/60"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        {action.icon}
                      </span>
                      <h3 className="font-bold text-foreground text-sm">{action.label}</h3>
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{action.desc}</p>
                  </div>

                  <button
                    type="button"
                    disabled={!action.enabled || busyKey !== null}
                    onClick={() => void runManualSync(action.kind)}
                    className="mt-4 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/40 text-xs font-bold text-foreground shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyKey === `manual-${action.kind}` ? <LoadingIcon className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>{action.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 5: DEPLAO AUTOMATION ===================== */}
      {activeTab === 'deplao' && <DeplaoAutomationPanel />}
    </div>
  );
};

export default AdminPancakeManagementPage;
