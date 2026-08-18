import { expect, test } from '@playwright/test';

test.describe('Public pharmacy catalog', () => {
  test('filters by category and opens a product detail from the listing', async ({ page }) => {
    await page.goto('/san-pham', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[placeholder*="Tìm kiếm theo tên, công dụng"]').first();
    await expect(searchInput).toBeVisible();
    await expect(page.getByText(/Hiển thị 1-\d+ trên \d+ sản phẩm/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Dược phẩm\s*\d*/i }).first().click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/1 bộ lọc đang bật/i)).toBeVisible();
    await expect(page.getByText(/^Dược phẩm$/i).first()).toBeVisible();

    const firstProductCard = page.locator('article').first();
    const firstProductTitle = page.locator('article h3').first();
    await expect(firstProductTitle).toBeVisible();
    const expectedTitle = ((await firstProductTitle.innerText()) || '').trim();
    expect(expectedTitle.length).toBeGreaterThan(4);

    await firstProductCard.click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/san-pham\/.+/);
    await expect(page.locator('h1').filter({ hasText: expectedTitle })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mô tả chi tiết/i }).first()).toBeVisible();
  });
});
