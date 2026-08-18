import React, { useLayoutEffect, useRef } from 'react';

interface PublicScrollRevealProps {
  children: React.ReactNode;
  routeKey: string;
}

const REVEAL_SELECTOR = 'section, [data-scroll-section]';
const SETTLE_AFTER_MS = 1200;

const PublicScrollReveal: React.FC<PublicScrollRevealProps> = ({ children, routeKey }) => {
  const scopeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches || !('IntersectionObserver' in window)) return;

    const settleTimers = new Map<HTMLElement, number>();
    let collectFrame: number | null = null;
    let revealOrder = 0;

    const settle = (element: HTMLElement) => {
      const timer = settleTimers.get(element);
      if (timer) window.clearTimeout(timer);
      settleTimers.delete(element);
      element.classList.remove('scroll-reveal-pending', 'is-revealed');
      element.dataset.scrollRevealState = 'complete';
      element.style.removeProperty('--scroll-reveal-delay');
    };

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;
          intersectionObserver.unobserve(element);

          window.requestAnimationFrame(() => {
            element.classList.add('is-revealed');
            const timer = window.setTimeout(() => settle(element), SETTLE_AFTER_MS);
            settleTimers.set(element, timer);
          });
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -9% 0px',
      },
    );

    const isEligible = (element: HTMLElement) => {
      if (element.dataset.scrollRevealState) return false;
      if (element.id === 'home' || element.dataset.scrollReveal === 'off') return false;
      if (element.closest('[data-scroll-reveal-item], [data-no-scroll-reveal], [role="dialog"], [aria-modal="true"]')) return false;

      // Existing AnimatedSection descendants already provide a more deliberate stagger.
      if (element.querySelector('[data-scroll-reveal-item]')) return false;
      return true;
    };

    const collectSections = () => {
      collectFrame = null;
      const sections = Array.from(scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

      sections.forEach((element) => {
        if (!isEligible(element)) return;

        element.dataset.scrollRevealState = 'pending';
        element.classList.add('scroll-reveal-pending');
        element.style.setProperty('--scroll-reveal-delay', `${(revealOrder % 3) * 55}ms`);
        revealOrder += 1;
        intersectionObserver.observe(element);
      });
    };

    const scheduleCollection = () => {
      if (collectFrame !== null) return;
      collectFrame = window.requestAnimationFrame(collectSections);
    };

    collectSections();

    const mutationObserver = new MutationObserver(scheduleCollection);
    mutationObserver.observe(scope, { childList: true, subtree: true });

    return () => {
      if (collectFrame !== null) window.cancelAnimationFrame(collectFrame);
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers.clear();
    };
  }, [routeKey]);

  return (
    <div ref={scopeRef} className="public-scroll-reveal-scope">
      {children}
    </div>
  );
};

export default PublicScrollReveal;
