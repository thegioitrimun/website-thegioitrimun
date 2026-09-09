// Shared by checkout, admin order entry and the Worker. This is the customer
// shipping charge, not a carrier quote. Never apply it to imported/old orders.
export const ONLINE_SHIPPING_FEE_VND = 30_000;

export function shippingFeeForNewOrder(channel = 'online') {
    if (channel === 'online') return ONLINE_SHIPPING_FEE_VND;
    if (channel === 'pos') return 0;
    throw new Error('Unsupported order channel.');
}

export function publicShippingPolicy(env = {}) {
    return {
        mode: 'fixed',
        currency: 'VND',
        online_fee: ONLINE_SHIPPING_FEE_VND,
        pos_fee: 0,
        // These are checkout preferences, not proof of a booked shipment.
        checkout_providers: ['spx', ...(
            String(env.GHTK_ENABLED || '').toLowerCase() === 'true' && env.GHTK_TOKEN
                ? ['ghtk'] : []
        )],
    };
}
