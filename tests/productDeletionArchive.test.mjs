import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260531103000_archive_ordered_products_on_delete.sql', import.meta.url);
const apiPath = new URL('../services/api.ts', import.meta.url);

test('product deletion migration preserves ordered products by archiving them', async () => {
  const sql = await readFile(migrationPath, 'utf8').catch(() => '');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_delete_or_archive_product/i);
  assert.match(sql, /FROM public\.product_order_items[\s\S]*WHERE poi\.product_id = p_product_id/i);
  assert.match(sql, /UPDATE public\.products[\s\S]*archived_at = COALESCE\(archived_at, now\(\)\)/i);
  assert.match(sql, /DELETE FROM public\.products/i);
});

test('client deletion calls the atomic RPC before removing storage files', async () => {
  const source = await readFile(apiPath, 'utf8');
  const deleteStart = source.indexOf('export async function deleteProduct');
  const deleteEnd = source.indexOf('export async function saveProductCategory', deleteStart);
  const deleteSource = source.slice(deleteStart, deleteEnd);
  const rpcIndex = deleteSource.indexOf("rpc('admin_delete_or_archive_product'");
  const storageIndex = deleteSource.indexOf("removePublicImages('product-images'");

  assert.ok(rpcIndex >= 0, 'deleteProduct must use the atomic delete-or-archive RPC');
  assert.ok(storageIndex > rpcIndex, 'storage cleanup must happen only after the database deletion succeeds');
  assert.match(deleteSource, /outcome === 'deleted'/);
});
