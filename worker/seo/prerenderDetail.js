import {
    normalizeLocalSeoTags,
    toLocalSeoHashtag,
} from './localSeoTags.js';

const renderLocalSeoTagsHtml = (tags, escapeHtml) => {
    const normalizedTags = normalizeLocalSeoTags(tags);
    if (normalizedTags.length === 0) return '';
    return `<p>${normalizedTags.map((tag) => `<span>${escapeHtml(toLocalSeoHashtag(tag))}</span>`).join(' ')}</p>`;
};

export async function handleProduct(idOrSlug, lang = 'vi', deps) {
    const {
        getProductByIdOrSlug,
        getAvailableLangsRequiringAll,
        resolveSupportedLang,
        normalizeSeoLang,
        getProductImages,
        getProductCategoryById,
        getProductReviewSchemaData,
        getProductList,
        getBlogList,
        getServiceList,
        getProductBrands,
        getPrimaryProductImageUrl,
        getListingImageUrl = (url) => url,
        DEFAULT_SHARE_IMAGE,
        getStorageUrl,
        getLocalizedField,
        getStrictLocalizedArray,
        getLocalizedArray,
        getStrictLocalizedField,
        renderMarkdownishHtml,
        formatCurrencyVnd,
        buildAbsoluteUrl,
        normalizeBrandMatchKey,
        getLocalizedLabel,
        buildMetaDescription,
        splitHighlights,
        normalizeDetailFaqItems,
        buildFaqJsonLd,
        HREFLANG_BY_LANG,
        buildKeywordString,
        ORGANIZATION_SCHEMA_ID,
        SITE_NAME,
        BASE_URL,
        buildReviewSection,
        escapeHtml,
        escapeAttr,
        truncateText,
        renderTextList,
        renderFaqItemsHtml,
        rankRecordsByTokenOverlap,
        getProductPathByCategorySlug,
        getResolvedBlogImageUrl,
        getServicePath,
        generateDetailPrerenderHtml,
        buildSeoTitle,
        buildStockLabel,
        getBlogPathByCategorySlug,
    } = deps;

    const product = await getProductByIdOrSlug(idOrSlug);
    if (!product) return null;
    const availableLangs = getAvailableLangsRequiringAll(product, ['name', 'description']);
    const resolvedLang = resolveSupportedLang(lang, availableLangs);
    const hasUnsupportedRequestedLocale = normalizeSeoLang(lang) !== resolvedLang;

    const [productImages, category, reviewSchemaData, productCandidates, blogCandidates, serviceCandidates, brands] = await Promise.all([
        getProductImages(product.id),
        getProductCategoryById(product.category_id),
        getProductReviewSchemaData(product.id),
        getProductList(48, null, { lang: resolvedLang, translationRequired: true }),
        getBlogList(24, null, { lang: resolvedLang, translationRequired: true }),
        getServiceList(24),
        getProductBrands(),
    ]);

    const imageUrl = getPrimaryProductImageUrl(productImages) || DEFAULT_SHARE_IMAGE;
    const allImageUrls = (productImages || [])
        .map((image) => image?.image_path ? getStorageUrl(image.image_path, 'product-images') : null)
        .filter(Boolean);
    const localizedName = getLocalizedField(product, 'name', resolvedLang) || product.name;
    const localizedDescription = getLocalizedField(product, 'description', resolvedLang) || product.description || '';
    const localizedBenefits = getStrictLocalizedArray(product, 'key_benefits', resolvedLang);
    const localizedSkinTypes = getLocalizedArray(product, 'skin_types', resolvedLang);
    const localizedUsage = getStrictLocalizedField(product, 'usage_instructions', resolvedLang);
    const localizedIngredients = getStrictLocalizedField(product, 'ingredients', resolvedLang);
    const localizedPrecautions = getStrictLocalizedField(product, 'precautions', resolvedLang);
    const localizedOrigin = getStrictLocalizedField(product, 'origin', resolvedLang);
    const localizedTexture = getStrictLocalizedField(product, 'texture', resolvedLang);
    const longDescriptionBlocks = resolvedLang === 'vi' && Array.isArray(product.long_description)
        ? product.long_description
        : [];
    const longDescriptionHtml = longDescriptionBlocks.length > 0
        ? renderMarkdownishHtml(
            longDescriptionBlocks
                .filter((block) => block?.type === 'text' && block.content)
                .map((block) => block.content)
                .join('\n\n'),
            { maxBlocks: 18 },
        )
        : '';

    const priceText = formatCurrencyVnd(product.price);
    const categorySlug = category?.slug || 'khac';
    const detailPath = `/san-pham/${categorySlug}/${product.slug || product.id}`;
    const canonicalUrl = buildAbsoluteUrl(detailPath, resolvedLang);
    const matchedBrand = (brands || []).find((brand) => normalizeBrandMatchKey(brand.name) === normalizeBrandMatchKey(product.brand)) || null;
    const brandLandingUrl = matchedBrand ? buildAbsoluteUrl(`/thuong-hieu/${matchedBrand.slug}`, resolvedLang) : null;
    const categoryName = getLocalizedField(category, 'name', resolvedLang) || getLocalizedLabel({
        vi: 'Sản phẩm',
        en: 'Products',
        ru: 'Товары',
        cn: '产品',
    }, resolvedLang);
    const metaDescription = buildMetaDescription([
        localizedDescription,
        localizedBenefits[0],
        product.brand ? `${getLocalizedLabel({ vi: 'Thương hiệu', en: 'Brand', ru: 'Бренд', cn: '品牌' }, resolvedLang)} ${product.brand}` : '',
        priceText,
    ]);
    const ingredientHighlights = splitHighlights(localizedIngredients, 4);
    const usageHighlights = splitHighlights(localizedUsage, 3);
    const internalLinkSourceParts = [
        localizedName,
        localizedDescription,
        localizedIngredients,
        localizedBenefits,
        localizedSkinTypes,
        product.brand || '',
    ];
    const productFaqItems = resolvedLang === 'vi'
        ? normalizeDetailFaqItems(product.faq_items)
        : [];
    if (productFaqItems.length === 0) {
        if (localizedSkinTypes.length > 0 || localizedBenefits.length > 0 || localizedDescription) {
            productFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Sản phẩm này phù hợp với ai?',
                    en: 'Who is this product best suited for?',
                    ru: 'Кому лучше всего подходит этот продукт?',
                    cn: '这款产品更适合哪些人群？',
                }, resolvedLang),
                answer: localizedSkinTypes.length > 0
                    ? `${getLocalizedLabel({
                        vi: 'Hiện sản phẩm phù hợp nhất với',
                        en: 'This product currently aligns best with',
                        ru: 'Сейчас продукт в первую очередь подходит для',
                        cn: '根据当前资料，这款产品更适合',
                    }, resolvedLang)} ${localizedSkinTypes.join(', ')}.`
                    : localizedBenefits.length > 0
                        ? `${getLocalizedLabel({
                            vi: 'Hiện hồ sơ sản phẩm đang tập trung vào',
                            en: 'The current product profile focuses on',
                            ru: 'Текущий профиль товара делает акцент на',
                            cn: '当前产品资料主要聚焦于',
                        }, resolvedLang)} ${localizedBenefits.slice(0, 3).join(', ')}.`
                        : localizedDescription,
            });
        }
        if (ingredientHighlights.length > 0 || localizedIngredients) {
            productFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Thành phần hoặc điểm nổi bật của sản phẩm là gì?',
                    en: 'What ingredients or highlights stand out?',
                    ru: 'Какие ингредиенты и акценты выделены?',
                    cn: '产品有哪些重点成分或亮点？',
                }, resolvedLang),
                answer: ingredientHighlights.length > 0
                    ? `${getLocalizedLabel({
                        vi: 'Những điểm nổi bật đang được nhấn mạnh gồm',
                        en: 'The current product profile highlights',
                        ru: 'В карточке сейчас выделены',
                        cn: '当前产品资料重点强调',
                    }, resolvedLang)} ${ingredientHighlights.join(', ')}.`
                    : localizedIngredients,
            });
        }
        if (usageHighlights.length > 0 || localizedUsage) {
            productFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Nên dùng sản phẩm như thế nào trong routine?',
                    en: 'How should it be used in a routine?',
                    ru: 'Как использовать продукт в рутине?',
                    cn: '在日常护理中应如何使用？',
                }, resolvedLang),
                answer: usageHighlights.length > 0
                    ? `${getLocalizedLabel({
                        vi: 'Cách dùng nhanh từ hồ sơ hiện tại là',
                        en: 'A quick usage direction from the current profile is',
                        ru: 'Краткая рекомендация по применению сейчас выглядит так',
                        cn: '当前资料给出的快速用法是',
                    }, resolvedLang)} ${usageHighlights.join(', ')}.`
                    : localizedUsage,
            });
        }
        if (localizedPrecautions) {
            productFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Có lưu ý gì trước khi dùng không?',
                    en: 'Are there precautions before use?',
                    ru: 'Есть ли меры предосторожности?',
                    cn: '使用前有什么需要注意？',
                }, resolvedLang),
                answer: localizedPrecautions,
            });
        }
        if (localizedTexture || localizedOrigin) {
            const textureOriginAnswer = [localizedTexture, localizedOrigin].filter(Boolean).join(' • ');
            if (textureOriginAnswer) {
                productFaqItems.push({
                    question: getLocalizedLabel({
                        vi: 'Kết cấu và xuất xứ của sản phẩm ra sao?',
                        en: 'What are the texture and origin details?',
                        ru: 'Какая у продукта текстура и происхождение?',
                        cn: '产品的质地和产地是什么？',
                    }, resolvedLang),
                    answer: textureOriginAnswer,
                });
            }
        }
    }
    const faqJsonLd = buildFaqJsonLd(productFaqItems, { url: canonicalUrl, lang: resolvedLang });
    const productSchemaId = `${canonicalUrl}#product`;
    const jsonLd = {
        '@context': 'https://schema.org/',
        '@id': productSchemaId,
        '@type': 'Product',
        name: localizedName,
        description: metaDescription || localizedDescription,
        image: allImageUrls.length > 0 ? allImageUrls : imageUrl,
        url: canonicalUrl,
        inLanguage: HREFLANG_BY_LANG[resolvedLang] || HREFLANG_BY_LANG.vi,
        category: categoryName,
        keywords: buildKeywordString([
            product.brand,
            categoryName,
            localizedBenefits,
            localizedSkinTypes,
            ingredientHighlights,
        ]),
        mainEntityOfPage: canonicalUrl,
        itemCondition: 'https://schema.org/NewCondition',
        brand: product.brand ? {
            '@type': 'Brand',
            name: product.brand,
            ...(brandLandingUrl ? { url: brandLandingUrl } : {}),
        } : undefined,
        sku: product.sku || undefined,
        ...(localizedOrigin ? {
            countryOfOrigin: {
                '@type': 'Country',
                name: localizedOrigin,
            },
        } : {}),
        ...((localizedTexture || localizedSkinTypes.length > 0 || ingredientHighlights.length > 0) ? {
            additionalProperty: [
                localizedTexture ? {
                    '@type': 'PropertyValue',
                    name: getLocalizedLabel({ vi: 'Kết cấu', en: 'Texture', ru: 'Текстура', cn: '质地' }, resolvedLang),
                    value: localizedTexture,
                } : null,
                localizedSkinTypes.length > 0 ? {
                    '@type': 'PropertyValue',
                    name: getLocalizedLabel({ vi: 'Phù hợp với', en: 'Best suited for', ru: 'Подходит для', cn: '更适合' }, resolvedLang),
                    value: localizedSkinTypes.join(', '),
                } : null,
                ingredientHighlights.length > 0 ? {
                    '@type': 'PropertyValue',
                    name: getLocalizedLabel({ vi: 'Điểm nổi bật', en: 'Highlights', ru: 'Акценты', cn: '重点亮点' }, resolvedLang),
                    value: ingredientHighlights.join(', '),
                } : null,
            ].filter(Boolean),
        } : {}),
        offers: {
            '@type': 'Offer',
            price: product.price || 0,
            priceCurrency: 'VND',
            availability: product.stock_quantity > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', '@id': ORGANIZATION_SCHEMA_ID, name: SITE_NAME, url: BASE_URL },
            url: canonicalUrl,
            ...(Number.isFinite(Number(product.stock_quantity)) ? {
                inventoryLevel: {
                    '@type': 'QuantitativeValue',
                    value: Math.max(Number(product.stock_quantity || 0), 0),
                },
            } : {}),
        },
    };
    if (reviewSchemaData.aggregate) {
        jsonLd.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: reviewSchemaData.aggregate.ratingValue,
            reviewCount: reviewSchemaData.aggregate.reviewCount,
            bestRating: '5',
            worstRating: '1',
        };
    }
    if (reviewSchemaData.reviews.length > 0) {
        jsonLd.review = reviewSchemaData.reviews;
    }

    const sections = [];
    if (matchedBrand && brandLandingUrl) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Thương hiệu', en: 'Brand', ru: 'Бренд', cn: '品牌' }, resolvedLang),
            html: `<p>${escapeHtml(truncateText(matchedBrand.description || `${matchedBrand.name} hiện đang có mặt trên ${SITE_NAME}.`, 260))}</p><p><a href="${escapeAttr(brandLandingUrl)}">${escapeHtml(getLocalizedLabel({ vi: `Xem hồ sơ thương hiệu ${matchedBrand.name}`, en: `Open ${matchedBrand.name} brand page`, ru: `Открыть страницу бренда ${matchedBrand.name}`, cn: `查看 ${matchedBrand.name} 品牌页` }, resolvedLang))}</a></p>`,
        });
    }
    if (localizedBenefits.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Lợi ích nổi bật', en: 'Key benefits', ru: 'Ключевые преимущества', cn: '核心功效' }, resolvedLang),
            html: renderTextList(localizedBenefits),
        });
    }
    if (localizedIngredients) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Thành phần', en: 'Ingredients', ru: 'Состав', cn: '成分' }, resolvedLang),
            html: renderMarkdownishHtml(localizedIngredients, { maxBlocks: 6 }),
        });
    }
    if (localizedUsage) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Hướng dẫn sử dụng', en: 'How to use', ru: 'Способ применения', cn: '使用方法' }, resolvedLang),
            html: renderMarkdownishHtml(localizedUsage, { maxBlocks: 8 }),
        });
    }
    if (localizedPrecautions) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Lưu ý an toàn', en: 'Precautions', ru: 'Меры предосторожности', cn: '注意事项' }, resolvedLang),
            html: renderMarkdownishHtml(localizedPrecautions, { maxBlocks: 6 }),
        });
    }
    if (productFaqItems.length > 0) {
        sections.push({
            title: getLocalizedLabel({
                vi: 'FAQ trước khi mua',
                en: 'Pre-purchase FAQ',
                ru: 'FAQ перед покупкой',
                cn: '购买前问答',
            }, resolvedLang),
            html: renderFaqItemsHtml(productFaqItems),
        });
    }
    if (longDescriptionHtml) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Mô tả chi tiết', en: 'Detailed overview', ru: 'Подробное описание', cn: '详细介绍' }, resolvedLang),
            html: longDescriptionHtml,
        });
    }

    const reviewSection = buildReviewSection(reviewSchemaData, resolvedLang);
    if (reviewSection) sections.push(reviewSection);

    const relatedProducts = rankRecordsByTokenOverlap(
        (productCandidates || []).filter((candidate) => candidate.id !== product.id),
        {
            lang: resolvedLang,
            limit: 4,
            sourceParts: internalLinkSourceParts,
            getItemParts: (candidate) => [
                getLocalizedField(candidate, 'name', resolvedLang),
                getStrictLocalizedField(candidate, 'description', resolvedLang),
                candidate.brand || '',
            ],
            getExtraScore: (candidate) => {
                let score = 0;
                if (candidate.category_id === product.category_id) score += 5;
                if (product.brand && candidate.brand && normalizeBrandMatchKey(candidate.brand) === normalizeBrandMatchKey(product.brand)) score += 3;
                return score;
            },
            requiredFields: ['name', 'description'],
            tieBreaker: (a, b) => Number(b.id || 0) - Number(a.id || 0),
        },
    );
    const relatedLinks = relatedProducts.map((candidate) => ({
        href: buildAbsoluteUrl(getProductPathByCategorySlug((Array.isArray(candidate.category) ? candidate.category[0]?.slug : candidate.category?.slug) || 'khac', candidate.slug || candidate.id), resolvedLang),
        label: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
        description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
        image: getListingImageUrl(getPrimaryProductImageUrl(candidate.images || [])),
        imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
    }));
    if (relatedLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Sản phẩm liên quan', en: 'Related products', ru: 'Похожие товары', cn: '相关产品' }, resolvedLang),
            links: relatedLinks,
        });
    }

    const relatedBlogLinks = rankRecordsByTokenOverlap(blogCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'title', resolvedLang),
            getStrictLocalizedField(candidate, 'summary', resolvedLang),
            candidate.category_slug || '',
        ],
        requiredFields: ['title', 'summary'],
        tieBreaker: (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getBlogPathByCategorySlug(candidate.category_slug, candidate.slug), resolvedLang),
        label: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
        description: truncateText((resolvedLang === 'vi' ? candidate.meta_description : '') || getStrictLocalizedField(candidate, 'summary', resolvedLang) || ''),
        image: getResolvedBlogImageUrl(candidate),
        imageAlt: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
    }));
    if (relatedBlogLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Bài viết liên quan', en: 'Related articles', ru: 'Похожие статьи', cn: '相关文章' }, resolvedLang),
            links: relatedBlogLinks,
        });
    }

    const relatedServiceLinks = rankRecordsByTokenOverlap(serviceCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'name', resolvedLang),
            getStrictLocalizedField(candidate, 'description', resolvedLang),
            getStrictLocalizedArray(candidate, 'benefits', resolvedLang),
        ],
        requiredFields: ['name', 'description'],
        tieBreaker: (a, b) => Number(a.id || 0) - Number(b.id || 0),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getServicePath(candidate), resolvedLang),
        label: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
        description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
        image: candidate.image_path ? getStorageUrl(candidate.image_path, 'site-assets') : null,
        imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
    }));
    if (relatedServiceLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Dịch vụ liên quan', en: 'Related services', ru: 'Похожие услуги', cn: '相关服务' }, resolvedLang),
            links: relatedServiceLinks,
        });
    }

    const facts = [
        { label: getLocalizedLabel({ vi: 'Danh mục', en: 'Category', ru: 'Категория', cn: '分类' }, resolvedLang), value: categoryName },
        product.brand ? { label: getLocalizedLabel({ vi: 'Thương hiệu', en: 'Brand', ru: 'Бренд', cn: '品牌' }, resolvedLang), value: product.brand } : null,
        localizedOrigin ? { label: getLocalizedLabel({ vi: 'Xuất xứ', en: 'Origin', ru: 'Происхождение', cn: '产地' }, resolvedLang), value: localizedOrigin } : null,
        localizedTexture ? { label: getLocalizedLabel({ vi: 'Kết cấu', en: 'Texture', ru: 'Текстура', cn: '质地' }, resolvedLang), value: localizedTexture } : null,
        priceText ? { label: getLocalizedLabel({ vi: 'Giá bán', en: 'Price', ru: 'Цена', cn: '价格' }, resolvedLang), value: priceText } : null,
        product.sku ? { label: 'SKU', value: product.sku } : null,
        { label: getLocalizedLabel({ vi: 'Tình trạng', en: 'Availability', ru: 'Наличие', cn: '库存状态' }, resolvedLang), value: buildStockLabel(product.stock_quantity, resolvedLang) },
    ].filter(Boolean);

    return generateDetailPrerenderHtml({
        lang: resolvedLang,
        path: detailPath,
        title: buildSeoTitle(localizedName, { context: categoryName }),
        description: metaDescription || localizedDescription || `${localizedName} | ${SITE_NAME}`,
        heading: localizedName,
        intro: localizedDescription,
        image: imageUrl,
        imageAlt: localizedName,
        canonicalUrl,
        type: 'product',
        noindex: hasUnsupportedRequestedLocale,
        price: product.price || undefined,
        currency: 'VND',
        availability: product.stock_quantity > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        jsonLd: faqJsonLd ? [jsonLd, faqJsonLd] : jsonLd,
        breadcrumbItems: [
            { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, resolvedLang), item: buildAbsoluteUrl('/', resolvedLang) },
            { name: getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, resolvedLang), item: buildAbsoluteUrl('/san-pham', resolvedLang) },
            { name: categoryName, item: buildAbsoluteUrl(`/san-pham/${categorySlug}`, resolvedLang) },
            { name: localizedName, item: canonicalUrl },
        ],
        facts,
        sections,
        alternateLangs: availableLangs,
    });
}

