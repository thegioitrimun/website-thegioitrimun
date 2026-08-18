# Roadmap Nang Cap Website - 2026-03-31

## Muc tieu
- Giu public runtime on dinh ngay ca khi upstream cham hoac timeout.
- Tang ty le chuyen doi o product detail, service detail, brand landing va cac trang listing.
- Lam admin de van hanh hon, it loi thao tac hon.
- Tang kha nang giam sat va backup/restore de project ben vung hon.

## Trang thai hien tai
- Public runtime da duoc dua phan lon ve same-origin worker.
- Product detail, blog detail, brand landing, services listing, brand directory da duoc nang cap UX.
- Admin da co workspace shell, order flow gon hon, dashboard co runtime health card.
- Observability da co ingest log client va runtime qua worker, co tab quan ly co ban trong admin.

## Pha 1 - Public Runtime Hardening
### Muc tieu
Khong de public page phu thuoc truc tiep vao Supabase tu browser va khong de route bi drift.

### Cong viec
1. Chot toan bo public read path con sot qua worker same-origin.
2. Them cache TTL ngan + inflight dedupe cho cac GET cong khai quan trong.
3. Chuan hoa canonical, redirect, sitemap, taxonomy slug cho product/blog/service/brand.
4. Them fallback hien thi de khi upstream loi van con page huu dung.
5. Theo doi rieng cac loi CORS, timeout, not-found drift.

### Tieu chi xong
- Public route khong con blank page.
- Khong con console error do public read path chinh.
- Product/blog/service detail giu dung URL chuan sau hydrate.

## Pha 2 - Conversion UX
### Muc tieu
Lam cho user ra quyet dinh nhanh hon tren cac trang mang doanh thu.

### Cong viec
1. Tiep tuc polish product detail theo huong premium va gon hon tren desktop/tablet.
2. Nang service detail theo logic ra quyet dinh, aftercare, next-step CTA.
3. Nang brand landing va brand directory de tim duoc brand dung nhanh hon.
4. Them section routine, goi y ghep treatment, goi y bai viet, goi y san pham theo context.
5. Tinh chinh spacing, hierarchy va empty states cho listing pages.

### Tieu chi xong
- Trang chi tiet doc nhanh hon, it block dai vo huong.
- Tang add-to-cart, booking intent va click sang bai viet/san pham lien quan.

## Pha 3 - Search / Filter / Discovery
### Muc tieu
Khong de nguoi dung phai tu quet catalog bang tay.

### Cong viec
1. Nang ranking local search cho product/blog/service/brand.
2. Them filter theo concern, brand, category, gia, muc dich dieu tri.
3. Them internal linking cheo giua product, blog, service va brand.
4. Tao landing pages co chu dich SEO cho category, topic va concern.
5. Them cac quick pivot va browse path ro rang hon o listing pages.

### Tieu chi xong
- Tim duoc noi dung/san pham nhanh hon.
- Session depth va chat luong discovery cao hon.

## Pha 4 - Admin Operations
### Muc tieu
Lam admin la mot he thong van hanh, khong chi la bo form.

### Cong viec
1. Them autosave hoac canh bao roi trang trong cac editor sau.
2. Hardening workflow don hang, refund, shipping, bulk actions.
3. Day runtime health, observability va anomaly vao dashboard admin.
4. Chuan hoa empty/loading/error states trong admin.
5. Them runbook thao tac ngay tren admin cho mot so khu quan trong.

### Tieu chi xong
- Admin thao tac nhanh hon, it mat du lieu hon, it loi nguoi dung hon.

## Pha 5 - Observability + Automation
### Muc tieu
Phat hien su co som va co quy trinh xu ly ro rang.

### Cong viec
1. Them export JSON/CSV cho log observability.
2. Hien retention, cleanup controls va summary loi tren dashboard admin.
3. Tao audit dinh ky cho public runtime, OG image, sitemap/canonical, admin dashboard.
4. Cap nhat runbook backup, restore, deploy, cutover, rollback.
5. Neu can, nang cap tiep sang mot lop error monitoring manh hon.

### Tieu chi xong
- Loi runtime duoc nhin thay som.
- Backup/restore/deploy co tai lieu ro va co the lap lai.

## Thu tu thuc hien de xuat
1. Hoan tat Public Runtime Hardening.
2. Day manh Conversion UX cho product/service/brand.
3. Nhanh hoa Search/Filter/Discovery.
4. Hoan thien Admin Operations.
5. Mo rong Observability + Automation.

## Quy tac thuc thi moi batch
1. Tao branch sach.
2. Sua code theo mot muc tieu ro rang.
3. Build pass.
4. Smoke test route lien quan.
5. Tao PR sach va merge.
6. Deploy production tu main.
7. Xac minh lai live domain.
