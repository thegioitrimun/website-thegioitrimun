# Runbook Chuyển Supabase Sang Cloudflare D1

## Nguyên tắc an toàn

- `wrangler.jsonc` production phải giữ `DATA_BACKEND=supabase` cho đến khi `npm run d1:cutover-gate` trả về `ok: true`.
- Không xóa Supabase. Sau cutover, chuyển hai project sang read-only tối thiểu 14 ngày.
- Không chép secret vào source, D1, frontend, log, file migration hoặc tài liệu này.
- D1 là SQLite. Chính sách Free dùng tối đa 10 database, cảnh báo ở 400 MiB và chặn cutover ở 450 MiB cho từng database để còn biên trước giới hạn 500 MB.
- Chạy `npm run d1:audit-capacity` trước mọi migration/cutover. Không tạo database rỗng trước nhu cầu thực tế.

## Kiến trúc đích

- `APP_DB`: OAuth, người dùng, quyền, sản phẩm, nội dung, đơn hàng, tồn kho, dịch vụ, lịch hẹn, vận đơn, outbox email và báo cáo.
- `INCI_DB`: thành phần, alias, EWG, CIR, công dụng và dữ liệu tìm kiếm.
- Worker là cổng duy nhất tới D1, R2 private, SMTP và GHTK.
- `R2_IMAGES` chứa ảnh công khai. `PRIVATE_RECORDS` chứa hồ sơ/tài liệu riêng tư và chỉ được tải qua API đã kiểm tra session/RBAC.
- `NOTIFICATION_QUEUE`, `SHIPPING_QUEUE` và `PANCAKE_QUEUE` tách tác vụ chậm khỏi checkout.

## 1. Chuẩn bị Cloudflare staging

Tài khoản hoặc API token cần quyền Workers, D1, R2 và Queues. Token hiện tại phải tạo/list được D1 trước khi tiếp tục.

```bash
npx wrangler whoami
npm run d1:provision
```

Tạo file cấu hình staging từ `wrangler.d1.staging.example.jsonc`, điền database ID và giữ file chứa ID thực ngoài git nếu cần.

Tạo Queue và DLQ:

```bash
npx wrangler queues create thegioitrimun-notifications-staging
npx wrangler queues create thegioitrimun-notifications-staging-dlq
npx wrangler queues create thegioitrimun-shipping-staging
npx wrangler queues create thegioitrimun-shipping-staging-dlq
npx wrangler queues create thegioitrimun-pancake-staging
npx wrangler queues create thegioitrimun-pancake-staging-dlq
```

## 2. Cấu hình secret

Thiết lập bằng `wrangler secret put --config <config-staging>` cho từng tên sau:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
- `SMTP_FROM_NAME`, `SMTP_FROM_ADDRESS`, `ADMIN_NOTIFICATION_EMAIL`
- `ORDER_LOOKUP_OTP_PEPPER` (chuỗi ngẫu nhiên riêng, tối thiểu 32 byte; không dùng lại mật khẩu SMTP)
- `GHTK_TOKEN`, `GHTK_WEBHOOK_SECRET` khi `GHTK_ENABLED=true`
- `PANCAKE_API_KEY` khi `PANCAKE_ENABLED=true`; shop ID và warehouse ID là Worker vars, không phải frontend vars
- Các secret AI/monitoring còn dùng trong Worker hiện tại

Không dùng SMTP production để test tải. Tạo người nhận test được kiểm soát trước.

## 3. OAuth

- Staging callback: `https://iskin-clinic-d1-staging.thegioitrimun.workers.dev/api/auth/google/callback`
- Production callback: `https://thegioitrimun.vn/api/auth/google/callback`
- Chỉ Google OAuth được bật; Worker từ chối các provider khác.
- Xác minh `state`, `nonce`, PKCE/redirect URI và email verified bằng test tích hợp.
- Tài khoản cũ chỉ liên kết khi provider ID khớp hoặc OAuth trả email đã xác minh.
- Session Supabase cũ không được nhập vào D1.

## 4. Email domain và SMTP

