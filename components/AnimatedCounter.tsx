import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  formatter?: (val: number) => string;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  formatter = (val) => val.toLocaleString('vi-VN'),
  duration = 500,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    // Respect user's motion preferences
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(endVal);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    // Quartic ease-out for a smooth Apple-like deceleration
    const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = Math.round(startVal + (endVal - startVal) * easedProgress);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return (
    <span className={`tabular-nums transition-opacity duration-300 ${className}`}>
      {formatter(displayValue)}
    </span>
  );
};

export interface AnimatedConicScoreGaugeProps {
  score: number;
  label?: string;
  size?: number;
  innerSize?: number;
  color?: string;
  bgColor?: string;
  textSize?: string;
  className?: string;
}

export const AnimatedConicScoreGauge: React.FC<AnimatedConicScoreGaugeProps> = ({
  score,
  label = 'Điểm an toàn',
  size = 88,
  innerSize = 68,
  color = '#299582',
  bgColor = '#dfe8ec',
  textSize = 'text-xl',
  className = '',
}) => {
  const [currentScore, setCurrentScore] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetScore = Math.max(0, Math.min(100, Math.round(score || 0)));

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;
    let observer: IntersectionObserver | null = null;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setCurrentScore(targetScore);
      return;
    }

    const animate = () => {
      const duration = 1100;
      const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = easeOutQuart(progress);
        const val = Math.round(targetScore * eased);
        setCurrentScore(val);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setCurrentScore(targetScore);
        }
      };
      animationFrameId = requestAnimationFrame(step);
    };

    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry && entry.isIntersecting) {
            animate();
            if (observer) observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
    } else {
      animate();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (observer) observer.disconnect();
    };
  }, [targetScore]);

  return (
    <div
      ref={containerRef}
      className={`grid shrink-0 place-items-center rounded-full transition-transform duration-300 hover:scale-105 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: `conic-gradient(${color} ${currentScore}%, ${bgColor} 0)`,
      }}
      aria-label={`${label}: ${targetScore}%`}
    >
      <div
        className="grid place-items-center rounded-full bg-white text-center shadow-inner dark:bg-card"
        style={{ width: `${innerSize}px`, height: `${innerSize}px` }}
      >
        <span className={`${textSize} font-black tracking-[-0.04em] text-foreground tabular-nums`}>
          {currentScore}%
        </span>
      </div>
    </div>
  );
};

export default AnimatedCounter;

