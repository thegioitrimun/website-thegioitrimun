import React, { useState } from 'react';
import type { AdminNavigationView, AdminUserSection, PatientProfile, DoctorDetail, DoctorProfile } from '../types';
import { UsersIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import { AdminMobileCard, AdminMobileList, AdminMobileMeta } from './AdminResponsivePrimitives';
import DoctorForm from './DoctorForm';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';


interface AdminUserManagementPageProps {
  allPatients: PatientProfile[];
  doctorDetails: DoctorDetail[];
  initialSection?: AdminUserSection;
  onUpdatePatient: (patient: Partial<PatientProfile> & { id: string }, avatarFile: File | null) => void;
  onSaveDoctorProfile: (doctorProfile: DoctorProfile) => void;
  onDeleteDoctorProfile: (doctorId: string) => void;
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
}

type AdminUserView = 'list' | 'edit-doctor' | 'user-detail';
type ActiveTab = AdminUserSection;

const AdminUserManagementPage: React.FC<AdminUserManagementPageProps> = (props) => {
  const { t } = useTranslation();
  const setSidebarConfig = useAdminLayoutDispatch();
  const [activeTab, setActiveTab] = useState<ActiveTab>(props.initialSection || 'doctors');
  const [view, setView] = useState<AdminUserView>('list');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorDetail | null>(null);
  const [selectedUser, setSelectedUser] = useState<PatientProfile | null>(null);
  const [userDetail, setUserDetail] = useState<api.AdminUserDetail | null>(null);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false);
  const customers = props.allPatients.filter(p => p.role === 'customer');
  const privilegedAccounts = props.allPatients.filter((patient) => patient.role === 'admin' || patient.role === 'master_admin');
  const userTabs: Array<{ key: ActiveTab; label: string }> = [
    { key: 'doctors', label: `${t('admin.manage_doctors')} (${props.doctorDetails.length})` },
    { key: 'roles', label: `Role & quyền (${privilegedAccounts.length})` },
  ];

  const handleTabChange = React.useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setView('list');
    setSelectedDoctor(null);
    setSelectedUser(null);
    setUserDetail(null);
    setUserDetailError(null);
    
    props.onNavigate({ page: 'adminUserManagement', section: tab });
  }, [props.onNavigate]);

  const userTaskItems = React.useMemo(() => userTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    onClick: () => handleTabChange(tab.key),
  })), [userTabs, handleTabChange]);

  React.useEffect(() => {
    if (props.initialSection && props.initialSection !== activeTab) {
      setActiveTab(props.initialSection);
      setView('list');
      setSelectedDoctor(null);
      setSelectedUser(null);
      setUserDetail(null);
      setUserDetailError(null);
    }
  }, [props.initialSection]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.location.pathname.startsWith('/admin/nguoi-dung')) return;

    const section = props.initialSection || activeTab;
    const canonicalPath = section === 'roles' ? '/admin/nguoi-dung/roles' : '/admin/nguoi-dung';
    const url = new URL(window.location.href);
    const hasLegacyUserTab = url.searchParams.has('tab') || url.searchParams.has('section');

    if (url.pathname === canonicalPath && !hasLegacyUserTab) return;

    url.pathname = canonicalPath;
    url.searchParams.delete('tab');
    url.searchParams.delete('section');
    window.history.replaceState(
      window.history.state,
      document.title,
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [activeTab, props.initialSection]);

  const sectionMeta = (() => {
    if (view === 'user-detail') {
      return {
        title: selectedUser?.name || 'Hồ sơ người dùng',
        description: 'Đơn hàng, lịch hẹn, hồ sơ y tế và tài liệu private được tải trực tiếp từ Cloudflare D1 cho đúng người dùng này.',
        eyebrow: 'D1 customer profile',
        insights: [
          { label: 'Đơn hàng', value: String(userDetail?.orders.length || 0), hint: 'Đơn gắn theo user ID hoặc email xác minh' },
          { label: 'Lịch hẹn', value: String(userDetail?.appointments.length || 0), hint: 'Dịch vụ và trạng thái lịch gần nhất' },
          { label: 'Hồ sơ / tài liệu', value: `${userDetail?.medicalRecords.length || 0} / ${userDetail?.documents.length || 0}`, hint: 'Tài liệu private không lộ URL R2 công khai' },
        ],
      };
    }
    if (view === 'edit-doctor') {
      return {
        title: selectedDoctor ? 'Chỉnh sửa hồ sơ bác sĩ' : 'Tạo hồ sơ bác sĩ',
        description: 'Form bác sĩ được tách khỏi bảng tài khoản để cập nhật hồ sơ chuyên môn, avatar và thông tin công khai mà không làm rối phần role management.',
        eyebrow: 'Doctor profile editor',
        insights: [
          { label: 'Tổng tài khoản', value: String(props.allPatients.length), hint: `${props.doctorDetails.length} bác sĩ • ${customers.length} khách hàng` },
          { label: 'Màn hiện tại', value: selectedDoctor ? 'Đang sửa' : 'Tạo mới', hint: 'Thoát editor sẽ quay lại đúng task người dùng đang mở' },
          { label: 'Khu vực quản trị', value: 'Bác sĩ', hint: 'Hồ sơ chuyên môn và thông tin hiển thị công khai' },
        ],
      };
    }

    if (activeTab === 'doctors') {
      return {
        title: 'Quản lý bác sĩ',
        description: 'Quản lý hồ sơ chuyên môn, thông tin hiển thị công khai và dữ liệu bác sĩ trong hệ thống.',
        eyebrow: 'Doctor operations',
        insights: [
          { label: 'Bác sĩ', value: String(props.doctorDetails.length), hint: 'Tổng hồ sơ bác sĩ đang có trong hệ thống' },
          { label: 'Màn hiện tại', value: 'Danh sách bác sĩ', hint: 'Task-level route qua shell admin' },
          { label: 'Tổng tài khoản', value: String(props.allPatients.length), hint: 'Giữ quyền nhìn tổng thể khi cần đổi role' },
        ],
      };
    }

    if (activeTab === 'roles') {
      return {
        title: 'Role & quyền truy cập',
        description: 'Tách role management khỏi danh sách user thông thường để việc nâng quyền hoặc hạ quyền không bị lẫn với xử lý khách hàng/bác sĩ.',
        eyebrow: 'Role governance',
        insights: [
          { label: 'Tài khoản quyền cao', value: String(privilegedAccounts.length), hint: 'Admin và master admin cần được rà riêng' },
          { label: 'Tổng tài khoản', value: String(props.allPatients.length), hint: `${props.doctorDetails.length} bác sĩ • ${customers.length} khách hàng` },
          { label: 'Màn hiện tại', value: 'Role matrix', hint: 'Thao tác quyền được gom vào một queue riêng' },
        ],
      };
    }

    return {
      title: 'Quản lý bác sĩ',
      description: 'Quản lý hồ sơ chuyên môn, thông tin hiển thị công khai và dữ liệu bác sĩ trong hệ thống.',
      eyebrow: 'Doctor operations',
      insights: [
        { label: 'Bác sĩ', value: String(props.doctorDetails.length), hint: 'Tổng hồ sơ bác sĩ đang có trong hệ thống' },
        { label: 'Màn hiện tại', value: 'Danh sách bác sĩ', hint: 'Task-level route qua shell admin' },
        { label: 'Tổng tài khoản', value: String(props.allPatients.length), hint: 'Quản lý phân quyền tại mục Role & quyền' },
      ],
    };
  })();

  const workspaceActions = (
    <div className="flex flex-wrap justify-end gap-2">
      {view === 'edit-doctor' || view === 'user-detail' ? (
        <button
          type="button"
          onClick={() => {
            setView('list');
            setSelectedUser(null);
            setUserDetail(null);
            setUserDetailError(null);
          }}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          Về danh sách
        </button>
      ) : activeTab === 'roles' ? (
        <button
          type="button"
          onClick={() => handleTabChange('doctors')}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          Mở bác sĩ
        </button>
      ) : null}
    </div>
  );

  React.useEffect(() => {
    setSidebarConfig({
      title: sectionMeta.title,
      description: sectionMeta.description,
      icon: <UsersIcon className="w-8 h-8" />,
      eyebrow: sectionMeta.eyebrow,
      insights: sectionMeta.insights,
      taskItems: userTaskItems,
      activeTaskKey: view === 'edit-doctor' ? 'doctors' : activeTab,
      actions: workspaceActions,
    });
  }, [setSidebarConfig, sectionMeta, userTaskItems, view, activeTab, workspaceActions]);

  const handleEditDoctor = (doctor: DoctorDetail) => {
    setSelectedDoctor(doctor);
    setView('edit-doctor');
  };

  const handleOpenUserDetail = React.useCallback(async (user: PatientProfile, force = false) => {
    setSelectedUser(user);
    setView('user-detail');
    setIsUserDetailLoading(true);
    setUserDetailError(null);
    try {
      const detail = await api.getAdminUserDetail(user.id, { force });
      setUserDetail(detail);
    } catch (error: any) {
      setUserDetail(null);
      setUserDetailError(error?.message || 'Không thể tải hồ sơ người dùng.');
    } finally {
      setIsUserDetailLoading(false);
    }
  }, []);

  const handleSaveDoctor = (doctorProfile: DoctorProfile) => {
    props.onSaveDoctorProfile(doctorProfile);
    setView('list');
    setActiveTab('doctors');
  };

  const renderContent = () => {
    if (view === 'edit-doctor' && selectedDoctor) {
      return (
        <DoctorForm
          doctor={selectedDoctor}
          onSave={handleSaveDoctor}
          onCancel={() => setView('list')}
        />
      );
    }

    if (view === 'user-detail' && selectedUser) {
      return (
        <UserDetailPanel
          user={selectedUser}
          detail={userDetail}
          isLoading={isUserDetailLoading}
          error={userDetailError}
          onRetry={() => void handleOpenUserDetail(selectedUser, true)}
          onBack={() => {
            setView('list');
            setSelectedUser(null);
            setUserDetail(null);
            setUserDetailError(null);
          }}
        />
      );
    }

    return (
      <div className="space-y-5 md:space-y-7">
        {/* Top Hero Banner */}
        <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl px-5 py-6 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            {activeTab === 'roles' ? 'ROLE & QUYỀN TRUY CẬP' : 'QUẢN LÝ BÁC SĨ'}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
            {activeTab === 'roles' ? 'Phân quyền & Tài khoản' : 'Danh sách Bác sĩ'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            {activeTab === 'roles'
              ? 'Tách role management khỏi danh sách user thông thường để việc nâng quyền hoặc hạ quyền không bị lẫn với khách hàng.'
              : 'Quản lý hồ sơ chuyên môn, thông tin hiển thị công khai và dữ liệu bác sĩ trong hệ thống.'}
          </p>
        </div>

        {activeTab === 'doctors' && <DoctorsTab doctors={props.doctorDetails} onEdit={handleEditDoctor} onDelete={props.onDeleteDoctorProfile} />}
        {activeTab === 'roles' && <AllAccountsTab patients={props.allPatients} onUpdatePatient={props.onUpdatePatient} onView={handleOpenUserDetail} />}
      </div>
    );
  };

  return (
    <AnimatedSection stagger={100}>
      {renderContent()}
    </AnimatedSection>
  );
};


