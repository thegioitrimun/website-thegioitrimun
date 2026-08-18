-- Tax hardening:
-- 1) Persist shipping_tax_rate separately from product tax_rate.
-- 2) Keep district-aware quote RPC correct for both item VAT and shipping VAT.
-- 3) Recalculate order snapshots using shipping_tax_rate instead of product tax_rate.

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS shipping_tax_rate numeric(7,6) NOT NULL DEFAULT 0;

UPDATE public.product_orders
SET shipping_tax_rate = CASE
  WHEN COALESCE(shipping_tax_amount, 0) > 0 THEN ROUND(COALESCE(tax_rate, 0), 6)
  ELSE ROUND(COALESCE(shipping_tax_rate, 0), 6)
END
WHERE shipping_tax_rate = 0;

DROP FUNCTION IF EXISTS public.quote_product_order_totals(
  numeric,
  numeric,
  numeric,
  text,
  text,
  jsonb
);

DROP FUNCTION IF EXISTS public.quote_product_order_totals(
  numeric,
  numeric,
  numeric,
  text,
  jsonb
);

CREATE OR REPLACE FUNCTION public.quote_product_order_totals(
  p_subtotal numeric,
  p_discount_amount numeric,
  p_shipping_fee numeric,
  p_shipping_province text,
  p_shipping_district text,
  p_items jsonb
)
RETURNS TABLE (
  tax_profile_id uuid,
  tax_mode public.tax_mode,
  tax_rate numeric,
  currency text,
  subtotal numeric,
  discount_amount numeric,
  taxable_amount numeric,
  tax_amount numeric,
  shipping_net_amount numeric,
  shipping_tax_rate numeric,
  shipping_tax_amount numeric,
  shipping_fee numeric,
  grand_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamp with time zone := now();
  v_profile public.tax_profiles%ROWTYPE;
  v_rate_row record;
  v_mode public.tax_mode := 'exclusive'::public.tax_mode;
  v_product_rate numeric := 0;
  v_shipping_rate numeric := 0;
  v_currency text := 'VND';
  v_shipping_taxable boolean := false;
  v_subtotal numeric := GREATEST(COALESCE(p_subtotal, 0), 0);
  v_discount numeric := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_shipping_fee numeric := GREATEST(COALESCE(p_shipping_fee, 0), 0);
  v_after_discount numeric := 0;
  v_taxable_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_shipping_net numeric := 0;
  v_shipping_tax numeric := 0;
  v_grand_total numeric := 0;
  v_items_subtotal numeric := NULL;
  v_weighted_rate numeric := NULL;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.tax_profiles tp
  WHERE tp.is_active = true
    AND (tp.starts_at IS NULL OR v_now >= tp.starts_at)
    AND (tp.ends_at IS NULL OR v_now <= tp.ends_at)
  ORDER BY tp.is_default DESC, tp.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    v_mode := v_profile.tax_mode;
    v_product_rate := COALESCE(v_profile.default_rate, 0);
    v_shipping_rate := v_product_rate;
    v_currency := COALESCE(NULLIF(v_profile.currency, ''), 'VND');
    v_shipping_taxable := COALESCE(v_profile.applies_to_shipping, false);

    SELECT
      tr.rate,
      tr.applies_to_shipping,
      tr.currency
    INTO v_rate_row
    FROM public.tax_rates tr
    WHERE tr.tax_profile_id = v_profile.id
      AND tr.is_active = true
      AND (tr.starts_at IS NULL OR v_now >= tr.starts_at)
      AND (tr.ends_at IS NULL OR v_now <= tr.ends_at)
      AND (tr.province IS NULL OR tr.province = p_shipping_province)
      AND (tr.district IS NULL OR tr.district = p_shipping_district)
    ORDER BY
      CASE
        WHEN tr.province IS NOT NULL AND tr.province = p_shipping_province
          AND tr.district IS NOT NULL AND tr.district = p_shipping_district THEN 0
        WHEN tr.province IS NOT NULL AND tr.province = p_shipping_province
          AND tr.district IS NULL THEN 1
        WHEN tr.province IS NULL AND tr.district IS NULL THEN 2
        ELSE 3
      END,
      tr.priority DESC,
      tr.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_product_rate := COALESCE(v_rate_row.rate, v_product_rate);
      v_shipping_rate := COALESCE(v_rate_row.rate, v_shipping_rate);
      v_shipping_taxable := COALESCE(v_rate_row.applies_to_shipping, v_shipping_taxable);
      v_currency := COALESCE(NULLIF(v_rate_row.currency, ''), v_currency);
    END IF;
  END IF;

  v_product_rate := GREATEST(v_product_rate, 0);
  v_shipping_rate := GREATEST(v_shipping_rate, 0);

  IF p_items IS NOT NULL
     AND jsonb_typeof(p_items) = 'array'
     AND jsonb_array_length(p_items) > 0 THEN
    WITH requested AS (
      SELECT
        (item->>'product_id')::integer AS product_id,
        SUM((item->>'quantity')::numeric) AS quantity
      FROM jsonb_array_elements(p_items) AS item
      GROUP BY (item->>'product_id')::integer
    ),
    lines AS (
      SELECT
        p.id,
        p.price,
        r.quantity,
        (p.price * r.quantity) AS line_subtotal,
        COALESCE(p.vat_rate, v_product_rate) AS line_rate
      FROM requested r
      JOIN public.products p ON p.id = r.product_id
      WHERE r.quantity > 0
    )
    SELECT
      COALESCE(SUM(line_subtotal), 0),
      CASE
        WHEN COALESCE(SUM(line_subtotal), 0) > 0
          THEN COALESCE(SUM(line_subtotal * line_rate), 0) / SUM(line_subtotal)
        ELSE v_product_rate
      END
    INTO v_items_subtotal, v_weighted_rate
    FROM lines;

    IF v_items_subtotal IS NOT NULL AND v_items_subtotal > 0 THEN
      v_subtotal := ROUND(v_items_subtotal, 2);
    END IF;

    IF v_weighted_rate IS NOT NULL THEN
      v_product_rate := GREATEST(v_weighted_rate, 0);
    END IF;
  END IF;

  v_discount := LEAST(v_discount, v_subtotal);
  v_after_discount := v_subtotal - v_discount;

  IF v_mode = 'inclusive'::public.tax_mode AND v_product_rate > 0 THEN
    v_taxable_amount := ROUND(v_after_discount / (1 + v_product_rate), 2);
    v_tax_amount := ROUND(v_after_discount - v_taxable_amount, 2);

    IF v_shipping_taxable AND v_shipping_rate > 0 THEN
      v_shipping_net := ROUND(v_shipping_fee / (1 + v_shipping_rate), 2);
      v_shipping_tax := ROUND(v_shipping_fee - v_shipping_net, 2);
    ELSE
      v_shipping_net := ROUND(v_shipping_fee, 2);
      v_shipping_tax := 0;
    END IF;

    v_grand_total := ROUND(v_after_discount + v_shipping_fee, 2);
  ELSE
    v_taxable_amount := ROUND(v_after_discount, 2);
    v_tax_amount := ROUND(v_taxable_amount * v_product_rate, 2);

    v_shipping_net := ROUND(v_shipping_fee, 2);
    IF v_shipping_taxable AND v_shipping_rate > 0 THEN
      v_shipping_tax := ROUND(v_shipping_net * v_shipping_rate, 2);
    ELSE
      v_shipping_tax := 0;
    END IF;

    v_grand_total := ROUND(v_taxable_amount + v_shipping_net + v_tax_amount + v_shipping_tax, 2);
  END IF;

  RETURN QUERY
  SELECT
    v_profile.id,
    v_mode,
    ROUND(v_product_rate, 6),
    v_currency,
    ROUND(v_subtotal, 2),
    ROUND(v_discount, 2),
    v_taxable_amount,
    v_tax_amount,
    v_shipping_net,
    CASE WHEN v_shipping_taxable THEN ROUND(v_shipping_rate, 6) ELSE 0 END,
    v_shipping_tax,
    ROUND(v_shipping_fee, 2),
    v_grand_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.quote_product_order_totals(
  p_subtotal numeric,
  p_discount_amount numeric DEFAULT 0,
  p_shipping_fee numeric DEFAULT 0,
  p_shipping_province text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS TABLE (
  tax_profile_id uuid,
  tax_mode public.tax_mode,
  tax_rate numeric,
  currency text,
  subtotal numeric,
  discount_amount numeric,
  taxable_amount numeric,
  tax_amount numeric,
  shipping_net_amount numeric,
  shipping_tax_rate numeric,
  shipping_tax_amount numeric,
  shipping_fee numeric,
  grand_total numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.quote_product_order_totals(
    p_subtotal,
    p_discount_amount,
    p_shipping_fee,
    p_shipping_province,
    NULL,
    p_items
  );
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_order_vat_snapshot(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.product_orders%ROWTYPE;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_after_discount numeric := 0;
  v_shipping_fee numeric := 0;
  v_shipping_net numeric := 0;
  v_shipping_tax numeric := 0;
  v_shipping_taxable boolean := false;
  v_default_product_rate numeric := 0;
  v_shipping_rate numeric := 0;
  v_effective_rate numeric := 0;
  v_taxable_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_grand_total numeric := 0;
BEGIN
  SELECT *
  INTO v_order
  FROM public.product_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_default_product_rate := GREATEST(COALESCE(v_order.tax_rate, 0), 0);
  v_shipping_rate := GREATEST(COALESCE(v_order.shipping_tax_rate, v_order.tax_rate, 0), 0);

  SELECT
    COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0),
    CASE
      WHEN COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) > 0 THEN
        COALESCE(SUM((oi.price_at_purchase * oi.quantity) * COALESCE(p.vat_rate, v_default_product_rate)), 0)
        / SUM(oi.price_at_purchase * oi.quantity)
      ELSE
        v_default_product_rate
    END
  INTO v_subtotal, v_effective_rate
  FROM public.product_order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  v_subtotal := ROUND(COALESCE(v_subtotal, 0), 2);
  v_effective_rate := ROUND(GREATEST(COALESCE(v_effective_rate, 0), 0), 6);

  v_discount := LEAST(GREATEST(COALESCE(v_order.discount_amount, 0), 0), v_subtotal);
  v_after_discount := ROUND(v_subtotal - v_discount, 2);

  v_shipping_fee := ROUND(COALESCE(v_order.shipping_fee, 0), 2);
  v_shipping_taxable := COALESCE(v_order.shipping_tax_amount, 0) > 0 OR COALESCE(v_order.shipping_tax_rate, 0) > 0;

  IF COALESCE(v_order.tax_mode, 'exclusive'::public.tax_mode) = 'inclusive'::public.tax_mode
     AND v_effective_rate > 0 THEN
    v_taxable_amount := ROUND(v_after_discount / (1 + v_effective_rate), 2);
    v_tax_amount := ROUND(v_after_discount - v_taxable_amount, 2);
    IF v_shipping_taxable AND v_shipping_rate > 0 THEN
      v_shipping_net := ROUND(v_shipping_fee / (1 + v_shipping_rate), 2);
      v_shipping_tax := ROUND(v_shipping_fee - v_shipping_net, 2);
    ELSE
      v_shipping_net := v_shipping_fee;
      v_shipping_tax := 0;
    END IF;
    v_grand_total := ROUND(v_after_discount + v_shipping_fee, 2);
  ELSE
    v_taxable_amount := v_after_discount;
    v_tax_amount := ROUND(v_taxable_amount * v_effective_rate, 2);
    v_shipping_net := v_shipping_fee;
    IF v_shipping_taxable AND v_shipping_rate > 0 THEN
      v_shipping_tax := ROUND(v_shipping_net * v_shipping_rate, 2);
    ELSE
      v_shipping_tax := 0;
    END IF;
    v_grand_total := ROUND(v_taxable_amount + v_shipping_net + v_tax_amount + v_shipping_tax, 2);
  END IF;

  UPDATE public.product_orders
  SET
    subtotal_price = v_subtotal,
    discount_amount = ROUND(v_discount, 2),
    tax_rate = v_effective_rate,
    taxable_amount = v_taxable_amount,
    tax_amount = v_tax_amount,
    shipping_net_amount = v_shipping_net,
    shipping_tax_rate = CASE WHEN v_shipping_taxable THEN ROUND(v_shipping_rate, 6) ELSE 0 END,
    shipping_tax_amount = v_shipping_tax,
    grand_total = v_grand_total,
    total_price = v_grand_total
  WHERE id = p_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_product_order_atomic(
  p_user_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_street text,
  p_shipping_ward text,
  p_shipping_district text,
  p_shipping_province text,
  p_notes text DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_estimated_delivery_time text DEFAULT NULL,
  p_status public.order_status DEFAULT 'pending',
  p_payment_method text DEFAULT NULL,
  p_discount_code text DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.product_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.product_orders;
  v_quote record;
  v_items jsonb := '[]'::jsonb;
  v_payment_method text := lower(coalesce(nullif(btrim(p_payment_method), ''), ''));
BEGIN
  SELECT *
  INTO v_order
  FROM public.create_product_order_atomic(
    p_user_id,
    p_customer_name,
    p_customer_phone,
    p_shipping_street,
    p_shipping_ward,
    p_shipping_district,
    p_shipping_province,
    p_notes,
    p_shipping_provider,
    p_shipping_fee,
    p_estimated_delivery_time,
    p_status,
    p_discount_code,
    p_checkout_idempotency_key,
    p_items
  );

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Could not create order.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'quantity', oi.quantity
      )
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.product_order_items oi
  WHERE oi.order_id = v_order.id;

  SELECT *
  INTO v_quote
  FROM public.quote_product_order_totals(
    COALESCE(v_order.subtotal_price, 0),
    COALESCE(v_order.discount_amount, 0),
    COALESCE(v_order.shipping_fee, 0),
    v_order.shipping_province,
    v_order.shipping_district,
    v_items
  );

  UPDATE public.product_orders
  SET
    total_price = ROUND(COALESCE(v_quote.grand_total, v_order.total_price, 0), 2),
    shipping_fee = ROUND(COALESCE(v_quote.shipping_fee, v_order.shipping_fee, 0), 2),
    shipping_net_amount = ROUND(COALESCE(v_quote.shipping_net_amount, v_order.shipping_net_amount, 0), 2),
    shipping_tax_rate = ROUND(COALESCE(v_quote.shipping_tax_rate, v_order.shipping_tax_rate, 0), 6),
    shipping_tax_amount = ROUND(COALESCE(v_quote.shipping_tax_amount, v_order.shipping_tax_amount, 0), 2),
    tax_profile_id = COALESCE(v_quote.tax_profile_id, v_order.tax_profile_id),
    tax_mode = COALESCE(v_quote.tax_mode, v_order.tax_mode, 'exclusive'::public.tax_mode),
    tax_rate = ROUND(COALESCE(v_quote.tax_rate, v_order.tax_rate, 0), 6),
    taxable_amount = ROUND(COALESCE(v_quote.taxable_amount, v_order.taxable_amount, 0), 2),
    tax_amount = ROUND(COALESCE(v_quote.tax_amount, v_order.tax_amount, 0), 2),
    currency = COALESCE(NULLIF(v_quote.currency, ''), v_order.currency, 'VND'),
    grand_total = ROUND(COALESCE(v_quote.grand_total, v_order.grand_total, v_order.total_price, 0), 2),
    payment_method = CASE
      WHEN v_payment_method IN ('cod', 'bank_transfer') THEN v_payment_method
      ELSE payment_method
    END
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$function$;
