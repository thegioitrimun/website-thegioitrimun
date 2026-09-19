import { motionDuration } from './SurfacePresence';

/** Reveal only below-the-fold content; settle removes compositing hints and containing blocks. */
export function createRevealController() {
  const elements = new Set<HTMLElement>();
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const settle = (element: HTMLElement) => {
    clearTimeout(timers.get(element));
    timers.delete(element);
    element.dataset.reveal = 'complete';
    element.style.removeProperty('--scroll-reveal-delay');
  };
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target as HTMLElement;
      observer?.unobserve(element);
      element.dataset.reveal = 'visible';
      const delay = parseFloat(element.style.getPropertyValue('--scroll-reveal-delay')) || 0;
      timers.set(element, setTimeout(() => settle(element), motionDuration('--site-reveal-duration', 400) + delay));
    });
  }, { threshold: 0, rootMargin: '0px 0px 40px 0px' }) : null;
  const onPreference = () => { if (preference.matches) { observer?.disconnect(); elements.forEach(settle); } };
  preference.addEventListener('change', onPreference);
  return {
    observe(element: HTMLElement, delay = 0) {
      if (elements.has(element)) return;
      elements.add(element);
      element.classList.add('site-reveal');
      const bounds = element.getBoundingClientRect();
      if (!observer || preference.matches || (bounds.height > 0 && bounds.top < window.innerHeight)) {
        settle(element);
        return;
      }
      element.dataset.reveal = 'pending';
      element.style.setProperty('--scroll-reveal-delay', `${Math.min(Math.max(delay, 0), 120)}ms`);
      observer.observe(element);
    },
    disconnect() {
      observer?.disconnect();
      preference.removeEventListener('change', onPreference);
      elements.forEach(settle);
      elements.clear();
    },
  };
}
