#!/usr/bin/env node

const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const outPath = process.env.PHASE5_RUNTIME_OUT || '';

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

const sql = `
BEGIN;

CREATE TEMP TABLE _phase5_checks (
  check_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  v_product public.products%ROWTYPE;
  v_order_bank public.product_orders%ROWTYPE;
  v_order_cod public.product_orders%ROWTYPE;
  v_order_cancel public.product_orders%ROWTYPE;
  v_discount_code text;
  v_stock_initial integer;
  v_stock_after_create integer;
  v_stock_after_restock integer;
  v_invalid_transition_blocked boolean := false;
  v_second_restock_blocked boolean := false;
  v_over_refund_blocked boolean := false;
  v_partial_refund numeric := 0;
  v_order_bank_total numeric := 0;
  v_order_cod_total numeric := 0;
  v_hist_count integer := 0;
  v_payment_count integer := 0;
  v_refund_count integer := 0;
BEGIN
  SELECT *
  INTO v_product
  FROM public.products
  WHERE is_published = true
    AND stock_quantity >= 6
  ORDER BY stock_quantity DESC, id ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No published product with stock >= 6 for phase5 runtime matrix.';
  END IF;

  INSERT INTO _phase5_checks VALUES (
    'seed_product_available',
    true,
    'product_id=' || v_product.id
  );

  v_discount_code := 'PHASE5' || upper(substring(md5(random()::text) from 1 for 6));

  INSERT INTO public.discount_codes (
    code,
    type,
    value,
    min_purchase_amount,
    is_active,
    description
  ) VALUES (
    v_discount_code,
    'percentage'::public.discount_type,
    10,
    0,
    true,
    'Temporary code for phase5 runtime matrix test'
  );

  INSERT INTO _phase5_checks VALUES (
    'discount_code_created',
    true,
    v_discount_code
  );

  SELECT stock_quantity INTO v_stock_initial
  FROM public.products
  WHERE id = v_product.id;

  SELECT * INTO v_order_bank
  FROM public.create_product_order_atomic(
    p_user_id => NULL::uuid,
    p_customer_name => 'Phase5 Bank Transfer'::text,
    p_customer_phone => '0900000001'::text,
    p_shipping_street => '123 Test Street'::text,
    p_shipping_ward => 'Phuong 1'::text,
    p_shipping_district => 'Quan 1'::text,
    p_shipping_province => 'Ho Chi Minh'::text,
    p_notes => 'phase5 runtime matrix - bank transfer'::text,
    p_shipping_provider => 'ghtk'::text,
    p_shipping_fee => 15000::numeric,
    p_estimated_delivery_time => '2-3 days',
    p_status => 'pending'::public.order_status,
    p_payment_method => 'bank_transfer'::text,
    p_discount_code => NULL::text,
    p_checkout_idempotency_key => 'phase5-bank-' || substring(md5(random()::text) from 1 for 12),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_product.id, 'quantity', 1)
    )
  );

  INSERT INTO _phase5_checks VALUES (
    'order_bank_created',
    v_order_bank.id IS NOT NULL,
    COALESCE(v_order_bank.order_code, 'null')
  );

  INSERT INTO _phase5_checks VALUES (
    'order_bank_payment_method_bank_transfer',
    v_order_bank.payment_method = 'bank_transfer',
    COALESCE(v_order_bank.payment_method, 'null')
  );

  INSERT INTO _phase5_checks VALUES (
    'order_bank_shipping_provider_ghtk',
    lower(COALESCE(v_order_bank.shipping_provider, '')) = 'ghtk',
    COALESCE(v_order_bank.shipping_provider, 'null')
  );

  SELECT stock_quantity INTO v_stock_after_create
  FROM public.products
  WHERE id = v_product.id;

  INSERT INTO _phase5_checks VALUES (
    'stock_decrement_after_checkout',
    v_stock_after_create = v_stock_initial - 1,
    'initial=' || v_stock_initial || ', after_create=' || v_stock_after_create
  );

  PERFORM public.transition_order_status(v_order_bank.id, 'processing'::public.fulfillment_status, 'phase5 runtime matrix');
  PERFORM public.transition_order_status(v_order_bank.id, 'shipped'::public.fulfillment_status, 'phase5 runtime matrix');
  PERFORM public.transition_order_status(v_order_bank.id, 'completed'::public.fulfillment_status, 'phase5 runtime matrix');

  SELECT * INTO v_order_bank
  FROM public.product_orders
  WHERE id = v_order_bank.id;

  INSERT INTO _phase5_checks VALUES (
    'order_bank_completed_and_paid',
    v_order_bank.fulfillment_status = 'completed'::public.fulfillment_status
      AND v_order_bank.payment_status = 'paid'::public.payment_status,
    'fulfillment=' || v_order_bank.fulfillment_status || ', payment=' || v_order_bank.payment_status
  );

  BEGIN
    PERFORM public.transition_order_status(v_order_bank.id, 'pending'::public.fulfillment_status, 'phase5 invalid transition test');
  EXCEPTION
    WHEN OTHERS THEN
      v_invalid_transition_blocked := true;
  END;

  INSERT INTO _phase5_checks VALUES (
    'invalid_transition_blocked',
    v_invalid_transition_blocked,
    CASE WHEN v_invalid_transition_blocked THEN 'blocked' ELSE 'allowed unexpectedly' END
  );

  v_order_bank_total := ROUND(COALESCE(v_order_bank.grand_total, v_order_bank.total_price, 0), 2);
  v_partial_refund := GREATEST(1000, ROUND(v_order_bank_total * 0.25, 2));

  IF v_partial_refund >= v_order_bank_total THEN
    v_partial_refund := GREATEST(1000, ROUND(v_order_bank_total / 2, 2));
  END IF;

  PERFORM public.create_order_refund(
    p_order_id => v_order_bank.id,
    p_amount => v_partial_refund,
    p_reason => 'phase5 partial refund + restock',
    p_restock => true
  );

  SELECT stock_quantity INTO v_stock_after_restock
  FROM public.products
  WHERE id = v_product.id;

  INSERT INTO _phase5_checks VALUES (
    'restock_once_returns_stock',
    v_stock_after_restock = v_stock_initial,
    'initial=' || v_stock_initial || ', after_restock=' || v_stock_after_restock
  );

  BEGIN
    PERFORM public.create_order_refund(
      p_order_id => v_order_bank.id,
      p_amount => 1000,
      p_reason => 'phase5 second restock should fail',
      p_restock => true
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_second_restock_blocked := true;
  END;

  INSERT INTO _phase5_checks VALUES (
    'second_restock_blocked',
    v_second_restock_blocked,
    CASE WHEN v_second_restock_blocked THEN 'blocked' ELSE 'allowed unexpectedly' END
  );

  BEGIN
    PERFORM public.create_order_refund(
      p_order_id => v_order_bank.id,
      p_amount => v_order_bank_total,
      p_reason => 'phase5 over refund should fail',
      p_restock => false
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_over_refund_blocked := true;
  END;

  INSERT INTO _phase5_checks VALUES (
    'over_refund_blocked',
    v_over_refund_blocked,
    CASE WHEN v_over_refund_blocked THEN 'blocked' ELSE 'allowed unexpectedly' END
  );

  SELECT COUNT(*) INTO v_hist_count
  FROM public.order_status_history
  WHERE order_id = v_order_bank.id;

  SELECT COUNT(*) INTO v_payment_count
  FROM public.order_payments
  WHERE order_id = v_order_bank.id;

  SELECT COUNT(*) INTO v_refund_count
  FROM public.order_refunds
  WHERE order_id = v_order_bank.id;

  INSERT INTO _phase5_checks VALUES (
    'logs_recorded_for_bank_order',
    v_hist_count >= 3 AND v_payment_count >= 2 AND v_refund_count >= 1,
    'history=' || v_hist_count || ', payments=' || v_payment_count || ', refunds=' || v_refund_count
  );

  SELECT * INTO v_order_cod
  FROM public.create_product_order_atomic(
    p_user_id => NULL::uuid,
    p_customer_name => 'Phase5 COD'::text,
    p_customer_phone => '0900000002'::text,
    p_shipping_street => '456 Test Street'::text,
    p_shipping_ward => 'Phuong 2'::text,
    p_shipping_district => 'Quan 3'::text,
    p_shipping_province => 'Ho Chi Minh'::text,
    p_notes => 'phase5 runtime matrix - cod + discount'::text,
    p_shipping_provider => 'manual'::text,
    p_shipping_fee => 12000::numeric,
    p_estimated_delivery_time => '3-4 days',
    p_status => 'pending'::public.order_status,
    p_payment_method => 'cod'::text,
    p_discount_code => v_discount_code,
    p_checkout_idempotency_key => 'phase5-cod-' || substring(md5(random()::text) from 1 for 12),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_product.id, 'quantity', 1)
    )
  );

  INSERT INTO _phase5_checks VALUES (
    'order_cod_created',
    v_order_cod.id IS NOT NULL,
    COALESCE(v_order_cod.order_code, 'null')
  );

  INSERT INTO _phase5_checks VALUES (
    'order_cod_discount_applied',
    v_order_cod.discount_code = v_discount_code
      AND COALESCE(v_order_cod.discount_amount, 0) > 0,
    'code=' || COALESCE(v_order_cod.discount_code, 'null') || ', discount=' || COALESCE(v_order_cod.discount_amount, 0)
  );

  INSERT INTO _phase5_checks VALUES (
    'order_cod_manual_shipping',
    lower(COALESCE(v_order_cod.shipping_provider, '')) = 'manual',
    COALESCE(v_order_cod.shipping_provider, 'null')
  );

  INSERT INTO _phase5_checks VALUES (
    'order_cod_payment_method_cod',
    v_order_cod.payment_method = 'cod',
    COALESCE(v_order_cod.payment_method, 'null')
  );

  PERFORM public.transition_order_status(v_order_cod.id, 'processing'::public.fulfillment_status, 'phase5 cod flow');
  PERFORM public.transition_order_status(v_order_cod.id, 'shipped'::public.fulfillment_status, 'phase5 cod flow');
  PERFORM public.transition_order_status(v_order_cod.id, 'completed'::public.fulfillment_status, 'phase5 cod flow');

  SELECT * INTO v_order_cod
  FROM public.product_orders
  WHERE id = v_order_cod.id;

  v_order_cod_total := ROUND(COALESCE(v_order_cod.grand_total, v_order_cod.total_price, 0), 2);

  SELECT * INTO v_order_cod
  FROM public.create_order_refund(
    p_order_id => v_order_cod.id,
    p_amount => v_order_cod_total,
    p_reason => 'phase5 cod full refund',
    p_restock => false
  );

  INSERT INTO _phase5_checks VALUES (
    'order_cod_full_refund_sets_refunded',
    v_order_cod.payment_status = 'refunded'::public.payment_status
      AND v_order_cod.status = 'refunded'::public.order_status,
    'payment=' || v_order_cod.payment_status || ', status=' || v_order_cod.status
  );

  SELECT * INTO v_order_cancel
  FROM public.create_product_order_atomic(
    p_user_id => NULL::uuid,
    p_customer_name => 'Phase5 Cancel'::text,
    p_customer_phone => '0900000003'::text,
    p_shipping_street => '789 Test Street'::text,
    p_shipping_ward => 'Phuong 3'::text,
    p_shipping_district => 'Quan 5'::text,
    p_shipping_province => 'Ho Chi Minh'::text,
    p_notes => 'phase5 runtime matrix - cancel path'::text,
    p_shipping_provider => 'ghtk'::text,
    p_shipping_fee => 10000::numeric,
    p_estimated_delivery_time => '2 days'::text,
    p_status => 'pending'::public.order_status,
    p_payment_method => 'bank_transfer'::text,
    p_discount_code => NULL::text,
    p_checkout_idempotency_key => 'phase5-cancel-' || substring(md5(random()::text) from 1 for 12),
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_product.id, 'quantity', 1)
    )
  );

  PERFORM public.transition_order_status(v_order_cancel.id, 'cancelled'::public.fulfillment_status, 'phase5 cancel path');

  SELECT * INTO v_order_cancel
  FROM public.product_orders
  WHERE id = v_order_cancel.id;

  INSERT INTO _phase5_checks VALUES (
    'cancel_path_supported',
    v_order_cancel.fulfillment_status = 'cancelled'::public.fulfillment_status
      AND v_order_cancel.payment_status = 'failed'::public.payment_status,
    'fulfillment=' || v_order_cancel.fulfillment_status || ', payment=' || v_order_cancel.payment_status
  );
END;
$$;

SELECT
  BOOL_AND(passed) AS all_passed,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'check', check_name,
      'passed', passed,
      'details', details
    )
    ORDER BY check_name
  ) AS checks
FROM _phase5_checks;

ROLLBACK;
`;

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Supabase Management API error ${response.status}`);
  console.error(text);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(text);
} catch (err) {
  console.error('Failed to parse JSON response:', text);
  process.exit(1);
}

if (!Array.isArray(payload) || payload.length === 0) {
  console.error('Unexpected response payload:', payload);
  process.exit(1);
}

const row = payload[0] || {};
const allPassed = row.all_passed === true || row.all_passed === 't';
const checks = Array.isArray(row.checks) ? row.checks : [];

const result = {
  project_ref: projectRef,
  all_passed: Boolean(allPassed),
  checks,
  generated_at: new Date().toISOString(),
};

if (outPath) {
  const fs = await import('node:fs');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
}

console.log('PHASE5_RUNTIME_MATRIX');
console.log(`project_ref: ${projectRef}`);
console.log(`all_passed: ${result.all_passed}`);
for (const check of checks) {
  const marker = check.passed ? 'PASS' : 'FAIL';
  console.log(`- [${marker}] ${check.check}: ${check.details ?? ''}`);
}

if (!result.all_passed) {
  process.exit(1);
}
