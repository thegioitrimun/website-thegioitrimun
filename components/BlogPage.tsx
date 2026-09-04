import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlogCategory, BlogPost } from '../types';
import {
  ArrowRightIcon,
  BlogIcon,
  CheckCircleIcon,
  CloseIcon,
  EyeIcon,
  SearchIcon,
  SparklesIcon,
  UserIcon,
} from './icons';
import { buildBlogImageAlt } from '../src/imageSeo';
import { BLOG_LISTING_PAGE_SIZE } from '../src/listingPageConfig';
import FallbackBlogImage from './FallbackBlogImage';
import Pagination from './Pagination';

interface BlogPageProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  initialCategorySlug?: string;
  onSelectPost: (slug: string, categorySlug?: string) => void;
  onPrefetchPost?: (slug: string) => void;
  onBack: () => void;
}

const POSTS_PER_PAGE = BLOG_LISTING_PAGE_SIZE;

const BlogSection: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={className}>{children}</div>;

const BlogPage: React.FC<BlogPageProps> = ({
  posts,
  categories,
  initialCategorySlug,
  onSelectPost,
  onPrefetchPost,
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const localizedValue = obj[`${field}_${lang}`];
      if (localizedValue) return localizedValue;
    }
    return obj[field] || '';
  };

  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, getLocalized(category, 'name')])),
    [categories, i18n.language]
  );

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      counts.set(post.category_slug, (counts.get(post.category_slug) || 0) + 1);
    });

    return categories
      .map((category) => ({
        category,
        count: counts.get(category.slug) || 0,
      }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || getLocalized(left.category, 'name').localeCompare(getLocalized(right.category, 'name')));
  }, [categories, i18n.language, posts]);

  const activeCategory = useMemo(
    () => (filter === 'all' ? null : categories.find((category) => category.slug === filter) || null),
    [categories, filter]
  );

  const topicOptions = useMemo(
    () => [
      {
        slug: 'all',
        label: t('blog.all_categories', 'Tất cả'),
        count: posts.length,
        description: t('blog.topic_library_hint'),
      },
      ...categoryStats.map((entry) => ({
        slug: entry.category.slug,
        label: getLocalized(entry.category, 'name'),
        count: entry.count,
        description: getLocalized(entry.category, 'description'),
      })),
    ],
    [categoryStats, i18n.language, posts.length, t]
  );

  // Group posts by category for divided sections
  const postsGroupedByCategory = useMemo(() => {
    const map = new Map<string, BlogPost[]>();
    posts.forEach((post) => {
      const list = map.get(post.category_slug) || [];
      list.push(post);
      map.set(post.category_slug, list);
    });
    return map;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const searchTokens = deferredSearchTerm
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    return posts.filter((post) => {
      if (filter !== 'all' && post.category_slug !== filter) return false;
      if (searchTokens.length === 0) return true;

      const searchableText = [
        getLocalized(post, 'title'),
        getLocalized(post, 'summary'),
        post.author?.name || '',
        categoryNameMap.get(post.category_slug) || '',
      ].join(' ').toLowerCase();

      return searchTokens.every((token) => searchableText.includes(token));
    });
  }, [categoryNameMap, deferredSearchTerm, filter, i18n.language, posts]);

  useEffect(() => {
    if (!initialCategorySlug) {
      setFilter('all');
      return;
    }
    const exists = categories.some((category) => category.slug === initialCategorySlug);
    setFilter(exists ? initialCategorySlug : 'all');
  }, [categories, initialCategorySlug]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [currentPage, filteredPosts]);

  const resultsStart = filteredPosts.length === 0 ? 0 : (currentPage - 1) * POSTS_PER_PAGE + 1;
  const resultsEnd = Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length);
  const activeFilterLabel = filter === 'all' ? t('blog.all_categories', 'Tất cả') : categoryNameMap.get(filter) || filter;
  const leadPost = paginatedPosts[0] || null;
  const spotlightPosts = paginatedPosts.slice(1, 4);
  const archivePosts = paginatedPosts.slice(4);
  const hasSearchTerm = searchTerm.trim().length > 0;
  const activeTopicDescription =
    getLocalized(activeCategory, 'description') ||
    t('blog.topic_library_hint');

  const isDividedTopicOverview = filter === 'all' && !hasSearchTerm;

  const clearFilters = () => {
    setFilter('all');
    setSearchTerm('');
  };

  const handleSelectCategory = (slug: string) => {
    setFilter(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">

        {/* Compact Apple Frosted Glass Hero Section */}
        <section className="relative overflow-hidden rounded-[26px] md:rounded-[34px] border border-white/60 bg-white/70 p-5 md:p-8 lg:p-10 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_56px_-28px_rgba(0,0,0,0.55)]">
          {/* Ambient Lighting Orbs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#ff7f5d]/14 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[#35b7a5]/14 blur-3xl" />

          <div className="relative z-10 flex flex-col items-start text-left">
            {/* Glass Kicker Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>{t('blog.kicker', 'Kiến thức da liễu')}</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.035em] text-foreground sm:text-3xl md:text-[2.5rem]">
              {t('blog.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm md:text-base">
              {t('blog.subtitle')}
            </p>

            {/* Apple Frosted Glass Search Input */}
            <div className="relative mt-5 w-full max-w-xl md:max-w-2xl">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('blog.search_placeholder', 'Tìm theo tiêu đề, tóm tắt hoặc chủ đề')}
                className="h-11 w-full rounded-full border border-white/60 bg-white/80 pl-10 pr-10 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground/60 shadow-xs backdrop-blur-xl transition focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:focus:bg-[#0f1722]"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                  aria-label={t('common.clear_search')}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Category Glass Pills for Quick Tap */}
            <div className="mt-5 hidden flex-wrap gap-2 md:flex">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs dark:bg-primary/20 dark:text-[#35b7a5]'
                    : 'border border-white/60 bg-white/60 text-foreground hover:bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <span>{t('blog.all_categories', 'Tất cả')}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filter === 'all' ? 'bg-primary/15 text-primary dark:text-[#35b7a5]' : 'bg-black/5 dark:bg-white/10 text-muted-foreground'}`}>
                  {posts.length}
                </span>
              </button>
              {categoryStats.slice(0, 6).map((entry) => {
                const isActive = filter === entry.category.slug;
                return (
                  <button
                    key={entry.category.slug}
                    type="button"
                    onClick={() => setFilter(entry.category.slug)}
                    className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs dark:bg-primary/20 dark:text-[#35b7a5]'
                        : 'border border-white/60 bg-white/60 text-foreground hover:bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <span>{getLocalized(entry.category, 'name')}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? 'bg-primary/15 text-primary dark:text-[#35b7a5]' : 'bg-black/5 dark:bg-white/10 text-muted-foreground'}`}>
                      {entry.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Mobile Horizontal Scrollable Category Bar */}
        <div className="mt-4 md:hidden">
          <div className="no-scrollbar -mx-4 flex overflow-x-auto px-4 pb-2">
            <div className="flex w-max gap-2">
              {topicOptions.map((option) => {
                const isActive = filter === option.slug;
                return (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => setFilter(option.slug)}
                    className={`btn-press inline-flex items-center gap-1.5 flex-none rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs dark:bg-primary/20 dark:text-[#35b7a5]'
                        : 'border border-white/60 bg-white/60 text-foreground hover:bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-white/5'
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? 'bg-primary/15 text-primary dark:text-[#35b7a5]' : 'bg-black/5 dark:bg-white/10 text-muted-foreground'}`}>
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Layout: Sidebar + Article Feeds */}
        <div className="mt-6 md:mt-8 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          {/* Desktop Frosted Glass Sidebar */}
          <aside className="hidden xl:block">
            <BlogSection className="sticky top-24 overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-5 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] dark:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)]">
              <div className="border-b border-border/40 pb-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
                  <BlogIcon className="h-3 w-3" />
                  <span>{t('blog.topic_library', 'Thư viện chủ đề')}</span>
                </div>
                <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-foreground">{t('blog.topics', 'Chủ đề')}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('blog.topic_library_hint')}</p>
              </div>

              <div className="mt-4 space-y-2">
                {topicOptions.map((option) => {
                  const isActive = filter === option.slug;
                  return (
                    <button
                      key={option.slug}
                      type="button"
                      onClick={() => setFilter(option.slug)}
                      className={`group flex w-full items-center justify-between rounded-[18px] border p-3 text-left transition-all duration-200 btn-press ${
                        isActive
                          ? 'border-primary/25 bg-primary/10 text-primary shadow-xs'
                          : 'border-white/50 bg-white/40 text-foreground hover:bg-white/80 hover:border-primary/30 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`truncate text-xs font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {option.label}
                        </p>
                        {option.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black shadow-xs ${
                        isActive
                          ? 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-[#35b7a5]'
                          : 'bg-white/80 text-foreground border border-white/60 dark:bg-white/10 dark:text-white dark:border-white/10'
                      }`}>
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Medical Evidence Standard Pill */}
              <div className="mt-5 rounded-[20px] border border-white/60 bg-white/60 p-3.5 backdrop-blur-xl dark:border-white/5 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-[11px] font-bold text-foreground">
                    {t('blog.evidence_standard', 'Kiểm chứng y khoa')}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t('blog.evidence_standard_desc', '100% nội dung được biên soạn theo chuẩn lâm sàng da liễu.')}
                </p>
              </div>
            </BlogSection>
          </aside>

          {/* Main Articles Area */}
          <div className="min-w-0">
            {isDividedTopicOverview ? (
              /* ======================================================== */
              /* DIVIDED TOPIC SECTIONS VIEW (CHIA CHỦ ĐỀ TRONG TRANG) */
              /* ======================================================== */
              <div className="space-y-8 md:space-y-10">
                {/* 1. Top Highlight Lead Story */}
                {leadPost ? (
                  <BlogSection>
                    <button
                      type="button"
                      onClick={() => onSelectPost(leadPost.slug, leadPost.category_slug)}
                      onMouseEnter={() => onPrefetchPost?.(leadPost.slug)}
                      className="group flex h-full w-full flex-col md:flex-row overflow-hidden rounded-[28px] md:rounded-[34px] border border-white/60 bg-white/75 text-left shadow-[0_20px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_28px_60px_-24px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_52px_-28px_rgba(0,0,0,0.55)]"
                    >
                      <div className="relative aspect-[16/10] md:aspect-auto md:w-1/2 overflow-hidden">
                        <FallbackBlogImage
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          slug={leadPost.slug}
                          src={leadPost.image_url}
                          alt={buildBlogImageAlt({
                            title: getLocalized(leadPost, 'title'),
                            categoryName: categoryNameMap.get(leadPost.category_slug),
                            context: 'listing',
                          })}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/60 dark:text-white">
                          {categoryNameMap.get(leadPost.category_slug) || t('nav.knowledge')}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-5 sm:p-7 md:p-8">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                              {t('blog.featured_story', 'Tiêu điểm da liễu')}
                            </p>
                          </div>

                          <h2 className="mt-3 text-xl sm:text-2xl md:text-[1.8rem] font-black leading-tight tracking-[-0.025em] text-foreground">
                            {getLocalized(leadPost, 'title')}
                          </h2>

                          <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-3 md:line-clamp-4">
                            {getLocalized(leadPost, 'summary')}
                          </p>
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserIcon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <p className="text-[11px] font-bold text-foreground">
                                {leadPost.author?.name || 'Thế Giới Trị Mụn'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(leadPost.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary transition-transform group-hover:translate-x-1">
                            {t('blog.read_article', 'Xem chi tiết')}
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </BlogSection>
                ) : null}

                {/* 2. Distinct Topic Sections (Chia từng khối chủ đề) */}
                {categoryStats.map((entry) => {
                  const categoryPosts = postsGroupedByCategory.get(entry.category.slug) || [];
                  if (categoryPosts.length === 0) return null;

                  const displayPosts = categoryPosts.slice(0, 3);
                  const categoryName = getLocalized(entry.category, 'name');
                  const categoryDesc = getLocalized(entry.category, 'description');

                  return (
                    <section key={entry.category.slug} className="content-auto space-y-4">
                      {/* Frosted Glass Topic Header */}
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2.5 rounded-[22px] border border-white/60 bg-white/70 px-5 py-3.5 backdrop-blur-xl shadow-xs dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <BlogIcon className="h-3.5 w-3.5" />
                            </span>
                            <h2 className="text-base sm:text-lg font-black tracking-[-0.02em] text-foreground">
                              {categoryName}
                            </h2>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary dark:bg-primary/20 dark:text-[#35b7a5]">
                              {categoryPosts.length} bài
                            </span>
                          </div>
                          {categoryDesc ? (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {categoryDesc}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectCategory(entry.category.slug)}
                          className="btn-press inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-primary shadow-xs transition hover:border-primary/30 hover:bg-primary hover:text-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-primary"
                        >
                          <span>{t('blog.view_all', 'Xem tất cả')}</span>
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* 3-Column Glass Cards Grid for Topic */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {displayPosts.map((post) => (
                          <button
                            key={post.slug}
                            type="button"
                            onClick={() => onSelectPost(post.slug, post.category_slug)}
                            onMouseEnter={() => onPrefetchPost?.(post.slug)}
                            className="group flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/70 text-left shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] dark:shadow-[0_18px_38px_-26px_rgba(0,0,0,0.5)]"
                          >
                            <div className="relative aspect-[16/10] overflow-hidden">
                              <FallbackBlogImage
                                loading="lazy"
                                slug={post.slug}
                                src={post.image_url}
                                alt={buildBlogImageAlt({
                                  title: getLocalized(post, 'title'),
                                  categoryName: categoryName,
                                  context: 'listing',
                                })}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                              />
                              <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/60 dark:text-white">
                                {categoryName}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col p-4">
                              <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug text-foreground">
                                {getLocalized(post, 'title')}
                              </h3>
                              <p className="mt-2 flex-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {getLocalized(post, 'summary')}
                              </p>

                              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                                <p className="text-[10.5px] font-medium text-muted-foreground">
                                  {new Date(post.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-transform group-hover:translate-x-0.5">
                                  {t('blog.read_article', 'Xem chi tiết')}
                                  <EyeIcon className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              /* ======================================================== */
              /* FILTERED / SINGLE TOPIC PAGINATED VIEW */
              /* ======================================================== */
              <div>
                {/* Frosted Glass Results Summary Bar */}
                <BlogSection className="hidden md:block">
                  <div className="rounded-[22px] border border-white/60 bg-white/70 px-5 py-3.5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)]">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black tracking-[-0.02em] text-foreground">
                          {filteredPosts.length > 0
                            ? t('blog.results_summary', {
                                start: resultsStart,
                                end: resultsEnd,
                                total: filteredPosts.length,
                                defaultValue: `Hiển thị ${resultsStart}-${resultsEnd} trên ${filteredPosts.length} bài viết`,
                              })
                            : t('blog.results_summary_empty', 'Chưa có bài viết phù hợp')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {filter === 'all'
                            ? t('blog.page_note', 'Mỗi trang giữ 12 bài để nhịp đọc và nhịp scan gọn hơn trên cả mobile lẫn desktop.')
                            : t('blog.filtered_note', { filter: activeFilterLabel, defaultValue: `Đang lọc theo ${activeFilterLabel}.` })}
                        </p>
                      </div>
                      {(filter !== 'all' || hasSearchTerm) ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="btn-press rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-xs transition hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/5"
                        >
                          {t('blog.clear_filters', 'Xem tất cả chủ đề')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </BlogSection>

                {filteredPosts.length > 0 && leadPost ? (
                  <>
                    {/* Top Section: Lead Story & Spotlight Stories */}
                    <div className="mt-4 md:mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_330px]">
                      {/* Lead Featured Story (Apple Glass Magazine Card) */}
                      <BlogSection>
                        <button
                          type="button"
                          onClick={() => onSelectPost(leadPost.slug, leadPost.category_slug)}
                          onMouseEnter={() => onPrefetchPost?.(leadPost.slug)}
                          className="group flex h-full w-full flex-col overflow-hidden rounded-[28px] md:rounded-[32px] border border-white/60 bg-white/75 text-left shadow-[0_20px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_28px_60px_-24px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.68)] dark:shadow-[0_24px_52px_-28px_rgba(0,0,0,0.55)]"
                        >
                          <div className="relative aspect-[16/9] overflow-hidden">
                            <FallbackBlogImage
                              loading="eager"
                              fetchPriority="high"
                              decoding="async"
                              slug={leadPost.slug}
                              src={leadPost.image_url}
                              alt={buildBlogImageAlt({
                                title: getLocalized(leadPost, 'title'),
                                categoryName: categoryNameMap.get(leadPost.category_slug),
                                context: 'listing',
                              })}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                            <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/80 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/60 dark:text-white">
                              {categoryNameMap.get(leadPost.category_slug) || t('nav.knowledge')}
                            </span>
                          </div>

                          <div className="flex flex-1 flex-col p-5 sm:p-7">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                                {t('blog.featured_story', 'Bài viết tiêu điểm')}
                              </p>
                            </div>

                            <h2 className="mt-2.5 text-xl sm:text-2xl md:text-[1.75rem] font-black leading-tight tracking-[-0.025em] text-foreground">
                              {getLocalized(leadPost, 'title')}
                            </h2>

                            <p className="mt-3 flex-1 text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-3">
                              {getLocalized(leadPost, 'summary')}
                            </p>

                            <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <UserIcon className="h-3.5 w-3.5" />
                                </span>
                                <div>
                                  <p className="text-[11px] font-bold text-foreground">
                                    {leadPost.author?.name || 'Thế Giới Trị Mụn'}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(leadPost.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary transition-transform group-hover:translate-x-1">
                                {t('blog.read_article', 'Xem chi tiết')}
                                <ArrowRightIcon className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </button>
                      </BlogSection>

                      {/* Spotlight Stories Side List */}
                      <div className="grid gap-3.5 self-start">
                        <BlogSection className="hidden md:block">
                          <div className="rounded-[22px] border border-white/60 bg-white/70 p-4 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)]">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.spotlight_title', 'Chuyên đề nổi bật')}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('blog.featured_story_hint')}</p>
                          </div>
                        </BlogSection>

                        {spotlightPosts.map((post) => (
                          <BlogSection key={post.slug}>
                            <button
                              type="button"
                              onClick={() => onSelectPost(post.slug, post.category_slug)}
                              onMouseEnter={() => onPrefetchPost?.(post.slug)}
                              className="group flex w-full items-center gap-3.5 overflow-hidden rounded-[22px] border border-white/60 bg-white/70 p-3.5 text-left shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/90 dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] dark:hover:bg-[rgba(15,23,42,0.85)]"
                            >
                              <FallbackBlogImage
                                loading="eager"
                                decoding="async"
                                slug={post.slug}
                                src={post.image_url}
                                alt={buildBlogImageAlt({
                                  title: getLocalized(post, 'title'),
                                  categoryName: categoryNameMap.get(post.category_slug),
                                  context: 'listing',
                                })}
                                className="h-20 w-20 sm:h-22 sm:w-22 shrink-0 rounded-[16px] object-cover transition duration-300 group-hover:scale-[1.03]"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="inline-block text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                  {categoryNameMap.get(post.category_slug) || t('nav.knowledge')}
                                </span>
                                <h3 className="mt-1 line-clamp-2 text-xs sm:text-sm font-black leading-snug text-foreground">
                                  {getLocalized(post, 'title')}
                                </h3>
                                <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">
                                  {getLocalized(post, 'summary')}
                                </p>
                                <p className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
                                  {new Date(post.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                              </div>
                            </button>
                          </BlogSection>
                        ))}
                      </div>
                    </div>

                    {/* Archive / Grid Articles (2 Columns) */}
                    {archivePosts.length > 0 ? (
                      <section className="mt-8 md:mt-10 content-auto">
                        <BlogSection className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                          <div>
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                              <BlogIcon className="h-3 w-3" />
                              <span>{t('blog.recent_dispatches', 'Bài viết cùng chủ đề')}</span>
                            </div>
                            <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-[-0.03em] text-foreground">
                              {t('blog.recent_dispatches', 'Danh sách bài viết')}
                            </h2>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-md">
                            {t('blog.recent_dispatches_hint')}
                          </p>
                        </BlogSection>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {archivePosts.map((post) => (
                            <BlogSection key={post.slug}>
                              <button
                                type="button"
                                onClick={() => onSelectPost(post.slug, post.category_slug)}
                                onMouseEnter={() => onPrefetchPost?.(post.slug)}
                                className="group flex h-full w-full flex-col overflow-hidden rounded-[24px] md:rounded-[26px] border border-white/60 bg-white/70 text-left shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] dark:shadow-[0_20px_42px_-28px_rgba(0,0,0,0.5)]"
                              >
                                <div className="relative aspect-[16/10] overflow-hidden">
                                  <FallbackBlogImage
                                    loading="lazy"
                                    slug={post.slug}
                                    src={post.image_url}
                                    alt={buildBlogImageAlt({
                                      title: getLocalized(post, 'title'),
                                      categoryName: categoryNameMap.get(post.category_slug),
                                      context: 'listing',
                                    })}
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                  />
                                  <span className="absolute left-3.5 top-3.5 rounded-full border border-white/60 bg-white/80 px-3 py-0.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-primary shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-black/60 dark:text-white">
                                    {categoryNameMap.get(post.category_slug) || t('nav.knowledge')}
                                  </span>
                                </div>

                                <div className="flex flex-1 flex-col p-4.5 sm:p-5">
                                  <h3 className="line-clamp-2 text-base sm:text-lg font-black leading-snug text-foreground">
                                    {getLocalized(post, 'title')}
                                  </h3>
                                  <p className="mt-2 flex-1 line-clamp-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                                    {getLocalized(post, 'summary')}
                                  </p>

                                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                                    <p className="text-[11px] font-medium text-muted-foreground">
                                      {new Date(post.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </p>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-transform group-hover:translate-x-0.5">
                                      {t('blog.read_article', 'Xem chi tiết')}
                                      <EyeIcon className="h-3.5 w-3.5" />
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </BlogSection>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </>
                ) : (
                  /* Frosted Glass Empty State */
                  <BlogSection className="mt-6 rounded-[28px] border border-white/60 bg-white/70 p-8 text-center backdrop-blur-2xl shadow-xs dark:border-white/10 dark:bg-[rgba(15,23,42,0.65)] md:p-12">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <BlogIcon className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-base font-bold text-foreground">{t('blog.no_posts', 'Không tìm thấy bài viết')}</p>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                      {t('blog.no_posts_recovery', 'Thử bỏ từ khóa tìm kiếm hoặc chuyển sang nhóm chủ đề rộng hơn để tiếp tục khám phá.')}
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn-press mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-xs font-bold text-primary shadow-xs transition hover:bg-primary hover:text-white"
                    >
                      {t('blog.clear_filters', 'Đặt lại bộ lọc')}
                    </button>
                  </BlogSection>
                )}

                {/* Pagination */}
                {filteredPosts.length > 0 ? (
                  <div className="mt-8">
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Frosted Glass Filter Drawer */}
        {isFilterOpen ? (
          <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setIsFilterOpen(false)}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[32px] border-t border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f172a]/95"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.topics_label', 'Chủ đề')}</p>
                  <h2 className="mt-0.5 text-base font-black text-foreground">{t('blog.choose_topic', 'Chọn chủ đề')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-xs dark:bg-white/5 dark:border-white/10"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {topicOptions.map((option) => {
                  const isActive = filter === option.slug;
                  return (
                    <button
                      key={option.slug}
                      type="button"
                      onClick={() => {
                        setFilter(option.slug);
                        setIsFilterOpen(false);
                      }}
                      className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                        isActive
                          ? 'bg-primary text-white shadow-xs'
                          : 'border border-white/60 bg-white/60 text-foreground dark:border-white/10 dark:bg-white/5'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-muted-foreground'}`}>
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BlogPage;
