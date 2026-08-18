# PHASE 3 PROGRESS REPORT - ADMIN OPERATIONS (ORDERS FINANCIAL DASHBOARD)

Date: 2026-03-10
Project ref: `vwzgibsdtednpitbrdeb`

## Completed

1. Admin Orders financial dashboard
- Added financial KPI block on filtered order set:
  - gross before tax
  - discount total
  - tax payable
  - refunded total
  - net revenue
- Kept operational KPI block (total/today/month/pending/completed/revenue).

2. Refund-aware order dataset in admin
- Updated `getAllProductOrders()` to include `refund_logs:order_refunds(*)`.
- Normalized `refund_logs` in `normalizeProductOrderRow(...)`.
- After creating a refund from order detail modal, local order state is now refreshed with:
  - `status_history`
  - `payment_logs`
  - `refund_logs`
  so dashboard/export reflects latest refund values immediately.

3. Export for accounting reconciliation
- Enhanced Orders export with:
  - `tax_total`
  - `gross_before_tax`
  - `refunded_amount`
  - `net_revenue`
- Existing tax/payment/shipping columns are preserved.

4. i18n updates
- Added admin translation keys for new order list heading/export label and financial KPI labels in:
  - `src/locales/vi/translation.json`
  - `src/locales/en/translation.json`
  - `src/locales/ru/translation.json`
  - `src/locales/cn/translation.json`

## Validation

- `npm run lint` => PASS
- `npm run build` => PASS
- `npm run qa:smoke` => PASS

## Git + Deploy

- Commit on `main`:
  - `4ac42f4 feat(admin-orders): add financial KPIs and refund-aware export`
- Pushed to `origin/main`.
- Cloudflare Pages production deployment:
  - deployment id: `56d1bd90-a7c4-44e6-be9c-ed26466aa805`
  - source commit: `4ac42f4`
  - URL: `https://56d1bd90.website-thegioitrimun.pages.dev`

