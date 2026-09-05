import React from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, SearchIcon } from '../icons';

type HeaderChip = {
  id: string;
  label: string;
  active?: boolean;
  onClick: () => void;
};

interface CategoryHeaderProps {
  title: string;
  eyebrow: string;
  categoryChips: HeaderChip[];
}

const chipClasses = (active?: boolean) =>
  active
    ? 'bg-primary text-primary-foreground border-primary'
    : 'bg-white text-foreground border-border hover:border-primary/30 hover:text-primary dark:bg-card dark:border-white/10 dark:hover:border-primary/40';

const getMobileBannerUrl = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('thực phẩm chức năng')) return 'https://thegioitrimun.vn/r2/site-assets/category-banners/thucphamchucnang.webp';
  if (lowerTitle.includes('chống nắng')) return 'https://thegioitrimun.vn/r2/site-assets/category-banners/chongnang.webp';
  if (lowerTitle.includes('làm sạch')) return 'https://thegioitrimun.vn/r2/site-assets/category-banners/lamsach.webp';
  if (lowerTitle.includes('tinh chất')) return 'https://thegioitrimun.vn/r2/site-assets/category-banners/tinhchat.webp';
  if (lowerTitle.includes('dưỡng ẩm')) return 'https://thegioitrimun.vn/r2/site-assets/category-banners/duongam.webp';
  return 'https://thegioitrimun.vn/r2/site-assets/category-banners/thegioitrimun.webp';
};

const CategoryHeader: React.FC<CategoryHeaderProps> = ({
  title,
  eyebrow,
  categoryChips,
}) => {
  const { t } = useTranslation();

  const renderTitle = (text: string) => {
    const parts = text.split(/(Trị)/);
    return parts.map((part, i) => 
      part === 'Trị' ? <em key={i} className="font-black not-italic text-red-500 animate-doll-jump cursor-pointer" title="Trị">Trị</em> : part
    );
  };

  return (
    <section className="relative flex flex-col justify-start overflow-hidden aspect-square md:aspect-auto md:min-h-[320px] -mx-3 sm:-mx-4 md:mx-0 rounded-none md:rounded-[28px] border-none md:border md:border-border/80 px-5 py-6 shadow-[0_18px_40px_-34px_rgba(36,46,57,0.12)] md:px-8 md:py-8 lg:px-10 animate-fade-rise">
      {/* Mobile Banner */}
      <div 
        className="absolute inset-0 bg-cover bg-center md:hidden" 
        style={{ backgroundImage: `url('${getMobileBannerUrl(title)}')` }}
      />
      {/* Desktop/Tablet Banner */}
      <div 
        className="absolute inset-0 bg-cover bg-center hidden md:block" 
        style={{ backgroundImage: `url('https://thegioitrimun.vn/r2/site-assets/category-banners/bannerlong.webp')` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/70 via-white/10 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full flex flex-col items-center md:items-start gap-3 mt-2 md:mt-0">
        <div className="text-center md:text-left px-5 py-2.5 rounded-full backdrop-blur-xl bg-white/40 border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.08)] max-w-fit">
          <p className="section-kicker text-primary">{eyebrow}</p>
        </div>
        <div className="text-center md:text-left px-6 py-4 rounded-[20px] backdrop-blur-xl bg-white/40 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] max-w-fit">
          <h1 className="whitespace-nowrap text-[1.5rem] font-['Playfair_Display',_serif] font-[700] leading-[0.96] tracking-[-0.02em] text-slate-900 md:text-[2.4rem]">
            {renderTitle(title)}
          </h1>
        </div>
      </div>
    </section>
  );
};

export default CategoryHeader;
