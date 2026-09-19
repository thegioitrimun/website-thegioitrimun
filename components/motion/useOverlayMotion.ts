import { useLayoutEffect, useRef, useState } from 'react';
import { motionDuration, reducedMotion } from './SurfacePresence';

import { lockScroll } from './scrollLock';

/** CSS owns timing; React owns presence. Closing/reopening cancels the previous lifecycle. */
export default function useOverlayMotion(open: boolean, onClose: () => void, kind: 'panel' | 'modal' = 'panel') {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [retained, setRetained] = useState(open);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    if (!open) {
      setVisible(false);
      if (node) node.inert = true;
      timer = setTimeout(() => setRetained(false), motionDuration(`--${kind}-close-dur`, 250));
      return () => clearTimeout(timer);
    }
    if (!node) return;
    setRetained(true);
    node.inert = false;
    const unlock = lockScroll();
    const previousFocus = document.activeElement as HTMLElement | null;
    const show = () => {
      setVisible(true);
      node.querySelector<HTMLElement>('[data-overlay-autofocus], button, [href], input, select, textarea')?.focus({ preventScroll: true });
    };
    void node.offsetWidth;
    if (reducedMotion()) show();
    else frame = requestAnimationFrame(show);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[inert]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      unlock();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, kind]);
  return { ref, mounted: open || retained, visible: open && visible };
}
