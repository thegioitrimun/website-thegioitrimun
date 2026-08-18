import { methodNotAllowed } from '../platform/http.js';
import {
    appendAdminProductImages,
    deleteAdminProduct,
    deleteDiscountCode,
    deleteProductBrand,
    deleteProductCategory,
    deleteReportSchedule,
    deleteTaxProfile,
    deleteTaxRate,
    getAdminOrderLifecycle,
    getAlerts,
    getAppointmentsDrilldown,
    getCustomerMetrics,
    getDashboardKpi,
    getDashboardTimeseries,
    getInventoryMetrics,
    getServicePerformance,
    getTopProducts,
    listAdminOrders,
    listAdminProducts,
    listProductBrands,
    listProductCategories,
    listDiscountCodes,
    listReportSchedules,
    listTaxProfiles,
    promoteAdminProductImages,
    renameProductBrand,
    saveAdminProduct,
    saveDiscountCode,
    saveProductBrand,
    saveProductCategory,
    saveReportSchedule,
    saveTaxProfile,
    saveTaxRate,
} from './handlers.js';
import {
    deleteAdminBlogCategory, deleteAdminBlogPost, deleteAdminService, deleteAdminSiteContent,
    deleteMedicalRecord, getAdminCapabilities, getAdminOperations, getAdminUserDetail, listAdminAppointments,
    listAdminBlogCategories, listAdminBlogPosts, listAdminMediaAssets, listAdminServices,
    listAdminSiteContent, listAdminUsers, listMedicalRecords,
    saveAdminBlogCategory, saveAdminBlogPost, saveAdminService, saveAdminSiteContent,
    saveMedicalRecord, updateAdminUser,
} from './contentHandlers.js';

