# Observability Runbook

## Mục tiêu

Batch này bổ sung lớp quan sát lỗi tự-host:

- lỗi client từ frontend gửi về `POST /api/monitor/client-error`
- lỗi proxy public runtime nghiêm trọng trong worker
- các event được ghi vào R2 riêng tư, không public qua `/r2/...`

## Nơi lưu log

Các file JSON được ghi vào binding `R2_IMAGES` với prefix:

```text
monitoring-errors/YYYY/MM/DD/<channel>/<timestamp>-<uuid>.json
```

Ví dụ channel:

- `client-error`
- `public-runtime/upstream-5xx`
- `public-runtime/exception`

## Vì sao log này không public

Worker public image chỉ cho đọc các bucket prefix:

- `site-assets`
- `avatars`
- `blog-images`
- `product-images`
- `assets`

Prefix `monitoring-errors/` không nằm trong allowlist này, nên không thể truy cập qua URL `/r2/...`.

## Cách xem log

### Cách 1: Trong admin site

1. Đăng nhập admin
2. Mở `Nội dung site`
3. Chuyển sang tab `Observability`
4. Chọn cửa sổ ngày, số log, rồi `Làm mới log`
5. Nếu cần, chạy `Phân tích trước` để xem retention sẽ xóa gì

Tab này gọi:

- `GET /api/admin/observability/logs`
- `POST /api/admin/observability/cleanup`

và chỉ chấp nhận bearer token có role `admin` hoặc `master_admin`.

### Cách 2: Cloudflare Dashboard

1. Mở `R2 Object Storage`
2. Chọn bucket đang gắn vào binding `R2_IMAGES`
3. Tìm theo prefix `monitoring-errors/`
4. Mở file JSON cần xem

### Cách 3: S3 API nếu đã có access key riêng

```bash
aws s3 ls s3://<R2_BUCKET_NAME>/monitoring-errors/ --recursive --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
aws s3 cp s3://<R2_BUCKET_NAME>/monitoring-errors/<path-to-file>.json - --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

## Event nào đang được ghi

### 1. Client errors

Frontend gửi về:

- `window.onerror`
- `unhandledrejection`
- `api-error` do `handleApiError(...)`

Payload có:

- `type`
- `message`
- `context`
- `path`
- `href`
- `source`
- `user_agent`
- `cf_ray`
- `stack`
- `details`

### 2. Public runtime proxy failures

Worker ghi khi:

- upstream Supabase trả `5xx`
- proxy ném exception / timeout

Payload có:

- `resource`
- `search`
- `status`
- `body_preview`
- `message`
- `stack`

## Cách xử lý khi site lỗi

### Nếu product/blog/detail bị trắng hoặc thiếu dữ liệu

1. Kiểm tra `monitoring-errors/public-runtime/...`
2. Xem resource nào fail nhiều nhất
3. Đối chiếu với route public tương ứng
4. Nếu là `faq_items`, `products`, `public_blog_posts`, ưu tiên kiểm tra:
   - Supabase response time
   - schema/view còn tồn tại
   - CORS không còn liên quan vì browser đang đi qua same-origin worker

### Nếu người dùng báo modal lỗi hoặc thao tác AI lỗi

1. Kiểm tra `monitoring-errors/client-error/...`
2. Tìm theo thời gian gần nhất
3. So sánh `path`, `message`, `context`
4. Nếu cần tái hiện, dùng đúng route/path trong log

## Lưu ý vận hành

- Worker hiện có auto-retention kiểu lazy:
  - nếu có traffic và đã quá khoảng 12 giờ chưa cleanup
  - worker sẽ tự dọn prefix `monitoring-errors/` theo số ngày giữ hiện tại
- Số ngày mặc định:

```text
MONITORING_RETENTION_DAYS=14
```

- Nếu không cấu hình env này, worker mặc định giữ `14` ngày log.
- Cleanup thủ công trong admin luôn nên chạy `Phân tích trước` trước khi xóa thật.
- Nếu prefix `monitoring-errors/` tăng quá nhanh, cân nhắc chuyển sang hệ logging chuyên dụng như Sentry/Logtail/DataDog; lớp R2 này vẫn hữu ích như fallback tối thiểu trên production.
