function createSeoNotFoundResponse() {
    return new Response('Not found', {
        status: 404,
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
    });
}

export async function handleBrandsDirectoryPrerender(lang = 'vi', deps) {
    const {
        normalizeSeoLang,
        getProductBrands,
        getProductList,
        getActiveBrandRows,
        buildAbsoluteUrl,
        SITE_NAME,
        generateDetailPrerenderHtml,
        buildSeoTitle,
        getStorageUrl,
    } = deps;

    const requestedLang = normalizeSeoLang(lang);
    const hasUnsupportedRequestedLocale = requestedLang !== 'vi';
    const resolvedLang = 'vi';
    const [brands, products] = await Promise.all([
        getProductBrands(),
        getProductList(450, null, { lang: resolvedLang }),
    ]);

    const activeBrands = getActiveBrandRows(brands, products)
        .sort((a, b) => b.productCount - a.productCount || String(a.name || '').localeCompare(String(b.name || '')));

    const canonicalPath = '/thuong-hieu';
    const canonicalUrl = buildAbsoluteUrl(canonicalPath, resolvedLang);
    const description = `Danh mục thương hiệu tại ${SITE_NAME}, tổng hợp thương hiệu đang có mặt trên website cùng lối vào nhanh tới trang giới thiệu và danh sách sản phẩm của từng brand.`;
    const itemList = activeBrands.map((brand, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildAbsoluteUrl(`/thuong-hieu/${brand.slug}`, resolvedLang),
        name: brand.name,
    }));

    return generateDetailPrerenderHtml({
        lang: resolvedLang,
        path: canonicalPath,
        title: buildSeoTitle('Thương hiệu | Danh mục thương hiệu'),
        description,
        heading: 'Danh mục thương hiệu',
        intro: `Xem toàn bộ thương hiệu đang được ${SITE_NAME} phân phối, đọc mô tả chi tiết của từng brand và đi thẳng vào danh sách sản phẩm đã lọc sẵn.`,
        canonicalUrl,
        type: 'website',
        noindex: hasUnsupportedRequestedLocale,
        breadcrumbItems: [
            { name: 'Trang chủ', item: buildAbsoluteUrl('/', resolvedLang) },
            { name: 'Thương hiệu', item: canonicalUrl },
        ],
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Danh mục thương hiệu',
                description,
                url: canonicalUrl,
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: itemList,
                },
            },
        ],
        facts: [
            { label: 'Tổng thương hiệu', value: String(activeBrands.length) },
            { label: 'Tổng sản phẩm đang hiển thị', value: String(activeBrands.reduce((sum, brand) => sum + brand.productCount, 0)) },
        ],
        sections: [
            {
                title: 'Thương hiệu hiện có',
                description: 'Đi vào từng trang thương hiệu để xem phần giới thiệu chi tiết và nhóm sản phẩm đang bán.',
                links: activeBrands.map((brand) => ({
                    href: buildAbsoluteUrl(`/thuong-hieu/${brand.slug}`, resolvedLang),
                    label: brand.name,
                    description: deps.truncateText(brand.description || `${brand.name} hiện có ${brand.productCount} sản phẩm đang hiển thị tại ${SITE_NAME}.`, 160),
                    meta: `${brand.productCount} sản phẩm`,
                    image: brand.logo_path ? getStorageUrl(brand.logo_path, 'site-assets') : null,
                    imageAlt: brand.name,
                })),
            },
        ],
        alternateLangs: ['vi'],
    });
}

