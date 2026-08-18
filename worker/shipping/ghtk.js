const API_BASE = 'https://services.giaohangtietkiem.vn';

function token(env) {
    const value = String(env.GHTK_TOKEN || '').trim();
    if (!value) throw Object.assign(new Error('GHTK is not configured.'), { status: 503 });
    return value;
}

async function ghtkFetch(env, path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 8000));
    try {
        const headers = new Headers(options.headers || {});
        headers.set('Token', token(env));
        headers.set('Accept', options.accept || 'application/json');
        const response = await fetch(`${API_BASE}${path}`, {
            method: options.method || 'GET',
            headers,
            body: options.body,
            signal: controller.signal,
        });
        if (options.raw) {
            if (!response.ok) throw Object.assign(new Error(`GHTK request failed (${response.status}).`), { status: 502 });
            return response;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
            throw Object.assign(new Error(String(payload.message || `GHTK request failed (${response.status}).`)), {
                status: response.status >= 400 && response.status < 500 ? 400 : 502,
            });
        }
        return payload;
    } catch (error) {
        if (error?.name === 'AbortError') throw Object.assign(new Error('GHTK request timed out.'), { status: 504 });
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function listPickAddresses(env) {
    const cache = caches.default;
    const key = new Request('https://internal.thegioitrimun.vn/cache/ghtk/pick-addresses');
    const cached = await cache.match(key);
    if (cached) return cached.json();
    const payload = await ghtkFetch(env, '/services/shipment/list_pick_addr');
    const data = payload.data || [];
    await cache.put(key, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    }));
    return data;
}

export async function getPickAddress(env, id) {
    const payload = await ghtkFetch(env, `/services/shipment/get_pick_addr?pick_address_id=${encodeURIComponent(id)}`);
    return payload.data;
}

export async function calculateFee(env, input) {
    const addresses = await listPickAddresses(env).catch(() => []);
    const defaultAddress = addresses.find((item) => Number(item.is_default) === 1) || {};
    const params = new URLSearchParams({
        pick_province: defaultAddress.pick_province || env.GHTK_PICK_PROVINCE || 'Thành phố Hồ Chí Minh',
        pick_district: defaultAddress.pick_district || env.GHTK_PICK_DISTRICT || 'Quận Tân Phú',
        province: input.province,
        district: input.district,
        ward: input.ward,
        address: input.address,
        weight: String(input.weight),
        transport: input.transport === 'fly' ? 'fly' : 'road',
    });
    if (input.value) params.set('value', String(input.value));
    const payload = await ghtkFetch(env, `/services/shipment/fee?${params.toString()}`);
    return payload.fee;
}

export async function createShipment(env, payload) {
    const response = await ghtkFetch(env, '/services/shipment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 12000,
    });
    return response.order;
}

export async function cancelShipment(env, label) {
    return ghtkFetch(env, `/services/shipment/cancel/${encodeURIComponent(label)}`, { method: 'POST' });
}

export async function trackShipment(env, label) {
    return ghtkFetch(env, `/services/shipment/v2/${encodeURIComponent(label)}`);
}

export async function getShipmentLabel(env, label) {
    return ghtkFetch(env, `/services/label/${encodeURIComponent(label)}`, { raw: true, accept: 'application/pdf' });
}
