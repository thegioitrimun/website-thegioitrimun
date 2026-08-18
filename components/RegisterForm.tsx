import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, GoogleIcon } from './icons';
import * as api from '../services/api';

interface RegisterFormProps {
    onSwitchToLogin: () => void;
    onRegisterSuccess: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onRegisterSuccess }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError(t('auth.password_mismatch'));
            return;
        }
        if (password.length < 8) {
            setError(t('auth.password_min'));
            return;
        }

        setIsLoading(true);
        try {
            await api.register({ email, password, name });
            onRegisterSuccess();
        } catch (err: any) {
            setError(err.message || t('auth.register_error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-scale-in">
            <h2 className="mt-6 text-2xl font-bold text-foreground text-center">{t('auth.create_account')}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">{t('auth.register_desc')}</p>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>}

                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input name="name" type="text" required value={name} onChange={e => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.name_placeholder')} />
                </div>

                <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.email_placeholder')} />
                </div>

                <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.password_placeholder')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input name="confirm-password" type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.confirm_password_placeholder')} />
                </div>

                <div>
                    <button type="submit" disabled={isLoading}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:bg-muted"
                    >
                        {isLoading ? t('common.loading') : t('common.register')}
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
                {t('auth.have_account')}{' '}
                <button onClick={onSwitchToLogin} className="font-medium text-primary hover:text-primary/80">
                    {t('common.login')}
                </button>
            </p>
        </div>
    );
};

export default RegisterForm;