- Gửi thử HTML và text cho Gmail, Outlook, Yahoo/Apple Mail; kiểm tra spam và header authentication.
- SMTP `accepted` chỉ có nghĩa server nhận sau `DATA`, không khẳng định thư đã vào inbox.
- `delivery_unknown` phải được xử lý thủ công, không tự retry vì có thể tạo thư trùng.
- OTP tra cứu đơn được mã hóa AES-GCM trong outbox, chỉ giải mã trong Queue consumer và không xuất hiện trong log hoặc HTTP response.
- IMAP/POP3 không nằm trong Worker; phản hồi được đọc bằng webmail/email client.

## 5. Export và kiểm tra nguồn

Tạo `.env` cục bộ với URL/service key của hai Supabase, không commit file này.

```bash
npm run d1:export:supabase
npm run d1:validate-export
npm run d1:generate-import
npm run d1:validate-schema
```

`validation-report.json` phải xác nhận:

- Checksum từng bảng khớp manifest.
- Không thiếu bảng bắt buộc.
- Quan hệ chính không có bản ghi mồ côi.
- Dung lượng dự phóng an toàn cho D1.

## 6. Import staging và xác minh

Kiểm tra migration local trước. Các lệnh local tự dùng `wrangler.d1.local.jsonc`, không phụ thuộc hoặc chỉnh sửa cấu hình production:

```bash
npm run d1:migrate:local
```

```bash
D1_WRANGLER_CONFIG=wrangler.d1.staging.jsonc npm run d1:migrate:remote
D1_WRANGLER_CONFIG=wrangler.d1.staging.jsonc npm run d1:import:remote
D1_WRANGLER_CONFIG=wrangler.d1.staging.jsonc npm run d1:verify:remote
```

`d1:migrate:remote` chỉ tạo/cập nhật schema. `d1:import:remote` mới nạp dữ liệu đã xuất. File import không được chứa `BEGIN`/`COMMIT`, phải nhỏ hơn 5 GiB và checksum `.sha256` phải khớp trước khi Wrangler chạy.

Đối chiếu tối thiểu:

- Row count toàn bộ bảng.
- Tổng tiền đơn hàng, tổng số lượng item, tồn kho, refund.
- Người dùng/role, lịch sử trạng thái, appointment.
- Ingredient count, alias và snapshot phân tích.
- `PRAGMA foreign_key_check` không trả lỗi.

## 7. Shadow read

Trên một Worker không nhận traffic production hoặc trên production với `DATA_BACKEND=supabase`, bind `APP_DB` và bật `D1_SHADOW_READ=true`.

- Response vẫn đến từ Supabase.
- Worker chỉ ghi checksum/count/key khi D1 khác nguồn vào `shadow_read_diffs`.
- Không ghi dữ liệu nhạy cảm vào diff/log.
- Xử lý hết diff trước cutover.

## 8. R2 private

- Xuất inventory Storage nguồn: object key, owner, MIME, size, checksum.
- Copy object sang `PRIVATE_RECORDS` staging bằng lệnh sau. Script tải ngược từng object từ R2 và so sánh size/SHA-256 trước khi ghi báo cáo thành công:

```bash
D1_WRANGLER_CONFIG=wrangler.d1.staging.jsonc \
PRIVATE_RECORDS_BUCKET_NAME=thegioitrimun-private-staging \
npm run d1:migrate:private-r2
```

- `output/d1-migration/private-storage-copy-report.json` phải có `ok=true` và `expected=copied=verified`.
- Kiểm tra user chỉ tải được file thuộc quyền; bác sĩ/admin cần role phù hợp.
- Không dùng URL công khai hoặc public bucket cho bệnh án.

## 9. Kiểm thử chức năng

- Checkout tài khoản/khách, email bắt buộc, locale `vi/en/ru/cn`.
- Tạo đơn không chờ SMTP; mỗi trạng thái chỉ tạo một idempotency key.
- Lặp webhook GHTK không tạo lịch sử/email trùng.
- Queue retry, DLQ, SMTP 4xx/5xx, TLS/auth failure và mất kết nối sau `DATA`.
- Google OAuth, logout, expiry, CSRF và RBAC ghi/admin.
- CRUD sản phẩm, nội dung, người dùng, dashboard, review, discount, tax.
- Trang chi tiết sản phẩm trả sản phẩm và snapshot INCI trong một response.
- Frontend bundle/network không gọi hostname Supabase khi build D1.

