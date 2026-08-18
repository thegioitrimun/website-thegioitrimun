import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlogPost, BlogCategory, Product, Service, SiteInfo } from '../types';
import { getFallbackBlogImage } from '../types';
import { CalendarIcon, ShoppingBagIcon, UserIcon as AuthorIcon, ServiceListIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import MarkdownRenderer from './MarkdownRenderer';
import { buildBlogArticleBodyExcerpt, buildBlogKeywordList, buildBlogSeoDescription, countBlogWords, extractBlogHeadings } from '../src/blogSeo';
import { getLocalizedArrayValue, getLocalizedValue, rankByTokenOverlap } from '../src/relatedContent';
import { buildBlogImageAlt } from '../src/imageSeo';
import FallbackBlogImage from './FallbackBlogImage';
import BackIconButton from './BackIconButton';
import LocalSeoTags from './LocalSeoTags';

interface BlogPostPageProps {
  post: BlogPost;
  isContentLoading?: boolean;
  allPosts: BlogPost[];
  categories: BlogCategory[];
  allProducts: Product[];
  allServices: Service[];
  onSelectPost: (slug: string, categorySlug?: string) => void;
  onSelectProduct: (id: number, categorySlug?: string) => void;
  onSelectService: (id: number) => void;
  onBack: () => void;
  siteInfo: SiteInfo | null;
  onGoToServices?: () => void;
  onGoToProducts?: () => void;
}

const buildSeoUrl = (path: string, lang: string) => {
  if (lang.startsWith('vi')) return `https://thegioitrimun.vn${path}`;
  return `https://thegioitrimun.vn${path}?lang=${encodeURIComponent(lang)}`;
};

const BlogPostPage: React.FC<BlogPostPageProps> = ({
  post,
  isContentLoading = false,
  allPosts,
  categories,
  allProducts,
  allServices,
  onSelectPost,
  onSelectProduct,
  onSelectService,
  onBack,
  siteInfo,
  onGoToServices,
  onGoToProducts,
}) => {
  const { t, i18n } = useTranslation();
  const author = post.author;
  const category = categories.find(c => c.slug === post.category_slug);

  const getLocalized = (obj: any, field: string): string => getLocalizedValue(obj, field, i18n.language);
  const getLocalizedArray = (obj: any, field: string): string[] => getLocalizedArrayValue(obj, field, i18n.language);

  const localizedTitle = getLocalized(post, 'title');
  const localizedSummary = getLocalized(post, 'summary');
  const localizedContent = getLocalized(post, 'content');
  const hasRenderableContent = localizedContent.trim().length > 0;
  const categoryName = category ? getLocalized(category, 'name') : post.category_slug || '';
  const categorySlug = category?.slug || post.category_slug || 'tong-hop';
  const canonicalPath = `/kien-thuc/${categorySlug}/${post.slug}`;
  const canonicalUrl = post.canonical_url || buildSeoUrl(canonicalPath, i18n.language);
  const blogIndexUrl = buildSeoUrl('/kien-thuc', i18n.language);
  const imageUrl = post.image_url || getFallbackBlogImage(post.slug);
  const seoDescription = useMemo(
    () =>
      buildBlogSeoDescription({
        metaDescription: i18n.language.startsWith('vi') ? post.meta_description : '',
        summary: localizedSummary,
        content: localizedContent,
        categoryName,
      }),
    [categoryName, i18n.language, localizedContent, localizedSummary, post.meta_description]
  );
  const articleKeywords = useMemo(
    () => Array.from(new Set([
      ...buildBlogKeywordList({
        metaKeywords: i18n.language.startsWith('vi') ? post.meta_keywords : '',
        title: localizedTitle,
        categoryName,
        summary: localizedSummary,
        content: localizedContent,
      }),
      ...(i18n.language.startsWith('vi') ? post.local_seo_tags || [] : []),
    ])),
    [categoryName, i18n.language, localizedContent, localizedSummary, localizedTitle, post.local_seo_tags, post.meta_keywords]
  );
  const articleHeadings = useMemo(() => extractBlogHeadings(localizedContent, 4), [localizedContent]);
  const articleBodyExcerpt = useMemo(() => buildBlogArticleBodyExcerpt(localizedContent), [localizedContent]);
  const articleWordCount = useMemo(() => countBlogWords(localizedContent), [localizedContent]);
  const sourceParts = useMemo(
    () => [localizedTitle, localizedSummary, localizedContent.slice(0, 1800), categoryName],
    [localizedTitle, localizedSummary, localizedContent, categoryName]
  );

  const relatedPosts = useMemo(() => rankByTokenOverlap<BlogPost>({
    items: allPosts.filter((candidate) => candidate.slug !== post.slug),
    lang: i18n.language,
    limit: 4,
    sourceParts,
    getItemParts: (candidate) => [
      getLocalized(candidate, 'title'),
      getLocalized(candidate, 'summary'),
      candidate.category_slug || '',
    ],
    getExtraScore: (candidate) => candidate.category_slug === post.category_slug ? 4 : 0,
    requiredFields: ['title', 'summary'],
    sortTieBreaker: (a, b) => (b.date || '').localeCompare(a.date || ''),
  }), [allPosts, post.slug, post.category_slug, sourceParts, i18n.language]);

  const relatedServices = useMemo(() => rankByTokenOverlap<Service>({
    items: allServices,
    lang: i18n.language,
    limit: 4,
    sourceParts,
    getItemParts: (candidate) => [
      getLocalized(candidate, 'name'),
      getLocalized(candidate, 'description'),
      getLocalizedArray(candidate, 'benefits'),
    ],
    requiredFields: ['name', 'description'],
    sortTieBreaker: (a, b) => a.id - b.id,
  }), [allServices, sourceParts, i18n.language]);

  const relatedProducts = useMemo(() => rankByTokenOverlap<Product>({
    items: allProducts.filter((candidate) => candidate.is_published),
    lang: i18n.language,
    limit: 4,
    sourceParts,
    getItemParts: (candidate) => [
      getLocalized(candidate, 'name'),
      getLocalized(candidate, 'description'),
      getLocalized(candidate, 'ingredients'),
      getLocalizedArray(candidate, 'key_benefits'),
      candidate.brand || '',
    ],
    requiredFields: ['name', 'description'],
    sortTieBreaker: (a, b) => b.id - a.id,
  }), [allProducts, sourceParts, i18n.language]);

  useEffect(() => {
    const publisherLogo = siteInfo?.logo_light_url || siteInfo?.logo_dark_url || 'https://thegioitrimun.vn/icons/da-lieu-nhiet-doi-phu-quoc-512.png';
    const webPageId = `${canonicalUrl}#webpage`;
    const aboutTopics = Array.from(new Set([categoryName, ...articleKeywords, ...articleHeadings].filter(Boolean)))
      .slice(0, 8)
      .map((topic) => ({
        '@type': 'Thing',
        name: topic,
      }));
    const mentionEntities = [
      ...relatedProducts.slice(0, 2).map((product) => ({
        '@type': 'Thing',
        name: getLocalized(product, 'name'),
        url: buildSeoUrl(`/san-pham/${product.category?.slug || product.category_slug || 'khac'}/${product.slug || product.id}`, i18n.language),
      })),
      ...relatedServices.slice(0, 2).map((service) => ({
        '@type': 'Thing',
        name: getLocalized(service, 'name'),
        url: buildSeoUrl(`/dich-vu/${service.slug || service.id}`, i18n.language),
      })),
      ...relatedPosts.slice(0, 2).map((candidate) => ({
        '@type': 'Thing',
        name: getLocalized(candidate, 'title'),
        url: buildSeoUrl(`/kien-thuc/${candidate.category_slug || 'tong-hop'}/${candidate.slug}`, i18n.language),
      })),
    ].filter((entry) => entry.name);

    const breadcrumbLd = {
      '@context': 'https://schema.org/',
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Trang chủ',
          item: buildSeoUrl('/', i18n.language)
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Kiến thức',
          item: buildSeoUrl('/kien-thuc', i18n.language)
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: category ? getLocalized(category, 'name') : 'Bài viết',
          item: buildSeoUrl(`/kien-thuc/${categorySlug}`, i18n.language)
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: localizedTitle,
          item: canonicalUrl
        }
      ]
    };

    const webPageLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': webPageId,
      url: canonicalUrl,
      name: localizedTitle,
      description: seoDescription || localizedSummary,
      inLanguage: i18n.language.startsWith('zh') || i18n.language.startsWith('cn') ? 'zh' : i18n.language,
      isPartOf: {
        '@id': 'https://thegioitrimun.vn#website',
      },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: imageUrl,
        caption: localizedTitle,
      },
      breadcrumb: {
        '@id': `${canonicalUrl}#breadcrumb`,
      },
    };

    const articleLd = {
      '@context': 'https://schema.org',
      '@id': `${canonicalUrl}#article`,
      '@type': 'BlogPosting',
      headline: localizedTitle,
      alternativeHeadline: localizedSummary || undefined,
      description: seoDescription || localizedSummary,
      image: [imageUrl],
      thumbnailUrl: imageUrl,
      url: canonicalUrl,
      inLanguage: i18n.language.startsWith('zh') || i18n.language.startsWith('cn') ? 'zh' : i18n.language,
      datePublished: post.date,
      dateModified: post.date,
      mainEntityOfPage: {
        '@id': webPageId,
      },
      isPartOf: {
        '@type': 'Blog',
        '@id': `${blogIndexUrl}#blog`,
        name: t('blog.title'),
        url: blogIndexUrl,
        publisher: {
          '@id': 'https://thegioitrimun.vn#organization',
        },
      },
      articleSection: category ? getLocalized(category, 'name') : 'Kiến thức',
      keywords: articleKeywords.join(', ') || undefined,
      wordCount: articleWordCount || undefined,
      articleBody: articleBodyExcerpt || undefined,
      author: [{
        '@type': 'Person',
        name: author?.name || 'Thế Giới Trị Mụn',
        url: 'https://thegioitrimun.vn/ve-chung-toi'
      }],
      publisher: {
        '@type': 'Organization',
        name: siteInfo?.clinic_name || 'Thế Giới Trị Mụn',
        logo: {
          '@type': 'ImageObject',
          url: publisherLogo
        }
      },
      about: aboutTopics.length > 0 ? aboutTopics : undefined,
      mentions: mentionEntities.length > 0 ? mentionEntities : undefined,
    };

    let scriptEl = document.getElementById('blog-jsonld') as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'blog-jsonld';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify([breadcrumbLd, webPageLd, articleLd]);

    return () => {
      scriptEl?.remove();
    };
  }, [
    articleBodyExcerpt,
    articleHeadings,
    articleKeywords,
    articleWordCount,
    author?.name,
    blogIndexUrl,
    canonicalUrl,
    category,
    categoryName,
    categorySlug,
    getLocalized,
    i18n.language,
    imageUrl,
    localizedSummary,
    localizedTitle,
    post.date,
    post.slug,
    relatedPosts,
    relatedProducts,
    relatedServices,
    seoDescription,
    siteInfo,
    t,
  ]);

  return (
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">

        <div className="flex flex-col lg:flex-row gap-12">
          <main className="lg:w-3/4">
            <AnimatedSection>
              {category && <div className="flex justify-center md:justify-start mb-3"><span className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary">{getLocalized(category, 'name')}</span></div>}
              <h1 className="text-3xl md:text-5xl font-bold text-foreground font-heading mb-5 leading-tight text-center md:text-left">{localizedTitle}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-muted-foreground text-sm mb-6 pb-6 border-b border-border">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 border border-border">
                  <AuthorIcon className="w-5 h-5" />
                  <span>{author?.name || 'Thế Giới Trị Mụn'}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 border border-border">
                  <CalendarIcon className="w-5 h-5" />
                  <span>{new Date(post.date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : i18n.language === 'cn' ? 'zh-CN' : i18n.language === 'ru' ? 'ru-RU' : 'en-US')}</span>
                </div>
              </div>
              <FallbackBlogImage
                slug={post.slug}
                src={post.image_url}
                alt={buildBlogImageAlt({
                  title: localizedTitle,
                  categoryName,
                  context: 'cover',
                })}
                className="w-full rounded-[24px] shadow-lg mb-6 md:mb-8"
              />
              <div className="mx-auto max-w-4xl">
                {hasRenderableContent ? (
                  <MarkdownRenderer content={localizedContent} />
                ) : (
                  <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-sm md:p-8">
                    <p className="section-kicker">Loading article</p>
                    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground md:text-3xl">
                      {localizedSummary || localizedTitle}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
                      {isContentLoading
                        ? t('blog.loading_detail', 'Nội dung chi tiết đang được tải. Phần mở đầu của bài viết đã sẵn sàng, phần còn lại sẽ xuất hiện ngay sau đó.')
                        : t('blog.content_unavailable', 'Nội dung chi tiết của bài viết hiện chưa tải được. Vui lòng thử tải lại trang.')}
                    </p>
                    <div className="mt-6 space-y-4" aria-hidden="true">
                      <div className="h-4 w-11/12 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
                      <div className="h-4 w-10/12 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 w-9/12 animate-pulse rounded-full bg-muted" />
                      <div className="h-28 animate-pulse rounded-[24px] bg-muted/80" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 bg-card border border-border rounded-[24px] p-5 md:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-foreground font-medium">{t('cta.subtitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('blog.cluster_cta', 'Bài viết này là điểm bắt đầu. Từ đây bạn có thể đi tiếp sang dịch vụ điều trị hoặc sản phẩm hỗ trợ phù hợp.')}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  <button
                    onClick={onGoToServices}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-full transition-colors"
                  >
                    {t('nav.services')}
                  </button>
                  <button
                    onClick={onGoToProducts}
                    className="bg-accent hover:bg-accent/80 text-accent-foreground font-semibold py-2 px-4 rounded-full transition-colors"
                  >
                    {t('nav.pharmacy')}
                  </button>
                </div>
              </div>
            </AnimatedSection>

            {(relatedServices.length > 0 || relatedProducts.length > 0) && (
              <AnimatedSection className="mt-12">
                <div className="grid gap-6 lg:grid-cols-2">
                  {relatedServices.length > 0 && (
                    <section className="rounded-2xl border border-border bg-card p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <ServiceListIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold font-heading text-foreground">{t('blog.related_services', 'Dịch vụ phù hợp')}</h2>
                          <p className="text-sm text-muted-foreground">{t('blog.related_services_hint', 'Các lựa chọn điều trị có cùng ngữ cảnh với nội dung bài viết này.')}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {relatedServices.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => onSelectService(service.id)}
                            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-primary/5"
                          >
                            <img loading="lazy" src={service.image_url || 'https://placehold.co/120x120'} alt={getLocalized(service, 'name')} className="h-16 w-16 rounded-lg object-cover" />
                            <div>
                              <h3 className="font-semibold text-foreground line-clamp-2">{getLocalized(service, 'name')}</h3>
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{getLocalized(service, 'description')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {relatedProducts.length > 0 && (
                    <section className="rounded-2xl border border-border bg-card p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <ShoppingBagIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold font-heading text-foreground">{t('blog.related_products', 'Sản phẩm tham khảo')}</h2>
                          <p className="text-sm text-muted-foreground">{t('blog.related_products_hint', 'Những sản phẩm này có chủ đề, công dụng hoặc bối cảnh sử dụng gần với bài viết.')}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {relatedProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => onSelectProduct(product.id, product.category?.slug || product.category_slug)}
                            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-primary/5"
                          >
                            <img loading="lazy" src={product.images?.[0]?.image_url || 'https://placehold.co/120x120'} alt={getLocalized(product, 'name')} className="h-16 w-16 rounded-lg object-cover" />
                            <div>
                              <h3 className="font-semibold text-foreground line-clamp-2">{getLocalized(product, 'name')}</h3>
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{getLocalized(product, 'description')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </AnimatedSection>
            )}
          </main>

          <aside className="lg:w-1/4 lg:sticky lg:top-28 self-start space-y-6">
            {relatedPosts.length > 0 && (
              <AnimatedSection stagger={100}>
                <div className="rounded-[24px] border border-border bg-card p-5">
                  <h3 className="text-xl font-bold text-foreground mb-2 font-heading text-center lg:text-left">{t('blog.related_articles', 'Bài cùng chủ đề')}</h3>
                  <p className="mb-4 text-sm text-muted-foreground text-center lg:text-left">{t('blog.related_articles_hint', 'Đọc thêm các bài liên quan để hiểu rõ hơn chủ đề này trước khi quyết định chăm sóc hoặc điều trị.')}</p>
                  <div className="flex flex-col space-y-4">
                    {relatedPosts.map((candidate) => (
                      <button
                        key={candidate.slug}
                        type="button"
                        onClick={() => onSelectPost(candidate.slug, candidate.category_slug)}
                        className="rounded-xl p-3 text-left transition-all hover:bg-primary/5"
                      >
                            <FallbackBlogImage
                              loading="lazy"
                              slug={candidate.slug}
                              src={candidate.image_url}
                              alt={buildBlogImageAlt({
                                title: getLocalized(candidate, 'title'),
                                categoryName: categories.find((item) => item.slug === candidate.category_slug) ? getLocalized(categories.find((item) => item.slug === candidate.category_slug), 'name') : candidate.category_slug,
                                context: 'listing',
                              })}
                              className="mb-3 h-24 w-full rounded-lg object-cover"
                            />
                        <h4 className="font-semibold text-foreground text-sm leading-tight line-clamp-3">{getLocalized(candidate, 'title')}</h4>
                      </button>
                    ))}
                  </div>
                </div>
              </AnimatedSection>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default BlogPostPage;
