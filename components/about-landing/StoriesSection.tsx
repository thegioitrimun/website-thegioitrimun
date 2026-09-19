import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface StoryArticle {
  id: string;
  theme: string;
  title: string;
  excerpt: string;
  content: string[];
  date: string;
  image?: string;
  author: string;
  readTime: string;
}

const STORIES_DATA: StoryArticle[] = [
  {
    id: 'story-1',
    theme: 'Phác đồ điều trị',
    title: 'Cá nhân hóa phác đồ: Hành trình chữa lành mụn nội tiết dai dẳng sau 5 năm',
    excerpt:
      'Mụn nội tiết không đơn thuần là vấn đề bề mặt. Tại Thế Giới Trị Mụn, chúng tôi kết hợp phân tích bảng thành phần INCI, kiểm soát hàng rào bảo vệ da và phác đồ can thiệp chứng cứ y khoa để phục hồi tận gốc.',
    content: [
      'Mụn nội tiết dai dẳng là một trong những thách thức phổ biến nhất đối với bệnh nhân da liễu. Sau nhiều năm thử nghiệm vô số sản phẩm không kiểm soát, hàng rào bảo vệ da thường bị tổn thương nặng nề, kèm theo tình trạng viêm đỏ kéo dài.',
      'Tại Thế Giới Trị Mụn, quy trình tiếp cận bắt đầu bằng việc giải mã toàn diện thói quen chăm sóc da và phân tích bảng thành phần INCI của mọi sản phẩm bệnh nhân đang dùng. Loại bỏ các hoạt chất gây bít tắc tiềm ẩn (comedogenic) và cồn khô gây kích ứng là bước tiên quyết.',
      'Phác đồ được xây dựng theo từng giai đoạn: Kháng viêm êm dịu, ổn định tiết bã nhờn, phục hồi hệ vi sinh trên da và tái thiết lập lớp màng lipid tự nhiên. Kết quả lâm sàng sau 12 tuần cho thấy tỷ lệ giảm thương tổn viêm đạt trên 85% mà không gây tái phát.',
    ],
    date: '18 Tháng 9, 2026',
    image: '/images/about/serum-intelderm-top.webp',
    author: 'Bác sĩ Chuyên khoa Da liễu TGTM',
    readTime: '4 phút đọc',
  },
  {
    id: 'story-2',
    theme: 'Khoa học da liễu',
    title: 'Giải mã nguy cơ EWG & Bảng thành phần: Sự thật đằng sau nhãn mác mỹ phẩm',
    excerpt:
      'Không phải mọi hoạt chất "hot trend" đều an toàn cho làn da dễ bùng mụn. Cùng đội ngũ chuyên gia da liễu bóc tách các nhóm chất cồn khô, hương liệu nhân tạo và chất bảo quản phổ biến.',
    content: [
      'Trong thời đại thông tin bùng nổ, người tiêu dùng dễ dàng bị choáng ngợp bởi những lời quảng cáo hoa mỹ. Tuy nhiên, dưới góc nhìn da liễu y khoa, bảng thành phần INCI mới là bằng chứng xác thực nhất về độ an toàn của một sản phẩm.',
      'Thang đo EWG (Environmental Working Group) cùng tiêu chuẩn CIR (Cosmetic Ingredient Review) cung cấp cơ sở dữ liệu khách quan về mức độ rủi ro kích ứng, độc tính tế bào và khả năng gây bít tắc nang lông.',
      'Công cụ tra cứu INCI trực tiếp của Thế Giới Trị Mụn ra đời với sứ mệnh mang khoa học đến gần hơn với người dùng: Giúp bạn tự tin hiểu rõ từng giọt dưỡng chất thoa lên gương mặt mình.',
    ],
    date: '10 Tháng 9, 2026',
    image: '/images/about/sunscreen-day-cream-top.webp',
    author: 'Dược sĩ Lâm sàng & Đội ngũ Nghiên cứu',
    readTime: '5 phút đọc',
  },
  {
    id: 'story-3',
    theme: 'Nghiên cứu lâm sàng',
    title: 'Tretinoin vs Retinol: Lựa chọn dẫn xuất Vitamin A tối ưu cho nền da nhạy cảm',
    excerpt:
      'Nghiên cứu so sánh hiệu quả cải thiện sừng hóa nang lông, giảm bã nhờn và mức độ dung nạp lâm sàng giữa các nồng độ Retinoids khác nhau trên làn da người Việt.',
    content: [
      'Vitamin A và các phái sinh (Retinoids) được mệnh danh là tiêu chuẩn vàng trong điều trị mụn và trẻ hóa da. Tuy nhiên, việc lựa chọn giữa Retinol, Retinal hay Tretinoin thường khiến nhiều người lúng túng.',
      'Tretinoin tác động trực tiếp lên thụ thể tế bào da mà không cần qua các bước chuyển hóa enzyme, mang lại hiệu quả cao nhưng đi kèm nguy cơ bùng viêm và bong tróc nếu thiếu sự giám sát y khoa.',
      'Ngược lại, Retinaldehyde và Retinol bọc vi nang (encapsulated) đem lại sự cân bằng lý tưởng giữa hiệu quả và độ êm dịu. Phác đồ cá nhân hóa tại TGTM luôn bắt đầu từ nồng độ sinh học phù hợp nhất với ngưỡng chịu đựng của từng bệnh nhân.',
    ],
    date: '28 Tháng 8, 2026',
    image: '/images/about/serum-tretinoin-bottom.webp',
    author: 'Hội đồng Y khoa Thế Giới Trị Mụn',
    readTime: '6 phút đọc',
  },
  {
    id: 'story-4',
    theme: 'Phục hồi chuyên sâu',
    title: 'Tái thiết hàng rào Ceramide: Chìa khóa vàng ngăn ngừa mụn tái phát',
    excerpt:
      'Một hàng rào lipid suy yếu là cánh cửa mở cho vi khuẩn C. acnes tấn công. Khám phá cơ chế phục hồi sinh học đa tầng giúp da khỏe mạnh tự nhiên từ gốc.',
    content: [
      'Nhiều bệnh nhân trị mụn thường mắc sai lầm: Quá tập trung vào việc "diệt khuẩn" và "tẩy tế bào chết" mà quên mất rằng hàng rào biểu bì đang bị bào mòn nghiêm trọng.',
      'Khi tỷ lệ Ceramide, Cholesterol và Acid béo tự do bị mất cân bằng, độ ẩm thoát qua da (TEWL) tăng vọt, tạo điều kiện thuận lợi cho phản ứng viêm bùng phát.',
      'Chiến lược điều trị mụn hiện đại luôn song hành giữa hoạt chất đặc trị và phức hợp phục hồi màng tế bào. Chỉ khi hàng rào da vững chắc, làn da mới sở hữu khả năng tự bảo vệ bền vững.',
    ],
    date: '15 Tháng 8, 2026',
    image: '/images/about/serum-seasonly-col2.webp',
    author: 'Chuyên gia Trị liệu Da liễu',
    readTime: '4 phút đọc',
  },
  {
    id: 'story-5',
    theme: 'Câu chuyện khách hàng',
    title: 'Từ tự ti vì sẹo thâm đến tự tin rạng rỡ: Trải nghiệm thực tế của Mai Anh (24 tuổi)',
    excerpt:
      'Hành trình 12 tuần kiên trì cùng bác sĩ da liễu tại Phú Quốc: Không kem trộn, không lời hứa cấp tốc, chỉ có sự tận tâm và khoa học chính xác.',
    content: [
      '"Trước khi đến với Thế Giới Trị Mụn, tôi đã từng thử qua không biết bao nhiêu loại kem bôi được giới thiệu trên mạng. Hậu quả là da mỏng dần, mao mạch lộ rõ và mụn bọc nổi dày đặc." — Mai Anh chia sẻ.',
      'Sau buổi thăm khám chuyên sâu và nội soi da vi điểm, bác sĩ đã thiết lập một lộ trình phục hồi nghiêm ngặt: Dừng toàn bộ sản phẩm không rõ nguồn gốc, phục hồi dịu nhẹ 4 tuần đầu, sau đó mới bước vào giai đoạn kiểm soát ổ viêm.',
      'Sau 3 tháng, không chỉ mụn được kiểm soát hoàn toàn mà vết thâm cũng mờ dần đến 90%. Sự tự tin và nụ cười rạng rỡ trở lại trên gương mặt là phần thưởng quý giá nhất của đội ngũ TGTM.',
    ],
    date: '02 Tháng 8, 2026',
    image: '/images/about/sunscreen-segle-col2.webp',
    author: 'Ghi nhận thực tế tại Phòng khám TGTM',
    readTime: '5 phút đọc',
  },
];

