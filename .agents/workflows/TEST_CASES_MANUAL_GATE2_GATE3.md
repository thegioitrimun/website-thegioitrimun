# TEST CASES MANUAL - GATE 2 + GATE 3

Tai lieu nay la test case test tay chi tiet cho nghiep vu.

## 1. Public Pages

### TC-PUB-01: Home page

- Preconditions: Website online.
- Steps:
  1. Mo `https://thegioitrimun.vn/`
  2. Scroll tu tren xuong duoi.
  3. Click cac link dieu huong chinh.
- Expected:
  - Trang tai thanh cong, khong vo layout.
  - Link dieu huong di dung trang.

### TC-PUB-02: Product listing + category

- Steps:
  1. Mo `/san-pham`
  2. Click 2-3 danh muc.
  3. Click vao 1 san pham bat ky.
- Expected:
  - Danh muc hien du lieu.
  - Chi tiet san pham mo duoc, co thong tin co ban.

### TC-PUB-03: Blog listing + detail

- Steps:
  1. Mo `/kien-thuc`
  2. Click 1 danh muc blog.
  3. Click 1 bai viet.
- Expected:
  - Bai viet hien title + noi dung + ngay.
  - Co link dieu huong quay lai.

### TC-PUB-04: Service listing + detail

- Steps:
  1. Mo `/dich-vu`
  2. Click 1 dich vu.
- Expected:
  - Mo dung trang chi tiet dich vu.
  - Noi dung va thong tin gia (neu co) hien dung.

## 2. Auth + User

### TC-AUTH-01: Login success

- Steps:
  1. Mo `/dang-nhap`
  2. Dang nhap bang user test.
- Expected:
  - Dang nhap thanh cong.
  - User thay duoc khu vuc tai khoan.

### TC-AUTH-02: Logout

- Steps:
  1. Dang nhap.
  2. Bam dang xuat.
- Expected:
  - Session bi huy.
  - Vao trang private bi yeu cau dang nhap lai.

### TC-USER-01: Update profile

- Steps:
  1. Vao `/tai-khoan` / ho so.
  2. Sua 1 truong thong tin.
  3. Luu.
- Expected:
  - Thong bao thanh cong.
  - Reload van thay du lieu moi.

## 3. Booking Flow

### TC-BOOK-01: Create booking

- Preconditions: User da dang nhap.
- Steps:
  1. Mo `/dat-lich` hoac tu chi tiet dich vu.
  2. Chon dich vu + thoi gian.
  3. Gui yeu cau dat lich.
- Expected:
  - Tao booking thanh cong.
  - Booking hien trong lich hen cua user.

## 4. Cart + Checkout

### TC-CART-01: Add to cart

- Steps:
  1. Mo 1 trang chi tiet san pham.
  2. Them san pham vao gio.
  3. Vao `/gio-hang`.
- Expected:
  - San pham xuat hien trong gio hang.

### TC-CART-02: Update quantity

- Steps:
  1. Tang/giam so luong.
  2. Xoa 1 item.
- Expected:
  - Tong tien cap nhat dung.
  - Item bi xoa khoi gio.

### TC-CHECKOUT-01: Checkout success

- Preconditions: Co san pham trong gio.
- Steps:
  1. Mo `/thanh-toan`.
  2. Dien thong tin.
  3. Xac nhan thanh toan.
- Expected:
  - Tao don hang thanh cong.
  - Don xuat hien o `/don-hang`.

## 5. Admin Gate (Gate 3)

### TC-ADM-01: Admin access control

- Steps:
  1. Dang nhap user thuong -> vao `/admin`
  2. Dang nhap admin -> vao `/admin`
- Expected:
  - User thuong bi chan.
  - Admin vao duoc dashboard.

### TC-ADM-02: Product CRUD

- Steps:
  1. Vao `Admin Pharmacy`.
  2. Tao 1 san pham test.
  3. Sua ten/gia.
  4. Xoa san pham test.
- Expected:
  - Cac thao tac thanh cong, UI cap nhat dung.

### TC-ADM-03: Blog CRUD

- Steps:
  1. Vao `Admin Blog`.
  2. Tao bai viet test (co slug).
  3. Sua meta description.
  4. Xoa bai test.
- Expected:
  - Bai xuat hien dung route, sua/xoa dung.

### TC-ADM-04: Service CRUD

- Steps:
  1. Vao `Admin Service`.
  2. Tao dich vu test.
  3. Sua thong tin.
  4. Xoa dich vu.
- Expected:
  - Thao tac thanh cong.

## 6. SEO Sanity Manual

### TC-SEO-01: Basic SEO endpoints

- Steps:
  1. Mo `sitemap.xml`, `rss.xml`, `robots.txt`.
- Expected:
  - Tat ca tra 200 va co noi dung hop le.

### TC-SEO-02: Redirect + canonical

- Steps:
  1. Mo `/nha-thuoc`
  2. Mo `https://www.thegioitrimun.vn`
- Expected:
  - `/nha-thuoc` doi sang `/san-pham`
  - `www` doi sang apex.

---

Neu mot test fail:

1. Ghi lai URL + thao tac + screenshot.
2. Danh gia muc do (Critical/High/Medium/Low).
3. Fix -> retest test case do + smoke test nhanh.
