import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { IngredientAnalysisResults, type AnalyzerResponse } from '../IngredientAnalyzerPage';

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

const DEMO_INCI =
  'Water, Niacinamide, Glycerin, Salicylic Acid, Centella Asiatica Extract, Retinol, Sodium Hyaluronate';

export const BrandInciSection: React.FC = () => {
  const [inciText, setInciText] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Duplicate the logos array so marquee can scroll infinitely seamlessly
  const duplicatedLogos = [...BRAND_LOGOS, ...BRAND_LOGOS];

  const handleAnalyze = async () => {
    const trimmed = inciText.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ingredient-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inciText: trimmed, lang: 'vi' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Không thể phân tích bảng thành phần lúc này. Vui lòng thử lại sau.');
      }
      setAnalysis(payload);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể phân tích bảng thành phần lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInciText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleApplySample = () => {
    setInciText(DEMO_INCI);
    setError('');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        textareaRef.current.focus();
      }
    }, 0);
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
    <section
      id="brand-inci"
      className="relative w-full bg-[#FFFFFF] dark:bg-[#070e1b] text-[#0C0C0C] dark:text-[#F1F5F9] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-4 sm:px-6 md:px-10 pt-16 sm:pt-20 md:pt-24 pb-20 sm:pb-28 md:pb-32 z-0 select-none transition-colors duration-300"
    >
      {/* 1. Main Hero Video Container */}
      <div className="relative w-full max-w-6xl mx-auto h-[480px] sm:h-[520px] md:h-[560px] rounded-[28px] sm:rounded-[36px] md:rounded-[44px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-[#0b1424] flex flex-col justify-between select-none transition-colors duration-300">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          src="/videos/about/hero-epoch.mp4"
        />

        {/* Subtle Gradient Overlays for High Text Contrast in both Light & Dark Mode */}
        <div
          className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-white/94 via-white/78 via-40% to-white/60 dark:from-[#070e1b]/95 dark:via-[#070e1b]/80 dark:via-40% dark:to-[#070e1b]/70 transition-colors duration-300"
        />

        {/* 3. Hero Content */}
        <div className="relative z-20 flex-1 px-5 sm:px-8 md:px-16 pt-7 sm:pt-12 md:pt-16 flex flex-col items-start">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start max-w-2xl"
          >
            {/* Small pill tag for high-end polish on mobile */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 border border-primary/20 text-primary dark:bg-primary/20 dark:border-primary/30 dark:text-teal-300 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 backdrop-blur-md">
              <span className="text-[10px]">✦</span>
              <span>Chuẩn y khoa da liễu</span>
            </div>

            {/* Headline: Concise on mobile, full on desktop */}
            <h2 className="font-heading font-bold text-[22px] sm:text-[34px] md:text-[50px] leading-[1.2] sm:leading-[1.08] tracking-tight text-[#0a1b33] dark:text-white mb-2 sm:mb-3">
              <span className="sm:hidden">
                Phân tích thành phần INCI
              </span>
              <span className="hidden sm:inline">
                Phân tích thành phần INCI<br />chuẩn y khoa da liễu
              </span>
            </h2>

            {/* Subheadline: Clear contrast and legible font on mobile */}
            <p className="font-sans text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl mb-3.5 sm:mb-6">
              <span className="sm:hidden">
                Kiểm tra độ an toàn & mức độ phù hợp theo từng loại da.
              </span>
              <span className="hidden sm:inline">
                Tra cứu độ an toàn, cảnh báo rủi ro kích ứng và kiểm tra mức độ phù hợp với làn da của bạn dựa trên cơ sở khoa học.
              </span>
            </p>
          </motion.div>
        </div>

        {/* 4. Bottom Floating INCI Input Box */}
        <div className="absolute bottom-4 sm:bottom-7 md:bottom-8 left-1/2 -translate-x-1/2 z-30 w-[93%] sm:w-[540px] md:w-[620px] max-w-[650px]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full rounded-[24px] sm:rounded-[30px] bg-white/85 sm:bg-white/80 dark:bg-[rgba(15,23,34,0.85)] backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.14)] dark:shadow-[0_28px_60px_-25px_rgba(0,0,0,0.7)] p-2.5 sm:p-3 md:p-3.5 transition-all duration-300 focus-within:border-primary/50 dark:focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 dark:focus-within:ring-primary/20 overflow-hidden"
          >
            {/* Ambient subtle glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px] sm:rounded-[30px]">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-[#ff7f5d]/10 dark:bg-[#ff7f5d]/15 blur-3xl" />
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#35b7a5]/12 dark:bg-[#35b7a5]/22 blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-col w-full">
              {/* Textarea without scrollbar & auto-expanding */}
              <textarea
                id="hero-inci-textarea"
                ref={textareaRef}
                rows={2}
                value={inciText}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && inciText.trim() && !isLoading) {
                    e.preventDefault();
                    void handleAnalyze();
                  }
                }}
                placeholder="Dán hoặc gõ bảng thành phần mỹ phẩm (INCI)... Ví dụ: Water, Niacinamide, Glycerin, Salicylic Acid, Retinol..."
                className="w-full resize-none bg-transparent border-0 outline-none ring-0 p-1.5 sm:p-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400/60 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-[46px] sm:min-h-[52px] max-h-[120px] transition-all"
              />

              {/* Bottom Balanced Action Row */}
              <div className="flex items-center justify-between pt-2 px-1 sm:px-1.5 border-t border-slate-100 dark:border-white/[0.08]">
                {/* Left side: Sample button & Desktop hint */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplySample}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-teal-300 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200/60 dark:border-white/10 transition-all cursor-pointer select-none"
                    title="Điền bảng thành phần mẫu thử"
                  >
                    <span className="text-[10px] text-primary dark:text-teal-300">✦</span>
                    <span>Mẫu thử</span>
                  </button>

                  <span className="hidden sm:inline-flex items-center text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                    Enter ↵ để phân tích
                  </span>
                </div>

                {/* Right side: Clear button & Primary CTA */}
                <div className="flex items-center gap-2">
                  {inciText.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setInciText('');
                        setError('');
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                          textareaRef.current.focus();
                        }
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleAnalyze()}
                    disabled={!inciText.trim() || isLoading}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      inciText.trim() && !isLoading
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:scale-105 active:scale-95'
                        : 'bg-slate-200/80 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Đang đọc...</span>
                      </>
                    ) : (
                      <>
                        <span>Phân tích</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 4.5. In-Place INCI Analysis Results */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-8 max-w-xl mx-auto flex items-center justify-center gap-3 p-5 rounded-2xl bg-white/80 dark:bg-[#0c1626]/90 border border-slate-200/80 dark:border-white/10 shadow-lg backdrop-blur-md"
          >
            <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Đang phân tích bảng thành phần INCI theo chuẩn y khoa...
            </span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 max-w-xl mx-auto p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold text-center flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-xs underline hover:no-underline ml-3 cursor-pointer"
            >
              Đóng
            </button>
          </motion.div>
        )}

        {analysis && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 sm:mt-16 max-w-6xl mx-auto select-text scroll-mt-20"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <div>
                  <h3 className="font-heading font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
                    Kết quả phân tích bảng thành phần INCI
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đánh giá mức độ an toàn EWG, nguy cơ kích ứng & độ phù hợp loại da
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnalysis(null);
                  const el = document.getElementById('hero-inci-textarea');
                  el?.focus();
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/60 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>✕</span>
                <span>Thu gọn kết quả</span>
              </button>
            </div>

            <IngredientAnalysisResults analysis={analysis} lang="vi" />
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="absolute inset-0 rounded-full bg-white dark:bg-[#0f1b2d] border border-slate-200/60 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] group-hover:border-slate-200/80 dark:group-hover:border-white/20 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300" />

              {/* Brand Logo - maximized size within bounds, scaled down proportionally on mobile */}
              <img
                src={logo.src}
                alt={logo.alt}
                className="relative z-10 max-h-[44px] max-w-[88px] sm:max-h-[54px] sm:max-w-[110px] md:max-h-[66px] md:max-w-[128px] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105 dark:brightness-105 select-none"
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
    </MotionConfig>
  );
};

export default BrandInciSection;
