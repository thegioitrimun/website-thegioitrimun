import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
