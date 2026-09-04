import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { randomId, sha256Hex } from '../platform/crypto.js';
import { requireCsrf, requireRole } from '../auth/session.js';
import { paginationFromRequest, recordAdminAuditAttempt } from '../adminD1/support.js';
import { calculateVatDocument, calculateVatPeriod } from './calculation.js';

const VAT_ROLES = ['accountant', 'master_admin'];
const MASTER_ROLES = ['master_admin'];
const INVOICE_STATUSES = new Set(['draft', 'issued', 'replaced', 'adjusted', 'cancelled']);
const PURCHASE_DEDUCTION_STATUSES = new Set(['review', 'eligible', 'partial', 'excluded']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DANGEROUS_CELL = /^[=+@]|^-[A-Za-z]/;
const NON_CASH_WARNING_THRESHOLD = 5_000_000;

function cleanText(value, max = 500) {
    return String(value ?? '').trim().slice(0, max);
}

function nullableText(value, max = 500) {
    return cleanText(value, max) || null;
}

function requiredText(value, field, max = 500) {
    const normalized = cleanText(value, max);
    if (!normalized) throw Object.assign(new Error(`${field} là bắt buộc.`), { status: 400 });
    return normalized;
}

function dateValue(value, field) {
    const normalized = cleanText(value, 10);
    if (!DATE_PATTERN.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
        throw Object.assign(new Error(`${field} không đúng định dạng YYYY-MM-DD.`), { status: 400 });
    }
    return normalized;
}

function money(value, field, { allowNegative = false } = {}) {
    const parsed = Number(value ?? 0);
    const min = allowNegative ? -Number.MAX_SAFE_INTEGER : 0;
    if (!Number.isSafeInteger(parsed) || parsed < min) {
        throw Object.assign(new Error(`${field} phải là số nguyên VND hợp lệ.`), { status: 400 });
    }
    return parsed;
}

function parseJson(value, fallback) {
    try {
        return value == null || value === '' ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableValue(value[key]);
            return result;
        }, {});
    }
    return value;
}

async function immutableHash(value) {
    return sha256Hex(JSON.stringify(stableValue(value)));
}

async function authorize(request, env, masterOnly = false) {
    const db = requireD1(env);
    const session = await requireRole(db, request, masterOnly ? MASTER_ROLES : VAT_ROLES);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
    }
    return { db, session };
}

async function loadEntity(db) {
    const entity = await db.prepare('SELECT * FROM tax_entities ORDER BY created_at LIMIT 1').first();
    if (!entity) throw Object.assign(new Error('Chưa có hồ sơ pháp nhân VAT.'), { status: 409 });
    return entity;
}

function publicInvoice(row, lines = []) {
    return {
        ...row,
        subtotal_amount: Number(row.subtotal_amount || 0),
        discount_amount: Number(row.discount_amount || 0),
        net_amount: Number(row.net_amount || 0),
        vat_amount: Number(row.vat_amount || 0),
        gross_amount: Number(row.gross_amount || 0),
        deductible_vat_amount: Number(row.deductible_vat_amount || 0),
        non_cash_payment_warning: Boolean(row.non_cash_payment_warning),
        lines,
    };
}

async function migrationStatusPayload(db, env) {
    const [manifest, issues, appOrders, missingCounts] = await Promise.all([
        db.prepare(`SELECT COUNT(*) AS mapped,
            SUM(CASE WHEN target_kind <> 'view_replacement' THEN 1 ELSE 0 END) AS tables_mapped,
            SUM(CASE WHEN target_kind <> 'view_replacement' AND verified_at IS NOT NULL THEN 1 ELSE 0 END) AS tables_verified,
            SUM(CASE WHEN target_kind = 'view_replacement' THEN 1 ELSE 0 END) AS views_mapped,
            SUM(CASE WHEN target_kind = 'view_replacement' AND verified_at IS NOT NULL THEN 1 ELSE 0 END) AS views_verified,
            SUM(source_row_count) AS source_rows,
            SUM(imported_row_count) AS imported_rows,
            SUM(conflict_row_count) AS conflicts
          FROM source_migration_manifest`).first(),
        db.prepare(`SELECT COUNT(*) AS open_count FROM migration_issues WHERE resolution_status = 'open'`).first(),
        db.prepare('SELECT COUNT(*) AS count FROM product_orders').first(),
        Promise.all(['catalog_seo_events', 'product_ingredient_sync_events', 'product_generation_jobs'].map(async (table) => {
            const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first();
            return { table, count: Number(row?.count || 0) };
        })),
    ]);
    const protectedD1MinimumOrders = Math.max(0, Number.parseInt(String(env?.D1_PROTECTED_MINIMUM_ORDERS || '54'), 10) || 54);
    return {
        sourceTables: { expected: 46, mapped: Number(manifest?.tables_mapped || 0), verified: Number(manifest?.tables_verified || 0) },
        sourceViews: { expected: 3, replacementsMapped: Number(manifest?.views_mapped || 0), verified: Number(manifest?.views_verified || 0) },
        rows: {
            source: Number(manifest?.source_rows || 0),
            imported: Number(manifest?.imported_rows || 0),
            conflicts: Number(manifest?.conflicts || 0),
        },
        openIssues: Number(issues?.open_count || 0),
        d1Orders: Number(appOrders?.count || 0),
        protectedD1MinimumOrders,
        additionalTables: missingCounts,
        cutoverReady: Number(manifest?.tables_mapped || 0) === 46
            && Number(manifest?.tables_verified || 0) === 46
            && Number(manifest?.views_mapped || 0) === 3
            && Number(manifest?.views_verified || 0) === 3
            && Number(manifest?.conflicts || 0) === 0
            && Number(issues?.open_count || 0) === 0
            && Number(appOrders?.count || 0) >= protectedD1MinimumOrders,
    };
}

export async function getVatBootstrap(request, env) {
    try {
        const { db, session } = await authorize(request, env);
        const entity = await loadEntity(db);
        const today = new Date().toISOString().slice(0, 10);
        const [categories, directRates, periods, salesSummary, purchaseSummary, warningSummary, migration, pendingProducts, pendingServices] = await Promise.all([
            db.prepare('SELECT * FROM vat_categories ORDER BY rate_bps, code').all(),
            db.prepare('SELECT * FROM vat_direct_rates WHERE entity_id = ? ORDER BY revenue_category, version DESC').bind(entity.id).all(),
            db.prepare('SELECT * FROM vat_periods WHERE entity_id = ? ORDER BY starts_on DESC, created_at DESC LIMIT 12').bind(entity.id).all(),
            db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(net_amount), 0) AS net_amount,
                COALESCE(SUM(vat_amount), 0) AS vat_amount, COALESCE(SUM(gross_amount), 0) AS gross_amount
              FROM sales_invoices WHERE entity_id = ? AND status = 'issued'`).bind(entity.id).first(),
            db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(net_amount), 0) AS net_amount,
                COALESCE(SUM(vat_amount), 0) AS vat_amount,
                COALESCE(SUM(deductible_vat_amount), 0) AS deductible_vat_amount
              FROM purchase_invoices WHERE entity_id = ? AND status = 'issued'`).bind(entity.id).first(),
            db.prepare(`SELECT
                SUM(CASE WHEN reconciliation_status IN ('candidate', 'issue') THEN 1 ELSE 0 END) AS sales_candidates,
                0 AS payment_warnings
              FROM sales_invoices WHERE entity_id = ?`).bind(entity.id).first(),
            migrationStatusPayload(db, env),
            db.prepare(`SELECT id, name, sku, vat_rate, vat_category_code FROM products
                WHERE archived_at IS NULL AND (vat_category_code IS NULL OR vat_classification_approved_at IS NULL)
                ORDER BY id LIMIT 200`).all(),
            db.prepare(`SELECT id, name, price, vat_category_code FROM services
                WHERE is_published = 1 AND (vat_category_code IS NULL OR vat_classification_approved_at IS NULL)
                ORDER BY id LIMIT 200`).all(),
        ]);
        const purchaseWarnings = await db.prepare(`SELECT COUNT(*) AS count FROM purchase_invoices
            WHERE entity_id = ? AND non_cash_payment_warning = 1 AND status <> 'cancelled'`).bind(entity.id).first();
        return json({
            entity,
            categories: categories.results || [],
            directRates: directRates.results || [],
            periods: periods.results || [],
            summary: {
                sales: salesSummary,
                purchases: purchaseSummary,
                warnings: {
                    salesCandidates: Number(warningSummary?.sales_candidates || 0),
                    nonCashPayment: Number(purchaseWarnings?.count || 0),
                },
            },
            migration,
            pendingClassifications: {
                products: pendingProducts.results || [],
                services: pendingServices.results || [],
            },
            today,
            permissions: {
                canManage: true,
                canLock: session.roles.includes('master_admin'),
                canConfigure: session.roles.includes('master_admin'),
            },
            safeguards: {
                historicalRecalculation: false,
                xmlStatus: entity.htkk_version === 'pending_sample' ? 'pending_sample' : 'adapter_configured',
                nonCashWarningThreshold: NON_CASH_WARNING_THRESHOLD,
            },
        });
    } catch (error) {
        return apiError(error, 'Không thể tải sổ VAT.');
    }
}

