import React from 'react';
import AdminSurface from './AdminSurface';
import AdminInput from './AdminInput';
import AdminButton from './AdminButton';

export interface AdminToolbarProps {
  /** Giá trị ô tìm kiếm */
  searchValue?: string;
  /** Callback thay đổi nội dung tìm kiếm (onValueChange contract) */
  onSearchChange?: (value: string) => void;
  /** Placeholder tìm kiếm */
  searchPlaceholder?: string;
  /** Phím tắt hoặc submit tìm kiếm */
  onSearchSubmit?: () => void;
  /** Bật/tắt nút toggle bộ lọc */
  showFilterToggle?: boolean;
  /** Trạng thái mở bộ lọc hiện tại */
  isFilterOpen?: boolean;
  /** Alias trạng thái mở bộ lọc */
  filterOpen?: boolean;
  /** Trạng thái có filter đang active */
  filterActive?: boolean;
  /** Callback bật/tắt bộ lọc */
  onToggleFilter?: () => void;
  /** Số lượng bộ lọc đang kích hoạt */
  activeFilterCount?: number;
  /** Alias số lượng filter */
  filterCount?: number;
  /** Nhãn nút bộ lọc */
  filterLabel?: string;
  /** Nút hành động chính (Primary Action, ví dụ "Tạo đơn") */
  primaryAction?: React.ReactNode;
  /** Các hành động phụ (Xuất Excel, Thao tác khác, v.v.) */
  secondaryActions?: React.ReactNode;
  /** Alias cho actions */
  actions?: React.ReactNode;
  /** Phần mở rộng tùy chọn */
  children?: React.ReactNode;
  /** Tùy biến class container */
  className?: string;
}

export const AdminToolbar: React.FC<AdminToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  onSearchSubmit,
  showFilterToggle = true,
  isFilterOpen = false,
  filterOpen,
  filterActive,
  onToggleFilter,
  activeFilterCount = 0,
  filterCount,
  filterLabel = 'Bộ lọc',
  primaryAction,
  secondaryActions,
  actions,
  children,
  className = '',
}) => {
  const effectiveFilterOpen = filterOpen ?? isFilterOpen;
  const effectiveFilterCount = filterCount ?? activeFilterCount;
  const effectiveSecondaryActions = actions || secondaryActions;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <AdminSurface
      variant="toolbar"
      className={`p-3 sm:p-4 transition-all ${className}`}
    >
      <div className="flex flex-col gap-2.5 sm:gap-3 md:flex-row md:items-center md:justify-between">
        {/* Vùng tìm kiếm & toggle bộ lọc */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px]">
              <AdminInput
                type="text"
                value={searchValue}
                onValueChange={onSearchChange}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                clearable
                leadingIcon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                }
                className="w-full"
                aria-label={searchPlaceholder}
              />
            </div>
          )}

          {showFilterToggle && onToggleFilter && (
            <AdminButton
              variant={effectiveFilterOpen || effectiveFilterCount > 0 || filterActive ? 'secondary' : 'ghost'}
              onClick={onToggleFilter}
              aria-expanded={effectiveFilterOpen}
              aria-label={`${filterLabel} ${effectiveFilterCount > 0 ? `(${effectiveFilterCount} đang áp dụng)` : ''}`}
              leftIcon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                  />
                </svg>
              }
              className="shrink-0 relative font-semibold"
            >
              <span className="hidden sm:inline">{filterLabel}</span>
              {effectiveFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground px-1.5 shadow-xs">
                  {effectiveFilterCount}
                </span>
              )}
            </AdminButton>
          )}

          {children}
        </div>

        {/* Vùng hành động (Actions) */}
        {(primaryAction || effectiveSecondaryActions) && (
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {effectiveSecondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </AdminSurface>
  );
};

export default AdminToolbar;
