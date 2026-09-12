import React, { useState } from 'react';
import { FadeIn } from './FadeIn';
import { Magnet } from './Magnet';
import { ContactButton } from './Buttons';

interface HeroSectionProps {
  onContactClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContactClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <FadeIn
      as="section"
      delay={0.05}
      duration={0.8}
      y={20}
      className="relative h-screen w-full flex flex-col justify-between overflow-x-clip bg-[#0C0C0C] select-none"
    >
      {/* Background Poster Image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <picture className="w-full h-full block">
          <source srcSet="/about-hero-bg.webp" type="image/webp" />
          <img
            src="/about-hero-bg.png"
            alt="Thế Giới Trị Mụn - Phòng khám Da Liễu Phú Quốc"
            className="w-full h-full object-cover object-center"
            loading="eager"
            fetchPriority="high"
          />
        </picture>
        {/* Ambient Vignette & Scrim for Navbar and Bottom Bar legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70 pointer-events-none" />
      </div>

      {/* 1. Navbar */}
      <div className="w-full z-30">
        <header className="w-full px-3 sm:px-6 md:px-10 pt-4 sm:pt-6 md:pt-8">
          <div className="relative flex min-h-[64px] items-center justify-between gap-2 px-3 py-2.5 sm:min-h-[68px] sm:px-4 bg-transparent border-none shadow-none backdrop-blur-none lg:min-h-[78px] lg:px-5 lg:py-4 lg:justify-center">
            {/* Left on Mobile & Tablet: Menu button + Brand Logo (identical to homepage) */}
            <div className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-full p-2 transition-colors duration-200 hover:bg-white/10 hover:text-primary focus:outline-none btn-press cursor-pointer touch-manipulation select-none text-white"
                aria-label="Mở menu điều hướng"
              >
                <span className="sr-only">Mở menu điều hướng</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 pointer-events-none"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>

              <a href="/" className="flex min-w-0 items-center gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] transition-all duration-500 bg-white/90 border border-slate-200/70 shadow-sm">
                  <img
                    loading="eager"
                    decoding="async"
                    width="96"
                    height="96"
                    alt="Da Liễu Nhiệt Đới Phú Quốc Logo"
                    className="block h-9 w-9 object-contain pointer-events-none"
                    src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.svg"
                  />
                </span>
                <div className="min-w-0 flex flex-col items-center text-center leading-[1.15] select-none">
                  <span className="block whitespace-nowrap font-['Playfair_Display',_serif] text-[11px] font-black tracking-[-0.01em] transition-colors duration-500 sm:text-[13px] text-white">
                    Thế Giới{' '}
                    <span className="inline-block whitespace-nowrap">
                      <span className="text-[#ef4444] animate-doll-jump cursor-pointer" title="Trị">
                        Trị
                      </span>
                      &nbsp;Mụn
                    </span>
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap font-sans text-[8.5px] font-bold tracking-[0.06em] transition-colors duration-500 sm:text-[9.5px] text-slate-300">
                    Da Liễu <span className="text-[#35b7a5] font-bold">Phú Quốc</span>
                  </span>
                </div>
              </a>
            </div>

            {/* Middle: Centered Navigation Links on Desktop */}
            <nav className="relative z-10 hidden lg:flex items-center gap-1 rounded-full bg-transparent px-2 py-1.5">
              <a
                href="/"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10"
              >
                Trang chủ
              </a>
              <a
                href="/dich-vu"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10"
              >
                Dịch vụ
              </a>
              <a
                href="/ve-chung-toi"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none bg-primary/25 text-primary"
              >
                Về chúng tôi
              </a>
              <a
                href="/san-pham"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10"
              >
                Sản phẩm
              </a>
              <a
                href="/phan-tich-thanh-phan-my-pham"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10"
              >
                Phân tích
              </a>
              <a
                href="/kien-thuc"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10"
              >
                Kiến thức
              </a>
              <button
                type="button"
                onClick={() => (onContactClick ? onContactClick() : scrollTo('contact'))}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/90 hover:text-primary hover:bg-white/10 bg-transparent border-none"
              >
                Liên hệ
              </button>
            </nav>

            {/* Right on Mobile & Tablet: Search & Cart actions (identical to homepage) */}
            <div className="relative z-10 flex items-center gap-1 sm:gap-2 lg:hidden">
              <div className="inline-flex items-center gap-1 rounded-full bg-transparent px-1 py-1 text-white">
                <a
                  href="/san-pham"
                  className="utility-trigger btn-press cursor-pointer touch-manipulation select-none p-2 rounded-full hover:bg-white/10 text-white inline-flex items-center justify-center"
                  aria-label="Tìm kiếm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 pointer-events-none"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </a>
                <a
                  href="/gio-hang"
                  className="utility-trigger relative btn-press cursor-pointer touch-manipulation select-none p-2 rounded-full hover:bg-white/10 text-white inline-flex items-center justify-center"
                  aria-label="Giỏ hàng"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 pointer-events-none"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.658-.463 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Mobile Dropdown Menu when toggled */}
          {isMobileMenuOpen && (
            <div className="lg:hidden mt-3 w-full rounded-2xl bg-[#141414]/95 border border-white/15 p-4 backdrop-blur-xl shadow-2xl flex flex-col gap-2 animate-fadeIn z-50">
              <a
                href="/"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Trang chủ
              </a>
              <a
                href="/dich-vu"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Dịch vụ
              </a>
              <a
                href="/ve-chung-toi"
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-primary bg-primary/15"
              >
                Về chúng tôi
              </a>
              <a
                href="/san-pham"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Sản phẩm
              </a>
              <a
                href="/phan-tich-thanh-phan-my-pham"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Phân tích
              </a>
              <a
                href="/kien-thuc"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Kiến thức
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onContactClick) onContactClick();
                  else scrollTo('contact');
                }}
                className="text-left px-4 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Liên hệ
              </button>
              <a
                href="/dat-lich"
                className="mt-2 text-center py-3 rounded-full bg-secondary text-secondary-foreground text-sm font-bold"
              >
                Đặt lịch hẹn
              </a>
            </div>
          )}
        </header>
      </div>

      {/* 2. SEO Accessible Heading (Visual branding is embedded in the background artwork) */}
      <h1 className="sr-only">
        Thế Giới Trị Mụn - Phòng Khám Chuyên Khoa Da Liễu Phú Quốc
      </h1>

      {/* 3. Hero Portrait with Magnet */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10 w-[280px] sm:w-[360px] md:w-[440px] lg:w-[500px] xl:w-[540px] bottom-0 pointer-events-none">
        <div className="w-full flex justify-center pointer-events-auto">
          <Magnet
            padding={150}
            strength={3}
            activeTransition="transform 0.3s ease-out"
            inactiveTransition="transform 0.6s ease-in-out"
            className="w-full cursor-pointer"
          >
            <picture className="w-full h-auto block">
              <source srcSet="/hero-character.webp" type="image/webp" />
              <img
                src="/hero-character.png"
                alt="Thế Giới Trị Mụn"
                className="w-full h-auto object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] pointer-events-none select-none"
                draggable={false}
                loading="eager"
              />
            </picture>
          </Magnet>
        </div>
      </div>

      {/* 4. Bottom bar */}
      <div className="relative z-20 w-full flex justify-end items-end pb-7 sm:pb-8 md:pb-10 px-6 md:px-10">
        <div>
          <ContactButton onClick={onContactClick} />
        </div>
      </div>
    </FadeIn>
  );
};

export default HeroSection;
