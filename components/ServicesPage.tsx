import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Service } from '../types';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloseIcon,
  LaserIcon,
  SearchIcon,
  ServiceListIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StethoscopeIcon,
} from './icons';

interface ServicesPageProps {
  services: Service[];
  onSelectService: (id: number) => void;
  onBack: () => void;
}

type PriceTier = 'all' | 'contact' | 'starter' | 'core' | 'advanced';

const ServicesPage: React.FC<ServicesPageProps> = ({ services, onSelectService, onBack }) => {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [priceTier, setPriceTier] = useState<PriceTier>('all');

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const value = obj[`${field}_${lang}`];
      if (value) return value;
    }
    return obj[field] || '';
  };

  const getLocalizedArray = (obj: any, field: string): string[] => {
    if (!obj) return [];
    const lang = i18n.language;
    if (lang !== 'vi') {
      const value = obj[`${field}_${lang}`];
      if (Array.isArray(value) && value.length > 0) return value;
    }
    return Array.isArray(obj[field]) ? obj[field] : [];
  };

  const labels = useMemo(() => {
    const lang = i18n.language;
    if (lang.startsWith('en')) {
      return {
        back: 'Back',
        breadcrumbHome: 'Home',
        breadcrumbServices: 'Services',
        kicker: 'Clinical Dermatology & Treatment',
        title: 'Dermatology Services',
        subtitle: 'Evidence-based acne treatment, skin recovery, and rejuvenation protocols customized 1:1 with FDA-approved technology.',
        searchLabel: 'Search',
        searchPlaceholder: 'Search by service name, skin concern, or expected outcome...',
        liveResult: 'Showing',
        servicesCount: 'treatments',
        all: 'All treatments',
        contact: 'Consult first',
        starter: 'Starter budget',
        core: 'Core protocols',
        advanced: 'Advanced protocols',
        fromPrice: 'Starting from',
        openService: 'View details',
        cardBadge: 'Treatment',
        heroBadge: 'Featured Protocol',
        stepsLabel: 'steps',
        noMatchTitle: 'No matching treatment found',
        noMatchBody: 'Try using a broader keyword or reset filters to explore the complete clinical catalog.',
        reset: 'Reset all filters',
        trust1Title: 'Deep Skin Analysis',
        trust1Desc: 'Multi-layer diagnostic skin scan before crafting treatment route.',
        trust2Title: 'Personalized Protocol',
        trust2Desc: 'Customized route tailored to individual skin barrier condition.',
        trust3Title: 'Sterile Standards',
        trust3Desc: '100% sterilized instruments ensuring zero cross-contamination.',
        trust4Title: 'Post-Care Guidance',
        trust4Desc: '1:1 dermatologist follow-up and tailored home routine support.',
        badge1: '1:1 Clinical Protocol',
        badge2: 'FDA-Approved Technology',
        badge3: 'Medical-Grade Skincare',
      };
    }
    if (lang.startsWith('ru')) {
      return {
        back: 'Назад',
        breadcrumbHome: 'Главная',
        breadcrumbServices: 'Услуги',
        kicker: 'Клиническая дерматология',
        title: 'Дерматологические услуги',
        subtitle: 'Протоколы лечения акне, восстановления и омоложения кожи, подобранные индивидуально 1:1.',
        searchLabel: 'Поиск',
        searchPlaceholder: 'Поиск по названию процедуры, проблеме кожи или результату...',
        liveResult: 'Найдено',
        servicesCount: 'процедур',
        all: 'Все услуги',
        contact: 'Нужна консультация',
        starter: 'Стартовый бюджет',
        core: 'Основные программы',
        advanced: 'Продвинутые программы',
        fromPrice: 'Цена от',
        openService: 'Подробнее',
        cardBadge: 'Лечение',
        heroBadge: 'Ключевая программа',
        stepsLabel: 'этапов',
        noMatchTitle: 'Процедура не найдена',
        noMatchBody: 'Попробуйте изменить запрос или сбросьте фильтры для просмотра всех процедур.',
        reset: 'Сбросить фильтры',
        trust1Title: 'Диагностика кожи',
        trust1Desc: 'Глубокий анализ состояния кожи перед назначением процедур.',
        trust2Title: 'Индивидуальный план',
        trust2Desc: 'Программа лечения, составленная под вашу кожу.',
        trust3Title: 'Стерильность 100%',
        trust3Desc: 'Медицинские стандарты дезинфекции и стерилизации инструментов.',
        trust4Title: 'Сопровождение врача',
        trust4Desc: 'Контроль динамики восстановления и домашний уход 1:1.',
        badge1: 'Протокол 1:1',
        badge2: 'Технологии FDA',
        badge3: 'Медицинская косметика',
      };
    }
    if (lang.startsWith('cn') || lang.startsWith('zh')) {
      return {
        back: '返回',
        breadcrumbHome: '首页',
        breadcrumbServices: '服务',
        kicker: '专业皮肤临床疗程',
        title: '皮肤诊疗与疗程',
        subtitle: '针对痤疮治疗、屏障修复与抗衰定制的 1:1 临床治疗方案，结合正规仪器与医研护肤。',
        searchLabel: '搜索',
        searchPlaceholder: '按疗程名称、皮肤问题或期望效果搜索...',
        liveResult: '显示',
        servicesCount: '个疗程',
        all: '全部疗程',
        contact: '需先咨询',
        starter: '入门方案',
        core: '核心疗程',
        advanced: '进阶疗程',
        fromPrice: '起步价',
        openService: '查看详情',
        cardBadge: '疗程',
        heroBadge: '推荐主打',
        stepsLabel: '步骤',
        noMatchTitle: '未找到匹配疗程',
        noMatchBody: '您可以尝试更简短的关键词，或重置筛选查看全部服务。',
        reset: '重置筛选',
        trust1Title: '多层皮肤检测',
        trust1Desc: '制定治疗方案前进行深层皮肤影像与结构检测。',
        trust2Title: '1:1 个性化方案',
        trust2Desc: '根据个人屏障与耐受度量身打造专属治疗路径。',
        trust3Title: '严格无菌规范',
        trust3Desc: '100% 医用无菌器械标准，避免交叉感染。',
        trust4Title: '全程跟踪指导',
        trust4Desc: '治疗后一对一跟进，提供科学居家护理建议。',
        badge1: '1:1 专属方案',
        badge2: 'FDA 认证技术',
        badge3: '原装医研护肤',
      };
    }
    return {
      back: 'Quay lại',
      breadcrumbHome: 'Trang chủ',
      breadcrumbServices: 'Dịch vụ da liễu',
      kicker: 'Liệu trình chuẩn y khoa',
      title: 'Dịch Vụ Da Liễu Chuyên Sâu',
      subtitle: 'Hệ thống phác đồ điều trị mụn, phục hồi hàng rào sinh học và trẻ hóa da chuẩn y khoa 1:1, kết hợp trang thiết bị chính hãng.',
      searchLabel: 'Tìm kiếm',
      searchPlaceholder: 'Tìm theo tên liệu trình, vấn đề da hoặc hiệu quả mong muốn...',
      liveResult: 'Hiển thị',
      servicesCount: 'liệu trình',
      all: 'Tất cả',
      contact: 'Cần tư vấn trước',
      starter: 'Ngân sách dễ bắt đầu',
      core: 'Liệu trình cốt lõi',
      advanced: 'Liệu trình chuyên sâu',
      fromPrice: 'Mức giá từ',
      openService: 'Xem chi tiết',
      cardBadge: 'Liệu trình',
      heroBadge: 'Liệu trình tâm điểm',
      stepsLabel: 'bước chuẩn y khoa',
      noMatchTitle: 'Chưa có liệu trình phù hợp',
      noMatchBody: 'Hãy thử từ khóa tìm kiếm rộng hơn hoặc đặt lại bộ lọc để xem toàn bộ danh sách dịch vụ.',
      reset: 'Đặt lại bộ lọc',
      trust1Title: 'Thăm khám & Soi da',
      trust1Desc: 'Phân tích đa tầng cấu trúc da trước khi thiết lập phác đồ.',
      trust2Title: 'Phác đồ cá nhân hóa',
      trust2Desc: 'Thiết kế lộ trình riêng biệt tối ưu thời gian điều trị và chi phí.',
      trust3Title: 'Quy trình vô trùng',
      trust3Desc: '100% dụng cụ tiệt trùng theo chuẩn y tế, chống lây nhiễm chéo.',
      trust4Title: 'Theo dõi đồng hành',
      trust4Desc: 'Bác sĩ và chuyên viên theo sát tiến trình phục hồi 1:1 sau liệu trình.',
      badge1: 'Phác đồ chuẩn 1:1',
      badge2: 'Công nghệ FDA chính hãng',
      badge3: 'Dược mỹ phẩm chọn lọc',
    };
  }, [i18n.language]);

  const normalizedQuery = query.trim().toLowerCase();

  const matchesPriceTier = (service: Service) => {
    const price = Number(service.price || 0);
    if (priceTier === 'all') return true;
    if (priceTier === 'contact') return price <= 0;
    if (priceTier === 'starter') return price > 0 && price < 1000000;
    if (priceTier === 'core') return price >= 1000000 && price < 3000000;
    if (priceTier === 'advanced') return price >= 3000000;
    return true;
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (!matchesPriceTier(service)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        getLocalized(service, 'name'),
        getLocalized(service, 'description'),
        getLocalized(service, 'long_description'),
        ...(Array.isArray(service.benefits) ? service.benefits : []),
        ...(Array.isArray(service.benefits_en) ? service.benefits_en : []),
        ...(Array.isArray(service.benefits_ru) ? service.benefits_ru : []),
        ...(Array.isArray(service.benefits_cn) ? service.benefits_cn : []),
      ]
        .join(' ')
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [services, normalizedQuery, priceTier, i18n.language]);

  const tierButtons: Array<{ key: PriceTier; label: string; count: number }> = useMemo(() => {
    const counts = {
      all: services.length,
      contact: services.filter(s => Number(s.price || 0) <= 0).length,
      starter: services.filter(s => Number(s.price || 0) > 0 && Number(s.price || 0) < 1000000).length,
      core: services.filter(s => Number(s.price || 0) >= 1000000 && Number(s.price || 0) < 3000000).length,
      advanced: services.filter(s => Number(s.price || 0) >= 3000000).length,
    };
    const allTiers: Array<{ key: PriceTier; label: string; count: number }> = [
      { key: 'all', label: labels.all, count: counts.all },
      { key: 'contact', label: labels.contact, count: counts.contact },
      { key: 'starter', label: labels.starter, count: counts.starter },
      { key: 'core', label: labels.core, count: counts.core },
      { key: 'advanced', label: labels.advanced, count: counts.advanced },
    ];
    return allTiers.filter(t => t.key === 'all' || t.count > 0);
  }, [services, labels]);

  const formatCurrency = (amount: number) => {
    if (!amount) return labels.contact;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">

        {/* Compact Apple Frosted Glass Hero Header */}
        <section className="relative overflow-hidden rounded-[26px] md:rounded-[30px] border border-white/60 bg-white/70 p-5 md:p-7 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_56px_-28px_rgba(0,0,0,0.55)]">
          {/* Ambient Lighting Orbs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-primary/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-teal-500/10 blur-2xl" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
                  <SparklesIcon className="h-3 w-3" />
                  <span>{labels.kicker}</span>
                </div>

                <h1 className="mt-2 text-2xl font-black leading-tight tracking-[-0.035em] text-foreground sm:text-3xl md:text-[2.2rem]">
                  {labels.title}
                </h1>

                <p className="mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {labels.subtitle}
                </p>
              </div>

              {/* Quick Clinical Pill Badges (Compact) */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11px] font-bold text-foreground backdrop-blur-xl shadow-xs dark:border-white/10 dark:bg-white/5">
                  <StethoscopeIcon className="h-3 w-3 text-primary" />
                  <span>{labels.badge1}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11px] font-bold text-foreground backdrop-blur-xl shadow-xs dark:border-white/10 dark:bg-white/5">
                  <LaserIcon className="h-3 w-3 text-primary" />
                  <span>{labels.badge2}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11px] font-bold text-foreground backdrop-blur-xl shadow-xs dark:border-white/10 dark:bg-white/5">
                  <ShieldCheckIcon className="h-3 w-3 text-primary" />
                  <span>{labels.badge3}</span>
                </div>
              </div>
            </div>

            {/* Apple Frosted Search & Filter Controls */}
            <div className="mt-5 space-y-3 border-t border-border/40 pt-4">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={labels.searchPlaceholder}
                  className="w-full rounded-full border border-white/60 bg-white/80 py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground/60 shadow-xs backdrop-blur-xl transition focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:focus:bg-[#0f1722]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                    aria-label="Clear search"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Price Tier Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <div className="no-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 md:overflow-visible">
                  <div className="flex items-center gap-2 min-w-max md:min-w-0 md:flex-wrap">
                    {tierButtons.map((tier) => {
                      const isActive = priceTier === tier.key;
                      return (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={() => setPriceTier(tier.key)}
                          className={`btn-press inline-flex items-center gap-2 shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition ${
                            isActive
                              ? 'bg-[#eef8f6] text-[#2f855a] dark:bg-[#1b7a6d]/25 dark:text-[#35b7a5]'
                              : 'bg-[#f4f6f8] text-foreground hover:bg-[#e4ebef] dark:bg-white/5 dark:text-foreground dark:hover:bg-white/10'
                          }`}
                        >
                          <span>{tier.label}</span>
                          <span className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                            isActive ? 'bg-[#2f855a]/15 text-[#2f855a] dark:bg-[#35b7a5]/20 dark:text-[#35b7a5]' : 'bg-black/5 text-muted-foreground dark:bg-white/10'
                          }`}>
                            {tier.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0 text-[11px] font-bold text-muted-foreground">
                  {labels.liveResult} <strong className="text-foreground">{filteredServices.length}</strong> {labels.servicesCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Listing Section */}
        <section className="mt-10">
          {services.length === 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-[32px] border border-white/60 bg-white/70 p-6 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
                  <div className="aspect-[16/10] w-full rounded-2xl bg-muted/60" />
                  <div className="mt-4 h-6 w-3/4 rounded-lg bg-muted/60" />
                  <div className="mt-2 h-4 w-full rounded-lg bg-muted/40" />
                </div>
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="rounded-[32px] border border-white/60 bg-white/70 px-6 py-14 text-center shadow-[0_24px_60px_-24px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)] md:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary backdrop-blur-md dark:bg-primary/20">
                <SearchIcon className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-foreground">{labels.noMatchTitle}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {labels.noMatchBody}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPriceTier('all');
                }}
                className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_12px_28px_-8px_rgba(27,122,109,0.45)] transition hover:brightness-105 btn-press"
              >
                {labels.reset}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredServices.map((service, index) => {
                const benefits = getLocalizedArray(service, 'benefits');
                const isHero = index === 0;

                if (isHero) {
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => onSelectService(service.id)}
                      className="group relative flex h-full flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/75 text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_32px_70px_-24px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)] md:col-span-2 xl:col-span-2 xl:grid xl:grid-cols-[0.96fr_1.04fr]"
                    >
                      <div className="relative aspect-[16/10] xl:aspect-auto xl:h-full overflow-hidden bg-card">
                        <img
                          src={service.image_url || 'https://placehold.co/900x700'}
                          alt={getLocalized(service, 'name')}
                          loading="eager"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
                        
                        {/* Apple Glass Floating Badges */}
                        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-black/60 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary shadow-xs backdrop-blur-xl">
                          <SparklesIcon className="h-3.5 w-3.5" />
                          {labels.heroBadge}
                        </span>

                        <span className="absolute right-4 top-4 rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-black/60 px-3 py-1 font-sans text-xs font-bold text-foreground shadow-xs backdrop-blur-xl">
                          {service.procedure_steps?.length || 0} {labels.stepsLabel}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-6 sm:p-8 lg:p-10">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary dark:bg-primary/20">
                            <ServiceListIcon className="h-3.5 w-3.5" />
                            {labels.cardBadge}
                          </span>
                        </div>

                        <h3 className="mt-4 font-heading text-2xl font-black leading-tight tracking-[-0.035em] text-foreground transition group-hover:text-primary sm:text-3xl">
                          {getLocalized(service, 'name')}
                        </h3>

                        <p className="mt-3.5 line-clamp-3 font-sans text-sm leading-relaxed text-muted-foreground sm:text-base">
                          {getLocalized(service, 'description')}
                        </p>

                        {/* Key Benefits Preview */}
                        {benefits.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {benefits.slice(0, 3).map((benefit, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/5"
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5 text-primary" />
                                <span className="line-clamp-1">{benefit}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                              {labels.fromPrice}
                            </p>
                            <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-primary sm:text-3xl">
                              {formatCurrency(service.price)}
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-bold text-foreground backdrop-blur-xl transition group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground dark:border-white/10 dark:bg-white/10 dark:group-hover:bg-primary">
                            <span>{labels.openService}</span>
                            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onSelectService(service.id)}
                    className="group relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white/75 text-left shadow-[0_22px_48px_-24px_rgba(0,0,0,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] dark:hover:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.65)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-card">
                      <img
                        src={service.image_url || 'https://placehold.co/900x700'}
                        alt={getLocalized(service, 'name')}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent" />
                      
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl">
                        <ServiceListIcon className="h-3.5 w-3.5" />
                        {labels.cardBadge}
                      </span>

                      <span className="absolute right-4 top-4 rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-black/60 px-2.5 py-1 font-sans text-xs font-bold text-foreground shadow-xs backdrop-blur-xl">
                        {service.procedure_steps?.length || 0} {labels.stepsLabel}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-heading text-xl font-bold leading-tight tracking-[-0.03em] text-foreground transition group-hover:text-primary">
                        {getLocalized(service, 'name')}
                      </h3>

                      <p className="mt-2.5 line-clamp-2 font-sans text-sm leading-relaxed text-muted-foreground">
                        {getLocalized(service, 'description')}
                      </p>

                      {/* Key Benefits Preview */}
                      {benefits.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap gap-1.5">
                          {benefits.slice(0, 2).map((benefit, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/5"
                            >
                              <CheckCircleIcon className="h-3 w-3 text-primary" />
                              <span className="line-clamp-1">{benefit}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                            {labels.fromPrice}
                          </p>
                          <p className="mt-0.5 text-xl font-black tracking-[-0.03em] text-foreground group-hover:text-primary">
                            {formatCurrency(service.price)}
                          </p>
                        </div>

                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-foreground backdrop-blur-xl transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground dark:border-white/10 dark:bg-white/10">
                          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Clinical Quality Assurance / Trust Pillars */}
        <section className="mt-14">
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)] md:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />

            <div className="relative z-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20">
                  <StethoscopeIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-[-0.02em] text-foreground">
                    {labels.trust1Title}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[13px]">
                    {labels.trust1Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-[-0.02em] text-foreground">
                    {labels.trust2Title}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[13px]">
                    {labels.trust2Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-[-0.02em] text-foreground">
                    {labels.trust3Title}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[13px]">
                    {labels.trust3Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs backdrop-blur-md dark:bg-primary/20">
                  <CheckCircleIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-[-0.02em] text-foreground">
                    {labels.trust4Title}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[13px]">
                    {labels.trust4Desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ServicesPage;
