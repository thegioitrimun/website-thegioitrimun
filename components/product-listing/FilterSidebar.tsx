import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '../icons';

export type FilterOption = {
  label: string;
  value: string | number;
  count?: number;
};

interface FilterSidebarProps {
  activeFilterCount: number;
  selectedCategory: number | 'all';
  onSelectCategory: (value: number | 'all') => void;
  categoryOptions: FilterOption[];
  selectedPrice: string;
  onSelectPrice: (value: string) => void;
  priceOptions: FilterOption[];
  selectedBrands: string[];
  onToggleBrand: (value: string) => void;
  brandOptions: FilterOption[];
  selectedSkinTypes: string[];
  onToggleSkinType: (value: string) => void;
  skinTypeOptions: FilterOption[];
  selectedConcerns: string[];
  onToggleConcern: (value: string) => void;
  concernOptions: FilterOption[];
  onClearFilters: () => void;
  mode?: 'desktop' | 'mobile';
}

const countLabel = (count?: number) => {
  if (typeof count !== 'number') return null;
  return (
    <span className="shrink-0 rounded-full bg-[#f6ead8] px-2.5 py-1 text-[11px] font-bold text-[#8d6a48] dark:bg-primary/12 dark:text-primary">
      {count}
    </span>
  );
};

const FilterSection: React.FC<{ title: string; defaultOpen?: boolean; contentClassName?: string; children: React.ReactNode }> = ({
  title,
  defaultOpen = true,
  contentClassName = '',
  children,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group border-b border-border/70 py-4 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1">
        <span className="text-sm font-black text-foreground">{title}</span>
        <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className={`mt-4 space-y-2 ${contentClassName}`.trim()}>{children}</div>
    </details>
  );
};

const optionClass = (active: boolean) =>
  active
    ? 'border border-primary/40 bg-primary/15 text-primary font-bold shadow-xs backdrop-blur-md dark:bg-primary/25 dark:border-primary/40'
    : 'border border-white/50 bg-white/40 text-foreground hover:bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10';

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  activeFilterCount,
  selectedCategory,
  onSelectCategory,
  categoryOptions,
  selectedPrice,
  onSelectPrice,
  priceOptions,
  selectedBrands,
  onToggleBrand,
  brandOptions,
  selectedSkinTypes,
  onToggleSkinType,
  skinTypeOptions,
  selectedConcerns,
  onToggleConcern,
  concernOptions,
  onClearFilters,
  mode = 'desktop',
}) => {
  const { t } = useTranslation();
  const wrapperClass =
    mode === 'desktop'
      ? 'overflow-hidden rounded-[24px] border border-border/80 bg-white p-5 shadow-[0_16px_32px_-28px_rgba(36,46,57,0.12)] dark:border-white/10 dark:bg-card dark:shadow-[0_24px_52px_-36px_rgba(4,10,24,0.58)] md:p-5'
      : 'space-y-2 bg-transparent p-0';
  const categoryScrollClass = mode === 'desktop' ? 'max-h-[26rem] overflow-y-auto pr-1' : 'max-h-[32vh] overflow-y-auto pr-1';
  const brandScrollClass = mode === 'desktop' ? 'max-h-[24rem] overflow-y-auto pr-1' : 'max-h-[28vh] overflow-y-auto pr-1';
  const compactScrollClass = mode === 'desktop' ? 'max-h-[22rem] overflow-y-auto pr-1' : 'max-h-[26vh] overflow-y-auto pr-1';

  return (
    <div className={wrapperClass}>
      {mode === 'desktop' && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('filters.sidebar_title', 'Bộ lọc')}</p>
            <h2 className="mt-2 text-base font-black tracking-[-0.03em] text-foreground">
              {activeFilterCount > 0
                ? t('filters.active_count', { count: activeFilterCount, defaultValue: `${activeFilterCount} bộ lọc đang bật` })
                : t('filters.collapsed_hint', 'Thu gọn danh sách')}
            </h2>
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-accent"
            >
              {t('filters.clear_all', 'Xóa hết')}
            </button>
          ) : null}
        </div>
      )}

      <div className={mode === 'desktop' ? 'mt-6' : 'mt-2'}>
        <FilterSection title={t('filters.category', 'Danh mục')} defaultOpen contentClassName={categoryScrollClass}>
          {categoryOptions.map((option) => {
            const isActive = selectedCategory === option.value;
            return (
              <button
                key={`category-${option.value}`}
                type="button"
                onClick={() => onSelectCategory(option.value === 'all' ? 'all' : Number(option.value))}
                className={`flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition ${optionClass(isActive)}`}
              >
                <span className="min-w-0 truncate font-semibold">{option.label}</span>
                {countLabel(option.count)}
              </button>
            );
          })}
        </FilterSection>

        <FilterSection title={t('filters.price_range', 'Khoảng giá')} defaultOpen={selectedPrice !== 'all'}>
          {priceOptions.map((option) => {
            const isActive = selectedPrice === option.value;
            return (
              <label
                key={`price-${option.value}`}
                className={`flex cursor-pointer items-center justify-between rounded-[18px] px-4 py-3 text-sm transition ${optionClass(isActive)}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={isActive}
                    onChange={() => onSelectPrice(String(option.value))}
                    className="h-4 w-4 border-border text-primary focus:ring-primary"
                  />
                  <span className="min-w-0 truncate font-medium">{option.label}</span>
                </div>
                {countLabel(option.count)}
              </label>
            );
          })}
        </FilterSection>

        {brandOptions.length > 0 ? (
          <FilterSection title={t('filters.brand', 'Thương hiệu')} defaultOpen={selectedBrands.length > 0} contentClassName={brandScrollClass}>
            {brandOptions.map((option) => {
              const isActive = selectedBrands.includes(String(option.value));
              return (
                <label
                key={`brand-${option.value}`}
                className={`flex cursor-pointer items-center justify-between rounded-[18px] px-4 py-3 text-sm transition ${optionClass(isActive)}`}
              >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleBrand(String(option.value))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 truncate font-medium">{option.label}</span>
                  </div>
                  {countLabel(option.count)}
                </label>
              );
            })}
          </FilterSection>
        ) : null}

        {skinTypeOptions.length > 0 ? (
          <FilterSection title={t('filters.skin_type', 'Loại da')} defaultOpen={selectedSkinTypes.length > 0} contentClassName={compactScrollClass}>
            {skinTypeOptions.map((option) => {
              const isActive = selectedSkinTypes.includes(String(option.value));
              return (
                <label
                key={`skin-${option.value}`}
                className={`flex cursor-pointer items-center justify-between rounded-[18px] px-4 py-3 text-sm transition ${optionClass(isActive)}`}
              >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleSkinType(String(option.value))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 truncate font-medium">{option.label}</span>
                  </div>
                  {countLabel(option.count)}
                </label>
              );
            })}
          </FilterSection>
        ) : null}

        {concernOptions.length > 0 ? (
          <FilterSection title={t('filters.concerns', 'Mối quan tâm')} defaultOpen={selectedConcerns.length > 0} contentClassName={compactScrollClass}>
            {concernOptions.map((option) => {
              const isActive = selectedConcerns.includes(String(option.value));
              return (
                <label
                key={`concern-${option.value}`}
                className={`flex cursor-pointer items-center justify-between rounded-[18px] px-4 py-3 text-sm transition ${optionClass(isActive)}`}
              >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleConcern(String(option.value))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="min-w-0 truncate font-medium">{option.label}</span>
                  </div>
                  {countLabel(option.count)}
                </label>
              );
            })}
          </FilterSection>
        ) : null}
      </div>
    </div>
  );
};

export default FilterSidebar;
