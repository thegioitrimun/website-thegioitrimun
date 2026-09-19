import { lockScroll } from './scrollLock';
import React, { useLayoutEffect, useRef, useState } from 'react';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function motionDuration(token: string, fallback: number): number {
  if (reducedMotion()) return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const amount = parseFloat(value);
  return Number.isFinite(amount) ? amount * (value.endsWith('ms') ? 1 : 1000) : fallback;
}

/** Keep the last rendered surface through its CSS exit; never keep its controls interactive. */
export default function SurfacePresence({ children, kind = 'dropdown' }: {
  children: React.ReactNode;
  kind?: 'dropdown' | 'modal' | 'panel' | 'toast';
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef<React.ReactNode>(null);
  const [retained, setRetained] = useState(Boolean(children));
  const present = Boolean(children);
  useLayoutEffect(() => { if (present) previous.current = children; });
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const surfaces = node.querySelectorAll<HTMLElement>('[data-motion-surface]');
    const change = (open: boolean) => {
      node.dataset.open = String(open);
      surfaces.forEach(surface => {
        surface.classList.toggle('is-open', open);
        surface.classList.toggle('is-closing', !open);
        surface.dataset.open = String(open);
      });
    };
    node.inert = !present;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        node.querySelector<HTMLElement>('.admin-backdrop, .motion-backdrop')?.click();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const unlock = present && kind === 'modal' ? lockScroll() : undefined;
    if (present && kind === 'modal') {
      node.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true });
      document.addEventListener('keydown', onKey);
    }
    if (present) {
      setRetained(true);
      surfaces.forEach(surface => surface.classList.remove('is-closing'));
      // Commit the pre-open style before applying the skill's open class.
      void node.offsetWidth;
      if (reducedMotion()) change(true);
      else frame = requestAnimationFrame(() => change(true));
    } else {
      change(false);
      const token = kind === 'toast' ? '--toast-close' : `--${kind}-close-dur`;
      timer = setTimeout(() => { setRetained(false); previous.current = null; }, motionDuration(token, 150));
    }
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      unlock?.();
      if (present && kind === 'modal') previousFocus?.focus({ preventScroll: true });
    };
  }, [present, kind]);
  return <div ref={root} className={`motion-presence ${kind === 'panel' ? 't-acc' : ''}`} aria-hidden={!present || undefined}>
    {kind === 'panel' ? <div className="t-acc-panel"><div className="t-acc-panel-inner min-h-0">
      {present ? children : retained ? previous.current : null}
    </div></div> : present ? children : retained ? previous.current : null}
  </div>;
}
