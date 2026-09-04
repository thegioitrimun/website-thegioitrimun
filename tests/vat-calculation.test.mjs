import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateLargestRemainder,
  calculateVatDocument,
  calculateVatPeriod,
  roundHalfUpRatio,
} from '../worker/vat/calculation.js';

test('round half up is deterministic for positive and negative VND', () => {
  assert.equal(roundHalfUpRatio(5, 10), 1);
  assert.equal(roundHalfUpRatio(4, 10), 0);
  assert.equal(roundHalfUpRatio(-5, 10), -1);
  assert.equal(roundHalfUpRatio(-4, 10), 0);
});

test('largest remainder allocation preserves the exact discount', () => {
  assert.deepEqual(allocateLargestRemainder([1, 1, 1], 2), [1, 1, 0]);
  const result = allocateLargestRemainder([70_000, 20_000, 10_000], 9_999);
  assert.equal(result.reduce((sum, value) => sum + value, 0), 9_999);
  assert.deepEqual(result, [6_999, 2_000, 1_000]);
});

test('exclusive and inclusive formulas match the statutory basis-point formulas', () => {
  const exclusive = calculateVatDocument({ priceMode: 'exclusive', lines: [{ quantity: 1, unitPrice: 100_000, rateBps: 1_000 }] });
  assert.equal(exclusive.netAmount, 100_000);
  assert.equal(exclusive.vatAmount, 10_000);
  assert.equal(exclusive.grossAmount, 110_000);
  const inclusive = calculateVatDocument({ priceMode: 'inclusive', lines: [{ quantity: 1, unitPrice: 110_000, rateBps: 1_000 }] });
  assert.equal(inclusive.netAmount, 100_000);
  assert.equal(inclusive.vatAmount, 10_000);
  assert.equal(inclusive.grossAmount, 110_000);
});

test('0%, 5%, 8%, 10%, discount and shipping are calculated by line then grouped', () => {
  const document = calculateVatDocument({
    priceMode: 'exclusive',
    lines: [
      { id: 'zero', quantity: 1, unitPrice: 100_000, rateBps: 0, taxClass: 'zero' },
      { id: 'five', quantity: 1, unitPrice: 100_000, rateBps: 500 },
      { id: 'eight', quantity: 1, unitPrice: 100_000, rateBps: 800 },
      { id: 'ten', quantity: 1, unitPrice: 100_000, rateBps: 1_000 },
    ],
    discountAmount: 3,
    shippingFee: 11_000,
    shippingRateBps: 1_000,
    shippingTaxClass: 'standard',
    shippingVatCategoryCode: 'VAT_10',
  });
  assert.equal(document.lines.reduce((sum, line) => sum + line.allocatedDiscount, 0), 3);
  assert.equal(document.groups.length, 4);
  assert.equal(document.netAmount + document.vatAmount, document.grossAmount);
  assert.equal(document.lines.reduce((sum, line) => sum + line.netAmount, 0), document.netAmount);
  assert.equal(document.lines.reduce((sum, line) => sum + line.vatAmount, 0), document.vatAmount);
});

test('negative correction keeps the sign and VAT equality', () => {
  const correction = calculateVatDocument({
    priceMode: 'inclusive', allowNegativeLines: true,
    lines: [{ quantity: 1, unitPrice: -108_000, rateBps: 800 }],
  });
  assert.equal(correction.netAmount, -100_000);
  assert.equal(correction.vatAmount, -8_000);
  assert.equal(correction.grossAmount, -108_000);
});

test('01/GTGT calculates payable and carry-forward credit', () => {
  const payable = calculateVatPeriod({
    method: 'deduction_01', sales: [{ vatAmount: 20_000 }],
    purchases: [{ vatAmount: 12_000, deductibleVatAmount: 10_000 }],
    adjustments: [{ amount: 1_000 }], openingCreditAmount: 2_000,
  });
  assert.equal(payable.taxPayableAmount, 9_000);
  assert.equal(payable.closingCreditAmount, 0);
  const credit = calculateVatPeriod({
    method: 'deduction_01', sales: [{ vatAmount: 5_000 }],
    purchases: [{ vatAmount: 12_000, deductibleVatAmount: 12_000 }], openingCreditAmount: 1_000,
  });
  assert.equal(credit.taxPayableAmount, 0);
  assert.equal(credit.closingCreditAmount, 8_000);
});

test('04/GTGT groups revenue at 1%, 5%, 3% and 2%', () => {
  const result = calculateVatPeriod({
    method: 'direct_04',
    directRates: { goods: 100, services: 500, manufacturing_transport_goods_services: 300, other: 200 },
    sales: [
      { grossAmount: 1_000_000, directRevenueCategory: 'goods' },
      { grossAmount: 1_000_000, directRevenueCategory: 'services' },
      { grossAmount: 1_000_000, directRevenueCategory: 'manufacturing_transport_goods_services' },
      { grossAmount: 1_000_000, directRevenueCategory: 'other' },
    ],
  });
  assert.equal(result.directRevenueAmount, 4_000_000);
  assert.equal(result.directTaxAmount, 110_000);
  assert.equal(result.taxPayableAmount, 110_000);
  assert.equal(result.directGroups.length, 4);
});
