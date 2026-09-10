import React, { useEffect, useRef } from 'react';
import AdminSurface from './AdminSurface';
import { ADMIN_THEME_TOKENS } from '../../src/admin/adminThemeTokens';

export interface AdminTableColumn<T> {
  key?: string;
  id?: string;
  title?: React.ReactNode;
  label?: React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  render?: (item: T, index: number) => React.ReactNode;
}

export type AdminColumn<T> = AdminTableColumn<T>;

export interface AdminDataTableProps<T, K extends string | number = string | number> {
  /** Danh sách dữ liệu bảng */
  data: T[];
  /** Hàm trích xuất key duy nhất của từng dòng (ID ổn định) */
  rowKey: (item: T, index: number) => K;
  /** Định nghĩa các cột */
  columns: AdminTableColumn<T>[];
  /** Danh sách key đang được chọn */
  selectedKeys?: K[];
  /** Callback khi chọn/bỏ chọn một dòng */
  onSelectKey?: (key: K, selected: boolean) => void;
  /** Callback khi chọn/bỏ chọn tất cả dòng trên trang hiện tại */
  onSelectAll?: (selected: boolean) => void;
  /** Alias callback khi toggle chọn dòng */
  onToggleSelect?: (id: any) => void;
  /** Alias callback khi toggle chọn tất cả */
  onToggleSelectAll?: (select: any) => void;
  /** Alias trạng thái tất cả đang chọn */
  isAllSelected?: boolean;
  /** Alias trạng thái một phần đang chọn */
  isSomeSelected?: boolean;
  /** Trạng thái đang tải dữ liệu */
  isLoading?: boolean;
  /** Số dòng skeleton hiển thị khi tải */
  skeletonRowCount?: number;
  /** Thông báo khi không có dữ liệu */
  emptyMessage?: string;
  /** Nút hoặc hành động gợi ý khi bảng rỗng (CTA) */
  emptyCta?: React.ReactNode;
  /** Callback khi click vào dòng */
  onRowClick?: (item: T) => void;
  /** Class tùy biến cho table container */
  className?: string;
}

export function AdminDataTable<T, K extends string | number = string | number>({
  data,
  rowKey,
  columns,
  selectedKeys,
  onSelectKey,
  onSelectAll,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isSomeSelected,
  isLoading = false,
  skeletonRowCount = 5,
  emptyMessage = 'Không có dữ liệu phù hợp',
  emptyCta,
  onRowClick,
  className = '',
}: AdminDataTableProps<T, K>) {
  const effectiveOnSelectKey = onSelectKey || (onToggleSelect ? (key: K, _sel: boolean) => onToggleSelect(key) : undefined);
  const effectiveOnSelectAll = onSelectAll || (onToggleSelectAll ? (sel: boolean) => onToggleSelectAll(sel) : undefined);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const hasSelection = Boolean(effectiveOnSelectKey || effectiveOnSelectAll);
  const currentKeys = data.map((item, idx) => rowKey(item, idx));
  const computedAllSelected =
    isAllSelected !== undefined
      ? isAllSelected
      : currentKeys.length > 0 && currentKeys.every((key) => selectedKeys?.includes(key));
  const computedSomeSelected =
    isSomeSelected !== undefined
      ? isSomeSelected
      : !computedAllSelected && currentKeys.some((key) => selectedKeys?.includes(key));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = computedSomeSelected;
    }
  }, [computedSomeSelected]);

  return (
    <AdminSurface
      variant="table"
      className={`overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          {/* Header Bảng */}
          <thead>
            <tr className={ADMIN_THEME_TOKENS.surface.tableHead}>
              {hasSelection && (
                <th className="w-11 px-3.5 py-3 text-center align-middle">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={computedAllSelected}
                    onChange={(e) => effectiveOnSelectAll?.(e.target.checked)}
                    aria-label="Chọn tất cả mục trên trang"
                    className="h-4 w-4 rounded border-border/80 text-primary accent-primary focus:ring-primary/25 cursor-pointer"
                  />
                </th>
              )}

              {columns.map((col, colIndex) => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';

                return (
                  <th
                    key={col.key || col.id || String(colIndex)}
                    aria-sort={col.sortable ? (col.sortDirection === 'asc' ? 'ascending' : col.sortDirection === 'desc' ? 'descending' : 'none') : undefined}
                    style={col.width ? { width: col.width } : undefined}
                    className={`px-3.5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground ${alignClass} ${col.headerClassName || ''}`}
                  >
                    {col.sortable && col.onSort ? <button type="button" onClick={col.onSort} className="inline-flex items-center gap-1 text-inherit">{col.title ?? col.label}<span aria-hidden="true">{col.sortDirection === 'asc' ? '↑' : col.sortDirection === 'desc' ? '↓' : '↕'}</span></button> : (col.title ?? col.label)}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Nội dung Bảng */}
          <tbody className="divide-y divide-border/40 font-medium">
            {isLoading && data.length === 0 ? (
              // Skeleton loading states (Zero layout shift)
              Array.from({ length: skeletonRowCount }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {hasSelection && (
                    <td className="px-3.5 py-4 text-center">
                      <div className="h-4 w-4 rounded bg-muted/60 mx-auto" />
                    </td>
                  )}
                  {columns.map((col, colIdx) => (
                    <td key={`sk-col-${col.key || col.id || colIdx}`} className="px-3.5 py-4">
                      <div className="h-4 rounded bg-muted/60 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length + (hasSelection ? 1 : 0)}
                  className="px-6 py-12 text-center"
                >
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
                </td>
              </tr>
            ) : (
              // Real data rows
              data.map((item, idx) => {
                const key = rowKey(item, idx);
                const isSelected = Boolean(selectedKeys?.includes(key));

                return (
                  <tr
                    key={String(key)}
                    onClick={() => onRowClick?.(item)}
                    className={`group transition-colors duration-120 ${
                      isSelected
                        ? 'bg-primary/8 dark:bg-primary/15'
                        : 'hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]'
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {hasSelection && (
                      <td
                        className="w-11 px-3.5 py-3.5 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => effectiveOnSelectKey?.(key, e.target.checked)}
                          aria-label={`Chọn mục ${String(key)}`}
                          className="h-4 w-4 rounded border-border/80 text-primary accent-primary focus:ring-primary/25 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col, colIdx) => {
                      const alignClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';

                      return (
                        <td
                          key={col.key || col.id || String(colIdx)}
                          className={`px-3.5 py-3.5 align-middle text-foreground ${alignClass} ${col.className || ''}`}
                        >
                          {col.render
                            ? col.render(item, idx)
                            : (item as any)[col.key || col.id || '']}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );
}

export default AdminDataTable;