// TAB COMPONENTS

const UserDetailPanel: React.FC<{
  user: PatientProfile;
  detail: api.AdminUserDetail | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}> = ({ user, detail, isLoading, error, onRetry, onBack }) => {
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-[1.7rem] border border-border/40 bg-card/25" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-[1.7rem] border border-border/40 bg-card/25" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-[1.7rem] border border-border/40 bg-card/25" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.7rem] border border-red-200 bg-red-50/50 p-6 text-center backdrop-blur-2xl dark:border-red-500/20 dark:bg-red-500/5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15)]">
        <p className="font-bold text-red-700 dark:text-red-200">Không thể tải hồ sơ</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{error}</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onRetry} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm">
            Thử lại
          </button>
          <button type="button" onClick={onBack} className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;
  const formatDate = (value?: string | null) => {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date);
  };

  const roleLabel = user.role === 'admin' || user.role === 'master_admin' ? 'Quản trị viên' : user.role === 'doctor' ? 'Bác sĩ chuyên khoa' : 'Khách hàng';

  // Calculate order metrics
  const totalSpent = detail.orders.reduce((sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0), 0);
  const completedOrders = detail.orders.filter(o => o.status === 'completed' || o.status === 'shipped');
  const completedSpent = completedOrders.reduce((sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0), 0);
  const pendingOrders = detail.orders.filter(o => o.status === 'pending' || o.status === 'processing');
  const pendingSpent = pendingOrders.reduce((sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0), 0);

  // Calculate appointment metrics
  const completedAppointments = detail.appointments.filter((a: any) => a.status === 'completed');
  const pendingAppointments = detail.appointments.filter((a: any) => a.status !== 'completed' && a.status !== 'cancelled');

  return (
    <div className="space-y-5 md:space-y-7">
      {/* Top Hero Banner */}
      <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl px-5 py-6 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">HỒ SƠ KHÁCH HÀNG</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">{user.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {user.email} • <span className="font-semibold text-foreground">{roleLabel}</span> • ID: <span className="font-mono">{user.id.slice(0, 8)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:text-primary shadow-sm"
          >
            ← Về danh sách
          </button>
        </div>
      </div>

      {/* 2x2 Modules Grid styled like Dashboard */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Module 1: Hoạt động mua hàng & Đơn hàng */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">DOANH SỐ MUA HÀNG</p>
              <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Đơn hàng và chi tiêu</h2>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {detail.orders.length} đơn hàng
            </span>
          </div>

          <div className="mt-7 space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground md:text-base">Đơn hàng hoàn tất</p>
                <p className="text-base font-bold text-foreground md:text-lg">{new Intl.NumberFormat('vi-VN').format(completedSpent)} đ</p>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary md:h-5">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: totalSpent > 0 ? `${Math.max(8, (completedSpent / totalSpent) * 100)}%` : '0%' }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground md:text-base">Đơn đang xử lý / Chờ giao</p>
                <p className="text-base font-bold text-foreground md:text-lg">{new Intl.NumberFormat('vi-VN').format(pendingSpent)} đ</p>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary md:h-5">
                <div
                  className="h-full rounded-full bg-[#dca846] transition-[width] duration-500"
                  style={{ width: totalSpent > 0 ? `${Math.max(8, (pendingSpent / totalSpent) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Tổng chi tiêu ghi nhận</span>
            <strong className="text-lg text-primary md:text-xl">{new Intl.NumberFormat('vi-VN').format(totalSpent)} đ</strong>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Danh sách đơn gần đây</p>
            {detail.orders.length ? (
              detail.orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-sm transition-colors hover:border-primary/30">
                  <div>
                    <p className="font-bold text-foreground">#{order.order_code || order.id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at)} • <span className="capitalize font-medium text-foreground">{order.status}</span></p>
                  </div>
                  <p className="text-base font-black text-primary">{new Intl.NumberFormat('vi-VN').format(order.grand_total ?? order.total_price ?? 0)} đ</p>
                </div>
              ))
            ) : (
              <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/40 px-5 text-center text-sm text-muted-foreground">
                Chưa có đơn hàng nào.
              </div>
            )}
          </div>
        </section>

        {/* Module 2: Lịch hẹn & Dịch vụ Clinic */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">DỊCH VỤ CLINIC</p>
              <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Lịch hẹn và điều trị</h2>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {detail.appointments.length} lượt hẹn
            </span>
          </div>

          <div className="mt-7 space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground md:text-base">Lịch khám đã hoàn tất</p>
                <p className="text-base font-bold text-foreground md:text-lg">{completedAppointments.length} lịch</p>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary md:h-5">
                <div
                  className="h-full rounded-full bg-[#e97862] transition-[width] duration-500"
                  style={{ width: detail.appointments.length > 0 ? `${Math.max(8, (completedAppointments.length / detail.appointments.length) * 100)}%` : '0%' }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground md:text-base">Lịch hẹn đang chờ / Đang đặt</p>
                <p className="text-base font-bold text-foreground md:text-lg">{pendingAppointments.length} lịch</p>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary md:h-5">
                <div
                  className="h-full rounded-full bg-[#3b82f6] transition-[width] duration-500"
                  style={{ width: detail.appointments.length > 0 ? `${Math.max(8, (pendingAppointments.length / detail.appointments.length) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Tổng số lượt lịch hẹn</span>
            <strong className="text-lg text-foreground md:text-xl">{detail.appointments.length} lượt</strong>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lịch hẹn gần đây</p>
            {detail.appointments.length ? (
              detail.appointments.slice(0, 5).map((appointment: any) => (
                <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-sm transition-colors hover:border-primary/30">
                  <div>
                    <p className="font-bold text-foreground">{appointment.service_name || 'Dịch vụ da liễu'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {appointment.appointment_date || appointment.date || 'Chưa có ngày'} {appointment.appointment_time || appointment.time || ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground capitalize">
                    {appointment.status || 'pending'}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/40 px-5 text-center text-sm text-muted-foreground">
                Chưa có lịch hẹn nào.
              </div>
            )}
          </div>
        </section>

        {/* Module 3: Hồ sơ y tế & Bệnh án */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">HỒ SƠ ĐIỀU TRỊ</p>
              <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Bệnh án & Ghi chú y tế</h2>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {detail.medicalRecords.length} hồ sơ
            </span>
          </div>
          <div className="mt-6 space-y-3">
            {detail.medicalRecords.length ? (
              detail.medicalRecords.slice(0, 6).map((record: any) => (
                <div key={record.id} className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-sm">
                  <p className="font-bold text-foreground">{record.summary || record.clinical_notes || 'Hồ sơ khám da'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.created_at || record.encounter_date)} • Ghi chép lâm sàng</p>
                </div>
              ))
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/40 px-5 text-center text-sm text-muted-foreground">
                Chưa có hồ sơ bệnh án nào được ghi nhận.
              </div>
            )}
          </div>
        </section>

        {/* Module 4: Tài liệu private R2 */}
        <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">LƯU TRỮ DỮ LIỆU</p>
              <h2 className="mt-2 text-xl font-bold text-foreground md:text-2xl">Tài liệu & Kết quả riêng tư</h2>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {detail.documents.length} tài liệu
            </span>
          </div>
          <div className="mt-6 space-y-3">
            {detail.documents.length ? (
              detail.documents.slice(0, 6).map((document: any) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-sm">
                  <div>
                    <p className="break-words font-bold text-foreground">{document.file_name || document.object_key || 'Tài liệu'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(document.created_at)} • Encrypted storage</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    Private R2
                  </span>
                </div>
              ))
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/40 px-5 text-center text-sm text-muted-foreground">
                Chưa có tài liệu private nào trên R2.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const AllAccountsTab: React.FC<{
  patients: PatientProfile[];
  onUpdatePatient: (p: Partial<PatientProfile> & { id: string }, f: File | null) => void;
  onView: (patient: PatientProfile) => void;
}> = ({ patients, onUpdatePatient, onView }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">DANH SÁCH TÀI KHOẢN</p>
          <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Phân quyền & Hồ sơ</h2>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {patients.length} tài khoản
        </span>
      </div>

      <AdminMobileList>
        {patients.map(p => (
          <AdminMobileCard key={p.id}>
            <p className="line-clamp-1 text-base font-black text-foreground">{p.name}</p>
            <div className="mt-3 grid gap-2">
              <AdminMobileMeta label={t('admin.table_email')} value={p.email} />
              <AdminMobileMeta
                label={t('admin.table_role')}
                value={(
                  <select
                    value={p.role}
                    onChange={(e) => onUpdatePatient({ id: p.id, role: e.target.value as PatientProfile['role'] }, null)}
                    className="w-full admin-glass-input"
                  >
                    <option value="customer">Customer</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                  </select>
                )}
              />
              <button type="button" onClick={() => onView(p)} className="mt-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-primary">
                Xem hồ sơ
              </button>
            </div>
          </AdminMobileCard>
        ))}
      </AdminMobileList>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm text-left bg-transparent">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">{t('admin.table_name')}</th>
              <th className="px-4 py-3">{t('admin.table_email')}</th>
              <th className="px-4 py-3">{t('admin.table_role')}</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {patients.map(p => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3.5 font-bold text-foreground">{p.name}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{p.email}</td>
                <td className="px-4 py-3.5">
                  <select
                    value={p.role}
                    onChange={(e) => onUpdatePatient({ id: p.id, role: e.target.value as PatientProfile['role'] }, null)}
                    className="admin-glass-input !py-1 !px-2.5 rounded-lg text-xs font-semibold"
                  >
                    <option value="customer">Customer</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                    <option value="master_admin">Master Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => onView(p)}
                    className="rounded-full border border-border bg-background/90 px-4 py-1.5 text-xs font-bold text-primary transition-all hover:border-primary/40 hover:bg-primary hover:text-primary-foreground shadow-sm"
                  >
                    Xem hồ sơ →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DoctorsTab: React.FC<{ doctors: DoctorDetail[], onEdit: (d: DoctorDetail) => void, onDelete: (id: string) => void }> = ({ doctors, onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">ĐỘI NGŨ CHUYÊN MÔN</p>
          <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Bác sĩ da liễu</h2>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {doctors.length} bác sĩ
        </span>
      </div>

      <AdminMobileList>
        {doctors.map(d => (
          <AdminMobileCard key={d.id}>
            <p className="line-clamp-1 text-base font-black text-foreground">{d.name}</p>
            <div className="mt-3 grid gap-2">
              <AdminMobileMeta label={t('admin.table_job_title')} value={d.doctor_profile?.job_title || t('admin.not_updated')} />
              <AdminMobileMeta label={t('admin.table_specialization')} value={d.doctor_profile?.specialization || t('admin.not_updated')} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onEdit(d)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="h-4 w-4 object-contain inline-block" />
                Sửa
              </button>
              <button type="button" onClick={() => onDelete(d.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/35 hover:text-destructive">
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="h-4 w-4 object-contain inline-block" />
                Xóa
              </button>
            </div>
          </AdminMobileCard>
        ))}
      </AdminMobileList>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm text-left bg-transparent">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">{t('admin.table_name')}</th>
              <th className="px-4 py-3">{t('admin.table_job_title')}</th>
              <th className="px-4 py-3">{t('admin.table_specialization')}</th>
              <th className="px-4 py-3 text-right">{t('admin.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3.5 font-bold text-foreground">{d.name}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{d.doctor_profile?.job_title || t('admin.not_updated')}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{d.doctor_profile?.specialization || t('admin.not_updated')}</td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <div className="relative group inline-flex">
                      <button
                        type="button"
                        onClick={() => onEdit(d)}
                        aria-label={`Chỉnh sửa bác sĩ ${d.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-primary"
                      >
                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="w-5 h-5 object-contain" />
                      </button>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                        Chỉnh sửa
                      </span>
                    </div>
                    <div className="relative group inline-flex">
                      <button
                        type="button"
                        onClick={() => onDelete(d.id)}
                        aria-label={`Xóa bác sĩ ${d.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-destructive"
                      >
                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="w-5 h-5 object-contain" />
                      </button>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                        Xóa hồ sơ
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUserManagementPage;
