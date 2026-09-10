import React, { useRef, useImperativeHandle } from 'react';

export interface AdminInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  hasError?: boolean;
}

export const AdminInput = React.forwardRef<HTMLInputElement, AdminInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      leadingIcon,
      trailingIcon,
      clearable = false,
      onClear,
      hasError = false,
      disabled = false,
      className = '',
      type = 'text',
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = internalRef;
    useImperativeHandle(forwardedRef, () => internalRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      if (onClear) onClear();
      else onValueChange?.('');
      inputRef.current?.focus();
    };

    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div className="relative flex items-center w-full">
        {leadingIcon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-muted-foreground/80 shrink-0">
            {leadingIcon}
          </div>
        )}

        <input
          ref={inputRef}
          type={type}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={handleChange}
          className={`w-full h-11 lg:h-10 text-base md:text-sm font-medium transition-all outline-none rounded-xl md:rounded-2xl border ${
            hasError
              ? 'border-rose-500/80 bg-rose-500/5 text-rose-900 dark:text-rose-100 focus:ring-2 focus:ring-rose-500/25'
              : 'border-border/80 bg-white/80 dark:bg-[#0b1320] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-2xs'
          } ${leadingIcon ? 'pl-10' : 'pl-3.5'} ${
            clearable && hasValue ? 'pr-9' : trailingIcon ? 'pr-9' : 'pr-3.5'
          } disabled:opacity-55 disabled:cursor-not-allowed ${className}`}
          {...props}
        />

        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Xóa nội dung"
            className="absolute right-3 flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}

        {!clearable && trailingIcon && (
          <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground/80 shrink-0">
            {trailingIcon}
          </div>
        )}
      </div>
    );
  }
);

AdminInput.displayName = 'AdminInput';
export default AdminInput;
