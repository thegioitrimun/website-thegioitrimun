import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Service } from '../types';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloseIcon,
  FilterIcon,
  SearchIcon,
  ServiceListIcon,
} from './icons';
import { GlassSearchInput, GlassDivider } from './GlassInputs';

interface ServicesPageProps {
  services: Service[];
  onSelectService: (id: number) => void;
  onBack: () => void;
}

type PriceTier = 'all' | 'contact' | 'starter' | 'core' | 'advanced';
type SortOrder = 'default' | 'priceAsc' | 'priceDesc' | 'stepsDesc';
type ViewMode = 'list' | 'grid';

const GridViewIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
);

const ListViewIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const ServicesPage: React.FC<ServicesPageProps> = ({ services, onSelectService, onBack }) => {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [priceTier, setPriceTier] = useState<PriceTier>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);

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
        starter: 'Starter budget (< 1M)',
        core: 'Core protocols (1M - 3M)',
        advanced: 'Advanced (≥ 3M)',
        fromPrice: 'Starting from',
        openService: 'View details',
        cardBadge: 'Treatment',
        stepsLabel: 'clinical steps',
        procedureSteps: 'steps',
        noMatchTitle: 'No matching treatment found',
        noMatchBody: 'Try using a broader keyword or reset filters to explore the complete clinical catalog.',
        reset: 'Reset all filters',
        viewList: 'List view',
        viewGrid: 'Grid view',
        sortDefault: 'Default order',
        sortPriceAsc: 'Price: Low to High',
        sortPriceDesc: 'Price: High to Low',
        sortStepsDesc: 'Most steps',
        trust1Title: 'Deep Skin Analysis',
        trust1Desc: 'Multi-layer diagnostic skin scan before crafting treatment route.',
        trust2Title: 'Personalized Protocol',
        trust2Desc: 'Customized route tailored to individual skin barrier condition.',
        trust3Title: 'Sterile Standards',
        trust3Desc: '100% sterilized instruments ensuring zero cross-contamination.',
        trust4Title: 'Post-Care Guidance',
        trust4Desc: '1:1 dermatologist follow-up and tailored home routine support.',
        badge1: '1:1 Clinical Protocol',
        badge2: 'FDA-Approved Tech',
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
        starter: 'Стартовый бюджет (< 1M)',
        core: 'Основные программы (1M - 3M)',
        advanced: 'Продвинутые (≥ 3M)',
        fromPrice: 'Цена от',
        openService: 'Подробнее',
        cardBadge: 'Лечение',
        stepsLabel: 'этапов',
        procedureSteps: 'этапов',
        noMatchTitle: 'Процедура не найдена',
        noMatchBody: 'Попробуйте изменить запрос или сбросьте фильтры для просмотра всех процедур.',
        reset: 'Сбросить фильтры',
        viewList: 'Список',
        viewGrid: 'Сетка',
        sortDefault: 'По умолчанию',
        sortPriceAsc: 'Сначала дешевле',
        sortPriceDesc: 'Сначала дороже',
        sortStepsDesc: 'Больше этапов',
        trust1Title: 'Диагностика кожи',
        trust1Desc: 'Глубокий анализ состояния кожи перед назначением процедур.',
        trust2Title: 'Индивидуальный план',
        trust2Desc: 'Программа лечения, составленная под вашу кожу.',
        trust3Title: 'Стерильность 100%',
        trust3Desc: 'Медицинские стандакты дезинфекции и стерилизации инструментов.',
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
        starter: '入门方案 (< 1M)',
        core: '核心疗程 (1M - 3M)',
        advanced: '进阶疗程 (≥ 3M)',
        fromPrice: '起步价',
        openService: '查看详情',
        cardBadge: '疗程',
        stepsLabel: '步骤',
        procedureSteps: '步',
        noMatchTitle: '未找到匹配疗程',
        noMatchBody: '您可以尝试更简短的关键词，或重置筛选查看全部服务。',
        reset: '重置筛选',
        viewList: '列表模式',
        viewGrid: '网格模式',
        sortDefault: '默认排序',
        sortPriceAsc: '价格从低到高',
        sortPriceDesc: '价格从高到低',
        sortStepsDesc: '步骤最多',
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
      starter: 'Khởi đầu (< 1 triệu)',
      core: 'Cốt lõi (1 - 3 triệu)',
      advanced: 'Chuyên sâu (≥ 3 triệu)',
      fromPrice: 'Mức giá từ',
      openService: 'Xem chi tiết',
      cardBadge: 'Liệu trình',
      stepsLabel: 'bước chuẩn y khoa',
      procedureSteps: 'bước',
      noMatchTitle: 'Chưa có liệu trình phù hợp',
      noMatchBody: 'Hãy thử từ khóa tìm kiếm rộng hơn hoặc đặt lại bộ lọc để xem toàn bộ danh sách dịch vụ.',
      reset: 'Đặt lại bộ lọc',
      viewList: 'Dạng danh sách',
      viewGrid: 'Dạng lưới',
      sortDefault: 'Thứ tự chuẩn',
      sortPriceAsc: 'Giá: Thấp đến cao',
      sortPriceDesc: 'Giá: Cao đến thấp',
      sortStepsDesc: 'Nhiều bước nhất',
      trust1Title: 'Thăm khám & Soi da',
      trust1Desc: 'Phân tích đa tầng cấu trúc da trước khi thiết lập phác đồ.',
      trust2Title: 'Phác đồ cá nhân hóa',
      trust2Desc: 'Thiết kế lộ trình riêng biệt tối ưu thời gian điều trị và chi phí.',
      trust3Title: 'Quy trình vô trùng',
      trust3Desc: '100% dụng cụ tiệt trùng theo chuẩn y tế, chống lây nhiễm chéo.',
      trust4Title: 'Theo dõi đồng hành',
      trust4Desc: 'Bác sĩ và chuyên viên theo sát tiến trình phục hồi 1:1 sau liệu trình.',
      badge1: 'Phác đồ 1:1',
      badge2: 'Công nghệ FDA',
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

  const filteredAndSortedServices = useMemo(() => {
    const list = services.filter((service) => {
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

    return [...list].sort((a, b) => {
      const priceA = Number(a.price || 0);
      const priceB = Number(b.price || 0);
      const stepsA = a.procedure_steps?.length || 0;
      const stepsB = b.procedure_steps?.length || 0;

      if (sortOrder === 'priceAsc') {
        if (priceA === 0) return 1;
        if (priceB === 0) return -1;
        return priceA - priceB;
      }
      if (sortOrder === 'priceDesc') {
        return priceB - priceA;
      }
      if (sortOrder === 'stepsDesc') {
        return stepsB - stepsA;
      }
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [services, normalizedQuery, priceTier, sortOrder, i18n.language]);

  const tierButtons: Array<{ key: PriceTier; label: string; count: number }> = useMemo(() => {
    const counts = {
      all: services.length,
      starter: services.filter(s => Number(s.price || 0) > 0 && Number(s.price || 0) < 1000000).length,
      core: services.filter(s => Number(s.price || 0) >= 1000000 && Number(s.price || 0) < 3000000).length,
      advanced: services.filter(s => Number(s.price || 0) >= 3000000).length,
      contact: services.filter(s => Number(s.price || 0) <= 0).length,
    };
    const allTiers: Array<{ key: PriceTier; label: string; count: number }> = [
      { key: 'all', label: labels.all, count: counts.all },
      { key: 'starter', label: labels.starter, count: counts.starter },
      { key: 'core', label: labels.core, count: counts.core },
      { key: 'advanced', label: labels.advanced, count: counts.advanced },
      { key: 'contact', label: labels.contact, count: counts.contact },
    ];
    return allTiers.filter(t => t.key === 'all' || t.count > 0);
  }, [services, labels]);

  const formatCurrency = (amount: number) => {
    if (!amount) return labels.contact;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 space-y-4 sm:space-y-6">

        {/* Header & Filter Card: Styled identically to /admin/don-hang */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3.5 sm:p-5">
          {/* SEO Heading for Mobile */}
          <h1 className="sr-only sm:hidden">{labels.title}</h1>

          {/* Top Title (Hidden on mobile) */}
          <div className="hidden sm:block pb-3 sm:pb-4 border-b border-border/40">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-[-0.03em] text-foreground">
              {labels.title}
            </h1>
          </div>

          {/* Search Row with Filter Button & View Mode Switcher Inside */}
          <GlassSearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={labels.searchPlaceholder}
            className="mt-0 sm:mt-3"
          >
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                showFilters || priceTier !== 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Lọc mức giá"
              aria-label="Lọc mức giá"
            >
              <FilterIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>

            <GlassDivider />

            <div className="inline-flex items-center rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={labels.viewList}
                aria-label={labels.viewList}
              >
                <ListViewIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={labels.viewGrid}
                aria-label={labels.viewGrid}
              >
                <GridViewIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </GlassSearchInput>

          {/* Preset Pill Tabs Row: Only shown when filter button is clicked */}
          {showFilters && (
            <div className="pt-2.5 sm:pt-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {tierButtons.map((tier) => {
                  const isActive = priceTier === tier.key;
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setPriceTier(tier.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                          : 'border-0 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{tier.label}</span>
                      {tier.count > 0 && (
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                        }`}>
                          {tier.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


        </div>

        {/* Services List / Grid Card: Styled identically to /admin/don-hang Card Container */}
        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
          {services.length === 0 ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-3 text-xs text-muted-foreground font-medium">Đang tải danh sách dịch vụ...</p>
            </div>
          ) : filteredAndSortedServices.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/20">
                <SearchIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base sm:text-lg font-bold text-foreground">{labels.noMatchTitle}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">{labels.noMatchBody}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPriceTier('all');
                }}
                className="mt-4 inline-flex items-center gap-1.5 h-9 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary/90"
              >
                {labels.reset}
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW: Clean, streamlined rows like order rows in /admin/don-hang */
            <div className="divide-y divide-border/25">
              {filteredAndSortedServices.map((service, index) => {
                const benefits = getLocalizedArray(service, 'benefits');
                const stepsCount = service.procedure_steps?.length || 0;

                return (
                  <article
                    key={service.id}
                    onClick={() => onSelectService(service.id)}
                    className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 md:p-5 transition-all hover:bg-primary/[0.03] cursor-pointer animate-product-card-enter will-change-transform"
                    style={{
                      animationDelay: `${Math.min(index, 11) * 35}ms`,
                    }}
                  >
                    {/* Left details: Thumbnail + Title + Specs */}
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                      {/* Square / 16:10 Thumbnail with corner badge */}
                      <div className="relative shrink-0 overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-card shadow-xs w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-24">
                        <img
                          src={service.image_url || 'https://placehold.co/900x700'}
                          alt={getLocalized(service, 'name')}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {stepsCount > 0 && (
                          <span className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-white backdrop-blur-xs">
                            {stepsCount} {labels.procedureSteps}
                          </span>
                        )}
                      </div>

                      {/* Content column */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary dark:bg-primary/20">
                            <ServiceListIcon className="h-3 w-3" />
                            <span>{labels.cardBadge}</span>
                          </span>
                          {Number(service.price || 0) <= 0 && (
                            <span className="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                              {labels.contact}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-1 text-sm sm:text-base md:text-lg font-black text-foreground transition group-hover:text-primary leading-snug line-clamp-1">
                          {getLocalized(service, 'name')}
                        </h3>

                        <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                          {getLocalized(service, 'description')}
                        </p>

                        {/* Clinical Benefits Tags */}
                        {benefits.length > 0 && (
                          <div className="mt-2 hidden sm:flex flex-wrap gap-1.5">
                            {benefits.slice(0, 2).map((benefit, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-xs"
                              >
                                <CheckCircleIcon className="h-3 w-3 text-primary" />
                                <span className="line-clamp-1">{benefit}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right column: Price & Action button */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {labels.fromPrice}
                        </p>
                        <p className="text-base sm:text-lg md:text-xl font-black text-primary tabular-nums tracking-tight">
                          {formatCurrency(service.price)}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1.5 h-8 sm:h-9 rounded-xl bg-primary px-3 sm:px-4 text-xs font-bold text-primary-foreground shadow-xs transition group-hover:bg-primary/90">
                        <span>{labels.openService}</span>
                        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* GRID VIEW: Uniform, balanced 3-column cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4.5 p-3.5 sm:p-5">
              {filteredAndSortedServices.map((service, index) => {
                const benefits = getLocalizedArray(service, 'benefits');
                const stepsCount = service.procedure_steps?.length || 0;

                return (
                  <article
                    key={service.id}
                    onClick={() => onSelectService(service.id)}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-xs transition duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer animate-product-card-enter will-change-transform"
                    style={{
                      animationDelay: `${Math.min(index, 11) * 35}ms`,
                    }}
                  >
                    {/* Card Thumbnail */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted/40">
                      <img
                        src={service.image_url || 'https://placehold.co/900x700'}
                        alt={getLocalized(service, 'name')}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/90 dark:bg-black/80 px-2 py-0.5 text-[10.5px] font-bold text-primary shadow-xs backdrop-blur-xs">
                        <ServiceListIcon className="h-3 w-3" />
                        <span>{labels.cardBadge}</span>
                      </span>
                      {stepsCount > 0 && (
                        <span className="absolute right-3 top-3 rounded-md bg-white/90 dark:bg-black/80 px-2 py-0.5 text-[10.5px] font-bold text-foreground shadow-xs backdrop-blur-xs">
                          {stepsCount} {labels.procedureSteps}
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-base font-bold leading-snug text-foreground transition group-hover:text-primary line-clamp-1">
                        {getLocalized(service, 'name')}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {getLocalized(service, 'description')}
                      </p>

                      {benefits.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {benefits.slice(0, 2).map((benefit, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium text-foreground"
                            >
                              <CheckCircleIcon className="h-2.5 w-2.5 text-primary" />
                              <span className="line-clamp-1">{benefit}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <div>
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-muted-foreground">
                            {labels.fromPrice}
                          </p>
                          <p className="text-base font-black text-primary tabular-nums">
                            {formatCurrency(service.price)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 h-8 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs transition group-hover:bg-primary/90">
                          <span>{labels.openService}</span>
                          <ArrowRightIcon className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>



      </div>
    </div>
  );
};

export default ServicesPage;
