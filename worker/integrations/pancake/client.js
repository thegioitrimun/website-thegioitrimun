const DEFAULT_BASE_URL = 'https://pos.pages.fm/api/v1';

function boundedInteger(value, fallback, min, max) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

export function getPancakeConfig(env) {
    const apiKey = String(env?.PANCAKE_API_KEY || '').trim();
    const shopId = String(env?.PANCAKE_SHOP_ID || '').trim();
    const explicitlyDisabled = String(env?.PANCAKE_ENABLED || '').toLowerCase() === 'false';
    return {
        enabled: !explicitlyDisabled && Boolean(apiKey && shopId),
        apiKey,
        shopId,
        warehouseId: String(env?.PANCAKE_WAREHOUSE_ID || '').trim() || null,
        baseUrl: String(env?.PANCAKE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        timeoutMs: boundedInteger(env?.PANCAKE_TIMEOUT_MS, 12_000, 2_000, 30_000),
        maxAttempts: boundedInteger(env?.PANCAKE_MAX_ATTEMPTS, 8, 1, 12),
    };
}

export class PancakeApiError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'PancakeApiError';
        this.status = Number(options.status || 502);
        this.retryable = Boolean(options.retryable);
        this.code = String(options.code || 'PANCAKE_API_ERROR');
        this.details = options.details || null;
    }
}

function responseMessage(payload, fallback) {
    return String(
        payload?.message || payload?.error?.message || payload?.error || payload?.data?.message || fallback,
    ).slice(0, 1000);
}

export class PancakeClient {
    constructor(env) {
        this.config = getPancakeConfig(env);
        if (!this.config.enabled) {
            throw new PancakeApiError('Pancake is not configured.', {
                status: 503,
                code: 'PANCAKE_NOT_CONFIGURED',
                retryable: false,
            });
        }
    }

    shopPath(path = '') {
        return `/shops/${encodeURIComponent(this.config.shopId)}${path}`;
    }

