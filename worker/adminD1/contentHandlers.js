import { requireCsrf, requireRole } from '../auth/session.js';
import { apiError, json, readJson, requireD1 } from '../platform/http.js';
import { listPayload, paginationFromRequest, recordAdminAuditAttempt, revisionValue } from './support.js';

const SITE_RESOURCES = new Set([
    'featured_posts', 'featured_services', 'featured_doctors', 'doctors', 'faq_items',
    'homepage_hero', 'site_info', 'footer_content', 'auth_page_images',
    'about_page_content', 'about_features', 'about_values', 'payment_settings',
]);
const ROLES = new Set(['customer', 'doctor', 'editor', 'accountant', 'admin', 'master_admin']);

function clean(value, max = 10000) { return String(value ?? '').trim().slice(0, max); }
function optional(value, max = 10000) { return clean(value, max) || null; }
function flag(value, fallback = false) {
    if (value == null) return fallback ? 1 : 0;
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}
function integer(value, fallback = 0) {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}
function jsonValue(value, fallback = []) {
    if (value == null || value === '') return JSON.stringify(fallback);
    if (typeof value === 'string') { try { JSON.parse(value); return value; } catch { return JSON.stringify(value); } }
    return JSON.stringify(value);
}
function parseJson(value, fallback) {
    try {
        const parsed = JSON.parse(value);
        return parsed == null ? fallback : parsed;
    } catch {
        return fallback;
    }
}
function slug(value) {
    return clean(value, 255).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function admin(request, env, write = false) {
    const db = requireD1(env);
    const session = await requireRole(db, request, ['admin', 'master_admin']);
    if (write) {
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
    }
    return { db, session };
}
async function clinical(request, env, write = false) {
    const db = requireD1(env);
    const session = await requireRole(db, request, ['admin', 'master_admin']);
    if (write) {
        await requireCsrf(db, request, session);
        await recordAdminAuditAttempt(db, request, session);
    }
    return { db, session };
}

function serviceRow(row, steps = []) {
    return {
        ...row,
        is_published: Boolean(row.is_published), is_featured: Boolean(row.is_featured),
        benefits: parseJson(row.benefits_json, []), benefits_en: parseJson(row.benefits_en_json, []),
        benefits_ru: parseJson(row.benefits_ru_json, []), benefits_cn: parseJson(row.benefits_cn_json, []),
        faq_items: parseJson(row.faq_items_json, []), local_seo_tags: parseJson(row.local_seo_tags_json, []),
        procedure_steps: steps,
    };
}

export async function listAdminServices(request, env) {
    try {
        const { db } = await admin(request, env);
        const { url, page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const conditions = ['1 = 1'];
        const bindings = [];
        if (query) {
            const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            conditions.push('(s.name LIKE ? OR s.slug LIKE ? OR s.description LIKE ?)');
            bindings.push(pattern, pattern, pattern);
        }
        const published = url.searchParams.get('published');
        if (published === 'true' || published === 'false') { conditions.push('s.is_published = ?'); bindings.push(published === 'true' ? 1 : 0); }
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM services s WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM services s WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT s.* FROM services s WHERE ${where} ORDER BY s.is_featured DESC, s.name COLLATE NOCASE LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, offset).all(),
        ]);
        const services = rows.results || [];
        const stepsByService = new Map();
        if (url.searchParams.get('include')?.split(',').includes('steps') && services.length) {
            const ids = services.map((row) => row.id);
            const steps = await db.prepare(`SELECT * FROM procedure_steps WHERE service_id IN (${ids.map(() => '?').join(',')}) ORDER BY service_id, step_number`)
                .bind(...ids).all();
            for (const step of steps.results || []) {
                const list = stepsByService.get(step.service_id) || [];
                list.push(step);
                stepsByService.set(step.service_id, list);
            }
        }
        const data = services.map((row) => serviceRow(row, stepsByService.get(row.id) || []));
        return json(listPayload(data, {
            page, pageSize, total: integer(countRow?.total), revision: revisionValue(revisionRow?.revision),
        }, 'services'));
    } catch (error) { return apiError(error, 'Could not load services.'); }
}

