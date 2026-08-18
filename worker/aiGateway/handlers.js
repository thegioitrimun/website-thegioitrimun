const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 45_000;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_PROMPT_LENGTH = 120_000;
const ADMIN_ACTIONS = new Set([
    'generate_product_details',
    'generate_product_faq',
    'generate_seo_metadata',
    'translate_blog_category_en',
    'translate_blog_category_all',
    'translate_blog_content',
]);
const USER_ACTIONS = new Set(['ask_skin', 'summarize_document']);
const ALLOWED_ACTIONS = new Set([...ADMIN_ACTIONS, ...USER_ACTIONS]);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
]);

function normalizePart(part) {
    if (!part || typeof part !== 'object') return null;
    if (typeof part.text === 'string') return { text: part.text };

    const inlineData = part.inlineData || part.inline_data;
    if (inlineData && typeof inlineData.data === 'string') {
        const mimeType = String(inlineData.mimeType || inlineData.mime_type || '').toLowerCase();
        if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
            throw new Error('Unsupported document MIME type.');
        }
        return {
            inline_data: {
                data: inlineData.data,
                mime_type: mimeType,
            },
        };
    }

    return null;
}

function normalizeContents(contents) {
    if (typeof contents === 'string') {
        return [{ role: 'user', parts: [{ text: contents }] }];
    }

    const entries = Array.isArray(contents) ? contents : [contents];
    return entries
        .filter(Boolean)
        .map((entry) => {
            if (typeof entry === 'string') {
                return { role: 'user', parts: [{ text: entry }] };
            }
            const parts = Array.isArray(entry?.parts) ? entry.parts : [];
            return {
                role: entry?.role === 'model' ? 'model' : 'user',
                parts: parts.map(normalizePart).filter(Boolean),
            };
        })
        .filter((entry) => entry.parts.length > 0);
}

function countTextLength(contents) {
    return contents.reduce(
        (total, entry) => total + entry.parts.reduce((partTotal, part) => partTotal + String(part.text || '').length, 0),
        0,
    );
}

function buildGeminiRequest(rawRequest, action) {
    const contents = normalizeContents(rawRequest?.contents);
    if (contents.length === 0) throw new Error('Missing AI prompt.');
    if (countTextLength(contents) > MAX_TEXT_PROMPT_LENGTH) throw new Error('AI prompt is too large.');

    if (action !== 'summarize_document' && contents.some((entry) => entry.parts.some((part) => part.inline_data))) {
        throw new Error('Inline documents are only allowed for document summarization.');
    }

    const config = rawRequest?.config && typeof rawRequest.config === 'object' ? rawRequest.config : {};
    const generationConfig = {};
    if (config.responseMimeType === 'application/json') {
        generationConfig.response_mime_type = 'application/json';
    }
    if (config.responseSchema && typeof config.responseSchema === 'object') {
        generationConfig.response_schema = config.responseSchema;
    }

    const requestBody = { contents };
    if (Object.keys(generationConfig).length > 0) requestBody.generation_config = generationConfig;
    if (action === 'ask_skin') requestBody.tools = [{ google_search: {} }];
    return requestBody;
}

const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function fetchGemini(apiKey, body, configuredModel) {
    const candidateModels = [
        configuredModel,
        ...DEFAULT_GEMINI_MODELS,
    ].filter((m, idx, self) => typeof m === 'string' && m.trim().length > 0 && self.indexOf(m) === idx);

    let lastResponse = null;
    for (const model of candidateModels) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                },
            );

            if (res.ok) {
                return res;
            }

            lastResponse = res;
            if (res.status === 404) {
                console.warn(`Gemini model ${model} returned 404, attempting fallback to next model.`);
                continue;
            }

            return res;
        } catch (err) {
            if (model === candidateModels[candidateModels.length - 1]) {
                throw err;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }
    return lastResponse;
}

function buildClientResponse(payload) {
    const candidate = payload?.candidates?.[0] || {};
    const parts = candidate?.content?.parts || [];
    const text = parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
    return {
        text,
        candidates: [{
            groundingMetadata: candidate.groundingMetadata || candidate.grounding_metadata || null,
        }],
    };
}

export async function handleAiGenerate(request, env, deps) {
    const { jsonResponse, authorizeAuthenticatedRequest, authorizeRequestByRole } = deps;
    const respond = (payload, status = 200, headers = {}) => jsonResponse(payload, status, {
        'Cache-Control': 'no-store',
        ...headers,
    });
    const noStoreResponse = (response) => {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) return respond({ error: 'Request body is too large.' }, 413);

    let body;
    try {
        body = await request.json();
    } catch {
        return respond({ error: 'Invalid JSON body.' }, 400);
    }

    const action = String(body?.action || '').trim();
    if (!ALLOWED_ACTIONS.has(action)) return respond({ error: 'Unsupported AI action.' }, 400);

    const auth = ADMIN_ACTIONS.has(action)
        ? await authorizeRequestByRole(request, ['admin', 'master_admin', 'doctor'])
        : await authorizeAuthenticatedRequest(request);
    if (auth.error) return noStoreResponse(auth.error);

    if (!env.GEMINI_API_KEY) {
        return respond({ error: 'AI service is not configured.' }, 503);
    }

    if (!env.AI_RATE_LIMITER) {
        return respond({ error: 'AI rate limiter is not configured.' }, 503);
    }
    const rateLimit = await env.AI_RATE_LIMITER.limit({ key: `${auth.user.id}:${action}` });
    if (!rateLimit.success) {
        return respond({ error: 'AI request limit exceeded. Please try again later.' }, 429, {
            'Retry-After': '60',
        });
    }

    let geminiRequest;
    try {
        geminiRequest = buildGeminiRequest(body?.request, action);
    } catch (error) {
        return respond({ error: error instanceof Error ? error.message : 'Invalid AI request.' }, 400);
    }

    let upstream;
    try {
        upstream = await fetchGemini(env.GEMINI_API_KEY, geminiRequest, env.GEMINI_MODEL);
    } catch (error) {
        const timedOut = error instanceof Error && error.name === 'AbortError';
        return respond({ error: timedOut ? 'AI request timed out.' : 'AI service is unavailable.' }, 503);
    }

    if (!upstream.ok) {
        const payload = await upstream.json().catch(() => null);
        const status = [400, 429, 500, 502, 503, 504].includes(upstream.status) ? upstream.status : 502;
        return respond({
            error: payload?.error?.message || 'AI service returned an error.',
        }, status);
    }

    const payload = await upstream.json();
    return respond(buildClientResponse(payload));
}
