const FRAGRANCE_ALLERGENS = new Set([
    'fragrance',
    'parfum',
    'perfume',
    'flavor',
    'limonene',
    'linalool',
    'citral',
    'citronellol',
    'geraniol',
    'coumarin',
    'eugenol',
    'isoeugenol',
    'benzyl alcohol',
    'benzyl benzoate',
    'benzyl salicylate',
    'hexyl cinnamal',
    'hydroxycitronellal',
    'alpha isomethyl ionone',
    'cinnamyl alcohol',
    'amyl cinnamal',
    'anisyl alcohol',
]);

const PARABEN_RE = /\b\w*paraben\b/i;
const SULFATE_RE = /\b(sodium lauryl sulfate|sodium laureth sulfate|ammonium lauryl sulfate|ammonium laureth sulfate|sulfate|sulphate|sles|sls)\b/i;
const SILICONE_RE = /(silicone|dimethicone|methicone|siloxane|silsesquioxane|cyclopentasiloxane|cyclohexasiloxane)/i;
const FUNGAL_RE = /(oil|oleate|stearate|palmitate|myristate|laurate|polysorbate|sorbitan|triglyceride|ester|butter|wax)/i;
const UV_FILTER_RE = /\b(titanium dioxide|zinc oxide|avobenzone|octinoxate|octisalate|octocrylene|homosalate|oxybenzone|ensulizole|ecamsule|bemotrizinol|bisoctrizole|uvinul|tinosorb|mexoryl|ethylhexyl methoxycinnamate|butyl methoxydibenzoylmethane)\b/i;

const DRYING_ALCOHOLS = new Set([
    'alcohol denat',
    'alcohol denatured',
    'sd alcohol',
    'ethanol',
    'isopropyl alcohol',
]);

export const DEFAULT_EFFECT_ASSETS = {
    'Dưỡng ẩm & bảo vệ hàng rào da': '/ingredient-assets/13941699.png.webp',
    'Làm dịu / phục hồi': '/ingredient-assets/promotes-wound-healing-e7a95d5590e806b332559c604d2a08f9a0b23aa88046873f0839a7495d7789f0.png.webp',
    'Làm mềm / hỗ trợ nền kem': '/ingredient-assets/4299869.png.webp',
    'Làm sạch': '/ingredient-assets/4299869.png.webp',
    'Làm sáng da': '/ingredient-assets/brightening-1cd9c2f5dcdd9edb1d023dc46c290121b78bc0db1f584eeba19c848d94d3756a.png.webp',
    'Chống lão hóa': '/ingredient-assets/anti-aging-cd7044b572861dda33a4a0864e40999dacb6d34b942c19552b97209ce49ecf89.png.webp',
    'Trị mụn': '/ingredient-assets/acne-fighting-c4a8124526ac47a08077940f801808fdd24dea70946dfc7fa302db9a08bb23a5.png.webp',
    'Chống nắng': '/ingredient-assets/UV Protection-28e21150fa26bf0db09528b94946eda7d8b8e82514a82423606376d3c54c84c9.png',
    'Chứa hương liệu': '/ingredient-assets/9976718.png.webp',
};

export const DEFAULT_SKIN_ASSETS = {
    'Da khô': '/ingredient-assets/Dry-a2e4adadf353fe0ebedd9288ea81b6088305a5ba9ce17fa3183c917c02dc23fa.png',
    'Da dầu': '/ingredient-assets/Oil-e14d56cbde6f5f190638159a3d73dcbf81eda672c65d391ff8e8180051097518.png',
    'Da nhạy cảm': '/ingredient-assets/Sensitive-67668fb28129bd8e45e802eb9583a0cd1e2d7f1c6cfe18506c4df531544d11a3.png',
};

