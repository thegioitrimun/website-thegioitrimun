import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdminCustomerMetric,
  AdminDashboardAlert,
  AdminDashboardKpiSnapshot,
  AdminReportFrequency,
  AdminReportPreset,
  AdminReportSchedule,
  AdminServicePerformanceMetric,
  AdminTopProductMetric,
  ProductOrder,
} from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import { DocumentDuplicateIcon, MailIcon, ReceiptIcon, TrashIcon, PencilIcon } from './icons';
import { useToast } from '../hooks/useToast';
import { exportWorkbook } from '../src/workbookExport';

type ReportsPreset = AdminReportPreset;

type ScheduleFormState = {
  id?: string;
  name: string;
  preset: AdminReportPreset;
  frequency: AdminReportFrequency;
  dayOfWeek: number;
  hourLocal: number;
  minuteLocal: number;
  timezone: string;
  recipients: string;
  enabled: boolean;
};

interface AdminDashboardReportsPanelProps {
  orders: ProductOrder[];
}

const PRESET_LABELS: Record<ReportsPreset, string> = {
  '7d': '7 ngày',
  '30d': '30 ngày',
  '90d': '90 ngày',
};

const FREQUENCY_LABELS: Record<AdminReportFrequency, string> = {
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
};

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

const DEFAULT_FORM: ScheduleFormState = {
  name: 'Daily Ops Digest',
  preset: '30d',
  frequency: 'daily',
  dayOfWeek: 1,
  hourLocal: 8,
  minuteLocal: 15,
  timezone: 'Asia/Ho_Chi_Minh',
  recipients: 'hovidaiphuc@gmail.com',
  enabled: true,
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const getPresetRange = (preset: ReportsPreset) => {
  const to = new Date();
  const from = new Date(to);
  if (preset === '7d') from.setDate(to.getDate() - 7);
  if (preset === '30d') from.setDate(to.getDate() - 30);
  if (preset === '90d') from.setDate(to.getDate() - 90);
  return { from: from.toISOString(), to: to.toISOString() };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const MetricTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all hover:border-primary/40 dark:border-white/10">
    <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">{value}</p>
    {hint ? <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{hint}</p> : null}
  </div>
);

const parseRecipients = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

const scheduleToForm = (schedule: AdminReportSchedule): ScheduleFormState => ({
  id: schedule.id,
  name: schedule.name,
  preset: schedule.preset,
  frequency: schedule.frequency,
  dayOfWeek: schedule.day_of_week ?? 1,
  hourLocal: schedule.hour_local,
  minuteLocal: schedule.minute_local,
  timezone: schedule.timezone,
  recipients: schedule.recipients.join(', '),
  enabled: schedule.enabled,
});

const AdminDashboardReportsPanel: React.FC<AdminDashboardReportsPanelProps> = ({ orders }) => {
  const { addToast } = useToast();
  const [preset, setPreset] = useState<ReportsPreset>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminDashboardKpiSnapshot | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerMetric[]>([]);
  const [topProducts, setTopProducts] = useState<AdminTopProductMetric[]>([]);
  const [topServices, setTopServices] = useState<AdminServicePerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<AdminDashboardAlert[]>([]);
  const [schedules, setSchedules] = useState<AdminReportSchedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(DEFAULT_FORM);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    const range = getPresetRange(preset);
    let cancelled = false;
    setLoading(true);

    void Promise.all([
      api.getAdminDashboardKpiSnapshot(range),
      api.getAdminCustomerMetrics({ ...range, limit: 200, offset: 0 }),
      api.getAdminTopProducts({ ...range, limit: 25 }),
      api.getAdminServicePerformance({ ...range, limit: 25 }),
      api.getAdminAlertFeed(25),
      api.getAdminReportSchedules(),
    ])
      .then(([snapshotData, customerData, productData, serviceData, alertData, scheduleData]) => {
        if (cancelled) return;
        setSnapshot(snapshotData);
        setCustomers(customerData);
        setTopProducts(productData);
        setTopServices(serviceData);
        setAlerts(alertData);
        setSchedules(scheduleData);
      })
      .catch((error: any) => {
        if (cancelled) return;
        addToast('Không thể tải dữ liệu báo cáo', { type: 'error', description: error.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast, preset]);

  const range = useMemo(() => getPresetRange(preset), [preset]);

  const filteredOrders = useMemo(() => {
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime();
    return orders.filter((order) => {
      const createdAt = new Date(order.created_at).getTime();
      return createdAt >= from && createdAt < to;
    });
  }, [orders, range]);

  const sortedSchedules = useMemo(
    () =>
      [...schedules].sort((a, b) => {
        const aNext = a.next_run_at ? new Date(a.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bNext = b.next_run_at ? new Date(b.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
        return aNext - bNext;
      }),
    [schedules],
  );
  const activeScheduleCount = useMemo(
    () => sortedSchedules.filter((schedule) => schedule.enabled).length,
    [sortedSchedules],
  );
  const totalRecipientCount = useMemo(
    () => new Set(sortedSchedules.flatMap((schedule) => schedule.recipients)).size,
    [sortedSchedules],
  );
  const nextSchedule = useMemo(
    () => sortedSchedules.find((schedule) => schedule.enabled && schedule.next_run_at) || null,
    [sortedSchedules],
  );

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return topProducts;
    const q = searchQuery.toLowerCase();
    return topProducts.filter((p) => p.product_name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)));
  }, [topProducts, searchQuery]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return topServices;
    const q = searchQuery.toLowerCase();
    return topServices.filter((s) => s.service_name.toLowerCase().includes(q));
  }, [topServices, searchQuery]);

  const filteredAlerts = useMemo(() => {
    if (!searchQuery.trim()) return alerts;
    const q = searchQuery.toLowerCase();
    return alerts.filter((a) => a.title.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q)));
  }, [alerts, searchQuery]);

  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return sortedSchedules;
    const q = searchQuery.toLowerCase();
    return sortedSchedules.filter((s) => s.name.toLowerCase().includes(q) || s.recipients.some((r) => r.toLowerCase().includes(q)));
  }, [sortedSchedules, searchQuery]);

  const handleExport = async () => {
    if (!snapshot) return;
    setExporting(true);
    try {
      await exportWorkbook(`admin-report-${preset}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        {
          name: 'Snapshot',
          rows: [{ preset, from: range.from, to: range.to, ...snapshot }],
        },
        {
          name: 'Orders',
          rows: filteredOrders.map((order) => ({
            order_code: order.order_code || order.id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            created_at: order.created_at,
            total: Number(order.grand_total || order.total_price || 0),
            status: order.fulfillment_status || order.status,
            payment_status: order.payment_status || '',
            shipping_provider: order.shipping_provider || '',
          })),
        },
        {
          name: 'Customers',
          rows: customers.map((customer) => ({
            patient_id: customer.patient_id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            segment: customer.segment,
            total_orders: customer.total_orders,
            total_spent: customer.total_spent,
            spent_in_period: customer.spent_in_period,
            is_at_risk: customer.is_at_risk,
            is_returning: customer.is_returning,
          })),
        },
        {
          name: 'Top Products',
          rows: topProducts.map((product) => ({
            product_id: product.product_id,
            product_name: product.product_name,
            brand: product.brand,
            units_sold: product.units_sold,
            order_count: product.order_count,
            gross_revenue: product.gross_revenue,
          })),
        },
        {
          name: 'Top Services',
          rows: topServices.map((service) => ({
            service_id: service.service_id,
            service_name: service.service_name,
            appointment_count: service.appointment_count,
            completed_count: service.completed_count,
            cancelled_count: service.cancelled_count,
            pending_count: service.pending_count,
            realized_revenue: service.realized_revenue,
          })),
        },
        {
          name: 'Alerts',
          rows: alerts.map((alert) => ({
            alert_type: alert.alert_type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            ref_type: alert.ref_type,
            ref_id: alert.ref_id,
            created_at: alert.created_at,
          })),
        },
      ]);
      addToast('Đã xuất báo cáo quản trị', { type: 'success' });
    } catch (error: any) {
      addToast('Không thể xuất báo cáo quản trị', { type: 'error', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const saved = await api.saveAdminReportSchedule({
        id: scheduleForm.id,
        name: scheduleForm.name,
        preset: scheduleForm.preset,
        frequency: scheduleForm.frequency,
        dayOfWeek: scheduleForm.frequency === 'weekly' ? scheduleForm.dayOfWeek : null,
        hourLocal: scheduleForm.hourLocal,
        minuteLocal: scheduleForm.minuteLocal,
        timezone: scheduleForm.timezone,
        recipients: parseRecipients(scheduleForm.recipients),
        enabled: scheduleForm.enabled,
      });

      setSchedules((prev) => {
        const existing = prev.some((schedule) => schedule.id === saved.id);
        if (existing) {
          return prev.map((schedule) => (schedule.id === saved.id ? saved : schedule));
        }
        return [...prev, saved];
      });
      setScheduleForm(DEFAULT_FORM);
      addToast('Đã lưu lịch gửi báo cáo', {
        type: 'success',
        description: `${saved.name} • ${FREQUENCY_LABELS[saved.frequency]}`,
      });
    } catch (error: any) {
      addToast('Không thể lưu lịch gửi báo cáo', { type: 'error', description: error.message });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (schedule: AdminReportSchedule) => {
    setDeletingScheduleId(schedule.id);
    try {
      await api.deleteAdminReportSchedule(schedule.id);
      setSchedules((prev) => prev.filter((entry) => entry.id !== schedule.id));
      if (scheduleForm.id === schedule.id) {
        setScheduleForm(DEFAULT_FORM);
      }
      addToast('Đã xóa lịch gửi báo cáo', { type: 'success', description: schedule.name });
    } catch (error: any) {
      addToast('Không thể xóa lịch gửi báo cáo', { type: 'error', description: error.message });
    } finally {
      setDeletingScheduleId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* Screen reader & E2E semantic heading */}
      <h2 className="sr-only">Xuất báo cáo định kỳ</h2>

      {/* 1. Header & Filter Card matching Orders, Customers, Appointments */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        {/* Preset pills row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(['30d', '7d', '90d'] as ReportsPreset[]).map((pKey) => {
            const isActive = preset === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setPreset(pKey)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{PRESET_LABELS[pKey]}</span>
                {snapshot && pKey === preset && (
                  <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                    {snapshot.total_orders} đơn
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search bar, Scheduler shortcut & Excel export button */}
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm sản phẩm / dịch vụ / cảnh báo / lịch gửi..."
              className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all text-foreground"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const elem = document.getElementById('report-scheduler-card');
              elem?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 bg-background/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shrink-0 active:scale-95"
            title="Xem lịch gửi email tự động"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>Lịch tự động</span>
            {activeScheduleCount > 0 && (
              <span className="flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeScheduleCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !snapshot}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0"
            title="Xuất toàn bộ báo cáo Excel"
          >
            {exporting ? (
              <Spinner className="w-4 h-4 text-primary" />
            ) : (
              <img
                src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp"
                alt="Xuất Excel"
                className="w-4.5 h-4.5 object-contain"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setScheduleForm(DEFAULT_FORM);
              const elem = document.getElementById('report-scheduler-card');
              elem?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold shrink-0 shadow-xs hover:bg-secondary/90 active:scale-95 transition-all"
            title="Thêm lịch gửi báo cáo mới"
          >
            <span>+ Thêm lịch</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics & Detailed Breakdown */}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-white/70 bg-card/75 p-8 shadow-xs backdrop-blur-2xl dark:border-white/10">
          <Spinner />
        </div>
      ) : !snapshot ? (
        <div className="rounded-2xl border border-white/70 bg-card/75 p-10 text-center text-sm text-muted-foreground shadow-xs backdrop-blur-2xl dark:border-white/10">
          Không có dữ liệu báo cáo cho khoảng thời gian này.
        </div>
      ) : (
        <>
          {/* KPI Metric Tiles */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 mx-1 sm:mx-0">
            <MetricTile
              label="Doanh thu thực (Net)"
              value={formatCurrency(snapshot.net_revenue)}
              hint={`Gross: ${formatCurrency(snapshot.gross_revenue)}`}
            />
            <MetricTile
              label="Đơn đã thanh toán"
              value={String(snapshot.paid_orders)}
              hint={`${snapshot.total_orders} tổng đơn hàng`}
            />
            <MetricTile
              label="Khách hàng mới"
              value={String(snapshot.new_customers)}
              hint={`${snapshot.returning_customers} khách quay lại`}
            />
            <MetricTile
              label="Lịch tự động active"
              value={String(activeScheduleCount)}
              hint={`${alerts.length} cảnh báo • kỳ ${PRESET_LABELS[preset]}`}
            />
          </div>

          {/* 3-Column Breakdown: Top Products, Top Services, Alert Feed */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-3 mx-1 sm:mx-0">
            {/* Top Products */}
            <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <ReceiptIcon className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Top sản phẩm</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  {filteredProducts.length} SP
                </span>
              </div>
              <div className="mt-3.5 space-y-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Không có sản phẩm nào phù hợp.</p>
                ) : (
                  filteredProducts.slice(0, 6).map((product, idx) => (
                    <div
                      key={product.product_id}
                      className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md p-3 transition-all hover:bg-background/50 hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                            {idx + 1}
                          </span>
                          <p className="truncate text-xs sm:text-sm font-bold text-foreground">{product.product_name}</p>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-primary font-mono shrink-0">{formatCurrency(product.gross_revenue)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground pl-6.5">
                        {product.units_sold} đã bán • {product.order_count} đơn hàng
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Services */}
            <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <ReceiptIcon className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Top dịch vụ</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  {filteredServices.length} DV
                </span>
              </div>
              <div className="mt-3.5 space-y-2">
                {filteredServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Không có dịch vụ nào phù hợp.</p>
                ) : (
                  filteredServices.slice(0, 6).map((service, idx) => (
                    <div
                      key={service.service_id}
                      className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md p-3 transition-all hover:bg-background/50 hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                            {idx + 1}
                          </span>
                          <p className="truncate text-xs sm:text-sm font-bold text-foreground">{service.service_name}</p>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-primary font-mono shrink-0">{formatCurrency(service.realized_revenue)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground pl-6.5">
                        {service.appointment_count} lịch hẹn • {service.completed_count} hoàn thành
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Alert Feed */}
            <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <ReceiptIcon className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Cảnh báo vận hành</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  {filteredAlerts.length} tin
                </span>
              </div>
              <div className="mt-3.5 space-y-2">
                {filteredAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Hệ thống đang hoạt động tối ưu.</p>
                ) : (
                  filteredAlerts.slice(0, 6).map((alert) => (
                    <div
                      key={alert.alert_key}
                      className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md p-3 transition-all hover:bg-background/50 hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs sm:text-sm font-bold text-foreground">{alert.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                            alert.severity === 'critical'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{alert.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. Scheduled Report Management (Lịch gửi email báo cáo thật) */}
      <div
        id="report-scheduler-card"
        className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MailIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Scheduler Engine</p>
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Lịch gửi email báo cáo thật</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Worker cron quét mỗi giờ, tự động trích xuất dữ liệu từ D1 và đưa email báo cáo vào outbox gửi nền.
          </p>
        </div>

        {/* Mini stats */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lịch active</p>
            <p className="mt-1 text-base font-bold text-foreground">{activeScheduleCount} / {sortedSchedules.length} lịch</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email pool</p>
            <p className="mt-1 text-base font-bold text-foreground">{totalRecipientCount} người nhận</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/30 backdrop-blur-md px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lần chạy kế tiếp</p>
            <p className="mt-1 text-xs sm:text-sm font-bold text-foreground truncate">{nextSchedule?.name || 'Chưa có lịch'}</p>
            <p className="text-[10px] text-muted-foreground">{formatDateTime(nextSchedule?.next_run_at)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Form Create / Edit */}
          <div className="rounded-2xl border border-border/40 bg-background/30 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                {scheduleForm.id ? 'Cập nhật lịch gửi' : 'Tạo lịch gửi mới'}
              </p>
              {scheduleForm.id && (
                <button
                  type="button"
                  onClick={() => setScheduleForm(DEFAULT_FORM)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Hủy sửa (Tạo mới)
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-foreground">Tên lịch</span>
                <input
                  aria-label="Tên lịch"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Daily Ops Digest"
                  className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">Kỳ báo cáo</span>
                <select
                  value={scheduleForm.preset}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, preset: e.target.value as AdminReportPreset }))}
                  className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                >
                  {(Object.keys(PRESET_LABELS) as AdminReportPreset[]).map((k) => (
                    <option key={k} value={k}>{PRESET_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">Tần suất gửi</span>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, frequency: e.target.value as AdminReportFrequency }))}
                  className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                >
                  {(Object.keys(FREQUENCY_LABELS) as AdminReportFrequency[]).map((k) => (
                    <option key={k} value={k}>{FREQUENCY_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              {scheduleForm.frequency === 'weekly' && (
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-foreground">Ngày trong tuần</span>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                    className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                  >
                    {WEEKDAY_LABELS.map((w, idx) => (
                      <option key={w} value={idx}>{w}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">Giờ gửi</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={scheduleForm.hourLocal}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, hourLocal: Number(e.target.value) }))}
                  className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">Phút gửi</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={scheduleForm.minuteLocal}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, minuteLocal: Number(e.target.value) }))}
                  className="w-full h-8.5 rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-foreground">Email nhận báo cáo (phân cách bằng dấu phẩy)</span>
                <textarea
                  aria-label="Email nhận báo cáo"
                  rows={2}
                  value={scheduleForm.recipients}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, recipients: e.target.value }))}
                  placeholder="admin@thegioitrimun.vn, ops@thegioitrimun.vn"
                  className="w-full rounded-xl border-0 bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] p-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={scheduleForm.enabled}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary"
                />
                <span className="text-xs font-semibold text-foreground">Bật kích hoạt lịch gửi tự động này</span>
              </label>
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="inline-flex items-center justify-center h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 active:scale-95 disabled:opacity-50 transition-all"
              >
                {savingSchedule ? 'Đang lưu...' : scheduleForm.id ? 'Cập nhật lịch' : 'Tạo lịch'}
              </button>
              <button
                type="button"
                onClick={() => setScheduleForm(DEFAULT_FORM)}
                className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-border/60 bg-background/40 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground active:scale-95 transition-all"
              >
                Làm mới
              </button>
            </div>
          </div>

          {/* Active Schedules List */}
          <div className="rounded-2xl border border-border/40 bg-background/30 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                Danh sách lịch chạy
              </p>
              <span className="text-xs font-semibold text-primary font-mono">
                {filteredSchedules.length} lịch
              </span>
            </div>
            <div data-testid="admin-report-schedule-list" className="mt-3 space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredSchedules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">
                  Chưa có lịch gửi báo cáo nào phù hợp.
                </div>
              ) : (
                filteredSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    data-testid="admin-report-schedule-card"
                    data-schedule-name={schedule.name}
                    className="relative rounded-xl border border-white/70 bg-card/75 p-3.5 shadow-2xs backdrop-blur-xl transition-all hover:border-primary/40 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p data-testid="admin-report-schedule-name" className="truncate text-xs sm:text-sm font-bold text-foreground">
                          {schedule.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-primary">{PRESET_LABELS[schedule.preset]}</span>
                          <span>•</span>
                          <span>{FREQUENCY_LABELS[schedule.frequency]}</span>
                          {schedule.frequency === 'weekly' && schedule.day_of_week !== null && (
                            <>
                              <span>•</span>
                              <span>{WEEKDAY_LABELS[schedule.day_of_week]}</span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {String(schedule.hour_local).padStart(2, '0')}:{String(schedule.minute_local).padStart(2, '0')} • {schedule.timezone}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.2 text-[10px] font-semibold ${
                          schedule.enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {schedule.enabled ? 'Đang chạy' : 'Tạm dừng'}
                      </span>
                    </div>

                    <div className="mt-2 space-y-0.5 border-t border-border/20 pt-1.5 text-[11px] text-muted-foreground">
                      <p data-testid="admin-report-schedule-recipients" className="truncate">
                        <span className="font-medium text-foreground">Email:</span> {schedule.recipients.join(', ') || 'Chưa có'}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                        <span>Tới: <span className="font-medium text-foreground">{formatDateTime(schedule.next_run_at)}</span></span>
                        <span>Gần nhất: {formatDateTime(schedule.last_sent_at)}</span>
                      </div>
                      {schedule.last_error_message && (
                        <p className="text-rose-600 dark:text-rose-400 font-medium">Lỗi: {schedule.last_error_message}</p>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-border/20 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setScheduleForm(scheduleToForm(schedule))}
                        data-testid="admin-report-schedule-edit"
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.8 text-[11px] font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
                      >
                        <PencilIcon className="h-3 w-3" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSchedule(schedule)}
                        data-testid="admin-report-schedule-delete"
                        disabled={deletingScheduleId === schedule.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-0.8 text-[11px] font-bold text-rose-700 dark:text-rose-400 transition-all hover:bg-rose-500 hover:text-white active:scale-95 disabled:opacity-50"
                      >
                        {deletingScheduleId === schedule.id ? <Spinner className="h-3 w-3" /> : <TrashIcon className="h-3 w-3" />}
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardReportsPanel;