Kiểm tra bản build D1 riêng biệt:

```bash
npm run build:d1
npm run qa:d1-bundle
```

Build D1 dùng module fail-closed thay cho `supabase-js`. Nếu một nhánh legacy bị gọi nhầm, ứng dụng phải báo lỗi rõ thay vì âm thầm kết nối Supabase.

## 10. Cutover

1. Tạo `wrangler.d1.production.jsonc` từ file example, điền ID thật và không để placeholder. Chạy gate bằng `CUTOVER_FRONTEND_BACKEND=d1 D1_CUTOVER_CONFIG=wrangler.d1.production.jsonc npm run d1:cutover-gate`. Không tiếp tục nếu lệnh fail.
2. Khóa ghi admin 15–30 phút.
3. Export delta cuối, drain outbox, import và chạy verify/checksum lần cuối.
4. Tạo backup Supabase và D1 trước thay đổi.
5. Build frontend với `VITE_DATA_BACKEND=d1`; giá trị này phải khớp Worker `DATA_BACKEND=d1` trong cùng release.
6. Chuyển Worker production sang D1 bindings và `DATA_BACKEND=d1`.
7. Smoke test OAuth, checkout, admin CRUD, email và INCI. Chỉ smoke test GHTK nếu `GHTK_ENABLED=true`.
8. Theo dõi Worker errors, Queue/DLQ, D1 latency và email outbox.

Gate sẽ từ chối cutover nếu thiếu report export/import, report copy R2 private, audit D1 dưới 450 MiB, callback Google production, kết nối SMTP, rollback drill hoặc cấu hình frontend/Worker không đồng nhất. Webhook GHTK chỉ bắt buộc khi GHTK được bật; kiểm tra email DNS chỉ bắt buộc nếu release đặt `REQUIRE_EMAIL_DNS_VERIFIED=true`.

## 11. Rollback

- Dừng ghi admin và checkout ngắn hạn.
- Drain hoặc đóng băng Queue để tránh xử lý hai nguồn.
- Chuyển frontend/Worker về `DATA_BACKEND=supabase` bằng bản deploy đã lưu.
- Reconcile các đơn/lịch hẹn phát sinh trong cửa sổ D1 trước khi mở lại ghi.
- Ghi lại thời điểm, row IDs và email/vận đơn đã chấp nhận để không gửi/tạo trùng.

## 12. Sau cutover

- Giữ Supabase read-only tối thiểu 14 ngày.
- Dùng D1 Time Travel cho khôi phục ngắn hạn.
- Export D1 vào R2 hằng ngày bằng `npm run d1:backup:remote`. Job phải đặt `D1_WRANGLER_CONFIG`, `D1_BACKUP_BUCKET` và secret Cloudflare trong CI/cron; mỗi lần chạy tạo hai bản SQL cùng manifest SHA-256. Vì Wrangler giới hạn upload một object ở 300 MiB, script tự chia file lớn thành các phần 250 MiB và ghi checksum/kích thước từng phần vào manifest. Khi restore phải tải đủ các phần theo đúng thứ tự, kiểm tra checksum từng phần, ghép lại rồi kiểm tra checksum toàn file trước khi import. Kiểm tra công cụ local bằng `npm run d1:backup:local`.
- Restore từ backup bằng `npm run d1:restore:remote -- --database <name> --database-id <id> --file <sql> --sha256 <sha> --confirm-remote-restore`. Với backup INCI lịch sử có dữ liệu crawler thô, thêm `--skip-table ingredient_source_records`; dữ liệu thô vẫn nằm trong backup R2, còn D1 runtime chỉ giữ dữ liệu chuẩn hóa dùng bởi analyzer.
- Cấu hình lifecycle rule trên bucket backup để giữ đúng retention, và chạy restore drill định kỳ từ một manifest đã chọn trước khi đánh dấu `rollback_drill_passed=true`.
- Chỉ gỡ `supabase-js`, service-role secret và Edge Function sau khi restore drill đạt.
- Cập nhật `d1/cutover-capabilities.json` bằng bằng chứng kiểm thử, không chỉ bằng xác nhận thủ công.
