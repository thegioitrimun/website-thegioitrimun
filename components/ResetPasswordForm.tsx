import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LockIcon, EyeIcon, EyeOffIcon } from './icons';
import * as api from '../services/api';
import Spinner from './Spinner';

interface ResetPasswordFormProps {
    onResetSuccess: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onResetSuccess }) => {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

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
            await api.updatePassword(password);
            setSuccess(t('auth.password_updated'));
            onResetSuccess();
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-scale-in">
            <h2 className="mt-6 text-2xl font-bold text-foreground text-center">{t('auth.reset_password_title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">{t('auth.reset_password_desc')}</p>

            {error && <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>}
            {success && <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-sm rounded-lg">{success}</div>}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        name="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.new_password_placeholder')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        name="confirm-new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-md placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                        placeholder={t('auth.confirm_new_password_placeholder')}
                    />
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
                            <span>{t('auth.update_password')}</span>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResetPasswordForm;
