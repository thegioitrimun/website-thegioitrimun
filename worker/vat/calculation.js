const PRICE_MODES = new Set(['inclusive', 'exclusive']);
const REVENUE_CATEGORIES = new Set([
    'goods',
    'services',
    'manufacturing_transport_goods_services',
    'other',
]);

function integer(value, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        throw Object.assign(new Error(`${field} must be a safe integer.`), { status: 400 });
    }
    return parsed;
}

/** Round a rational number to the nearest integer, with .5 away from zero. */
export function roundHalfUpRatio(numerator, denominator) {
    const n = BigInt(integer(numerator, 'numerator'));
    const d = BigInt(integer(denominator, 'denominator', { min: 1 }));
    const sign = n < 0n ? -1n : 1n;
    const absolute = n < 0n ? -n : n;
    const rounded = (absolute * 2n + d) / (d * 2n);
    const result = Number(rounded * sign);
    if (!Number.isSafeInteger(result)) {
        throw Object.assign(new Error('Rounded monetary value exceeds the safe integer range.'), { status: 400 });
    }
    return result;
}

/**
 * Allocate an integer amount proportionally and distribute residual đồng by
 * largest remainder. Stable index ordering makes replays deterministic.
 */
export function allocateLargestRemainder(weights, total) {
    const normalized = weights.map((weight, index) => ({
        index,
        weight: integer(weight, `weights[${index}]`, { min: 0 }),
    }));
    const allocationTotal = integer(total, 'total', { min: 0 });
    const weightTotal = normalized.reduce((sum, item) => sum + item.weight, 0);
    if (allocationTotal === 0) return normalized.map(() => 0);
    if (weightTotal <= 0 || allocationTotal > weightTotal) {
        throw Object.assign(new Error('Discount cannot exceed the allocatable amount.'), { status: 400 });
    }

    const denominator = BigInt(weightTotal);
    const provisional = normalized.map((item) => {
        const numerator = BigInt(allocationTotal) * BigInt(item.weight);
        return {
            ...item,
            amount: Number(numerator / denominator),
            remainder: numerator % denominator,
        };
    });
    let residual = allocationTotal - provisional.reduce((sum, item) => sum + item.amount, 0);
    provisional.sort((left, right) => {
        if (left.remainder === right.remainder) return left.index - right.index;
        return left.remainder > right.remainder ? -1 : 1;
    });
    for (let index = 0; index < residual; index += 1) provisional[index].amount += 1;
    provisional.sort((left, right) => left.index - right.index);
    return provisional.map((item) => item.amount);
}

function normalizeLine(line, index, fallbackPriceMode, allowNegativeLines = false) {
    const quantity = integer(line.quantity ?? 1, `lines[${index}].quantity`, { min: 1, max: 1_000_000 });
    const unitPrice = integer(line.unitPrice ?? line.unit_price ?? 0, `lines[${index}].unitPrice`, { min: allowNegativeLines ? Number.MIN_SAFE_INTEGER : 0 });
    const rateBps = integer(line.rateBps ?? line.rate_bps ?? 0, `lines[${index}].rateBps`, { min: 0, max: 10_000 });
    const priceMode = PRICE_MODES.has(line.priceMode ?? line.price_mode)
        ? (line.priceMode ?? line.price_mode)
        : fallbackPriceMode;
    const revenueCategory = REVENUE_CATEGORIES.has(line.directRevenueCategory ?? line.direct_revenue_category)
        ? (line.directRevenueCategory ?? line.direct_revenue_category)
        : 'goods';
    const amountBeforeDiscount = integer(unitPrice * quantity, `lines[${index}].amountBeforeDiscount`, { min: allowNegativeLines ? Number.MIN_SAFE_INTEGER : 0 });
    return {
        ...line,
        id: String(line.id ?? index + 1),
        lineNumber: index + 1,
        quantity,
        unitPrice,
        rateBps,
        priceMode,
        revenueCategory,
        vatCategoryCode: String(line.vatCategoryCode ?? line.vat_category_code ?? (rateBps ? `VAT_${rateBps / 100}` : 'VAT_0')),
        taxClass: String(line.taxClass ?? line.tax_class ?? (rateBps ? 'standard' : 'zero')),
        amountBeforeDiscount,
    };
}

