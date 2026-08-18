# Milestone: Admin Product Ops + Discount Engine + Atomic Checkout (v1.4.0-stable)

Mốc `v1.4.0-stable` tập trung vào 3 nhóm nâng cấp lớn:
1. Quản trị nhà thuốc tiện hơn cho vận hành hàng ngày.
2. Hệ thống mã giảm giá + checkout atomic an toàn dữ liệu tồn kho.
3. Theo dõi funnel cơ bản để tối ưu chuyển đổi.

---

## 1) Highlights

### A. Product Management (Admin) - tối ưu thao tác
- **Quick Edit ngay trên bảng sản phẩm**: chỉnh nhanh SKU, giá, tồn kho, ngưỡng tồn thấp, hạn dùng.
- **Lưu nhanh theo dòng** với validate dữ liệu trước khi lưu.
- **Bulk Actions** theo checkbox:
  - Hiện/ẩn web hàng loạt
  - Bật/tắt nổi bật hàng loạt
  - Đổi chuyên mục/thương hiệu hàng loạt
  - Cộng/trừ tồn kho hàng loạt
  - Đặt ngưỡng tồn thấp hàng loạt
  - Xóa sản phẩm hàng loạt
- **Smart Filters** mới:
  - Đang ẩn web
  - Đang nổi bật
  - Sắp hết hạn 30 ngày
  - Thiếu SKU

### B. Discount Codes + Checkout Atomic (Supabase)
- Thêm bảng và logic:
  - `discount_codes`
  - `discount_code_usages`
  - `funnel_events`
- Thêm RPC:
  - `validate_discount_code(...)`
  - `create_product_order_atomic(...)`
- Checkout chuyển sang RPC atomic để:
  - Validate giỏ hàng + tồn kho ở DB
  - Tránh race condition khi chốt đơn
  - Ghi nhận discount usage đúng transaction
- Hoàn thiện **CRUD mã giảm giá** trên Admin Pharmacy tab.

### C. Funnel Events (best-effort)
- Track các sự kiện chính:
  - `view_product`
  - `add_to_cart`
  - `apply_discount`
  - `begin_checkout`
  - `purchase`
  - `checkout_failed`
- Lưu theo `session_id` + `user_id` (nếu có) + `path`.

### D. Import an toàn hơn
- Validate trước khi ghi DB:
  - Thiếu tên/chuyên mục
  - Giá/tồn/ngưỡng âm hoặc sai kiểu
  - Trùng SKU/slug trong file
  - Trùng SKU/slug với dữ liệu hiện có
  - JSON mô tả sai định dạng
  - Hạn dùng không hợp lệ

---

## 2) Changed Files (chính)

- `App.tsx`
- `components/AdminPharmacyManagementPage.tsx`
- `components/CheckoutPage.tsx`
- `components/ProductDetailPage.tsx`
- `contexts/CartContext.tsx`
- `services/api.ts`
- `types.ts`
- `supabase/migrations/20260310114000_add_discount_codes_atomic_checkout_and_funnel_events.sql`

---

## 3) Validation Status

- `npm run lint` ✅ pass
- `npm run build` ✅ pass
- Supabase migration đã áp dụng trên project liên kết.
- Deploy production qua Cloudflare Pages (Direct Upload) thành công.

---

## 4) Suggested Tag

```bash
git tag -a v1.4.0-stable -m "Admin ops, discount engine, atomic checkout, funnel tracking"
git push origin v1.4.0-stable
```

---

## 5) Deployment Notes

- Project Cloudflare Pages: `website-thegioitrimun`
- Domain production: `https://thegioitrimun.vn`
- Deploy command:

```bash
npm run deploy:pages
```

