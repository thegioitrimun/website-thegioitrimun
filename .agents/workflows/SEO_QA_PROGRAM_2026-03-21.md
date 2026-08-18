# SEO QA Program

## Mục tiêu

Quy trình này dùng để khóa hai lớp rủi ro:

1. SEO kỹ thuật bị gãy sau deploy.
2. Nội dung sản phẩm và bài viết bị mỏng, thiếu internal links, thiếu FAQ, thiếu hình ảnh hoặc thiếu bản dịch usable, dẫn tới CTR thấp và khó mở rộng long-tail SEO.

Phạm vi ưu tiên cao nhất:

- Trang chi tiết sản phẩm
- Trang chi tiết bài viết
- Trang danh mục sản phẩm / kiến thức liên quan trực tiếp tới traffic intent cao

## Nguyên tắc vận hành

- Không publish sản phẩm hoặc bài viết mới nếu còn lỗi `critical`.
- `high` phải vào backlog sprint hiện tại.
- `medium` được xử lý theo batch tối ưu hóa editorial định kỳ.
- Mọi thay đổi runtime SEO phải đi qua regression kỹ thuật.
- Mọi thay đổi nội dung sản phẩm/blog phải đi qua regression content quality.

## 5 lớp kiểm định bắt buộc

### 1. Technical SEO gate

Lệnh:

```bash
npm run qa:seo:ci
```

Bắt các lỗi:

- canonical sai
- hreflang sai
- missing JSON-LD loại chính
- noindex/indexing sai
- sitemap parity sai

### 2. Blog content integrity gate

Lệnh:

```bash
npm run qa:blog-content
```

Bắt các lỗi:

- `blog_posts` và `public_blog_posts` lệch nhau
- public detail có row nhưng content rỗng
- title/category/summary bị mismatch

### 3. SEO content quality gate

Lệnh:

```bash
npm run qa:seo-content
```

Script này audit trực tiếp dữ liệu `products` và `blog_posts`.

Với bài viết, script kiểm tra:

- slug
- title
- summary
- meta description
- cover image
- category
- body word count
- heading structure
- internal links tổng
- internal links sang product/service/brand
- author
- locale coverage `en/ru/cn`

Với sản phẩm, script kiểm tra:

- slug
- name
- short description
- số ảnh gallery
- long description blocks
- block text / block image trong long description
- usage instructions
- ingredients
- key benefits
- FAQ riêng
- brand / origin / skin types / texture
- locale coverage `en/ru/cn`

### 4. Image SEO gate

Lệnh:

```bash
npm run seo:audit-image-paths
```

Bắt các lỗi:

- ảnh còn path legacy
- ảnh không theo naming SEO
- assets site/blog/product/service/brand chưa vào chuẩn mới

### 5. Public runtime gate

Lệnh:

```bash
npm run qa:smoke
npm run qa:site-critical:e2e
```

Bắt các lỗi:

- trang detail không render được
- route public hỏng
- luồng điều hướng chính không usable

## Thang mức độ lỗi

### `critical`

Không được phép publish hoặc release nếu còn:

- bài viết không có slug/title/category/content/image
- bài viết body quá mỏng
- sản phẩm không có slug/name/description/images
- sản phẩm thiếu content support ở mức unusable

### `high`

Được xem là chặn hiệu quả SEO thực chiến:

- bài viết không có internal links
- bài viết không kéo traffic về product/service/brand
- thiếu meta description riêng
- sản phẩm chỉ có 1 ảnh
- sản phẩm thiếu usage / ingredients / key benefits / FAQ

### `medium`

Không chặn publish ngay nhưng làm giảm mặt bằng chất lượng:

- heading structure yếu
- title/meta length chưa chuẩn
- thiếu locale `en/ru/cn`
- thiếu origin/skin types/texture

## Tiêu chuẩn tối thiểu để publish

### Bài viết

- title rõ intent, không quá ngắn hoặc quá dài
- summary >= 110 ký tự
- meta description riêng 120-170 ký tự
- body >= 600 từ hoặc đủ chiều sâu chủ đề
- có ít nhất 3 heading
- có ít nhất 3 internal links
- có ít nhất 1 internal link sang product/service/brand
- có cover image
- có category và author

### Sản phẩm

- name + slug hoàn chỉnh
- short description usable
- >= 2 ảnh gallery
- long description có text blocks
- usage instructions
- ingredients
- key benefits
- FAQ riêng >= 2 câu
- brand + origin + skin types
- content support >= 260 từ

## Quy trình biên tập chuẩn

### Với bài viết mới

1. Soạn title, summary, body tiếng Việt.
2. Gắn category, cover image, author.
3. Thêm internal links tới:
   - ít nhất 1 sản phẩm
   - ít nhất 1 dịch vụ
   - ít nhất 1 bài viết/brand liên quan
4. Điền meta description riêng.
5. Chạy hoặc dùng AI tạo bản dịch `en/ru/cn`.
6. Chạy audit SEO content trước khi publish.

### Với sản phẩm mới

1. Tạo slug, name, description.
2. Upload ít nhất 2 ảnh.
3. Điền long description có text blocks và nếu có thể thêm image blocks.
4. Điền usage instructions, ingredients, key benefits.
5. Điền FAQ riêng.
6. Điền brand, origin, skin types.
7. Thêm bản dịch core locales.
8. Chạy audit SEO content trước khi publish.

## Cadence vận hành

### Mỗi push `main`

- `site-regression` chạy kỹ thuật + content integrity + SEO content quality ở chế độ report-governance.
- Khi backlog `critical` đã được kéo về mức chấp nhận được, có thể siết lại `qa:seo-content:ci` thành hard gate.

### Mỗi ngày

- workflow `SEO Content Governance` chạy lại audit editorial/content để sinh backlog mới.

### Mỗi tuần

- ưu tiên xử lý top backlog:
  - blog thiếu commerce links
  - product thiếu FAQ
  - product chỉ có 1 ảnh
  - bài viết/sản phẩm thiếu locale coverage

## Command chuẩn cho vận hành

```bash
npm run qa:seo
npm run qa:blog-content
npm run qa:seo-content
npm run seo:audit-image-paths
npm run qa:site-regression
```

## Kết quả đầu ra

- `SEO_AUDIT_LIVE.md`
- `BLOG_CONTENT_AUDIT.md`
- `SEO_CONTENT_QUALITY_AUDIT.md`

## Quy tắc release

- Release bị chặn nếu regression kỹ thuật fail.
- Release bị chặn nếu content audit phát hiện lỗi `critical`.
- Không đẩy indexation mạnh cho nhóm URL nào còn backlog `critical-backlog`.
