import { sha256Hex, randomId } from '../platform/crypto.js';
import { calculateVatDocument } from './calculation.js';

function categoryMap(rows) {
    return new Map((rows || []).map((row) => [row.code, row]));
}

function lineStatements(db, invoiceId, calculated, now) {
    return calculated.lines.map((line, index) => db.prepare(`INSERT INTO sales_invoice_lines (
        id, invoice_id, line_number, source_type, source_id, description, unit, quantity,
        unit_price, gross_before_discount, allocated_discount, vat_category_code, tax_class,
        rate_bps, price_mode, net_amount, vat_amount, gross_amount, direct_revenue_category, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(randomId(), invoiceId, index + 1, line.isShipping ? 'shipping' : 'product',
            String(line.id), line.description || 'Sản phẩm', line.isShipping ? 'lần' : 'sản phẩm',
            line.quantity, line.unitPrice, line.amountBeforeDiscount, line.allocatedDiscount,
            line.vatCategoryCode, line.taxClass, line.rateBps, line.priceMode,
            line.netAmount, line.vatAmount, line.grossAmount, line.revenueCategory, now));
}

async function syncOrderCandidates(db, entity, categories, limit) {
    const result = await db.prepare(`SELECT o.*,
          EXISTS(SELECT 1 FROM pancake_inbound_orders pio WHERE pio.local_order_id = o.id) AS from_pancake
        FROM product_orders o
        WHERE date(o.created_at) >= ? AND o.status NOT IN ('cancelled', 'refunded')
        ORDER BY o.updated_at ASC LIMIT ?`).bind(entity.go_live_date, limit).all();
    let synced = 0;
    let skipped = 0;
    for (const order of result.results || []) {
        const itemResult = await db.prepare(`SELECT i.*, p.vat_category_code, p.vat_classification_approved_at
            FROM product_order_items i LEFT JOIN products p ON p.id = i.product_id
            WHERE i.order_id = ? ORDER BY i.created_at, i.id`).bind(order.id).all();
        const items = itemResult.results || [];
        if (!items.length || items.some((item) => !item.vat_category_code || !item.vat_classification_approved_at || !categories.has(item.vat_category_code))) {
            skipped += 1;
            continue;
        }
        const calculated = calculateVatDocument({
            priceMode: order.tax_mode === 'exclusive' ? 'exclusive' : 'inclusive',
            lines: items.map((item) => {
                const category = categories.get(item.vat_category_code);
                return {
                    id: item.id,
                    description: item.product_name,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.price_at_purchase),
                    rateBps: Number(category.rate_bps),
                    vatCategoryCode: category.code,
                    taxClass: category.tax_class,
                    directRevenueCategory: category.direct_revenue_category,
                };
            }),
            discountAmount: Number(order.discount_amount || 0),
            shippingFee: Number(order.shipping_fee || 0),
            shippingRateBps: 0,
            shippingVatCategoryCode: 'NON_SUBJECT',
            shippingTaxClass: 'non_subject',
        });
        const sourceType = order.from_pancake ? 'pancake_order'
            : order.order_channel === 'pos' ? 'pos_order' : 'online_order';
        const payload = { order, items, calculated };
        const sourceChecksum = await sha256Hex(JSON.stringify(payload));
        const existing = await db.prepare(`SELECT * FROM sales_invoices
            WHERE entity_id = ? AND source_type = ? AND source_id = ? LIMIT 1`)
            .bind(entity.id, sourceType, order.id).first();
        if (existing && existing.status !== 'draft') continue;
        if (existing?.source_checksum === sourceChecksum) continue;
        const id = existing?.id || randomId();
        const now = new Date().toISOString();
        const statements = [];
        if (existing) statements.push(db.prepare('DELETE FROM sales_invoice_lines WHERE invoice_id = ?').bind(id));
        statements.push(db.prepare(`INSERT INTO sales_invoices (
            id, entity_id, source_type, source_id, source_channel, invoice_date, buyer_name,
            buyer_email, payment_method, status, currency, price_mode, subtotal_amount,
            discount_amount, net_amount, vat_amount, gross_amount, reconciliation_status,
            source_checksum, idempotency_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'VND', ?, ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET source_channel = excluded.source_channel,
            invoice_date = excluded.invoice_date, buyer_name = excluded.buyer_name,
            buyer_email = excluded.buyer_email, payment_method = excluded.payment_method,
            price_mode = excluded.price_mode, subtotal_amount = excluded.subtotal_amount,
            discount_amount = excluded.discount_amount, net_amount = excluded.net_amount,
            vat_amount = excluded.vat_amount, gross_amount = excluded.gross_amount,
            source_checksum = excluded.source_checksum, updated_at = excluded.updated_at`)
            .bind(id, entity.id, sourceType, order.id, order.order_channel || 'online',
                String(order.created_at).slice(0, 10), order.customer_name, order.customer_email,
                order.payment_method, order.tax_mode === 'exclusive' ? 'exclusive' : 'inclusive',
                calculated.subtotalAmount, calculated.discountAmount, calculated.netAmount,
                calculated.vatAmount, calculated.grossAmount, sourceChecksum,
                `vat-candidate:${sourceType}:${order.id}`, existing?.created_at || now, now));
        statements.push(...lineStatements(db, id, calculated, now));
        await db.batch(statements);
        synced += 1;
    }
    return { synced, skipped };
}

async function syncClinicCandidates(db, entity, categories, limit) {
    const result = await db.prepare(`SELECT a.*, s.name AS service_name, s.price,
            s.vat_category_code, s.vat_classification_approved_at
        FROM appointments a JOIN services s ON s.id = a.service_id
        WHERE a.status = 'completed' AND a.appointment_date >= ?
        ORDER BY a.updated_at ASC LIMIT ?`).bind(entity.go_live_date, limit).all();
    let synced = 0;
    let skipped = 0;
    for (const appointment of result.results || []) {
        const category = categories.get(appointment.vat_category_code);
        if (!category || !appointment.vat_classification_approved_at) {
            skipped += 1;
            continue;
        }
        const calculated = calculateVatDocument({
            priceMode: category.default_price_mode,
            lines: [{
                id: appointment.id,
                description: appointment.service_name,
                quantity: 1,
                unitPrice: Number(appointment.price || 0),
                rateBps: Number(category.rate_bps),
                vatCategoryCode: category.code,
                taxClass: category.tax_class,
                directRevenueCategory: category.direct_revenue_category || 'services',
            }],
        });
        const sourceChecksum = await sha256Hex(JSON.stringify({ appointment, calculated }));
        const existing = await db.prepare(`SELECT * FROM sales_invoices
            WHERE entity_id = ? AND source_type = 'clinic_service' AND source_id = ? LIMIT 1`)
            .bind(entity.id, appointment.id).first();
        if (existing && existing.status !== 'draft') continue;
        if (existing?.source_checksum === sourceChecksum) continue;
        const id = existing?.id || randomId();
        const now = new Date().toISOString();
        const statements = [];
        if (existing) statements.push(db.prepare('DELETE FROM sales_invoice_lines WHERE invoice_id = ?').bind(id));
        statements.push(db.prepare(`INSERT INTO sales_invoices (
            id, entity_id, source_type, source_id, source_channel, invoice_date, buyer_name,
            buyer_email, status, currency, price_mode, subtotal_amount, discount_amount,
            net_amount, vat_amount, gross_amount, reconciliation_status, source_checksum,
            idempotency_key, created_at, updated_at
          ) VALUES (?, ?, 'clinic_service', ?, 'clinic', ?, ?, ?, 'draft', 'VND', ?, ?, 0, ?, ?, ?, 'candidate', ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET invoice_date = excluded.invoice_date,
            buyer_name = excluded.buyer_name, buyer_email = excluded.buyer_email,
            price_mode = excluded.price_mode, subtotal_amount = excluded.subtotal_amount,
            net_amount = excluded.net_amount, vat_amount = excluded.vat_amount,
            gross_amount = excluded.gross_amount, source_checksum = excluded.source_checksum,
            updated_at = excluded.updated_at`)
            .bind(id, entity.id, appointment.id, appointment.appointment_date,
                appointment.customer_name, appointment.customer_email, category.default_price_mode,
                calculated.subtotalAmount, calculated.netAmount, calculated.vatAmount,
                calculated.grossAmount, sourceChecksum, `vat-candidate:clinic:${appointment.id}`,
                existing?.created_at || now, now));
        statements.push(...lineStatements(db, id, calculated, now));
        await db.batch(statements);
        synced += 1;
    }
    return { synced, skipped };
}

export async function syncVatCandidates(env, options = {}) {
    const db = env?.APP_DB;
    if (!db || String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return { skipped: true, reason: 'd1_disabled' };
    const entity = await db.prepare(`SELECT * FROM tax_entities WHERE is_active = 1 AND go_live_date IS NOT NULL ORDER BY created_at LIMIT 1`).first();
    if (!entity) return { skipped: true, reason: 'vat_not_live' };
    const categoryResult = await db.prepare('SELECT * FROM vat_categories WHERE is_active = 1').all();
    const categories = categoryMap(categoryResult.results || []);
    const limit = Math.max(1, Math.min(Number(options.limit || 50), 200));
    const [orders, clinic] = await Promise.all([
        syncOrderCandidates(db, entity, categories, limit),
        syncClinicCandidates(db, entity, categories, limit),
    ]);
    return { orders, clinic };
}
