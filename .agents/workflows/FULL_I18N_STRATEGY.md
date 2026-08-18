# CHIẾN LƯỢC CHUYỂN ĐỔI 100% ĐA NGÔN NGỮ KẾT HỢP SUPABASE
**Mục tiêu:** Đảm bảo toàn bộ Website iSkin Clinic hiển thị chính xác 4 ngôn ngữ (Tiếng Việt, Anh, Nga, Trung) ở mọi ngóc ngách, không để lọt bất kỳ chữ nào chưa dịch. Đồng thời quy chuẩn hoá cách lưu trữ nội dung động (Dynamic Content) trên Supabase.

---

## PHẦN 1: QUAN ĐIỂM KIẾN TRÚC
Một website chia làm 2 loại chữ cần dịch:
1. **Static Text (Chữ tĩnh cố định ở Frontend):** Menu, nút bấm, nhãn input, thông báo lỗi hệ thống, tiêu đề cột trong bảng. (Lưu ở file `JSON`).
2. **Dynamic Content (Nội dung động trên Backend Supabase):** Tên dịch vụ, mô tả sản phẩm, nội dung bài viết blog, thông tin bác sĩ. (Lưu ở Database Server).

*Quy tắc tối thượng:* Tuyệt đối không hardcode (gõ chết) Tiếng Việt vào file `.tsx`. Bất kỳ chuỗi (string) nào hiển thị cho người dùng cũng phải bọc qua hàm dịch.

---

## PHẦN 2: XỬ LÝ STATIC TEXT (MÃ NGUỒN FRONTEND)

### 1. Tổ chức thư mục & Thư viện
- Cốt lõi sử dụng `react-i18next` và `i18next-browser-languagedetector`.
- Tổ chức các file dịch thuật thành các thư mục ngôn ngữ rõ ràng:
  - `src/locales/vi/translation.json`
  - `src/locales/en/translation.json`
  - `src/locales/ru/translation.json`
  - `src/locales/cn/translation.json`

### 2. Các điểm mù thường bị bỏ sót cần rà soát kỹ 100%:
- **Toast/Alert Messages (Thông báo):** Các thông báo pop-up như "Thêm dịch vụ thành công", "Vui lòng nhập mật khẩu",... cần được đưa vào `translation.json` (VD: `t('messages.service_added')`).
- **Placeholder trong Form:** Các gợi ý mờ mờ trong ô nhập liệu `<input placeholder={t('admin.enter_name')} />`.
- **Thẻ Meta & Title (SEO):** Tiêu đề trang (`<title>`) cần thay đổi theo ngôn ngữ để tối ưu hóa tìm kiếm (SEO) cho người nước ngoài.
- **Trạng thái (Status):** Các trạng thái như "Đang xử lý", "Hoàn thành", "Hết hàng" (Đã được xử lý ở bước trước cho phần Pharmacy).

> **Hành động kỹ thuật:** Sử dụng lệnh Regex cực mạnh trong VSCode để tìm tất cả các chữ Tiếng Việt còn sót lại trong file `.tsx` hoặc `.jsx` và bọc vào `{t('...')}`.

---

## PHẦN 3: XỬ LÝ DYNAMIC CONTENT (DATABASE SUPABASE)

Đây là nơi phức tạp nhất vì bản thân dữ liệu trong Database thay đổi liên tục khi Admin thêm bài viết/sản phẩm mới.

### Phương Pháp Tối Ưu: "Cột Dữ Liệu JSONB" (JSONB Columns Translation)
Thay vì tạo bảng mới làm loạn Database, chúng ta sẽ áp dụng cột `JSONB` của PostgreSQL (được Supabase hỗ trợ cực tốt) cho những trường dữ liệu cần dịch.

**1. Ví dụ trên bảng `services` (Dịch vụ):**
Hiện tại:
- `id` (uuid)
- `service_name` (text) -> VD: "Trị mụn chuyên sâu"
- `description` (text) -> VD: "Trị mụn tầng sâu, không sưng"