    async request(method, path, { query = {}, body } = {}) {
        const url = new URL(`${this.config.baseUrl}${path}`);
        url.searchParams.set('api_key', this.config.apiKey);
        for (const [key, value] of Object.entries(query)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item != null && item !== '') url.searchParams.append(key, String(item));
                }
            } else if (value != null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort('Pancake request timed out.'), this.config.timeoutMs);
        try {
            const response = await fetch(url, {
                method,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    ...(body == null ? {} : { 'Content-Type': 'application/json' }),
                },
                body: body == null ? undefined : JSON.stringify(body),
            });
            const text = await response.text();
            let payload = null;
            try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 2000) }; }
            if (!response.ok || payload?.success === false) {
                const message = responseMessage(payload, `Pancake returned HTTP ${response.status}.`);
                // Pancake sometimes returns HTTP 200 with success:false for a missing product.
                // Normalize that semantic response so product upsert can create it instead of retrying forever.
                const productNotFound = /product\s+not\s+found/i.test(message);
                throw new PancakeApiError(message, {
                    status: response.status === 404 || productNotFound
                        ? 404
                        : response.status >= 400 && response.status < 500 ? response.status : 502,
                    code: response.status === 404 || productNotFound ? 'PANCAKE_NOT_FOUND' : 'PANCAKE_REQUEST_FAILED',
                    retryable: !productNotFound && (response.status === 408 || response.status === 429 || response.status >= 500),
                    details: { httpStatus: response.status, payload },
                });
            }
            return payload;
        } catch (error) {
            if (error instanceof PancakeApiError) throw error;
            const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
            throw new PancakeApiError(timedOut ? 'Pancake request timed out.' : 'Could not connect to Pancake.', {
                status: 502,
                code: timedOut ? 'PANCAKE_TIMEOUT' : 'PANCAKE_NETWORK_ERROR',
                retryable: true,
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    getProductBySku(sku) {
        return this.request('GET', this.shopPath(`/products/${encodeURIComponent(sku)}`));
    }

    createProduct(product) {
        return this.request('POST', this.shopPath('/products'), { body: { product } });
    }

    updateProduct(productId, product) {
        return this.request('PUT', this.shopPath(`/products/${encodeURIComponent(productId)}`), { body: { product } });
    }

    setProductsHidden(productIds, isHidden) {
        return this.request('PUT', this.shopPath('/products/update_hide'), {
            body: { product_ids: productIds.map(String), is_hide: Boolean(isHidden) },
        });
    }

    listWarehouses() {
        return this.request('GET', this.shopPath('/warehouses'));
    }

    listProductVariations(search, pageNumber = 1) {
        return this.request('GET', this.shopPath('/products/variations'), {
            query: { search, page_number: pageNumber, page_size: 30 },
        });
    }

    updateVariationQuantity(variationId, remainQuantity, warehouseId = this.config.warehouseId) {
        if (!warehouseId) {
            throw new PancakeApiError('PANCAKE_WAREHOUSE_ID is required to synchronize inventory.', {
                status: 503,
                code: 'PANCAKE_WAREHOUSE_NOT_CONFIGURED',
                retryable: false,
            });
        }
        return this.request('POST', this.shopPath(`/variations/${encodeURIComponent(variationId)}/update_quantity`), {
            body: {
                variations_warehouses: [{
                    warehouse_id: String(warehouseId),
                    remain_quantity: Math.max(0, Math.trunc(Number(remainQuantity) || 0)),
                }],
            },
        });
    }

    listCustomers(search, pageNumber = 1) {
        return this.request('GET', this.shopPath('/customers'), {
            query: { search, page_number: pageNumber, page_size: 30 },
        });
    }

    listCustomersUpdated(startTime, endTime, pageNumber = 1, pageSize = 25) {
        return this.request('GET', this.shopPath('/customers'), {
            query: {
                start_time_updated_at: Math.max(0, Math.trunc(Number(startTime) || 0)),
                end_time_updated_at: Math.max(0, Math.trunc(Number(endTime) || 0)),
                page_number: Math.max(1, Math.trunc(Number(pageNumber) || 1)),
                page_size: Math.max(1, Math.min(30, Math.trunc(Number(pageSize) || 25))),
            },
        });
    }

    getCustomer(customerId) {
        return this.request('GET', this.shopPath(`/customers/${encodeURIComponent(customerId)}`));
    }

    createCustomer(customer) {
        return this.request('POST', this.shopPath('/customers'), { body: customer });
    }

    updateCustomer(customerId, customer) {
        return this.request('PUT', this.shopPath(`/customers/${encodeURIComponent(customerId)}`), {
            body: { customer },
        });
    }

    createOrder(order) {
        return this.request('POST', this.shopPath('/orders'), { body: order });
    }

    listOrders(search, pageNumber = 1) {
        return this.request('GET', this.shopPath('/orders'), {
            query: {
                search,
                page_number: pageNumber,
                page_size: 30,
                'extra_fields[]': ['custom_id'],
            },
        });
    }

    listOrdersUpdated(startTime, endTime, pageNumber = 1, pageSize = 25) {
        return this.request('GET', this.shopPath('/orders'), {
            query: {
                updateStatus: 'updated_at',
                startDateTime: Math.max(0, Math.trunc(Number(startTime) || 0)),
                endDateTime: Math.max(0, Math.trunc(Number(endTime) || 0)),
                option_sort: 'last_updated_order_asc',
                page_number: Math.max(1, Math.trunc(Number(pageNumber) || 1)),
                page_size: Math.max(1, Math.min(30, Math.trunc(Number(pageSize) || 25))),
            },
        });
    }

    getOrder(orderId) {
        return this.request('GET', this.shopPath(`/orders/${encodeURIComponent(orderId)}`));
    }

    getShippingDocumentUrls(orderId, documentType = 'SHIPPING_LABEL') {
        return this.request('POST', this.shopPath('/products/get_logistics_shipping_document'), {
            query: { document_type: documentType },
            body: { params: [{ order_id: String(orderId) }] },
        });
    }

    updateOrder(orderId, order) {
        return this.request('PUT', this.shopPath(`/orders/${encodeURIComponent(orderId)}`), { body: order });
    }
}
