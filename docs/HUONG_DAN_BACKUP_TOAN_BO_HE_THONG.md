# Hướng dẫn sao lưu toàn bộ hệ thống Thế Giới Trị Mụn

Ngày cập nhật: **08/09/2026**. Dành cho chủ hệ thống và người kỹ thuật phụ trách.

> Đây là tài liệu hướng dẫn, không phải thông báo đã tạo một bộ backup mới. Các bước có lệnh bên dưới phải được thực hiện, đối chiếu và thử phục hồi trước khi đánh dấu hoàn tất.

## 1. “Toàn bộ” gồm những gì?

Một file nén mã nguồn **không đủ** để khôi phục hệ thống. Bộ backup cần bao phủ:

| Nhóm | Nội dung phải giữ | Cách kiểm chứng |
| --- | --- | --- |
| Website | Toàn thư mục TGTM: `.git`, file ẩn, file chưa commit, file bị Git ignore, `.env*`, `.dev.vars*`, chứng thư/khóa, dependency, build, tài liệu, công cụ, SQLite local, output | Giải mã/giải nén thử, danh sách file và checksum |
| Git | Nhánh, tag, lịch sử, trạng thái thay đổi và file chưa theo dõi | Git bundle verify; archive giữ cả working tree |
| APP D1 production | Schema, dữ liệu nghiệp vụ, người dùng/quyền, cấu hình, đơn hàng, VAT, outbox, audit, migration ledger | Phục hồi thử; so sánh mọi bảng |
| INCI | **Cả hai shard đang được binding sử dụng**, schema và dữ liệu | So sánh từng shard; không cộng hai bản sao thành số nguyên liệu duy nhất |
| Staging/DB cũ | APP staging, INCI staging, DB dự phòng và runtime cũ còn giữ | Inventory có tên, ID, vai trò và kết quả export |
| R2 | Ảnh, tài liệu riêng tư, nhãn vận đơn PDF, dữ liệu staging, bucket backup nếu còn tồn tại | Đủ object và metadata; checksum nội dung |
| Cloudflare | Worker đang chạy, artifact, binding, vars, routes, cron, Queue/DLQ, DNS, cấu hình miền và bảo mật | Đối chiếu dashboard/API với file cấu hình |
| Bí mật | Token, SMTP, OAuth, webhook secret, khóa ký/mã hóa, quyền quản trị và phương án khôi phục tài khoản | Có bản mã hóa giải mã được; biết nơi giữ khóa |
| Deplao/Zalo | Source, bản cài ứng dụng, cơ sở dữ liệu local, cấu hình, phiên đăng nhập, thư mục dữ liệu và media ngoài source | Thử mở bản sao trên môi trường cô lập |
| Tích hợp bên ngoài | Pancake, SePay, email, Telegram, Zalo và Supabase lịch sử nếu còn | Export/cấu hình theo khả năng nhà cung cấp; ghi phần không xuất được |

Không thể dùng backup website để thu hồi tin Zalo/Telegram/email đã gửi, đảo giao dịch ngân hàng, hay đưa vận đơn phía hãng về quá khứ. Lưu dữ liệu đối soát của những hệ thống này riêng.

## 2. Cảnh báo quan trọng của dự án này

### 2.1. D1 production đã đổi sau lần phục hồi

Thông tin đọc từ `wrangler.d1.production.jsonc` ngày 08/09/2026:

| Binding | Tên D1 | Database ID |
| --- | --- | --- |
| APP_DB | `thegioitrimun-app-restored-20260906` | `9760bb57-e3be-4bf0-9eec-55773df169ac` |
| INCI_DB_0 | `thegioitrimun-inci-shard-00` | `a104fdb0-a0c9-47b2-820e-95e10feda713` |
| INCI_DB_1 | `thegioitrimun-inci-shard-01` | `731f0de9-65fe-44ec-9a87-2b0eb64697d0` |