export async function maybeHandleAdminD1Route({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    if (!path.startsWith('/api/admin/')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    const getRoutes = new Map([
        ['/api/admin/orders', listAdminOrders],
        ['/api/admin/dashboard/kpi', getDashboardKpi],
        ['/api/admin/dashboard/timeseries', getDashboardTimeseries],
        ['/api/admin/dashboard/inventory', getInventoryMetrics],
        ['/api/admin/dashboard/top-products', getTopProducts],
        ['/api/admin/dashboard/services', getServicePerformance],
        ['/api/admin/dashboard/customers', getCustomerMetrics],
        ['/api/admin/dashboard/appointments', getAppointmentsDrilldown],
        ['/api/admin/dashboard/alerts', getAlerts],
    ]);
    if (getRoutes.has(path)) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getRoutes.get(path)(request, env);
    }

    if (path === '/api/admin/report-schedules') {
        if (request.method === 'GET') return listReportSchedules(request, env);
        if (request.method === 'POST') return saveReportSchedule(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }

    if (path === '/api/admin/products') {
        if (request.method === 'GET') return listAdminProducts(request, env);
        if (request.method === 'POST') return saveAdminProduct(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/services') {
        if (request.method === 'GET') return listAdminServices(request, env);
        if (request.method === 'POST') return saveAdminService(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/blog-posts') {
        if (request.method === 'GET') return listAdminBlogPosts(request, env);
        if (request.method === 'POST') return saveAdminBlogPost(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/blog-categories') {
        if (request.method === 'GET') return listAdminBlogCategories(request, env);
        if (request.method === 'POST') return saveAdminBlogCategory(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/users') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return listAdminUsers(request, env);
    }
    if (path === '/api/admin/medical-records') {
        if (request.method === 'GET') return listMedicalRecords(request, env);
        if (request.method === 'POST') return saveMedicalRecord(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/products/gallery/append') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return appendAdminProductImages(request, env);
    }
    if (path === '/api/admin/products/gallery/promote') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return promoteAdminProductImages(request, env);
    }
    if (path === '/api/admin/product-categories') {
        if (request.method === 'GET') return listProductCategories(request, env);
        if (request.method === 'POST') return saveProductCategory(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/product-brands') {
        if (request.method === 'GET') return listProductBrands(request, env);
        if (request.method === 'POST') return saveProductBrand(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/product-brands/rename-products') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return renameProductBrand(request, env);
    }
    if (path === '/api/admin/discount-codes') {
        if (request.method === 'GET') return listDiscountCodes(request, env);
        if (request.method === 'POST') return saveDiscountCode(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/tax-profiles') {
        if (request.method === 'GET') return listTaxProfiles(request, env);
        if (request.method === 'POST') return saveTaxProfile(request, env);
        return methodNotAllowed(['GET', 'POST']);
    }
    if (path === '/api/admin/tax-rates') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return saveTaxRate(request, env);
    }
    if (path === '/api/admin/appointments') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return listAdminAppointments(request, env);
    }
    if (path === '/api/admin/media-assets') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return listAdminMediaAssets(request, env);
    }
    if (path === '/api/admin/system/capabilities') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getAdminCapabilities(request, env);
    }
    if (path === '/api/admin/system/operations') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getAdminOperations(request, env);
    }

    const lifecycleMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/lifecycle$/);
    if (lifecycleMatch) {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return getAdminOrderLifecycle(request, env, decodeURIComponent(lifecycleMatch[1]));
    }
    const productMatch = path.match(/^\/api\/admin\/products\/(\d+)$/);
    if (productMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteAdminProduct(request, env, productMatch[1]);
    }
    const serviceMatch = path.match(/^\/api\/admin\/services\/(\d+)$/);
    if (serviceMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteAdminService(request, env, serviceMatch[1]);
    }
    const postMatch = path.match(/^\/api\/admin\/blog-posts\/([^/]+)$/);
    if (postMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteAdminBlogPost(request, env, decodeURIComponent(postMatch[1]));
    }
    const blogCategoryMatch = path.match(/^\/api\/admin\/blog-categories\/([^/]+)$/);
    if (blogCategoryMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteAdminBlogCategory(request, env, decodeURIComponent(blogCategoryMatch[1]));
    }
    const contentMatch = path.match(/^\/api\/admin\/site-content\/([^/]+)$/);
    if (contentMatch) {
        const resource = decodeURIComponent(contentMatch[1]);
        if (request.method === 'GET') return listAdminSiteContent(request, env, resource);
        if (request.method === 'POST') return saveAdminSiteContent(request, env, resource);
        return methodNotAllowed(['GET', 'POST']);
    }
    const contentItemMatch = path.match(/^\/api\/admin\/site-content\/([^/]+)\/([^/]+)$/);
    if (contentItemMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteAdminSiteContent(request, env, decodeURIComponent(contentItemMatch[1]), decodeURIComponent(contentItemMatch[2]));
    }
    const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch) {
        if (request.method === 'GET') return getAdminUserDetail(request, env, decodeURIComponent(userMatch[1]));
        if (request.method === 'PATCH') return updateAdminUser(request, env, decodeURIComponent(userMatch[1]));
        return methodNotAllowed(['GET', 'PATCH']);
    }
    const medicalRecordMatch = path.match(/^\/api\/admin\/medical-records\/([^/]+)$/);
    if (medicalRecordMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteMedicalRecord(request, env, decodeURIComponent(medicalRecordMatch[1]));
    }
    const categoryMatch = path.match(/^\/api\/admin\/product-categories\/(\d+)$/);
    if (categoryMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteProductCategory(request, env, categoryMatch[1]);
    }
    const brandMatch = path.match(/^\/api\/admin\/product-brands\/([^/]+)$/);
    if (brandMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteProductBrand(request, env, decodeURIComponent(brandMatch[1]));
    }
    const discountMatch = path.match(/^\/api\/admin\/discount-codes\/([^/]+)$/);
    if (discountMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteDiscountCode(request, env, decodeURIComponent(discountMatch[1]));
    }
    const taxProfileMatch = path.match(/^\/api\/admin\/tax-profiles\/([^/]+)$/);
    if (taxProfileMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteTaxProfile(request, env, decodeURIComponent(taxProfileMatch[1]));
    }
    const taxRateMatch = path.match(/^\/api\/admin\/tax-rates\/([^/]+)$/);
    if (taxRateMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteTaxRate(request, env, decodeURIComponent(taxRateMatch[1]));
    }
    const scheduleMatch = path.match(/^\/api\/admin\/report-schedules\/([^/]+)$/);
    if (scheduleMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        return deleteReportSchedule(request, env, decodeURIComponent(scheduleMatch[1]));
    }
    return null;
}
