# PHASE 5 RELEASE REPORT

Date: 2026-03-10
Base URL: https://thegioitrimun.vn
Project: website-thegioitrimun

## A. Automated Gates

- [x] npm run lint
- [x] npm run build
- [x] npm run qa:smoke
- [x] Runtime matrix (COD/Bank, discount yes/no, GHTK/manual, cancel/refund/restock)

Runtime summary: Runtime matrix passed.

## B. Runtime Matrix Details

- [x] cancel_path_supported — fulfillment=cancelled, payment=failed
- [x] discount_code_created — PHASE5319BCD
- [x] invalid_transition_blocked — blocked
- [x] logs_recorded_for_bank_order — history=4, payments=3, refunds=1
- [x] order_bank_completed_and_paid — fulfillment=completed, payment=paid
- [x] order_bank_created — ISKIN7FB47584
- [x] order_bank_payment_method_bank_transfer — bank_transfer
- [x] order_bank_shipping_provider_ghtk — ghtk
- [x] order_cod_created — ISKIN07757388
- [x] order_cod_discount_applied — code=PHASE5319BCD, discount=53500.00
- [x] order_cod_full_refund_sets_refunded — payment=refunded, status=refunded
- [x] order_cod_manual_shipping — manual
- [x] order_cod_payment_method_cod — cod
- [x] over_refund_blocked — blocked
- [x] restock_once_returns_stock — initial=250, after_restock=250
- [x] second_restock_blocked — blocked
- [x] seed_product_available — product_id=5
- [x] stock_decrement_after_checkout — initial=250, after_create=249

## C. Manual Gates Pending (Gate 2/3)

- [ ] Auth: login/logout
- [ ] User profile update
- [ ] Booking create flow
- [ ] Checkout real order create on production UI
- [ ] Admin: Product/Service/Blog CRUD quick sanity
- [ ] Customer Order History UI: timeline + invoice PDF save-as

## D. Deployment Snapshot

- Latest production deployment id: dce62211-64fd-48d1-957c-ce93a2fc8d53
- Latest production source commit: 04f096e
- Latest production URL: https://dce62211.website-thegioitrimun.pages.dev
- Full deployment list captured: .tmp-phase5/deployments.log

## E. Go/No-Go

- Automated gates all pass: **YES**
- Final decision: **NO-GO until manual gates complete**
