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
      col1Top:
        'https://thegioitrimun.vn/r2/product-images/products/kem-chong-nang-4-in-1-dermeden-day-cream-global-action-combination-skin-spf-50-pa-da-hon-hop-da-dau-50ml/manual-gallery/9aaa1ee75f95-0081-kem-chong-nang-4-in-1-dermeden-day-cream-global-action-combination-skin-spf-50-pa-da-hon-hop-da-dau-kem-chong-nang-.webp',
      col1Bottom:
        'https://thegioitrimun.vn/r2/product-images/products/kem-chong-nang-vitamin-d-dermeden-dd-cream-spf50-50ml/manual-gallery/be76d253b3f2-0083-kem-chong-nang-vitamin-d-dermeden-dd-cream-spf50-50ml-kem-chong-nang-vitamin-d-dermeden-dd-cream-spf50-50ml-01-gall.webp',
      col2:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png&w=1280&q=85',
    },
    links: {
      col1Top:
        '/san-pham/kem-chong-nang/kem-chong-nang-4-in-1-dermeden-day-cream-global-action-combination-skin-spf-50-pa-da-hon-hop-da-dau-50ml',
      col1Bottom:
        '/san-pham/kem-chong-nang/kem-chong-nang-vitamin-d-dermeden-dd-cream-spf50-50ml',
    },
    alts: {
      col1Top:
        'Kem chống nắng 4 in 1 DermEden Day Cream Global Action Combination Skin SPF 50 PA+++',
      col1Bottom:
        'Kem chống nắng Vitamin D DermEden DD Cream SPF50',
    },
  },
  {
    id: '02',
    number: '02',
    category: 'Cá nhân',
    name: 'Tinh Chất Đặc Trị',
    images: {
      col1Top:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055654_911201c5-36d9-4bc6-bac7-331adfce159f.png&w=1280&q=85',
      col1Bottom:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055723_5ceda0b8-d9c2-4665-b2e3-83ba19ba76d1.png&w=1280&q=85',
      col2:
        'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055753_adc5dcbd-a8e6-49c0-b43a-9b030d835cea.png&w=1280&q=85',
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
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      className={`sticky top-16 md:top-20 flex flex-col items-center ${
        index === totalCards - 1 ? 'pb-16 md:pb-24' : 'pb-[50vh] md:pb-[70vh]'
      }`}
      style={{
        top: `calc(4rem + ${index * 20}px)`,
      }}
    >
      <motion.div
        style={{
          scale,
        }}
        className="relative w-full max-w-6xl rounded-[32px] sm:rounded-[40px] md:rounded-[48px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:p-5 md:p-6 lg:p-7 flex flex-col gap-4 md:gap-5 shadow-2xl origin-top will-change-transform"
      >
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D7E2EA]/20 pb-3 md:pb-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <span
              style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
              className="font-heading font-black text-[#D7E2EA] leading-none select-none tracking-tighter"
            >
              {project.number}
            </span>
            <div className="flex flex-col">
              <span className="font-sans text-[#D7E2EA]/60 text-xs sm:text-sm uppercase tracking-widest font-normal">
                {project.category}
              </span>
              <h3 className="font-heading text-white font-bold text-lg sm:text-xl md:text-2xl uppercase tracking-wider">
                {project.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Bottom row: Two-column image grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 md:gap-6 items-stretch md:h-[clamp(360px,46vh,500px)]">
          {/* Left column (col-span-4 on md, col-span-3 on lg): 2 square product images */}
          <div className="md:col-span-4 lg:col-span-3 grid grid-cols-2 md:flex md:flex-col gap-3 sm:gap-4 justify-between h-full">
            <div
              className="w-full h-auto md:h-[calc(50%-0.5rem)] aspect-square overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px] bg-[#1a1a1a]"
            >
              {project.links?.col1Top ? (
                <a
                  href={project.links.col1Top}
                  className="group block w-full h-full cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px]"
                  title={project.alts?.col1Top || `${project.name} preview top`}
                >
                  <img
                    src={project.images.col1Top}
                    alt={project.alts?.col1Top || `${project.name} preview top`}
                    loading="lazy"
                    className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 group-hover:scale-105 select-none"
                  />
                </a>
              ) : (
                <img
                  src={project.images.col1Top}
                  alt={project.alts?.col1Top || `${project.name} preview top`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
                />
              )}
            </div>
            <div
              className="w-full h-auto md:h-[calc(50%-0.5rem)] aspect-square overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px] bg-[#1a1a1a]"
            >
              {project.links?.col1Bottom ? (
                <a
                  href={project.links.col1Bottom}
                  className="group block w-full h-full cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px]"
                  title={project.alts?.col1Bottom || `${project.name} preview bottom`}
                >
                  <img
                    src={project.images.col1Bottom}
                    alt={project.alts?.col1Bottom || `${project.name} preview bottom`}
                    loading="lazy"
                    className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 group-hover:scale-105 select-none"
                  />
                </a>
              ) : (
                <img
                  src={project.images.col1Bottom}
                  alt={project.alts?.col1Bottom || `${project.name} preview bottom`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
                />
              )}
            </div>
          </div>

          {/* Right column (col-span-8 on md, col-span-9 on lg): 1 tall visual image */}
          <div className="md:col-span-8 lg:col-span-9 h-[220px] sm:h-[260px] md:h-full overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px] bg-[#1a1a1a]">
            {project.links?.col2 ? (
              <a
                href={project.links.col2}
                className="group block w-full h-full cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[28px] md:rounded-[32px]"
                title={project.alts?.col2 || `${project.name} main visual`}
              >
                <img
                  src={project.images.col2}
                  alt={project.alts?.col2 || `${project.name} main visual`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 group-hover:scale-105 select-none"
                />
              </a>
            ) : (
              <img
                src={project.images.col2}
                alt={project.alts?.col2 || `${project.name} main visual`}
                loading="lazy"
                className="w-full h-full object-cover rounded-[20px] sm:rounded-[28px] md:rounded-[32px] transition-transform duration-500 hover:scale-105 pointer-events-none select-none"
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
      className="relative w-full bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 pt-20 sm:pt-28 md:pt-36 pb-32 px-4 sm:px-6 md:px-10 z-10 select-none"
    >
      {/* Heading: "Project" (singular) */}
      <div className="max-w-6xl mx-auto mb-16 sm:mb-20 md:mb-24 flex justify-center">
        <FadeIn delay={0} y={40}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="hero-heading font-heading font-black uppercase leading-tight tracking-tight text-center py-2"
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
