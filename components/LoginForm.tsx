import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, LoginIcon, GoogleIcon } from './icons';
import * as api from '../services/api';
import Spinner from './Spinner';

interface LoginFormProps {
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
    onLoginSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onSwitchToForgotPassword, onLoginSuccess }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const oauthOnly = api.isD1BackendEnabled();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await api.login(email, password);
            onLoginSuccess();
        } catch (err: any) {
            setError(err.message || t('auth.login_error'));
        } finally {
            setIsLoading(false);
        }
    };

    if (oauthOnly) {
        const startOAuth = async () => {
            setError(null);
            setIsLoading(true);
            try {
                await api.loginWithOAuth('google');
            } catch (err: any) {
                setError(err?.message || t('auth.login_error'));
                setIsLoading(false);
            }
        };

        return (
            <div className="animate-scale-in">
                <h2 className="mt-6 text-2xl font-bold text-foreground text-center">{t('auth.welcome_back')}</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    {t('auth.oauth_google_desc', 'Đăng nhập an toàn bằng tài khoản Google của bạn.')}
                </p>
                {error ? <div className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
                <div className="mt-8 space-y-3">
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void startOAuth()}
                        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        <span>{t('auth.continue_google', 'Tiếp tục với Google')}</span>
                    </button>
                </div>
                <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
                    {t('auth.oauth_account_note', 'Nếu email đã tồn tại, hệ thống chỉ liên kết khi nhà cung cấp xác minh email đó.')}
                </p>
            </div>
        );
    }

    return (
        <div className="animate-scale-in">
            <h2 className="mt-6 text-2xl font-bold text-foreground text-center">{t('auth.welcome_back')}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">{t('auth.login_desc')}</p>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>}

                <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        id="email-address"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.email_placeholder')}
                    />
                </div>

                <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.password_placeholder')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <button type="button" onClick={onSwitchToForgotPassword} className="font-medium text-primary hover:text-primary/80">
                            {t('auth.forgot_password')}
                        </button>
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Spinner className="w-5 h-5 animate-spin" />
                                <span>{t('common.loading')}</span>
                            </>
                        ) : (
                            <>
                                <LoginIcon className="w-5 h-5" />
                                <span>{t('common.login')}</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-card text-muted-foreground">{t('auth.or_continue_with') || 'Hoặc tiếp tục với'}</span>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => api.loginWithOAuth('google')}
                            className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-border rounded-md shadow-sm bg-background text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
                        >
                            <GoogleIcon className="w-5 h-5" />
                            <span>Google</span>
                        </button>
                    </div>
                </div>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('auth.no_account')}{' '}
                <button onClick={onSwitchToRegister} className="font-medium text-primary hover:text-primary/80">
                    {t('auth.register_now')}
                </button>
            </p>
        </div>
    );
};

export default LoginForm;
