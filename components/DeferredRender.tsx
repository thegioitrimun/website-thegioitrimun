import React, { useEffect, useRef, useState } from 'react';

interface DeferredRenderProps {
  children: React.ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
}

const DeferredRender: React.FC<DeferredRenderProps> = ({
  children,
  minHeight = 320,
  rootMargin = '80px 0px',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={isVisible ? undefined : { minHeight: `${minHeight}px`, containIntrinsicSize: `${minHeight}px` }}
    >
      {isVisible ? children : null}
    </div>
  );
};

export default DeferredRender;
