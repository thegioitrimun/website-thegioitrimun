# SEO EXECUTION PLAYBOOK FOR AI AGENTS

## 1) Purpose
This document is the single source of truth for any AI agent working on SEO for this project.
Follow this file strictly to keep technical SEO, content SEO, and measurement consistent across all tasks.

## 2) Scope
Applies to:
- Frontend SEO implementation (React/Vite app)
- Metadata and structured data
- Indexing and crawlability
- i18n SEO
- Performance for SEO
- Content governance and publishing workflow

Out of scope:
- Paid ads (Google Ads, Meta Ads)
- Social media growth tasks not tied to SEO

## 3) Non-Negotiable Rules
1. Do not ship SEO changes without measurable acceptance criteria.
2. Do not create duplicate pages targeting the same search intent.
3. Do not leave hardcoded Vietnamese strings in SEO metadata for non-`vi` locales.
4. Do not remove or weaken canonical/hreflang logic once added.
5. Do not publish medical content without author/reviewer metadata.

## 4) Global SEO Goals (90 Days)
1. Increase organic clicks by 40-60%.
2. Increase ranking keywords in Top 10 by 30%.
3. Increase organic conversion actions (booking + checkout) by 20%.
4. Keep Core Web Vitals pass rate above 85% on mobile URLs.

## 5) Execution Order (Must Follow)
1. Baseline and tracking.
2. Technical SEO foundation.
3. On-page SEO templates.
4. Structured data rollout.
5. i18n SEO hardening.
6. Content cluster execution.
7. Internal linking and authority support.
8. Weekly monitoring and iterative fixes.

## 6) Phase-by-Phase Tasks

### Phase A - Baseline (Week 1)
Required tasks:
1. Confirm GA4, Google Search Console, Bing Webmaster active.
2. Confirm conversion events tracked:
- `book_appointment`
- `start_checkout`
- `purchase`
- `submit_contact`
3. Export baseline:
- Top landing pages
- Top queries
- Index coverage issues
- Current CWV snapshots

Definition of done:
- A baseline report exists in markdown under `.agents/reports/seo-baseline-YYYY-MM-DD.md`.

### Phase B - Technical SEO (Week 2-4)
Required tasks:
1. Ensure every important page has a stable crawlable URL.
2. Implement per-page metadata:
- `title`
- `meta description`
- canonical
- Open Graph + Twitter tags
3. Generate and maintain:
- `robots.txt`
- `sitemap.xml`
- segmented sitemaps (`blog`, `products`, `services`) if needed
4. Add JSON-LD by page type:
- `Organization` / `MedicalClinic` / `LocalBusiness`
- `Service`
- `Product`
- `Article`
- `FAQPage`
- `BreadcrumbList`
5. Fix internal linking depth and breadcrumb consistency.

Definition of done:
- No critical crawl/index errors in GSC coverage for key pages.
- Metadata is unique on all key templates.

### Phase C - i18n SEO (Week 4-5)
Required tasks:
1. Implement correct `hreflang` (`vi`, `en`, `ru`, `zh`).
2. Ensure canonical points to the correct language URL variant.
3. Ensure translated title/description exist for each locale.
4. Prevent cross-locale duplicate indexing conflicts.

Definition of done:
- Locale variants are discoverable and correctly mapped in source HTML.

### Phase D - Content & On-page (Week 5-8)
Required tasks:
1. Build topic clusters:
- Acne treatment cluster
- Dermatology service cluster
- Skincare/product education cluster
2. Enforce medical E-E-A-T:
- Author
- Medical reviewer
- Last updated date
3. Optimize service and product pages for intent + conversion CTA.
4. Add FAQ blocks for eligible pages.

Definition of done:
- Each new page has target keyword, intent, schema, internal links, and CTA.

### Phase E - Monitoring + CRO (Week 9-12)
Required tasks:
1. Weekly review of GSC query changes and CTR drops.
2. Refresh underperforming titles/descriptions.
3. Improve landing page conversion UX for organic traffic.
4. Track impact of each SEO release in changelog.

Definition of done:
- Weekly report exists in `.agents/reports/seo-weekly-YYYY-WW.md`.

## 7) Required Implementation Standards

### Metadata standard per indexable page
Must include:
1. Unique title (50-60 chars target).
2. Unique meta description (140-160 chars target).
3. Canonical URL.
4. Open Graph tags.
5. Twitter Card tags.

### Content quality standard
1. One primary intent per page.
2. Intro paragraph must match search intent directly.
3. Include expert trust signals for medical topics.
4. Include at least one conversion CTA above the fold.

### Internal linking standard
1. Every indexable page must link to at least 2 related pages.
2. Blog posts must link to relevant service/product pages.
3. Service pages must link to booking/contact action.

## 8) Deliverables Every AI Agent Must Produce
For each SEO task, output:
1. Files changed list.
2. What was implemented.
3. Acceptance criteria checks performed.
4. Remaining risks and next actions.

Do not close a task without this summary.

## 9) QA Checklist Before Deploy
1. No duplicate title/meta in key pages.
2. Canonical URLs resolve correctly.
3. `robots.txt` and sitemap accessible.
4. JSON-LD validates (no syntax errors).
5. Hreflang tags consistent across locale variants.
6. Mobile page performance does not regress significantly.
7. No broken internal links in edited pages.

## 10) Suggested Folder Convention
Use these paths for SEO operations:
- `.agents/workflows/SEO_EXECUTION_PLAYBOOK.md` (this file)
- `.agents/workflows/SEO_BASELINE_REPORT_TEMPLATE.md`
- `.agents/workflows/SEO_WEEKLY_REPORT_TEMPLATE.md`
- `.agents/workflows/SEO_RELEASE_NOTES_TEMPLATE.md`
- `.agents/workflows/seo-baseline-YYYY-MM-DD.md`
- `.agents/workflows/seo-weekly-YYYY-WW.md`
- `.agents/workflows/seo-release-notes-YYYY-MM-DD.md`

## 11) Quick Start for Any New Agent
1. Read this file fully.
2. Open latest file in `.agents/reports/`.
3. Continue from the earliest incomplete item in the latest report.
4. Execute tasks in priority order: Technical SEO -> i18n SEO -> Content SEO.
5. Update report file before ending the session.

## 12) Stop Conditions (Escalate to User)
Stop and ask the user before proceeding if:
1. URL structure must be changed in a way that can break existing backlinks.
2. A major routing/SSR/prerender refactor is required.
3. Existing production metadata would be overwritten globally.
4. Supabase schema changes are needed for SEO fields.
