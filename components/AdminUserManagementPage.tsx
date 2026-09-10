import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type {
  AdminNavigationView,
  AdminUserSection,
  PatientProfile,
  DoctorDetail,
  DoctorProfile,
} from '../types';
import { SearchIcon, CloseIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import DoctorForm from './DoctorForm';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import { AdminMobileList, AdminMobileCard } from './AdminResponsivePrimitives';

interface AdminUserManagementPageProps {
  allPatients: PatientProfile[];
  doctorDetails: DoctorDetail[];
  initialSection?: AdminUserSection;
  onUpdatePatient: (
    patient: Partial<PatientProfile> & { id: string },
    avatarFile: File | null
  ) => void;
  onSaveDoctorProfile: (doctorProfile: DoctorProfile) => void;
  onDeleteDoctorProfile: (doctorId: string) => void;
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
}

type AdminUserView = 'list' | 'edit-doctor' | 'user-detail';
type ActiveTab = AdminUserSection;

const EDIT_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp';
const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';
const USER_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786757644972-Untitled-26.webp';
const ADD_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp';

const primaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

const secondaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3.5 text-xs sm:text-sm font-bold text-foreground shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const customers = useMemo(
    () => props.allPatients.filter((p) => p.role === 'customer'),
    [props.allPatients]
  );
  const privilegedAccounts = useMemo(
    () =>
      props.allPatients.filter(
        (p) => p.role === 'admin' || p.role === 'master_admin' || p.role === 'accountant'
      ),
    [props.allPatients]
  );

  const userTabs: Array<{ key: ActiveTab; label: string }> = [
    { key: 'doctors', label: `Quản lý Bác sĩ (${props.doctorDetails.length})` },
    { key: 'roles', label: `Role & quyền (${privilegedAccounts.length})` },
  ];

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
      setView('list');
      setSelectedDoctor(null);
      setSelectedUser(null);
      setUserDetail(null);
      setUserDetailError(null);
      setSearchQuery('');
      setRoleFilter('all');
      props.onNavigate({ page: 'adminUserManagement', section: tab });
    },
    [props]
  );

  const userTaskItems = useMemo(
    () =>
      userTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        onClick: () => handleTabChange(tab.key),
      })),
    [userTabs, handleTabChange]
  );

  useEffect(() => {
    if (props.initialSection && props.initialSection !== activeTab) {
      setActiveTab(props.initialSection);
      setView('list');
      setSelectedDoctor(null);
      setSelectedUser(null);
      setUserDetail(null);
      setUserDetailError(null);
    }
  }, [props.initialSection]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.location.pathname.startsWith('/admin/nguoi-dung')
    )
      return;

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
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [activeTab, props.initialSection]);

  // Synchronize sidebar layout with AdminWorkspaceLayout
  useEffect(() => {
    setSidebarConfig({
      eyebrow: 'USER GOVERNANCE',
      title: 'Người dùng & Bác sĩ',
      description: 'Quản lý đội ngũ bác sĩ chuyên môn, phân quyền tài khoản và hồ sơ người dùng D1.',
      icon: (
        <img
          src={USER_ICON}
          alt="Người dùng"
          className="h-8 w-8 object-contain"
        />
      ),
      insights: [
        {
          label: 'Bác sĩ',
          value: String(props.doctorDetails.length),
          hint: 'Hồ sơ chuyên môn đang hoạt động',
        },
        {
          label: 'Quyền cao',
          value: String(privilegedAccounts.length),
          hint: 'Admin, Master Admin & Kế toán',
        },
        {
          label: 'Tổng tài khoản',
          value: String(props.allPatients.length),
          hint: `${customers.length} khách hàng`,
        },
      ],
      taskItems: userTaskItems,
      activeTaskKey: view === 'edit-doctor' ? 'doctors' : activeTab,
      hideHeader: view === 'edit-doctor' || view === 'user-detail',
    });
  }, [
    setSidebarConfig,
    props.doctorDetails.length,
    privilegedAccounts.length,
    props.allPatients.length,
    customers.length,
    userTaskItems,
    view,
    activeTab,
  ]);

  const handleEditDoctor = (doctor: DoctorDetail) => {
    setSelectedDoctor(doctor);
    setView('edit-doctor');
  };

  const handleOpenUserDetail = useCallback(async (user: PatientProfile, force = false) => {
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

  // Filtered Doctors
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return props.doctorDetails;
    const q = searchQuery.trim().toLowerCase();
    return props.doctorDetails.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.doctor_profile?.job_title?.toLowerCase().includes(q) ||
        d.doctor_profile?.specialization?.toLowerCase().includes(q)
    );
  }, [props.doctorDetails, searchQuery]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    let result = props.allPatients;
    if (roleFilter === 'privileged') {
      result = result.filter(
        (p) => p.role === 'admin' || p.role === 'master_admin' || p.role === 'accountant'
      );
    } else if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [props.allPatients, roleFilter, searchQuery]);

  // --- Sub-Views ---
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
    <AnimatedSection stagger={100}>
      <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
        
        {/* CARD 1: Header & Filter Toolbar (Apple Glass Standard) */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0 transition-all relative z-20">
          
          {/* Row 1: Preset Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => handleTabChange('doctors')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeTab === 'doctors'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>Bác sĩ chuyên khoa</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'doctors'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {props.doctorDetails.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleTabChange('roles');
                setRoleFilter('all');
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeTab === 'roles' && roleFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>Tất cả tài khoản</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'roles' && roleFilter === 'all'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {props.allPatients.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleTabChange('roles');
                setRoleFilter('privileged');
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeTab === 'roles' && roleFilter === 'privileged'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>Admin & Kế toán</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'roles' && roleFilter === 'privileged'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {privilegedAccounts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleTabChange('roles');
                setRoleFilter('customer');
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeTab === 'roles' && roleFilter === 'customer'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>Khách hàng</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'roles' && roleFilter === 'customer'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {customers.length}
              </span>
            </button>
          </div>

          {/* Row 2: Search + Role Filter + Actions */}
          <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'doctors'
                    ? 'Tìm theo tên bác sĩ, chức danh, chuyên khoa...'
                    : 'Tìm theo họ tên, email người dùng...'
                }
                className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
              <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role dropdown when on roles tab */}
            {activeTab === 'roles' && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50 max-w-[140px] sm:max-w-[170px] shrink-0 cursor-pointer"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="privileged">Admin & Kế toán</option>
                <option value="customer">Customer</option>
                <option value="doctor">Doctor</option>
                <option value="accountant">Accountant</option>
                <option value="admin">Admin</option>
                <option value="master_admin">Master Admin</option>
              </select>
            )}

            {/* Action Button: Create doctor */}
            {activeTab === 'doctors' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDoctor({
                    id: '',
                    name: '',
                    email: '',
                    role: 'doctor',
                    doctor_profile: {
                      job_title: '',
                      specialization: '',
                      experience_years: 0,
                      biography: '',
                    },
                  } as unknown as DoctorDetail);
                  setView('edit-doctor');
                }}
                className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-all shrink-0 active:scale-95"
                title="Thêm hồ sơ bác sĩ mới"
              >
                <img src={ADD_ICON} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                <span className="hidden sm:inline">Thêm bác sĩ</span>
                <span className="sm:hidden">Thêm</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: Main List Container (Apple Glass Standard) */}
        {activeTab === 'doctors' ? (
          <DoctorsTab
            doctors={filteredDoctors}
            onEdit={handleEditDoctor}
            onDelete={props.onDeleteDoctorProfile}
          />
        ) : (
          <AllAccountsTab
            patients={filteredAccounts}
            onUpdatePatient={props.onUpdatePatient}
            onView={handleOpenUserDetail}
          />
        )}
      </div>
    </AnimatedSection>
  );
};

