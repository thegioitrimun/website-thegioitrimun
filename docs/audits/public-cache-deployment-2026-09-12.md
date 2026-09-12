# Public cache deployment — 2026-09-12

Production Worker version: `c59dacd3-0904-470f-9a25-56caaea30957`.
Migration `0024_public_cache_versions` applied successfully.

## Policy

| Resource | Edge TTL |
|---|---:|
| Product lists/details and image relations | 180 seconds |
| Categories, brands, articles, services and public site content | 1800 seconds |
| Product reviews | 300 seconds |
| Ingredient snapshots | 900 seconds |
| Homepage/full bootstrap | 180 seconds |
| Deferred homepage bootstrap | 1800 seconds |
| Newly uploaded images with content-hashed URLs | 1 year, immutable |

API browsers must revalidate (`no-cache, max-age=0, must-revalidate`). Shared
caching is managed by the Worker, with `CDN-Cache-Control: no-store` on outgoing
responses. D1 frontend memory TTL is disabled; in-flight request deduplication remains.
Already-open pages are not pushed new content: the next network request uses the
current version. The existing checkout reads authoritative product data.

## Invalidation and costs

Database triggers increment scoped versions transactionally for meaningful changes
to products, images, categories, brands, services, procedure steps, blog content,
public site content, reviews and ingredient snapshots. This covers writes from
admin, Pancake, checkout and scripts. Timestamp-only updates do not flush caches.
A request reads the single primary D1 revision row before selecting its edge key.
Measured revision query cost: **1 row read**. Cache hits avoid catalog/image scans,
but are not zero-D1-read requests. Revision updates add a small write cost on mutation.
Private responses, errors and responses with cookies are not stored. If the version
lookup fails, body caching is bypassed rather than serving an unchecked old version.
An in-flight response uses the version captured before loading its body, so it cannot
repopulate the new version after a concurrent update.

The active Worker imports `productSyncD1.js`. The earlier dirty-set change had been
made to the legacy `productSync.js`; this deployment moves it into the active D1
module and re-exports it for legacy callers/tests, removing the recurring scan.

## Validation

- 60 targeted Node tests passed; 10 real SQLite tests passed; 5 email tests passed.
- TypeScript/Vite build and D1 frontend/Worker bundle audits passed.
- The broad suite had 6 failures; all 6 reproduced against HEAD in an isolated
  baseline: branding/hero layout, legacy product deletion contract, SEO controls.
- Live catalog probe returned MISS → HIT → version increment → MISS → HIT.
  Every response retained 48 products and 227 images; same HKG edge location.
- Blog, categories, homepage bootstrap and ingredient snapshot each returned MISS
  followed by HIT with their intended TTL. Homepage HTTP 200; bootstrap not partial.
- The production probe increments only the cache version, not business data.
- An unrelated concurrent DoctorForm edit was preserved and excluded from the
  isolated release build.

## References

Cloudflare Cache API does not implement stale-while-revalidate for cache.put/match;
this implementation uses explicit TTL and versioned keys instead:
https://developers.cloudflare.com/workers/runtime-apis/cache/

D1 requests without Sessions API read the primary:
https://developers.cloudflare.com/d1/worker-api/d1-database/
