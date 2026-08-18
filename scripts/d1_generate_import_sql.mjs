import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const inputDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const outputDir = path.resolve(process.env.D1_IMPORT_DIR || path.join(inputDir, 'sql'));
const generatedAt = new Date().toISOString();
const includeRawIngredientSourceRecords = String(process.env.D1_INCLUDE_RAW_INGREDIENT_SOURCE_RECORDS || '').toLowerCase() === 'yes';

async function rows(source, table) {
    try {
        const text = await readFile(path.join(inputDir, source, `${table}.jsonl`), 'utf8');
        return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }
}

async function* streamRows(source, table) {
    const file = path.join(inputDir, source, `${table}.jsonl`);
    const input = createReadStream(file, { encoding: 'utf8' });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
        if (line) yield JSON.parse(line);
    }
}

function splitTextChunks(value, maxCodeUnits = 16_000) {
    const text = String(value ?? '');
    const chunks = [];
    for (let offset = 0; offset < text.length;) {
        let end = Math.min(text.length, offset + maxCodeUnits);
        if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end -= 1;
        chunks.push(text.slice(offset, end));
        offset = end;
    }
    return chunks;
}

async function createSqlWriter(name) {
    const file = path.join(outputDir, `${name}-import.sql`);
    const output = createWriteStream(file, { encoding: 'utf8' });
    const checksum = createHash('sha256');
    let statements = 0;
    let bytes = 0;
    let maxStatementBytes = 0;

    async function write(statement) {
        const statementBytes = Buffer.byteLength(statement);
        if (statementBytes > 100_000) {
            throw new Error(`${name} import statement ${statements + 1} is ${statementBytes} bytes; D1 allows at most 100000 bytes.`);
        }
        const line = `${statement}\n`;
        checksum.update(line);
        statements += 1;
        bytes += Buffer.byteLength(line);
        maxStatementBytes = Math.max(maxStatementBytes, statementBytes);
        if (!output.write(line)) await once(output, 'drain');
    }

    async function close() {
        output.end();
        await once(output, 'finish');
        await writeFile(
            path.join(outputDir, `${name}-import.sha256`),
            `${checksum.digest('hex')}  ${name}-import.sql\n`,
            'utf8',
        );
        process.stdout.write(`${name}: ${statements} statements, ${bytes} bytes, max statement ${maxStatementBytes} bytes\n`);
    }

    return { write, close };
}

function literal(value) {
    if (value === undefined || value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `'${text.replaceAll("'", "''")}'`;
}

function insert(table, record, mode = 'REPLACE') {
    const entries = Object.entries(record).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => `"${key}"`).join(', ');
    return `INSERT OR ${mode} INTO ${table} (${columns}) VALUES (${entries.map(([, value]) => literal(value)).join(', ')});`;
}

function pick(row, columns, overrides = {}) {
    const output = Object.fromEntries(columns.filter((key) => row[key] !== undefined).map((key) => [key, row[key]]));
    return { ...output, ...overrides };
}

function json(value, fallback = []) {
    if (value === undefined || value === null || value === '') return JSON.stringify(fallback);
    if (typeof value !== 'string') return JSON.stringify(value);
    try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
}

function flag(value, fallback = false) {
    if (value === undefined || value === null) return fallback ? 1 : 0;
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
    return Math.round(number(value, fallback));
}

function timestamp(value) {
    return value ? String(value) : generatedAt;
}

function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableId(prefix, value) {
    const hash = createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
    return `${prefix}-${hash}`;
}

function roleCode(value) {
    const role = String(value || 'customer').toLowerCase();
    if (role === 'master_admin') return 'master_admin';
    if (role === 'admin') return 'admin';
    if (role === 'doctor') return 'doctor';
    return 'customer';
}

function allowed(value, values, fallback) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return values.includes(normalizedValue) ? normalizedValue : fallback;
}

function orderStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (['confirmed', 'preparing', 'packed'].includes(status)) return 'processing';
    if (['shipping', 'delivering', 'in_transit'].includes(status)) return 'shipped';
    if (['delivered', 'success', 'done'].includes(status)) return 'completed';
    if (status === 'canceled') return 'cancelled';
    return allowed(status, ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'], 'pending');
}

function fulfillmentStatus(value, fallbackStatus) {
    const status = orderStatus(value || fallbackStatus);
    return status === 'refunded' ? 'completed' : status;
}

