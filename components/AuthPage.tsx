import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import type { AuthPageImages } from '../types';
import Spinner from './Spinner';
import * as api from '../services/api';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

interface AuthPageProps {
    onAuthSuccess: () => void;
    authImages: AuthPageImages | null;
    initialMode?: AuthMode;
    onRecoveryComplete?: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, authImages, initialMode = 'login', onRecoveryComplete }) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [authStatus, setAuthStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

    React.useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const checkAuthAvailability = React.useCallback(async () => {
        setAuthStatus('checking');
        const available = await api.isAuthServiceAvailable();
        setAuthStatus(available ? 'available' : 'unavailable');
    }, []);

    React.useEffect(() => {
        void checkAuthAvailability();
    }, [checkAuthAvailability]);

    const renderForm = () => {
        if (authStatus === 'checking') {
            return (
                <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-6 text-center">
                    <Spinner className="mx-auto h-6 w-6 animate-spin" />
                    <p className="mt-4 text-sm font-semibold text-foreground">{t('auth.checking_title', 'Đang kiểm tra hệ thống đăng nhập')}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t('auth.checking_desc', 'Mình đang xác nhận kết nối tới dịch vụ tài khoản trước khi mở form.')}
                    </p>
                </div>
            );
        }

        if (authStatus === 'unavailable') {
            return (
                <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">{t('auth.maintenance_kicker', 'Auth maintenance')}</p>
                    <h2 className="mt-3 text-2xl font-black text-foreground">{t('auth.maintenance_title', 'Đăng nhập tạm thời chưa khả dụng')}</h2>
                    <p className="mt-3 text-sm leading-7 text-amber-900/90">
                        {t('auth.maintenance_desc', 'Dịch vụ tài khoản hiện phản hồi không ổn định. Website công khai vẫn hoạt động, nhưng đăng nhập đang được khóa tạm thời để tránh lỗi treo.')}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => void checkAuthAvailability()}
                            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground btn-press"
                        >
                            {t('auth.retry_check', 'Kiểm tra lại')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('login')}
                            className="rounded-full border border-amber-300 bg-white px-5 py-2.5 text-sm font-bold text-amber-900 btn-press"
                        >
                            {t('auth.back_to_login', 'Về màn hình đăng nhập')}
                        </button>
                    </div>
                </div>
            );
        }

        if (api.isD1BackendEnabled()) {
            return <LoginForm onSwitchToRegister={() => setMode('login')} onSwitchToForgotPassword={() => setMode('login')} onLoginSuccess={onAuthSuccess} />;
        }

        switch (mode) {
            case 'login':
                return <LoginForm onSwitchToRegister={() => setMode('register')} onSwitchToForgotPassword={() => setMode('forgot-password')} onLoginSuccess={onAuthSuccess} />;
            case 'register':
                return <RegisterForm onSwitchToLogin={() => setMode('login')} onRegisterSuccess={onAuthSuccess} />;
            case 'forgot-password':
                return <ForgotPasswordForm onSwitchToLogin={() => setMode('login')} />;
            case 'reset-password':
                return <ResetPasswordForm onResetSuccess={() => onRecoveryComplete?.()} />;
            default:
                return null;
        }
    }

    const authImage = authImages?.login_image_url || '/hero/hero-desktop-v2.webp';

    return (
        <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="relative w-full max-w-5xl mx-auto bg-card rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
                {/* Right side: Form */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                    <div className="w-full max-w-md mx-auto">
                        <h1 className="text-3xl font-bold text-primary font-heading mb-2 text-center">{t('auth.brand_title', 'Thế Giới Trị Mụn')}</h1>
                        {renderForm()}
                    </div>
                </div>
                {/* Left side: Image */}
                <div className="hidden md:block relative">
                    <img src={authImage} alt={t('common.skincare')} className="absolute h-full w-full object-cover" />
                    <div className="absolute h-full w-full bg-gradient-to-r from-card to-transparent"></div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
