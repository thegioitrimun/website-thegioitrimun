import { expect, test, type Page } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from '../shared/auth';
import { allowE2EMutation, createE2ELabel } from '../shared/mutation';

async function openPharmacyAdmin(page: Page, path = '/admin/nha-thuoc') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  if (path.includes('/categories')) {
    await expect(page.getByText(/Thêm chuyên mục mới/i)).toBeVisible();
    await expect(page.locator('input[placeholder="vi-du-slug"]').first()).toBeVisible();
    return;
  }

  if (path.includes('/brands')) {
    await expect(page.getByText(/Kho thương hiệu|Tạo thương hiệu mới|Cập nhật thương hiệu/i).first()).toBeVisible();
    await expect(page.locator('input[placeholder="la-roche-posay"]').first()).toBeVisible();
    return;
  }

  await expect(page.getByText(/Danh sách Sản phẩm/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Thêm Sản phẩm/i }).first()).toBeVisible();
}

async function acceptNextDialog(page: Page) {
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
}

async function selectFirstNonEmptyOption(selectLocator: ReturnType<Page['locator']>) {
  const options = selectLocator.locator('option');
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const value = (await options.nth(index).getAttribute('value')) || '';
    if (value.trim()) {
      await selectLocator.selectOption(value);
      return;
    }
  }
}

