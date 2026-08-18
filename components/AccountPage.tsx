import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserData } from '../types';
import { useTheme } from '../hooks/useTheme';
import { ColorTheme } from '../contexts/ThemeContext';
import { useFont } from '../hooks/useFont';
import { FONT_OPTIONS, Font } from '../contexts/FontContext';
import {
    UserIcon, ProfileIcon, MedicalRecordIcon, CalendarIcon, DocumentDuplicateIcon,
    PaletteIcon, SunIcon, MoonIcon, SystemIcon, CheckIcon, ChevronDownIcon,
    LoginIcon, LogoutIcon, HeartIcon, CogIcon, ReceiptIcon
} from './icons';

type UserPage = 'administrativeProfile' | 'medicalRecords' | 'myMedicalRecords' | 'appointments' | 'wishlist' | 'adminDashboard' | 'orderHistory';

interface AccountPageProps {
    user: UserData | null;
    onNavigate: (page: { page: UserPage } | { page: 'auth' }) => void;
    onLogout: () => void;
}

const THEMES: { name: ColorTheme; color: string }[] = [
    { name: 'teal', color: 'hsl(190, 60%, 43%)' }, { name: 'violet', color: 'hsl(231, 70%, 65%)' },
    { name: 'mint', color: 'hsl(155, 15%, 42%)' }, { name: 'amber', color: 'hsl(27, 86%, 49%)' },
    { name: 'gold', color: 'hsl(30, 41%, 59%)' }, { name: 'fuchsia', color: 'hsl(336, 71%, 57%)' },
    { name: 'purple', color: 'hsl(289, 44%, 46%)' }, { name: 'pastel', color: 'hsl(309, 39%, 79%)' },
    { name: 'rose', color: 'hsl(350, 61%, 68%)' }, { name: 'crimson', color: 'hsl(334, 66%, 61%)' },
    { name: 'green', color: 'hsl(119, 33%, 37%)' }, { name: 'sky', color: 'hsl(223, 97%, 70%)' },
    { name: 'sunrise', color: 'hsl(261, 52%, 82%)' }, { name: 'stone', color: 'hsl(231, 48%, 58%)' },
    { name: 'coral', color: 'hsl(5, 84%, 64%)' }, { name: 'vinmec', color: 'hsl(186, 98%, 30%)' },
];

const MenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="flex items-center w-full text-left p-4 hover:bg-accent transition-colors">
        <span className="text-primary mr-4">{icon}</span>
        <span className="flex-grow text-foreground font-medium">{label}</span>
        <ChevronDownIcon className="w-5 h-5 text-muted-foreground -rotate-90" />
    </button>
);

const AccountPage: React.FC<AccountPageProps> = ({ user, onNavigate, onLogout }) => {
    const { t } = useTranslation();
    const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
    const { font, setFont } = useFont();

    const loggedInMenuItems = [
        { label: t('account.profile'), onClick: () => onNavigate({ page: 'administrativeProfile' }), icon: <ProfileIcon className="w-6 h-6" /> },
        { label: t('account.orders'), onClick: () => onNavigate({ page: 'orderHistory' }), icon: <ReceiptIcon className="w-6 h-6" /> },
        { label: t('account.wishlist'), onClick: () => onNavigate({ page: 'wishlist' }), icon: <HeartIcon className="w-6 h-6" /> },
        { label: t('account.my_records'), onClick: () => onNavigate({ page: 'myMedicalRecords' }), icon: <DocumentDuplicateIcon className="w-6 h-6" /> },
        { label: t('account.medical_records'), onClick: () => onNavigate({ page: 'medicalRecords' }), icon: <MedicalRecordIcon className="w-6 h-6" /> },
        { label: t('account.appointments'), onClick: () => onNavigate({ page: 'appointments' }), icon: <CalendarIcon className="w-6 h-6" /> },
    ];

    const adminMenuItem = { label: t('account.admin'), onClick: () => onNavigate({ page: 'adminDashboard' }), icon: <CogIcon className="w-6 h-6" /> };

    return (
        <div className="bg-background text-foreground animate-scale-in pb-20">
            <div className="container mx-auto px-4 py-8">
                {/* User Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                        {user && user.profile.avatar_url ? (
                            <img loading="lazy" src={user.profile.avatar_url} alt={user.profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-10 h-10" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{user ? user.profile.name : t('account.guest')}</h1>
                        <p className="text-muted-foreground">{user ? user.profile.email : t('account.welcome')}</p>
                    </div>
                </div>

                {/* Menu */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {user ? (
                        <>
                            <div className="divide-y divide-border">
                                {loggedInMenuItems.map(item => <MenuItem key={item.label} {...item} />)}
                                {['admin', 'master_admin'].includes(user.profile.role) && <MenuItem {...adminMenuItem} />}
                            </div>
                            <div className="p-4">
                                <button onClick={onLogout} className="w-full text-center py-3 font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors">
                                    {t('common.logout')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="p-6 text-center">
                            <p className="mb-4">{t('account.login_prompt')}</p>
                            <button onClick={() => onNavigate({ page: 'auth' })} className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-full">
                                {t('account.login_register')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Settings */}
                <div className="mt-8 bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-bold mb-4">{t('account.settings')}</h2>
                    <div className="space-y-6">
                        {/* Theme Mode */}
                        <div>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('account.theme_mode')}</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setTheme('light')} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-colors text-sm ${theme === 'light' ? 'bg-accent text-accent-foreground ring-1 ring-ring' : 'hover:bg-accent/50'}`}>
                                    <SunIcon className="w-5 h-5" /> <span>{t('account.light')}</span>
                                </button>
                                <button onClick={() => setTheme('dark')} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-colors text-sm ${theme === 'dark' ? 'bg-accent text-accent-foreground ring-1 ring-ring' : 'hover:bg-accent/50'}`}>
                                    <MoonIcon className="w-5 h-5" /> <span>{t('account.dark')}</span>
                                </button>
                                <button onClick={() => setTheme('system')} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-colors text-sm ${theme === 'system' ? 'bg-accent text-accent-foreground ring-1 ring-ring' : 'hover:bg-accent/50'}`}>
                                    <SystemIcon className="w-5 h-5" /> <span>{t('account.system')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Color Theme */}
                        <div>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('account.color')}</h4>
                            <div className="grid grid-cols-5 gap-3">
                                {THEMES.map((themeInfo) => (
                                    <button key={themeInfo.name} onClick={() => setColorTheme(themeInfo.name)} className="w-full h-8 rounded-full flex items-center justify-center transition-all-smooth btn-press focus:outline-none focus:ring-2 focus:ring-ring" style={{ backgroundColor: themeInfo.color }} title={themeInfo.name.charAt(0).toUpperCase() + themeInfo.name.slice(1)}>
                                        {colorTheme === themeInfo.name && <CheckIcon className="w-5 h-5 text-white mix-blend-difference" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Font */}
                        <div>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('account.font')}</h4>
                            <select onChange={(e) => setFont(e.target.value as Font)} value={font} className="w-full p-2 border border-input rounded-md bg-background" style={{ fontFamily: FONT_OPTIONS[font].stack }}>
                                {Object.keys(FONT_OPTIONS).map((fontKey) => (
                                    <option key={fontKey} value={fontKey} style={{ fontFamily: FONT_OPTIONS[fontKey as Font].stack }}>
                                        {FONT_OPTIONS[fontKey as Font].label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
