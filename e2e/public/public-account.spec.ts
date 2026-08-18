import { expect, test } from '@playwright/test';
import { isCustomerAuthConfigured, loginToCustomer } from '../shared/auth';

test.describe('Public account journeys', () => {
  test('guest account and wishlist routes open the auth experience', async ({ page }) => {
    await page.goto('/tai-khoan', { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/tai-khoan(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Chào mừng trở lại!/i })).toBeVisible();
    await expect(page.getByText(/Đăng nhập để quản lý lịch hẹn và hồ sơ của bạn/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Đăng nhập$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng ký ngay/i })).toBeVisible();

    await page.getByRole('button', { name: /Đăng ký ngay/i }).click();
    await expect(page.getByRole('heading', { name: /Tạo tài khoản mới/i })).toBeVisible();
    await expect(page.getByText(/Bắt đầu hành trình chăm sóc da của bạn với Thế Giới Trị Mụn/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Đăng ký$/i })).toBeVisible();

    await page.getByRole('button', { name: /^Đăng nhập$/i }).last().click();
    await expect(page.getByRole('heading', { name: /Chào mừng trở lại!/i })).toBeVisible();

    await page.getByRole('button', { name: /Quên mật khẩu\?/i }).click();
    await expect(page.getByRole('heading', { name: /Quên mật khẩu\?/i })).toBeVisible();
    await expect(page.getByText(/Nhập email để nhận liên kết đặt lại mật khẩu/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Gửi liên kết đặt lại/i })).toBeVisible();

    await page.getByRole('button', { name: /^Đăng nhập$/i }).last().click();
    await expect(page.getByRole('heading', { name: /Chào mừng trở lại!/i })).toBeVisible();

    await page.goto('/yeu-thich', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/yeu-thich(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: /Chào mừng trở lại!/i })).toBeVisible();
    await expect(page.getByText(/Đăng nhập để quản lý lịch hẹn và hồ sơ của bạn/i)).toBeVisible();
  });

  test('authenticated customer reaches the account center', async ({ page }) => {
    test.skip(!isCustomerAuthConfigured(), 'Missing CUSTOMER_E2E_EMAIL or CUSTOMER_E2E_PASSWORD.');

    await loginToCustomer(page, '/tai-khoan');

    await expect(page).toHaveURL(/\/tai-khoan(?:\?.*)?$/);
    await expect(page.getByRole('button', { name: /^Thông tin cá nhân$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Đơn hàng của tôi$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Danh sách yêu thích$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Cài đặt Giao diện$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng xuất/i })).toBeVisible();
  });
});
