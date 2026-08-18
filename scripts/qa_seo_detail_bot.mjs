const baseUrl = (process.argv[2] || 'https://thegioitrimun.vn').replace(/\/+$/, '');
const googlebotUa = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
const spaShellTitle = 'Thế Giới Trị Mụn | Chăm sóc da chuyên sâu';

const detailChecks = [
  {
    label: 'product detail',
    path: '/san-pham/tinh-chat-dac-tri/gel-tri-mun-klenzit-ms-0-1',
  },
  {
    label: 'service detail',
    path: '/dich-vu/dieu-tri-mun-chuyen-sau',
  },
  {
    label: 'blog detail',
    path: '/kien-thuc/dieu-tri-mun/kem-tron-tri-mun-co-nen-dung-khong-6-tac-hai-khon-luong',
  },
];

const fail = (message) => {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
};

const pass = (message) => {
  console.log(`[PASS] ${message}`);
};

for (const check of detailChecks) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    headers: {
      'user-agent': googlebotUa,
    },
  });

  if (response.status !== 200) {
    fail(`${check.label} returned HTTP ${response.status}: ${url}`);
  }

  const robots = response.headers.get('x-robots-tag') || '';
  if (/noindex/i.test(robots)) {
    fail(`${check.label} unexpectedly returned noindex header: ${url}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';
  if (!title) {
    fail(`${check.label} missing <title>: ${url}`);
  }
  if (title === spaShellTitle) {
    fail(`${check.label} fell back to SPA shell title: ${url}`);
  }

  if (!/application\/ld\+json/i.test(html)) {
    fail(`${check.label} missing JSON-LD: ${url}`);
  }
  if (/natural skin/i.test(html)) {
    fail(`${check.label} still exposes the legacy Natural Skin brand: ${url}`);
  }

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonicalHref = canonicalMatch?.[1] || '';
  if (!canonicalHref) {
    fail(`${check.label} missing canonical href: ${url}`);
  }
  if (canonicalHref === baseUrl || canonicalHref === `${baseUrl}/`) {
    fail(`${check.label} canonical fell back to homepage: ${url}`);
  }

  pass(`${check.label} prerender ok -> ${title}`);
}
