import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { requireCsrf, requireSession } from '../auth/session.js';
import { hydrateOrderItemsWithProductImages } from '../products/orderImage.js';

function parseJson(value, fallback) {
    if (value == null || value === '') return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function publicRole(roles) {
    if (roles.includes('master_admin')) return 'master_admin';
    if (roles.includes('accountant')) return 'accountant';
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('doctor') || roles.includes('editor')) return 'doctor';
    return 'customer';
}

function resolveAvatarUrl(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith('/')) return normalized;
    return `/r2/avatars/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

function profileFromRows(session, patient) {
    const address = parseJson(patient?.address_json, {});
    const avatarUrl = resolveAvatarUrl(session.avatar_url);
    return {
        id: session.user_id,
        name: session.display_name || session.email.split('@')[0],
        dob: patient?.date_of_birth || '',
        phone: session.phone || '',
        email: session.email,
        address_street: address.street || '',
        address_ward: address.ward || '',
        address_district: address.district || '',
        address_province: address.province || '',
        gender: patient?.gender || 'other',
        citizen_id_number: patient?.citizen_id_number || '',
        nationality: patient?.nationality || '',
        medical_history: patient?.medical_history || '',
        skin_type: patient?.skin_type || '',
        allergies: patient?.allergies || '',
        avatar_path: session.avatar_url || '',
        avatar_url: avatarUrl,
        role: publicRole(session.roles),
    };
}

function cleanText(value, maxLength) {
    const normalized = String(value ?? '').trim();
    return normalized.slice(0, maxLength);
}

const PRIVATE_DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
]);

function safeFileName(value) {
    const normalized = cleanText(value, 180)
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'document';
}

function canManageOwner(session, ownerUserId) {
    return ownerUserId === session.user_id
        || session.roles.some((role) => ['admin', 'master_admin', 'doctor'].includes(role));
}

async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function allowedGender(value) {
    return ['male', 'female', 'other'].includes(value) ? value : 'other';
}

function patientAddress(payload) {
    return JSON.stringify({
        street: cleanText(payload.address_street, 300),
        ward: cleanText(payload.address_ward, 160),
        district: cleanText(payload.address_district, 160),
        province: cleanText(payload.address_province, 160),
    });
}

function appointmentRow(row) {
    return {
        ...row,
        patient_id: row.user_id,
        date: row.appointment_date,
        time: row.appointment_time,
    };
}

function medicalRecordRow(row) {
    const plan = parseJson(row.treatment_plan, {});
    const diagnoses = parseJson(row.diagnosis, []);
    return {
        id: row.id,
        appointment_id: row.appointment_id || '',
        encounter_date: row.created_at,
        examining_doctor_id: row.practitioner_id || '',
        preliminary_diagnoses_icd_codes: [],
        definitive_diagnoses_icd_codes: Array.isArray(diagnoses) ? diagnoses : [],
        clinical_notes: row.summary || '',
        services: Array.isArray(plan.services) ? plan.services : [],
        prescriptions: Array.isArray(plan.prescriptions) ? plan.prescriptions : [],
        invoice: plan.invoice || {
            id: `legacy-${row.id}`,
            total_amount: 0,
            payment_status: 'unpaid',
            payment_method: '',
        },
    };
}

async function orderRows(db, orders, items) {
    const hydratedItems = await hydrateOrderItemsWithProductImages(db, items);
    const byOrder = new Map();
    for (const item of hydratedItems) {
        const list = byOrder.get(item.order_id) || [];
        list.push({
            ...item,
        });
        byOrder.set(item.order_id, list);
    }
    return orders.map((order) => ({ ...order, order_items: byOrder.get(order.id) || [] }));
}

async function loadAccountPayload(db, session, includeDetails) {
    const patientPromise = db.prepare('SELECT * FROM patient_profiles WHERE id = ? LIMIT 1')
        .bind(session.user_id).first();
    if (!includeDetails) {
        return { profile: profileFromRows(session, await patientPromise) };
    }

    const [patient, appointments, records, documents, wishlist, orders] = await Promise.all([
        patientPromise,
        db.prepare('SELECT * FROM appointments WHERE user_id = ? ORDER BY appointment_date DESC, appointment_time DESC')
            .bind(session.user_id).all(),
        db.prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC')
            .bind(session.user_id).all(),
        db.prepare('SELECT * FROM private_documents WHERE owner_user_id = ? ORDER BY created_at DESC')
            .bind(session.user_id).all(),
        db.prepare('SELECT product_id FROM wishlists WHERE user_id = ? ORDER BY created_at DESC')
            .bind(session.user_id).all(),
        db.prepare('SELECT * FROM product_orders WHERE user_id = ? ORDER BY created_at DESC')
            .bind(session.user_id).all(),
    ]);

    const orderList = orders.results || [];
    let items = [];
    if (orderList.length > 0) {
        const placeholders = orderList.map(() => '?').join(',');
        const result = await db.prepare(`SELECT * FROM product_order_items WHERE order_id IN (${placeholders}) ORDER BY created_at, id`)
            .bind(...orderList.map((order) => order.id)).all();
        items = result.results || [];
    }

    return {
        profile: profileFromRows(session, patient),
        appointments: (appointments.results || []).map(appointmentRow),
        medical_records: (records.results || []).map(medicalRecordRow),
        documents: (documents.results || []).map((document) => ({
            id: document.id,
            patient_id: document.owner_user_id,
            file_path: document.object_key,
            file_name: document.original_name || document.object_key.split('/').pop() || 'document',
            mime_type: document.content_type,
            ai_summary: document.ai_summary || null,
            created_at: document.created_at,
            public_url: `/api/account/documents/${encodeURIComponent(document.id)}/download`,
        })),
        wishlist: (wishlist.results || []).map((row) => Number(row.product_id)),
        product_orders: await orderRows(db, orderList, items),
        detail_loaded: true,
    };
}

export async function getAccountProfile(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        return json(await loadAccountPayload(db, session, false));
    } catch (error) {
        return apiError(error, 'Could not load account profile.');
    }
}

export async function getAccountData(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        return json(await loadAccountPayload(db, session, true));
    } catch (error) {
        return apiError(error, 'Could not load account data.');
    }
}

export async function updateAccountProfile(request, env) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const payload = await readJson(request, 48 * 1024);
        const now = new Date().toISOString();
        const displayName = cleanText(payload.name, 180);
        const phone = cleanText(payload.phone, 40);
        const avatarPath = cleanText(payload.avatar_path, 1000);

        if (!displayName) {
            throw Object.assign(new Error('Tên không được để trống.'), { status: 400 });
        }

        await db.batch([
            db.prepare(`
                UPDATE users
                SET display_name = ?, phone = ?, avatar_url = ?, updated_at = ?
                WHERE id = ?
            `).bind(displayName, phone || null, avatarPath || null, now, session.user_id),
            db.prepare(`
                INSERT INTO patient_profiles (
                    id, date_of_birth, gender, address_json, emergency_contact_json,
                    citizen_id_number, nationality, medical_history, skin_type, allergies,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    date_of_birth = excluded.date_of_birth,
                    gender = excluded.gender,
                    address_json = excluded.address_json,
                    citizen_id_number = excluded.citizen_id_number,
                    nationality = excluded.nationality,
                    medical_history = excluded.medical_history,
                    skin_type = excluded.skin_type,
                    allergies = excluded.allergies,
                    updated_at = excluded.updated_at
            `).bind(
                session.user_id,
                cleanText(payload.dob, 20) || null,
                allowedGender(payload.gender),
                patientAddress(payload),
                cleanText(payload.citizen_id_number, 80) || null,
                cleanText(payload.nationality, 100) || null,
                cleanText(payload.medical_history, 5000) || null,
                cleanText(payload.skin_type, 160) || null,
                cleanText(payload.allergies, 3000) || null,
                now,
                now,
            ),
        ]);

        const refreshed = await requireSession(db, request);
        return json(await loadAccountPayload(db, refreshed, false));
    } catch (error) {
        return apiError(error, 'Could not update account profile.');
    }
}

export async function addWishlistProduct(request, env, productId) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const normalizedId = Number(productId);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            throw Object.assign(new Error('Sản phẩm không hợp lệ.'), { status: 400 });
        }
        const product = await db.prepare('SELECT id FROM products WHERE id = ? AND archived_at IS NULL LIMIT 1')
            .bind(normalizedId).first();
        if (!product) throw Object.assign(new Error('Không tìm thấy sản phẩm.'), { status: 404 });
        await db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)')
            .bind(session.user_id, normalizedId, new Date().toISOString()).run();
        return json({ ok: true }, 201);
    } catch (error) {
        return apiError(error, 'Could not add wishlist product.');
    }
}

export async function removeWishlistProduct(request, env, productId) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const normalizedId = Number(productId);
        if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
            throw Object.assign(new Error('Sản phẩm không hợp lệ.'), { status: 400 });
        }
        await db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
            .bind(session.user_id, normalizedId).run();
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not remove wishlist product.');
    }
}

export async function downloadPrivateDocument(request, env, documentId) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        const document = await db.prepare('SELECT * FROM private_documents WHERE id = ? LIMIT 1')
            .bind(documentId).first();
        if (!document) throw Object.assign(new Error('Document was not found.'), { status: 404 });
        const canRead = document.owner_user_id === session.user_id
            || session.roles.some((role) => ['admin', 'master_admin', 'doctor'].includes(role));
        if (!canRead) throw Object.assign(new Error('Forbidden.'), { status: 403 });
        if (!env.PRIVATE_RECORDS) {
            throw Object.assign(new Error('Private document storage is not configured.'), { status: 503 });
        }
        const object = await env.PRIVATE_RECORDS.get(document.object_key);
        if (!object) throw Object.assign(new Error('Document object was not found.'), { status: 404 });
        const headers = new Headers({
            'Content-Type': document.content_type || object.httpMetadata?.contentType || 'application/octet-stream',
            'Cache-Control': 'private, no-store',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.original_name || document.object_key.split('/').pop() || 'document')}`,
            'X-Content-Type-Options': 'nosniff',
        });
        return new Response(object.body, { status: 200, headers });
    } catch (error) {
        return apiError(error, 'Could not download document.');
    }
}

