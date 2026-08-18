import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailIcon } from './icons';
import * as api from '../services/api';

interface ForgotPasswordFormProps {
    onSwitchToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onSwitchToLogin }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(null);
        setError(null);
        setIsLoading(true);

        try {
            await api.forgotPassword(email);
            setSuccessMessage(t('auth.reset_link_sent', { email }));
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-scale-in">
            <h2 className="mt-6 text-2xl font-bold text-foreground text-center">{t('auth.forgot_password')}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">{t('auth.forgot_desc')}</p>

            {error && <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>}
            {successMessage ? (
                <div className="mt-8 p-4 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-sm rounded-lg">
                    {successMessage}
                </div>
            ) : (
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:bg-muted"
                        >
                            {isLoading ? t('common.loading') : t('auth.send_reset_link')}
                        </button>
                    </div>
                </form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('auth.remember_password')}{' '}
                <button onClick={onSwitchToLogin} className="font-medium text-primary hover:text-primary/80">
                    {t('common.login')}
                </button>
            </p>
        </div>
    );
};

export default ForgotPasswordForm;