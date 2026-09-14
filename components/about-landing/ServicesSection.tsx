import React, { useState } from 'react';
import { motion } from 'motion/react';

interface LogoItem {
  name: string;
  src: string;
  alt: string;
  gradient: {
    from: string;
    to: string;
  };
  fallback?: string;
}

const LOGOS: LogoItem[] = [
  {
    name: 'Deep Blue Health',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589578249-6a4a8e4f.webp',
    alt: 'Deep Blue Health',
    gradient: { from: '#0284c7', to: '#38bdf8' },
    fallback: '/r2/site-assets/brands/brand-1773589578249-6a4a8e4f.webp',
  },
  {
    name: 'DermEden',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589639911-91e64315.webp',
    alt: 'DermEden',
    gradient: { from: '#4338ca', to: '#6366f1' },
    fallback: '/r2/site-assets/brands/brand-1773589639911-91e64315.webp',
  },
  {
    name: 'Aromase',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589486791-d8dbe957.webp',
    alt: 'Aromase',
    gradient: { from: '#059669', to: '#10b981' },
    fallback: '/r2/site-assets/brands/brand-1773589486791-d8dbe957.webp',
  },
  {
    name: 'Biohoney',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589527829-88f7ad6b.webp',
    alt: 'Biohoney',
    gradient: { from: '#d97706', to: '#fbbf24' },
    fallback: '/r2/site-assets/brands/brand-1773589527829-88f7ad6b.webp',
  },
  {
    name: 'Kolorex',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589810023-c9cbfe75.webp',
    alt: 'Kolorex',
    gradient: { from: '#e11d48', to: '#fb7185' },
    fallback: '/r2/site-assets/brands/brand-1773589810023-c9cbfe75.webp',
  },
  {
    name: 'Age No More',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773587255673-bd9d46dd.webp',
    alt: 'Age No More',
    gradient: { from: '#7c3aed', to: '#a855f7' },
    fallback: '/r2/site-assets/brands/brand-1773587255673-bd9d46dd.webp',
  },
  {
    name: 'Living Nature',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589789570-15696963.webp',
    alt: 'Living Nature',
    gradient: { from: '#65a30d', to: '#84cc16' },
    fallback: '/r2/site-assets/brands/brand-1773589789570-15696963.webp',
  },
  {
    name: 'Madeleine Ritchie',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590004391-c7510eb8.webp',
    alt: 'Madeleine Ritchie',
    gradient: { from: '#ea580c', to: '#f59e0b' },
    fallback: '/r2/site-assets/brands/brand-1773590004391-c7510eb8.webp',
  },
  {
    name: 'Lavior',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589736420-f502744d.webp',
    alt: 'Lavior',
    gradient: { from: '#0891b2', to: '#06b6d4' },
    fallback: '/r2/site-assets/brands/brand-1773589736420-f502744d.webp',
  },
  {
    name: 'Scarguard',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589928900-561b2e60.webp',
    alt: 'Scarguard',
    gradient: { from: '#1d4ed8', to: '#3b82f6' },
    fallback: '/r2/site-assets/brands/brand-1773589928900-561b2e60.webp',
  },
  {
    name: 'Earth’s Kitchen',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590028128-e0152934.webp',
    alt: 'Earth’s Kitchen',
    gradient: { from: '#15803d', to: '#22c55e' },
    fallback: '/r2/site-assets/brands/brand-1773590028128-e0152934.webp',
  },
  {
    name: 'Harker Herbals',
    src: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590079044-949f2a7c.webp',
    alt: 'Harker Herbals',
    gradient: { from: '#c2410c', to: '#f97316' },
    fallback: '/r2/site-assets/brands/brand-1773590079044-949f2a7c.webp',
  },
];

