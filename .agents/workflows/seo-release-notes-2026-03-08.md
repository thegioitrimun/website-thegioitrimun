# SEO RELEASE NOTES

## Release Info
- Date: 2026-03-08
- Release name: seo-foundation-phase-1
- Prepared by: Codex

## 1) Scope
- Primary objective: Ship technical SEO foundation and improve web performance for crawl/index and mobile UX.
- Affected pages/modules: App router SEO layer, i18n detection, blog/product detail SEO behavior, build chunking strategy.

## 2) Implemented Changes
1. Centralized SEO engine (`title`, `description`, canonical, hreflang, OG/Twitter, robots).
- Files: `src/seo.ts`, `App.tsx`, `index.html`.
- Acceptance check: metadata updates correctly per route and locale.

2. Added locale-aware URL behavior using `?lang=`.
- Files: `src/i18n.ts`, `App.tsx`.
- Acceptance check: language can be restored from URL query on navigation/back-forward.

3. Removed conflicting per-page canonical/meta overrides while keeping JSON-LD detail schemas.
- Files: `components/BlogPostPage.tsx`, `components/ProductDetailPage.tsx`.
- Acceptance check: no duplicate canonical mutations from nested components.

4. Added sitemap fallback file.
- Files: `public/sitemap.xml`.
- Acceptance check: `/sitemap.xml` exists even before dynamic worker generation.

5. Improved SEO internal linking with conversion CTA in blog post detail.
- Files: `components/BlogPostPage.tsx`, `App.tsx`.
- Acceptance check: blog pages link users to service and pharmacy hubs.

6. Performance optimization via route-level lazy loading and vendor chunk splitting.
- Files: `App.tsx`, `vite.config.js`.
- Acceptance check: build outputs split chunks; entry chunk reduced significantly vs previous build.

7. Advanced chunk split optimization for app core modules.
- Files: `App.tsx`, `components/HomePageContent.tsx`, `vite.config.js`, `components/AdminBlogManagementPage.tsx`, `components/AdminPharmacyManagementPage.tsx`.
- Acceptance check: entry chunk reduced from ~`573 kB` to ~`142 kB` (minified), with app code separated into `app-api`, `app-icons`, `app-gemini`, `HomePageContent`, and `xlsx`.

## 3) Validation
- Build status: PASS (`npm run build`)
- Metadata validation: PASS (manual code inspection)
- Structured data validation: PASS (JSON-LD still present on service/blog/product pages)
- Internal link check: PASS (blog detail CTA links added)
- Manual QA pages: `/`, `/dich-vu`, `/san-pham/:slug`, `/kien-thuc/:slug`, `/admin`

## 4) Risks
- Known limitations: `xlsx` chunk remains large (~429 kB) but now lazy loaded only when admin import/export is used.
- Rollback plan: revert changed files in this release and redeploy previous stable tag.

## 5) Post-Release Monitoring
- Metrics to watch (7 days): CWV mobile, GSC indexing coverage, organic CTR for service/blog/product landing pages.
- Alert threshold: CWV pass rate drop >10% or sudden deindexing on core landing URLs.
