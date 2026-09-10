import React from 'react';

export interface AdminPageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  subtitle,
  eyebrow,
  badge,
  actions,
  children,
  className = '',
}) => {
  const displayDescription = description || subtitle;

  return (
    <header className={`mb-4 flex flex-col gap-3 ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-0.5">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-foreground font-heading tracking-tight truncate">
              {title}
            </h2>
            {badge && (
              <div className="inline-flex shrink-0">
                {typeof badge === 'string' ? (
                  <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {badge}
                  </span>
                ) : (
                  badge
                )}
              </div>
            )}
          </div>
          {displayDescription && (
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
              {displayDescription}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>

      {children}
    </header>
  );
};

export default AdminPageHeader;
