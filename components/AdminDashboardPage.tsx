import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftIcon,
  CogIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  BlogIcon,
  ServiceListIcon,
  ShoppingBagIcon,
  CalendarDaysIcon,
  DocumentDuplicateIcon,
  PlusCircleIcon,
} from './icons';
import AnimatedSection from './AnimatedSection';
import AnimatedCounter from './AnimatedCounter';
import Spinner from './Spinner';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import type {
  AdminDashboardAlert,
  AdminDashboardKpiSnapshot,
  AdminDashboardTimeseriesPoint,
  AdminInventoryMetrics,
  AdminCustomerMetric,
  AdminTopProductMetric,
  AdminServicePerformanceMetric,
  AdminDashboardSection,
  AdminNavigationView,
  DoctorDetail,
  ObservabilityLogEntry,
  ObservabilityLogsResponse,
  ProductOrder,
  Service,
} from '../types';
import AdminDashboardCustomersPanel from './AdminDashboardCustomersPanel';
import AdminDashboardAppointmentsPanel, { type AppointmentPanelSeed } from './AdminDashboardAppointmentsPanel';
import AdminDashboardReportsPanel from './AdminDashboardReportsPanel';

type DashboardPanel = AdminDashboardSection;
type DashboardPreset = '7d' | '30d' | '90d';

interface AdminDashboardPageProps {
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
  initialPanel?: DashboardPanel;
  productOrders: ProductOrder[];
  services: Service[];
  doctors: DoctorDetail[];
}

const PRESET_LABELS: Record<DashboardPreset, string> = {
  '7d': 'Tuần này',
  '30d': '30 ngày',
  '90d': '90 ngày',
};

const segmentLabels: Record<AdminCustomerMetric['segment'], string> = {
  hybrid_customer: 'Hybrid',
  product_only_customer: 'Chỉ mua hàng',
  service_only_customer: 'Chỉ dịch vụ',
  lead_only_customer: 'Mới tạo hồ sơ',
};

const severityStyles: Record<AdminDashboardAlert['severity'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  high: 'border-amber-200 bg-amber-50 text-amber-800',
  medium: 'border-sky-200 bg-sky-50 text-sky-800',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: value >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value || 0);

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const formatCurrencyCompact = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount || 0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDashboardError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /AbortError|timed out|timeout|network/i.test(message);
};

const getPresetRange = (preset: DashboardPreset) => {
  const to = new Date();
  const from = new Date(to);
  if (preset === '7d') {
    const daysSinceMonday = (to.getDay() + 6) % 7;
    from.setDate(to.getDate() - daysSinceMonday);
    from.setHours(0, 0, 0, 0);
  }
  if (preset === '30d') from.setDate(to.getDate() - 30);
  if (preset === '90d') from.setDate(to.getDate() - 90);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: preset === '90d' ? ('week' as const) : ('day' as const),
  };
};

type TrendBucket = {
  key: string;
  label: string;
  totalOrders: number;
  netRevenue: number;
  appointmentsTotal: number;
};

const compressTimeseries = (points: AdminDashboardTimeseriesPoint[], maxBuckets: number): TrendBucket[] => {
  if (!points.length) return [];
  const safeMax = Math.max(maxBuckets, 1);
  const bucketSize = Math.max(1, Math.ceil(points.length / safeMax));
  const buckets: TrendBucket[] = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const slice = points.slice(index, index + bucketSize);
    const first = slice[0];
    const last = slice[slice.length - 1];
    const firstLabel = formatDateLabel(first.bucket_start);
    const lastLabel = formatDateLabel(last.bucket_start);

    buckets.push({
      key: `${first.bucket_start}-${last.bucket_start}`,
      label: firstLabel === lastLabel ? firstLabel : `${firstLabel}–${lastLabel}`,
      totalOrders: slice.reduce((sum, point) => sum + Number(point.total_orders || 0), 0),
      netRevenue: slice.reduce((sum, point) => sum + Number(point.net_revenue || 0), 0),
      appointmentsTotal: slice.reduce((sum, point) => sum + Number(point.appointments_total || 0), 0),
    });
  }

  return buckets.slice(-safeMax);
};

const buildSparklinePath = (values: number[], width: number, height: number, padding = 12) => {
  if (!values.length) return '';
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x = padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = padding + innerHeight - ratio * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}> = ({ label, value, hint, onClick }) => {
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-bold leading-none text-foreground md:text-[2.45rem]">{value}</p>
      {hint ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
    </>
  );

  if (!onClick) {
    return <div className="rounded-[1.25rem] border border-border bg-card/95 p-4 shadow-sm md:p-5">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.25rem] border border-border bg-card/95 p-4 text-left shadow-sm transition-all hover:border-primary/35 hover:bg-background md:p-5"
    >
      {content}
    </button>
  );
};

