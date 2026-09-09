import React from 'react';

export type AdminIconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'destructive';
export type AdminIconButtonSize = 'sm' | 'md' | 'lg';

export interface AdminIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label'?: string;
  label?: string;
  icon?: React.ReactNode;
  variant?: AdminIconButtonVariant;
  size?: AdminIconButtonSize;
  loading?: boolean;
  tooltip?: string;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<AdminIconButtonVariant, string> = {
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all',
  secondary:
    'border border-border/70 bg-white/70 dark:bg-white/10 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/15 active:scale-95 transition-all shadow-2xs',
  primary:
    'bg-primary text-primary-foreground font-bold hover:bg-primary/92 active:scale-95 transition-all shadow-xs',
  destructive:
    'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all shadow-2xs',
};

const SIZE_CLASSES: Record<AdminIconButtonSize, string> = {
  sm: 'h-7.5 w-7.5 rounded-lg text-xs',
  md: 'h-9 w-9 rounded-xl text-sm',
  lg: 'h-10 w-10 rounded-2xl text-base',
};

export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      label,
      icon,
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled = false,
      tooltip,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const finalAriaLabel = ariaLabel || label || tooltip || '';
    const finalContent = icon || children;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={finalAriaLabel}
        title={tooltip || finalAriaLabel}
        aria-busy={loading}
        className={`relative inline-flex items-center justify-center shrink-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {/* Invisible expanded touch area on touch devices to guarantee 44x44px minimum */}
        <span className="absolute -inset-1.5 md:hidden pointer-events-none" aria-hidden="true" />

        {loading ? (
          <svg
            className="animate-spin h-4 w-4 text-current opacity-80"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          finalContent
        )}
      </button>
    );
  }
);

AdminIconButton.displayName = 'AdminIconButton';
export default AdminIconButton;
