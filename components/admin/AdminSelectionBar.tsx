import React from 'react';
import AdminSurface from './AdminSurface';
import AdminButton from './AdminButton';

export interface AdminSelectionBarProps {
  /** Tổng số mục đang được chọn */
  selectedCount: number;
  /** Tổng số mục tổng thể (tùy chọn) */
  totalCount?: number;
  /** Tên đối tượng đang chọn (mặc định: 'mục') */
  itemLabel?: string;
  /** Callback khi bấm bỏ chọn tất cả */
  onClearSelection: () => void;
  /** Các nút hoặc form thao tác hàng loạt qua prop actions */
  actions?: React.ReactNode;
  /** Các nút hoặc form thao tác hàng loạt */
  children?: React.ReactNode;
  /** Class tùy biến */
  className?: string;
}

export const AdminSelectionBar: React.FC<AdminSelectionBarProps> = ({
  selectedCount,
  totalCount,
  itemLabel = 'mục',
  onClearSelection,
  actions,
  children,
  className = '',
}) => {
  const finalActions = actions || children;
  if (selectedCount <= 0) return null;

  return (
    <div
      className={`relative w-full ${className}`}
      role="region"
      aria-label="Thao tác hàng loạt trên các mục đã chọn"
    >
      <AdminSurface
        variant="overlay"
        className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl"
      >
        {/* Số lượng đang chọn và nút bỏ chọn */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground px-1.5">
              {selectedCount}
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              Đã chọn {selectedCount} {itemLabel}
            </span>
          </div>

          <AdminButton
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2"
          >
            Bỏ chọn
          </AdminButton>
        </div>

        {/* Các hành động hàng loạt (Actions slot) */}
        {finalActions && (
          <div className="flex flex-wrap items-center gap-2">
            {finalActions}
          </div>
        )}
      </AdminSurface>
    </div>
  );
};

export default AdminSelectionBar;