export const StoriesSection: React.FC = () => {
  const [selectedStory, setSelectedStory] = useState<StoryArticle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Check scroll position to toggle navigation buttons
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedStory) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedStory]);

  return (
    <section
      id="blog-section"
      className="relative w-full bg-transparent py-20 sm:py-28 md:py-36 px-4 sm:px-6 md:px-10 z-10 select-none overflow-hidden"
    >
      {/* 1. Header Row matching noho.ink title style */}
      <div className="max-w-6xl mx-auto mb-10 sm:mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary dark:bg-primary/20 dark:border-primary/30 dark:text-teal-300 text-xs font-semibold mb-3 backdrop-blur-md">
            <span>✦</span>
            <span>Khoa học da liễu & Đời sống</span>
          </div>
          <h2
            style={{ fontSize: 'clamp(2.5rem, 7vw, 90px)' }}
            className="font-heading font-black text-white dark:text-[#D7E2EA] leading-[1.05] tracking-tight uppercase"
          >
            TGTM stories
          </h2>
          <p className="mt-3 font-sans text-sm sm:text-base text-slate-300/80 max-w-xl leading-relaxed">
            Góc nhìn chuyên môn, nghiên cứu lâm sàng và những câu chuyện chuyển hóa làn da dựa trên nền tảng y học chứng cứ.
          </p>
        </div>

        {/* Carousel Prev/Next Buttons (Desktop) */}
        <div className="hidden sm:flex items-center gap-3 self-end md:self-auto">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              canScrollLeft
                ? 'border-white/30 text-white hover:bg-white/10 hover:border-white active:scale-95'
                : 'border-white/10 text-white/30 cursor-not-allowed'
            }`}
            aria-label="Previous story"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              canScrollRight
                ? 'border-white/30 text-white hover:bg-white/10 hover:border-white active:scale-95'
                : 'border-white/10 text-white/30 cursor-not-allowed'
            }`}
            aria-label="Next story"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Horizontal Scrollable Collection (Matching noho.ink) */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto overflow-y-hidden scrollbar-none flex gap-4 sm:gap-6 pb-6 pt-2 px-2 sm:px-6 md:px-12 snap-x snap-mandatory"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {STORIES_DATA.map((story, index) => {
          // Three alternating background colors like Noho:
          // 3n+1: Soft Sage / Emerald tint
          // 3n+2: Soft Sand / Coral tint
          // 3n+3: Soft Slate / Sapphire tint
          const colorVariant = index % 3;

          const bgClasses =
            colorVariant === 0
              ? 'bg-[#edf5f3] text-[#0f231e] dark:bg-[#0c2229] dark:text-[#d3eef5] border-teal-200/50 dark:border-teal-500/20'
              : colorVariant === 1
              ? 'bg-[#fcf5ef] text-[#2c1b12] dark:bg-[#1a1c29] dark:text-[#f2e6dc] border-orange-200/50 dark:border-amber-500/20'
              : 'bg-[#f0f4f8] text-[#122336] dark:bg-[#0e1d33] dark:text-[#d8e6f7] border-sky-200/50 dark:border-sky-500/20';

          const accentBadgeClasses =
            colorVariant === 0
              ? 'bg-[#0f231e]/10 text-[#0f231e] dark:bg-teal-400/15 dark:text-teal-300'
              : colorVariant === 1
              ? 'bg-[#2c1b12]/10 text-[#2c1b12] dark:bg-amber-400/15 dark:text-amber-300'
              : 'bg-[#122336]/10 text-[#122336] dark:bg-sky-400/15 dark:text-sky-300';

          return (
            <div
              key={story.id}
              className="snap-start shrink-0 w-[85vw] sm:w-[380px] md:w-[420px] max-w-[440px]"
            >
              <div
                onClick={() => setSelectedStory(story)}
                className={`group relative h-full min-h-[420px] sm:min-h-[460px] rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 flex flex-col justify-between border shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer select-none ${bgClasses}`}
              >
                {/* Top Section */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${accentBadgeClasses}`}
                    >
                      {story.theme}
                    </span>
                    <span className="text-[11px] font-medium opacity-60">
                      {story.readTime}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-xl sm:text-2xl leading-snug line-clamp-3 mb-3 group-hover:opacity-90 transition-opacity">
                    {story.title}
                  </h3>

                  <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-75 line-clamp-4">
                    {story.excerpt}
                  </p>
                </div>

                {/* Bottom Footer Section matching noho.ink */}
                <div className="pt-6 mt-6 border-t border-current/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] sm:text-xs font-medium opacity-60">
                      {story.date}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold opacity-80 mt-0.5">
                      {story.author}
                    </p>
                  </div>

                  {/* "Read article" button with SVG arrow */}
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Đọc bài</span>
                    <svg
                      className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                      viewBox="0 0 7 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M0.530335 12.5303L5.82323 7.23738C6.21375 6.84686 6.21375 6.21369 5.82323 5.82317L0.530334 0.530273"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Interactive Article Reader Modal (Noho.ink Inspired) */}
      <AnimatePresence>
        {selectedStory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
            onClick={() => setSelectedStory(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] sm:rounded-[40px] bg-white dark:bg-[#0c182a] text-slate-900 dark:text-[#E2E8F0] border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-10 select-text scrollbar-none"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedStory(null)}
                className="absolute top-5 right-5 sm:top-7 sm:right-7 w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                ✕
              </button>

              {/* Tag & Date */}
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-teal-300 text-xs font-semibold uppercase tracking-wider">
                  {selectedStory.theme}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedStory.date} · {selectedStory.readTime}
                </span>
              </div>

              {/* Title */}
              <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-slate-950 dark:text-white leading-tight mb-4 pr-8">
                {selectedStory.title}
              </h2>

              {/* Author */}
              <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-200 dark:border-white/10">
                <div className="w-10 h-10 rounded-full bg-primary/20 dark:bg-teal-500/20 text-primary dark:text-teal-300 font-bold flex items-center justify-center text-sm">
                  TG
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {selectedStory.author}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Thế Giới Trị Mụn · Chăm sóc da chuẩn y khoa
                  </p>
                </div>
              </div>

              {/* Content Body */}
              <div className="space-y-4 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                {selectedStory.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              {/* Footer CTA */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedStory(null)}
                  className="px-5 py-2.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 transition-colors cursor-pointer"
                >
                  Đóng bài viết
                </button>

                <a
                  href="/kien-thuc"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-md cursor-pointer"
                >
                  <span>Khám phá thêm kiến thức</span>
                  <span>→</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default StoriesSection;
