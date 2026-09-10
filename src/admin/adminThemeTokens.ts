/**
 * Hệ thống Design Tokens chuẩn hóa cho toàn bộ không gian Admin (/admin/)
 * Tham chiếu trực tiếp: Giao diện Admin Đơn hàng (Plan_Detail.md - Mục 4)
 */

export const ADMIN_THEME_TOKENS = {
  // Bề mặt & Nền
  background: {
    lightPastelGradient:
      'linear-gradient(135deg, #ffecee 0%, #fff3e6 20%, #fffbea 40%, #ecfdf5 60%, #eff6ff 80%, #f5f3ff 100%)',
    darkGradient:
      'linear-gradient(135deg, #0b1320 0%, #0d1726 50%, #09101a 100%)',
    baseLight: '#FFFFFF',
    baseDark: 'hsl(214, 32%, 8%)',
  },

  // Lớp bề mặt kính (Glass Surface)
  surface: {
    toolbar: 'admin-surface admin-surface-toolbar',
    content: 'admin-surface',
    table: 'admin-surface',
    overlay: 'admin-surface admin-surface-overlay',
    tableHead: 'admin-table-head text-[11px] font-semibold text-muted-foreground border-b border-border/70',
  },

  // Bóng đổ chuẩn hóa
  shadows: {
    primary: 'shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] dark:shadow-[0_28px_70px_-48px_rgba(0,0,0,0.7)]',
    overlay: 'shadow-2xl',
    card: 'shadow-[0_18px_48px_-32px_rgba(24,35,32,0.35)]',
  },

  // Bo góc chuẩn hóa
  radii: {
    blockLg: 'rounded-2xl md:rounded-[28px]',
    blockMd: 'rounded-xl md:rounded-2xl',
    field: 'rounded-xl md:rounded-2xl',
    badge: 'rounded-xl',
    button: 'rounded-xl md:rounded-2xl',
  },

  // Kích thước chuẩn hóa
  dimensions: {
    railWidthDesktop: 76,
    drawerWidthMobile: 320,
    headerHeightMobile: 56,
    fieldHeightDesktop: 'h-10',
    fieldHeightMobile: 'h-11',
    iconButtonSizeDesktop: 'h-9 w-9',
    touchTargetMinMobile: 'min-h-[44px] min-w-[44px]',
  },

  // Màu sắc trạng thái theo ngữ nghĩa (Semantic Status Tones)
  statusTones: {
    emerald: {
      name: 'emerald',
      badge:
        'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25',
      dot: 'bg-emerald-500',
    },
    sky: {
      name: 'sky',
      badge:
        'bg-sky-500/12 text-sky-800 dark:text-sky-300 border border-sky-500/25',
      dot: 'bg-sky-500',
    },
    amber: {
      name: 'amber',
      badge:
        'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30',
      dot: 'bg-amber-500',
    },
    rose: {
      name: 'rose',
      badge:
        'bg-rose-500/12 text-rose-800 dark:text-rose-300 border border-rose-500/25',
      dot: 'bg-rose-500',
    },
    slate: {
      name: 'slate',
      badge:
        'bg-slate-500/12 text-slate-700 dark:text-slate-300 border border-slate-500/20',
      dot: 'bg-slate-400',
    },
    violet: {
      name: 'violet',
      badge:
        'bg-violet-500/12 text-violet-800 dark:text-violet-300 border border-violet-500/25',
      dot: 'bg-violet-500',
    },
  },
} as const;

export type AdminStatusTone = keyof typeof ADMIN_THEME_TOKENS.statusTones;
export type AdminSurfaceVariant = keyof typeof ADMIN_THEME_TOKENS.surface;
