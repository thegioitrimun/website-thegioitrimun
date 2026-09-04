import React, { useEffect, useMemo, useState } from 'react';
import type { AdminCustomerMetric, ProductOrder } from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import { SearchIcon } from './icons';
import { exportWorkbook } from '../src/workbookExport';
import { useToast } from '../hooks/useToast';

interface AdminDashboardCustomersPanelProps {
  orders: ProductOrder[];
  onOpenAdvancedModule: () => void;
}

type CustomerSegment = AdminCustomerMetric['segment'] | 'all';
type DetailTab = 'overview' | 'orders' | 'insights';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

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

const formatDateOnly = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const normalizeContactPhone = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
};

const segmentLabel: Record<AdminCustomerMetric['segment'], string> = {
  hybrid_customer: 'Hybrid (Hàng & DV)',
  product_only_customer: 'Chỉ mua hàng',
  service_only_customer: 'Chỉ dịch vụ',
  lead_only_customer: 'Tiềm năng (Lead)',
};

const getInitials = (name?: string | null) => {
  if (!name) return 'KH';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name?: string | null) => {
  const colors = [
    'from-emerald-500/20 to-teal-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    'from-sky-500/20 to-blue-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30',
    'from-indigo-500/20 to-violet-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    'from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    'from-rose-500/20 to-pink-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
};


const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2.5 text-xs sm:text-sm last:border-b-0 last:pb-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-semibold text-foreground">{value}</span>
  </div>
);

