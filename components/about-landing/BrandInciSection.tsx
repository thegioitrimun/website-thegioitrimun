import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface BrandLogoItem {
  name: string;
  src: string;
  alt: string;
  fallback?: string;
  gradient: {
    from: string;
    to: string;
  };
}

const BRAND_LOGOS: BrandLogoItem[] = [
  {
    name: 'Deep Blue Health',
    src: '/r2/site-assets/brands/brand-1773589578249-6a4a8e4f.webp',
    alt: 'Deep Blue Health',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589578249-6a4a8e4f.webp',
    gradient: { from: 'rgb(2, 132, 199)', to: 'rgb(56, 189, 248)' },
  },
  {
    name: 'DermEden',
    src: '/r2/site-assets/brands/brand-1773589639911-91e64315.webp',
    alt: 'DermEden',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589639911-91e64315.webp',
    gradient: { from: 'rgb(67, 56, 202)', to: 'rgb(99, 102, 241)' },
  },
  {
    name: 'Aromase',
    src: '/r2/site-assets/brands/brand-1773589486791-d8dbe957.webp',
    alt: 'Aromase',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589486791-d8dbe957.webp',
    gradient: { from: 'rgb(5, 150, 105)', to: 'rgb(16, 185, 129)' },
  },
  {
    name: 'Biohoney',
    src: '/r2/site-assets/brands/brand-1773589527829-88f7ad6b.webp',
    alt: 'Biohoney',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589527829-88f7ad6b.webp',
    gradient: { from: 'rgb(217, 119, 6)', to: 'rgb(251, 191, 36)' },
  },
  {
    name: 'Kolorex',
    src: '/r2/site-assets/brands/brand-1773589810023-c9cbfe75.webp',
    alt: 'Kolorex',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589810023-c9cbfe75.webp',
    gradient: { from: 'rgb(225, 29, 72)', to: 'rgb(251, 113, 133)' },
  },
  {
    name: 'Age No More',
    src: '/r2/site-assets/brands/brand-1773587255673-bd9d46dd.webp',
    alt: 'Age No More',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773587255673-bd9d46dd.webp',
    gradient: { from: 'rgb(124, 58, 237)', to: 'rgb(168, 85, 247)' },
  },
  {
    name: 'Living Nature',
    src: '/r2/site-assets/brands/brand-1773589789570-15696963.webp',
    alt: 'Living Nature',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589789570-15696963.webp',
    gradient: { from: 'rgb(101, 163, 13)', to: 'rgb(132, 204, 22)' },
  },
  {
    name: 'Madeleine Ritchie',
    src: '/r2/site-assets/brands/brand-1773590004391-c7510eb8.webp',
    alt: 'Madeleine Ritchie',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590004391-c7510eb8.webp',
    gradient: { from: 'rgb(234, 88, 12)', to: 'rgb(245, 158, 11)' },
  },
  {
    name: 'Lavior',
    src: '/r2/site-assets/brands/brand-1773589736420-f502744d.webp',
    alt: 'Lavior',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589736420-f502744d.webp',
    gradient: { from: 'rgb(8, 145, 178)', to: 'rgb(6, 182, 212)' },
  },
  {
    name: 'Scarguard',
    src: '/r2/site-assets/brands/brand-1773589928900-561b2e60.webp',
    alt: 'Scarguard',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773589928900-561b2e60.webp',
    gradient: { from: 'rgb(29, 78, 216)', to: 'rgb(59, 130, 246)' },
  },
  {
    name: 'Earth’s Kitchen',
    src: '/r2/site-assets/brands/brand-1773590028128-e0152934.webp',
    alt: 'Earth’s Kitchen',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590028128-e0152934.webp',
    gradient: { from: 'rgb(21, 128, 61)', to: 'rgb(34, 197, 94)' },
  },
  {
    name: 'Harker Herbals',
    src: '/r2/site-assets/brands/brand-1773590079044-949f2a7c.webp',
    alt: 'Harker Herbals',
    fallback: 'https://thegioitrimun.vn/r2/site-assets/brands/brand-1773590079044-949f2a7c.webp',
    gradient: { from: 'rgb(194, 65, 12)', to: 'rgb(249, 115, 22)' },
  },
];

