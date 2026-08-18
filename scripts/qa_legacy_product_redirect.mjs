import assert from 'node:assert/strict';

const workerModule = await import(new URL('../_worker.js', import.meta.url));
const worker = workerModule.default;

const originalFetch = globalThis.fetch;

const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

const productFixture = {
  id: 101,
  slug: 'alhydran-anti-itch-care',
  name: 'Alhydran Anti Itch Care',
  description: 'Kem dưỡng hỗ trợ làm dịu da.',
  category_id: 12,
  category: { slug: 'duong-am-phuc-hoi' },
};

const renamedProductFixture = {
  id: 371,
  slug: 'serum-tr-nm-trng-da-intelderm-3-tranexamic-acid--10-niacinamide-30ml-chnh-hng',
  name: 'Serum Trị Nám, Trắng Da Intelderm 3% Tranexamic Acid + 10% Niacinamide 30ml [Chính Hãng]',
  description: 'Serum hỗ trợ cải thiện nám và làm sáng da.',
  category_id: 4,
  category: { slug: 'tinh-chat-dac-tri' },
};

globalThis.fetch = async (input) => {
  const url = new URL(String(input));

  if (url.pathname.endsWith('/rest/v1/products')) {
    const slugFilter = url.searchParams.get('slug');
    if (slugFilter === 'eq.alhydran-anti-itch-care') {
      return jsonResponse([productFixture]);
    }
    if (slugFilter === 'eq.serum-intelderm-tranexamic-acid-3-niacinamide-10-30ml-1') {
      return jsonResponse([]);
    }
    const fuzzyFilter = url.searchParams.get('or') || '';
    if (fuzzyFilter.includes('intelderm') || fuzzyFilter.includes('tranexamic') || fuzzyFilter.includes('niacinamide')) {
      return jsonResponse([renamedProductFixture]);
    }
    return jsonResponse([]);
  }

  if (url.pathname.endsWith('/rest/v1/product_categories')) {
    return jsonResponse([{ id: 12, slug: 'duong-am-phuc-hoi' }]);
  }

  return originalFetch(input);
};

const assetResponse = new Response('<!doctype html><title>Homepage</title>', { status: 200 });
const env = {
  ASSETS: {
    fetch: async () => assetResponse.clone(),
  },
};
const ctx = {
  waitUntil() {},
};

try {
  const legacyProductResponse = await worker.fetch(
    new Request('https://thegioitrimun.vn/alhydran-anti-itch-care'),
    env,
    ctx,
  );

  assert.equal(legacyProductResponse.status, 301);
  assert.equal(
    legacyProductResponse.headers.get('location'),
    'https://thegioitrimun.vn/san-pham/duong-am-phuc-hoi/alhydran-anti-itch-care',
  );

  const renamedLegacyProductResponse = await worker.fetch(
    new Request('https://thegioitrimun.vn/serum-intelderm-tranexamic-acid-3-niacinamide-10-30ml-1'),
    env,
    ctx,
  );

  assert.equal(renamedLegacyProductResponse.status, 301);
  assert.equal(
    renamedLegacyProductResponse.headers.get('location'),
    'https://thegioitrimun.vn/san-pham/tinh-chat-dac-tri/serum-tr-nm-trng-da-intelderm-3-tranexamic-acid--10-niacinamide-30ml-chnh-hng',
  );

  const unknownResponse = await worker.fetch(
    new Request('https://thegioitrimun.vn/khong-phai-san-pham'),
    env,
    ctx,
  );

  assert.equal(unknownResponse.status, 200);

  const unavailableLegacyProductResponse = await worker.fetch(
    new Request('https://thegioitrimun.vn/theraphyto-cure-cream'),
    env,
    ctx,
  );

  assert.equal(unavailableLegacyProductResponse.status, 302);
  assert.equal(
    unavailableLegacyProductResponse.headers.get('location'),
    'https://thegioitrimun.vn/san-pham?tu-khoa=theraphyto+cure+cream',
  );

  const staticResponse = await worker.fetch(
    new Request('https://thegioitrimun.vn/favicon.ico'),
    env,
    ctx,
  );

  assert.equal(staticResponse.status, 200);
} finally {
  globalThis.fetch = originalFetch;
}
