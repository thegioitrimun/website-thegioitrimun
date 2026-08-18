import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE_URL = (process.argv[2] || process.env.PLAYWRIGHT_BASE_URL || 'https://thegioitrimun.vn').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('[FAIL] Missing E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD');
  process.exit(1);
}

const OUTPUT_DIR = 'output/playwright/admin-ui-runtime';

const VIEWPORTS = {
  mobileSmall: { width: 390, height: 844 },
  mobile: { width: 430, height: 932 },
  tablet: { width: 834, height: 1194 },
  desktopCompact: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 1100 },
};

const ROUTE_CHECKS = [
  {
    label: 'dashboard',
    path: '/admin',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'role-heading', value: /Dashboard quản trị/i },
        { kind: 'text', value: /Xu hướng gọn theo kỳ/i },
      ]);
    },
  },
  {
    label: 'pharmacy',
    path: '/admin/nha-thuoc',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Danh sách Sản phẩm/i },
        { kind: 'role-button', value: /Thêm Sản phẩm/i },
      ]);
    },
  },
  {
    label: 'blog',
    path: '/admin/blog',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Danh sách Bài viết/i },
        { kind: 'role-button', value: /Thêm bài viết/i },
      ]);
    },
  },
  {
    label: 'users',
    path: '/admin/nguoi-dung',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Điều phối người dùng/i },
        { kind: 'text', value: /Tổng tài khoản/i },
      ]);
    },
  },
  {
    label: 'services',
    path: '/admin/dich-vu',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Danh sách Dịch vụ/i },
        { kind: 'role-button', value: /Thêm dịch vụ/i },
      ]);
    },
  },
  {
    label: 'site-branding',
    path: '/admin/noi-dung/branding',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Branding hệ thống/i },
        { kind: 'text', value: /Thương hiệu & Logo/i },
      ]);
    },
  },
  {
    label: 'site-faq',
    path: '/admin/noi-dung/faq',
    check: async (page) => {
      await expectVisible(page, [
        { kind: 'text', value: /Quản lý FAQ/i },
        { kind: 'role-button', value: /Thêm FAQ/i },
      ]);
    },
  },
];

const CONSOLE_IGNORE_PATTERNS = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of \d+/i,
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isIgnoredConsoleError(text) {
  return CONSOLE_IGNORE_PATTERNS.some((pattern) => pattern.test(text));
}

function createDiagnostics(page) {
  const events = [];

  const push = (type, text) => {
    events.push({ type, text });
  };

  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text().trim();
    if (!text || isIgnoredConsoleError(text)) return;
    push('console', text);
  };

  const onPageError = (error) => {
    const text = String(error?.message || error || '').trim();
    if (!text) return;
    push('pageerror', text);
  };

  const onResponse = (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (!url.startsWith(BASE_URL)) return;
    push('response', `${status} ${url}`);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  return {
    takeNew() {
      return events.splice(0, events.length);
    },
    dispose() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
    },
  };
}

function formatEvents(events) {
  const groups = new Map();

  for (const event of events) {
    const groupKey = event.type === 'response' && /\/r2\//.test(event.text)
      ? 'missing-r2-asset'
      : event.type;
    const next = groups.get(groupKey) || [];
    next.push(event.text);
    groups.set(groupKey, next);
  }

  return Array.from(groups.entries())
    .map(([groupKey, items]) => {
      const uniqueItems = [...new Set(items)];
      const header = groupKey === 'missing-r2-asset'
        ? 'missing-r2-asset'
        : groupKey;
      return `- ${header}:\n${uniqueItems.map((item) => `  • ${item}`).join('\n')}`;
    })
    .join('\n');
}

async function expectVisible(page, selectors) {
  let lastError = null;
  for (const selector of selectors) {
    try {
      const locator = getLocator(page, selector);
      await locator.first().waitFor({ state: 'visible', timeout: 20000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No selector became visible');
}

function getLocator(page, selector) {
  switch (selector.kind) {
    case 'role-heading':
      return page.getByRole('heading', { name: selector.value });
    case 'role-button':
      return page.getByRole('button', { name: selector.value });
    case 'text':
    default:
      return page.getByText(selector.value);
  }
}

async function loginToAdmin(page) {
  await page.goto(`${BASE_URL}/dang-nhap`, { waitUntil: 'domcontentloaded' });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const emailField = page.locator('input[name="email"]').first();
    const maintenanceGate = page.getByText(/Đăng nhập tạm thời chưa khả dụng/i);

    if (await emailField.isVisible().catch(() => false)) {
      break;
    }

    if (await maintenanceGate.isVisible().catch(() => false)) {
      const retryButton = page.getByRole('button', { name: 'Kiểm tra lại' });
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
        await page.waitForTimeout(2000);
        continue;
      }
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  }

  const emailField = page.locator('input[name="email"]').first();
  await emailField.waitFor({ state: 'visible', timeout: 20000 });
  await emailField.fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/dang-nhap'), { timeout: 30000 }).catch(() => null);
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Dashboard quản trị/i }).waitFor({ state: 'visible', timeout: 30000 });
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    moduleButtons: Array.from(document.querySelectorAll('nav button'))
      .filter((button) => {
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .slice(0, 6)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      }),
  }));

  assert(
    metrics.documentWidth <= metrics.innerWidth + 1 && metrics.bodyWidth <= metrics.innerWidth + 1,
    `[${label}] Horizontal overflow detected (${metrics.documentWidth}/${metrics.bodyWidth} > ${metrics.innerWidth})`,
  );

  const clippedButton = metrics.moduleButtons.find((button) => button.left < -1 || button.right > metrics.innerWidth + 1);
  assert(!clippedButton, `[${label}] Module navigation button is clipped out of viewport`);
}

