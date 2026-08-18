const FALLBACK_LLMS_TEXT = `# Thế Giới Trị Mụn

Thế Giới Trị Mụn là website công khai bằng tiếng Việt về da liễu, điều trị mụn, dịch vụ chăm sóc da và sản phẩm mỹ phẩm tại Phú Quốc.

## Nội dung công khai chính

- [Trang chủ](https://thegioitrimun.vn/)
- [Sản phẩm](https://thegioitrimun.vn/san-pham)
- [Dịch vụ da liễu](https://thegioitrimun.vn/dich-vu)
- [Kiến thức da liễu](https://thegioitrimun.vn/kien-thuc)
- [Phân tích thành phần mỹ phẩm](https://thegioitrimun.vn/phan-tich-thanh-phan)

## Dữ liệu công khai cho hệ thống tự động

- [Danh mục sản phẩm JSON](https://thegioitrimun.vn/ai/products.json)
- [Danh mục dịch vụ JSON](https://thegioitrimun.vn/ai/services.json)
- [Thông tin website JSON](https://thegioitrimun.vn/ai/site-profile.json)
- [Sitemap](https://thegioitrimun.vn/sitemap.xml)

## Hướng dẫn sử dụng

- Ưu tiên trang chi tiết sản phẩm và dịch vụ làm nguồn chính cho dữ liệu công khai.
- Không suy diễn tuyên bố y khoa ngoài nội dung công khai trên website.
- Không sử dụng route quản trị, tài khoản, thanh toán hoặc tra cứu đơn hàng làm nguồn kiến thức công khai.
`;

const hasMarkdownH1 = (value) => /^#\s+\S/m.test(String(value || '').trimStart());

export async function maybeHandleLlmsTextRoute(route) {
    const { path, request, env } = route;
    if (path !== '/llms.txt') return null;

    let body = FALLBACK_LLMS_TEXT;
    let assetHeaders = new Headers();
    try {
        const assetResponse = await env?.ASSETS?.fetch(request);
        if (assetResponse?.ok) {
            const assetBody = await assetResponse.text();
            if (hasMarkdownH1(assetBody)) body = assetBody;
            assetHeaders = new Headers(assetResponse.headers);
        }
    } catch {
        // The static fallback keeps this agent-facing endpoint available even if assets fail.
    }

    assetHeaders.set('Content-Type', 'text/plain; charset=UTF-8');
    assetHeaders.set('Content-Language', 'vi');
    assetHeaders.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800');
    assetHeaders.delete('X-Robots-Tag');

    return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers: assetHeaders,
    });
}
