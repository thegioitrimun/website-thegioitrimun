import { expect, test } from '@playwright/test';

test.describe('Public service journeys', () => {
  test('opens a service detail from the service listing', async ({ page }) => {
    await page.goto('/dich-vu', { waitUntil: 'networkidle' });

    await expect(page.getByText(/Dịch vụ da liễu/i)).toBeVisible();
    await expect(page.getByText(/Điều trị mụn chuyên sâu/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Mở trang liệu trình/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/dich-vu\/dieu-tri-mun-chuyen-sau(?:\?.*)?$/);
    await expect(page.locator('h1').filter({ hasText: /Điều trị mụn chuyên sâu/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Chi tiết liệu trình/i }).first()).toBeVisible();
  });

  test('jumps from a service detail to its support product', async ({ page }) => {
    await page.goto('/dich-vu/dieu-tri-mun-chuyen-sau', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').filter({ hasText: /Điều trị mụn chuyên sâu/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xem sản phẩm hỗ trợ/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /Xem sản phẩm hỗ trợ/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/san-pham\/.+/);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Mô tả chi tiết/i }).first()).toBeVisible();
  });
});
