#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { runQuery, sqlString } from './lib/seo_batch_shared.mjs';

const AUDIT_JSON_PATH = process.env.BLOG_EDITORIAL_AUDIT_JSON || 'output/audits/blog-editorial-audit.json';
const OUTPUT_DIR = process.env.BLOG_EDITORIAL_PRUNE_OUTPUT_DIR || 'output/audits';
const DRY_RUN = process.env.BLOG_EDITORIAL_PRUNE_DRY_RUN === '1';

async function main() {
  const raw = await fs.readFile(AUDIT_JSON_PATH, 'utf8');
  const auditRows = JSON.parse(raw);
  const removeRows = auditRows.filter((row) => row.action === 'remove');
  const slugs = removeRows.map((row) => String(row.slug || '').trim()).filter(Boolean);

  if (slugs.length === 0) {
    console.log(JSON.stringify({ dryRun: DRY_RUN, removeCount: 0 }, null, 2));
    return;
  }

  const slugSql = slugs.map(sqlString).join(', ');
  const existingRows = await runQuery(`
    select *
    from public.blog_posts
    where slug in (${slugSql})
    order by slug asc;
  `);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(OUTPUT_DIR, `blog-editorial-removed-backup-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(existingRows, null, 2), 'utf8');

  if (!DRY_RUN) {
    await runQuery(`
      delete from public.blog_posts
      where slug in (${slugSql});
    `);
  }

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    removeCount: slugs.length,
    backupPath,
    removedSlugsSample: slugs.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
