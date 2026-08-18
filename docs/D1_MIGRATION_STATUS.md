# Trạng thái migration Cloudflare D1

Cập nhật: 2026-08-11 (Asia/Ho_Chi_Minh)

## Trạng thái an toàn

- Production `thegioitrimun.vn` vẫn dùng `DATA_BACKEND=supabase`.
- Đã tạo cấu hình `wrangler.d1.production.jsonc`, nhưng chưa deploy lên route production.
- Không được cutover cho đến khi `npm run d1:cutover-gate` trả về `ok: true`.

## Tài nguyên production đã tạo

- `APP_DB`: `thegioitrimun-app` (`bffac3a5-7aa2-46dc-a8c2-179d049900c5`).
- `INCI_DB` runtime: `thegioitrimun-inci-runtime` (`aeee3cf2-ffc1-4955-9c31-80af865bb6bb`), khoảng 90,94 MB.
- Database INCI đầy đủ cũ đã được xóa khỏi D1 sau khi manifest và các part backup được xác nhận trực tiếp trên R2. Dữ liệu crawler thô vẫn còn trong `thegioitrimun-d1-backups`.
- R2 private: `thegioitrimun-private-records`.
- R2 backup: `thegioitrimun-d1-backups`.
- Queue email và DLQ: `thegioitrimun-notifications`, `thegioitrimun-notifications-dlq`.
- Queue vận chuyển và DLQ: `thegioitrimun-shipping`, `thegioitrimun-shipping-dlq`.
- Google OAuth, SMTP và OTP pepper đã được nạp bằng Worker Secrets. Apple OAuth không nằm trong phạm vi sản phẩm.
- SMTP SSL port 465 đã xác thực tài khoản thành công; chưa gửi email production.
- GHTK đang được khóa bằng `GHTK_ENABLED=false`; checkout không phụ thuộc GHTK.

## Tài nguyên staging

- `APP_DB`: `thegioitrimun-app-staging`
- `INCI_DB`: `thegioitrimun-inci-staging-runtime` (`b2360953-47fc-4db6-897e-05ff3c935ab3`)
- R2 private: `thegioitrimun-private-staging`
- R2 backup: `thegioitrimun-d1-backups-staging`
- Queue email: `thegioitrimun-notifications-staging`
- Queue vận chuyển: `thegioitrimun-shipping-staging`
- Worker staging đang chạy version `ec683d4d-5a54-44cf-a02e-d40ec4e6bcb2` với `INCI_DB` runtime gọn và Google OAuth duy nhất.
- Database INCI staging đầy đủ cũ đã được xóa sau khi xác nhận backup remote; staging chỉ còn database runtime.

## Dung lượng D1 Free

- Chính sách vận hành nằm tại `d1/capacity-policy.json`.
- Gate cảnh báo từ 400 MiB và chặn ở 450 MiB, trước giới hạn 500 MB của một database.
- Hiện có 4/10 database, tổng 203,04 MiB; database lớn nhất 86,72 MiB; còn 6 slot.
- APP chỉ archive dữ liệu lịch sử đã đóng sang database mới; cart, order, order item và inventory của cùng giao dịch không bị tách qua nhiều D1.
- INCI chỉ tạo shard kế tiếp khi có cảnh báo; một thành phần cùng toàn bộ alias/công dụng luôn nằm chung shard.
- Dữ liệu crawler thô và export bất biến được lưu trên R2, không nạp lại vào D1 runtime.
- Chạy `npm run d1:audit-capacity`; báo cáo được ghi tại `output/d1-capacity-report.json`. Cutover gate tự chạy lại audit này.

## Kết quả migration dữ liệu production

- APP: 6.186 câu lệnh import, database khoảng 15,44 MB.
- INCI runtime: 109.652 câu lệnh import, database khoảng 90,94 MB.
- Sản phẩm: 367/367.
- Ảnh sản phẩm: 2.009/2.009.
- Đơn hàng: 44/44; item: 55/55.
- Tổng tiền đơn: 24.618.700; tổng số lượng item: 58.
- Dịch vụ: 6/6; bước dịch vụ: 36/36.
- Bài viết: 360/360.
- INCI canonical: 13.050/13.050.
- 13.286 bản ghi crawler thô được giữ nguyên trong backup R2, không nạp vào D1 runtime. Bảng này không được Worker/analyzer sử dụng và trước đây chiếm khoảng 589 MB.
- Lỗi khóa ngoại APP/INCI: 0/0.

Bằng chứng nằm tại:

- `output/d1-migration/validation-report.json`
- `output/d1-migration/verification-remote.json`
- `output/d1-migration/private-storage-copy-report.json`

## Backup staging

R2 prefix:

`d1-backups/staging/pre-cutover-2026-08-10`

