# Admin Dashboard Test Program

## Mục tiêu

- Khóa lỗi UI cho dashboard sau mỗi lần thay đổi.
- Kiểm tra dữ liệu điều hành không bị drift so với Supabase live.
- Bảo vệ các luồng bị ảnh hưởng trực tiếp bởi dashboard:
  - order management
  - customer analytics
  - appointments drill-down
  - scheduled email reports

## Lớp kiểm thử

### 1. Static gates

- `npm run lint`
- `npm run build`

Mục tiêu:
- chặn lỗi TypeScript/React
- chặn import sai, props sai, workflow drift trong source

### 2. Live smoke

- `npm run qa:smoke`

Mục tiêu:
- xác minh domain live còn hoạt động
- xác minh các route SEO/core không gãy sau deploy

### 3. Dashboard data audit

- `npm run qa:admin-dashboard`

Mục tiêu:
- kiểm tra KPI foundation và anomaly feed
- phát hiện:
  - pending orders quá hạn
  - paid orders thiếu payment logs
  - appointments thiếu doctor/service
  - low stock / out-of-stock published products
  - duplicate emails / phones

### 4. Browser E2E

- `npm run qa:admin-dashboard:e2e`

Coverage:
- login admin dashboard
- compact overview render
- panel navigation
- order filters + bulk selection shell
- appointments drill-down visibility
- report schedule create/delete

### 5. Full regression command

- `npm run qa:admin-regression`

Thứ tự:
1. lint
2. build
3. live smoke
4. dashboard data audit
5. dashboard E2E

## GitHub Actions

### Push protection

- `.github/workflows/admin-dashboard-e2e.yml`

Chạy trên `push main` và `workflow_dispatch`:
- lint
- build
- live smoke
- dashboard audit
- dashboard E2E

### Scheduled audit

- `.github/workflows/admin-dashboard-audit.yml`

Chạy mỗi ngày:
- dashboard data audit
- upload artifact báo cáo

## Secrets cần thiết

- `SUPABASE_ACCESS_TOKEN`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

## Nguyên tắc vận hành

- Mọi thay đổi dashboard phải pass đủ:
  - static gates
  - live smoke
  - dashboard audit
  - E2E
- Không merge/push production nếu dashboard audit xuất hiện anomaly mới do code tạo ra.
