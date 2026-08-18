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
