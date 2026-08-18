---
description: Deploy code lên website thegioitrimun.vn qua Cloudflare Pages
---

# 🚀 Hướng dẫn Deploy lên thegioitrimun.vn

## Kiến trúc hiện tại

| Thành phần | Tên | URL |
|---|---|---|
| Cloudflare Pages (production) | `website-thegioitrimun` | thegioitrimun.vn |
| GitHub Repo | `Hovidaiphuc/website-thegioitrimun` | github.com |
| Backend | Supabase | vwzgibsdtednpitbrdeb.supabase.co |

> **Lưu ý quan trọng:** Dự án `website-thegioitrimun` trên Cloudflare Pages dùng **Direct Upload** (không có Git connection tự động). Mỗi lần deploy phải build và upload thủ công bằng Wrangler.

---

## Quy trình Deploy (mỗi lần có thay đổi)

### Bước 1: Commit và push lên GitHub
```bash
cd "/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project (1)"

git add -A
git commit -m "mô tả thay đổi"
git push
```

### Bước 2: Build và deploy lên Cloudflare Pages
```bash
npm run build && npx wrangler pages deploy dist --project-name=website-thegioitrimun
```

> Lệnh này sẽ:
> 1. Build production bundle vào thư mục `dist/`
> 2. Upload các file mới lên Cloudflare Pages
> 3. In ra URL preview như: `https://xxxxxxxx.website-thegioitrimun.pages.dev`
> 4. Sau vài giây, `thegioitrimun.vn` sẽ được cập nhật tự động

### Bước tất cả trong 1 lần (copy & paste)
```bash
cd "/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project (1)" && git add -A && git commit -m "deploy: cập nhật" && git push && npm run build && npx wrangler pages deploy dist --project-name=website-thegioitrimun
```

---

## Xác nhận deploy thành công

Sau khi chạy lệnh, terminal sẽ hiện:
```
✨ Deployment complete! Take a peek over at https://xxxxxxxx.website-thegioitrimun.pages.dev
```

Kiểm tra trực tiếp tại: **https://thegioitrimun.vn**

---

## Troubleshooting

### Lỗi: Wrangler chưa đăng nhập
```bash
npx wrangler login
```
Trình duyệt sẽ mở ra, đăng nhập bằng tài khoản **hovidaiphuc@gmail.com**.

### Lỗi: Build thất bại (TypeScript errors)
Kiểm tra lỗi trong terminal, sửa code rồi chạy lại.

### Lỗi: `project-name` không tìm thấy
Chắc chắn dùng đúng tên: `website-thegioitrimun` (không phải `website-thegioitrimun02`).

---

## Tại sao không tự động từ GitHub?

Dự án `website-thegioitrimun` hiện dùng **Direct Upload** — Cloudflare Pages không hỗ trợ chuyển từ Direct Upload sang Git tự động trên cùng một project.

Nếu muốn tự động hoá trong tương lai: tạo project Pages mới với Git connection, rồi chuyển domain `thegioitrimun.vn` sang project mới đó.
