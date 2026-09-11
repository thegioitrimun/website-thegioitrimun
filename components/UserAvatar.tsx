


import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon, ProfileIcon, MedicalRecordIcon, CalendarIcon, DocumentDuplicateIcon, LogoutIcon, HeartIcon, CogIcon, ReceiptIcon } from './icons';
import type { UserData } from '../types';

type UserPage = 'administrativeProfile' | 'medicalRecords' | 'myMedicalRecords' | 'appointments' | 'wishlist' | 'adminDashboard' | 'adminVatManagement' | 'orderHistory';

interface UserAvatarProps {
  user: UserData | null;
  onGoToAuth: () => void;
  onLogout: () => void;
  onNavigate: (page: { page: UserPage }) => void;
}


const UserAvatar: React.FC<UserAvatarProps> = ({ user, onGoToAuth, onLogout, onNavigate }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigation = (page: UserPage) => {
    onNavigate({ page });
    closeDropdown();
  };

  const handleAuthAction = () => {
    if (user) {
      onLogout();
    } else {
      onGoToAuth();
    }
    closeDropdown();
  };

  const loggedInMenuItems = [
    { label: t('profile.personal_info'), action: () => handleNavigation('administrativeProfile'), icon: <ProfileIcon className="w-5 h-5" /> },
    { label: t('orders.my_orders'), action: () => handleNavigation('orderHistory'), icon: <ReceiptIcon className="w-5 h-5" /> },
    { label: t('wishlist.title'), action: () => handleNavigation('wishlist'), icon: <HeartIcon className="w-5 h-5" /> },
    { label: t('records.title'), action: () => handleNavigation('myMedicalRecords'), icon: <DocumentDuplicateIcon className="w-5 h-5" /> },
    { label: t('medical.clinic_records'), action: () => handleNavigation('medicalRecords'), icon: <MedicalRecordIcon className="w-5 h-5" /> },
    { label: t('appointments.title'), action: () => handleNavigation('appointments'), icon: <CalendarIcon className="w-5 h-5" /> },
  ];

  const adminMenuItems = [
    {
      label: user?.profile.role === 'accountant' ? 'Kế toán VAT' : t('nav.admin_dashboard'),
      action: () => {
        closeDropdown();
        window.location.href = user?.profile.role === 'accountant' ? '/admin/vat' : '/admin';
      },
      icon: <CogIcon className="w-5 h-5" />,
    },
  ];

  const triggerClass = `utility-trigger h-10 w-10 shrink-0 overflow-hidden p-0 cursor-pointer touch-manipulation select-none ${isOpen ? 'is-active' : ''}`;

  const MenuContent = () => (
    <>
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-popover-foreground">{user ? user.profile.name : t('profile.guest')}</p>
        <p className="text-sm text-muted-foreground truncate">{user ? user.profile.email : t('common.login_required')}</p>
      </div>
      {user && (
        <div className="space-y-1 p-1.5">
          {loggedInMenuItems.map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={item.action}
              className="utility-popover-item text-popover-foreground cursor-pointer touch-manipulation"
              role="menuitem"
            >
              <span className="text-muted-foreground pointer-events-none">{item.icon}</span>
              <span className="pointer-events-none">{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {user && ['admin', 'master_admin', 'accountant'].includes(user.profile.role) && (
        <div className="border-t border-border p-1.5">
          {adminMenuItems.map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={item.action}
              className="utility-popover-item text-popover-foreground cursor-pointer touch-manipulation"
              role="menuitem"
            >
              <span className="text-muted-foreground pointer-events-none">{item.icon}</span>
              <span className="pointer-events-none">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-1.5">
        <button
          type="button"
          onClick={handleAuthAction}
          className="utility-popover-item text-destructive hover:bg-destructive/10 cursor-pointer touch-manipulation"
          role="menuitem"
        >
          <LogoutIcon className="w-5 h-5 text-destructive pointer-events-none" />
          <span className="pointer-events-none">{user ? t('common.logout') : t('common.login')}</span>
        </button>
      </div>
    </>
  );

  if (!user) {
    return (
      <button
        type="button"
        onClick={onGoToAuth}
        aria-label={t('common.login')}
        title={t('common.login')}
        className={`hidden md:inline-flex ${triggerClass}`}
      >
        <UserIcon className="utility-trigger-icon pointer-events-none" />
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
        aria-label={t('common.open_user_menu')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t('common.user_account')}
      >
        {user && user.profile.avatar_url ? (
          <img src={user.profile.avatar_url} alt={user.profile.name} className="pointer-events-none block h-full w-full object-cover" />
        ) : (
          <UserIcon className="utility-trigger-icon pointer-events-none" />
        )}
      </button>

      {/* --- Desktop Popover --- */}
      <div
        className={`utility-popover absolute right-0 mt-2 w-72 text-popover-foreground z-[90] transition-all duration-200 ease-custom-bezier transform-origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        role="menu"
        aria-orientation="vertical"
      >
        <MenuContent />
      </div>
    </div>
  );
};

export default UserAvatar;
