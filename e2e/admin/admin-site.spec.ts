import { expect, test, type Page } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from '../shared/auth';
import { allowE2EMutation, createE2ELabel } from '../shared/mutation';

async function openSiteSection(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
}

test.describe.serial('Admin site business flows', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');

  test('opens branding and faq management shells', async ({ page }) => {
    await loginToAdmin(page, '/admin/noi-dung/branding');

    await openSiteSection(page, '/admin/noi-dung/branding');
    await expect(page.getByText(/Branding hệ thống/i)).toBeVisible();
    await expect(page.getByText(/Thương hiệu & Logo/i)).toBeVisible();
    await expect(page.locator('input[name="clinic_name"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu cài đặt/i })).toBeVisible();

    await openSiteSection(page, '/admin/noi-dung/faq');
    await expect(page.getByRole('heading', { name: /Quản lý FAQ/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Thêm FAQ/i })).toBeVisible();

    await page.getByRole('button', { name: /Thêm FAQ/i }).click();
    await expect(page.getByText(/Thêm FAQ mới|Chỉnh sửa FAQ/i)).toBeVisible();
    const faqForm = page.locator('form').filter({ has: page.locator('textarea') }).last();
    await expect(faqForm.locator('input[type="text"]').first()).toBeVisible();
    await expect(faqForm.locator('textarea').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Lưu$/i })).toBeVisible();
    await page.getByRole('button', { name: /^Hủy$/i }).click();
    await expect(page.getByText(/Thêm FAQ mới|Chỉnh sửa FAQ/i)).toHaveCount(0);
  });

  test('creates and removes an faq item when mutation is enabled', async ({ page }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');

    const faq = createE2ELabel('faq');
    const answer = `Câu trả lời tự động cho ${faq.name}`;

    await loginToAdmin(page, '/admin/noi-dung/faq');
    await openSiteSection(page, '/admin/noi-dung/faq');

    await page.getByRole('button', { name: /Thêm FAQ/i }).click();
    const faqForm = page.locator('form').filter({ has: page.locator('textarea') }).last();
    await faqForm.locator('input[type="text"]').first().fill(faq.name);
    await faqForm.locator('textarea').first().fill(answer);
    await page.getByRole('button', { name: /^Lưu$/i }).click();

    const createdFaq = page.locator('div').filter({ hasText: faq.name }).first();
    await expect(createdFaq).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(answer)).toBeVisible({ timeout: 30000 });

    await createdFaq.getByRole('button').last().click();
    await expect(page.getByText(faq.name)).toHaveCount(0, { timeout: 30000 });
  });
});
