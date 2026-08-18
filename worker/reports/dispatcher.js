import { createOutboxStatement } from '../email/outbox.js';

function presetDays(preset) {
    if (preset === '90d') return 90;
    if (preset === '30d') return 30;
    return 7;
}

function nextRun(schedule, from = new Date()) {
    const intervalDays = schedule.frequency === 'weekly' ? 7 : 1;
    return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();
}

async function reportPayload(db, schedule, now) {
    const start = new Date(now.getTime() - presetDays(schedule.preset) * 24 * 60 * 60 * 1000).toISOString();
    const [orders, appointments, products, provinces] = await Promise.all([
        db.prepare(`SELECT COUNT(*) AS order_count, COALESCE(SUM(grand_total), 0) AS product_revenue
                    FROM product_orders WHERE created_at >= ? AND status NOT IN ('cancelled', 'refunded')`).bind(start).first(),
        db.prepare(`SELECT COUNT(*) AS appointment_count, COALESCE(SUM(s.price), 0) AS service_revenue
                    FROM appointments a LEFT JOIN services s ON s.id = a.service_id
                    WHERE a.created_at >= ? AND a.status IN ('confirmed', 'completed')`).bind(start).first(),
        db.prepare(`SELECT poi.product_name AS name, SUM(poi.quantity) AS quantity, SUM(poi.quantity * poi.price_at_purchase) AS revenue
                    FROM product_order_items poi JOIN product_orders po ON po.id = poi.order_id
                    WHERE po.created_at >= ? AND po.status NOT IN ('cancelled', 'refunded')
                    GROUP BY poi.product_id, poi.product_name ORDER BY quantity DESC, revenue DESC LIMIT 5`).bind(start).all(),
        db.prepare(`SELECT shipping_province AS province, COUNT(*) AS order_count, SUM(grand_total) AS revenue
                    FROM product_orders WHERE created_at >= ? AND status NOT IN ('cancelled', 'refunded')
                    GROUP BY shipping_province ORDER BY order_count DESC, revenue DESC LIMIT 5`).bind(start).all(),
    ]);
    return {
        report_name: schedule.name,
        preset: schedule.preset,
        period_start: start,
        period_end: now.toISOString(),
        order_count: Number(orders?.order_count || 0),
        product_revenue: Number(orders?.product_revenue || 0),
        appointment_count: Number(appointments?.appointment_count || 0),
        service_revenue: Number(appointments?.service_revenue || 0),
        top_products: products.results || [],
        top_provinces: provinces.results || [],
    };
}

export async function enqueueDueAdminReports(env, limit = 10) {
    if (!env.APP_DB) return { skipped: true, reports: 0, recipients: 0 };
    const now = new Date();
    const due = await env.APP_DB.prepare(`SELECT * FROM admin_report_schedules
        WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
        ORDER BY next_run_at LIMIT ?`).bind(now.toISOString(), Math.max(1, Math.min(25, limit))).all();
    let reports = 0;
    let recipients = 0;
    for (const schedule of due.results || []) {
        let recipientList = [];
        try {
            recipientList = JSON.parse(schedule.recipients_json || '[]');
        } catch {
            recipientList = [];
        }
        const payload = await reportPayload(env.APP_DB, schedule, now);
        const runKey = String(schedule.next_run_at).slice(0, 16);
        const statements = [];
        for (const recipient of recipientList) {
            const email = String(recipient || '').trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
            statements.push(createOutboxStatement(env.APP_DB, {
                eventType: 'admin.report', aggregateType: 'admin_report', aggregateId: schedule.id,
                audience: 'admin', recipientEmail: email, locale: 'vi', payload,
                idempotencyKey: `admin/report/${schedule.id}/${runKey}/${email}`,
            }));
            recipients += 1;
        }
        statements.push(env.APP_DB.prepare(`UPDATE admin_report_schedules
            SET last_sent_at = ?, next_run_at = ?, last_error_at = NULL, last_error_message = NULL, updated_at = ? WHERE id = ?`)
            .bind(now.toISOString(), nextRun(schedule, now), now.toISOString(), schedule.id));
        await env.APP_DB.batch(statements);
        reports += 1;
    }
    return { skipped: false, reports, recipients };
}

