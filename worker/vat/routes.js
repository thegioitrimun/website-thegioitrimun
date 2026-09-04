import { methodNotAllowed } from '../platform/http.js';
import {
    amendVatPeriod,
    approveClassifications,
    approveDirectRates,
    commitVatImport,
    createInvoiceCorrection,
    createVatPeriod,
    downloadVatDocument,
    getMigrationStatus,
    getVatBootstrap,
    getVatExportData,
    listPurchaseInvoices,
    listSalesInvoices,
    listVatAdjustments,
    listVatPeriods,
    lockVatPeriod,
    markVatPeriodFiled,
    previewVatImport,
    rebuildVatPeriod,
    savePurchaseInvoice,
    saveSalesInvoice,
    saveTaxEntity,
    saveVatAdjustment,
    saveVatCategory,
    submitVatPeriodForReview,
    uploadVatDocument,
} from './handlers.js';

export async function maybeHandleVatRoute({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    if (!path.startsWith('/api/admin/vat/')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    const routes = new Map([
        ['/api/admin/vat/bootstrap', { GET: getVatBootstrap }],
        ['/api/admin/vat/migration-status', { GET: getMigrationStatus }],
        ['/api/admin/vat/entity', { PUT: saveTaxEntity }],
        ['/api/admin/vat/categories', { POST: saveVatCategory }],
        ['/api/admin/vat/classifications/approve', { POST: approveClassifications }],
        ['/api/admin/vat/direct-rates/approve', { POST: approveDirectRates }],
        ['/api/admin/vat/sales-invoices', { GET: listSalesInvoices, POST: saveSalesInvoice }],
        ['/api/admin/vat/purchase-invoices', { GET: listPurchaseInvoices, POST: savePurchaseInvoice }],
        ['/api/admin/vat/imports/preview', { POST: previewVatImport }],
        ['/api/admin/vat/periods', { GET: listVatPeriods, POST: createVatPeriod }],
        ['/api/admin/vat/adjustments', { GET: listVatAdjustments, POST: saveVatAdjustment }],
        ['/api/admin/vat/documents', { POST: uploadVatDocument }],
    ]);
    const direct = routes.get(path);
    if (direct) {
        const handler = direct[request.method];
        if (!handler) return methodNotAllowed(Object.keys(direct));
        return handler(request, env);
    }

    const importCommit = path.match(/^\/api\/admin\/vat\/imports\/([^/]+)\/commit$/);
    if (importCommit) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return commitVatImport(request, env, decodeURIComponent(importCommit[1]));
    }
    const correction = path.match(/^\/api\/admin\/vat\/sales-invoices\/([^/]+)\/corrections$/);
    if (correction) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return createInvoiceCorrection(request, env, decodeURIComponent(correction[1]));
    }
    const rebuild = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/rebuild$/);
    if (rebuild) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return rebuildVatPeriod(request, env, decodeURIComponent(rebuild[1]));
    }
    const review = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/submit-review$/);
    if (review) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return submitVatPeriodForReview(request, env, decodeURIComponent(review[1]));
    }
    const lock = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/lock$/);
    if (lock) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return lockVatPeriod(request, env, decodeURIComponent(lock[1]));
    }
    const filed = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/filed$/);
    if (filed) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return markVatPeriodFiled(request, env, decodeURIComponent(filed[1]));
    }
    const amendment = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/amend$/);
    if (amendment) {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return amendVatPeriod(request, env, decodeURIComponent(amendment[1]));
    }
    const exportData = path.match(/^\/api\/admin\/vat\/periods\/([^/]+)\/export$/);
    if (exportData) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getVatExportData(request, env, decodeURIComponent(exportData[1]));
    }
    const document = path.match(/^\/api\/admin\/vat\/documents\/([^/]+)$/);
    if (document) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return downloadVatDocument(request, env, decodeURIComponent(document[1]));
    }
    return null;
}
