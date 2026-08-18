import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface CollapsibleSidebarItem {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface CollapsibleSidebarProps {
  title: string;
  subtitle?: string;
  items: CollapsibleSidebarItem[];
  footer?: React.ReactNode;
  defaultCollapsed?: boolean;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  title,
  subtitle,
  items,
  footer,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <>
      <div className="rounded-[1.35rem] border border-border bg-card/95 p-3 shadow-sm lg:hidden">
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Admin editor</p>
          <h2 className="mt-1 text-lg font-black text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <nav className="overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2.5 text-sm font-bold ${
                  item.active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-transparent bg-muted/70 text-foreground'
                }`}
              >
                {item.icon ? <span className={item.active ? 'text-primary-foreground' : 'text-primary'}>{item.icon}</span> : null}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <aside
        className={`hidden lg:flex lg:min-h-[calc(100vh-3rem)] lg:flex-col lg:rounded-[1.5rem] lg:bg-card/95 lg:shadow-sm ${
          isCollapsed ? 'lg:w-[84px]' : 'lg:w-[244px]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          {isCollapsed ? (
            <div className="mx-auto rounded-xl bg-primary/10 p-2.5 text-primary">{items[0]?.icon || <span className="text-xs font-bold">CMS</span>}</div>
          ) : (
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Admin editor</p>
              <h2 className="mt-1 text-lg font-black text-foreground">{title}</h2>
              {subtitle ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p> : null}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary"
            aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          >
            {isCollapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2.5 py-3">
          {items.map((item) => {
            const activeClasses = item.active
              ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
              : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-background';

            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={`flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-all ${activeClasses}`}
                title={isCollapsed ? item.label : item.hint || item.label}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.active ? 'bg-white/15' : 'bg-primary/10 text-primary'}`}>
                  {item.icon || <span className="text-sm font-bold">{item.label.slice(0, 1)}</span>}
                </span>

                {!isCollapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.label}</span>
                    {item.hint ? (
                      <span className={`mt-0.5 block text-xs leading-5 ${item.active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {footer ? <div className="border-t border-border px-3 py-3">{footer}</div> : null}
      </aside>
    </>
  );
};

export default CollapsibleSidebar;