- APP SQL: 14.119.662 byte.
- INCI SQL: 665.251.701 byte, chia thành 3 phần để không vượt giới hạn upload của Wrangler.
- Manifest SHA-256 đã upload lên R2 và tải ngược so sánh byte thành công.
- Manifest cục bộ: `output/d1-backups/2026-08-09T18-33-21-263Z/manifest.json`.

## Backup production

R2 prefix:

`d1-backups/production/pre-cutover-2026-08-10`

- APP SQL: 14.119.662 byte.
- INCI SQL: 665.251.701 byte, chia thành 3 phần.
- Manifest đã tải ngược từ R2 và so sánh byte thành công.
- Manifest cục bộ: `output/d1-backups/2026-08-10T02-20-37-287Z/manifest.json`.

### Backup production runtime đã kiểm chứng

R2 prefix:

`d1-backups/production/pre-cutover-runtime-2026-08-10`

- APP SQL: 14.119.662 byte, SHA-256 `a0726314b531eacf03612e81dbf5dc602807db490fa516b37deffaeaeed09a15`.
- INCI runtime SQL: 86.869.152 byte, SHA-256 `2204f37115d0fda461544a6bdef628ed30a32778a29af461a6878f74972d31c9`.
- Hai object và manifest đã được tải ngược từ R2; kích thước và SHA-256 đều khớp.
- Manifest cục bộ: `output/d1-backups/2026-08-10T03-10-28-956Z/manifest.json`.
- Bản backup đầy đủ phía trên vẫn giữ 13.286 bản ghi crawler thô để phục vụ lưu trữ/đối chiếu; bản runtime phục vụ restore nhanh và vận hành D1.

## Kiểm thử đã đạt

- `npm run qa:d1`: 7/7 test.
- `npm run d1:validate-schema`: APP và INCI hợp lệ.
- `npx tsc --noEmit --pretty false`: đạt.
- `npm run build:d1`: đạt.
- `npm run qa:d1-bundle`: không tìm thấy kết nối Supabase trong bundle D1.
- `npm run qa:security`: 8/8 test.
- `npm run lint`: đạt.
- `npm audit`: 0 lỗ hổng sau khi nâng DOMPurify và các dependency toolchain đã vá.
- Wrangler staging dry-run: đạt; nhận đủ binding APP_DB, INCI_DB, R2, Queue, Images và rate limiter.
- Wrangler production dry-run với `_worker.js --assets dist`: đạt; không deploy production.
- Browser staging: `/`, `/san-pham`, chi tiết sản phẩm, `/phan-tich-thanh-phan` và `/dang-nhap` tải từ D1, không lỗi console hoặc tràn ngang ở 390 px; analyzer mẫu nhận diện 4/4.
- Sau khi chuyển binding staging sang `thegioitrimun-inci-staging-runtime`, analyzer được smoke test lại ở 390 px: nhận diện 4/4, render đầy đủ EWG/CIR, loại da và công dụng, không tràn ngang.
- Đối chiếu production runtime đạt 23/23 kiểm tra: số hàng nghiệp vụ, tổng tiền đơn, tổng số lượng item và 13.050 thành phần đều khớp; lỗi khóa ngoại APP/INCI bằng 0.
- Restore drill: APP_DB phục hồi đủ 23 nhóm kiểm tra; INCI runtime phục hồi 13.050 thành phần, 36.356 alias, 36.550 search term và 23.506 liên kết công dụng; khóa ngoại 0 lỗi.
- Restore drill phát hiện và đã xử lý giới hạn D1 Free: dữ liệu crawler thô được lưu ở R2, còn D1 runtime giảm từ khoảng 690 MB xuống 90,94 MB.
- Gate production chỉ còn yêu cầu xác minh Google OAuth callback production. Email DNS không chặn cutover; GHTK chỉ trở thành điều kiện bắt buộc khi `GHTK_ENABLED=true`.
- Cấu hình live `wrangler.jsonc` vẫn là `DATA_BACKEND=supabase`; cấu hình D1 production mới chỉ được kiểm tra bằng `--dry-run` và chưa deploy.

## Điều kiện production còn thiếu

1. Thêm callback production `https://thegioitrimun.vn/api/auth/google/callback` vào Google Cloud Console và xác minh đăng nhập thực tế.
2. Chạy lại smoke test rollback sau cutover rehearsal cuối cùng nếu cấu hình production thay đổi.
3. Khi có GHTK token/secret, bật `GHTK_ENABLED=true` rồi xác minh webhook production và idempotency trước release có GHTK.

Không được chuyển các cờ tương ứng trong `d1/cutover-capabilities.json` thành `true` nếu chưa có bằng chứng kiểm thử.