function paymentMethod(value) {
    const method = String(value || '').trim().toLowerCase();
    if (['bank', 'banking', 'transfer', 'qr'].includes(method)) return 'bank_transfer';
    return allowed(method, ['cod', 'bank_transfer'], 'cod');
}

function paymentStatus(value, fallbackStatus) {
    const status = String(value || '').trim().toLowerCase();
    if (['completed', 'success'].includes(status)) return 'paid';
    if (['cancelled', 'canceled'].includes(status)) return 'failed';
    if (['paid', 'failed', 'refunded', 'unpaid'].includes(status)) return status;
    const order = orderStatus(fallbackStatus);
    return order === 'completed' ? 'paid' : order === 'refunded' ? 'refunded' : 'unpaid';
}

function appointmentStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (['approved', 'accepted'].includes(status)) return 'confirmed';
    if (status === 'canceled') return 'cancelled';
    return allowed(status, ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'], 'pending');
}

// `wrangler d1 execute --file` manages import statements itself. Explicit
// BEGIN/COMMIT statements are rejected by the remote D1 importer.
const app = ['PRAGMA foreign_keys = ON;', 'PRAGMA defer_foreign_keys = true;'];
const patients = await rows('app-supabase', 'patients');
const patientById = new Map(patients.map((row) => [String(row.id), row]));

for (const row of patients) {
    const email = String(row.email || `legacy+${row.id}@invalid.local`).toLowerCase();
    app.push(insert('users', {
        id: row.id, email, email_verified: row.email ? 1 : 0,
        display_name: row.name || email.split('@')[0], avatar_url: row.avatar_path,
        phone: row.phone, locale: 'vi', legacy_supabase_user_id: row.id,
        created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    }));
    app.push(`INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) SELECT ${literal(row.id)}, id, ${literal(timestamp(row.created_at))} FROM roles WHERE code = ${literal(roleCode(row.role))};`);
    app.push(insert('patient_profiles', {
        id: row.id, date_of_birth: row.dob, gender: row.gender,
        address_json: JSON.stringify({ street: row.address_street, ward: row.address_ward, district: row.address_district, province: row.address_province }),
        emergency_contact_json: '{}', citizen_id_number: row.citizen_id_number,
        nationality: row.nationality, medical_history: row.medical_history,
        skin_type: row.skin_type, allergies: row.allergies,
        created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    }));
}

const categoryColumns = ['id', 'slug', 'name', 'name_en', 'name_ru', 'name_cn', 'description', 'description_en', 'description_ru', 'description_cn', 'image_path'];
for (const row of await rows('app-supabase', 'product_categories')) app.push(insert('product_categories', pick(row, categoryColumns, { is_featured: flag(row.is_featured), display_order: integer(row.display_order), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })));

const brandColumns = ['slug', 'name', 'description', 'logo_path'];
for (const row of await rows('app-supabase', 'product_brands')) app.push(insert('product_brands', pick(row, brandColumns, { id: String(row.id), is_active: flag(row.is_active, true), display_order: integer(row.display_order), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })));

const productColumns = [
    'id', 'slug', 'sku', 'category_id', 'brand', 'name', 'name_en', 'name_ru', 'name_cn',
    'description', 'description_en', 'description_ru', 'description_cn',
    'usage_instructions', 'usage_instructions_en', 'usage_instructions_ru', 'usage_instructions_cn',
    'ingredients', 'ingredients_en', 'ingredients_ru', 'ingredients_cn',
    'precautions', 'precautions_en', 'precautions_ru', 'precautions_cn', 'volume',
    'origin', 'origin_en', 'origin_ru', 'origin_cn', 'texture', 'texture_en', 'texture_ru', 'texture_cn',
    'expiry_date', 'archived_at',
];
for (const row of await rows('app-supabase', 'products')) {
    app.push(insert('products', pick(row, productColumns, {
        long_description: json(row.long_description, []),
        long_description_en: json(row.long_description_en, []),
        long_description_ru: json(row.long_description_ru, []),
        long_description_cn: json(row.long_description_cn, []),
        inci_text: row.inci_text || row.ingredients,
        key_benefits_json: json(row.key_benefits, []), key_benefits_en_json: json(row.key_benefits_en, []),
        key_benefits_ru_json: json(row.key_benefits_ru, []), key_benefits_cn_json: json(row.key_benefits_cn, []),
        skin_types_json: json(row.skin_types, []), faq_items_json: json(row.faq_items, []),
        price: Math.max(0, integer(row.price)), vat_rate: number(row.vat_rate),
        stock_quantity: Math.max(0, integer(row.stock_quantity)), low_stock_threshold: Math.max(0, integer(row.low_stock_threshold)),
        sold_count: Math.max(0, integer(row.sold_count)), is_published: flag(row.is_published), is_featured: flag(row.is_featured),
        source_updated_at: row.updated_at, created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    })));
}

