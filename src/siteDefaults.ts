import type { HomepageHero } from '../types';

export const HOMEPAGE_HERO_CACHE_KEY = 'natural-skin-homepage-hero-v2';

export const OPTIMIZED_HOMEPAGE_HERO_ASSETS = {
  desktop: {
    path: 'hero/hero-desktop-v2.webp',
    url: '/hero/hero-desktop-v2.webp',
    avifPath: 'hero/hero-desktop-v2.avif',
    avifUrl: '/hero/hero-desktop-v2.avif',
  },
  tablet: {
    path: 'hero/hero-tablet-v2.webp',
    url: '/hero/hero-tablet-v2.webp',
    avifPath: 'hero/hero-tablet-v2.avif',
    avifUrl: '/hero/hero-tablet-v2.avif',
  },
  mobile: {
    path: 'hero/hero-mobile-v2.webp',
    url: '/hero/hero-mobile-v2.webp',
    avifPath: 'hero/hero-mobile-v2.avif',
    avifUrl: '/hero/hero-mobile-v2.avif',
  },
} as const;

export const LEGACY_HOMEPAGE_HERO_PATHS = {
  desktop: 'hero-desktop-1773590349415.webp',
  tablet: 'hero-tablet-1773590352338.webp',
  mobile: 'hero-mobile-1773590354606.webp',
} as const;

export const FALLBACK_HOMEPAGE_HERO: HomepageHero = {
  id: 1,
  title: 'Chăm sóc da chuyên sâu, chuẩn y khoa',
  subtitle: 'Giải pháp toàn diện được cá nhân hóa bởi đội ngũ bác sĩ chuyên khoa da liễu hàng đầu.',
  image_desktop_path: OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.path,
  image_desktop_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.url,
  image_desktop_avif_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.desktop.avifUrl,
  image_tablet_path: OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.path,
  image_tablet_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.url,
  image_tablet_avif_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.tablet.avifUrl,
  image_mobile_path: OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.path,
  image_mobile_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.url,
  image_mobile_avif_url: OPTIMIZED_HOMEPAGE_HERO_ASSETS.mobile.avifUrl,
};
