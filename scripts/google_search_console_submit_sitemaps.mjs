import {
  DEFAULT_BASE_URL,
  fetchWithTimeout,
  loadDotEnv,
} from './lib/productImageSeoCatalog.mjs';

await loadDotEnv();

const DEFAULT_SITEMAPS = [
  '/sitemap.xml',
  '/sitemap-products.xml',
  '/sitemap-images.xml',
];

const isDryRun = process.env.GOOGLE_SEARCH_CONSOLE_DRY_RUN === '1';
const siteUrl = String(process.env.GOOGLE_SITE_URL || DEFAULT_BASE_URL)
  .replace(/\/?$/, '/');
const baseUrl = siteUrl.replace(/\/+$/, '');
const configuredSitemapUrls = String(process.env.GOOGLE_SITEMAP_URLS || process.env.GOOGLE_SITEMAP_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const targets = [...new Set([
  ...DEFAULT_SITEMAPS.map((path) => `${baseUrl}${path}`),
  ...configuredSitemapUrls,
].map((value) => new URL(value, baseUrl).toString()))];

function assertEnv() {
  const missing = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
  ].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Search Console OAuth env: ${missing.join(', ')}`);
  }
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function summarizeGoogleError(payload) {
  if (!payload) return 'No response body';
  if (payload.error_description) return payload.error_description;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error?.message) return payload.error.message;
  if (payload.message) return payload.message;
  return JSON.stringify(payload).slice(0, 500);
}

async function getAccessToken() {
  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  }, 20000);

  const payload = await readJsonSafe(response);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google OAuth refresh failed: ${summarizeGoogleError(payload)} (HTTP ${response.status})`);
  }
  return payload.access_token;
}

async function submitSitemap(accessToken, sitemapUrl) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  }, 30000);

  const payload = await readJsonSafe(response);
  return {
    sitemapUrl,
    status: response.status,
    ok: response.ok,
    message: response.ok
      ? 'submitted'
      : summarizeGoogleError(payload),
  };
}

if (isDryRun) {
  console.log(JSON.stringify({
    dryRun: true,
    siteUrl,
    sitemapCount: targets.length,
    sitemaps: targets,
  }, null, 2));
  process.exit(0);
}

assertEnv();
const accessToken = await getAccessToken();
const results = [];
for (const sitemapUrl of targets) {
  results.push(await submitSitemap(accessToken, sitemapUrl));
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({
  siteUrl,
  submittedAt: new Date().toISOString(),
  sitemapCount: targets.length,
  results,
  failedCount: failed.length,
}, null, 2));

if (failed.length > 0) {
  process.exitCode = 2;
}
