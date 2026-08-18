import { getSession, requireCsrf, requireSession } from '../auth/session.js';
import { apiError, json, readJson, requireD1 } from '../platform/http.js';

function productId(value) {
    const id = Math.trunc(Number(value));
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw Object.assign(new Error('Invalid product ID.'), { status: 400 });
    }
    return id;
}

async function reviewEligibility(db, userId, id) {
    const existing = await db.prepare('SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? LIMIT 1')
        .bind(userId, id).first();
    if (existing) return { eligible: false, reason: 'already_reviewed' };
    const purchase = await db.prepare(`SELECT 1 AS eligible
        FROM product_order_items i JOIN product_orders o ON o.id = i.order_id
        WHERE i.product_id = ? AND o.user_id = ? AND o.status = 'completed' LIMIT 1`)
        .bind(id, userId).first();
    return { eligible: Boolean(purchase), reason: purchase ? null : 'purchase_not_completed' };
}

export async function listProductReviews(request, env, rawProductId) {
    try {
        const db = requireD1(env);
        const id = productId(rawProductId);
        const rows = await db.prepare(`SELECT r.*, COALESCE(u.display_name, 'Khách hàng') AS author_name,
            COALESCE(u.avatar_url, '') AS author_avatar_url
            FROM product_reviews r LEFT JOIN users u ON u.id = r.user_id
            WHERE r.product_id = ? AND r.is_published = 1 ORDER BY r.created_at DESC LIMIT 500`)
            .bind(id).all();
        return json({ reviews: (rows.results || []).map((row) => ({
            ...row,
            verified_purchase: Boolean(row.verified_purchase),
            is_published: Boolean(row.is_published),
            author: { name: row.author_name, avatar_url: row.author_avatar_url, avatar_path: '' },
        })) });
    } catch (error) {
        return apiError(error, 'Could not load product reviews.');
    }
}

export async function canReview(request, env, rawProductId) {
    try {
        const db = requireD1(env);
        const id = productId(rawProductId);
        const session = await getSession(db, request);
        if (!session) return json({ eligible: false, reason: 'authentication_required' });
        return json(await reviewEligibility(db, session.user_id, id));
    } catch (error) {
        return apiError(error, 'Could not check review eligibility.');
    }
}

export async function createReview(request, env, rawProductId) {
    try {
        const db = requireD1(env);
        const id = productId(rawProductId);
        const session = await requireSession(db, request);
        await requireCsrf(db, request, session);
        const eligibility = await reviewEligibility(db, session.user_id, id);
        if (!eligibility.eligible) {
            const message = eligibility.reason === 'already_reviewed'
                ? 'Bạn đã đánh giá sản phẩm này rồi.'
                : 'Chỉ khách hàng đã hoàn tất đơn mua mới có thể đánh giá sản phẩm này.';
            throw Object.assign(new Error(message), { status: 409 });
        }
        const body = await readJson(request, 32 * 1024);
        const rating = Math.trunc(Number(body.rating));
        const comment = String(body.comment || '').trim().slice(0, 5000);
        const title = String(body.title || '').trim().slice(0, 255) || null;
        if (rating < 1 || rating > 5 || !comment) {
            throw Object.assign(new Error('Điểm đánh giá và nội dung là bắt buộc.'), { status: 400 });
        }
        const now = new Date().toISOString();
        const review = {
            id: crypto.randomUUID(), product_id: id, user_id: session.user_id,
            rating, title, comment, verified_purchase: 1, is_published: 1,
            created_at: now, updated_at: now,
        };
        await db.prepare(`INSERT INTO product_reviews (
            id, product_id, user_id, rating, title, comment, verified_purchase,
            is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(...Object.values(review)).run();
        return json({ review: { ...review, verified_purchase: true } }, 201);
    } catch (error) {
        return apiError(error, 'Could not create product review.');
    }
}

