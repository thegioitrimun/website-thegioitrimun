import { useMediaQuery } from '../../hooks/useMediaQuery';
import React from 'react';
import AdminSurface from './AdminSurface';

export interface AdminMobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
}

export const AdminMobileCard: React.FC<AdminMobileCardProps> = ({
  children,
  selected = false,
  className = '',
  onClick,
  ...props
}) => {
  return (
    <AdminSurface
      variant="content"
      onClick={onClick}
      className={`p-3.5 sm:p-4 transition-all duration-150 relative ${
        selected ? 'ring-2 ring-primary/60 bg-primary/5' : ''
      } ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}
      {...props}
    >
      {children}
    </AdminSurface>
  );
};

export interface AdminMobileListProps<T = any, K extends string | number = string | number> {
  /** Danh sách dữ liệu hiển thị dạng card trên mobile */
  data?: T[];
  /** Hàm trích xuất key duy nhất của từng phần tử */
  rowKey?: (item: T, index: number) => K;
  /** Hàm render từng card mobile */
  renderCard?: (item: T, isSelected: boolean, index: number) => React.ReactNode;
  /** Danh sách key đang được chọn */
  selectedKeys?: K[];
  /** Trạng thái đang tải dữ liệu */
  isLoading?: boolean;
  /** Số card skeleton hiển thị khi tải */
  skeletonCardCount?: number;
  /** Thông báo khi không có dữ liệu */
  emptyMessage?: string;
  /** CTA khi không có dữ liệu */
  emptyCta?: React.ReactNode;
  /** Hoặc truyền trực tiếp children */
  children?: React.ReactNode;
  /** Class tùy biến container */
  className?: string;
}

export function AdminMobileList<T = any, K extends string | number = string | number>({
  data = [],
  rowKey = ((_, i) => i) as any,
  renderCard = () => null,
  selectedKeys,
  isLoading = false,
  skeletonCardCount = 4,
  emptyMessage = 'Không có dữ liệu phù hợp.',
  emptyCta,
  children,
  className = '',
}: AdminMobileListProps<T, K>) {
  const mobile = useMediaQuery('(max-width:1023px)');
  if (!mobile) return null;
  if (children) {
    return <div className={`space-y-3 ${className}`}>{children}</div>;
  }
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: skeletonCardCount }).map((_, idx) => (
          <AdminSurface
            key={`sk-card-${idx}`}
            variant="content"
            className="p-4 animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-muted/60" />
              <div className="h-5 w-16 rounded-full bg-muted/60" />
            </div>
            <div className="h-3 w-40 rounded bg-muted/60" />
            <div className="h-3 w-3/4 rounded bg-muted/60" />
            <div className="flex justify-between pt-2 border-t border-border/40">
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 w-24 rounded bg-muted/60" />
            </div>
          </AdminSurface>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <AdminSurface variant="content" className={`p-8 text-center ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {emptyMessage}
          </p>
          {emptyCta}
        </div>
      </AdminSurface>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item, idx) => {
        const key = rowKey(item, idx);
        const isSelected = selectedKeys?.includes(key) || false;
        return (
          <div key={String(key)}>
            {renderCard(item, isSelected, idx)}
          </div>
        );
      })}
    </div>
  );
}

export default AdminMobileList;