const TrendBoard: React.FC<{
  points: TrendBucket[];
  presetLabel: string;
  snapshot: AdminDashboardKpiSnapshot | null;
}> = ({ points, presetLabel, snapshot }) => {
  const values = points.map((point) => point.netRevenue);
  const linePath = buildSparklinePath(values, 640, 220, 18);
  const areaPath = linePath ? `${linePath} L 622 202 L 18 202 Z` : '';
  const maxRevenue = Math.max(...values, 1);
  const bestBucket = points.reduce<TrendBucket | null>((best, point) => {
    if (!best) return point;
    return point.netRevenue > best.netRevenue ? point : best;
  }, null);
  const avgRevenue = points.length > 0 ? values.reduce((sum, value) => sum + value, 0) / points.length : 0;
  const avgOrders = points.length > 0 ? points.reduce((sum, point) => sum + point.totalOrders, 0) / points.length : 0;

  return (
    <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Executive trend</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Xu hướng gọn theo kỳ</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Nén dữ liệu theo cụm để nhìn nhanh doanh thu, đơn hàng và lịch hẹn mà không bị dày cột theo ngày.
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {presetLabel}
        </span>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cụm tốt nhất</p>
          <p className="mt-2 text-lg font-bold text-foreground">{bestBucket?.label || 'N/A'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatCurrencyCompact(bestBucket?.netRevenue || 0)} net revenue</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Doanh thu bình quân</p>
          <p className="mt-2 text-lg font-bold text-foreground">{formatCurrencyCompact(avgRevenue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{points.length} cụm dữ liệu</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Orders bình quân</p>
          <p className="mt-2 text-lg font-bold text-foreground">{formatCompactNumber(Math.round(avgOrders))}</p>
          <p className="mt-1 text-sm text-muted-foreground">Trên mỗi cụm kỳ</p>
        </div>
      </div>
      <div className="rounded-[1.75rem] border border-border/70 bg-secondary/35 p-4">
        <svg viewBox="0 0 640 220" className="h-52 w-full" role="img" aria-label="Biểu đồ xu hướng doanh thu">
          <defs>
            <linearGradient id="dashboardTrendArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(53,92,49,0.26)" />
              <stop offset="100%" stopColor="rgba(53,92,49,0.04)" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="18"
              y1={18 + (202 - 18) * ratio}
              x2="622"
              y2={18 + (202 - 18) * ratio}
              stroke="rgba(123,107,85,0.12)"
              strokeDasharray="4 8"
            />
          ))}
          {areaPath ? <path d={areaPath} fill="url(#dashboardTrendArea)" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="#355c31" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((point, index) => {
            const x = 18 + (points.length === 1 ? 302 : (index / (points.length - 1)) * (622 - 18));
            const y = values.length ? 18 + (202 - 18) - ((point.netRevenue / maxRevenue) * (202 - 18)) : 110;
            return (
              <g key={point.key}>
                <circle cx={x} cy={y} r="5" fill="#355c31" />
                <text x={x} y="214" textAnchor="middle" fontSize="11" fill="#7b6b55">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Net revenue</p>
          <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(snapshot?.net_revenue || 0)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Đơn trong kỳ</p>
          <p className="mt-2 text-xl font-bold text-foreground">{formatCompactNumber(snapshot?.total_orders || 0)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lịch hẹn mới</p>
          <p className="mt-2 text-xl font-bold text-foreground">{formatCompactNumber(snapshot?.appointments_total || 0)}</p>
        </div>
      </div>
    </div>
  );
};

type RankedChartRow = {
  label: string;
  value: number;
  valueLabel: string;
  meta?: string;
};

const RankedBarChart: React.FC<{
  title: string;
  eyebrow: string;
  rows: RankedChartRow[];
  emptyLabel: string;
  accent?: 'teal' | 'coral' | 'amber';
}> = ({ title, eyebrow, rows, emptyLabel, accent = 'teal' }) => {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const barClasses = {
    teal: 'bg-primary',
    coral: 'bg-[#e97862]',
    amber: 'bg-[#dca846]',
  }[accent];

  return (
    <section className="group/card rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/95 hover:shadow-[0_36px_85px_-36px_rgba(24,35,32,0.65)] dark:border-white/10 dark:hover:border-white/25">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">{title}</h2>
      {rows.length === 0 ? (
        <div className="mt-5 flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-transparent px-5 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-6 space-y-4" role="img" aria-label={title}>
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="group/row -mx-2.5 rounded-xl px-2.5 py-1.5 transition-colors duration-200 hover:bg-primary/5"
            >
              <div className="mb-2 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover/row:text-primary md:text-[15px]">
                    <span className="mr-2 text-muted-foreground group-hover/row:text-primary/70">{index + 1}.</span>{row.label}
                  </p>
                  {row.meta ? <p className="mt-1 truncate text-xs text-muted-foreground">{row.meta}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground tabular-nums">{row.valueLabel}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary/80" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barClasses} group-hover/row:brightness-105`}
                  style={{ width: row.value > 0 ? `${Math.max(5, (row.value / maxValue) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const RevenueComparisonChart: React.FC<{
  productRevenue: number;
  serviceRevenue: number;
  periodLabel: string;
}> = ({ productRevenue, serviceRevenue, periodLabel }) => {
  const rows = [
    { label: 'Bán sản phẩm', value: productRevenue, color: 'bg-primary' },
    { label: 'Dịch vụ da liễu', value: serviceRevenue, color: 'bg-[#e97862]' },
  ];
  const maxValue = Math.max(productRevenue, serviceRevenue, 1);
  const totalRevenue = productRevenue + serviceRevenue;

  return (
    <section className="group/card rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-7 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/95 hover:shadow-[0_36px_85px_-36px_rgba(24,35,32,0.65)] dark:border-white/10 dark:hover:border-white/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Doanh số</p>
          <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Sản phẩm và dịch vụ</h2>
        </div>
        <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs transition-colors">{periodLabel}</span>
      </div>
      <div className="mt-7 space-y-7" role="img" aria-label={`Biểu đồ doanh số ${periodLabel}`}>
        {rows.map((row) => (
          <div key={row.label} className="group/row -mx-2.5 rounded-xl px-2.5 py-1.5 transition-colors duration-200 hover:bg-muted/40">
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-foreground transition-colors group-hover/row:text-primary md:text-base">{row.label}</p>
              <p className="text-base font-bold text-foreground tabular-nums md:text-lg">
                <AnimatedCounter value={row.value} formatter={formatCurrency} />
              </p>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-secondary md:h-6">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${row.color} group-hover/row:brightness-105`}
                style={{ width: row.value > 0 ? `${Math.max(6, (row.value / maxValue) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-between gap-4 border-t border-border pt-5">
        <span className="text-sm text-muted-foreground">Tổng doanh số ghi nhận</span>
        <strong className="text-lg text-foreground tabular-nums md:text-xl">
          <AnimatedCounter value={totalRevenue} formatter={formatCurrency} />
        </strong>
      </div>
    </section>
  );
};

const WeeklyRevenueTrendChart: React.FC<{ points: TrendBucket[] }> = ({ points }) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const values = points.map((point) => point.netRevenue);
  const linePath = buildSparklinePath(values, 640, 220, 24);
  const areaPath = linePath ? `${linePath} L 616 196 L 24 196 Z` : '';

  const coords = useMemo(() => {
    if (!points.length) return [];
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const innerWidth = 640 - 48;
    const innerHeight = 220 - 48;
    return points.map((point, index) => {
      const x = 24 + (points.length === 1 ? 296 : (index / (points.length - 1)) * innerWidth);
      const ratio = max === min ? 0.5 : (point.netRevenue - min) / (max - min);
      const y = 24 + innerHeight - ratio * innerHeight;
      return { ...point, x, y };
    });
  }, [points, values]);

  return (
    <section className="group/card relative rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-7 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/95 hover:shadow-[0_36px_85px_-36px_rgba(24,35,32,0.65)] dark:border-white/10 dark:hover:border-white/25">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Nhịp bán hàng</p>
          <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Doanh thu sản phẩm theo ngày</h2>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="mt-5 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border bg-background px-5 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu doanh thu trong tuần này.
        </div>
      ) : (
        <div
          className="relative mt-5 overflow-hidden rounded-2xl bg-transparent p-2 sm:p-4"
          onMouseLeave={() => setActivePointIndex(null)}
        >
          {/* Glassmorphism Interactive Tooltip */}
          {activePointIndex !== null && coords[activePointIndex] && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-white/80 bg-card/95 px-3 py-2 shadow-[0_12px_28px_-8px_rgba(24,35,32,0.35)] backdrop-blur-xl transition-all duration-150 ease-out dark:border-white/15"
              style={{
                left: `${Math.min(90, Math.max(10, (coords[activePointIndex].x / 640) * 100))}%`,
                top: `${Math.max(14, (coords[activePointIndex].y / 220) * 100 - 6)}%`,
              }}
            >
              <p className="text-[11px] font-semibold text-muted-foreground">{coords[activePointIndex].label}</p>
              <p className="text-xs font-bold text-primary">{formatCurrency(coords[activePointIndex].netRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{coords[activePointIndex].totalOrders} đơn hàng</p>
            </div>
          )}
          <svg viewBox="0 0 640 220" className="h-56 w-full overflow-visible" role="img" aria-label="Biểu đồ doanh thu sản phẩm theo ngày">
            <defs>
              <linearGradient id="weeklyProductRevenueArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(36,145,125,0.28)" />
                <stop offset="100%" stopColor="rgba(36,145,125,0.02)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1="24" y1={24 + 172 * ratio} x2="616" y2={24 + 172 * ratio} stroke="rgba(90,102,115,0.16)" strokeDasharray="4 8" />
            ))}
            {areaPath ? <path d={areaPath} fill="url(#weeklyProductRevenueArea)" className="transition-all duration-700 ease-out" /> : null}
            {linePath ? <path d={linePath} fill="none" stroke="#24917d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 ease-out" /> : null}
            {/* Active Vertical Guide */}
            {activePointIndex !== null && coords[activePointIndex] ? (
              <line
                x1={coords[activePointIndex].x}
                y1={24}
                x2={coords[activePointIndex].x}
                y2={196}
                stroke="rgba(36,145,125,0.45)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
            ) : null}
            {/* Interactive Dots */}
            {coords.map((point, index) => {
              const isActive = activePointIndex === index;
              return (
                <g
                  key={point.key}
                  className="cursor-pointer"
                  onMouseEnter={() => setActivePointIndex(index)}
                  onTouchStart={() => setActivePointIndex(index)}
                >
                  <circle cx={point.x} cy={point.y} r="18" fill="transparent" />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? 6 : 3.5}
                    fill="#24917d"
                    stroke="#ffffff"
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className="transition-all duration-200 ease-out"
                  />
                  <text
                    x={point.x}
                    y="216"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={isActive ? 'bold' : 'normal'}
                    fill={isActive ? '#24917d' : '#667085'}
                    className="transition-colors duration-200 select-none"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
};

const OperationsDigest: React.FC<{
  snapshot: AdminDashboardKpiSnapshot | null;
  inventory: AdminInventoryMetrics | null;
  alerts: AdminDashboardAlert[];
  onOpenOrders: () => void;
  onOpenAppointments: () => void;
  onOpenReports: () => void;
  onOpenInventory: () => void;
}> = ({ snapshot, inventory, alerts, onOpenOrders, onOpenAppointments, onOpenReports, onOpenInventory }) => {
  const items = [
    {
      label: 'Đơn chờ xử lý',
      value: formatCompactNumber(snapshot?.pending_orders || 0),
      meta: `${formatCompactNumber(snapshot?.completed_orders || 0)} hoàn tất`,
      onClick: onOpenOrders,
    },
    {
      label: 'Rủi ro kho',
      value: formatCompactNumber((inventory?.low_stock_products || 0) + (inventory?.out_of_stock_products || 0)),
      meta: `${formatCompactNumber(inventory?.out_of_stock_products || 0)} hết hàng`,
      onClick: onOpenInventory,
    },
    {
      label: 'Lịch hẹn chờ xác nhận',
      value: formatCompactNumber(snapshot?.appointments_pending || 0),
      meta: `${formatCompactNumber(snapshot?.appointments_completed || 0)} completed`,
      onClick: onOpenAppointments,
    },
    {
      label: 'Discount + thuế',
      value: formatCurrencyCompact((snapshot?.discount_total || 0) + (snapshot?.tax_total || 0)),
      meta: `${alerts.length} alert mở`,
      onClick: onOpenReports,
    },
  ];

  return (
    <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Operations digest</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Điều hành ngắn gọn</h2>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition-colors hover:border-primary/35"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{item.value}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const AlertFeed: React.FC<{
  alerts: AdminDashboardAlert[];
  onTakeAction: (alert: AdminDashboardAlert) => void;
}> = ({ alerts, onTakeAction }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Alerts</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Các điểm cần để ý</h2>
      </div>
      <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {alerts.length} mục
      </span>
    </div>
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
          Không có cảnh báo nghiêm trọng trong thời điểm hiện tại.
        </div>
      ) : (
        alerts.slice(0, 4).map((alert) => (
          <button
            key={alert.alert_key}
            type="button"
            onClick={() => onTakeAction(alert)}
            className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${severityStyles[alert.severity]} transition-transform hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">{alert.alert_type.replace(/_/g, ' ')}</p>
                <p className="mt-2 font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm opacity-90">{alert.description}</p>
              </div>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                {alert.severity}
              </span>
            </div>
            <p className="mt-3 text-xs opacity-80">{formatDateTime(alert.created_at)}</p>
          </button>
        ))
      )}
    </div>
  </div>
);

const MiniLeaderboard: React.FC<{
  title: string;
  kicker: string;
  rows: Array<{ label: string; value: string; meta?: string }>;
}> = ({ title, kicker, rows }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{kicker}</p>
    <h2 className="mt-2 text-2xl font-bold text-foreground">{title}</h2>
    <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-border/70 bg-background px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-secondary/30">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {index + 1}
                </span>
                <p className="truncate font-semibold text-foreground">{row.label}</p>
              </div>
              {row.meta ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.meta}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold text-primary">{row.value}</p>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const QuickActionGrid: React.FC<{
  adminLinks: Array<{
    target: AdminNavigationView;
    title: string;
    description: string;
    icon: React.ReactNode;
    eyebrow: string;
    meta?: string;
    actionLabel?: string;
  }>;
  onNavigate: (page: AdminNavigationView) => void;
}> = ({ adminLinks, onNavigate }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Workspace map</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Khu vực quản trị</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Mỗi module đại diện cho một mảng vận hành riêng. Chọn đúng khu vực để vào nhanh, thay vì phải nhớ đường đi trong admin.
      </p>
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {adminLinks.map((link) => (
        <button
          key={`${link.target.page}-${'action' in link.target ? link.target.action || 'default' : 'default'}`}
          onClick={() => onNavigate(link.target)}
          className="group flex h-full flex-col rounded-[1.5rem] border border-border/80 bg-background px-5 py-5 text-left shadow-[0_12px_24px_-24px_rgba(28,24,18,0.4)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-secondary/25"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">{link.icon}</div>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {link.eyebrow}
            </span>
          </div>
          <div className="mt-5">
            <h3 className="text-lg font-bold text-foreground">{link.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{link.description}</p>
            {link.meta ? <p className="mt-4 text-sm font-medium text-foreground/80">{link.meta}</p> : null}
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
            <span>{link.actionLabel || 'Mở khu vực'}</span>
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
          </div>
        </button>
      ))}
    </div>
  </div>
);

const PriorityActionsCard: React.FC<{
  pendingOrders: number;
  pendingAppointments: number;
  alertCount: number;
  onCreateProduct: () => void;
  onOpenOrders: () => void;
  onOpenAppointments: () => void;
  onOpenAlerts: () => void;
}> = ({
  pendingOrders,
  pendingAppointments,
  alertCount,
  onCreateProduct,
  onOpenOrders,
  onOpenAppointments,
  onOpenAlerts,
}) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Priority actions</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Tác vụ ưu tiên</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Đi thẳng vào thao tác thường dùng nhất từ dashboard mà không cần vòng qua từng module.
      </p>
    </div>
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCreateProduct}
        className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-primary/20 bg-primary/5 px-4 py-4 text-left transition-colors hover:border-primary/35 hover:bg-primary/10"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Tạo nhanh</p>
          <p className="mt-2 text-lg font-bold text-foreground">Tạo sản phẩm mới</p>
          <p className="mt-1 text-sm text-muted-foreground">Mở thẳng form tạo mới trong khu sản phẩm.</p>
        </div>
        <PlusCircleIcon className="mt-1 h-6 w-6 text-primary" />
      </button>
      <button
        type="button"
        onClick={onOpenOrders}
        className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition-colors hover:border-primary/35"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Đơn hàng</p>
          <p className="mt-2 text-lg font-bold text-foreground">Xử lý đơn đang chờ</p>
          <p className="mt-1 text-sm text-muted-foreground">{pendingOrders} đơn cần theo dõi ngay.</p>
        </div>
        <ShoppingBagIcon className="mt-1 h-6 w-6 text-primary" />
      </button>
      <button
        type="button"
        onClick={onOpenAppointments}
        className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition-colors hover:border-primary/35"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lịch hẹn</p>
          <p className="mt-2 text-lg font-bold text-foreground">Kiểm tra lịch chờ xác nhận</p>
          <p className="mt-1 text-sm text-muted-foreground">{pendingAppointments} lịch hẹn đang cần phản hồi.</p>
        </div>
        <CalendarDaysIcon className="mt-1 h-6 w-6 text-primary" />
      </button>
      <button
        type="button"
        onClick={onOpenAlerts}
        className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition-colors hover:border-primary/35"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cảnh báo</p>
          <p className="mt-2 text-lg font-bold text-foreground">Mở các điểm cần chú ý</p>
          <p className="mt-1 text-sm text-muted-foreground">{alertCount} cảnh báo vận hành đang mở.</p>
        </div>
        <DocumentDuplicateIcon className="mt-1 h-6 w-6 text-primary" />
      </button>
    </div>
  </div>
);

const TodayWorkBoard: React.FC<{
  items: Array<{
    label: string;
    value: string;
    description: string;
    meta: string;
    onClick: () => void;
    tone?: string;
    priority?: string;
    sla?: string;
  }>;
}> = ({ items }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Today queue</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Việc cần xử lý hôm nay</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Dashboard này ưu tiên backlog, ngoại lệ và cảnh báo runtime trước. KPI và báo cáo được đưa xuống sau để không che mất việc vận hành.
      </p>
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="rounded-[1.5rem] border border-border/80 bg-background px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-secondary/20"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            {item.priority ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">{item.priority}</span> : null}
            {item.sla ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">SLA {item.sla}</span> : null}
          </div>
          <p className={`mt-3 text-3xl font-black ${item.tone || 'text-foreground'}`}>{item.value}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{item.description}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.meta}</p>
        </button>
      ))}
    </div>
  </div>
);

const OperationsInbox: React.FC<{
  items: Array<{
    title: string;
    owner: string;
    priority: string;
    sla: string;
    status: string;
    summary: string;
    onClick: () => void;
  }>;
}> = ({ items }) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Operations inbox</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Việc mở theo mức ưu tiên</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Đây là lớp điều phối sâu hơn Today queue: mỗi mục gắn owner, SLA và route đích để người vận hành vào đúng hàng đợi ngay.
      </p>
    </div>
    <div className="mt-5 space-y-3">
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={item.onClick}
          className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">{item.priority}</span>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">SLA {item.sla}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.owner}</span>
            </div>
            <p className="mt-3 text-base font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">{item.status}</span>
        </button>
      ))}
    </div>
  </div>
);

const RuntimeHealthCard: React.FC<{
  logs: ObservabilityLogEntry[];
  meta: ObservabilityLogsResponse | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenObservability: () => void;
}> = ({ logs, meta, isLoading, error, onRefresh, onOpenObservability }) => {
  const channelStats = useMemo(() => {
    const counts = new Map<string, number>();
    logs.forEach((entry) => {
      const key = entry.channel || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel))
      .slice(0, 4);
  }, [logs]);

  const latestEntry = logs[0] || null;

  return (
    <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Runtime health</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Quan sát lỗi gần đây</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tóm tắt nhanh log runtime để thấy có lỗi mới hay không mà không phải chuyển sang module cấu hình site.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/35 hover:text-primary"
        >
          Làm mới
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Log đang xem</p>
          <p className="mt-2 text-lg font-bold text-foreground">{logs.length}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Objects quét</p>
          <p className="mt-2 text-lg font-bold text-foreground">{meta?.scanned_objects ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Lần gần nhất</p>
          <p className="mt-2 text-lg font-bold text-foreground">{formatRelativeTime(latestEntry?.recorded_at || null)}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 flex min-h-[140px] items-center justify-center rounded-[1.5rem] border border-border bg-background">
          <Spinner />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-[1.5rem] border border-border/80 bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-foreground">Phân bố theo channel</p>
              <button type="button" onClick={onOpenObservability} className="text-sm font-semibold text-primary hover:text-primary/80">
                Mở observability
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {channelStats.length > 0 ? channelStats.map((item) => (
                <span key={item.channel} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
                  {item.channel} • {item.count}
                </span>
              )) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  Không có lỗi mới trong cửa sổ hiện tại
                </span>
              )}
            </div>
          </div>

          {latestEntry ? (
            <div className="rounded-[1.5rem] border border-border/80 bg-background p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{latestEntry.channel || 'runtime'} • {formatDateTime(latestEntry.recorded_at)}</p>
              <p className="mt-2 text-base font-semibold text-foreground">{latestEntry.message || latestEntry.resource || latestEntry.type || 'Sự kiện runtime'}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{latestEntry.context || latestEntry.path || latestEntry.href || latestEntry.details || 'Không có mô tả bổ sung.'}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const SystemOperationsCard: React.FC<{
  data: api.AdminSystemOperations | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}> = ({ data, loading, error, onRefresh }) => {
  const shipping = data?.integrations?.shipping;
  const rows = [
    { label: 'Email đang chờ', value: data?.notificationOutbox.length ?? 0, tone: 'text-amber-700' },
    { label: 'GHTK outbox', value: data?.shippingOutbox.length ?? 0, tone: 'text-sky-700' },
    { label: 'Vấn đề migration', value: data?.migrationIssues.length ?? 0, tone: 'text-rose-700' },
    { label: 'Lịch báo cáo', value: data?.reportSchedules.length ?? 0, tone: 'text-emerald-700' },
  ];
  return (
    <div className="group/card rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/95 hover:shadow-[0_36px_85px_-36px_rgba(24,35,32,0.65)] dark:border-white/10 dark:hover:border-white/25 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">System operations</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">D1, email và tích hợp</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Trạng thái thực từ D1; tích hợp đang tắt được hiển thị rõ và không làm treo dashboard.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/35 hover:text-primary active:scale-95"
        >
          <span>Làm mới</span>
        </button>
      </div>
      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{row.label}</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${row.tone}`}>
                  <AnimatedCounter value={row.value} />
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">D1 hoạt động</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${shipping?.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted text-muted-foreground'}`}>
              GHTK: {shipping?.enabled ? 'Đã bật' : 'Chưa bật'}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {data?.auditLog.length ?? 0} thao tác audit gần nhất
            </span>
          </div>
        </>
      )}
    </div>
  );
};

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigate,
  onBack,
  initialPanel,
  productOrders,
  services,
  doctors,
}) => {
  const { t } = useTranslation();
  const setSidebarConfig = useAdminLayoutDispatch();
  const [activePanel, setActivePanel] = useState<DashboardPanel>(initialPanel || 'overview');
  const [preset, setPreset] = useState<DashboardPreset>('7d');
  const [snapshot, setSnapshot] = useState<AdminDashboardKpiSnapshot | null>(null);
  const [timeseries, setTimeseries] = useState<AdminDashboardTimeseriesPoint[]>([]);
  const [inventory, setInventory] = useState<AdminInventoryMetrics | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerMetric[]>([]);
  const [topProducts, setTopProducts] = useState<AdminTopProductMetric[]>([]);
  const [topServices, setTopServices] = useState<AdminServicePerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<AdminDashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState<ObservabilityLogEntry[]>([]);
  const [runtimeMeta, setRuntimeMeta] = useState<ObservabilityLogsResponse | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [systemOperations, setSystemOperations] = useState<api.AdminSystemOperations | null>(null);
  const [systemOperationsLoading, setSystemOperationsLoading] = useState(false);
  const [systemOperationsError, setSystemOperationsError] = useState<string | null>(null);
  const [appointmentSeed, setAppointmentSeed] = useState<AppointmentPanelSeed | null>(null);
  const [appointmentSeedKey, setAppointmentSeedKey] = useState(0);
  const [isOverviewMounted, setIsOverviewMounted] = useState(false);

  useEffect(() => {
    if (activePanel === 'overview') {
      const timer = setTimeout(() => {
        setIsOverviewMounted(true);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setIsOverviewMounted(false);
    }
  }, [activePanel]);

  const panelButtons = useMemo(
    () => [
      { key: 'overview' as const, label: 'Tổng quan', icon: <CogIcon className="h-4 w-4" /> },
      { key: 'orders' as const, label: 'Đơn hàng', icon: <ShoppingBagIcon className="h-4 w-4" /> },
      { key: 'customers' as const, label: 'Khách hàng', icon: <UsersIcon className="h-4 w-4" /> },
      { key: 'appointments' as const, label: 'Lịch hẹn', icon: <CalendarDaysIcon className="h-4 w-4" /> },
      { key: 'reports' as const, label: 'Báo cáo', icon: <DocumentDuplicateIcon className="h-4 w-4" /> },
    ],
    [],
  );

  const dashboardTaskItems = useMemo(
    () => panelButtons.map((item) => ({
      key: item.key,
      label: item.label,
      onClick: () => {
        if (item.key === 'orders') {
          onNavigate({ page: 'adminPharmacyManagement', section: 'orders' });
          return;
        }
        setActivePanel(item.key);
        onNavigate({ page: 'adminDashboard', section: item.key });
      },
    })),
    [onNavigate, panelButtons],
  );

  const workspaceInsights = useMemo(
    () => [
      {
        label: 'Backlog hôm nay',
        value: formatCompactNumber((snapshot?.pending_orders || 0) + (snapshot?.appointments_pending || 0)),
        hint: `${formatCompactNumber(snapshot?.pending_orders || 0)} đơn chờ • ${formatCompactNumber(snapshot?.appointments_pending || 0)} lịch hẹn pending`,
      },
      {
        label: 'Rủi ro vận hành',
        value: formatCompactNumber(alerts.length),
        hint: inventory ? `${formatCompactNumber(inventory.low_stock_products + inventory.out_of_stock_products)} điểm nghẽn kho` : 'Theo dõi alerts, runtime và kho',
      },
      {
        label: 'Runtime mới',
        value: formatCompactNumber(runtimeLogs.length),
        hint: runtimeLogs.length > 0 ? `${formatRelativeTime(runtimeLogs[0]?.recorded_at || null)} • ${runtimeLogs[0]?.channel || 'runtime'}` : 'Chưa có lỗi mới gần đây',
      },
    ],
    [alerts.length, inventory, runtimeLogs, snapshot]
  );

  useEffect(() => {
    setActivePanel(initialPanel || 'overview');
  }, [initialPanel]);

  const adminLinks = useMemo(
    () => [
      {
        target: { page: 'adminUserManagement' as const, section: 'doctors' as const },
        title: t('admin.user_management_title'),
        description: t('admin.user_management_desc'),
        eyebrow: 'Khách hàng',
        meta: snapshot
          ? `${formatCompactNumber(snapshot.new_customers)} khách mới • ${formatCompactNumber(snapshot.returning_customers)} quay lại`
          : 'Theo dõi hồ sơ, bác sĩ và nhóm khách hàng',
        actionLabel: 'Mở người dùng',
        icon: <UsersIcon className="h-8 w-8" />,
      },
      {
        target: { page: 'adminServiceManagement' as const },
        title: t('admin.service_management_title'),
        description: t('admin.service_management_desc'),
        eyebrow: 'Clinic',
        meta: snapshot
          ? `${formatCompactNumber(snapshot.appointments_total)} lịch hẹn • ${formatCompactNumber(services.length)} dịch vụ`
          : 'Quản lý gói dịch vụ và hiệu suất vận hành',
        actionLabel: 'Mở dịch vụ',
        icon: <ServiceListIcon className="h-8 w-8" />,
      },
      {
        target: { page: 'adminPharmacyManagement' as const, section: 'products' as const },
        title: t('admin.pharmacy_management_title'),
        description: t('admin.pharmacy_management_desc'),
        eyebrow: 'Bán hàng & kho',
        meta: inventory
          ? `${formatCompactNumber(inventory.total_products)} SKU • ${formatCompactNumber(inventory.low_stock_products)} sắp hết hàng`
          : 'Sản phẩm, tồn kho, thương hiệu, giảm giá và GHTK',
        actionLabel: 'Mở sản phẩm',
        icon: <ShoppingBagIcon className="h-8 w-8" />,
      },
      {
        target: { page: 'adminPharmacyManagement' as const, section: 'products' as const, action: 'new-product' as const },
        title: 'Tạo sản phẩm mới',
        description: 'Mở thẳng form tạo mới sản phẩm để nhập nhanh mà không cần qua danh sách.',
        eyebrow: 'Tạo nhanh',
        meta: 'Shortcut dành cho thao tác nhập sản phẩm mới.',
        actionLabel: 'Tạo ngay',
        icon: <PlusCircleIcon className="h-8 w-8" />,
      },
      {
        target: { page: 'adminBlogManagement' as const, section: 'posts' as const },
        title: t('admin.blog_management_title'),
        description: t('admin.blog_management_desc'),
        eyebrow: 'Nội dung',
        meta: 'Quản lý bài viết, danh mục và cập nhật SEO nội dung.',
        actionLabel: 'Mở blog',
        icon: <BlogIcon className="h-8 w-8" />,
      },
      {
        target: { page: 'adminSiteManagement' as const, section: 'branding' as const },
        title: t('admin.site_management_title'),
        description: t('admin.site_management_desc'),
        eyebrow: 'Site ops',
        meta: `${formatCompactNumber(alerts.length)} cảnh báo • banner, footer, FAQ, payment`,
        actionLabel: 'Mở cấu hình site',
        icon: <WrenchScrewdriverIcon className="h-8 w-8" />,
      },
    ],
    [alerts.length, inventory, services.length, snapshot, t],
  );

  const todayOrderSignals = useMemo(() => {
    const priorityQueue = productOrders.filter((order) => {
      const createdAt = new Date(order.created_at);
      const ageHours = Number.isNaN(createdAt.getTime()) ? 0 : (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      const status = order.fulfillment_status || (order.status === 'processing' ? 'processing' : order.status === 'shipped' ? 'shipped' : order.status === 'completed' ? 'completed' : order.status === 'cancelled' ? 'cancelled' : 'pending');
      return (status === 'pending' && ageHours >= 6) || (status === 'processing' && ageHours >= 12);
    }).length;

    const missingShipping = productOrders.filter((order) => {
      const status = order.fulfillment_status || (order.status === 'processing' ? 'processing' : order.status === 'shipped' ? 'shipped' : order.status === 'completed' ? 'completed' : order.status === 'cancelled' ? 'cancelled' : 'pending');
      return (status === 'processing' || status === 'shipped') && (!String(order.shipping_provider || '').trim() || !String(order.shipping_code || '').trim());
    }).length;

    const bankTransferFollowup = productOrders.filter((order) => {
      const paymentMethod = order.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
      const paymentStatus = order.payment_status || (order.status === 'completed' ? 'paid' : order.status === 'refunded' ? 'refunded' : 'unpaid');
      return paymentMethod === 'bank_transfer' && (paymentStatus === 'unpaid' || paymentStatus === 'failed');
    }).length;

    return { priorityQueue, missingShipping, bankTransferFollowup };
  }, [productOrders]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = getPresetRange(preset);
      let lastError: unknown = null;
      let dashboardPayload:
        | [
            AdminDashboardKpiSnapshot,
            AdminDashboardTimeseriesPoint[],
            AdminInventoryMetrics,
            AdminCustomerMetric[],
            AdminTopProductMetric[],
            AdminServicePerformanceMetric[],
            AdminDashboardAlert[],
          ]
        | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          dashboardPayload = await Promise.all([
            api.getAdminDashboardKpiSnapshot({ from: range.from, to: range.to }),
            api.getAdminOrdersTimeseries({ from: range.from, to: range.to, granularity: range.granularity }),
            api.getAdminInventoryMetrics(),
            api.getAdminCustomerMetrics({ from: range.from, to: range.to, limit: 6 }),
            api.getAdminTopProducts({ from: range.from, to: range.to, limit: 5 }),
            api.getAdminServicePerformance({ from: range.from, to: range.to, limit: 5 }),
            api.getAdminAlertFeed(8),
          ]);
          break;
        } catch (attemptError) {
          lastError = attemptError;
          if (attempt >= 2 || !isRetryableDashboardError(attemptError)) {
            throw attemptError;
          }
          await sleep(800 * (attempt + 1));
        }
      }

      if (!dashboardPayload) {
        throw lastError || new Error('Không thể tải dữ liệu dashboard.');
      }

      const [kpiData, timeData, inventoryData, customerData, productData, serviceData, alertData] = dashboardPayload;

      setSnapshot(kpiData);
      setTimeseries(timeData);
      setInventory(inventoryData);
      setCustomers(customerData);
      setTopProducts(productData);
      setTopServices(serviceData);
      setAlerts(alertData);
      setLastUpdated(new Date().toISOString());
    } catch (loadError: any) {
      setError(loadError?.message || 'Không thể tải dữ liệu dashboard.');
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const loadRuntimeHealth = useCallback(async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      const response = await api.getAdminObservabilityLogs(8, 3);
      setRuntimeLogs(response.logs || []);
      setRuntimeMeta(response);
    } catch (loadError: any) {
      setRuntimeError(loadError?.message || 'Không thể tải log runtime gần đây.');
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePanel === 'overview' && !runtimeLoading && !runtimeMeta && !runtimeError) {
      void loadRuntimeHealth();
    }
  }, [activePanel, loadRuntimeHealth, runtimeError, runtimeLoading, runtimeMeta]);

  const loadSystemOperations = useCallback(async () => {
    setSystemOperationsLoading(true);
    setSystemOperationsError(null);
    try {
      setSystemOperations(await api.getAdminSystemOperations({ force: true }));
    } catch (loadError: any) {
      setSystemOperationsError(loadError?.message || 'Không thể tải trạng thái vận hành hệ thống.');
    } finally {
      setSystemOperationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePanel === 'overview' && !systemOperations && !systemOperationsLoading && !systemOperationsError) {
      void loadSystemOperations();
    }
  }, [activePanel, loadSystemOperations, systemOperations, systemOperationsError, systemOperationsLoading]);

  const openAppointmentsPanel = useCallback((seedData?: AppointmentPanelSeed) => {
    setActivePanel('appointments');
    setAppointmentSeed(seedData || null);
    setAppointmentSeedKey((prev) => prev + 1);
  }, []);

  const todayWorkItems = useMemo(
    () => [
      {
        label: 'Đơn ưu tiên',
        value: formatCompactNumber(todayOrderSignals.priorityQueue),
        description: 'Đơn pending lâu hoặc processing quá ngưỡng',
        meta: 'Mở thẳng khu Orders trong Sản phẩm để xử lý theo hàng đợi ưu tiên.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'priority_queue' }),
        tone: 'text-amber-700',
        priority: 'P1',
        sla: '30 phút',
      },
      {
        label: 'Thiếu vận đơn',
        value: formatCompactNumber(todayOrderSignals.missingShipping),
        description: 'Đơn đang chạy nhưng chưa hoàn tất bàn giao shipping',
        meta: 'Tập trung xử lý GHTK / mã vận chuyển trước khi đơn bị treo.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'shipping_handover' }),
        tone: 'text-rose-700',
        priority: 'P1',
        sla: '60 phút',
      },
      {
        label: 'Bank transfer chưa chốt',
        value: formatCompactNumber(todayOrderSignals.bankTransferFollowup),
        description: 'Cần đối chiếu thanh toán để đẩy fulfillment',
        meta: 'Đi tới Orders để lọc bank transfer unpaid/failed.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'bank_transfer_followup' }),
        tone: 'text-sky-700',
        priority: 'P2',
        sla: '2 giờ',
      },
      {
        label: 'Lịch hẹn pending',
        value: formatCompactNumber(snapshot?.appointments_pending || 0),
        description: 'Bác sĩ và điều phối cần xác nhận lịch mới',
        meta: `${formatCompactNumber(snapshot?.appointments_completed || 0)} lịch đã hoàn tất trong kỳ đang xem.`,
        onClick: () => openAppointmentsPanel({ status: 'pending' }),
        tone: 'text-primary',
        priority: 'P2',
        sla: 'Trong ca',
      },
      {
        label: 'Cảnh báo runtime',
        value: formatCompactNumber(alerts.length),
        description: 'Có vấn đề vận hành cần mở ngay',
        meta: runtimeLogs.length > 0 ? `${runtimeLogs[0]?.channel || 'runtime'} • ${formatRelativeTime(runtimeLogs[0]?.recorded_at || null)}` : 'Chưa có lỗi mới gần đây.',
        onClick: () => onNavigate({ page: 'adminSiteManagement', section: 'observability', action: 'observability' }),
        tone: 'text-foreground',
        priority: 'P1',
        sla: '15 phút',
      },
      {
        label: 'Kho cần can thiệp',
        value: formatCompactNumber((inventory?.low_stock_products || 0) + (inventory?.out_of_stock_products || 0)),
        description: 'SKU sắp hết hàng hoặc đã hết hàng',
        meta: inventory ? `${formatCompactNumber(inventory.no_sku_products)} SKU thiếu mã • ${formatCompactNumber(inventory.near_expiry_products)} SKU sắp hết hạn` : 'Chờ nạp dữ liệu kho',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'products', productFilter: 'low_stock' }),
        tone: 'text-emerald-700',
        priority: 'P2',
        sla: 'Trong ngày',
      },
    ],
    [alerts.length, inventory, onNavigate, openAppointmentsPanel, runtimeLogs, snapshot, todayOrderSignals],
  );

  const operationsInboxItems = useMemo(
    () => [
      {
        title: 'Đẩy đơn pending lâu sang xử lý ngay',
        owner: 'Sản phẩm / Orders',
        priority: 'P1',
        sla: '30 phút',
        status: `${formatCompactNumber(todayOrderSignals.priorityQueue)} đơn`,
        summary: 'Các đơn pending quá lâu hoặc processing quá ngưỡng thời gian cần được xử lý trước.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'priority_queue' }),
      },
      {
        title: 'Hoàn tất bàn giao vận chuyển',
        owner: 'Sản phẩm / Shipping',
        priority: 'P1',
        sla: '60 phút',
        status: `${formatCompactNumber(todayOrderSignals.missingShipping)} đơn`,
        summary: 'Các đơn đang chạy nhưng chưa có shipping code hoặc chưa chốt nhà vận chuyển.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'shipping_handover' }),
      },
      {
        title: 'Đối chiếu chuyển khoản chưa chốt',
        owner: 'Sản phẩm / Payment',
        priority: 'P2',
        sla: '2 giờ',
        status: `${formatCompactNumber(todayOrderSignals.bankTransferFollowup)} đơn`,
        summary: 'Các đơn bank transfer unpaid/failed cần rà để không làm treo fulfillment.',
        onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'bank_transfer_followup' }),
      },
      {
        title: 'Xác nhận lịch hẹn đang pending',
        owner: 'Clinic / Appointments',
        priority: 'P2',
        sla: 'Trong ca',
        status: `${formatCompactNumber(snapshot?.appointments_pending || 0)} lịch`,
        summary: 'Ưu tiên phản hồi lịch mới để không làm khách chờ sang ngày tiếp theo.',
        onClick: () => openAppointmentsPanel({ status: 'pending' }),
      },
      {
        title: 'Rà lỗi runtime và cảnh báo hệ thống',
        owner: 'Site ops / Runtime',
        priority: 'P1',
        sla: '15 phút',
        status: runtimeLogs.length > 0 ? `${runtimeLogs[0]?.channel || 'runtime'}` : 'Ổn định',
        summary: runtimeLogs.length > 0 ? `${formatRelativeTime(runtimeLogs[0]?.recorded_at || null)} • mở observability để xem log mới nhất.` : 'Chưa có lỗi mới, vẫn nên rà retention và cleanup định kỳ.',
        onClick: () => onNavigate({ page: 'adminSiteManagement', section: 'observability', action: 'observability' }),
      },
    ],
    [onNavigate, openAppointmentsPanel, runtimeLogs, snapshot, todayOrderSignals],
  );

  const handleAlertAction = useCallback(
    (alert: AdminDashboardAlert) => {
      switch (alert.alert_type) {
        case 'order_pending':
          onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'priority_queue' });
          break;
        case 'shipping_missing':
          onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'shipping_handover' });
          break;
        case 'appointment_pending':
          openAppointmentsPanel({ status: 'pending', highlightAppointmentId: alert.ref_id });
          break;
        case 'product_out_of_stock':
          onNavigate({ page: 'adminPharmacyManagement', section: 'products', productFilter: 'out_of_stock' });
          break;
        case 'product_low_stock':
          onNavigate({ page: 'adminPharmacyManagement', section: 'products', productFilter: 'low_stock' });
          break;
        case 'refund_pending':
          onNavigate({ page: 'adminPharmacyManagement', section: 'orders', orderPreset: 'refund_attention' });
          break;
        default:
          setActivePanel('reports');
      }
    },
    [onNavigate, openAppointmentsPanel],
  );

  const compactTrendPoints = useMemo(
    () => compressTimeseries(timeseries, preset === '7d' ? 7 : 6),
    [preset, timeseries],
  );

  const topProductChartRows = useMemo<RankedChartRow[]>(
    () => topProducts.slice(0, 5).map((product) => ({
      label: product.product_name,
      value: Number(product.units_sold || 0),
      valueLabel: `${formatCompactNumber(product.units_sold)} sản phẩm`,
      meta: `${product.brand || 'Chưa có thương hiệu'} • ${formatCurrency(product.gross_revenue)}`,
    })),
    [topProducts],
  );

  const serviceRevenueChartRows = useMemo<RankedChartRow[]>(
    () => topServices.slice(0, 5).map((service) => ({
      label: service.service_name,
      value: Number(service.realized_revenue || 0),
      valueLabel: formatCurrency(service.realized_revenue),
      meta: `${formatCompactNumber(service.appointment_count)} lịch • ${formatCompactNumber(service.completed_count)} hoàn tất`,
    })),
    [topServices],
  );

  const provinceChartRows = useMemo<RankedChartRow[]>(() => {
    const range = getPresetRange(preset);
    const fromTime = new Date(range.from).getTime();
    const toTime = new Date(range.to).getTime();
    const provinceTotals = new Map<string, { orders: number; revenue: number }>();

    productOrders.forEach((order) => {
      const orderTime = new Date(order.created_at).getTime();
      if (Number.isNaN(orderTime) || orderTime < fromTime || orderTime > toTime) return;
      if (order.status === 'cancelled' || order.status === 'refunded') return;

      const province = String(order.shipping_province || '').trim() || 'Chưa xác định';
      const current = provinceTotals.get(province) || { orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.grand_total ?? order.total_price ?? 0);
      provinceTotals.set(province, current);
    });

    return Array.from(provinceTotals.entries())
      .sort(([, left], [, right]) => right.orders - left.orders || right.revenue - left.revenue)
      .slice(0, 5)
      .map(([province, value]) => ({
        label: province,
        value: value.orders,
        valueLabel: `${formatCompactNumber(value.orders)} đơn`,
        meta: formatCurrency(value.revenue),
      }));
  }, [preset, productOrders]);

  const cardTransitionClass = (delayMs: number) =>
    `transform-gpu transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none ${
      isOverviewMounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-[0.99]'
    }`;

  const renderOverview = () => (
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* 1. Header Card matching Apple Glass standard */}
      <div
        className={`${cardTransitionClass(0)} rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl transition-all duration-300 hover:border-white/95 hover:shadow-[0_32px_75px_-36px_rgba(24,35,32,0.6)] dark:border-white/10 dark:hover:border-white/25 p-3 sm:p-4 mx-1 sm:mx-0`}
        style={{ transitionDelay: '0ms' }}
      >
        {/* Preset pills row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(Object.keys(PRESET_LABELS) as DashboardPreset[]).map((key) => {
            const isActive = preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 scale-[1.02]'
                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:border-border'
                }`}
              >
                <span>{PRESET_LABELS[key]}</span>
              </button>
            );
          })}
        </div>

        {/* Status / Action row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">
              {lastUpdated ? `Cập nhật lúc ${formatDateTime(lastUpdated)}` : 'Chưa có dữ liệu cập nhật'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboardData()}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-border/60 bg-background/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shrink-0 active:scale-95"
            title="Làm mới dữ liệu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-3.5 h-3.5 transition-transform duration-500 ${loading ? 'animate-spin text-primary' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="hidden sm:inline">{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2 mx-1 sm:mx-0">
        <div className={cardTransitionClass(80)} style={{ transitionDelay: '80ms' }}>
          <RevenueComparisonChart
            productRevenue={Number(snapshot?.net_revenue || 0)}
            serviceRevenue={Number(snapshot?.service_revenue || 0)}
            periodLabel={PRESET_LABELS[preset]}
          />
        </div>
        <div className={cardTransitionClass(140)} style={{ transitionDelay: '140ms' }}>
          <WeeklyRevenueTrendChart points={compactTrendPoints} />
        </div>
        <div className={cardTransitionClass(200)} style={{ transitionDelay: '200ms' }}>
          <RankedBarChart
            eyebrow="Top sản phẩm"
            title="5 sản phẩm tiêu thụ nhiều nhất"
            rows={topProductChartRows}
            emptyLabel="Chưa có sản phẩm phát sinh doanh số trong khoảng thời gian này."
            accent="teal"
          />
        </div>
        <div className={cardTransitionClass(260)} style={{ transitionDelay: '260ms' }}>
          <RankedBarChart
            eyebrow="Top dịch vụ"
            title="Doanh thu dịch vụ theo liệu trình"
            rows={serviceRevenueChartRows}
            emptyLabel="Chưa có dịch vụ phát sinh doanh thu trong khoảng thời gian này."
            accent="coral"
          />
        </div>
        <div className={`xl:col-span-2 ${cardTransitionClass(320)}`} style={{ transitionDelay: '320ms' }}>
          <RankedBarChart
            eyebrow="Phân bổ đơn hàng"
            title="5 tỉnh, thành có nhiều đơn hàng nhất"
            rows={provinceChartRows}
            emptyLabel="Chưa có địa phương phát sinh đơn hàng trong khoảng thời gian này."
            accent="amber"
          />
        </div>
        <div className={`xl:col-span-2 ${cardTransitionClass(380)}`} style={{ transitionDelay: '380ms' }}>
          <SystemOperationsCard
            data={systemOperations}
            loading={systemOperationsLoading}
            error={systemOperationsError}
            onRefresh={loadSystemOperations}
          />
        </div>
      </div>
    </div>
  );

  const renderPanel = () => {
    return (
      <div className="transition-all duration-300 ease-out animate-fade-in-page">
        {activePanel === 'customers' ? (
          <AdminDashboardCustomersPanel orders={productOrders} onOpenAdvancedModule={() => onNavigate({ page: 'adminUserManagement' })} />
        ) : activePanel === 'appointments' ? (
          <AdminDashboardAppointmentsPanel
            services={services}
            doctors={doctors}
            onOpenAdvancedModule={() => onNavigate({ page: 'adminServiceManagement' })}
            onRefreshDashboard={loadDashboardData}
            seed={appointmentSeed}
            seedKey={appointmentSeedKey}
          />
        ) : activePanel === 'reports' ? (
          <AdminDashboardReportsPanel orders={productOrders} />
        ) : (
          renderOverview()
        )}
      </div>
    );
  };

  const actions = useMemo(() => (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {(Object.keys(PRESET_LABELS) as DashboardPreset[]).map((key) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
              preset === key
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:border-primary/45 hover:text-primary'
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {lastUpdated ? `Cập nhật lúc ${formatDateTime(lastUpdated)}` : 'Chưa có dữ liệu cập nhật'}
      </p>
    </>
  ), [lastUpdated, preset]);

  useEffect(() => {
    setSidebarConfig({
      title: 'Dashboard kinh doanh',
      description: 'Theo dõi doanh số bán hàng, dịch vụ, sản phẩm bán chạy và các địa phương đặt hàng nhiều nhất.',
      icon: <CogIcon className="h-8 w-8" />,
      eyebrow: 'Tuần này',
      insights: workspaceInsights,
      taskItems: dashboardTaskItems,
      activeTaskKey: activePanel,
      actions: actions,
    });
  }, [activePanel, actions, dashboardTaskItems, setSidebarConfig, workspaceInsights]);

  return (
    <>
      {loading && activePanel === 'overview' && !snapshot ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[1.25rem] border border-border bg-background">
          <Spinner />
        </div>
      ) : error && activePanel === 'overview' && !snapshot ? (
        <div className="rounded-[1.25rem] border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="text-lg font-semibold">Không thể tải dashboard</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : (
        renderPanel()
      )}
    </>
  );
};

export default AdminDashboardPage;
