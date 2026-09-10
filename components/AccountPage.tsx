import React from 'react';
import { useTranslation } from 'react-i18next';
import type { UserData } from '../types';
import { useTheme } from '../hooks/useTheme';
import { ColorTheme } from '../contexts/ThemeContext';
import { useFont } from '../hooks/useFont';
import { FONT_OPTIONS, Font } from '../contexts/FontContext';
import {
  UserIcon, ProfileIcon, MedicalRecordIcon, CalendarIcon, DocumentDuplicateIcon,
  SunIcon, MoonIcon, SystemIcon, CheckIcon, ChevronDownIcon,
  HeartIcon, CogIcon, ReceiptIcon
} from './icons';

type UserPage = 'administrativeProfile' | 'medicalRecords' | 'myMedicalRecords' | 'appointments' | 'wishlist' | 'adminDashboard' | 'adminVatManagement' | 'orderHistory';

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

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center w-full text-left p-3.5 sm:p-4 hover:bg-muted/30 active:bg-muted/50 transition-colors group"
  >
    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0 mr-3.5">
      {icon}
    </div>
    <span className="flex-grow text-xs sm:text-sm font-semibold text-foreground tracking-tight">{label}</span>
    <ChevronDownIcon className="w-4 h-4 text-muted-foreground -rotate-90 shrink-0 group-hover:translate-x-0.5 transition-transform" />
  </button>
);

const AccountPage: React.FC<AccountPageProps> = ({ user, onNavigate, onLogout }) => {
  const { t } = useTranslation();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { font, setFont } = useFont();

  const loggedInMenuItems = [
    { label: t('account.profile'), onClick: () => onNavigate({ page: 'administrativeProfile' }), icon: <ProfileIcon className="w-5 h-5" /> },
    { label: t('account.orders'), onClick: () => onNavigate({ page: 'orderHistory' }), icon: <ReceiptIcon className="w-5 h-5" /> },
    { label: t('account.wishlist'), onClick: () => onNavigate({ page: 'wishlist' }), icon: <HeartIcon className="w-5 h-5" /> },
    { label: t('account.my_records'), onClick: () => onNavigate({ page: 'myMedicalRecords' }), icon: <DocumentDuplicateIcon className="w-5 h-5" /> },
    { label: t('account.medical_records'), onClick: () => onNavigate({ page: 'medicalRecords' }), icon: <MedicalRecordIcon className="w-5 h-5" /> },
    { label: t('account.appointments'), onClick: () => onNavigate({ page: 'appointments' }), icon: <CalendarIcon className="w-5 h-5" /> },
  ];

  const adminMenuItem = {
    label: user?.profile.role === 'accountant' ? 'Kế toán VAT' : t('account.admin'),
    onClick: () => {
      window.location.href = user?.profile.role === 'accountant' ? '/admin/vat' : '/admin';
    },
    icon: <CogIcon className="w-5 h-5" />,
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* User Header Card */}
        <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden shrink-0 ring-4 ring-primary/20 shadow-md">
            {user && user.profile.avatar_url ? (
              <img loading="lazy" src={user.profile.avatar_url} alt={user.profile.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-7 h-7 sm:w-8 sm:h-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate font-heading">{user ? user.profile.name : t('account.guest')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{user ? user.profile.email : t('account.welcome')}</p>
            {user?.profile.role && ['admin', 'master_admin', 'accountant'].includes(user.profile.role) && (
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {user.profile.role}
              </span>
            )}
          </div>
        </div>

        {/* Menu Navigation Card */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 overflow-hidden">
          {user ? (
            <>
              <div className="divide-y divide-border/30">
                {loggedInMenuItems.map(item => <MenuItem key={item.label} {...item} />)}
                {['admin', 'master_admin', 'accountant'].includes(user.profile.role) && <MenuItem {...adminMenuItem} />}
              </div>
              <div className="p-3.5 sm:p-4 border-t border-border/30 bg-muted/10">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full text-center py-2.5 sm:py-3 font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl transition-colors btn-press text-xs sm:text-sm"
                >
                  {t('common.logout')}
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center space-y-4">
              <p className="text-xs sm:text-sm text-muted-foreground">{t('account.login_prompt')}</p>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'auth' })}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 px-8 text-sm shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 btn-press"
              >
                {t('account.login_register')}
              </button>
            </div>
          )}
        </div>

        {/* Settings Card */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 p-4 sm:p-6 space-y-5">
          <h2 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">{t('account.settings')}</h2>

          <div className="space-y-4">
            {/* Theme Mode */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t('account.theme_mode')}</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl transition-all text-xs font-semibold ${
                    theme === 'light'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background/40 hover:bg-background/70 border border-white/50 text-foreground dark:border-white/10'
                  }`}
                >
                  <SunIcon className="w-4 h-4" /> <span>{t('account.light')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl transition-all text-xs font-semibold ${
                    theme === 'dark'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background/40 hover:bg-background/70 border border-white/50 text-foreground dark:border-white/10'
                  }`}
                >
                  <MoonIcon className="w-4 h-4" /> <span>{t('account.dark')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl transition-all text-xs font-semibold ${
                    theme === 'system'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background/40 hover:bg-background/70 border border-white/50 text-foreground dark:border-white/10'
                  }`}
                >
                  <SystemIcon className="w-4 h-4" /> <span>{t('account.system')}</span>
                </button>
              </div>
            </div>

            {/* Color Theme */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t('account.color')}</h4>
              <div className="grid grid-cols-8 gap-2">
                {THEMES.map((themeInfo) => (
                  <button
                    type="button"
                    key={themeInfo.name}
                    onClick={() => setColorTheme(themeInfo.name)}
                    className={`w-full aspect-square rounded-full flex items-center justify-center transition-all-smooth btn-press focus:outline-none ring-offset-2 ring-primary focus:ring-2 ${
                      colorTheme === themeInfo.name
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-sm'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: themeInfo.color }}
                    title={themeInfo.name.charAt(0).toUpperCase() + themeInfo.name.slice(1)}
                  >
                    {colorTheme === themeInfo.name && <CheckIcon className="w-4 h-4 text-white drop-shadow-sm" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t('account.font')}</h4>
              <select
                onChange={(e) => setFont(e.target.value as Font)}
                value={font}
                className="w-full admin-glass-input py-2.5 text-xs sm:text-sm"
                style={{ fontFamily: FONT_OPTIONS[font].stack }}
              >
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
