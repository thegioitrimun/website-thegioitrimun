import { expect, type Page } from '@playwright/test';

export const adminEmail = process.env.E2E_ADMIN_EMAIL;
export const adminPassword = process.env.E2E_ADMIN_PASSWORD;
export const customerEmail = process.env.CUSTOMER_E2E_EMAIL;
export const customerPassword = process.env.CUSTOMER_E2E_PASSWORD;

export function isAdminAuthConfigured() {
  return Boolean(adminEmail && adminPassword);
}

export function isCustomerAuthConfigured() {
  return Boolean(customerEmail && customerPassword);
}

async function loginWithCredentials(page: Page, credentials: { email: string; password: string }, targetPath: string) {
  const { email, password } = credentials;

  if (!email || !password) {
    throw new Error(`Missing credentials for target "${targetPath}"`);
  }

  for (let loginAttempt = 0; loginAttempt < 2; loginAttempt += 1) {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    for (let gateAttempt = 0; gateAttempt < 5; gateAttempt += 1) {
      const emailField = page.locator('input[name="email"]').first();
      const maintenanceGate = page.getByText(/Đăng nhập tạm thời chưa khả dụng/i);

      if (!page.url().includes('/dang-nhap') && !(await emailField.isVisible().catch(() => false))) {
        break;
      }

      if (await emailField.isVisible().catch(() => false)) {
        break;
      }

      if (await maintenanceGate.isVisible().catch(() => false)) {
        const retryButton = page.getByRole('button', { name: 'Kiểm tra lại' });
        if (await retryButton.isVisible().catch(() => false)) {
          await retryButton.click();
          await page.waitForTimeout(1500);
          continue;
        }
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }

    const emailField = page.locator('input[name="email"]').first();
    if (await emailField.isVisible().catch(() => false)) {
      await expect(emailField).toBeVisible({ timeout: 20_000 });
      await emailField.fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('form button[type="submit"]').click();
      await emailField.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => null);
      await page.waitForLoadState('networkidle').catch(() => null);
    }

    if (!(await page.locator('input[name="email"]').first().isVisible().catch(() => false))) {
      await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      if (!(await page.locator('input[name="email"]').first().isVisible().catch(() => false))) {
        return;
      }
    }
  }

  const pageText = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
  throw new Error(`Login did not complete for target "${targetPath}". Current URL: ${page.url()}\n${pageText}`);
}

export async function loginToAdmin(page: Page, targetPath = '/admin') {
  if (!adminEmail || !adminPassword) {
    throw new Error('Missing E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD');
  }

  await loginWithCredentials(page, { email: adminEmail, password: adminPassword }, targetPath);
}

export async function loginToCustomer(page: Page, targetPath = '/tai-khoan') {
  if (!customerEmail || !customerPassword) {
    throw new Error('Missing CUSTOMER_E2E_EMAIL or CUSTOMER_E2E_PASSWORD');
  }

  await loginWithCredentials(page, { email: customerEmail, password: customerPassword }, targetPath);
}