export async function getMigrationStatus(request, env) {
    try {
        const { db } = await authorize(request, env);
        return json({ migration: await migrationStatusPayload(db, env) });
    } catch (error) {
        return apiError(error, 'Không thể kiểm tra trạng thái chuyển D1.');
    }
}

export async function saveTaxEntity(request, env) {
    try {
        const { db, session } = await authorize(request, env, true);
        const body = await readJson(request, 64 * 1024);
        const current = await loadEntity(db);
        const method = body.default_method === 'direct_04' ? 'direct_04' : 'deduction_01';
        const cycle = body.filing_cycle === 'monthly' ? 'monthly' : 'quarterly';
        const goLiveDate = body.go_live_date ? dateValue(body.go_live_date, 'Ngày go-live') : null;
        const isActive = body.is_active ? 1 : 0;
        const legalName = requiredText(body.legal_name, 'Tên pháp nhân', 500);
        const taxCode = nullableText(body.tax_code, 30);
        const address = nullableText(body.address, 1000);
        const authority = nullableText(body.tax_authority, 500);
        const htkkVersion = cleanText(body.htkk_version || current.htkk_version || 'pending_sample', 80);
        if (isActive && (!taxCode || !address || !authority || !goLiveDate)) {
            throw Object.assign(new Error('Phải đủ MST, địa chỉ, cơ quan thuế và ngày go-live trước khi kích hoạt.'), { status: 409 });
        }
        if (isActive) {
            const [unapprovedProducts, unapprovedServices, unapprovedDirect] = await Promise.all([
                db.prepare(`SELECT COUNT(*) AS count FROM products WHERE archived_at IS NULL
                    AND (vat_category_code IS NULL OR vat_classification_approved_at IS NULL)`).first(),
                db.prepare(`SELECT COUNT(*) AS count FROM services WHERE is_published = 1
                    AND (vat_category_code IS NULL OR vat_classification_approved_at IS NULL)`).first(),
                db.prepare(`SELECT COUNT(*) AS count FROM vat_direct_rates WHERE entity_id = ? AND approved_at IS NULL`).bind(current.id).first(),
            ]);
            const pending = Number(unapprovedProducts?.count || 0) + Number(unapprovedServices?.count || 0)
                + (method === 'direct_04' ? Number(unapprovedDirect?.count || 0) : 0);
            if (pending > 0) {
                throw Object.assign(new Error(`Còn ${pending} phân loại/tỷ lệ chưa được master admin duyệt.`), { status: 409 });
            }
        }
        const now = new Date().toISOString();
        await db.prepare(`UPDATE tax_entities SET legal_name = ?, tax_code = ?, address = ?, tax_authority = ?,
            default_method = ?, filing_cycle = ?, go_live_date = ?, htkk_version = ?, is_active = ?,
            classifications_approved_at = CASE WHEN ? = 1 THEN COALESCE(classifications_approved_at, ?) ELSE classifications_approved_at END,
            classifications_approved_by = CASE WHEN ? = 1 THEN COALESCE(classifications_approved_by, ?) ELSE classifications_approved_by END,
            updated_by = ?, updated_at = ? WHERE id = ?`)
            .bind(legalName, taxCode, address, authority, method, cycle, goLiveDate, htkkVersion, isActive,
                isActive, now, isActive, session.user_id, session.user_id, now, current.id).run();
        return json({ entity: await loadEntity(db) });
    } catch (error) {
        return apiError(error, 'Không thể lưu hồ sơ pháp nhân.');
    }
}

export async function approveClassifications(request, env) {
    try {
        const { db, session } = await authorize(request, env, true);
        const body = await readJson(request, 128 * 1024);
        const resourceType = body.resource_type === 'services' ? 'services' : 'products';
        const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter(Number.isInteger))] : [];
        if (!ids.length || ids.length > 500) throw Object.assign(new Error('Danh sách phân loại không hợp lệ.'), { status: 400 });
        const categoryCode = requiredText(body.vat_category_code, 'Danh mục VAT', 80);
        const category = await db.prepare('SELECT * FROM vat_categories WHERE code = ? AND is_active = 1 LIMIT 1').bind(categoryCode).first();
        if (!category) throw Object.assign(new Error('Danh mục VAT không tồn tại.'), { status: 404 });
        const now = new Date().toISOString();
        const placeholders = ids.map(() => '?').join(',');
        const result = await db.prepare(`UPDATE ${resourceType}
            SET vat_category_code = ?, vat_classification_approved_at = ?, vat_classification_approved_by = ?, updated_at = ?
            WHERE id IN (${placeholders})`)
            .bind(categoryCode, now, session.user_id, now, ...ids).run();
        return json({ updated: Number(result.meta?.changes || 0), category });
    } catch (error) {
        return apiError(error, 'Không thể duyệt phân loại VAT.');
    }
}

export async function saveVatCategory(request, env) {
    try {
        const { db, session } = await authorize(request, env, true);
        const body = await readJson(request, 64 * 1024);
        const id = nullableText(body.id, 100) || randomId();
        const code = requiredText(body.code, 'Mã danh mục', 80).toUpperCase();
        const rateBps = money(Number(body.rate_bps), 'Thuế suất basis point');
        if (rateBps > 10_000) throw Object.assign(new Error('Thuế suất vượt giới hạn.'), { status: 400 });
        const taxClass = ['non_subject', 'zero', 'reduced', 'standard'].includes(body.tax_class) ? body.tax_class : 'standard';
        const revenueCategory = ['goods', 'services', 'manufacturing_transport_goods_services', 'other'].includes(body.direct_revenue_category)
            ? body.direct_revenue_category : 'goods';
        const now = new Date().toISOString();
        await db.prepare(`INSERT INTO vat_categories (
            id, code, name, tax_class, rate_bps, default_price_mode, direct_revenue_category,
            reduction_eligible, effective_from, effective_to, legal_basis, requires_approval,
            approved_at, approved_by, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name,
            tax_class = excluded.tax_class, rate_bps = excluded.rate_bps,
            default_price_mode = excluded.default_price_mode,
            direct_revenue_category = excluded.direct_revenue_category,
            reduction_eligible = excluded.reduction_eligible, effective_from = excluded.effective_from,
            effective_to = excluded.effective_to, legal_basis = excluded.legal_basis,
            approved_at = excluded.approved_at, approved_by = excluded.approved_by,
            is_active = excluded.is_active, updated_at = excluded.updated_at`)
            .bind(id, code, requiredText(body.name, 'Tên danh mục'), taxClass, rateBps,
                body.default_price_mode === 'exclusive' ? 'exclusive' : 'inclusive', revenueCategory,
                body.reduction_eligible ? 1 : 0, body.effective_from ? dateValue(body.effective_from, 'Hiệu lực từ') : null,
                body.effective_to ? dateValue(body.effective_to, 'Hiệu lực đến') : null,
                requiredText(body.legal_basis, 'Căn cứ pháp lý', 2000), now, session.user_id,
                body.is_active === false ? 0 : 1, now, now).run();
        return json({ category: await db.prepare('SELECT * FROM vat_categories WHERE id = ?').bind(id).first() });
    } catch (error) {
        return apiError(error, 'Không thể lưu danh mục VAT.');
    }
}

export async function approveDirectRates(request, env) {
    try {
        const { db, session } = await authorize(request, env, true);
        const body = await readJson(request, 32 * 1024);
        const rates = body.rates && typeof body.rates === 'object' ? body.rates : {};
        const entity = await loadEntity(db);
        const now = new Date().toISOString();
        const current = await db.prepare('SELECT * FROM vat_direct_rates WHERE entity_id = ?').bind(entity.id).all();
        const statements = (current.results || []).map((row) => {
            const next = rates[row.revenue_category] == null ? Number(row.rate_bps) : money(Number(rates[row.revenue_category]), 'Tỷ lệ trực tiếp');
            if (next > 10_000) throw Object.assign(new Error('Tỷ lệ trực tiếp vượt giới hạn.'), { status: 400 });
            return db.prepare(`UPDATE vat_direct_rates SET rate_bps = ?, approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?`)
                .bind(next, now, session.user_id, now, row.id);
        });
        await db.batch(statements);
        const result = await db.prepare('SELECT * FROM vat_direct_rates WHERE entity_id = ? ORDER BY revenue_category').bind(entity.id).all();
        return json({ directRates: result.results || [] });
    } catch (error) {
        return apiError(error, 'Không thể duyệt tỷ lệ phương pháp trực tiếp.');
    }
}

