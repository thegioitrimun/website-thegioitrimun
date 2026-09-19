import React from 'react';
import AnimatedSection from '../AnimatedSection';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** About sections share the same short reveal and reduced-motion behavior as the site. */
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className = '' }) => (
  <AnimatedSection className={className} stagger={delay * 1000}>
    {children}
  </AnimatedSection>
);

export default FadeIn;
