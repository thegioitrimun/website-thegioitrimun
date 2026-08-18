import { expect, test, type Locator, type Page } from '@playwright/test';
import { isAdminAuthConfigured, loginToAdmin } from '../shared/auth';
import { allowE2EMutation, createE2ELabel } from '../shared/mutation';

async function openBlogAdmin(page: Page, path = '/admin/blog') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  if (path.includes('/categories')) {
    await expect(page.getByRole('button', { name: /Thêm mới|Cập nhật chuyên mục/i }).first()).toBeVisible();
    await expect(page.locator('input[placeholder="vi-du-slug"]').first()).toBeVisible();
    return;
  }

  await expect(page.getByRole('button', { name: /Thêm bài viết/i }).first()).toBeVisible();
  await expect(page.getByText(/Toàn bộ bài viết|Danh sách bài viết|Hàng đợi SEO|Thiếu ảnh/i).first()).toBeVisible();
}

async function clickFirstVisible(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }
  throw new Error('No visible locator found to click.');
}

test.describe.serial('Admin blog business flows', () => {
  test.skip(!isAdminAuthConfigured(), 'Missing E2E admin credentials.');

  test('opens the post editor and returns safely to the list', async ({ page }) => {
    await loginToAdmin(page, '/admin/blog');
    await openBlogAdmin(page);

    await clickFirstVisible(page.locator('[data-testid^="admin-blog-edit-post-"]'));

    await expect(page.getByTestId('admin-blog-post-editor')).toBeVisible();
    await expect(page.locator('input[name="title"]').first()).toBeVisible();
    await expect(page.locator('input[name="slug"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="summary"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="content"]').first()).toBeVisible();
    await expect(page.locator('select[name="category_slug"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="meta_description"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu bài viết/i })).toBeVisible();

    await page.getByRole('button', { name: /^Hủy$/i }).click();
    await expect(page.getByRole('button', { name: /Thêm bài viết/i }).first()).toBeVisible();
  });

  test('opens the category management shell and edit mode', async ({ page }) => {
    await loginToAdmin(page, '/admin/blog/categories');
    await openBlogAdmin(page, '/admin/blog/categories');

    const firstCategoryItem = page.locator('ul li').first();
    await expect(firstCategoryItem).toBeVisible();
    await firstCategoryItem.locator('button').first().click();

    await expect(page.getByRole('heading', { name: /Chỉnh sửa chuyên mục/i })).toBeVisible();
    const slugField = page.locator('input[placeholder="vi-du-slug"]').first();
    await expect(slugField).toBeDisabled();
    await expect(page.getByRole('button', { name: /Cập nhật chuyên mục/i }).first()).toBeVisible();
  });

  test('creates and removes an e2e post when mutation is enabled', async ({ page }) => {
    test.skip(!allowE2EMutation, 'E2E_ALLOW_MUTATION is disabled.');

    const draft = createE2ELabel('blog');

    await loginToAdmin(page, '/admin/blog');
    await openBlogAdmin(page);

    await page.getByRole('button', { name: /Thêm bài viết/i }).first().click();

    await page.locator('input[name="title"]').first().fill(draft.name);
    await page.locator('input[name="slug"]').first().fill(draft.slug);
    await page.locator('textarea[name="summary"]').first().fill(`Tóm tắt cho ${draft.name}`);
    await page.locator('textarea[name="content"]').first().fill(`### ${draft.name}\n\nNội dung kiểm thử cho ${draft.name}.`);
    await page.locator('textarea[name="meta_description"]').first().fill(`Mô tả SEO cho ${draft.name}`);

    const categorySelect = page.locator('select[name="category_slug"]').first();
    const optionCount = await categorySelect.locator('option').count();
    for (let index = 0; index < optionCount; index += 1) {
      const option = categorySelect.locator('option').nth(index);
      const value = (await option.getAttribute('value')) || '';
      if (value.trim()) {
        await categorySelect.selectOption(value);
        break;
      }
    }

    await page.getByRole('button', { name: /Lưu bài viết/i }).click();
    await expect(page.getByRole('button', { name: /Lưu bài viết/i })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: /^Hủy$/i }).click();

    await expect(page.getByText(draft.name).first()).toBeVisible({ timeout: 30000 });

    if (await page.locator('tbody tr').filter({ hasText: draft.name }).count()) {
      const row = page.locator('tbody tr').filter({ hasText: draft.name }).first();
      await row.locator('button').last().click();
    } else {
      const card = page.locator('article').filter({ hasText: draft.name }).first();
      await card.getByRole('button', { name: /^Xóa$/i }).click();
    }

    await expect(page.getByText(draft.name)).toHaveCount(0, { timeout: 30000 });
  });
});
