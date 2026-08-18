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
  <div className="rounded-3xl border border-border bg-card px-5 py-4 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
    <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
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
    <div className="space-y-8">


      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
          <div className="flex items-center gap-2">
            <MailIcon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Scheduler</p>
              <h3 className="mt-1 text-2xl font-bold text-foreground">Lịch gửi email báo cáo thật</h3>
            </div>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Worker cron sẽ quét mỗi giờ, lấy lịch đến hạn từ D1 và đưa email báo cáo vào outbox để gửi nền. Admin chỉ cần cấu hình ở đây, không cần export thủ công.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Schedules active</p>
              <p className="mt-2 text-lg font-bold text-foreground">{activeScheduleCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">{sortedSchedules.length} lịch tổng cộng</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recipient pool</p>
              <p className="mt-2 text-lg font-bold text-foreground">{totalRecipientCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">Email nhận báo cáo duy nhất</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lần chạy kế tiếp</p>
              <p className="mt-2 text-lg font-bold text-foreground">{nextSchedule?.name || 'Chưa có'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(nextSchedule?.next_run_at)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tên lịch</span>
              <input
                value={scheduleForm.name}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
                placeholder="Daily Ops Digest"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Preset báo cáo</span>
              <select
                value={scheduleForm.preset}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, preset: event.target.value as AdminReportPreset }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
              >
                {(Object.keys(PRESET_LABELS) as AdminReportPreset[]).map((key) => (
                  <option key={key} value={key}>
                    {PRESET_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tần suất</span>
              <select
                value={scheduleForm.frequency}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, frequency: event.target.value as AdminReportFrequency }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
              >
                {(Object.keys(FREQUENCY_LABELS) as AdminReportFrequency[]).map((key) => (
                  <option key={key} value={key}>
                    {FREQUENCY_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            {scheduleForm.frequency === 'weekly' ? (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Ngày chạy</span>
                <select
                  value={scheduleForm.dayOfWeek}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfWeek: Number(event.target.value) }))}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="hidden lg:block" />
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Giờ local</span>
              <input
                type="number"
                min="0"
                max="23"
                value={scheduleForm.hourLocal}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, hourLocal: Number(event.target.value) }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Phút</span>
              <input
                type="number"
                min="0"
                max="59"
                value={scheduleForm.minuteLocal}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, minuteLocal: Number(event.target.value) }))}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
              />
            </label>

            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-sm font-medium text-foreground">Email nhận báo cáo</span>
              <textarea
                value={scheduleForm.recipients}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, recipients: event.target.value }))}
                rows={3}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
                placeholder="hovidaiphuc@gmail.com, ops@example.com"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground lg:col-span-2">
              <input
                type="checkbox"
                checked={scheduleForm.enabled}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>Bật lịch gửi báo cáo</span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSchedule ? 'Đang lưu...' : scheduleForm.id ? 'Cập nhật lịch' : 'Tạo lịch'}
            </button>
            <button
              type="button"
              onClick={() => setScheduleForm(DEFAULT_FORM)}
              className="rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Làm mới form
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Active schedules</p>
          <h3 className="mt-2 text-2xl font-bold text-foreground">Lịch đang chạy</h3>
          <div data-testid="admin-report-schedule-list" className="mt-5 space-y-3">
            {sortedSchedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                Chưa có lịch gửi báo cáo nào.
              </div>
            ) : (
              sortedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  data-testid="admin-report-schedule-card"
                  data-schedule-name={schedule.name}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p data-testid="admin-report-schedule-name" className="text-sm font-semibold text-foreground">{schedule.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {PRESET_LABELS[schedule.preset]} • {FREQUENCY_LABELS[schedule.frequency]}
                        {schedule.frequency === 'weekly' && schedule.day_of_week !== null ? ` • ${WEEKDAY_LABELS[schedule.day_of_week]}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {String(schedule.hour_local).padStart(2, '0')}:{String(schedule.minute_local).padStart(2, '0')} • {schedule.timezone}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${schedule.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p data-testid="admin-report-schedule-recipients">Email: {schedule.recipients.join(', ') || 'Chưa có'}</p>
                    <p>Lần chạy kế tiếp: {formatDateTime(schedule.next_run_at)}</p>
                    <p>Lần gửi gần nhất: {formatDateTime(schedule.last_sent_at)}</p>
                    {schedule.last_error_message ? (
                      <p className="text-rose-700">Lỗi gần nhất: {schedule.last_error_message}</p>
                    ) : null}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleForm(scheduleToForm(schedule))}
                      data-testid="admin-report-schedule-edit"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <PencilIcon className="h-4 w-4" />
                      <span>Chỉnh sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSchedule(schedule)}
                      data-testid="admin-report-schedule-delete"
                      disabled={deletingScheduleId === schedule.id}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingScheduleId === schedule.id ? <Spinner className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-border bg-card">
          <Spinner />
        </div>
      ) : !snapshot ? (
        <div className="rounded-[2rem] border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Không có dữ liệu báo cáo.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Net revenue" value={formatCurrency(snapshot.net_revenue)} hint={`Gross ${formatCurrency(snapshot.gross_revenue)}`} />
            <MetricTile label="Paid orders" value={String(snapshot.paid_orders)} hint={`${snapshot.total_orders} tổng đơn`} />
            <MetricTile label="Khách mới" value={String(snapshot.new_customers)} hint={`${snapshot.returning_customers} returning`} />
            <MetricTile label="Schedules active" value={String(activeScheduleCount)} hint={`${alerts.length} alert • preset ${PRESET_LABELS[preset]}`} />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Top sản phẩm</h3>
              </div>
              <div className="mt-4 space-y-3">
                {topProducts.slice(0, 6).map((product) => (
                  <div key={product.product_id} className="rounded-2xl border border-border/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-foreground">{product.product_name}</p>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(product.gross_revenue)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{product.units_sold} units • {product.order_count} orders</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Top dịch vụ</h3>
              </div>
              <div className="mt-4 space-y-3">
                {topServices.slice(0, 6).map((service) => (
                  <div key={service.service_id} className="rounded-2xl border border-border/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-foreground">{service.service_name}</p>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(service.realized_revenue)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{service.appointment_count} appointments • {service.completed_count} completed</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Alert feed</h3>
              </div>
              <div className="mt-4 space-y-3">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.alert_key} className="rounded-2xl border border-border/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{alert.severity}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardReportsPanel;