export const BrandInciSection: React.FC = () => {
  const [inciText, setInciText] = useState('');

  // Duplicate the logos array so marquee can scroll infinitely seamlessly
  const duplicatedLogos = [...BRAND_LOGOS, ...BRAND_LOGOS];

  const handleAnalyze = () => {
    if (!inciText.trim()) return;
    const searchParams = new URLSearchParams({
      ingredients: inciText.trim(),
    });
    window.location.href = `/phan-tich-thanh-phan?${searchParams.toString()}`;
  };

  return (
    <section
      id="brand-inci"
      className="relative w-full bg-[#FFFFFF] text-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 md:pt-24 pb-20 sm:pb-28 md:pb-32 z-0 select-none"
    >
      {/* 1. Main Hero Video Container */}
      <div className="relative w-full max-w-6xl mx-auto h-[480px] sm:h-[520px] md:h-[560px] rounded-[28px] sm:rounded-[36px] md:rounded-[44px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-200/80 bg-slate-100 flex flex-col justify-between select-none">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          src="/videos/about/hero-epoch.mp4"
        />

        {/* Subtle Gradient Overlays for High Text Contrast */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.78) 32%, rgba(255, 255, 255, 0.2) 65%, rgba(255, 255, 255, 0.7) 100%)',
          }}
        />

        {/* 3. Hero Content */}
        <div className="relative z-20 flex-1 px-5 sm:px-8 md:px-16 pt-7 sm:pt-12 md:pt-16 flex flex-col items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start max-w-2xl"
          >
            {/* Small pill tag for high-end polish on mobile */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 backdrop-blur-md">
              <span className="text-[10px]">✦</span>
              <span>Chuẩn y khoa da liễu</span>
            </div>

            {/* Headline: Concise on mobile, full on desktop */}
            <h2 className="font-heading font-bold text-[22px] sm:text-[34px] md:text-[50px] leading-[1.2] sm:leading-[1.08] tracking-tight text-[#0a1b33] mb-2 sm:mb-3">
              <span className="sm:hidden">
                Phân tích thành phần INCI
              </span>
              <span className="hidden sm:inline">
                Phân tích thành phần INCI<br />chuẩn y khoa da liễu
              </span>
            </h2>

            {/* Subheadline: Clear contrast and legible font on mobile */}
            <p className="font-sans text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed text-slate-600 sm:text-[#64748b] max-w-xl mb-3.5 sm:mb-6">
              <span className="sm:hidden">
                Kiểm tra độ an toàn & mức độ phù hợp theo từng loại da.
              </span>
              <span className="hidden sm:inline">
                Tra cứu độ an toàn, cảnh báo rủi ro kích ứng và kiểm tra mức độ phù hợp với làn da của bạn dựa trên cơ sở khoa học.
              </span>
            </p>

            <motion.button
              type="button"
              onClick={() => {
                if (inciText.trim()) {
                  handleAnalyze();
                } else {
                  const el = document.getElementById('hero-inci-textarea');
                  if (el) {
                    el.focus();
                  } else {
                    window.location.href = '/phan-tich-thanh-phan';
                  }
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="inline-flex items-center gap-1.5 bg-[#0a152d] text-white rounded-full px-5 py-2.5 sm:px-7 sm:py-3 text-[12px] sm:text-[14px] font-medium transition-colors shadow-md hover:bg-[#13274f] cursor-pointer"
            >
              <span className="sm:hidden">Tra cứu ngay</span>
              <span className="hidden sm:inline">Phân tích thành phần</span>
              <svg className="w-3.5 h-3.5 sm:hidden opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.button>
          </motion.div>
        </div>

        {/* 4. Bottom Floating INCI Textarea */}
        <div className="absolute bottom-3 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 w-[92%] sm:w-[500px] md:w-[560px] max-w-[580px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full rounded-[22px] sm:rounded-[28px] bg-[rgba(15,23,34,0.78)] lg:bg-[rgba(15,23,34,0.74)] backdrop-blur-md shadow-[0_24px_52px_-38px_rgba(4,10,24,0.58)] lg:shadow-[0_30px_64px_-38px_rgba(4,10,24,0.64)] border border-white/10 p-1 sm:p-1.5 overflow-hidden"
          >
            {/* Ambient glow matching ProjectsSection */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px] sm:rounded-[28px]">
              <div className="absolute -left-10 top-0 h-44 w-44 rounded-full bg-[#ff7f5d]/12 blur-3xl" />
              <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#35b7a5]/15 blur-3xl" />
            </div>

            <div className="relative z-10 w-full">
              <textarea
                id="hero-inci-textarea"
                rows={2}
                value={inciText}
                onChange={(e) => setInciText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && inciText.trim()) {
                    e.preventDefault();
                    handleAnalyze();
                  }
                }}
                placeholder="Dán hoặc gõ bảng thành phần mỹ phẩm (INCI) tại đây... Ví dụ: Water, Niacinamide, Glycerin, Salicylic Acid, Centella Asiatica Extract, Retinol, Sodium Hyaluronate..."
                className="w-full resize-none rounded-[18px] sm:rounded-[24px] border border-white/10 bg-white/[0.06] p-3 sm:p-4 text-xs sm:text-sm font-medium leading-relaxed text-[#D7E2EA] placeholder:text-[#D7E2EA]/50 shadow-inner backdrop-blur-md focus:bg-white/[0.1] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#35b7a5]/30 transition-all"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* 5. Seamless Marquee Logo Scroller Component */}
      <div
        className="mt-6 sm:mt-10 w-full overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="flex w-max gap-2.5 sm:gap-4 py-2.5 sm:py-4 animate-marquee-infinite">
          {duplicatedLogos.map((logo, idx) => (
            <div
              key={`${logo.name}-${idx}`}
              className="group relative h-16 w-28 sm:h-20 sm:w-36 md:h-24 md:w-40 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-0.5 cursor-pointer select-none"
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

              {/* Brand Logo - maximized size within bounds, scaled down proportionally on mobile */}
              <img
                src={logo.src}
                alt={logo.alt}
                className="relative z-10 max-h-[44px] max-w-[88px] sm:max-h-[54px] sm:max-w-[110px] md:max-h-[66px] md:max-w-[128px] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105 select-none"
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

export default BrandInciSection;
