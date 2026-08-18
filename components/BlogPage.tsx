import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlogCategory, BlogPost } from '../types';
import { CloseIcon, EyeIcon, MenuIcon, SearchIcon } from './icons';
import { buildBlogImageAlt } from '../src/imageSeo';
import { BLOG_LISTING_PAGE_SIZE } from '../src/listingPageConfig';
import FallbackBlogImage from './FallbackBlogImage';
import Pagination from './Pagination';
import BackIconButton from './BackIconButton';

interface BlogPageProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  initialCategorySlug?: string;
  onSelectPost: (slug: string, categorySlug?: string) => void;
  onPrefetchPost?: (slug: string) => void;
  onBack: () => void;
}

const POSTS_PER_PAGE = BLOG_LISTING_PAGE_SIZE;

const BlogSection: React.FC<{ children: React.ReactNode; className?: string; stagger?: number }> = ({
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
      .sort((left, right) => right.count - left.count || getLocalized(left.category, 'name').localeCompare(getLocalized(right.category, 'name')))
      .slice(0, 8);
  }, [categories, i18n.language, posts]);

  const activeCategory = useMemo(
    () => (filter === 'all' ? null : categories.find((category) => category.slug === filter) || null),
    [categories, filter]
  );

  const topicOptions = useMemo(
    () => [
      {
        slug: 'all',
        label: t('blog.all_categories'),
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
  const activeFilterLabel = filter === 'all' ? t('blog.all_categories') : categoryNameMap.get(filter) || filter;
  const leadPost = paginatedPosts[0] || null;
  const spotlightPosts = paginatedPosts.slice(1, 4);
  const archivePosts = paginatedPosts.slice(4);
  const hasSearchTerm = searchTerm.trim().length > 0;
  const activeTopicDescription =
    getLocalized(activeCategory, 'description') ||
    t('blog.topic_library_hint');

  const clearFilters = () => {
    setFilter('all');
    setSearchTerm('');
  };

  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-6 md:px-6 md:py-10">

        <section className="relative overflow-hidden rounded-[36px] border border-border bg-[linear-gradient(135deg,#fff2e8_0%,#ffffff_44%,#eef8ff_100%)] px-5 py-6 shadow-[0_28px_62px_-40px_rgba(36,46,57,0.16)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0c1520_0%,#101926_44%,#0f1d29_100%)] dark:shadow-[0_32px_64px_-40px_rgba(4,10,24,0.68)] md:px-8 md:py-10 lg:px-10">
          <div className="pointer-events-none absolute -left-8 top-0 h-48 w-48 rounded-full bg-[#ff7f5d]/18 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[#6bbdff]/14 blur-3xl" />
          <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_320px] xl:items-start">
            <div className="max-w-3xl mx-auto xl:mx-0 flex flex-col items-center xl:items-start text-center xl:text-left">
              <p className="section-kicker text-center xl:text-left w-full">{t('blog.kicker', 'Kiến thức da liễu')}</p>
              <h1 className="mt-4 w-full text-[2.4rem] font-black leading-[0.94] tracking-[-0.05em] text-foreground md:text-[4rem] text-center xl:text-left">
                {t('blog.title')}
              </h1>
              <p className="mt-4 w-full max-w-2xl text-base leading-8 text-muted-foreground text-center xl:text-left">{t('blog.subtitle')}</p>

              <div className="relative mt-6 hidden md:block">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('blog.search_placeholder', 'Tìm theo tiêu đề, tóm tắt hoặc chủ đề')}
                  className="h-12 w-full rounded-full border border-border bg-background/80 pl-12 pr-12 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 md:text-base"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label={t('common.clear_search')}
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground hidden md:block">{t('blog.search_hint')}</p>

              <div className="mt-6 hidden md:flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    filter === 'all'
                      ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_34px_-28px_rgba(53,183,165,0.62)]'
                      : 'border-border bg-white text-foreground hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-card dark:hover:border-primary/40'
                  }`}
                >
                  {t('blog.all_categories')}
                </button>
                {categoryStats.slice(0, 6).map((entry) => (
                  <button
                    key={entry.category.slug}
                    type="button"
                    onClick={() => setFilter(entry.category.slug)}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      filter === entry.category.slug
                        ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_34px_-28px_rgba(53,183,165,0.62)]'
                        : 'border-border bg-white text-foreground hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-card dark:hover:border-primary/40'
                    }`}
                  >
                    {getLocalized(entry.category, 'name')}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:grid gap-3 self-start">
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_34px_-26px_rgba(36,46,57,0.16)] backdrop-blur dark:border-white/10 dark:bg-[#111a27]/86 dark:shadow-[0_22px_40px_-28px_rgba(4,10,24,0.62)]">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">{t('blog.live_result', 'Live result')}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-muted-foreground">{activeFilterLabel}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {hasSearchTerm ? `“${searchTerm.trim()}”` : activeTopicDescription}
                    </p>
                  </div>
                  <p className="text-3xl font-black text-foreground">{filteredPosts.length}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_28px_-24px_rgba(36,46,57,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#111a27]/86 dark:shadow-[0_18px_34px_-26px_rgba(4,10,24,0.6)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.active_topic_label')}</p>
                  <p className="mt-2 text-base font-black leading-6 text-foreground">{activeFilterLabel}</p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_28px_-24px_rgba(36,46,57,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#111a27]/86 dark:shadow-[0_18px_34px_-26px_rgba(4,10,24,0.6)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.active_search_label')}</p>
                  <p className="mt-2 text-base font-black leading-6 text-foreground">
                    {hasSearchTerm ? searchTerm.trim() : t('common.search')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 md:hidden">
          <div className="no-scrollbar -mx-4 flex overflow-x-auto px-4 pb-2">
            <div className="flex w-max gap-2">
              {topicOptions.map((option) => (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => setFilter(option.slug)}
                  className={`flex-none rounded-full border px-4 py-2 text-sm font-bold transition ${
                    filter === option.slug
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-white text-foreground hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-card dark:hover:border-primary/40'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <BlogSection className="sticky top-24 overflow-hidden rounded-[30px] border border-border bg-white shadow-[0_20px_44px_-32px_rgba(36,46,57,0.16)] dark:border-white/10 dark:bg-card dark:shadow-[0_24px_48px_-30px_rgba(4,10,24,0.6)]">
              <div className="border-b border-border px-5 py-5">
                <p className="section-kicker">{t('blog.topic_library')}</p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground">{t('blog.topics')}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('blog.topic_library_hint')}</p>
              </div>
              <div className="space-y-2 p-4">
                {topicOptions.map((option) => (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => setFilter(option.slug)}
                    className={`flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition ${
                      filter === option.slug
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-accent/60 dark:hover:border-primary/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{option.label}</p>
                      {option.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{option.description}</p>
                      ) : null}
                    </div>
                    <span className="ml-3 shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-foreground shadow-sm dark:bg-[#0f1722]/92 dark:text-white">
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
            </BlogSection>
          </aside>

          <div className="min-w-0">
            <BlogSection className="hidden md:block">
              <div className="rounded-[26px] border border-border bg-white px-5 py-4 shadow-[0_18px_42px_-30px_rgba(36,46,57,0.14)] dark:border-white/10 dark:bg-card dark:shadow-[0_24px_48px_-30px_rgba(4,10,24,0.6)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-black tracking-[-0.02em] text-foreground">
                      {filteredPosts.length > 0
                        ? t('blog.results_summary', {
                            start: resultsStart,
                            end: resultsEnd,
                            total: filteredPosts.length,
                            defaultValue: `Hiển thị ${resultsStart}-${resultsEnd} trên ${filteredPosts.length} bài viết`,
                          })
                        : t('blog.results_summary_empty', 'Chưa có bài viết phù hợp')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {filter === 'all'
                        ? t('blog.page_note', 'Mỗi trang giữ 12 bài để nhịp đọc và nhịp scan gọn hơn trên cả mobile lẫn desktop.')
                        : t('blog.filtered_note', { filter: activeFilterLabel, defaultValue: `Đang lọc theo ${activeFilterLabel}.` })}
                    </p>
                  </div>
                  {(filter !== 'all' || hasSearchTerm) ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-full border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition hover:border-primary/30 hover:text-primary"
                    >
                      {t('blog.clear_filters', 'Xóa lọc')}
                    </button>
                  ) : null}
                </div>
              </div>
            </BlogSection>

            {filteredPosts.length > 0 && leadPost ? (
              <>
                <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_320px]">
                  <BlogSection>
                    <button
                      type="button"
                      onClick={() => onSelectPost(leadPost.slug, leadPost.category_slug)}
                      onMouseEnter={() => onPrefetchPost?.(leadPost.slug)}
                      className="group flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-border bg-white text-left shadow-[0_24px_54px_-34px_rgba(36,46,57,0.18)] transition hover:-translate-y-1 hover:border-primary/30 dark:border-white/10 dark:bg-card dark:shadow-[0_28px_58px_-34px_rgba(4,10,24,0.62)]"
                    >
                      <div className="relative aspect-[1.4/1] overflow-hidden">
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
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                        <span className="absolute left-4 top-4 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/50 dark:text-white">
                          {categoryNameMap.get(leadPost.category_slug) || t('nav.knowledge')}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-6 md:p-8">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.featured_story')}</p>
                        <h2 className="mt-3 text-2xl font-black leading-tight text-foreground md:text-[2rem]">{getLocalized(leadPost, 'title')}</h2>
                        <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground md:text-base">{getLocalized(leadPost, 'summary')}</p>
                        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('blog.published_date', 'Ngày đăng')}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{new Date(leadPost.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          </div>
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                            {t('blog.read_article')}
                            <EyeIcon className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </BlogSection>

                  <div className="grid gap-4">
                    <BlogSection className="hidden md:block">
                      <div className="rounded-[28px] border border-border bg-white p-5 shadow-[0_18px_40px_-30px_rgba(36,46,57,0.14)] dark:border-white/10 dark:bg-card dark:shadow-[0_24px_46px_-30px_rgba(4,10,24,0.56)]">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.featured_story')}</p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('blog.featured_story_hint')}</p>
                      </div>
                    </BlogSection>
                    {spotlightPosts.map((post) => (
                      <BlogSection key={post.slug}>
                        <button
                          type="button"
                          onClick={() => onSelectPost(post.slug, post.category_slug)}
                          onMouseEnter={() => onPrefetchPost?.(post.slug)}
                          className="group flex w-full items-center gap-4 overflow-hidden rounded-[26px] border border-border bg-white p-4 text-left shadow-[0_18px_40px_-30px_rgba(36,46,57,0.16)] transition hover:-translate-y-1 hover:border-primary/30 dark:border-white/10 dark:bg-card dark:shadow-[0_24px_48px_-30px_rgba(4,10,24,0.58)]"
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
                            className="h-24 w-24 rounded-[18px] object-cover md:h-28 md:w-28"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                              {categoryNameMap.get(post.category_slug) || t('nav.knowledge')}
                            </p>
                            <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-foreground">{getLocalized(post, 'title')}</h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{getLocalized(post, 'summary')}</p>
                          </div>
                        </button>
                      </BlogSection>
                    ))}
                  </div>
                </div>

                {archivePosts.length > 0 ? (
                  <section className="mt-8 content-auto">
                    <BlogSection className="mb-5 text-center md:text-left">
                      <p className="section-kicker">{t('blog.recent_dispatches')}</p>
                      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground md:text-[2rem]">{t('blog.recent_dispatches')}</h2>
                      <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0">{t('blog.recent_dispatches_hint')}</p>
                    </BlogSection>
                    <div className="grid gap-4 md:grid-cols-2">
                      {archivePosts.map((post) => (
                        <BlogSection key={post.slug}>
                          <button
                            type="button"
                            onClick={() => onSelectPost(post.slug, post.category_slug)}
                            onMouseEnter={() => onPrefetchPost?.(post.slug)}
                            className="group flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-border bg-white text-left shadow-[0_18px_42px_-32px_rgba(36,46,57,0.15)] transition hover:-translate-y-1 hover:border-primary/30 dark:border-white/10 dark:bg-card dark:shadow-[0_24px_48px_-30px_rgba(4,10,24,0.58)]"
                          >
                            <div className="relative aspect-[1.28/1] overflow-hidden">
                              <FallbackBlogImage
                                loading="lazy"
                                slug={post.slug}
                                src={post.image_url}
                                alt={buildBlogImageAlt({
                                  title: getLocalized(post, 'title'),
                                  categoryName: categoryNameMap.get(post.category_slug),
                                  context: 'listing',
                                })}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                              />
                              <span className="absolute left-4 top-4 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/50 dark:text-white">
                                {categoryNameMap.get(post.category_slug) || t('nav.knowledge')}
                              </span>
                            </div>
                            <div className="flex flex-1 flex-col p-5">
                              <h3 className="line-clamp-2 text-xl font-black leading-7 text-foreground">{getLocalized(post, 'title')}</h3>
                              <p className="mt-3 flex-1 line-clamp-3 text-sm leading-7 text-muted-foreground">{getLocalized(post, 'summary')}</p>
                              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                                <p className="line-clamp-1 text-sm font-semibold text-muted-foreground">{new Date(post.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                                  {t('blog.read_article')}
                                  <EyeIcon className="h-4 w-4" />
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
              <BlogSection className="mt-8 rounded-[30px] border border-border bg-[linear-gradient(135deg,#fff4eb_0%,#ffffff_48%,#eef8ff_100%)] px-6 py-12 text-center shadow-[0_24px_52px_-36px_rgba(36,46,57,0.16)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0c1520_0%,#101926_48%,#0f1d29_100%)] dark:shadow-[0_28px_58px_-36px_rgba(4,10,24,0.62)] md:px-10">
                <p className="text-lg font-semibold text-foreground">{t('blog.no_posts')}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('blog.no_posts_recovery', 'Thử bỏ từ khóa tìm kiếm hoặc chuyển sang nhóm chủ đề rộng hơn để tiếp tục khám phá.')}</p>
              </BlogSection>
            )}

            {filteredPosts.length > 0 ? (
              <div className="mt-8">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            ) : null}
          </div>
        </div>

        {isFilterOpen ? (
          <div className="fixed inset-0 z-[110] bg-black/50 md:hidden" onClick={() => setIsFilterOpen(false)}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[30px] bg-white p-5 shadow-[0_-28px_60px_-34px_rgba(36,46,57,0.32)] dark:bg-card dark:shadow-[0_-28px_60px_-34px_rgba(4,10,24,0.78)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t('blog.topics_label', 'Topics')}</p>
                  <h2 className="mt-1 text-lg font-black text-foreground">{t('blog.choose_topic', 'Chọn chủ đề')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {topicOptions.map((option) => (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => {
                      setFilter(option.slug);
                      setIsFilterOpen(false);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      filter === option.slug
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-white text-foreground dark:border-white/10 dark:bg-accent'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BlogPage;
