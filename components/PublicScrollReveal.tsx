import React, { useLayoutEffect, useRef } from 'react';
import { createRevealController } from './motion/reveal';

const PublicScrollReveal: React.FC<{ children: React.ReactNode; routeKey: string }> = ({ children, routeKey }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scope = ref.current;
    if (!scope) return;
    const controller = createRevealController();
    let frame = 0;
    const collect = () => {
      scope.querySelectorAll<HTMLElement>('section, [data-scroll-section]').forEach(element => {
        if (element.id === 'home' || element.dataset.scrollReveal === 'off') return;
        if (element.closest('[data-scroll-reveal-item], [data-no-scroll-reveal], [role="dialog"], [aria-modal="true"]')) return;
        if (element.parentElement?.closest('section, [data-scroll-section]') || element.querySelector('[data-scroll-reveal-item]')) return;
        controller.observe(element);
      });
    };
    collect();
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(collect); });
    observer.observe(scope, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controller.disconnect(); };
  }, [routeKey]);
  return <div ref={ref} className="public-scroll-reveal-scope">{children}</div>;
};
export default PublicScrollReveal;
