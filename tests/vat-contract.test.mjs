import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('VAT migration contains ledger, imports, immutable returns and source parity tables', async () => {
  const sql = await read('d1/app/migrations/0021_vat_ledger_and_source_parity.sql');
  for (const table of [
    'tax_entities', 'vat_categories', 'vat_rules', 'sales_invoices', 'sales_invoice_lines',
    'purchase_invoices', 'purchase_invoice_lines', 'vat_periods', 'vat_period_entries',
    'vat_adjustments', 'vat_return_versions', 'vat_import_jobs', 'vat_import_issues',
    'vat_documents', 'catalog_seo_events', 'product_ingredient_sync_events',
    'product_generation_jobs', 'clinic_invoices', 'clinic_performed_services',
    'clinic_prescribed_medications', 'source_migration_manifest',
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  assert.match(sql, /'accountant'/);
  assert.match(sql, /'deduction_01', 'direct_04'/);
  assert.match(sql, /'draft', 'in_review', 'locked', 'filed', 'amended'/);
});

test('VAT routes enforce D1 and expose the complete admin surface', async () => {
  const routes = await read('worker/vat/routes.js');
  assert.match(routes, /DATA_BACKEND/);
  for (const path of ['bootstrap', 'migration-status', 'sales-invoices', 'purchase-invoices', 'imports\/preview', 'periods', 'adjustments', 'documents']) {
    assert.match(routes, new RegExp(path));
  }
  for (const action of ['submit-review', 'lock', 'filed', 'amend', 'export']) assert.match(routes, new RegExp(action));
});

test('VAT authorization excludes ordinary admin and requires CSRF for mutations', async () => {
  const handlers = await read('worker/vat/handlers.js');
  assert.match(handlers, /const VAT_ROLES = \['accountant', 'master_admin'\]/);
  assert.match(handlers, /const MASTER_ROLES = \['master_admin'\]/);
  assert.match(handlers, /await requireCsrf\(db, request, session\)/);
  assert.doesNotMatch(handlers, /VAT_ROLES = \[[^\]]*'admin'/);
});

test('source parity map covers exactly 46 tables and 3 views', async () => {
  const map = JSON.parse(await read('d1/source-parity-map.json'));
  assert.equal(map.targets.length, 49);
  assert.equal(new Set(map.targets.map((entry) => entry.source)).size, 49);
  assert.equal(map.targets.filter((entry) => entry.kind === 'view').length, 3);
  assert.equal(map.targets.filter((entry) => entry.kind === 'table').length, 46);
});

test('HTKK XML export is fail-closed until a sample-backed adapter passes round-trip', async () => {
  const source = await read('src/vatExports.ts');
  assert.match(source, /canImportToHtkk/);
  assert.match(source, /xml_validation_status !== 'htkk_valid'/);
  assert.match(source, /DOMParser/);
  assert.match(source, /Chưa xuất XML nhập HTKK/);
});
