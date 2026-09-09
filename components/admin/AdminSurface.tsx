import React from 'react';
import { ADMIN_THEME_TOKENS, type AdminSurfaceVariant } from '../../src/admin/adminThemeTokens';

interface AdminSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AdminSurfaceVariant | 'card';
  as?: 'div' | 'section' | 'article' | 'nav' | 'header' | 'aside';
  children: React.ReactNode;
}

export const AdminSurface: React.FC<AdminSurfaceProps> = ({
  variant = 'content',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) => {
  const actualVariant = variant === 'card' ? 'content' : variant;
  const surfaceClass = ADMIN_THEME_TOKENS.surface[actualVariant] || ADMIN_THEME_TOKENS.surface.content;
  const radiusClass =
    variant === 'toolbar'
      ? 'rounded-2xl md:rounded-[24px]'
      : variant === 'overlay'
      ? 'rounded-2xl'
      : 'rounded-2xl md:rounded-[28px]';

  return (
    <Component
      className={`${surfaceClass} ${radiusClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

export default AdminSurface;
