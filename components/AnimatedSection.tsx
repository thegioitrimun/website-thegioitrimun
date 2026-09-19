import React, { useLayoutEffect, useRef } from 'react';
import { createRevealController } from './motion/reveal';

const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string; stagger?: number; threshold?: number; triggerOnce?: boolean }> = ({ children, className, stagger = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || document.documentElement.dataset.adminApp === 'true') return;
    // One reveal per visual region, without stacked transforms on nested sections.
    if (ref.current.parentElement?.closest('[data-scroll-reveal-item]')) return;
    const controller = createRevealController();
    controller.observe(ref.current, stagger);
    return () => controller.disconnect();
  }, [stagger]);
  return <div ref={ref} data-scroll-reveal-item="true" className={className}>{children}</div>;
};
export default AnimatedSection;
