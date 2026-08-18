#!/usr/bin/env node

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const fail = (message) => {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
};

const pass = (message) => {
  console.log(`[PASS] ${message}`);
};

const parseNumeric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

const expectApprox = (actual, expected, label, tolerance = 1e-6) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected}, received ${actual}`);
  }
  pass(`${label}: ${actual}`);
};

async function runQuery(query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    fail(`Query failed (${res.status}): ${text.slice(0, 1000)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    fail(`Invalid JSON response: ${text.slice(0, 1000)}`);
  }
}

async function main() {
  const summaryRows = await runQuery(`
    select
      (select count(*)::int from public.tax_profiles where is_active = true) as active_profiles,
      (select count(*)::int from public.tax_profiles where is_default = true) as default_profiles,
      (select count(*)::int from public.products where vat_rate is null) as products_missing_vat,
      (select count(*)::int from public.products where vat_rate < 0 or vat_rate > 1) as products_vat_out_of_range;
  `);

  const summary = summaryRows[0];
  if (!summary) fail('Could not load tax summary.');
  if (Number(summary.active_profiles) < 1) fail('No active tax profile found.');
  if (Number(summary.default_profiles) !== 1) fail(`Expected exactly 1 default tax profile, found ${summary.default_profiles}.`);
  if (Number(summary.products_missing_vat) !== 0) fail(`Found ${summary.products_missing_vat} products missing vat_rate.`);
  if (Number(summary.products_vat_out_of_range) !== 0) fail(`Found ${summary.products_vat_out_of_range} products with vat_rate outside 0..1.`);

  pass(`Active tax profiles: ${summary.active_profiles}`);
  pass(`Default tax profiles: ${summary.default_profiles}`);
  pass('All products have vat_rate');
  pass('All product vat_rate values are inside 0..1');

  const sampleQuoteRows = await runQuery(`
    with sample_product as (
      select id, name, price, vat_rate
      from public.products
      where is_published = true
      order by id desc
      limit 1
    )
    select
      sp.id,
      sp.name,
      sp.price,
      sp.vat_rate,
      q.tax_mode,
      q.tax_rate,
      q.taxable_amount,
      q.tax_amount,
      q.shipping_tax_rate,
      q.shipping_tax_amount,
      q.grand_total
    from sample_product sp
    cross join lateral public.quote_product_order_totals(
      sp.price,
      0,
      0,
      null,
      null,
      jsonb_build_array(jsonb_build_object('product_id', sp.id, 'quantity', 1))
    ) q;
  `);

  const sampleQuote = sampleQuoteRows[0];
  if (!sampleQuote) fail('Could not load sample quote.');

  const samplePrice = parseNumeric(sampleQuote.price);
  const sampleVatRate = parseNumeric(sampleQuote.vat_rate);
  const quotedTaxRate = parseNumeric(sampleQuote.tax_rate);
  const quotedTaxAmount = parseNumeric(sampleQuote.tax_amount);
  const quotedTaxable = parseNumeric(sampleQuote.taxable_amount);

  expectApprox(quotedTaxRate, sampleVatRate, 'Quote uses product vat_rate');

  if (sampleQuote.tax_mode === 'inclusive') {
    const expectedTaxable = Number((samplePrice / (1 + sampleVatRate)).toFixed(2));
    const expectedTax = Number((samplePrice - expectedTaxable).toFixed(2));
    expectApprox(quotedTaxable, expectedTaxable, 'Inclusive taxable amount', 0.01);
    expectApprox(quotedTaxAmount, expectedTax, 'Inclusive tax amount', 0.01);
  } else {
    const expectedTax = Number((samplePrice * sampleVatRate).toFixed(2));
    expectApprox(quotedTaxable, samplePrice, 'Exclusive taxable amount', 0.01);
    expectApprox(quotedTaxAmount, expectedTax, 'Exclusive tax amount', 0.01);
  }

  const matchRows = await runQuery(`
    begin;
    with profile as (
      select id
      from public.tax_profiles
      where is_default = true
      limit 1
    ),
    inserted as (
      insert into public.tax_rates (
        tax_profile_id,
        province,
        district,
        rate,
        applies_to_shipping,
        priority,
        is_active
      )
      select id, 'Hồ Chí Minh', 'Quận 1', 0.07, true, 999, true
      from profile
      returning id
    ),
    sample_product as (
      select id, price
      from public.products
      where is_published = true
      order by id desc
      limit 1
    )
    select
      q.tax_rate,
      q.shipping_tax_rate,
      q.shipping_tax_amount,
      q.grand_total
    from inserted
    cross join sample_product sp
    cross join lateral public.quote_product_order_totals(
      sp.price,
      0,
      100000,
      'Hồ Chí Minh',
      'Quận 1',
      jsonb_build_array(jsonb_build_object('product_id', sp.id, 'quantity', 1))
    ) q;
    rollback;
  `);

  const match = matchRows[0];
  if (!match) fail('Could not verify district-matching tax override.');
  expectApprox(parseNumeric(match.shipping_tax_rate), 0.07, 'District override shipping tax rate');
  expectApprox(parseNumeric(match.shipping_tax_amount), 7000, 'District override shipping tax amount', 0.01);

  const nonMatchRows = await runQuery(`
    begin;
    with profile as (
      select id
      from public.tax_profiles
      where is_default = true
      limit 1
    ),
    inserted as (
      insert into public.tax_rates (
        tax_profile_id,
        province,
        district,
        rate,
        applies_to_shipping,
        priority,
        is_active
      )
      select id, 'Hồ Chí Minh', 'Quận 1', 0.07, true, 999, true
      from profile
      returning id
    ),
    sample_product as (
      select id, price
      from public.products
      where is_published = true
      order by id desc
      limit 1
    )
    select
      q.shipping_tax_rate,
      q.shipping_tax_amount
    from inserted
    cross join sample_product sp
    cross join lateral public.quote_product_order_totals(
      sp.price,
      0,
      100000,
      'Hồ Chí Minh',
      'Quận 9',
      jsonb_build_array(jsonb_build_object('product_id', sp.id, 'quantity', 1))
    ) q;
    rollback;
  `);

  const nonMatch = nonMatchRows[0];
  if (!nonMatch) fail('Could not verify non-matching district tax fallback.');
  expectApprox(parseNumeric(nonMatch.shipping_tax_rate), 0, 'Non-matching district shipping tax rate');
  expectApprox(parseNumeric(nonMatch.shipping_tax_amount), 0, 'Non-matching district shipping tax amount', 0.01);

  console.log('');
  console.log(`[DONE] Tax runtime QA passed for ${projectRef}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
