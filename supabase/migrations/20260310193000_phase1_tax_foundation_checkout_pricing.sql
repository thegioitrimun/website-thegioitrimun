-- Migration: phase1_tax_foundation_checkout_pricing
-- Description:
-- 1) Adds tax profile/rate tables.
-- 2) Adds tax snapshot columns on product_orders.
-- 3) Adds server-side pricing quote RPC.
-- 4) Updates atomic checkout RPC to persist tax snapshot and grand total.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_mode') THEN
    CREATE TYPE public.tax_mode AS ENUM ('exclusive', 'inclusive');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.tax_profiles (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tax_mode public.tax_mode NOT NULL DEFAULT 'exclusive',
  default_rate numeric(7,6) NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  applies_to_shipping boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'VND',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_tax_profiles_updated_at ON public.tax_profiles;
CREATE TRIGGER update_tax_profiles_updated_at
BEFORE UPDATE ON public.tax_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tax_profile_id uuid NOT NULL REFERENCES public.tax_profiles(id) ON DELETE CASCADE,
  province text,
  district text,
  rate numeric(7,6) NOT NULL CHECK (rate >= 0),
  applies_to_shipping boolean,
  currency text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_tax_rates_updated_at ON public.tax_rates;
CREATE TRIGGER update_tax_rates_updated_at
BEFORE UPDATE ON public.tax_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS tax_rates_tax_profile_id_idx ON public.tax_rates(tax_profile_id);
CREATE INDEX IF NOT EXISTS tax_rates_province_district_idx ON public.tax_rates(province, district);
CREATE INDEX IF NOT EXISTS tax_profiles_is_default_idx ON public.tax_profiles(is_default) WHERE is_default = true;

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS tax_profile_id uuid REFERENCES public.tax_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_mode public.tax_mode,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_net_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS grand_total numeric(12,2) NOT NULL DEFAULT 0;

INSERT INTO public.tax_profiles (
  code,
  name,
  tax_mode,
  default_rate,
  applies_to_shipping,
  currency,
  is_active,
  is_default
)
VALUES (
  'VAT_STANDARD',
  'VAT tiêu chuẩn',
  'exclusive',
  0.10,
  false,
  'VND',
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

UPDATE public.product_orders
SET
  tax_mode = COALESCE(tax_mode, 'exclusive'::public.tax_mode),
  tax_rate = COALESCE(tax_rate, 0),
  taxable_amount = GREATEST(COALESCE(subtotal_price, 0) - COALESCE(discount_amount, 0), 0),
  tax_amount = COALESCE(tax_amount, 0),
  shipping_net_amount = COALESCE(shipping_net_amount, COALESCE(shipping_fee, 0)),
  shipping_tax_amount = COALESCE(shipping_tax_amount, 0),
  currency = COALESCE(NULLIF(currency, ''), 'VND'),
  grand_total = COALESCE(NULLIF(grand_total, 0), COALESCE(total_price, 0));

UPDATE public.product_orders po
SET tax_profile_id = tp.id
FROM (
  SELECT id
  FROM public.tax_profiles
  WHERE is_active = true
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1
) AS tp
WHERE po.tax_profile_id IS NULL;

ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active tax profiles" ON public.tax_profiles;
CREATE POLICY "Public can view active tax profiles"
  ON public.tax_profiles
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage tax profiles" ON public.tax_profiles;
CREATE POLICY "Admins can manage tax profiles"
  ON public.tax_profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view active tax rates" ON public.tax_rates;
CREATE POLICY "Public can view active tax rates"
  ON public.tax_rates
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage tax rates" ON public.tax_rates;
CREATE POLICY "Admins can manage tax rates"
  ON public.tax_rates
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DO $$
BEGIN
  EXECUTE $fn_quote$
    CREATE OR REPLACE FUNCTION public.quote_product_order_totals(
      p_subtotal numeric,
      p_discount_amount numeric DEFAULT 0,
      p_shipping_fee numeric DEFAULT 0,
      p_shipping_province text DEFAULT NULL
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
      shipping_tax_amount numeric,
      shipping_fee numeric,
      grand_total numeric
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $quote$
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
        v_rate,
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
    $quote$;
  $fn_quote$;

  EXECUTE $fn_create$
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
      p_discount_code text DEFAULT NULL,
      p_checkout_idempotency_key text DEFAULT NULL,
      p_items jsonb DEFAULT '[]'::jsonb
    )
    RETURNS public.product_orders
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $create_order$
    DECLARE
      v_auth_uid uuid := auth.uid();
      v_effective_user_id uuid := COALESCE(p_user_id, auth.uid());
      v_now timestamp with time zone := now();
      v_order_id uuid := extensions.uuid_generate_v4();
      v_order_code text := 'ISKIN' || upper(substring(replace(v_order_id::text, '-', '') from 1 for 8));
      v_subtotal numeric := 0;
      v_discount_amount numeric := 0;
      v_shipping_fee numeric := COALESCE(p_shipping_fee, 0);
      v_final_total numeric := 0;
      v_expected_count integer := 0;
      v_found_count integer := 0;
      v_user_usage_count integer := 0;
      v_idempotency_key text := NULLIF(btrim(p_checkout_idempotency_key), '');
      v_discount public.discount_codes%ROWTYPE;
      v_inserted_order public.product_orders%ROWTYPE;
      v_existing_order public.product_orders%ROWTYPE;
      v_quote record;
      rec record;
    BEGIN
      IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Giỏ hàng trống.';
      END IF;

      IF p_user_id IS NOT NULL AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
        RAISE EXCEPTION 'Không thể tạo đơn hàng cho tài khoản khác.';
      END IF;

      IF v_idempotency_key IS NOT NULL THEN
        SELECT *
        INTO v_existing_order
        FROM public.product_orders
        WHERE checkout_idempotency_key = v_idempotency_key
          AND (
            (v_effective_user_id IS NULL AND user_id IS NULL)
            OR user_id = v_effective_user_id
          )
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
          RETURN v_existing_order;
        END IF;
      END IF;

      SELECT COUNT(*)
      INTO v_expected_count
      FROM (
        SELECT (item->>'product_id')::integer AS product_id
        FROM jsonb_array_elements(p_items) AS item
        GROUP BY (item->>'product_id')::integer
      ) requested;

      FOR rec IN
        WITH requested AS (
          SELECT
            (item->>'product_id')::integer AS product_id,
            SUM((item->>'quantity')::integer)::integer AS quantity
          FROM jsonb_array_elements(p_items) AS item
          GROUP BY (item->>'product_id')::integer
        )
        SELECT
          r.product_id,
          r.quantity,
          p.name,
          p.price,
          p.stock_quantity,
          p.is_published
        FROM requested r
        JOIN public.products p ON p.id = r.product_id
        FOR UPDATE OF p
      LOOP
        v_found_count := v_found_count + 1;

        IF rec.quantity IS NULL OR rec.quantity <= 0 THEN
          RAISE EXCEPTION 'Số lượng sản phẩm không hợp lệ.';
        END IF;

        IF rec.is_published IS DISTINCT FROM true THEN
          RAISE EXCEPTION 'Sản phẩm "%" hiện không thể đặt hàng.', rec.name;
        END IF;

        IF rec.stock_quantity < rec.quantity THEN
          RAISE EXCEPTION 'Sản phẩm "%" chỉ còn % sản phẩm.', rec.name, rec.stock_quantity;
        END IF;

        v_subtotal := v_subtotal + (rec.price * rec.quantity);
      END LOOP;

      IF v_found_count <> v_expected_count THEN
        RAISE EXCEPTION 'Một hoặc nhiều sản phẩm không tồn tại.';
      END IF;

      IF p_discount_code IS NOT NULL AND btrim(p_discount_code) <> '' THEN
        SELECT *
        INTO v_discount
        FROM public.discount_codes
        WHERE code = upper(btrim(p_discount_code))
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
        END IF;

        IF NOT v_discount.is_active THEN
          RAISE EXCEPTION 'Mã giảm giá đã bị vô hiệu hóa.';
        END IF;

        IF v_discount.starts_at IS NOT NULL AND v_now < v_discount.starts_at THEN
          RAISE EXCEPTION 'Mã giảm giá chưa đến thời gian sử dụng.';
        END IF;

        IF v_discount.ends_at IS NOT NULL AND v_now > v_discount.ends_at THEN
          RAISE EXCEPTION 'Mã giảm giá đã hết hạn.';
        END IF;

        IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
          RAISE EXCEPTION 'Mã giảm giá đã hết lượt sử dụng.';
        END IF;

        IF COALESCE(v_discount.min_purchase_amount, 0) > v_subtotal THEN
          RAISE EXCEPTION 'Mã này yêu cầu đơn hàng tối thiểu %.', to_char(v_discount.min_purchase_amount, 'FM999G999G999D00');
        END IF;

        IF v_effective_user_id IS NOT NULL AND v_discount.usage_limit_per_user IS NOT NULL THEN
          SELECT COUNT(*)
          INTO v_user_usage_count
          FROM public.discount_code_usages
          WHERE discount_code_id = v_discount.id
            AND user_id = v_effective_user_id;

          IF v_user_usage_count >= v_discount.usage_limit_per_user THEN
            RAISE EXCEPTION 'Bạn đã dùng hết lượt cho mã giảm giá này.';
          END IF;
        END IF;

        IF v_discount.type = 'percentage'::public.discount_type THEN
          v_discount_amount := v_subtotal * (v_discount.value / 100);
        ELSE
          v_discount_amount := v_discount.value;
        END IF;

        IF v_discount.max_discount_amount IS NOT NULL THEN
          v_discount_amount := LEAST(v_discount_amount, v_discount.max_discount_amount);
        END IF;

        v_discount_amount := LEAST(v_discount_amount, v_subtotal);
      END IF;

      SELECT *
      INTO v_quote
      FROM public.quote_product_order_totals(
        v_subtotal,
        v_discount_amount,
        v_shipping_fee,
        p_shipping_province
      );

      v_final_total := COALESCE(v_quote.grand_total, 0);

      BEGIN
        INSERT INTO public.product_orders (
          id,
          user_id,
          order_code,
          subtotal_price,
          discount_code,
          discount_amount,
          total_price,
          status,
          customer_name,
          customer_phone,
          shipping_street,
          shipping_ward,
          shipping_district,
          shipping_province,
          notes,
          shipping_provider,
          shipping_fee,
          shipping_net_amount,
          shipping_tax_amount,
          tax_profile_id,
          tax_mode,
          tax_rate,
          taxable_amount,
          tax_amount,
          currency,
          grand_total,
          estimated_delivery_time,
          checkout_idempotency_key
        ) VALUES (
          v_order_id,
          v_effective_user_id,
          v_order_code,
          ROUND(v_subtotal, 2),
          CASE WHEN p_discount_code IS NULL OR btrim(p_discount_code) = '' THEN NULL ELSE upper(btrim(p_discount_code)) END,
          ROUND(v_discount_amount, 2),
          ROUND(v_final_total, 2),
          p_status,
          p_customer_name,
          p_customer_phone,
          p_shipping_street,
          p_shipping_ward,
          p_shipping_district,
          p_shipping_province,
          p_notes,
          p_shipping_provider,
          ROUND(COALESCE(v_quote.shipping_fee, v_shipping_fee), 2),
          ROUND(COALESCE(v_quote.shipping_net_amount, v_shipping_fee), 2),
          ROUND(COALESCE(v_quote.shipping_tax_amount, 0), 2),
          v_quote.tax_profile_id,
          COALESCE(v_quote.tax_mode, 'exclusive'::public.tax_mode),
          ROUND(COALESCE(v_quote.tax_rate, 0), 6),
          ROUND(COALESCE(v_quote.taxable_amount, 0), 2),
          ROUND(COALESCE(v_quote.tax_amount, 0), 2),
          COALESCE(NULLIF(v_quote.currency, ''), 'VND'),
          ROUND(COALESCE(v_quote.grand_total, 0), 2),
          p_estimated_delivery_time,
          v_idempotency_key
        )
        RETURNING * INTO v_inserted_order;
      EXCEPTION
        WHEN unique_violation THEN
          IF v_idempotency_key IS NOT NULL THEN
            SELECT *
            INTO v_existing_order
            FROM public.product_orders
            WHERE checkout_idempotency_key = v_idempotency_key
              AND (
                (v_effective_user_id IS NULL AND user_id IS NULL)
                OR user_id = v_effective_user_id
              )
            ORDER BY created_at DESC
            LIMIT 1;

            IF FOUND THEN
              RETURN v_existing_order;
            END IF;
          END IF;
          RAISE;
      END;

      WITH requested AS (
        SELECT
          (item->>'product_id')::integer AS product_id,
          SUM((item->>'quantity')::integer)::integer AS quantity
        FROM jsonb_array_elements(p_items) AS item
        GROUP BY (item->>'product_id')::integer
      )
      INSERT INTO public.product_order_items (
        id,
        order_id,
        product_id,
        quantity,
        price_at_purchase
      )
      SELECT
        extensions.uuid_generate_v4(),
        v_order_id,
        r.product_id,
        r.quantity,
        p.price
      FROM requested r
      JOIN public.products p ON p.id = r.product_id;

      WITH requested AS (
        SELECT
          (item->>'product_id')::integer AS product_id,
          SUM((item->>'quantity')::integer)::integer AS quantity
        FROM jsonb_array_elements(p_items) AS item
        GROUP BY (item->>'product_id')::integer
      )
      UPDATE public.products p
      SET
        stock_quantity = p.stock_quantity - r.quantity,
        sold_count = COALESCE(p.sold_count, 0) + r.quantity
      FROM requested r
      WHERE p.id = r.product_id;

      IF v_discount.id IS NOT NULL THEN
        UPDATE public.discount_codes
        SET
          usage_count = usage_count + 1,
          updated_at = now()
        WHERE id = v_discount.id;

        INSERT INTO public.discount_code_usages (
          discount_code_id,
          order_id,
          user_id
        ) VALUES (
          v_discount.id,
          v_order_id,
          v_effective_user_id
        );
      END IF;

      RETURN v_inserted_order;
    END;
    $create_order$;
  $fn_create$;

  GRANT EXECUTE ON FUNCTION public.quote_product_order_totals(
    numeric,
    numeric,
    numeric,
    text
  ) TO anon, authenticated;

  GRANT EXECUTE ON FUNCTION public.create_product_order_atomic(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    numeric,
    text,
    public.order_status,
    text,
    text,
    jsonb
  ) TO anon, authenticated;
END
$$;
