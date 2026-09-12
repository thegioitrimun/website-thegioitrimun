import React, { useState } from 'react';
import { FadeIn } from './FadeIn';
import { Magnet } from './Magnet';
import { ContactButton } from './Buttons';

interface HeroSectionProps {
  onContactClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContactClick }) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('VI');

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const closeAllMenus = () => {
    setIsLangOpen(false);
    setIsThemeOpen(false);
    setIsUserMenuOpen(false);
  };

  return (
    <section className="relative h-screen w-full flex flex-col justify-between overflow-x-clip bg-[#0C0C0C] select-none">
      {/* 1. Navbar */}
      <FadeIn delay={0} y={-20} className="w-full z-30">
        <header className="w-full px-3 sm:px-6 md:px-10 pt-4 sm:pt-6 md:pt-8">
          <div className="relative flex min-h-[64px] items-center justify-between gap-2 rounded-[30px] px-3 py-2.5 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-in-out sm:min-h-[68px] sm:px-4 lg:min-h-[78px] lg:px-5 lg:py-4 border border-white/10 bg-[rgba(255,255,255,0.06)] shadow-none backdrop-blur-md">
            {/* Ambient glows */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] transition-opacity duration-500 ease-in-out opacity-60">
              <div className="absolute -left-6 top-0 h-24 w-24 rounded-full bg-[#ff7f5d]/15 blur-2xl"></div>
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#35b7a5]/15 blur-2xl"></div>
            </div>

            {/* Left: Mobile menu toggle + Logo */}
            <div className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2.5 lg:gap-4">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-full p-2 transition-colors duration-200 hover:bg-white/10 hover:text-primary focus:outline-none btn-press lg:hidden cursor-pointer touch-manipulation select-none text-white"
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

              <a href="/" className="flex min-w-0 items-center gap-2 lg:max-w-[340px] lg:gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] transition-all duration-500 lg:h-12 lg:w-12 lg:rounded-[20px] bg-white/90 border border-slate-200/70 shadow-sm">
                  <img
                    loading="eager"
                    decoding="async"
                    width="96"
                    height="96"
                    alt="Da Liễu Nhiệt Đới Phú Quốc Logo"
                    className="block h-9 w-9 object-contain lg:h-10 lg:w-10 pointer-events-none"
                    src="/icons/da-lieu-nhiet-doi-phu-quoc-logo.svg"
                  />
                </span>
                <div className="min-w-0 flex flex-col items-center text-center leading-[1.15] select-none">
                  <span className="block whitespace-nowrap font-['Playfair_Display',_serif] text-[11px] font-black tracking-[-0.01em] transition-colors duration-500 sm:text-[13px] lg:text-[15px] text-white">
                    Thế Giới{' '}
                    <span className="inline-block whitespace-nowrap">
                      <span className="text-[#ef4444] animate-doll-jump cursor-pointer" title="Trị">
                        Trị
                      </span>
                      &nbsp;Mụn
                    </span>
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap font-sans text-[8.5px] font-bold tracking-[0.06em] transition-colors duration-500 sm:text-[9.5px] lg:text-[11px] text-slate-300">
                    Da Liễu <span className="text-[#35b7a5] font-bold">Phú Quốc</span>
                  </span>
                </div>
              </a>
            </div>

            {/* Middle: Navigation Links */}
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

            {/* Right: Actions & Utilities */}
            <div className="relative z-10 flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-transparent px-1.5 py-1.5 transition-colors duration-500 sm:px-2 text-white">
                {/* Search */}
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

                <div className="utility-divider hidden lg:block transition-colors duration-500 bg-white/20 w-[1px] h-5 mx-1"></div>

                {/* Language Switcher */}
                <div className="hidden lg:block relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLangOpen(!isLangOpen);
                      setIsThemeOpen(false);
                      setIsUserMenuOpen(false);
                    }}
                    className="utility-trigger px-3 py-1.5 rounded-full hover:bg-white/10 text-white cursor-pointer touch-manipulation select-none flex items-center gap-1"
                    aria-label="Chọn ngôn ngữ"
                    aria-expanded={isLangOpen}
                    aria-haspopup="menu"
                  >
                    <span className="utility-trigger-label pointer-events-none text-xs font-bold">{currentLang}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`h-3.5 w-3.5 pointer-events-none transition-transform duration-200 ${
                        isLangOpen ? 'rotate-180' : ''
                      }`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isLangOpen && (
                    <div
                      className="absolute right-0 mt-2 w-40 rounded-2xl bg-[#181818] border border-white/15 text-white shadow-2xl z-[90] p-1.5 animate-fadeIn"
                      role="menu"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentLang('VI');
                            setIsLangOpen(false);
                          }}
                          className={`flex items-center px-3 py-2 rounded-xl text-xs hover:bg-white/10 cursor-pointer ${
                            currentLang === 'VI' ? 'font-bold text-primary bg-primary/10' : 'text-white'
                          }`}
                          role="menuitem"
                        >
                          <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">VI</span>
                          Tiếng Việt
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentLang('EN');
                            setIsLangOpen(false);
                          }}
                          className={`flex items-center px-3 py-2 rounded-xl text-xs hover:bg-white/10 cursor-pointer ${
                            currentLang === 'EN' ? 'font-bold text-primary bg-primary/10' : 'text-white'
                          }`}
                          role="menuitem"
                        >
                          <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">EN</span>
                          English
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentLang('RU');
                            setIsLangOpen(false);
                          }}
                          className={`flex items-center px-3 py-2 rounded-xl text-xs hover:bg-white/10 cursor-pointer ${
                            currentLang === 'RU' ? 'font-bold text-primary bg-primary/10' : 'text-white'
                          }`}
                          role="menuitem"
                        >
                          <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">RU</span>
                          Русский
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentLang('CN');
                            setIsLangOpen(false);
                          }}
                          className={`flex items-center px-3 py-2 rounded-xl text-xs hover:bg-white/10 cursor-pointer ${
                            currentLang === 'CN' ? 'font-bold text-primary bg-primary/10' : 'text-white'
                          }`}
                          role="menuitem"
                        >
                          <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">CN</span>
                          中文
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="utility-divider hidden xl:block transition-colors duration-500 bg-white/20 w-[1px] h-5 mx-1"></div>

                {/* Theme Switcher */}
                <div className="hidden xl:block relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsThemeOpen(!isThemeOpen);
                      setIsLangOpen(false);
                      setIsUserMenuOpen(false);
                    }}
                    className="utility-trigger p-2 rounded-full hover:bg-white/10 text-white cursor-pointer touch-manipulation select-none inline-flex items-center justify-center"
                    aria-label="Cài đặt Giao diện"
                    aria-expanded={isThemeOpen}
                    aria-haspopup="menu"
                    title="Cài đặt Giao diện"
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
                        d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5m-15.065-7.023L3.375 3.375m17.25 17.25l-1.125-1.125M3.375 20.625l1.125-1.125m15.002-15.002l-1.125 1.125M20.625 3.375l-1.125 1.125"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
                    </svg>
                  </button>

                  {isThemeOpen && (
                    <div
                      className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#181818] border border-white/15 text-white py-1 z-[90] shadow-2xl animate-fadeIn"
                      role="menu"
                    >
                      <div className="p-3">
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-white/60 px-1 mb-2">Chế độ</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-xs cursor-pointer touch-manipulation text-white/80 hover:bg-white/10"
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
                                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                                />
                              </svg>
                              <span>Sáng</span>
                            </button>
                            <button
                              type="button"
                              className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-xs cursor-pointer touch-manipulation bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
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
                                  d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                                />
                              </svg>
                              <span>Tối</span>
                            </button>
                            <button
                              type="button"
                              className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-xs cursor-pointer touch-manipulation text-white/80 hover:bg-white/10"
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
                                  d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-1.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
                                />
                              </svg>
                              <span>Hệ thống</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white/60 px-1 mb-2">Phông chữ</h4>
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150 cursor-pointer text-white/90 hover:bg-white/10"
                              style={{
                                fontFamily:
                                  '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
                              }}
                            >
                              <span>Be Vietnam Pro</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150 cursor-pointer text-white/90 hover:bg-white/10"
                              style={{
                                fontFamily:
                                  'Roboto, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
                              }}
                            >
                              <span>Roboto</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150 cursor-pointer text-white/90 hover:bg-white/10"
                              style={{ fontFamily: '"Open Sans", "Segoe UI", Arial, sans-serif' }}
                            >
                              <span>Open Sans</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150 cursor-pointer bg-primary/20 text-primary font-bold"
                              style={{ fontFamily: '"Noto Sans", "Segoe UI", Arial, sans-serif' }}
                            >
                              <span>Noto Sans</span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-4 h-4 pointer-events-none"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="utility-divider hidden lg:block transition-colors duration-500 bg-white/20 w-[1px] h-5 mx-1"></div>

                {/* User Profile Avatar / Menu */}
                <div className="hidden lg:block relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(!isUserMenuOpen);
                      setIsLangOpen(false);
                      setIsThemeOpen(false);
                    }}
                    className="utility-trigger h-10 w-10 shrink-0 overflow-hidden p-0 rounded-full border border-white/20 cursor-pointer touch-manipulation select-none"
                    aria-label="Mở menu người dùng"
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    title="Tài khoản người dùng"
                  >
                    <img
                      alt="Thế Giới Trị Mụn"
                      className="pointer-events-none block h-full w-full object-cover"
                      src="https://lh3.googleusercontent.com/a/ACg8ocIilPKMzEX5xSksmHvwVG-nmdIY4m8GOe-xNpWc1aONhMGjNw=s96-c"
                    />
                  </button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#181818] border border-white/15 text-white z-[90] shadow-2xl animate-fadeIn"
                      role="menu"
                    >
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-medium text-white">Thế Giới Trị Mụn</p>
                        <p className="text-xs text-white/60 truncate">thegioitrimun@gmail.com</p>
                      </div>

                      <div className="space-y-0.5 p-1.5 text-xs">
                        <a
                          href="/tai-khoan"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                          </svg>
                          <span>Thông tin cá nhân</span>
                        </a>

                        <a
                          href="/tai-khoan"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                          <span>Đơn hàng của tôi</span>
                        </a>

                        <a
                          href="/yeu-thich"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                            />
                          </svg>
                          <span>Danh sách yêu thích</span>
                        </a>

                        <a
                          href="/tai-khoan"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m9.375 0a9.06 9.06 0 00-9.375-9.375m9.375 0a9.06 9.06 0 00-9.375-9.375"
                            />
                          </svg>
                          <span>Hồ sơ của tôi</span>
                        </a>

                        <a
                          href="/admin"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-white/60"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5m-15.065-7.023L3.375 3.375m17.25 17.25l-1.125-1.125M3.375 20.625l1.125-1.125m15.002-15.002l-1.125 1.125M20.625 3.375l-1.125 1.125"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
                          </svg>
                          <span>Trang quản trị</span>
                        </a>
                      </div>

                      <div className="border-t border-white/10 p-1.5">
                        <a
                          href="/tai-khoan"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 cursor-pointer text-xs"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-red-400"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3 0l-3-3m0 0 3-3m-3 3H9"
                            />
                          </svg>
                          <span>Đăng xuất</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cart Icon */}
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

              {/* Booking CTA Button */}
              <a
                href="/dat-lich"
                className="hidden min-h-[48px] whitespace-nowrap items-center rounded-full bg-secondary/92 px-5 text-sm font-bold text-secondary-foreground shadow-[0_18px_40px_-28px_rgba(255,127,93,0.46)] transition-all-smooth hover:-translate-y-0.5 hover:brightness-95 lg:inline-flex btn-press cursor-pointer touch-manipulation select-none"
              >
                Đặt lịch hẹn
              </a>
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
      </FadeIn>

      {/* 2. Hero Heading */}
      <div className="relative z-0 w-full overflow-hidden flex items-center justify-center">
        <FadeIn delay={0.15} y={40} className="w-full">
          <h1
            style={{ margin: '10px 0px 0px' }}
            className="hero-heading font-black uppercase tracking-tight leading-none whitespace-nowrap w-full text-center text-[8.5vw] sm:text-[9.5vw] md:text-[10.5vw] lg:text-[11.5vw] xl:text-[12vw] select-none"
          >
            Thế Giới Trị Mụn
          </h1>
        </FadeIn>
      </div>

      {/* 3. Hero Portrait with Magnet */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10 w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px] top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0 pointer-events-none">
        <FadeIn delay={0.6} y={30} className="w-full flex justify-center pointer-events-auto">
          <Magnet
            padding={150}
            strength={3}
            activeTransition="transform 0.3s ease-out"
            inactiveTransition="transform 0.6s ease-in-out"
            className="w-full cursor-pointer"
          >
            <img
              src="https://shrug-person-78902957.figma.site/_components/v2/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png"
              alt="Jack 3D Creator"
              className="w-full h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-none select-none"
              draggable={false}
              loading="eager"
            />
          </Magnet>
        </FadeIn>
      </div>

      {/* 4. Bottom bar */}
      <div className="relative z-20 w-full flex justify-between items-end pb-7 sm:pb-8 md:pb-10 px-6 md:px-10">
        <FadeIn delay={0.35} y={20}>
          <p
            style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.5rem)' }}
            className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug max-w-[180px] sm:max-w-[240px] md:max-w-[300px]"
          >
            Chăm sóc da liễu chuyên nghiệp tại phú quốc
          </p>
        </FadeIn>

        <FadeIn delay={0.5} y={20}>
          <ContactButton onClick={onContactClick} />
        </FadeIn>
      </div>
    </section>
  );
};

export default HeroSection;
