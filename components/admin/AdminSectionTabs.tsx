import React, { useRef, useEffect } from 'react';

export interface AdminSectionTabItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface AdminSectionTabsProps<T extends string = string> {
  items?: Array<AdminSectionTabItem<T>>;
  tabs?: Array<AdminSectionTabItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export function AdminSectionTabs<T extends string = string>({
  items,
  tabs,
  activeKey,
  onChange,
  className = '',
  variant = 'pill',
}: AdminSectionTabsProps<T>) {
  const effectiveItems = tabs || items || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  // Auto scroll active tab into view horizontally on mobile / small viewports
  useEffect(() => {
    if (activeBtnRef.current && containerRef.current) {
      const btn = activeBtnRef.current;
      const container = containerRef.current;
      const btnLeft = btn.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
      const btnRight = btnLeft + btn.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const scrollRight = scrollLeft + container.offsetWidth;

      if (btnLeft < scrollLeft) {
        container.scrollTo({ left: btnLeft - 16, behavior: 'instant' });
      } else if (btnRight > scrollRight) {
        container.scrollTo({ left: btnRight - container.offsetWidth + 16, behavior: 'instant' });
      }
    }
  }, [activeKey]);

  if (variant === 'underline') {
    return (
      <div
        ref={containerRef}
        className={`flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-border/70 dark:border-white/10 ${className}`.trim()}
      >
        {effectiveItems.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              ref={isActive ? activeBtnRef : undefined}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(item.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold border-b-2 transition-all select-none ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-xs font-bold ${
                    isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl border border-border/70 bg-white/70 dark:bg-[rgba(15,23,34,0.7)] backdrop-blur-md shadow-2xs scrollbar-none ${className}`.trim()}
    >
      {effectiveItems.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={isActive ? activeBtnRef : undefined}
            type="button"
              aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all select-none active:scale-95 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-xs font-black ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-black/5 dark:bg-white/10 text-muted-foreground'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AdminSectionTabs;
