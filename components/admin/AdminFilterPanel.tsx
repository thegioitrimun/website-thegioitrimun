import React from 'react';
import AdminSurface from './AdminSurface';
import AdminButton from './AdminButton';

export interface AdminFilterPanelProps {
  /** Bộ lọc có đang mở hay không (nếu undefined sẽ tự hiển thị responsive) */
  isOpen?: boolean;
  /** Callback khi xóa tất cả bộ lọc */
  onReset?: () => void;
  /** Số lượng bộ lọc đang áp dụng */
  activeCount?: number;
  /** Alias số lượng bộ lọc đang áp dụng */
  activeFilterCount?: number;
  /** Chuỗi tóm tắt bộ lọc tùy chọn */
  summaryText?: string;
  /** Số kết quả sau khi lọc */
  resultCount?: number;
  /** Tên định danh đối tượng lọc (mặc định: 'kết quả') */
  resultLabel?: string;
  /** Các phần tử bộ lọc con (Form fields, selects, date pickers) */
  children: React.ReactNode;
  /** Tùy biến class container */
  className?: string;
}

export const AdminFilterPanel: React.FC<AdminFilterPanelProps> = ({
  isOpen = true,
  onReset,
  activeCount = 0,
  activeFilterCount,
  summaryText,
  resultCount,
  resultLabel = 'kết quả',
  children,
  className = '',
}) => {
  const effectiveActiveCount = activeFilterCount ?? activeCount;

  if (!isOpen) return null;

  return (
    <AdminSurface
      variant="content"
      className={`p-3.5 sm:p-4 space-y-3 transition-all duration-160 ${className}`}
    >
      {/* Thanh tóm tắt và nút xóa lọc */}
      {(resultCount !== undefined || effectiveActiveCount > 0 || summaryText) && (
        <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
          <div className="flex items-center gap-2">
            {summaryText && (
              <span className="font-semibold text-muted-foreground text-xs">
                {summaryText}
              </span>
            )}
            {!summaryText && resultCount !== undefined && (
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                {resultCount.toLocaleString('vi-VN')} {resultLabel}
              </span>
            )}
            {effectiveActiveCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {effectiveActiveCount} bộ lọc đang chọn
              </span>
            )}
          </div>

          {effectiveActiveCount > 0 && onReset && (
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-primary hover:text-primary/80 h-7 text-xs font-semibold px-2"
            >
              Xóa bộ lọc
            </AdminButton>
          )}
        </div>
      )}

      {/* Grid các trường lọc */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {children}
      </div>
    </AdminSurface>
  );
};

export default AdminFilterPanel;
