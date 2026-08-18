import { maybeHandleSeoFeedRoute } from './feeds.js';
import { maybeHandleAiCatalogRoute } from './aiCatalog.js';
import { maybeHandleLlmsTextRoute } from './llmsText.js';
import { maybeHandleMerchantFeedRoute } from './merchantFeed.js';
import {
    handleAboutPrerender,
    handleBlogPrerender,
    handleBrandLandingPrerender,
    handleBrandsDirectoryPrerender,
    handleHomePrerender,
    handleProductsPrerender,
    handleServicesPrerender,
} from './prerenderIndex.js';
import {
    handleBlogPost,
    handleProduct,
    handleService,
} from './prerenderDetail.js';
import { maybeHandleSeoRedirects } from './redirects.js';

function escapeSeoText(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function buildSeoFailureResponse(path, seoLang, deps, status = 503) {
    const { buildAbsoluteUrl, SITE_NAME, getLocalizedLabel } = deps;
    const title = getLocalizedLabel({
        vi: 'Không thể tạo trang SEO',
        en: 'Unable to build SEO page',
        ru: 'Не удалось собрать SEO-страницу',
        cn: '无法生成 SEO 页面',
    }, seoLang);
    const description = getLocalizedLabel({
        vi: 'Máy chủ chưa thể dựng trước nội dung cho bot. Vui lòng thử lại sau.',
        en: 'The server could not prerender this page for bots. Please retry later.',
        ru: 'Сервер не смог предварительно подготовить страницу для ботов. Повторите попытку позже.',
        cn: '服务器暂时无法为抓取程序预渲染该页面，请稍后再试。',
    }, seoLang);
    const canonicalUrl = buildAbsoluteUrl(path, seoLang);
    const safeTitle = escapeSeoText(`${title} | ${SITE_NAME}`);
    const safeDescription = escapeSeoText(description);

    return new Response(`<!DOCTYPE html>
<html lang="${escapeSeoText(seoLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeSeoText(canonicalUrl)}">
</head>
<body>
  <main>
    <h1>${escapeSeoText(title)}</h1>
    <p>${safeDescription}</p>
  </main>
</body>
</html>`, {
        status,
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store, max-age=0',
            'Retry-After': '120',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
    });
}

function buildSeoNotFoundResponse(path, seoLang, deps) {
    const { buildAbsoluteUrl, SITE_NAME, getLocalizedLabel } = deps;
    const title = getLocalizedLabel({
        vi: 'Không tìm thấy nội dung',
        en: 'Content not found',
        ru: 'Контент не найден',
        cn: '未找到内容',
    }, seoLang);
    const description = getLocalizedLabel({
        vi: 'URL này không còn nội dung công khai để lập chỉ mục.',
        en: 'This URL no longer has public content available for indexing.',
        ru: 'По этому URL больше нет публичного контента для индексации.',
        cn: '此链接当前没有可供索引的公开内容。',
    }, seoLang);
    const canonicalUrl = buildAbsoluteUrl(path, seoLang);
    const safeTitle = escapeSeoText(`${title} | ${SITE_NAME}`);
    const safeDescription = escapeSeoText(description);

    return new Response(`<!DOCTYPE html>
<html lang="${escapeSeoText(seoLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeSeoText(canonicalUrl)}">
</head>
<body>
  <main>
    <h1>${escapeSeoText(title)}</h1>
    <p>${safeDescription}</p>
  </main>
</body>
</html>`, {
        status: 404,
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store, max-age=0',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
    });
}

async function fetchAssetsResponse(request, env) {
    if (env?.ASSETS?.fetch) {
        return env.ASSETS.fetch(request);
    }
    return new Response('Static asset binding unavailable', {
        status: 503,
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}

export async function maybeHandleSeoRoute(route, deps) {
    const { request, env, url, path, seoLang, botRequest } = route;
    const {
        buildRobotsContent,
        withRobotsHeader,
        generateNoindexPage,
        isPrivatePath,
        isExcludedBlogSlug,
    } = deps;

    const feedResponse = await maybeHandleSeoFeedRoute(route, deps);
    if (feedResponse) {
        return feedResponse;
    }

    const merchantFeedResponse = await maybeHandleMerchantFeedRoute(route, deps);
    if (merchantFeedResponse) {
        return merchantFeedResponse;
    }

    const aiCatalogResponse = await maybeHandleAiCatalogRoute(route, deps);
    if (aiCatalogResponse) {
        return aiCatalogResponse;
    }

    const llmsTextResponse = await maybeHandleLlmsTextRoute(route, deps);
    if (llmsTextResponse) {
        return llmsTextResponse;
    }

    const redirectResponse = await maybeHandleSeoRedirects(route, deps);
    if (redirectResponse) {
        return redirectResponse;
    }

    if (isPrivatePath(path)) {
        if (botRequest) {
            return generateNoindexPage(path, seoLang);
        }
        const response = await fetchAssetsResponse(request, env);
        return withRobotsHeader(response, buildRobotsContent(true));
    }

    if (!botRequest) {
        return fetchAssetsResponse(request, env);
    }

    let matchedSeoRoute = false;
    try {
        if (path === '/') {
            matchedSeoRoute = true;
            return await handleHomePrerender(seoLang, deps);
        }
        if (path === '/san-pham') {
            matchedSeoRoute = true;
            return await handleProductsPrerender(null, seoLang, url.searchParams.get('q') || url.searchParams.get('tu-khoa') || '', deps);
        }
        if (path === '/kien-thuc') {
            matchedSeoRoute = true;
            return await handleBlogPrerender(null, seoLang, deps);
        }
        if (path === '/dich-vu') {
            matchedSeoRoute = true;
            return await handleServicesPrerender(seoLang, deps);
        }
        if (path === '/ve-chung-toi') {
            matchedSeoRoute = true;
            return await handleAboutPrerender(seoLang, deps);
        }
        if (path === '/thuong-hieu') {
            matchedSeoRoute = true;
            return await handleBrandsDirectoryPrerender(seoLang, deps);
        }

        const brandLandingMatch = path.match(/^\/thuong-hieu\/([^/]+)$/);
        if (brandLandingMatch) {
            matchedSeoRoute = true;
            return await handleBrandLandingPrerender(decodeURIComponent(brandLandingMatch[1]), seoLang, deps);
        }

        const productCategoryMatch = path.match(/^\/san-pham\/([^/]+)$/);
        if (productCategoryMatch) {
            matchedSeoRoute = true;
            return await handleProductsPrerender(
                decodeURIComponent(productCategoryMatch[1]),
                seoLang,
                url.searchParams.get('q') || url.searchParams.get('tu-khoa') || '',
                deps,
            );
        }

        const blogCategoryMatch = path.match(/^\/kien-thuc\/([^/]+)$/);
        if (blogCategoryMatch) {
            matchedSeoRoute = true;
            return await handleBlogPrerender(decodeURIComponent(blogCategoryMatch[1]), seoLang, deps);
        }

        const productMatch = path.match(/^\/san-pham\/([^/]+)\/([^/]+)$/);
        if (productMatch) {
            matchedSeoRoute = true;
            const result = await handleProduct(decodeURIComponent(productMatch[2]), seoLang, deps);
            return result || buildSeoNotFoundResponse(path, seoLang, deps);
        }

        const blogMatch = path.match(/^\/kien-thuc\/([^/]+)\/([^/]+)$/);
        if (blogMatch) {
            matchedSeoRoute = true;
            const blogSlug = decodeURIComponent(blogMatch[2]);
            if (isExcludedBlogSlug(blogSlug)) {
                return new Response('Not found', {
                    status: 404,
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        'X-Robots-Tag': 'noindex, nofollow, noarchive',
                    },
                });
            }
            const result = await handleBlogPost(blogSlug, seoLang, deps);
            return result || buildSeoNotFoundResponse(path, seoLang, deps);
        }

        const serviceMatch = path.match(/^\/dich-vu\/([^/]+)$/);
        if (serviceMatch) {
            matchedSeoRoute = true;
            const result = await handleService(decodeURIComponent(serviceMatch[1]), seoLang, deps);
            return result || buildSeoNotFoundResponse(path, seoLang, deps);
        }
    } catch (err) {
        console.error('OG Worker error:', err);
        if (matchedSeoRoute) {
            return buildSeoFailureResponse(path, seoLang, deps);
        }
    }

    return fetchAssetsResponse(request, env);
}
