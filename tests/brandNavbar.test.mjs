import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../App.tsx', import.meta.url);
const htmlPath = new URL('../index.html', import.meta.url);
const manifestPath = new URL('../public/manifest.json', import.meta.url);
const seoPath = new URL('../src/seo.ts', import.meta.url);
const canonicalLogoPath = new URL('../public/icons/da-lieu-nhiet-doi-phu-quoc-logo.webp', import.meta.url);

test('shared navbar and metadata use the tropical dermatology brand', async () => {
  const [app, html, manifest, seo] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(htmlPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
    readFile(seoPath, 'utf8'),
  ]);
  const headerStart = app.indexOf('<header className=');
  const headerEnd = app.indexOf('</header>', headerStart);
  const headerSource = app.slice(headerStart, headerEnd);

  assert.match(headerSource, /Thế Giới/);
  assert.match(headerSource, /Trị/);
  assert.match(headerSource, /Mụn/);
  assert.match(headerSource, /Phú Quốc/);
  assert.match(headerSource, /backdrop-blur-md/);
  assert.doesNotMatch(headerSource, /Skin clinic \+ pharmacy/);
  assert.doesNotMatch(headerSource, /backdrop-blur-(?:xl|2xl)/);
  assert.doesNotMatch(headerSource, /pointer-events-none absolute inset-x-0 top-0 h-/);
  assert.match(app, /da-lieu-nhiet-doi-phu-quoc/);
  assert.match(html, /da-lieu-nhiet-doi-phu-quoc-96\.png/);
  assert.match(manifest, /da-lieu-nhiet-doi-phu-quoc-192\.png/);
  assert.match(seo, /da-lieu-nhiet-doi-phu-quoc-512\.png/);
  await access(canonicalLogoPath);
});
