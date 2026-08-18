import { expect, type Page } from '@playwright/test';

export type AdminRouteKey =
  | 'dashboard'
  | 'pharmacy'
  | 'blog'
  | 'services'
  | 'users'
  | 'siteBranding'
  | 'siteFaq';

type SelectorCheck = {
  kind: 'heading' | 'button' | 'text';
  value: RegExp;
};

const ADMIN_ROUTE_CHECKS: Record<AdminRouteKey, SelectorCheck[]> = {
  dashboard: [
    { kind: 'heading', value: /Dashboard quản trị/i },
    { kind: 'text', value: /Xu hướng gọn theo kỳ/i },
  ],
  pharmacy: [
    { kind: 'text', value: /Danh sách Sản phẩm/i },
    { kind: 'button', value: /Thêm Sản phẩm/i },
  ],
  blog: [
    { kind: 'text', value: /Danh sách Bài viết/i },
    { kind: 'button', value: /Thêm bài viết/i },
  ],
  services: [
    { kind: 'text', value: /Danh sách Dịch vụ/i },
    { kind: 'button', value: /Thêm dịch vụ/i },
  ],
  users: [
    { kind: 'text', value: /Điều phối người dùng/i },
    { kind: 'text', value: /Tổng tài khoản/i },
  ],
  siteBranding: [
    { kind: 'text', value: /Branding hệ thống/i },
    { kind: 'text', value: /Thương hiệu & Logo/i },
  ],
  siteFaq: [
    { kind: 'text', value: /Quản lý FAQ/i },
    { kind: 'button', value: /Thêm FAQ/i },
  ],
};

function getLocator(page: Page, selector: SelectorCheck) {
  if (selector.kind === 'heading') {
    return page.getByRole('heading', { name: selector.value }).first();
  }
  if (selector.kind === 'button') {
    return page.getByRole('button', { name: selector.value }).first();
  }
  return page.getByText(selector.value).first();
}

export async function expectAdminRouteReady(page: Page, key: AdminRouteKey) {
  for (const selector of ADMIN_ROUTE_CHECKS[key]) {
    await expect(getLocator(page, selector)).toBeVisible({ timeout: 20_000 });
  }
}

export async function expectNoHomepageFallback(page: Page) {
  const pathname = new URL(page.url()).pathname;
  expect(pathname.startsWith('/admin')).toBeTruthy();
  await expect(page.getByRole('heading', { name: /Chăm sóc da chuyên sâu, chuẩn y khoa/i })).toHaveCount(0);
}
