# Hướng Dẫn Đăng Nhập Supabase Bằng AI Agent (Supabase CLI)

Tài liệu này tổng hợp chi tiết các bước để một AI Agent (hoặc một tiến trình tự động/bất kỳ ai dùng terminal) có thể đăng nhập và liên kết với dự án Supabase này mà không cần mở trình duyệt UI bằng lệnh `supabase login` thông thường.

## Thông tin Dự Án
- **Project Ref (ID)**: `vwzgibsdtednpitbrdeb`

## Các Bước Thực Hiện

### Bước 1: Chuẩn bị Personal Access Token
Agent không thể mở và tương tác với trình duyệt để thao tác trên giao diện web của Supabase. Do đó, cần cung cấp một Personal Access Token.
1. Truy cập vào tài khoản Supabase trên trình duyệt của người dùng: [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens).
2. Nhấn nút **Generate new token**.
3. Đặt một cái tên bất kỳ (ví dụ: `agent-cli-token`).
4. Sao chép đoạn mã (token) được tạo ra (thường bắt đầu bằng `sbp_...`).

### Bước 2: Đăng Nhập Supabase CLI
Nhờ người dùng cung cấp token ở Bước 1. Sau khi nhận được token, Agent chạy lệnh sau ở môi trường Terminal (trong thư mục gốc của project):

```bash
npx supabase login --token <MÃ_TOKEN_CỦA_BẠN>
```
*Ví dụ:* `npx supabase login --token sbp_abc123...`

Nếu thành công, terminal sẽ trả về câu thông báo: `You are now logged in. Happy coding!`

### Bước 3: Liên Kết (Link) CLI Với Dự Án
Chạy lệnh sau để liên kết (link) CLI hiện tại với project Supabase cụ thể của cơ sở dữ liệu này:

```bash
npx supabase link --project-ref vwzgibsdtednpitbrdeb
```
Quá trình này sẽ lưu thông tin liên kết vào cấu hình nội bộ.

### Bước 4: Kiểm Tra Truy Cập (Tùy chọn)
Để đảm bảo CLI đã có quyền hợp lệ và có thể tương tác với Database thực tế, Agent có thể chạy lệnh để kéo schema (cấu trúc bảng dữ liệu) mới nhất từ remote về:

```bash
npx supabase db pull
```
Thao tác này sẽ cập nhật các tệp trong thư mục `supabase/migrations/` và thể hiện rằng Agent đã kết nối thành công.

---
**Lưu ý:**
- Vì lý do bảo mật, Personal Access Token không nên được lưu lại trong mã nguồn công khai (ví dụ: commits, github repo mở).
- Tùy vào thời điểm đăng nhập lại, nếu token cũ đã bị thu hồi (revoke), bạn chỉ cần làm lại Bước 1 để tạo token mới và cung cấp cho Agent là được.
