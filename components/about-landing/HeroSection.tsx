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
      {/* 1. Navbar */}
      <div className="w-full z-30">
        <header className="w-full px-3 sm:px-6 md:px-10 pt-4 sm:pt-6 md:pt-8">
          <div className="relative flex min-h-[64px] items-center justify-between gap-2 rounded-[30px] px-3 py-2.5 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-in-out sm:min-h-[68px] sm:px-4 border border-white/10 bg-[rgba(255,255,255,0.06)] shadow-none backdrop-blur-md lg:min-h-[78px] lg:px-5 lg:py-4 lg:justify-center lg:border-none lg:bg-transparent lg:backdrop-blur-none">
            {/* Ambient colored blur for mobile & tablet glass effect */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] transition-opacity duration-500 ease-in-out opacity-60 lg:hidden">
              <div className="absolute -left-6 top-0 h-24 w-24 rounded-full bg-[#ff7f5d]/15 blur-2xl"></div>
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#35b7a5]/15 blur-2xl"></div>
            </div>

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
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5"
              >
                Trang chủ
              </a>
              <a
                href="/dich-vu"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5"
              >
                Dịch vụ
              </a>
              <a
                href="/ve-chung-toi"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none bg-primary/20 text-primary"
              >
                Về chúng tôi
              </a>
              <a
                href="/san-pham"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5"
              >
                Sản phẩm
              </a>
              <a
                href="/phan-tich-thanh-phan-my-pham"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5"
              >
                Phân tích
              </a>
              <a
                href="/kien-thuc"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5"
              >
                Kiến thức
              </a>
              <button
                type="button"
                onClick={() => (onContactClick ? onContactClick() : scrollTo('contact'))}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer touch-manipulation select-none text-white/80 hover:text-primary hover:bg-white/5 bg-transparent border-none"
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

      {/* 2. Hero Heading */}
      <div className="relative z-0 w-full flex items-center justify-center">
        <div className="w-full">
          <h1
            style={{ margin: '30px 0px 0px' }}
            className="font-['Playfair_Display',_serif] font-black tracking-[-0.01em] leading-[1.15] pt-4 pb-2 whitespace-nowrap w-full text-center text-[8.5vw] sm:text-[9.5vw] md:text-[10.5vw] lg:text-[11.5vw] xl:text-[12vw] text-white select-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]"
          >
            Thế Giới{' '}
            <span className="inline-block whitespace-nowrap">
              <span className="text-[#ef4444] animate-doll-jump cursor-pointer" title="Trị">
                Trị
              </span>
              &nbsp;Mụn
            </span>
          </h1>
        </div>
      </div>

      {/* 3. Hero Portrait with Magnet */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10 w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px] top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0 pointer-events-none">
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
                className="w-full h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-none select-none"
                draggable={false}
                loading="eager"
              />
            </picture>
          </Magnet>
        </div>
      </div>

      {/* 4. Bottom bar */}
      <div className="relative z-20 w-full flex justify-between items-end pb-7 sm:pb-8 md:pb-10 px-6 md:px-10">
        <div>
          <p
            style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
            className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug max-w-[180px] sm:max-w-[240px] md:max-w-[300px]"
          >
            Chăm sóc da liễu chuyên nghiệp tại phú quốc
          </p>
        </div>

        <div>
          <ContactButton onClick={onContactClick} />
        </div>
      </div>
    </FadeIn>
  );
};

export default HeroSection;