test.describe.serial('Admin pharmacy business flows', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');

  test('opens the product editor and returns safely to the product list', async ({ page }) => {
    await loginToAdmin(page, '/admin/nha-thuoc');
    await openPharmacyAdmin(page);

    await page.getByTitle('Sửa đầy đủ').first().click();

    await expect(page.locator('input[name="name"]').first()).toBeVisible();
    await expect(page.locator('input[name="slug"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="description"]').first()).toBeVisible();
    await expect(page.locator('input[name="price"]').first()).toBeVisible();
    await expect(page.locator('input[name="stock_quantity"]').first()).toBeVisible();
    await expect(page.getByText(/FAQ sản phẩm/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu thay đổi|Lưu & cập nhật website/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /Về danh sách/i }).first().click();
    await expect(page.getByText(/Danh sách Sản phẩm/i).first()).toBeVisible();
  });

  test('opens category and brand management shells', async ({ page }) => {
    await loginToAdmin(page, '/admin/nha-thuoc/categories');
    await openPharmacyAdmin(page, '/admin/nha-thuoc/categories');
    await expect(page.getByRole('button', { name: /Thêm mới/i }).first()).toBeVisible();

    await openPharmacyAdmin(page, '/admin/nha-thuoc/brands');
    await expect(page.getByRole('button', { name: /Tạo thương hiệu|Lưu thương hiệu/i }).first()).toBeVisible();
    await expect(page.locator('input[placeholder=\"Tìm theo tên, slug hoặc mô tả...\"]').first()).toBeVisible();
  });

  test('opens route-backed Online and POS order forms with conditional fields', async ({ page }) => {
    await loginToAdmin(page, '/admin/don-hang');
    await expect(page.getByRole('button', { name: /Tạo đơn online/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo đơn POS/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /Tạo đơn POS/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/don-hang\?.*action=new-order.*channel=pos/);
    await expect(page.getByRole('heading', { name: /Tạo đơn POS/i })).toBeVisible();
    await expect(page.getByLabel(/Trạng thái khi tạo/i)).toBeVisible();
    await expect(page.locator('input[name="province"]')).toHaveCount(0);

    await page.getByRole('button', { name: /Về danh sách đơn/i }).click();
    await page.getByRole('button', { name: /Tạo đơn online/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/don-hang\?.*action=new-order.*channel=online/);
    await expect(page.getByRole('heading', { name: /Tạo đơn online/i })).toBeVisible();
    await expect(page.locator('input[name="province"]')).toBeVisible();
    await expect(page.getByLabel(/Phương thức thanh toán/i)).toHaveValue('cod');
  });

  test('creates Online and POS orders and exposes receipt actions when mutation is enabled', async ({ page, context }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const addFirstProduct = async () => {
      const addButton = page.getByRole('button', { name: /^Thêm .+/i }).first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();
      await expect(page.getByText(/1 sản phẩm/i).last()).toBeVisible();
    };

    const verifyResultActions = async () => {
      await expect(page.getByText(/Tạo đơn thành công/i)).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /In A4/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /In 80mm/i })).toBeVisible();
      await page.getByRole('button', { name: /Sao chép gửi Zalo/i }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('ĐƠN HÀNG');

      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: /In A4/i }).click();
      const printPage = await popupPromise;
      await printPage.waitForLoadState('domcontentloaded').catch(() => null);
      await expect(printPage.locator('body')).toContainText(/HÓA ĐƠN|ĐƠN HÀNG/);
      await printPage.close();
    };

    await loginToAdmin(page, '/admin/don-hang?action=new-order&channel=pos');
    await addFirstProduct();
    await page.getByRole('button', { name: /^Tạo đơn POS$/i }).click();
    await verifyResultActions();

    await page.goto('/admin/don-hang?action=new-order&channel=online');
    await page.waitForLoadState('networkidle').catch(() => null);
    await addFirstProduct();
    await page.getByLabel(/Tên khách hàng/i).fill(createE2ELabel('online-order').name);
    await page.getByLabel(/Số điện thoại/i).fill('0901234567');

    const provinceInput = page.locator('input[name="province"]');
    const provinceOption = page.locator('datalist').first().locator('option').first();
    await expect(provinceOption).toHaveCount(1, { timeout: 30000 });
    await provinceInput.fill((await provinceOption.getAttribute('value')) || 'Thành phố Hồ Chí Minh');
    await provinceInput.blur();
    const wardInput = page.locator('input[name="ward"]');
    await expect(wardInput).toBeEnabled({ timeout: 30000 });
    const wardOption = page.locator('datalist').nth(1).locator('option').first();
    await expect(wardOption).toHaveCount(1, { timeout: 30000 });
    await wardInput.fill((await wardOption.getAttribute('value')) || 'Phường Sài Gòn');
    await page.locator('input[name="street"]').fill('1 Đường E2E');
    await page.getByRole('button', { name: /^Tạo đơn online$/i }).click();
    await verifyResultActions();
  });

  test('creates and removes an e2e product category when mutation is enabled', async ({ page }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');

    const draft = createE2ELabel('product-category');

    await loginToAdmin(page, '/admin/nha-thuoc/categories');
    await openPharmacyAdmin(page, '/admin/nha-thuoc/categories');

    await page.locator('input').filter({ has: page.locator('[value]') }).first().fill(draft.name);
    await page.locator('input[placeholder="vi-du-slug"]').first().fill(draft.slug);
    await page.getByRole('button', { name: /Thêm mới/i }).first().click();

    const createdCategory = page.locator('li').filter({ hasText: draft.name }).first();
    await expect(createdCategory).toBeVisible({ timeout: 30000 });

    await acceptNextDialog(page);
    await createdCategory.locator('button').last().click();
    await expect(page.getByText(draft.name)).toHaveCount(0, { timeout: 30000 });
  });

  test('creates and cleans up an e2e product when mutation is enabled', async ({ page }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');

    const draft = createE2ELabel('product');

    await loginToAdmin(page, '/admin/nha-thuoc');
    await openPharmacyAdmin(page);

    await page.getByRole('button', { name: /Thêm Sản phẩm/i }).first().click();

    await page.locator('input[name="name"]').first().fill(draft.name);
    await page.locator('input[name="slug"]').first().fill(draft.slug);
    await page.locator('textarea[name="description"]').first().fill(`Mô tả ngắn cho ${draft.name}`);
    await page.locator('input[name="price"]').first().fill('123000');
    await page.locator('input[name="stock_quantity"]').first().fill('7');

    const categorySelect = page.locator('select[name="category_id"]').first();
    const currentValue = await categorySelect.inputValue().catch(() => '');
    if (!currentValue) {
      await selectFirstNonEmptyOption(categorySelect);
    }

    await page.getByRole('button', { name: /Lưu thay đổi|Lưu & cập nhật website/i }).first().click();
    await expect(page.getByRole('button', { name: /Lưu thay đổi|Lưu & cập nhật website/i }).first()).toBeEnabled({ timeout: 30000 });

    await page.getByRole('button', { name: /Về danh sách/i }).first().click();
    const createdRow = page.locator('tr:visible').filter({ hasText: draft.name });
    await expect(createdRow).toHaveCount(1, { timeout: 30000 });

    await createdRow.getByRole('checkbox', { name: `Chọn sản phẩm ${draft.name}` }).check();
    await page.locator('select').filter({ has: page.locator('option[value="delete"]') }).selectOption('delete');
    await acceptNextDialog(page);
    await page.getByRole('button', { name: 'Áp dụng thao tác', exact: true }).click();

    await expect(page.locator('tr:visible').filter({ hasText: draft.name })).toHaveCount(0, { timeout: 30000 });
  });
});
