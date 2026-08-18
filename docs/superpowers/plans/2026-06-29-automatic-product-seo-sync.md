# Automatic Product SEO Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public product update automatically refresh the website SEO surface, AI discovery catalogs, and Google Merchant product feed without requiring manual deploys.

**Architecture:** The website already generates product SEO surfaces dynamically from Supabase through Cloudflare Pages/Worker routes. The missing layer is a reliable product-change event pipeline that updates timestamps, warms critical URLs, records sync status, and optionally calls Google APIs when credentials are available. Google Merchant should consume the hosted XML feed by scheduled fetch or Merchant API, while Google Search uses dynamic sitemaps plus optional Search Console API submission.

**Tech Stack:** Supabase Postgres triggers, Cloudflare Pages/Worker routes, Google Search Console API, Google Merchant Center scheduled fetch or Merchant API, Node QA scripts.

## Implementation Status

- Done: added `catalog_seo_events` with triggers on products, product images, product categories, and product brands.
- Done: product image changes now touch parent `products.updated_at`, so product sitemap `lastmod` can change without a frontend deploy.
- Done: `/ai/products.json` and `/ai/services.json` now expose `data_version` and use short public cache.
- Done: `/feeds/google-products.xml` now uses short public cache and exposes `X-Product-Feed-Items`.
- Done: added `seo:submit-sitemaps`, `qa:merchant-feed`, and `qa:seo-sync`.
- Done: added scheduled/manual GitHub Actions workflow `.github/workflows/seo-catalog-sync.yml`.
- Done: submitted `sitemap.xml`, `sitemap-products.xml`, and `sitemap-images.xml` to Google Search Console successfully.
- External: Google Merchant Center scheduled fetch still must be configured in Merchant Center, or a Merchant API integration needs merchant account credentials and Merchant API scope.

---

## Current Behavior

- `/sitemap-products.xml`, `/sitemap-images.xml`, `/feeds/google-products.xml`, `/ai/products.json`, `/ai/services.json`, and `/llms.txt` are generated dynamically from Supabase at request time.
- Product detail SEO for Googlebot is generated dynamically from Supabase product data and product images.
- Product updates do not require a frontend rebuild or Cloudflare deploy to appear in those dynamic endpoints.
- Google Search does not instantly index changes; sitemaps are a discovery hint, not an indexing guarantee.
- Google Merchant will only refresh product data automatically if Merchant Center is configured to scheduled-fetch `/feeds/google-products.xml`, or if we integrate the Merchant API.

## File Structure

- Modify: `supabase/migrations/<timestamp>_catalog_seo_sync_events.sql`
  - Add `catalog_seo_events` table.
  - Add triggers on `products`, `product_images`, and product taxonomy tables.
  - Ensure product `updated_at` changes whenever SEO-relevant fields or images change.
- Modify: `worker/seo/feeds.js`
  - Keep sitemap product `lastmod` tied to the latest product or image update.
  - Add stable cache headers for SEO surfaces.
- Modify: `worker/seo/merchantFeed.js`
  - Add optional `g:additional_image_link`, availability, SKU/ID consistency, and diagnostics-safe output.
- Modify: `worker/seo/aiCatalog.js`
  - Add `generated_at`, `updated_at`, and `data_version` fields for product records.
- Create: `worker/seo/syncStatus.js`
  - Internal endpoint for checking latest product event and endpoint freshness.
- Create: `scripts/qa_product_seo_sync.mjs`
  - Checks that a changed product appears consistently in product detail SEO, product sitemap, image sitemap, merchant feed, and AI catalog.
- Create: `scripts/google_search_console_submit_sitemaps.mjs`
  - Optional script using OAuth credentials to submit sitemaps through Search Console API.
- Create: `scripts/google_merchant_feed_healthcheck.mjs`
  - Checks feed size, required tags, duplicate IDs, invalid URLs, missing image links, price/availability issues.
- Modify: `package.json`
  - Add `qa:seo-sync`, `qa:merchant-feed`, and optional `seo:submit-sitemaps`.

## Task 1: Make Product Updates Mark SEO Data Dirty

**Files:**
- Create: `supabase/migrations/<timestamp>_catalog_seo_sync_events.sql`

- [ ] **Step 1: Add a `catalog_seo_events` table**

