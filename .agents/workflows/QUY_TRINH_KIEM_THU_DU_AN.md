# Quy Trinh Kiem Thu Du An iSkin Clinic

Tai lieu nay la quy trinh kiem thu truoc khi release/deploy, muc tieu giam toi da loi nghiem trong tren production.

## 1. Muc tieu va nguyen tac

- Khong deploy neu con loi `Critical` hoac `High`.
- Moi thay doi code deu phai qua du 3 lop:
  - Kiem tra ky thuat (`lint`, `build`, route, worker).
  - Kiem thu chuc nang theo luong nguoi dung.
  - Kiem thu SEO + hieu nang + bao mat co ban.
- Neu co loi, sua xong phai re-test dung khu vuc loi va chay lai smoke test.

## 2. Chuan bi truoc khi test

### 2.1 Nhan su va du lieu

- Co it nhat 1 tai khoan user thuong, 1 tai khoan admin.
- Co du du lieu mau:
  - Dich vu, san pham, danh muc san pham.
  - Bai viet blog, danh muc blog.
  - Don hang test, lich hen test.

### 2.2 Moi truong

- Local:
  - Node.js + npm dung theo project.
  - Bien moi truong `.env` da cau hinh Supabase.
- Staging/Production:
  - Cloudflare Pages + `_worker.js` dang hoat dong.
  - Domain `thegioitrimun.vn` da tro dung.

### 2.3 Lenh bat buoc truoc khi test tay

```bash
npm run lint
npm run build
```

Neu mot trong hai lenh fail: dung test chuc nang, sua truoc.

## 3. Tieu chuan phan loai loi

- `Critical`: Sap he thong, khong dang nhap duoc, khong dat lich/mua hang duoc, loi du lieu y te nghiem trong.
- `High`: Chuc nang chinh sai ket qua, route sai, mat du lieu, SEO canonical sai toan cum.
- `Medium`: UI vo cuc bo, thong diep sai, quy trinh van chay duoc.
- `Low`: Loi nho giao dien/chinh ta, khong anh huong nghiep vu.

Rule release:

- `Critical/High`: bat buoc fix truoc deploy.
- `Medium`: can ticket + ke hoach fix ro rang.
- `Low`: co the dua vao backlog.

## 4. Checklist kiem thu ky thuat (Gate 1)

### 4.1 Static + Build

- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.
- [ ] Khong co warning nghiem trong lien quan route/worker.

### 4.2 Worker/SEO endpoint

- [ ] `https://thegioitrimun.vn/sitemap.xml` tra `200`.
- [ ] `https://thegioitrimun.vn/rss.xml` tra `200`.
- [ ] `https://thegioitrimun.vn/robots.txt` tra `200`.
- [ ] URL xac minh Google (neu dung) tra `200`.

### 4.3 Redirect/Canonical

- [ ] `http://thegioitrimun.vn` -> `https://thegioitrimun.vn/`.
- [ ] `/nha-thuoc` -> `/san-pham` (301).
- [ ] URL cu san pham/blog dich vu redirect dung URL canonical moi.

## 5. Checklist kiem thu chuc nang nguoi dung (Gate 2)

### 5.1 Public pages

- [ ] Trang chu tai duoc, cac section hien dung.
- [ ] Trang dich vu (`/dich-vu`) va chi tiet dich vu mo duoc.
- [ ] Trang san pham (`/san-pham`) va danh muc mo duoc.
- [ ] Chi tiet san pham hien thong tin, anh, san pham lien quan, bai viet lien quan.
- [ ] Trang blog (`/kien-thuc`), danh muc blog, bai viet chi tiet mo duoc.

### 5.2 Tim kiem, gio hang, thanh toan

- [ ] Tim kiem full-screen tra ket qua dung.
- [ ] Them/xoa san pham trong gio hang.
- [ ] Cap nhat so luong san pham trong gio.
- [ ] Checkout chay duoc den ket qua thanh cong.
- [ ] Don hang xuat hien trong lich su don.

### 5.3 Dang nhap/phan quyen

- [ ] Dang nhap/dang xuat thanh cong.
- [ ] User thuong khong vao duoc route admin.
- [ ] Admin vao duoc dashboard va cac trang quan tri.

### 5.4 Ho so, lich hen, benh an

- [ ] Cap nhat ho so ca nhan thanh cong.
- [ ] Dat lich moi tao du lieu dung.
- [ ] Tai lieu y te upload/xoa duoc.
- [ ] Tom tat AI (neu bat) khong gay loi UI va co thong bao ro rang khi fail.

### 5.5 Da ngon ngu

- [ ] Doi ngon ngu khong vo layout.
- [ ] Title/meta thay doi theo ngon ngu.

