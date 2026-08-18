import React from 'react';
import type { FooterContent } from '../types';
import { normalizeExternalUrl } from '../src/socialLinks';

interface FloatingContactButtonsProps {
  footerContent: FooterContent | null;
}

const getDigits = (value?: string) => (value || '').replace(/\D/g, '');

const deriveMessengerUrl = (footerContent: FooterContent) => {
  const explicitUrl = normalizeExternalUrl(footerContent.messenger_url);
  if (explicitUrl) return explicitUrl;

  const facebookUrl = normalizeExternalUrl(footerContent.facebook_url);
  if (!facebookUrl) return '';

  try {
    const parsed = new URL(facebookUrl);
    const pageHandle = parsed.pathname.split('/').filter(Boolean)[0];
    if (pageHandle && pageHandle !== 'profile.php') {
      return `https://m.me/${pageHandle}`;
    }
  } catch {
    return facebookUrl;
  }

  return facebookUrl;
};

const MessengerMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
    <defs>
      <linearGradient id="messenger-gradient" x1="8" x2="40" y1="42" y2="6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#006AFF" />
        <stop offset="0.52" stopColor="#A033FF" />
        <stop offset="1" stopColor="#FF5280" />
      </linearGradient>
    </defs>
    <path fill="url(#messenger-gradient)" d="M24 5.5C13.6 5.5 5.5 13.1 5.5 23.3c0 5.3 2.2 9.8 5.9 13v6.2l5.4-3c2.2.9 4.6 1.4 7.2 1.4 10.4 0 18.5-7.6 18.5-17.8S34.4 5.5 24 5.5Z" />
    <path fill="#fff" d="m12.9 28.5 9.4-10 4.9 5.2 8-5.2-9.3 9.9-5-5.1-8 5.2Z" />
  </svg>
);

const FloatingContactButtons: React.FC<FloatingContactButtonsProps> = ({ footerContent }) => {
  if (!footerContent || footerContent.floating_contact_enabled === false) return null;

  const phoneDigits = getDigits(footerContent.phone);
  const zaloUrl = normalizeExternalUrl(footerContent.zalo_url) || (phoneDigits ? `https://zalo.me/${phoneDigits}` : '');
  const messengerUrl = deriveMessengerUrl(footerContent);

  const buttons = [
    zaloUrl
      ? {
          key: 'zalo',
          label: 'Chat Zalo',
          href: zaloUrl,
          className: 'bg-white shadow-[0_18px_36px_-18px_rgba(0,104,255,0.62)] ring-1 ring-[#0068ff]/15 hover:bg-[#f7fbff]',
          icon: <img src="/icons/zalo-icon.png" alt="" className="h-9 w-9 object-contain" />,
        }
      : null,
    messengerUrl
      ? {
          key: 'messenger',
          label: 'Chat Messenger',
          href: messengerUrl,
          className: 'bg-white text-[#0A7CFF] shadow-[0_18px_36px_-18px_rgba(39,101,255,0.5)] ring-1 ring-border hover:bg-[#f7fbff]',
          icon: <MessengerMark className="h-8 w-8" />,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string; className: string; icon: React.ReactNode }>;

  if (buttons.length === 0) return null;

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-4 z-50 flex flex-col gap-3 md:bottom-6 md:right-6"
      aria-label="Kênh chat nhanh"
    >
      {buttons.map((button) => (
        <a
          key={button.key}
          href={button.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={button.label}
          title={button.label}
          className={`group relative flex h-13 w-13 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 md:h-14 md:w-14 ${button.className}`}
        >
          {button.icon}
          <span className="pointer-events-none absolute right-full mr-3 hidden rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 md:block">
            {button.label.replace('Chat ', '')}
          </span>
        </a>
      ))}
    </div>
  );
};

export default FloatingContactButtons;
