# Kế hoạch đồng bộ toàn bộ giao diện và UX Admin Thế Giới Trị Mụn

**Tài liệu đích:** `/Users/PHUC/Desktop/TGTM/docs/ADMIN_UI_UX_UNIFICATION_PLAN.md`  
**Ngày khảo sát:** 09/09/2026  
**Giao diện chuẩn:** [Admin Đơn hàng](https://thegioitrimun.vn/admin/don-hang)  
**Phạm vi:** Toàn bộ trang, tab, biểu mẫu, chi tiết, menu và trạng thái bên trong `/admin/`.

**Trạng thái tài liệu:** Nội dung kế hoạch đã được chuẩn bị bên dưới. File Markdown chưa được ghi vì phiên hiện tại đang ở chế độ lập kế hoạch.

---

## 1. Mục tiêu và các quyết định đã chốt

### 1.1. Mục tiêu

Thiết kế lại admin để người dùng cảm nhận đây là một hệ thống thống nhất khi chuyển giữa Đơn hàng, Sản phẩm, VAT, Kiến thức, Dịch vụ và các module khác.

Việc đồng bộ phải đạt đủ ba mặt:

1. **Hình thức:** Cùng màu, font, khoảng cách, bề mặt, nút, ô nhập, bảng và trạng thái.
2. **Cách sử dụng:** Cùng quy tắc tìm kiếm, lọc, chọn nhiều, mở chi tiết, chỉnh sửa, lưu và quay lại.
3. **Hiệu năng:** Chuyển trang ổn định; gõ tìm kiếm, cuộn danh sách và mở menu không bị giật do cách render.

### 1.2. Quyết định thiết kế

| Nội dung | Quyết định |
|---|---|
| Giao diện tham chiếu | Dùng trực tiếp trang Đơn hàng hiện tại |
| Concept hình ảnh mới | Không tạo; đã chọn giữ sát mẫu |
| Phong cách | Nền pastel nhẹ, bề mặt trắng mờ, bo góc mềm, màu xanh cho thao tác chính |
| Phạm vi thay đổi | Cả giao diện và UX |
| Theme admin | Bộ màu và font riêng, độc lập với theme website |
| Font | Noto Sans và fallback hiện có |
| Chế độ màu | Sáng và tối; mặc định sáng ở lần sử dụng đầu tiên |
| Điều hướng | Tách Đơn hàng thành mục chính riêng |
| Ưu tiên thiết bị | Desktop cho vận hành thường xuyên; đầy đủ chức năng trên mobile |
| Ưu tiên chuyển động | Phản hồi nhanh, không làm nội dung dịch chuyển ngoài ý muốn |
| Backend | Giữ Cloudflare D1 và các API hiện hành |
| Nghiệp vụ | Giữ quy tắc đơn hàng, giá, tồn kho, thanh toán, hoàn tiền, VAT và phân quyền |
| Framework | Giữ React, TypeScript, Vite và Tailwind hiện tại |
| Cách triển khai | Làm nền tảng chung trước, chuyển từng module sau |

### 1.3. Những việc không thuộc đợt này

- Viết lại toàn bộ backend.
- Chuyển framework hoặc thay hệ thống lưu trữ.
- Thiết kế lại website công khai.
- Thay công thức tính giá, VAT, giảm giá hoặc phí vận chuyển.
- Thay quyền hạn của các vai trò.
- Tạo một hệ thống POS độc lập khác.
- Thay thuật toán đồng bộ Pancake hoặc ghép ảnh vào sản phẩm.
- Tự triển khai lên production trong bước lập tài liệu.

Những lỗi giao diện làm người dùng hiểu sai dữ liệu hoặc thao tác sai vẫn thuộc phạm vi xử lý.

---

## 2. Kết quả khảo sát và các vấn đề cần giải quyết

### 2.1. Nguồn đã đối chiếu

Đã xem trực tiếp:

- Trang Đơn hàng trên desktop và mobile.
- Menu thao tác của đơn hàng trên mobile.
- Trang chi tiết đơn hàng.
- Dashboard.
- Danh sách sản phẩm.
- Cấu trúc danh sách Kiến thức.
- Tổng quan VAT.
- Biểu mẫu Thương hiệu trong Nội dung site.

Đã đối chiếu mã nguồn cho các module, tab, editor, routing và bộ kiểm thử còn lại.

Một số đường dẫn đã mở chỉ được kiểm tra tới khung điều hướng và đối chiếu tiếp bằng mã nguồn. Chưa coi đó là kiểm thử đầy đủ mọi trạng thái trên production.

### 2.2. Những gì nên giữ từ trang Đơn hàng

- Thanh tìm kiếm nằm ở đầu vùng làm việc.
- Nút bộ lọc tích hợp gọn trong thanh tìm kiếm.
- Nhóm bộ lọc có thể thu gọn trên màn hình nhỏ.
- Danh sách desktop có cột và phân cấp thông tin rõ.
- Thanh chọn nhiều tách biệt với từng dòng.
- Mã đơn là điểm mở chi tiết.
- Trạng thái có màu và nhãn.
- Menu thao tác gọn trên mobile.
- Bề mặt trắng mờ và nền pastel tạo nhận diện riêng.
- Ảnh sản phẩm có khung kích thước ổn định.
- Phân trang giúp giới hạn số dòng render.

### 2.3. Vấn đề đã phát hiện

| Mã | Hiện trạng | Hướng xử lý |
|---|---|---|
| HT-01 | Đơn hàng dùng cùng page nghiệp vụ với Sản phẩm nhưng được ánh xạ sang Dashboard trong shell | Tách định danh điều hướng khỏi component nghiệp vụ |
| HT-02 | Mobile đang hiển thị “Dashboard” khi ở Đơn hàng | Tiêu đề lấy từ route thực tế |
| HT-03 | Sidebar mở rộng bằng hover và chuyển động chiều rộng | Dùng rail cố định; mở menu đầy đủ bằng thao tác chủ động |
| HT-04 | Nhiều trang thiếu tiêu đề trang rõ ràng sau các lần tinh gọn header | Thêm tiêu đề ngắn, thống nhất, không tạo banner lớn |
| HT-05 | Danh sách Sản phẩm và một số biểu mẫu có bề mặt khác Đơn hàng | Đưa về cùng mẫu toolbar và vùng dữ liệu |
| HT-06 | Nhiều chuỗi class bề mặt, nút và field được sao chép | Tập trung vào token và component dùng chung |
| HT-07 | `AdminPharmacyManagementPage` hiện gần 7.000 dòng | Tách theo miền và màn hình để giảm phạm vi render, dễ bảo trì |
| HT-08 | `GlassInputs` đang nhận nhiều kiểu callback bằng `any` và `try/catch` | Chuẩn hóa hợp đồng sự kiện có kiểu rõ ràng |
| HT-09 | Một số class như `h-8.5`, `shadow-xs`, `w-4.5` cần kiểm tra CSS thực sự được sinh | Dùng token hoặc utility được khai báo rõ |
| HT-10 | `AnimatedSection` dùng hiệu ứng 700 ms và IntersectionObserver | Loại hiệu ứng hiện dần khỏi vùng vận hành chính |
| HT-11 | Có luồng preload toàn bộ admin và Pancake đang được import trực tiếp | Chuyển sang tải module theo nhu cầu |
| HT-12 | Skeleton theo loại trang chưa thống nhất; còn spinner toàn vùng | Giữ khung bố cục trong lúc tải |
| HT-13 | Trạng thái khả dụng ở chi tiết đơn khác danh sách | Dùng cùng bộ quy tắc hiển thị chuyển trạng thái |
| HT-14 | Một số biểu đồ hiển thị thanh màu lớn dù giá trị bằng 0 | Quy định riêng trạng thái dữ liệu 0 |
| HT-15 | Nhãn tiếng Việt và thuật ngữ kỹ thuật đang trộn lẫn | Chuẩn hóa ngôn ngữ vận hành |
| HT-16 | Bộ kiểm thử còn tìm các tiêu đề giao diện cũ | Cập nhật theo hành vi và cấu trúc truy cập hiện hành |
| HT-17 | Playwright mặc định trỏ production; có bài test tạo/xóa lịch báo cáo | Tách kiểm thử chỉ đọc và kiểm thử có thay đổi dữ liệu |
| HT-18 | Workspace có nhiều thay đổi chưa commit | Lấy trạng thái đang làm việc làm mốc; không khôi phục bản cũ đè lên |

### 2.4. Nguyên tắc đọc kết quả khảo sát

- Các thông số CSS và cấu trúc nêu trên là thông tin đã quan sát.
- Chưa đo profiler để kết luận nguyên nhân định lượng của hiện tượng giật.
- Các giới hạn thời gian và hiệu năng ở phần sau là **mục tiêu nghiệm thu**, chưa phải kết quả đã đạt.
- Số lượng đơn, sản phẩm và người dùng là dữ liệu động; không đưa vào thiết kế như hằng số.

---

## 3. Kiến trúc điều hướng và khung admin

### 3.1. Menu chính

Giữ mười mục chính theo thứ tự sau:

| Thứ tự | Mục chính | Mục con | Đường dẫn |
|---:|---|---|---|
| 1 | Tổng quan | Tổng quan, Khách hàng, Lịch hẹn, Báo cáo | `/admin` và `?panel=` hiện có |
| 2 | Đơn hàng | Danh sách, Tạo đơn Online, Tạo đơn POS | `/admin/don-hang` |
| 3 | Sản phẩm | Sản phẩm, Chuyên mục, Thương hiệu, Mã giảm giá, Thuế bán hàng, Giao hàng, Gắn ảnh hàng loạt | `/admin/nha-thuoc` và các route hiện có |
| 4 | Pancake POS | Kết nối, Luồng đồng bộ, Hàng đợi & Webhook, Đồng bộ thủ công, Deplao Zalo | `/admin/pancake-pos` |
| 5 | Kế toán VAT | Tổng quan, Bán ra, Mua vào, Kỳ kê khai, Điều chỉnh, Quy tắc VAT, Pháp nhân, Đối soát D1 | `/admin/ke-toan-vat` |
| 6 | Kiến thức | Bài viết, Hàng đợi SEO, Thiếu ảnh bìa, Chuyên mục | `/admin/blog` |
| 7 | Dịch vụ | Danh sách, Thêm, Chỉnh sửa | `/admin/dich-vu` |
| 8 | Hình ảnh | Thư viện, Tải lên, Chi tiết ảnh | `/admin/hinh-anh` |
| 9 | Người dùng | Bác sĩ, Tài khoản & phân quyền, Chi tiết hồ sơ | `/admin/nguoi-dung` |
| 10 | Nội dung site | Thương hiệu, Chân trang, Trang đăng nhập, Thanh toán, Trang chủ, Giới thiệu, FAQ, Theo dõi hệ thống | `/admin/noi-dung` |

**Quy tắc cụ thể:**

- Đơn hàng không còn làm sáng mục Tổng quan hoặc Sản phẩm.
- Gắn ảnh hàng loạt làm sáng mục Sản phẩm.
- Không thêm mục con “Danh sách” cho module chỉ có một màn hình chính.
- “Thuế bán hàng” là nhãn điều hướng của phần cấu hình thuế trong Sản phẩm.
- “Kế toán VAT” là module sổ sách riêng; không nhập hai phần này thành một.
- Các định danh `section` phía mã nguồn được giữ để tránh thay đổi hợp đồng không cần thiết.

### 3.2. Điều hướng desktop

- Rail mặc định rộng **76 px**, giữ gần mẫu hiện tại.
- Rail nằm trong cột cố định; thay đổi dữ liệu không làm thay đổi chiều rộng.
- Icon module có vùng tương tác ít nhất **44 × 44 px**.
- Có tooltip khi hover hoặc focus.
- Bấm icon chuyển đến màn hình mặc định của module.
- Nút mở menu ở đầu rail mở panel rộng **268 px** phủ lên giao diện.
- Panel mở bằng `transform` và `opacity`, không animate chiều rộng.
- Rê chuột qua rail không tự mở rộng.
- Panel có tên module và toàn bộ mục con.
- Click ngoài hoặc Escape đóng panel.
- Nội dung trang bên dưới giữ nguyên tọa độ trong suốt quá trình mở và đóng.
- Rail có vùng cuộn riêng khi chiều cao màn hình không đủ.
- Mục đang hoạt động luôn có thể nhìn thấy hoặc cuộn tới bằng bàn phím.

### 3.3. Điều hướng mobile và tablet

Áp dụng dưới **1024 px**:

- Header cao **56 px**, gồm logo nhỏ, tên trang và nút mở menu.
- Tên trang phản ánh đúng màn hình: “Đơn hàng”, “Chi tiết đơn hàng”, “Sản phẩm”…
- Drawer rộng tối đa **320 px**, không vượt quá **88vw**.
- Drawer có cả module và mục con.
- Khóa cuộn nền khi drawer mở.
- Đóng drawer trả focus về nút đã mở.
- Tab con dưới header cuộn ngang nếu cần.
- Mục tab đang chọn tự nằm trong vùng nhìn thấy.
- Không hiển thị đồng thời nhiều hàng menu lớn chiếm gần hết màn hình.
- Vùng cuối trang chừa khoảng trống cho thanh hành động cố định và safe area.

### 3.4. Header và thứ tự vùng nội dung

Mỗi trang danh sách có cùng thứ tự:

1. Tiêu đề trang ngắn.
2. Tab con nếu module có nhiều khu vực.
3. Toolbar tìm kiếm và thao tác.
4. Bộ lọc.
5. Tóm tắt kết quả hoặc thanh chọn nhiều.
6. Danh sách/bảng.
7. Phân trang.

Quy định:

- Một `h1` cho mỗi trang.
- Tiêu đề desktop 20 px; mobile dùng tiêu đề trong header, có heading truy cập tương ứng.
- Không thêm banner giới thiệu lớn.
- Không thêm ba đến bốn khối thống kê nếu màn hình không cần chúng để thao tác.
- Nút tạo mới đặt ở toolbar, không lặp tại nhiều nơi.
- Trạng thái “Đang cập nhật…” nằm trong vị trí đã chừa sẵn.

### 3.5. Routing và tương thích

- Giữ URL đơn hàng, chi tiết đơn, sản phẩm, blog, người dùng và nội dung hiện có.
- Giữ các tham số `panel`, `preset`, `channel`, `action`, `inventory` đang được sử dụng.
- Các URL cũ trỏ vào phần orders của nhà thuốc tiếp tục được nhận diện và ánh xạ sang Đơn hàng.
- Thêm `section` cho tab Pancake và VAT bằng query string trên route gốc:
  - `/admin/pancake-pos?section=queue_webhook`
  - `/admin/ke-toan-vat?section=purchases`
- Chỉ nhận giá trị tab đã khai báo; giá trị không hợp lệ trở về tab mặc định.
- Editor đang hoạt động bằng state được giữ trong đợt này; không tự tạo thêm một hệ thống URL editor mới.
- Back/Forward và reload phải giữ đúng route và tab.
- Không gắn dữ liệu khách hàng vào URL chỉ để duy trì bộ lọc.

### 3.6. Quyền truy cập

- `master_admin`: các module và thao tác theo quyền hiện hành.
- `admin`: các module quản trị hiện được phép; không tự mở module VAT.
- `accountant`: module VAT và các thao tác hiện được cho phép trong đó.
- `doctor`, `customer`: không được cấp thêm quyền admin.

Việc ẩn nút là phản ánh quyền hiện có. Backend vẫn quyết định quyền cuối cùng.

---

## 4. Hệ thống thiết kế chung

### 4.1. Phạm vi token

Tạo một vùng theme riêng cho admin:

- Toàn bộ admin nằm dưới root nhận diện riêng.
- Token admin không bị bộ chọn theme của website ghi đè.
- Portal của dialog, drawer, popover và toast phải nằm trong vùng nhận cùng theme.
- Không sửa màu toàn cục để giải quyết vấn đề của một trang admin.
- Không làm thay đổi giao diện trang công khai dùng chung `GlassInputs`, `Pagination` hoặc uploader.

### 4.2. Bảng token màu

| Token | Sáng | Tối |
|---|---|---|
| Nền cơ sở | `#FFFFFF` | `hsl(214 32% 8%)` |
| Chữ chính | `hsl(217 31% 15%)` | `hsl(210 28% 94%)` |
| Chữ phụ | `hsl(215 16% 38%)` | `hsl(214 16% 72%)` |
| Primary | `hsl(170 58% 35%)` | `hsl(174 56% 53%)` |
| Chữ trên primary | `#FFFFFF` | `hsl(214 40% 9%)` |
| Bề mặt nội dung | Trắng, độ đục 85% | `hsl(214 28% 12%)`, độ đục 95% |
| Bề mặt toolbar | Trắng, độ đục 75% | `hsl(214 28% 12%)`, độ đục 95% |
| Bề mặt overlay | Trắng, độ đục tối thiểu 98% | Bề mặt tối, độ đục tối thiểu 98% |
| Viền bề mặt | Trắng 70% | Trắng 10% |
| Viền field/dòng | Màu border hiện tại, độ đục theo token | `hsl(214 18% 24%)` |
| Nền đầu bảng | `hsl(42 82% 95% / 0.4)` | `hsl(215 22% 16%)` |

Nền pastel sáng giữ các điểm màu hiện có:

```text
135deg:
#ffecee 0%
#fff3e6 20%
#fffbea 40%
#ecfdf5 60%
#eff6ff 80%
#f5f3ff 100%
```

Nền tối dùng các điểm màu tối đang có trong shell. Nền luôn tĩnh, không có chuyển động gradient.

### 4.3. Màu trạng thái

| Ngữ nghĩa | Nhóm màu | Ví dụ |
|---|---|---|
| Thành công | Emerald | Đã lưu, Hoàn thành, Đã thanh toán |
| Đang xử lý | Sky | Đang giao, Đang đồng bộ |
| Cần chú ý | Amber | Chờ xác nhận, Thiếu dữ liệu |
| Lỗi/nguy hiểm | Rose | Thanh toán lỗi, Xóa, Đồng bộ thất bại |
| Trung tính | Slate | Chưa thiết lập, Không có dữ liệu |
| Phân loại POS | Violet | POS |
| Phân loại Online | Sky | Online |

Quy tắc:

- Trạng thái luôn có chữ, không chỉ có chấm màu.
- Loại đơn, trạng thái đơn và trạng thái thanh toán là ba thông tin khác nhau.
- Giữ nghĩa nghiệp vụ của từng giá trị backend.
- Các trạng thái khác miền dùng chung cách vẽ nhưng có bảng nhãn riêng.
- Chữ thường phải đạt tương phản tối thiểu 4,5:1 trên nền thực tế.

### 4.4. Font và chữ

| Vai trò | Desktop | Mobile |
|---|---|---|
| Tiêu đề trang | 20/28 px, 700 | 16/24 px, 700 |
| Tiêu đề khu vực | 16/24 px, 700 | 16/24 px, 700 |
| Nội dung chính | 14/20 px, 400–500 | 14/20 px, 400–500 |
| Dữ liệu nổi bật | 14/20 px, 600–700 | 14/20 px, 600–700 |
| Nhãn field | 12/16 px, 600 | 12/16 px, 600 |
| Chữ phụ | 12/18 px | 12/18 px |
| Tiêu đề cột | 11/16 px, 600 | Theo mẫu danh sách mobile |
| Chữ trong input | 14 px | 16 px |
| Số thống kê | 24/32 px, 700 | 20/28 px, 700 |

- Font 16 px trong ô nhập mobile tránh phóng to ngoài ý muốn trên iOS.
- Tiền và số lượng dùng chữ số có độ rộng đồng đều.
- Không dùng `font-black` cho mọi nhãn.
- Không viết hoa toàn bộ đoạn mô tả.
- Không dùng chữ 9–10 px cho thông tin người dùng cần đọc để ra quyết định.
- Font được tải từ nguồn hiện có; ưu tiên WOFF2 và `font-display: swap`.

### 4.5. Kích thước và khoảng cách

| Thành phần | Quy định |
|---|---|
| Chiều rộng workspace | Tối đa 1680 px |
| Lề ngoài | 12 px mobile; 16 px tablet; 24–32 px desktop |
| Khoảng cách giữa khối | 12 px mobile; 20 px desktop |
| Padding toolbar | 12 px mobile; 16 px desktop |
| Padding khối nội dung | 16 px mobile; 20–24 px desktop |
| Bo góc khối lớn | 16 px mobile; 28 px desktop |
| Bo góc field/nút | 12 px nhỏ; 16 px tiêu chuẩn |
| Field thường | Cao 40 px desktop; 44 px mobile |
| Nút biểu tượng | 36 px desktop; vùng bấm 44 px mobile |
| Dòng danh sách đơn | Tối thiểu 80 px; tăng theo nội dung |
| Dòng danh mục đơn giản | Tối thiểu 64 px |
| Ảnh trong bảng | 40–48 px |
| Ảnh trong danh sách mobile | 48–56 px |
| Dialog ngắn | Tối đa 480 px |
| Dialog form | Tối đa 720 px |
| Dialog nhập/xem trước dữ liệu | Tối đa 1080 px |

Không thêm padding riêng lẻ bằng `-mx-*` để bù sai lệch giữa các trang. Container chung chịu trách nhiệm căn lề.

### 4.6. Bề mặt và hiệu ứng

- Dùng một loại shadow chính lấy từ mẫu Đơn hàng:
  `0 28px 70px -48px rgba(24,35,32,0.55)`.
- Khối con ưu tiên đường phân cách và khoảng trắng.
- Không lồng nhiều khối có shadow trong cùng một khối.
- Blur chỉ dùng ở chrome hoặc bề mặt cần thiết.
- Không đặt blur trên từng hàng, từng cell hoặc từng badge.
- Bảng dài dùng nền bán trong suốt để giữ cảm giác của mẫu mà giảm chi phí vẽ.
- Không animate blur, shadow lớn hoặc gradient.

### 4.7. Icon

- Tái sử dụng bộ icon admin hiện có.
- Sửa việc icon có nhãn/alt không khớp module, chẳng hạn Sản phẩm đang dùng alt Đơn hàng.
- Khung icon luôn có kích thước cố định.
- Icon công cụ nhỏ dùng cùng kích thước 16–20 px.
- Nút có chữ dùng icon trang trí với `alt=""` hoặc `aria-hidden`.
- Nút chỉ có icon phải có tên truy cập cụ thể.
- Có fallback khi ảnh icon lỗi; fallback không thay đổi chiều rộng nút.
- Không tạo icon mới bằng hình ảnh AI trong đợt này.

### 4.8. Chuyển động

- Hover/focus: 120 ms.
- Menu/popover: 120–160 ms.
- Drawer/dialog: 160–180 ms.
- Không chạy animation hiện từng hàng trong bảng.
- Không làm số tiền đếm từ 0 mỗi lần làm mới.
- Không dùng hiệu ứng scale toàn workspace khi chuyển trang.
- Khi bật giảm chuyển động, bỏ transform và chỉ giữ thay đổi trạng thái tức thời.

---

## 5. Component và quy tắc UX dùng chung

### 5.1. Danh mục component

| Component | Trách nhiệm |
|---|---|
| `AdminWorkspaceLayout` | Khung, rail, mobile header, vùng nội dung, portal root |
| `AdminPageHeader` | Tiêu đề, breadcrumb của chi tiết, mô tả ngắn khi cần |
| `AdminSectionTabs` | Tab con và active state |
| `AdminSurface` | Bề mặt toolbar, nội dung, overlay |
| `AdminToolbar` | Search, filter toggle, primary action, action menu |
| `AdminFilterPanel` | Grid bộ lọc và nút xóa lọc |
| `AdminSearchField` | Input có label, xóa nội dung và trạng thái lọc |
| `AdminField` | Label, mô tả, lỗi, required, ID |
| `AdminButton` | Primary, secondary, ghost, destructive |
| `AdminIconButton` | Nút icon có tên truy cập và tooltip |
| `AdminStatusBadge` | Hiển thị trạng thái theo ngữ nghĩa |
| `AdminDataTable` | Đầu bảng, cột, row key, empty/loading state |
| `AdminMobileList` | Danh sách nhỏ tương đương về dữ liệu |
| `AdminSelectionBar` | Chọn trang, số chọn, thao tác hàng loạt |
| `AdminPagination` | Tổng kết quả, trang, trước/sau |
| `AdminRowActions` | Menu hành động desktop/mobile |
| `AdminDialog` | Modal, focus trap, Escape, trả focus |
| `AdminDrawer` | Vùng chi tiết hoặc điều hướng trên màn hình nhỏ |
| `AdminFormSection` | Nhóm field và mô tả |
| `AdminFormActions` | Lưu, hủy, trạng thái lưu |
| `AdminAsyncState` | Tải lần đầu, làm mới, rỗng, lỗi, bị từ chối |
| `AdminMetric` | Số liệu và trạng thái không có dữ liệu |
| `AdminUploadQueue` | Tiến trình theo file |
| `AdminImportPreview` | Dòng hợp lệ, lỗi, kết quả nhập |

Không đưa nghiệp vụ VAT hoặc trạng thái đơn hàng trực tiếp vào component tổng quát.

### 5.2. Hợp đồng dữ liệu component

- Search dùng một kiểu callback: `onValueChange(value: string)`.
- Input native dùng `onChange(event)` theo chuẩn React.
- Không thử gọi callback theo một kiểu rồi bắt lỗi để đoán kiểu khác.
- Nút có `loading`, `disabled`, `variant`, `size`.
- Cột bảng khai báo ID, nhãn, căn lề, cách render và thông tin sắp xếp nếu có.
- Bảng dùng `rowKey` từ ID ổn định.
- Badge nhận `tone` và `label`; adapter nghiệp vụ quyết định chúng.
- Component trạng thái nhận lỗi đã được chuyển thành thông điệp người dùng đọc được.
- Không dùng `any` để nối route với menu.

### 5.3. Tìm kiếm

- Người dùng gõ và thấy ký tự ngay.
- Search phía client dùng giá trị trì hoãn cho phần lọc nặng; không trì hoãn chính input.
- Search gọi API có debounce 250 ms.
- Enter chạy ngay nếu chưa hết debounce.
- Xóa search đưa kết quả về trang đầu.
- Search có label truy cập; placeholder chỉ gợi ý phạm vi.
- Không tạo lại callback hoặc cấu hình sidebar theo từng ký tự.
- Kết quả cũ không bị xóa trắng trong lúc chờ phản hồi mới.
- Phản hồi cũ không được ghi đè truy vấn mới.

### 5.4. Bộ lọc

- Desktop từ 1280 px: bộ lọc mở sẵn theo mẫu Đơn hàng.
- Từ 1024–1279 px: thu gọn mặc định, mở theo nút.
- Dưới 1024 px: thu gọn mặc định, grid hai cột; một cột nếu field cần rộng.
- Khoảng ngày luôn có tên “Từ ngày”, “Đến ngày”.
- Thay bộ lọc đưa về trang 1.
- Có số bộ lọc đang hoạt động.
- Có “Xóa bộ lọc”.
- Preset là bộ lọc, không phải trạng thái nghiệp vụ mới.
- Khoảng ngày sai hiển thị lỗi tại field, không gửi request sai.
- Bộ lọc chỉ tác động dữ liệu mà màn hình thực sự tải được.
- Khi dataset bị giới hạn bởi API, UI phải nêu rõ phạm vi.

### 5.5. Chọn nhiều

- Checkbox đầu bảng chọn toàn bộ trang hiện tại.
- Giữ lựa chọn khi chuyển trang trong cùng một bộ lọc.
- Thay search, bộ lọc hoặc module sẽ xóa lựa chọn.
- Nhãn thanh chọn phải thể hiện tổng số đang chọn, kể cả ở trang khác.
- Checkbox đầu bảng có trạng thái chọn một phần.
- Không hiển thị “chọn toàn bộ” nếu hệ thống chỉ có một phần dataset.
- Thao tác hàng loạt hiển thị số bản ghi và tác động trước khi xác nhận.
- Kết quả trả về hiển thị số thành công, số thất bại và bản ghi cần xử lý lại.
- Không báo thành công toàn bộ khi API trả thành công một phần.

### 5.6. Danh sách và phân trang

- Giữ 30 dòng/trang với Sản phẩm và Đơn hàng.
- Các danh sách quản trị lớn mới được chuẩn hóa về 30 dòng/trang.
- Danh mục nhỏ dưới 30 bản ghi không cần hiện dãy số trang.
- Dữ liệu phía server dùng phân trang của API khi đã có.
- Dữ liệu đã tải đủ phía client mới được phân trang tại client.
- Không biến `limit: 300` của khách hàng thành “toàn bộ khách hàng”.
- Khi quay lại từ chi tiết, khôi phục search, filter, trang và vị trí cuộn trong phiên.
- Khi bản ghi bị xóa khiến trang hiện tại không còn tồn tại, chuyển tới trang hợp lệ gần nhất.
- Trong lúc cập nhật một dòng, các dòng khác tiếp tục thao tác được.

### 5.7. Biểu mẫu

- Label ở trên field.
- Field bắt buộc có dấu `*` và quy tắc tương ứng.
- Validation trên blur và khi submit.
- Lỗi cấp form xuất hiện đầu form; lỗi field nằm ngay dưới field.
- Submit lỗi đưa focus tới field lỗi đầu tiên.
- Nút Lưu giữ nguyên kích thước khi hiện spinner.
- Trong lúc lưu, chặn submit lặp.
- Lưu thất bại giữ nguyên dữ liệu đang nhập.
- Hủy chỉ hỏi lại nếu có thay đổi chưa lưu.
- Điều hướng nội bộ, nút Back và đóng editor đều đi qua cùng cơ chế kiểm tra thay đổi.
- Không lưu draft mới cho dữ liệu tài chính hoặc hồ sơ nhạy cảm nếu màn hình đó chưa có cơ chế draft.
- Editor đã có draft local/server tiếp tục giữ khóa và dữ liệu draft hiện hữu.

### 5.8. Nháp và lưu chính thức

Phải hiển thị riêng:

- “Có thay đổi chưa lưu”.
- “Đang lưu bản nháp”.
- “Bản nháp đã lưu trên máy”.
- “Bản nháp đã đồng bộ”.
- “Đã lưu nội dung”.
- “Không thể đồng bộ bản nháp”.

Không dùng “Đã lưu” để đại diện cho cả bản nháp và dữ liệu chính thức.

### 5.9. Dialog và menu

- Escape đóng menu và dialog thông thường.
- Dialog đang thực hiện thao tác không thể hủy phải nêu trạng thái rõ.
- Focus không đi ra phía sau modal.
- Đóng dialog trả focus về nút mở.
- Menu thao tác neo đúng dòng.
- Đổi trang hoặc xóa dòng đóng menu cũ.
- Không để `overflow-hidden` của bảng cắt menu.
- Không lồng dialog chỉ để hỏi một lựa chọn đơn giản.
- Menu trên mobile dùng popover hoặc sheet tùy không gian, cùng danh sách thao tác.

### 5.10. Trạng thái bất đồng bộ

Mỗi màn hình phải có đủ:

| Trạng thái | Cách hiển thị |
|---|---|
| Tải lần đầu | Skeleton theo đúng cấu trúc màn hình |
| Có dữ liệu | Nội dung chính |
| Đang làm mới | Giữ nội dung, hiện chỉ báo nhỏ |
| Không có dữ liệu | Thông điệp theo module và CTA phù hợp |
| Không khớp bộ lọc | Giải thích + Xóa bộ lọc |
| Lỗi tải lần đầu | Lỗi trong khung + Thử lại |
| Làm mới thất bại | Giữ dữ liệu cũ + thời điểm cập nhật + Thử lại |
| Không có quyền | Trang thông báo quyền và đường quay lại hợp lệ |
| Hết phiên | Chuyển về đăng nhập theo cơ chế hiện có |
| Tác vụ thành công một phần | Bảng kết quả có từng lỗi |

### 5.11. Tiền, ngày giờ và ngôn ngữ

- Tiền: định dạng `vi-VN`, đơn vị VND.
- Không đổi quy tắc làm tròn nghiệp vụ.
- Thời gian hiển thị theo `Asia/Ho_Chi_Minh`.
- Dữ liệu vẫn gửi theo định dạng API hiện hành.
- Giá trị không có là “Chưa có”, “Chưa thiết lập” hoặc dấu `—`.
- Giá trị 0 phải hiển thị là 0, không bị coi là thiếu dữ liệu.
- Nhãn vận hành dùng tiếng Việt.
- Giữ tên sản phẩm Pancake, Deplao, GHTK, SePay.
- Thuật ngữ D1, webhook hoặc outbox chỉ đặt trong phần tích hợp/kỹ thuật cần chúng.

---

## 6. Kế hoạch chi tiết từng màn hình

### 6.1. Tổng quan

#### TQ-01 — Dashboard `/admin`

**Bố cục:**

1. Header “Tổng quan”.
2. Thanh chọn kỳ: Tuần này, 30 ngày, 90 ngày; nút Làm mới.
3. Một dải số liệu gọn từ các chỉ số hiện có.
4. Hai vùng: cơ cấu doanh số và doanh thu theo ngày.
5. Top sản phẩm, top dịch vụ, phân bố địa phương.
6. Trạng thái hệ thống ở cuối.

**Công việc:**

- Chuẩn hóa toolbar theo Đơn hàng.
- Giảm cỡ tiêu đề bên trong biểu đồ về cùng thang chữ.
- Bỏ các nhãn trang trí lặp nội dung tiêu đề.
- Giữ chiều cao biểu đồ cố định khi đang tải.
- Giá trị 0 hiển thị cột/thanh có độ dài 0 hoặc empty state phù hợp.
- Giữ định nghĩa doanh số và doanh thu hiện có.
- Thời điểm cập nhật nằm cạnh nút Làm mới.
- Vùng trạng thái hệ thống lỗi không làm biến mất toàn Dashboard.
- Không tự thêm KPI chưa có nguồn dữ liệu.

**Nghiệm thu:**

- Đổi kỳ không làm shell nháy.
- Không vẽ thanh đầy khi giá trị bằng 0.
- Một request lỗi không làm toàn trang trống.
- Các liên kết mở danh sách có preset đúng.

#### TQ-02 — Khách hàng `/admin?panel=customers`

**Bố cục:**

- Toolbar tìm tên, email, điện thoại; xuất dữ liệu nếu hiện có.
- Bộ lọc phân khúc, khách quay lại, khách cần chăm sóc lại và thời gian.
- Dải tổng kết số khách, chi tiêu và phân khúc.
- Danh sách bên trái; chi tiết bên phải trên màn hình rộng.
- Mobile chuyển giữa danh sách và chi tiết.

**Công việc:**

- Chuẩn hóa nhãn phân khúc sang tiếng Việt dễ hiểu.
- Dòng khách gồm tên, liên hệ, phân khúc, chi tiêu, số đơn/lịch và lần gần nhất theo dữ liệu có.
- Phân biệt tổng tiền trong kỳ và tổng lịch sử.
- Không mở nhiều chi tiết khách cùng lúc.
- Thay bộ lọc mà khách đang xem không còn trong kết quả thì đóng chi tiết và thông báo ngắn.
- Hiển thị rõ phạm vi tải nếu endpoint đang giới hạn 300 bản ghi.
- Không gọi tổng dataset đã tải là tổng hệ thống.
- Giữ thuật toán liên kết đơn với khách hiện tại.

**Nghiệm thu:**

- Search và bộ lọc kết hợp đúng.
- Chọn khách không tải lại toàn danh sách.
- Dữ liệu khách trước không xuất hiện dưới tên khách mới khi request chậm.
- Trở về danh sách mobile khôi phục vị trí.

#### TQ-03 — Chi tiết khách hàng

- Header gồm tên, định danh và nút quay lại.
- Các tab: Tổng quan, Đơn hàng, Phân tích.
- Tổng quan hiển thị thông tin và số liệu hiện hữu theo nhóm.
- Đơn hàng dùng hàng rút gọn của component đơn hàng.
- Đơn có liên kết tới chi tiết đúng ID.
- Mỗi tab có trạng thái rỗng riêng.
- Không tự tạo chức năng gửi tin, gọi API chăm sóc khách hoặc thay phân khúc.
- Khi dữ liệu chi tiết lỗi, danh sách khách vẫn giữ nguyên.

**Nghiệm thu:** Mỗi tab đổi độc lập; không rò dữ liệu giữa hai khách; link đơn hoạt động.

#### TQ-04 — Lịch hẹn `/admin?panel=appointments`

**Cột desktop:**

- Khách hàng/bệnh nhân.
- Dịch vụ và bác sĩ.
- Thời gian hẹn.
- Hóa đơn và thanh toán.
- Trạng thái.
- Thao tác.

**Công việc:**

- Search và các bộ lọc trạng thái, dịch vụ, bác sĩ, khoảng ngày theo mẫu chung.
- Mobile ưu tiên tên, dịch vụ, thời gian, trạng thái.
- Ngày giờ không bị cắt thành chuỗi khó hiểu.
- Phân biệt trạng thái lịch và trạng thái thanh toán.
- Bộ lọc được truyền từ Dashboard phải xuất hiện rõ.
- Thao tác thay trạng thái áp dụng vào bản ghi đang chọn.
- Làm mới không đóng chi tiết nếu bản ghi vẫn còn.

**Nghiệm thu:** Giữ đúng preset, ngày giờ, lựa chọn bác sĩ và trạng thái sau reload/Back.

#### TQ-05 — Chi tiết lịch hẹn

- Header hiển thị khách và thời gian.
- Nhóm thông tin khách, dịch vụ/bác sĩ, thanh toán và cập nhật trạng thái.
- Các thao tác bị giới hạn theo trạng thái backend hiện hành.
- Không đặt nhiều nút primary cạnh nhau.
- Sau cập nhật, dòng trong danh sách và chi tiết dùng cùng dữ liệu mới.
- Form lỗi giữ lựa chọn và hiện thông điệp tại vùng cập nhật.

#### TQ-06 — Báo cáo `/admin?panel=reports`

- Toolbar kỳ báo cáo, xuất báo cáo và làm mới.
- Số liệu dùng cùng định dạng với Dashboard.
- Top sản phẩm và dịch vụ dùng hàng dữ liệu gọn.
- Cảnh báo có nhãn mức độ tiếng Việt.
- Lịch gửi báo cáo là một khu vực quản lý riêng ở phía dưới.
- Xuất dữ liệu phải thể hiện rõ kỳ đang xuất.
- Trong lúc xuất, chỉ nút xuất chuyển trạng thái bận.

**Nghiệm thu:** Kỳ hiển thị và kỳ xuất khớp; không có số liệu từ kỳ cũ xen vào.

#### TQ-07 — Lịch gửi báo cáo

**Danh sách:**

- Tên lịch.
- Loại/kỳ báo cáo.
- Tần suất.
- Thời gian và múi giờ.
- Người nhận.
- Lần chạy kế tiếp.
- Bật/tắt.
- Thao tác.

**Form:**

- Giữ các field hiện tại: tên, preset, tần suất, ngày trong tuần khi cần, giờ, phút, người nhận, enabled.
- Ngày trong tuần chỉ xuất hiện khi chọn hàng tuần.
- Thời gian có nhãn múi giờ rõ.
- Kiểm tra email trước khi lưu.
- Chuyển form tạo/sửa vào dialog, không chiếm nửa trang thường trực.
- Xóa có tên lịch trong xác nhận.
- Không thêm nút gửi thử nếu backend chưa có.

**Nghiệm thu:** Tạo, sửa, bật/tắt và xóa trên môi trường test; không phát sinh người nhận ngoài fixture.

---

### 6.2. Đơn hàng

#### DH-01 — Danh sách `/admin/don-hang`

Đây là màn hình tham chiếu đầu tiên được chuyển sang component chung.

**Giữ:**

- Search mã đơn, khách, SĐT, vận đơn.
- Lọc trạng thái đơn, thanh toán, vận chuyển, nguồn đơn và ngày.
- Bảng, chọn nhiều, phân trang.
- Phân biệt Online/POS.
- Xuất Excel.
- Các thao tác nghiệp vụ hiện có.

**Bổ sung/chỉnh:**

- Header đúng “Đơn hàng”.
- Nút “Tạo đơn” mở lựa chọn Online/POS.
- Preset nghiệp vụ có nhãn Việt:
  - Tất cả đơn.
  - Cần xử lý.
  - Thiếu vận đơn.
  - Chờ đối soát chuyển khoản.
  - Cần kiểm tra hoàn tiền.
  - Đơn hôm nay.
- Thanh chọn nhiều có cùng vị trí ở desktop và mobile.
- Nút Lưu tại từng dòng chỉ khả dụng khi có thay đổi hợp lệ.
- Khi lưu một dòng, chỉ dòng đó thể hiện đang lưu.
- Tách rõ trạng thái đơn và thanh toán.
- Mã rút gọn có tooltip hoặc thao tác xem mã đầy đủ.
- Địa chỉ dài giới hạn số dòng nhưng có cách xem đầy đủ.
- Các hàng không cần thay đổi không render lại khi sửa trạng thái một đơn.

**Nghiệm thu:**

- Kết quả lọc và tổng kết quả đúng.
- Chọn nhiều qua hai trang không sai số lượng.
- Đổi bộ lọc xóa lựa chọn cũ.
- Xuất đúng phạm vi ghi trên UI.
- Trạng thái đơn sau lưu giống tại trang chi tiết.

#### DH-02 — Chi tiết `/admin/don-hang/:id`

**Bố cục desktop:**

- Header: mã đơn, nguồn, thời gian, trạng thái.
- Hành động: in A4, in 80 mm và các thao tác hiện có.
- Hai cột: khách/nhận hàng và thanh toán/tổng tiền.
- Danh sách sản phẩm toàn chiều rộng.
- Tab lịch sử trạng thái, thanh toán, hoàn tiền.

**Công việc:**

- Header dùng `h1`, bỏ tiêu đề bị lặp.
- Back và đóng chi tiết cùng trở về danh sách trước đó.
- Phần giá trị dùng số snapshot của đơn.
- Không lấy giá catalog hiện tại tính lại đơn lịch sử.
- Trạng thái khả dụng dùng cùng nguồn quy tắc với danh sách.
- Lịch sử có thời gian và ghi chú rõ.
- Tab đang tải không làm collapse phần thông tin phía trên.
- Mobile xếp theo thứ tự: tóm tắt → khách → nhận hàng → sản phẩm → thanh toán → lịch sử.

**Nghiệm thu:** URL mở trực tiếp được; ID sai có thông báo; không chuyển về Dashboard ngoài ý muốn.

#### DH-03 — Tạo đơn Online

**Bố cục:**

- Header và quay lại.
- Chọn sản phẩm.
- Khách hàng.
- Địa chỉ/giao hàng.
- Thanh toán/ghi chú.
- Tóm tắt đơn bên phải trên desktop; cuối form trên mobile.

**Công việc:**

- Search catalog không làm giật danh sách đã chọn.
- Dòng sản phẩm có ảnh, tên, đơn giá, số lượng, thành tiền, xóa.
- Tên và điện thoại bắt buộc theo validation hiện tại.
- Email giữ tùy chọn.
- Tái sử dụng `VietnamAddressFields`.
- Phương thức thanh toán giữ các lựa chọn Online đang có.
- Phí thu khách dùng chính sách backend hiện tại; không nhập thêm một công thức UI riêng.
- Phân biệt phí thu khách và cước hãng vận chuyển.
- Tóm tắt cập nhật từ cùng hàm tính đang dùng.
- Khóa submit lặp.
- Thành công hiển thị mã đơn và thao tác xem/in.

**Nghiệm thu:** Đơn tạo ra có sản phẩm, số lượng, phí, giảm giá và thanh toán khớp request/response hiện hành.

#### DH-04 — Tạo đơn POS

- Dùng cùng editor với Online.
- Nhãn đầu trang “Tạo đơn POS”.
- Hỗ trợ khách lẻ theo hành vi hiện có.
- Không buộc địa chỉ giao hàng.
- Không hiển thị field giao hàng không áp dụng.
- Giữ phương thức thanh toán và trạng thái khi tạo đang có.
- Giữ mặc định nghiệp vụ POS hiện hành.
- Không tái tạo trang POS đã bị loại khỏi workspace.

**Nghiệm thu:** Chuyển kênh không mang theo dữ liệu bắt buộc hoặc chi phí sai; hóa đơn POS được tạo đúng.

#### DH-05 — Cập nhật hàng loạt và các tác vụ xử lý đơn

- Gom vào thanh chọn hoặc menu công cụ.
- Xác nhận nêu số đơn và trạng thái đích.
- Dùng validation backend, không giả định mọi đơn đều chuyển được.
- Hiển thị thành công một phần.
- Giữ các bản ghi lỗi được nhận diện để xử lý lại.
- Các tác vụ dọn đơn cũ hiện hữu đặt trong nhóm thao tác nâng cao.
- Không đặt nút tác động lớn cạnh nút mở chi tiết thông thường.

#### DH-06 — Thanh toán và hoàn tiền

- Trạng thái thanh toán đọc từ dữ liệu hiện có.
- Phần hoàn tiền hiển thị số tiền, lý do và tùy chọn hiện hành.
- Không mặc định coi thay trạng thái đơn là đã hoàn tiền.
- Lỗi hoàn tiền giữ dữ liệu form.
- Thao tác thành công cập nhật lịch sử và tổng tiền liên quan.
- Không thay nguồn thanh toán, luồng webhook hay phương thức hoàn tiền.

#### DH-07 — In A4, in 80 mm và xuất đơn

- Giữ `orderReceipt` và logic xuất hiện có.
- Bản in nền trắng, chữ đen, không có nền pastel.
- Không in sidebar, toolbar hoặc nút.
- Nội dung dài xuống dòng, không tràn mép giấy.
- Ảnh có lỗi không làm đứt bản in.
- A4 và 80 mm có kiểm thử bố cục riêng.
- Không thay trường tiền hoặc công thức trong lúc đổi giao diện.
- Xuất nhiều dữ liệu tải thư viện khi người dùng bấm, không tải vào bước mở danh sách.

---

### 6.3. Sản phẩm

#### SP-01 — Danh sách sản phẩm

**Toolbar:**

- Search tên/SKU.
- Bộ lọc.
- Menu nhập/xuất và tiện ích hiện có.
- Nút Thêm sản phẩm.

**Bộ lọc:**

- Tồn kho.
- Ẩn/hiện.
- Nổi bật.
- Cận hạn/hết hạn.
- Thiếu SKU.
- Chuyên mục.
- Thương hiệu.
- Sắp xếp.

**Công việc:**

- Đặt danh sách vào cùng bề mặt trắng mờ như Đơn hàng.
- Cột sản phẩm gồm ảnh, tên và metadata.
- Giá căn phải.
- Trạng thái có nhãn truy cập; không chỉ dùng icon.
- Các bộ lọc tồn kho giữ predicate hiện tại.
- Đổi nhãn để người dùng phân biệt tồn kho và hạn sử dụng.
- Thao tác sửa, đồng bộ hoặc xóa giữ đúng handler hiện có.
- Chọn nhiều và xuất áp dụng quy tắc chung.

**Nghiệm thu:** Mọi preset inventory cũ vẫn mở đúng; sort ổn định; thao tác một dòng không làm reset danh sách.

#### SP-02 — Tạo/chỉnh sửa sản phẩm

**Các khu vực bắt buộc:**

1. Thông tin cơ bản: tên, slug, mô tả ngắn.
2. Nội dung: lợi ích, thành phần, cách dùng, lưu ý, mô tả dài.
3. Hình ảnh: ảnh đại diện và gallery.
4. Giá và tồn kho.
5. Thương hiệu, xuất xứ, dung tích, kết cấu.
6. FAQ.
7. Kiểm duyệt nội dung và SEO.

**Công việc:**

- Dùng editor shell gọn thay banner lớn.
- Mục lục section có anchor.
- Desktop có thanh tóm tắt bên phải rộng 320–360 px.
- Mobile chuyển tóm tắt xuống dưới hoặc vùng thu gọn.
- Tái sử dụng các form con hiện có.
- Nút Lưu nằm ở thanh hành động thống nhất.
- Tách thông báo nháp khỏi lưu chính thức.
- Preview nội dung không render lại mỗi phần không liên quan khi gõ field ngắn.
- Field số giữ cách nhập và parse an toàn hiện tại.
- Không sửa slug đã lưu một cách tự động chỉ vì đổi tên.
- Giữ trình kiểm duyệt và SEO hiện có.

**Nghiệm thu:** Tạo/sửa, draft, khôi phục, hủy và quay lại không mất dữ liệu; ảnh và thứ tự gallery được bảo toàn.

#### SP-03 — Chuyên mục sản phẩm

- Toolbar search và Thêm chuyên mục.
- Bảng: tên, slug, hiển thị trang chủ, thao tác.
- Form giữ các field và cấu hình ảnh hiện hữu.
- Form tạo/sửa tách khỏi danh sách bằng dialog hoặc editor ngắn.
- Slug có hướng dẫn, lỗi trùng hiển thị ở field.
- Thao tác xóa phản ánh ràng buộc sản phẩm liên quan từ backend.
- Không tự chuyển sản phẩm sang chuyên mục khác.

**Nghiệm thu:** Tạo/sửa/xóa fixture hợp lệ; lỗi quan hệ không làm mất form.

#### SP-04 — Thương hiệu

- Danh sách: logo, tên, slug, thông tin mô tả, thao tác.
- Search giữ khả năng đang có.
- Form: tên, slug, mô tả, logo.
- Khung logo dùng `object-contain`.
- Khi không có logo, dùng chữ viết tắt ổn định.
- Upload logo có preview và trạng thái.
- Không dùng nhiều badge trang trí cho từng dòng.
- Giữ liên kết giữa thương hiệu và sản phẩm.

**Nghiệm thu:** Logo không méo; mô tả dài không kéo giãn toàn bảng; tên và slug không bị thay ngoài ý muốn.

#### SP-05 — Mã giảm giá

**Danh sách:**

- Mã.
- Loại và giá trị.
- Điều kiện.
- Lượt sử dụng.
- Hiệu lực.
- Trạng thái.
- Thao tác.

**Form giữ đầy đủ:**

- Mã.
- Loại giảm.
- Giá trị giảm.
- Đơn tối thiểu.
- Giảm tối đa.
- Tổng lượt.
- Lượt mỗi khách.
- Bắt đầu/kết thúc.
- Mô tả.
- Bật/tắt.

**Công việc:**

- Hiện đơn vị `%` hoặc VND theo loại.
- Phân biệt chưa hiệu lực, đang hiệu lực, hết hiệu lực và bị tắt.
- Ngày bắt đầu/kết thúc kiểm tra cùng một nơi.
- Không tự đổi mã thành chữ hoa hoặc thay quy tắc nếu backend chưa quy định.
- Không thay điều kiện áp dụng giảm giá.

**Nghiệm thu:** Giao diện chỉnh sửa phản ánh đúng giá trị đã lưu; không đổi số tiền hoặc tỷ lệ do format.

#### SP-06 — Thuế bán hàng: hồ sơ thuế

- Danh sách hồ sơ ở trên; form mở theo nút.
- Giữ mã, tên, phương thức, thuế chuẩn, tiền tệ, ngày hiệu lực và các cờ hiện có.
- Tỷ lệ hiển thị rõ đơn vị.
- Hồ sơ mặc định/đang áp dụng có nhãn rõ.
- Thuật ngữ “Thuế bán hàng” giúp phân biệt với Kế toán VAT.
- Không thay công thức thuế.

#### SP-07 — Thuế bán hàng: mức ghi đè

- Bảng: hồ sơ, khu vực, mức thuế, ưu tiên, trạng thái, thao tác.
- Form giữ tỉnh/thành, quận/huyện và các trường theo model hiện tại.
- Các field không áp dụng ở bộ địa chỉ mới vẫn được xử lý tương thích với dữ liệu cũ.
- Mô tả ngắn giải thích mức ghi đè áp dụng theo cấu hình nào.
- Không tự thay thứ tự ưu tiên nghiệp vụ.

**Nghiệm thu SP-06/07:** Trước và sau redesign, cùng fixture tạo ra cùng số thuế.

#### SP-08 — Giao hàng/GHTK

- Header trạng thái kết nối.
- Vùng webhook URL chỉ đọc, có sao chép.
- Danh sách kho/địa chỉ lấy hàng.
- Chi tiết địa chỉ mở dialog.
- Làm mới dùng loading cục bộ.
- “Chưa bật”, “Chưa cấu hình”, “Lỗi kết nối” có thông điệp khác nhau.
- Không hiển thị token hoặc thông tin bí mật.
- Không thay cấu hình hoặc kích hoạt tích hợp khi chỉ mở trang.

**Nghiệm thu:** Tích hợp đang tắt vẫn render bình thường; URL dài không tràn; dialog địa chỉ có focus đúng.

#### SP-09 — Gắn ảnh hàng loạt

**Luồng cố định:**

1. Chọn file/thư mục.
2. Phân tích.
3. Xem trước.
4. Nhập ảnh.
5. Kết quả.

**Công việc:**

- Giữ thuật toán ghép ID/slug/tên hiện có.
- Giữ danh sách định dạng và giới hạn file đang khai báo.
- Hiển thị riêng ảnh ghép được, trùng và chưa ghép được.
- Mỗi ảnh thể hiện sản phẩm đích và phương pháp ghép.
- Các tùy chọn ảnh chính, dừng khi lỗi và mức đồng thời chuyển vào vùng Cài đặt.
- Giữ mặc định hiện có: mức đồng thời 3, không tự đặt tất cả thành ảnh chính.
- Không chạy nhập ngay sau khi chọn file.
- Trong khi phân tích/nhập, thanh tiến trình giữ nguyên vị trí.
- Danh sách xem trước chỉ render số mục cần thiết trong viewport/trang.
- Giữ tải backup/report JSON hiện có.
- Lỗi từng ảnh xuất hiện ở đúng hàng.
- Thu hồi object URL khi thay bộ file hoặc rời trang.

**Nghiệm thu:** Ảnh trùng không bị nhập lặp; file lỗi không làm mất kết quả các file đã hoàn thành; trạng thái cuối khớp report.

---

### 6.4. Pancake POS

#### PC-01 — Kết nối

- Toolbar Làm mới và thời điểm cập nhật.
- Nhóm thông tin shop, kho và kênh kết nối.
- Trạng thái tổng thể có một nhãn rõ.
- Chi tiết kỹ thuật đặt dưới phần thông tin vận hành.
- Chưa cấu hình được coi là một trạng thái hợp lệ.
- Không dùng spinner vô hạn khi thiếu cấu hình.

#### PC-02 — Luồng đồng bộ

- Danh sách hàng cho sản phẩm, tồn kho, khách hàng, đơn hàng và các luồng inbound hiện có.
- Mỗi hàng: tên, chiều đồng bộ, mô tả tác động, trạng thái, công tắc.
- Công tắc thay đổi chỉ hàng tương ứng.
- Đang lưu không làm disable toàn trang.
- Thất bại trả lại trạng thái cũ và hiện lỗi.
- Mở tab không tạo tác vụ đồng bộ.

#### PC-03 — Hàng đợi và Webhook

- Tách hai khu vực outbound/inbound.
- Bảng có thực thể, sự kiện, trạng thái, lần thử, thời điểm và thao tác theo dữ liệu có.
- Chi tiết lỗi mở vùng đọc riêng.
- Hiển thị `0 tác vụ` khi rỗng.
- Payload dài dùng vùng code có giới hạn chiều cao và xuống dòng phù hợp.
- Làm mới giữ vị trí đang đọc.
- Thử lại chỉ gọi handler hiện có và cập nhật tác vụ tương ứng.

#### PC-04 — Đồng bộ thủ công

- Các hành động sản phẩm/tồn kho/khách hàng/đơn hàng thành danh sách rõ tác động.
- Hành động đang chạy có tiến trình hoặc trạng thái thực API trả về.
- Phân biệt “Đã đưa vào hàng đợi” với “Đã đồng bộ xong”.
- Không suy diễn hoàn thành khi request enqueue thành công.
- Giữ điều kiện enabled của từng tác vụ.
- Không tự chạy backfill khi vào trang.

#### PC-05 — Deplao Zalo

- Dải trạng thái thiết bị, tài khoản kết nối và số job.
- Bảng đơn, sự kiện, trạng thái/lần thử, thao tác.
- Offline hiển thị rõ và không làm toàn module lỗi.
- Giữ các thao tác retry hiện hữu.
- Không tạo tính năng gửi tin mới.
- Không đưa nội dung khách hàng vào log giao diện vượt phạm vi dữ liệu đang có.

**Nghiệm thu toàn module:** Chuyển tab không gọi mutation; loading cục bộ; trạng thái hiển thị đúng phản hồi tích hợp.

---

### 6.5. Kế toán VAT

#### VAT-01 — Tổng quan

- Giữ bốn nhóm: VAT đầu ra, đầu vào khấu trừ, thuế phải nộp, cảnh báo đối soát.
- Giữ trạng thái pháp nhân, phân loại chờ duyệt và khả năng xuất XML.
- Dải số liệu gọn, bề mặt đồng bộ.
- “Chưa mở kỳ” khác với “Thuế bằng 0”.
- Các cảnh báo có đường dẫn tới tab xử lý.
- Không biến thiếu cấu hình thành số 0 bình thường.

#### VAT-02 — Bán ra

**Bố cục mới:**

- Toolbar tìm kiếm/lọc hiện có.
- Nút Thêm hóa đơn.
- Menu Nhập Excel.
- Bảng kê là vùng chính.

**Công việc:**

- Đưa form thêm dài ra khỏi vị trí mở sẵn phía trên bảng.
- Bảng giữ ngày, số/ký hiệu, đối tác, chưa thuế, VAT, tổng tiền và trạng thái.
- Tiền căn phải và đồng nhất số chữ số.
- Mở hóa đơn giữ toàn bộ dòng chi tiết.
- Các trạng thái nháp/phát hành/đối soát dùng nhãn rõ.
- Không tính lại hóa đơn lịch sử bằng cấu hình mới.

#### VAT-03 — Mua vào

- Dùng cùng cấu trúc Bán ra.
- Giữ trường nhà cung cấp, thuế đầu vào và các điều kiện khấu trừ hiện có.
- Phân biệt hóa đơn chưa kiểm tra và đã kiểm tra.
- Thông tin chứng từ dài xuống dòng trong chi tiết.
- Không mặc định đầu vào nào cũng được khấu trừ.

#### VAT-04 — Form hóa đơn và nhập Excel

**Form:**

- Thông tin chứng từ.
- Đối tác.
- Dòng hàng hóa/dịch vụ.
- Thuế/giảm giá/tổng tiền.
- Trạng thái và lưu.

**Nhập Excel:**

1. Chọn file.
2. Kiểm tra.
3. Xem lỗi và dòng hợp lệ.
4. Xác nhận nhập.
5. Kết quả.

**Công việc:**

- Giữ kiểm tra công thức và nội dung file hiện có.
- Không mất liên hệ giữa lỗi và số dòng Excel.
- Không nhập trước bước xác nhận.
- Giữ giao dịch nguyên tử theo backend.
- Bảng số liệu rộng chỉ cuộn ngang trong khung.
- Mobile xem bản tóm tắt rồi mở chi tiết dòng khi cần.

**Nghiệm thu:** Tổng tiền và VAT khớp test hiện hữu; file có lỗi bị chặn đúng; không báo thành công trước khi commit.

#### VAT-05 — Kỳ kê khai

- Danh sách kỳ: kỳ, phương pháp, trạng thái, số liệu và thao tác.
- Mở kỳ bằng hành động rõ.
- Mỗi kỳ có khu vực chi tiết.
- Giữ luồng: nháp → gửi duyệt → khóa → đánh dấu đã nộp theo backend.
- Chỉ hiển thị thao tác đúng quyền và trạng thái.
- Nút xuất Excel, PDF, XML gom thành nhóm.
- XML chưa đủ điều kiện tiếp tục bị chặn và giải thích lý do.
- Không thay đổi snapshot phương pháp/chu kỳ của kỳ đã mở.

#### VAT-06 — Điều chỉnh

- Bảng điều chỉnh trước; nút Thêm điều chỉnh mở form.
- Form gồm kỳ, loại, số tiền, lý do.
- Chỉ chọn kỳ chưa khóa theo quy tắc hiện tại.
- Lý do bắt buộc.
- Nhãn tăng/giảm đầu vào/đầu ra rõ ràng.
- Trạng thái chờ/đã duyệt có màu và chữ.
- Giữ cách phê duyệt theo vai trò hiện có.

#### VAT-07 — Quy tắc VAT

- Ba khu vực: danh mục thuế suất, phân loại chờ duyệt, tỷ lệ/phương pháp trực tiếp hiện có.
- Bảng thuế suất giữ mã, tên nhóm, tỷ lệ, hiệu lực, trạng thái, căn cứ.
- Không hiển thị một tỷ lệ mới chỉ từ việc đổi thiết kế.
- Người không có quyền duyệt có chế độ chỉ đọc rõ.
- Duyệt hàng loạt nêu số sản phẩm/dịch vụ.
- Kết quả cập nhật không reset tab về Tổng quan.

#### VAT-08 — Pháp nhân

- Field chia theo: danh tính, phương pháp/chu kỳ, mốc vận hành và cấu hình tờ khai.
- Giữ các field hiện hữu.
- `accountant` xem thông tin theo quyền hiện tại.
- Chỉ vai trò hiện được phép mới sửa.
- Lưu thất bại không làm mất form.
- Không tự kích hoạt pháp nhân hoặc đổi mốc ghi nhận.

#### VAT-09 — Đối soát D1

- Giữ chức năng hiện có, đổi tên hiển thị dễ hiểu.
- Tóm tắt trạng thái đối soát và danh sách vấn đề.
- Không nhúng bảng dài vào một khối nhỏ có nhiều tầng scroll.
- Chi tiết lỗi có nút sao chép thông tin cần thiết nếu chức năng đã có.
- Không tự chạy migration hoặc sửa dữ liệu khi mở tab.

**Nghiệm thu toàn module:**

- Cùng fixture tạo cùng kết quả trước/sau.
- Quyền accountant/master_admin được giữ.
- Kỳ khóa không sửa được.
- Bản in và file xuất giữ số liệu, cấu trúc cần thiết.
- Không coi trạng thái XML chưa sẵn sàng là lỗi giao diện cần bỏ qua.

---

### 6.6. Kiến thức

#### KT-01 — Tất cả bài viết

- Toolbar search, lọc chuyên mục, menu nhập/xuất và Thêm bài viết.
- Bảng: bài viết, chuyên mục, tác giả, ngày đăng, thao tác.
- Ảnh bìa kích thước ổn định.
- Tiêu đề giới hạn hai dòng.
- Trạng thái nội dung/SEO chỉ thêm từ dữ liệu đang có.
- Mobile ưu tiên ảnh, tiêu đề, chuyên mục, ngày và menu.
- Xóa giữ xác nhận và handler hiện tại.

#### KT-02 — Hàng đợi SEO

- Dùng chung danh sách bài viết.
- Hiển thị lý do bài nằm trong hàng đợi.
- Ưu tiên mở đúng editor/khu vực sửa.
- Không đánh dấu đạt chỉ vì mở bài.
- Giữ logic xác định hàng đợi hiện hành.
- Không tự sinh nội dung hoặc thay thuật toán SEO trong đợt UI.

#### KT-03 — Thiếu ảnh bìa

- Dùng chung toolbar và bảng.
- Mỗi dòng có hành động mở phần ảnh của bài.
- Không dùng trạng thái ảnh lỗi tải tạm thời thay cho “bài chưa có ảnh”.
- Giữ logic kiểm tra ảnh hiện có.
- Empty state: “Các bài viết trong phạm vi này đã có ảnh bìa”.

#### KT-04 — Chuyên mục bài viết

- Danh sách tên, slug, thông tin hiện có và thao tác.
- Form tạo/sửa gọn.
- Quan hệ với bài viết được giữ.
- Xóa có xử lý lỗi chuyên mục đang được sử dụng.
- Không tự thay slug hoặc redirect.

#### KT-05 — Tạo/chỉnh sửa bài viết

**Nhóm nội dung:**

1. Tiêu đề, slug, tóm tắt.
2. Ảnh bìa.
3. Nội dung chính.
4. Bản dịch SEO.
5. Chuyên mục.
6. Meta description, keywords, canonical và phần SEO hiện hữu.

**Công việc:**

- Dùng `AdminEditorShell` chung.
- Bản dịch giữ English, Russian và Chinese hiện có.
- Mỗi bản dịch có tab/section riêng, không render preview nặng cùng lúc.
- Preview Markdown và vùng nhập có hành vi nhất quán.
- Thanh lưu, dirty state và draft giống editor sản phẩm.
- Không tự sửa nội dung đã đăng.
- Không xóa draft cũ khi migrate component.

**Nghiệm thu:** Văn bản dài, ảnh, bản dịch và metadata lưu/khôi phục đúng; public rendering không bị ảnh hưởng.

---

### 6.7. Dịch vụ

#### DV-01 — Danh sách

- Toolbar search và Thêm dịch vụ.
- Bảng giữ ảnh, tên, giá, mô tả ngắn, thao tác.
- Giá “Liên hệ” không bị chuyển thành `0 ₫`.
- Hình ảnh đồng nhất tỷ lệ.
- Không thêm các bộ lọc không có dữ liệu hỗ trợ.
- Dưới 30 dịch vụ không cần phân trang thừa.

#### DV-02 — Tạo/chỉnh sửa dịch vụ

- Các section: thông tin cơ bản, chi phí, quy trình, FAQ.
- Giữ tên, slug, icon, ảnh, mô tả ngắn/dài và giá.
- Thao tác thêm/xóa/sắp xếp bước quy trình theo khả năng hiện có.
- Chuẩn hóa uploader và FAQ editor.
- Có draft và cảnh báo rời form như hiện tại.
- Giá rỗng giữ nghĩa “Liên hệ”.
- Không thêm validation làm mất dữ liệu hợp lệ cũ.

**Nghiệm thu:** Tạo/sửa dịch vụ; quy trình và FAQ đúng thứ tự; giá rỗng và giá 0 được phân biệt theo model.

---

### 6.8. Hình ảnh

#### HA-01 — Thư viện

- Toolbar chọn vùng lưu trữ, thư mục, search, Làm mới, Tải ảnh.
- Các vùng hiện có: assets, product-images, site-assets, blog-images, avatars.
- Nhãn người dùng đọc được; tên kỹ thuật đặt phụ khi cần.
- Lưới thumbnail có tỷ lệ cố định.
- Ảnh tải chậm có skeleton.
- Ảnh lỗi có fallback đúng kích thước.
- Hiển thị tên file và thông tin đang dùng theo API.
- Không load toàn bộ ảnh gốc ngay khi mở thư viện.

#### HA-02 — Chi tiết ảnh

- Preview lớn.
- Tên file, vùng lưu, thư mục, URL và thông tin sử dụng hiện có.
- Sao chép URL có phản hồi rõ.
- Tên/URL dài xuống dòng hoặc có vùng cuộn riêng.
- Xóa bị chặn khi ảnh đang được tham chiếu theo kiểm tra hiện tại.
- Không thêm quyền đổi tên/di chuyển file nếu chưa có API.

#### HA-03 — Tải lên

- Nút Tải ảnh mở khu vực upload.
- Danh sách từng file: tên, preview, trạng thái, kết quả/lỗi.
- Hiện rõ đích tải trước khi bắt đầu.
- File thành công xuất hiện trong thư viện.
- Làm mới lưới không làm mất kết quả upload.
- Không buộc tải lại các file đã thành công khi chỉ một file lỗi.

**Nghiệm thu:** Ảnh đang dùng không bị xóa; file lỗi được báo riêng; clipboard và URL đúng.

---

### 6.9. Người dùng

#### ND-01 — Bác sĩ

- Toolbar search và Thêm bác sĩ nếu quyền hiện tại cho phép.
- Bảng: ảnh/tên, chức danh/học vị, chuyên môn, thao tác.
- Thông tin nhiều dòng không làm icon thao tác lệch vị trí.
- Mở editor giữ context danh sách.
- Không dùng avatar lỗi làm tăng chiều cao hàng.

#### ND-02 — Editor bác sĩ

- Tài khoản và chứng chỉ hành nghề.
- Hồ sơ chuyên môn.
- Bằng cấp/quá trình công tác.
- Nội dung hiển thị trang chủ.
- Ảnh và các field hiện hữu.
- Giữ cơ chế draft.
- Không coi chỉnh hồ sơ bác sĩ là đổi quyền tài khoản.
- Không tự thay username hoặc mã chứng chỉ.

#### ND-03 — Tài khoản & phân quyền

- Toolbar search và lọc role.
- Bảng: tên, email/xác minh, vai trò, hồ sơ và thao tác hiện có.
- Nhãn role hiển thị tiếng Việt nhưng payload giữ enum hiện tại.
- Thay quyền có xác nhận nêu tài khoản và quyền mới.
- Chỉ render lựa chọn được quyền thay đổi.
- Trong lúc lưu chỉ khóa tài khoản đang cập nhật.
- Lỗi quyền từ backend được phản ánh rõ.

**Nghiệm thu:** Không tự mở rộng quyền; direct route không vượt kiểm tra backend.

#### ND-04 — Chi tiết hồ sơ

- Header tên và liên hệ.
- Các section: đơn hàng/chi tiêu, lịch hẹn/điều trị, bệnh án/ghi chú và phần hồ sơ hiện hữu.
- Dữ liệu y tế chỉ hiện theo quyền và API hiện tại.
- Nội dung dài không nằm trong tooltip.
- Các tài liệu giữ cách truy cập hiện có.
- Mỗi section có loading và error độc lập.
- Không cache dữ liệu khách trong vùng dùng chung không gắn tài khoản.

---

### 6.10. Nội dung site

#### SITE-01 — Thương hiệu

- Tên thương hiệu.
- Logo nền sáng.
- Logo nền tối.
- Favicon.
- Preview có đúng nền sáng/tối.
- Uploader và nút lưu dùng component chung.
- Sửa nhãn/alt preview nếu đang không khớp.
- Lưu chỉ áp dụng nhóm cài đặt đang sửa.

#### SITE-02 — Chân trang

- Giới thiệu ngắn.
- Địa chỉ, email, điện thoại.
- Giờ làm việc.
- Liên kết mạng xã hội hiện có.
- Bản quyền.
- Field được nhóm theo mục sử dụng.
- Email/điện thoại/URL có loại input phù hợp.
- Không render một form quá rộng khiến các dòng khó đọc.

#### SITE-03 — Trang đăng nhập

- Quản lý ảnh nền theo dữ liệu hiện có.
- Preview ảnh cùng tỷ lệ sử dụng.
- Hiển thị rõ ảnh đang dùng và ảnh vừa chọn.
- Không tạo ảnh riêng cho màn hình khác nếu model chỉ có ảnh đăng nhập.
- Lưu lỗi giữ preview và file đã chọn khi còn trong phiên.

#### SITE-04 — Thanh toán

- Mã ngân hàng/BIN.
- Tên ngân hàng.
- Số tài khoản.
- Chủ tài khoản.
- Tiền tố nội dung hiện có.
- Nhóm thông tin giải thích đúng vai trò từng field.
- Số tài khoản là chuỗi, giữ số 0 đầu.
- Không biến phần chỉnh cấu hình thành thao tác thanh toán.
- Không thay tích hợp SePay.

#### SITE-05 — Trang chủ

- Tiêu đề/phụ đề.
- Banner desktop, tablet, mobile.
- Dịch vụ nổi bật.
- Bác sĩ nổi bật.
- Bài viết nổi bật.
- Preview từng banner đúng thiết bị.
- Danh sách chọn có search khi dữ liệu dài.
- Hiển thị số đang chọn.
- Giữ thứ tự và giới hạn hiện có.
- Không thay cấu trúc homepage công khai trong đợt này.

#### SITE-06 — Giới thiệu

- Tiêu đề, phụ đề.
- Sứ mệnh.
- Tầm nhìn.
- Tiêu đề/phụ đề giá trị cốt lõi.
- Ảnh nền.
- Lý do lựa chọn.
- Danh sách giá trị cốt lõi.

**Công việc:**

- Mỗi nhóm thành section có thể định vị.
- Item lặp dùng editor con gọn.
- Thao tác thêm/sửa/xóa item nhất quán.
- Preview văn bản dài có giới hạn hợp lý.
- Giữ icon và thứ tự hiện tại.

#### SITE-07 — FAQ

- Danh sách câu hỏi.
- Nút Thêm FAQ.
- Form câu hỏi/trả lời.
- Giữ sắp xếp hoặc thứ tự hiện có.
- Câu trả lời dài mở khi cần.
- Không đặt mọi textarea mở sẵn cùng lúc.
- Xóa nêu rõ câu hỏi liên quan.

#### SITE-08 — Theo dõi hệ thống

- Toolbar khoảng thời gian, bộ lọc và làm mới theo chức năng có.
- Tóm tắt trạng thái.
- Hiệu năng endpoint.
- Log gần đây.
- Retention/cleanup đặt trong phần nâng cao.

**Công việc:**

- Giữ thuật ngữ kỹ thuật cần thiết trong module này.
- Tách lỗi tải log khỏi lỗi hệ thống được log ghi nhận.
- Bảng log có thời gian, mức độ, nguồn, thông điệp và chi tiết.
- Payload dài không làm trang tràn.
- Làm mới không đổi vị trí cuộn đang đọc.
- Cleanup có phạm vi và xác nhận theo hành vi hiện hữu.
- Không chạy cleanup khi chỉ đổi bộ lọc.

**Nghiệm thu toàn nhóm:** Mỗi tab lưu đúng nhóm dữ liệu; chuyển tab có cảnh báo dirty; public content không thay ngoài thao tác đã lưu.

---

## 7. Kiến trúc triển khai và thay đổi interface

### 7.1. Điểm nối chính

Ba điểm cần chỉnh có kiểm soát:

- [Routing hiện tại](/Users/PHUC/Desktop/TGTM/src/appRouting.ts): giữ đường dẫn cũ, bổ sung trạng thái tab cần thiết.
- [Khung admin hiện tại](/Users/PHUC/Desktop/TGTM/components/AdminWorkspaceLayout.tsx): thay cách xác định module và điều hướng.
- [Bộ nhớ đệm dữ liệu admin](/Users/PHUC/Desktop/TGTM/src/admin/AdminDataProvider.ts): tái sử dụng cache, deduplicate và cơ chế invalidation.

Các component mới đặt dưới vùng `components/admin/`; token và helper dưới `src/admin/`. Không di chuyển hàng loạt file không liên quan chỉ để đồng nhất tên thư mục.

### 7.2. Định danh điều hướng

Bổ sung `AdminModuleId` có giá trị riêng cho:

```text
overview
orders
products
pancake
vat
knowledge
services
media
users
site
```

- `orders` là định danh điều hướng.
- Không bắt buộc đổi ngay `View.page` nghiệp vụ của Đơn hàng.
- Hàm resolve menu đọc đầy đủ `page`, `section`, `action`.
- `AdminWorkspaceLayout` nhận `currentView` thay vì một `currentPage` đã ép kiểu.
- Loại bỏ ánh xạ ngoại lệ Đơn hàng → Dashboard bằng `as any`.

### 7.3. Registry điều hướng

Mỗi mục khai báo:

- ID.
- Nhãn.
- Icon.
- Route mặc định.
- Các mục con.
- Vai trò hiện được phép.
- Hàm xác định active.

Registry là nguồn chung cho:

- Rail desktop.
- Menu desktop đầy đủ.
- Drawer mobile.
- Tab con.
- Tiêu đề trang.
- Kiểm thử route.

Không tạo riêng một danh sách menu trong từng module.

### 7.4. Metadata trang

- Metadata tĩnh như tiêu đề, module và tab lấy từ route ngay khi điều hướng.
- Action động và thông tin bản ghi được cập nhật khi dữ liệu sẵn sàng.
- Cập nhật async từ trang đã rời không được ghi đè header của trang mới.
- Context cấu hình và dispatch tiếp tục tách để hạn chế render.
- Metadata không chứa toàn bộ danh sách hoặc dữ liệu form.
- Không cập nhật layout context theo mỗi ký tự search.

### 7.5. Tách module lớn

Tách phần Nhà thuốc thành các vùng:

- Danh sách sản phẩm.
- Editor sản phẩm.
- Chuyên mục.
- Thương hiệu.
- Mã giảm giá.
- Thuế bán hàng.
- GHTK.
- Danh sách đơn.
- Chi tiết đơn.
- Tạo đơn.

Trình tự:

1. Tách phần render.
2. Giữ props và handler.
3. Chạy kiểm thử hành vi.
4. Tách state/helper theo miền.
5. Chuyển vùng nặng sang lazy loading.

Không đồng thời viết lại cả UI, dữ liệu và nghiệp vụ trong cùng một bước.

### 7.6. API/backend

**Không dự kiến thêm endpoint hoặc migration dữ liệu cho redesign.**

- Component UI gọi adapter hoặc callback hiện có.
- API response được chuyển sang model hiển thị tại lớp module.
- Quy tắc trạng thái vẫn kiểm tra bằng backend.
- Không thêm client-side business rule có thể mâu thuẫn backend.
- Nếu API có giới hạn dữ liệu, UI phản ánh giới hạn đó.
- Không tự bổ sung export hoặc server pagination mới ngoài khả năng hiện có.

### 7.7. Trạng thái danh sách

Dùng một helper chung để giữ:

- Search.
- Bộ lọc.
- Sort.
- Trang.
- Vị trí cuộn.
- Bản ghi đang mở khi phù hợp.

Quy tắc:

- Lưu trong bộ nhớ phiên ứng dụng, gắn với tài khoản/module.
- URL explicit như `preset` hoặc `inventory` được áp dụng khi điều hướng.
- Khi không có preset mới, trở lại từ chi tiết dùng trạng thái trước đó.
- Không lưu danh sách khách hàng hoặc dữ liệu đơn vào localStorage chỉ để tăng tốc.
- Logout hoặc đổi tài khoản xóa cache và trạng thái liên quan.

---

## 8. Kế hoạch render mượt và ổn định

### 8.1. Shell phải tồn tại liên tục

- Sidebar, header và vùng nền không remount khi chuyển tab.
- `Suspense` bao quanh nội dung module, không bao quanh toàn admin.
- Skeleton có cùng toolbar, khoảng cách và khung dữ liệu với trang đích.
- Tách trạng thái xác thực khỏi trạng thái tải dữ liệu module.
- Chưa xác minh quyền thì không hiển thị dữ liệu hoặc nút đặc quyền.
- Đã xác thực rồi thì chuyển module không quay về spinner toàn màn hình.

### 8.2. Tải mã theo nhu cầu

- Pancake chuyển từ import trực tiếp sang loader tương tự các module khác.
- Dừng preload mọi module ngay sau đăng nhập.
- Preload mã của module khi người dùng hover/focus hoặc chuẩn bị chọn mục đó.
- Không prefetch mutation.
- Excel, PDF, parser import và editor nặng tải khi mở tính năng tương ứng.
- Truy cập Đơn hàng không kéo theo toàn bộ VAT hoặc trình nhập ảnh.
- Giữ cơ chế retry chunk bị lỗi đã có trong loader.

### 8.3. Tải và làm mới dữ liệu

- Tận dụng cache 30 giây hiện có.
- Hiện cache trước, làm mới nền khi cần.
- Deduplicate request cùng khóa.
- Khóa cache gồm tài khoản và các tham số quyết định kết quả.
- Chỉ invalidate miền dữ liệu bị tác động sau mutation.
- Chi tiết đơn cập nhật thì danh sách đơn được làm mới; không reload blog, ảnh và nội dung site.
- Chặn phản hồi cũ ghi đè dữ liệu mới bằng request sequence hoặc AbortController tại lớp phù hợp.
- Khi lỗi làm mới, ghi rõ dữ liệu đang hiển thị được cập nhật lúc nào.

### 8.4. Giảm render không cần thiết

- State menu đặt gần menu.
- State selection đặt trong module danh sách.
- State field đặt trong editor/section phù hợp.
- Tách row component và memo hóa nơi có lợi.
- Callback và cấu hình cột ổn định.
- Không tạo component function mới bên trong render.
- Không dùng index hoặc giá trị ngẫu nhiên làm key.
- Tính Map lookup sản phẩm/khách một lần theo dataset.
- Chọn một hàng không render lại biểu đồ hoặc sidebar.

### 8.5. Bảng và danh sách

- Phân trang trước khi render.
- Không render hàng trăm row ẩn chỉ để dùng CSS đổi desktop/mobile.
- Chỉ mount một renderer dữ liệu theo breakpoint.
- Vùng switch desktop/mobile giữ state ở parent.
- Với thư viện ảnh, tối đa 60 thumbnail trong một lượt render.
- Các trang còn dữ liệu sử dụng phân trang hoặc nút tải thêm theo API hiện có.
- Không thêm thư viện virtualization cho bảng đã chỉ có 30 dòng.
- Preview/import lớn chia trang và cập nhật tiến trình theo lô.

### 8.6. Form và nội dung dài

- Input cập nhật đồng bộ.
- Preview Markdown xử lý từ giá trị trì hoãn.
- Không serialize toàn bộ form nặng nhiều lần trong cùng render.
- Giữ khoảng debounce draft hiện hữu; tối ưu vị trí serialize, không đổi nghĩa autosave.
- Response draft cũ không được ghi đè trạng thái bản nháp mới.
- Editor tab chưa mở không chạy preview tốn chi phí.
- Lazy editor không được làm mất draft khi tab bị unmount.

### 8.7. CSS, ảnh và cuộn

- Bỏ `AnimatedSection` khỏi hàng dữ liệu, toolbar và shell admin.
- Không dùng IntersectionObserver để quyết định khi nào được nhìn thấy thông tin vận hành.
- Ảnh có width/height hoặc aspect ratio.
- Ảnh dưới màn hình dùng lazy loading.
- Không lazy logo và icon quan trọng ở viewport đầu.
- Dùng `scrollbar-gutter` phù hợp để tránh dịch ngang khi xuất hiện scrollbar.
- Dialog có portal chung, không bị ancestor transform làm lệch.
- Sticky action bar không che field cuối.
- Nền gradient không chuyển động.
- Không dùng `transition-all` trên bảng và container lớn.

### 8.8. Tác vụ nhập/xuất

- Hiển thị trạng thái bận trước khi bắt đầu tính toán nặng.
- Chia xử lý phía client thành lô có nhường main thread.
- Thư viện chỉ tải ở thời điểm cần.
- Không gọi setState cho từng byte hoặc từng sự kiện tiến trình quá dày.
- Giới hạn cập nhật tiến trình tối đa khoảng 10 lần/giây.
- Giữ mức đồng thời nhập ảnh mặc định 3.
- Không thay tính nguyên tử của thao tác server chỉ để tạo cảm giác nhanh.

### 8.9. Chỉ tiêu nghiệm thu hiệu năng

Đo trên production build với fixture cố định, cùng trình duyệt và điều kiện trước/sau.

| Hạng mục | Mục tiêu |
|---|---|
| Gõ search | Ký tự xuất hiện ở frame kế tiếp; p95 phản hồi dưới 100 ms trong kịch bản test |
| Mở menu | Phản hồi bắt đầu dưới 100 ms |
| Drawer | Hoàn tất chuyển động trong 180 ms |
| Chuyển tab đã có mã và cache | Nội dung sử dụng được trong 300 ms, không tính request nền |
| Layout shift ngoài thao tác chủ động | CLS mục tiêu ≤ 0,05 trên các route chuẩn |
| Cập nhật một dòng | Không remount bảng và shell |
| Cuộn bảng | Không có chuỗi long task do render hàng hoặc animation |
| Thao tác search/lọc/chọn | Không có long task giao diện trên 200 ms trong trace chuẩn |
| Bundle | Không tăng entry chunk công khai vì component admin mới |
| Tải tính năng | Không tải Excel/PDF/VAT khi chỉ mở danh sách Đơn hàng |
| Quay lại danh sách | Khôi phục filter, trang và scroll mà không nháy dữ liệu mặc định |

Không dùng một điểm Lighthouse tổng hợp để thay thế việc kiểm tra các thao tác này.

---

## 9. Trình tự triển khai từng đợt

### Đợt 0 — Chốt mốc và bảo vệ công việc hiện tại

- [ ] Ghi nhận diff đang có.
- [ ] Xác định file mới/chưa commit cần giữ.
- [ ] Ghi lại route và các màn hình hiện hữu.
- [ ] Chụp baseline bằng dữ liệu test hoặc ảnh đã che thông tin cần thiết.
- [ ] Ghi nhận build/lint hiện tại và lỗi tồn tại trước.
- [ ] Đo baseline Đơn hàng, Sản phẩm và editor.
- [ ] Không reset/stash tự động để dọn workspace.

**Điều kiện hoàn thành:** Có mốc so sánh rõ và không thất lạc thay đổi đang làm.

### Đợt 1 — Token và component cơ sở

- [ ] Tạo theme admin độc lập.
- [ ] Tạo component nút, field, surface, badge và trạng thái.
- [ ] Chuẩn hóa callback của input.
- [ ] Tạo portal host.
- [ ] Tạo trang thử component chỉ ở môi trường phát triển.
- [ ] Kiểm tra sáng/tối, focus, disabled, loading, error.
- [ ] Xác minh website công khai không đổi kiểu dáng.

**Điều kiện hoàn thành:** Component đủ trạng thái và có kích thước thống nhất.

### Đợt 2 — Shell, menu và routing

- [ ] Tạo registry menu.
- [ ] Tách định danh Đơn hàng.
- [ ] Sửa active module và tiêu đề mobile.
- [ ] Thay sidebar hover bằng rail/menu chủ động.
- [ ] Tạo tab con dùng chung.
- [ ] Thêm query section Pancake/VAT.
- [ ] Giữ các URL cũ.
- [ ] Kiểm tra vai trò và focus drawer.

**Điều kiện hoàn thành:** Mọi route mở đúng module, không mất trang khi Back/Forward.

### Đợt 3 — Bộ danh sách và Đơn hàng

- [ ] Tạo toolbar/filter/table/mobile list/selection/pagination.
- [ ] Chuyển danh sách Đơn hàng.
- [ ] Chuyển chi tiết Đơn hàng.
- [ ] Đồng nhất lựa chọn trạng thái.
- [ ] Chuyển tạo đơn Online/POS.
- [ ] Kiểm tra bản in và Excel.
- [ ] Đo lại tương tác và bố cục.

**Điều kiện hoàn thành:** Đơn hàng trở thành mẫu triển khai dùng chung đã kiểm chứng.

### Đợt 4 — Sản phẩm và editor chung

- [ ] Tách phần render Sản phẩm khỏi file lớn.
- [ ] Chuyển danh sách.
- [ ] Tạo editor shell thống nhất.
- [ ] Chuyển editor sản phẩm.
- [ ] Chuyển chuyên mục.
- [ ] Chuyển thương hiệu.
- [ ] Chuyển mã giảm giá.
- [ ] Chuyển thuế bán hàng.
- [ ] Chuyển GHTK.

**Điều kiện hoàn thành:** Tạo/sửa và điều hướng không mất draft hoặc context.

### Đợt 5 — Dashboard và vận hành

- [ ] Chuyển Tổng quan.
- [ ] Sửa biểu đồ giá trị 0.
- [ ] Chuyển Khách hàng và chi tiết.
- [ ] Chuyển Lịch hẹn và chi tiết.
- [ ] Chuyển Báo cáo.
- [ ] Chuyển lịch gửi báo cáo.
- [ ] Xác minh lỗi từng vùng không làm toàn trang trắng.

### Đợt 6 — Kiến thức và Dịch vụ

- [ ] Chuyển các danh sách bài viết.
- [ ] Chuyển chuyên mục bài.
- [ ] Chuyển editor bài và bản dịch.
- [ ] Chuyển danh sách dịch vụ.
- [ ] Chuyển editor dịch vụ.
- [ ] Kiểm tra public rendering của nội dung đã lưu.

### Đợt 7 — Hình ảnh

- [ ] Chuyển thư viện.
- [ ] Chuyển chi tiết ảnh.
- [ ] Chuyển upload.
- [ ] Chuyển trình gắn ảnh hàng loạt.
- [ ] Kiểm tra file lỗi/trùng/chưa ghép.
- [ ] Đo bộ nhớ và tốc độ với tập ảnh lớn.

### Đợt 8 — Người dùng

- [ ] Chuyển danh sách bác sĩ.
- [ ] Chuyển editor bác sĩ.
- [ ] Chuyển tài khoản/phân quyền.
- [ ] Chuyển hồ sơ chi tiết.
- [ ] Kiểm tra dữ liệu theo tài khoản và quyền.
- [ ] Kiểm tra logout/đổi tài khoản xóa cache liên quan.

### Đợt 9 — Nội dung site

- [ ] Chuyển Thương hiệu.
- [ ] Chuyển Chân trang.
- [ ] Chuyển Trang đăng nhập.
- [ ] Chuyển Thanh toán.
- [ ] Chuyển Trang chủ.
- [ ] Chuyển Giới thiệu.
- [ ] Chuyển FAQ.
- [ ] Chuyển Theo dõi hệ thống.

### Đợt 10 — Pancake và VAT

- [ ] Chuyển năm tab Pancake.
- [ ] Kiểm tra enqueue/running/completed/failed.
- [ ] Chuyển Tổng quan VAT.
- [ ] Chuyển Bán ra/Mua vào và form.
- [ ] Chuyển nhập Excel.
- [ ] Chuyển Kỳ kê khai.
- [ ] Chuyển Điều chỉnh.
- [ ] Chuyển Quy tắc VAT.
- [ ] Chuyển Pháp nhân.
- [ ] Chuyển Đối soát D1.
- [ ] Kiểm tra quyền, số tiền và trạng thái khóa.

### Đợt 11 — Tối ưu và dọn phần cũ

- [ ] Gỡ preload toàn admin.
- [ ] Lazy-load tính năng nặng.
- [ ] Giảm phạm vi context update.
- [ ] Loại animation vận hành không cần thiết.
- [ ] Loại style trùng sau khi hết call site.
- [ ] Xóa wrapper cũ chỉ khi xác minh không còn sử dụng.
- [ ] Không xóa `AdminShell` hoặc component cũ chỉ dựa vào tên.
- [ ] Kiểm tra không còn page dùng bộ nút/field lệch chuẩn.

### Đợt 12 — Kiểm thử tổng và bàn giao

- [ ] Chạy build/lint và test liên quan.
- [ ] Chạy kiểm thử route toàn admin.
- [ ] Chạy kiểm thử nghiệp vụ trên staging.
- [ ] Kiểm tra responsive, dark mode và bàn phím.
- [ ] Đo lại hiệu năng.
- [ ] Đối chiếu ảnh trước/sau.
- [ ] Ghi rõ kết quả đạt, lỗi tồn tại và phần chưa đạt.
- [ ] Chuẩn bị bản triển khai có thể quay lại theo release.
- [ ] Cập nhật checklist ngay trong tài liệu Markdown.

---

## 10. Kế hoạch kiểm thử

### 10.1. Môi trường

- Kiểm thử mutation chạy trên local/staging với fixture riêng.
- Production chỉ dùng khảo sát và smoke chỉ đọc.
- Truyền `PLAYWRIGHT_BASE_URL` rõ ràng, vì cấu hình hiện tại mặc định dùng production.
- Các bài tạo/xóa lịch báo cáo phải được bổ sung guard môi trường và cờ cho phép mutation.
- Tài khoản test lấy từ biến môi trường, không ghi vào tài liệu.
- Không chạy script tạo người dùng hoặc thay dữ liệu production để phục vụ screenshot.

### 10.2. Viewport

| Nhóm | Kích thước |
|---|---|
| Mobile nhỏ | 390 × 844 |
| Mobile lớn | 430 × 932 |
| Tablet | 834 × 1194 |
| Desktop nhỏ | 1280 × 800 |
| Desktop chuẩn | 1440 × 1100 |
| Desktop rộng | 1680 × 1050 |

Mỗi module cần kiểm tra ít nhất:

- Desktop chuẩn.
- Mobile nhỏ.
- Sáng và tối.

Bảng tài chính, editor dài và drawer kiểm tra thêm tablet/desktop nhỏ.

### 10.3. Ma trận dữ liệu

- Không có bản ghi.
- Có một bản ghi.
- Đủ một trang.
- Có nhiều trang.
- Tên rất dài.
- Tiếng Việt có dấu.
- Email, mã và URL dài.
- Ảnh thiếu.
- Ảnh lỗi.
- Ngày không có.
- Giá trị 0.
- Giá trị tiền lớn.
- Trạng thái không còn được chỉnh.
- API chậm.
- API lỗi.
- Request cũ trả về sau request mới.
- Người dùng mất quyền hoặc hết phiên.

### 10.4. Kiểm thử component

- Button loading không đổi chiều rộng.
- Input gọi đúng callback một lần.
- Clear search xóa và đưa focus hợp lý.
- Field lỗi có `aria-describedby`.
- Checkbox có trạng thái mixed.
- Dialog trap focus và trả focus.
- Menu không bị cắt bởi bảng.
- Pagination xử lý trang cuối và dataset rỗng.
- Badge không truyền đạt nghĩa chỉ bằng màu.
- Theme admin bao phủ cả portal.

### 10.5. Kiểm thử điều hướng

- Mở trực tiếp mọi route trong ma trận.
- Reload giữ đúng tab.
- Back/Forward giữ đúng trang.
- Mở chi tiết rồi quay lại giữ bộ lọc/trang/scroll.
- Đơn hàng làm sáng đúng mục Đơn hàng.
- Gắn ảnh làm sáng Sản phẩm.
- Accountant vào đúng VAT.
- Vai trò không có quyền không nhìn thấy dữ liệu.
- Header không bị metadata của request cũ ghi đè.
- Đổi module liên tục không tạo vòng lặp render.

### 10.6. Kiểm thử nghiệp vụ bắt buộc

| Nhóm | Kịch bản |
|---|---|
| Đơn hàng | Lọc, chọn nhiều, cập nhật hợp lệ, cập nhật bị từ chối, mở chi tiết |
| Tạo đơn | Online/POS, field điều kiện, submit lặp, lỗi tồn kho/validation |
| Thanh toán | Nhãn và số tiền đúng, lỗi không báo thành công |
| Hoàn tiền | Lỗi/thành công, lịch sử và tổng liên quan khớp |
| Bản in | A4, 80 mm, tên dài, nhiều dòng, không in chrome |
| Sản phẩm | Search/sort/filter, tạo/sửa, ẩn/hiện, featured theo thao tác hiện có |
| Editor | Draft local/server, restore, dirty navigation, lỗi lưu |
| Danh mục | Chuyên mục/thương hiệu tạo/sửa/xóa và lỗi quan hệ |
| Giảm giá | Phần trăm/VND, hiệu lực, giới hạn sử dụng |
| Thuế bán hàng | Kết quả trước/sau giống fixture |
| Khách hàng | Chọn nhanh hai khách, giới hạn dataset, link đơn |
| Lịch hẹn | Bộ lọc, chi tiết, trạng thái, thời gian |
| Báo cáo | Kỳ hiển thị/xuất khớp, lịch gửi trên staging |
| Kiến thức | Tạo/sửa, bản dịch, ảnh bìa, hàng đợi |
| Dịch vụ | Giá rỗng, quy trình, FAQ và draft |
| Hình ảnh | Upload, copy URL, ảnh đang dùng bị chặn xóa |
| Gắn ảnh | Trùng, chưa ghép, file quá giới hạn, lỗi một phần |
| Người dùng | Role, quyền thao tác, dữ liệu hồ sơ |
| Nội dung site | Lưu riêng từng tab, dirty state, nội dung công khai |
| Pancake | Thiếu cấu hình, tác vụ chờ, lỗi và thử lại |
| VAT | Invoice totals, import, kỳ khóa, quyền duyệt, export |

### 10.7. Kiểm thử chống giật

Ghi trace ít nhất các chuỗi sau:

1. Đơn hàng → Sản phẩm → Kiến thức → Đơn hàng.
2. Gõ liên tục trong search sản phẩm.
3. Đổi liên tiếp ba bộ lọc.
4. Chọn/bỏ chọn một hàng và cả trang.
5. Mở/đóng menu nhiều lần.
6. Mở chi tiết rồi Back.
7. Scroll danh sách có ảnh.
8. Gõ nội dung dài trong editor và xem preview.
9. Làm mới dữ liệu khi đang đọc.
10. Phân tích tập ảnh lớn.

**Quan sát bắt buộc:**

- Không trắng toàn trang.
- Không nhảy rail/header.
- Không hiện dữ liệu cũ dưới tiêu đề mới.
- Không mất focus input.
- Không đổi scroll vì ảnh vừa tải.
- Không có spinner kéo dài do state bị kẹt.
- Không có request trùng tăng theo số lần render.

### 10.8. Lệnh kiểm tra hiện có cần tái sử dụng

Sau khi kiểm tra môi trường và phạm vi:

- `npm run lint`
- `npm run build`
- `npm run qa:admin-d1`
- `npm run qa:vat`
- `npm run qa:pancake`
- `npm run qa:d1-bundle`
- `npm run qa:admin-navigation:e2e`
- `npm run qa:admin-business:e2e`
- `npm run qa:admin-ui`

Bổ sung kiểm thử giao diện thống nhất và hiệu năng thao tác. Không xóa assertion chỉ để test xanh; thay assertion cũ bằng kiểm tra hành vi tương ứng.

---

## 11. Quy tắc nghiệm thu từng hạng mục

Một màn hình chỉ được đánh dấu hoàn thành khi đủ các điểm sau:

- [ ] Dùng khung admin mới.
- [ ] Đúng menu và tiêu đề.
- [ ] Dùng token màu/font/spacing chung.
- [ ] Dùng toolbar, field, button và trạng thái chung.
- [ ] Có desktop và mobile phù hợp.
- [ ] Có loading, refreshing, empty và error.
- [ ] Không mất chức năng hiện hữu.
- [ ] Không thay số tiền hoặc quy tắc nghiệp vụ.
- [ ] Không làm rộng quyền.
- [ ] Có kiểm thử thao tác chính.
- [ ] Có đối chiếu hình ảnh với mẫu.
- [ ] Không phát sinh console error liên quan.
- [ ] Không có overflow toàn trang.
- [ ] Không giật do remount hoặc animation.
- [ ] Không làm thay đổi giao diện website công khai.
- [ ] Có ghi nhận kết quả kiểm tra trong tài liệu.

Không đánh dấu xong chỉ vì đã thay màu và bo góc.

---

## 12. Tiêu chí hoàn thành toàn dự án

Toàn bộ đợt đồng bộ hoàn thành khi:

1. Mười module dùng chung một khung điều hướng.
2. Đơn hàng là mục chính và hiển thị đúng trên desktop/mobile.
3. Mọi tab, form và chi tiết trong danh mục ở phần 6 đã được xử lý.
4. Không còn các bộ field, nút và bề mặt tự phát giữa các trang.
5. Theme website không làm đổi màu/font admin.
6. Portal, dialog và menu giữ cùng theme.
7. Không mất draft, filter hoặc vị trí làm việc khi điều hướng đúng luồng.
8. Tải và làm mới dữ liệu không gây trắng trang hoặc nhảy bố cục.
9. Các chỉ tiêu render đã được đo và ghi kết quả.
10. Đơn hàng, giá, tồn kho, VAT, thanh toán và phân quyền giữ hành vi đúng.
11. Các bài kiểm thử có mutation được giới hạn đúng môi trường.
12. Có bằng chứng kiểm tra từng module và danh sách tồn đọng rõ ràng.
13. Nội dung kế hoạch cùng checklist được lưu trong một file `ADMIN_UI_UX_UNIFICATION_PLAN.md`.
14. Bản bàn giao nêu rõ thay đổi, kết quả test, chỉ số hiệu năng và cách quay lại release trước nếu cần.

**Đầu ra của bước kế tiếp khi chuyển sang chế độ thực thi:** ghi toàn bộ tài liệu này vào file Markdown đã chỉ định; việc triển khai giao diện được thực hiện theo từng đợt trong tài liệu.
