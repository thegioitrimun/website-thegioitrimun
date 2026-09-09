import React from 'react';
import { ADMIN_THEME_TOKENS, type AdminStatusTone } from '../../src/admin/adminThemeTokens';

export type AdminBadgeTone = AdminStatusTone | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface AdminStatusBadgeProps {
  tone: AdminBadgeTone;
  label?: React.ReactNode;
  children?: React.ReactNode;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1 rounded-lg font-semibold',
  md: 'px-2.5 py-1 text-xs gap-1.5 rounded-xl font-bold',
};

const DOT_SIZE_CLASSES = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
};

const TONE_MAP: Record<string, AdminStatusTone> = {
  success: 'emerald',
  warning: 'amber',
  danger: 'rose',
  info: 'sky',
  neutral: 'slate',
};

export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({
  tone,
  label,
  children,
  dot = true,
  size = 'md',
  className = '',
}) => {
  const mappedTone = TONE_MAP[tone] || (tone as AdminStatusTone);
  const toneConfig = ADMIN_THEME_TOKENS.statusTones[mappedTone] || ADMIN_THEME_TOKENS.statusTones.slate;
  const content = children ?? label;

  return (
    <span
      className={`inline-flex items-center shrink-0 tracking-tight transition-colors select-none ${toneConfig.badge} ${SIZE_CLASSES[size]} ${className}`}
    >
      {dot && (
        <span
          className={`rounded-full shrink-0 ${toneConfig.dot} ${DOT_SIZE_CLASSES[size]}`}
          aria-hidden="true"
        />
      )}
      <span>{content}</span>
    </span>
  );
};

export default AdminStatusBadge;