export async function saveAdminService(request, env) {
    try {
        const { db } = await admin(request, env, true);
        const body = await readJson(request, 512 * 1024);
        const input = body.service || body;
        const serviceSlug = slug(input.slug || input.name);
        const name = clean(input.name, 500);
        if (!serviceSlug || !name) throw Object.assign(new Error('Tên và slug dịch vụ là bắt buộc.'), { status: 400 });
        const requestedId = integer(input.id);
        const id = requestedId > 0 ? requestedId : Number((await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM services').first())?.id || 1);
        const now = new Date().toISOString();
        const statements = [db.prepare(`INSERT INTO services (
            id, slug, name, name_en, name_ru, name_cn, description, description_en, description_ru, description_cn,
            long_description, long_description_en, long_description_ru, long_description_cn,
            benefits_json, benefits_en_json, benefits_ru_json, benefits_cn_json, faq_items_json, local_seo_tags_json,
            price, duration_minutes, image_path, icon, is_published, is_featured, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, name_en=excluded.name_en,
            name_ru=excluded.name_ru, name_cn=excluded.name_cn, description=excluded.description,
            description_en=excluded.description_en, description_ru=excluded.description_ru, description_cn=excluded.description_cn,
            long_description=excluded.long_description, long_description_en=excluded.long_description_en,
            long_description_ru=excluded.long_description_ru, long_description_cn=excluded.long_description_cn,
            benefits_json=excluded.benefits_json, benefits_en_json=excluded.benefits_en_json,
            benefits_ru_json=excluded.benefits_ru_json, benefits_cn_json=excluded.benefits_cn_json,
            faq_items_json=excluded.faq_items_json, local_seo_tags_json=excluded.local_seo_tags_json,
            price=excluded.price, duration_minutes=excluded.duration_minutes, image_path=excluded.image_path,
            icon=excluded.icon, is_published=excluded.is_published, is_featured=excluded.is_featured, updated_at=excluded.updated_at`)
            .bind(id, serviceSlug, name, optional(input.name_en, 500), optional(input.name_ru, 500), optional(input.name_cn, 500),
                optional(input.description, 20000), optional(input.description_en, 20000), optional(input.description_ru, 20000), optional(input.description_cn, 20000),
                optional(input.long_description, 100000), optional(input.long_description_en, 100000), optional(input.long_description_ru, 100000), optional(input.long_description_cn, 100000),
                jsonValue(input.benefits), jsonValue(input.benefits_en), jsonValue(input.benefits_ru), jsonValue(input.benefits_cn),
                jsonValue(input.faq_items), jsonValue(input.local_seo_tags), Math.max(0, integer(input.price)),
                input.duration_minutes == null ? null : Math.max(0, integer(input.duration_minutes)), optional(input.image_path, 2000), optional(input.icon, 100),
                flag(input.is_published, true), flag(input.is_featured), now, now),
            db.prepare('DELETE FROM procedure_steps WHERE service_id = ?').bind(id),
        ];
        const steps = Array.isArray(input.procedure_steps) ? input.procedure_steps.slice(0, 100) : [];
        steps.forEach((step, index) => statements.push(db.prepare(`INSERT INTO procedure_steps (
            id, service_id, step_number, title, description, title_en, title_ru, title_cn,
            description_en, description_ru, description_cn, image_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(String(step.id || crypto.randomUUID()), id, integer(step.step_number, index + 1), clean(step.title, 500),
                optional(step.description, 10000), optional(step.title_en, 500), optional(step.title_ru, 500), optional(step.title_cn, 500),
                optional(step.description_en, 10000), optional(step.description_ru, 10000), optional(step.description_cn, 10000),
                optional(step.image_path, 2000), now, now)));
        await db.batch(statements);
        const saved = await db.prepare('SELECT * FROM services WHERE id = ?').bind(id).first();
        const savedSteps = await db.prepare('SELECT * FROM procedure_steps WHERE service_id = ? ORDER BY step_number').bind(id).all();
        return json({ service: serviceRow(saved, savedSteps.results || []) });
    } catch (error) { return apiError(error, 'Could not save service.'); }
}

export async function deleteAdminService(request, env, id) {
    try {
        const { db } = await admin(request, env, true);
        const serviceId = integer(id);
        const appointmentCount = Number((await db.prepare('SELECT COUNT(*) AS count FROM appointments WHERE service_id = ?').bind(serviceId).first())?.count || 0);
        if (appointmentCount) {
            await db.prepare('UPDATE services SET is_published = 0, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), serviceId).run();
            return json({ outcome: 'archived' });
        }
        await db.prepare('DELETE FROM services WHERE id = ?').bind(serviceId).run();
        return json({ outcome: 'deleted' });
    } catch (error) { return apiError(error, 'Could not delete service.'); }
}

export async function saveAdminBlogPost(request, env) {
    try {
        const { db, session } = await admin(request, env, true);
        const body = await readJson(request, 1024 * 1024);
        const post = body.post || body;
        const postSlug = slug(post.slug || post.title);
        const title = clean(post.title, 1000);
        if (!postSlug || !title) throw Object.assign(new Error('Tiêu đề và slug bài viết là bắt buộc.'), { status: 400 });
        const now = new Date().toISOString();
        const id = clean(post.id || postSlug, 180);
        const status = ['draft', 'published', 'archived'].includes(post.status) ? post.status : 'published';
        await db.prepare(`INSERT INTO blog_posts (
            id, slug, category_slug, author_id, title, title_en, title_ru, title_cn,
            summary, summary_en, summary_ru, summary_cn, content, content_en, content_ru, content_cn,
            image_path, meta_description, meta_keywords, canonical_url, local_seo_tags_json,
            status, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, category_slug=excluded.category_slug,
            author_id=excluded.author_id, title=excluded.title, title_en=excluded.title_en,
            title_ru=excluded.title_ru, title_cn=excluded.title_cn, summary=excluded.summary,
            summary_en=excluded.summary_en, summary_ru=excluded.summary_ru, summary_cn=excluded.summary_cn,
            content=excluded.content, content_en=excluded.content_en, content_ru=excluded.content_ru,
            content_cn=excluded.content_cn, image_path=excluded.image_path,
            meta_description=excluded.meta_description, meta_keywords=excluded.meta_keywords,
            canonical_url=excluded.canonical_url, local_seo_tags_json=excluded.local_seo_tags_json,
            status=excluded.status, published_at=excluded.published_at, updated_at=excluded.updated_at`)
            .bind(id, postSlug, optional(post.category_slug, 255), optional(post.author_id || session.user_id, 80), title,
                optional(post.title_en, 1000), optional(post.title_ru, 1000), optional(post.title_cn, 1000),
                optional(post.summary, 20000), optional(post.summary_en, 20000), optional(post.summary_ru, 20000), optional(post.summary_cn, 20000),
                optional(post.content, 500000), optional(post.content_en, 500000), optional(post.content_ru, 500000), optional(post.content_cn, 500000),
                optional(post.image_path, 2000), optional(post.meta_description, 1000), optional(post.meta_keywords, 2000), optional(post.canonical_url, 2000),
                jsonValue(post.local_seo_tags), status, post.date || post.published_at || (status === 'published' ? now : null), now, now).run();
        const saved = await db.prepare('SELECT *, published_at AS date FROM blog_posts WHERE id = ?').bind(id).first();
        return json({ post: { ...saved, local_seo_tags: parseJson(saved.local_seo_tags_json, []) } });
    } catch (error) { return apiError(error, 'Could not save blog post.'); }
}

export async function listAdminBlogPosts(request, env) {
    try {
        const { db } = await admin(request, env);
        const { url, page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const conditions = ['1 = 1'];
        const bindings = [];
        if (query) {
            const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            conditions.push('(p.title LIKE ? OR p.slug LIKE ? OR p.summary LIKE ?)');
            bindings.push(pattern, pattern, pattern);
        }
        const status = clean(url.searchParams.get('status'), 40);
        if (status) { conditions.push('p.status = ?'); bindings.push(status); }
        const category = clean(url.searchParams.get('category'), 255);
        if (category) { conditions.push('p.category_slug = ?'); bindings.push(category); }
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM blog_posts p WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM blog_posts p WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT p.*, p.published_at AS date, c.name AS category_name, u.display_name AS author_name
                FROM blog_posts p LEFT JOIN blog_categories c ON c.slug = p.category_slug
                LEFT JOIN users u ON u.id = p.author_id WHERE ${where}
                ORDER BY COALESCE(p.published_at, p.updated_at) DESC LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, offset).all(),
        ]);
        const posts = (rows.results || []).map((row) => ({ ...row, local_seo_tags: parseJson(row.local_seo_tags_json, []) }));
        return json(listPayload(posts, {
            page, pageSize, total: integer(countRow?.total), revision: revisionValue(revisionRow?.revision),
        }, 'posts'));
    } catch (error) { return apiError(error, 'Could not load blog posts.'); }
}

export async function deleteAdminBlogPost(request, env, postSlug) {
    try { const { db } = await admin(request, env, true); await db.prepare('DELETE FROM blog_posts WHERE slug = ?').bind(postSlug).run(); return json({ ok: true }); }
    catch (error) { return apiError(error, 'Could not delete blog post.'); }
}

export async function saveAdminBlogCategory(request, env) {
    try {
        const { db } = await admin(request, env, true); const body = await readJson(request, 64 * 1024); const category = body.category || body;
        const categorySlug = slug(category.slug || category.name); const name = clean(category.name, 500);
        if (!categorySlug || !name) throw Object.assign(new Error('Tên và slug chuyên mục là bắt buộc.'), { status: 400 });
        const now = new Date().toISOString(); const id = clean(category.id || categorySlug, 180);
        await db.prepare(`INSERT INTO blog_categories (id, slug, name, name_en, name_ru, name_cn, description, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name,
            name_en=excluded.name_en, name_ru=excluded.name_ru, name_cn=excluded.name_cn,
            description=excluded.description, display_order=excluded.display_order, updated_at=excluded.updated_at`)
            .bind(id, categorySlug, name, optional(category.name_en, 500), optional(category.name_ru, 500), optional(category.name_cn, 500),
                optional(category.description, 5000), integer(category.display_order), now, now).run();
        return json({ category: await db.prepare('SELECT * FROM blog_categories WHERE id = ?').bind(id).first() });
    } catch (error) { return apiError(error, 'Could not save blog category.'); }
}

export async function listAdminBlogCategories(request, env) {
    try {
        const { db } = await admin(request, env);
        const { page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        const where = query ? 'WHERE c.name LIKE ? OR c.slug LIKE ?' : '';
        const bindings = query ? [pattern, pattern] : [];
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM blog_categories c ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM blog_categories c ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT c.*, COUNT(p.id) AS post_count FROM blog_categories c
                LEFT JOIN blog_posts p ON p.category_slug = c.slug ${where}
                GROUP BY c.id ORDER BY c.display_order, c.name COLLATE NOCASE LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, offset).all(),
        ]);
        const categories = (rows.results || []).map((row) => ({ ...row, post_count: integer(row.post_count) }));
        return json(listPayload(categories, {
            page, pageSize, total: integer(countRow?.total), revision: revisionValue(revisionRow?.revision),
        }, 'categories'));
    } catch (error) { return apiError(error, 'Could not load blog categories.'); }
}

export async function deleteAdminBlogCategory(request, env, categorySlug) {
    try { const { db } = await admin(request, env, true); await db.prepare('DELETE FROM blog_categories WHERE slug = ?').bind(categorySlug).run(); return json({ ok: true }); }
    catch (error) { return apiError(error, 'Could not delete blog category.'); }
}

export async function listAdminSiteContent(request, env, resource) {
    try {
        const { db } = await admin(request, env); if (!SITE_RESOURCES.has(resource)) throw Object.assign(new Error('Unsupported content resource.'), { status: 404 });
        const rows = await db.prepare('SELECT * FROM site_content WHERE resource = ? ORDER BY resource_key').bind(resource).all();
        return json({ items: (rows.results || []).map((row) => ({ id: row.resource_key, ...parseJson(row.payload_json, {}), is_published: Boolean(row.is_published) })) });
    } catch (error) { return apiError(error, 'Could not load site content.'); }
}

export async function saveAdminSiteContent(request, env, resource) {
    try {
        const { db } = await admin(request, env, true); if (!SITE_RESOURCES.has(resource)) throw Object.assign(new Error('Unsupported content resource.'), { status: 404 });
        const body = await readJson(request, 1024 * 1024); const items = Array.isArray(body.items) ? body.items.slice(0, 1000) : [body.item || body];
        const replace = body.replace === true; const now = new Date().toISOString(); const statements = [];
        if (replace) statements.push(db.prepare('DELETE FROM site_content WHERE resource = ?').bind(resource));
        if (resource === 'featured_services') {
            statements.push(db.prepare('UPDATE services SET is_featured = 0, updated_at = ?').bind(now));
        }
        items.forEach((item, index) => {
            const key = clean(item.resource_key ?? item.id ?? item.slug ?? item.code ?? index, 255);
            if (!key) return;
            const payload = { ...item }; delete payload.resource_key; delete payload.is_published;
            statements.push(db.prepare(`INSERT INTO site_content (resource, resource_key, payload_json, is_published, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(resource, resource_key) DO UPDATE SET
                payload_json=excluded.payload_json, is_published=excluded.is_published, updated_at=excluded.updated_at`)
                .bind(resource, key, JSON.stringify(payload), flag(item.is_published, true), now, now));
            if (resource === 'featured_services') {
                const serviceId = integer(item.service_id ?? item.id);
                if (serviceId > 0) statements.push(db.prepare('UPDATE services SET is_featured = 1, updated_at = ? WHERE id = ?').bind(now, serviceId));
            }
        });
        if (statements.length) await db.batch(statements);
        return listAdminSiteContent(request, env, resource);
    } catch (error) { return apiError(error, 'Could not save site content.'); }
}

export async function deleteAdminSiteContent(request, env, resource, key) {
    try { const { db } = await admin(request, env, true); if (!SITE_RESOURCES.has(resource)) throw Object.assign(new Error('Unsupported content resource.'), { status: 404 }); await db.prepare('DELETE FROM site_content WHERE resource = ? AND resource_key = ?').bind(resource, key).run(); return json({ ok: true }); }
    catch (error) { return apiError(error, 'Could not delete site content.'); }
}

function userRow(row) {
    const address = parseJson(row.address_json, {}); const roles = clean(row.role_codes || 'customer').split(',').filter(Boolean);
    const role = roles.includes('master_admin') ? 'master_admin' : roles.includes('accountant') ? 'accountant' : roles.includes('admin') ? 'admin' : roles.includes('doctor') ? 'doctor' : 'customer';
    return { id: row.id, name: row.display_name || row.email.split('@')[0], email: row.email, phone: row.phone || '', dob: row.date_of_birth || '', gender: row.gender || 'other',
        address_street: address.street || '', address_ward: address.ward || '', address_district: address.district || '', address_province: address.province || '',
        citizen_id_number: row.citizen_id_number || '', nationality: row.nationality || '', medical_history: row.medical_history || '', skin_type: row.skin_type || '', allergies: row.allergies || '',
        avatar_path: row.avatar_url || '', role, roles, disabled_at: row.disabled_at || null };
}

export async function listAdminUsers(request, env) {
    try {
        const { db } = await admin(request, env);
        const { url, page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const conditions = ['1 = 1']; const bindings = [];
        if (query) {
            const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            conditions.push('(u.display_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
            bindings.push(pattern, pattern, pattern);
        }
        const role = clean(url.searchParams.get('role'), 40);
        if (role) {
            conditions.push('EXISTS (SELECT 1 FROM user_roles fur JOIN roles fr ON fr.id = fur.role_id WHERE fur.user_id = u.id AND fr.code = ?)');
            bindings.push(role);
        }
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM users u WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(updated_at) AS revision FROM users u WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT u.*, p.*,
            u.id AS id, u.avatar_url AS avatar_url, COALESCE(GROUP_CONCAT(r.code), 'customer') AS role_codes
            FROM users u LEFT JOIN patient_profiles p ON p.id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id WHERE ${where} GROUP BY u.id
            ORDER BY u.display_name COLLATE NOCASE, u.email LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all(),
        ]);
        const users = (rows.results || []).map(userRow);
        return json(listPayload(users, { page, pageSize, total: integer(countRow?.total), revision: revisionValue(revisionRow?.revision) }, 'users'));
    } catch (error) { return apiError(error, 'Could not load users.'); }
}

export async function getAdminUserDetail(request, env, userId) {
    try {
        const { db } = await admin(request, env);
        const row = await db.prepare(`SELECT u.*, p.*, u.id AS id, u.avatar_url AS avatar_url,
            COALESCE(GROUP_CONCAT(r.code), 'customer') AS role_codes
            FROM users u LEFT JOIN patient_profiles p ON p.id = u.id
            LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
            WHERE u.id = ? GROUP BY u.id LIMIT 1`).bind(userId).first();
        if (!row) throw Object.assign(new Error('Không tìm thấy người dùng.'), { status: 404 });
        const [orders, appointments, records, documents] = await Promise.all([
            db.prepare('SELECT * FROM product_orders WHERE user_id = ? OR lower(customer_email) = lower(?) ORDER BY created_at DESC LIMIT 200').bind(userId, row.email).all(),
            db.prepare(`SELECT a.*, s.name AS service_name FROM appointments a LEFT JOIN services s ON s.id = a.service_id
                WHERE a.user_id = ? OR lower(a.customer_email) = lower(?) ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 200`).bind(userId, row.email).all(),
            db.prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC LIMIT 200').bind(userId).all(),
            db.prepare(`SELECT id, owner_user_id, medical_record_id, object_key,
                COALESCE(original_name, object_key) AS file_name, content_type, size_bytes,
                checksum, uploaded_by, ai_summary, created_at
                FROM private_documents WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 200`).bind(userId).all(),
        ]);
        return json({
            user: userRow(row),
            orders: orders.results || [], appointments: appointments.results || [],
            medicalRecords: records.results || [], documents: documents.results || [],
        });
    } catch (error) { return apiError(error, 'Could not load user details.'); }
}

export async function listAdminAppointments(request, env) {
    try {
        const { db } = await admin(request, env);
        const { url, page, pageSize, offset, query } = paginationFromRequest(request, { pageSize: 100, maxPageSize: 500 });
        const conditions = ['1 = 1']; const bindings = [];
        if (query) {
            const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
            conditions.push('(a.customer_name LIKE ? OR a.customer_email LIKE ? OR a.customer_phone LIKE ? OR s.name LIKE ?)');
            bindings.push(pattern, pattern, pattern, pattern);
        }
        const status = clean(url.searchParams.get('status'), 40);
        if (status) { conditions.push('a.status = ?'); bindings.push(status); }
        const serviceId = integer(url.searchParams.get('serviceId'));
        if (serviceId > 0) { conditions.push('a.service_id = ?'); bindings.push(serviceId); }
        const from = clean(url.searchParams.get('from'), 20);
        const to = clean(url.searchParams.get('to'), 20);
        if (from) { conditions.push('a.appointment_date >= ?'); bindings.push(from); }
        if (to) { conditions.push('a.appointment_date <= ?'); bindings.push(to); }
        const where = conditions.join(' AND ');
        const [countRow, revisionRow, rows] = await Promise.all([
            db.prepare(`SELECT COUNT(*) AS total FROM appointments a LEFT JOIN services s ON s.id = a.service_id WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT MAX(a.updated_at) AS revision FROM appointments a LEFT JOIN services s ON s.id = a.service_id WHERE ${where}`).bind(...bindings).first(),
            db.prepare(`SELECT a.*, s.name AS service_name, s.duration_minutes, u.display_name AS user_name
                FROM appointments a LEFT JOIN services s ON s.id = a.service_id LEFT JOIN users u ON u.id = a.user_id
                WHERE ${where} ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`)
                .bind(...bindings, pageSize, offset).all(),
        ]);
        const appointments = rows.results || [];
        return json(listPayload(appointments, { page, pageSize, total: integer(countRow?.total), revision: revisionValue(revisionRow?.revision) }, 'appointments'));
    } catch (error) { return apiError(error, 'Could not load appointments.'); }
}

const MEDIA_BUCKETS = new Set(['site-assets', 'avatars', 'blog-images', 'product-images', 'assets']);
const ADMIN_MEDIA_USAGE_SOURCES = [
    { table: 'product_images', column: 'image_path', label: 'Sản phẩm' },
    { table: 'product_categories', column: 'image_path', label: 'Danh mục sản phẩm' },
    { table: 'product_brands', column: 'logo_path', label: 'Thương hiệu' },
    { table: 'services', column: 'image_path', label: 'Dịch vụ' },
    { table: 'procedure_steps', column: 'image_path', label: 'Bước liệu trình' },
    { table: 'blog_posts', column: 'image_path', label: 'Bài viết' },
    { table: 'users', column: 'avatar_url', label: 'Ảnh đại diện' },
    { table: 'product_order_items', column: 'product_image_path', label: 'Ảnh lưu trong đơn hàng' },
];

function mediaUsageCandidates(bucket, path) {
    const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
    return [path, `${bucket}/${path}`, `/r2/${encodeURIComponent(bucket)}/${encodedPath}`];
}

function addMediaUsage(usage, path, label, id) {
    const current = usage.get(path) || { count: 0, types: [], references: [] };
    current.count += 1;
    if (!current.types.includes(label)) current.types.push(label);
    current.references.push({ label, id: String(id || '') });
    usage.set(path, current);
}

async function collectAdminMediaUsage(db, bucket, paths) {
    const usage = new Map();
    for (let index = 0; index < paths.length; index += 20) {
        const chunk = paths.slice(index, index + 20);
        const candidateToPath = new Map();
        for (const path of chunk) {
            for (const candidate of mediaUsageCandidates(bucket, path)) candidateToPath.set(candidate, path);
        }
        const candidates = Array.from(candidateToPath.keys());
        for (const source of ADMIN_MEDIA_USAGE_SOURCES) {
            try {
                const result = await db.prepare(`SELECT id, ${source.column} AS reference FROM ${source.table}
                    WHERE ${source.column} IN (${candidates.map(() => '?').join(',')}) LIMIT 1000`)
                    .bind(...candidates).all();
                for (const row of result.results || []) {
                    const reference = String(row.reference || '');
                    const path = candidateToPath.get(reference) || chunk.find((item) => reference.endsWith(item));
                    if (path) addMediaUsage(usage, path, source.label, row.id);
                }
            } catch (error) {
                console.warn(`Media usage index skipped for ${source.table}:`, error instanceof Error ? error.message : error);
            }
        }

        try {
            const contentResult = await db.prepare(`SELECT id, content_key, payload_json FROM site_content
                WHERE ${chunk.map(() => 'instr(payload_json, ?) > 0').join(' OR ')} LIMIT 1000`)
                .bind(...chunk).all();
            for (const row of contentResult.results || []) {
                const payload = String(row.payload_json || '');
                for (const path of chunk) {
                    if (payload.includes(path)) addMediaUsage(usage, path, 'Nội dung site', row.id || row.content_key);
                }
            }
        } catch (error) {
            console.warn('Media usage index skipped for site_content:', error instanceof Error ? error.message : error);
        }
    }
    return usage;
}

export async function listAdminMediaAssets(request, env) {
    try {
        const { db } = await admin(request, env);
        if (!env.R2_IMAGES) throw Object.assign(new Error('R2 image storage is not configured.'), { status: 503 });
        const { url, pageSize, query } = paginationFromRequest(request, { pageSize: 60, maxPageSize: 200 });
        const bucket = clean(url.searchParams.get('bucket') || 'product-images', 100);
        if (!MEDIA_BUCKETS.has(bucket)) throw Object.assign(new Error('Invalid media bucket.'), { status: 400 });
        const prefix = clean(url.searchParams.get('prefix'), 1000).replace(/^\/+|\/+$/g, '');
        const cursor = optional(url.searchParams.get('cursor'), 2000) || undefined;
        const keyPrefix = `${bucket}/${prefix ? `${prefix}/` : ''}`;
        const listed = await env.R2_IMAGES.list({
            prefix: keyPrefix,
            cursor,
            limit: pageSize,
            include: ['httpMetadata', 'customMetadata'],
        });
        const now = new Date().toISOString();
        const allObjects = listed.objects || [];
        const filtered = query
            ? allObjects.filter((object) => String(object.key).toLowerCase().includes(query.toLowerCase()))
            : allObjects;
        const paths = filtered.map((object) => String(object.key).replace(new RegExp(`^${bucket}/`), ''));
        const usage = paths.length ? await collectAdminMediaUsage(db, bucket, paths) : new Map();
        const statements = [];
        const data = filtered.map((object) => {
            const objectPath = String(object.key).replace(new RegExp(`^${bucket}/`), '');
            const uploadedAt = object.customMetadata?.uploaded_at || (object.uploaded ? new Date(object.uploaded).toISOString() : null);
            const publicUrl = `/r2/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
            const id = `${bucket}:${objectPath}`;
            statements.push(db.prepare(`INSERT INTO media_assets (
                id, bucket, object_key, object_path, public_url, content_type, size_bytes, etag,
                uploaded_by, uploaded_at, last_seen_at, deleted_at, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
            ON CONFLICT(bucket, object_path) DO UPDATE SET object_key=excluded.object_key,
                public_url=excluded.public_url, content_type=excluded.content_type, size_bytes=excluded.size_bytes,
                etag=excluded.etag, uploaded_by=COALESCE(excluded.uploaded_by, media_assets.uploaded_by),
                uploaded_at=COALESCE(excluded.uploaded_at, media_assets.uploaded_at), last_seen_at=excluded.last_seen_at,
                deleted_at=NULL, metadata_json=excluded.metadata_json, updated_at=excluded.updated_at`)
                .bind(id, bucket, object.key, objectPath, publicUrl, object.httpMetadata?.contentType || null,
                    integer(object.size), object.httpEtag || object.etag || null, object.customMetadata?.uploaded_by || null,
                    uploadedAt, now, JSON.stringify(object.customMetadata || {}), uploadedAt || now, now));
            return {
                id, bucket, key: object.key, path: objectPath, public_url: publicUrl,
                content_type: object.httpMetadata?.contentType || null, size: integer(object.size),
                etag: object.httpEtag || object.etag || null, uploaded_at: uploadedAt,
                uploaded_by: object.customMetadata?.uploaded_by || null, usage: usage.get(objectPath) || null,
            };
        });
        if (statements.length) await db.batch(statements);
        return json(listPayload(data, {
            page: 1, pageSize, total: data.length, revision: now,
            cursor: listed.cursor || null, truncated: Boolean(listed.truncated),
        }, 'items'));
    } catch (error) { return apiError(error, 'Could not load media assets.'); }
}

export async function getAdminCapabilities(request, env) {
    try {
        const { db } = await admin(request, env);
        const tables = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
        const counts = await db.prepare(`SELECT
            (SELECT COUNT(*) FROM products WHERE archived_at IS NULL) AS products,
            (SELECT COUNT(*) FROM product_orders) AS orders,
            (SELECT COUNT(*) FROM services) AS services,
            (SELECT COUNT(*) FROM appointments) AS appointments,
            (SELECT COUNT(*) FROM blog_posts) AS blog_posts,
            (SELECT COUNT(*) FROM users) AS users`).first();
        const features = {
            database: true,
            inci: Boolean(env.INCI_DB_0),
            mediaLibrary: Boolean(env.R2_IMAGES),
            privateDocuments: Boolean(env.PRIVATE_RECORDS),
            imageSanitization: Boolean(env.IMAGES),
            notifications: Boolean(env.NOTIFICATION_QUEUE),
            shipping: String(env.GHTK_ENABLED || '').toLowerCase() === 'true',
            oauthProviders: String(env.OAUTH_PROVIDERS || 'google').split(',').map((item) => item.trim()).filter(Boolean),
        };
        return json({
            data: { features, counts, tables: (tables.results || []).map((row) => row.name) },
            capabilities: features,
            meta: { revision: new Date().toISOString() },
        });
    } catch (error) { return apiError(error, 'Could not load system capabilities.'); }
}

async function tableExists(db, tableName) {
    const row = await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .bind(tableName).first();
    return Boolean(row?.present);
}

async function safeAdminRows(db, tableName, sql, bindings = []) {
    if (!(await tableExists(db, tableName))) return [];
    const result = await db.prepare(sql).bind(...bindings).all();
    return result.results || [];
}

export async function getAdminOperations(request, env) {
    try {
        const { db } = await admin(request, env);
        const [auditLog, migrationIssues, notificationOutbox, shippingOutbox, shipments, reportSchedules] = await Promise.all([
            safeAdminRows(db, 'admin_audit_log', `SELECT id, actor_user_id, actor_email, action, entity_type, entity_id,
                request_method, request_path, status, metadata_json, created_at
                FROM admin_audit_log ORDER BY created_at DESC LIMIT 30`),
            safeAdminRows(db, 'migration_issues', `SELECT id, source_system, entity_type, entity_id, issue_code,
                details_json, resolution_status, resolved_at, created_at, updated_at
                FROM migration_issues WHERE resolution_status != 'resolved' ORDER BY updated_at DESC LIMIT 50`),
            safeAdminRows(db, 'notification_outbox', `SELECT id, event_type, aggregate_type, aggregate_id, audience,
                recipient_email, locale, status, attempts, available_at, accepted_at, last_error, created_at, updated_at
                FROM notification_outbox WHERE status NOT IN ('accepted') ORDER BY created_at DESC LIMIT 50`),
            safeAdminRows(db, 'shipping_outbox', `SELECT id, order_id, operation, status, attempts, available_at,
                last_error, created_at, updated_at FROM shipping_outbox
                WHERE status NOT IN ('completed') ORDER BY created_at DESC LIMIT 50`),
            safeAdminRows(db, 'shipping_shipments', `SELECT id, order_id, provider, provider_order_id, tracking_code,
                status, status_text, created_at, updated_at FROM shipping_shipments ORDER BY updated_at DESC LIMIT 30`),
            safeAdminRows(db, 'admin_report_schedules', `SELECT id, name, preset, frequency, enabled, next_run_at,
                last_sent_at, last_error_at, last_error_message, created_at, updated_at
                FROM admin_report_schedules ORDER BY updated_at DESC LIMIT 30`),
        ]);
        const integrations = {
            database: { enabled: true, status: 'ready' },
            inci: { enabled: Boolean(env.INCI_DB_0), status: env.INCI_DB_0 ? 'ready' : 'not_configured' },
            media: { enabled: Boolean(env.R2_IMAGES), status: env.R2_IMAGES ? 'ready' : 'not_configured' },
            privateDocuments: { enabled: Boolean(env.PRIVATE_RECORDS), status: env.PRIVATE_RECORDS ? 'ready' : 'not_configured' },
            notifications: { enabled: Boolean(env.NOTIFICATION_QUEUE), status: env.NOTIFICATION_QUEUE ? 'ready' : 'not_configured' },
            shipping: {
                enabled: String(env.GHTK_ENABLED || '').toLowerCase() === 'true',
                status: String(env.GHTK_ENABLED || '').toLowerCase() === 'true' ? 'ready' : 'disabled',
            },
        };
        return json({
            data: { auditLog, migrationIssues, notificationOutbox, shippingOutbox, shipments, reportSchedules, integrations },
            meta: { revision: new Date().toISOString() },
        });
    } catch (error) { return apiError(error, 'Could not load admin operations.'); }
}

export async function updateAdminUser(request, env, userId) {
    try {
        const { db, session } = await admin(request, env, true); const body = await readJson(request, 64 * 1024); const role = clean(body.role, 40);
        if (role && !ROLES.has(role)) throw Object.assign(new Error('Vai trò không hợp lệ.'), { status: 400 });
        if (userId === session.user_id && role && !['admin', 'master_admin'].includes(role)) throw Object.assign(new Error('Không thể tự hạ quyền quản trị của phiên hiện tại.'), { status: 409 });
        const now = new Date().toISOString();
        const address = JSON.stringify({ street: clean(body.address_street, 300), ward: clean(body.address_ward, 160), district: clean(body.address_district, 160), province: clean(body.address_province, 160) });
        const gender = ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'other';
        const statements = [
            db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), phone = COALESCE(?, phone), avatar_url = COALESCE(?, avatar_url), disabled_at = ?, updated_at = ? WHERE id = ?')
                .bind(optional(body.name, 180), optional(body.phone, 40), optional(body.avatar_path, 1000), body.disabled === true ? now : null, now, userId),
            db.prepare(`INSERT INTO patient_profiles (id, date_of_birth, gender, address_json, emergency_contact_json, citizen_id_number, nationality, medical_history, skin_type, allergies, created_at, updated_at)
                VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                date_of_birth=excluded.date_of_birth, gender=excluded.gender, address_json=excluded.address_json,
                citizen_id_number=excluded.citizen_id_number, nationality=excluded.nationality,
                medical_history=excluded.medical_history, skin_type=excluded.skin_type, allergies=excluded.allergies, updated_at=excluded.updated_at`)
                .bind(userId, optional(body.dob, 20), gender, address, optional(body.citizen_id_number, 80), optional(body.nationality, 100),
                    optional(body.medical_history, 5000), optional(body.skin_type, 160), optional(body.allergies, 3000), now, now),
        ];
        if (role) {
            statements.push(db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId));
            statements.push(db.prepare('INSERT INTO user_roles (user_id, role_id, created_at) SELECT ?, id, ? FROM roles WHERE code = ?').bind(userId, now, role));
        }
        await db.batch(statements); return json({ ok: true });
    } catch (error) { return apiError(error, 'Could not update user.'); }
}

export async function listMedicalRecords(request, env) {
    try { const { db } = await clinical(request, env); const patientId = new URL(request.url).searchParams.get('patientId'); const rows = patientId
        ? await db.prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC').bind(patientId).all()
        : await db.prepare('SELECT * FROM medical_records ORDER BY created_at DESC LIMIT 2000').all(); return json({ records: rows.results || [] }); }
    catch (error) { return apiError(error, 'Could not load medical records.'); }
}

export async function saveMedicalRecord(request, env) {
    try {
        const { db, session } = await clinical(request, env, true); const body = await readJson(request, 256 * 1024); const record = body.record || body;
        const patientId = clean(record.patient_id, 80); if (!patientId) throw Object.assign(new Error('Patient ID is required.'), { status: 400 });
        const patient = await db.prepare('SELECT id FROM patient_profiles WHERE id = ?').bind(patientId).first(); if (!patient) throw Object.assign(new Error('Không tìm thấy hồ sơ bệnh nhân.'), { status: 404 });
        const id = clean(record.id || crypto.randomUUID(), 80); const now = new Date().toISOString();
        await db.prepare(`INSERT INTO medical_records (id, patient_id, practitioner_id, appointment_id, summary, diagnosis, treatment_plan, private_document_prefix, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET patient_id=excluded.patient_id,
            practitioner_id=excluded.practitioner_id, appointment_id=excluded.appointment_id, summary=excluded.summary,
            diagnosis=excluded.diagnosis, treatment_plan=excluded.treatment_plan, private_document_prefix=excluded.private_document_prefix, updated_at=excluded.updated_at`)
            .bind(id, patientId, optional(record.practitioner_id || record.examining_doctor_id || session.user_id, 80), optional(record.appointment_id, 80),
                optional(record.summary || record.clinical_notes, 50000), jsonValue(record.diagnosis || record.definitive_diagnoses_icd_codes),
                jsonValue(record.treatment_plan || { services: record.services || [], prescriptions: record.prescriptions || [], invoice: record.invoice || null }, {}),
                optional(record.private_document_prefix, 1000), record.created_at || record.encounter_date || now, now).run();
        return json({ record: await db.prepare('SELECT * FROM medical_records WHERE id = ?').bind(id).first() });
    } catch (error) { return apiError(error, 'Could not save medical record.'); }
}

export async function deleteMedicalRecord(request, env, recordId) {
    try { const { db } = await clinical(request, env, true); await db.prepare('DELETE FROM medical_records WHERE id = ?').bind(recordId).run(); return json({ ok: true }); }
    catch (error) { return apiError(error, 'Could not delete medical record.'); }
}
