import React from 'react';

interface ContactButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const ContactButton: React.FC<ContactButtonProps> = ({
  onClick,
  className = '',
  label = 'Liên hệ ngay',
}) => {
  const baseClass =
    'mt-10 inline-flex min-h-14 items-center gap-3 rounded-full border border-white/50 bg-white/20 backdrop-blur-2xl px-10 py-4 font-sans text-[15px] font-bold text-white shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/30 hover:border-white/80 hover:shadow-[0_18px_48px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.6)] focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-4 focus:ring-offset-[#0C0C0C] animate-fade-rise-delay-2 sm:mt-12 sm:px-12 sm:text-base cursor-pointer select-none';

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {label}
    </button>
  );
};

interface LiveProjectButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const LiveProjectButton: React.FC<LiveProjectButtonProps> = ({
  onClick,
  className = '',
  label = 'Xem dự án',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA] font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base hover:bg-[#D7E2EA]/10 transition-colors duration-200 inline-flex items-center justify-center cursor-pointer select-none ${className}`}
    >
      {label}
    </button>
  );
};
