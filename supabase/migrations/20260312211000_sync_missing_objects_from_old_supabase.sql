-- Sync missing DB objects from old Supabase project (vwzgibsdtednpitbrdeb)
-- to new project (vjowphilfeoqesvcfqnb).
-- Scope: app-critical objects + migration schema parity.

BEGIN;

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);

CREATE TABLE IF NOT EXISTS supabase_migrations.seed_files (
  path text PRIMARY KEY,
  hash text NOT NULL
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vat_rate numeric;

UPDATE public.products
SET vat_rate = 0.10
WHERE vat_rate IS NULL;

ALTER TABLE public.products
  ALTER COLUMN vat_rate SET DEFAULT 0.10,
  ALTER COLUMN vat_rate SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'products'
      AND con.conname = 'products_vat_rate_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_vat_rate_check
      CHECK (vat_rate >= 0::numeric AND vat_rate <= 1::numeric);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_unique_product_path
ON public.product_images USING btree (product_id, image_path);

DROP FUNCTION IF EXISTS public.quote_product_order_totals(numeric, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.quote_product_order_totals(
  p_subtotal numeric,
  p_discount_amount numeric DEFAULT 0,
  p_shipping_fee numeric DEFAULT 0,
  p_shipping_province text DEFAULT NULL::text,
  p_items jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(
  tax_profile_id uuid,
  tax_mode tax_mode,
  tax_rate numeric,
  currency text,
  subtotal numeric,
  discount_amount numeric,
  taxable_amount numeric,
  tax_amount numeric,
  shipping_net_amount numeric,
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
  v_rate numeric := 0;
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
    v_rate := COALESCE(v_profile.default_rate, 0);
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
    ORDER BY
      CASE
        WHEN tr.province IS NOT NULL AND tr.province = p_shipping_province THEN 0
        ELSE 1
      END,
      tr.priority DESC,
      tr.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_rate := COALESCE(v_rate_row.rate, v_rate);
      v_shipping_taxable := COALESCE(v_rate_row.applies_to_shipping, v_shipping_taxable);
      v_currency := COALESCE(NULLIF(v_rate_row.currency, ''), v_currency);
    END IF;
  END IF;

  v_rate := GREATEST(v_rate, 0);

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
        COALESCE(p.vat_rate, v_rate) AS line_rate
      FROM requested r
      JOIN public.products p ON p.id = r.product_id
      WHERE r.quantity > 0
    )
    SELECT
      COALESCE(SUM(line_subtotal), 0),
      CASE
        WHEN COALESCE(SUM(line_subtotal), 0) > 0
          THEN COALESCE(SUM(line_subtotal * line_rate), 0) / SUM(line_subtotal)
        ELSE v_rate
      END
    INTO v_items_subtotal, v_weighted_rate
    FROM lines;

    IF v_items_subtotal IS NOT NULL AND v_items_subtotal > 0 THEN
      v_subtotal := ROUND(v_items_subtotal, 2);
    END IF;

    IF v_weighted_rate IS NOT NULL THEN
      v_rate := GREATEST(v_weighted_rate, 0);
    END IF;
  END IF;

  v_discount := LEAST(v_discount, v_subtotal);
  v_after_discount := v_subtotal - v_discount;

  IF v_mode = 'inclusive'::public.tax_mode AND v_rate > 0 THEN
    v_taxable_amount := ROUND(v_after_discount / (1 + v_rate), 2);
    v_tax_amount := ROUND(v_after_discount - v_taxable_amount, 2);

    IF v_shipping_taxable THEN
      v_shipping_net := ROUND(v_shipping_fee / (1 + v_rate), 2);
      v_shipping_tax := ROUND(v_shipping_fee - v_shipping_net, 2);
    ELSE
      v_shipping_net := ROUND(v_shipping_fee, 2);
      v_shipping_tax := 0;
    END IF;

    v_grand_total := ROUND(v_after_discount + v_shipping_fee, 2);
  ELSE
    v_taxable_amount := ROUND(v_after_discount, 2);
    v_tax_amount := ROUND(v_taxable_amount * v_rate, 2);

    v_shipping_net := ROUND(v_shipping_fee, 2);
    IF v_shipping_taxable THEN
      v_shipping_tax := ROUND(v_shipping_net * v_rate, 2);
    ELSE
      v_shipping_tax := 0;
    END IF;

    v_grand_total := ROUND(v_taxable_amount + v_shipping_net + v_tax_amount + v_shipping_tax, 2);
  END IF;

  RETURN QUERY
  SELECT
    v_profile.id,
    v_mode,
    ROUND(v_rate, 6),
    v_currency,
    ROUND(v_subtotal, 2),
    ROUND(v_discount, 2),
    v_taxable_amount,
    v_tax_amount,
    v_shipping_net,
    v_shipping_tax,
    ROUND(v_shipping_fee, 2),
    v_grand_total;
END;
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
  v_default_rate numeric := 0;
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

  v_default_rate := GREATEST(COALESCE(v_order.tax_rate, 0), 0);

  SELECT
    COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0),
    CASE
      WHEN COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) > 0 THEN
        COALESCE(SUM((oi.price_at_purchase * oi.quantity) * COALESCE(p.vat_rate, v_default_rate)), 0)
        / SUM(oi.price_at_purchase * oi.quantity)
      ELSE
        v_default_rate
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
  v_shipping_taxable := COALESCE(v_order.shipping_tax_amount, 0) > 0;

  IF COALESCE(v_order.tax_mode, 'exclusive'::public.tax_mode) = 'inclusive'::public.tax_mode
     AND v_effective_rate > 0 THEN
    v_taxable_amount := ROUND(v_after_discount / (1 + v_effective_rate), 2);
    v_tax_amount := ROUND(v_after_discount - v_taxable_amount, 2);
    IF v_shipping_taxable THEN
      v_shipping_net := ROUND(v_shipping_fee / (1 + v_effective_rate), 2);
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
    IF v_shipping_taxable THEN
      v_shipping_tax := ROUND(v_shipping_net * v_effective_rate, 2);
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
    shipping_tax_amount = v_shipping_tax,
    grand_total = v_grand_total,
    total_price = v_grand_total
  WHERE id = p_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_brand_order_code_prefix()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code :=
      'DRHAPPYPI' ||
      UPPER(SUBSTRING(REPLACE(COALESCE(NEW.id::text, gen_random_uuid()::text), '-', '') FROM 1 FOR 6));
  ELSE
    NEW.order_code := regexp_replace(NEW.order_code, '^ISKIN', 'DRHAPPYPI');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_recalculate_order_vat_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NOT NULL THEN
    PERFORM public.recalculate_order_vat_snapshot(v_order_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Note: source project has 5 legacy functions in schema storage.
-- They are intentionally excluded here because this role cannot CREATE in schema storage
-- on hosted Supabase (managed by supabase_admin).

DROP TRIGGER IF EXISTS recalculate_order_vat_snapshot_on_items ON public.product_order_items;
CREATE TRIGGER recalculate_order_vat_snapshot_on_items
AFTER INSERT OR DELETE OR UPDATE ON public.product_order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_recalculate_order_vat_snapshot();

DROP TRIGGER IF EXISTS brand_order_code_prefix_on_product_orders ON public.product_orders;
CREATE TRIGGER brand_order_code_prefix_on_product_orders
BEFORE INSERT OR UPDATE OF order_code ON public.product_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_brand_order_code_prefix();

GRANT EXECUTE ON FUNCTION public.quote_product_order_totals(
  numeric,
  numeric,
  numeric,
  text,
  jsonb
) TO anon, authenticated;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id FROM public.product_orders LOOP
    PERFORM public.recalculate_order_vat_snapshot(rec.id);
  END LOOP;
END
$$;

COMMIT;
