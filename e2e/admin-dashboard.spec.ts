import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { adminEmail, isAdminAuthConfigured, loginToAdmin } from './shared/auth';

async function createScheduledReportWithRetry(page: Page, scheduleName: string) {
  const scheduleCard = page.locator(`[data-testid="admin-report-schedule-card"][data-schedule-name="${scheduleName}"]`);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel('Tên lịch').fill(scheduleName);
    await page.getByLabel('Email nhận báo cáo').fill(adminEmail!);
    await page.getByRole('button', { name: 'Tạo lịch' }).click();

    if (await scheduleCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      return scheduleCard;
    }

    const saveErrorToast = page.getByText('Không thể lưu lịch gửi báo cáo').last();
    if (await saveErrorToast.isVisible().catch(() => false)) {
      await page.waitForTimeout(1500);
    }
  }

  await expect(scheduleCard).toBeVisible({ timeout: 30000 });
  return scheduleCard;
}

test.describe.serial('Admin dashboard', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');
  let context: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginToAdmin(sharedPage, '/admin');
    await expect(sharedPage.getByRole('heading', { name: 'Dashboard quản trị' })).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('renders compact overview and panel navigation', async () => {
    await sharedPage.getByRole('button', { name: 'Tổng quan', exact: true }).click();
    await expect(sharedPage.getByRole('button', { name: 'Tổng quan', exact: true })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Xu hướng gọn theo kỳ' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Điều hành ngắn gọn' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Các điểm cần để ý' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: '7 ngày' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: '30 ngày' })).toBeVisible();

    await sharedPage.getByRole('button', { name: 'Khách hàng', exact: true }).click();
    await expect(sharedPage.getByRole('heading', { name: 'Phân tích khách hàng' })).toBeVisible();
    await expect(sharedPage.getByText('Chỉ hiện khách at risk')).toBeVisible();

    await sharedPage.getByRole('button', { name: 'Lịch hẹn', exact: true }).click();
    await expect(sharedPage.getByRole('heading', { name: 'Drill-down lịch hẹn và dịch vụ' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Xuất Excel' })).toBeVisible();
  });

  test('supports order filters and bulk selection shell', async () => {
    await expect(sharedPage.getByRole('button', { name: 'Đơn hàng', exact: true })).toBeVisible({ timeout: 30000 });
    await sharedPage.getByRole('button', { name: 'Đơn hàng', exact: true }).click();
    await expect(sharedPage.getByRole('heading', { name: 'Đơn hàng, thanh toán, hoàn tiền' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Bộ lọc thao tác' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Dọn pending orders cũ hàng loạt' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Xuất Excel' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Chọn toàn bộ danh sách lọc' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Áp dụng hàng loạt' })).toBeVisible();

    const clearSelectionButton = sharedPage.getByRole('button', { name: 'Xóa vùng chọn' });
    const bulkUpdateButton = sharedPage.getByRole('button', { name: 'Áp dụng hàng loạt' });
    await expect(clearSelectionButton).toBeDisabled();
    await expect(bulkUpdateButton).toBeDisabled();

    const emptyOrdersState = sharedPage.getByText('Không có đơn hàng nào khớp bộ lọc hiện tại.');
    if (await emptyOrdersState.isVisible().catch(() => false)) {
      await expect(emptyOrdersState).toBeVisible();
      return;
    }

    const firstOrderCheckbox = sharedPage.getByRole('checkbox').nth(2);
    await expect(firstOrderCheckbox).toBeVisible();
    await firstOrderCheckbox.check();

    await expect(clearSelectionButton).toBeEnabled();
    await expect(bulkUpdateButton).toBeEnabled();

    await clearSelectionButton.click();
    await expect(clearSelectionButton).toBeDisabled();
    await expect(bulkUpdateButton).toBeDisabled();
  });

  test('creates and deletes a scheduled report', async () => {
    const scheduleName = `E2E Admin Report ${Date.now()}`;

    await expect(sharedPage.getByRole('button', { name: 'Báo cáo', exact: true })).toBeVisible({ timeout: 30000 });
    await sharedPage.getByRole('button', { name: 'Báo cáo', exact: true }).click();
    await expect(sharedPage.getByRole('heading', { name: 'Xuất báo cáo định kỳ' })).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Lịch gửi email báo cáo thật' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: /Tạo lịch|Cập nhật lịch/ })).toBeVisible();

    const scheduleCard = await createScheduledReportWithRetry(sharedPage, scheduleName);
    await expect(scheduleCard.getByTestId('admin-report-schedule-recipients')).toContainText(adminEmail!, { timeout: 30000 });
    await scheduleCard.getByTestId('admin-report-schedule-delete').click();
    await expect(scheduleCard).toHaveCount(0, { timeout: 30000 });
  });
});
