# PHASE 2 HANDOFF - ORDER LIFECYCLE + PAYMENT/REFUND

Date: 2026-03-10
Owner handoff: Codex
Project ref: `vwzgibsdtednpitbrdeb`

## 1) Snapshot hien tai

Da hoan thanh Phase 0 + Phase 1:

1. `20260310170500_phase0_order_hardening_idempotency.sql`
- Dong policy mo `Anyone can insert order items`.
- Them `checkout_idempotency_key`.
- Nang cap RPC `create_product_order_atomic(...)` co idempotency key.

2. `20260310193000_phase1_tax_foundation_checkout_pricing.sql`
- Them `tax_profiles`, `tax_rates`.
- Them snapshot cot thue tren `product_orders`:
  `tax_profile_id`, `tax_mode`, `tax_rate`, `taxable_amount`, `tax_amount`,
  `shipping_net_amount`, `shipping_tax_amount`, `currency`, `grand_total`.
- Tao RPC `quote_product_order_totals(...)`.
- Cap nhat RPC `create_product_order_atomic(...)` de tinh/persist tax snapshot server-side.

3. `20260310194500_drop_legacy_create_product_order_atomic.sql`
- Xoa overload cu cua `create_product_order_atomic` (khong co idempotency param).

4. Edge function da deploy:
- `order-email-notification` da doi sang dung field that trong DB + item list + tax + grand_total.

5. Frontend da cap nhat:
- Checkout lay quote tong tien tu backend (`quote_product_order_totals`).
- Order History/Admin Orders hien thi tax va uu tien `grand_total`.

## 2) File quan trong da doi (de doc truoc)

1. `supabase/migrations/20260310170500_phase0_order_hardening_idempotency.sql`
2. `supabase/migrations/20260310193000_phase1_tax_foundation_checkout_pricing.sql`
3. `supabase/migrations/20260310194500_drop_legacy_create_product_order_atomic.sql`
4. `services/api.ts`
5. `components/CheckoutPage.tsx`
6. `components/OrderHistoryPage.tsx`
7. `components/AdminPharmacyManagementPage.tsx`
8. `supabase/functions/order-email-notification/index.ts`
9. `types.ts`

## 3) Trang thai remote can xac nhan truoc khi lam tiep

Chay:

```bash
npx supabase migration list
```

Expected remote co den:
- `20260310170500`
- `20260310193000`
- `20260310194500`

## 4) Muc tieu buoc tiep theo (Phase 2)

Implement Order Lifecycle + Payment/Refund + Inventory Reversal.

### 4.1 DB schema

1. Tao enum `payment_status` (`unpaid`, `paid`, `failed`, `refunded`).
2. Tao enum `fulfillment_status` (`pending`, `processing`, `shipped`, `completed`, `cancelled`).
3. Them cot vao `product_orders`:
- `payment_method` (`cod`, `bank_transfer`)
- `payment_status`
- `fulfillment_status`

4. Tao bang:
- `order_status_history`
  - `id`, `order_id`, `from_status`, `to_status`, `actor_id`, `actor_role`, `note`, `created_at`
- `order_payments`
  - `id`, `order_id`, `method`, `amount`, `status`, `transaction_ref`, `paid_at`, `metadata`, `created_at`
- `order_refunds`
  - `id`, `order_id`, `amount`, `reason`, `status`, `restocked`, `refunded_at`, `created_by`, `created_at`

5. RLS:
- Admin full manage.
- Customer chi xem records cua own order.

### 4.2 RPC/business logic

1. Tao RPC `transition_order_status(...)`:
- Validate state machine, khong cho nhay trang thai sai.
- Insert vao `order_status_history` moi lan doi status.

2. Tao RPC `create_order_refund(...)`:
- Ghi `order_refunds`.
- Update `payment_status`/`status` hop le.
- Restock theo rule (chi restock 1 lan, co flag).

3. Cap nhat edge functions lien quan shipping:
- `create-ghtk-order`
- `cancel-ghtk-order`
- `ghtk-webhook`

Can dong bo voi `fulfillment_status` (tranh conflict giua shipping va payment).

### 4.3 Frontend/Admin

1. Admin Orders:
- Tach filter `payment_status` va `fulfillment_status`.
- Action update status di qua API `transition_order_status` (khong update truc tiep bang `.update`).

2. Them UI refund:
- Nhap amount/reason/restock.
- Goi `create_order_refund`.

3. Modal chi tiet don:
- Hien timeline status (`order_status_history`).
- Hien payment logs + refund logs.

### 4.4 Inventory reversal rules (bat buoc chot ro)

De xuat:

1. `cancelled` truoc khi giao hang -> restock full.
2. `refunded` sau khi giao -> restock tuy case (manual checkbox trong admin).
3. Moi dong order item chi restock toi da 1 lan (can flag/chot o `order_refunds` hoac bang phụ).

## 5) Acceptance criteria Phase 2

1. Khong the update status sai flow qua API.
2. Moi status change co 1 dong trong `order_status_history`.
3. Refund tao duoc record + cap nhat tong tien/trang thai hop le.
4. Restock xay ra dung 1 lan theo rule.
5. Admin xem duoc history/payment/refund trong order detail.
6. Build pass + migration pass + khong vo checkout flow hien tai.

## 6) Commands cho phien tiep theo

```bash
# 1) Kiem tra trang thai
npm run build
npx supabase migration list

# 2) Sau khi viet migration moi
npx supabase db push --linked --yes

# 3) Neu sua edge functions
npx supabase functions deploy create-ghtk-order --project-ref vwzgibsdtednpitbrdeb
npx supabase functions deploy cancel-ghtk-order --project-ref vwzgibsdtednpitbrdeb
npx supabase functions deploy ghtk-webhook --project-ref vwzgibsdtednpitbrdeb
npx supabase functions deploy order-email-notification --project-ref vwzgibsdtednpitbrdeb
```

## 7) Luu y quan trong

1. Khong rollback schema hien co; lam migration additive.
2. Khong sua tay tong tien o frontend; backend la source of truth.
3. `total_price` hien dang duoc dung de backward compatibility; `grand_total` la gia tri uu tien cho luong moi.
4. Nen bo sung key i18n cho cac label tax/status moi (hien mot so cho dung fallback text).

## 8) Prompt goi y cho session sau

```text
Tiep tuc Phase 2 theo file PHASE2_HANDOFF_ORDER_TAX.md.
Muc tieu: state machine don hang + payment/refund logs + restock an toan.
Lam migration truoc, sau do update API va AdminPharmacyManagementPage de dung RPC transition/refund.
Ket thuc bang build pass, db push, va bao cao file da doi + acceptance criteria.
```