for (const row of await rows('app-supabase', 'product_images')) app.push(insert('product_images', {
    id: String(row.id), product_id: row.product_id, image_path: row.image_path || row.image_url,
    alt_text: row.alt_text, is_primary: flag(row.is_primary), display_order: integer(row.display_order),
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
}));

const discountColumns = ['id', 'code', 'type', 'starts_at', 'ends_at', 'usage_limit', 'usage_limit_per_user'];
for (const row of await rows('app-supabase', 'discount_codes')) app.push(insert('discount_codes', pick(row, discountColumns, {
    type: ['fixed', 'amount'].includes(String(row.type || '').toLowerCase()) ? 'fixed_amount' : allowed(row.type, ['percentage', 'fixed_amount'], 'percentage'),
    value: number(row.value), min_purchase_amount: Math.max(0, integer(row.min_purchase_amount)),
    max_discount_amount: row.max_discount_amount == null ? null : Math.max(0, integer(row.max_discount_amount)),
    usage_count: Math.max(0, integer(row.usage_count)), is_active: flag(row.is_active, true),
    description: row.description || null,
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
})));

for (const row of await rows('app-supabase', 'tax_profiles')) app.push(insert('tax_profiles', {
    id: String(row.id), code: row.code, name: row.name,
    tax_mode: allowed(row.tax_mode, ['exclusive', 'inclusive'], 'exclusive'),
    default_rate: Math.max(0, number(row.default_rate)),
    applies_to_shipping: flag(row.applies_to_shipping), currency: row.currency || 'VND',
    is_active: flag(row.is_active, true), is_default: flag(row.is_default),
    starts_at: row.starts_at || null, ends_at: row.ends_at || null,
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
}));
for (const row of await rows('app-supabase', 'tax_rates')) app.push(insert('tax_rates', {
    id: String(row.id), tax_profile_id: String(row.tax_profile_id), province: row.province || null,
    district: row.district || null, rate: Math.max(0, number(row.rate)),
    applies_to_shipping: row.applies_to_shipping == null ? null : flag(row.applies_to_shipping),
    currency: row.currency || null, priority: integer(row.priority), is_active: flag(row.is_active, true),
    starts_at: row.starts_at || null, ends_at: row.ends_at || null,
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
}));

const orderColumns = [
    'id', 'user_id', 'customer_name', 'customer_phone', 'customer_email', 'shipping_street', 'shipping_ward',
    'shipping_district', 'shipping_province', 'notes', 'status', 'discount_code', 'shipping_provider',
    'shipping_code', 'ghtk_label', 'ghtk_status_text', 'estimated_delivery_time', 'tax_profile_id', 'tax_mode',
];
for (const row of await rows('app-supabase', 'product_orders')) app.push(insert('product_orders', pick(row, orderColumns, {
    order_code: row.order_code || String(row.id).slice(0, 8).toUpperCase(),
    checkout_idempotency_key: row.checkout_idempotency_key || `legacy/${row.id}`,
    locale: allowed(row.locale, ['vi', 'en', 'ru', 'cn'], 'vi'), shipping_district: row.shipping_district || '',
    status: orderStatus(row.status),
    fulfillment_status: fulfillmentStatus(row.fulfillment_status, row.status),
    payment_method: paymentMethod(row.payment_method),
    payment_status: paymentStatus(row.payment_status, row.status),
    subtotal_price: integer(row.subtotal_price ?? row.total_price), discount_amount: integer(row.discount_amount),
    taxable_amount: integer(row.taxable_amount), tax_amount: integer(row.tax_amount),
    shipping_fee: integer(row.shipping_fee), shipping_net_amount: integer(row.shipping_net_amount),
    shipping_tax_rate: number(row.shipping_tax_rate), shipping_tax_amount: integer(row.shipping_tax_amount),
    currency: row.currency || 'VND', grand_total: integer(row.grand_total ?? row.total_price),
    total_price: integer(row.total_price ?? row.grand_total), tax_rate: number(row.tax_rate),
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
})));

