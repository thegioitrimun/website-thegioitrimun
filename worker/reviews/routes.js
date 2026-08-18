import { methodNotAllowed } from '../platform/http.js';
import { canReview, createReview, listProductReviews } from './handlers.js';

export async function maybeHandleReviewRoute({ request, env, path }) {
    if (String(env.DATA_BACKEND || '').toLowerCase() !== 'd1') return null;
    const match = path.match(/^\/api\/products\/(\d+)\/reviews(?:\/(eligibility))?$/);
    if (!match) return null;
    if (match[2] === 'eligibility') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        return canReview(request, env, match[1]);
    }
    if (request.method === 'GET') return listProductReviews(request, env, match[1]);
    if (request.method === 'POST') return createReview(request, env, match[1]);
    return methodNotAllowed(['GET', 'POST']);
}

