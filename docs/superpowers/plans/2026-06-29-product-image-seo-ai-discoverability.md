# Product Image SEO And AI Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every published product on thegioitrimun.vn clearly discoverable by Google Images, Google product/merchant surfaces, and AI/browser agents with correct product-detail URLs, product-specific images, and trustworthy machine-readable context.

**Architecture:** Treat each product detail page as the canonical source of truth for its primary image, metadata, offer, brand, ingredients, and usage. Listing pages may display thumbnails, but they must not compete with product detail pages for the same image identity. Add a controlled public catalog/feed layer for search engines and AI agents without exposing admin, checkout, account, or private data.

**Tech Stack:** React + Vite + TypeScript frontend, Cloudflare Pages/Worker SEO prerender, Supabase Postgres/R2 images, JSON-LD schema.org, XML sitemaps, Google Merchant Center feed, Playwright + curl smoke tests.

---

## Source Guidance To Follow

- Google Image SEO: image context, descriptive filenames, alt/title/caption, structured data, image sitemaps.
- Google Product/Merchant structured data: Product + Offer, price, availability, images, brand, SKU, merchant listing eligibility.
- Google generative AI guidance: AI visibility still depends on foundational SEO, crawlability, valuable content, and technical clarity. Do not depend on “AI-only hacks”.
- Google Merchant Center product data: build an explicit feed so Google can match product URLs, image URLs, price, availability, and titles.

---

## Files And Responsibilities

- `_worker.js`: inject shared SEO helpers/dependencies, public routes, robots, and canonical URL/image helpers.
- `worker/seo/prerenderDetail.js`: product detail HTML, Product JSON-LD, canonical image identity, related products.
- `worker/seo/prerenderIndex.js`: homepage/listing/brand prerender, thumbnail-only listing images, crawlable product links.
- `worker/seo/feeds.js`: sitemap, image sitemap, product URL feed.
- `worker/seo/merchantFeed.js`: new Google Merchant Center product feed route.
- `worker/seo/aiCatalog.js`: new AI-readable public product/service catalog route.
- `src/imageSeo.ts`: frontend image URL helpers, listing thumbnail URL helper, canonical product image URL helper.
- `components/product-listing/ProductCard.tsx`: crawlable product cards and image alt text.
- `components/ProductSliderSection.tsx`: crawlable homepage product cards and listing thumbnails.
- `components/ProductDetailPage.tsx`: visible product media, alt/caption, semantic content sections.
- `types.ts`: product image SEO fields if schema expands.
- `supabase/migrations/*product_image_seo*.sql`: optional DB columns for image alt/caption/width/height/hash/role.
- `scripts/audit_image_seo_paths.mjs`: audit duplicate image URLs, missing alt/caption, and homepage/detail conflicts.
- `scripts/submit_sitemaps_or_report.mjs`: generate Search Console/Merchant Center manual checklist output if API credentials are unavailable.
- `e2e/seo/product-image-seo.spec.ts`: Googlebot and DOM smoke tests.

---

## Phase 1: Baseline Audit And Inventory

### Task 1: Build product image SEO inventory

**Files:**
- Create: `scripts/export_product_image_seo_inventory.mjs`
- Output: `tmp/product-image-seo-inventory.json`

- [ ] Query public products from `https://thegioitrimun.vn/api/public/rest/products` using `is_published=eq.true&archived_at=is.null`.
- [ ] For every product, select the same representative image as the frontend: `is_primary=true` first, then lowest `display_order`.
- [ ] Record: `product_id`, `slug`, `name`, `brand`, `category`, `canonical_url`, `primary_image_path`, `primary_image_url`, `image_id`, `is_primary`, `display_order`.
- [ ] Detect products with no image, duplicate primary image URLs, duplicate filenames, and image URLs appearing on both listing and detail pages without a listing-thumbnail query.
- [ ] Save JSON report and print counts.

### Task 2: Crawl current SEO output with Googlebot UA