async function listInvoiceRows(db, table, entityId, request) {
    const { page, pageSize, offset, query, url } = paginationFromRequest(request, { pageSize: 50, maxPageSize: 200 });
    const status = cleanText(url.searchParams.get('status'), 30);
    const from = cleanText(url.searchParams.get('from'), 10);
    const to = cleanText(url.searchParams.get('to'), 10);
    const filters = ['entity_id = ?'];
    const bindings = [entityId];
    if (status && INVOICE_STATUSES.has(status)) { filters.push('status = ?'); bindings.push(status); }
    if (from && DATE_PATTERN.test(from)) { filters.push('invoice_date >= ?'); bindings.push(from); }
    if (to && DATE_PATTERN.test(to)) { filters.push('invoice_date <= ?'); bindings.push(to); }
    if (query) {
        const queryColumns = table === 'sales_invoices'
            ? ['invoice_number', 'buyer_name', 'buyer_tax_code', 'source_id']
            : ['invoice_number', 'supplier_name', 'supplier_tax_code'];
        filters.push(`(${queryColumns.map((column) => `${column} LIKE ?`).join(' OR ')})`);
        for (let index = 0; index < queryColumns.length; index += 1) bindings.push(`%${query}%`);
    }
    const where = filters.join(' AND ');
    const [rows, count] = await Promise.all([
        db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY invoice_date DESC, created_at DESC LIMIT ? OFFSET ?`)
            .bind(...bindings, pageSize, offset).all(),
        db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).bind(...bindings).first(),
    ]);
    const list = rows.results || [];
    let lines = [];
    if (list.length) {
        const placeholders = list.map(() => '?').join(',');
        const lineTable = table === 'sales_invoices' ? 'sales_invoice_lines' : 'purchase_invoice_lines';
        const result = await db.prepare(`SELECT * FROM ${lineTable} WHERE invoice_id IN (${placeholders}) ORDER BY invoice_id, line_number`)
            .bind(...list.map((row) => row.id)).all();
        lines = result.results || [];
    }
    const lineMap = new Map();
    for (const line of lines) {
        const bucket = lineMap.get(line.invoice_id) || [];
        bucket.push(line);
        lineMap.set(line.invoice_id, bucket);
    }
    return {
        data: list.map((row) => publicInvoice(row, lineMap.get(row.id) || [])),
        meta: { page, pageSize, total: Number(count?.count || 0) },
    };
}

export async function listSalesInvoices(request, env) {
    try {
        const { db } = await authorize(request, env);
        const entity = await loadEntity(db);
        return json(await listInvoiceRows(db, 'sales_invoices', entity.id, request));
    } catch (error) {
        return apiError(error, 'Không thể tải hóa đơn bán ra.');
    }
}

export async function listPurchaseInvoices(request, env) {
    try {
        const { db } = await authorize(request, env);
        const entity = await loadEntity(db);
        return json(await listInvoiceRows(db, 'purchase_invoices', entity.id, request));
    } catch (error) {
        return apiError(error, 'Không thể tải hóa đơn mua vào.');
    }
}

async function normalizedInvoiceLines(db, body, invoiceDate, priceMode) {
    const sourceLines = Array.isArray(body.lines) ? body.lines : [];
    if (!sourceLines.length || sourceLines.length > 200) {
        throw Object.assign(new Error('Hóa đơn phải có từ 1 đến 200 dòng.'), { status: 400 });
    }
    const codes = [...new Set(sourceLines.map((line) => requiredText(line.vat_category_code, 'Danh mục VAT', 80)))];
    const placeholders = codes.map(() => '?').join(',');
    const result = await db.prepare(`SELECT * FROM vat_categories WHERE code IN (${placeholders}) AND is_active = 1`).bind(...codes).all();
    const categories = new Map((result.results || []).map((row) => [row.code, row]));
    if (categories.size !== codes.length) throw Object.assign(new Error('Có dòng dùng danh mục VAT không hợp lệ.'), { status: 400 });
    const allowNegativeLines = Boolean(body.adjusts_invoice_id || body.replaces_invoice_id || body.allow_negative_lines);
    const lines = sourceLines.map((line, index) => {
        const category = categories.get(line.vat_category_code);
        if (category.effective_from && invoiceDate < category.effective_from) {
            throw Object.assign(new Error(`Dòng ${index + 1}: danh mục chưa có hiệu lực.`), { status: 400 });
        }
        if (category.effective_to && invoiceDate > category.effective_to) {
            throw Object.assign(new Error(`Dòng ${index + 1}: danh mục đã hết hiệu lực.`), { status: 400 });
        }
        return {
            id: line.id || index + 1,
            sourceId: nullableText(line.source_id, 200),
            sourceType: nullableText(line.source_type, 80),
            description: requiredText(line.description, `Mô tả dòng ${index + 1}`, 1000),
            unit: nullableText(line.unit, 80),
            quantity: money(Number(line.quantity ?? 1), `Số lượng dòng ${index + 1}`) || 1,
            unitPrice: money(Number(line.unit_price ?? line.unitPrice ?? 0), `Đơn giá dòng ${index + 1}`, { allowNegative: allowNegativeLines }),
            rateBps: Number(category.rate_bps),
            vatCategoryCode: category.code,
            taxClass: category.tax_class,
            priceMode: line.price_mode === 'exclusive' || line.price_mode === 'inclusive' ? line.price_mode : priceMode,
            directRevenueCategory: category.direct_revenue_category,
        };
    });
    return calculateVatDocument({ lines, priceMode, discountAmount: money(body.discount_amount, 'Giảm giá'), allowNegativeLines });
}

function invoiceLineStatements(db, table, invoiceId, calculated, now, purchase = false) {
    return calculated.lines.map((line, index) => {
        if (purchase) {
            const deductible = line.taxClass === 'non_subject' ? 0 : line.vatAmount;
            return db.prepare(`INSERT INTO purchase_invoice_lines (
                id, invoice_id, line_number, description, unit, quantity, unit_price,
                gross_before_discount, allocated_discount, vat_category_code, tax_class,
                rate_bps, price_mode, net_amount, vat_amount, deductible_vat_amount,
                gross_amount, exclusion_reason, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
                .bind(randomId(), invoiceId, index + 1, line.description, line.unit || null,
                    line.quantity, line.unitPrice, line.amountBeforeDiscount, line.allocatedDiscount,
                    line.vatCategoryCode, line.taxClass, line.rateBps, line.priceMode,
                    line.netAmount, line.vatAmount, deductible, line.grossAmount, now);
        }
        return db.prepare(`INSERT INTO sales_invoice_lines (
            id, invoice_id, line_number, source_type, source_id, description, unit, quantity,
            unit_price, gross_before_discount, allocated_discount, vat_category_code, tax_class,
            rate_bps, price_mode, net_amount, vat_amount, gross_amount, direct_revenue_category, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(randomId(), invoiceId, index + 1, line.sourceType || null, line.sourceId || null,
                line.description, line.unit || null, line.quantity, line.unitPrice,
                line.amountBeforeDiscount, line.allocatedDiscount, line.vatCategoryCode,
                line.taxClass, line.rateBps, line.priceMode, line.netAmount, line.vatAmount,
                line.grossAmount, line.revenueCategory, now);
    });
}

async function saveInvoice(request, env, purchase) {
    const { db, session } = await authorize(request, env);
    const body = await readJson(request, 512 * 1024);
    const entity = await loadEntity(db);
    const id = nullableText(body.id, 100) || randomId();
    const current = await db.prepare(`SELECT * FROM ${purchase ? 'purchase_invoices' : 'sales_invoices'} WHERE id = ? LIMIT 1`).bind(id).first();
    if (current && current.status !== 'draft') {
        throw Object.assign(new Error('Hóa đơn đã phát hành là bất biến; hãy lập chứng từ điều chỉnh/thay thế.'), { status: 409 });
    }
    const invoiceDate = dateValue(body.invoice_date, 'Ngày hóa đơn');
    if (entity.go_live_date && invoiceDate < entity.go_live_date) {
        throw Object.assign(new Error('Không được ghi VAT cho giao dịch trước ngày go-live.'), { status: 409 });
    }
    const priceMode = body.price_mode === 'exclusive' ? 'exclusive' : 'inclusive';
    const calculated = await normalizedInvoiceLines(db, body, invoiceDate, priceMode);
    const now = new Date().toISOString();
    const status = body.status === 'issued' ? 'issued' : 'draft';
    if (status === 'issued') {
        requiredText(body.invoice_number, 'Số hóa đơn', 100);
        requiredText(body.invoice_series, 'Ký hiệu hóa đơn', 80);
    }
    const invoicePayload = { ...body, id, entity_id: entity.id, invoice_date: invoiceDate, calculated };
    const hash = status === 'issued' ? await immutableHash(invoicePayload) : null;
    const idempotencyKey = nullableText(body.idempotency_key || request.headers.get('Idempotency-Key'), 160);
    const statements = [];
    if (current) {
        statements.push(db.prepare(`DELETE FROM ${purchase ? 'purchase_invoice_lines' : 'sales_invoice_lines'} WHERE invoice_id = ?`).bind(id));
    }
    if (purchase) {
        const deductionStatus = PURCHASE_DEDUCTION_STATUSES.has(body.deduction_status) ? body.deduction_status : 'review';
        const deductible = deductionStatus === 'excluded' ? 0
            : deductionStatus === 'partial' ? money(body.deductible_vat_amount, 'VAT được khấu trừ')
                : calculated.vatAmount;
        if (deductible > calculated.vatAmount) throw Object.assign(new Error('VAT khấu trừ không được vượt VAT hóa đơn.'), { status: 400 });
        const supplierTaxCode = nullableText(body.supplier_tax_code, 30);
        const supplierDay = supplierTaxCode
            ? await db.prepare(`SELECT COALESCE(SUM(gross_amount), 0) AS total FROM purchase_invoices
                WHERE entity_id = ? AND supplier_tax_code = ? AND invoice_date = ? AND id <> ? AND status <> 'cancelled'`)
                .bind(entity.id, supplierTaxCode, invoiceDate, id).first()
            : null;
        const dayTotal = Number(supplierDay?.total || 0) + calculated.grossAmount;
        const isNonCash = ['bank_transfer', 'card', 'offset', 'other_non_cash'].includes(body.payment_method);
        const warning = dayTotal >= NON_CASH_WARNING_THRESHOLD && !isNonCash ? 1 : 0;
        statements.push(db.prepare(`INSERT INTO purchase_invoices (
            id, entity_id, supplier_name, supplier_tax_code, invoice_template, invoice_series,
            invoice_number, invoice_date, received_at, payment_method, payment_reference, paid_at,
            currency, status, subtotal_amount, discount_amount, net_amount, vat_amount,
            deductible_vat_amount, gross_amount, deduction_status, exclusion_reason,
            non_cash_payment_warning, warning_note, import_job_id, idempotency_key, immutable_hash,
            created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET supplier_name = excluded.supplier_name,
            supplier_tax_code = excluded.supplier_tax_code, invoice_template = excluded.invoice_template,
            invoice_series = excluded.invoice_series, invoice_number = excluded.invoice_number,
            invoice_date = excluded.invoice_date, received_at = excluded.received_at,
            payment_method = excluded.payment_method, payment_reference = excluded.payment_reference,
            paid_at = excluded.paid_at, status = excluded.status, subtotal_amount = excluded.subtotal_amount,
            discount_amount = excluded.discount_amount, net_amount = excluded.net_amount,
            vat_amount = excluded.vat_amount, deductible_vat_amount = excluded.deductible_vat_amount,
            gross_amount = excluded.gross_amount, deduction_status = excluded.deduction_status,
            exclusion_reason = excluded.exclusion_reason, non_cash_payment_warning = excluded.non_cash_payment_warning,
            warning_note = excluded.warning_note, immutable_hash = excluded.immutable_hash,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
            .bind(id, entity.id, requiredText(body.supplier_name, 'Nhà cung cấp'), supplierTaxCode,
                nullableText(body.invoice_template, 80), nullableText(body.invoice_series, 80),
                requiredText(body.invoice_number, 'Số hóa đơn', 100), invoiceDate,
                nullableText(body.received_at, 40), nullableText(body.payment_method, 80),
                nullableText(body.payment_reference, 200), nullableText(body.paid_at, 40), status,
                calculated.subtotalAmount, calculated.discountAmount, calculated.netAmount,
                calculated.vatAmount, deductible, calculated.grossAmount, deductionStatus,
                nullableText(body.exclusion_reason, 1000), warning,
                warning ? `Tổng mua cùng nhà cung cấp trong ngày là ${dayTotal.toLocaleString('vi-VN')} VND; cần kiểm tra chứng từ thanh toán không dùng tiền mặt.` : null,
                nullableText(body.import_job_id, 100), idempotencyKey, hash,
                session.user_id, session.user_id, current?.created_at || now, now));
    } else {
        const sourceType = ['online_order', 'pos_order', 'pancake_order', 'clinic_service', 'manual', 'import'].includes(body.source_type)
            ? body.source_type : 'manual';
        statements.push(db.prepare(`INSERT INTO sales_invoices (
            id, entity_id, source_type, source_id, source_channel, invoice_template, invoice_series,
            invoice_number, invoice_code, invoice_date, issued_at, buyer_name, buyer_tax_code,
            buyer_address, buyer_email, payment_method, status, replaces_invoice_id,
            adjusts_invoice_id, currency, price_mode, subtotal_amount, discount_amount, net_amount,
            vat_amount, gross_amount, reconciliation_status, reconciliation_note, source_checksum,
            import_job_id, idempotency_key, immutable_hash, created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET source_type = excluded.source_type, source_id = excluded.source_id,
            source_channel = excluded.source_channel, invoice_template = excluded.invoice_template,
            invoice_series = excluded.invoice_series, invoice_number = excluded.invoice_number,
            invoice_code = excluded.invoice_code, invoice_date = excluded.invoice_date,
            issued_at = excluded.issued_at, buyer_name = excluded.buyer_name,
            buyer_tax_code = excluded.buyer_tax_code, buyer_address = excluded.buyer_address,
            buyer_email = excluded.buyer_email, payment_method = excluded.payment_method,
            status = excluded.status, replaces_invoice_id = excluded.replaces_invoice_id,
            adjusts_invoice_id = excluded.adjusts_invoice_id, price_mode = excluded.price_mode,
            subtotal_amount = excluded.subtotal_amount, discount_amount = excluded.discount_amount,
            net_amount = excluded.net_amount, vat_amount = excluded.vat_amount,
            gross_amount = excluded.gross_amount, reconciliation_status = excluded.reconciliation_status,
            reconciliation_note = excluded.reconciliation_note, immutable_hash = excluded.immutable_hash,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
            .bind(id, entity.id, sourceType, nullableText(body.source_id, 200), nullableText(body.source_channel, 80),
                nullableText(body.invoice_template, 80), nullableText(body.invoice_series, 80), nullableText(body.invoice_number, 100),
                nullableText(body.invoice_code, 160), invoiceDate, status === 'issued' ? (body.issued_at || now) : null,
                nullableText(body.buyer_name, 500), nullableText(body.buyer_tax_code, 30), nullableText(body.buyer_address, 1000),
                nullableText(body.buyer_email, 320), nullableText(body.payment_method, 80), status,
                nullableText(body.replaces_invoice_id, 100), nullableText(body.adjusts_invoice_id, 100), priceMode,
                calculated.subtotalAmount, calculated.discountAmount, calculated.netAmount, calculated.vatAmount,
                calculated.grossAmount, ['matched', 'verified', 'excluded', 'issue'].includes(body.reconciliation_status)
                    ? body.reconciliation_status : (status === 'issued' ? 'verified' : 'candidate'),
                nullableText(body.reconciliation_note, 1000), nullableText(body.source_checksum, 100),
                nullableText(body.import_job_id, 100), idempotencyKey, hash,
                session.user_id, session.user_id, current?.created_at || now, now));
    }
    statements.push(...invoiceLineStatements(db, purchase ? 'purchase_invoice_lines' : 'sales_invoice_lines', id, calculated, now, purchase));
    await db.batch(statements);
    const row = await db.prepare(`SELECT * FROM ${purchase ? 'purchase_invoices' : 'sales_invoices'} WHERE id = ?`).bind(id).first();
    const lineResult = await db.prepare(`SELECT * FROM ${purchase ? 'purchase_invoice_lines' : 'sales_invoice_lines'} WHERE invoice_id = ? ORDER BY line_number`).bind(id).all();
    return publicInvoice(row, lineResult.results || []);
}

export async function saveSalesInvoice(request, env) {
    try {
        return json({ invoice: await saveInvoice(request, env, false) }, 201);
    } catch (error) {
        return apiError(error, 'Không thể lưu hóa đơn bán ra.');
    }
}

export async function savePurchaseInvoice(request, env) {
    try {
        return json({ invoice: await saveInvoice(request, env, true) }, 201);
    } catch (error) {
        return apiError(error, 'Không thể lưu hóa đơn mua vào.');
    }
}

export async function createInvoiceCorrection(request, env, sourceId) {
    try {
        const { db, session } = await authorize(request, env);
        const body = await readJson(request, 512 * 1024);
        const source = await db.prepare('SELECT * FROM sales_invoices WHERE id = ? LIMIT 1').bind(sourceId).first();
        if (!source || source.status !== 'issued') throw Object.assign(new Error('Chỉ hóa đơn đã phát hành mới được điều chỉnh/thay thế.'), { status: 409 });
        const correctionType = body.correction_type === 'replacement' ? 'replacement' : 'adjustment';
        body.source_type = 'manual';
        body.replaces_invoice_id = correctionType === 'replacement' ? source.id : null;
        body.adjusts_invoice_id = correctionType === 'adjustment' ? source.id : null;
        body.status = 'draft';
        const proxyRequest = new Request(request.url, {
            method: 'POST', headers: request.headers, body: JSON.stringify(body),
        });
        const invoice = await saveInvoice(proxyRequest, env, false);
        await db.prepare(`UPDATE sales_invoices SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
            .bind(correctionType === 'replacement' ? 'replaced' : 'adjusted', session.user_id, new Date().toISOString(), source.id).run();
        return json({ invoice, sourceInvoiceStatus: correctionType === 'replacement' ? 'replaced' : 'adjusted' }, 201);
    } catch (error) {
        return apiError(error, 'Không thể lập chứng từ điều chỉnh/thay thế.');
    }
}

function validateImportRow(row, index, type) {
    const issues = [];
    const required = type === 'purchase'
        ? ['supplier_name', 'invoice_number', 'invoice_date', 'description', 'unit_price', 'vat_category_code']
        : ['invoice_date', 'description', 'unit_price', 'vat_category_code'];
    for (const field of required) {
        if (row?.[field] == null || cleanText(row[field], 2000) === '') {
            issues.push({ rowNumber: index + 2, fieldName: field, code: 'REQUIRED', severity: 'error', message: `${field} là bắt buộc.` });
        }
    }
    if (row?.invoice_date && !DATE_PATTERN.test(cleanText(row.invoice_date, 10))) {
        issues.push({ rowNumber: index + 2, fieldName: 'invoice_date', code: 'INVALID_DATE', severity: 'error', message: 'Ngày phải theo YYYY-MM-DD.' });
    }
    for (const [field, value] of Object.entries(row || {})) {
        if (typeof value === 'string' && DANGEROUS_CELL.test(value.trim())) {
            issues.push({ rowNumber: index + 2, fieldName: field, code: 'FORMULA_CELL', severity: 'error', message: 'Ô chứa công thức hoặc nội dung có thể thực thi.' });
        }
    }
    const unitPrice = Number(row?.unit_price);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
        issues.push({ rowNumber: index + 2, fieldName: 'unit_price', code: 'INVALID_MONEY', severity: 'error', message: 'Đơn giá phải là số nguyên VND.' });
    }
    return issues;
}

export async function previewVatImport(request, env) {
    try {
        const { db, session } = await authorize(request, env);
        const body = await readJson(request, 1024 * 1024);
        const entity = await loadEntity(db);
        const type = body.import_type === 'purchase' ? 'purchase' : 'sales';
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (!rows.length || rows.length > 1000) throw Object.assign(new Error('File nhập phải có 1–1.000 dòng.'), { status: 400 });
        const fileSha256 = requiredText(body.file_sha256, 'SHA-256 file', 128);
        const idempotencyKey = requiredText(body.idempotency_key || request.headers.get('Idempotency-Key'), 'Idempotency key', 160);
        const existing = await db.prepare('SELECT * FROM vat_import_jobs WHERE idempotency_key = ? LIMIT 1').bind(idempotencyKey).first();
        if (existing) return json({ preview: { ...existing, rows: parseJson(existing.preview_json, []) }, idempotentReplay: true });
        const issues = rows.flatMap((row, index) => validateImportRow(row, index, type));
        const duplicateKeys = new Set();
        const seen = new Set();
        rows.forEach((row, index) => {
            const key = type === 'purchase'
                ? [row.supplier_tax_code, row.invoice_series, row.invoice_number, row.invoice_date].join('|')
                : [row.invoice_series, row.invoice_number, row.invoice_date].join('|');
            if (seen.has(key)) duplicateKeys.add(key);
            seen.add(key);
            if (duplicateKeys.has(key)) issues.push({ rowNumber: index + 2, fieldName: 'invoice_number', code: 'DUPLICATE_IN_FILE', severity: 'error', message: 'Hóa đơn trùng trong file.' });
        });
        const id = randomId();
        const now = new Date().toISOString();
        const errorRows = new Set(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.rowNumber));
        const statements = [db.prepare(`INSERT INTO vat_import_jobs (
            id, entity_id, import_type, file_name, file_sha256, idempotency_key, status,
            row_count, valid_count, issue_count, preview_json, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'previewed', ?, ?, ?, ?, ?, ?, ?)`)
            .bind(id, entity.id, type, requiredText(body.file_name, 'Tên file', 255), fileSha256,
                idempotencyKey, rows.length, rows.length - errorRows.size, issues.length,
                JSON.stringify(rows), session.user_id, now, now)];
        for (const issue of issues) {
            statements.push(db.prepare(`INSERT INTO vat_import_issues (
                id, import_job_id, row_number, field_name, issue_code, severity, message, raw_value, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
                .bind(randomId(), id, issue.rowNumber, issue.fieldName, issue.code, issue.severity, issue.message, now));
        }
        await db.batch(statements);
        return json({ preview: { id, importType: type, rowCount: rows.length, validCount: rows.length - errorRows.size, issues, rows } }, 201);
    } catch (error) {
        return apiError(error, 'Không thể xem trước file nhập VAT.');
    }
}

export async function commitVatImport(request, env, jobId) {
    try {
        const { db, session } = await authorize(request, env);
        const job = await db.prepare('SELECT * FROM vat_import_jobs WHERE id = ? LIMIT 1').bind(jobId).first();
        if (!job) throw Object.assign(new Error('Không tìm thấy phiên nhập.'), { status: 404 });
        if (job.status === 'committed') return json({ importJob: job, idempotentReplay: true });
        if (Number(job.issue_count || 0) > 0) throw Object.assign(new Error('Phải xử lý toàn bộ lỗi trước khi commit.'), { status: 409 });
        const rows = parseJson(job.preview_json, []);
        if (rows.length > 100) throw Object.assign(new Error('Mỗi commit nguyên tử hỗ trợ tối đa 100 hóa đơn; hãy chia file.'), { status: 413 });
        const entity = await loadEntity(db);
        const now = new Date().toISOString();
        const statements = [];
        for (const [index, row] of rows.entries()) {
            const id = randomId();
            const invoiceDate = dateValue(row.invoice_date, 'Ngày hóa đơn');
            if (entity.go_live_date && invoiceDate < entity.go_live_date) throw Object.assign(new Error(`Dòng ${index + 2} trước ngày go-live.`), { status: 409 });
            const category = await db.prepare('SELECT * FROM vat_categories WHERE code = ? AND is_active = 1 LIMIT 1').bind(row.vat_category_code).first();
            if (!category) throw Object.assign(new Error(`Dòng ${index + 2} có danh mục VAT không hợp lệ.`), { status: 400 });
            const calculated = calculateVatDocument({
                priceMode: row.price_mode === 'exclusive' ? 'exclusive' : 'inclusive',
                lines: [{ description: row.description, quantity: Number(row.quantity || 1), unitPrice: Number(row.unit_price),
                    rateBps: Number(category.rate_bps), vatCategoryCode: category.code, taxClass: category.tax_class,
                    directRevenueCategory: category.direct_revenue_category }],
                discountAmount: Number(row.discount_amount || 0),
            });
            const hash = await immutableHash({ row, calculated });
            if (job.import_type === 'purchase') {
                const deductible = calculated.vatAmount;
                const warning = calculated.grossAmount >= NON_CASH_WARNING_THRESHOLD
                    && !['bank_transfer', 'card', 'offset', 'other_non_cash'].includes(row.payment_method) ? 1 : 0;
                statements.push(db.prepare(`INSERT INTO purchase_invoices (
                    id, entity_id, supplier_name, supplier_tax_code, invoice_series, invoice_number,
                    invoice_date, payment_method, currency, status, subtotal_amount, discount_amount,
                    net_amount, vat_amount, deductible_vat_amount, gross_amount, deduction_status,
                    non_cash_payment_warning, warning_note, import_job_id, idempotency_key, immutable_hash,
                    created_by, updated_by, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VND', 'issued', ?, ?, ?, ?, ?, ?, 'eligible', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .bind(id, entity.id, row.supplier_name, nullableText(row.supplier_tax_code, 30),
                        nullableText(row.invoice_series, 80), row.invoice_number, invoiceDate,
                        nullableText(row.payment_method, 80), calculated.subtotalAmount, calculated.discountAmount,
                        calculated.netAmount, calculated.vatAmount, deductible, calculated.grossAmount, warning,
                        warning ? 'Cần kiểm tra chứng từ thanh toán không dùng tiền mặt.' : null, job.id,
                        `${job.id}:${index + 1}`, hash, session.user_id, session.user_id, now, now));
                statements.push(...invoiceLineStatements(db, 'purchase_invoice_lines', id, calculated, now, true));
            } else {
                statements.push(db.prepare(`INSERT INTO sales_invoices (
                    id, entity_id, source_type, invoice_series, invoice_number, invoice_date, issued_at,
                    buyer_name, buyer_tax_code, currency, price_mode, status, subtotal_amount, discount_amount,
                    net_amount, vat_amount, gross_amount, reconciliation_status, import_job_id, idempotency_key,
                    immutable_hash, created_by, updated_by, created_at, updated_at
                  ) VALUES (?, ?, 'import', ?, ?, ?, ?, ?, ?, 'VND', ?, 'issued', ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?)`)
                    .bind(id, entity.id, nullableText(row.invoice_series, 80), nullableText(row.invoice_number, 100),
                        invoiceDate, now, nullableText(row.buyer_name, 500), nullableText(row.buyer_tax_code, 30),
                        row.price_mode === 'exclusive' ? 'exclusive' : 'inclusive', calculated.subtotalAmount,
                        calculated.discountAmount, calculated.netAmount, calculated.vatAmount, calculated.grossAmount,
                        job.id, `${job.id}:${index + 1}`, hash, session.user_id, session.user_id, now, now));
                statements.push(...invoiceLineStatements(db, 'sales_invoice_lines', id, calculated, now, false));
            }
        }
        statements.push(db.prepare(`UPDATE vat_import_jobs SET status = 'committed', committed_at = ?, updated_at = ? WHERE id = ? AND status = 'previewed'`)
            .bind(now, now, job.id));
        await db.batch(statements);
        return json({ importJob: await db.prepare('SELECT * FROM vat_import_jobs WHERE id = ?').bind(job.id).first(), committed: rows.length });
    } catch (error) {
        return apiError(error, 'Không thể commit file nhập VAT.');
    }
}

export async function listVatPeriods(request, env) {
    try {
        const { db } = await authorize(request, env);
        const entity = await loadEntity(db);
        const result = await db.prepare(`SELECT * FROM vat_periods WHERE entity_id = ?
            ORDER BY starts_on DESC, created_at DESC LIMIT 120`).bind(entity.id).all();
        return json({ data: result.results || [] });
    } catch (error) {
        return apiError(error, 'Không thể tải kỳ kê khai.');
    }
}

function periodBounds(body, cycle) {
    const year = Number(body.year);
    const number = Number(body.period_number);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
        throw Object.assign(new Error('Năm kê khai không hợp lệ.'), { status: 400 });
    }
    if (cycle === 'monthly') {
        if (!Number.isInteger(number) || number < 1 || number > 12) throw Object.assign(new Error('Tháng không hợp lệ.'), { status: 400 });
        const month = String(number).padStart(2, '0');
        const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
        return { periodKey: `${year}-M${month}`, startsOn: `${year}-${month}-01`, endsOn: `${year}-${month}-${lastDay}` };
    }
    if (!Number.isInteger(number) || number < 1 || number > 4) throw Object.assign(new Error('Quý không hợp lệ.'), { status: 400 });
    const startMonth = (number - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
        periodKey: `${year}-Q${number}`,
        startsOn: `${year}-${String(startMonth).padStart(2, '0')}-01`,
        endsOn: `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`,
    };
}

async function methodSnapshot(db, entity, method) {
    const rates = await db.prepare(`SELECT revenue_category, rate_bps, version, legal_basis
        FROM vat_direct_rates WHERE entity_id = ? AND approved_at IS NOT NULL
        ORDER BY revenue_category, version DESC`).bind(entity.id).all();
    return {
        method,
        filingCycle: entity.filing_cycle,
        entity: {
            legalName: entity.legal_name,
            taxCode: entity.tax_code,
            taxAuthority: entity.tax_authority,
            htkkVersion: entity.htkk_version,
        },
        directRates: rates.results || [],
        snapshottedAt: new Date().toISOString(),
    };
}

export async function createVatPeriod(request, env) {
    try {
        const { db, session } = await authorize(request, env);
        const body = await readJson(request, 32 * 1024);
        const entity = await loadEntity(db);
        if (!entity.go_live_date) throw Object.assign(new Error('Phải cấu hình ngày go-live trước khi mở kỳ.'), { status: 409 });
        const cycle = entity.filing_cycle === 'monthly' ? 'monthly' : 'quarterly';
        const bounds = periodBounds(body, cycle);
        const startsOn = bounds.startsOn < entity.go_live_date ? entity.go_live_date : bounds.startsOn;
        if (bounds.endsOn < entity.go_live_date) {
            throw Object.assign(new Error('Kỳ này hoàn toàn trước ngày go-live; chỉ xem ở báo cáo đối soát mở đầu.'), { status: 409 });
        }
        const method = body.method === 'direct_04' ? 'direct_04' : entity.default_method;
        const snapshot = await methodSnapshot(db, entity, method);
        if (method === 'direct_04' && snapshot.directRates.length < 4) {
            throw Object.assign(new Error('Bốn tỷ lệ phương pháp trực tiếp phải được duyệt trước khi mở kỳ.'), { status: 409 });
        }
        const id = randomId();
        const now = new Date().toISOString();
        const openingCredit = money(body.opening_credit_amount, 'Khấu trừ chuyển kỳ');
        await db.prepare(`INSERT INTO vat_periods (
            id, entity_id, period_key, starts_on, ends_on, filing_cycle, method, status,
            method_snapshot_json, opening_credit_amount, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`)
            .bind(id, entity.id, bounds.periodKey, startsOn, bounds.endsOn, cycle, method,
                JSON.stringify(snapshot), openingCredit, session.user_id, now, now).run();
        return json({ period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(id).first() }, 201);
    } catch (error) {
        return apiError(error, 'Không thể mở kỳ kê khai.');
    }
}

async function periodSourceData(db, period) {
    const [salesRows, purchaseRows, adjustments, issueCount] = await Promise.all([
        db.prepare(`SELECT i.id, i.net_amount, i.vat_amount, i.gross_amount,
            COALESCE((SELECT direct_revenue_category FROM sales_invoice_lines l
              WHERE l.invoice_id = i.id ORDER BY l.line_number LIMIT 1), 'goods') AS direct_revenue_category
          FROM sales_invoices i
          WHERE i.entity_id = ? AND i.invoice_date BETWEEN ? AND ? AND i.status = 'issued'
            AND i.reconciliation_status IN ('matched', 'verified')`)
            .bind(period.entity_id, period.starts_on, period.ends_on).all(),
        db.prepare(`SELECT id, net_amount, vat_amount, deductible_vat_amount, gross_amount
          FROM purchase_invoices
          WHERE entity_id = ? AND invoice_date BETWEEN ? AND ? AND status = 'issued'
            AND deduction_status IN ('eligible', 'partial')`)
            .bind(period.entity_id, period.starts_on, period.ends_on).all(),
        db.prepare(`SELECT * FROM vat_adjustments WHERE period_id = ? AND status = 'approved'`).bind(period.id).all(),
        db.prepare(`SELECT
            (SELECT COUNT(*) FROM sales_invoices WHERE entity_id = ? AND invoice_date BETWEEN ? AND ?
              AND (status = 'draft' OR reconciliation_status IN ('candidate', 'issue')))
            + (SELECT COUNT(*) FROM purchase_invoices WHERE entity_id = ? AND invoice_date BETWEEN ? AND ?
              AND (status = 'draft' OR deduction_status = 'review' OR non_cash_payment_warning = 1)) AS count`)
            .bind(period.entity_id, period.starts_on, period.ends_on,
                period.entity_id, period.starts_on, period.ends_on).first(),
    ]);
    const snapshot = parseJson(period.method_snapshot_json, {});
    const directRates = Object.fromEntries((snapshot.directRates || []).map((row) => [row.revenue_category, Number(row.rate_bps)]));
    const normalizedAdjustments = (adjustments.results || []).map((row) => {
        const direction = ['output_decrease', 'input_increase'].includes(row.adjustment_type) ? -1 : 1;
        return { ...row, amount: Number(row.amount || 0) * direction };
    });
    return {
        sales: salesRows.results || [],
        purchases: purchaseRows.results || [],
        adjustments: normalizedAdjustments,
        directRates,
        issueCount: Number(issueCount?.count || 0),
    };
}

async function rebuildPeriodRow(db, period) {
    if (!['draft', 'in_review'].includes(period.status)) {
        throw Object.assign(new Error('Kỳ đã khóa không thể tính lại.'), { status: 409 });
    }
    const source = await periodSourceData(db, period);
    const result = calculateVatPeriod({
        method: period.method,
        sales: source.sales,
        purchases: source.purchases,
        adjustments: source.adjustments,
        directRates: source.directRates,
        openingCreditAmount: Number(period.opening_credit_amount || 0),
    });
    const now = new Date().toISOString();
    await db.prepare(`UPDATE vat_periods SET output_vat_amount = ?, input_vat_amount = ?,
        deductible_input_vat_amount = ?, adjustment_amount = ?, tax_payable_amount = ?,
        closing_credit_amount = ?, direct_revenue_amount = ?, direct_tax_amount = ?,
        reconciliation_issue_count = ?, updated_at = ? WHERE id = ?`)
        .bind(result.outputVatAmount, result.inputVatAmount, result.deductibleInputVatAmount,
            result.adjustmentAmount, result.taxPayableAmount, result.closingCreditAmount,
            result.directRevenueAmount, result.directTaxAmount, source.issueCount, now, period.id).run();
    return { result, source, period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(period.id).first() };
}

export async function rebuildVatPeriod(request, env, periodId) {
    try {
        const { db } = await authorize(request, env);
        const period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!period) throw Object.assign(new Error('Không tìm thấy kỳ kê khai.'), { status: 404 });
        const rebuilt = await rebuildPeriodRow(db, period);
        return json({ period: rebuilt.period, calculation: rebuilt.result });
    } catch (error) {
        return apiError(error, 'Không thể đối soát lại kỳ kê khai.');
    }
}

