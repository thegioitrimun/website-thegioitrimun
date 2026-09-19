import React, { useLayoutEffect, useRef } from 'react';
import { motionDuration, reducedMotion } from './AdminPresence';

/** Fade in the new module without remounting forms or retaining stale, actionable pages.
 * Opacity alone keeps nested fixed dialogs and sticky headers attached to the viewport. */
export default function AdminPageTransition({ children, identity }: {
  children: React.ReactNode; identity: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || reducedMotion()) return;
    const animation = ref.current.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: motionDuration('--page-fade-dur', 250),
      easing: getComputedStyle(document.documentElement).getPropertyValue('--page-fade-ease').trim(),
    });
    return () => animation.cancel();
  }, [identity]);
  return <div ref={ref} data-admin-page-transition="true">{children}</div>;
}
