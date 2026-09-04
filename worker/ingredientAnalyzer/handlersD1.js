import { analyzeIngredients, buildSearchTerms, parseInciText } from './analyzer.js';

const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
};
const D1_TERM_BATCH_SIZE = 24;
const D1_ID_BATCH_SIZE = 60;

function chunks(values, size) {
    const output = [];
    for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
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
        for (const row of matches.results || []) if (row.ingredient_id) matchedIds.add(row.ingredient_id);
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
                if (ingredientId) sourceById.set(ingredientId, parseJsonObject((chunksBySourceId.get(sourceId) || []).join('')));
            }
        }

        for (const row of ingredients.results || []) {
            const source = sourceById.get(row.id) || {};
            rows.push({
                ...source,
                id: row.id,
                inci_name: row.inci_name || source.inci_name || '',
                vi_name: row.name_vi || source.vi_name || source.name_vi || '',
                ewg_score: row.ewg_min == null ? (source.ewg_score ?? null)
                    : (row.ewg_max != null && row.ewg_max !== row.ewg_min ? `${row.ewg_min}-${row.ewg_max}` : String(row.ewg_min)),
                cir_rating: row.cir_rating || source.cir_rating || '',
                comedogenic_rating: row.comedogenic_rating ?? source.comedogenic_rating ?? null,
                description: row.description_vi || row.description_en || source.description || '',
                aliases: uniqueStrings([...(Array.isArray(source.aliases) ? source.aliases : []), ...(aliasesById.get(row.id) || [])]),
                functions: uniqueStrings([...(Array.isArray(source.functions) ? source.functions : []), ...(functionsById.get(row.id) || [])]),
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
    if (!databases.length) throw Object.assign(new Error('INCI D1 database is not configured.'), { status: 503 });
    const terms = buildSearchTerms(rawNames).slice(0, 160);
    if (!terms.length) return [];
    const shardRows = await Promise.all(databases.map((db) => fetchIngredientRowsFromD1Shard(db, terms)));
    return uniqueRows(shardRows.flat());
}

export async function handleIngredientAnalyze(request, env, deps = {}) {
    const { jsonResponse } = deps;
    const payload = await request.json().catch(() => null);
    if (!payload) return jsonResponse({ error: 'Invalid JSON body.' }, 400, RESPONSE_HEADERS);
    const inciText = String(payload.inciText || payload.ingredients || '').trim();
    if (!inciText) return jsonResponse({ error: 'Vui lòng nhập bảng thành phần cần phân tích.' }, 400, RESPONSE_HEADERS);
    const rawNames = parseInciText(inciText);
    if (rawNames.length > 160) return jsonResponse({ error: 'Vui lòng phân tích tối đa 160 thành phần mỗi lần.' }, 413, RESPONSE_HEADERS);
    try {
        const rows = await fetchIngredientRowsD1(env, rawNames);
        const analysis = analyzeIngredients(inciText, { rows });
        return jsonResponse({
            ...analysis,
            meta: {
                source: getIngredientD1Databases(env).length > 1 ? 'cloudflare-d1-sharded' : 'cloudflare-d1',
                matched_rows: rows.length,
                lang: payload.lang || 'vi',
            },
        }, 200, RESPONSE_HEADERS);
    } catch (error) {
        console.error('[ingredient-analyzer] D1 analysis failed:', { message: error instanceof Error ? error.message : String(error) });
        return jsonResponse({ error: 'Không thể phân tích thành phần lúc này.' }, Number(error?.status || 502), RESPONSE_HEADERS);
    }
}
