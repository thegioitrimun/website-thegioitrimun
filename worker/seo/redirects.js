export async function maybeHandleSeoRedirects(route, deps) {
    const { request, url, path, seoLang, botRequest } = route;
    const {
        BASE_URL,
        buildCanonicalRedirectUrl,
        buildLegacyProductSearchRedirectUrl,
        getLegacyRootProductSlug,
        isLikelyLegacyProductSlug,
        getLegacyProductCanonicalRoute,
        getProductCanonicalRoute,
        getServiceCanonicalRoute,
        getBlogCanonicalRoute,
    } = deps;

    const legacyRootProductSlug = getLegacyRootProductSlug(path);
    if ((request.method === 'GET' || request.method === 'HEAD') && legacyRootProductSlug) {
        try {
            const likelyLegacyProduct = isLikelyLegacyProductSlug(legacyRootProductSlug);
            const canonical = likelyLegacyProduct
                ? await getLegacyProductCanonicalRoute(legacyRootProductSlug, seoLang)
                : await getProductCanonicalRoute(legacyRootProductSlug, seoLang);
            if (canonical) {
                return Response.redirect(buildCanonicalRedirectUrl(url, canonical.path, canonical.lang), 301);
            }
            if (likelyLegacyProduct) {
                return Response.redirect(buildLegacyProductSearchRedirectUrl(url, legacyRootProductSlug, seoLang), 302);
            }
        } catch (err) {
            console.error('Legacy root product redirect error:', err);
        }
    }

    const legacyProductMatch = path.match(/^\/san-pham\/([^/]+)$/);
    if (legacyProductMatch) {
        try {
            const legacyIdOrSlug = decodeURIComponent(legacyProductMatch[1]);
            const canonical = await getProductCanonicalRoute(legacyIdOrSlug, seoLang);
            if (canonical) {
                return Response.redirect(buildCanonicalRedirectUrl(url, canonical.path, canonical.lang), 301);
            }
        } catch (err) {
            console.error('Legacy product redirect error:', err);
        }
    }

    const legacyServiceMatch = path.match(/^\/dich-vu\/([^/]+)$/);
    if (legacyServiceMatch) {
        let didResolveService = false;
        try {
            const legacyIdOrSlug = decodeURIComponent(legacyServiceMatch[1]);
            const canonical = await getServiceCanonicalRoute(legacyIdOrSlug, seoLang);
            if (canonical) {
                didResolveService = true;
                if (canonical.path !== path || canonical.lang !== seoLang) {
                    return Response.redirect(
                        buildCanonicalRedirectUrl(url, canonical.path, canonical.lang),
                        canonical.path !== path ? 301 : 302,
                    );
                }
            }
            if (!didResolveService && /^\d+$/.test(legacyIdOrSlug)) {
                return Response.redirect(`${BASE_URL}/dich-vu`, 302);
            }
        } catch (err) {
            console.error('Legacy service redirect error:', err);
        }
    }

    const legacyBlogMatch = path.match(/^\/kien-thuc\/([^/]+)$/);
    if (legacyBlogMatch) {
        try {
            const legacySlug = decodeURIComponent(legacyBlogMatch[1]);
            const canonical = await getBlogCanonicalRoute(legacySlug, seoLang);
            if (canonical) {
                return Response.redirect(buildCanonicalRedirectUrl(url, canonical.path, canonical.lang), 301);
            }
        } catch (err) {
            console.error('Legacy blog redirect error:', err);
        }
    }

    const productDetailMatch = path.match(/^\/san-pham\/([^/]+)\/([^/]+)$/);
    if (productDetailMatch && botRequest) {
        try {
            const requestedCategorySlug = decodeURIComponent(productDetailMatch[1]);
            const canonical = await getProductCanonicalRoute(decodeURIComponent(productDetailMatch[2]), seoLang);
            const shouldAvoidWeakDowngrade = canonical && requestedCategorySlug !== 'khac' && canonical.path.includes('/san-pham/khac/');
            if (canonical && !shouldAvoidWeakDowngrade && (canonical.path !== path || canonical.lang !== seoLang)) {
                return Response.redirect(
                    buildCanonicalRedirectUrl(url, canonical.path, canonical.lang),
                    canonical.path !== path ? 301 : 302,
                );
            }
        } catch (err) {
            console.error('Product canonical redirect error:', err);
        }
    }

    const blogDetailMatch = path.match(/^\/kien-thuc\/([^/]+)\/([^/]+)$/);
    if (blogDetailMatch) {
        try {
            const canonical = await getBlogCanonicalRoute(decodeURIComponent(blogDetailMatch[2]), seoLang);
            if (canonical && (canonical.path !== path || canonical.lang !== seoLang)) {
                return Response.redirect(
                    buildCanonicalRedirectUrl(url, canonical.path, canonical.lang),
                    canonical.path !== path ? 301 : 302,
                );
            }
        } catch (err) {
            console.error('Blog canonical redirect error:', err);
        }
    }

    return null;
}
