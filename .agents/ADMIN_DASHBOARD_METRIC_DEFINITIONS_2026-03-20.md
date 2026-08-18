# Admin Dashboard Metric Definitions

## Pham vi

Tai lieu nay khoa cong thuc KPI cho dashboard quan tri de frontend, SQL RPC va export khop nhau.

## Order metrics

### Total orders

- Nguon: `product_orders.created_at`
- Dinh nghia: tong so don duoc tao trong khoang thoi gian loc

### Paid orders

- Nguon: `product_orders`
- Dinh nghia: don co `payment_status in ('paid','refunded')`
- Fallback:
  - `status = completed` -> `paid`
  - `status = refunded` -> `refunded`

### Pending orders

- Nguon: `product_orders`
- Dinh nghia: don co `fulfillment_status = pending`
- Fallback:
  - neu `fulfillment_status` null, map tu `status`

### Gross revenue

- Nguon: `coalesce(grand_total, total_price)`
- Dinh nghia: tong gia tri don co `payment_status in ('paid','refunded')` trong khoang thoi gian loc theo `product_orders.created_at`

### Refund total

- Nguon: `order_refunds`
- Dinh nghia: tong `amount` cua refund co `status = completed`
- Moc thoi gian: `coalesce(refunded_at, created_at)`

### Net revenue

- Cong thuc: `gross_revenue - refund_total`

### Average order value

- Cong thuc: `gross_revenue / paid_orders`

### Discount total

- Nguon: `product_orders.discount_amount`
- Dinh nghia: tong chiet khau tren cac don `paid/refunded`

### Tax total

- Nguon:
  - `product_orders.tax_amount`
  - `product_orders.shipping_tax_amount`
- Dinh nghia: tong thue tren cac don `paid/refunded`

### Shipping total

- Nguon: `product_orders.shipping_fee`
- Dinh nghia: tong phi ship tren cac don `paid/refunded`

### Guest orders

- Dinh nghia: don co `user_id is null`

## Customer metrics

### Total customers

- Nguon: `patients`
- Dinh nghia: `role = 'customer'`

### New customers

- Dinh nghia: customer co `patients.created_at` nam trong khoang loc

### Returning customers

- Dinh nghia: customer co it nhat 1 `paid/refunded` order trong ky loc va da tung co `paid/refunded` order truoc `p_from`

### Customer segment

- `hybrid_customer`: co order va co appointment
- `product_only_customer`: co order, khong co appointment
- `service_only_customer`: co appointment, khong co order
- `lead_only_customer`: chua co order va chua co appointment

### At risk customer

- Dinh nghia: khong co activity moi trong 60 ngay
- Activity = max cua:
  - `last_order_at`
  - `last_appointment_at`
  - `patients.updated_at`

## Appointment / Service metrics

### Appointments total

- Nguon: `appointments.created_at`
- Dinh nghia: tong lich hen tao trong ky loc

### Appointments pending / completed / cancelled

- Nguon: `appointments.status`

### Service revenue

- Nguon:
  - `invoices.total_amount`
  - join `medical_records`
- Dinh nghia:
  - tong invoice co `payment_status in ('paid','partial')`
  - moc thoi gian = `coalesce(invoices.payment_date, medical_records.created_at, medical_records.encounter_date)`

## Inventory metrics

### Published products

- Nguon: `products.is_published = true`

### Low stock products

- Dinh nghia:
  - `stock_quantity > 0`
  - `low_stock_threshold > 0`
  - `stock_quantity <= low_stock_threshold`

### Out of stock products

- Dinh nghia: `stock_quantity <= 0`

### Near expiry products

- Dinh nghia:
  - `expiry_date is not null`
  - `expiry_date` trong vong 30 ngay toi

### Inventory estimated value

- Cong thuc: `sum(max(stock_quantity, 0) * price)`

## Alert feed rules

### Order pending too long

- `fulfillment_status = pending`
- `created_at <= now() - 2h`

### Paid order missing shipping code

- `payment_status in ('paid','refunded')`
- `shipping_provider = 'ghtk'`
- `shipping_code is null/empty`
- `created_at <= now() - 30m`

### Refund pending too long

- `order_refunds.status = pending`
- `created_at <= now() - 24h`

### Appointment pending too long

- `appointments.status = pending`
- `created_at <= now() - 24h`

### Product out of stock but published

- `products.is_published = true`
- `stock_quantity <= 0`

### Product low stock

- `products.is_published = true`
- `stock_quantity <= low_stock_threshold`
