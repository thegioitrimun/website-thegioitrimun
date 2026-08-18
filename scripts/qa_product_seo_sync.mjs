import { spawnSync } from 'node:child_process';

const checks = [
  {
    name: 'product image SEO endpoints',
    command: ['node', 'scripts/verify_live_product_image_seo.mjs'],
  },
  {
    name: 'Googlebot product detail pages',
    command: ['node', 'scripts/audit_live_googlebot_product_pages.mjs'],
  },
  {
    name: 'Google Merchant product feed',
    command: ['node', 'scripts/google_merchant_feed_healthcheck.mjs'],
  },
];

const results = [];

for (const check of checks) {
  const startedAt = Date.now();
  console.log(`\n[seo-sync] ${check.name}`);
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  results.push({
    name: check.name,
    status: result.status,
    durationMs: Date.now() - startedAt,
  });
  if (result.status !== 0) break;
}

const failed = results.filter((result) => result.status !== 0);
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  checks: results,
  failedCount: failed.length,
}, null, 2));

if (failed.length > 0) {
  process.exitCode = failed[0].status || 1;
}
