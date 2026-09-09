import React from 'react';

export type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type AdminButtonSize = 'sm' | 'md' | 'lg';

export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<AdminButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground font-bold hover:bg-primary/92 shadow-sm active:scale-95 transition-all',
  secondary:
    'border border-border/70 bg-white/70 dark:bg-white/10 text-foreground font-semibold hover:bg-white dark:hover:bg-white/15 hover:border-border active:scale-95 transition-all shadow-2xs',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium active:scale-95 transition-all',
  destructive:
    'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 active:scale-95 font-semibold transition-all shadow-2xs',
};

const SIZE_CLASSES: Record<AdminButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl md:rounded-2xl',
  lg: 'h-11 md:h-12 px-5 text-base gap-2.5 rounded-2xl',
};

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      icon,
      rightIcon,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const effectiveLeftIcon = icon || leftIcon;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        className={`inline-flex items-center justify-center font-sans select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-0.5 h-4 w-4 shrink-0 text-current opacity-80"
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
            <span className="truncate">{children}</span>
          </>
        ) : (
          <>
            {effectiveLeftIcon && <span className="shrink-0 flex items-center">{effectiveLeftIcon}</span>}
            {children && <span className="truncate">{children}</span>}
            {rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

AdminButton.displayName = 'AdminButton';
export default AdminButton;
