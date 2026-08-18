const SOCIAL_URL_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export const SOCIAL_URL_FIELDS = [
  'facebook_url',
  'instagram_url',
  'youtube_url',
  'tiktok_url',
  'zalo_url',
  'messenger_url',
];

export const SOCIAL_NETWORK_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  zalo: 'Zalo',
  messenger: 'Messenger',
};

export function normalizeExternalUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  let candidate = trimmed;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (!SOCIAL_URL_PROTOCOL_PATTERN.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname || url.username || url.password) return '';
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return '';
  }
}

export function getExternalUrlError(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || normalizeExternalUrl(trimmed)) return '';
  return 'URL không hợp lệ. Hãy nhập địa chỉ đầy đủ, ví dụ https://facebook.com/thegioimun.';
}

export function normalizeFooterSocialUrls(content) {
  if (!content) return content;

  const normalized = { ...content };
  for (const field of SOCIAL_URL_FIELDS) {
    const currentValue = normalized[field];
    if (typeof currentValue !== 'string') continue;
    normalized[field] = currentValue.trim() ? normalizeExternalUrl(currentValue) : '';
  }
  return normalized;
}
