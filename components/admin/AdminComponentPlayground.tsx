import React, { useState } from 'react';
import AdminSurface from './AdminSurface';
import AdminButton from './AdminButton';
import AdminIconButton from './AdminIconButton';
import AdminInput from './AdminInput';
import AdminField from './AdminField';
import AdminStatusBadge from './AdminStatusBadge';
import { ADMIN_THEME_TOKENS, type AdminStatusTone } from '../../src/admin/adminThemeTokens';

export const AdminComponentPlayground: React.FC = () => {
  const [inputValue, setInputValue] = useState('Đơn hàng #DH-2026-0909');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="admin-theme-root space-y-8 p-4 md:p-8 max-w-6xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Admin Component Playground (Đợt 1 Baseline)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kiểm tra toàn bộ token, bề mặt kính, nút bấm, ô nhập và huy hiệu trạng thái.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AdminButton
            size="sm"
            variant={isLoading ? 'primary' : 'secondary'}
            onClick={() => setIsLoading(!isLoading)}
          >
            {isLoading ? 'Đang bật Loading' : 'Bật Loading'}
          </AdminButton>
          <AdminButton
            size="sm"
            variant={hasError ? 'destructive' : 'secondary'}
            onClick={() => setHasError(!hasError)}
          >
            {hasError ? 'Đang bật Error' : 'Bật Error'}
          </AdminButton>
        </div>
      </div>

      {/* 1. Surfaces */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. AdminSurface (Bề mặt kính Apple Glass)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminSurface variant="toolbar" className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Toolbar Surface</span>
            <p className="text-sm text-foreground mt-1">Bề mặt kính độ đục 75% cho thanh công cụ và bộ lọc.</p>
          </AdminSurface>

          <AdminSurface variant="content" className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Content Card Surface</span>
            <p className="text-sm text-foreground mt-1">Bề mặt kính độ đục 85% cho khung nội dung và form.</p>
          </AdminSurface>

          <AdminSurface variant="table" className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Table Surface</span>
            <p className="text-sm text-foreground mt-1">Bề mặt bán trong suốt 80% tối ưu cho bảng dữ liệu danh sách dài.</p>
          </AdminSurface>

          <AdminSurface variant="overlay" className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Overlay Surface</span>
            <p className="text-sm text-foreground mt-1">Bề mặt đục 98% cho popover, dropdown và modal dialog.</p>
          </AdminSurface>
        </div>
      </section>

      {/* 2. Buttons */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">2. AdminButton & AdminIconButton</h2>
        <AdminSurface variant="content" className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminButton variant="primary" loading={isLoading}>
              Nút Primary
            </AdminButton>
            <AdminButton variant="secondary" loading={isLoading}>
              Nút Secondary
            </AdminButton>
            <AdminButton variant="ghost" loading={isLoading}>
              Nút Ghost
            </AdminButton>
            <AdminButton variant="destructive" loading={isLoading}>
              Nút Destructive
            </AdminButton>
            <AdminButton variant="primary" disabled>
              Vô hiệu hóa
            </AdminButton>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Icon Buttons:</span>
            <AdminIconButton aria-label="Tìm kiếm" variant="secondary" loading={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </AdminIconButton>
            <AdminIconButton aria-label="Thêm mới" variant="primary" loading={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </AdminIconButton>
            <AdminIconButton aria-label="Xóa" variant="destructive" loading={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </AdminIconButton>
            <AdminIconButton aria-label="Menu" variant="ghost" loading={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </AdminIconButton>
          </div>
        </AdminSurface>
      </section>

      {/* 3. Inputs & Fields */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">3. AdminInput & AdminField</h2>
        <AdminSurface variant="content" className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <AdminField
            label="Tìm kiếm mã đơn hoặc khách hàng"
            required
            description="Hỗ trợ mã đơn, số điện thoại hoặc họ tên khách hàng."
            error={hasError ? 'Không tìm thấy đơn hàng phù hợp với từ khóa.' : undefined}
          >
            <AdminInput
              value={inputValue}
              onValueChange={setInputValue}
              clearable
              leadingIcon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              placeholder="Nhập thông tin tìm kiếm..."
            />
          </AdminField>

          <AdminField label="Trạng thái đơn hàng (Readonly)" description="Trường hiển thị mẫu ở trạng thái vô hiệu hóa.">
            <AdminInput value="Đã thanh toán (Chờ giao hàng)" disabled />
          </AdminField>
        </AdminSurface>
      </section>

      {/* 4. Status Badges */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">4. AdminStatusBadge (Semantic Status Tones)</h2>
        <AdminSurface variant="content" className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(ADMIN_THEME_TOKENS.statusTones) as AdminStatusTone[]).map((tone) => (
              <AdminStatusBadge
                key={tone}
                tone={tone}
                label={`${tone.toUpperCase()} - Trạng thái mẫu`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Dense Table Size (sm):</span>
            <AdminStatusBadge size="sm" tone="emerald" label="Đã hoàn thành" />
            <AdminStatusBadge size="sm" tone="sky" label="Online" />
            <AdminStatusBadge size="sm" tone="violet" label="POS" />
            <AdminStatusBadge size="sm" tone="amber" label="Chờ xử lý" />
            <AdminStatusBadge size="sm" tone="rose" label="Đã hủy" />
            <AdminStatusBadge size="sm" tone="slate" label="Chưa có mã" />
          </div>
        </AdminSurface>
      </section>
    </div>
  );
};

export default AdminComponentPlayground;
