import React, { useId } from 'react';

export interface AdminFieldProps {
  label?: React.ReactNode;
  id?: string;
  required?: boolean;
  description?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

export const AdminField: React.FC<AdminFieldProps> = ({
  label,
  id: explicitId,
  required = false,
  description,
  error,
  className = '',
  children,
}) => {
  const generatedId = useId();
  const fieldId = explicitId || generatedId;

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="flex items-center text-xs font-semibold text-foreground/80 mb-1.5 select-none"
        >
          <span>{label}</span>
          {required && (
            <span className="text-rose-500 font-bold ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string; hasError?: boolean }>, {
            id: fieldId,
            hasError: Boolean(error),
          })
        : children}

      {error ? (
        <p
          role="alert"
          className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground mt-1 leading-normal">{description}</p>
      ) : null}
    </div>
  );
};

export default AdminField;
