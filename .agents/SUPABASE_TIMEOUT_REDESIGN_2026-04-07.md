# Supabase Timeout Redesign 2026-04-07

## Van de goc

Qua ra soat luong request hien tai, co 4 van de chinh:

1. `App.tsx` bootstrap bang rat nhieu request public rieng le.
   Luong dau trang hien tai goi mot loat `getServices`, `getDoctors`, `getBlogCategories`, `getFaqItems`, `getFeaturedDoctorIds`, `getFeaturedPostSlugs`, `getAboutPageData`, `getHomepageHero`, `getFeaturedServiceIds`, `getSiteInfo`, `getFooterContent`, `getAuthPageImages`, `getProductCategories`, `getPaymentSettings`, `getBrands`, roi moi goi tiep blog/product catalog.

2. Browser timeout nhanh hon worker timeout.
   Frontend public runtime timeout 5s, trong khi worker proxy Supabase cho public runtime timeout 8s. Browser huy truoc, roi code lai fallback sang Supabase tu frontend, dan toi duplicate load.

3. Public data van co duong fallback goi Supabase truc tiep tu browser.
   Cach nay khien luc edge/proxy cham, frontend lai tu nhan them ap luc truy van.

4. Khoi tao public data chua co bootstrap cache ben browser.
   Refresh trang, mo tab moi, va truy cap tu mobile deu de lap lai cung mot cum request.

## Kien truc moi

Muc tieu moi:

- Public first paint chi can 1 request bootstrap.
- Public data di qua edge runtime truoc, khong uu tien goi Supabase truc tiep tu browser.
- Edge timeout ngan hon browser timeout de worker fail fast.
- Edge cache + browser cache giu trang van mo nhanh khi Supabase cham.

Luong moi:

1. Browser goi `GET /api/public/bootstrap?mode=home|full`
2. Worker goi Supabase song song cho cac resource public can thiet
3. Worker hop nhat payload va cache o edge
4. Browser cache bootstrap payload vao `localStorage`
5. Neu network co van de, browser dung bootstrap cache cu
6. Neu khong co cache, frontend dung fallback snapshot de tranh trang trang

Phan tach truy cap:

- Public bootstrap, listing, home data: qua worker
- Public detail page: uu tien worker runtime + memory cache
- Auth, admin, mutation: van di truc tiep Supabase vi la personalized / write path

## Da thay doi trong repo

### 1. Edge bootstrap endpoint

Them `GET /api/public/bootstrap` trong `_worker.js`.

Payload bootstrap gom:

- services
- doctors
- blogCategories
- faqItems
- featuredDoctorIds
- featuredPostSlugs
- aboutData
- homepageHero
- featuredServiceIds
- siteInfo
- footerContent
- authPageImages
- productCategories
- paymentSettings
- brands
- blogPosts
- products

Endpoint nay co 2 mode:

- `mode=home`: payload nhe cho first paint
- `mode=full`: payload day du catalog lite

### 2. Edge cache cho public runtime

Worker hien cache:

- `/api/public/bootstrap`
- `/api/public/rest/*`

Muc tieu la giam so lan hit Supabase khi user refresh, di chuyen route, hoac crawler truy cap lap lai.

### 3. Timeout duoc can chinh lai

- Worker public runtime upstream timeout: 4.5s
- Worker bootstrap query timeout: 4.5s
- Browser public runtime timeout: 6.5s
- Browser bootstrap timeout: 6.5s

Nguyen tac:

- Edge phai tra loi som hon browser abort
- Browser khong duoc bo request roi lai lap tuc tao them request Supabase khac

### 4. Browser bootstrap cache

Them local cache cho payload bootstrap theo `mode`.

Cache policy:

- fresh window ngan de update nhanh
- stale window dai hon de co the phuc hoi khi Supabase cham / loi tam thoi

### 5. Da loai bo public browser fallback truc tiep vao Supabase

Sau vong cap nhat thu hai, cac public read path trong `services/api.ts` da duoc doi thanh:

- chi doc qua worker public runtime / public bootstrap
- neu edge co cache cu thi tra cache
- neu edge loi thi roi ve fallback snapshot trong frontend

Phan con lai van dung Supabase truc tiep la:

- auth
- admin reads
- data mutation
- storage/public URL helper

## Nguyen tac thiet ke tiep theo

1. Public page khong duoc khoi tao bang 10+ request rieng le.
2. Public data khong duoc fallback truc tiep sang Supabase tu browser trong first paint.
3. Worker phai la lop aggregation + cache cho read path cong khai.
4. Query nhe hon:
   chi select dung cot can dung cho listing.
5. Detail page moi load them payload detail khi can.
6. Admin/Auth la fast path rieng, khong trung voi public bootstrap.

## Viec nen lam tiep

1. Chuyen cac public detail query dau tien sang cache-first runtime thay vi fallback Supabase truc tiep.
2. Tach `services/api.ts` thanh:
   - public-read client
   - auth client
   - admin client
3. Tao RPC/view toi uu cho cac query nang:
   - product listing
   - blog listing
   - admin dashboard metrics
4. Raa soat index DB cho:
   - `products(is_published, id, name)`
   - `public_blog_posts(date, slug)`
   - `product_images(product_id, display_order)`
   - `featured_*`
5. Ghi observability theo endpoint:
   - cache hit/miss
   - upstream timeout
   - payload size
   - p95 response time

## Ket luan

Huong dung la:

- giam request count truoc
- fail fast o edge
- cache o edge va browser
- khong nhan doi request khi timeout

Neu can lam them mot vong nua, buoc tiep theo dung nhat la doi cac public detail/read con lai sang cung mot chuan `edge-first, cache-first, no direct browser Supabase fallback`.