`thegioitrimun-app` / `bffac3a5-7aa2-46dc-a8c2-179d049900c5` hiện là DB giữ lại trước phục hồi, **không phải APP_DB đang chạy**. Mỗi lần backup phải xác minh lại binding thực tế; bảng trên không phải cấu hình vĩnh viễn.

### 2.2. Không coi script cũ là backup toàn bộ

- `npm run backup:safe` gọi `scripts/create_full_system_backup.sh`: loại trừ file bí mật, dependency, build và một số dữ liệu local; không tự export toàn bộ D1 hoặc tải toàn bộ R2. Bản dump Supabase còn phụ thuộc lựa chọn/quyền truy cập.
- `scripts/d1_backup_to_r2.mjs` có mặc định tên APP cũ và một INCI runtime cũ. Không chạy rồi kết luận đã có APP production cùng hai INCI shard.
- `git bundle` không chứa thay đổi chưa commit hoặc file ngoài Git. Luôn đi cùng archive thư mục.
- D1 Time Travel và lịch sử Worker là lớp bảo vệ bổ sung, không thay cho bản sao độc lập ngoài tài khoản Cloudflare.

## 3. Chuẩn bị trước khi chạy

1. Chọn người chịu trách nhiệm và lịch bảo trì. Dự trù dung lượng cho source, R2, SQL, bản giải nén thử và các bản lưu khác. Backup không tự thay gói Cloudflare; đọc/xuất dữ liệu có thể tiêu tốn hạn mức và phát sinh phí theo dịch vụ.
2. Dùng ổ đĩa mã hóa. Thư mục backup phải nằm **ngoài** TGTM và Deplao, không nằm trong public R2 hoặc thư mục đồng bộ công khai.
3. Kiểm tra có Node, Git, tar, SQLite, Wrangler của dự án; cài `age` và `rclone` từ nguồn chính thức nếu thiếu. Không tự nâng phiên bản công cụ giữa một lần phục hồi quan trọng.
4. Có quyền đọc D1/R2 và cấu hình cần thiết; khóa dùng riêng cho backup nên giới hạn quyền. Không chép token vào tài liệu này, lịch sử shell, ảnh chụp hoặc cuộc trò chuyện.
5. Ghi phiên bản Node/Wrangler, macOS, dependency lockfile và phiên bản Deplao. Kiểm tra liên kết tượng trưng: archive giữ liên kết nhưng dữ liệu đích ở ngoài thư mục phải được sao lưu riêng.

Mở **Bash** rồi chạy các khối lệnh theo thứ tự trong cùng cửa sổ. Dừng ngay khi có lỗi; không dùng `|| true` để che lỗi backup.

```bash
bash
set -euo pipefail
umask 077
cd /Users/PHUC/Desktop/TGTM
BACKUP_DIR="$(mktemp -d /Users/PHUC/Desktop/TGTM-backups/full-system-XXXXXXXX)"
mkdir -p "$BACKUP_DIR"/{source,d1,r2,config,external,metadata,logs,verify}
node --version > "$BACKUP_DIR/metadata/node-version.txt"
node node_modules/wrangler/bin/wrangler.js --version > "$BACKUP_DIR/metadata/wrangler-version.txt"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$BACKUP_DIR/metadata/started-utc.txt"
node --env-file=.env node_modules/wrangler/bin/wrangler.js whoami
```

Không `source .env`: file môi trường không cần được thực thi như mã shell. Lệnh trên dùng Node đọc `.env`; nếu xác thực không thành công, dừng và xử lý quyền trước.

## 4. Chốt một mốc dữ liệu nhất quán

Các DB, R2, máy Deplao và Pancake không có một nút snapshot nguyên tử chung.

**Backup đầy đủ có mốc nhất quán:** sao chép R2 lượt đầu trước; sau đó bố trí khoảng bảo trì để dừng mọi bên ghi dữ liệu, export DB và sao chép phần thay đổi R2 lượt cuối.

