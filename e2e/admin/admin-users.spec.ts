import { expect, test, type Page } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from '../shared/auth';

async function expectAnyVisibleSelect(page: Page) {
  const selects = page.locator('select');
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = selects.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await expect(candidate).toBeVisible();
      return;
    }
  }
  throw new Error('No visible select found on the page.');
}

async function openUsersAdmin(page: Page, path = '/admin/nguoi-dung') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  if (path.includes('/doctors')) {
    await expect(page.getByRole('heading', { name: /Quản lý bác sĩ/i }).first()).toBeVisible();
    return;
  }

  if (path.includes('/roles')) {
    await expect(page.getByText(/Role nhạy cảm|Tổng tài khoản/i).first()).toBeVisible();
    return;
  }

  await expect(page.getByRole('heading', { name: /Quản lý bác sĩ/i }).first()).toBeVisible();
}

test.describe.serial('Admin user business flows', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');

  test('opens doctor editor and returns safely', async ({ page }) => {
    await loginToAdmin(page, '/admin/nguoi-dung/doctors');
    await openUsersAdmin(page, '/admin/nguoi-dung/doctors');

    const doctorRows = page.locator('tbody tr');
    if (await doctorRows.count()) {
      await doctorRows.first().locator('button').first().click();
    } else {
      await page.getByRole('button', { name: /^Sửa$/i }).first().click();
    }

    await expect(page.locator('input[name="username"]').first()).toBeVisible();
    await expect(page.locator('input[name="job_title"]').first()).toBeVisible();
    await expect(page.locator('input[name="specialization"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="qualification"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu hồ sơ/i })).toBeVisible();

    await page.getByRole('button', { name: /^Hủy$/i }).click();
    await expect(page.getByRole('heading', { name: /Quản lý bác sĩ/i }).first()).toBeVisible();
  });

  test('opens roles governance and redirects removed user sections', async ({ page }) => {
    await loginToAdmin(page, '/admin/nguoi-dung/roles');
    await openUsersAdmin(page, '/admin/nguoi-dung/roles');
    await expectAnyVisibleSelect(page);

    await openUsersAdmin(page, '/admin/nguoi-dung/doctor_pipeline');
    await expect(page.getByRole('heading', { name: /Quản lý bác sĩ/i }).first()).toBeVisible();
    await expect(page.getByText(/Pipeline promote|Quản lý Khách hàng|Tổng quan \(/i)).toHaveCount(0);
  });
});
