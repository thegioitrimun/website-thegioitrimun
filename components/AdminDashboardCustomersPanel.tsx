import React, { useEffect, useMemo, useState } from 'react';
import type { AdminCustomerMetric, ProductOrder } from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import { DocumentDuplicateIcon, SearchIcon, UsersIcon } from './icons';
import { exportWorkbook } from '../src/workbookExport';
import { useToast } from '../hooks/useToast';

interface AdminDashboardCustomersPanelProps {
  orders: ProductOrder[];
  onOpenAdvancedModule: () => void;
}

type CustomerSegment = AdminCustomerMetric['segment'] | 'all';

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

const segmentLabel: Record<AdminCustomerMetric['segment'], string> = {
  hybrid_customer: 'Hybrid',
  product_only_customer: 'Chỉ mua hàng',
  service_only_customer: 'Chỉ dịch vụ',
  lead_only_customer: 'Lead',
};

const MetricTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-3xl border border-border bg-card px-5 py-4 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
    <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
  </div>
);

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right text-sm font-semibold text-foreground">{value}</span>
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
      .filter((order) => order.user_id === selectedCustomer.patient_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
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
      addToast('Đã xuất báo cáo khách hàng', { type: 'success' });
    } catch (error: any) {
      addToast('Không thể xuất báo cáo khách hàng', { type: 'error', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Khách hàng hiển thị" value={String(summary.total)} />
        <MetricTile label="Doanh thu kỳ" value={formatCurrency(summary.totalRevenue)} />
        <MetricTile label="Returning" value={String(summary.returning)} hint={`${summary.hybrid} hybrid`} />
        <MetricTile
          label="At risk"
          value={String(summary.atRisk)}
          hint={segmentFilter === 'all' ? 'Không hoạt động > 60 ngày' : `Segment ${segmentLabel[segmentFilter]}`}
        />
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Customer filters</p>
            <h3 className="mt-2 text-2xl font-bold text-foreground">Bộ lọc phân khúc</h3>
            <p className="mt-2 text-sm text-muted-foreground">Rút gọn bộ lọc để tập trung vào returning, at-risk và nhóm khách đang tạo doanh thu.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-3 py-1.5">{filteredCustomers.length} kết quả</span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5">{segmentFilter === 'all' ? 'Tất cả segment' : segmentLabel[segmentFilter]}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Tìm kiếm</span>
            <div className="flex items-center rounded-2xl border border-border bg-background px-4 py-3">
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="ml-3 w-full bg-transparent text-sm text-foreground outline-none"
                placeholder="Tên, email, điện thoại"
              />
            </div>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Segment</span>
            <select
              value={segmentFilter}
              onChange={(event) => setSegmentFilter(event.target.value as CustomerSegment)}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
            >
              <option value="all">Tất cả</option>
              {Object.entries(segmentLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={atRiskOnly}
              onChange={(event) => setAtRiskOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Chỉ hiện khách at risk</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={returningOnly}
              onChange={(event) => setReturningOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Chỉ hiện khách returning</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Đến ngày</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Danh sách khách hàng</p>
              <h3 className="mt-2 text-2xl font-bold text-foreground">Top khách hàng theo kỳ</h3>
            </div>
            <p className="text-sm text-muted-foreground">{filteredCustomers.length} kết quả</p>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-border bg-background">
              <Spinner />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Không có khách hàng nào khớp bộ lọc.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer, index) => (
                <button
                  key={customer.patient_id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.patient_id)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${
                    selectedCustomerId === customer.patient_id
                      ? 'border-primary bg-primary/5 shadow-[0_18px_35px_-32px_rgba(53,92,49,0.45)]'
                      : 'border-border bg-background hover:border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                          {index + 1}
                        </span>
                        <p className="text-base font-bold text-foreground">{customer.name || customer.email || customer.phone || customer.patient_id}</p>
                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
                          {segmentLabel[customer.segment]}
                        </span>
                        {customer.is_at_risk ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            At risk
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {customer.total_orders} đơn • {customer.total_appointments} lịch hẹn
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-base font-bold text-primary">{formatCurrency(customer.spent_in_period || customer.total_spent)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">AOV {formatCurrency(customer.average_order_value)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[0_18px_45px_-36px_rgba(28,24,18,0.45)]">
          {!selectedCustomer ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              Chọn một khách hàng để xem chi tiết.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Hồ sơ khách hàng</p>
                <h3 className="mt-2 text-2xl font-bold text-foreground">{selectedCustomer.name || 'Khách hàng'}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{selectedCustomer.email || selectedCustomer.phone || 'Chưa có thông tin liên hệ'}</p>
              </div>

              <div className="rounded-3xl border border-border bg-background p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tổng quan</p>
                <div className="mt-4 space-y-3">
                  <DetailRow label="Segment" value={segmentLabel[selectedCustomer.segment]} />
                  <DetailRow label="Tổng chi tiêu" value={formatCurrency(selectedCustomer.total_spent)} />
                  <DetailRow label="Doanh thu kỳ" value={formatCurrency(selectedCustomer.spent_in_period)} />
                  <DetailRow label="Tổng đơn hàng" value={selectedCustomer.total_orders} />
                  <DetailRow label="Tổng lịch hẹn" value={selectedCustomer.total_appointments} />
                  <DetailRow label="First order" value={formatDateTime(selectedCustomer.first_order_at)} />
                  <DetailRow label="Last order" value={formatDateTime(selectedCustomer.last_order_at)} />
                  <DetailRow label="Last appointment" value={formatDateTime(selectedCustomer.last_appointment_at)} />
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Đơn hàng gần nhất</p>
                <div className="mt-4 space-y-3">
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Khách này chưa có đơn hàng gắn tài khoản.</p>
                  ) : (
                    recentOrders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-border/70 px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-semibold text-foreground">{order.order_code || order.id}</p>
                          <p className="text-sm font-semibold text-primary">{formatCurrency(Number(order.grand_total || order.total_price || 0))}</p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardCustomersPanel;
