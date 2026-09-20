import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import FadeIn from './FadeIn';
import { useTranslation } from 'react-i18next';
import type { BlogPost, BlogCategory } from '../../types';
import { getBlogDetailPath } from '../../src/appRouting';
import { getLocalizedValue } from '../../src/relatedContent';

export interface StoriesSectionProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  onSelectPost: (slug: string, categorySlug?: string) => void;
}

export const StoriesSection: React.FC<StoriesSectionProps> = ({ posts, categories, onSelectPost }) => {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const stories = useMemo(() => [...posts]
    .filter(post => post.slug && post.title)
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.slug.localeCompare(b.slug))
    .slice(0, 5)
    .map(post => {
      const date = new Date(post.date);
      const category = categories.find(item => item.slug === post.category_slug);
      return {
        id: post.slug,
        post,
        href: getBlogDetailPath(post, categories),
        title: getLocalizedValue(post, 'title', i18n.language),
        excerpt: getLocalizedValue(post, 'summary', i18n.language),
        theme: getLocalizedValue(category, 'name', i18n.language) || 'Kiến thức',
        date: Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(i18n.language === 'cn' ? 'zh-CN' : i18n.language, { day: '2-digit', month: 'long', year: 'numeric' }),
        author: post.author?.name || 'Thế Giới Trị Mụn',
      };
    }), [posts, categories, i18n.language]);
  const openStory = (event: React.MouseEvent<HTMLAnchorElement>, post: BlogPost) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelectPost(post.slug, post.category_slug);
  };

  // Outer container ref for scroll-pinned tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  const [trackDistance, setTrackDistance] = useState(0);

  // Measure desktop window and calculate precise horizontal scroll travel
  useEffect(() => {
    const handleResize = () => {
      if (trackRef.current) {
        // Calculate the exact amount needed to reveal all cards with comfortable end padding
        const scrollWidth = trackRef.current.scrollWidth;
        const viewportWidth = window.innerWidth;
        const distance = Math.max(0, scrollWidth - viewportWidth + 120);
        setTrackDistance(distance);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [stories]);

  // Framer-motion scroll-driven progress across the section's vertical height
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth horizontal translation tied 100% to vertical scroll on desktop
  const x = useTransform(scrollYProgress, [0, 1], [0, -trackDistance]);

  // Mobile scroll buttons helper
  const handleMobileScroll = (direction: 'left' | 'right') => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section
      id="blog-section"
      ref={containerRef}
      className="relative w-full bg-transparent select-none lg:min-h-[250vh]"
    >
      {/* Pinned Sticky Frame (Desktop: sticks to viewport while user scrolls down; Mobile: natural section) */}
      <div className="relative w-full lg:sticky lg:top-0 lg:h-screen lg:flex lg:flex-col lg:justify-center overflow-hidden py-20 sm:py-28 lg:py-0 px-4 sm:px-8 lg:px-12">
        
        {/* 1. Heading: "Kiến Thức" centered like "Sản Phẩm" */}
        <div className="max-w-6xl mx-auto mb-10 sm:mb-14 lg:mb-16 flex flex-col items-center justify-center w-full">
          <FadeIn delay={0}>
            <h2
              style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
              className="text-primary font-heading font-black uppercase leading-tight tracking-tight text-center py-2"
            >
              Kiến Thức
            </h2>
          </FadeIn>

          {/* Desktop scroll cue / progress indicator */}
          <div className="hidden lg:flex items-center gap-3 mt-3">
            <span className="text-xs uppercase tracking-widest text-slate-400/80 font-medium">
              Cuộn để khám phá
            </span>
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                style={{ scaleX: scrollYProgress }}
                className="w-full h-full bg-primary origin-left"
              />
            </div>
          </div>

          {/* Mobile/Tablet Prev/Next buttons */}
          <div className="flex lg:hidden items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => handleMobileScroll('left')}
              className="w-10 h-10 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Previous story"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleMobileScroll('right')}
              className="w-10 h-10 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Next story"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Desktop: Scroll-Pinned Horizontal Motion Track */}
        <div className="hidden lg:block w-full overflow-visible">
          <motion.div
            ref={trackRef}
            style={{ x }}
            className="flex gap-6 will-change-transform pb-4"
          >
            {stories.map((story, index) => {
              const colorVariant = index % 3;
              const bgClasses =
                colorVariant === 0
                  ? 'bg-[#edf5f3] text-[#0f231e] dark:bg-[#0c2229] dark:text-[#d3eef5] border-teal-200/50 dark:border-teal-500/20'
                  : colorVariant === 1
                  ? 'bg-[#fcf5ef] text-[#2c1b12] dark:bg-[#1a1c29] dark:text-[#f2e6dc] border-orange-200/50 dark:border-amber-500/20'
                  : 'bg-[#f0f4f8] text-[#122336] dark:bg-[#0e1d33] dark:text-[#d8e6f7] border-sky-200/50 dark:border-sky-500/20';

              const accentBadgeClasses =
                colorVariant === 0
                  ? 'bg-[#0f231e]/10 text-[#0f231e] dark:bg-teal-400/15 dark:text-teal-300'
                  : colorVariant === 1
                  ? 'bg-[#2c1b12]/10 text-[#2c1b12] dark:bg-amber-400/15 dark:text-amber-300'
                  : 'bg-[#122336]/10 text-[#122336] dark:bg-sky-400/15 dark:text-sky-300';

              return (
                <div
                  key={story.id}
                  className="shrink-0 w-[420px] max-w-[440px]"
                >
                  <a
                    href={story.href}
                    onClick={event => openStory(event, story.post)}
                    className={`group relative h-full min-h-[440px] rounded-[36px] p-8 flex flex-col justify-between border shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer select-none ${bgClasses}`}
                  >
                    {/* Top Content */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${accentBadgeClasses}`}
                        >
                          {story.theme}
                        </span>
                      </div>

                      <h3 className="font-heading font-bold text-2xl leading-snug line-clamp-3 mb-3 group-hover:opacity-90 transition-opacity">
                        {story.title}
                      </h3>

                      <p className="font-sans text-sm leading-relaxed opacity-75 line-clamp-4">
                        {story.excerpt}
                      </p>
                    </div>

                    {/* Bottom Footer Section */}
                    <div className="pt-6 mt-6 border-t border-current/10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium opacity-60">
                          {story.date}
                        </p>
                        <p className="text-xs font-semibold opacity-80 mt-0.5">
                          {story.author}
                        </p>
                      </div>

                      {/* "Read article" button with SVG arrow */}
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:translate-x-1.5 transition-transform">
                        <span>Đọc bài</span>
                        <svg
                          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 7 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M0.530335 12.5303L5.82323 7.23738C6.21375 6.84686 6.21375 6.21369 5.82323 5.82317L0.530334 0.530273"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* 3. Mobile / Tablet: Smooth Native Horizontal Scroll & Snap Track */}
        <div
          ref={mobileScrollRef}
          className="lg:hidden w-full overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex gap-4 sm:gap-6 pb-6 pt-2 snap-x snap-mandatory"
          style={{
            scrollBehavior: reduceMotion ? 'auto' : 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {stories.map((story, index) => {
            const colorVariant = index % 3;
            const bgClasses =
              colorVariant === 0
                ? 'bg-[#edf5f3] text-[#0f231e] dark:bg-[#0c2229] dark:text-[#d3eef5] border-teal-200/50 dark:border-teal-500/20'
                : colorVariant === 1
                ? 'bg-[#fcf5ef] text-[#2c1b12] dark:bg-[#1a1c29] dark:text-[#f2e6dc] border-orange-200/50 dark:border-amber-500/20'
                : 'bg-[#f0f4f8] text-[#122336] dark:bg-[#0e1d33] dark:text-[#d8e6f7] border-sky-200/50 dark:border-sky-500/20';

            const accentBadgeClasses =
              colorVariant === 0
                ? 'bg-[#0f231e]/10 text-[#0f231e] dark:bg-teal-400/15 dark:text-teal-300'
                : colorVariant === 1
                ? 'bg-[#2c1b12]/10 text-[#2c1b12] dark:bg-amber-400/15 dark:text-amber-300'
                : 'bg-[#122336]/10 text-[#122336] dark:bg-sky-400/15 dark:text-sky-300';

            return (
              <div
                key={story.id}
                className="snap-start shrink-0 w-[85vw] sm:w-[380px]"
              >
                <a
                  href={story.href}
                  onClick={event => openStory(event, story.post)}
                  className={`group relative h-full min-h-[420px] rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 flex flex-col justify-between border shadow-lg cursor-pointer select-none ${bgClasses}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${accentBadgeClasses}`}
                      >
                        {story.theme}
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-xl sm:text-2xl leading-snug line-clamp-3 mb-3">
                      {story.title}
                    </h3>

                    <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-75 line-clamp-4">
                      {story.excerpt}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-current/10 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] sm:text-xs font-medium opacity-60">
                        {story.date}
                      </p>
                      <p className="text-[11px] sm:text-xs font-semibold opacity-80 mt-0.5">
                        {story.author}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
                      <span>Đọc bài</span>
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 7 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M0.530335 12.5303L5.82323 7.23738C6.21375 6.84686 6.21375 6.21369 5.82323 5.82317L0.530334 0.530273"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
};

export default StoriesSection;
