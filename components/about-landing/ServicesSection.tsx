import React from 'react';
import { FadeIn } from './FadeIn';
import type { Service } from '../../types';
import { useTranslation } from 'react-i18next';
import { getLocalizedValue } from '../../src/relatedContent';

// The five existing featured treatments, linked by their stable database IDs.
const FEATURED_SERVICE_IDS = [1, 2, 3, 4, 6];

export interface ServicesSectionProps {
  services: Service[];
  onSelectService: (id: number) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ services, onSelectService }) => {
  const { i18n } = useTranslation();
  const featuredServices = FEATURED_SERVICE_IDS.flatMap(id => {
    const service = services.find(item => item.id === id);
    return service ? [service] : [];
  });
  const openService = (event: React.MouseEvent<HTMLAnchorElement>, service: Service) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelectService(service.id);
  };
  return (
    <section
      id="services"
      className="relative w-full bg-[#FFFFFF] text-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 z-0"
    >
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <FadeIn delay={0}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="text-primary font-heading font-black uppercase text-center leading-tight tracking-tight py-2 mb-16 sm:mb-20 md:mb-28"
          >
            Dịch vụ
          </h2>
        </FadeIn>

        {/* 5 Service Items */}
        <div className="flex flex-col divide-y divide-[rgba(12,12,12,0.15)] border-t border-b border-[rgba(12,12,12,0.15)]">
          {featuredServices.map((service, i) => (
            <FadeIn key={service.id} delay={i * 0.1}>
              <a href={`/dich-vu/${service.slug || service.id}`} onClick={event => openService(event, service)} className="group flex flex-col md:flex-row md:items-baseline justify-between gap-4 md:gap-14 py-8 sm:py-10 md:py-12 rounded-xl hover:bg-black/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                {/* Number on left */}
                <span
                  style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
                  className="font-heading font-black text-[#0C0C0C] leading-none select-none tracking-tighter flex-shrink-0"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Name + Description on right */}
                <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                  <h3
                    style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
                    className="font-heading font-semibold uppercase text-[#0C0C0C] tracking-wide"
                  >
                    {getLocalizedValue(service, 'name', i18n.language)}
                  </h3>
                  <p
                    style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}
                    className="font-sans font-normal leading-relaxed max-w-2xl text-[#0C0C0C] opacity-70"
                  >
                    {getLocalizedValue(service, 'description', i18n.language)}
                  </p>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