const AdminDashboardCustomersPanel: React.FC<AdminDashboardCustomersPanelProps> = ({ orders, onOpenAdvancedModule }) => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<AdminCustomerMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment>('all');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [returningOnly, setReturningOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Apple Glass UI States
  const [showFilters, setShowFilters] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'detail'>('list');
  const [openMenuCustomerId, setOpenMenuCustomerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (segmentFilter !== 'all') count++;
    if (atRiskOnly) count++;
    if (returningOnly) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [segmentFilter, atRiskOnly, returningOnly, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const to = dateTo ? new Date(dateTo) : new Date();
    if (dateTo) to.setHours(23, 59, 59, 999);
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (dateFrom) from.setHours(0, 0, 0, 0);

    void api.getAdminCustomerMetrics({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 300,
      offset: 0,
    })
      .then((rows) => {
        if (cancelled) return;
        setCustomers(rows);
        if (!selectedCustomerId && rows[0]) {
          setSelectedCustomerId(rows[0].patient_id);
        } else if (selectedCustomerId && rows.length > 0 && !rows.some((row) => row.patient_id === selectedCustomerId)) {
          setSelectedCustomerId(rows[0].patient_id);
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        addToast('Không thể tải chỉ số khách hàng', { type: 'error', description: error.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast, dateFrom, dateTo]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const hit = [customer.name, customer.email, customer.phone]
          .some((value) => String(value || '').toLowerCase().includes(query));
        if (!hit) return false;
      }

      if (segmentFilter !== 'all' && customer.segment !== segmentFilter) return false;
      if (atRiskOnly && !customer.is_at_risk) return false;
      if (returningOnly && !customer.is_returning) return false;
      return true;
    });
  }, [atRiskOnly, customers, returningOnly, searchQuery, segmentFilter]);

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((customer) => customer.patient_id === selectedCustomerId) || customers.find((customer) => customer.patient_id === selectedCustomerId) || null,
    [customers, filteredCustomers, selectedCustomerId],
  );

  const recentOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
      .filter((order) =>
        order.user_id === selectedCustomer.patient_id
        || (selectedCustomer.phone && normalizeContactPhone(order.customer_phone) === normalizeContactPhone(selectedCustomer.phone))
        || (selectedCustomer.email && String(order.customer_email || '').toLowerCase() === selectedCustomer.email.toLowerCase())
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [orders, selectedCustomer]);

  const summary = useMemo(() => {
    const totalRevenue = filteredCustomers.reduce((sum, customer) => sum + Number(customer.spent_in_period || 0), 0);
    return {
      total: filteredCustomers.length,
      atRisk: filteredCustomers.filter((customer) => customer.is_at_risk).length,
      returning: filteredCustomers.filter((customer) => customer.is_returning).length,
      hybrid: filteredCustomers.filter((customer) => customer.segment === 'hybrid_customer').length,
      totalRevenue,
    };
  }, [filteredCustomers]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportWorkbook(`admin-customers-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        {
          name: 'Customers',
          rows: filteredCustomers.map((customer) => ({
            patient_id: customer.patient_id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            segment: segmentLabel[customer.segment],
            total_orders: customer.total_orders,
            total_spent: customer.total_spent,
            average_order_value: customer.average_order_value,
            orders_in_period: customer.orders_in_period,
            spent_in_period: customer.spent_in_period,
            total_appointments: customer.total_appointments,
            last_order_at: customer.last_order_at,
            last_appointment_at: customer.last_appointment_at,
            is_at_risk: customer.is_at_risk,
            is_returning: customer.is_returning,
          })),
        },
      ]);
      addToast('Đã xuất báo cáo khách hàng ra Excel thành công', { type: 'success' });
    } catch (error: any) {
      addToast('Không thể xuất báo cáo khách hàng', { type: 'error', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const handleSelectCustomer = (customer: AdminCustomerMetric) => {
    setSelectedCustomerId(customer.patient_id);
    setMobileViewMode('detail');
  };

  const handleApplyDatePreset = (preset: 'today' | '7days' | '30days' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === '7days') {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (preset === '30days') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  const customerPresets = useMemo(() => [
    {
      key: 'all',
      label: 'Tất cả khách',
      count: customers.length,
      isActive: segmentFilter === 'all' && !atRiskOnly && !returningOnly,
      onClick: () => {
        setSegmentFilter('all');
        setAtRiskOnly(false);
        setReturningOnly(false);
      },
    },
    {
      key: 'hybrid_customer',
      label: 'Hybrid',
      count: customers.filter((c) => c.segment === 'hybrid_customer').length,
      isActive: segmentFilter === 'hybrid_customer' && !atRiskOnly && !returningOnly,
      onClick: () => {
        setSegmentFilter('hybrid_customer');
        setAtRiskOnly(false);
        setReturningOnly(false);
      },
    },
    {
      key: 'product_only_customer',
      label: 'Chỉ mua hàng',
      count: customers.filter((c) => c.segment === 'product_only_customer').length,
      isActive: segmentFilter === 'product_only_customer' && !atRiskOnly && !returningOnly,
      onClick: () => {
        setSegmentFilter('product_only_customer');
        setAtRiskOnly(false);
        setReturningOnly(false);
      },
    },
    {
      key: 'service_only_customer',
      label: 'Chỉ dịch vụ',
      count: customers.filter((c) => c.segment === 'service_only_customer').length,
      isActive: segmentFilter === 'service_only_customer' && !atRiskOnly && !returningOnly,
      onClick: () => {
        setSegmentFilter('service_only_customer');
        setAtRiskOnly(false);
        setReturningOnly(false);
      },
    },
    {
      key: 'lead_only_customer',
      label: 'Tiềm năng',
      count: customers.filter((c) => c.segment === 'lead_only_customer').length,
      isActive: segmentFilter === 'lead_only_customer' && !atRiskOnly && !returningOnly,
      onClick: () => {
        setSegmentFilter('lead_only_customer');
        setAtRiskOnly(false);
        setReturningOnly(false);
      },
    },
    {
      key: 'at_risk',
      label: 'Khách At-risk',
      count: customers.filter((c) => c.is_at_risk).length,
      isActive: atRiskOnly,
      onClick: () => {
        setAtRiskOnly((prev) => !prev);
      },
    },
    {
      key: 'returning',
      label: 'Khách Returning',
      count: customers.filter((c) => c.is_returning).length,
      isActive: returningOnly,
      onClick: () => {
        setReturningOnly((prev) => !prev);
      },
    },
  ], [customers, segmentFilter, atRiskOnly, returningOnly]);

  return (
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* 1. Header & Filter Card (Chuẩn kiểu Đơn hàng - Hình số 2) */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        {/* Preset pills row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {customerPresets.map((preset) => {
            const isActive = preset.isActive;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={preset.onClick}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{preset.label}</span>
                {preset.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    {preset.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search bar, Filter toggle & Icon-only Export button */}
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên khách, SĐT, email..."
              className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'border-primary/50 bg-primary/10 text-primary font-bold shadow-xs'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || filteredCustomers.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0"
            title="Xuất file Excel"
          >
            {exporting ? (
              <Spinner className="w-4 h-4 text-primary" />
            ) : (
              <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="Xuất file Excel" className="w-4.5 h-4.5 object-contain" />
            )}
          </button>
        </div>

        {/* Collapsible / Desktop Grid Filters */}
        <div className={`mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 transition-all ${
          showFilters ? 'grid' : 'hidden xl:grid'
        }`}>
          {activeFilterCount > 0 && (
            <div className="col-span-2 sm:col-span-2 lg:col-span-4 flex items-center justify-between pb-1 border-b border-border/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {filteredCustomers.length} khách {summary.totalRevenue > 0 ? `• Doanh thu: ${formatCurrency(summary.totalRevenue)}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSegmentFilter('all');
                  setAtRiskOnly(false);
                  setReturningOnly(false);
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                }}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Xóa bộ lọc ({activeFilterCount})
              </button>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Phân khúc khách hàng</label>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value as CustomerSegment)}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả phân khúc</option>
              <option value="hybrid_customer">Hybrid (Hàng & DV)</option>
              <option value="product_only_customer">Chỉ mua hàng</option>
              <option value="service_only_customer">Chỉ dịch vụ</option>
              <option value="lead_only_customer">Tiềm năng (Lead)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Loại khách hàng</label>
            <select
              value={atRiskOnly ? 'at_risk' : returningOnly ? 'returning' : 'all'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'at_risk') {
                  setAtRiskOnly(true);
                  setReturningOnly(false);
                } else if (val === 'returning') {
                  setReturningOnly(true);
                  setAtRiskOnly(false);
                } else {
                  setAtRiskOnly(false);
                  setReturningOnly(false);
                }
              }}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả khách hàng</option>
              <option value="at_risk">Khách At-risk (Nguy cơ)</option>
              <option value="returning">Khách Returning (Quay lại)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Mốc thời gian</label>
            <select
              value={
                !dateFrom && !dateTo
                  ? 'all'
                  : dateFrom === dateTo && dateFrom === new Date().toISOString().slice(0, 10)
                  ? 'today'
                  : 'custom'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all' || val === 'today' || val === '7days' || val === '30days') {
                  handleApplyDatePreset(val as any);
                }
              }}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
              <option value="custom">Tùy chọn ngày...</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Khoảng ngày</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type={dateFrom ? 'date' : 'text'}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => {
                  if (!e.target.value) e.target.type = 'text';
                }}
                placeholder="Từ ngày"
                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
              <input
                type={dateTo ? 'date' : 'text'}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => {
                  if (!e.target.value) e.target.type = 'text';
                }}
                placeholder="Đến ngày"
                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Body: Split View on Desktop, Drill-down on Mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Customer List (Hidden on mobile if viewing detail) */}
        <div className={`space-y-3 ${mobileViewMode === 'detail' ? 'hidden lg:block' : 'block'} lg:col-span-7 xl:col-span-7`}>

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/10 bg-card/60 p-8 backdrop-blur-xl">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="mt-3 text-xs font-semibold text-muted-foreground">Đang tải danh sách khách hàng...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-2xl sm:rounded-3xl border border-dashed border-border/70 bg-card/40 p-10 text-center text-xs sm:text-sm text-muted-foreground backdrop-blur-xl">
              Không tìm thấy khách hàng nào khớp với điều kiện lọc.
            </div>
          ) : (
            <div className="mx-1 sm:mx-0 space-y-2">
              {filteredCustomers.map((customer, index) => {
                const isSelected = selectedCustomerId === customer.patient_id;
                const isMenuOpen = openMenuCustomerId === customer.patient_id;
                const isTopThree = index < 3;
                const avatarStyle = getAvatarColor(customer.name || customer.phone);

                return (
                  <div
                    key={customer.patient_id}
                    className={`group relative rounded-2xl border transition-all p-3 sm:p-3.5 backdrop-blur-xl ${
                      isSelected
                        ? 'border-primary/60 bg-primary/[0.04] shadow-xs ring-1 ring-primary/20'
                        : 'border-white/60 dark:border-white/10 bg-card/60 hover:bg-card/85'
                    } ${isMenuOpen ? 'z-30' : isSelected ? 'z-20' : 'z-0'}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with Initials & Rank Badge (Matching Image 2 Style) */}
                      <div className="relative shrink-0 cursor-pointer" onClick={() => handleSelectCustomer(customer)}>
                        <div className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border bg-gradient-to-br font-black text-sm sm:text-base shadow-2xs ${avatarStyle}`}>
                          {getInitials(customer.name)}
                        </div>
                        {isTopThree && (
                          <span
                            className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-black text-white shadow-xs ${
                              index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : 'bg-amber-700'
                            }`}
                            title={`Top ${index + 1}`}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Main Customer Info */}
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleSelectCustomer(customer)}>
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm sm:text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                              {customer.name || 'Khách vãng lai'}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {customer.phone || 'Chưa có SĐT'} {customer.email ? `• ${customer.email}` : ''}
                            </p>
                          </div>

                          {/* Price & Spent amount */}
                          <div className="text-right shrink-0">
                            <p className="text-xs sm:text-sm font-black font-mono text-primary">
                              {formatCurrency(customer.spent_in_period || customer.total_spent)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              AOV: {formatCurrency(customer.average_order_value)}
                            </p>
                          </div>
                        </div>

                        {/* Meta Tags & Chips */}
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] sm:text-[11px] font-semibold">
                          <span className="rounded-md border border-border/50 bg-background/50 px-1.5 py-0.5 text-foreground">
                            {segmentLabel[customer.segment]}
                          </span>

                          {customer.customer_source?.startsWith('pancake') && (
                            <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                              Pancake POS
                            </span>
                          )}

                          {customer.is_at_risk && (
                            <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                              At risk
                            </span>
                          )}

                          {customer.is_returning && (
                            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                              Returning
                            </span>
                          )}

                          <span className="ml-auto text-muted-foreground font-normal">
                            {customer.total_orders} đơn • {customer.total_appointments} hẹn
                          </span>
                        </div>
                      </div>

                      {/* 3-Dots Action Menu Popover (Transparent Backdrop - Apple Glass Standard) */}
                      <div className="relative shrink-0" data-mobile-action-menu>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuCustomerId((prev) => (prev === customer.patient_id ? null : customer.patient_id));
                          }}
                          aria-label={`Thao tác cho khách ${customer.name || customer.patient_id}`}
                          className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                            isMenuOpen
                              ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                              : 'border-border/70 bg-card/50 backdrop-blur-xl text-muted-foreground hover:bg-card/80 hover:text-foreground'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                          </svg>
                        </button>

                        {/* Popover Menu */}
                        {isMenuOpen && (
                          <>
                            {/* Transparent Backdrop Click-catcher (NO dark blur overlay) */}
                            <div
                              className="fixed inset-0 z-40 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuCustomerId(null);
                              }}
                            />

                            {/* Dropdown Card (Matching Sidebar bg-card) */}
                            <div
                              className="absolute right-0 top-9 z-50 w-56 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl transition-all animate-in fade-in zoom-in-95"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-0.5">
                                {/* 1. Xem chi tiết hồ sơ */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuCustomerId(null);
                                    handleSelectCustomer(customer);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-primary">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                  </svg>
                                  <span>Xem hồ sơ chi tiết</span>
                                </button>

                                {/* 2. Gọi điện */}
                                {customer.phone && (
                                  <a
                                    href={`tel:${customer.phone}`}
                                    onClick={() => setOpenMenuCustomerId(null)}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                    </svg>
                                    <span className="truncate">Gọi khách ({customer.phone})</span>
                                  </a>
                                )}

                                {/* 3. Nhắn Zalo */}
                                {customer.phone && (
                                  <a
                                    href={`https://zalo.me/${normalizeContactPhone(customer.phone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setOpenMenuCustomerId(null)}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-500/10"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 5.95 5.95 0 0 0 .97-3.155C4.246 15.347 3 13.784 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                    </svg>
                                    <span>Nhắn tin Zalo</span>
                                  </a>
                                )}

                                {/* 4. Sao chép số điện thoại */}
                                {customer.phone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuCustomerId(null);
                                      void navigator.clipboard.writeText(customer.phone);
                                      addToast(`Đã sao chép SĐT: ${customer.phone}`, { type: 'success' });
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4 text-muted-foreground">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                    </svg>
                                    <span>Sao chép SĐT</span>
                                  </button>
                                )}

                                {/* 5. Sao chép Email */}
                                {customer.email && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuCustomerId(null);
                                      void navigator.clipboard.writeText(customer.email);
                                      addToast(`Đã sao chép Email: ${customer.email}`, { type: 'success' });
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4 text-muted-foreground">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                    </svg>
                                    <span className="truncate">Sao chép Email</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Customer Detail Profile */}
        <div className={`lg:col-span-5 xl:col-span-5 ${mobileViewMode === 'list' ? 'hidden lg:block' : 'block'}`}>
          <div className="sticky top-20">
            {!selectedCustomer ? (
              <div className="rounded-2xl sm:rounded-3xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
                Chọn một khách hàng từ danh sách để xem hồ sơ chi tiết.
              </div>
            ) : (
              <div className="mx-1 sm:mx-0 rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/10 bg-card/80 p-4 sm:p-5 shadow-lg backdrop-blur-2xl space-y-4">
                {/* Mobile Back Button */}
                <div className="flex items-center justify-between lg:hidden border-b border-border/40 pb-3">
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('list')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-bold text-foreground transition-all active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    <span>Quay lại danh sách</span>
                  </button>
                  <span className="text-xs font-bold text-muted-foreground">Hồ sơ khách hàng</span>
                </div>

                {/* Profile Header */}
                <div className="flex items-start gap-3.5">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-lg font-black shadow-xs ${getAvatarColor(selectedCustomer.name)}`}>
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base sm:text-lg font-black text-foreground truncate">
                        {selectedCustomer.name || 'Khách vãng lai'}
                      </h3>
                      {selectedCustomer.is_at_risk && (
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          At risk
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {selectedCustomer.phone || 'Chưa có SĐT'} {selectedCustomer.email ? `• ${selectedCustomer.email}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-foreground">
                        {segmentLabel[selectedCustomer.segment]}
                      </span>
                      {selectedCustomer.customer_source && (
                        <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                          {selectedCustomer.customer_source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {selectedCustomer.phone ? (
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                      </svg>
                      <span>Gọi ngay</span>
                    </a>
                  ) : (
                    <button disabled className="rounded-xl border border-border/40 bg-muted/20 py-2 text-xs font-semibold text-muted-foreground opacity-50">
                      Không có SĐT
                    </button>
                  )}

                  {selectedCustomer.phone ? (
                    <a
                      href={`https://zalo.me/${normalizeContactPhone(selectedCustomer.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 transition-all hover:bg-sky-500/20 active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 5.95 5.95 0 0 0 .97-3.155C4.246 15.347 3 13.784 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                      </svg>
                      <span>Nhắn Zalo</span>
                    </a>
                  ) : (
                    <button disabled className="rounded-xl border border-border/40 bg-muted/20 py-2 text-xs font-semibold text-muted-foreground opacity-50">
                      Zalo
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = `${selectedCustomer.name || ''} - ${selectedCustomer.phone || ''} - ${selectedCustomer.email || ''}`.trim();
                      void navigator.clipboard.writeText(textToCopy);
                      addToast('Đã chép thông tin liên hệ', { type: 'success' });
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 py-2 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-muted-foreground">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                    </svg>
                    <span>Sao chép</span>
                  </button>
                </div>

                {/* Segmented Control Tabs (Pill Style) */}
                <div className="flex items-center gap-1 rounded-2xl border border-border/50 bg-muted/40 p-1 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setDetailTab('overview')}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all ${
                      detailTab === 'overview'
                        ? 'border border-white/60 dark:border-white/10 bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Chỉ số
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('orders')}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all ${
                      detailTab === 'orders'
                        ? 'border border-white/60 dark:border-white/10 bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Đơn hàng ({recentOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('insights')}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all ${
                      detailTab === 'insights'
                        ? 'border border-white/60 dark:border-white/10 bg-card text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Chăm sóc
                  </button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {detailTab === 'overview' && (
                  <div className="space-y-3 pt-1">
                    {/* Financial Metrics Card */}
                    <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-background/50 p-4 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Hiệu quả doanh số
                      </p>
                      <div className="space-y-1">
                        <DetailRow label="Tổng chi tiêu" value={<span className="font-mono font-black text-primary">{formatCurrency(selectedCustomer.total_spent)}</span>} />
                        <DetailRow label="Doanh thu kỳ" value={<span className="font-mono font-bold text-foreground">{formatCurrency(selectedCustomer.spent_in_period)}</span>} />
                        <DetailRow label="Giá trị TB (AOV)" value={<span className="font-mono font-bold text-foreground">{formatCurrency(selectedCustomer.average_order_value)}</span>} />
                        <DetailRow label="Tổng số đơn hàng" value={<span>{selectedCustomer.total_orders} đơn</span>} />
                        <DetailRow label="Tổng số lịch hẹn" value={<span>{selectedCustomer.total_appointments} lịch</span>} />
                      </div>
                    </div>

                    {/* Timeline Card */}
                    <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-background/50 p-4 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Dòng thời gian hoạt động
                      </p>
                      <div className="space-y-1">
                        <DetailRow label="Đơn hàng đầu tiên" value={<span>{formatDateOnly(selectedCustomer.first_order_at)}</span>} />
                        <DetailRow label="Đơn hàng gần nhất" value={<span>{formatDateOnly(selectedCustomer.last_order_at)}</span>} />
                        <DetailRow label="Lịch hẹn gần nhất" value={<span>{formatDateOnly(selectedCustomer.last_appointment_at)}</span>} />
                        <DetailRow label="Ngày ghi nhận" value={<span>{formatDateOnly(selectedCustomer.created_at)}</span>} />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ORDERS */}
                {detailTab === 'orders' && (
                  <div className="space-y-2 pt-1 max-h-[380px] overflow-y-auto pr-1">
                    {recentOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                        Khách hàng này chưa có đơn hàng nào liên kết tài khoản.
                      </div>
                    ) : (
                      recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-xl border border-white/60 dark:border-white/10 bg-background/50 p-3 backdrop-blur-md transition-all hover:bg-background/80"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-primary">
                              {order.order_code || `#${order.id.slice(0, 6)}`}
                            </span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {formatCurrency(Number(order.grand_total || order.total_price || 0))}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>{formatDateTime(order.created_at)}</span>
                            <span className="rounded-md border border-border/50 bg-card/60 px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
                              {order.order_channel || 'online'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 3: INSIGHTS */}
                {detailTab === 'insights' && (
                  <div className="space-y-3 pt-1">
                    {selectedCustomer.is_at_risk ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                          <span>Cảnh báo nguy cơ rời bỏ (At-risk)</span>
                        </div>
                        <p className="leading-relaxed text-muted-foreground dark:text-amber-300/80">
                          Khách hàng này đã hơn 60 ngày không phát sinh đơn hàng mới hoặc lịch hẹn.
                          Nên gọi điện chăm sóc tình trạng da hoặc gửi mã ưu đãi tái kích hoạt.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Khách hàng đang hoạt động tốt</span>
                        </div>
                        <p className="leading-relaxed text-muted-foreground dark:text-emerald-300/80">
                          Khách hàng có tương tác gần đây, duy trì tần suất mua hoặc đặt hẹn ổn định.
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-background/50 p-4 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Thông tin kỹ thuật ID
                      </p>
                      <div className="space-y-1">
                        <DetailRow
                          label="Mã Patient ID"
                          value={
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(selectedCustomer.patient_id);
                                addToast('Đã chép Patient ID', { type: 'success' });
                              }}
                              className="font-mono text-xs font-semibold text-primary underline decoration-dotted"
                              title="Bấm để sao chép"
                            >
                              {selectedCustomer.patient_id.slice(0, 12)}...
                            </button>
                          }
                        />
                        <DetailRow label="Nguồn dữ liệu" value={<span>{selectedCustomer.customer_source || 'Website store'}</span>} />
                        <DetailRow label="Trạng thái Returning" value={<span>{selectedCustomer.is_returning ? 'Có (Mua lại)' : 'Khách mới'}</span>} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardCustomersPanel;
