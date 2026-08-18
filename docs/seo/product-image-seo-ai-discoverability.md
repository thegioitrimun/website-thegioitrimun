# Product Image SEO + AI Discoverability

Mục tiêu của lớp này là bảo đảm Google, Google Images, Merchant Center và các hệ thống AI đọc được đúng từng sản phẩm, đúng URL chi tiết, đúng ảnh sản phẩm, không rơi về trang chủ.

## Public Endpoints

- `/sitemap.xml`: sitemap tổng của website.
- `/sitemap-products.xml`: chỉ chứa URL chi tiết sản phẩm.
- `/sitemap-images.xml`: URL chi tiết sản phẩm kèm image sitemap tags.
- `/feeds/google-products.xml`: Google Merchant RSS feed cho sản phẩm public có giá và ảnh.
- `/ai/products.json`: catalog sản phẩm công khai cho AI/agent.
- `/ai/services.json`: catalog dịch vụ công khai cho AI/agent.
- `/ai/site-profile.json`: hồ sơ website công khai.
- `/llms.txt`: hướng dẫn entry point cho AI crawler.

## Required Checks

Chạy sau mỗi batch import ảnh hoặc thay đổi SEO worker:

```bash
npm run seo:export-product-image-inventory
npm run qa:seo-googlebot-products
npm run qa:seo-images
```

Chạy chế độ fail cứng khi muốn chặn release:

```bash
SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-googlebot-products
SEO_AUDIT_FAIL_ON_FINDINGS=1 npm run qa:seo-images
```

## Google Search Console

Submit các sitemap sau:

- `https://thegioitrimun.vn/sitemap.xml`
- `https://thegioitrimun.vn/sitemap-products.xml`
- `https://thegioitrimun.vn/sitemap-images.xml`

Khi kiểm URL sản phẩm, dùng URL chi tiết dạng:

```text
https://thegioitrimun.vn/san-pham/{category-slug}/{product-slug}
```

Nếu Google Images trả về homepage, kiểm ngay:

- Canonical của trang sản phẩm có trỏ đúng URL chi tiết không.
- `og:url` có trỏ đúng URL chi tiết không.
- `og:image` có phải ảnh sản phẩm thật không.
- JSON-LD `Product.url` và `Product.image` có đúng không.
- `/sitemap-images.xml` có chứa URL sản phẩm và image loc tương ứng không.

## Google Merchant Center

Tạo feed bằng URL:

```text
https://thegioitrimun.vn/feeds/google-products.xml
```

Feed này chỉ lấy sản phẩm public, không archive, có ảnh đại diện và có giá. Sản phẩm không có ảnh đại diện bị loại khỏi Merchant feed để tránh lỗi chất lượng dữ liệu.

## AI Discovery

Các hệ thống AI nên dùng:

- `https://thegioitrimun.vn/llms.txt`
- `https://thegioitrimun.vn/ai/products.json`
- `https://thegioitrimun.vn/ai/services.json`
- `https://thegioitrimun.vn/ai/site-profile.json`

Các endpoint AI chỉ xuất dữ liệu công khai, không có đơn hàng, tài khoản, số điện thoại, email khách hàng hoặc dữ liệu admin.
