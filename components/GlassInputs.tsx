import React, { forwardRef } from 'react';
import { SearchIcon, CloseIcon } from './icons';

export interface GlassSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  value: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  size?: 'md' | 'sm';
  leftIcon?: React.ReactNode;
  hideClearButton?: boolean;
  clearAriaLabel?: string;
  containerClassName?: string;
  inputClassName?: string;
  children?: React.ReactNode;

  // Integrated filter button props
  onFilter?: () => void;
  isFilterActive?: boolean;
  filterLabel?: React.ReactNode;
  filterTitle?: string;
  filterIcon?: React.ReactNode;
  filterClassName?: string;
}

export interface GlassFilterButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  label?: React.ReactNode;
  icon?: React.ReactNode;
}

export const FilterFunnelIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
  </svg>
);

export const GlassFilterButton = forwardRef<HTMLButtonElement, GlassFilterButtonProps>(({
  isActive = false,
  label = 'Bộ lọc',
  icon,
  className = '',
  title,
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95 ${
        isActive
          ? 'bg-primary text-primary-foreground shadow-xs font-bold'
          : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
      } ${className}`}
      title={title || (typeof label === 'string' ? label : 'Bộ lọc')}
      {...props}
    >
      {icon || <FilterFunnelIcon className="w-3.5 h-3.5" />}
      {label && <span className="hidden sm:inline">{label}</span>}
      {children}
    </button>
  );
});
GlassFilterButton.displayName = 'GlassFilterButton';

/**
 * Unified Apple Glass Search Input Capsule
 * Based on the ServicesPage design system:
 * Container: rounded-2xl bg-background/30 backdrop-blur-xl shadow-[inset...] px-3 focus-within:ring-1 focus-within:ring-primary/50
 * Natural flex layout: left icon -> flexible borderless input -> clear button -> embedded actions (children)
 */
export const GlassSearchInput = forwardRef<HTMLInputElement, GlassSearchInputProps>(({
  value,
  onValueChange,
  onClear,
  size = 'md',
  leftIcon,
  hideClearButton = false,
  clearAriaLabel = 'Xóa tìm kiếm',
  containerClassName = '',
  inputClassName = '',
  className = '',
  children,
  placeholder = 'Tìm kiếm...',
  disabled,
  onFilter,
  isFilterActive = false,
  filterLabel = 'Bộ lọc',
  filterTitle,
  filterIcon,
  filterClassName = '',
  ...props
}, ref) => {
  const isSm = size === 'sm';
  const heightClass = isSm ? 'h-9 rounded-xl px-2.5 gap-1.5' : 'h-10 sm:h-11 rounded-2xl px-3 gap-1.5';
  const textClass = isSm ? 'text-xs' : 'text-xs sm:text-sm';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value);
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) onClear();
    else onValueChange?.('');
    e.currentTarget.parentElement?.querySelector('input')?.focus();
  };

  return (
    <div
      className={`flex items-center ${heightClass} border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all focus-within:ring-1 focus-within:ring-primary/50 ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${containerClassName} ${className}`}
    >
      {leftIcon !== null && (
        <span className="shrink-0 text-muted-foreground">
          {leftIcon || <SearchIcon className={`shrink-0 ${isSm ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
        </span>
      )}

      <input
        ref={ref}
        type="text"
        value={value}
        onChange={handleChange}
        aria-label={props['aria-label'] || placeholder}
        placeholder={placeholder}
        disabled={disabled}
        className={`flex-1 min-w-0 bg-transparent ${textClass} text-foreground placeholder:text-muted-foreground/70 outline-none border-0 p-0 focus:ring-0 ${inputClassName}`}
        {...props}
      />

      {Boolean(value) && !hideClearButton && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label={clearAriaLabel}
          title={clearAriaLabel}
        >
          <CloseIcon className={`${isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
        </button>
      )}

      {onFilter && (
        <GlassFilterButton
          onClick={onFilter}
          isActive={isFilterActive}
          label={filterLabel}
          icon={filterIcon}
          title={filterTitle}
          className={filterClassName}
        />
      )}

      {children}
    </div>
  );
});

GlassSearchInput.displayName = 'GlassSearchInput';

/**
 * Vertical divider inside glass capsules
 */
export const GlassDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-4 w-[1px] bg-border/40 shrink-0 mx-0.5 ${className}`} />
);

export interface GlassSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'md' | 'sm';
  containerClassName?: string;
  hideChevron?: boolean;
}

/**
 * Standardized glass select dropdown with custom chevron
 */
export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(({
  size = 'md',
  className = '',
  containerClassName = '',
  hideChevron = false,
  children,
  ...props
}, ref) => {
  const isSm = size === 'sm';
  const heightClass = isSm ? 'h-8 sm:h-8.5 rounded-xl text-xs pl-2.5 pr-7' : 'h-10 sm:h-11 rounded-2xl text-xs sm:text-sm pl-3.5 pr-8';

  return (
    <div className={`relative ${containerClassName}`}>
      <select
        ref={ref}
        className={`w-full ${heightClass} ${hideChevron ? '' : 'appearance-none'} border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] text-foreground focus:ring-1 focus:ring-primary/50 outline-none transition-all cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
      {!hideChevron && (
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      )}
    </div>
  );
});

GlassSelect.displayName = 'GlassSelect';

export interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'sm';
  containerClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Standardized glass input field for form inputs and dates
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(({
  size = 'md',
  className = '',
  containerClassName = '',
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const isSm = size === 'sm';
  const heightClass = isSm ? 'h-8 sm:h-8.5 rounded-xl text-xs px-2.5' : 'h-10 sm:h-11 rounded-2xl text-xs sm:text-sm px-3.5';

  if (leftIcon || rightIcon) {
    return (
      <div className={`relative flex items-center ${containerClassName}`}>
        {leftIcon && <span className="absolute left-2.5 text-muted-foreground pointer-events-none">{leftIcon}</span>}
        <input
          ref={ref}
          className={`w-full ${heightClass} ${leftIcon ? 'pl-8' : ''} ${rightIcon ? 'pr-8' : ''} border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all ${className}`}
          {...props}
        />
        {rightIcon && <span className="absolute right-2.5 text-muted-foreground pointer-events-none">{rightIcon}</span>}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      className={`w-full ${heightClass} border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all ${className}`}
      {...props}
    />
  );
});

GlassInput.displayName = 'GlassInput';

export interface GlassMenuItem<T = string> {
  value: T;
  label: React.ReactNode;
  count?: number | React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'primary' | 'destructive' | 'emerald' | 'sky';
  onClick?: () => void;
}

export interface GlassMenuPopoverProps<T = string> {
  isOpen: boolean;
  onClose: () => void;
  items?: GlassMenuItem<T>[];
  selectedValue?: T;
  onSelect?: (value: T) => void;
  className?: string;
  widthClass?: string;
  topClass?: string;
  align?: 'right' | 'left';
  children?: React.ReactNode;
}

/**
 * Standardized Apple Glass Popover Menu
 * - Transparent 100% click-catcher backdrop (fixed inset-0 z-40 bg-transparent)
 * - Solid 100% popover container (bg-card border-border/80 shadow-2xl rounded-2xl)
 */
export const GlassMenuPopover = <T extends string = string>({
  isOpen,
  onClose,
  items,
  selectedValue,
  onSelect,
  className = '',
  widthClass = 'w-56',
  topClass = 'top-9',
  align = 'right',
  children,
}: GlassMenuPopoverProps<T>) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />
      <div
        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${topClass} z-50 ${widthClass} rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl transition-all animate-in fade-in zoom-in-95 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-0.5">
          {items
            ? items.map((item) => {
                const isSelected = selectedValue !== undefined && selectedValue === item.value;
                return (
                  <button
                    key={String(item.value)}
                    type="button"
                    onClick={() => {
                      if (item.onClick) {
                        item.onClick();
                      } else if (onSelect) {
                        onSelect(item.value);
                      }
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.icon && <span className="shrink-0">{item.icon}</span>}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                        ({item.count})
                      </span>
                    )}
                  </button>
                );
              })
            : children}
        </div>
      </div>
    </>
  );
};

