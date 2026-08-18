# CHECKLIST RELEASE (1 PAGE)

Su dung file nay de tick nhanh truoc moi lan deploy.

## A. Pre-flight

- [ ] Da pull code moi nhat va rebase/merge xong.
- [ ] Khong con conflict.
- [ ] Khong commit secret/token.
- [ ] Co backup DB/du lieu quan trong (neu co migration).

## B. Gate Ky Thuat (Auto)

- [ ] `npm run lint` PASS
- [ ] `npm run build` PASS
- [ ] `npm run qa:smoke` PASS

## C. Gate Chuc Nang Chinh (Manual)

- [ ] Public pages: `/`, `/san-pham`, `/kien-thuc`, `/dich-vu`, `/ve-chung-toi`
- [ ] Auth: dang nhap / dang xuat
- [ ] User: cap nhat ho so
- [ ] Booking: tao lich hen thanh cong
- [ ] Cart/Checkout: them gio hang -> thanh toan -> co don hang
- [ ] Admin: CRUD dich vu, san pham, bai viet

## D. Gate SEO

- [ ] `https://thegioitrimun.vn/sitemap.xml` = 200
- [ ] `https://thegioitrimun.vn/rss.xml` = 200
- [ ] `https://thegioitrimun.vn/robots.txt` = 200
- [ ] `/nha-thuoc` -> `/san-pham` (301)
- [ ] `www` -> apex (301)

## E. Gate Production Sau Deploy (15-30 phut)

- [ ] Open nhanh 5 trang chinh khong loi UI
- [ ] Console browser khong co runtime error nghiem trong
- [ ] Dat 1 booking test
- [ ] Tao 1 order test
- [ ] Search Console khong phat sinh loi dot bien

## F. Go/No-Go

- [ ] Khong con loi `Critical`/`High`
- [ ] Quy trinh release duoc duyet
- [ ] Quyet dinh: `GO` / `NO-GO`

Owner:
Date:
Version:
