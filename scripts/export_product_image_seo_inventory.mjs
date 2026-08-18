import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_OUTPUT_PATH,
  getRuntimeConfig,
  loadDotEnv,
  readPublicProductInventory,
  summarizeInventory,
  writeJsonFile,
} from './lib/productImageSeoCatalog.mjs';

await loadDotEnv();

const outputPath = path.resolve(process.env.PRODUCT_IMAGE_SEO_INVENTORY_OUTPUT || DEFAULT_OUTPUT_PATH);
const config = getRuntimeConfig();
const products = await readPublicProductInventory(config);
const summary = summarizeInventory(products);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeJsonFile(outputPath, {
  generated_at: new Date().toISOString(),
  source: {
    base_url: config.baseUrl,
    supabase_url: config.supabaseUrl,
    r2_base_url: config.r2BaseUrl,
  },
  summary,
  products,
});

console.log(JSON.stringify({
  outputPath,
  baseUrl: config.baseUrl,
  productCount: summary.product_count,
  productsWithPrimaryImage: summary.products_with_primary_image,
  productsWithoutPrimaryImage: summary.products_without_primary_image,
  duplicatePrimaryImageGroups: summary.duplicate_primary_image_groups,
}, null, 2));

if (summary.products_without_primary_image > 0 && process.env.PRODUCT_IMAGE_SEO_FAIL_ON_MISSING === '1') {
  process.exitCode = 2;
}
