import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const homepagePath = new URL('../components/HomePageContent.tsx', import.meta.url);
const appPath = new URL('../App.tsx', import.meta.url);

test('homepage hero is full bleed and keeps the cinematic CTA', async () => {
  const source = await readFile(homepagePath, 'utf8');
  const appSource = await readFile(appPath, 'utf8');
  const heroIdIndex = source.indexOf('id="home"');
  const heroStart = source.lastIndexOf('<section', heroIdIndex);
  const heroEnd = source.indexOf('{hasFeaturedServices && (', heroStart);
  const heroSource = source.slice(heroStart, heroEnd);

  assert.ok(heroStart >= 0 && heroEnd > heroStart, 'homepage hero section must be discoverable');
  assert.match(source, /className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover/);
  assert.doesNotMatch(source, /top-\[300px\]|h-\[calc\(100%_-_300px\)\]/);
  assert.match(heroSource, /homepage-hero-focus/);
  assert.doesNotMatch(heroSource, /homepage-hero-top-glow|homepage-hero-vignette/);
  assert.match(heroSource, />\s*Begin Journey\s*</);
  assert.match(appSource, /isAdminView \|\| view\.page === 'main'/);
  assert.doesNotMatch(heroSource, /pt-\[calc\(8rem_-_75px\)\]/);
});

test('homepage brand wall uses one edge-to-edge logo canvas per brand', async () => {
  const source = await readFile(homepagePath, 'utf8');
  const brandStart = source.indexOf('{featuredBrandRows.length > 0 && (');
  const brandEnd = source.indexOf('{leadPost && (', brandStart);
  const brandSource = source.slice(brandStart, brandEnd);

  assert.ok(brandStart >= 0 && brandEnd > brandStart, 'brand wall must be discoverable');
  assert.match(brandSource, /grid-cols-2/);
  assert.match(brandSource, /2xl:grid-cols-9/);
  assert.match(brandSource, /containerClassName="!absolute inset-0/);
  assert.match(brandSource, /imageClassName="h-full w-full object-contain/);
  assert.doesNotMatch(brandSource, /max-h-\[40px\]|max-h-\[46px\]|bg-card px-4|bg-card px-3/);
  assert.doesNotMatch(brandSource, /border-\[#eadfd5\]|dark:border-white\/15|hover:border-primary/);
});

test('homepage service cards use a compact responsive grid', async () => {
  const source = await readFile(homepagePath, 'utf8');
  const serviceStart = source.indexOf('{hasFeaturedServices && (');
  const serviceEnd = source.indexOf('{hasProductShowcase && (', serviceStart);
  const serviceSource = source.slice(serviceStart, serviceEnd);

  assert.ok(serviceStart >= 0 && serviceEnd > serviceStart, 'service showcase must be discoverable');
  assert.match(serviceSource, /md:grid-cols-2 xl:grid-cols-3/);
  assert.match(serviceSource, /aspect-\[16\/10\]/);
  assert.match(serviceSource, /line-clamp-3/);
  assert.doesNotMatch(serviceSource, /row-span-2|min-h-\[640px\]|min-h-\[312px\]/);
});