export const ServicesSection: React.FC = () => {
  const [inciText, setInciText] = useState('');

  const handleAnalyze = () => {
    if (!inciText.trim()) return;
    try {
      sessionStorage.setItem('ingredient_analyzer_query', inciText.trim());
    } catch {
      // ignore
    }
    window.location.href = '/phan-tich-thanh-phan';
  };

  // Render the list twice inline to ensure a seamless loop
  const duplicatedLogos = [...LOGOS, ...LOGOS];

  return (
    <section
      id="services"
      className="relative w-full bg-[#f9fafb] text-[#0a1b33] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-4 sm:px-6 md:px-10 py-16 sm:py-20 md:py-24 z-10 overflow-hidden"
    >
      {/* 2. Main Hero Container */}
      <div className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] flex flex-col">
        {/* Background Video Layer */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-105 transition-transform duration-1000"
          />
        </div>

        {/* 3. Hero Text Content */}
        <div className="z-20 flex-1 px-5 sm:px-8 md:px-16 pt-7 sm:pt-10 md:pt-16 flex flex-col items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start max-w-2xl"
          >
            {/* Headline: Concise on mobile, full on desktop */}
            <h2 className="font-heading font-bold text-[24px] sm:text-[34px] md:text-[50px] leading-[1.12] sm:leading-[1.08] tracking-tight text-[#0a1b33] mb-2 sm:mb-3">
              <span className="sm:hidden">
                Phân tích thành phần INCI
              </span>
              <span className="hidden sm:inline">
                Phân tích thành phần INCI<br />chuẩn y khoa da liễu
              </span>
            </h2>

            {/* Subheadline: Short on mobile to prevent collision with textarea */}
            <p className="font-sans text-[12px] sm:text-[14px] md:text-[15px] leading-relaxed text-[#64748b] max-w-xl mb-3 sm:mb-6">
              <span className="sm:hidden">
                Kiểm tra độ an toàn & mức phù hợp theo từng loại da.
              </span>
              <span className="hidden sm:inline">
                Tra cứu độ an toàn, cảnh báo rủi ro kích ứng và kiểm tra mức độ phù hợp với làn da của bạn dựa trên cơ sở khoa học.
              </span>
            </p>

            <motion.button
              type="button"
              onClick={() => {
                const el = document.getElementById('hero-inci-textarea');
                if (el) {
                  el.focus();
                } else {
                  window.location.href = '/phan-tich-thanh-phan';
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="bg-[#0a152d] text-white rounded-full px-5 py-2 sm:px-7 sm:py-3 text-[12px] sm:text-[14px] font-medium transition-colors shadow-md hover:bg-[#13274f] cursor-pointer mb-2 sm:mb-0"
            >
              Phân tích thành phần
            </motion.button>
          </motion.div>
        </div>

        {/* 4. Bottom Floating INCI Textarea */}
        <div className="absolute bottom-3 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 w-[94%] sm:w-[500px] md:w-[560px] max-w-[580px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full rounded-[22px] sm:rounded-[26px] bg-white/90 backdrop-blur-2xl p-1 sm:p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.08)] border border-slate-200/50"
          >
            <textarea
              id="hero-inci-textarea"
              rows={3}
              value={inciText}
              onChange={(e) => setInciText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && inciText.trim()) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
              placeholder="Dán hoặc gõ bảng thành phần mỹ phẩm (INCI) tại đây... Ví dụ: Water, Niacinamide, Glycerin, Salicylic Acid, Centella Asiatica Extract, Retinol, Sodium Hyaluronate..."
              className="w-full resize-none rounded-[18px] sm:rounded-[22px] border-0 bg-black/[0.03] p-3 sm:p-4 text-xs sm:text-sm font-medium leading-relaxed text-foreground placeholder:text-muted-foreground/70 shadow-inner backdrop-blur-md focus:bg-white/95 focus:outline-none focus:ring-2 focus:ring-primary/25 dark:bg-white/[0.05] dark:text-white dark:focus:bg-white/[0.08]"
            />
            {inciText.trim() && (
              <button
                type="button"
                onClick={handleAnalyze}
                className="absolute bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 sm:px-4 sm:py-1.5 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-105 active:scale-95 cursor-pointer"
              >
                <span>Phân tích ngay</span>
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* 5. Seamless Marquee Logo Scroller Component */}
      <div
        className="mt-10 w-full overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="flex w-max gap-4 py-4 animate-marquee-infinite">
          {duplicatedLogos.map((logo, idx) => (
            <div
              key={`${logo.name}-${idx}`}
              className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-0.5 cursor-pointer select-none"
            >
              {/* Subtle colored glow strictly contained within marquee bounds */}
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-35 transition-all duration-300 blur-sm pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.to})`,
                }}
              />

              {/* White card container base with softer, gentle shadow */}
              <div className="absolute inset-0 rounded-full bg-white border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] group-hover:border-slate-200/80 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300" />

              {/* Brand Logo - maximized size within bounds, original colors */}
              <img
                src={logo.src}
                alt={logo.alt}
                className="relative z-10 max-h-[66px] max-w-[128px] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105 select-none"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (logo.fallback && target.src !== logo.fallback) {
                    target.src = logo.fallback;
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
