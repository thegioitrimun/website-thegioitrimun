import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loginWithOAuth } from '../services/api';
import { ArrowLeftIcon, SparklesIcon, ShieldCheckIcon } from '../components/icons';

type AdminLoginPageProps = {
  onLoginSuccess?: () => void;
  error?: string | null;
};

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ error: propError }) => {
  const { t } = useTranslation();
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
    <div className="relative min-h-[100svh] w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Top brand icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-white/60 bg-white/80 p-3 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80">
            <img
              src="/icons/da-lieu-nhiet-doi-phu-quoc-180.png?v=clinic-20260906"
              alt="TGTM"
              className="h-full w-full object-contain"
            />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/75 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/75">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>TGTM Workspace</span>
            </div>
            <h1 className="mt-3 font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Đăng nhập Quản trị
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
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
              className="group relative flex w-full min-h-[52px] items-center justify-center gap-3 rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm font-bold text-foreground shadow-sm transition-all hover:bg-background hover:shadow-md active:scale-98 disabled:opacity-50 btn-press"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
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
