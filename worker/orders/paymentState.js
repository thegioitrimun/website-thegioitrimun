const PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'failed', 'refunded']);

export function paymentStateAfterFulfillment(order, nextFulfillmentStatus, paidAt) {
    const currentStatus = PAYMENT_STATUSES.has(order?.payment_status) ? order.payment_status : 'unpaid';
    const currentPaidAt = order?.paid_at || null;
    const shouldMarkCounterPaymentPaid = nextFulfillmentStatus === 'completed'
        && (order?.payment_method === 'cod' || order?.payment_method === 'cash')
        && currentStatus === 'unpaid';

    return {
        payment_status: shouldMarkCounterPaymentPaid ? 'paid' : currentStatus,
        paid_at: shouldMarkCounterPaymentPaid ? (paidAt || new Date().toISOString()) : currentPaidAt,
        changed: shouldMarkCounterPaymentPaid,
    };
}
