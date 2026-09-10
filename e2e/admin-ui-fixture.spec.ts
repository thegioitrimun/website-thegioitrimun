import { test, expect } from '@playwright/test';
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.PLAYWRIGHT_BASE_URL || '');
test.skip(!local, 'The component fixture is development-only and must run on localhost.');
for (const viewport of [{width:1440,height:1100},{width:390,height:844},{width:834,height:1194}]) {
  test(`admin shell, theme and dialog at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/admin-ui-preview.html');
    await expect(page.getByRole('heading',{name:'Đơn hàng',level:1})).toHaveCount(1);
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('[data-admin-theme]').first()).toHaveAttribute('data-admin-theme','light');
    const main = page.locator('main'); const before = await main.boundingBox();
    await page.getByRole('button',{name:'Mở menu quản trị',exact:true}).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    expect(Math.round((await dialog.boundingBox())!.width)).toBe(viewport.width>=1024?268:320);
    expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);
    await dialog.getByRole('button',{name:'Đóng',exact:true}).press('Escape');
    await expect(page.getByRole('button',{name:'Mở menu quản trị',exact:true})).toBeFocused();
    const after = await main.boundingBox();expect(after!.x).toBe(before!.x);
    if(viewport.width<1024) await page.getByRole('button',{name:'Mở menu quản trị',exact:true}).click();
    await page.getByRole('button',{name:'Bật giao diện tối',exact:true}).click();
    if(viewport.width<1024) await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
    await expect(page.locator('[data-admin-theme]').first()).toHaveAttribute('data-admin-theme','dark');
    await page.getByRole('button',{name:'Tạo đơn mẫu',exact:true}).click();
    await expect(page.locator('#admin-portal-root')).toHaveAttribute('data-admin-theme','dark');
    await page.getByRole('dialog').getByRole('button',{name:'Đóng bản mẫu',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`output/admin-unification-${viewport.width}-dark.png`,fullPage:false});
    expect(errors).toEqual([]);
  });
}
test('search, sort, cross-page selection and stable loading button', async ({page})=>{
  await page.setViewportSize({width:1440,height:1100});await page.goto('/admin-ui-preview.html');
  const width=(await page.getByTestId('stable-button').boundingBox())!.width;
  await page.getByRole('button',{name:'Đổi trạng thái bận'}).click();
  expect((await page.getByTestId('stable-button').boundingBox())!.width).toBe(width);
  await page.getByRole('checkbox',{name:'Chọn mục DH-0001',exact:true}).check();
  expect(await page.getByRole('checkbox',{name:'Chọn tất cả mục trên trang'}).evaluate((e:HTMLInputElement)=>e.indeterminate)).toBe(true);
  await page.getByRole('button',{name:'Sau',exact:true}).click();
  await page.getByRole('checkbox',{name:'Chọn mục DH-0031',exact:true}).check();
  await expect(page.getByRole('region',{name:'Thao tác hàng loạt trên các mục đã chọn'})).toContainText('Đã chọn 2');
  await page.getByRole('textbox',{name:'Tìm đơn mẫu'}).fill('DH-0002');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Thao tác hàng loạt trên các mục đã chọn'})).toHaveCount(0);
  await page.getByRole('button',{name:'Xóa nội dung'}).click();
  await expect(page.getByRole('textbox',{name:'Tìm đơn mẫu'})).toBeFocused();
  await page.getByRole('button',{name:'Tổng tiền',exact:true}).click();
  await expect(page.locator('tbody tr').first()).toContainText('DH-0035');
});
test('public dark mode does not force the admin theme dark',async({page})=>{
  await page.addInitScript(()=>document.documentElement.classList.add('dark','theme-violet'));
  await page.goto('/admin-ui-preview.html');
  const root=page.locator('[data-admin-theme]').first();
  await expect(root).toHaveAttribute('data-admin-theme','light');
  expect(await root.evaluate(e=>getComputedStyle(e).getPropertyValue('--primary').trim())).toBe('170 58% 35%');
  const button=page.getByRole('button',{name:'Tạo đơn mẫu',exact:true});
  expect(await button.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(255, 255, 255)');
});
