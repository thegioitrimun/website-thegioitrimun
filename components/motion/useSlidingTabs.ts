import { useLayoutEffect, useRef, useState } from 'react';

/** Adapted from transitions.dev tabs-sliding, including resize/first-paint snapping. */
export default function useSlidingTabs(activeKey: string, signature: string) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const initialized = useRef(false);
  const moveRef = useRef<(animate: boolean) => void>(() => {});
  useLayoutEffect(() => {
    const pill = bar?.querySelector<HTMLElement>('.t-tabs-pill');
    if (!bar || !pill) return;
    initialized.current = false;
    const move = (animate: boolean) => {
      const tab = bar.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!tab || !tab.offsetWidth) { initialized.current = false; return; }
      if (!animate) pill.style.transition = 'none';
      pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      pill.style.height = `${tab.offsetHeight}px`;
      pill.style.opacity = '1';
      if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
      initialized.current = true;
    };
    moveRef.current = move;
    move(false);
    const observer = new ResizeObserver(() => move(false));
    observer.observe(bar);
    bar.querySelectorAll('button').forEach(button => observer.observe(button));
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const tabs = Array.from(bar.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const index = tabs.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
      tabs[next]?.click();
    };
    bar.addEventListener('keydown', onKey);
    return () => { observer.disconnect(); bar.removeEventListener('keydown', onKey); moveRef.current = () => {}; };
  }, [bar, signature]);
  useLayoutEffect(() => moveRef.current(initialized.current), [activeKey, signature, bar]);
  return setBar;
}
