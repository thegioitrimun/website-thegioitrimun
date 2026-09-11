import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loginWithOAuth } from '../services/api';
import { ArrowLeftIcon, SparklesIcon, ShieldCheckIcon, SunIcon, MoonIcon } from '../components/icons';
import { useTheme } from '../hooks/useTheme';

type AdminLoginPageProps = {
  onLoginSuccess?: () => void;
  error?: string | null;
};

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ error: propError }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(propError || null);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loginWithOAuth('google');
    } catch (err: any) {
      setError(err?.message || 'Không thể khởi tạo đăng nhập Google. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-card/80 text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/40 hover:text-foreground dark:border-white/10 dark:bg-[#151f30]/80 shadow-sm btn-press"
          title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
      </div>
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[560px] rounded-full bg-primary/15 blur-[120px] dark:bg-primary/20" />
      <div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-secondary/10 blur-[100px] dark:bg-teal-500/10" />

      <div className="relative w-full max-w-md">
        {/* Top brand icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border/80 bg-card/90 p-2.5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#151f30] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
            <img
              src="/icons/admin-logo.svg"
              alt="TGTM Admin"
              className="h-full w-full object-contain dark:hidden"
            />
            <img
              src="/icons/admin-logo-dark.svg"
              alt="TGTM Admin"
              className="hidden h-full w-full object-contain dark:block"
            />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-[28px] border border-border/80 bg-card/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#111a27]/90 dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)]">
          {/* Top subtle specular highlight line */}
          <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary shadow-xs">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>TGTM Workspace</span>
            </div>
            <h1 className="mt-3 font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Đăng nhập Quản trị
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Phân hệ dành riêng cho Bác sĩ, Quản trị viên và Bộ phận Kế toán Thế Giới Trị Mụn.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-medium text-red-600 dark:text-red-400 leading-relaxed text-center">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="group relative flex w-full min-h-[52px] items-center justify-center gap-3 rounded-2xl border border-border/80 bg-background/90 dark:bg-white/[0.04] dark:border-white/10 px-4 py-3 text-sm font-bold text-foreground shadow-xs transition-all hover:bg-muted/80 dark:hover:bg-white/[0.08] hover:border-primary/40 hover:shadow-md active:scale-[0.98] disabled:opacity-50 btn-press"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isLoading ? 'Đang chuyển hướng...' : 'Đăng nhập bằng Google Workspace'}</span>
            </button>
          </div>

          <div className="mt-8 border-t border-border/60 pt-6 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-1 px-3 rounded-xl hover:bg-muted/50"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              <span>Quay lại website thegioitrimun.vn</span>
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © 2026 Thế Giới Trị Mụn Clinic & Pharmacy. Tất cả quyền được bảo hộ.
        </p>
      </div>
    </div>
  );
};