function calculateLine(line, allocatedDiscount) {
    const transactionAmount = line.amountBeforeDiscount - allocatedDiscount;
    if (line.priceMode === 'inclusive') {
        const vatAmount = line.rateBps > 0
            ? roundHalfUpRatio(transactionAmount * line.rateBps, 10_000 + line.rateBps)
            : 0;
        return {
            ...line,
            allocatedDiscount,
            netAmount: transactionAmount - vatAmount,
            vatAmount,
            grossAmount: transactionAmount,
        };
    }
    const vatAmount = line.rateBps > 0
        ? roundHalfUpRatio(transactionAmount * line.rateBps, 10_000)
        : 0;
    return {
        ...line,
        allocatedDiscount,
        netAmount: transactionAmount,
        vatAmount,
        grossAmount: transactionAmount + vatAmount,
    };
}

/**
 * Canonical VAT document calculator. Money is integer VND and rates are basis
 * points. VAT is calculated per line, then aggregated by rate.
 */
export function calculateVatDocument(input = {}) {
    const fallbackPriceMode = PRICE_MODES.has(input.priceMode ?? input.price_mode)
        ? (input.priceMode ?? input.price_mode)
        : 'inclusive';
    const sourceLines = Array.isArray(input.lines) ? input.lines : [];
    if (!sourceLines.length || sourceLines.length > 500) {
        throw Object.assign(new Error('A VAT document must contain between 1 and 500 lines.'), { status: 400 });
    }
    const allowNegativeLines = Boolean(input.allowNegativeLines ?? input.allow_negative_lines);
    const normalized = sourceLines.map((line, index) => normalizeLine(line, index, fallbackPriceMode, allowNegativeLines));
    const subtotalAmount = normalized.reduce((sum, line) => sum + line.amountBeforeDiscount, 0);
    const requestedDiscount = input.discountAmount ?? input.discount_amount ?? 0;
    const discountAmount = subtotalAmount < 0
        ? integer(requestedDiscount, 'discountAmount', { min: 0, max: 0 })
        : integer(requestedDiscount, 'discountAmount', { min: 0, max: subtotalAmount });
    if (discountAmount > 0 && normalized.some((line) => line.amountBeforeDiscount < 0)) {
        throw Object.assign(new Error('Discount allocation cannot mix positive and negative lines.'), { status: 400 });
    }
    const allocations = discountAmount
        ? allocateLargestRemainder(normalized.map((line) => line.amountBeforeDiscount), discountAmount)
        : normalized.map(() => 0);
    const lines = normalized.map((line, index) => calculateLine(line, allocations[index]));

    const shippingFee = integer(input.shippingFee ?? input.shipping_fee ?? 0, 'shippingFee', { min: 0 });
    if (shippingFee > 0) {
        const shipping = normalizeLine({
            id: input.shippingId || 'shipping',
            description: input.shippingDescription || 'Phí vận chuyển',
            quantity: 1,
            unitPrice: shippingFee,
            rateBps: input.shippingRateBps ?? input.shipping_rate_bps ?? 0,
            priceMode: input.shippingPriceMode ?? input.shipping_price_mode ?? fallbackPriceMode,
            vatCategoryCode: input.shippingVatCategoryCode ?? input.shipping_vat_category_code ?? 'NON_SUBJECT',
            taxClass: input.shippingTaxClass ?? input.shipping_tax_class ?? 'non_subject',
            directRevenueCategory: input.shippingRevenueCategory ?? input.shipping_revenue_category ?? 'services',
            isShipping: true,
        }, lines.length, fallbackPriceMode, false);
        lines.push(calculateLine(shipping, 0));
    }

    const groups = new Map();
    for (const line of lines) {
        const key = `${line.taxClass}:${line.rateBps}`;
        const group = groups.get(key) || {
            taxClass: line.taxClass,
            rateBps: line.rateBps,
            netAmount: 0,
            vatAmount: 0,
            grossAmount: 0,
        };
        group.netAmount += line.netAmount;
        group.vatAmount += line.vatAmount;
        group.grossAmount += line.grossAmount;
        groups.set(key, group);
    }

    const netAmount = lines.reduce((sum, line) => sum + line.netAmount, 0);
    const vatAmount = lines.reduce((sum, line) => sum + line.vatAmount, 0);
    const grossAmount = lines.reduce((sum, line) => sum + line.grossAmount, 0);
    return {
        priceMode: fallbackPriceMode,
        subtotalAmount,
        discountAmount,
        netAmount,
        vatAmount,
        grossAmount,
        lines,
        groups: [...groups.values()].sort((left, right) => left.rateBps - right.rateBps),
    };
}