**Files:**
- Create: `scripts/audit_live_googlebot_product_pages.mjs`

- [ ] Crawl 20 representative product URLs and 5 category/brand/listing URLs.
- [ ] Verify each product page has one canonical URL, one `og:url`, one `og:image`, one `rel=image_src`, one Product JSON-LD block, and no homepage canonical.
- [ ] Verify listing pages use thumbnail variant URLs, not canonical detail image URLs.
- [ ] Fail if a product image appears on homepage/listing without `seo_context=listing-thumb`.

---

## Phase 2: Canonical Product Image Model

### Task 3: Add/normalize product image SEO metadata

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_product_image_seo_metadata.sql`
- Modify: `types.ts`

- [ ] Add nullable columns to `product_images`: `seo_alt text`, `seo_caption text`, `image_width integer`, `image_height integer`, `content_hash text`, `image_role text default 'gallery'`.
- [ ] Add index on `(product_id, is_primary, display_order)` if missing.
- [ ] Backfill `seo_alt` as `[Product name] - [Brand] - Thế Giới Trị Mụn` for primary images.
- [ ] Backfill `seo_caption` as a readable product caption, not keyword stuffing.
- [ ] Keep old images and paths intact.

### Task 4: Create canonical and listing image URL helpers

**Files:**
- Modify: `src/imageSeo.ts`
- Modify: `_worker.js`

- [ ] Ensure product detail pages use raw canonical image URL: `/r2/product-images/products/.../primary.webp`.
- [ ] Ensure homepage/listing/related product images use a distinct derivative URL with query like `?seo_context=listing-thumb&w=480`.
- [ ] Ensure query params preserve valid image rendering but differentiate Google Images source attribution.
- [ ] Add unit-style script assertions for representative URLs.

---

## Phase 3: Product Detail SEO Hardening

### Task 5: Harden Product JSON-LD

**Files:**
- Modify: `worker/seo/prerenderDetail.js`
- Modify: `_worker.js`

- [ ] Product detail JSON-LD must include: `@type: Product`, `name`, `description`, `image`, `brand`, `sku`, `category`, `url`, and `offers`.
- [ ] `offers` must include: `@type: Offer`, `url`, `priceCurrency: VND`, numeric `price`, and schema availability based on stock/publish state.
- [ ] Include `aggregateRating` or `review` only if real review data exists. Do not generate fake stars.
- [ ] Include `additionalProperty` for `volume`, `origin`, `texture`, key ingredients, and suitable skin concerns where data exists.
- [ ] Ensure `image` is an array: primary image first, then additional gallery images.

### Task 6: Make visible page content match structured data

**Files:**
- Modify: `components/ProductDetailPage.tsx`

- [ ] Product H1 must exactly match product name.
- [ ] Primary image `alt` must be product-specific: `[Tên sản phẩm] - [thương hiệu]`.
- [ ] Product detail page must show a short visible caption/brand/source near image where design allows.
- [ ] Ingredients, usage, suitability, benefits, origin, volume, and brand text must be crawlable HTML, not only hidden state.

---

## Phase 4: Listing Pages Must Not Steal Image Attribution

### Task 7: Make listing cards crawlable but thumbnail-scoped

**Files:**
- Modify: `components/product-listing/ProductCard.tsx`
- Modify: `components/ProductSliderSection.tsx`
- Modify: `worker/seo/prerenderIndex.js`

- [ ] Every product card has a real `<a href="/san-pham/...">` link.
- [ ] Listing images use `buildListingImageUrl()`.
- [ ] Listing `alt` can be shorter, but must remain product-specific.
- [ ] Buttons inside cards stop propagation and do not break the anchor.
- [ ] Homepage source HTML for Googlebot contains product links, but listing thumbnail URLs do not equal detail canonical image URLs.

---

## Phase 5: Image Sitemap And Product Sitemap

### Task 8: Expand image sitemap quality

**Files:**
- Modify: `worker/seo/feeds.js`

- [ ] Product detail `<url>` entries include `<image:image>`.
- [ ] `<image:loc>` uses canonical primary image URL for product detail pages.
- [ ] `<image:title>` uses product name + brand.
- [ ] `<image:caption>` uses readable caption: product, brand, clinic/store identity.
- [ ] Do not put listing-thumbnail query URLs into image sitemap.

### Task 9: Add sitemap index and targeted product sitemap if missing

**Files:**
- Modify: `worker/seo/feeds.js`

- [ ] Keep `/sitemap.xml` valid.
- [ ] Add `/sitemap-products.xml` for product URLs only if current sitemap is too broad or slow.
- [ ] Add `/sitemap-images.xml` if image entries should be isolated for easier Search Console monitoring.
- [ ] Include `lastmod` from product `updated_at` where available.

---

## Phase 6: Google Merchant Center Feed

### Task 10: Create Merchant Center product feed

**Files:**
- Create: `worker/seo/merchantFeed.js`
- Modify: `_worker.js`

- [ ] Add route `/feeds/google-products.xml` or `/feeds/google-products.tsv`.
- [ ] Include only published, non-archived products with valid price and primary image.
- [ ] Fields: `id`, `title`, `description`, `link`, `image_link`, `additional_image_link`, `availability`, `price`, `brand`, `condition`, `product_type`.
- [ ] Use canonical product URL for `link`, canonical image URL for `image_link`.
- [ ] Exclude medical claims not present on page.
- [ ] Add cache control suitable for feed refresh, for example `max-age=3600`.

### Task 11: Merchant validation workflow

**Files:**
- Create: `docs/seo/google-merchant-center-setup.md`

- [ ] Document where to add feed URL in Merchant Center.
- [ ] Document required manual checks: shipping, returns, tax/VAT policy, business verification, product disapprovals.
- [ ] Document that product page structured data and feed data must match price/availability.

---

## Phase 7: AI Discoverability And Agent-Friendly Catalog

### Task 12: Add AI-readable public catalog

**Files:**
- Create: `worker/seo/aiCatalog.js`
- Modify: `_worker.js`

- [ ] Add `/ai/products.json` with concise product records: `id`, `name`, `brand`, `url`, `image`, `price`, `availability`, `category`, `short_description`, `ingredients`, `usage`, `benefits`, `warnings`.
- [ ] Add `/ai/services.json` with service name, URL, indications, contraindications, expected result, and booking CTA.
- [ ] Add `/ai/site-profile.json` with business identity, location, specialties, contact channels, and operating scope.
- [ ] Do not expose admin, customers, orders, phone numbers, emails, or private analytics.
- [ ] Add `Cache-Control` and `X-Robots-Tag` policy intentionally: indexable only if we want search engines to index JSON; otherwise crawlable but noindex for utility.

### Task 13: Add optional `llms.txt` for non-Google AI systems

**Files:**
- Create: `worker/seo/llmsText.js`
- Modify: `_worker.js`

- [ ] Add `/llms.txt` linking to top product categories, services, policies, AI catalog JSON, and sitemap.
- [ ] Explicitly note this is for third-party AI tools; do not treat it as a Google ranking factor.
- [ ] Keep it short and maintained automatically from live public data.

### Task 14: Make the site easier for browser agents

**Files:**
- Modify: `components/ProductDetailPage.tsx`
- Modify: `components/CheckoutPage.tsx`
- Modify: `components/OrderLookupPage.tsx`

- [ ] Add clear accessible names for add-to-cart, quantity controls, checkout, order lookup, Zalo/Messenger buttons.
- [ ] Add stable `data-testid`/`data-agent-action` only for important public conversion actions.
- [ ] Ensure guest checkout fields have labels, autocomplete attributes, and validation messages.
- [ ] Ensure product price/availability are visible text and not only icons.

---

## Phase 8: Local Authority And Trust

### Task 15: Strengthen local entity signals

**Files:**
- Modify: `worker/seo/prerenderDetail.js`
- Modify: `worker/seo/prerenderIndex.js`
- Modify: `components/AboutPage.tsx`
- Create: `docs/seo/local-entity-checklist.md`

- [ ] Add Organization/LocalBusiness/MedicalBusiness JSON-LD on homepage and about page where appropriate.
- [ ] Keep name/address/phone/social/profile data consistent with Google Business Profile.
- [ ] Product pages should reference distributor/official brand status only when true.
- [ ] Service pages should include doctor/expert review and medical disclaimer where needed.

### Task 16: Content trust cleanup

**Files:**
- Modify product content through admin/database import, not hardcoded files.

- [ ] Product descriptions must be accurate, not overclaim treatment/cure effects.
- [ ] Ingredients and usage must be separated into crawlable sections.
- [ ] Add “phù hợp với”, “không phù hợp nếu”, and “cần hỏi bác sĩ nếu” where relevant.
- [ ] Add internal links from articles/services to product detail pages with descriptive anchor text.

---

## Phase 9: Testing And Monitoring

### Task 17: Add automated SEO regression tests

**Files:**
- Create: `e2e/seo/product-image-seo.spec.ts`
- Modify: `package.json`

- [ ] Test 10 product URLs with Googlebot UA.
- [ ] Assert canonical URL equals product URL.
- [ ] Assert Product JSON-LD image equals primary image.
- [ ] Assert no product page falls back to homepage title/canonical.
- [ ] Assert homepage/listing images use listing-thumbnail URLs.
- [ ] Add command: `npm run qa:seo-images`.

### Task 18: Add live post-deploy verification script

**Files:**
- Create: `scripts/verify_live_product_image_seo.mjs`

- [ ] Fetch `/sitemap.xml`, pick 20 product URLs.
- [ ] Fetch each URL as Googlebot.
- [ ] Validate `title`, canonical, `og:url`, `og:image`, `image_src`, Product JSON-LD, and image sitemap entry.
- [ ] Print failed URLs with exact reason.

### Task 19: Search Console monitoring workflow

**Files:**
- Create: `docs/seo/search-console-image-seo-workflow.md`

- [ ] Submit `/sitemap.xml`, `/sitemap-products.xml`, `/sitemap-images.xml` if added.
- [ ] Inspect representative product URLs and request indexing after deployment.
- [ ] Monitor: Search results, Image search tab, Product snippets, Merchant listings, indexing coverage.
- [ ] Track queries by product name, brand + product, and use-case keyword.

---

## Acceptance Criteria

- Every published product has one canonical product URL and one primary canonical image URL.
- Googlebot HTML for product detail never falls back to homepage title/canonical.
- Listing pages use thumbnail-scoped image URLs and real product anchors.
- Product sitemap and image sitemap contain accurate product image title/caption.
- Merchant feed validates and uses same price/availability/image as product pages.
- AI catalog exposes public product/service facts without private data.
- Automated `qa:seo-images` passes locally and after deploy.
- Search Console shows product detail URLs indexed and image impressions attributed increasingly to product URLs over time.

---

## Rollout Strategy

1. Ship Phase 1 audit only and store the baseline.
2. Ship Phase 2-5 technical SEO fixes.
3. Deploy and verify 20-30 representative URLs.
4. Submit sitemap and inspect key product URLs in Search Console.
5. Ship Merchant Center feed and validate manually.
6. Ship AI catalog and browser-agent accessibility improvements.
7. Monitor for 2-4 weeks; do not expect Google Images to update instantly.

---

## Risks And Guardrails

- Do not create fake reviews or ratings.
- Do not keyword-stuff alt text/captions.
- Do not remove old product images unless explicitly requested.
- Do not expose admin/order/customer data in AI catalog.
- Do not assume `llms.txt` improves Google visibility; use it only as a convenience for non-Google systems.
- Do not make listing thumbnails canonical image sitemap entries.
