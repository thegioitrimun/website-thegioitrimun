export const truncateText = (text: string, max = 160): string => {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
};

export const stripHtml = (text: string): string =>
    String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const buildClientSeoTitle = (
    primary: string,
    options: { context?: string; siteName?: string; maxLength?: number } = {},
) => {
    const { context, siteName = 'Thế Giới Trị Mụn', maxLength = 65 } = options;
    const parts = [stripHtml(primary), stripHtml(context || '')].filter(Boolean);
    let left = parts.join(' | ');
    let full = `${left} | ${siteName}`;

    if (full.length <= maxLength) return full;

    if (context) {
        left = stripHtml(primary);
        full = `${left} | ${siteName}`;
        if (full.length <= maxLength) return full;
    }

    const available = Math.max(10, maxLength - (` | ${siteName}`).length);
    return `${truncateText(left, available)} | ${siteName}`;
};

export const buildClientMetaDescription = (parts: Array<string | undefined | null>, max = 160) => {
    const seen = new Set<string>();
    const normalized = parts
        .map((entry) => stripHtml(String(entry || '')))
        .filter((entry) => {
            if (!entry) return false;
            const key = entry.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    if (normalized.length === 0) return '';

    const joined = normalized.join(' ');
    if (joined.length <= max) return joined;

    const bulletJoined = normalized.join(' • ');
    if (bulletJoined.length <= max) return bulletJoined;

    return truncateText(joined, max);
};
