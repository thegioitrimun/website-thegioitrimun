import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterIcon } from '../icons';
import type { SortOption } from './SortControl';

interface MobileFilterBarProps {
  activeFilterCount: number;
  sortValue: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;
  onOpenFilters: () => void;
}

const MobileFilterBar: React.FC<MobileFilterBarProps> = ({
  activeFilterCount,
  sortValue,
  sortOptions,
  onSortChange,
  onOpenFilters,
}) => {
  const { t } = useTranslation();

  // Shorten labels for mobile view
  const getShortLabel = (value: string, originalLabel: string) => {
    if (value === 'default') return t('products.sort_default_short', 'Phổ biến');
    if (value === 'newest') return t('products.sort_newest_short', 'Hàng mới');
    if (value === 'price-asc') return t('products.sort_price_asc_short', 'Giá tăng dần');
    if (value === 'price-desc') return t('products.sort_price_desc_short', 'Giá giảm dần');
    return originalLabel.replace('Sắp xếp: ', '');
  };

  return (
    <div className="relative z-10 -mx-3 my-1 py-2.5 md:hidden">
      <div className="flex items-center pl-3">
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto pr-4">
          <div className="flex w-max items-center gap-2">
            {sortOptions.map((option) => {
              const active = sortValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSortChange(option.value)}
                  className={`rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition ${
                    active
                      ? 'bg-[#eef8f6] text-[#2f855a] dark:bg-[#1b7a6d]/20 dark:text-[#35b7a5]'
                      : 'bg-[#f4f6f8] text-foreground hover:bg-[#e4ebef] dark:bg-card dark:hover:bg-accent'
                  }`}
                >
                  {getShortLabel(option.value, option.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 shrink-0 border-l border-border/80 bg-background/80 pl-3 pr-3">
          <div className="pointer-events-none absolute -left-6 inset-y-0 w-6 bg-gradient-to-r from-transparent to-background"></div>
          <button
            type="button"
            onClick={onOpenFilters}
            className="relative z-10 inline-flex h-9 min-w-fit items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold text-foreground transition hover:text-primary"
          >
            <FilterIcon className="h-4 w-4" />
            <span>{t('products.filter', 'Lọc')}</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFilterBar;
