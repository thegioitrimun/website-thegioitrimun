#!/usr/bin/env node

import {
  inferLocalSeoTags,
  mergeLocalSeoTags,
} from '../worker/seo/localSeoTags.js';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const SHOULD_APPLY = process.argv.includes('--apply');

if (!ACCESS_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN');
}

async function getServiceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot read api-keys (${response.status}): ${text.slice(0, 1000)}`);
  }

  const keys = JSON.parse(text);
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  if (!serviceRole) {
    throw new Error('service_role key not found');
  }
  return serviceRole;
}

const buildHeaders = (serviceRole, extra = {}) => ({
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  ...extra,
});

async function fetchRows(serviceRole, table, select) {
  const response = await fetch(
    `https://${PROJECT_REF}.supabase.co/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${table === 'services' ? 'id' : 'slug'}.asc`,
    {
      headers: buildHeaders(serviceRole),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot read ${table} (${response.status}): ${text.slice(0, 1000)}`);
  }
  return JSON.parse(text);
}

async function patchRow(serviceRole, table, key, value, localSeoTags) {
  const response = await fetch(
    `https://${PROJECT_REF}.supabase.co/rest/v1/${table}?${key}=eq.${encodeURIComponent(value)}`,
    {
      method: 'PATCH',
      headers: buildHeaders(serviceRole, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({ local_seo_tags: localSeoTags }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cannot update ${table}.${key}=${value} (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  }
}

const arraysEqual = (left, right) =>
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index]);

async function planUpdates(rows, kind) {
  return rows.map((row) => {
    const inferredTags = inferLocalSeoTags(row, { kind });
    const tags = mergeLocalSeoTags(row.local_seo_tags, inferredTags);
    return {
      ...row,
      inferredTags,
      tags,
      changed: !arraysEqual(row.local_seo_tags, tags),
    };
  });
}

const summarize = (rows) => ({
  total: rows.length,
  tagged: rows.filter((row) => row.tags.length > 0).length,
  untagged: rows.filter((row) => row.tags.length === 0).length,
  changed: rows.filter((row) => row.changed).length,
  distribution: rows.reduce((counts, row) => {
    for (const tag of row.tags) counts[tag] = (counts[tag] || 0) + 1;
    return counts;
  }, {}),
  untaggedExamples: rows
    .filter((row) => row.tags.length === 0)
    .slice(0, 12)
    .map((row) => row.slug || row.name || row.id),
});

async function main() {
  const serviceRole = await getServiceRoleKey();
  const [blogPosts, services] = await Promise.all([
    fetchRows(serviceRole, 'blog_posts', 'slug,title,summary,content,meta_keywords,local_seo_tags'),
    fetchRows(serviceRole, 'services', 'id,slug,name,description,long_description,benefits,local_seo_tags'),
  ]);
  const [blogPlan, servicePlan] = await Promise.all([
    planUpdates(blogPosts, 'blog'),
    planUpdates(services, 'service'),
  ]);

  if (SHOULD_APPLY) {
    for (const row of blogPlan.filter((entry) => entry.changed)) {
      await patchRow(serviceRole, 'blog_posts', 'slug', row.slug, row.tags);
    }
    for (const row of servicePlan.filter((entry) => entry.changed)) {
      await patchRow(serviceRole, 'services', 'id', row.id, row.tags);
    }
  }

  console.log(JSON.stringify({
    mode: SHOULD_APPLY ? 'apply' : 'dry-run',
    blogPosts: summarize(blogPlan),
    services: summarize(servicePlan),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
