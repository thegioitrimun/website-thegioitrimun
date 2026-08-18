# Site Regression Test Program

- Scope: public site, SEO surfaces, long blog content integrity, admin dashboard data sanity, admin dashboard UI.
- Goal: catch regressions from frontend routing, worker SEO, dashboard changes, and long-content rendering before they reach production users.

## Local commands

- Full site regression:
  - `SUPABASE_ACCESS_TOKEN=... E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... PLAYWRIGHT_BASE_URL=https://thegioitrimun.vn npm run qa:site-regression`
- Admin-only regression:
  - `SUPABASE_ACCESS_TOKEN=... E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... PLAYWRIGHT_BASE_URL=https://thegioitrimun.vn npm run qa:admin-regression`

## Coverage

- `npm run lint`
  - static code health
- `npm run build`
  - typecheck + production build viability
- `npm run qa:smoke`
  - live storefront health
- `npm run qa:seo:ci`
  - live SEO guardrails and schema presence
- `npm run qa:blog-content`
  - compares long-article payloads between `blog_posts` and `public_blog_posts`
- `npm run qa:admin-dashboard`
  - live metrics anomaly audit
- `npm run qa:site-critical:e2e`
  - homepage
  - long blog detail
  - product detail
  - service detail
  - brand directory / brand landing / filtered catalog
- `npm run qa:admin-dashboard:e2e`
  - admin login
  - overview navigation
  - order bulk-action shell
  - scheduled report CRUD

## GitHub Actions

- `Site Regression`
  - runs on every push to `main`
  - covers public-site regression stack
- `Admin Dashboard E2E`
  - runs on every push to `main`
  - covers admin UI plus dashboard audit
- `SEO Regression`
  - runs on every push to `main` and daily
- `Admin Dashboard Audit`
  - scheduled data anomaly audit

## Pass criteria

- No failing static/build checks
- No smoke failures on live domain
- No blocking SEO findings
- No long-article content mismatches
- No admin dashboard anomaly regressions
- No Playwright failures in public or admin critical paths
