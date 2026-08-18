import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { randomId } from '../platform/crypto.js';
import { createOutboxStatement } from '../email/outbox.js';
import { requireCsrf, requireRole, requireSession } from '../auth/session.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = new Set(['vi', 'en', 'ru', 'cn']);
const STATUSES = new Set(['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled']);

function normalizedEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw Object.assign(new Error('A valid customer email is required.'), { status: 400 });
    return email;
}

function appointmentPayload(row, serviceName, reason = null) {
    return {
        appointment_id: row.id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        service_name: serviceName || '',
        date: row.appointment_date,
        time: row.appointment_time,
        status: row.status,
        reason,
    };
}

export async function createAppointment(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 32 * 1024);
        const user = await db.prepare('SELECT display_name, email, phone, locale FROM users WHERE id = ? LIMIT 1')
            .bind(session.user_id).first();
        const email = normalizedEmail(body.customerEmail || user?.email);
        const serviceId = Number(body.serviceId ?? body.service_id);
        if (!Number.isInteger(serviceId) || serviceId <= 0) throw Object.assign(new Error('A service is required.'), { status: 400 });
        const service = await db.prepare('SELECT id, name FROM services WHERE id = ? AND is_published = 1 LIMIT 1')
            .bind(serviceId).first();
        if (!service) throw Object.assign(new Error('Service was not found.'), { status: 404 });
        const date = String(body.date || '').trim();
        const time = String(body.time || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
            throw Object.assign(new Error('Appointment date or time is invalid.'), { status: 400 });
        }
        const now = new Date().toISOString();
        const row = {
            id: randomId(), user_id: session.user_id, service_id: serviceId,
            doctor_id: String(body.doctorId ?? body.doctor_id ?? '').trim() || null,
            customer_name: String(body.customerName || user?.display_name || email.split('@')[0]).trim().slice(0, 255),
            customer_email: email,
            customer_phone: String(body.customerPhone || user?.phone || '').trim().slice(0, 32),
            appointment_date: date, appointment_time: time,
            locale: LOCALES.has(body.locale) ? body.locale : (LOCALES.has(user?.locale) ? user.locale : 'vi'),
            status: 'pending', notes: String(body.notes || '').trim().slice(0, 2000) || null,
        };
        if (!row.customer_phone) throw Object.assign(new Error('A customer phone is required.'), { status: 400 });
        const payload = appointmentPayload(row, service.name);
        const statements = [
            db.prepare(`INSERT INTO appointments (
                id, user_id, service_id, doctor_id, customer_name, customer_email, customer_phone,
                appointment_date, appointment_time, locale, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(row.id, row.user_id, row.service_id, row.doctor_id, row.customer_name, row.customer_email,
                    row.customer_phone, row.appointment_date, row.appointment_time, row.locale, row.status,
                    row.notes, now, now),
            createOutboxStatement(db, {
                eventType: 'appointment.created', aggregateType: 'appointment', aggregateId: row.id,
                audience: 'customer', recipientEmail: row.customer_email, locale: row.locale, payload,
                idempotencyKey: `customer/appointment.created/${row.id}`,
            }),
        ];
        const adminEmail = String(env.ADMIN_NOTIFICATION_EMAIL || env.SMTP_FROM_ADDRESS || '').trim().toLowerCase();
        if (EMAIL_PATTERN.test(adminEmail)) {
            statements.push(createOutboxStatement(db, {
                eventType: 'appointment.created', aggregateType: 'appointment', aggregateId: row.id,
                audience: 'admin', recipientEmail: adminEmail, locale: 'vi', payload,
                idempotencyKey: `admin/appointment.created/${row.id}`,
            }));
        }
        await db.batch(statements);
        return json({ appointment: { ...row, patient_id: row.user_id, date: row.appointment_date, time: row.appointment_time } }, 201);
    } catch (error) {
        return apiError(error, 'Could not create appointment.');
    }
}

export async function updateAppointmentStatus(request, env, id) {
    try {
        const db = requireD1(env);
        const session = await requireRole(db, request, ['admin', 'master_admin']);
        await requireCsrf(db, request, session);
        const body = await readJson(request, 16 * 1024);
        const status = String(body.status || '').trim();
        if (!STATUSES.has(status)) throw Object.assign(new Error('Appointment status is invalid.'), { status: 400 });
        const current = await db.prepare(`SELECT a.*, s.name AS service_name FROM appointments a LEFT JOIN services s ON s.id = a.service_id WHERE a.id = ? LIMIT 1`)
            .bind(id).first();
        if (!current) throw Object.assign(new Error('Appointment was not found.'), { status: 404 });
        if (current.status === status) return json({ appointment: current, unchanged: true });
        const now = new Date().toISOString();
        const reason = String(body.reason || '').trim().slice(0, 1000) || null;
        const updated = { ...current, status };
        const statements = [
            db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id),
        ];
        if (EMAIL_PATTERN.test(String(current.customer_email || ''))) {
            statements.push(createOutboxStatement(db, {
                eventType: `appointment.${status}`, aggregateType: 'appointment', aggregateId: id,
                audience: 'customer', recipientEmail: current.customer_email, locale: current.locale,
                payload: appointmentPayload(updated, current.service_name, reason),
                idempotencyKey: `customer/appointment.${status}/${id}`,
            }));
        }
        await db.batch(statements);
        return json({ appointment: updated });
    } catch (error) {
        return apiError(error, 'Could not update appointment.');
    }
}