export function normalizeIngredientName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[®™©]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseInciText(text) {
    return String(text || '')
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function buildSearchTerms(rawNames) {
    const terms = new Set();
    for (const rawName of rawNames || []) {
        const term = normalizeIngredientName(rawName);
        if (term) terms.add(term);
    }
    return Array.from(terms);
}

function parseJsonField(value, fallback) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function normalizeArrayField(value) {
    const parsed = parseJsonField(value, []);
    return Array.isArray(parsed)
        ? parsed
            .map((item) => String(item || '').trim())
            .filter((item) => item && item.length <= 80)
        : [];
}

export function normalizeIngredientRow(row) {
    const aliases = normalizeArrayField(row?.aliases ?? row?.aliases_json);
    const functions = normalizeArrayField(row?.functions ?? row?.functions_json);
    const categories = normalizeArrayField(row?.categories ?? row?.categories_json);
    return {
        id: row?.id || '',
        url: row?.url || '',
        inci_name: row?.inci_name || row?.name || row?.id || '',
        vi_name: row?.vi_name || '',
        ewg_score: row?.ewg_score ?? null,
        cir_rating: row?.cir_rating || '',
        comedogenic_rating: row?.comedogenic_rating ?? null,
        description: row?.description || row?.overview_text || '',
        aliases,
        functions,
        categories,
        overview_html: row?.overview_html || '',
    };
}

export function buildIngredientIndex(rows = []) {
    const index = new Map();
    for (const rawRow of rows) {
        const item = normalizeIngredientRow(rawRow);
        const keys = [item.id, item.inci_name, item.vi_name, ...item.aliases];
        for (const key of keys) {
            const normalized = normalizeIngredientName(key);
            if (normalized && !index.has(normalized)) {
                index.set(normalized, item);
            }
        }
    }
    return index;
}

export function ewgMax(score) {
    const values = String(score || '')
        .match(/\d+/g)
        ?.map((value) => Number.parseInt(value, 10))
        .filter(Number.isFinite) || [];
    return values.length ? Math.max(...values) : null;
}

export function ewgBucket(score) {
    const value = ewgMax(score);
    if (value === null) return 'unknown';
    if (value <= 2) return 'low';
    if (value <= 6) return 'moderate';
    return 'high';
}

function joinForText(parts) {
    return normalizeIngredientName(parts.filter(Boolean).join(' '));
}

function textFor(item) {
    return joinForText([
        item.id,
        item.inci_name,
        item.vi_name,
        item.aliases.join(' '),
        item.functions.join(' '),
        item.description,
    ]);
}

function identityTextFor(item) {
    return joinForText([
        item.id,
        item.inci_name,
        item.vi_name,
        item.aliases.join(' '),
    ]);
}

function coreIdentityTextFor(item) {
    return joinForText([
        item.id,
        item.inci_name,
        item.vi_name,
    ]);
}

function hasFragrance(item) {
    const identity = coreIdentityTextFor(item);
    for (const term of FRAGRANCE_ALLERGENS) {
        if (identity.includes(term)) return true;
    }
    return false;
}

function hasDryingAlcohol(identity) {
    for (const term of DRYING_ALCOHOLS) {
        if (identity.includes(term)) return true;
    }
    return false;
}

export function classifyIngredient(item) {
    const text = textFor(item);
    const identity = coreIdentityTextFor(item);
    const functions = String(item.functions.join(' ') || '').toLowerCase();
    const sunscreenFunction = ['chống nắng', 'hấp thụ uv', 'bộ lọc uv'].some((term) => functions.includes(term));
    const cleanserFunction = ['chất làm sạch', 'làm sạch - hoạt động bề mặt', 'tạo bọt', 'foaming', 'cleansing'].some((term) => functions.includes(term));
    const cleanserIdentity = ['sulfate', 'sulfonate', 'glucoside', 'betaine', 'sarcosinate', 'isethionate', 'taurate', 'cocoyl', 'lauroyl', 'lauryl', 'cocoampho', 'soap'].some((term) => identity.includes(term));
    const ewg = ewgMax(item.ewg_score);

    return {
        paraben: PARABEN_RE.test(identity),
        sulfate: SULFATE_RE.test(identity),
        drying_alcohol: hasDryingAlcohol(identity),
        silicone: SILICONE_RE.test(identity),
        fragrance: hasFragrance(item),
        eu_allergen: hasFragrance(item),
        fungal_acne_risk: FUNGAL_RE.test(text),
        high_ewg: ewg !== null && ewg >= 7,
        comedogenic: item.comedogenic_rating !== null && Number(item.comedogenic_rating) >= 3,
        humectant: ['giữ ẩm', 'dưỡng ẩm', 'humectant'].some((term) => functions.includes(term)),
        soothing: ['làm dịu', 'phục hồi'].some((term) => functions.includes(term)) || ['centella', 'madecassoside', 'allantoin', 'panthenol', 'aloe', 'bisabolol'].some((term) => text.includes(term)),
        cleanser: cleanserFunction && cleanserIdentity,
        emollient_base: ['chất làm mềm', 'nhũ hóa', 'ổn định nhũ tương', 'chất tạo màng', 'dưỡng da - làm mềm da'].some((term) => functions.includes(term)) || ['wax', 'butter', 'oil', 'stearate', 'palmitate', 'triglyceride'].some((term) => identity.includes(term)),
        barrier_support: ['bảo vệ da', 'dưỡng da - khóa ẩm', 'chất giữ ẩm', 'dưỡng ẩm'].some((term) => functions.includes(term)) || ['hyaluronate', 'glycerin', 'ceramide', 'cholesterol', 'panthenol'].some((term) => identity.includes(term)),
        brightening: ['niacinamide', 'vitamin c', 'ascorbic', 'arbutin', 'kojic', 'tranexamic'].some((term) => text.includes(term)),
        anti_acne: ['salicylic', 'benzoyl peroxide', 'sulfur', 'azelaic', 'retinol', 'adapalene'].some((term) => text.includes(term)),
        anti_aging: ['retinol', 'retinal', 'retinyl', 'peptide', 'tocopherol', 'niacinamide'].some((term) => text.includes(term)),
        uv_filter: sunscreenFunction || UV_FILTER_RE.test(identity),
    };
}

function makeCheck(label, passed, positiveTitle, negativeTitle) {
    return {
        label,
        passed,
        title: passed ? positiveTitle : negativeTitle,
    };
}

function trimDescription(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 420 ? `${text.slice(0, 417).trim()}...` : text;
}

export function computeSafetyScore(ewg, total) {
    if (!total) return 0;
    const weighted = ((ewg.low || 0) * 99) + ((ewg.moderate || 0) * 68) + ((ewg.unknown || 0) * 55) + ((ewg.high || 0) * 25);
    return Math.round(weighted / total);
}

export function verdictForScore(score) {
    if (score >= 90) return 'Độ an toàn xuất sắc';
    if (score >= 75) return 'Độ an toàn tốt';
    if (score >= 60) return 'Cần xem xét thêm';
    return 'Cần thận trọng';
}

export function analyzeIngredients(inciText, options = {}) {
    const rawNames = parseInciText(inciText);
    const index = options.index || buildIngredientIndex(options.rows || []);

    const analyzed = [];
    const unrecognized = [];
    rawNames.forEach((rawName, rawIndex) => {
        const match = index.get(normalizeIngredientName(rawName));
        if (!match) {
            unrecognized.push(rawName);
            analyzed.push({
                position: rawIndex + 1,
                raw_name: rawName,
                recognized: false,
                id: null,
                inci_name: rawName,
                vi_name: '',
                ewg_score: null,
                ewg_bucket: 'unknown',
                cir_rating: '',
                functions: [],
                description: 'Chưa có dữ liệu trong cơ sở dữ liệu.',
                flags: {},
            });
            return;
        }

        const flags = classifyIngredient(match);
        analyzed.push({
            position: rawIndex + 1,
            raw_name: rawName,
            recognized: true,
            id: match.id,
            url: match.url,
            inci_name: match.inci_name,
            vi_name: match.vi_name,
            ewg_score: match.ewg_score,
            ewg_bucket: ewgBucket(match.ewg_score),
            cir_rating: match.cir_rating,
            functions: match.functions,
            description: trimDescription(match.description),
            flags,
        });
    });

    const recognized = analyzed.filter((item) => item.recognized);
    const flagNames = ['paraben', 'sulfate', 'drying_alcohol', 'silicone', 'fungal_acne_risk', 'eu_allergen', 'fragrance'];
    const hasFlag = Object.fromEntries(flagNames.map((name) => [name, recognized.some((item) => item.flags?.[name])]));
    const quickChecks = {
        paraben_free: makeCheck('Không chứa paraben', !hasFlag.paraben, 'Không chứa paraben', 'Có chứa paraben'),
        sulfate_free: makeCheck('Không chứa sulfate', !hasFlag.sulfate, 'Không chứa sulfate', 'Có chứa sulfate'),
        alcohol_free: makeCheck('Không cồn khô', !hasFlag.drying_alcohol, 'Không cồn khô', 'Có cồn khô dễ làm khô da'),
        silicone_free: makeCheck('Không chứa silicone', !hasFlag.silicone, 'Không chứa silicone', 'Có chứa silicone'),
        fungal_acne_safe: makeCheck('An toàn với mụn nấm', !hasFlag.fungal_acne_risk, 'An toàn với mụn nấm', 'Có thành phần cần lưu ý với mụn nấm'),
        eu_allergen_free: makeCheck('Không chứa chất gây dị ứng (EU)', !hasFlag.eu_allergen, 'Không chứa chất gây dị ứng (EU)', 'Có chất gây dị ứng/hương liệu'),
        fragrance_free: makeCheck('Không chứa hương liệu', !hasFlag.fragrance, 'Không chứa hương liệu', 'Có chứa hương liệu'),
    };

    const ewg = { low: 0, moderate: 0, high: 0, unknown: 0 };
    analyzed.forEach((item) => {
        ewg[item.ewg_bucket] += 1;
    });

    const effectRules = [
        ['Dưỡng ẩm & bảo vệ hàng rào da', 'barrier_support'],
        ['Làm dịu / phục hồi', 'soothing'],
        ['Làm mềm / hỗ trợ nền kem', 'emollient_base'],
        ['Làm sạch', 'cleanser'],
        ['Làm sáng da', 'brightening'],
        ['Chống lão hóa', 'anti_aging'],
        ['Trị mụn', 'anti_acne'],
        ['Chống nắng', 'uv_filter'],
        ['Chứa hương liệu', 'fragrance'],
    ];
    const effects = effectRules
        .map(([label, flag]) => {
            const matches = recognized.filter((item) => item.flags?.[flag]);
            return matches.length
                ? {
                    label,
                    icon: DEFAULT_EFFECT_ASSETS[label] || '',
                    count: matches.length,
                    ingredients: matches.slice(0, 8).map((item) => item.inci_name),
                    negative: label === 'Chứa hương liệu',
                }
                : null;
        })
        .filter(Boolean);

    const skinRules = [
        ['Da khô', (flags) => (flags.humectant || flags.soothing ? 1 : (flags.drying_alcohol || flags.sulfate ? -1 : 0))],
        ['Da dầu', (flags) => (flags.anti_acne || flags.cleanser ? 1 : (flags.comedogenic || flags.fungal_acne_risk ? -1 : 0))],
        ['Da nhạy cảm', (flags) => (flags.soothing ? 1 : (flags.fragrance || flags.eu_allergen || flags.high_ewg || flags.drying_alcohol ? -1 : 0))],
    ];
    const skin = skinRules.map(([label, scorer]) => {
        const good = recognized.filter((item) => scorer(item.flags) > 0).map((item) => item.inci_name);
        const bad = recognized.filter((item) => scorer(item.flags) < 0).map((item) => item.inci_name);
        return {
            label,
            icon: DEFAULT_SKIN_ASSETS[label] || '',
            good: good.slice(0, 8),
            bad: bad.slice(0, 8),
            score: good.length - bad.length,
        };
    });

    const concerns = [];
    for (const item of recognized) {
        const reasons = [];
        if (item.flags.high_ewg) reasons.push(`EWG ${item.ewg_score}`);
        if (item.flags.fragrance) reasons.push('Hương liệu/chất tạo mùi');
        if (item.flags.paraben) reasons.push('Paraben');
        if (item.flags.sulfate) reasons.push('Sulfate');
        if (item.flags.drying_alcohol) reasons.push('Cồn khô');
        if (reasons.length) {
            concerns.push({
                id: item.id,
                inci_name: item.inci_name,
                ewg_score: item.ewg_score,
                reasons,
            });
        }
    }

    const summary = {
        total: rawNames.length,
        recognized: recognized.length,
        unrecognized: unrecognized.length,
        recognition_rate: rawNames.length ? Math.round((recognized.length / rawNames.length) * 100) : 0,
    };
    const safety_score = computeSafetyScore(ewg, summary.total);

    return {
        summary,
        safety_score,
        verdict: verdictForScore(safety_score),
        quick_checks: quickChecks,
        ewg,
        effects,
        skin,
        ingredients: analyzed,
        concerns,
        unrecognized,
    };
}
