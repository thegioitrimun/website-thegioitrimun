

import React, { useState, useEffect } from 'react';
import type { AdminNavigationView, Service } from '../types';
import { ServiceListIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import ServiceEditorForm from './ServiceEditorForm';
import { AdminMobileCard, AdminMobileList } from './AdminResponsivePrimitives';
import * as api from '../services/api';
import { useTranslation } from 'react-i18next';


interface AdminServiceManagementPageProps {
  services: Service[];
  onSaveService: (service: Partial<Service>, imageFile: File | null) => Promise<void> | void;
  onDeleteService: (id: number) => void;
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
}

const AdminServiceManagementPage: React.FC<AdminServiceManagementPageProps> = ({
  services, onSaveService, onDeleteService, onNavigate, onBack
}) => {
  const { t } = useTranslation();
  const setSidebarConfig = useAdminLayoutDispatch();
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const workspaceInsights = [
    { label: 'Dịch vụ', value: String(services.length), hint: 'Toàn bộ dịch vụ hiển thị trên website và booking flow' },
    { label: 'Màn hiện tại', value: view === 'edit' ? 'Đang sửa' : 'Danh sách', hint: 'Giữ cùng shell với sản phẩm, blog và site' },
    { label: 'Truy cập nhanh', value: '1 click', hint: 'Chuyển module bằng thanh điều hướng cố định bên trái' },
  ];

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
  }

  const handleSave = async (service: Partial<Service>, imageFile: File | null) => {
    await onSaveService(service, imageFile);
    setView('list');
    setSelectedService(null);
  };

  const renderContent = () => {
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
      <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="hidden md:block text-xl font-bold">{t('admin.services_list')} ({services.length})</h3>
          <button onClick={handleAddNew} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:py-2">
            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themdichvu.webp" alt="Thêm" className="h-5 w-5 object-contain" />
            <span>{t('admin.add_service')}</span>
          </button>
        </div>
        <AdminMobileList>
          {services.map(service => (
            <AdminMobileCard key={service.id}>
              <div className="flex gap-3">
                <img
                  src={service.image_url || 'https://placehold.co/96x96'}
                  alt={service.name}
                  className="h-20 w-20 shrink-0 rounded-2xl border border-border bg-background object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-base font-black leading-6 text-foreground">{service.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(service)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
                >
                  <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="h-4 w-4 object-contain inline-block" />
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteService(service.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/35 hover:text-destructive"
                >
                  <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="h-4 w-4 object-contain inline-block" />
                  Xóa
                </button>
              </div>
            </AdminMobileCard>
          ))}
        </AdminMobileList>
        <div className="hidden overflow-hidden rounded-[1.25rem] lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{t('admin.table_image')}</th>
                  <th className="px-4 py-3">{t('admin.table_service_name')}</th>
                  <th className="px-4 py-3">{t('admin.table_short_desc')}</th>
                  <th className="px-4 py-3 text-right">{t('admin.table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <img src={service.image_url || 'https://placehold.co/80x80'} alt={service.name} className="w-16 h-16 object-cover rounded-md" />
                    </td>
                    <td className="px-4 py-3 font-medium">{service.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{service.description}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative group inline-flex">
                          <button
                            type="button"
                            onClick={() => handleEdit(service)}
                            aria-label={`Chỉnh sửa dịch vụ ${service.name}`}
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
                            onClick={() => onDeleteService(service.id)}
                            aria-label={`Xóa dịch vụ ${service.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-destructive"
                          >
                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="w-5 h-5 object-contain" />
                          </button>
                          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                            Xóa dịch vụ
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
      </>
    );
  };

  useEffect(() => {
    setSidebarConfig({
      title: t('admin.service_management_title'),
      description: t('admin.service_management_desc'),
      icon: <ServiceListIcon className="w-8 h-8" />,
      eyebrow: "Clinic services",
      insights: workspaceInsights,
      actions: (
        <div className="flex flex-wrap justify-end gap-2">
          {view === 'edit' ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Về danh sách
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>{t('admin.add_service')}</span>
          </button>
        </div>
      ),
      hideHeader: true,
    });
  }, [setSidebarConfig, t, workspaceInsights, view]);

  return (
    <AnimatedSection stagger={100}>
        {renderContent()}
    </AnimatedSection>
  );
};

export default AdminServiceManagementPage;
