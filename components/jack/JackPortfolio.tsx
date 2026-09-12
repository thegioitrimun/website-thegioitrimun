import React, { useEffect, useState } from 'react';
import HeroSection from './HeroSection';
import MarqueeSection from './MarqueeSection';
import AboutSection from './AboutSection';
import ServicesSection from './ServicesSection';
import ProjectsSection from './ProjectsSection';

interface JackPortfolioProps {
  onBackToClinic?: () => void;
}

export const JackPortfolio: React.FC<JackPortfolioProps> = ({ onBackToClinic }) => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  useEffect(() => {
    // Set page title as requested: "Jack -- 3D Creator"
    const originalTitle = document.title;
    document.title = 'Jack -- 3D Creator';

    // Ensure page background is #0C0C0C
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#0C0C0C';
    document.documentElement.style.backgroundColor = '#0C0C0C';

    window.scrollTo(0, 0);

    return () => {
      document.title = originalTitle;
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
    };
  }, []);

  const handleContact = () => {
    setIsContactModalOpen(true);
  };

  return (
    <div
      style={{
        backgroundColor: '#0C0C0C',
        fontFamily: "'Kanit', sans-serif",
        overflowX: 'clip',
      }}
      className="w-full min-h-screen text-[#D7E2EA] bg-[#0C0C0C] font-kanit selection:bg-[#B600A8] selection:text-white"
    >
      {/* SECTION ORDER:
          1. HeroSection
          2. MarqueeSection
          3. AboutSection
          4. ServicesSection
          5. ProjectsSection
      */}
      <HeroSection onContactClick={handleContact} />
      <MarqueeSection />
      <AboutSection onContactClick={handleContact} />
      <ServicesSection />
      <ProjectsSection />

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
              <h3 className="hero-heading font-black text-2xl sm:text-3xl uppercase tracking-wider">
                Let&apos;s Connect
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
              Have a project in mind, 3D modeling requirement, or motion design inquiry? Drop an email or reach out directly:
            </p>

            <div className="flex flex-col gap-3">
              <a
                href="mailto:jack.3dcreator@gmail.com"
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#D7E2EA]/20 flex items-center justify-between text-white font-medium transition-colors"
              >
                <span>Email</span>
                <span className="text-sm text-[#D7E2EA]/70">jack.3dcreator@gmail.com</span>
              </a>
              <a
                href="https://t.me/"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#D7E2EA]/20 flex items-center justify-between text-white font-medium transition-colors"
              >
                <span>Telegram</span>
                <span className="text-sm text-[#D7E2EA]/70">@jack_3d</span>
              </a>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="rounded-full px-6 py-2.5 text-xs uppercase tracking-widest text-[#D7E2EA] hover:underline"
              >
                Close
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

export default JackPortfolio;
