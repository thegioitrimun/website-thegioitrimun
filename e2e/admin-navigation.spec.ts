import { expect, test } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from './shared/auth';
import { expectAdminPath, clickAdminModule } from './shared/navigation';

const VIEWPORTS = [
  { name: 'mobile', viewport: { width: 430, height: 932 } },
  { name: 'desktop', viewport: { width: 1440, height: 1100 } },
] as const;

for (const view of VIEWPORTS) {
  test.describe.serial(`Admin navigation (${view.name})`, () => {
    test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');
    test.use({ viewport: view.viewport });

    test('navigates from blog to site management without falling back home', async ({ page }) => {
      await loginToAdmin(page, '/admin/blog');
      await expectAdminPath(page, /\/admin\/blog(?:\?.*)?$/, 'blog');

      await clickAdminModule(page, 'site');
      await expectAdminPath(page, /\/admin\/noi-dung(?:\/branding)?(?:\?.*)?$/, 'siteBranding');
    });

    test('navigates from site management to pharmacy and back to blog', async ({ page }) => {
      await loginToAdmin(page, '/admin/noi-dung');
      await expectAdminPath(page, /\/admin\/noi-dung(?:\/branding)?(?:\?.*)?$/, 'siteBranding');

      await clickAdminModule(page, 'pharmacy');
      await expectAdminPath(page, /\/admin\/nha-thuoc(?:\?.*)?$/, 'pharmacy');

      await clickAdminModule(page, 'blog');
      await expectAdminPath(page, /\/admin\/blog(?:\?.*)?$/, 'blog');
    });

    test('keeps admin route stable across reload and browser history', async ({ page }) => {
      await loginToAdmin(page, '/admin/noi-dung/faq');
      await expectAdminPath(page, /\/admin\/noi-dung\/faq(?:\?.*)?$/, 'siteFaq');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      await expectAdminPath(page, /\/admin\/noi-dung\/faq(?:\?.*)?$/, 'siteFaq');

      await clickAdminModule(page, 'users');
      await expectAdminPath(page, /\/admin\/nguoi-dung(?:\?.*)?$/, 'users');

      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      await expectAdminPath(page, /\/admin\/noi-dung\/faq(?:\?.*)?$/, 'siteFaq');

      await page.goForward({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      await expectAdminPath(page, /\/admin\/nguoi-dung(?:\?.*)?$/, 'users');
    });
  });
}