- Ngừng nhận thao tác tạo/sửa đơn, thanh toán thủ công và upload; không chỉ ẩn nút trên giao diện.
- Xác định mọi Worker/cron/Queue consumer/thiết bị Deplao hoặc script có thể ghi D1/R2; tạm dừng có kiểm soát và lưu trạng thái cũ để bật lại.
- Đóng hoàn toàn Deplao, kể cả ứng dụng chạy dưới khay hệ thống; chờ DB local đóng.
- Không trả HTTP thành công cho webhook bị bỏ qua. Đảm bảo nhà cung cấp sẽ retry hoặc có cơ chế lưu nhận bền vững/đối soát sau bảo trì. Không mặc định mọi nhà cung cấp đều retry.
- Không xóa hoặc purge Queue/DLQ. Ghi lại tác vụ còn tồn, lease, receipt và khóa chống trùng; nếu không thể chốt chúng, ghi rõ backup là nhiều thời điểm.
- Ghi thời điểm bắt đầu/kết thúc từng export. Export D1 có thể chặn truy vấn của DB trong thời gian chạy, theo [tài liệu Cloudflare D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

Không có lệnh bảo trì một dòng đã được bảo đảm cho mọi hệ thống trong tài liệu này. Người kỹ thuật phải xác minh đầy đủ các đường ghi trước khi thao tác. Nếu cần giữ website hoạt động, ghi rõ đây là backup online với cửa sổ thời gian và quy trình đối soát, không gọi là snapshot toàn hệ thống cùng một giây.

## 5. Sao lưu toàn thư mục website và Deplao

Để đúng yêu cầu “tất tần tật”, các lệnh sau **không loại trừ** `.git`, `.env`, `node_modules`, `dist`, file ẩn hoặc file chưa commit. Vì chứa bí mật, mã hóa trực tiếp qua đường ống, không tạo archive source rõ trên ổ đĩa.

`age -p` yêu cầu mật khẩu qua Terminal. Lưu mật khẩu trong trình quản lý mật khẩu và một phương án khôi phục độc lập; không lưu cạnh file backup. Dùng mật khẩu mạnh, riêng cho backup. [Hướng dẫn age](https://github.com/FiloSottile/age).

```bash
tar -czf - -C /Users/PHUC/Desktop TGTM \
  | age -p -o "$BACKUP_DIR/source/TGTM-full.tar.gz.age"

tar -czf - -C /Users/PHUC/Downloads deplao-builder-main \
  | age -p -o "$BACKUP_DIR/source/deplao-source-full.tar.gz.age"

git bundle create "$BACKUP_DIR/source/TGTM.bundle" --all
git bundle verify "$BACKUP_DIR/source/TGTM.bundle"
git status --porcelain=v1 > "$BACKUP_DIR/metadata/git-status.txt"
git rev-parse HEAD > "$BACKUP_DIR/metadata/git-head.txt"
git ls-files --others --exclude-standard > "$BACKUP_DIR/metadata/git-untracked.txt"
```

Chạy Git bundle tương tự cho Deplao **nếu** thư mục đó là Git repository. Bundle và metadata cũng có thể nhạy cảm; chúng sẽ nằm trong gói mã hóa cuối.

Nếu source chứa các backup cũ, chúng cũng được đưa vào archive và làm file rất lớn. Chỉ loại chúng khi đã sao lưu riêng và ghi rõ trong manifest. Không tự bỏ qua vì thấy dung lượng lớn. Không chỉnh sửa source trong lúc đang nén; nếu tar báo file thay đổi, làm lại sau khi dừng bên ghi.

### Dữ liệu ứng dụng Deplao ngoài source

Source không đồng nghĩa với dữ liệu Zalo đang dùng. Trong ứng dụng, xem vị trí dữ liệu thực tế; mã hiện tại sử dụng `app.getPath('userData')`, có thể đổi DB qua `deplao-config.json` → `dbFolder`.

Sau khi thoát ứng dụng, sao lưu riêng, mã hóa và ghi đường dẫn phục hồi cho:

- Toàn bộ thư mục userData thực tế và thư mục DB tùy chỉnh nếu có.
- File SQLite cùng `-wal`/`-shm` còn tồn tại, file cấu hình, session/cookie/token và media/cache nếu cần toàn bộ lịch sử local.
- Thư mục media tải về ở ngoài userData, bản cài `.app`/`.dmg`/installer đúng phiên bản và cấu hình kết nối TGTM.
- Nếu bản nhân viên kết nối một máy chủ dữ liệu khác, backup máy chủ đó; không nhầm cache của máy nhân viên với nguồn chính.

Không đoán tên thư mục trong `Library/Application Support` rồi chỉ nén một thư mục. Xác minh đường dẫn trong ứng dụng trước. Dữ liệu dùng Electron `safeStorage` có thể phụ thuộc Keychain/máy/tài khoản macOS: sao chép file chưa chắc phục hồi được đăng nhập trên máy khác. Chuẩn bị phương án đăng nhập lại chính chủ và phục hồi máy; không xuất toàn bộ Keychain vào một file rõ.

## 6. Sao lưu D1: production, staging và DB còn giữ

Lấy inventory mới và đối chiếu cả live Worker bindings trong Cloudflare Dashboard. File cấu hình local có thể khác production nếu lần deploy trước giữ lại biến hoặc dùng cấu hình khác.

```bash
node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 list --json \
  > "$BACKUP_DIR/metadata/d1-inventory.json"

node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 export APP_DB \
  --remote --config wrangler.d1.production.jsonc --output "$BACKUP_DIR/d1/app-production.sql"
node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 export INCI_DB_0 \
  --remote --config wrangler.d1.production.jsonc --output "$BACKUP_DIR/d1/inci-production-00.sql"
node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 export INCI_DB_1 \
  --remote --config wrangler.d1.production.jsonc --output "$BACKUP_DIR/d1/inci-production-01.sql"
```

Các lệnh export giữ schema và dữ liệu, không chỉ một bảng. Tham khảo cú pháp [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/). SQL chứa hồ sơ khách hàng, thông tin thuế và token/session: chỉ để trên ổ mã hóa, không đưa lên Git.

Xuất thêm từng D1 thuộc hệ thống đã xác nhận trong inventory. Tại thời điểm viết còn các tên sau; nếu đổi tên/ID phải sửa danh sách, nếu có DB khác thuộc hệ thống phải bổ sung:

```bash
for DB_NAME in \
  thegioitrimun-app-staging \
  thegioitrimun-inci-staging-shard-00 \
  thegioitrimun-inci-staging-shard-01 \
  thegioitrimun-app \
  thegioitrimun-inci-runtime \
  thegioitrimun-inci-staging-runtime
do
  node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 export "$DB_NAME" \
    --remote --output "$BACKUP_DIR/d1/$DB_NAME.sql"
done
```

Không tự xuất DB của dự án khác nếu tài khoản có nhiều dự án. Với mỗi DB, lưu tên/ID, binding, vai trò, thời gian export, kích thước, SHA-256 và tình trạng kiểm tra. Không ghi cứng “61 đơn” hay một số nguyên liệu làm chuẩn cho tương lai; lấy số thực tế tại mốc backup.

## 7. Sao lưu toàn bộ R2, không chỉ URL ảnh

Các bucket production trong cấu hình hiện tại là `thegioitrimun-images` và `thegioitrimun-private-records`. Phải kiểm tra thêm bucket private staging, bucket backup và mọi bucket được các Worker khác của hệ thống sử dụng.

```bash
node --env-file=.env node_modules/wrangler/bin/wrangler.js r2 bucket list \
  > "$BACKUP_DIR/metadata/r2-buckets.txt"
```

Cấu hình một remote rclone tên `tgtm-r2` theo [Cloudflare R2 với rclone](https://developers.cloudflare.com/r2/examples/rclone/), dùng S3 endpoint của tài khoản và credential có quyền đọc cần thiết. Không dùng API token Cloudflare thông thường thay cho S3 access key. Bảo vệ file cấu hình rclone vì có credential.

Ví dụ cho hai bucket đã xác định:

```bash
for BUCKET_NAME in thegioitrimun-images thegioitrimun-private-records
do
  rclone lsjson "tgtm-r2:$BUCKET_NAME" --recursive \
    > "$BACKUP_DIR/metadata/$BUCKET_NAME-objects.json"
  rclone copy "tgtm-r2:$BUCKET_NAME" "$BACKUP_DIR/r2/$BUCKET_NAME" \
    --log-level INFO --log-file "$BACKUP_DIR/logs/$BUCKET_NAME-copy.log"
  rclone check "tgtm-r2:$BUCKET_NAME" "$BACKUP_DIR/r2/$BUCKET_NAME" --download \
    --log-file "$BACKUP_DIR/logs/$BUCKET_NAME-check.log"
done
```

Xác nhận cờ lệnh bằng `rclone help` của phiên bản cài đặt. `--download` đối chiếu nội dung khi checksum chung không có; có thể cần tải lại nhiều dữ liệu. Không chỉ so ETag với MD5: ETag của object multipart không nhất thiết là checksum toàn file.

**Bản sao object chưa đủ metadata/cấu hình:** dùng S3 `HeadObject` hoặc API được hỗ trợ để lưu sidecar metadata cho từng key: Content-Type, Cache-Control, Content-Disposition, Content-Encoding, custom metadata, size, ETag/checksum khả dụng và Last-Modified. Phải phân trang hết danh sách. Ghi riêng CORS, lifecycle, custom domain/public access và sự kiện bucket. Khi phục hồi cần áp lại metadata, không chỉ upload bytes.

Kiểm tra key có xung đột chữ hoa/thường, Unicode hoặc tên không thể lưu trên filesystem đích. Nếu có, dùng ổ phân biệt hoa/thường hoặc định dạng backup mã hóa key kèm manifest; không để một object ghi đè object khác trên macOS. `rclone copy` ở trên là bước sao chép, không bảo đảm giải quyết mọi dạng key.

Không dùng `rclone sync`, `--delete` hoặc thao tác xóa trên bucket nguồn. Không đưa bản sao tài liệu riêng tư vào public bucket. Nếu không lấy đủ metadata/object, đánh dấu phần R2 chưa hoàn tất.

## 8. Cloudflare, cấu hình bên ngoài và bí mật

### Cấu hình triển khai

Source archive đã có `wrangler*.jsonc`, nhưng cần lưu thêm trạng thái **đang chạy**:

```bash
node --env-file=.env node_modules/wrangler/bin/wrangler.js deployments list \
  --config wrangler.d1.production.jsonc --json > "$BACKUP_DIR/config/production-deployments.json"
node --env-file=.env node_modules/wrangler/bin/wrangler.js secret list \
  --config wrangler.d1.production.jsonc > "$BACKUP_DIR/config/production-secret-names.json"
```

Lặp lại theo từng Worker/staging được inventory xác định. Xuất/lưu bằng Dashboard hoặc API chính thức:

- Artifact/module Worker đang phát hành, assets đúng version, deployment ID và ngày giờ. `dist` trên máy có thể không phải bản đang chạy; không mặc định chúng giống nhau.
- Bindings thật, plain vars, compatibility date/flags, routes, cron, domain và cấu hình Queue/DLQ (retry, retention, consumer/producer).
- DNS zone, registrar/nameserver, redirects, TLS/chứng thư do mình quản lý, WAF/rate limit, cache, Access và quyền tài khoản cần thiết.
- KV, Durable Objects, Workers Images, Pages, Workflow hoặc tài nguyên khác **nếu live inventory có sử dụng**: bổ sung cách export đúng tài nguyên. Có binding Images chưa chứng minh đang lưu ảnh trong Cloudflare Images; phân biệt dịch vụ biến đổi ảnh với kho ảnh.

Queue/DLQ là tài nguyên vận hành riêng; SQL outbox không phải bản dump mọi message trong Queue. Không consume/purge để “backup”. Nếu không có cách xuất đầy đủ không phá hủy, ghi giới hạn và quy trình dựng lại/đối soát từ outbox cùng khóa chống trùng, không đánh dấu Queue đã snapshot.

### Bí mật và quyền phục hồi

`wrangler secret list` chỉ lập danh sách; không lấy lại giá trị bí mật. Phải có bản gốc từ kho mật khẩu hoặc người quản trị. Xem [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

Lập checklist theo **tên và nơi lưu**, không ghi giá trị vào tài liệu:

- Cloudflare API/R2 S3, quyền quản lý miền và MFA/recovery codes.
- SMTP, Google OAuth, nhà cung cấp AI; URL callback và allowlist.
- Pancake shop/kho/token/webhook; SePay token/webhook/account mapping.
- Telegram bot/chat ID; Deplao device pairing/signing key, Zalo session và khóa giải mã ứng dụng.
- Khóa mã hóa/chữ ký/chứng thư đang dùng, thời hạn và quy trình cấp lại.

Lưu export của kho mật khẩu vào container mã hóa riêng; khóa phục hồi phải ở nơi độc lập. Bí mật cloud không có bản gốc thì ghi **THIẾU — phải cấp lại khi phục hồi**, không giả định nằm trong `.env`.

## 9. Dữ liệu dịch vụ ngoài website

- **Pancake:** export đơn/khách/sản phẩm/tồn/thanh toán và vận chuyển theo quyền, mốc thời gian, phân trang của nền tảng; lưu hãng/kho/tài khoản, mapping ID và cấu hình webhook. Không tự tạo đơn hoặc gọi hãng để thử backup.
- **SePay/ngân hàng:** giữ báo cáo giao dịch/đối soát, mã giao dịch và cấu hình webhook. Không đổi tài khoản nhận tiền khi sao lưu.
- **Email/Telegram/Zalo:** lưu cấu hình, mẫu thông báo và export lịch sử được nền tảng cho phép, nếu cần phạm vi đầy đủ. Dữ liệu chat phải theo quyền chủ tài khoản; không vượt cơ chế bảo vệ hoặc sao lưu tài khoản ngoài phạm vi.
- **Supabase lịch sử:** nếu nguồn cũ còn tồn tại, giữ snapshot DB gồm schema/data/roles, Auth/config, functions và Storage objects riêng. Kiểm tra công cụ export có bỏ qua schema quản lý `auth`/`storage` hay không. Database backup không chứa bytes của Storage objects, theo [Supabase backups](https://supabase.com/docs/guides/platform/backups). Không phục hồi Supabase vào runtime chỉ vì đang sao lưu nguồn lịch sử.
- Với nguồn không thể export đầy đủ: ghi dữ liệu đã lấy, phạm vi thiếu, người giữ quyền, và phương án khôi phục. Không gọi đó là bản sao độc lập hoàn chỉnh.

## 10. Thử phục hồi — bắt buộc trước nghiệm thu

### Source và khóa giải mã

```bash
age -d "$BACKUP_DIR/source/TGTM-full.tar.gz.age" \
  | tar -tzf - > "$BACKUP_DIR/verify/TGTM-file-list.txt"
```

Sau kiểm tra danh sách, giải nén vào thư mục tạm mới, **không ghi lên TGTM đang dùng**. Kiểm tra file ẩn/Git/env, symlink, quyền file. Chạy build/test từ bản sao với secret thử, không để môi trường QA gửi email/Zalo/Telegram hoặc webhook đến khách thật.

### SQL

Ví dụ phục hồi local một export vào **file SQLite mới chưa tồn tại**:

```bash
test ! -e "$BACKUP_DIR/verify/app-test.sqlite"
sqlite3 "$BACKUP_DIR/verify/app-test.sqlite" ".read $BACKUP_DIR/d1/app-production.sql"
sqlite3 "$BACKUP_DIR/verify/app-test.sqlite" \
  'PRAGMA integrity_check; PRAGMA foreign_key_check;'
```

Kết quả phải có `ok` và không có dòng lỗi khóa ngoại. Lặp lại cho mọi DB. SQL chỉ lấy từ nguồn backup tin cậy; không chạy dump người lạ trên máy làm việc.

Thử thêm D1 riêng khi có quyền và tài nguyên, không nhập đè production. **Dự án này từng gặp lỗi vì bảng/dữ liệu con xuất trước bảng cha.** Khi cần chuẩn hóa thứ tự: giữ SQL gốc và checksum, tạo schema cha–con đúng thứ tự, nhập dữ liệu theo quan hệ, xử lý index/trigger/view thích hợp, rồi so sánh lại toàn bộ dữ liệu. `defer_foreign_keys` không thay thế việc chuẩn hóa thứ tự trong mọi cách import. Không xóa ràng buộc chỉ để import báo thành công.

Với mỗi bảng, đối chiếu schema/index/trigger/view, số dòng, khóa chính và checksum nội dung được chuẩn hóa/sắp xếp ổn định. Kiểm tra riêng tổng tiền, VAT, thanh toán, dòng hàng và tham chiếu file R2. COUNT bằng nhau không đủ chứng minh dữ liệu giống nhau.

### R2 và tích hợp

Thử mở ảnh, tải chứng từ có quyền và render/quét nhãn PDF trong môi trường cô lập. So sánh toàn bộ inventory và nội dung, không chỉ một vài file mẫu. Deplao thử với bản sao dữ liệu, không kết nối gửi tin thật. Ghi rõ khả năng cần đăng nhập lại trên máy mới.

## 11. Đóng gói, checksum và lưu ở nơi khác

Trước đóng gói, tạo `metadata/manifest.md` bằng trình soạn thảo, gồm:

```text
Mã backup:
Người thực hiện:
Thời gian bắt đầu/kết thúc UTC và Asia/Ho_Chi_Minh:
Mốc nghiệp vụ / khoảng bảo trì:
Git commit và trạng thái dirty:
Worker version đang chạy:
Danh sách DB: binding, tên, ID, thời gian, số bảng/dòng, checksum:
Danh sách bucket: số object, tổng bytes, metadata, kết quả kiểm tra:
Deplao: phiên bản, userData, actual DB path, media ngoài source:
Cấu hình/secret: đã lưu ở đâu; chỉ tên, không ghi giá trị:
Queue/webhook: còn tồn gì, cách đối soát khi phục hồi:
Nguồn bên ngoài và phần chưa xuất được:
Kết quả diễn tập phục hồi và bằng chứng:
Trạng thái: COMPLETE / PARTIAL / FAILED:
```

Tạo checksum cho các file rồi đóng gói toàn bộ thư mục vào một file mã hóa nằm bên ngoài nó:

```bash
(
  cd "$BACKUP_DIR"
  find . -type f ! -name SHA256SUMS.txt -exec shasum -a 256 {} \; > SHA256SUMS.txt
  shasum -a 256 -c SHA256SUMS.txt
)
tar -czf - -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")" \
  | age -p -o "$BACKUP_DIR.tar.gz.age"
shasum -a 256 "$BACKUP_DIR.tar.gz.age" > "$BACKUP_DIR.tar.gz.age.sha256"
```

Tên file có xuống dòng cần công cụ manifest hỗ trợ tên bất kỳ; không dùng manifest dạng dòng trên để chứng nhận các tên đó. SHA-256 kiểm tra hỏng/thay đổi bytes, không tự chứng minh danh tính người tạo; giữ checksum trong nơi đáng tin cậy hoặc ký manifest nếu quy trình yêu cầu.

Giải mã/giải nén **gói cuối** sang nơi khác, chạy lại checksum trước khi bàn giao. Chỉ checksum file mã hóa mà chưa thử giải mã là chưa đủ.

Áp dụng 3–2–1: ba bản, trên hai phương tiện, một bản ngoài máy/tài khoản chính. Ví dụ ổ local mã hóa, ổ rời mã hóa và kho offsite riêng. Không chỉ lưu backup D1 vào cùng một R2 account. Giữ bản trước/sau deploy và chính sách lưu ngày/tuần/tháng phù hợp; kiểm tra dung lượng và hạn mức trước khi tự động hóa.

Không xóa bản rõ hoặc bản cũ trong lượt đầu; sau khi xác minh đầy đủ, xử lý theo chính sách bảo mật. Xóa thông thường trên SSD không bảo đảm xóa an toàn, vì vậy mã hóa ổ đĩa ngay từ đầu rất quan trọng.

## 12. Khi cần đưa backup trở lại production

1. Xác nhận riêng phạm vi: mã nguồn, dữ liệu hay cả hai; mốc thời gian và dữ liệu sẽ bị lùi.
2. Tạo backup trạng thái hiện tại, thử phục hồi, ghi lại version/binding để quay lui.
3. Cô lập bên ghi và tác vụ bên ngoài; phục hồi sang DB/thư mục/bucket thử riêng.
4. Nghiệm thu checksum, schema, tiền/tồn/VAT, quyền truy cập và build.
5. Đối soát sự kiện đã xảy ra ngoài website: ngân hàng, Pancake, hãng vận chuyển và thông báo đã gửi. Chốt cách xử lý receipt, cursor, lease, schedule và idempotency; không tự phát lại tin hoặc gọi hãng.
6. Chuyển binding/artifact có kiểm soát, xác minh đúng DB mới. Cập nhật cả script backup nếu có tên DB mặc định cũ.
7. Mở ghi trở lại, theo dõi lỗi; giữ DB cũ để quay lui. Nếu đã phát sinh giao dịch mới, không đổi ngược binding mà chưa đối soát.

Không có lệnh `DROP`, `DELETE`, `rm -rf` hoặc restore đè production trong hướng dẫn backup này.

## 13. Checklist bàn giao

- [ ] Archive website và Deplao đủ file ẩn, dữ liệu local và thay đổi chưa commit; Git bundle hợp lệ.
- [ ] APP production đúng binding hiện tại, hai INCI shard, staging và DB lịch sử trong phạm vi đã export.
- [ ] Mọi DB phục hồi thử đạt integrity/FK và đối chiếu nội dung.
- [ ] R2 đủ bytes, object keys, metadata và cấu hình bucket; private vẫn được bảo vệ.
- [ ] Deplao có dữ liệu thực tế ngoài source và phương án khôi phục đăng nhập/khóa.
- [ ] Có cấu hình cloud đang chạy, artifact/version, DNS, Queue/DLQ và bí mật hoặc phương án cấp lại.
- [ ] Dịch vụ ngoài website đã export hoặc ghi rõ giới hạn, không che phần thiếu.
- [ ] Manifest chỉ rõ mốc thời gian, nguồn/đích và mọi ngoại lệ.
- [ ] Gói cuối đã giải mã/giải nén thử; checksum đạt; người nhận có quyền lấy khóa từ nơi độc lập.
- [ ] Có bản offsite kiểm tra được; không còn nhầm DB dự phòng với DB production.
- [ ] Bảo trì đã kết thúc và các công tắc vận hành được trả về trạng thái đã ghi nhận.

**Chỉ đánh dấu COMPLETE khi các mục thuộc phạm vi đều đạt. Thiếu dữ liệu cloud, object, khóa hoặc thử phục hồi thì phải ghi PARTIAL/FAILED, dù file nén đã tạo thành công.**
