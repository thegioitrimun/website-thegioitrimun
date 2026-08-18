import { expect, type Page } from '@playwright/test';
import { expectAdminRouteReady, expectNoHomepageFallback, type AdminRouteKey } from './assertions';

const MODULE_BUTTON_NAMES: Record<'dashboard' | 'pharmacy' | 'blog' | 'services' | 'users' | 'site', RegExp[]> = {
  dashboard: [/Dashboard/i],
  pharmacy: [/Sản phẩm/i],
  blog: [/Kiến thức/i],
  services: [/Dịch vụ/i],
  users: [/Người dùng/i],
  site: [/Nội dung site/i, /^Nội dung$/i],
};

export async function clickAdminModule(page: Page, target: keyof typeof MODULE_BUTTON_NAMES) {
  const patterns = MODULE_BUTTON_NAMES[target];

  for (const pattern of patterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForLoadState('networkidle').catch(() => null);
      return;
    }
  }

  throw new Error(`Admin module button not found for target "${target}"`);
}

export async function expectAdminPath(page: Page, expectedPath: RegExp, routeKey: AdminRouteKey) {
  await expect(page).toHaveURL(expectedPath);
  await expectNoHomepageFallback(page);
  await expectAdminRouteReady(page, routeKey);
}