```sql
create table if not exists public.catalog_seo_events (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('product', 'product_image', 'product_category', 'product_brand')),
  entity_id text not null,
  product_id bigint,
  event_type text not null check (event_type in ('insert', 'update', 'delete')),
  public_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists catalog_seo_events_created_at_idx
  on public.catalog_seo_events (created_at desc);

create index if not exists catalog_seo_events_product_id_idx
  on public.catalog_seo_events (product_id, created_at desc);
```

- [ ] **Step 2: Add trigger function to record product changes**

```sql
create or replace function public.record_product_seo_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  changed_product_id bigint;
  changed_entity_id text;
  changed_event_type text;
begin
  changed_event_type := lower(tg_op);

  if tg_table_name = 'products' then
    changed_product_id := coalesce(new.id, old.id);
    changed_entity_id := changed_product_id::text;

    if tg_op in ('INSERT', 'UPDATE') then
      new.updated_at := now();
    end if;
  elsif tg_table_name = 'product_images' then
    changed_product_id := coalesce(new.product_id, old.product_id);
    changed_entity_id := coalesce(new.id, old.id)::text;

    update public.products
      set updated_at = now()
      where id = changed_product_id;
  else
    changed_entity_id := coalesce(new.id, old.id)::text;
  end if;

  insert into public.catalog_seo_events (
    entity_type,
    entity_id,
    product_id,
    event_type,
    payload
  )
  values (
    case
      when tg_table_name = 'products' then 'product'
      when tg_table_name = 'product_images' then 'product_image'
      when tg_table_name = 'product_categories' then 'product_category'
      when tg_table_name = 'product_brands' then 'product_brand'
      else tg_table_name
    end,
    changed_entity_id,
    changed_product_id,
    changed_event_type,
    jsonb_build_object('table', tg_table_name)
  );

  return coalesce(new, old);
end;
$$;
```

- [ ] **Step 3: Attach triggers**

```sql
drop trigger if exists products_record_product_seo_event on public.products;
create trigger products_record_product_seo_event
before insert or update or delete on public.products
for each row execute function public.record_product_seo_event();

drop trigger if exists product_images_record_product_seo_event on public.product_images;
create trigger product_images_record_product_seo_event
after insert or update or delete on public.product_images
for each row execute function public.record_product_seo_event();
```

- [ ] **Step 4: Verify**

Run:

```sql
update public.products
set name = name
where id = (select id from public.products where is_published = true limit 1);

select *
from public.catalog_seo_events
order by created_at desc
limit 5;
```

Expected: at least one recent `product` event exists.

## Task 2: Make Dynamic SEO Surfaces Clearly Fresh

**Files:**
- Modify: `worker/seo/feeds.js`
- Modify: `worker/seo/merchantFeed.js`
- Modify: `worker/seo/aiCatalog.js`

- [ ] **Step 1: Ensure product sitemap `lastmod` changes after product image changes**

Use the product `updated_at` updated by the `product_images` trigger. Product sitemap entries should continue using `product.updated_at`.

- [ ] **Step 2: Add `data_version` to AI catalog**

Each AI payload should include:

```js
data_version: records
  .map((record) => record.updated_at || '')
  .sort()
  .at(-1) || null
```

- [ ] **Step 3: Keep feed cache predictable**

Use:

```js
'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600'
```

for `/feeds/google-products.xml` and `/ai/products.json` if faster update visibility is needed.

- [ ] **Step 4: Verify**

Run:

```bash
SEO_AUDIT_BASE_URL=https://thegioitrimun.vn SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-images
SEO_AUDIT_BASE_URL=https://thegioitrimun.vn SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-googlebot-products
```

Expected: both commands exit `0`.

## Task 3: Configure Google Merchant Automatic Refresh

**Files:**
- No repo change required for scheduled fetch.
- Optional create: `docs/seo/google-merchant-setup.md`

- [ ] **Step 1: In Google Merchant Center, create or edit product data source**

Use this URL:

```text
https://thegioitrimun.vn/feeds/google-products.xml
```

- [ ] **Step 2: Configure scheduled updates**

Set Merchant Center scheduled fetch to daily at minimum. If prices or stock change often, set it to the shortest available interval in the Merchant UI.