export async function uploadPrivateDocument(request, env) {
    let objectKey = '';
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        if (!env.PRIVATE_RECORDS) {
            throw Object.assign(new Error('Private document storage is not configured.'), { status: 503 });
        }
        const contentLength = Number(request.headers.get('content-length') || 0);
        const maxBytes = Math.max(1024, Math.min(Number(env.PRIVATE_DOCUMENT_MAX_BYTES || 20 * 1024 * 1024), 50 * 1024 * 1024));
        if (contentLength > maxBytes + 64 * 1024) {
            throw Object.assign(new Error('Tệp hồ sơ vượt quá giới hạn cho phép.'), { status: 413 });
        }
        const form = await request.formData();
        const file = form.get('file');
        if (!file || typeof file.arrayBuffer !== 'function') {
            throw Object.assign(new Error('Không tìm thấy tệp tải lên.'), { status: 400 });
        }
        const ownerUserId = cleanText(form.get('ownerUserId') || session.user_id, 80);
        if (!ownerUserId || !canManageOwner(session, ownerUserId)) {
            throw Object.assign(new Error('Forbidden.'), { status: 403 });
        }
        const owner = await db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').bind(ownerUserId).first();
        if (!owner) throw Object.assign(new Error('Không tìm thấy người dùng.'), { status: 404 });
        const contentType = cleanText(file.type, 120).toLowerCase();
        if (!PRIVATE_DOCUMENT_MIME_TYPES.has(contentType)) {
            throw Object.assign(new Error('Định dạng hồ sơ không được hỗ trợ.'), { status: 415 });
        }
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
            throw Object.assign(new Error('Kích thước tệp hồ sơ không hợp lệ.'), { status: bytes.byteLength > maxBytes ? 413 : 400 });
        }
        const medicalRecordId = cleanText(form.get('medicalRecordId'), 80) || null;
        if (medicalRecordId) {
            const record = await db.prepare('SELECT id FROM medical_records WHERE id = ? AND patient_id = ? LIMIT 1')
                .bind(medicalRecordId, ownerUserId).first();
            if (!record) throw Object.assign(new Error('Hồ sơ bệnh án không hợp lệ.'), { status: 400 });
        }
        const id = crypto.randomUUID();
        const now = new Date();
        const originalName = safeFileName(file.name);
        objectKey = `patients/${encodeURIComponent(ownerUserId)}/${now.getUTCFullYear()}/${id}-${originalName}`;
        const checksum = await sha256Hex(bytes);
        await env.PRIVATE_RECORDS.put(objectKey, bytes, {
            httpMetadata: { contentType },
            customMetadata: { ownerUserId, documentId: id, checksum },
        });
        try {
            await db.prepare(`INSERT INTO private_documents (
                id, owner_user_id, medical_record_id, object_key, content_type,
                size_bytes, checksum, uploaded_by, original_name, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(id, ownerUserId, medicalRecordId, objectKey, contentType, bytes.byteLength,
                    checksum, session.user_id, originalName, now.toISOString()).run();
        } catch (error) {
            await env.PRIVATE_RECORDS.delete(objectKey).catch(() => undefined);
            throw error;
        }
        return json({ document: {
            id, patient_id: ownerUserId, file_path: objectKey, file_name: originalName,
            mime_type: contentType, ai_summary: null, created_at: now.toISOString(),
            public_url: `/api/account/documents/${encodeURIComponent(id)}/download`,
        } }, 201);
    } catch (error) {
        return apiError(error, 'Could not upload document.');
    }
}

export async function deletePrivateDocument(request, env, documentId) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const document = await db.prepare('SELECT * FROM private_documents WHERE id = ? LIMIT 1').bind(documentId).first();
        if (!document) throw Object.assign(new Error('Document was not found.'), { status: 404 });
        if (!canManageOwner(session, document.owner_user_id)) {
            throw Object.assign(new Error('Forbidden.'), { status: 403 });
        }
        await db.prepare('DELETE FROM private_documents WHERE id = ?').bind(documentId).run();
        if (env.PRIVATE_RECORDS) await env.PRIVATE_RECORDS.delete(document.object_key);
        return json({ ok: true });
    } catch (error) {
        return apiError(error, 'Could not delete document.');
    }
}

export async function updatePrivateDocumentSummary(request, env, documentId) {
    try {
        const db = requireD1(env);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const document = await db.prepare('SELECT * FROM private_documents WHERE id = ? LIMIT 1').bind(documentId).first();
        if (!document) throw Object.assign(new Error('Document was not found.'), { status: 404 });
        if (!canManageOwner(session, document.owner_user_id)) {
            throw Object.assign(new Error('Forbidden.'), { status: 403 });
        }
        const payload = await readJson(request, 32 * 1024);
        const summary = cleanText(payload.summary, 20000);
        await db.prepare('UPDATE private_documents SET ai_summary = ? WHERE id = ?').bind(summary || null, documentId).run();
        return json({ document: {
            id: document.id, patient_id: document.owner_user_id, file_path: document.object_key,
            file_name: document.original_name || document.object_key.split('/').pop() || 'document',
            mime_type: document.content_type, ai_summary: summary || null, created_at: document.created_at,
            public_url: `/api/account/documents/${encodeURIComponent(document.id)}/download`,
        } });
    } catch (error) {
        return apiError(error, 'Could not update document summary.');
    }
}
