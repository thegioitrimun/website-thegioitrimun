import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { requireSession } from '../worker/auth/session.js';

const root = new URL('../', import.meta.url);
const source = (file) => readFile(new URL(file, root), 'utf8');

test('admin D1 exposes every required read contract', async () => {
    const [routes, handlers, content, client] = await Promise.all([
        source('worker/adminD1/routes.js'),
        source('worker/adminD1/handlers.js'),
        source('worker/adminD1/contentHandlers.js'),
        source('services/api.ts'),
    ]);
    for (const endpoint of [
        '/api/admin/products', '/api/admin/orders', '/api/admin/services',
        '/api/admin/blog-posts', '/api/admin/blog-categories',
        '/api/admin/product-categories', '/api/admin/product-brands',
        '/api/admin/appointments', '/api/admin/users',
        '/api/admin/media-assets', '/api/admin/system/capabilities',
        '/api/admin/system/operations', '/api/admin/report-schedules',
    ]) assert.ok(routes.includes(endpoint), `missing admin endpoint ${endpoint}`);

    assert.match(handlers, /listPayload\(/);
    assert.match(content, /listPayload\(/);
    assert.match(client, /adminDataProvider/);
    assert.match(client, /getAdminSystemOperations/);
    assert.match(client, /getBlogPostBySlugAdmin[\s\S]*?if \(USE_D1_API\)[\s\S]*?getAdminBlogPosts/);
    assert.match(content, /parsed == null \? fallback : parsed/);
});

test('all admin writes require CSRF and admin roles only', async () => {
    const [handlers, content, support, worker, adminTools] = await Promise.all([
        source('worker/adminD1/handlers.js'),
        source('worker/adminD1/contentHandlers.js'),
        source('worker/adminD1/support.js'),
        source('_worker.js'),
        source('worker/adminTools/handlers.js'),
    ]);
    assert.match(handlers, /requireRole\(db, request, \['admin', 'master_admin'\]\)/);
    assert.match(content, /requireRole\(db, request, \['admin', 'master_admin'\]\)/);
    assert.match(handlers, /requireCsrf\(db, request, session\)/);
    assert.match(content, /requireCsrf\(db, request, session\)/);
    assert.match(support, /INSERT INTO admin_audit_log/);
    assert.match(adminTools, /writeAdminToolAudit/);
    assert.match(worker, /authorizeAdminEditorAccess[\s\S]*?\['admin', 'master_admin'\]/);
});

test('read-only authentication avoids D1 session write bursts', async () => {
    const updates = [];
    const db = {
        prepare(sql) {
            if (/FROM sessions s/i.test(sql)) {
                return {
                    bind() {
                        return {
                            first: async () => ({
                                session_id: 'session-1',
                                user_id: 'admin-1',
                                email: 'admin@example.com',
                                role_codes: 'master_admin',
                                expires_at: '2099-01-01T00:00:00.000Z',
                            }),
                        };
                    },
                };
            }
            if (/UPDATE sessions SET last_seen_at/i.test(sql)) {
                return {
                    bind(...values) {
                        return { run: async () => updates.push(values) };
                    },
                };
            }
            throw new Error(`Unexpected SQL in session test: ${sql}`);
        },
    };
    const request = (method) => new Request('https://thegioitrimun.vn/api/admin/users', {
        method,
        headers: { Cookie: 'tg_session=session-token' },
    });

    await requireSession(db, request('GET'));
    assert.equal(updates.length, 0, 'GET authentication must remain read-only');

    await requireSession(db, request('POST'));
    assert.equal(updates.length, 1, 'mutations should still refresh session activity');
});

test('media library tracks references and prevents unsafe deletion', async () => {
    const [media, content, migration] = await Promise.all([
        source('worker/mediaR2/handlers.js'),
        source('worker/adminD1/contentHandlers.js'),
        source('d1/app/migrations/0014_admin_data_parity.sql'),
    ]);
    assert.match(media, /MEDIA_REFERENCE_SOURCES/);
    assert.match(media, /MEDIA_IN_USE/);
    assert.match(content, /collectAdminMediaUsage/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS media_assets/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_audit_log/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS migration_issues/);
});

test('admin module loading is isolated and cached per resource', async () => {
    const [bootstrap, provider, app] = await Promise.all([
        source('hooks/useAppBootstrap.ts'),
        source('src/admin/AdminDataProvider.ts'),
        source('App.tsx'),
    ]);
    assert.match(bootstrap, /adminModuleStates/);
    assert.match(bootstrap, /Promise\.allSettled/);
    assert.match(bootstrap, /scheduleDeferredTask/);
    assert.match(provider, /inFlight/);
    assert.match(provider, /invalidate/);
    assert.match(app, /AdminWorkspaceLayout/);
    assert.doesNotMatch(provider, /supabase/i);
});

test('admin product image reads respect D1 binding limits and alerts use order joins', async () => {
    const handlers = await source('worker/adminD1/handlers.js');
    assert.match(handlers, /PRODUCT_IMAGE_QUERY_BATCH_SIZE = 80/);
    assert.match(handlers, /index \+= PRODUCT_IMAGE_QUERY_BATCH_SIZE/);
    assert.match(handlers, /LEFT JOIN product_orders o ON o\.id = s\.order_id/);
    assert.match(handlers, /COALESCE\(o\.order_code, s\.order_id\)/);
});

test('admin order creation exposes guarded Online/POS contracts and safe receipt actions', async () => {
    const [routes, handlers, client, form, adminPage, migration, receipt] = await Promise.all([
        source('worker/orders/routes.js'),
        source('worker/orders/handlers.js'),
        source('services/api.ts'),
        source('components/AdminOrderCreatePage.tsx'),
        source('components/AdminPharmacyManagementPage.tsx'),
        source('d1/app/migrations/0019_admin_order_channels.sql'),
        source('src/orderReceipt.ts'),
    ]);

    assert.match(routes, /\/api\/admin\/orders\/quote/);
    assert.match(routes, /path === '\/api\/admin\/orders' && request\.method === 'POST'/);
    assert.match(handlers, /requireRole\(db, request, \['admin', 'master_admin'\]\)/);
    assert.match(handlers, /requireCsrf\(db, request, session\)/);
    assert.match(handlers, /recordAdminAuditAttempt/);
    assert.match(handlers, /checkout_idempotency_key/);
    assert.match(handlers, /\['paid_completed', 'unpaid_processing'\]\.includes\(workflow\)/);
    assert.match(handlers, /workflow === 'paid_completed'/);
    assert.match(handlers, /channel === 'pos'[\s\S]*?new Set\(\['cash', 'bank_transfer'\]\)[\s\S]*?: new Set\(\['cod', 'bank_transfer'\]\)/);
    assert.match(handlers, /stock_quantity = stock_quantity - \?/);
    assert.match(handlers, /if \(customerPhone\)[\s\S]*?createPancakeCustomerOutboxStatement/);

    assert.match(client, /Idempotency-Key/);
    assert.match(client, /quoteAdminProductOrderTotals/);
    assert.match(client, /createAdminProductOrder/);
    assert.match(form, /In A4/);
    assert.match(form, /In 80mm/);
    assert.match(form, /Sao chép gửi Zalo/);
    assert.match(adminPage, /lazy\(\(\) => import\('\.\/AdminOrderCreatePage'\)\)/);
    assert.match(adminPage, /orderChannelFilter/);

    assert.match(migration, /payment_method IN \('cod', 'bank_transfer', 'cash'\)/);
    assert.match(migration, /order_channel TEXT NOT NULL DEFAULT 'online'/);
    assert.match(migration, /product_orders_channel_idx/);
    assert.match(migration, /PRAGMA defer_foreign_keys = ON/);
    for (const dependent of ['product_order_items', 'order_payment_logs', 'order_status_history', 'shipping_outbox', 'sepay_order_links']) {
        assert.match(migration, new RegExp(`_0019_${dependent}`), `missing migration backup for ${dependent}`);
    }

    assert.match(receipt, /buildOrderShareText/);
    assert.match(receipt, /receipt80/);
    assert.match(receipt, /printWindow\.print/);
});
