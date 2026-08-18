# PHASE 2 PROGRESS REPORT - ORDER LIFECYCLE / PAYMENT / REFUND

Date: 2026-03-10
Project ref: `vwzgibsdtednpitbrdeb`

## Completed

1. Database migrations (remote applied)
- `20260310213000_phase2_order_lifecycle_payment_refund.sql`
- `20260310222000_phase2_refund_cap_hotfix.sql`

2. Schema + logic
- Added enums: `payment_status`, `fulfillment_status`.
- Added columns on `product_orders`: `payment_method`, `payment_status`, `fulfillment_status`.
- Added tables: `order_status_history`, `order_payments`, `order_refunds`.
- Added RLS policies:
  - Admin full manage.
  - Customer view own order-related records.
- Added RPCs:
  - `transition_order_status(...)` with state-machine validation + history log.
  - `create_order_refund(...)` with optional restock, one-time restock guard, and cumulative refund cap.
- Added triggers to keep legacy `status` and new lifecycle columns synced and seed initial logs.

3. Frontend/Admin
- Admin Orders now:
  - Filters by `fulfillment` and `payment` separately.
  - Uses `transition_order_status` for single and bulk status updates.
  - Shows order detail lifecycle timeline + payment logs + refund logs.
  - Supports refund creation (`amount/reason/restock`) via `create_order_refund`.
  - Restricts row-level dropdown options to allowed transitions.

4. API layer
- Added:
  - `transitionOrderStatus(...)`
  - `createOrderRefund(...)`
  - `getOrderLifecycleLogs(...)`
- Normalized order lifecycle fields consistently when loading orders.

5. Edge functions deployed
- `create-ghtk-order`
- `cancel-ghtk-order`
- `ghtk-webhook`

All 3 functions now use `transition_order_status` to keep lifecycle/history in sync.

## Remote verification

- `npx supabase migration list` confirms remote has:
  - `20260310213000`
  - `20260310222000`

- SQL checks (Management API):
  - `product_orders` has lifecycle columns (`payment_method`, `payment_status`, `fulfillment_status`).
  - RPCs exist: `transition_order_status`, `create_order_refund`.
  - RLS policies exist for all three new log tables.
  - Existing orders all have non-null lifecycle fields.
  - Existing orders all have seed status/payment logs.

## Build status

- `npm run build` passed after all changes.
- `npm run lint` passed.
- `npm run qa:smoke` passed (Gate 1 static checks + live SEO/routes sanity).

## Cloudflare Pages deployment status

- Preview deployment created from branch `codex/phase2-order-lifecycle-payment-refund`:
  - `https://a9a89a6b.website-thegioitrimun.pages.dev`
  - alias: `https://codex-phase2-order-lifecycle.website-thegioitrimun.pages.dev`
- Production deployment is active on branch `main` with source commit `af0175c`:
  - deployment id: `54afcf05-5996-424b-8381-d8b05d1b2836`
  - URL: `https://54afcf05.website-thegioitrimun.pages.dev`
- Main branch was fast-forwarded and pushed to include Phase 2 commits.
- Production was redeployed from updated `main` head (`591824b`):
  - deployment id: `c1f3ba8c-b052-4b44-95e7-89af3309fc92`
  - URL: `https://c1f3ba8c.website-thegioitrimun.pages.dev`
- Verification command:
  - `npx wrangler pages deployment list --project-name website-thegioitrimun`

## Runtime acceptance smoke test (DB transaction, rolled back)

Executed on remote via Supabase Management API in a single transaction and `ROLLBACK`:
- Create synthetic order + item.
- Transition flow: `pending -> processing -> shipped -> completed`.
- Assert invalid transition (`completed -> pending`) is rejected.
- Assert transition logs are inserted.
- Refund flow:
  - partial refund with `restock=true` succeeds.
  - second `restock=true` refund is rejected (one-time restock rule).
  - cumulative over-refund is rejected.
  - final allowed refund moves order to `payment_status=refunded` and `status=refunded`.

Result returned by SQL runtime test:
- `PHASE2_RUNTIME_TEST_PASS`

## Notes

- Frontend contains additional in-progress changes from earlier phases in other files:
  - `components/CheckoutPage.tsx`
  - `components/OrderHistoryPage.tsx`
  - `contexts/CartContext.tsx`
  - `supabase/functions/order-email-notification/index.ts`

These were already present before this Phase 2 continuation and were kept intact.
