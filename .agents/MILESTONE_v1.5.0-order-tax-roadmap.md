# MILESTONE v1.5.0 — Order Management + Tax Upgrade Roadmap

Ngày lập kế hoạch: 2026-03-10
Nguồn tham chiếu: `Readme.md`, `.agents/workflows/SUPABASE_AGENT_SETUP.md`, code hiện tại trong `components/`, `services/`, `supabase/functions/`, `supabase/migrations/`.

## 1) Hiện trạng và khoảng trống chính

1. Luồng checkout đã có RPC atomic (`create_product_order_atomic`) và trừ tồn kho theo transaction.
2. Chưa có engine thuế: chưa có `tax_rate`, `tax_amount`, `tax_breakdown`, chưa tách net/gross.
3. Trạng thái đơn hàng đang gộp chung (đặt hàng + thanh toán + vận hành), chưa có state machine chuẩn.
4. Chưa có lịch sử chuyển trạng thái (audit trail), chưa có bảng payment/refund riêng.
5. Có policy mở rộng rủi ro: `Anyone can insert order items`.
6. Hàm email đơn hàng đang dùng sai field (`total_amount`, `order.note`, `shipping_address`...), dữ liệu email có thể sai.
7. Chưa có logic hoàn kho khi `cancelled/refunded`.
8. Admin Orders đã có filter/bulk/export nhưng chưa có dashboard tài chính thuế và SLA vận hành.

## 2) Mục tiêu nghiệp vụ v1.5.0

1. Chuẩn hóa vận hành đơn hàng theo vòng đời đầy đủ: `pending -> paid -> processing -> shipped -> completed` + nhánh `cancelled/refunded`.
2. Tính thuế server-side, lưu snapshot thuế tại thời điểm đặt hàng, chống sai số và chống sửa tay frontend.
3. Có log/audit để truy vết mọi cập nhật trạng thái, phục vụ kiểm soát nội bộ.
4. Báo cáo admin có chỉ số doanh thu trước thuế, thuế phải nộp, hoàn tiền, COD còn phải đối soát.
5. Không làm gián đoạn production checkout hiện tại.

## 3) Phạm vi kỹ thuật (đề xuất)

### 3.1 Database

1. Bổ sung vào `product_orders`:
   - `payment_method` (`cod` | `bank_transfer`)
   - `payment_status` (`unpaid` | `paid` | `failed` | `refunded`)
   - `fulfillment_status` (`pending` | `processing` | `shipped` | `completed` | `cancelled`)
   - `currency` (mặc định `VND`)
   - `tax_mode` (`exclusive` | `inclusive`)
   - `tax_rate` (numeric)
   - `tax_amount` (numeric)
   - `shipping_tax_amount` (numeric)
   - `taxable_amount` (numeric)
   - `grand_total` (numeric; thay vai trò tổng cuối cùng)
2. Tạo bảng `tax_profiles` + `tax_rates` (hỗ trợ hiệu lực theo thời gian và khu vực).
3. Tạo bảng `order_status_history` (audit), `order_payments`, `order_refunds`, `order_internal_notes`.
4. Bổ sung unique chống tạo đơn trùng: `checkout_idempotency_key`.

### 3.2 RPC và backend

1. Nâng cấp RPC `create_product_order_atomic` để:
   - Tự tính subtotal/discount/tax/shipping/total server-side.
   - Validate chuyển đổi trạng thái ban đầu theo `payment_method`.
   - Ghi status history ngay khi tạo đơn.
2. Tạo RPC `transition_order_status` để cập nhật trạng thái theo state machine.
3. Tạo RPC `create_order_refund` để hoàn tiền và hoàn kho có điều kiện.
4. Chuẩn hóa logic email và webhook theo field mới.

### 3.3 Frontend

1. `CheckoutPage.tsx`: hiển thị breakdown `Tạm tính -> Giảm giá -> Thuế -> Ship -> Tổng cộng`.
2. `OrderHistoryPage.tsx`: hiển thị tax + payment status + timeline trạng thái.
3. `AdminPharmacyManagementPage.tsx`:
   - Filter theo `payment_status`, `fulfillment_status`, thời gian.
   - Cập nhật trạng thái qua action hợp lệ (không cho nhảy trạng thái sai).
   - Modal chi tiết có tax breakdown, payment logs, refund logs.
   - Export Excel thêm cột thuế và thanh toán.

## 4) Kế hoạch triển khai theo phase

## Phase 0 — Stabilize & Security (2026-03-10 đến 2026-03-12)

1. Fix `order-email-notification` dùng đúng field thực tế từ `product_orders`.
2. Truyền `userId` vào `getDiscountCode(...)` khi user đã đăng nhập để preview chính xác giới hạn per-user.
3. Đóng policy `Anyone can insert order items` (nếu không chạy guest checkout).
4. Bổ sung guard chống double-click checkout bằng `idempotency key` phía frontend.

