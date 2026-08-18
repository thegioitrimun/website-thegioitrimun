import { expect, test, type Locator, type Page } from '@playwright/test';

const BLOG_DETAIL_PATH = '/kien-thuc/dieu-tri-mun/mun-dau-den-o-tran-nguyen-nhan-cach-dieu-tri-an-toan-hieu-qua';
const PRODUCT_DETAIL_PATH = '/san-pham/tinh-chat-dac-tri/gel-tri-mun-klenzit-ms-0-1';
const SERVICE_DETAIL_PATH = '/dich-vu/dieu-tri-mun-chuyen-sau';
const BRAND_DIRECTORY_PATH = '/thuong-hieu';

async function firstVisible(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      return item;
    }
  }
  throw new Error('No visible editorial body found.');
}

async function expectEditorialBody(page: Page, minLength: number) {
  const locator = await firstVisible(page.locator('.editorial-prose'));
  await expect(locator).toBeVisible();
  const bodyText = (await locator.innerText()).trim();
  expect(bodyText.length).toBeGreaterThan(minLength);
}

test.describe('Public site critical paths', () => {
  test('homepage renders hero and key discovery sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const homepageHero = page.locator('#home');
    await expect(homepageHero.getByTestId('homepage-hero-picture')).toBeVisible();
    await expect(homepageHero.getByTestId('homepage-hero-image')).toBeVisible();
    await expect(homepageHero.locator('h1, p, button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Xem toàn bộ dịch vụ/i })).toBeVisible();
  });

  test('long blog detail renders actual editorial body instead of blank content', async ({ page }) => {
    await page.goto(BLOG_DETAIL_PATH, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').filter({ hasText: /Mụn đầu đen ở trán/i })).toBeVisible();
    await expect(page.getByText(/Loading article/i)).toHaveCount(0);
    await expectEditorialBody(page, 1200);
  });

  test('product and service detail pages render their core content blocks', async ({ page }) => {
    await page.goto(PRODUCT_DETAIL_PATH, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').filter({ hasText: /Gel Trị Mụn Klenzit MS 0.1%/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mô tả chi tiết/i })).toBeVisible();
    await expect(page.getByText(/Thành phần|Công dụng|Cách dùng|Mô tả/i).first()).toBeVisible();

    await page.goto(SERVICE_DETAIL_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').filter({ hasText: /Điều trị mụn chuyên sâu/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Chi tiết liệu trình/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Xem sản phẩm hỗ trợ|Đặt lịch/i }).first()).toBeVisible();
  });

  test('brand directory and landing page link into filtered products', async ({ page }) => {
    await page.goto(BRAND_DIRECTORY_PATH, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Mở nhanh đúng thương hiệu bạn đang cần/i })).toBeVisible();
    const openBrandProfile = page.getByRole('button', { name: /Xem hồ sơ thương hiệu/i }).first();
    await expect(openBrandProfile).toBeVisible();
    await openBrandProfile.click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/thuong-hieu\/[^/?#]+(?:\?.*)?$/);
    await expect(page.locator('h1').first()).toBeVisible();
    const browseBrandProducts = page.getByRole('button', { name: /Xem tất cả sản phẩm của thương hiệu/i }).first();
    await expect(browseBrandProducts).toBeVisible();

    await browseBrandProducts.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/san-pham\?(?:.*&)?brand=/);
  });
});
