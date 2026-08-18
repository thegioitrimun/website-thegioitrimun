import { fetchProductImagesForProducts } from './productImages.js';

function createSitemapUrlEntry(entry, deps) {
    const {
        path,
        lastmod,
        changefreq,
        priority,
        imageUrl,
        imageTitle,
        alternateLangs = deps.SEO_LANGS,
    } = entry;
    const { getAlternateUrls, escapeXml, buildAbsoluteUrl } = deps;

    const alternates = getAlternateUrls(path, alternateLangs)
        .map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}" />`)
        .join('\n');
    const defaultAlternate = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(buildAbsoluteUrl(path, 'vi'))}" />`;
    const imageBlock = imageUrl
        ? `\n    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>${imageTitle ? `\n      <image:title>${escapeXml(imageTitle)}</image:title>\n      <image:caption>${escapeXml(imageTitle)}</image:caption>` : ''}\n    </image:image>`
        : '';

    return `  <url>
    <loc>${escapeXml(buildAbsoluteUrl(path, 'vi'))}</loc>
${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
${defaultAlternate}${imageBlock}
  </url>`;
}

async function generateSitemap(deps) {
    const {
        supabaseFetch,
        isExcludedBlogSlug,
        getResolvedBlogImageUrl,
        getAvailableLangsRequiringAll,
        getAvailableLangs,
        CATEGORY_TRANSLATION_FIELDS,
        pickLatestDate,
        toDateOnly,
        normalizeBrandMatchKey,
        DEFAULT_SHARE_IMAGE,
        SITE_NAME,
        getStorageUrl,
        buildImageTitle,
    } = deps;

    const [products, categories, posts, blogCategories, services, brands] = await Promise.all([
        supabaseFetch('products?is_published=eq.true&archived_at=is.null&select=id,slug,category_id,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,brand,updated_at&order=id.asc'),
        supabaseFetch('product_categories?select=id,slug,name,name_en,name_ru,name_cn,description'),
        supabaseFetch('public_blog_posts?select=slug,title,title_en,title_ru,title_cn,summary,summary_en,summary_ru,summary_cn,category_slug,date,updated_at,image_path&order=date.desc'),
        supabaseFetch('blog_categories?select=slug,name,name_en,name_ru,name_cn'),
        supabaseFetch('services?select=id,slug,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,image_path,updated_at&order=id.asc'),
        supabaseFetch('product_brands?select=slug,name,description,logo_path&order=name.asc'),
    ]);
    const productImages = await fetchProductImagesForProducts((products || []).map((product) => product.id), supabaseFetch);
    const blogCategoryNameMap = new Map((blogCategories || []).map((category) => [category.slug, category.name || category.slug]));

    const today = new Date().toISOString().split('T')[0];
    const latestProductLastmod = pickLatestDate((products || []).map((product) => product.updated_at), today);
    const latestBlogLastmod = pickLatestDate((posts || []).map((post) => post.updated_at || post.date), today);
    const latestServiceLastmod = pickLatestDate((services || []).map((service) => service.updated_at), today);
    const categoryLastmodById = new Map();
    const blogCategoryLastmodBySlug = new Map();
    const brandLastmodByKey = new Map();

    for (const product of products || []) {
        const productLastmod = toDateOnly(product.updated_at) || today;
        if (product.category_id !== null && product.category_id !== undefined) {
            categoryLastmodById.set(
                product.category_id,
                pickLatestDate([categoryLastmodById.get(product.category_id), productLastmod], today),
            );
        }
        const brandKey = normalizeBrandMatchKey(product.brand);
        if (brandKey) {
            brandLastmodByKey.set(
                brandKey,
                pickLatestDate([brandLastmodByKey.get(brandKey), productLastmod], today),
            );
        }
    }

    for (const post of posts || []) {
        const postLastmod = toDateOnly(post.updated_at || post.date) || today;
        if (post.category_slug) {
            blogCategoryLastmodBySlug.set(
                post.category_slug,
                pickLatestDate([blogCategoryLastmodBySlug.get(post.category_slug), postLastmod], today),
            );
        }
    }

    const entries = [
        createSitemapUrlEntry({
            path: '/',
            lastmod: today,
            changefreq: 'daily',
            priority: '1.0',
            imageUrl: DEFAULT_SHARE_IMAGE,
            imageTitle: SITE_NAME,
        }, deps),
        createSitemapUrlEntry({ path: '/san-pham', lastmod: latestProductLastmod, changefreq: 'daily', priority: '0.9' }, deps),
        createSitemapUrlEntry({ path: '/kien-thuc', lastmod: latestBlogLastmod, changefreq: 'daily', priority: '0.8' }, deps),
        createSitemapUrlEntry({ path: '/dich-vu', lastmod: latestServiceLastmod, changefreq: 'weekly', priority: '0.8' }, deps),
        createSitemapUrlEntry({ path: '/ve-chung-toi', changefreq: 'monthly', priority: '0.6' }, deps),
    ];

    const categoryMap = new Map((categories || []).map((c) => [c.id, c.slug]));
    const productImageMap = new Map();

    (productImages || []).forEach((image) => {
        const existing = productImageMap.get(image.product_id);
        if (!existing) {
            productImageMap.set(image.product_id, image);
            return;
        }
        const existingRank = existing.is_primary ? 2 : 0;
        const imageRank = image.is_primary ? 2 : 0;
        const existingOrder = Number(existing.display_order ?? Number.MAX_SAFE_INTEGER);
        const imageOrder = Number(image.display_order ?? Number.MAX_SAFE_INTEGER);
        const existingId = Number(existing.id ?? Number.MAX_SAFE_INTEGER);
        const imageId = Number(image.id ?? Number.MAX_SAFE_INTEGER);
        if (
            imageRank > existingRank
            || (imageRank === existingRank && imageOrder < existingOrder)
            || (imageRank === existingRank && imageOrder === existingOrder && imageId < existingId)
        ) {
            productImageMap.set(image.product_id, image);
        }
    });

    if (products) {
        for (const p of products) {
            const categorySlug = categoryMap.get(p.category_id) || 'khac';
            const slug = p.slug || p.id;
            const productImage = productImageMap.get(p.id)?.image_path;
            entries.push(createSitemapUrlEntry({
                path: `/san-pham/${String(categorySlug)}/${String(slug)}`,
                lastmod: p.updated_at ? String(p.updated_at).split('T')[0] : today,
                changefreq: 'weekly',
                priority: '0.8',
                imageUrl: productImage ? getStorageUrl(productImage, 'product-images') : null,
                imageTitle: buildImageTitle(p.name || String(slug), p.brand, SITE_NAME),
                alternateLangs: getAvailableLangsRequiringAll(p, ['name', 'description']),
            }, deps));
        }
    }
    for (const category of categories || []) {
        entries.push(createSitemapUrlEntry({
            path: `/san-pham/${String(category.slug)}`,
            lastmod: categoryLastmodById.get(category.id) || latestProductLastmod,
            changefreq: 'weekly',
            priority: '0.75',
            alternateLangs: getAvailableLangs(category, CATEGORY_TRANSLATION_FIELDS),
        }, deps));
    }

    if (brands && products) {
        const activeBrandKeys = new Set(
            products
                .map((product) => normalizeBrandMatchKey(product.brand))
                .filter(Boolean),
        );
        entries.push(createSitemapUrlEntry({
            path: '/thuong-hieu',
            lastmod: latestProductLastmod,
            changefreq: 'weekly',
            priority: '0.74',
            alternateLangs: ['vi'],
        }, deps));
        for (const brand of brands) {
            if (!activeBrandKeys.has(normalizeBrandMatchKey(brand.name))) continue;
            entries.push(createSitemapUrlEntry({
                path: `/thuong-hieu/${String(brand.slug)}`,
                lastmod: brandLastmodByKey.get(normalizeBrandMatchKey(brand.name)) || latestProductLastmod,
                changefreq: 'weekly',
                priority: '0.72',
                imageUrl: brand.logo_path ? getStorageUrl(brand.logo_path, 'site-assets') : null,
                imageTitle: buildImageTitle(brand.name || brand.slug, 'Logo thuong hieu', SITE_NAME),
                alternateLangs: ['vi'],
            }, deps));
        }
    }

    if (posts) {
        for (const p of posts.filter((post) => !isExcludedBlogSlug(post.slug))) {
            const categorySlug = p.category_slug || 'tong-hop';
            const postLastmod = p.updated_at
                ? String(p.updated_at).split('T')[0]
                : (p.date ? String(p.date).split('T')[0] : null);
            entries.push(createSitemapUrlEntry({
                path: `/kien-thuc/${String(categorySlug)}/${String(p.slug)}`,
                lastmod: postLastmod,
                changefreq: 'monthly',
                priority: '0.7',
                imageUrl: getResolvedBlogImageUrl(p),
                imageTitle: buildImageTitle(p.title || p.slug, blogCategoryNameMap.get(p.category_slug), SITE_NAME),
                alternateLangs: getAvailableLangsRequiringAll(p, ['title', 'summary']),
            }, deps));
        }
    }
    for (const category of blogCategories || []) {
        entries.push(createSitemapUrlEntry({
            path: `/kien-thuc/${String(category.slug)}`,
            lastmod: blogCategoryLastmodBySlug.get(category.slug) || latestBlogLastmod,
            changefreq: 'weekly',
            priority: '0.7',
            alternateLangs: getAvailableLangs(category, ['name']),
        }, deps));
    }

    if (services) {
        for (const s of services) {
            const serviceSlug = s.slug || s.id;
            entries.push(createSitemapUrlEntry({
                path: `/dich-vu/${String(serviceSlug)}`,
                lastmod: s.updated_at ? String(s.updated_at).split('T')[0] : today,
                changefreq: 'monthly',
                priority: '0.7',
                imageUrl: s.image_path ? getStorageUrl(s.image_path, 'site-assets') : null,
                imageTitle: buildImageTitle(s.name || `Dịch vụ ${serviceSlug}`, SITE_NAME),
                alternateLangs: getAvailableLangsRequiringAll(s, ['name', 'description']),
            }, deps));
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

async function generateProductSitemap(deps, { imageOnly = false } = {}) {
    const {
        supabaseFetch,
        escapeXml,
        buildAbsoluteUrl,
        getAvailableLangsRequiringAll,
        getStorageUrl,
        buildImageTitle,
        SITE_NAME,
    } = deps;

    const [products, categories] = await Promise.all([
        supabaseFetch('products?is_published=eq.true&archived_at=is.null&select=id,slug,category_id,name,name_en,name_ru,name_cn,description,description_en,description_ru,description_cn,brand,updated_at&order=id.asc'),
        supabaseFetch('product_categories?select=id,slug,name'),
    ]);
    const productImages = await fetchProductImagesForProducts((products || []).map((product) => product.id), supabaseFetch);

    const today = new Date().toISOString().split('T')[0];
    const categoryMap = new Map((categories || []).map((category) => [category.id, category.slug]));
    const productImageMap = new Map();

    for (const image of productImages || []) {
        const existing = productImageMap.get(image.product_id);
        if (!existing) {
            productImageMap.set(image.product_id, image);
            continue;
        }
        const existingRank = existing.is_primary ? 2 : 0;
        const imageRank = image.is_primary ? 2 : 0;
        const existingOrder = Number(existing.display_order ?? Number.MAX_SAFE_INTEGER);
        const imageOrder = Number(image.display_order ?? Number.MAX_SAFE_INTEGER);
        const existingId = Number(existing.id ?? Number.MAX_SAFE_INTEGER);
        const imageId = Number(image.id ?? Number.MAX_SAFE_INTEGER);
        if (
            imageRank > existingRank
            || (imageRank === existingRank && imageOrder < existingOrder)
            || (imageRank === existingRank && imageOrder === existingOrder && imageId < existingId)
        ) {
            productImageMap.set(image.product_id, image);
        }
    }

    const entries = [];
    for (const product of products || []) {
        const categorySlug = categoryMap.get(product.category_id) || 'khac';
        const slug = product.slug || product.id;
        const productImage = productImageMap.get(product.id)?.image_path;
        if (imageOnly && !productImage) continue;
        entries.push(createSitemapUrlEntry({
            path: `/san-pham/${String(categorySlug)}/${String(slug)}`,
            lastmod: product.updated_at ? String(product.updated_at).split('T')[0] : today,
            changefreq: 'weekly',
            priority: '0.8',
            imageUrl: productImage ? getStorageUrl(productImage, 'product-images') : null,
            imageTitle: buildImageTitle(product.name || String(slug), product.brand, SITE_NAME),
            alternateLangs: getAvailableLangsRequiringAll(product, ['name', 'description']),
        }, deps));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

async function generateRss(deps) {
    const { supabaseFetch, isExcludedBlogSlug, escapeXml, stripHtml, SITE_NAME, BASE_URL } = deps;
    const posts = await supabaseFetch('blog_posts?select=slug,title,summary,meta_description,date,category_slug&order=date.desc&limit=100');
    const items = (posts || []).filter((post) => !isExcludedBlogSlug(post.slug)).map((post) => {
        const title = escapeXml(post.title || post.slug || 'Bài viết');
        const categorySlug = escapeXml(post.category_slug || 'tong-hop');
        const slug = escapeXml(post.slug || '');
        const link = `${BASE_URL}/kien-thuc/${categorySlug}/${slug}`;
        const description = escapeXml(stripHtml(post.meta_description || post.summary || '').slice(0, 500));
        const pubDate = post.date ? new Date(post.date).toUTCString() : new Date().toUTCString();
        const guid = link;
        return `<item>
  <title>${title}</title>
  <link>${link}</link>
  <guid>${guid}</guid>
  <pubDate>${escapeXml(pubDate)}</pubDate>
  <description>${description}</description>
</item>`;
    }).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(SITE_NAME)} - Kiến thức da liễu</title>
  <link>${BASE_URL}/kien-thuc</link>
  <description>Tổng hợp bài viết kiến thức da liễu, trị mụn và chăm sóc da.</description>
  <language>vi-vn</language>
  ${items}
</channel>
</rss>`;

    return new Response(rss, {
        headers: {
            'Content-Type': 'application/rss+xml;charset=UTF-8',
            'Cache-Control': 'public, max-age=1800',
        },
    });
}

export async function maybeHandleSeoFeedRoute(route, deps) {
    const { request, path, host, url } = route;
    const { BASE_URL, CANONICAL_HOST } = deps;

    const googleVerifyMatch = path.match(/^\/(google[a-zA-Z0-9]+\.html)$/);
    if (googleVerifyMatch) {
        return new Response(`google-site-verification: ${googleVerifyMatch[1]}`, {
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }

    if (host === `www.${CANONICAL_HOST}`) {
        url.hostname = CANONICAL_HOST;
        return Response.redirect(url.toString(), 301);
    }

    if (path === '/robots.txt') {
        const privateDisallows = [
            '/admin',
            '/admin/',
            '/tai-khoan',
            '/ho-so',
            '/benh-an',
            '/ho-so-y-te',
            '/thanh-toan',
            '/dang-nhap',
            '/dat-hang-thanh-cong',
            '/tra-cuu-don-hang',
        ];
        const aiUserAgents = [
            'GPTBot',
            'ChatGPT-User',
            'OAI-SearchBot',
            'Google-Extended',
            'ClaudeBot',
            'Claude-User',
            'anthropic-ai',
            'PerplexityBot',
            'Perplexity-User',
            'Applebot',
            'Applebot-Extended',
            'CCBot',
            'Amazonbot',
            'meta-externalagent',
            'Bytespider',
        ];
        const privateRules = privateDisallows.map((rule) => `Disallow: ${rule}`).join('\n');
        const aiRules = aiUserAgents.map((agent) => `User-agent: ${agent}
Content-Signal: search=yes,ai-input=yes,ai-train=yes
Allow: /
${privateRules}`).join('\n\n');

        const robotsBody = `${aiRules}

User-agent: *
Content-Signal: search=yes,ai-input=yes,ai-train=yes
Allow: /
${privateRules}

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap-products.xml
Sitemap: ${BASE_URL}/sitemap-images.xml
Sitemap: ${BASE_URL}/rss.xml
`;
        return new Response(robotsBody, {
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8',
                'Cache-Control': 'public, max-age=300, must-revalidate',
            },
        });
    }

    if (path === '/sitemap.xml') {
        try {
            return await generateSitemap(deps);
        } catch (err) {
            console.error('Sitemap error:', err);
        }
    }

    if (path === '/sitemap-products.xml') {
        try {
            return await generateProductSitemap(deps);
        } catch (err) {
            console.error('Product sitemap error:', err);
        }
    }

    if (path === '/sitemap-images.xml') {
        try {
            return await generateProductSitemap(deps, { imageOnly: true });
        } catch (err) {
            console.error('Image sitemap error:', err);
        }
    }

    if (path === '/rss.xml') {
        try {
            return await generateRss(deps);
        } catch (err) {
            console.error('RSS error:', err);
        }
    }

    if (path === '/nha-thuoc') {
        return Response.redirect(`${BASE_URL}/san-pham`, 301);
    }

    return null;
}
