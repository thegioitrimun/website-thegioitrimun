import React, { useEffect, useMemo, useState } from 'react';
import type { AdminAppointmentDrilldown, Appointment, DoctorDetail, Service } from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import AnimatedSection from './AnimatedSection';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
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
  const [showFilters, setShowFilters] = useState(false);
  const [appointments, setAppointments] = useState<AdminAppointmentDrilldown[]>([]);
  const [allAppointments, setAllAppointments] = useState<AdminAppointmentDrilldown[]>([]);
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
    void api.getAdminAppointmentsDrilldown({
      limit: 500,
      offset: 0,
    }).then((rows) => {
      if (!cancelled) setAllAppointments(rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [seedKey]);

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
        if (statusFilter === 'all' && serviceFilter === 'all' && doctorFilter === 'all' && !dateFrom && !dateTo && !searchQuery) {
          setAllAppointments(rows);
        }
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
    setSelectedAppointmentId(null);
  };

  const currentIndex = useMemo(() => {
    if (!selectedAppointment) return -1;
    return appointments.findIndex((a) => a.id === selectedAppointment.id);
  }, [appointments, selectedAppointment]);

  const prevAppointment = currentIndex > 0 ? appointments[currentIndex - 1] : null;
  const nextAppointment = currentIndex >= 0 && currentIndex < appointments.length - 1 ? appointments[currentIndex + 1] : null;

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

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setServiceFilter('all');
    setDoctorFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  type AppointmentPreset = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'today';

  const APPOINTMENT_PRESET_TABS: Array<{ key: AppointmentPreset; label: string }> = [
    { key: 'all', label: 'Tất cả lịch hẹn' },
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã hủy' },
    { key: 'today', label: 'Hôm nay' },
  ];

  const handleSelectPreset = (key: AppointmentPreset) => {
    if (key === 'all') {
      setStatusFilter('all');
      setDateFrom('');
      setDateTo('');
    } else if (key === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      setStatusFilter('all');
      setDateFrom(today);
      setDateTo(today);
    } else {
      setStatusFilter(key);
      setDateFrom('');
      setDateTo('');
    }
  };

  const currentPreset: AppointmentPreset = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (dateFrom === today && dateTo === today && statusFilter === 'all') return 'today';
    if (statusFilter === 'pending' && !dateFrom && !dateTo) return 'pending';
    if (statusFilter === 'confirmed' && !dateFrom && !dateTo) return 'confirmed';
    if (statusFilter === 'completed' && !dateFrom && !dateTo) return 'completed';
    if (statusFilter === 'cancelled' && !dateFrom && !dateTo) return 'cancelled';
    if (statusFilter === 'all' && !dateFrom && !dateTo) return 'all';
    return 'all';
  }, [dateFrom, dateTo, statusFilter]);

  const countSource = allAppointments.length > 0 ? allAppointments : appointments;
  const presetCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const counts: Record<AppointmentPreset, number> = {
      all: countSource.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      today: 0,
    };
    countSource.forEach((item) => {
      if (item.status === 'pending') counts.pending++;
      if (item.status === 'confirmed') counts.confirmed++;
      if (item.status === 'completed') counts.completed++;
      if (item.status === 'cancelled') counts.cancelled++;
      if (item.date === today) counts.today++;
    });
    return counts;
  }, [countSource]);

  if (selectedAppointment && isDetailModalOpen) {
    return (
      <AnimatedSection stagger={100}>
        <div className="space-y-3.5 sm:space-y-4 -mx-3 sm:mx-0 p-0 sm:p-2 md:p-5">
          {/* 1. Header Banner */}
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: Back button + Appointment Code + Status Badge + Info */}
              <div className="flex items-start gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                  aria-label="Quay lại danh sách lịch hẹn"
                  title="Quay lại danh sách lịch hẹn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                      CHI TIẾT LỊCH HẸN
                    </span>
                    <h3 className="font-mono text-base sm:text-xl font-black text-foreground tracking-tight">
                      #{selectedAppointment.id.slice(0, 8)}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        statusBadgeClass[selectedAppointment.status]
                      }`}
                    >
                      {statusLabel[selectedAppointment.status]}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg sm:text-2xl font-bold text-foreground">
                    {selectedAppointment.patient_name || 'Khách hàng'}
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                    {selectedAppointment.service_name} • {formatDateTime(selectedAppointment.date, selectedAppointment.time)}
                  </p>
                </div>
              </div>

              {/* Right: Quick actions (Pager + Quick contact + Back button) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Pager */}
                {appointments.length > 1 && currentIndex !== -1 && (
                  <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background/40 p-1 backdrop-blur-md">
                    <button
                      type="button"
                      disabled={!prevAppointment}
                      onClick={() => prevAppointment && openDetail(prevAppointment)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
                      title="Lịch hẹn trước"
                      aria-label="Lịch hẹn trước"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-[11px] font-bold text-muted-foreground">
                      {currentIndex + 1} / {appointments.length}
                    </span>
                    <button
                      type="button"
                      disabled={!nextAppointment}
                      onClick={() => nextAppointment && openDetail(nextAppointment)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
                      title="Lịch hẹn tiếp theo"
                      aria-label="Lịch hẹn tiếp theo"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Gọi điện */}
                {selectedAppointment.patient_phone && (
                  <a
                    href={`tel:${selectedAppointment.patient_phone}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 shadow-2xs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    <span>Gọi khách</span>
                  </a>
                )}

                {/* Quay lại danh sách */}
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-3 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                >
                  <span>Về danh sách</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Detail Body Grid (2 Cột Apple Glass) */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 mx-1 sm:mx-0">
            {/* CỘT 1: Thông tin bệnh nhân & Khám điều trị */}
            <div className="space-y-3 sm:space-y-4">
              {/* Thẻ 1: Thông tin bệnh nhân */}
              <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Thông tin bệnh nhân</h4>
                </div>
                <div className="space-y-2.5">
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

              {/* Thẻ 2: Khám & Điều trị */}
              <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <CalendarDaysIcon className="h-5 w-5 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Khám & Điều trị</h4>
                </div>
                <div className="space-y-2.5">
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

            {/* CỘT 2: Hóa đơn & Chi phí + Cập nhật trạng thái */}
            <div className="space-y-3 sm:space-y-4">
              {/* Thẻ 3: Hóa đơn & Chi phí */}
              <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <ReceiptIcon className="h-5 w-5 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Hóa đơn & Chi phí</h4>
                </div>
                <div className="space-y-2.5">
                  <DetailRow
                    label="Tổng tiền dịch vụ"
                    value={
                      <span className="text-base font-black text-foreground">
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

              {/* Thẻ 4: Cập nhật trạng thái lịch hẹn */}
              <div className="rounded-2xl sm:rounded-[1.75rem] border border-primary/40 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <CheckCircleIcon className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Cập nhật trạng thái lịch hẹn
                    </h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Thay đổi trạng thái để đồng bộ tiến trình tiếp đón và điều trị.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((statusKey) => {
                      const isSelected = nextStatus === statusKey;
                      return (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => setNextStatus(statusKey)}
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]'
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {updating ? <Spinner className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                    <span>Lưu trạng thái lịch hẹn</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* 1. Header & Filter Card matching Orders & Customers */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        {/* Preset pills row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {APPOINTMENT_PRESET_TABS.map((preset) => {
            const isActive = currentPreset === preset.key;
            const count = presetCounts[preset.key] || 0;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleSelectPreset(preset.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{preset.label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search bar, Filter toggle, Export button & Quick Service action */}
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mã lịch hẹn / tên khách / SĐT / email / bác sĩ..."
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
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition-all shrink-0 active:scale-95 ${
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
            disabled={exporting || appointments.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0"
            title="Xuất file Excel"
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
            onClick={onOpenAdvancedModule}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold shrink-0 shadow-xs hover:bg-secondary/90 active:scale-95 transition-all"
            title="Quản lý dịch vụ"
          >
            <span>Quản lý dịch vụ</span>
          </button>
        </div>

        {/* Collapsible / Desktop Grid Filters */}
        <div
          className={`mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 transition-all ${
            showFilters ? 'grid' : 'hidden xl:grid'
          }`}
        >
          {activeFilterCount > 0 && (
            <div className="col-span-2 sm:col-span-2 lg:col-span-4 flex items-center justify-between pb-1 border-b border-border/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {appointments.length} lịch hẹn tìm thấy
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Xóa bộ lọc ({activeFilterCount})
              </button>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Appointment['status'])}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(statusLabel).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Dịch vụ</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả dịch vụ</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Bác sĩ</label>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            >
              <option value="all">Tất cả bác sĩ</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Khoảng ngày</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type={dateFrom ? "date" : "text"}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                placeholder="Từ ngày"
                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
              <input
                type={dateTo ? "date" : "text"}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onFocus={(e) => (e.target.type = 'date')}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                placeholder="Đến ngày"
                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Appointments List / Cards */}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center p-8">
          <Spinner />
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-white/70 bg-card/75 p-10 text-center text-sm text-muted-foreground shadow-xs backdrop-blur-2xl dark:border-white/10">
          Không tìm thấy lịch hẹn nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="block md:hidden space-y-2 mx-1 sm:mx-0">
            {appointments.map((appointment, index) => (
              <div
                key={appointment.id}
                onClick={() => openDetail(appointment)}
                className="relative rounded-2xl border border-white/70 bg-card/75 p-3.5 shadow-xs backdrop-blur-xl transition-all active:scale-[0.99] cursor-pointer hover:border-primary/40 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                        {index + 1}
                      </span>
                      <p className="truncate text-sm font-bold text-foreground">
                        {appointment.patient_name || 'Khách chưa rõ tên'}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {appointment.patient_phone && (
                        <a
                          href={`tel:${appointment.patient_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {appointment.patient_phone}
                        </a>
                      )}
                      {appointment.patient_phone && <span>•</span>}
                      <span className="text-primary font-medium truncate">{appointment.service_name}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-2xs ${
                      statusBadgeClass[appointment.status]
                    }`}
                  >
                    {statusLabel[appointment.status]}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-border/30 pt-2 text-xs">
                  <div className="text-muted-foreground text-[11px]">
                    {formatDateTime(appointment.date, appointment.time)}
                    {appointment.doctor_name && (
                      <span className="ml-1 text-foreground/80 font-medium">({appointment.doctor_name})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground font-mono">{formatCurrency(appointment.invoice_total_amount)}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[9px] font-semibold ${
                        paymentBadgeClass[appointment.invoice_payment_status || ''] || paymentBadgeClass['']
                      }`}
                    >
                      {appointment.invoice_payment_status || 'unpaid'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (≥ md) */}
          <div className="hidden md:block overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
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
          </div>
        </>
      )}

    </div>
  );
};

export default AdminDashboardAppointmentsPanel;
