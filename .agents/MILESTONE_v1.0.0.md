# 🎉 Milestone v1.0.0 — thegioitrimun.vn Live

**Ngày:** 2026-03-02  
**Tag GitHub:** `v1.0.0`  
**URL production:** https://thegioitrimun.vn

---

## ✅ Những gì đã hoàn thành ở cột mốc này

- **Full-stack iSkin Clinic** với Supabase (auth, database, storage, edge functions)
- **Mobile header** — topbar 1 bar, hamburger menu + sidebar, đã bỏ bottom nav bar
- **Admin dashboard** — User, Service, Pharmacy, Blog, Site Management
- **Quản lý đơn hàng** tích hợp GHTK (Giao Hàng Tiết Kiệm), in nhãn, theo dõi vận đơn
- **Đa ngôn ngữ** — Tiếng Việt, English, Русский, 中文
- **Deploy** lên Cloudflare Pages (Direct Upload qua Wrangler)
- **Custom domain** thegioitrimun.vn đang hoạt động ổn định

---

## ⏪ Cách quay lại cột mốc này (rollback)

### 1. Checkout tag v1.0.0 về local
```bash
git fetch --tags
git checkout v1.0.0
```

### 2. Build và deploy lên thegioitrimun.vn
```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=website-thegioitrimun
```

### 3. Quay về nhánh main sau khi xong
```bash
git checkout main
```

---

## 🔁 Deploy bình thường (không rollback)

Xem file `.agents/workflows/deploy-to-cloudflare.md` hoặc chạy:

```bash
git add -A && git commit -m "mô tả" && git push && npm run build && npx wrangler pages deploy dist --project-name=website-thegioitrimun
```

---

## 📌 Thông tin kỹ thuật

| | |
|---|---|
| Git tag | `v1.0.0` |
| Git commit | `cec8f20` |
| Cloudflare project | `website-thegioitrimun` |
| Supabase project | `vwzgibsdtednpitbrdeb` |
| Node | `>=18` |
| Framework | Vite + React + TypeScript |