export async function submitVatPeriodForReview(request, env, periodId) {
    try {
        const { db } = await authorize(request, env);
        const period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!period) throw Object.assign(new Error('Không tìm thấy kỳ kê khai.'), { status: 404 });
        const rebuilt = await rebuildPeriodRow(db, period);
        if (Number(rebuilt.period.reconciliation_issue_count || 0) > 0) {
            throw Object.assign(new Error(`Còn ${rebuilt.period.reconciliation_issue_count} cảnh báo/đối soát chưa xử lý.`), { status: 409 });
        }
        const now = new Date().toISOString();
        await db.prepare(`UPDATE vat_periods SET status = 'in_review', submitted_for_review_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'`)
            .bind(now, now, period.id).run();
        return json({ period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(period.id).first() });
    } catch (error) {
        return apiError(error, 'Không thể gửi duyệt kỳ kê khai.');
    }
}

async function returnSnapshot(db, period) {
    const source = await periodSourceData(db, period);
    const [entity, salesLines, purchaseLines] = await Promise.all([
        db.prepare('SELECT * FROM tax_entities WHERE id = ?').bind(period.entity_id).first(),
        db.prepare(`SELECT l.*, i.invoice_date, i.invoice_number, i.invoice_series, i.buyer_name, i.buyer_tax_code
            FROM sales_invoice_lines l JOIN sales_invoices i ON i.id = l.invoice_id
            WHERE i.entity_id = ? AND i.invoice_date BETWEEN ? AND ? AND i.status = 'issued'
              AND i.reconciliation_status IN ('matched', 'verified') ORDER BY i.invoice_date, i.id, l.line_number`)
            .bind(period.entity_id, period.starts_on, period.ends_on).all(),
        db.prepare(`SELECT l.*, i.invoice_date, i.invoice_number, i.invoice_series, i.supplier_name, i.supplier_tax_code,
              i.payment_method, i.non_cash_payment_warning
            FROM purchase_invoice_lines l JOIN purchase_invoices i ON i.id = l.invoice_id
            WHERE i.entity_id = ? AND i.invoice_date BETWEEN ? AND ? AND i.status = 'issued'
              AND i.deduction_status IN ('eligible', 'partial') ORDER BY i.invoice_date, i.id, l.line_number`)
            .bind(period.entity_id, period.starts_on, period.ends_on).all(),
    ]);
    return {
        generatedAt: new Date().toISOString(),
        entity,
        period,
        methodSnapshot: parseJson(period.method_snapshot_json, {}),
        sales: source.sales,
        salesLines: salesLines.results || [],
        purchases: source.purchases,
        purchaseLines: purchaseLines.results || [],
        adjustments: source.adjustments,
        reconciliationIssueCount: source.issueCount,
        xmlAcceptance: entity.htkk_version === 'pending_sample'
            ? { status: 'pending_sample', message: 'Cần file XML mẫu 01/GTGT và 04/GTGT đã khử dữ liệu nhạy cảm từ HTKK đang dùng.' }
            : { status: 'adapter_configured', version: entity.htkk_version },
    };
}

