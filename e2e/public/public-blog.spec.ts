import { expect, test } from '@playwright/test';

test.describe('Public blog journeys', () => {
  test('filters the library and opens a real article body', async ({ page }) => {
    await page.goto('/kien-thuc', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[placeholder*="Tìm theo tiêu đề"]').first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('mụn đầu đen');
    await page.waitForTimeout(1200);

    await expect(page.getByText(/KẾT QUẢ NHANH/i)).toBeVisible();
    await expect(page.getByText(/mụn đầu đen/i).first()).toBeVisible();
    await expect(page.getByText(/Mụn đầu đen ở trán: Nguyên nhân & Cách điều trị an toàn, hiệu quả/i)).toBeVisible();

    await page.getByRole('button', { name: /Xem chi tiết/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/kien-thuc\/dieu-tri-mun\/mun-dau-den-o-tran-nguyen-nhan-cach-dieu-tri-an-toan-hieu-qua(?:\?.*)?$/);

    await expect(page.locator('h1').filter({ hasText: /Mụn đầu đen ở trán/i })).toBeVisible();
    await expect(page.getByText(/LOADING ARTICLE/i)).toHaveCount(0, { timeout: 30_000 });

    const articleBody = page.locator('.editorial-prose').first();
    await expect(articleBody).toBeVisible();
    const bodyText = (await articleBody.innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(1200);
  });
});
