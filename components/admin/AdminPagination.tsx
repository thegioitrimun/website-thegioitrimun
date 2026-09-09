import React from 'react';
import AdminButton from './AdminButton';

export interface AdminPaginationProps {
  /** Trang hiện tại (1-indexed) */
  currentPage: number;
  /** Tổng số mục dữ liệu */
  totalItems: number;
  /** Số mục trên mỗi trang (mặc định: 30) */
  pageSize?: number;
  /** Tổng số trang (tùy chọn) */
  totalPages?: number;
  /** Callback khi đổi trang */
  onPageChange: (page: number) => void;
  /** Nhãn tên đối tượng (mặc định: 'mục') */
  itemLabel?: string;
  /** Class tùy biến container */
  className?: string;
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 30,
  totalPages: explicitTotalPages,
  onPageChange,
  itemLabel = 'mục',
  className = '',
}) => {
  const totalPages = explicitTotalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));

  // Theo mục 5.6 (rule 454): danh sách dưới 30 bản ghi không cần hiện dãy số trang
  if (totalItems <= pageSize && totalPages <= 1) {
    return null;
  }

  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const to = Math.min(currentPage * pageSize, totalItems);

  // Sinh các số trang thông minh kèm dấu chấm lửng
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 text-xs sm:text-sm text-muted-foreground ${className}`}
      aria-label="Phân trang"
    >
      {/* Tóm tắt số lượng */}
      <div className="font-medium text-center sm:text-left">
        Hiển thị <span className="font-bold text-foreground">{from}</span>–
        <span className="font-bold text-foreground">{to}</span> trên tổng{' '}
        <span className="font-bold text-foreground">{totalItems.toLocaleString('vi-VN')}</span> {itemLabel}
      </div>

      {/* Dãy nút chuyển trang */}
      <div className="flex items-center gap-1">
        {/* Nút Trước */}
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Trang trước"
          className="h-8 px-2.5 font-semibold"
        >
          Trước
        </AdminButton>

        {/* Các số trang */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Trang ${p}`}
                className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-bold transition-all duration-120 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-foreground hover:bg-card/80 hover:text-primary active:scale-95'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Nút Sau */}
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Trang sau"
          className="h-8 px-2.5 font-semibold"
        >
          Sau
        </AdminButton>
      </div>
    </div>
  );
};

export default AdminPagination;