async function assertContentNotBlank(page, label) {
  const content = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || document.body.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      length: text.length,
      childCount: main?.children.length || 0,
    };
  });

  assert(content.length >= 80, `[${label}] Main content text is unexpectedly short (${content.length})`);
  assert(content.childCount >= 1, `[${label}] Main content appears empty`);
}

async function checkFaqInputFlow(page, viewportKey) {
  await page.goto(`${BASE_URL}/admin/noi-dung/faq`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expectVisible(page, [
    { kind: 'text', value: /Quản lý FAQ/i },
    { kind: 'role-button', value: /Thêm FAQ/i },
  ]);

  const addButton = page.getByRole('button', { name: /Thêm FAQ/i }).first();
  await addButton.click();

  const faqForm = page.locator('form').first();
  const questionInput = faqForm.locator('input[type="text"]').first();
  const answerTextarea = faqForm.locator('textarea').first();

  await questionInput.fill(`Câu hỏi test khoảng trắng ${viewportKey}`);
  await questionInput.press('End');
  await questionInput.type(' thêm dấu cách', { delay: 20 });
  const activeTagAfterQuestion = await page.evaluate(() => document.activeElement?.tagName);
  assert(activeTagAfterQuestion === 'INPUT', `[faq-${viewportKey}] Question input lost focus while typing spaces`);

  const questionValue = await questionInput.inputValue();
  assert(questionValue.includes('dấu cách'), `[faq-${viewportKey}] Question input did not retain typed spaces`);

  await answerTextarea.fill('Đây là câu trả lời kiểm tra dấu cách');
  await answerTextarea.press('End');
  await answerTextarea.type(' và vẫn giữ focus', { delay: 20 });
  const activeTagAfterAnswer = await page.evaluate(() => document.activeElement?.tagName);
  assert(activeTagAfterAnswer === 'TEXTAREA', `[faq-${viewportKey}] Answer textarea lost focus while typing spaces`);

  const answerValue = await answerTextarea.inputValue();
  assert(answerValue.includes('giữ focus'), `[faq-${viewportKey}] Answer textarea did not retain typed spaces`);

  await assertNoHorizontalOverflow(page, `faq-${viewportKey}`);
  await assertContentNotBlank(page, `faq-${viewportKey}`);
}

async function runViewportAudit(browser, viewportKey, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);

  try {
    await loginToAdmin(page);
    const loginEvents = diagnostics.takeNew();
    assert(loginEvents.length === 0, `[login-${viewportKey}] Runtime errors detected:\n${formatEvents(loginEvents)}`);

    for (const route of ROUTE_CHECKS) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      await route.check(page);
      await assertNoHorizontalOverflow(page, `${route.label}-${viewportKey}`);
      await assertContentNotBlank(page, `${route.label}-${viewportKey}`);
      const events = diagnostics.takeNew();
      assert(events.length === 0, `[${route.label}-${viewportKey}] Runtime errors detected:\n${formatEvents(events)}`);
      console.log(`[PASS] ${route.label} (${viewportKey})`);
    }

    await checkFaqInputFlow(page, viewportKey);
    const faqEvents = diagnostics.takeNew();
    assert(faqEvents.length === 0, `[faq-${viewportKey}] Runtime errors detected:\n${formatEvents(faqEvents)}`);
    console.log(`[PASS] faq-input (${viewportKey})`);
  } catch (error) {
    const safeBase = BASE_URL.replace(/https?:\/\//, '').replace(/[^\w.-]+/g, '_');
    await page.screenshot({ path: `${OUTPUT_DIR}/${safeBase}-${viewportKey}-failure.png`, fullPage: true });
    throw error;
  } finally {
    diagnostics.dispose();
    await context.close();
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [viewportKey, viewport] of Object.entries(VIEWPORTS)) {
      console.log(`== Admin UI runtime audit: ${viewportKey} @ ${viewport.width}x${viewport.height} ==`);
      await runViewportAudit(browser, viewportKey, viewport);
    }
    console.log(`[PASS] Admin UI runtime audit passed for ${BASE_URL}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[FAIL] Admin UI runtime audit failed');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
