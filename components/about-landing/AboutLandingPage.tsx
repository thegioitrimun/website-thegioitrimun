import React, { useEffect, useState } from 'react';
import HeroSection from './HeroSection';
import MarqueeSection from './MarqueeSection';
import AboutSection from './AboutSection';
import ServicesSection from './ServicesSection';
import ProjectsSection from './ProjectsSection';

export interface AboutLandingProps {
  onBackToClinic?: () => void;
}

export const AboutLandingPage: React.FC<AboutLandingProps> = ({ onBackToClinic }) => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  useEffect(() => {
    // Enhanced rich dark gradient: deep midnight navy -> royal twilight -> vibrant oceanic teal -> deep emerald night
    const originalBodyBg = document.body.style.background;
    const originalBodyBgColor = document.body.style.backgroundColor;
    const originalHtmlBgColor = document.documentElement.style.backgroundColor;

    document.body.style.background =
      'linear-gradient(180deg, #0a1526 0%, #0f2540 25%, #13334c 50%, #0e3843 78%, #092027 100%)';
    document.body.style.backgroundColor = '#0a1526';
    document.documentElement.style.backgroundColor = '#0a1526';

    window.scrollTo(0, 0);

    return () => {
      document.body.style.background = originalBodyBg;
      document.body.style.backgroundColor = originalBodyBgColor;
      document.documentElement.style.backgroundColor = originalHtmlBgColor;
    };
  }, []);

  const handleContact = () => {
    setIsContactModalOpen(true);
  };

  return (
    <div
      style={{
        backgroundColor: '#0a1526',
        fontFamily: 'var(--font-sans)',
        overflowX: 'clip',
      }}
      className="relative w-full min-h-screen text-[#D7E2EA] bg-[#0a1526] font-sans selection:bg-[#B600A8] selection:text-white"
    >
      {/* Living Smooth Transition Dark Gradient Background (Fixed Viewport Layer) */}
      <div
        className="about-animated-bg fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* State 1: Deep Midnight Navy & Sapphire Base */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, #0a1526 0%, #0f2744 35%, #133956 70%, #0d2e3a 100%)',
          }}
        />

        {/* State 2: Smooth Cross-fading Oceanic Deep Teal / Emerald */}
        <div
          className="absolute inset-0 will-change-[opacity]"
          style={{
            background:
              'linear-gradient(195deg, #071929 0%, #0b3042 30%, #0e4650 70%, #09242c 100%)',
            animation: 'aboutBgFade1 14s ease-in-out infinite alternate',
          }}
        />

        {/* State 3: Smooth Cross-fading Royal Twilight Indigo */}
        <div
          className="absolute inset-0 will-change-[opacity]"
          style={{
            background:
              'linear-gradient(225deg, #0c1832 0%, #142c4e 35%, #11405c 75%, #0b2735 100%)',
            animation: 'aboutBgFade2 18s ease-in-out infinite alternate',
          }}
        />

        {/* Floating Glowing Ambient Orbs for gentle, organic light motion */}
        <div
          className="absolute -top-[15%] -left-[10%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full blur-[120px] opacity-45 mix-blend-screen will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(24, 82, 138, 0.75) 0%, rgba(13, 44, 76, 0) 70%)',
            animation: 'aboutOrbDrift1 22s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute top-[35%] -right-[15%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full blur-[130px] opacity-40 mix-blend-screen will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 102, 110, 0.7) 0%, rgba(9, 48, 56, 0) 70%)',
            animation: 'aboutOrbDrift2 26s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute -bottom-[15%] left-[20%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] opacity-35 mix-blend-screen will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(19, 74, 118, 0.65) 0%, rgba(10, 38, 66, 0) 70%)',
            animation: 'aboutOrbDrift1 28s ease-in-out infinite alternate-reverse',
          }}
        />
      </div>

      {/* SECTION ORDER:
          1. HeroSection
          2. MarqueeSection
          3. AboutSection
          4. ServicesSection
          5. ProjectsSection
      */}
      <div className="relative z-10">
        <HeroSection onContactClick={handleContact} />
        <MarqueeSection />
        <AboutSection onContactClick={handleContact} />
        <ServicesSection />
        <ProjectsSection />
      </div>

      {/* Optional Contact / Inquiry Modal */}
      {isContactModalOpen && (
        <div
          id="contact"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsContactModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-[32px] border-2 border-[#D7E2EA] bg-[#121212] p-8 sm:p-10 shadow-2xl flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="hero-heading font-heading font-black text-2xl sm:text-3xl uppercase tracking-wider leading-tight py-1">
                Liên Hệ Với Chúng Tôi
              </h3>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="w-10 h-10 rounded-full border border-[#D7E2EA]/30 text-[#D7E2EA] hover:bg-[#D7E2EA]/10 flex items-center justify-center text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-[#D7E2EA]/80 font-light text-sm sm:text-base leading-relaxed">
              Bạn cần tư vấn phác đồ điều trị mụn chuyên sâu, đặt lịch khám trực tiếp hoặc thắc mắc về sản phẩm? Hãy liên hệ ngay với Thế Giới Trị Mụn:
            </p>

            <div className="flex flex-col gap-3">
              <a
                href="tel:0934086843"
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#D7E2EA]/20 flex items-center justify-between text-white font-medium transition-colors"
              >
                <span>Hotline / Tư vấn</span>
                <span className="text-sm text-[#D7E2EA]/70">0934 086 843</span>
              </a>
              <a
                href="mailto:thegioitrimun@gmail.com"
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#D7E2EA]/20 flex items-center justify-between text-white font-medium transition-colors"
              >
                <span>Email</span>
                <span className="text-sm text-[#D7E2EA]/70">thegioitrimun@gmail.com</span>
              </a>
              <a
                href="https://zalo.me/0934086843"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#D7E2EA]/20 flex items-center justify-between text-white font-medium transition-colors"
              >
                <span>Zalo tư vấn</span>
                <span className="text-sm text-[#D7E2EA]/70">0934 086 843</span>
              </a>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="rounded-full px-6 py-2.5 text-xs uppercase tracking-widest text-[#D7E2EA] hover:underline"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating subtle badge to return to clinic homepage if user arrived from TGTM */}
      {onBackToClinic && (
        <button
          type="button"
          onClick={onBackToClinic}
          className="fixed bottom-6 left-6 z-40 px-4 py-2 rounded-full bg-[#1A1A1A]/80 border border-[#D7E2EA]/30 text-xs font-light tracking-wide text-[#D7E2EA] backdrop-blur-md hover:bg-[#222222] transition-all duration-200 flex items-center gap-2 shadow-lg"
          title="Quay lại Thế Giới Trị Mụn"
        >
          <span>←</span>
          <span>Thế Giới Trị Mụn</span>
        </button>
      )}
    </div>
  );
};

export default AboutLandingPage;