Tiêu chí nghiệm thu:
1. Email đơn mới hiển thị đúng tổng tiền và địa chỉ.
2. Không còn insert trực tiếp `product_order_items` từ client.
3. Không tạo trùng 2 đơn khi click đặt hàng liên tục.

## Phase 1 — Tax Foundation (2026-03-13 đến 2026-03-18)

1. Migration tạo bảng/cột thuế và seed tax profile mặc định.
2. Refactor RPC tạo đơn: server tính và persist đầy đủ tax snapshot.
3. Mọi phép tính tiền chuyển về backend, frontend chỉ hiển thị.

Tiêu chí nghiệm thu:
1. 100% đơn mới có `tax_rate`, `tax_amount`, `grand_total`.
2. Sai lệch tính tiền frontend/backend = 0.

## Phase 2 — Lifecycle + Payment + Inventory Reversal (2026-03-19 đến 2026-03-24)

1. Tách rõ `payment_status` và `fulfillment_status`.
2. Tạo state machine + RPC `transition_order_status`.
3. Thêm `order_status_history` + `order_payments` + `order_refunds`.
4. Hoàn kho khi `cancelled/refunded` theo rule rõ ràng.

Tiêu chí nghiệm thu:
1. Không thể cập nhật trạng thái sai luồng qua API.
2. Mọi thay đổi trạng thái đều có bản ghi history.
3. Hủy/hoàn tiền làm kho tăng lại đúng số lượng.

## Phase 3 — Admin Operations (2026-03-25 đến 2026-03-31)

1. Nâng cấp tab Orders trong `AdminPharmacyManagementPage.tsx`.
2. Thêm dashboard tài chính: gross, discount, tax payable, net revenue, refunded amount.
3. Bulk action an toàn theo điều kiện trạng thái.
4. Export đơn hàng có đầy đủ cột tài chính/thuế.

Tiêu chí nghiệm thu:
1. Admin theo dõi được số thuế theo ngày/tháng.
2. Export Excel đủ để đối soát kế toán.

## Phase 4 — Customer Transparency + Invoice (2026-04-01 đến 2026-04-05)

1. `OrderHistoryPage.tsx` hiển thị tax/payment/fulfillment timeline.
2. Thêm chứng từ đơn hàng (invoice summary) cho khách tải PDF (v1 basic).
3. Đồng bộ text i18n cho các trường thuế/trạng thái mới.

Tiêu chí nghiệm thu:
1. Khách nhìn thấy đầy đủ cấu phần thanh toán của đơn.
2. Không còn chuỗi hardcode chưa dịch ở flow đơn hàng mới.

## Phase 5 — QA + Release (2026-04-06 đến 2026-04-08)

1. Test matrix:
   - COD + Bank transfer
   - Có/không mã giảm giá
   - GHTK + manual shipping
   - Cancel + refund + restock
2. Chạy smoke test production checklist trước deploy Cloudflare.
3. Deploy theo `.agents/workflows/deploy-to-cloudflare.md`.

Tiêu chí nghiệm thu:
1. Không có regression checkout.
2. Build pass, migration pass, workflow vận hành pass.

## 5) Danh sách file dự kiến tác động

1. `components/CheckoutPage.tsx`
2. `components/OrderHistoryPage.tsx`
3. `components/AdminPharmacyManagementPage.tsx`
4. `contexts/CartContext.tsx`
5. `services/api.ts`
6. `types.ts`
7. `supabase/migrations/*` (thêm migration mới)
8. `supabase/functions/order-email-notification/index.ts`
9. `supabase/functions/create-ghtk-order/index.ts`
10. `supabase/functions/cancel-ghtk-order/index.ts`
11. `src/locales/*/translation.json`

## 6) Rủi ro và cách giảm rủi ro

1. Rủi ro thay đổi schema ảnh hưởng dữ liệu cũ.
   - Giải pháp: migration additive, backfill, không xóa cột cũ ở v1.5.0.
2. Rủi ro sai số tính tiền khi chuyển logic server-side.
   - Giải pháp: snapshot test với bộ dữ liệu chuẩn, lock rounding rule.
3. Rủi ro trạng thái GHTK mâu thuẫn trạng thái nội bộ.
   - Giải pháp: mapping status tập trung một chỗ, log conflict để xử lý thủ công.

## 7) Định nghĩa hoàn thành (DoD)

1. Order flow có tax breakdown đầy đủ ở cả customer và admin.
2. Payment status tách riêng fulfillment status.
3. Có audit trail trạng thái, có hoàn kho khi huỷ/hoàn tiền.
4. Báo cáo thuế và doanh thu export được từ admin.
5. Không còn policy order-item quá mở và không còn email payload sai field.