export async function handleBlogPost(slug, lang = 'vi', deps) {
    const {
        getBlogPostBySlug,
        getAvailableLangsRequiringAll,
        resolveSupportedLang,
        normalizeSeoLang,
        getBlogCategoryBySlug,
        getBlogList,
        getProductList,
        getServiceList,
        getLocalizedField,
        getResolvedBlogImageUrl,
        DEFAULT_SHARE_IMAGE,
        buildAbsoluteUrl,
        getLocalizedLabel,
        buildBlogSeoDescription,
        stripHtml,
        getStrictLocalizedField,
        buildKeywordTerms,
        renderMarkdownishHtml,
        escapeHtml,
        rankRecordsByTokenOverlap,
        truncateText,
        getStorageUrl,
        getServicePath,
        getStrictLocalizedArray,
        getProductPathByCategorySlug,
        getPrimaryProductImageUrl,
        getListingImageUrl = (url) => url,
        getBlogPathByCategorySlug,
        HREFLANG_BY_LANG,
        buildArticleBodyExcerpt,
        dedupeTextParts,
        extractMarkdownishHeadings,
        ORGANIZATION_SCHEMA_ID,
        SITE_NAME,
        BASE_URL,
        buildKeywordString,
        generateDetailPrerenderHtml,
        buildSeoTitle,
    } = deps;

    const post = await getBlogPostBySlug(slug);
    if (!post) return null;

    const availableLangs = getAvailableLangsRequiringAll(post, ['title', 'summary', 'content']);
    const resolvedLang = resolveSupportedLang(lang, availableLangs);
    const hasUnsupportedRequestedLocale = normalizeSeoLang(lang) !== resolvedLang;

    const [category, relatedPosts, productCandidates, serviceCandidates] = await Promise.all([
        getBlogCategoryBySlug(post.category_slug),
        getBlogList(24, null, { lang: resolvedLang, translationRequired: true }),
        getProductList(36, null, { lang: resolvedLang, translationRequired: true }),
        getServiceList(24),
    ]);
    const localizedTitle = getLocalizedField(post, 'title', resolvedLang) || post.title;
    const localizedSummary = getLocalizedField(post, 'summary', resolvedLang) || post.summary || '';
    const imageUrl = getResolvedBlogImageUrl(post) || DEFAULT_SHARE_IMAGE;
    const detailPath = `/kien-thuc/${post.category_slug || 'tong-hop'}/${post.slug}`;
    const canonicalUrl = post.canonical_url || buildAbsoluteUrl(detailPath, resolvedLang);
    const isExternalCanonical = post.canonical_url && !post.canonical_url.startsWith(BASE_URL);
    const categoryName = getLocalizedField(category, 'name', resolvedLang) || getLocalizedLabel({
        vi: 'Kiến thức',
        en: 'Knowledge',
        ru: 'Блог',
        cn: '知识',
    }, resolvedLang);
    const localizedContent = resolvedLang === 'vi'
        ? post.content
        : getStrictLocalizedField(post, 'content', resolvedLang);
    const metaDescription = buildBlogSeoDescription({
        metaDescription: resolvedLang === 'vi' ? post.meta_description : '',
        summary: localizedSummary,
        content: localizedContent,
        categoryName,
    });
    const internalLinkSourceParts = [
        localizedTitle,
        localizedSummary,
        stripHtml(localizedContent || '').slice(0, 1800),
        categoryName,
    ];
    const articleKeywords = buildKeywordTerms({
        metaKeywords: resolvedLang === 'vi' ? post.meta_keywords : '',
        title: localizedTitle,
        categoryName,
        summary: localizedSummary,
        content: localizedContent,
    });
    const localSeoTags = resolvedLang === 'vi' ? normalizeLocalSeoTags(post.local_seo_tags) : [];
    const combinedArticleKeywords = dedupeTextParts([...localSeoTags, ...articleKeywords]);
    const articleHtml = renderMarkdownishHtml(localizedContent, { maxBlocks: 32 });
    const sections = [];
    if (articleHtml) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Nội dung chính', en: 'Main content', ru: 'Основной материал', cn: '正文内容' }, resolvedLang),
            html: articleHtml,
        });
    }
    if (localSeoTags.length > 0) {
        sections.push({
            title: 'Từ khóa liên quan tại Phú Quốc',
            html: renderLocalSeoTagsHtml(localSeoTags, escapeHtml),
        });
    }

    const relatedLinks = rankRecordsByTokenOverlap(
        (relatedPosts || []).filter((candidate) => candidate.slug !== post.slug),
        {
            lang: resolvedLang,
            limit: 4,
            sourceParts: internalLinkSourceParts,
            getItemParts: (candidate) => [
                getLocalizedField(candidate, 'title', resolvedLang),
                getStrictLocalizedField(candidate, 'summary', resolvedLang),
                candidate.category_slug || '',
            ],
            getExtraScore: (candidate) => candidate.category_slug === post.category_slug ? 4 : 0,
            requiredFields: ['title', 'summary'],
            tieBreaker: (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
        },
    ).map((candidate) => ({
        href: buildAbsoluteUrl(getBlogPathByCategorySlug(candidate.category_slug, candidate.slug), resolvedLang),
        label: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
        description: truncateText((resolvedLang === 'vi' ? candidate.meta_description : '') || getStrictLocalizedField(candidate, 'summary', resolvedLang) || ''),
        image: getResolvedBlogImageUrl(candidate),
        imageAlt: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
    }));
    if (relatedLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Bài viết liên quan', en: 'Related articles', ru: 'Похожие статьи', cn: '相关文章' }, resolvedLang),
            links: relatedLinks,
        });
    }

    const relatedServiceLinks = rankRecordsByTokenOverlap(serviceCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'name', resolvedLang),
            getStrictLocalizedField(candidate, 'description', resolvedLang),
            getStrictLocalizedArray(candidate, 'benefits', resolvedLang),
        ],
        requiredFields: ['name', 'description'],
        tieBreaker: (a, b) => Number(a.id || 0) - Number(b.id || 0),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getServicePath(candidate), resolvedLang),
        label: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
        description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
        image: candidate.image_path ? getStorageUrl(candidate.image_path, 'site-assets') : null,
        imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
    }));
    if (relatedServiceLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Dịch vụ phù hợp', en: 'Relevant services', ru: 'Подходящие услуги', cn: '匹配服务' }, resolvedLang),
            links: relatedServiceLinks,
        });
    }

    const relatedProductLinks = rankRecordsByTokenOverlap(productCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'name', resolvedLang),
            getStrictLocalizedField(candidate, 'description', resolvedLang),
            candidate.brand || '',
        ],
        requiredFields: ['name', 'description'],
        tieBreaker: (a, b) => Number(b.id || 0) - Number(a.id || 0),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getProductPathByCategorySlug((Array.isArray(candidate.category) ? candidate.category[0]?.slug : candidate.category?.slug) || 'khac', candidate.slug || candidate.id), resolvedLang),
        label: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
        description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
        image: getListingImageUrl(getPrimaryProductImageUrl(candidate.images || [])),
        imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
    }));
    if (relatedProductLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Sản phẩm nên tham khảo', en: 'Recommended products', ru: 'Рекомендуемые товары', cn: '推荐产品' }, resolvedLang),
            links: relatedProductLinks,
        });
    }

    const blogIndexUrl = buildAbsoluteUrl('/kien-thuc', resolvedLang);
    const articleSchemaId = `${canonicalUrl}#article`;
    const webPageId = `${canonicalUrl}#webpage`;
    const aboutTopics = dedupeTextParts([categoryName, ...combinedArticleKeywords, ...extractMarkdownishHeadings(localizedContent, 4)])
        .slice(0, 8)
        .map((name) => ({
            '@type': 'Thing',
            name,
        }));
    const mentionEntities = [
        ...relatedProductLinks.slice(0, 2).map((item) => ({
            '@type': 'Thing',
            name: item.label,
            url: item.href,
        })),
        ...relatedServiceLinks.slice(0, 2).map((item) => ({
            '@type': 'Thing',
            name: item.label,
            url: item.href,
        })),
        ...relatedLinks.slice(0, 2).map((item) => ({
            '@type': 'Thing',
            name: item.label,
            url: item.href,
        })),
    ];
    const jsonLd = {
        '@context': 'https://schema.org',
        '@id': articleSchemaId,
        '@type': 'BlogPosting',
        headline: localizedTitle,
        alternativeHeadline: localizedSummary || undefined,
        description: metaDescription || localizedSummary || '',
        image: [imageUrl],
        thumbnailUrl: imageUrl,
        url: canonicalUrl,
        inLanguage: HREFLANG_BY_LANG[resolvedLang] || HREFLANG_BY_LANG.vi,
        datePublished: post.date,
        dateModified: post.date,
        mainEntityOfPage: { '@id': webPageId },
        isPartOf: {
            '@type': 'Blog',
            '@id': `${blogIndexUrl}#blog`,
            name: getLocalizedLabel({ vi: 'Kiến thức da liễu', en: 'Dermatology knowledge', ru: 'Дерматологические статьи', cn: '皮肤知识' }, resolvedLang),
            url: blogIndexUrl,
            publisher: { '@id': ORGANIZATION_SCHEMA_ID },
        },
        articleSection: categoryName,
        keywords: buildKeywordString(combinedArticleKeywords, 16),
        wordCount: stripHtml(localizedContent || '').split(/\s+/).filter(Boolean).length || undefined,
        articleBody: buildArticleBodyExcerpt(localizedContent) || undefined,
        author: post.author_name ? {
            '@type': 'Person',
            name: post.author_name,
            url: `${BASE_URL}/ve-chung-toi`,
        } : {
            '@type': 'Organization',
            name: SITE_NAME,
        },
        publisher: {
            '@type': 'Organization',
            '@id': ORGANIZATION_SCHEMA_ID,
            name: SITE_NAME,
            url: BASE_URL,
            logo: {
                '@type': 'ImageObject',
                url: deps.DEFAULT_LOGO_IMAGE,
            },
        },
        about: aboutTopics.length > 0 ? aboutTopics : undefined,
        mentions: mentionEntities.length > 0 ? mentionEntities : undefined,
    };

    return generateDetailPrerenderHtml({
        lang: resolvedLang,
        path: detailPath,
        title: buildSeoTitle(localizedTitle, { context: categoryName }),
        description: metaDescription || `${localizedTitle} | ${SITE_NAME}`,
        heading: localizedTitle,
        intro: localizedSummary,
        image: imageUrl,
        imageAlt: localizedTitle,
        canonicalUrl,
        type: 'article',
        noindex: Boolean(isExternalCanonical) || hasUnsupportedRequestedLocale,
        keywords: buildKeywordString(combinedArticleKeywords, 16),
        author: post.author_name || SITE_NAME,
        publishedTime: post.date,
        modifiedTime: post.date,
        section: categoryName,
        tags: combinedArticleKeywords,
        jsonLd,
        breadcrumbItems: [
            { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, resolvedLang), item: buildAbsoluteUrl('/', resolvedLang) },
            { name: getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, resolvedLang), item: buildAbsoluteUrl('/kien-thuc', resolvedLang) },
            { name: categoryName, item: buildAbsoluteUrl(`/kien-thuc/${post.category_slug || 'tong-hop'}`, resolvedLang) },
            { name: localizedTitle, item: post.canonical_url || buildAbsoluteUrl(detailPath, resolvedLang) },
        ],
        facts: [
            { label: getLocalizedLabel({ vi: 'Chuyên mục', en: 'Category', ru: 'Раздел', cn: '分类' }, resolvedLang), value: categoryName },
            post.author_name ? { label: getLocalizedLabel({ vi: 'Tác giả', en: 'Author', ru: 'Автор', cn: '作者' }, resolvedLang), value: post.author_name } : null,
            post.date ? { label: getLocalizedLabel({ vi: 'Ngày đăng', en: 'Published', ru: 'Дата публикации', cn: '发布时间' }, resolvedLang), value: post.date } : null,
        ].filter(Boolean),
        sections,
        alternateLangs: availableLangs,
    });
}

