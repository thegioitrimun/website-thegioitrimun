import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBiDirectionalSticky } from '../hooks/useBiDirectionalSticky';
import type { BlogPost, Product, Service } from '../types';
import { getFallbackBlogImage } from '../types';
import FallbackBlogImage from './FallbackBlogImage';
import FallbackPublicImage from './FallbackPublicImage';
import { CheckIcon, ChevronDownIcon, ShieldCheckIcon, SparklesIcon, HeartIcon } from './icons';
import * as api from '../services/api';
import { sanitizeDetailFaqItems } from '../src/detailFaq';
import { getLocalizedArrayValue, getLocalizedValue, rankByTokenOverlap } from '../src/relatedContent';
import { buildServiceImageAlt } from '../src/imageSeo';
import BackIconButton from './BackIconButton';
import LocalSeoTags from './LocalSeoTags';

interface ServiceDetailPageProps {
    service: Service;
    allServices: Service[];
    allProducts: Product[];
    allBlogPosts: BlogPost[];
    onSelectService: (id: number) => void;
    onSelectProduct: (id: number, categorySlug?: string) => void;
    onSelectPost: (slug: string, categorySlug?: string) => void;
    onBack: () => void;
    onRequestBooking: () => void;
}

const buildSeoUrl = (path: string, lang: string) => {
    if (lang.startsWith('vi')) return `https://thegioitrimun.vn${path}`;
    return `https://thegioitrimun.vn${path}?lang=${encodeURIComponent(lang)}`;
};

type DetailFaqItem = {
    question: string;
    answer: string;
};

const splitHighlights = (value: string | undefined | null, limit = 4) =>
    String(value || '')
        .split(/[\n•|-]|(?:\.\s+)/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, limit);

