import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoots = [
  'components',
  'services',
  'src',
  'supabase/functions',
  'worker',
];
const rootRuntimeFiles = ['App.tsx', '_worker.js', 'index.html'];
const runtimeExtensions = new Set(['.html', '.js', '.json', '.ts', '.tsx']);

async function collectRuntimeFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRuntimeFiles(child));
    } else if (runtimeExtensions.has(path.extname(entry.name))) {
      files.push(child);
    }
  }

  return files;
}

test('public runtime no longer exposes the legacy Natural Skin brand', async () => {
  const nestedFiles = (await Promise.all(runtimeRoots.map(collectRuntimeFiles))).flat();
  const files = [...rootRuntimeFiles, ...nestedFiles];
  const staleFiles = [];

  for (const relativePath of files) {
    const source = await readFile(path.join(root, relativePath), 'utf8');
    if (/natural skin/i.test(source)) staleFiles.push(relativePath);
  }

  assert.deepEqual(staleFiles, []);
});

test('core metadata consistently names Thế Giới Trị Mụn', async () => {
  const [app, worker, html, seo] = await Promise.all([
    readFile(path.join(root, 'App.tsx'), 'utf8'),
    readFile(path.join(root, '_worker.js'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'src/seo.ts'), 'utf8'),
  ]);

  for (const source of [app, worker, html, seo]) {
    assert.match(source, /Thế Giới Trị Mụn/);
  }
});

test('SEO controls cover transactional routes and brand landing pages', async () => {
  const [worker, feeds, audit] = await Promise.all([
    readFile(path.join(root, '_worker.js'), 'utf8'),
    readFile(path.join(root, 'worker/seo/feeds.js'), 'utf8'),
    readFile(path.join(root, 'scripts/seo_live_audit.mjs'), 'utf8'),
  ]);

  for (const route of ['dat-hang-thanh-cong', 'tra-cuu-don-hang']) {
    assert.match(worker, new RegExp(route));
    assert.match(feeds, new RegExp(`Disallow: /${route}`));
  }

  assert.match(audit, /Brand Directory/);
  assert.match(audit, /Brand Landing/);
  assert.match(audit, /Legacy Natural Skin brand remains in prerendered HTML/);
});
