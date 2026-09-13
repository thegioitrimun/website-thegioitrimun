import React from 'react';
import { FadeIn } from './FadeIn';
import { Magnet } from './Magnet';
import { ContactButton } from './Buttons';

interface HeroSectionProps {
  onContactClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContactClick }) => {
  return (
    <FadeIn
      as="section"
      delay={0.05}
      duration={0.8}
      y={20}
      className="relative h-screen w-full flex flex-col justify-end overflow-x-clip bg-[#0C0C0C] select-none"
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
            <picture className="w-full h-auto block scale-[1.2] origin-bottom">
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
