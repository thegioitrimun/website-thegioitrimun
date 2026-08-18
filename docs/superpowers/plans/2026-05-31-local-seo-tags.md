# Local SEO Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add relevant Phu Quoc dermatology tags to blog posts and services across Supabase, admin editors, public pages and worker prerender HTML.

**Architecture:** A dependency-free JavaScript taxonomy module under `worker/seo` is shared by Vite and the Cloudflare worker. Supabase stores the curated result as `text[]`, while a deterministic admin script backfills existing records and editors preserve manual overrides.

**Tech Stack:** React, TypeScript, Cloudflare Pages Worker, Supabase Postgres, Node test runner.

---

### Task 1: Taxonomy Module

**Files:**
- Create: `worker/seo/localSeoTags.js`
- Create: `tests/localSeoTags.test.mjs`

- [ ] Write tests for taxonomy normalization, matching, de-duplication and the maximum of five tags.
- [ ] Run `node --test tests/localSeoTags.test.mjs` and confirm the module-not-found RED state.
- [ ] Implement the dependency-free taxonomy module.
- [ ] Re-run `node --test tests/localSeoTags.test.mjs` and confirm the suite passes.

### Task 2: Database And Backfill

**Files:**
- Create: `supabase/migrations/20260531093000_add_local_seo_tags.sql`
- Create: `scripts/backfill_local_seo_tags.mjs`

- [ ] Add `local_seo_tags text[] not null default '{}'::text[]` to `blog_posts` and `services`.
- [ ] Add the field to `public_blog_posts` while preserving its security-invoker behavior.
- [ ] Implement a Supabase Management API backfill using the shared taxonomy module.
- [ ] Push the migration and run the backfill against the linked project.

### Task 3: Admin And Public Frontend

**Files:**
- Modify: `types.ts`
- Modify: `services/api.ts`
- Modify: `components/PostEditorForm.tsx`
- Modify: `components/ServiceEditorForm.tsx`
- Modify: `components/BlogPostPage.tsx`
- Modify: `components/ServiceDetailPage.tsx`

- [ ] Extend types and mutation payloads with `local_seo_tags`.
- [ ] Add comma-separated tag inputs to the blog and service editors.
- [ ] Render public hashtag chips on Vietnamese blog and service details.
- [ ] Append blog local tags to browser SEO article tags and JSON-LD.

### Task 4: Worker Prerender

**Files:**
- Modify: `_worker.js`
- Modify: `worker/seo/prerenderDetail.js`

- [ ] Fetch tags in blog/service list and detail queries.
- [ ] Render blog local tags in keywords and `article:tag`.
- [ ] Render service local tags in JSON-LD keywords and a visible prerender section.

### Task 5: Verification

- [x] Run `node --test tests/localSeoTags.test.mjs`.
- [x] Run `npm run build`.
- [x] Run `node scripts/qa_seo_detail_bot.mjs http://127.0.0.1:8790` with the worker stack available.
- [x] Verify persisted blog and service tag counts through the Supabase REST API.
