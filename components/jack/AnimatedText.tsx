import React, { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';

interface CharacterProps {
  char: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}

const Character: React.FC<CharacterProps> = ({ char, progress, start, end }) => {
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  const isSpace = char === ' ';

  return (
    <span className="relative inline-block">
      <span className="opacity-0 select-none">{isSpace ? '\u00A0' : char}</span>
      <motion.span style={{ opacity }} className="absolute inset-0 select-none">
        {isSpace ? '\u00A0' : char}
      </motion.span>
    </span>
  );
};

interface AnimatedTextProps {
  text: string;
  className?: string;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({ text, className = '' }) => {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.2'],
  });

  const words = text.split(' ');
  const total = text.length;
  let charCounter = 0;

  return (
    <p ref={containerRef} className={className}>
      {words.map((word, wordIndex) => {
        const wordChars = word.split('');
        const startCharIndex = charCounter;
        charCounter += word.length + 1;

        return (
          <React.Fragment key={wordIndex}>
            <span className="inline-block whitespace-nowrap">
              {wordChars.map((char, charIdx) => {
                const globalIndex = startCharIndex + charIdx;
                const start = globalIndex / total;
                const end = Math.min(1, (globalIndex + 1) / total);
                return (
                  <Character
                    key={charIdx}
                    char={char}
                    progress={scrollYProgress}
                    start={start}
                    end={end}
                  />
                );
              })}
            </span>
            {wordIndex < words.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </p>
  );
};

export default AnimatedText;
