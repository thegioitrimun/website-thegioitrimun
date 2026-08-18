import { expect, test } from '@playwright/test';

test.describe('Public homepage journeys', () => {
  test('renders an image-only responsive hero and opens services from homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const homepageHero = page.locator('#home');
    await expect(homepageHero.getByTestId('homepage-hero-picture')).toBeVisible();
    await expect(homepageHero.getByTestId('homepage-hero-image')).toBeVisible();
    await expect(homepageHero.locator('h1, p, button')).toHaveCount(0);

    await page.getByRole('button', { name: /Xem toàn bộ dịch vụ/i }).click();
    await page.waitForLoadState('networkidle').catch(() => null);
    await expect(page).toHaveURL(/\/dich-vu(?:\?.*)?$/);
    await expect(page.getByText(/Dịch vụ da liễu/i)).toBeVisible();
    await expect(page.getByText(/Mở trang liệu trình/i).first()).toBeVisible();
  });

  test('top navigation reaches the blog library', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Kiến thức$/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/kien-thuc(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Kiến thức Da liễu/i })).toBeVisible();
    await expect(page.locator('input[placeholder*="Tìm theo tiêu đề"]').first()).toBeVisible();
  });

  test('footer social links have accessible names and absolute URLs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const facebookLink = page.getByRole('link', { name: /Facebook của (Thế Giới Trị Mụn|Da Liễu Nhiệt Đới Phú Quốc)/i });
    await expect(facebookLink).toBeVisible();
    await expect(facebookLink).toHaveAttribute('href', /^https:\/\/facebook\.com\/thegioimun\/?$/);
  });
});
