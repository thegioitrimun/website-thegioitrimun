# Brand Logo and Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site logo with the supplied artwork, render the new two-line clinic name, and make the shared navbar more transparent with less blur before deploying to Cloudflare.

**Architecture:** Keep branding centralized in the existing public icon directory and shared `App.tsx` header. Generate compatible PNG sizes from the supplied WebP so the browser, PWA, boot shell, and SEO structured data all resolve the same artwork without changing Supabase content.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Node test runner, Cloudflare Pages/Workers.

---

### Task 1: Add a branding regression contract

**Files:**
- Create: `tests/brandNavbar.test.mjs`
- Test: `tests/brandNavbar.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared navbar and metadata use the tropical dermatology brand', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8');

  assert.match(app, /Da Liễu Nhiệt Đới/);
  assert.match(app, /Phú Quốc/);
  assert.match(app, /da-lieu-nhiet-doi-phu-quoc-96\.png/);
  assert.match(app, /backdrop-blur-md/);
  assert.doesNotMatch(app, /Skin clinic \+ pharmacy/);
  assert.match(html, /da-lieu-nhiet-doi-phu-quoc-96\.png/);
  assert.match(manifest, /da-lieu-nhiet-doi-phu-quoc-192\.png/);
  await access(new URL('../public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp', import.meta.url));
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node --test tests/brandNavbar.test.mjs`

Expected: FAIL because the new brand strings and assets do not exist yet.

### Task 2: Generate and wire the shared logo assets

**Files:**
- Create: `public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp`
- Create: `public/icons/da-lieu-nhiet-doi-phu-quoc-{32,48,96,180,192,512}.png`
- Modify: `index.html`
- Modify: `public/manifest.json`
- Modify: `src/seo.ts`

- [ ] **Step 1: Copy the canonical WebP and generate required PNG sizes**

Run:

```bash
cp /Users/PHUC/Desktop/logo.webp public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp
for size in 32 48 96 180 192 512; do
  sips -s format png -z "$size" "$size" public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp \
    --out "public/icons/da-lieu-nhiet-doi-phu-quoc-${size}.png"
done
```

- [ ] **Step 2: Update static browser, boot, PWA, and SEO references**

Use `/icons/da-lieu-nhiet-doi-phu-quoc-*.png` in `index.html`, `public/manifest.json`, and `src/seo.ts`. Render the boot shell as two lines: `Da Liễu Nhiệt Đới` and `Phú Quốc`.

### Task 3: Update the shared responsive navbar

**Files:**
- Modify: `App.tsx:89-91`
- Modify: `App.tsx:1720-1771`

- [ ] **Step 1: Replace the dynamic navbar label with approved fixed lines**

```tsx
<span>Da Liễu Nhiệt Đới</span>
<span>Phú Quốc</span>
```

Keep the label visible on mobile with compact, non-wrapping type and retain the supplied logo alt text.

- [ ] **Step 2: Reduce opacity and blur without removing glass treatment**

Use approximately `rgba(...,0.54)` on the main light navbar, `rgba(...,0.56)` in dark mode, and `backdrop-blur-md`. Reduce nested navigation/utility blur to `backdrop-blur-sm` while preserving borders, shadows, theme contrast, and the white header gradient.

- [ ] **Step 3: Run the contract and production build**

Run:

```bash
node --test tests/brandNavbar.test.mjs
npm run build
```

Expected: test passes and build exits with code 0.

### Task 4: Rendered QA and Cloudflare deployment

**Files:**
- Verify only; no new source files expected.

- [ ] **Step 1: Verify local desktop and mobile UI**

Run the local app, then use the in-app Browser to verify:

- navbar logo loads;
- two-line name is visible without clipping;
- desktop and mobile layouts retain all controls;
- light/dark navbar remains readable;
- console has no relevant warnings or errors.

- [ ] **Step 2: Verify Cloudflare authentication**

Run: `npx wrangler whoami`

Expected: authenticated Cloudflare account is displayed.

- [ ] **Step 3: Deploy and verify production**

Run: `npm run deploy:pages`

Then verify `https://thegioitrimun.vn/` returns the new logo and two-line brand label with no browser console errors.
