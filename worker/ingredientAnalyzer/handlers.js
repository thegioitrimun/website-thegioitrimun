import {
    analyzeIngredients,
    buildSearchTerms,
    parseInciText,
} from './analyzer.js';

const INGREDIENT_SELECT = [
    'id',
    'url',
    'inci_name',
    'vi_name',
    'ewg_score',
    'cir_rating',
    'comedogenic_rating',
    'description',
    'aliases',
    'categories',
    'functions',
    'skin_types',
    'additional_info',
    'crawled_at',
].join(',');

const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
};

const D1_TERM_BATCH_SIZE = 24;
const D1_ID_BATCH_SIZE = 60;

function normalizeSupabaseUrl(value) {
    return String(value || '').replace(/\/+$/, '');
}

export function getIngredientSupabaseConfig(env = {}) {
    const url = normalizeSupabaseUrl(env.INGREDIENT_SUPABASE_URL || env.SKINCARISMA_SUPABASE_URL);
    const key = (
        env.INGREDIENT_SUPABASE_SECRET_KEY ||
        env.INGREDIENT_SUPABASE_KEY ||
        env.INGREDIENT_SUPABASE_PUBLISHABLE_KEY ||
        env.INGREDIENT_SUPABASE_ANON_KEY ||
        env.SKINCARISMA_SUPABASE_KEY ||
        env.SKINCARISMA_SUPABASE_PUBLISHABLE_KEY ||
        ''
    );
    return { url, key };
}

export function ingredientRestUrl(baseUrl, endpoint, params = {}) {
    const url = new URL(`/rest/v1/${String(endpoint || '').replace(/^\/+/, '')}`, `${baseUrl}/`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

export function ingredientRestHeaders(key) {
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
    };
}

function postgrestIn(values) {
    return `(${values.map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`;
}

function postgrestLike(value) {
    return String(value || '')
        .replace(/[%*]/g, '')
        .slice(0, 80);
}

async function fetchJson(url, key, options = {}) {
    const response = await fetch(url, {
        method: 'GET',
        headers: ingredientRestHeaders(key),
        signal: options.signal,
    });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        const error = new Error(`Supabase responded with ${response.status}`);
        error.status = response.status;
        error.body = body.slice(0, 500);
        throw error;
    }
    return response.json();
}

function uniqueRows(rows) {
    const seen = new Set();
    const output = [];
    for (const row of rows || []) {
        const ingredient = row?.ingredients || row?.ingredient || row;
        if (!ingredient?.id || seen.has(ingredient.id)) continue;
        seen.add(ingredient.id);
        output.push(ingredient);
    }
    return output;
}

function chunks(values, size) {
    const output = [];
    for (let index = 0; index < values.length; index += size) {
        output.push(values.slice(index, index + size));
    }
    return output;
}

function parseJsonObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function uniqueStrings(values) {
    return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

export function getIngredientD1Databases(env = {}) {
    const configuredCount = Math.max(0, Number.parseInt(String(env.INCI_SHARD_COUNT || '0'), 10) || 0);
    if (configuredCount > 0) {
        const databases = Array.from({ length: configuredCount }, (_, index) => env[`INCI_DB_${index}`])
            .filter((db) => db && typeof db.prepare === 'function');
        if (databases.length !== configuredCount) {
            throw Object.assign(new Error('INCI shard bindings are incomplete.'), { status: 503 });
        }
        return databases;
    }
    return env.INCI_DB && typeof env.INCI_DB.prepare === 'function' ? [env.INCI_DB] : [];
}

async function fetchViaSearchTerms(config, terms, signal) {
    if (!terms.length) return [];
    const url = ingredientRestUrl(config.url, 'ingredient_search_terms', {
        term_norm: `in.${postgrestIn(terms)}`,
        select: `term_norm,ingredient_id,ingredients(${INGREDIENT_SELECT})`,
        limit: Math.max(terms.length, 1) * 4,
    });
    const rows = await fetchJson(url, config.key, { signal });
    return uniqueRows(rows);
}

async function fetchViaDirectIngredientLookup(config, rawNames, signal) {
    const rows = [];
    const seenUrls = new Set();
    for (const rawName of rawNames.slice(0, 120)) {
        const normalized = postgrestLike(rawName);
        if (!normalized) continue;
        const queryUrl = ingredientRestUrl(config.url, 'ingredients', {
            select: INGREDIENT_SELECT,
            or: `(id.eq.${normalized.toLowerCase().replace(/\s+/g, '-')},inci_name.ilike.*${normalized}*,vi_name.ilike.*${normalized}*)`,
            limit: 8,
        });
        if (seenUrls.has(queryUrl)) continue;
        seenUrls.add(queryUrl);
        try {
            rows.push(...await fetchJson(queryUrl, config.key, { signal }));
        } catch (error) {
            if (error?.status === 404 || error?.status === 400) {
                continue;
            }
            throw error;
        }
    }
    return uniqueRows(rows);
}

export async function fetchIngredientRows(config, rawNames, signal) {
    const terms = buildSearchTerms(rawNames).slice(0, 160);
    try {
        const rows = await fetchViaSearchTerms(config, terms, signal);
        if (rows.length) return rows;
    } catch (error) {
        if (![400, 404, 406].includes(Number(error?.status))) {
            throw error;
        }
        console.warn('[ingredient-analyzer] Falling back from ingredient_search_terms lookup:', {
            status: error.status,
            body: error.body,
        });
    }
    return fetchViaDirectIngredientLookup(config, rawNames, signal);
}

async function fetchIngredientRowsFromD1Shard(db, terms) {
    const matchedIds = new Set();
    await Promise.all(chunks(terms, D1_TERM_BATCH_SIZE).map(async (termBatch) => {
        const placeholders = termBatch.map(() => '?').join(',');
        const matches = await db.prepare(`
            SELECT ingredient_id FROM ingredient_search_terms WHERE term IN (${placeholders})
            UNION
            SELECT id AS ingredient_id FROM ingredients WHERE inci_name_norm IN (${placeholders})
            UNION
            SELECT ingredient_id FROM ingredient_aliases WHERE alias_norm IN (${placeholders})
        `).bind(...termBatch, ...termBatch, ...termBatch).all();
        for (const row of matches.results || []) {
            if (row.ingredient_id) matchedIds.add(row.ingredient_id);
        }
    }));

    const ids = Array.from(matchedIds);
    if (!ids.length) return [];

    const rows = [];
    await Promise.all(chunks(ids, D1_ID_BATCH_SIZE).map(async (idBatch) => {
        const placeholders = idBatch.map(() => '?').join(',');
        const [ingredients, aliases, functions, sourceRecords] = await Promise.all([
            db.prepare(`SELECT * FROM ingredients WHERE id IN (${placeholders})`).bind(...idBatch).all(),
            db.prepare(`SELECT ingredient_id, alias FROM ingredient_aliases WHERE ingredient_id IN (${placeholders})`).bind(...idBatch).all(),
            db.prepare(`SELECT l.ingredient_id, f.name_vi, f.name_en FROM ingredient_function_links l
                JOIN ingredient_functions f ON f.id = l.function_id WHERE l.ingredient_id IN (${placeholders})
                ORDER BY l.confidence DESC, f.name_vi`).bind(...idBatch).all(),
            db.prepare(`SELECT source_id, ingredient_id, source_json FROM ingredient_source_records
                WHERE ingredient_id IN (${placeholders}) ORDER BY updated_at DESC`).bind(...idBatch).all(),
        ]);

        const aliasesById = new Map();
        for (const row of aliases.results || []) {
            const list = aliasesById.get(row.ingredient_id) || [];
            list.push(row.alias);
            aliasesById.set(row.ingredient_id, list);
        }
        const functionsById = new Map();
        for (const row of functions.results || []) {
            const list = functionsById.get(row.ingredient_id) || [];
            list.push(row.name_vi || row.name_en);
            functionsById.set(row.ingredient_id, list);
        }
        const sourceById = new Map();
        const chunkedSourceIds = [];
        const sourceIdToIngredientId = new Map();
        for (const row of sourceRecords.results || []) {
            if (sourceById.has(row.ingredient_id)) continue;
            const source = parseJsonObject(row.source_json);
            sourceIdToIngredientId.set(row.source_id, row.ingredient_id);
            if (source.chunked) chunkedSourceIds.push(row.source_id);
            else sourceById.set(row.ingredient_id, source);
        }
        if (chunkedSourceIds.length) {
            const chunkPlaceholders = chunkedSourceIds.map(() => '?').join(',');
            const chunkRows = await db.prepare(`SELECT source_id, chunk_index, chunk_text
                FROM ingredient_source_record_chunks WHERE source_id IN (${chunkPlaceholders})
                ORDER BY source_id, chunk_index`).bind(...chunkedSourceIds).all();
            const chunksBySourceId = new Map();
            for (const row of chunkRows.results || []) {
                const list = chunksBySourceId.get(row.source_id) || [];
                list.push(row.chunk_text);
                chunksBySourceId.set(row.source_id, list);
            }
            for (const sourceId of chunkedSourceIds) {
                const ingredientId = sourceIdToIngredientId.get(sourceId);
                if (ingredientId) {
                    sourceById.set(ingredientId, parseJsonObject((chunksBySourceId.get(sourceId) || []).join('')));
                }
            }
        }

        for (const row of ingredients.results || []) {
            const source = sourceById.get(row.id) || {};
            const aliasesForIngredient = uniqueStrings([
                ...(Array.isArray(source.aliases) ? source.aliases : []),
                ...(aliasesById.get(row.id) || []),
            ]);
            const functionsForIngredient = uniqueStrings([
                ...(Array.isArray(source.functions) ? source.functions : []),
                ...(functionsById.get(row.id) || []),
            ]);
            rows.push({
                ...source,
                id: row.id,
                inci_name: row.inci_name || source.inci_name || '',
                vi_name: row.name_vi || source.vi_name || source.name_vi || '',
                ewg_score: row.ewg_min == null
                    ? (source.ewg_score ?? null)
                    : (row.ewg_max != null && row.ewg_max !== row.ewg_min
                        ? `${row.ewg_min}-${row.ewg_max}`
                        : String(row.ewg_min)),
                cir_rating: row.cir_rating || source.cir_rating || '',
                comedogenic_rating: row.comedogenic_rating ?? source.comedogenic_rating ?? null,
                description: row.description_vi || row.description_en || source.description || '',
                aliases: aliasesForIngredient,
                functions: functionsForIngredient,
                categories: Array.isArray(source.categories) ? source.categories : [],
                skin_types: Array.isArray(source.skin_types) ? source.skin_types : [],
                additional_info: Array.isArray(source.additional_info) ? source.additional_info : [],
            });
        }
    }));
    return rows;
}

export async function fetchIngredientRowsD1(env, rawNames) {
    const databases = getIngredientD1Databases(env);
    if (!databases.length) {
        throw Object.assign(new Error('INCI D1 database is not configured.'), { status: 503 });
    }
    const terms = buildSearchTerms(rawNames).slice(0, 160);
    if (!terms.length) return [];
    const shardRows = await Promise.all(databases.map((db) => fetchIngredientRowsFromD1Shard(db, terms)));
    return uniqueRows(shardRows.flat());
}

export async function handleIngredientAnalyze(request, env, deps = {}) {
    const { jsonResponse } = deps;
    let payload = null;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400, RESPONSE_HEADERS);
    }

    const inciText = String(payload?.inciText || payload?.ingredients || '').trim();
    if (!inciText) {
        return jsonResponse({ error: 'Vui lòng nhập bảng thành phần cần phân tích.' }, 400, RESPONSE_HEADERS);
    }

    const rawNames = parseInciText(inciText);
    if (rawNames.length > 160) {
        return jsonResponse({ error: 'Vui lòng phân tích tối đa 160 thành phần mỗi lần.' }, 413, RESPONSE_HEADERS);
    }

    const useD1 = String(env.DATA_BACKEND || '').toLowerCase() === 'd1';
    const config = getIngredientSupabaseConfig(env);
    if (!useD1 && (!config.url || !config.key)) {
        return jsonResponse({ error: 'Ingredient data source is not configured.' }, 503, RESPONSE_HEADERS);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('ingredient analyzer timeout'), 9000);
    try {
        const rows = useD1
            ? await fetchIngredientRowsD1(env, rawNames)
            : await fetchIngredientRows(config, rawNames, controller.signal);
        const analysis = analyzeIngredients(inciText, { rows });
        return jsonResponse({
            ...analysis,
            meta: {
                source: useD1
                    ? (getIngredientD1Databases(env).length > 1 ? 'cloudflare-d1-sharded' : 'cloudflare-d1')
                    : 'supabase-skincarisma',
                matched_rows: rows.length,
                lang: payload?.lang || 'vi',
            },
        }, 200, RESPONSE_HEADERS);
    } catch (error) {
        console.error('[ingredient-analyzer] Analysis failed:', {
            message: error instanceof Error ? error.message : String(error),
            status: error?.status,
            body: error?.body,
        });
        return jsonResponse({ error: 'Không thể phân tích thành phần lúc này.' }, 502, RESPONSE_HEADERS);
    } finally {
        clearTimeout(timeoutId);
    }
}
