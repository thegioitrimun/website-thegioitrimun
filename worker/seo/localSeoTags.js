export const LOCAL_SEO_TAGS = [
    'phòng khám da liễu phú quốc',
    'trị mụn phú quốc',
    'bác sĩ da liễu phú quốc',
    'khám da liễu ở đâu phú quốc',
    'dị ứng hải sản phú quốc',
    'trị nám tàn nhang phú quốc',
    'cháy nắng biển phú quốc',
    'thuốc bôi dị ứng phú quốc',
    'spa chăm sóc da phú quốc',
    'bắn tàn nhang ở phú quốc',
    'khám da liễu bệnh viện phú quốc',
    'thuốc trị sứa lửa cắn phú quốc',
    'kem chống nắng đi biển phú quốc',
    'trị mụn lưng phú quốc',
];

const MAX_LOCAL_SEO_TAGS = 5;
const TAG_BY_NORMALIZED_VALUE = new Map();

const normalizeSearchText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/^#+/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

for (const tag of LOCAL_SEO_TAGS) {
    TAG_BY_NORMALIZED_VALUE.set(normalizeSearchText(tag), tag);
}

const TAG_RULES = [
    {
        tag: 'trị mụn lưng phú quốc',
        signals: ['mụn lưng', 'mụn vùng lưng', 'mụn ở lưng'],
        bodySignals: ['mụn lưng', 'mụn vùng lưng', 'mụn ở lưng'],
        score: 12,
    },
    {
        tag: 'trị mụn phú quốc',
        signals: ['mụn', 'acne', 'trị mụn', 'điều trị mụn'],
        score: 10,
    },
    {
        tag: 'dị ứng hải sản phú quốc',
        signals: ['dị ứng hải sản', 'hải sản gây dị ứng', 'ngộ độc hải sản'],
        bodySignals: ['dị ứng hải sản', 'hải sản gây dị ứng', 'ngộ độc hải sản'],
        score: 12,
    },
    {
        tag: 'thuốc trị sứa lửa cắn phú quốc',
        signals: ['sứa lửa', 'sứa cắn', 'vết sứa', 'bị sứa'],
        bodySignals: ['sứa lửa', 'sứa cắn', 'vết sứa', 'bị sứa'],
        score: 12,
    },
    {
        tag: 'cháy nắng biển phú quốc',
        signals: ['cháy nắng', 'bỏng nắng', 'da sau nắng', 'phục hồi sau nắng'],
        bodySignals: ['cháy nắng', 'bỏng nắng', 'da sau nắng', 'phục hồi sau nắng'],
        score: 11,
    },
    {
        tag: 'kem chống nắng đi biển phú quốc',
        signals: ['kem chống nắng', 'chống nắng', 'đi biển', 'tia uv', 'spf'],
        score: 10,
    },
    {
        tag: 'trị nám tàn nhang phú quốc',
        signals: ['nám', 'tàn nhang', 'sắc tố', 'đốm nâu'],
        score: 10,
    },
    {
        tag: 'bắn tàn nhang ở phú quốc',
        signals: ['bắn tàn nhang', 'laser tàn nhang', 'điều trị tàn nhang', 'xóa tàn nhang'],
        bodySignals: ['bắn tàn nhang', 'laser tàn nhang', 'điều trị tàn nhang', 'xóa tàn nhang'],
        score: 11,
    },
    {
        tag: 'thuốc bôi dị ứng phú quốc',
        signals: ['dị ứng', 'mẩn ngứa', 'phát ban', 'viêm da tiếp xúc', 'thuốc bôi'],
        score: 9,
    },
    {
        tag: 'spa chăm sóc da phú quốc',
        signals: ['spa', 'chăm sóc da', 'liệu trình da', 'peel da', 'mesotherapy', 'vi kim', 'laser'],
        score: 7,
    },
    {
        tag: 'bác sĩ da liễu phú quốc',
        signals: ['bác sĩ da liễu', 'da liễu', 'bác sĩ', 'chuyên khoa da'],
        score: 6,
    },
    {
        tag: 'phòng khám da liễu phú quốc',
        signals: ['phòng khám da liễu', 'da liễu', 'điều trị da', 'chăm sóc da', 'làn da'],
        score: 5,
    },
    {
        tag: 'khám da liễu ở đâu phú quốc',
        signals: ['khám da liễu', 'phòng khám', 'bác sĩ da liễu'],
        score: 4,
    },
    {
        tag: 'khám da liễu bệnh viện phú quốc',
        signals: ['bệnh viện', 'khám da liễu bệnh viện'],
        score: 4,
    },
];

const splitInputTags = (value) => {
    if (Array.isArray(value)) return value;
    return String(value || '').split(',');
};

const includesSignal = (text, signal) =>
    ` ${text} `.includes(` ${normalizeSearchText(signal)} `);

export const normalizeLocalSeoTags = (value, limit = MAX_LOCAL_SEO_TAGS) => {
    const normalized = [];
    const seen = new Set();

    for (const entry of splitInputTags(value)) {
        const tag = TAG_BY_NORMALIZED_VALUE.get(normalizeSearchText(entry));
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        normalized.push(tag);
        if (normalized.length >= limit) break;
    }

    return normalized;
};

export const inferLocalSeoTags = (record = {}, options = {}) => {
    const primaryText = normalizeSearchText([
        record.title,
        record.summary,
        record.name,
        record.description,
        ...(Array.isArray(record.benefits) ? record.benefits : []),
    ].filter(Boolean).join(' '));
    const bodyText = normalizeSearchText([
        record.content,
        record.long_description,
    ].filter(Boolean).join(' '));

    const scoredTags = TAG_RULES
        .map((rule, index) => ({
            ...rule,
            index,
            matches: rule.signals.filter((signal) => includesSignal(primaryText, signal)).length
                + (rule.bodySignals || []).filter((signal) => includesSignal(bodyText, signal)).length,
        }))
        .filter((rule) => rule.matches > 0)
        .sort((a, b) => (b.score + b.matches) - (a.score + a.matches) || a.index - b.index)
        .map((rule) => rule.tag);

    if (options.kind === 'service' && scoredTags.length === 0) {
        scoredTags.push('spa chăm sóc da phú quốc', 'phòng khám da liễu phú quốc');
    }

    return normalizeLocalSeoTags(scoredTags);
};

export const mergeLocalSeoTags = (...values) =>
    normalizeLocalSeoTags(values.flatMap((value) => splitInputTags(value)));

export const toLocalSeoHashtag = (tag) =>
    `#${String(tag || '').trim().replace(/\s+/g, '_')}`;