export async function lockVatPeriod(request, env, periodId) {
    try {
        const { db, session } = await authorize(request, env, true);
        let period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!period) throw Object.assign(new Error('Không tìm thấy kỳ kê khai.'), { status: 404 });
        if (period.status === 'locked' || period.status === 'filed') return json({ period, idempotentReplay: true });
        if (period.status !== 'in_review') throw Object.assign(new Error('Kỳ phải ở trạng thái đang duyệt trước khi khóa.'), { status: 409 });
        const rebuilt = await rebuildPeriodRow(db, period);
        period = rebuilt.period;
        if (Number(period.reconciliation_issue_count || 0) > 0) {
            throw Object.assign(new Error('Không thể khóa khi còn cảnh báo đối soát.'), { status: 409 });
        }
        const snapshot = await returnSnapshot(db, period);
        const snapshotHash = await immutableHash(snapshot);
        const versionRow = await db.prepare('SELECT COALESCE(MAX(version_number), 0) AS version FROM vat_return_versions WHERE period_id = ?')
            .bind(period.id).first();
        const versionNumber = Number(versionRow?.version || 0) + 1;
        const now = new Date().toISOString();
        const statements = [
            db.prepare('DELETE FROM vat_period_entries WHERE period_id = ?').bind(period.id),
            db.prepare(`INSERT INTO vat_period_entries (
                period_id, entry_type, entry_id, immutable_hash, net_amount, vat_amount,
                deductible_vat_amount, direct_revenue_category, created_at
              ) SELECT ?, 'sales', id, COALESCE(immutable_hash, source_checksum, id), net_amount,
                vat_amount, 0, COALESCE((SELECT direct_revenue_category FROM sales_invoice_lines l
                  WHERE l.invoice_id = sales_invoices.id ORDER BY line_number LIMIT 1), 'goods'), ?
              FROM sales_invoices WHERE entity_id = ? AND invoice_date BETWEEN ? AND ?
                AND status = 'issued' AND reconciliation_status IN ('matched', 'verified')`)
                .bind(period.id, now, period.entity_id, period.starts_on, period.ends_on),
            db.prepare(`INSERT INTO vat_period_entries (
                period_id, entry_type, entry_id, immutable_hash, net_amount, vat_amount,
                deductible_vat_amount, created_at
              ) SELECT ?, 'purchase', id, COALESCE(immutable_hash, id), net_amount,
                vat_amount, deductible_vat_amount, ? FROM purchase_invoices
              WHERE entity_id = ? AND invoice_date BETWEEN ? AND ? AND status = 'issued'
                AND deduction_status IN ('eligible', 'partial')`)
                .bind(period.id, now, period.entity_id, period.starts_on, period.ends_on),
            db.prepare(`INSERT INTO vat_period_entries (
                period_id, entry_type, entry_id, immutable_hash, vat_amount, created_at
              ) SELECT ?, 'adjustment', id, id, amount, ? FROM vat_adjustments
              WHERE period_id = ? AND status = 'approved'`).bind(period.id, now, period.id),
            db.prepare(`INSERT INTO vat_return_versions (
                id, period_id, version_number, return_form, htkk_version, status,
                snapshot_json, snapshot_hash, xml_validation_status, created_by, created_at
              ) VALUES (?, ?, ?, ?, ?, 'locked', ?, ?, ?, ?, ?)`)
                .bind(randomId(), period.id, versionNumber, period.method === 'direct_04' ? '04/GTGT' : '01/GTGT',
                    snapshot.entity.htkk_version, JSON.stringify(snapshot), snapshotHash,
                    snapshot.entity.htkk_version === 'pending_sample' ? 'pending_sample' : 'internal_valid',
                    session.user_id, now),
            db.prepare(`UPDATE vat_periods SET status = 'locked', locked_at = ?, locked_by = ?, updated_at = ?
              WHERE id = ? AND status = 'in_review'`).bind(now, session.user_id, now, period.id),
        ];
        await db.batch(statements);
        return json({
            period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(period.id).first(),
            returnVersion: await db.prepare('SELECT * FROM vat_return_versions WHERE period_id = ? ORDER BY version_number DESC LIMIT 1').bind(period.id).first(),
        });
    } catch (error) {
        return apiError(error, 'Không thể khóa kỳ kê khai.');
    }
}

