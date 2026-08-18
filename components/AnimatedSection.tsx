
import React, { useRef } from 'react';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

const AnimatedSection: React.FC<{children: React.ReactNode, className?: string, stagger?: number, threshold?: number, triggerOnce?: boolean}> = ({ children, className, stagger = 0, threshold = 0.08, triggerOnce = true }) => {
    const ref = useRef<HTMLDivElement>(null);
    const isVisible = useIntersectionObserver(ref, {
        threshold,
        triggerOnce,
        rootMargin: '0px 0px -6% 0px',
    });

    return (
        <div
            ref={ref}
            data-scroll-reveal-item="true"
            className={`${className || ''} transform-gpu transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
            style={{ transitionDelay: `${isVisible ? stagger : 0}ms`}}
        >
            {children}
        </div>
    );
};

export default AnimatedSection;