export function calculateVatPeriod(input = {}) {
    const method = input.method === 'direct_04' ? 'direct_04' : 'deduction_01';
    const sales = Array.isArray(input.sales) ? input.sales : [];
    const purchases = Array.isArray(input.purchases) ? input.purchases : [];
    const adjustments = Array.isArray(input.adjustments) ? input.adjustments : [];
    const openingCreditAmount = integer(input.openingCreditAmount ?? 0, 'openingCreditAmount', { min: 0 });
    const adjustmentAmount = adjustments.reduce((sum, item, index) => (
        sum + integer(item.amount ?? 0, `adjustments[${index}].amount`)
    ), 0);

    const outputVatAmount = sales.reduce((sum, item) => sum + integer(item.vatAmount ?? item.vat_amount ?? 0, 'sales.vatAmount'), 0);
    const inputVatAmount = purchases.reduce((sum, item) => sum + integer(item.vatAmount ?? item.vat_amount ?? 0, 'purchases.vatAmount'), 0);
    const deductibleInputVatAmount = purchases.reduce((sum, item) => (
        sum + integer(item.deductibleVatAmount ?? item.deductible_vat_amount ?? 0, 'purchases.deductibleVatAmount')
    ), 0);

    if (method === 'deduction_01') {
        const balance = outputVatAmount - deductibleInputVatAmount + adjustmentAmount - openingCreditAmount;
        return {
            method,
            outputVatAmount,
            inputVatAmount,
            deductibleInputVatAmount,
            adjustmentAmount,
            openingCreditAmount,
            taxPayableAmount: Math.max(0, balance),
            closingCreditAmount: Math.max(0, -balance),
            directRevenueAmount: 0,
            directTaxAmount: 0,
            directGroups: [],
        };
    }

    const directRates = input.directRates || {};
    const directGroups = new Map();
    for (const sale of sales) {
        const category = REVENUE_CATEGORIES.has(sale.directRevenueCategory ?? sale.direct_revenue_category)
            ? (sale.directRevenueCategory ?? sale.direct_revenue_category)
            : 'goods';
        const amount = integer(sale.grossAmount ?? sale.gross_amount ?? sale.netAmount ?? sale.net_amount ?? 0, 'sales.revenue');
        const rateBps = integer(directRates[category] ?? sale.directRateBps ?? sale.direct_rate_bps ?? 0, 'directRateBps', { min: 0, max: 10_000 });
        const group = directGroups.get(category) || { category, rateBps, revenueAmount: 0, taxAmount: 0 };
        group.revenueAmount += amount;
        group.taxAmount += roundHalfUpRatio(amount * rateBps, 10_000);
        directGroups.set(category, group);
    }
    const groups = [...directGroups.values()];
    const directRevenueAmount = groups.reduce((sum, item) => sum + item.revenueAmount, 0);
    const directTaxAmount = groups.reduce((sum, item) => sum + item.taxAmount, 0) + adjustmentAmount;
    return {
        method,
        outputVatAmount,
        inputVatAmount,
        deductibleInputVatAmount,
        adjustmentAmount,
        openingCreditAmount,
        taxPayableAmount: Math.max(0, directTaxAmount),
        closingCreditAmount: 0,
        directRevenueAmount,
        directTaxAmount,
        directGroups: groups,
    };
}
