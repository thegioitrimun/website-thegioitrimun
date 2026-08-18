import { expect, test } from '@playwright/test';
import { isCustomerAuthConfigured, loginToCustomer } from '../shared/auth';

const PRODUCT_PATH = '/san-pham/tinh-chat-dac-tri/gel-tri-mun-klenzit-ms-0-1';

test.describe('Public checkout journeys', () => {
  test('guest checkout requires login after adding a product to cart', async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: 'networkidle' });

    await expect(page.locator('h1').filter({ hasText: /Gel Trị Mụn Klenzit MS 0.1%/i })).toBeVisible();
    await page.getByRole('button', { name: /Thêm vào giỏ hàng/i }).first().click();

    await expect(page.getByText(/Giỏ hàng \(1\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Thanh toán/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /Thanh toán/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/dang-nhap(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Chào mừng trở lại!/i })).toBeVisible();
    await expect(page.getByText(/Đăng nhập để quản lý lịch hẹn và hồ sơ của bạn/i)).toBeVisible();
  });

  test('guest can open the full cart page from the minicart', async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Thêm vào giỏ hàng/i }).first().click();
    await expect(page.getByText(/Giỏ hàng \(1\)/i)).toBeVisible();

    await page.getByRole('button', { name: /Xem giỏ hàng chi tiết/i }).click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/gio-hang(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Giỏ hàng của bạn/i })).toBeVisible();
    await expect(page.getByText(/Gel Trị Mụn Klenzit MS 0.1%/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Thanh toán/i }).last()).toBeVisible();
  });

  test('authenticated customer can reach the checkout form', async ({ page }) => {
    test.skip(!isCustomerAuthConfigured(), 'Missing CUSTOMER_E2E_EMAIL or CUSTOMER_E2E_PASSWORD.');

    await loginToCustomer(page, '/tai-khoan');
    await page.goto(PRODUCT_PATH, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Thêm vào giỏ hàng/i }).first().click();
    await expect(page.getByText(/Giỏ hàng \(1\)/i)).toBeVisible();

    await page.getByRole('button', { name: /Thanh toán/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).toHaveURL(/\/thanh-toan(?:\?.*)?$/);
    await expect(page.locator('h1').filter({ hasText: /^Thanh toán$/i })).toBeVisible();
    await expect(page.getByText(/Thông tin giao hàng/i)).toBeVisible();
    await expect(page.getByText(/Phương thức thanh toán/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Hoàn tất đơn hàng/i })).toBeVisible();
  });
});
