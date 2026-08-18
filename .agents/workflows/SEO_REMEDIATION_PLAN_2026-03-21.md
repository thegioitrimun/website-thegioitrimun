# SEO Remediation Plan 2026-03-21

## Objective
- Tăng chất lượng SEO thực chiến cho `blog` và `product` mà không thay đổi kết cấu giao diện.
- Ưu tiên các backlog đang bị governance audit báo lớn nhất.
- Đóng gói remediation thành batch có thể chạy lặp lại, có report và có audit sau khi chạy.

## Scope
1. Blog batch remediation
- backfill cover image mặc định khi thiếu
- chuẩn hóa meta description / meta keywords cơ bản
- thêm heading mở đầu nếu bài chưa có heading
- chèn khối internal links và commerce links có kiểm soát
- tạo report thay đổi

2. Product batch remediation
- sinh FAQ riêng từ dữ liệu thật của sản phẩm
- bổ sung text block và image block cho `long_description` khi thiếu
- tận dụng ảnh trong `long_description` để backfill gallery
- backfill locale core fields `en/ru/cn` cho name, description, usage, ingredients, benefits, origin, texture, skin types
- tạo report thay đổi

3. Governance
- workflow manual để chạy từng batch hoặc toàn bộ
- audit SEO content chạy ngay sau remediation để đo lại backlog

## Safety Rules
- chỉ update row khi có thay đổi thực
- không ghi đè locale đã có dữ liệu usable
- remediation block trong blog được đánh dấu bằng `<!-- seo-autofix:start --> ... <!-- seo-autofix:end -->` để có thể rerun an toàn
- ưu tiên dùng dữ liệu sẵn có trong DB, không dựng review giả và không đổi layout runtime

## Execution Order
1. `dry_run` toàn bộ để kiểm tra phạm vi tác động
2. chạy batch `blog`
3. audit lại
4. chạy batch `product`
5. audit lại
6. nếu backlog giảm tốt thì mới cân nhắc siết governance từ report mode sang fail mode

## Runtime Entry Points
- `npm run seo:autofix-blog`
- `npm run seo:autofix-product`
- workflow: `.github/workflows/seo-batch-remediation.yml`
