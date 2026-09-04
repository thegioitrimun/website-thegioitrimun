import { fetchD1PublicEndpoint } from './d1Rest.js';

export async function handlePublicBootstrap(request, env, ctx, deps) {
    const {
        readEdgeCache,
        queuePublicMetricEvent,
        PUBLIC_BOOTSTRAP_QUERY_TIMEOUT_MS,
        PRODUCT_LIST_LITE_SELECT,
        HOMEPAGE_PRODUCT_SELECT,
        HOMEPAGE_SERVICE_SELECT,
        HOMEPAGE_SOURCE_PRODUCT_LIMIT,
        HOMEPAGE_FAQ_LIMIT,
        HOMEPAGE_BRAND_LIMIT,
        BLOG_HOMEPAGE_SELECT,
        HOMEPAGE_BLOG_SOURCE_LIMIT,
        mapBlogLiteRecord,
        selectHomepageProductRows,
        mapServiceRecord,
        mapDoctorRecord,
        mapAboutPageData,
        mapHomepageHeroRecord,
        mapSiteInfoRecord,
        mapAuthPageImageRecord,
        mapBrandRecord,
        mapProductLiteRecord,
        jsonResponse,
        getPublicBootstrapCacheControl,
        writeEdgeCache,
    } = deps;

    const startedAt = Date.now();
    const url = new URL(request.url);
    const requestedMode = url.searchParams.get('mode');
    const mode = requestedMode === 'full'
        ? 'full'
        : requestedMode === 'home_deferred'
            ? 'home_deferred'
            : 'home';
    const metricEndpoint = `/api/public/bootstrap?mode=${mode}`;
    const cachedResponse = await readEdgeCache(request);
    if (cachedResponse) {
        queuePublicMetricEvent(env, ctx, {
            endpoint: metricEndpoint,
            resource: 'bootstrap',
            mode,
            cache_status: 'hit',
            response_status: cachedResponse.status,
            duration_ms: Date.now() - startedAt,
            partial: false,
            upstream_timeout: false,
        });
        return cachedResponse;
    }

    const bootstrapFetches = [
        ['blogCategories', 'blog_categories?select=*&order=name.asc'],
        ['homepageHero', 'homepage_hero?select=*&limit=1'],
        ['siteInfo', 'site_info?select=*&limit=1'],
        ['footerContent', 'footer_content?select=*&limit=1'],
        ['productCategories', 'product_categories?select=*&order=name.asc'],
    ];

    if (mode === 'full' || mode === 'home') {
        bootstrapFetches.push(
            [
                'services',
                mode === 'full'
                    ? 'services?select=*,procedure_steps(*)&order=id.asc'
                    : `services?select=${encodeURIComponent(HOMEPAGE_SERVICE_SELECT)}&order=id.asc`,
            ],
            ['featuredServices', 'featured_services?select=service_id'],
            [
                'products',
                mode === 'full'
                    ? `products?select=${encodeURIComponent(PRODUCT_LIST_LITE_SELECT)}&is_published=eq.true&archived_at=is.null&order=name.asc`
                    : `products?select=${encodeURIComponent(HOMEPAGE_PRODUCT_SELECT)}&is_published=eq.true&archived_at=is.null&order=id.desc&limit=${HOMEPAGE_SOURCE_PRODUCT_LIMIT}`,
            ],
        );
    }

    if (mode === 'full') {
        bootstrapFetches.push(
            ['doctors', 'public_doctors_directory?select=*'],
            ['featuredDoctors', 'featured_doctors?select=doctor_id'],
            ['aboutContent', 'about_page_content?select=*&limit=1'],
            ['aboutFeatures', 'about_features?select=*&order=display_order.asc'],
            ['aboutValues', 'about_values?select=*&order=display_order.asc'],
            ['authPageImages', 'auth_page_images?select=id,login_image_path&limit=1'],
            ['paymentSettings', 'payment_settings?select=*&limit=1'],
        );
    }

    if (mode === 'full' || mode === 'home_deferred') {
        bootstrapFetches.push(
            ['faqItems', mode === 'full' ? 'faq_items?select=*&order=id.asc' : `faq_items?select=*&order=id.asc&limit=${HOMEPAGE_FAQ_LIMIT}`],
            ['featuredPosts', 'featured_posts?select=post_slug'],
            ['brands', mode === 'full' ? 'product_brands?select=*&order=name.asc' : `product_brands?select=*&order=name.asc&limit=${HOMEPAGE_BRAND_LIMIT}`],
            ['blogPosts', mode === 'full' ? `public_blog_posts?select=${encodeURIComponent(BLOG_HOMEPAGE_SELECT)}&order=date.desc` : `public_blog_posts?select=${encodeURIComponent(BLOG_HOMEPAGE_SELECT)}&order=date.desc&limit=${HOMEPAGE_BLOG_SOURCE_LIMIT}`],
        );
    }

    if (!env.APP_DB) return jsonResponse({ error: 'APP_DB is not configured.' }, 503, { 'Cache-Control': 'no-store' });
    const runtimeFetch = (endpoint) => fetchD1PublicEndpoint(env, endpoint);
    const bootstrapResults = await Promise.all(
        bootstrapFetches.map(async ([key, endpoint]) => ({
            key,
            ...(await runtimeFetch(endpoint)),
        })),
    );
    const bootstrapByKey = Object.fromEntries(bootstrapResults.map((result) => [result.key, result]));

    const servicesRaw = bootstrapByKey.services?.data;
    const doctorsRaw = bootstrapByKey.doctors?.data;
    const blogCategoriesRaw = bootstrapByKey.blogCategories?.data;
    const faqItemsRaw = bootstrapByKey.faqItems?.data;
    const featuredDoctorsRaw = bootstrapByKey.featuredDoctors?.data;
    const featuredPostsRaw = bootstrapByKey.featuredPosts?.data;
    const aboutContentRaw = bootstrapByKey.aboutContent?.data;
    const aboutFeaturesRaw = bootstrapByKey.aboutFeatures?.data;
    const aboutValuesRaw = bootstrapByKey.aboutValues?.data;
    const homepageHeroRaw = bootstrapByKey.homepageHero?.data;
    const featuredServicesRaw = bootstrapByKey.featuredServices?.data;
    const siteInfoRaw = bootstrapByKey.siteInfo?.data;
    const footerContentRaw = bootstrapByKey.footerContent?.data;
    const authPageImagesRaw = bootstrapByKey.authPageImages?.data;
    const productCategoriesRaw = bootstrapByKey.productCategories?.data;
    const paymentSettingsRaw = bootstrapByKey.paymentSettings?.data;
    const brandsRaw = bootstrapByKey.brands?.data;
    const blogPostsRaw = bootstrapByKey.blogPosts?.data;
    const productsRaw = bootstrapByKey.products?.data;

    const featuredDoctorIds = Array.isArray(featuredDoctorsRaw)
        ? featuredDoctorsRaw.map((item) => item?.doctor_id).filter(Boolean)
        : null;
    const featuredPostSlugs = Array.isArray(featuredPostsRaw)
        ? featuredPostsRaw.map((item) => item?.post_slug).filter(Boolean)
        : null;
    const featuredServiceIds = Array.isArray(featuredServicesRaw)
        ? featuredServicesRaw.map((item) => Number(item?.service_id)).filter((id) => Number.isInteger(id) && id > 0)
        : null;
    const featuredCategoryIds = Array.isArray(productCategoriesRaw)
        ? productCategoriesRaw
            .filter((category) => category?.is_featured)
            .map((category) => Number(category?.id))
            .filter((id) => Number.isInteger(id) && id > 0)
        : [];

    const blogPostRows = Array.isArray(blogPostsRaw)
        ? blogPostsRaw.map(mapBlogLiteRecord).filter(Boolean)
        : null;
    const blogPosts = blogPostRows
        ? (mode === 'full'
            ? blogPostRows
            : (() => {
                const featuredOrder = new Map((featuredPostSlugs || []).map((slug, index) => [slug, index]));
                const featured = blogPostRows
                    .filter((post) => featuredOrder.has(post.slug))
                    .sort((a, b) => (featuredOrder.get(a.slug) || Number.MAX_SAFE_INTEGER) - (featuredOrder.get(b.slug) || Number.MAX_SAFE_INTEGER));
                return featured.length > 0 ? featured : blogPostRows.slice(0, 8);
            })())
        : null;

    const productRows = Array.isArray(productsRaw) ? productsRaw : null;
    const selectedProductRows = productRows
        ? (mode === 'full'
            ? productRows
            : selectHomepageProductRows(productRows, featuredCategoryIds))
        : null;
    const hasMissingCoreServices = (mode === 'home' || mode === 'full')
        && Array.isArray(servicesRaw)
        && servicesRaw.length === 0;
    const hasMissingCoreProducts = (mode === 'home' || mode === 'full')
        && Array.isArray(selectedProductRows)
        && selectedProductRows.length === 0;
    const missingSources = bootstrapResults
        .filter((result) => result.data === null)
        .map((result) => result.key);
    const timedOutSources = bootstrapResults
        .filter((result) => result.timed_out)
        .map((result) => result.key);

    const payload = {
        mode,
        generatedAt: new Date().toISOString(),
        partial: missingSources.length > 0 || hasMissingCoreServices || hasMissingCoreProducts,
        services: Array.isArray(servicesRaw) ? servicesRaw.map(mapServiceRecord) : null,
        doctors: Array.isArray(doctorsRaw) ? doctorsRaw.map(mapDoctorRecord) : null,
        blogCategories: Array.isArray(blogCategoriesRaw) ? blogCategoriesRaw : null,
        faqItems: Array.isArray(faqItemsRaw) ? faqItemsRaw : null,
        featuredDoctorIds,
        featuredPostSlugs,
        aboutData: mapAboutPageData(Array.isArray(aboutContentRaw) ? aboutContentRaw[0] || null : aboutContentRaw, aboutFeaturesRaw, aboutValuesRaw),
        homepageHero: mapHomepageHeroRecord(Array.isArray(homepageHeroRaw) ? homepageHeroRaw[0] || null : homepageHeroRaw),
        featuredServiceIds,
        siteInfo: mapSiteInfoRecord(Array.isArray(siteInfoRaw) ? siteInfoRaw[0] || null : siteInfoRaw),
        footerContent: Array.isArray(footerContentRaw) ? footerContentRaw[0] || null : footerContentRaw,
        authPageImages: mapAuthPageImageRecord(Array.isArray(authPageImagesRaw) ? authPageImagesRaw[0] || null : authPageImagesRaw),
        productCategories: Array.isArray(productCategoriesRaw) ? productCategoriesRaw : null,
        paymentSettings: Array.isArray(paymentSettingsRaw) ? paymentSettingsRaw[0] || null : paymentSettingsRaw,
        brands: Array.isArray(brandsRaw) ? brandsRaw.map(mapBrandRecord) : null,
        blogPosts,
        products: selectedProductRows ? selectedProductRows.map(mapProductLiteRecord) : null,
    };

    const response = jsonResponse(payload, 200, {
        'Cache-Control': getPublicBootstrapCacheControl(mode, payload.partial),
        'X-Robots-Tag': 'noindex, nofollow',
        'Vary': 'Accept-Encoding',
    });
    if (!payload.partial) {
        await writeEdgeCache(request, response, ctx);
    }
    queuePublicMetricEvent(env, ctx, {
        endpoint: metricEndpoint,
        resource: 'bootstrap',
        mode,
        cache_status: 'miss',
        response_status: response.status,
        duration_ms: Date.now() - startedAt,
        upstream_timeout: timedOutSources.length > 0,
        upstream_timeout_count: timedOutSources.length,
        partial: payload.partial,
        missing_source_count: missingSources.length,
        missing_sources: missingSources.join(','),
        timed_out_sources: timedOutSources.join(','),
    });
    return response;
}