const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({
    service: serviceProp,
    allServices,
    allProducts,
    allBlogPosts,
    onSelectService,
    onSelectProduct,
    onSelectPost,
    onBack,
    onRequestBooking,
}) => {
    const { t, i18n } = useTranslation();
    const [hydratedService, setHydratedService] = useState<Service | null>(null);
    const servicePropStepCount = serviceProp.procedure_steps?.length || 0;

    useEffect(() => {
        setHydratedService(null);

        if (servicePropStepCount > 0) {
            return;
        }

        let isActive = true;
        api.getServices()
            .then((services) => {
                if (!isActive) return;
                const freshService = services.find((candidate) =>
                    candidate.id === serviceProp.id || (serviceProp.slug && candidate.slug === serviceProp.slug)
                );
                if ((freshService?.procedure_steps || []).length > 0) {
                    setHydratedService(freshService || null);
                }
            })
            .catch(() => {
                // Keep the current lightweight service payload if the detail hydration request fails.
            });

        return () => {
            isActive = false;
        };
    }, [serviceProp.id, serviceProp.slug, servicePropStepCount]);

    const service = hydratedService && (hydratedService.id === serviceProp.id || Boolean(serviceProp.slug && hydratedService.slug === serviceProp.slug))
        ? hydratedService
        : serviceProp;

    const formatCurrency = (amount: number) => {
        if (!amount) return t('nav.contact');
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getLocalized = (obj: any, field: string): string => getLocalizedValue(obj, field, i18n.language);
    const getLocalizedArray = (obj: any, field: string): string[] => getLocalizedArrayValue(obj, field, i18n.language);

    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const sidebarRef = useBiDirectionalSticky(112, 112, 32) as React.RefObject<HTMLDivElement>;

    const localizedName = getLocalized(service, 'name');
    const localizedDescription = getLocalized(service, 'description');
    const localizedBenefits = getLocalizedArray(service, 'benefits');
    const localizedLongDescription = getLocalized(service, 'long_description');
    const localSeoTags = i18n.language.startsWith('vi') ? service.local_seo_tags || [] : [];
    const procedureHighlights = useMemo(
        () => (service.procedure_steps || [])
            .map((step) => getLocalized(step, 'title'))
            .filter(Boolean)
            .slice(0, 4),
        [service.procedure_steps, i18n.language]
    );
    const longDescriptionHighlights = useMemo(
        () => splitHighlights(localizedLongDescription, 4),
        [localizedLongDescription]
    );
    const detailCopy = useMemo(() => {
        const lang = i18n.language;
        if (lang.startsWith('en')) {
            return {
                trustBadges: [
                    { title: 'Clear treatment focus', desc: 'You can quickly see the main concern this service targets and the expected outcome.' },
                    { title: 'Step-by-step clarity', desc: 'The procedure is broken down clearly so patients know what to expect before booking.' },
                    { title: 'Home-care support', desc: 'Supportive products and related guidance are surfaced when at-home care makes sense.' },
                ],
                faqKicker: 'Treatment FAQ',
                faqTitle: 'Questions usually asked before booking',
                faqSubtitle: 'These answers are generated from the current service profile, price and procedure steps.',
                faqSubtitleManaged: 'These answers are maintained by the team specifically for this service.',
                faqSuitableQuestion: 'What concern is this service designed to address?',
                faqBenefitsQuestion: 'What treatment benefits are emphasized?',
                faqProcessQuestion: 'How does the procedure usually unfold?',
                faqPriceQuestion: 'What is the indicative price?',
                faqSuitableLead: 'The current service profile focuses on',
                faqBenefitsLead: 'The main treatment benefits currently highlighted are',
                faqProcessLead: 'The current procedure flow usually moves through',
                stepCountLabel: 'Procedure steps',
                benefitCountLabel: 'Benefit points',
            };
        }
        if (lang.startsWith('ru')) {
            return {
                trustBadges: [
                    { title: 'Понятный фокус лечения', desc: 'Сразу видно, на какую проблему направлена процедура и какого результата ожидать.' },
                    { title: 'Понятный путь процедуры', desc: 'Шаги процедуры показаны ясно, чтобы пациент понимал, как проходит визит до записи.' },
                    { title: 'Поддержка домашнего ухода', desc: 'При необходимости рядом показываются товары и материалы для домашнего сопровождения.' },
                ],
                faqKicker: 'FAQ по услуге',
                faqTitle: 'Вопросы, которые обычно задают перед записью',
                faqSubtitle: 'Ответы собраны из текущего профиля услуги, цены и этапов процедуры.',
                faqSubtitleManaged: 'Эти ответы команда поддерживает отдельно именно для этой услуги.',
                faqSuitableQuestion: 'Какую проблему решает эта услуга?',
                faqBenefitsQuestion: 'Какие преимущества процедуры выделены?',
                faqProcessQuestion: 'Как обычно проходит процедура?',
                faqPriceQuestion: 'Какова ориентировочная стоимость?',
                faqSuitableLead: 'Текущий профиль услуги сфокусирован на',
                faqBenefitsLead: 'Основные преимущества, выделенные на странице, это',
                faqProcessLead: 'Обычно процедура проходит через этапы',
                stepCountLabel: 'Этапов процедуры',
                benefitCountLabel: 'Преимуществ',
            };
        }
        if (lang.startsWith('cn') || lang.startsWith('zh')) {
            return {
                trustBadges: [
                    { title: '治疗重点清晰', desc: '可以快速看出这项疗程主要针对什么问题，以及大致期待什么结果。' },
                    { title: '流程清晰可见', desc: '治疗步骤展示得更清楚，方便在预约前先了解整个过程。' },
                    { title: '可衔接居家护理', desc: '需要时会同步给出辅助产品和相关文章，方便后续护理。' },
                ],
                faqKicker: '服务问答',
                faqTitle: '预约前最常见的问题',
                faqSubtitle: '以下答案来自当前服务资料、参考价格和治疗流程。',
                faqSubtitleManaged: '这些问答由团队单独维护，专门用于这项服务。',
                faqSuitableQuestion: '这项服务主要针对什么问题？',
                faqBenefitsQuestion: '当前强调的治疗优势有哪些？',
                faqProcessQuestion: '治疗流程通常如何进行？',
                faqPriceQuestion: '参考价格是多少？',
                faqSuitableLead: '当前服务资料主要聚焦于',
                faqBenefitsLead: '目前重点强调的治疗优势包括',
                faqProcessLead: '当前流程通常会经过以下环节',
                stepCountLabel: '流程步骤',
                benefitCountLabel: '核心优势',
            };
        }
        return {
            trustBadges: [
                { title: 'Mục tiêu điều trị rõ ràng', desc: 'Bạn có thể thấy nhanh dịch vụ này tập trung vào vấn đề gì và kỳ vọng ra sao.' },
                { title: 'Quy trình được trình bày từng bước', desc: 'Dễ hình dung buổi điều trị sẽ diễn ra như thế nào trước khi đặt lịch.' },
                { title: 'Có hướng chăm sóc hỗ trợ', desc: 'Có thể kết hợp với sản phẩm và bài viết liên quan khi cần chăm sóc tại nhà.' },
            ],
            faqKicker: 'FAQ dịch vụ',
            faqTitle: 'Những câu hỏi thường gặp trước khi đặt lịch',
            faqSubtitle: 'Các câu trả lời dưới đây được tạo từ hồ sơ dịch vụ, mức giá và quy trình hiện đang hiển thị.',
            faqSubtitleManaged: 'FAQ này được đội ngũ cập nhật riêng cho dịch vụ để thông tin hiển thị nhất quán hơn.',
            faqSuitableQuestion: 'Dịch vụ này giải quyết nhóm vấn đề nào?',
            faqBenefitsQuestion: 'Lợi ích điều trị nào đang được nhấn mạnh?',
            faqProcessQuestion: 'Quy trình điều trị thường diễn ra như thế nào?',
            faqPriceQuestion: 'Chi phí tham khảo hiện là bao nhiêu?',
            faqSuitableLead: 'Hiện hồ sơ dịch vụ đang tập trung vào',
            faqBenefitsLead: 'Những lợi ích điều trị được nhấn mạnh gồm',
            faqProcessLead: 'Quy trình hiện tại thường đi qua các bước',
            stepCountLabel: 'Bước điều trị',
            benefitCountLabel: 'Điểm lợi ích',
        };
    }, [i18n.language]);
    const managedServiceFaqs = useMemo<DetailFaqItem[]>(
        () => (i18n.language.startsWith('vi') ? sanitizeDetailFaqItems(service.faq_items) : []),
        [service.faq_items, i18n.language]
    );
    const guidanceCopy = useMemo(() => {
        const lang = i18n.language;
        if (lang.startsWith('en')) {
            return {
                nextStepTitle: 'Best next step after this page',
                nextStepSubtitle: 'Book now if the need is clear. Otherwise move into supportive products or related articles first.',
                bookingCta: 'Book this treatment',
                productsCta: 'See supportive products',
                articlesCta: 'Read related articles',
                homeCareTitle: 'At-home support lane',
                homeCareSubtitle: 'Natural next products that can support this treatment plan.',
            };
        }
        if (lang.startsWith('ru')) {
            return {
                nextStepTitle: 'Лучший следующий шаг',
                nextStepSubtitle: 'Если потребность уже ясна — записывайтесь. Если нет — сначала посмотрите поддерживающие товары и статьи.',
                bookingCta: 'Записаться на процедуру',
                productsCta: 'Товары поддержки',
                articlesCta: 'Связанные статьи',
                homeCareTitle: 'Домашняя поддержка',
                homeCareSubtitle: 'Логичные продукты, которые можно использовать рядом с этой услугой.',
            };
        }
        if (lang.startsWith('cn') || lang.startsWith('zh')) {
            return {
                nextStepTitle: '下一步怎么走更合适',
                nextStepSubtitle: '如果需求已经明确就直接预约；如果还在判断，可以先看辅助产品或相关文章。',
                bookingCta: '预约此疗程',
                productsCta: '查看辅助产品',
                articlesCta: '阅读相关文章',
                homeCareTitle: '居家支持路径',
                homeCareSubtitle: '与这项疗程自然衔接的辅助产品。',
            };
        }
        return {
            nextStepTitle: 'Bước đi hợp lý tiếp theo',
            nextStepSubtitle: 'Nếu nhu cầu đã rõ, hãy đặt lịch ngay. Nếu còn cân nhắc, hãy xem sản phẩm hỗ trợ hoặc bài viết liên quan trước.',
            bookingCta: 'Đặt lịch dịch vụ này',
            productsCta: 'Xem sản phẩm hỗ trợ',
            articlesCta: 'Đọc bài liên quan',
            homeCareTitle: 'Chăm sóc tại nhà',
            homeCareSubtitle: 'Các sản phẩm phù hợp để hỗ trợ hoặc duy trì sau liệu trình.',
        };
    }, [i18n.language]);
    const derivedServiceFaqs = useMemo<DetailFaqItem[]>(() => {
        const faqItems: DetailFaqItem[] = [];

        if (localizedDescription) {
            faqItems.push({
                question: detailCopy.faqSuitableQuestion,
                answer: localizedBenefits.length > 0
                    ? `${detailCopy.faqSuitableLead} ${localizedBenefits.slice(0, 3).join(', ')}.`
                    : localizedDescription,
            });
        }

        if (localizedBenefits.length > 0) {
            faqItems.push({
                question: detailCopy.faqBenefitsQuestion,
                answer: `${detailCopy.faqBenefitsLead} ${localizedBenefits.slice(0, 4).join(', ')}.`,
            });
        }

        if (procedureHighlights.length > 0 || longDescriptionHighlights.length > 0 || localizedLongDescription) {
            const processSummary = procedureHighlights.length > 0
                ? `${detailCopy.faqProcessLead} ${procedureHighlights.join(', ')}.`
                : longDescriptionHighlights.length > 0
                    ? longDescriptionHighlights.join('. ') + '.'
                    : localizedLongDescription;
            faqItems.push({
                question: detailCopy.faqProcessQuestion,
                answer: processSummary,
            });
        }

        if (service.price) {
            faqItems.push({
                question: detailCopy.faqPriceQuestion,
                answer: formatCurrency(service.price),
            });
        }

        return faqItems.slice(0, 4);
    }, [
        detailCopy,
        localizedBenefits,
        localizedDescription,
        localizedLongDescription,
        longDescriptionHighlights,
        procedureHighlights,
        service.price,
    ]);
    const serviceFaqs = managedServiceFaqs.length > 0 ? managedServiceFaqs : derivedServiceFaqs;
    const faqSubtitleText = managedServiceFaqs.length > 0 ? detailCopy.faqSubtitleManaged : detailCopy.faqSubtitle;
    const sourceParts = useMemo(
        () => [localizedName, localizedDescription, localizedBenefits, localizedLongDescription.slice(0, 1400)],
        [localizedName, localizedDescription, localizedBenefits, localizedLongDescription]
    );

    const relatedServices = useMemo(() => rankByTokenOverlap<Service>({
        items: allServices.filter((candidate) => candidate.id !== service.id),
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
    }), [allServices, service.id, sourceParts, i18n.language]);

    const relatedBlogPosts = useMemo(() => rankByTokenOverlap<BlogPost>({
        items: allBlogPosts,
        lang: i18n.language,
        limit: 4,
        sourceParts,
        getItemParts: (candidate) => [
            getLocalized(candidate, 'title'),
            getLocalized(candidate, 'summary'),
            candidate.category_slug || '',
        ],
        requiredFields: ['title', 'summary'],
        sortTieBreaker: (a, b) => (b.date || '').localeCompare(a.date || ''),
    }), [allBlogPosts, sourceParts, i18n.language]);

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
    const supportProducts = useMemo(() => relatedProducts.slice(0, 3), [relatedProducts]);
    const supportArticles = useMemo(() => relatedBlogPosts.slice(0, 3), [relatedBlogPosts]);

    React.useEffect(() => {
        const canonicalPath = `/dich-vu/${service.slug || service.id}`;
        const canonicalUrl = buildSeoUrl(canonicalPath, i18n.language);

        const breadcrumbLd = {
            '@context': 'https://schema.org/',
            '@type': 'BreadcrumbList',
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
                    name: 'Dịch vụ',
                    item: buildSeoUrl('/dich-vu', i18n.language)
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: localizedName,
                    item: canonicalUrl
                }
            ]
        };

        const serviceLd = {
            '@context': 'https://schema.org',
            '@id': `${canonicalUrl}#service`,
            '@type': 'MedicalProcedure',
            name: localizedName,
            description: localizedDescription,
            image: service.image_url || undefined,
            inLanguage: i18n.language.startsWith('zh') || i18n.language.startsWith('cn') ? 'zh' : i18n.language,
            category: t('services.title', 'Dịch vụ'),
            bodyLocation: t('services.body_location_skin', 'Skin'),
            procedureType: localizedBenefits[0] || localizedName,
            howPerformed: procedureHighlights.length > 0
                ? procedureHighlights.join(' • ')
                : longDescriptionHighlights.join(' • ') || localizedLongDescription || localizedDescription,
            provider: {
                '@type': 'MedicalOrganization',
                name: 'Thế Giới Trị Mụn',
                url: 'https://thegioitrimun.vn',
                image: 'https://thegioitrimun.vn/icons/da-lieu-nhiet-doi-phu-quoc-512.png'
            },
            url: canonicalUrl,
            mainEntityOfPage: canonicalUrl,
            serviceType: t('services.title', 'Dịch vụ'),
            keywords: localSeoTags.join(', ') || undefined,
            areaServed: {
                '@type': 'Country',
                name: 'Vietnam',
            },
            ...(localizedBenefits.length > 0 ? {
                additionalProperty: [
                    {
                        '@type': 'PropertyValue',
                        name: detailCopy.benefitCountLabel,
                        value: String(localizedBenefits.length),
                    },
                ]
            } : {}),
            ...(service.price ? {
                offers: {
                    '@type': 'Offer',
                    price: service.price,
                    priceCurrency: 'VND',
                    availability: 'https://schema.org/InStock',
                    url: canonicalUrl,
                }
            } : {})
        };
        const faqLd = serviceFaqs.length > 0 ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: serviceFaqs.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        } : null;

        let scriptEl = document.getElementById('service-jsonld') as HTMLScriptElement | null;
        if (!scriptEl) {
            scriptEl = document.createElement('script');
            scriptEl.id = 'service-jsonld';
            scriptEl.type = 'application/ld+json';
            document.head.appendChild(scriptEl);
        }
        scriptEl.textContent = JSON.stringify([breadcrumbLd, serviceLd, ...(faqLd ? [faqLd] : [])]);

        return () => {
            scriptEl?.remove();
        };
    }, [
        detailCopy,
        i18n.language,
        localizedBenefits,
        localizedDescription,
        localizedLongDescription,
        localizedName,
        localSeoTags,
        longDescriptionHighlights,
        procedureHighlights,
        service,
        serviceFaqs,
        t,
    ]);

    return (
        <div className="animate-scale-in bg-background pb-10 md:pb-16 text-foreground transition-colors duration-300">
            <div className="container mx-auto">


                <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:gap-12 md:mb-12">
                    <div className="lg:w-1/2 w-full">
                        <FallbackPublicImage
                            src={service.image_url || 'https://placehold.co/600x400'}
                            alt={buildServiceImageAlt({ serviceName: localizedName, context: 'cover' })}
                            loading="eager"
                            className="aspect-[1.05/1] w-full object-cover shadow-lg sm:aspect-[1.2/1] md:aspect-video md:rounded-2xl lg:rounded-[24px]"
                        />
                    </div>
                    <div className="lg:w-1/2 w-full flex flex-col justify-center px-5 sm:px-8 lg:px-0">
                        <h1 className="text-3xl font-bold text-foreground font-heading md:text-5xl text-center md:text-left">{localizedName}</h1>
                        <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg text-center md:text-left">{localizedDescription}</p>
                        <div className="mt-5 flex flex-wrap gap-2 md:mt-6 justify-center md:justify-start">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                                {formatCurrency(service.price)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
                                {service.procedure_steps?.length || 0} {detailCopy.stepCountLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
                                {localizedBenefits.length} {detailCopy.benefitCountLabel}
                            </span>
                        </div>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {detailCopy.trustBadges.map((badge, index) => {
                                const Icon = index === 0 ? ShieldCheckIcon : index === 1 ? SparklesIcon : HeartIcon;
                                return (
                                    <div key={badge.title} className="rounded-[22px] border border-border bg-white p-4 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-black text-foreground">{badge.title}</p>
                                                <p className="mt-1 text-xs leading-6 text-muted-foreground">{badge.desc}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="lg:grid lg:grid-cols-12 lg:gap-12">
                    <main className="lg:col-span-8 mb-12 lg:mb-0">
                        <div className="">
                            <div className="py-8 md:py-10">
                                <h2 className="text-3xl font-bold text-foreground font-heading mb-6 text-center md:text-left">{t('services.procedure')}</h2>
                                <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed mb-8">
                                    <p>{localizedLongDescription}</p>
                                </div>

                                <div className="my-8 border-t border-border"></div>

                                <div>
                                    <h3 className="text-2xl font-bold text-foreground mb-6 text-center md:text-left">{t('services.benefits')}</h3>
                                    <ul className="space-y-4">
                                        {localizedBenefits.map((benefit, index) => (
                                            <li key={index} className="flex items-start">
                                                <CheckIcon className="w-6 h-6 text-primary mr-3 mt-1 flex-shrink-0" />
                                                <span className="text-lg text-muted-foreground">{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>



                            {service.procedure_steps && service.procedure_steps.length > 0 && (
                                <div className="mt-8 md:mt-12">
                                    <h2 className="text-3xl font-bold text-foreground font-heading mb-8 text-center md:text-left">{t('services.procedure_steps', 'Chi tiết liệu trình')}</h2>
                                    <div className="relative ml-4 space-y-8 border-l-2 border-primary/20 pl-6 md:ml-6 md:pl-10 md:space-y-12">
                                        {service.procedure_steps.map((step) => (
                                            <div key={step.id} className="relative">
                                                <div className="absolute -left-[31px] top-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-4 ring-card md:-left-[51px] md:h-12 md:w-12 md:text-xl md:ring-8">
                                                    {step.step_number}
                                                </div>
                                                <div className="rounded-[22px] bg-muted/30 p-4 md:p-6">
                                                    <h4 className="text-xl font-semibold text-foreground mb-2">{getLocalized(step, 'title')}</h4>
                                                    <p className="text-muted-foreground mb-4">{getLocalized(step, 'description')}</p>
                                                    {step.image_url && (
                                                        <FallbackPublicImage
                                                            src={step.image_url}
                                                            alt={buildServiceImageAlt({
                                                                serviceName: localizedName,
                                                                stepTitle: getLocalized(step, 'title'),
                                                                stepNumber: step.step_number,
                                                                context: 'step',
                                                            })}
                                                            loading="eager"
                                                            className="w-full max-w-sm h-auto object-cover rounded-lg shadow-md"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {serviceFaqs.length > 0 && (
                                <div className="py-8 md:py-10 px-5 sm:px-8 lg:px-0">
                                    <p className="section-kicker text-center md:text-left">{detailCopy.faqKicker}</p>
                                    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground md:text-3xl text-center md:text-left">{detailCopy.faqTitle}</h2>
                                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base text-center md:text-left">{faqSubtitleText}</p>
                                    <div className="mt-6 space-y-3">
                                        {serviceFaqs.map((item, index) => (
                                            <details
                                                key={`${item.question}-${index}`}
                                                open={index === 0}
                                                className="group rounded-[22px] border border-border bg-white px-5 py-4 shadow-sm"
                                            >
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                                                    <span className="text-sm font-black text-foreground md:text-base">{item.question}</span>
                                                    <span className="action-icon-chip h-10 w-10 shrink-0 transition-transform group-open:rotate-180">
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    </span>
                                                </summary>
                                                <p className="mt-4 pr-2 text-sm leading-7 text-muted-foreground md:text-base">{item.answer}</p>
                                            </details>
                                        ))}
                                    </div>
                                </div>
                            )}



                            {(relatedBlogPosts.length > 0 || relatedProducts.length > 0) && (
                                <div className="grid gap-6 md:grid-cols-2">
                                    {relatedBlogPosts.length > 0 && (
                                        <section className="rounded-[24px] bg-card px-6 py-8 md:py-10 shadow-[0_22px_60px_-15px_rgba(0,0,0,0.15)] transform transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
                                            <h2 className="text-2xl font-bold font-heading text-foreground text-center md:text-left">{t('services.related_articles', 'Bài viết nên đọc')}</h2>
                                            <p className="mt-2 text-sm text-muted-foreground text-center md:text-left">{t('services.related_articles_hint', 'Những bài viết này giải thích sâu hơn về vấn đề da và lý do nên chọn liệu trình này.')}</p>
                                            <div className="mt-5 space-y-4">
                                                {relatedBlogPosts.map((candidate) => (
                                                    <button
                                                        key={candidate.slug}
                                                        type="button"
                                                        onClick={() => onSelectPost(candidate.slug, candidate.category_slug)}
                                                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-primary/5"
                                                    >
                                                        <FallbackBlogImage loading="lazy" slug={candidate.slug} src={candidate.image_url} alt={getLocalized(candidate, 'title')} className="h-16 w-16 rounded-lg object-cover" />
                                                        <div>
                                                            <h3 className="font-semibold text-foreground line-clamp-2">{getLocalized(candidate, 'title')}</h3>
                                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{getLocalized(candidate, 'summary')}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {relatedProducts.length > 0 && (
                                        <section className="rounded-[24px] bg-card px-6 py-8 md:py-10 shadow-[0_22px_60px_-15px_rgba(0,0,0,0.15)] transform transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
                                            <h2 className="text-2xl font-bold font-heading text-foreground text-center md:text-left">{t('services.related_products', 'Sản phẩm hỗ trợ')}</h2>
                                            <p className="mt-2 text-sm text-muted-foreground text-center md:text-left">{t('services.related_products_hint', 'Các sản phẩm này phù hợp để duy trì kết quả hoặc hỗ trợ trong routine tại nhà.')}</p>
                                            <div className="mt-5 space-y-4">
                                                {relatedProducts.map((candidate) => (
                                                    <button
                                                        key={candidate.id}
                                                        type="button"
                                                        onClick={() => onSelectProduct(candidate.id, candidate.category?.slug || candidate.category_slug)}
                                                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-primary/5"
                                                    >
                                                        <FallbackPublicImage loading="eager" src={candidate.images?.[0]?.image_url || 'https://placehold.co/120x120'} alt={getLocalized(candidate, 'name')} className="h-16 w-16 rounded-lg object-cover" />
                                                        <div>
                                                            <h3 className="font-semibold text-foreground line-clamp-2">{getLocalized(candidate, 'name')}</h3>
                                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{getLocalized(candidate, 'description')}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}

                        </div>
                    </main>

                    <aside className="lg:col-span-4">
                        <div ref={sidebarRef} className="sticky lg:self-start space-y-8" style={{ top: '7rem' }}>
                            <div className="bg-card p-6 rounded-xl shadow-lg">
                                <h3 className="text-lg font-semibold text-muted-foreground text-center md:text-left">{t('services.price')}</h3>
                                <p className="text-3xl font-bold tracking-tight text-primary my-2 text-center md:text-left">{formatCurrency(service.price)}</p>
                                <div className="mt-4 space-y-2 rounded-[20px] border border-border bg-background p-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{detailCopy.stepCountLabel}</span>
                                        <span className="font-bold text-foreground">{service.procedure_steps?.length || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{detailCopy.benefitCountLabel}</span>
                                        <span className="font-bold text-foreground">{localizedBenefits.length}</span>
                                    </div>
                                    <div className="border-t border-border pt-2 text-sm text-muted-foreground">
                                        {localizedBenefits[0] || procedureHighlights[0] || localizedDescription}
                                    </div>
                                </div>
                                <button onClick={onRequestBooking} className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press">
                                    {t('services.book_now')}
                                </button>
                                {supportProducts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectProduct(supportProducts[0].id, supportProducts[0].category?.slug || supportProducts[0].category_slug)}
                                        className="w-full mt-3 rounded-full border border-border bg-white px-6 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary btn-press"
                                    >
                                        {guidanceCopy.productsCta}
                                    </button>
                                )}
                            </div>

                            {relatedServices.length > 0 && (
                                <div className="bg-card px-6 py-8 md:py-10 rounded-[24px] shadow-[0_22px_60px_-15px_rgba(0,0,0,0.15)] transform transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
                                    <h3 className="text-2xl font-bold text-foreground font-heading mb-2 text-center md:text-left">{t('services.related')}</h3>
                                    <p className="mb-6 text-sm text-muted-foreground text-center md:text-left">{t('services.related_hint', 'Các dịch vụ này nằm gần cùng nhu cầu điều trị hoặc giai đoạn chăm sóc.')}</p>
                                    <div className="space-y-4">
                                        {relatedServices.map((candidate) => (
                                            <div
                                                key={candidate.id}
                                                onClick={() => onSelectService(candidate.id)}
                                                className="group bg-muted/40 p-3 rounded-lg cursor-pointer transition-all duration-300 hover:bg-primary/10 border border-transparent hover:border-primary/30 flex items-center gap-4"
                                            >
                                                <FallbackPublicImage loading="eager" src={candidate.image_url || 'https://placehold.co/100x100'} alt={getLocalized(candidate, 'name')} className="w-12 h-12 flex-shrink-0 rounded-md object-cover bg-muted" />
                                                <div>
                                                    <h4 className="font-bold text-foreground leading-tight">{getLocalized(candidate, 'name')}</h4>
                                                    <p className="text-sm text-muted-foreground line-clamp-1">{getLocalized(candidate, 'description')}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

        </div>
    );
};

export default ServiceDetailPage;
