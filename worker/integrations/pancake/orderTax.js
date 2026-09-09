import { calculateVatDocument } from '../../vat/calculation.js';

const SNAPSHOT_FIELDS = [
    'subtotal_price', 'discount_amount', 'taxable_amount', 'tax_amount',
    'shipping_fee', 'shipping_net_amount', 'shipping_tax_rate', 'shipping_tax_amount',
    'grand_total',
];

export function matchPancakeOrderItems(items, existingItems) {
    const remaining = [...existingItems];
    return items.map((item) => {
        let index = item.variationId ? remaining.findIndex((saved) => (
            String(saved.external_variation_id || '') === String(item.variationId)
        )) : -1;
        if (index < 0 && item.localProductId != null) {
            index = remaining.findIndex((saved) => Number(saved.product_id) === Number(item.localProductId));
        }
        const existing = index < 0 ? null : remaining.splice(index, 1)[0];
        const unchanged = existing && Number(existing.quantity) === item.quantity
            && Number(existing.price_at_purchase) === item.price;
        return {
            ...item, existing,
            vatRate: Number(existing?.vat_rate || 0),
            lineTax: unchanged ? Number(existing.tax_amount || 0) : 0,
        };
    });
}

// Pancake's zero/missing `tax` must not overwrite a checkout/admin VAT snapshot.
// Native Pancake orders have no local tax profile and retain their imported VAT.
export function resolvePancakeOrderTax(localOrder, incoming, matchedItems, existingCount, productRates = new Map()) {
    const imported = {
        ...incoming,
        taxable_amount: Math.max(0, incoming.subtotal_price - incoming.discount_amount),
        shipping_net_amount: incoming.shipping_fee,
        shipping_tax_rate: 0,
        shipping_tax_amount: 0,
    };
    if (!localOrder.tax_profile_id) return { financials: imported, items: matchedItems };

    const unchanged = matchedItems.length === existingCount
        && matchedItems.every((item) => item.existing
            && Number(item.existing.quantity) === item.quantity
            && Number(item.existing.price_at_purchase) === item.price)
        && Number(localOrder.subtotal_price) === incoming.subtotal_price
        && Number(localOrder.discount_amount || 0) === incoming.discount_amount;
    if (unchanged) {
        // Never reprice history with today's catalog or tax settings.
        return {
            financials: Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, Number(localOrder[field] || 0)])),
            items: matchedItems,
        };
    }

    const subtotal = matchedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!matchedItems.length || subtotal !== incoming.subtotal_price) {
        throw Object.assign(new Error('Pancake item subtotal conflicts with the saved VAT order; financial reconciliation is required.'), { retryable: false });
    }
    const items = matchedItems.map((item) => {
        const rawRate = item.existing?.vat_rate ?? productRates.get(item.localProductId);
        if (rawRate == null || !Number.isFinite(Number(rawRate))) {
            throw Object.assign(new Error('A new Pancake order item has no verified VAT classification; financial reconciliation is required.'), { retryable: false });
        }
        const rate = Number(rawRate);
        return { ...item, vatRate: rate > 1 ? rate / 100 : rate };
    });
    const document = calculateVatDocument({
        priceMode: localOrder.tax_mode,
        lines: items.map((item, index) => ({
            id: String(index), quantity: item.quantity, unitPrice: item.price,
            rateBps: Math.round(item.vatRate * 10_000),
        })),
        discountAmount: incoming.discount_amount,
        // The customer shipping charge is not the carrier's actual charge.
        shippingFee: Number(localOrder.shipping_fee || 0),
        shippingRateBps: Math.round(Number(localOrder.shipping_tax_rate || 0) * 10_000),
    });
    const productLines = document.lines.filter((line) => !line.isShipping);
    const shipping = document.lines.find((line) => line.isShipping);
    return {
        financials: {
            subtotal_price: subtotal,
            discount_amount: document.discountAmount,
            taxable_amount: productLines.reduce((sum, line) => sum + line.netAmount, 0),
            tax_amount: productLines.reduce((sum, line) => sum + line.vatAmount, 0),
            shipping_fee: Number(localOrder.shipping_fee || 0),
            shipping_net_amount: shipping?.netAmount || 0,
            shipping_tax_rate: Number(localOrder.shipping_tax_rate || 0),
            shipping_tax_amount: shipping?.vatAmount || 0,
            grand_total: document.grossAmount,
        },
        items: items.map((item, index) => ({ ...item, lineTax: productLines[index].vatAmount })),
    };
}