for (const row of await rows('app-supabase', 'product_order_items')) app.push(insert('product_order_items', {
    id: String(row.id), order_id: row.order_id, product_id: row.product_id,
    product_name: row.product_name || row.product?.name || `Sản phẩm #${row.product_id}`,
    product_sku: row.product_sku || row.product?.sku, product_image_path: row.product_image_path || row.product?.image_path,
    quantity: Math.max(1, integer(row.quantity, 1)), price_at_purchase: Math.max(0, integer(row.price_at_purchase)),
    vat_rate: number(row.vat_rate), tax_amount: integer(row.tax_amount), created_at: timestamp(row.created_at),
}));

const historyColumns = ['id', 'order_id', 'from_status', 'to_status', 'actor_id', 'actor_role', 'note'];
for (const row of await rows('app-supabase', 'order_status_history')) app.push(insert('order_status_history', pick(row, historyColumns, { id: String(row.id), created_at: timestamp(row.created_at) })));
const paymentColumns = ['order_id', 'method', 'status', 'transaction_ref', 'paid_at'];
for (const row of await rows('app-supabase', 'order_payments')) app.push(insert('order_payment_logs', pick(row, paymentColumns, { id: String(row.id), status: paymentStatus(row.status), amount: Math.max(0, integer(row.amount)), metadata_json: json(row.metadata, {}), created_at: timestamp(row.created_at) })));
const refundColumns = ['order_id', 'reason', 'status', 'refunded_at', 'created_by'];
for (const row of await rows('app-supabase', 'order_refunds')) app.push(insert('order_refund_logs', pick(row, refundColumns, { id: String(row.id), status: allowed(row.status, ['pending', 'completed', 'failed'], 'pending'), amount: Math.max(0, integer(row.amount)), restocked: flag(row.restocked), created_at: timestamp(row.created_at) })));

const reviewColumns = ['product_id', 'user_id', 'rating', 'title', 'comment'];
for (const row of await rows('app-supabase', 'product_reviews')) app.push(insert('product_reviews', pick(row, reviewColumns, { id: String(row.id), verified_purchase: flag(row.verified_purchase), is_published: flag(row.is_published, true), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })));
for (const row of await rows('app-supabase', 'user_wishlist')) app.push(insert('wishlists', { user_id: row.user_id, product_id: row.product_id, created_at: timestamp(row.created_at) }));

const serviceColumns = ['id', 'slug', 'name', 'name_en', 'name_ru', 'name_cn', 'description', 'description_en', 'description_ru', 'description_cn', 'long_description', 'long_description_en', 'long_description_ru', 'long_description_cn', 'duration_minutes', 'image_path', 'icon'];
for (const row of await rows('app-supabase', 'services')) app.push(insert('services', pick(row, serviceColumns, {
    slug: row.slug || `service-${row.id}`, benefits_json: json(row.benefits, []), benefits_en_json: json(row.benefits_en, []),
    benefits_ru_json: json(row.benefits_ru, []), benefits_cn_json: json(row.benefits_cn, []),
    faq_items_json: json(row.faq_items, []), local_seo_tags_json: json(row.local_seo_tags, []),
    price: Math.max(0, integer(row.price)), is_published: flag(row.is_published, true), is_featured: flag(row.is_featured),
    created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
})));
for (const row of await rows('app-supabase', 'procedure_steps')) app.push(insert('procedure_steps', pick(row, [
    'service_id', 'title', 'description', 'title_en', 'title_ru', 'title_cn',
    'description_en', 'description_ru', 'description_cn', 'image_path',
], { id: String(row.id), step_number: integer(row.step_number), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })));

for (const row of await rows('app-supabase', 'appointments')) {
    const patient = patientById.get(String(row.patient_id || row.user_id)) || {};
    app.push(insert('appointments', {
        id: String(row.id), user_id: row.patient_id || row.user_id, service_id: row.service_id, doctor_id: row.doctor_id,
        customer_name: row.customer_name || row.patient_name || patient.name || 'Khách hàng cũ',
        customer_email: row.customer_email || row.patient_email || patient.email || null,
        customer_phone: row.customer_phone || row.patient_phone || patient.phone || '',
        appointment_date: row.appointment_date || row.date, appointment_time: row.appointment_time || row.time,
        locale: allowed(row.locale, ['vi', 'en', 'ru', 'cn'], 'vi'), status: appointmentStatus(row.status), notes: row.notes, internal_notes: row.internal_notes,
        created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    }));
}