- [ ] **Step 3: Confirm IDs remain stable**

The feed uses product `sku` or database `id` as `<g:id>`. Do not change the ID strategy after Merchant Center has accepted the feed, otherwise Google may treat products as new items.

- [ ] **Step 4: Verify**

Run:

```bash
SEO_AUDIT_BASE_URL=https://thegioitrimun.vn SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-images
```

Expected: `/feeds/google-products.xml` has `itemCount > 0`, `linkCount === itemCount`, and `imageLinkCount === itemCount`.

## Task 4: Add Optional Search Console API Submission

**Files:**
- Create: `scripts/google_search_console_submit_sitemaps.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create script**

The script should submit:

```text
https://thegioitrimun.vn/sitemap.xml
https://thegioitrimun.vn/sitemap-products.xml
https://thegioitrimun.vn/sitemap-images.xml
```

through the Search Console API with OAuth scope:

```text
https://www.googleapis.com/auth/webmasters
```

- [ ] **Step 2: Add package script**

```json
"seo:submit-sitemaps": "node scripts/google_search_console_submit_sitemaps.mjs"
```

- [ ] **Step 3: Credential handling**

Use environment variables only:

```text
GOOGLE_SEARCH_CONSOLE_CLIENT_ID
GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET
GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://thegioitrimun.vn/
```

Never commit OAuth secrets.

- [ ] **Step 4: Verify**

Run:

```bash
npm run seo:submit-sitemaps
```

Expected: script returns `200` or `204` for each sitemap submit request.

## Task 5: Add Post-Update QA Button or Admin Job

**Files:**
- Modify: `components/AdminPharmacyManagementPage.tsx`
- Create: `worker/adminTools/seoSync.js`

- [ ] **Step 1: Add admin action**

Add a button in product admin:

```text
Kiểm tra SEO sản phẩm
```

It calls an internal Worker endpoint with the product ID.

- [ ] **Step 2: Worker endpoint checks one product**

The endpoint should verify:

- Product detail URL returns `200` to Googlebot.
- Canonical is product detail URL, not homepage.
- Product JSON-LD exists.
- `og:image` exists.
- Product URL appears in `/sitemap-products.xml`.
- Product image appears in `/sitemap-images.xml`.
- Product appears in `/feeds/google-products.xml`.
- Product appears in `/ai/products.json`.

- [ ] **Step 3: Display status**

Admin should show:

```text
SEO detail: OK
Sitemap sản phẩm: OK
Sitemap ảnh: OK
Merchant feed: OK
AI catalog: OK
Google index: chờ Google crawl
```

## Task 6: Monitoring and Alerts

**Files:**
- Create: `scripts/monitor_product_seo_surfaces.mjs`
- Modify: `package.json`
- Optional: Cloudflare Cron Trigger

- [ ] **Step 1: Nightly monitor**

Check:

- sitemap product count
- image sitemap count
- merchant feed item count
- AI product count
- 20 random Googlebot product pages

- [ ] **Step 2: Alert on mismatch**

Alert if:

- feed item count differs from sitemap product count by more than expected exclusions
- any product feed item has missing image, price, or URL
- any product detail canonical points to homepage
- any product detail returns SPA shell for Googlebot

- [ ] **Step 3: Run command**

```bash
SEO_AUDIT_BASE_URL=https://thegioitrimun.vn SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-images
SEO_AUDIT_BASE_URL=https://thegioitrimun.vn SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-googlebot-products
```

Expected: both commands exit `0`.

## Operating Model

After this plan is implemented:

1. Admin edits product in Supabase-backed admin.
2. Product `updated_at` changes automatically.
3. SEO event is recorded.
4. Dynamic product page, sitemap, image sitemap, Merchant feed, and AI catalog reflect the update without deploy.
5. Merchant Center fetches the hosted feed on schedule.
6. Google Search discovers updated `lastmod` through submitted sitemaps and `robots.txt`.
7. Admin/cron QA detects if any SEO surface drifts.

## References

- Google Search Central: Build and submit a sitemap  
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Console API  
  https://developers.google.com/webmaster-tools
- Google Merchant Center scheduled updates  
  https://support.google.com/merchants/answer/14991445
- Google Merchant API data sources  
  https://developers.google.com/merchant/api/guides/data-sources/api-sources
