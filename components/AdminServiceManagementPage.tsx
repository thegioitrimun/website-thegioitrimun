import React, { useMemo, useState, useEffect } from 'react';
import type { AdminNavigationView, Service } from '../types';
import { PlusCircleIcon, SearchIcon, XCircleIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import ServiceEditorForm from './ServiceEditorForm';
import { useTranslation } from 'react-i18next';

interface AdminServiceManagementPageProps {
  services: Service[];
  onSaveService: (service: Partial<Service>, imageFile: File | null) => Promise<void> | void;
  onDeleteService: (id: number) => void;
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
}

// System Icons
const SERVICE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786757644973-Untitled-20.webp';
const EDIT_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp';
const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';

const money = (value: unknown) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const AdminServiceManagementPage: React.FC<AdminServiceManagementPageProps> = ({
  services,
  onSaveService,
  onDeleteService,
  onNavigate,
  onBack,
}) => {
  const { t } = useTranslation();
  const setSidebarConfig = useAdminLayoutDispatch();
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.trim().toLowerCase();
    return services.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.slug?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

  const handleEdit = (service: Service) => {
    setSelectedService(service);
    setView('edit');
  };

  const handleAddNew = () => {
    setSelectedService(null);
    setView('edit');
  };

  const handleCancel = () => {
    setView('list');
    setSelectedService(null);
  };

  const handleSave = async (service: Partial<Service>, imageFile: File | null) => {
    await onSaveService(service, imageFile);
    setView('list');
    setSelectedService(null);
  };

  useEffect(() => {
    setSidebarConfig({
      eyebrow: 'CLINIC SERVICES',
      title: 'Quản lý Dịch vụ',
      description: 'Danh mục dịch vụ khám, liệu trình điều trị và thủ thuật da liễu tại phòng khám.',
      icon: (
        <img
          src={SERVICE_ICON}
          alt="Dịch vụ"
          className="h-8 w-8 object-contain"
        />
      ),
      insights: [
        {
          label: 'Tổng dịch vụ',
          value: String(services.length),
          hint: 'Gói khám và điều trị đang mở',
        },
        {
          label: 'Màn hiện tại',
          value: view === 'edit' ? (selectedService ? 'Đang sửa' : 'Tạo mới') : 'Danh sách',
          hint: 'Shell đồng bộ toàn hệ thống',
        },
      ],
      hideHeader: view === 'edit',
    });
  }, [setSidebarConfig, services.length, view, selectedService]);

  if (view === 'edit') {
    return (
      <ServiceEditorForm
        service={selectedService}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0">
      {/* Unified Filter & Action Card (Apple Glass Standard) */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        {/* Row 1: Preset Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-xs transition-all active:scale-95"
          >
            <span>Tất cả dịch vụ</span>
            <span className="rounded-full px-1.5 py-0.2 text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
              {services.length}
            </span>
          </button>
        </div>

        {/* Row 2: Search + Add Service Button */}
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên dịch vụ, mô tả, slug..."
              className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
            <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
              >
                <XCircleIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 shrink-0"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Thêm dịch vụ mới</span>
            <span className="sm:hidden">Thêm</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 overflow-hidden">
        {filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 p-8 text-center text-xs sm:text-sm text-muted-foreground">
            Không tìm thấy dịch vụ nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-border/50 bg-background/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5">Hình ảnh</th>
                  <th className="px-3.5 py-2.5">Dịch vụ</th>
                  <th className="px-3.5 py-2.5">Giá niêm yết</th>
                  <th className="px-3.5 py-2.5">Mô tả ngắn</th>
                  <th className="px-3.5 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredServices.map((service) => (
                  <tr key={service.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <img
                        src={service.image_url || 'https://placehold.co/96x96'}
                        alt={service.name}
                        className="h-12 w-12 rounded-xl object-cover border border-white/50 dark:border-white/10 shadow-2xs"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <p className="font-bold text-foreground leading-snug">{service.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        /{service.slug || `service-${service.id}`}
                      </p>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span className="font-bold text-primary">
                        {service.price ? money(service.price) : 'Liên hệ'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 max-w-md">
                      <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {service.description || 'Chưa có mô tả ngắn.'}
                      </p>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(service)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs transition-all hover:bg-muted/50 active:scale-95"
                          title="Chỉnh sửa dịch vụ"
                        >
                          <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteService(service.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive shadow-2xs transition-all hover:bg-destructive/20 active:scale-95"
                          title="Xóa dịch vụ"
                        >
                          <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Glass Card View */}
      <div className="md:hidden space-y-2.5 mx-1 sm:mx-0">
        {filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Không tìm thấy dịch vụ nào phù hợp.
          </div>
        ) : (
          filteredServices.map((service) => (
            <div
              key={service.id}
              className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 shadow-2xs space-y-2.5"
            >
              <div className="flex items-start gap-3">
                <img
                  src={service.image_url || 'https://placehold.co/96x96'}
                  alt={service.name}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover border border-white/50 dark:border-white/10 shadow-2xs"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground">
                    {service.name}
                  </p>
                  <p className="mt-1 font-bold text-xs text-primary">
                    {service.price ? money(service.price) : 'Liên hệ'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                    {service.description || 'Chưa có mô tả.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                <button
                  type="button"
                  onClick={() => handleEdit(service)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-bold text-foreground active:scale-95"
                >
                  <img src={EDIT_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                  <span>Sửa</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteService(service.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive active:scale-95"
                >
                  <img src={DELETE_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminServiceManagementPage;
