import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from './icons';

interface BackIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string;
}

const BackIconButton: React.FC<BackIconButtonProps> = ({
  label,
  className = '',
  type = 'button',
  ...props
}) => {
  const { t } = useTranslation();
  const resolvedLabel = label || t('common.back', 'Quay lại');

  return (
    <div className="relative group inline-flex">
      <button
        type={type}
        aria-label={resolvedLabel}
        title={resolvedLabel}
        className={`btn-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 ${className}`}
        {...props}
      >
        <ArrowLeftIcon className="h-5 w-5" />
        <span className="sr-only">{resolvedLabel}</span>
      </button>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-popover/95 px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
        {resolvedLabel}
      </span>
    </div>
  );
};

export default BackIconButton;
