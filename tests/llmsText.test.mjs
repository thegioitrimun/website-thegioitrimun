import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { maybeHandleLlmsTextRoute } from '../worker/seo/llmsText.js';

const llmsPath = new URL('../public/llms.txt', import.meta.url);

test('static llms.txt starts with an H1 and uses Markdown links', async () => {
  const body = await readFile(llmsPath, 'utf8');
  assert.match(body, /^#\s+Thế Giới Trị Mụn/m);
  assert.match(body, /\[Sản phẩm\]\(https:\/\/thegioitrimun\.vn\/san-pham\)/);
  assert.ok(body.length < 4_000, 'llms.txt should stay concise');
});

test('llms route serves the static asset with agent-friendly headers', async () => {
  const body = await readFile(llmsPath, 'utf8');
  const response = await maybeHandleLlmsTextRoute({
    path: '/llms.txt',
    request: new Request('https://thegioitrimun.vn/llms.txt'),
    env: {
      ASSETS: {
        fetch: async () => new Response(body, { status: 200, headers: { ETag: 'test-etag' } }),
      },
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/plain/);
  assert.equal(response.headers.get('content-language'), 'vi');
  assert.equal(response.headers.get('x-robots-tag'), null);
  assert.equal(response.headers.get('etag'), 'test-etag');
  assert.match(await response.text(), /^#\s+Thế Giới Trị Mụn/);
});

test('llms route returns a valid fallback when the asset binding fails', async () => {
  const response = await maybeHandleLlmsTextRoute({
    path: '/llms.txt',
    request: new Request('https://thegioitrimun.vn/llms.txt'),
    env: { ASSETS: { fetch: async () => { throw new Error('asset unavailable'); } } },
  });

  assert.equal(response.status, 200);
  assert.match(await response.text(), /^#\s+Thế Giới Trị Mụn/);
});