**Cải tạo thành (Migration):**
- Thêm cột `service_name_i18n` (kiểu jsonb)
- Thêm cột `description_i18n` (kiểu jsonb)
- Dữ liệu bên trong sẽ trông như thế này:
  ```json
  {
      "vi": "Trị mụn chuyên sâu",
      "en": "Intensive Acne Treatment",
      "ru": "Интенсивное лечение акне",
      "cn": "强效痤疮治疗"
  }
  ```

**2. Chỉnh sửa logic ở Frontend khi lấy dữ liệu:**
Lúc component tải dữ liệu từ Supabase, sẽ gọi ngôn ngữ hiện tại (`i18n.language`) để lấy ra Text thích hợp:

```tsx
import { useTranslation } from 'react-i18next';

export const ServiceCard = ({ service }) => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language || 'vi'; // Lấy biến ngôn ngữ (vi, en, ru, cn)
    
    // Nếu có dữ liệu chữ của ngôn ngữ đó thì dùng, không thì lấy Tiếng Việt làm mặc định
    const title = service.service_name_i18n?.[currentLang] || service.service_name;
    const desc = service.description_i18n?.[currentLang] || service.description;

    return (
        <div>
            <h3>{title}</h3>
            <p>{desc}</p>
        </div>
    );
};
```

**3. Danh sách các bảng (Tables) cần chạy Script thêm cột JSONB:**
- `services` (Tên, Mô tả ngắn, Lợi ích, ...)
- `products` (Tên, Mô tả, Hướng dẫn sử dụng)
- `categories` / `blog_categories` (Tên chuyên mục)
- `blog_posts` (Tiêu đề, Nội dung bài viết)
- `site_settings` (Giới thiệu, Liên hệ, FAQ...)

---

## PHẦN 4: KẾ HOẠCH HÀNH ĐỘNG (ACTION PLAN - EXECUTION)

Để đảm bảo việc chuyển đổi 100% không để lại tì vết, ta tiến hành theo 5 Phase:

### Phase 1: Nâng cấp Database Supabase (Migration)
- Kết nối vào Supabase SQL Editor.
- Viết câu lệnh `ALTER TABLE` thêm các cột `_i18n` (chuẩn `JSONB` với default giá trị là chuỗi Tiếng Việt hiện tại được wrap vào mảng json) cho các bảng dịch vụ, sản phẩm, bài viết.

### Phase 2: Dịch thuật tự động bằng Script Node.js (Migration Data)
- Do khối lượng dữ liệu trong Database rất lớn (ví dụ: vài trăm sản phẩm, chục bài viết có cả thẻ HTML), thay vì tự dịch tay trên trang quản trị, mình sẽ viết 1 file **Script tự động gọi Google Translate API / AI API** tại local.
- Script sẽ lướt qua toàn bộ Database, lấy ruột Tiếng Việt, dùng AI dịch sang Anh, Nga, Trung, và `UPDATE` lại vào cột `_i18n` vừa tạo dưới dạng JSON.

### Phase 3: Nâng cấp trang Admin (UI Nhập Liệu)
- Ở giao diện quản trị Admin (khi ấn nút Sửa hoặc Thêm Dịch Vụ, Sản Phẩm...), thêm các tab hoặc input phụ để người quản trị có thể chủ động sửa bản dịch tay cho 3 ngôn ngữ còn lại thay vì chỉ nhập Tiếng Việt.

### Phase 4: Quét Frontend tĩnh lần cuối
- Rà soát file `translation.json` và code `tsx` chạy lệnh search từ việt để bắt sạch các chuỗi Notification / Validation (như "Email không hợp lệ").

### Phase 5: Testing (Nghiệm thu)
- Khởi động chế độ duyệt web bằng 4 ngôn ngữ và click lướt qua từng trang Frontend, Trang tĩnh, và Trang Admin. Bật F12 kiểm tra không còn Fetch Text từ Supabase mà thiếu phiên bản dịch thuật.

---

**Kết luận:** Tài liệu này làm kim chỉ nam để không bỏ sót một ngóc ngách nào từ code giao diện cho đến sâu bên trong cơ sở dữ liệu Supabase, đảm bảo một hệ sinh thái Web chuẩn quốc tế.
