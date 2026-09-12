# D1 read optimization — 2026-09-12

Production: `thegioitrimun-app`. Migration: `0023_reduce_rows_read`.

Direct D1 measurements immediately before/after migration (rows read per execution):

| Query | Before | After | Returned rows |
|---|---:|---:|---:|
| pancake | 1892 | 7 | 0 |
| telegram | 361 | 1 | 0 |
| catalog_id | 891 | 96 | 48 |
| catalog_name | 891 | 96 | 48 |
| images | 1481 | 603 | 364 |
| ingredient_scan | 595 | 1 | 0 |

These are fixed query samples, not a measured reduction in the entire daily bill.
The image sample includes a subquery selecting 80 published products; it returned
364 images both times. The two catalog samples each use LIMIT 48. Queue and
maintenance samples were empty. The ingredient comparison replaces a catalog
scan with a dirty-set read; it depends on the new Worker deployment.

Changes:
- Indexes matching Pancake status/entity filters, Telegram retention, public catalog ordering.
- Covering image index; public relation loading now orders by product_id first, preserving per-product image order.
- Durable product dirty set with insert/update triggers and one-time stale-snapshot backfill.
- Generation-checked acknowledgment preserves changes arriving during analysis; failed jobs remain pending.
- Snapshot writes check that product source fields still match before saving.
- Schema existence checks cached per database binding (positive 5 minutes, negative 5 seconds).

Validation: all migrations applied to in-memory SQLite; dirty-set backfill, mutation,
unpublish/republish, cascade deletion and index plans tested; existing D1/admin/Pancake
and ingredient tests passed; frontend build, D1 frontend/Worker bundle audits and
email flow tests passed. Migration added approximately 0.69 MB of database storage.

Production Worker version: `48d59fc5-2040-424d-a6de-e09ccf6f6889`.
Final verification: 45 D1/admin/Pancake/ingredient Node tests, 5 email tests,
and 6 real SQLite tests passed (56 total). Post-deploy homepage and uncached
public catalog API returned HTTP 200; the API returned 48 products and 227 images,
with every image attached to the correct product.

Correction: the active Worker imported productSyncD1.js, so the dirty-set runtime change became effective in Worker c59dacd3-0904-470f-9a25-56caaea30957 with the public cache deployment. The earlier queue benchmark measured the proposed SQL, not the then-active cron path.
