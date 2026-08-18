import React from 'react';

const joinClasses = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

interface AdminMobileListProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminMobileList: React.FC<AdminMobileListProps> = ({ children, className }) => (
  <div className={joinClasses('flex flex-col lg:hidden', className)}>
    {children}
  </div>
);

interface AdminMobileCardProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminMobileCard: React.FC<AdminMobileCardProps> = ({ children, className }) => (
  <article className={joinClasses('relative border-b border-border/40 last:border-0 p-4 transition-colors hover:bg-muted/20', className)}>
    {children}
  </article>
);

interface AdminMobileMetaProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const AdminMobileMeta: React.FC<AdminMobileMetaProps> = ({ label, value, className }) => (
  <div className={joinClasses('rounded-2xl border border-white/50 bg-background/50 backdrop-blur-xl shadow-sm px-3 py-2 dark:border-white/10', className)}>
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
  </div>
);
