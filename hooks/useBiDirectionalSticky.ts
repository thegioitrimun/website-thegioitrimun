import { useEffect, useRef } from 'react';

export function useBiDirectionalSticky(defaultTop = 112, topPadding = 112, bottomPadding = 32) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        let lastScrollY = window.scrollY;
        let currentTop = defaultTop;
        let rafId: number;

        const handleScroll = () => {
            if (!ref.current) return;
            const element = ref.current;
            const rect = element.getBoundingClientRect();
            const elementHeight = element.offsetHeight;
            const vh = window.innerHeight;

            const scrollY = window.scrollY;
            const delta = scrollY - lastScrollY;
            lastScrollY = scrollY;

            // If element is shorter than viewport minus paddings, stick to top
            if (elementHeight <= vh - (topPadding + bottomPadding)) {
                currentTop = topPadding;
                element.style.top = `${topPadding}px`;
                return;
            }

            // Tall element logic
            const maxTop = topPadding;
            const minTop = vh - elementHeight - bottomPadding;

            // Check if element is currently at its sticky position
            const isSticky = Math.abs(rect.top - currentTop) <= 1;

            if (isSticky) {
                // Update currentTop based on scroll delta
                currentTop -= delta;
                currentTop = Math.max(minTop, Math.min(maxTop, currentTop));
                element.style.top = `${currentTop}px`;
            } else {
                // Reset currentTop if it's out of bounds
                if (rect.top > currentTop + 1) {
                    currentTop = maxTop;
                    element.style.top = `${maxTop}px`;
                } else if (rect.top < currentTop - 1) {
                    currentTop = minTop;
                    element.style.top = `${minTop}px`;
                }
            }
        };

        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(handleScroll);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });
        
        const timeoutId = setTimeout(handleScroll, 100);

        return () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [defaultTop, topPadding, bottomPadding]);

    return ref;
}
