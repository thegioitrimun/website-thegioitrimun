import React, { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { FadeIn } from './FadeIn';
import type { ProjectItem } from './types';

const PROJECTS: ProjectItem[] = [
  {
    id: '01',
    number: '01',
    category: 'Đa dạng',
    name: 'Kem chống nắng',
    images: {
      col1Top: '/images/about/sunscreen-day-cream-top.webp',
      col1Bottom: '/images/about/sunscreen-dd-cream-bottom.webp',
      col2: '/images/about/sunscreen-segle-col2.webp',
    },
    links: {
      col1Top:
        '/san-pham/kem-chong-nang/kem-chong-nang-4-in-1-dermeden-day-cream-global-action-combination-skin-spf-50-pa-da-hon-hop-da-dau-50ml',
      col1Bottom:
        '/san-pham/kem-chong-nang/kem-chong-nang-vitamin-d-dermeden-dd-cream-spf50-50ml',
      col2:
        '/san-pham/kem-chong-nang/segle-spf50-sun-care-gel-crema---kem-chng-nng-ph-rng-bo-v-ton-din-spf-50-pa',
    },
    alts: {
      col1Top:
        'Kem chống nắng 4 in 1 DermEden Day Cream Global Action Combination Skin SPF 50 PA+++',
      col1Bottom:
        'Kem chống nắng Vitamin D DermEden DD Cream SPF50',
      col2:
        'SEGLE SPF50+ SUN CARE GEL CREMA - Kem Chống Nắng Phổ Rộng Bảo Vệ Toàn Diện SPF 50+, PA++++',
    },
  },
  {
    id: '02',
    number: '02',
    category: 'Cá nhân',
    name: 'Tinh Chất Đặc Trị',
    images: {
      col1Top: '/images/about/serum-intelderm-top.webp',
      col1Bottom: '/images/about/serum-tretinoin-bottom.webp',
      col2: '/images/about/serum-seasonly-col2.webp',
    },
    links: {
      col1Top:
        '/san-pham/tinh-chat-dac-tri/serum-tr-nm-trng-da-intelderm-3-tranexamic-acid--10-niacinamide-30ml-chnh-hng',
      col1Bottom:
        '/san-pham/tinh-chat-dac-tri/kem-giam-mun-mo-nam-tre-hoa-da-nanogize-tretinoin-0-1-10ml',
      col2:
        '/san-pham/tinh-chat-dac-tri/serum-tr-mn-seasonly-blemish-control-serum-30ml',
    },
    alts: {
      col1Top:
        'Serum Trị Nám, Trắng Da Intelderm 3% Tranexamic Acid + 10% Niacinamide 30ml',
      col1Bottom:
        'Kem giảm mụn, mờ nám, trẻ hoá da Nanogize Tretinoin 0.1% (10ml)',
      col2:
        'Serum trị mụn Seasonly Blemish-Control Serum 30ml',
    },
  },
  {
    id: '03',
    number: '03',
    category: 'Phác đồ',
    name: 'Thực phẩm chức năng',
    images: {
      col1Top:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055759_963cfb0b-4bd1-4b0f-9d0a-09bd6cf95b2f.png&w=1280&q=85',
      col1Bottom:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_060108_438f781a-9846-4dcc-89ab-c4e6cb830f5b.png&w=1280&q=85',
      col2:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055818_9d062121-ad7e-46b9-999a-1a6a692ef1ee.png&w=1280&q=85',
    },
  },
];

interface ProjectCardProps {
  project: ProjectItem;
  index: number;
  totalCards: number;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  totalCards,
  progress,
  range,
  targetScale,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start'],
  });

  const imageScale = useTransform(scrollYProgress, [2, 0], [2, 1]);
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      ref={containerRef}
      className="h-[85vh] flex items-center justify-center sticky top-24 md:top-32"
      style={{
        top: `calc(5rem + ${index * 28}px)`,
      }}
    >
      <motion.div
        style={{
          scale,
          top: `${index * 28}px`,
        }}
        className="relative w-full max-w-6xl rounded-[40px] sm:rounded-[50px] md:rounded-[60px] bg-[rgba(15,23,34,0.78)] lg:bg-[rgba(15,23,34,0.74)] backdrop-blur-md shadow-[0_24px_52px_-38px_rgba(4,10,24,0.58)] lg:shadow-[0_30px_64px_-38px_rgba(4,10,24,0.64)] p-4 sm:p-6 md:p-8 flex flex-col gap-6 origin-top will-change-transform"
      >
        {/* Ambient glow matching navbar darkmode */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px]">
          <div className="absolute -left-10 top-0 h-44 w-44 rounded-full bg-[#ff7f5d]/12 blur-3xl"></div>
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#35b7a5]/15 blur-3xl"></div>
        </div>

        {/* Top row */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 sm:pb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <span
              style={{ fontSize: 'clamp(2.2rem, 6vw, 5rem)' }}
              className="font-heading font-black text-[#D7E2EA] leading-none select-none tracking-tighter"
            >
              {project.number}
            </span>
            <div className="flex flex-col">
              <span className="font-sans text-[#D7E2EA]/60 text-xs sm:text-sm uppercase tracking-widest font-normal">
                {project.category}
              </span>
              <h3 className="font-heading text-white font-bold text-lg sm:text-2xl md:text-3xl uppercase tracking-wider">
                {project.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Bottom row: Two-column image grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Left column (40% width): 2 stacked images */}
          <div className="md:col-span-5 flex flex-col gap-4 sm:gap-6 justify-between">
            <div
              style={{ height: 'clamp(130px, 16vw, 230px)' }}
              className="w-full overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px] bg-[#1a1a1a]"
            >
              {project.links?.col1Top ? (
                <a
                  href={project.links.col1Top}
                  className="group block w-full h-full cursor-pointer overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px]"
                  title={project.alts?.col1Top || `${project.name} preview top`}
                >
                  <img
                    src={project.images.col1Top}
                    alt={project.alts?.col1Top || `${project.name} preview top`}
                    loading="lazy"
                    className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 group-hover:scale-105 select-none"
                  />
                </a>
              ) : (
                <img
                  src={project.images.col1Top}
                  alt={project.alts?.col1Top || `${project.name} preview top`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
                />
              )}
            </div>
            <div
              style={{ height: 'clamp(160px, 22vw, 340px)' }}
              className="w-full overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px] bg-[#1a1a1a]"
            >
              {project.links?.col1Bottom ? (
                <a
                  href={project.links.col1Bottom}
                  className="group block w-full h-full cursor-pointer overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px]"
                  title={project.alts?.col1Bottom || `${project.name} preview bottom`}
                >
                  <img
                    src={project.images.col1Bottom}
                    alt={project.alts?.col1Bottom || `${project.name} preview bottom`}
                    loading="lazy"
                    className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 group-hover:scale-105 select-none"
                  />
                </a>
              ) : (
                <img
                  src={project.images.col1Bottom}
                  alt={project.alts?.col1Bottom || `${project.name} preview bottom`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
                />
              )}
            </div>
          </div>

          {/* Right column (60% width): 1 tall image */}
          <div className="md:col-span-7 h-full min-h-[260px] sm:min-h-[320px] md:min-h-0 overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px] bg-[#1a1a1a]">
            {project.links?.col2 ? (
              <a
                href={project.links.col2}
                className="group block w-full h-full cursor-pointer overflow-hidden rounded-[40px] sm:rounded-[50px] md:rounded-[60px]"
                title={project.alts?.col2 || `${project.name} main visual`}
              >
                <img
                  src={project.images.col2}
                  alt={project.alts?.col2 || `${project.name} main visual`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 group-hover:scale-105 select-none"
                />
              </a>
            ) : (
              <img
                src={project.images.col2}
                alt={project.alts?.col2 || `${project.name} main visual`}
                loading="lazy"
                className="w-full h-full object-cover rounded-[40px] sm:rounded-[50px] md:rounded-[60px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
              />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const ProjectsSection: React.FC = () => {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const totalCards = PROJECTS.length;

  return (
    <section
      ref={containerRef}
      id="projects"
      className="relative w-full bg-transparent rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 pt-20 sm:pt-28 md:pt-36 pb-32 px-4 sm:px-6 md:px-10 z-10 select-none"
    >
      {/* Heading: "Project" (singular) */}
      <div className="max-w-6xl mx-auto mb-16 sm:mb-20 md:mb-24 flex justify-center">
        <FadeIn delay={0} y={40}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="text-primary font-heading font-black uppercase leading-tight tracking-tight text-center py-2"
          >
            Sản Phẩm
          </h2>
        </FadeIn>
      </div>

      {/* 3 Sticky-stacking project cards */}
      <div className="max-w-6xl mx-auto flex flex-col">
        {PROJECTS.map((project, index) => {
          // Scale calculation: targetScale = 1 - (totalCards - 1 - index) * 0.03
          const targetScale = 1 - (totalCards - 1 - index) * 0.03;
          const range: [number, number] = [index * 0.25, 1];

          return (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              totalCards={totalCards}
              progress={scrollYProgress}
              range={range}
              targetScale={targetScale}
            />
          );
        })}
      </div>
    </section>
  );
};

export default ProjectsSection;
