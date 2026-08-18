#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { replaceManagedSeoBlock } from './lib/seo_batch_shared.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykcrngqhyinczmvwduox.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc';
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '';
const DRY_RUN = process.env.BLOG_SECTION_CLEANUP_DRY_RUN === '1';
const PAGE_SIZE = Number(process.env.BLOG_SECTION_CLEANUP_PAGE_SIZE || '25');

const UNWANTED_HEADINGS = [
  'Nội dung liên quan tại Natural Skin',
  'Gợi ý sản phẩm và dịch vụ liên quan',
  'Hướng theo dõi thêm',
];
const LEGACY_BLOG_FALLBACK_IMAGE_REGEX = /^https:\/\/thegioitrimun\.vn\/seo\/blog-cover-[a-z-]+\.jpg$/i;

function assertConfig() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing SUPABASE_ADMIN_EMAIL/E2E_ADMIN_EMAIL or SUPABASE_ADMIN_PASSWORD/E2E_ADMIN_PASSWORD');
  }
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripStandaloneHeadingSections(markdown) {
  let next = String(markdown || '');
  for (const heading of UNWANTED_HEADINGS) {
    const pattern = new RegExp(
      `(?:\\n|^)##\\s*${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=(?:\\n##\\s)|$)`,
      'g',
    );
    next = next.replace(pattern, '');
  }
  return next
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function cleanMarkdown(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const withoutManagedBlock = replaceManagedSeoBlock(source, '');
  return stripStandaloneHeadingSections(withoutManagedBlock);
}

function shouldClearLegacyBlogFallbackImagePath(value) {
  return LEGACY_BLOG_FALLBACK_IMAGE_REGEX.test(String(value || '').trim());
}

function cleanLongDescriptionBlocks(value) {
  if (!Array.isArray(value)) return value;
  return value.map((block) => {
    if (!block || typeof block !== 'object') return block;
    if (block.type !== 'text' || typeof block.content !== 'string') return block;
    const nextContent = cleanMarkdown(block.content);
    return nextContent === block.content ? block : { ...block, content: nextContent };
  });
}

function deepEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function fetchAllRows(fetchPage) {
  const rows = [];
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  assertConfig();

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (authError) {
    throw new Error(`Admin sign-in failed: ${authError.message}`);
  }

  try {
    const posts = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('slug,image_path,content,content_en,content_ru,content_cn')
        .order('slug', { ascending: true })
        .range(from, to);
      if (error) throw new Error(`Could not read blog_posts: ${error.message}`);
      return data || [];
    });

    const products = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabase
        .from('products')
        .select('slug,long_description')
        .order('slug', { ascending: true })
        .range(from, to);
      if (error) throw new Error(`Could not read products: ${error.message}`);
      return data || [];
    });

    let updatedPosts = 0;
    let clearedLegacyFallbackImages = 0;
    let updatedProducts = 0;

    for (const post of posts || []) {
      const nextPayload = {};
      for (const field of ['content', 'content_en', 'content_ru', 'content_cn']) {
        const current = typeof post[field] === 'string' ? post[field] : '';
        const cleaned = cleanMarkdown(current);
        if (cleaned !== current) {
          nextPayload[field] = cleaned;
        }
      }
      if (shouldClearLegacyBlogFallbackImagePath(post.image_path)) {
        nextPayload.image_path = null;
        clearedLegacyFallbackImages += 1;
      }
      if (Object.keys(nextPayload).length === 0) continue;
      updatedPosts += 1;
      if (!DRY_RUN) {
        const { error } = await supabase.from('blog_posts').update(nextPayload).eq('slug', post.slug);
        if (error) throw new Error(`Failed updating blog post ${post.slug}: ${error.message}`);
      }
    }

    for (const product of products || []) {
      const nextLongDescription = cleanLongDescriptionBlocks(product.long_description);
      if (deepEqualJson(nextLongDescription, product.long_description)) continue;
      updatedProducts += 1;
      if (!DRY_RUN) {
        const { error } = await supabase
          .from('products')
          .update({ long_description: nextLongDescription })
          .eq('slug', product.slug);
        if (error) throw new Error(`Failed updating product ${product.slug}: ${error.message}`);
      }
    }

    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      updatedPosts,
      clearedLegacyFallbackImages,
      updatedProducts,
      unwantedHeadings: UNWANTED_HEADINGS,
    }, null, 2));
  } finally {
    await supabase.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
