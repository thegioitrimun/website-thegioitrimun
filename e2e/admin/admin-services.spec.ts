import { expect, test, type Page } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from '../shared/auth';
import { allowE2EMutation, createE2ELabel } from '../shared/mutation';

async function openServicesAdmin(page: Page) {
  await page.goto('/admin/dich-vu', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expect(page.getByRole('heading', { name: /Danh sách Dịch vụ/i })).toBeVisible();
}

test.describe.serial('Admin service business flows', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');

  test('opens the service editor from list and returns safely to the list', async ({ page }) => {
    await loginToAdmin(page, '/admin/dich-vu');
    await openServicesAdmin(page);

    await page.getByRole('button', { name: /Thêm dịch vụ/i }).first().click();
    await expect(page.getByText(/Tạo Dịch vụ mới|Chỉnh sửa Dịch vụ/i)).toBeVisible();
    await expect(page.locator('input[name="name"]').first()).toBeVisible();
    await expect(page.locator('input[name="slug"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="description"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="long_description"]').first()).toBeVisible();
    await expect(page.locator('input[name="price"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu Dịch vụ/i })).toBeVisible();

    await page.getByRole('button', { name: /^Hủy$/i }).click();
    await expect(page.getByRole('heading', { name: /Danh sách Dịch vụ/i })).toBeVisible();
  });

  test('opens an existing service in edit mode', async ({ page }) => {
    await loginToAdmin(page, '/admin/dich-vu');
    await openServicesAdmin(page);

    await page.locator('tbody tr').first().locator('button').first().click();
    await expect(page.getByText(/Chỉnh sửa Dịch vụ|Tạo Dịch vụ mới/i)).toBeVisible();
    await expect(page.locator('input[name="name"]').first()).not.toHaveValue('');
    await expect(page.locator('input[name="slug"]').first()).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /Lưu Dịch vụ/i })).toBeVisible();
  });

  test('creates and cleans up an e2e service record when mutation is enabled', async ({ page }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');

    const draft = createE2ELabel('service');

    await loginToAdmin(page, '/admin/dich-vu');
    await openServicesAdmin(page);

    await page.getByRole('button', { name: /Thêm dịch vụ/i }).first().click();
    await page.locator('input[name="name"]').first().fill(draft.name);
    await page.locator('input[name="slug"]').first().fill(draft.slug);
    await page.locator('textarea[name="description"]').first().fill(`Mô tả ngắn cho ${draft.name}`);
    await page.locator('textarea[name="long_description"]').first().fill(`Mô tả chi tiết cho ${draft.name}`);
    await page.locator('textarea').nth(2).fill('Lợi ích 1\nLợi ích 2');
    await page.locator('input[name="price"]').first().fill('123000');

    await page.getByRole('button', { name: /Lưu Dịch vụ/i }).click();
    await expect(page.getByText(/Danh sách Dịch vụ/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(draft.name)).toBeVisible({ timeout: 30000 });

    const createdCard = page.locator('div, article, tr').filter({ hasText: draft.name }).first();
    const deleteButton = (await createdCard.locator('button').count()) > 0
      ? createdCard.locator('button').last()
      : page.getByRole('button', { name: /^Xóa$/i }).last();
    await deleteButton.click();
    await expect(page.getByText(draft.name)).toHaveCount(0, { timeout: 30000 });
  });
});