export async function markVatPeriodFiled(request, env, periodId) {
    try {
        const { db, session } = await authorize(request, env, true);
        const period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!period) throw Object.assign(new Error('Không tìm thấy kỳ kê khai.'), { status: 404 });
        if (period.status === 'filed') return json({ period, idempotentReplay: true });
        if (period.status !== 'locked') throw Object.assign(new Error('Chỉ kỳ đã khóa mới được đánh dấu đã nộp.'), { status: 409 });
        const now = new Date().toISOString();
        await db.batch([
            db.prepare(`UPDATE vat_periods SET status = 'filed', filed_at = ?, filed_by = ?, updated_at = ? WHERE id = ? AND status = 'locked'`)
                .bind(now, session.user_id, now, period.id),
            db.prepare(`UPDATE vat_return_versions SET status = 'filed' WHERE period_id = ? AND status = 'locked'`).bind(period.id),
        ]);
        return json({ period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(period.id).first() });
    } catch (error) {
        return apiError(error, 'Không thể đánh dấu kỳ đã nộp.');
    }
}

export async function amendVatPeriod(request, env, periodId) {
    try {
        const { db, session } = await authorize(request, env, true);
        const source = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!source || !['locked', 'filed', 'amended'].includes(source.status)) {
            throw Object.assign(new Error('Chỉ kỳ đã khóa/đã nộp mới được lập bổ sung.'), { status: 409 });
        }
        const existing = await db.prepare(`SELECT * FROM vat_periods WHERE parent_period_id = ? AND status IN ('draft', 'in_review') ORDER BY created_at DESC LIMIT 1`).bind(source.id).first();
        if (existing) return json({ period: existing, idempotentReplay: true });
        const id = randomId();
        const now = new Date().toISOString();
        await db.batch([
            db.prepare(`INSERT INTO vat_periods (
                id, entity_id, period_key, starts_on, ends_on, filing_cycle, method, status,
                method_snapshot_json, opening_credit_amount, parent_period_id, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`)
                .bind(id, source.entity_id, source.period_key, source.starts_on, source.ends_on,
                    source.filing_cycle, source.method, source.method_snapshot_json,
                    source.opening_credit_amount, source.id, session.user_id, now, now),
            db.prepare(`UPDATE vat_periods SET status = 'amended', updated_at = ? WHERE id = ?`).bind(now, source.id),
        ]);
        return json({ period: await db.prepare('SELECT * FROM vat_periods WHERE id = ?').bind(id).first() }, 201);
    } catch (error) {
        return apiError(error, 'Không thể lập kỳ bổ sung.');
    }
}