export async function handleHomePrerender(lang = 'vi', deps) {
    const {
        getProductList,
        getBlogList,
        getServiceList,
        getFaqItems,
        getDoctors,
        filterRecordsByRequiredLocale,
        getProductCategories,
        getLocalizedLabel,
        SITE_NAME,
        HREFLANG_BY_LANG,
        ORGANIZATION_SCHEMA_ID,
        WEBSITE_SCHEMA_ID,
        BASE_URL,
        DEFAULT_LOGO_IMAGE,
        DEFAULT_SHARE_IMAGE,
        getLocalizedField,
        buildAbsoluteUrl,
        generatePrerenderListHtml,
        getProductPathByCategorySlug,
        getStrictLocalizedField,
        stripHtml,
        getPrimaryProductImageUrl,
        getBlogPathByCategorySlug,
        getResolvedBlogImageUrl,
        getServicePath,
        getStorageUrl,
        truncateText,
        getListingImageUrl = (url) => url,
    } = deps;

    const [products, posts, services, faqs, doctors] = await Promise.all([
        getProductList(12, null, { lang, translationRequired: true }),
        getBlogList(8, null, { lang, translationRequired: true }),
        getServiceList(8),
        getFaqItems(8),
        getDoctors(6),
    ]);
    const localizedProducts = filterRecordsByRequiredLocale(products, lang, ['name', 'description']);
    const localizedPosts = filterRecordsByRequiredLocale(posts, lang, ['title', 'summary']);
    const localizedServices = filterRecordsByRequiredLocale(services, lang, ['name', 'description']);
    const categories = await getProductCategories();
    const categoryMap = new Map(categories.map((c) => [c.id, c.slug]));
    const labels = {
        title: getLocalizedLabel({
            vi: `${SITE_NAME} | Chăm sóc da chuyên sâu`,
            en: `${SITE_NAME} | Advanced Skin Care`,
            ru: `${SITE_NAME} | Профессиональный уход за кожей`,
            cn: `${SITE_NAME} | 专业皮肤护理`,
        }, lang),
        description: getLocalizedLabel({
            vi: 'Phòng khám da liễu chuyên sâu với dịch vụ trị mụn, sản phẩm chăm sóc da chính hãng, đội ngũ chuyên môn và nội dung tư vấn bài bản.',
            en: 'Advanced dermatology clinic with acne treatment services, trusted skincare pharmacy, and expert skin-care knowledge.',
            ru: 'Профессиональная дерматологическая клиника, лечение акне, аптечные средства и экспертные материалы по уходу за кожей.',
            cn: '专业皮肤诊疗、祛痘服务、正规护肤药房与皮肤护理知识中心。',
        }, lang),
        heading: SITE_NAME,
        intro: getLocalizedLabel({
            vi: 'Thế Giới Trị Mụn kết hợp khám da liễu, dịch vụ điều trị, sản phẩm mỹ phẩm và nội dung chuyên môn để người dùng tìm được giải pháp phù hợp theo từng vấn đề da.',
            en: 'An advanced skin-care platform with curated products, treatment services, and expert content for acne-prone skin.',
            ru: 'Платформа профессионального ухода за кожей: продукты, процедуры и экспертные статьи для кожи с акне.',
            cn: '提供专业护肤产品、治疗服务与知识内容的一体化平台，帮助改善痘痘与问题肌。',
        }, lang),
    };
    const breadcrumbItems = [
        { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, lang), item: buildAbsoluteUrl('/', lang) },
    ];

    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'MedicalClinic',
            '@id': ORGANIZATION_SCHEMA_ID,
            name: SITE_NAME,
            url: BASE_URL,
            logo: DEFAULT_LOGO_IMAGE,
            image: DEFAULT_SHARE_IMAGE,
            medicalSpecialty: 'Dermatology',
            areaServed: {
                '@type': 'Country',
                name: 'Vietnam',
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': WEBSITE_SCHEMA_ID,
            name: SITE_NAME,
            url: BASE_URL,
            inLanguage: HREFLANG_BY_LANG[lang],
            potentialAction: {
                '@type': 'SearchAction',
                target: `${BASE_URL}/san-pham?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
            },
            publisher: {
                '@id': ORGANIZATION_SCHEMA_ID,
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: labels.title,
            url: buildAbsoluteUrl('/', lang),
            description: labels.description,
        },
    ];

    const localizedFaq = faqs
        .map((faq) => ({
            '@type': 'Question',
            name: getLocalizedField(faq, 'question', lang),
            acceptedAnswer: {
                '@type': 'Answer',
                text: getLocalizedField(faq, 'answer', lang),
            },
        }))
        .filter((faq) => faq.name && faq.acceptedAnswer.text);
    if (localizedFaq.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            url: buildAbsoluteUrl('/', lang),
            inLanguage: HREFLANG_BY_LANG[lang],
            mainEntityOfPage: buildAbsoluteUrl('/', lang),
            publisher: {
                '@type': 'Organization',
                name: SITE_NAME,
                url: BASE_URL,
                logo: DEFAULT_LOGO_IMAGE,
            },
            mainEntity: localizedFaq,
        });
    }

    return generatePrerenderListHtml({
        lang,
        title: labels.title,
        description: labels.description,
        path: '/',
        heading: labels.heading,
        intro: labels.intro,
        image: DEFAULT_SHARE_IMAGE,
        imageAlt: labels.heading,
        breadcrumbItems,
        jsonLd,
        sections: [
            {
                title: getLocalizedLabel({ vi: 'Điều hướng chính', en: 'Main navigation', ru: 'Основная навигация', cn: '主要导航' }, lang),
                links: [
                    { href: buildAbsoluteUrl('/san-pham', lang), label: getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, lang) },
                    { href: buildAbsoluteUrl('/dich-vu', lang), label: getLocalizedLabel({ vi: 'Dịch vụ', en: 'Services', ru: 'Услуги', cn: '服务' }, lang) },
                    { href: buildAbsoluteUrl('/kien-thuc', lang), label: getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, lang) },
                    { href: buildAbsoluteUrl('/ve-chung-toi', lang), label: getLocalizedLabel({ vi: 'Về chúng tôi', en: 'About us', ru: 'О нас', cn: '关于我们' }, lang) },
                ],
            },
            {
                title: getLocalizedLabel({ vi: 'Sản phẩm nổi bật', en: 'Featured products', ru: 'Рекомендуемые товары', cn: '精选产品' }, lang),
                links: localizedProducts.map((p) => {
                    const categorySlug = categoryMap.get(p.category_id) || 'khac';
                    return {
                        href: buildAbsoluteUrl(getProductPathByCategorySlug(categorySlug, p.slug || p.id), lang),
                        label: getLocalizedField(p, 'name', lang) || String(p.slug || p.id),
                        description: stripHtml(getStrictLocalizedField(p, 'description', lang) || '').slice(0, 120),
                        image: getListingImageUrl(getPrimaryProductImageUrl(p.images || [])),
                        imageAlt: getLocalizedField(p, 'name', lang) || String(p.slug || p.id),
                    };
                }),
            },
            {
                title: getLocalizedLabel({ vi: 'Bài viết mới', en: 'Latest articles', ru: 'Новые статьи', cn: '最新文章' }, lang),
                links: localizedPosts.map((p) => ({
                    href: buildAbsoluteUrl(getBlogPathByCategorySlug(p.category_slug, p.slug), lang),
                    label: getLocalizedField(p, 'title', lang) || p.slug,
                    description: stripHtml((lang === 'vi' ? p.meta_description : '') || getStrictLocalizedField(p, 'summary', lang) || '').slice(0, 120),
                    image: getResolvedBlogImageUrl(p),
                    imageAlt: getLocalizedField(p, 'title', lang) || p.slug,
                })),
            },
            {
                title: getLocalizedLabel({ vi: 'Dịch vụ liên quan', en: 'Relevant services', ru: 'Сопутствующие услуги', cn: '相关服务' }, lang),
                links: localizedServices.map((s) => ({
                    href: buildAbsoluteUrl(getServicePath(s), lang),
                    label: getLocalizedField(s, 'name', lang) || `Dịch vụ ${s.id}`,
                    description: stripHtml(getStrictLocalizedField(s, 'description', lang) || '').slice(0, 120),
                    image: s.image_path ? getStorageUrl(s.image_path, 'site-assets') : null,
                    imageAlt: getLocalizedField(s, 'name', lang) || `Dịch vụ ${s.id}`,
                })),
            },
            ...(doctors.length > 0 ? [{
                title: getLocalizedLabel({ vi: 'Đội ngũ chuyên môn', en: 'Medical team', ru: 'Команда специалистов', cn: '专业团队' }, lang),
                description: getLocalizedLabel({
                    vi: 'Hồ sơ bác sĩ và đội ngũ tư vấn đang tham gia điều trị, chăm sóc và hướng dẫn khách hàng tại Thế Giới Trị Mụn.',
                    en: 'Meet the medical team supporting consultations, treatments, and patient guidance at Thế Giới Trị Mụn.',
                    ru: 'Познакомьтесь с командой специалистов, которые ведут консультации и лечение в Thế Giới Trị Mụn.',
                    cn: '认识在 Thế Giới Trị Mụn 提供咨询、治疗与皮肤管理支持的专业团队。',
                }, lang),
                links: doctors.map((doctor) => ({
                    href: buildAbsoluteUrl('/ve-chung-toi', lang),
                    label: doctor.name,
                    meta: [getLocalizedField(doctor, 'job_title', lang), getLocalizedField(doctor, 'specialization', lang)].filter(Boolean).join(' • '),
                    description: truncateText(getLocalizedField(doctor, 'homepage_description', lang) || ''),
                    image: doctor.avatar_path ? getStorageUrl(doctor.avatar_path, 'avatars') : null,
                    imageAlt: doctor.name,
                })),
            }] : []),
        ],
    });
}

export async function handleProductsPrerender(categorySlug = null, lang = 'vi', searchQuery = '', deps) {
    const {
        getProductCategories,
        getAvailableLangs,
        SEO_LANGS,
        resolveSupportedLang,
        normalizeSeoLang,
        getProductList,
        stripHtml,
        getLocalizedField,
        getStrictLocalizedField,
        getLocalizedLabel,
        SITE_NAME,
        buildAbsoluteUrl,
        getProductPathByCategorySlug,
        buildSeoTitle,
        DEFAULT_SHARE_IMAGE,
        generatePrerenderListHtml,
        getPrimaryProductImageUrl,
        getListingImageUrl = (url) => url,
    } = deps;

    const categories = await getProductCategories();
    const matchedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
    const categoryAlternateLangs = matchedCategory ? getAvailableLangs(matchedCategory, ['name']) : SEO_LANGS;
    const resolvedLang = matchedCategory ? resolveSupportedLang(lang, categoryAlternateLangs) : lang;
    const hasUnsupportedRequestedLocale = matchedCategory ? normalizeSeoLang(lang) !== resolvedLang : false;
    const allProducts = await getProductList(36, matchedCategory?.id ?? null, { lang: resolvedLang, translationRequired: true });
    const categoryMap = new Map(categories.map((c) => [c.id, c.slug]));
    const normalizedSearchQuery = stripHtml(String(searchQuery || '')).trim().slice(0, 80);
    const products = normalizedSearchQuery
        ? allProducts.filter((product) => {
            const searchableText = [
                getLocalizedField(product, 'name', resolvedLang),
                getStrictLocalizedField(product, 'description', resolvedLang),
                product.brand,
                product.category?.name,
                ...(product.key_benefits || []),
                ...(product.skin_types || []),
            ].join(' ').toLowerCase();
            return searchableText.includes(normalizedSearchQuery.toLowerCase());
        })
        : allProducts;

    const path = categorySlug ? `/san-pham/${categorySlug}` : '/san-pham';
    const categoryName = matchedCategory ? getLocalizedField(matchedCategory, 'name', resolvedLang) || matchedCategory.slug : null;
    const heading = normalizedSearchQuery
        ? getLocalizedLabel({
            vi: `Tìm kiếm sản phẩm: ${normalizedSearchQuery}`,
            en: `Product search: ${normalizedSearchQuery}`,
            ru: `Поиск товаров: ${normalizedSearchQuery}`,
            cn: `产品搜索：${normalizedSearchQuery}`,
        }, resolvedLang)
        : matchedCategory
            ? `${getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, resolvedLang)}: ${categoryName}`
            : getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, resolvedLang);
    const description = normalizedSearchQuery
        ? getLocalizedLabel({
            vi: `Kết quả tìm kiếm sản phẩm theo từ khóa "${normalizedSearchQuery}"${categoryName ? ` trong danh mục ${categoryName}` : ''} tại ${SITE_NAME}.`,
            en: `Filtered product results for "${normalizedSearchQuery}"${categoryName ? ` in ${categoryName}` : ''} at ${SITE_NAME}.`,
            ru: `Результаты поиска по запросу "${normalizedSearchQuery}"${categoryName ? ` в категории ${categoryName}` : ''} в ${SITE_NAME}.`,
            cn: `${SITE_NAME} 中与“${normalizedSearchQuery}”相关的产品结果${categoryName ? `，分类为 ${categoryName}` : ''}。`,
        }, resolvedLang)
        : matchedCategory
            ? getLocalizedLabel({
                vi: `Danh sách sản phẩm thuộc nhóm ${categoryName} tại ${SITE_NAME}, kèm mô tả ngắn để bạn so sánh và chọn đúng nhu cầu chăm sóc da.`,
                en: `Browse ${categoryName} products at ${SITE_NAME}.`,
                ru: `Каталог товаров категории ${categoryName} в ${SITE_NAME}.`,
                cn: `${SITE_NAME} 的 ${categoryName} 产品列表。`,
            }, resolvedLang)
            : getLocalizedLabel({
                vi: `Danh mục sản phẩm chăm sóc da, hỗ trợ điều trị mụn và phục hồi da tại ${SITE_NAME}, có phân loại rõ ràng để dễ tìm kiếm.`,
                en: `Browse skincare and acne-treatment products at ${SITE_NAME}.`,
                ru: `Каталог уходовых и противоугревых средств в ${SITE_NAME}.`,
                cn: `${SITE_NAME} 的护肤与祛痘产品目录。`,
            }, resolvedLang);
    const breadcrumbItems = [
        { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, resolvedLang), item: buildAbsoluteUrl('/', resolvedLang) },
        { name: getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, resolvedLang), item: buildAbsoluteUrl('/san-pham', resolvedLang) },
    ];
    if (matchedCategory) {
        breadcrumbItems.push({ name: categoryName, item: buildAbsoluteUrl(path, resolvedLang) });
    }
    const itemList = products.map((p, index) => {
        const slug = categorySlug || categoryMap.get(p.category_id) || 'khac';
        return {
            '@type': 'ListItem',
            position: index + 1,
            url: buildAbsoluteUrl(getProductPathByCategorySlug(slug, p.slug || p.id), resolvedLang),
            name: getLocalizedField(p, 'name', resolvedLang) || String(p.slug || p.id),
        };
    });

    return generatePrerenderListHtml({
        lang: resolvedLang,
        title: buildSeoTitle(heading),
        description,
        path,
        heading,
        intro: getLocalizedLabel({
            vi: 'Tổng hợp sản phẩm được phân loại theo danh mục, kèm mô tả nhanh để bạn đánh giá công dụng, chất liệu và mức độ phù hợp trước khi xem chi tiết.',
            en: 'Browse categorized products to compare and find the right fit faster.',
            ru: 'Подборка товаров по категориям для удобного поиска и сравнения.',
            cn: '按分类浏览产品，便于快速筛选与比较。',
        }, resolvedLang),
        image: DEFAULT_SHARE_IMAGE,
        imageAlt: heading,
        noindex: hasUnsupportedRequestedLocale || Boolean(normalizedSearchQuery),
        breadcrumbItems,
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: heading,
                url: buildAbsoluteUrl(path, resolvedLang),
                description,
                mainEntity: {
                    '@type': 'ItemList',
                    itemListOrder: 'https://schema.org/ItemListOrderAscending',
                    numberOfItems: products.length,
                    itemListElement: itemList,
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: heading,
                numberOfItems: products.length,
                itemListOrder: 'https://schema.org/ItemListOrderAscending',
                itemListElement: itemList,
            },
        ],
        alternateLangs: normalizedSearchQuery ? [resolvedLang] : categoryAlternateLangs,
        sections: [
            {
                title: getLocalizedLabel({ vi: 'Danh mục sản phẩm', en: 'Product categories', ru: 'Категории товаров', cn: '产品分类' }, resolvedLang),
                links: categories.map((c) => ({
                    href: buildAbsoluteUrl(`/san-pham/${c.slug}`, resolvedLang),
                    label: getLocalizedField(c, 'name', resolvedLang) || c.slug,
                })),
            },
            {
                title: normalizedSearchQuery
                    ? getLocalizedLabel({ vi: 'Kết quả phù hợp', en: 'Matching results', ru: 'Подходящие результаты', cn: '匹配结果' }, resolvedLang)
                    : getLocalizedLabel({ vi: 'Danh sách sản phẩm', en: 'Product list', ru: 'Список товаров', cn: '产品列表' }, resolvedLang),
                links: products.map((p) => {
                    const slug = categorySlug || categoryMap.get(p.category_id) || 'khac';
                    return {
                        href: buildAbsoluteUrl(getProductPathByCategorySlug(slug, p.slug || p.id), resolvedLang),
                        label: getLocalizedField(p, 'name', resolvedLang) || String(p.slug || p.id),
                        description: stripHtml(getStrictLocalizedField(p, 'description', resolvedLang) || '').slice(0, 140),
                        image: getListingImageUrl(getPrimaryProductImageUrl(p.images || [])),
                        imageAlt: getLocalizedField(p, 'name', resolvedLang) || String(p.slug || p.id),
                    };
                }),
            },
        ],
    });
}

export async function handleBrandLandingPrerender(brandSlug, lang = 'vi', deps) {
    const {
        getProductBrands,
        normalizeSeoLang,
        getProductsByBrandName,
        getProductCategories,
        buildAbsoluteUrl,
        SITE_NAME,
        stripHtml,
        splitBrandDescription,
        getStorageUrl,
        getPrimaryProductImageUrl,
        DEFAULT_SHARE_IMAGE,
        getLocalizedField,
        getProductPathByCategorySlug,
        generateDetailPrerenderHtml,
        buildSeoTitle,
        escapeHtml,
        escapeAttr,
        buildBrandFilteredCatalogUrl,
        getStrictLocalizedField,
        getListingImageUrl = (url) => url,
    } = deps;

    const brands = await getProductBrands();
    const brand = brands.find((entry) => String(entry.slug || '') === String(brandSlug || ''));
    if (!brand) return createSeoNotFoundResponse();

    const requestedLang = normalizeSeoLang(lang);
    const hasUnsupportedRequestedLocale = requestedLang !== 'vi';
    const resolvedLang = 'vi';
    const products = await getProductsByBrandName(brand.name, 12, { lang: resolvedLang });
    if (!products.length) return createSeoNotFoundResponse();

    const categories = await getProductCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const categoryStats = Array.from(
        products.reduce((acc, product) => {
            if (!product.category_id) return acc;
            acc.set(product.category_id, (acc.get(product.category_id) || 0) + 1);
            return acc;
        }, new Map()),
    )
        .map(([categoryId, count]) => ({
            category: categoryMap.get(categoryId),
            count,
        }))
        .filter((entry) => entry.category);

    const canonicalPath = `/thuong-hieu/${brand.slug}`;
    const canonicalUrl = buildAbsoluteUrl(canonicalPath, resolvedLang);
    const heading = brand.name;
    const description = stripHtml(brand.description || `Khám phá sản phẩm của thương hiệu ${brand.name} tại ${SITE_NAME}.`).slice(0, 180);
    const descriptionParagraphs = splitBrandDescription(brand.description || `${brand.name} là thương hiệu đang được ${SITE_NAME} giới thiệu trong nhóm sản phẩm chăm sóc và hỗ trợ điều trị da.`);
    const logoUrl = brand.logo_path ? getStorageUrl(brand.logo_path, 'site-assets') : (products[0]?.images?.[0] ? getPrimaryProductImageUrl(products[0].images) : DEFAULT_SHARE_IMAGE);

    const productLinks = products.map((product, index) => {
        const categorySlugValue = categoryMap.get(product.category_id)?.slug || 'khac';
        return {
            '@type': 'ListItem',
            position: index + 1,
            url: buildAbsoluteUrl(getProductPathByCategorySlug(categorySlugValue, product.slug || product.id), resolvedLang),
            name: getLocalizedField(product, 'name', resolvedLang) || String(product.slug || product.id),
        };
    });

    return generateDetailPrerenderHtml({
        lang: resolvedLang,
        path: canonicalPath,
        title: buildSeoTitle(`${brand.name} | Thương hiệu`),
        description,
        heading: brand.name,
        intro: `Trang thương hiệu ${brand.name} tại ${SITE_NAME}: giới thiệu nhanh, nhóm sản phẩm đang bán và lối vào danh sách sản phẩm đã lọc theo brand.`,
        image: logoUrl,
        imageAlt: brand.name,
        canonicalUrl,
        type: 'website',
        noindex: hasUnsupportedRequestedLocale,
        breadcrumbItems: [
            { name: 'Trang chủ', item: buildAbsoluteUrl('/', resolvedLang) },
            { name: 'Thương hiệu', item: buildAbsoluteUrl('/thuong-hieu', resolvedLang) },
            { name: brand.name, item: canonicalUrl },
        ],
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'Brand',
                name: brand.name,
                description,
                logo: logoUrl,
                url: canonicalUrl,
            },
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: brand.name,
                description,
                url: canonicalUrl,
                about: {
                    '@type': 'Brand',
                    name: brand.name,
                    logo: logoUrl,
                },
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: productLinks,
                },
            },
        ],
        facts: [
            { label: 'Sản phẩm đang bán', value: String(products.length) },
            { label: 'Danh mục có mặt', value: String(categoryStats.length) },
        ],
        sections: [
            {
                title: 'Giới thiệu thương hiệu',
                html: `${descriptionParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}<p><a href="${escapeAttr(buildBrandFilteredCatalogUrl(brand.slug, resolvedLang))}">Xem tất cả sản phẩm của thương hiệu</a></p>`,
            },
            ...(categoryStats.length > 0 ? [{
                title: 'Danh mục hiện có',
                description: 'Đi vào từng danh mục đã lọc sẵn theo thương hiệu.',
                links: categoryStats.map(({ category, count }) => ({
                    href: buildBrandFilteredCatalogUrl(brand.slug, resolvedLang, category.slug),
                    label: getLocalizedField(category, 'name', resolvedLang) || category.slug,
                    meta: `${count} sản phẩm`,
                })),
            }] : []),
            {
                title: 'Sản phẩm nổi bật',
                links: products.map((product) => {
                    const categorySlugValue = categoryMap.get(product.category_id)?.slug || 'khac';
                    return {
                        href: buildAbsoluteUrl(getProductPathByCategorySlug(categorySlugValue, product.slug || product.id), resolvedLang),
                        label: getLocalizedField(product, 'name', resolvedLang) || String(product.slug || product.id),
                        description: stripHtml(getStrictLocalizedField(product, 'description', resolvedLang) || '').slice(0, 140),
                        image: getListingImageUrl(getPrimaryProductImageUrl(product.images || [])),
                        imageAlt: getLocalizedField(product, 'name', resolvedLang) || String(product.slug || product.id),
                    };
                }),
            },
        ],
        alternateLangs: ['vi'],
    });
}

export async function handleBlogPrerender(categorySlug = null, lang = 'vi', deps) {
    const {
        getBlogCategories,
        getAvailableLangs,
        SEO_LANGS,
        resolveSupportedLang,
        normalizeSeoLang,
        getBlogList,
        getLocalizedField,
        getLocalizedLabel,
        SITE_NAME,
        buildAbsoluteUrl,
        getBlogPathByCategorySlug,
        buildSeoTitle,
        DEFAULT_SHARE_IMAGE,
        generatePrerenderListHtml,
        stripHtml,
        getStrictLocalizedField,
        getResolvedBlogImageUrl,
    } = deps;

    const categories = await getBlogCategories();
    const matchedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
    const categoryAlternateLangs = matchedCategory ? getAvailableLangs(matchedCategory, ['name']) : SEO_LANGS;
    const resolvedLang = matchedCategory ? resolveSupportedLang(lang, categoryAlternateLangs) : lang;
    const hasUnsupportedRequestedLocale = matchedCategory ? normalizeSeoLang(lang) !== resolvedLang : false;
    const posts = await getBlogList(30, matchedCategory?.slug || null, { lang: resolvedLang, translationRequired: true });

    const path = categorySlug ? `/kien-thuc/${categorySlug}` : '/kien-thuc';
    const categoryName = matchedCategory ? getLocalizedField(matchedCategory, 'name', resolvedLang) || matchedCategory.slug : null;
    const heading = matchedCategory
        ? `${getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, resolvedLang)}: ${categoryName}`
        : getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, resolvedLang);
    const description = matchedCategory
        ? getLocalizedLabel({
            vi: `Bài viết kiến thức da liễu thuộc chủ đề ${categoryName}, có tóm tắt ngắn để bạn chọn đúng nội dung cần đọc.`,
            en: `Dermatology articles in the ${categoryName} topic.`,
            ru: `Статьи по дерматологии в категории ${categoryName}.`,
            cn: `${categoryName} 主题下的皮肤科知识文章。`,
        }, resolvedLang)
        : getLocalizedLabel({
            vi: `Blog kiến thức trị mụn, chăm sóc da và tư vấn chuyên môn từ ${SITE_NAME}, được tổ chức theo chủ đề để dễ theo dõi.`,
            en: `Expert articles on acne treatment, skincare, and dermatology from ${SITE_NAME}.`,
            ru: `Экспертные статьи об акне, уходе за кожей и дерматологии от ${SITE_NAME}.`,
            cn: `${SITE_NAME} 提供的祛痘、护肤与皮肤科知识文章。`,
        }, resolvedLang);
    const breadcrumbItems = [
        { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, resolvedLang), item: buildAbsoluteUrl('/', resolvedLang) },
        { name: getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, resolvedLang), item: buildAbsoluteUrl('/kien-thuc', resolvedLang) },
    ];
    if (matchedCategory) {
        breadcrumbItems.push({ name: categoryName, item: buildAbsoluteUrl(path, resolvedLang) });
    }
    const itemList = posts.map((p, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildAbsoluteUrl(getBlogPathByCategorySlug(p.category_slug, p.slug), resolvedLang),
        name: getLocalizedField(p, 'title', resolvedLang) || p.slug,
    }));

    return generatePrerenderListHtml({
        lang: resolvedLang,
        title: buildSeoTitle(heading),
        description,
        path,
        heading,
        intro: getLocalizedLabel({
            vi: 'Tổng hợp bài viết chuyên môn, tóm tắt ngắn và liên kết nội bộ giúp bạn đi từ kiến thức nền đến giải pháp phù hợp nhanh hơn.',
            en: 'Expert articles to help you understand your skin condition and choose the right solution.',
            ru: 'Экспертные материалы помогут понять состояние кожи и выбрать подходящее решение.',
            cn: '专业内容帮助你理解肤况，并选择更合适的方案。',
        }, resolvedLang),
        image: DEFAULT_SHARE_IMAGE,
        imageAlt: heading,
        noindex: hasUnsupportedRequestedLocale,
        breadcrumbItems,
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: heading,
                url: buildAbsoluteUrl(path, resolvedLang),
                description,
                mainEntity: {
                    '@type': 'ItemList',
                    itemListOrder: 'https://schema.org/ItemListOrderDescending',
                    numberOfItems: posts.length,
                    itemListElement: itemList,
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: heading,
                numberOfItems: posts.length,
                itemListOrder: 'https://schema.org/ItemListOrderDescending',
                itemListElement: itemList,
            },
        ],
        alternateLangs: categoryAlternateLangs,
        sections: [
            {
                title: getLocalizedLabel({ vi: 'Danh mục bài viết', en: 'Article categories', ru: 'Категории статей', cn: '文章分类' }, resolvedLang),
                links: categories.map((c) => ({
                    href: buildAbsoluteUrl(`/kien-thuc/${c.slug}`, resolvedLang),
                    label: getLocalizedField(c, 'name', resolvedLang) || c.slug,
                })),
            },
            {
                title: getLocalizedLabel({ vi: 'Bài viết mới nhất', en: 'Latest articles', ru: 'Последние статьи', cn: '最新文章' }, resolvedLang),
                links: posts.map((p) => ({
                    href: buildAbsoluteUrl(getBlogPathByCategorySlug(p.category_slug, p.slug), resolvedLang),
                    label: getLocalizedField(p, 'title', resolvedLang) || p.slug,
                    description: stripHtml((resolvedLang === 'vi' ? p.meta_description : '') || getStrictLocalizedField(p, 'summary', resolvedLang) || '').slice(0, 140),
                    image: getResolvedBlogImageUrl(p),
                    imageAlt: getLocalizedField(p, 'title', resolvedLang) || p.slug,
                })),
            },
        ],
    });
}

export async function handleServicesPrerender(lang = 'vi', deps) {
    const {
        getServiceList,
        getLocalizedLabel,
        SITE_NAME,
        buildAbsoluteUrl,
        getServicePath,
        getLocalizedField,
        generatePrerenderListHtml,
        DEFAULT_SHARE_IMAGE,
        getStorageUrl,
    } = deps;

    const services = await getServiceList(30);
    const heading = getLocalizedLabel({ vi: 'Dịch vụ điều trị da', en: 'Skin treatment services', ru: 'Дерматологические услуги', cn: '皮肤治疗服务' }, lang);
    const description = getLocalizedLabel({
        vi: `Danh sách dịch vụ khám và điều trị da liễu tại ${SITE_NAME}, kèm mô tả ngắn để bạn chọn đúng nhu cầu và mức độ can thiệp.`,
        en: `Dermatology consultation and treatment services at ${SITE_NAME}.`,
        ru: `Услуги консультации и лечения кожи в ${SITE_NAME}.`,
        cn: `${SITE_NAME} 提供的皮肤诊疗服务列表。`,
    }, lang);
    const itemList = services.map((service, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildAbsoluteUrl(getServicePath(service), lang),
        name: getLocalizedField(service, 'name', lang) || `Dịch vụ ${service.id}`,
    }));
    return generatePrerenderListHtml({
        lang,
        title: `${heading} | ${SITE_NAME}`,
        description,
        path: '/dich-vu',
        heading,
        intro: getLocalizedLabel({
            vi: 'Thông tin các dịch vụ chuyên sâu, lợi ích chính và liên kết chi tiết để bạn đánh giá phương án phù hợp trước khi đặt lịch.',
            en: 'Explore advanced services tailored to different skin-care and treatment needs.',
            ru: 'Подборка специализированных услуг для разных задач ухода и лечения кожи.',
            cn: '查看适合不同护肤与治疗需求的专业服务。',
        }, lang),
        image: DEFAULT_SHARE_IMAGE,
        imageAlt: heading,
        breadcrumbItems: [
            { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, lang), item: buildAbsoluteUrl('/', lang) },
            { name: getLocalizedLabel({ vi: 'Dịch vụ', en: 'Services', ru: 'Услуги', cn: '服务' }, lang), item: buildAbsoluteUrl('/dich-vu', lang) },
        ],
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: heading,
                url: buildAbsoluteUrl('/dich-vu', lang),
                description,
                mainEntity: {
                    '@type': 'ItemList',
                    itemListOrder: 'https://schema.org/ItemListOrderAscending',
                    numberOfItems: services.length,
                    itemListElement: itemList,
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: heading,
                numberOfItems: services.length,
                itemListOrder: 'https://schema.org/ItemListOrderAscending',
                itemListElement: itemList,
            },
        ],
        sections: [
            {
                title: getLocalizedLabel({ vi: 'Danh sách dịch vụ', en: 'Service list', ru: 'Список услуг', cn: '服务列表' }, lang),
                links: services.map((s) => ({
                    href: buildAbsoluteUrl(getServicePath(s), lang),
                    label: getLocalizedField(s, 'name', lang) || `Dịch vụ ${s.id}`,
                    description: deps.stripHtml(getLocalizedField(s, 'description', lang) || '').slice(0, 140),
                    image: s.image_path ? getStorageUrl(s.image_path, 'site-assets') : null,
                    imageAlt: getLocalizedField(s, 'name', lang) || `Dịch vụ ${s.id}`,
                })),
            },
        ],
    });
}

export async function handleAboutPrerender(lang = 'vi', deps) {
    const {
        getAboutContent,
        getDoctors,
        getLocalizedField,
        getLocalizedLabel,
        SITE_NAME,
        buildAbsoluteUrl,
        generatePrerenderListHtml,
        DEFAULT_SHARE_IMAGE,
        BASE_URL,
        DEFAULT_LOGO_IMAGE,
        truncateText,
        getStorageUrl,
    } = deps;

    const [about, doctors] = await Promise.all([
        getAboutContent(),
        getDoctors(8),
    ]);
    const heading = getLocalizedField(about, 'header_title', lang) || getLocalizedLabel({
        vi: 'Về Thế Giới Trị Mụn',
        en: 'About Thế Giới Trị Mụn',
        ru: 'О Thế Giới Trị Mụn',
        cn: '关于 Thế Giới Trị Mụn',
    }, lang);
    const intro = getLocalizedField(about, 'header_subtitle', lang) || getLocalizedLabel({
        vi: 'Phòng khám da liễu chuyên sâu tập trung vào giải pháp điều trị, chăm sóc và đồng hành dài hạn với làn da.',
        en: 'An advanced dermatology clinic focused on treatment, skin care, and long-term patient guidance.',
        ru: 'Профессиональная дерматологическая клиника, ориентированная на лечение, уход и долгосрочное сопровождение пациентов.',
        cn: '专注治疗、护理与长期皮肤管理的专业皮肤诊疗机构。',
    }, lang);
    const title = `${heading} | ${SITE_NAME}`;
    const description = intro;

    return generatePrerenderListHtml({
        lang,
        title,
        description,
        path: '/ve-chung-toi',
        heading,
        intro,
        image: DEFAULT_SHARE_IMAGE,
        imageAlt: heading,
        breadcrumbItems: [
            { name: getLocalizedLabel({ vi: 'Trang chủ', en: 'Home', ru: 'Главная', cn: '首页' }, lang), item: buildAbsoluteUrl('/', lang) },
            { name: getLocalizedLabel({ vi: 'Về chúng tôi', en: 'About us', ru: 'О нас', cn: '关于我们' }, lang), item: buildAbsoluteUrl('/ve-chung-toi', lang) },
        ],
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'AboutPage',
                name: title,
                url: buildAbsoluteUrl('/ve-chung-toi', lang),
                description,
            },
            {
                '@context': 'https://schema.org',
                '@type': 'MedicalClinic',
                name: SITE_NAME,
                url: BASE_URL,
                logo: DEFAULT_LOGO_IMAGE,
                image: DEFAULT_SHARE_IMAGE,
            },
        ],
        sections: [
            {
                title: getLocalizedLabel({ vi: 'Liên kết chính', en: 'Core links', ru: 'Основные ссылки', cn: '主要链接' }, lang),
                links: [
                    { href: buildAbsoluteUrl('/dich-vu', lang), label: getLocalizedLabel({ vi: 'Dịch vụ', en: 'Services', ru: 'Услуги', cn: '服务' }, lang) },
                    { href: buildAbsoluteUrl('/san-pham', lang), label: getLocalizedLabel({ vi: 'Sản phẩm', en: 'Products', ru: 'Товары', cn: '产品' }, lang) },
                    { href: buildAbsoluteUrl('/kien-thuc', lang), label: getLocalizedLabel({ vi: 'Kiến thức', en: 'Blog', ru: 'Блог', cn: '知识' }, lang) },
                ],
            },
            ...(doctors.length > 0 ? [{
                title: getLocalizedLabel({ vi: 'Đội ngũ chuyên môn', en: 'Medical team', ru: 'Команда специалистов', cn: '专业团队' }, lang),
                description: getLocalizedLabel({
                    vi: 'Những bác sĩ và chuyên viên đang trực tiếp tham gia tư vấn, điều trị và đồng hành cùng khách hàng tại Thế Giới Trị Mụn.',
                    en: 'Doctors and specialists directly involved in consultations, treatment, and long-term skin guidance at Thế Giới Trị Mụn.',
                    ru: 'Врачи и специалисты, которые проводят консультации, лечение и сопровождают пациентов в Thế Giới Trị Mụn.',
                    cn: '在 Thế Giới Trị Mụn 提供咨询、治疗与长期皮肤管理支持的医生与专业团队。',
                }, lang),
                links: doctors.map((doctor) => ({
                    href: buildAbsoluteUrl('/ve-chung-toi', lang),
                    label: doctor.name,
                    meta: [getLocalizedField(doctor, 'job_title', lang), getLocalizedField(doctor, 'specialization', lang)].filter(Boolean).join(' • '),
                    description: truncateText(getLocalizedField(doctor, 'homepage_description', lang) || ''),
                    image: doctor.avatar_path ? getStorageUrl(doctor.avatar_path, 'avatars') : null,
                    imageAlt: doctor.name,
                })),
            }] : []),
        ],
    });
}
