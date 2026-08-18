# SEO Translation And Review Hardening - 2026-03-16

## Muc tieu

- Lam sach alternate locale cho SEO, tranh trang EN/RU/CN bi tron noi dung tieng Viet.
- Chi dua review co don mua da xac minh vao Product schema.
- Seed translation cho batch URL uu tien dang gan homepage / sitemap.

## Da thay doi trong code

### Review integrity

- Them migration [20260316114000_review_verified_purchase_gate.sql](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project (1)/supabase/migrations/20260316114000_review_verified_purchase_gate.sql)
- Them cot `product_reviews.verified_purchase`
- Them function `public.can_review_product(product_id, user_id)`
- RLS insert review chi cho phep user da co don `completed + paid`
- `public_product_reviews` expose them cot `verified_purchase`
- Frontend chi hien form review khi user du dieu kien
- Product JSON-LD va worker chi dung review da `verified_purchase = true`

### Locale rendering

- Worker loc danh sach san pham/bai viet/dich vu theo translation bat buoc cho locale phu
- Product detail EN/RU/CN chi render section nao da co translation that, khong fallback ve tieng Viet
- Blog detail EN/RU/CN chi render heading/summary va related links da dich; body tieng Viet khong con duoc dua vao prerender locale phu

## Batch translation da seed

### Products

- `kcn-la-roche-posay-anthelios-uvmune-400`
- `100-pure-manuka-oil`
- `gel-tri-mun-klenzit-ms-0-1`
- `gel-tri-mun-differin-0-1`
- `sua-rua-mat-la-roche-posay-effaclar`
- `nuoc-tay-trang-bioderma-sensibio-h2o`
- `bo-3-tri-mun-dep-da-toan-dien-vien-uong-hsn-ac-gel-bha-2-serum-seasonly-blemish-control`
- `harker-herbals-gutbiome-balance-men-can-bang-he-vi-sinh-duong-ruot-130g`

Field da seed:

- `name_en|ru|cn`
- `description_en|ru|cn`
- `key_benefits_en|ru|cn`
- `origin_en|ru|cn`
- `texture_en|ru|cn`

### Blog posts

- `voi-hoa-cot-song-la-gi`
- `10-cach-giup-ban-de-chiu-hon-ngay-tai-nha`
- `phau-thuat-veo-cot-song-khi-nao-can-va-can-biet-gi`
- `bap-chan-bieu-tinh-hieu-ve-cang-co-de-xu-ly-va-phong-tranh`
- `lam-thang-lung-ngay-tai-nha-9-bai-tap-don-gian-hieu-qua`

Field da seed:

- `title_en|ru|cn`
- `summary_en|ru|cn`

## Script phuc hoi / tai seed

- [seed_seo_priority_translations.mjs](/Users/PHUC/Downloads/32-kiến-trúc-mới-fullstack-iskin-clinic-+-supabase-ở-account-hovidaiphuc@gmail.com---website-project (1)/scripts/seed_seo_priority_translations.mjs)

Chay lai bang:

```bash
SUPABASE_ACCESS_TOKEN=... npm run seo:seed-translations
```

## Xac minh live truoc deploy

- `verified_reviews = 0`
- `total_reviews = 0`
- `can_review_product(1, null)` tra ve `false`
- Seed translation thanh cong:
  - `products_en_ready = 8`
  - `products_ru_ready = 8`
  - `products_cn_ready = 8`
  - `blogs_en_ready = 5`
  - `blogs_ru_ready = 5`
  - `blogs_cn_ready = 5`

## Viec con lai

- Neu muon blog detail locale phu index manh hon, can bo sung `content_en|ru|cn` cho `blog_posts` va dich than bai.
- Review schema se chi xuat hien tren live khi co don `completed + paid` va khach da gui review that.