export async function listVatAdjustments(request, env) {
    try {
        const { db } = await authorize(request, env);
        const url = new URL(request.url);
        const periodId = cleanText(url.searchParams.get('periodId'), 100);
        const result = periodId
            ? await db.prepare('SELECT * FROM vat_adjustments WHERE period_id = ? ORDER BY created_at DESC').bind(periodId).all()
            : await db.prepare('SELECT * FROM vat_adjustments ORDER BY created_at DESC LIMIT 200').all();
        return json({ data: result.results || [] });
    } catch (error) {
        return apiError(error, 'Không thể tải điều chỉnh VAT.');
    }
}

export async function saveVatAdjustment(request, env) {
    try {
        const { db, session } = await authorize(request, env);
        const body = await readJson(request, 32 * 1024);
        const period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(requiredText(body.period_id, 'Kỳ kê khai', 100)).first();
        if (!period || !['draft', 'in_review'].includes(period.status)) {
            throw Object.assign(new Error('Chỉ được điều chỉnh kỳ chưa khóa.'), { status: 409 });
        }
        const types = ['output_increase', 'output_decrease', 'input_increase', 'input_decrease', 'credit_carry', 'other'];
        if (!types.includes(body.adjustment_type)) throw Object.assign(new Error('Loại điều chỉnh không hợp lệ.'), { status: 400 });
        const now = new Date().toISOString();
        const id = randomId();
        const status = session.roles.includes('master_admin') && body.approve ? 'approved' : 'draft';
        await db.prepare(`INSERT INTO vat_adjustments (
            id, period_id, adjustment_type, amount, reason, legal_basis, source_period_key,
            status, created_by, approved_by, approved_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(id, period.id, body.adjustment_type, money(body.amount, 'Giá trị điều chỉnh', { allowNegative: true }),
                requiredText(body.reason, 'Lý do', 2000), nullableText(body.legal_basis, 2000),
                nullableText(body.source_period_key, 80), status, session.user_id,
                status === 'approved' ? session.user_id : null, status === 'approved' ? now : null, now, now).run();
        return json({ adjustment: await db.prepare('SELECT * FROM vat_adjustments WHERE id = ?').bind(id).first() }, 201);
    } catch (error) {
        return apiError(error, 'Không thể lưu điều chỉnh VAT.');
    }
}

export async function getVatExportData(request, env, periodId) {
    try {
        const { db } = await authorize(request, env);
        const period = await db.prepare('SELECT * FROM vat_periods WHERE id = ? LIMIT 1').bind(periodId).first();
        if (!period) throw Object.assign(new Error('Không tìm thấy kỳ kê khai.'), { status: 404 });
        if (!['locked', 'filed', 'amended'].includes(period.status)) {
            throw Object.assign(new Error('Phải khóa kỳ trước khi xuất hồ sơ chính thức.'), { status: 409 });
        }
        const version = await db.prepare('SELECT * FROM vat_return_versions WHERE period_id = ? ORDER BY version_number DESC LIMIT 1').bind(period.id).first();
        if (!version) throw Object.assign(new Error('Kỳ chưa có bản kê khai bất biến.'), { status: 409 });
        return json({
            period,
            returnVersion: { ...version, snapshot: parseJson(version.snapshot_json, {}) },
            acceptance: {
                xlsx: 'internal_verified',
                pdf: 'print_ready',
                xml: version.xml_validation_status,
                canImportToHtkk: version.xml_validation_status === 'htkk_valid',
            },
        });
    } catch (error) {
        return apiError(error, 'Không thể chuẩn bị dữ liệu xuất VAT.');
    }
}

export async function uploadVatDocument(request, env) {
    try {
        const { db, session } = await authorize(request, env);
        if (!env.PRIVATE_RECORDS) throw Object.assign(new Error('Private R2 chưa được cấu hình.'), { status: 503 });
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) throw Object.assign(new Error('Thiếu file chứng từ.'), { status: 400 });
        if (file.size <= 0 || file.size > 20 * 1024 * 1024) throw Object.assign(new Error('File phải nhỏ hơn hoặc bằng 20 MB.'), { status: 413 });
        const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/xml', 'text/xml']);
        if (!allowedTypes.has(file.type)) throw Object.assign(new Error('Loại file chứng từ không được hỗ trợ.'), { status: 400 });
        const ownerType = cleanText(form.get('owner_type'), 50);
        if (!['sales_invoice', 'purchase_invoice', 'period', 'return_version'].includes(ownerType)) {
            throw Object.assign(new Error('Loại chủ thể chứng từ không hợp lệ.'), { status: 400 });
        }
        const ownerId = requiredText(form.get('owner_id'), 'Chủ thể chứng từ', 100);
        const entity = await loadEntity(db);
        const bytes = await file.arrayBuffer();
        const hash = await sha256Hex(new Uint8Array(bytes));
        const safeName = cleanText(file.name, 180).replace(/[^a-zA-Z0-9._-]+/g, '-');
        const id = randomId();
        const objectKey = `vat/${entity.id}/${ownerType}/${ownerId}/${id}-${safeName || 'document'}`;
        const now = new Date().toISOString();
        await env.PRIVATE_RECORDS.put(objectKey, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { sha256: hash } });
        try {
            await db.prepare(`INSERT INTO vat_documents (
                id, entity_id, owner_type, owner_id, object_key, file_name, content_type,
                size_bytes, sha256, uploaded_by, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(id, entity.id, ownerType, ownerId, objectKey, file.name, file.type, file.size, hash, session.user_id, now).run();
        } catch (error) {
            await env.PRIVATE_RECORDS.delete(objectKey).catch(() => undefined);
            throw error;
        }
        return json({ document: await db.prepare('SELECT * FROM vat_documents WHERE id = ?').bind(id).first() }, 201);
    } catch (error) {
        return apiError(error, 'Không thể tải chứng từ VAT lên private R2.');
    }
}

export async function downloadVatDocument(request, env, documentId) {
    try {
        const { db } = await authorize(request, env);
        if (!env.PRIVATE_RECORDS) throw Object.assign(new Error('Private R2 chưa được cấu hình.'), { status: 503 });
        const document = await db.prepare('SELECT * FROM vat_documents WHERE id = ? LIMIT 1').bind(documentId).first();
        if (!document) throw Object.assign(new Error('Không tìm thấy chứng từ.'), { status: 404 });
        const object = await env.PRIVATE_RECORDS.get(document.object_key);
        if (!object) throw Object.assign(new Error('File chứng từ không còn trong R2.'), { status: 404 });
        return new Response(object.body, {
            headers: {
                'Content-Type': document.content_type,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        return apiError(error, 'Không thể tải chứng từ VAT.');
    }
}
