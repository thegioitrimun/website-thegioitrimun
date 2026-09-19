import useOverlayMotion from './motion/useOverlayMotion';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, ArrowLeftIcon } from './icons';
import type { UserData, Appointment, Service, Doctor } from '../types';
import { UserIcon, LogoutIcon, SunIcon, MoonIcon } from './icons';
import SidebarBookingForm from './SidebarBookingForm';
import LanguageSwitcher from './LanguageSwitcher';
import { useTheme } from '../hooks/useTheme';

interface NavLink {
    name: string;
    href: string;
    icon?: React.ReactNode;
    action: () => void;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    navLinks: NavLink[];
    onNavLinkClick: (action: () => void, href?: string) => void;
    currentUser: UserData | null;
    services: Service[];
    doctors: Doctor[];
    isDoctorsLoading?: boolean;
    onBookingComplete: (data: Omit<Appointment, 'id' | 'status'>) => void;
    onGoToAuth: () => void;
    onLogout: () => void;
    onGoToAccount: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    navLinks,
    onNavLinkClick,
    currentUser,
    services,
    doctors,
    isDoctorsLoading = false,
    onBookingComplete,
    onGoToAuth,
    onLogout,
    onGoToAccount,
}) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [mode, setMode] = useState<'nav' | 'booking'>('nav');
    const overlay = useOverlayMotion(isOpen, onClose);
    useEffect(() => { if (!overlay.mounted) setMode('nav'); }, [overlay.mounted]);

    const handleLinkClick = (link: NavLink) => {
        onNavLinkClick(link.action, link.href);
        onClose();
    };

    const handleBookingClick = () => {
        if (currentUser) {
            setMode('booking');
        } else {
            onGoToAuth();
            onClose();
        }
    };

    const handleBookingComplete = (data: Omit<Appointment, 'id' | 'status'>) => {
        onBookingComplete(data);
        onClose();
    }

    if (!overlay.mounted) {
        return null;
    }

    return (
        <div
            ref={overlay.ref}
            data-open={overlay.visible}
            aria-hidden={!isOpen}
            className="site-overlay fixed inset-0 z-[100]"
            aria-labelledby="slide-over-title"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="site-overlay-backdrop absolute inset-0"
                onClick={onClose}
            ></div>

            <div data-side="left" className="site-overlay-panel fixed inset-y-0 left-0 flex max-w-full pr-10">
                <div className="relative w-screen max-w-sm">
                    <button
                        type="button"
                        className={`absolute top-[max(env(safe-area-inset-top,0px),1rem)] right-0 -mr-12 p-2 rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card focus:outline-none transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                        onClick={onClose}
                    >
                        <span className="sr-only">{t('common.close')}</span>
                        <CloseIcon className="h-7 w-7" aria-hidden="true" />
                    </button>

                    <div className="flex h-full flex-col overflow-y-auto overscroll-contain bg-[rgba(255,255,255,0.7)] text-foreground pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] shadow-[24px_0_48px_-12px_rgba(0,0,0,0.1)] backdrop-blur-2xl border-r border-white/60 dark:bg-[rgba(15,23,34,0.65)] dark:border-white/10 dark:shadow-[24px_0_48px_-12px_rgba(0,0,0,0.5)] [-webkit-overflow-scrolling:touch]">
                        <div className="px-4 sm:px-6">
                            {mode === 'nav' ? (
                                <h2 className="text-2xl font-bold text-black dark:text-white font-heading text-center">
                                    Thế Giới Trị Mụn
                                </h2>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setMode('nav')}
                                        className="p-1 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all-smooth btn-press"
                                        aria-label={t('common.back')}
                                    >
                                        <ArrowLeftIcon className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-xl font-bold text-primary font-heading">
                                        {t('nav.book_appointment')}
                                    </h2>
                                </div>
                            )}
                        </div>
                        <div className="relative mt-6 flex-1 px-4 sm:px-6 flex flex-col">
                            {mode === 'nav' ? (
                                <nav className="flex flex-col space-y-2">
                                    {navLinks.map((link, index) => (
                                        <button
                                            key={link.name}
                                            onClick={() => handleLinkClick(link)}
                                            className="flex items-center text-lg text-left hover:bg-accent p-3 rounded-md transition-all-smooth font-medium"
                                        >
                                            {link.icon && <span className="mr-4 shrink-0 text-primary">{link.icon}</span>}
                                            <span>{link.name}</span>
                                        </button>
                                    ))}
                                    <div className="h-px bg-border my-2"></div>
                                    <div className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
                                                title={t('account.light', 'Sáng')}
                                            >
                                                <SunIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
                                                title={t('account.dark', 'Tối')}
                                            >
                                                <MoonIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <LanguageSwitcher />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (currentUser) {
                                                onGoToAccount();
                                            } else {
                                                onGoToAuth();
                                            }
                                            onClose();
                                        }}
                                        className="flex items-center text-lg text-left hover:bg-accent p-3 rounded-md transition-all-smooth font-medium"
                                    >
                                        <span className="mr-4 shrink-0 text-primary"><UserIcon className="w-6 h-6" /></span>
                                        <span>{currentUser ? t('nav.account', 'Tài Khoản') : t('auth.login', 'Đăng nhập')}</span>
                                    </button>
                                    {currentUser && (
                                        <button
                                            onClick={() => {
                                                onLogout();
                                                onClose();
                                            }}
                                            className="flex items-center text-lg text-left hover:bg-accent p-3 rounded-md transition-all-smooth font-medium text-destructive"
                                        >
                                            <span className="mr-4 shrink-0"><LogoutIcon className="w-6 h-6" /></span>
                                            <span>{t('auth.logout', 'Đăng xuất')}</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={handleBookingClick}
                                        className="mt-4 w-full text-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-5 rounded-full transition-all-smooth shadow-md hover:shadow-lg btn-press"
                                    >
                                        {t('nav.book_appointment')}
                                    </button>
                                </nav>
                            ) : (
                                isDoctorsLoading && doctors.length === 0 ? (
                                    <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
                                        Đang tải danh sách bác sĩ...
                                    </div>
                                ) : (
                                    <SidebarBookingForm
                                        services={services}
                                        doctors={doctors}
                                        onComplete={handleBookingComplete}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
