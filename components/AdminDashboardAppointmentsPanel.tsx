import React, { useEffect, useMemo, useState } from 'react';
import type { AdminAppointmentDrilldown, Appointment, DoctorDetail, Service } from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  EyeIcon,
  ReceiptIcon,
  UserIcon,
} from './icons';
import { useToast } from '../hooks/useToast';
import { exportWorkbook } from '../src/workbookExport';

export type AppointmentPanelSeed = {
  searchQuery?: string;
  status?: 'all' | Appointment['status'];
  serviceId?: number;
  doctorId?: string;
  highlightAppointmentId?: string;
};

interface AdminDashboardAppointmentsPanelProps {
  services: Service[];
  doctors: DoctorDetail[];
  onOpenAdvancedModule: () => void;
  onRefreshDashboard: () => Promise<void>;
  seed?: AppointmentPanelSeed | null;
  seedKey?: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDateTime = (date: string, time?: string | null) => {
  if (!date) return 'N/A';
  const combined = time ? `${date}T${time}` : date;
  const value = new Date(combined);
  if (Number.isNaN(value.getTime())) return `${date}${time ? ` ${time}` : ''}`;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const statusBadgeClass: Record<Appointment['status'], string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirmed: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const paymentBadgeClass: Record<string, string> = {
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  unpaid: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  '': 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

const statusLabel: Record<Appointment['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-right text-xs font-semibold text-foreground">{value}</span>
  </div>
);

const AdminDashboardAppointmentsPanel: React.FC<AdminDashboardAppointmentsPanelProps> = ({
  services,
  doctors,
  onOpenAdvancedModule,
  onRefreshDashboard,
  seed,
  seedKey,
}) => {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Appointment['status']>('all');
  const [serviceFilter, setServiceFilter] = useState<number | 'all'>('all');
  const [doctorFilter, setDoctorFilter] = useState<string | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appointments, setAppointments] = useState<AdminAppointmentDrilldown[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<Appointment['status']>('pending');
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (typeof seedKey === 'undefined') return;
    setSearchQuery(seed?.searchQuery || '');
    setStatusFilter(seed?.status || 'all');
    setServiceFilter(seed?.serviceId ?? 'all');
    setDoctorFilter(seed?.doctorId ?? 'all');
    if (seed?.highlightAppointmentId) {
      setSelectedAppointmentId(seed.highlightAppointmentId);
      setIsDetailModalOpen(true);
    }
  }, [seed, seedKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void api.getAdminAppointmentsDrilldown({
      fromDate: dateFrom || null,
      toDate: dateTo || null,
      status: statusFilter,
      serviceId: serviceFilter === 'all' ? null : serviceFilter,
      doctorId: doctorFilter === 'all' ? null : doctorFilter,
      search: searchQuery || null,
      limit: 250,
      offset: 0,
    })
      .then((rows) => {
        if (cancelled) return;
        setAppointments(rows);
      })
      .catch((error: any) => {
        if (cancelled) return;
        addToast('Không thể tải danh sách lịch hẹn', { type: 'error', description: error.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast, dateFrom, dateTo, doctorFilter, searchQuery, serviceFilter, statusFilter]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId],
  );

  useEffect(() => {
    if (selectedAppointment) {
      setNextStatus(selectedAppointment.status);
    }
  }, [selectedAppointment]);

  const openDetail = (appointment: AdminAppointmentDrilldown) => {
    setSelectedAppointmentId(appointment.id);
    setIsDetailModalOpen(true);
  };

  const closeDetail = () => {
    setIsDetailModalOpen(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedAppointment) return;
    setUpdating(true);
    try {
      const updated = await api.updateAdminAppointmentStatus(selectedAppointment.id, nextStatus);
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === updated.id
            ? {
                ...appointment,
                status: updated.status,
                updated_at: new Date().toISOString(),
              }
            : appointment,
        ),
      );
      await onRefreshDashboard();
      addToast('Đã cập nhật trạng thái lịch hẹn', { type: 'success' });
    } catch (error: any) {
      addToast('Không thể cập nhật lịch hẹn', { type: 'error', description: error.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportWorkbook(`admin-appointments-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        {
          name: 'Appointments',
          rows: appointments.map((appointment) => ({
            id: appointment.id,
            patient_name: appointment.patient_name,
            patient_email: appointment.patient_email,
            patient_phone: appointment.patient_phone,
            doctor_name: appointment.doctor_name,
            service_name: appointment.service_name,
            date: appointment.date,
            time: appointment.time,
            status: appointment.status,
            invoice_total_amount: appointment.invoice_total_amount,
            invoice_payment_status: appointment.invoice_payment_status,
            invoice_payment_method: appointment.invoice_payment_method,
            invoice_payment_date: appointment.invoice_payment_date,
            notes: appointment.notes,
          })),
        },
      ]);
      addToast('Đã xuất báo cáo lịch hẹn', { type: 'success' });
    } catch (error: any) {
      addToast('Không thể xuất lịch hẹn', { type: 'error', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const activeFilterCount = [
    searchQuery.trim() !== '',
    statusFilter !== 'all',
    serviceFilter !== 'all',
    doctorFilter !== 'all',
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setServiceFilter('all');
    setDoctorFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden">
      {/* 1. Filter Header matching Orders tab */}
      <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h4 className="mt-2 text-xl font-bold text-foreground">Danh sách lịch hẹn</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Bộ lọc đang bật: <span className="font-semibold text-foreground">{activeFilterCount}</span> • Tổng số lịch hẹn: <span className="font-semibold text-foreground">{appointments.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || appointments.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-background/50 hover:text-primary hover:shadow-md disabled:opacity-50"
            >
              {exporting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <img
                  src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp"
                  alt="Xuất Excel"
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={onOpenAdvancedModule}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-primary/80 backdrop-blur-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
            >
              <span>Quản lý dịch vụ</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mã lịch hẹn / tên khách / SĐT / email / bác sĩ..."
              className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Appointment['status'])}
              className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(statusLabel).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả dịch vụ</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả bác sĩ</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type={dateFrom ? "date" : "text"}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                placeholder="Từ ngày"
                className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <input
                type={dateTo ? "date" : "text"}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                placeholder="Đến ngày"
                className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Appointments Table Card */}
      <div className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">

        {/* 4. Full Table Content */}
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center p-8">
            <Spinner />
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Không tìm thấy lịch hẹn nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] table-auto text-left text-sm">
              <thead className="border-b border-border/50 bg-card/30 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="w-12 px-3.5 py-3 text-center">#</th>
                  <th className="px-3.5 py-3">Khách hàng / Bệnh nhân</th>
                  <th className="px-3.5 py-3">Dịch vụ & Bác sĩ</th>
                  <th className="px-3.5 py-3">Thời gian hẹn</th>
                  <th className="px-3.5 py-3">Hóa đơn & Thanh toán</th>
                  <th className="px-3.5 py-3 text-center">Trạng thái</th>
                  <th className="px-3.5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {appointments.map((appointment, index) => (
                  <tr
                    key={appointment.id}
                    onClick={() => openDetail(appointment)}
                    className="group cursor-pointer transition-colors hover:bg-card/30"
                  >
                    <td className="px-3.5 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                        {appointment.patient_name || 'Khách chưa rõ tên'}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {appointment.patient_phone && <span>{appointment.patient_phone}</span>}
                        {appointment.patient_phone && appointment.patient_email && <span>•</span>}
                        {appointment.patient_email && <span className="truncate max-w-[180px]">{appointment.patient_email}</span>}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-foreground text-xs sm:text-sm">
                        {appointment.service_name}
                      </div>
                      <div className="mt-0.5 text-xs text-primary/90 font-medium">
                        Bác sĩ: {appointment.doctor_name || 'Chưa phân công'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-semibold text-foreground text-xs sm:text-sm">
                        {formatDateTime(appointment.date, appointment.time)}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-bold text-foreground text-xs sm:text-sm">
                        {formatCurrency(appointment.invoice_total_amount)}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-semibold ${
                            paymentBadgeClass[appointment.invoice_payment_status || ''] || paymentBadgeClass['']
                          }`}
                        >
                          {appointment.invoice_payment_status || 'unpaid'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${
                          statusBadgeClass[appointment.status]
                        }`}
                      >
                        {statusLabel[appointment.status]}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openDetail(appointment)}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        <span>Chi tiết</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Detailed Modal Popup */}
      {selectedAppointment && isDetailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md"
          onClick={closeDetail}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-border/60 bg-background/95 backdrop-blur-2xl p-6 shadow-2xl md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                  CHI TIẾT LỊCH HẸN #{selectedAppointment.id.slice(0, 8)}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">
                  {selectedAppointment.patient_name || 'Khách hàng'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedAppointment.service_name} • {formatDateTime(selectedAppointment.date, selectedAppointment.time)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    statusBadgeClass[selectedAppointment.status]
                  }`}
                >
                  {statusLabel[selectedAppointment.status]}
                </span>
                <div className="relative group inline-flex">
                  <button
                    type="button"
                    onClick={closeDetail}
                    title="Đóng cửa sổ"
                    aria-label="Đóng cửa sổ"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/40 text-muted-foreground transition-all hover:bg-card hover:text-foreground hover:scale-110"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                  <span className="pointer-events-none absolute -bottom-8 right-0 whitespace-nowrap rounded-lg border border-border/50 bg-popover/95 px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                    Đóng
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Grid */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Column 1: Thông tin bệnh nhân & Lịch khám */}
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/60 bg-card/20 backdrop-blur-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                    <UserIcon className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Thông tin bệnh nhân</h4>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <DetailRow label="Họ và tên" value={selectedAppointment.patient_name || 'Chưa rõ'} />
                    <DetailRow
                      label="Số điện thoại"
                      value={
                        selectedAppointment.patient_phone ? (
                          <a
                            href={`tel:${selectedAppointment.patient_phone}`}
                            className="text-primary hover:underline font-bold"
                          >
                            {selectedAppointment.patient_phone}
                          </a>
                        ) : (
                          'Chưa cập nhật'
                        )
                      }
                    />
                    <DetailRow
                      label="Email"
                      value={
                        selectedAppointment.patient_email ? (
                          <a
                            href={`mailto:${selectedAppointment.patient_email}`}
                            className="text-primary hover:underline truncate max-w-[200px] inline-block"
                          >
                            {selectedAppointment.patient_email}
                          </a>
                        ) : (
                          'Chưa cập nhật'
                        )
                      }
                    />
                    {selectedAppointment.notes && (
                      <div className="pt-2">
                        <span className="text-xs text-muted-foreground block mb-1">Ghi chú của bệnh nhân:</span>
                        <p className="rounded-2xl border border-border/50 bg-background/60 p-3 text-xs leading-5 text-foreground italic">
                          "{selectedAppointment.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/20 backdrop-blur-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                    <CalendarDaysIcon className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Khám & Điều trị</h4>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <DetailRow label="Dịch vụ" value={selectedAppointment.service_name} />
                    <DetailRow label="Bác sĩ phụ trách" value={selectedAppointment.doctor_name || 'Chưa phân công'} />
                    <DetailRow
                      label="Thời gian hẹn"
                      value={formatDateTime(selectedAppointment.date, selectedAppointment.time)}
                    />
                    <DetailRow
                      label="Thời gian đặt lịch"
                      value={formatDateTime(selectedAppointment.created_at)}
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Hóa đơn & Cập nhật trạng thái */}
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/60 bg-card/20 backdrop-blur-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                    <ReceiptIcon className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Hóa đơn & Chi phí</h4>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <DetailRow
                      label="Tổng tiền dịch vụ"
                      value={
                        <span className="text-sm font-black text-foreground">
                          {formatCurrency(selectedAppointment.invoice_total_amount)}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Trạng thái thanh toán"
                      value={
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            paymentBadgeClass[selectedAppointment.invoice_payment_status || ''] || paymentBadgeClass['']
                          }`}
                        >
                          {selectedAppointment.invoice_payment_status || 'unpaid'}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Phương thức thanh toán"
                      value={selectedAppointment.invoice_payment_method || 'Chưa ghi nhận'}
                    />
                    {selectedAppointment.invoice_payment_date && (
                      <DetailRow
                        label="Ngày thanh toán"
                        value={formatDateTime(selectedAppointment.invoice_payment_date)}
                      />
                    )}
                  </div>
                </div>

                {/* Status Updater Card */}
                <div className="rounded-3xl border border-primary/40 bg-primary/[0.04] backdrop-blur-xl p-5 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Cập nhật trạng thái lịch hẹn
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Thay đổi trạng thái để đồng bộ tiến trình tiếp đón và khám bệnh.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((statusKey) => {
                        const isSelected = nextStatus === statusKey;
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => setNextStatus(statusKey)}
                            className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-xs font-bold transition-all ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                : 'border-border/70 bg-card/40 text-foreground hover:bg-card/80 hover:border-primary/40'
                            }`}
                          >
                            <span>{statusLabel[statusKey]}</span>
                            {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateStatus}
                      disabled={updating || nextStatus === selectedAppointment.status}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {updating ? <Spinner className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                      <span>Lưu trạng thái lịch hẹn</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardAppointmentsPanel;