const blogCategoryColumns = ['slug', 'name', 'name_en', 'name_ru', 'name_cn', 'description'];
for (const row of await rows('app-supabase', 'blog_categories')) app.push(insert('blog_categories', pick(row, blogCategoryColumns, { id: String(row.id || row.slug), display_order: integer(row.display_order), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })));
const blogColumns = ['slug', 'category_slug', 'author_id', 'title', 'title_en', 'title_ru', 'title_cn', 'summary', 'summary_en', 'summary_ru', 'summary_cn', 'content', 'content_en', 'content_ru', 'content_cn', 'image_path', 'meta_description', 'meta_keywords', 'canonical_url'];
for (const row of await rows('app-supabase', 'blog_posts')) app.push(insert('blog_posts', pick(row, blogColumns, {
    id: String(row.id || row.slug), local_seo_tags_json: json(row.local_seo_tags, []), status: allowed(row.status, ['draft', 'published', 'archived'], 'published'),
    published_at: row.date || row.published_at, created_at: timestamp(row.created_at || row.date), updated_at: timestamp(row.updated_at),
})));

for (const row of await rows('app-supabase', 'medical_records')) app.push(insert('medical_records', {
    id: String(row.id), patient_id: row.patient_id, practitioner_id: row.practitioner_id || row.examining_doctor_id,
    appointment_id: row.appointment_id, summary: row.summary || row.clinical_notes,
    diagnosis: json(row.definitive_diagnoses_icd_codes, []),
    treatment_plan: json({ services: row.services || [], prescriptions: row.prescriptions || [], invoice: row.invoice || null }, {}),
    created_at: timestamp(row.created_at || row.encounter_date), updated_at: timestamp(row.updated_at),
}));

for (const row of await rows('app-supabase', 'patient_uploaded_documents')) {
    const objectKey = row.file_path || row.object_key;
    if (!objectKey || !(row.patient_id || row.owner_user_id)) continue;
    app.push(insert('private_documents', {
        id: String(row.id), owner_user_id: row.patient_id || row.owner_user_id,
        medical_record_id: row.medical_record_id || null, object_key: objectKey,
        content_type: row.mime_type || row.content_type || 'application/octet-stream',
        size_bytes: Math.max(0, integer(row.size_bytes)), checksum: row.checksum || null,
        uploaded_by: row.uploaded_by || row.patient_id || row.owner_user_id,
        original_name: row.file_name || objectKey.split('/').pop() || 'document',
        ai_summary: row.ai_summary || null,
        created_at: timestamp(row.created_at),
    }));
}

for (const row of await rows('app-supabase', 'funnel_events')) {
    const sourceUserId = row.user_id == null ? null : String(row.user_id);
    app.push(insert('funnel_events', {
        id: String(row.id || stableId('funnel', `${row.event_name}/${row.session_id}/${row.created_at}`)),
        event_name: String(row.event_name || 'legacy.unknown').slice(0, 80),
        user_id: sourceUserId && patientById.has(sourceUserId) ? sourceUserId : null,
        session_id: String(row.session_id || `legacy-${row.id}`).slice(0, 128),
        path: row.path ? String(row.path).slice(0, 512) : null,
        metadata_json: json(row.metadata, {}),
        created_at: timestamp(row.created_at),
    }));
}

const siteTables = ['featured_posts', 'featured_services', 'featured_doctors', 'doctors', 'faq_items', 'homepage_hero', 'site_info', 'footer_content', 'auth_page_images', 'about_page_content', 'about_features', 'about_values', 'payment_settings'];
for (const table of siteTables) {
    (await rows('app-supabase', table)).forEach((row, index) => app.push(insert('site_content', {
        resource: table, resource_key: String(row.id ?? row.slug ?? row.code ?? index), payload_json: JSON.stringify(row),
        is_published: Object.hasOwn(row, 'is_published') ? flag(row.is_published) : 1,
        created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    })));
}
app.push('PRAGMA foreign_key_check;', 'PRAGMA optimize;');

await mkdir(outputDir, { recursive: true });
const appWriter = await createSqlWriter('app');
for (const statement of app) await appWriter.write(statement);
await appWriter.close();