// --- TAB: DOCTORS ---
const DoctorsTab: React.FC<{
  doctors: DoctorDetail[];
  onEdit: (d: DoctorDetail) => void;
  onDelete: (id: string) => void;
}> = ({ doctors, onEdit, onDelete }) => {
  return (
    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
      {/* Top Header / Info Bar */}
      <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-foreground">
            Đội ngũ Bác sĩ da liễu
          </span>
          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
            {doctors.length} bác sĩ
          </span>
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30 border border-border/50">
            <img src={USER_ICON} alt="" className="h-6 w-6 object-contain opacity-60" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">Không tìm thấy hồ sơ bác sĩ nào phù hợp</p>
          <p className="mt-1 text-xs text-muted-foreground">Thử tìm kiếm với từ khóa khác hoặc tạo bác sĩ mới.</p>
        </div>
      ) : (
        <>
          {/* Mobile List: Compact Rows (< 1024px) */}
          <AdminMobileList className="p-0 divide-y divide-border/25">
            {doctors.map((d) => (
              <AdminMobileCard key={d.id} className="px-3 py-2.5 sm:p-3.5 transition-colors hover:bg-muted/20">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  {/* Doctor Avatar */}
                  <div className="relative shrink-0">
                    {d.avatar_url ? (
                      <img
                        src={d.avatar_url}
                        alt={d.name}
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl object-cover shadow-xs"
                      />
                    ) : (
                      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-black text-base shadow-xs">
                        {(d.name || 'D').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Doctor Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground leading-snug">
                        {d.name}
                      </p>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEdit(d)}
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-border/70 bg-card/50 text-muted-foreground hover:bg-card/80 hover:text-foreground transition-all active:scale-95"
                          title="Sửa hồ sơ"
                          aria-label={`Sửa hồ sơ ${d.name}`}
                        >
                          <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(d.id)}
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-all active:scale-95"
                          title="Xóa hồ sơ"
                          aria-label={`Xóa hồ sơ ${d.name}`}
                        >
                          <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-0.5 truncate text-[11px] font-semibold text-primary">
                      {d.doctor_profile?.job_title || 'Bác sĩ da liễu'}
                    </p>

                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {d.doctor_profile?.specialization || 'Da liễu thẩm mỹ & Trị mụn'}
                    </p>

                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground font-mono">
                      {d.email}
                    </p>
                  </div>
                </div>
              </AdminMobileCard>
            ))}
          </AdminMobileList>

          {/* Desktop Table View (>= 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="w-[35%] px-4 py-3 font-semibold">Bác sĩ chuyên khoa</th>
                  <th className="w-[22%] px-4 py-3 font-semibold">Chức danh / Học vị</th>
                  <th className="w-[28%] px-4 py-3 font-semibold">Chuyên môn</th>
                  <th className="w-[15%] px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doctors.map((d) => (
                  <tr key={d.id} className="align-middle transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {d.avatar_url ? (
                          <img
                            src={d.avatar_url}
                            alt={d.name}
                            className="h-10 w-10 shrink-0 rounded-xl object-cover border border-border/80 bg-muted/20 shadow-xs"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
                            {(d.name || 'D').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-foreground leading-snug truncate">{d.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">{d.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary">
                        {d.doctor_profile?.job_title || 'Bác sĩ da liễu'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-xs text-muted-foreground leading-5 line-clamp-2">
                        {d.doctor_profile?.specialization || 'Da liễu thẩm mỹ & Trị mụn'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="relative group inline-flex">
                          <button
                            type="button"
                            onClick={() => onEdit(d)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/60 active:scale-95 text-muted-foreground hover:text-foreground"
                            aria-label="Sửa hồ sơ"
                          >
                            <img src={EDIT_ICON} alt="Sửa" className="h-5 w-5 object-contain" />
                          </button>
                          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                            Sửa hồ sơ
                          </span>
                        </div>

                        <div className="relative group inline-flex">
                          <button
                            type="button"
                            onClick={() => onDelete(d.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/60 active:scale-95 text-muted-foreground hover:text-rose-600"
                            aria-label="Xóa hồ sơ"
                          >
                            <img src={DELETE_ICON} alt="Xóa" className="h-5 w-5 object-contain" />
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
        </>
      )}
    </div>
  );
};

// --- TAB: ALL ACCOUNTS & ROLES ---
const AllAccountsTab: React.FC<{
  patients: PatientProfile[];
  onUpdatePatient: (p: Partial<PatientProfile> & { id: string }, f: File | null) => void;
  onView: (patient: PatientProfile) => void;
}> = ({ patients, onUpdatePatient, onView }) => {
  const getRoleBadge = (role: PatientProfile['role']) => {
    switch (role) {
      case 'master_admin':
      case 'admin':
        return (
          <span className="inline-flex items-center rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10.5px] font-bold text-violet-700 dark:text-violet-400">
            {role === 'master_admin' ? 'Master Admin' : 'Admin'}
          </span>
        );
      case 'accountant':
        return (
          <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
            Kế toán VAT
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">
            Bác sĩ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            Khách hàng
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
      {/* Top Header / Info Bar */}
      <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-foreground">
            Danh sách Tài khoản & Phân quyền
          </span>
          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
            {patients.length} tài khoản
          </span>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30 border border-border/50">
            <img src={USER_ICON} alt="" className="h-6 w-6 object-contain opacity-60" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">Không tìm thấy tài khoản nào phù hợp</p>
          <p className="mt-1 text-xs text-muted-foreground">Thử tìm kiếm với từ khóa hoặc bộ lọc vai trò khác.</p>
        </div>
      ) : (
        <>
          {/* Mobile List: Compact Rows (< 1024px) */}
          <AdminMobileList className="p-0 divide-y divide-border/25">
            {patients.map((p) => (
              <AdminMobileCard key={p.id} className="px-3 py-2.5 sm:p-3.5 transition-colors hover:bg-muted/20">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  {/* Avatar / Icon */}
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-bold text-sm shadow-xs">
                      {(p.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground leading-snug">
                        {p.name || 'Người dùng'}
                      </p>
                      {getRoleBadge(p.role)}
                    </div>

                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                      {p.email}
                    </p>

                    {/* Bottom row: Quick Role Select & View Detail button */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-1.5 border-t border-border/25">
                      <select
                        value={p.role}
                        onChange={(e) =>
                          onUpdatePatient(
                            { id: p.id, role: e.target.value as PatientProfile['role'] },
                            null
                          )
                        }
                        className="h-7.5 rounded-xl border border-border/70 bg-background/50 px-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50 max-w-[155px] cursor-pointer"
                      >
                        <option value="customer">Customer</option>
                        <option value="doctor">Doctor</option>
                        <option value="accountant">Accountant</option>
                        <option value="admin">Admin</option>
                        <option value="master_admin">Master Admin</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => onView(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                      >
                        <span>Hồ sơ</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </AdminMobileCard>
            ))}
          </AdminMobileList>

          {/* Desktop Table View (>= 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="w-[30%] px-4 py-3 font-semibold">Họ và tên</th>
                  <th className="w-[30%] px-4 py-3 font-semibold">Email xác minh</th>
                  <th className="w-[24%] px-4 py-3 font-semibold">Phân quyền (Role)</th>
                  <th className="w-[16%] px-4 py-3 font-semibold text-right">Hồ sơ D1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id} className="align-middle transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3.5 font-bold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
                          {(p.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{p.name || 'Người dùng'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs truncate">
                      {p.email}
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        value={p.role}
                        onChange={(e) =>
                          onUpdatePatient(
                            { id: p.id, role: e.target.value as PatientProfile['role'] },
                            null
                          )
                        }
                        className="h-8 rounded-xl border border-border/70 bg-background/50 px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer transition-all hover:bg-background"
                      >
                        <option value="customer">Customer (Khách hàng)</option>
                        <option value="doctor">Doctor (Bác sĩ)</option>
                        <option value="accountant">Accountant (Kế toán)</option>
                        <option value="admin">Admin (Quản trị)</option>
                        <option value="master_admin">Master Admin (Toàn quyền)</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onView(p)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 shadow-2xs"
                      >
                        <span>Xem hồ sơ</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// --- SUBPAGE: USER DETAIL (APPLE GLASS DRILL-DOWN) ---
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
      <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
        <div className="h-24 animate-pulse rounded-2xl border border-white/60 bg-card/40 backdrop-blur-xl mx-1 sm:mx-0" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mx-1 sm:mx-0">
          <div className="h-64 animate-pulse rounded-2xl border border-white/60 bg-card/40 backdrop-blur-xl" />
          <div className="h-64 animate-pulse rounded-2xl border border-white/60 bg-card/40 backdrop-blur-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl sm:rounded-[1.75rem] border border-destructive/30 bg-card/85 backdrop-blur-2xl p-6 sm:p-8 text-center shadow-lg mx-1 sm:mx-0 -mx-3 sm:mx-0">
        <p className="font-bold text-destructive text-base sm:text-lg">Không thể tải hồ sơ người dùng</p>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onRetry} className={primaryButton}>
            Thử lại
          </button>
          <button type="button" onClick={onBack} className={secondaryButton}>
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

  const roleLabel =
    user.role === 'accountant'
      ? 'Kế toán VAT'
      : user.role === 'admin' || user.role === 'master_admin'
      ? 'Quản trị viên'
      : user.role === 'doctor'
      ? 'Bác sĩ chuyên khoa'
      : 'Khách hàng';

  const totalSpent = detail.orders.reduce(
    (sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0),
    0
  );
  const completedOrders = detail.orders.filter(
    (o) => o.status === 'completed' || o.status === 'shipped'
  );
  const completedSpent = completedOrders.reduce(
    (sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0),
    0
  );
  const pendingOrders = detail.orders.filter(
    (o) => o.status === 'pending' || o.status === 'processing'
  );
  const pendingSpent = pendingOrders.reduce(
    (sum, o) => sum + Number(o.grand_total ?? o.total_price ?? 0),
    0
  );

  const completedAppointments = detail.appointments.filter((a: any) => a.status === 'completed');
  const pendingAppointments = detail.appointments.filter(
    (a: any) => a.status !== 'completed' && a.status !== 'cancelled'
  );

  return (
    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
      {/* Top Banner Card */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5 mx-1 sm:mx-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              HỒ SƠ KHÁCH HÀNG D1
            </p>
            <h1 className="mt-1 text-lg sm:text-2xl font-bold text-foreground">{user.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.email} • <span className="font-semibold text-foreground">{roleLabel}</span> • ID:{' '}
              <span className="font-mono">{user.id.slice(0, 8)}</span>
            </p>
          </div>
          <button type="button" onClick={onBack} className={secondaryButton}>
            ← Về danh sách
          </button>
        </div>
      </div>

      {/* 4 Modules Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mx-1 sm:mx-0">
        {/* Module 1: Đơn hàng & Doanh số */}
        <section className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                DOANH SỐ MUA HÀNG
              </p>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Đơn hàng và chi tiêu</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {detail.orders.length} đơn
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Hoàn tất</span>
                <strong className="text-foreground font-bold">
                  {new Intl.NumberFormat('vi-VN').format(completedSpent)} đ
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{
                    width:
                      totalSpent > 0 ? `${Math.max(5, (completedSpent / totalSpent) * 100)}%` : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Đang xử lý / Chờ giao</span>
                <strong className="text-foreground font-bold">
                  {new Intl.NumberFormat('vi-VN').format(pendingSpent)} đ
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                  style={{
                    width:
                      totalSpent > 0 ? `${Math.max(5, (pendingSpent / totalSpent) * 100)}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Tổng chi tiêu ghi nhận</span>
            <strong className="text-base text-primary font-black">
              {new Intl.NumberFormat('vi-VN').format(totalSpent)} đ
            </strong>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Đơn hàng gần đây
            </p>
            {detail.orders.length ? (
              detail.orders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 backdrop-blur-xl p-2.5 text-xs shadow-2xs"
                >
                  <div>
                    <p className="font-bold text-foreground">
                      #{order.order_code || order.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(order.created_at)} •{' '}
                      <span className="capitalize font-medium">{order.status}</span>
                    </p>
                  </div>
                  <strong className="text-primary font-bold">
                    {new Intl.NumberFormat('vi-VN').format(
                      order.grand_total ?? order.total_price ?? 0
                    )}{' '}
                    đ
                  </strong>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-2">Chưa có đơn hàng nào.</p>
            )}
          </div>
        </section>

        {/* Module 2: Lịch hẹn & Dịch vụ */}
        <section className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                DỊCH VỤ CLINIC
              </p>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Lịch hẹn và điều trị</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {detail.appointments.length} lượt
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Đã hoàn tất</span>
                <strong className="text-foreground font-bold">
                  {completedAppointments.length} lịch
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                  style={{
                    width:
                      detail.appointments.length > 0
                        ? `${Math.max(
                            5,
                            (completedAppointments.length / detail.appointments.length) * 100
                          )}%`
                        : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Chờ khám / Đang đặt</span>
                <strong className="text-foreground font-bold">
                  {pendingAppointments.length} lịch
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
                  style={{
                    width:
                      detail.appointments.length > 0
                        ? `${Math.max(
                            5,
                            (pendingAppointments.length / detail.appointments.length) * 100
                          )}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Lịch khám gần đây
            </p>
            {detail.appointments.length ? (
              detail.appointments.slice(0, 4).map((appointment: any) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 backdrop-blur-xl p-2.5 text-xs shadow-2xs"
                >
                  <div>
                    <p className="font-bold text-foreground">
                      {appointment.service_name || 'Dịch vụ da liễu'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {appointment.appointment_date || appointment.date || 'Chưa có ngày'}{' '}
                      {appointment.appointment_time || appointment.time || ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground capitalize">
                    {appointment.status || 'pending'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-2">Chưa có lịch hẹn nào.</p>
            )}
          </div>
        </section>

        {/* Module 3: Hồ sơ điều trị & Bệnh án */}
        <section className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                HỒ SƠ ĐIỀU TRỊ
              </p>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Bệnh án & Ghi chú y tế</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {detail.medicalRecords.length} hồ sơ
            </span>
          </div>

          <div className="space-y-2">
            {detail.medicalRecords.length ? (
              detail.medicalRecords.slice(0, 5).map((record: any) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-xl p-2.5 text-xs shadow-2xs"
                >
                  <p className="font-bold text-foreground">
                    {record.summary || record.clinical_notes || 'Hồ sơ khám da'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDate(record.created_at || record.encounter_date)} • Ghi chép lâm sàng
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Chưa có hồ sơ bệnh án nào được ghi nhận.
              </p>
            )}
          </div>
        </section>

        {/* Module 4: Tài liệu private R2 */}
        <section className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                LƯU TRỮ RIÊNG TƯ
              </p>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Tài liệu & Kết quả riêng tư
              </h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {detail.documents.length} tệp
            </span>
          </div>

          <div className="space-y-2">
            {detail.documents.length ? (
              detail.documents.slice(0, 5).map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 backdrop-blur-xl p-2.5 text-xs shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">
                      {doc.file_name || doc.object_key || 'Tài liệu'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(doc.created_at)} • Mã hóa R2
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                    Private R2
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Chưa có tài liệu private nào trên R2.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminUserManagementPage;
