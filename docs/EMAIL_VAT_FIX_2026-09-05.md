# VAT trong email cập nhật đơn hàng — 2026-09-05

## Nguyên nhân đã xác minh

SMTP chỉ gửi nội dung đã lưu trong `notification_outbox`, không tính lại VAT.
Đơn `TG20260905-EDCB8E50` có email tạo đơn: tạm tính 979.000đ,
VAT 97.900đ, vận chuyển 30.000đ, tổng 1.106.900đ.
Snapshot Pancake trả `tax: 0`. Inbound cũ ghi đè VAT cấp đơn thành 0 và
tổng thành 1.009.000đ, dù tổng VAT ở các dòng hàng vẫn là 97.900đ.
Email `order.shipped` sau đó sử dụng số tiền đã bị ghi đè trong D1.

Luồng email GHTK còn có bộ dựng payload riêng, bỏ mất VAT từng dòng hàng.

## Phạm vi sửa

- Đơn có `tax_profile_id` là đơn được Worker chốt VAT: echo trạng thái/thanh toán
  không được thay thế snapshot tiền bằng `tax` bằng 0 hoặc thiếu từ Pancake.
- Không tính lại lịch sử bằng cấu hình thuế hoặc giá sản phẩm hiện tại.
- Nếu thực sự sửa giá, số lượng hoặc giảm giá tại Pancake, dùng bộ tính VAT chung
  với thuế suất từng dòng và chế độ giá đã lưu. Dòng mới phải có sản phẩm được
  ánh xạ và thuế suất trong D1; thiếu phân loại hoặc tổng dòng không khớp thì
  tác vụ inbound thất bại để đối soát, không ghi số thuế 0 mặc định vào đơn.
- Phí thu khách đã chốt trên đơn website không bị đổi thành cước hãng.
- Đơn gốc nhập từ Pancake không có hồ sơ VAT nội bộ tiếp tục dùng VAT nguồn;
  không tự áp 10% cho đơn không thu VAT.
- Email GHTK dùng cùng `buildOrderEmailPayload` với checkout, quản trị và SePay.
  Email thanh toán POS dùng snapshot thuế của các dòng được ghi vào D1.
- Giữ idempotency/outbox; không phát lại email đặt đơn khi đồng bộ và không gửi bù.
- Không migration hoặc đổi cấu hình thuế, SMTP, hãng vận chuyển.

## Kiểm chứng

- 12 test mới trong `tests/email-vat-snapshot.test.mjs`: SQLite thực với toàn bộ
  migration D1, VAT 0/5/8/10%, gồm/chưa gồm thuế, thuế vận chuyển, echo/retry,
  email trạng thái/hoàn tiền/SePay/POS/GHTK và chỉnh sửa giá/số lượng.
- Tái hiện ca 979.000đ trên mã trước sửa: thất bại vì VAT thực tế bằng 0.
  Cùng test trên bản sửa: VAT 97.900đ, tổng 1.106.900đ, email shipped khớp.
- 95/95 test thuộc 10 bộ liên quan đạt; Deplao/Telegram 11/11 đạt khi cho phép
  máy chủ kiểm thử mở cổng localhost.
- Build, lint, D1 frontend/Worker bundle audit, `git diff --check` đạt.
- Bộ admin contract còn một lỗi đã có trước bản sửa: kiểm tra source cũ yêu cầu
  lazy import `AdminOrderCreatePage` trong `AdminPharmacyManagementPage`.
- Không tạo đơn, đổi trạng thái, gọi hãng hoặc gửi email khách thật để thử nghiệm.

## Backup và đối soát đơn đã bị ảnh hưởng

Backup riêng: `/Users/PHUC/Desktop/TGTM-backups/email-vat-fix.xjIx1G`.
`worker-tests-before.tar.gz` chứa Worker/tests trước sửa; APP D1 export đã phục hồi
thử trong SQLite: 61 đơn, integrity `ok`, không lỗi khóa ngoại.

SHA-256 của APP export:
`96864759bfea94f3fa337a341b1309d02f1095198ee6c6b81fc50d7a54e3f04b`.

Đơn đã bị lệch tiền chưa được sửa dữ liệu hồi tố. Tại thời điểm chẩn đoán đơn đang
giao và COD nguồn là 1.009.000đ. Lần đọc sau deploy cho thấy đơn đã chuyển thành
`cancelled`; tác vụ này không thực hiện thay đổi trạng thái đó. Dữ liệu lịch sử vẫn
là VAT 0đ, tổng 1.009.000đ; cần chủ shop xác nhận trước khi sửa số tiền lịch sử.
Không sửa nội dung email đã gửi, không tự gửi email đính chính.

## Triển khai

- Phiên bản rollback production trước bản sửa: `f2bb3a8b-8af6-4027-876f-060aee558e1d`.
- Staging: `9af43b7a-60bf-45a0-95a5-021fdae34f24`.
- Production: `e73c8879-c8f2-44b1-aeb9-24f07bfbc6db`, giữ nguyên biến cấu hình,
  không migration hoặc hồi tố dữ liệu.
- Staging homepage/policy/quote HTTP 200; quote tạm tính 979.000đ có VAT 97.900đ,
  phí 30.000đ, tổng 1.106.900đ.
- Production homepage/policy/quote HTTP 200 với cùng kết quả tiền; D1 vẫn có
  61 đơn, không có email đơn khách hàng ở trạng thái pending/queued/retrying/sending
  tại lần đọc cuối. Luồng email đầy đủ đã được kiểm thử bằng fixture cục bộ,
  không nghiệm thu SMTP qua địa chỉ khách thật.
