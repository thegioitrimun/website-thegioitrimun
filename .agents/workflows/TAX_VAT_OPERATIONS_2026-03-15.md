# Tax & VAT Operations

## Kiến trúc hiện tại

- `products.vat_rate`
  - VAT theo từng sản phẩm.
  - Đây là nguồn ưu tiên cao nhất khi tính thuế hàng hóa ở checkout.
- `tax_profiles`
  - Rule thuế mặc định của hệ thống.
  - Chứa `tax_mode`, `default_rate`, `applies_to_shipping`, `currency`.
- `tax_rates`
  - Override theo khu vực.
  - Hiện đã hỗ trợ match theo `province` và `district`.
- `product_orders.tax_rate`
  - Snapshot thuế hàng hóa của đơn.
- `product_orders.shipping_tax_rate`
  - Snapshot thuế áp vào phí ship.
  - Tách riêng để không bị nhầm với VAT sản phẩm.

## Thứ tự ưu tiên khi tính thuế

1. Chọn `tax_profile` mặc định đang active.
2. Nếu có `tax_rates` match theo `province` / `district`, dùng override đó cho base rate.
3. Khi tính thuế hàng hóa:
   - dùng `products.vat_rate` nếu sản phẩm có giá trị này
   - nếu không có thì fallback về rate từ profile / khu vực
4. Khi tính thuế ship:
   - dùng `shipping_tax_rate` từ profile / khu vực
   - không dùng `products.vat_rate`

## Phần admin

- Tab `Thuế & VAT`
  - CRUD `tax_profiles`
  - CRUD `tax_rates`
- Form sản phẩm
  - có ô `VAT sản phẩm (%)`
- Danh sách sản phẩm admin
  - có quick edit `VAT (%)`
  - có bulk action `Đặt VAT hàng loạt`
- Excel import/export
  - dùng cột `vat_rate_percent`
  - vẫn đọc được `vat_rate` nếu file cũ còn dùng định dạng cũ

## Kiểm thử tự động

Lệnh:

```bash
SUPABASE_ACCESS_TOKEN=... npm run qa:tax
```

Script sẽ kiểm tra:

1. Có đúng 1 `tax_profile` mặc định.
2. Tất cả sản phẩm đều có `vat_rate` hợp lệ.
3. Quote RPC dùng đúng `vat_rate` của sản phẩm.
4. Override theo `province + district` hoạt động đúng cho thuế ship.
5. Fallback khi district không match hoạt động đúng.

## Ghi chú vận hành

- Không hiển thị VAT ở card sản phẩm để tránh ảnh hưởng conversion.
- VAT chỉ hiển thị ở checkout, order history và admin order analytics.
- Nếu cần tính thuế ship theo khu vực, bật `applies_to_shipping` ở `tax_profile` hoặc `tax_rates`.