## 6. Checklist kiem thu quan tri (Gate 3)

- [ ] Quan ly user: sua thong tin co hieu luc.
- [ ] Quan ly dich vu: tao/sua/xoa khong loi.
- [ ] Quan ly nha thuoc: tao/sua/xoa san pham, anh, danh muc, thuong hieu.
- [ ] Quan ly blog: tao/sua/xoa bai viet + SEO fields (`meta_description`, `canonical_url`).
- [ ] Quan ly noi dung site: logo/favicon/thong tin chung cap nhat dung.

## 7. Checklist SEO bat buoc truoc deploy

### 7.1 On-page

- [ ] Moi trang chinh co `title`, `meta description`, `canonical`.
- [ ] Trang private/admin co `noindex`.
- [ ] JSON-LD co tren route chinh:
  - Organization/MedicalClinic.
  - WebSite + SearchAction.
  - Product/Article/Breadcrumb khi vao trang chi tiet.

### 7.2 Indexing

- [ ] Search Console nhan `sitemap.xml` thanh cong.
- [ ] Search Console nhan `rss.xml` (neu dung) thanh cong.
- [ ] Gui request indexing cho:
  - `/`
  - `/san-pham`
  - `/kien-thuc`
  - `/dich-vu`

### 7.3 Domain

- [ ] `www` da cau hinh dung va resolve duoc.
- [ ] SSL hoat dong cho ca apex va `www`.

## 8. Checklist hieu nang va kha dung

- [ ] Test mobile (iPhone/Android viewport) cac trang chinh.
- [ ] Test desktop (>=1366px).
- [ ] Khong bi layout shift lon khi load.
- [ ] Anh dung kich thuoc hop ly, khong vo ti le.
- [ ] Khong co loi nghiem trong trong Console browser.

Khuyen nghi dinh ky:

- Chay PageSpeed Insights cho `/`, `/san-pham`, 1 trang chi tiet san pham, 1 bai viet.
- Theo doi LCP/CLS/INP trong Search Console.

## 9. Checklist bao mat co ban

- [ ] Khong commit token/secret vao git.
- [ ] Khong hardcode service-role key trong frontend.
- [ ] Kiem tra route private can dang nhap.
- [ ] Kiem tra upload file gioi han dinh dang/kich thuoc.
- [ ] Kiem tra du lieu nhay cam khong hien thi cho user khong co quyen.

## 10. Quy trinh test sau moi lan sua loi

1. Reproduce loi.
2. Fix loi.
3. Retest ca:
   - Chuc nang vua sua.
   - Luong lien quan truc tiep.
4. Chay lai:
   - `npm run lint`
   - `npm run build`
5. Cap nhat changelog/milestone neu can.

## 11. Quy trinh deploy an toan

1. Code freeze cho ban release.
2. Chay full checklist Gate 1 -> Gate 3.
3. Deploy Pages:

```bash
npm run deploy:pages
```

4. Smoke test production trong 15-30 phut:
   - Trang chu, san pham, blog, dich vu.
   - Dang nhap, gio hang, checkout.
   - Sitemap/robots/rss.
5. Theo doi log va Search Console 24h dau.

## 12. Mau bien ban test (copy dung moi release)

```md
## Release: <version/date>

### Build
- lint: PASS/FAIL
- build: PASS/FAIL

### Functional
- Public pages: PASS/FAIL
- Auth + profile: PASS/FAIL
- Booking: PASS/FAIL
- Cart/Checkout: PASS/FAIL
- Admin modules: PASS/FAIL

### SEO
- sitemap.xml: PASS/FAIL
- robots.txt: PASS/FAIL
- rss.xml: PASS/FAIL
- Request indexing: DONE/NOT DONE

### Performance
- Home mobile score:
- Product detail mobile score:
- Blog detail mobile score:

### Known issues
1. ...

### Go/No-go
- Decision: GO / NO-GO
- Approver: ...
```

## 13. Giai doan nen tu dong hoa tiep theo (de giam loi lap lai)

- Them test E2E (Playwright/Cypress) cho 5 luong:
  - Dang nhap.
  - Dat lich.
  - Gio hang -> thanh toan.
  - Tao san pham moi (admin).
  - Tao bai viet moi (admin).
- Them CI pipeline:
  - `lint` + `build` bat buoc truoc merge.
- Them canh bao khi sitemap/robots/rss khong tra `200`.

---

Neu ban muon, buoc tiep theo minh co the tao them:
- `CHECKLIST_RELEASE.md` (ban ngan gon 1 trang de tick nhanh),
- `TEST_CASES_E2E.md` (test case chi tiet theo tung module).
