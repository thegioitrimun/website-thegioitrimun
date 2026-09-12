import React, { useRef, useState, useEffect } from 'react';

interface MarqueeVideoItem {
  video: string;
  poster: string;
  alt: string;
}

// Row 1: 9 unique treatment videos (runs to the right)
const ROW_1_RAW: MarqueeVideoItem[] = [
  {
    video: '/videos/about/video-1.mp4',
    poster: '/videos/about/poster-1.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 1',
  },
  {
    video: '/videos/about/video-11.mp4',
    poster: '/videos/about/poster-11.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 11',
  },
  {
    video: '/videos/about/video-9.mp4',
    poster: '/videos/about/poster-9.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 9',
  },
  // --- New Videos 3 (Center Position of Row 1) ---
  {
    video: '/videos/about/video-14.mp4',
    poster: '/videos/about/poster-14.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 14',
  },
  {
    video: '/videos/about/video-15.mp4',
    poster: '/videos/about/poster-15.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 15',
  },
  // ------------------------------------------------
  {
    video: '/videos/about/video-8.mp4',
    poster: '/videos/about/poster-8.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 8',
  },
  {
    video: '/videos/about/video-5.mp4',
    poster: '/videos/about/poster-5.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 5',
  },
  {
    video: '/videos/about/video-6.mp4',
    poster: '/videos/about/poster-6.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 6',
  },
  {
    video: '/videos/about/video-7.mp4',
    poster: '/videos/about/poster-7.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 7',
  },
];

// Row 2: 8 unique treatment videos (runs to the left, 0% overlap with Row 1)
const ROW_2_RAW: MarqueeVideoItem[] = [
  {
    video: '/videos/about/video-4.mp4',
    poster: '/videos/about/poster-4.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 4',
  },
  {
    video: '/videos/about/video-17.mp4',
    poster: '/videos/about/poster-17.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 17',
  },
  {
    video: '/videos/about/video-10.mp4',
    poster: '/videos/about/poster-10.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 10',
  },
  // --- New Videos 3 (Center Position of Row 2) ---
  {
    video: '/videos/about/video-16.mp4',
    poster: '/videos/about/poster-16.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 16',
  },
  {
    video: '/videos/about/video-3.mp4',
    poster: '/videos/about/poster-3.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 3',
  },
  // ------------------------------------------------
  {
    video: '/videos/about/video-2.mp4',
    poster: '/videos/about/poster-2.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 2',
  },
  {
    video: '/videos/about/video-12.mp4',
    poster: '/videos/about/poster-12.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 12',
  },
  {
    video: '/videos/about/video-13.mp4',
    poster: '/videos/about/poster-13.jpg',
    alt: 'Quy trình liệu trình chuyên sâu 13',
  },
];

// Repeated to guarantee seamless infinite scrolling across wide monitors
const ROW_1 = [...ROW_1_RAW, ...ROW_1_RAW, ...ROW_1_RAW];
const ROW_2 = [...ROW_2_RAW, ...ROW_2_RAW, ...ROW_2_RAW];

interface VideoCardProps {
  item: MarqueeVideoItem;
  uniqueKey: string;
}

const VideoCard: React.FC<VideoCardProps> = ({ item }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Autoplay requires muted
    video.defaultMuted = true;
    video.muted = true;

    // Play only when visible or near viewport to prevent hardware decoder limits on mobile Safari
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().catch(() => {
                // Autoplay may wait for user gesture in rare browser power-save modes
              });
            } else {
              video.pause();
            }
          });
        },
        { rootMargin: '300px' }
      );
      observer.observe(video);
    } else {
      video.play().catch(() => {});
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    <div className="w-[420px] h-[270px] flex-shrink-0 rounded-2xl overflow-hidden bg-[#1A1A1A]">
      <video
        ref={videoRef}
        src={item.video}
        poster={item.poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={item.alt}
        className="w-full h-full object-cover rounded-2xl pointer-events-none"
      />
    </div>
  );
};

export const MarqueeSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (sectionRef.current) {
            const rect = sectionRef.current.getBoundingClientRect();
            const sectionTop = rect.top + window.scrollY;
            const calculated = (window.scrollY - sectionTop + window.innerHeight) * 0.3;
            setOffset(calculated);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-[#0C0C0C] pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden"
    >
      <div className="flex flex-col gap-3">
        {/* Row 1: Moves RIGHT on scroll: translateX(offset - 200) */}
        <div
          style={{
            transform: `translateX(${offset - 200}px)`,
            willChange: 'transform',
          }}
          className="flex gap-3"
        >
          {ROW_1.map((item, i) => (
            <VideoCard key={`r1-${i}`} item={item} uniqueKey={`r1-${i}`} />
          ))}
        </div>

        {/* Row 2: Moves LEFT on scroll: translateX(-(offset - 200)) */}
        <div
          style={{
            transform: `translateX(${-(offset - 200)}px)`,
            willChange: 'transform',
          }}
          className="flex gap-3"
        >
          {ROW_2.map((item, i) => (
            <VideoCard key={`r2-${i}`} item={item} uniqueKey={`r2-${i}`} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MarqueeSection;
