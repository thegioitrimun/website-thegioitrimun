import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface HeroSectionProps {
  onContactClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContactClick }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    const handlePlaying = () => setIsPlaying(true);
    video.addEventListener('playing', handlePlaying);

    let observer: IntersectionObserver | null = null;
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(video);
    } else {
      void video.play().catch(() => undefined);
    }

    return () => {
      video.removeEventListener('playing', handlePlaying);
      if (observer) observer.disconnect();
    };
  }, []);

  const handleBeginJourney = () => {
    const nextSection = document.getElementById('about-marquee') || document.querySelector('section:nth-of-type(2)');
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    } else if (onContactClick) {
      onContactClick();
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      data-testid="homepage-hero-picture"
      className="relative min-h-[100svh] w-full overflow-hidden bg-background text-foreground"
    >
      <video
        ref={videoRef}
        data-testid="homepage-hero-image"
        className={`pointer-events-none absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
        src="/hero/hero-cinematic.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="homepage-hero-gradient pointer-events-none absolute inset-0 z-[1]"
      />
      <div
        aria-hidden="true"
        className="homepage-hero-focus pointer-events-none absolute inset-0 z-[1]"
      />

      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-5 pb-14 pt-[calc(env(safe-area-inset-top,0px)+7rem)] text-center sm:px-6 sm:pb-20 sm:pt-32">
        <h1
          data-testid="homepage-hero-title"
          className="homepage-hero-copy max-w-6xl animate-fade-rise font-['Playfair_Display',_serif] text-[clamp(1.65rem,6.8vw,6.75rem)] sm:text-[clamp(2.5rem,7vw,6.75rem)] font-[700] leading-[0.95] tracking-[-0.02em] normal-case text-foreground"
        >
          <span className="block whitespace-nowrap mb-3 sm:mb-5">
            Thế Giới{' '}
            <span className="inline-block whitespace-nowrap">
              <em
                className="font-black not-italic text-red-500 animate-doll-jump cursor-pointer select-none"
                title="Trị"
              >
                Trị
              </em>
              &nbsp;Mụn
            </span>
          </span>
          <span className="block whitespace-nowrap">
            Da Liễu{' '}
            <em className="font-black not-italic text-primary">Phú Quốc</em>
          </span>
        </h1>
        <p className="homepage-hero-copy mt-7 max-w-3xl animate-fade-rise-delay font-sans text-[15px] font-medium leading-relaxed text-foreground sm:mt-8 sm:text-lg">
          <span className="block">
            “{t('hero.home_quote', 'Hãy đầu tư cho làn da của bạn. Nó sẽ đại diện cho bạn trong một thời gian rất dài.')}”
          </span>
          <span className="mt-1.5 block text-sm font-semibold text-muted-foreground sm:text-base">
            {t('hero.home_quote_author', 'Linden Tyler')}
          </span>
        </p>
        <button
          type="button"
          onClick={handleBeginJourney}
          className="mt-10 inline-flex min-h-14 items-center gap-3 rounded-full border border-white/40 bg-white/20 backdrop-blur-2xl px-10 py-4 font-sans text-[15px] font-bold text-foreground shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/30 hover:border-white/60 hover:shadow-[0_18px_48px_rgba(0,0,0,0.2)] focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-4 focus:ring-offset-background animate-fade-rise-delay-2 sm:mt-12 sm:px-12 sm:text-base dark:bg-white/10 dark:border-white/15 dark:hover:bg-white/20 cursor-pointer"
        >
          Begin Journey
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