export async function handleService(idOrSlug, lang = 'vi', deps) {
    const {
        getServiceByIdOrSlug,
        getAvailableLangsRequiringAll,
        resolveSupportedLang,
        normalizeSeoLang,
        getServiceList,
        getBlogList,
        getProductList,
        getStorageUrl,
        DEFAULT_SHARE_IMAGE,
        buildAbsoluteUrl,
        getLocalizedField,
        getStrictLocalizedField,
        getStrictLocalizedArray,
        getLocalizedLabel,
        splitHighlights,
        buildMetaDescription,
        normalizeDetailFaqItems,
        formatCurrencyVnd,
        buildFaqJsonLd,
        buildKeywordString,
        HREFLANG_BY_LANG,
        ORGANIZATION_SCHEMA_ID,
        SITE_NAME,
        BASE_URL,
        renderTextList,
        renderMarkdownishHtml,
        renderFaqItemsHtml,
        escapeAttr,
        escapeHtml,
        rankRecordsByTokenOverlap,
        filterRecordsByRequiredLocale,
        truncateText,
        getBlogPathByCategorySlug,
        getResolvedBlogImageUrl,
        getProductPathByCategorySlug,
        getPrimaryProductImageUrl,
        getListingImageUrl = (url) => url,
        getServicePath,
        generateDetailPrerenderHtml,
        buildSeoTitle,
    } = deps;

    const service = await getServiceByIdOrSlug(idOrSlug);
    if (!service) return null;
    const availableLangs = getAvailableLangsRequiringAll(service, ['name', 'description']);
    const resolvedLang = resolveSupportedLang(lang, availableLangs);
    const hasUnsupportedRequestedLocale = normalizeSeoLang(lang) !== resolvedLang;
    const [serviceCandidates, blogCandidates, productCandidates] = await Promise.all([
        getServiceList(24),
        getBlogList(24, null, { lang: resolvedLang, translationRequired: true }),
        getProductList(36, null, { lang: resolvedLang, translationRequired: true }),
    ]);
    const imageUrl = service.image_path ? getStorageUrl(service.image_path, 'site-assets') : DEFAULT_SHARE_IMAGE;
    const detailPath = `/dich-vu/${service.slug || service.id}`;
    const canonicalUrl = buildAbsoluteUrl(detailPath, resolvedLang);
    const localizedName = getLocalizedField(service, 'name', resolvedLang) || service.name;
    const localizedDescription = getLocalizedField(service, 'description', resolvedLang) || service.description || '';
    const localizedLongDescription = getStrictLocalizedField(service, 'long_description', resolvedLang);
    const localizedBenefits = getStrictLocalizedArray(service, 'benefits', resolvedLang);
    const localSeoTags = resolvedLang === 'vi' ? normalizeLocalSeoTags(service.local_seo_tags) : [];
    const procedureHighlights = (service.procedure_steps || [])
        .map((step) => getLocalizedField(step, 'title', resolvedLang) || step.title)
        .filter(Boolean)
        .slice(0, 4);
    const longDescriptionHighlights = splitHighlights(localizedLongDescription, 4);
    const metaDescription = buildMetaDescription([localizedDescription, localizedBenefits[0]]);
    const internalLinkSourceParts = [
        localizedName,
        localizedDescription,
        localizedBenefits,
        localizedLongDescription,
    ];
    const serviceFaqItems = resolvedLang === 'vi'
        ? normalizeDetailFaqItems(service.faq_items)
        : [];
    if (serviceFaqItems.length === 0) {
        if (localizedDescription || localizedBenefits.length > 0) {
            serviceFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Dịch vụ này giải quyết nhóm vấn đề nào?',
                    en: 'What concern is this service designed to address?',
                    ru: 'Какую проблему решает эта услуга?',
                    cn: '这项服务主要针对什么问题？',
                }, resolvedLang),
                answer: localizedBenefits.length > 0
                    ? `${getLocalizedLabel({
                        vi: 'Hiện hồ sơ dịch vụ đang tập trung vào',
                        en: 'The current service profile focuses on',
                        ru: 'Текущий профиль услуги сфокусирован на',
                        cn: '当前服务资料主要聚焦于',
                    }, resolvedLang)} ${localizedBenefits.slice(0, 3).join(', ')}.`
                    : localizedDescription,
            });
        }
        if (localizedBenefits.length > 0) {
            serviceFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Lợi ích điều trị nào đang được nhấn mạnh?',
                    en: 'What treatment benefits are emphasized?',
                    ru: 'Какие преимущества процедуры выделены?',
                    cn: '当前强调的治疗优势有哪些？',
                }, resolvedLang),
                answer: `${getLocalizedLabel({
                    vi: 'Những lợi ích điều trị được nhấn mạnh gồm',
                    en: 'The main treatment benefits currently highlighted are',
                    ru: 'Основные преимущества, выделенные на странице, это',
                    cn: '目前重点强调的治疗优势包括',
                }, resolvedLang)} ${localizedBenefits.slice(0, 4).join(', ')}.`,
            });
        }
        if (procedureHighlights.length > 0 || longDescriptionHighlights.length > 0 || localizedLongDescription) {
            serviceFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Quy trình điều trị thường diễn ra như thế nào?',
                    en: 'How does the procedure usually unfold?',
                    ru: 'Как обычно проходит процедура?',
                    cn: '治疗流程通常如何进行？',
                }, resolvedLang),
                answer: procedureHighlights.length > 0
                    ? `${getLocalizedLabel({
                        vi: 'Quy trình hiện tại thường đi qua các bước',
                        en: 'The current procedure flow usually moves through',
                        ru: 'Обычно процедура проходит через этапы',
                        cn: '当前流程通常会经过以下环节',
                    }, resolvedLang)} ${procedureHighlights.join(', ')}.`
                    : longDescriptionHighlights.length > 0
                        ? `${longDescriptionHighlights.join('. ')}.`
                        : localizedLongDescription,
            });
        }
        if (service.price) {
            serviceFaqItems.push({
                question: getLocalizedLabel({
                    vi: 'Chi phí tham khảo hiện là bao nhiêu?',
                    en: 'What is the indicative price?',
                    ru: 'Какова ориентировочная стоимость?',
                    cn: '参考价格是多少？',
                }, resolvedLang),
                answer: formatCurrencyVnd(service.price),
            });
        }
    }
    const faqJsonLd = buildFaqJsonLd(serviceFaqItems, { url: canonicalUrl, lang: resolvedLang });
    const serviceSchemaId = `${canonicalUrl}#service`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@id': serviceSchemaId,
        '@type': 'MedicalProcedure',
        name: localizedName,
        description: metaDescription || localizedDescription,
        image: imageUrl,
        url: canonicalUrl,
        inLanguage: HREFLANG_BY_LANG[resolvedLang] || HREFLANG_BY_LANG.vi,
        category: getLocalizedLabel({ vi: 'Dịch vụ điều trị', en: 'Treatment service', ru: 'Лечебная услуга', cn: '治疗服务' }, resolvedLang),
        bodyLocation: getLocalizedLabel({ vi: 'Da', en: 'Skin', ru: 'Кожа', cn: '皮肤' }, resolvedLang),
        procedureType: localizedBenefits[0] || localizedName,
        howPerformed: procedureHighlights.length > 0
            ? procedureHighlights.join(' • ')
            : longDescriptionHighlights.join(' • ') || localizedLongDescription || localizedDescription,
        mainEntityOfPage: canonicalUrl,
        provider: {
            '@type': 'MedicalClinic',
            '@id': ORGANIZATION_SCHEMA_ID,
            name: SITE_NAME,
            url: BASE_URL,
            medicalSpecialty: getLocalizedLabel({ vi: 'Da liễu', en: 'Dermatology', ru: 'Дерматология', cn: '皮肤科' }, resolvedLang),
        },
        serviceType: getLocalizedLabel({ vi: 'Dịch vụ điều trị da', en: 'Dermatology treatment service', ru: 'Дерматологическая услуга', cn: '皮肤治疗服务' }, resolvedLang),
        keywords: buildKeywordString(localSeoTags, 5) || undefined,
        areaServed: { '@type': 'Country', name: 'Vietnam' },
        ...(localizedBenefits.length > 0 ? {
            additionalProperty: [
                {
                    '@type': 'PropertyValue',
                    name: getLocalizedLabel({ vi: 'Điểm lợi ích', en: 'Benefit points', ru: 'Преимущества', cn: '核心优势' }, resolvedLang),
                    value: localizedBenefits.join(', '),
                },
                {
                    '@type': 'PropertyValue',
                    name: getLocalizedLabel({ vi: 'Số bước điều trị', en: 'Procedure steps', ru: 'Этапы процедуры', cn: '流程步骤' }, resolvedLang),
                    value: String((service.procedure_steps || []).length || 0),
                },
            ],
        } : {}),
        ...(service.price ? {
            offers: {
                '@type': 'Offer',
                price: service.price,
                priceCurrency: 'VND',
                availability: 'https://schema.org/InStock',
                url: canonicalUrl,
            },
        } : {}),
    };

    const sections = [];
    if (localizedBenefits.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Lợi ích điều trị', en: 'Treatment benefits', ru: 'Преимущества процедуры', cn: '治疗优势' }, resolvedLang),
            html: renderTextList(localizedBenefits),
        });
    }
    if (localizedLongDescription) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Mô tả chi tiết', en: 'Detailed overview', ru: 'Подробное описание', cn: '详细介绍' }, resolvedLang),
            html: renderMarkdownishHtml(localizedLongDescription, { maxBlocks: 18 }),
        });
    }
    if (localSeoTags.length > 0) {
        sections.push({
            title: 'Từ khóa liên quan tại Phú Quốc',
            html: renderLocalSeoTagsHtml(localSeoTags, escapeHtml),
        });
    }
    if (serviceFaqItems.length > 0) {
        sections.push({
            title: getLocalizedLabel({
                vi: 'FAQ trước khi đặt lịch',
                en: 'Pre-booking FAQ',
                ru: 'FAQ перед записью',
                cn: '预约前问答',
            }, resolvedLang),
            html: renderFaqItemsHtml(serviceFaqItems),
        });
    }
    if (Array.isArray(service.procedure_steps) && service.procedure_steps.length > 0) {
        const stepsHtml = service.procedure_steps
            .map((step) => {
                const title = getLocalizedField(step, 'title', resolvedLang) || step.title;
                const description = getStrictLocalizedField(step, 'description', resolvedLang);
                const stepImage = step.image_path ? getStorageUrl(step.image_path, 'site-assets') : null;
                return description
                    ? `<article>${stepImage ? `<img src="${escapeAttr(stepImage)}" alt="${escapeAttr(title)}" loading="lazy" decoding="async">` : ''}<h3>${escapeHtml(`${step.step_number || ''}. ${title}`.trim())}</h3>${renderMarkdownishHtml(description, { maxBlocks: 4 })}</article>`
                    : '';
            })
            .filter(Boolean)
            .join('');
        if (stepsHtml) {
            sections.push({
                title: getLocalizedLabel({ vi: 'Quy trình điều trị', en: 'Procedure steps', ru: 'Этапы процедуры', cn: '治疗流程' }, resolvedLang),
                html: stepsHtml,
            });
        }
    }
    const relatedServices = rankRecordsByTokenOverlap(
        (serviceCandidates || []).filter((candidate) => candidate.id !== service.id),
        {
            lang: resolvedLang,
            limit: 4,
            sourceParts: internalLinkSourceParts,
            getItemParts: (candidate) => [
                getLocalizedField(candidate, 'name', resolvedLang),
                getStrictLocalizedField(candidate, 'description', resolvedLang),
                getStrictLocalizedArray(candidate, 'benefits', resolvedLang),
            ],
            requiredFields: ['name', 'description'],
            tieBreaker: (a, b) => Number(a.id || 0) - Number(b.id || 0),
        },
    );
    if (relatedServices.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Dịch vụ liên quan', en: 'Related services', ru: 'Похожие услуги', cn: '相关服务' }, resolvedLang),
            links: filterRecordsByRequiredLocale(relatedServices, resolvedLang, ['name', 'description']).map((candidate) => ({
                href: buildAbsoluteUrl(getServicePath(candidate), resolvedLang),
                label: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
                description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
                image: candidate.image_path ? getStorageUrl(candidate.image_path, 'site-assets') : null,
                imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || `Dịch vụ ${candidate.id}`,
            })),
        });
    }

    const relatedBlogLinks = rankRecordsByTokenOverlap(blogCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'title', resolvedLang),
            getStrictLocalizedField(candidate, 'summary', resolvedLang),
            candidate.category_slug || '',
        ],
        requiredFields: ['title', 'summary'],
        tieBreaker: (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getBlogPathByCategorySlug(candidate.category_slug, candidate.slug), resolvedLang),
        label: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
        description: truncateText((resolvedLang === 'vi' ? candidate.meta_description : '') || getStrictLocalizedField(candidate, 'summary', resolvedLang) || ''),
        image: getResolvedBlogImageUrl(candidate),
        imageAlt: getLocalizedField(candidate, 'title', resolvedLang) || candidate.slug,
    }));
    if (relatedBlogLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Bài viết nên đọc', en: 'Recommended articles', ru: 'Рекомендуемые статьи', cn: '推荐文章' }, resolvedLang),
            links: relatedBlogLinks,
        });
    }

    const relatedProductLinks = rankRecordsByTokenOverlap(productCandidates || [], {
        lang: resolvedLang,
        limit: 4,
        sourceParts: internalLinkSourceParts,
        getItemParts: (candidate) => [
            getLocalizedField(candidate, 'name', resolvedLang),
            getStrictLocalizedField(candidate, 'description', resolvedLang),
            candidate.brand || '',
        ],
        requiredFields: ['name', 'description'],
        tieBreaker: (a, b) => Number(b.id || 0) - Number(a.id || 0),
    }).map((candidate) => ({
        href: buildAbsoluteUrl(getProductPathByCategorySlug((Array.isArray(candidate.category) ? candidate.category[0]?.slug : candidate.category?.slug) || 'khac', candidate.slug || candidate.id), resolvedLang),
        label: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
        description: truncateText(getStrictLocalizedField(candidate, 'description', resolvedLang) || ''),
        image: getListingImageUrl(getPrimaryProductImageUrl(candidate.images || [])),
        imageAlt: getLocalizedField(candidate, 'name', resolvedLang) || String(candidate.slug || candidate.id),
    }));
    if (relatedProductLinks.length > 0) {
        sections.push({
            title: getLocalizedLabel({ vi: 'Sản phẩm hỗ trợ', en: 'Supportive products', ru: 'Поддерживающие товары', cn: '辅助产品' }, resolvedLang),
            links: relatedProductLinks,
        });
    }

    return generateDetailPrerenderHtml({
        lang: resolvedLang,
        path: detailPath,
        title: buildSeoTitle(localizedName, { context: localizedBenefits[0] || getLocalizedLabel({ vi: 'Dịch vụ điều trị', en: 'Treatment service', ru: 'Лечебная услуга', cn: '治疗服务' }, resolvedLang) }),
        description: metaDescription || localizedDescription || `${localizedName} - ${SITE_NAME}`,
        heading: localizedName,
        intro: localizedDescription,
        image: imageUrl,
        imageAlt: localizedName,
        canonicalUrl,
        type: 'website',
        noindex: hasUnsupportedRequestedLocale,
        keywords: buildKeywordString(localSeoTags, 5),
        tags: localSeoTags,
        jsonLd: faqJsonLd ? [jsonLd, faqJsonLd] : jsonLd,
        breadcrumbItems: [
            { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, resolvedLang), item: buildAbsoluteUrl('/', resolvedLang) },
            { name: getLocalizedLabel({ vi: 'Dịch vụ', en: 'Services', ru: 'Услуги', cn: '服务' }, resolvedLang), item: buildAbsoluteUrl('/dich-vu', resolvedLang) },
            { name: localizedName, item: canonicalUrl },
        ],
        facts: [
            service.price ? { label: getLocalizedLabel({ vi: 'Chi phí tham khảo', en: 'Indicative price', ru: 'Ориентировочная стоимость', cn: '参考价格' }, resolvedLang), value: formatCurrencyVnd(service.price) } : null,
            { label: getLocalizedLabel({ vi: 'Loại trang', en: 'Page type', ru: 'Тип страницы', cn: '页面类型' }, resolvedLang), value: getLocalizedLabel({ vi: 'Dịch vụ điều trị', en: 'Treatment service', ru: 'Медицинская услуга', cn: '治疗服务' }, resolvedLang) },
        ].filter(Boolean),
        sections,
        alternateLangs: availableLangs,
    });
}