const inci = await createSqlWriter('inci');
await inci.write('PRAGMA foreign_keys = ON;');
await inci.write('PRAGMA defer_foreign_keys = true;');
const canonicalIngredientByNorm = new Map();
const ingredientIdMap = new Map();
let duplicateIngredients = 0;
for await (const row of streamRows('inci-supabase', 'ingredients')) {
    const scores = String(row.ewg_score ?? '').match(/\d+/g)?.map(Number) || [];
    const sourceId = String(row.id);
    const inciNameNorm = normalized(row.inci_name || row.id);
    const ingredientId = canonicalIngredientByNorm.get(inciNameNorm) || sourceId;
    ingredientIdMap.set(sourceId, ingredientId);
    if (!canonicalIngredientByNorm.has(inciNameNorm)) {
        canonicalIngredientByNorm.set(inciNameNorm, ingredientId);
        await inci.write(insert('ingredients', {
            id: ingredientId, inci_name: row.inci_name || row.id, inci_name_norm: inciNameNorm,
            name_vi: row.vi_name, description_vi: row.description, ewg_min: scores[0] ?? null, ewg_max: scores.at(-1) ?? scores[0] ?? null,
            cir_rating: ['A', 'B', 'C', 'D'].includes(String(row.cir_rating || '').toUpperCase()) ? String(row.cir_rating).toUpperCase() : null,
            comedogenic_rating: row.comedogenic_rating == null ? null : integer(row.comedogenic_rating),
            irritancy_rating: row.irritancy_rating == null ? null : integer(row.irritancy_rating),
            flags_json: json({ categories: row.categories, skin_types: row.skin_types }, {}),
            source_json: JSON.stringify({ sourceRecordId: sourceId }),
            created_at: timestamp(row.crawled_at || row.created_at), updated_at: timestamp(row.updated_at || row.crawled_at),
        }));
    } else {
        duplicateIngredients += 1;
    }
    if (includeRawIngredientSourceRecords) {
        await inci.write(insert('ingredient_source_records', {
            source_id: sourceId, ingredient_id: ingredientId, source_json: '',
            created_at: timestamp(row.crawled_at || row.created_at),
            updated_at: timestamp(row.updated_at || row.crawled_at),
        }));
        for (const chunk of splitTextChunks(JSON.stringify(row))) {
            await inci.write(`UPDATE ingredient_source_records SET source_json = source_json || ${literal(chunk)} WHERE source_id = ${literal(sourceId)};`);
        }
    }
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    for (const alias of aliases) {
        const aliasNorm = normalized(alias);
        if (aliasNorm) await inci.write(insert('ingredient_aliases', { id: stableId('alias', `${ingredientId}/${aliasNorm}`), ingredient_id: ingredientId, alias, alias_norm: aliasNorm, created_at: timestamp(row.crawled_at) }, 'IGNORE'));
    }
    const functions = Array.isArray(row.functions) ? row.functions : [];
    for (const name of functions) {
        const code = normalized(name).replaceAll(' ', '-');
        if (!code) continue;
        const functionId = stableId('function', code);
        await inci.write(insert('ingredient_functions', { id: functionId, code, name_vi: name, created_at: timestamp(row.crawled_at) }, 'IGNORE'));
        await inci.write(insert('ingredient_function_links', { ingredient_id: ingredientId, function_id: functionId, confidence: 1 }, 'IGNORE'));
    }
}
for await (const row of streamRows('inci-supabase', 'ingredient_search_terms')) {
    const term = row.term_norm || row.term;
    const aliasNorm = normalized(term);
    const ingredientId = ingredientIdMap.get(String(row.ingredient_id));
    if (aliasNorm && ingredientId) await inci.write(insert('ingredient_aliases', { id: stableId('search', `${ingredientId}/${aliasNorm}`), ingredient_id: ingredientId, alias: term, alias_norm: aliasNorm, created_at: generatedAt }, 'IGNORE'));
}
await inci.write('DELETE FROM ingredient_search_terms;');
await inci.write('INSERT OR IGNORE INTO ingredient_search_terms (ingredient_id, term) SELECT id, inci_name_norm FROM ingredients;');
await inci.write('INSERT OR IGNORE INTO ingredient_search_terms (ingredient_id, term) SELECT ingredient_id, alias_norm FROM ingredient_aliases;');
await inci.write('PRAGMA foreign_key_check;');
await inci.write('PRAGMA optimize;');
await inci.close();
process.stdout.write(`inci: ${canonicalIngredientByNorm.size} canonical ingredients, ${duplicateIngredients} duplicate source rows normalized; raw source archive ${includeRawIngredientSourceRecords ? 'included' : 'excluded from runtime D1'}\n`);
