import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const outputDirectory = path.resolve(process.argv[2] || 'output/public-product-content');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pageSize = 500;
const rows = [];

for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,description,long_description,usage_instructions,ingredients,is_published,archived_at,updated_at')
    .eq('is_published', true)
    .is('archived_at', null)
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Unable to export public products: ${error.message}`);
  rows.push(...(data || []));
  if (!data || data.length < pageSize) break;
}

const products = rows.map((product) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  long_description: product.long_description,
  usage_instructions: product.usage_instructions,
  ingredients: product.ingredients,
}));

const safeFilePart = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, (character) => character === 'Đ' ? 'D' : 'd')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()
  .slice(0, 140) || 'san-pham';

await mkdir(outputDirectory, { recursive: true });

for (const [index, product] of products.entries()) {
  const ordinal = String(index + 1).padStart(3, '0');
  const filename = `${ordinal}__${safeFilePart(product.slug || product.name)}.json`;
  await writeFile(
    path.join(outputDirectory, filename),
    `${JSON.stringify(product, null, 2)}\n`,
    'utf8',
  );
}

const coverage = Object.fromEntries(
  ['description', 'long_description', 'usage_instructions', 'ingredients'].map((field) => [
    field,
    products.filter((product) => {
      const value = product[field];
      return Array.isArray(value) ? value.length > 0 : String(value || '').trim().length > 0;
    }).length,
  ]),
);

await writeFile(
  path.join(outputDirectory, '_tong_hop.json'),
  `${JSON.stringify(products, null, 2)}\n`,
  'utf8',
);

await writeFile(
  path.join(outputDirectory, '_manifest.json'),
  `${JSON.stringify({
    exported_at: new Date().toISOString(),
    source: 'public.products',
    filters: { is_published: true, archived_at: null },
    fields: ['id', 'slug', 'name', 'description', 'long_description', 'usage_instructions', 'ingredients'],
    product_count: products.length,
    populated_field_counts: coverage,
  }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({ outputDirectory, productCount: products.length, coverage }, null, 2));
