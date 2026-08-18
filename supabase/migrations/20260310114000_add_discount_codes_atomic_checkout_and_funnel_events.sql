-- Migration: add_discount_codes_atomic_checkout_and_funnel_events
-- Description:
-- 1) Adds real discount code tables and validation RPC
-- 2) Adds atomic checkout RPC with stock decrement transaction
-- 3) Adds funnel analytics events table

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
    CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  code text NOT NULL UNIQUE CHECK (code = upper(code)),
  type public.discount_type NOT NULL,
  value numeric(12,2) NOT NULL CHECK (value > 0),
  min_purchase_amount numeric(12,2) DEFAULT 0 CHECK (min_purchase_amount >= 0),
  max_discount_amount numeric(12,2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_limit_per_user integer CHECK (usage_limit_per_user IS NULL OR usage_limit_per_user > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_discount_codes_updated_at ON public.discount_codes;
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.discount_code_usages (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (discount_code_id, order_id)
);

CREATE INDEX IF NOT EXISTS discount_code_usages_discount_code_id_idx
  ON public.discount_code_usages(discount_code_id);
CREATE INDEX IF NOT EXISTS discount_code_usages_user_id_idx
  ON public.discount_code_usages(user_id);

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS subtotal_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_name text NOT NULL,
  user_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  session_id text,
  path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funnel_events_event_name_idx
  ON public.funnel_events(event_name);
CREATE INDEX IF NOT EXISTS funnel_events_created_at_idx
  ON public.funnel_events(created_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_user_id_idx
  ON public.funnel_events(user_id);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage discount usage logs" ON public.discount_code_usages;
CREATE POLICY "Admins can manage discount usage logs"
  ON public.discount_code_usages
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can insert funnel events" ON public.funnel_events;
CREATE POLICY "Anyone can insert funnel events"
  ON public.funnel_events
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view funnel events" ON public.funnel_events;
CREATE POLICY "Admins can view funnel events"
  ON public.funnel_events
  FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  code text,
  type public.discount_type,
  value numeric,
  min_purchase_amount numeric,
  max_discount_amount numeric,
  preview_discount_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.discount_codes%ROWTYPE;
  v_now timestamp with time zone := now();
  v_user_usage_count integer := 0;
  v_discount numeric := 0;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập mã giảm giá.';
  END IF;

  IF COALESCE(p_subtotal, 0) <= 0 THEN
    RAISE EXCEPTION 'Giỏ hàng trống hoặc không hợp lệ.';
  END IF;

  SELECT d.*
  INTO v_code
  FROM public.discount_codes d
  WHERE d.code = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
  END IF;

  IF NOT v_code.is_active THEN
    RAISE EXCEPTION 'Mã giảm giá đã bị vô hiệu hóa.';
  END IF;

  IF v_code.starts_at IS NOT NULL AND v_now < v_code.starts_at THEN
    RAISE EXCEPTION 'Mã giảm giá chưa đến thời gian sử dụng.';
  END IF;

  IF v_code.ends_at IS NOT NULL AND v_now > v_code.ends_at THEN
    RAISE EXCEPTION 'Mã giảm giá đã hết hạn.';
  END IF;

  IF v_code.usage_limit IS NOT NULL AND v_code.usage_count >= v_code.usage_limit THEN
    RAISE EXCEPTION 'Mã giảm giá đã hết lượt sử dụng.';
  END IF;

  IF COALESCE(v_code.min_purchase_amount, 0) > COALESCE(p_subtotal, 0) THEN
    RAISE EXCEPTION 'Mã này yêu cầu đơn hàng tối thiểu %.', to_char(v_code.min_purchase_amount, 'FM999G999G999D00');
  END IF;

  IF p_user_id IS NOT NULL AND v_code.usage_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_user_usage_count
    FROM public.discount_code_usages
    WHERE discount_code_id = v_code.id
      AND user_id = p_user_id;

    IF v_user_usage_count >= v_code.usage_limit_per_user THEN
      RAISE EXCEPTION 'Bạn đã dùng hết lượt cho mã giảm giá này.';
    END IF;
  END IF;

  IF v_code.type = 'percentage'::public.discount_type THEN
    v_discount := COALESCE(p_subtotal, 0) * (v_code.value / 100);
  ELSE
    v_discount := v_code.value;
  END IF;

  IF v_code.max_discount_amount IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_code.max_discount_amount);
  END IF;

  v_discount := LEAST(v_discount, COALESCE(p_subtotal, 0));

  RETURN QUERY
  SELECT
    v_code.code,
    v_code.type,
    v_code.value,
    v_code.min_purchase_amount,
    v_code.max_discount_amount,
    ROUND(v_discount, 2);
END;
$$;

DO $$
BEGIN
  EXECUTE $fn$
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
      v_discount public.discount_codes%ROWTYPE;
      v_inserted_order public.product_orders%ROWTYPE;
      rec record;
    BEGIN
      IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Giỏ hàng trống.';
      END IF;

      IF p_user_id IS NOT NULL AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
        RAISE EXCEPTION 'Không thể tạo đơn hàng cho tài khoản khác.';
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

      v_final_total := v_subtotal + v_shipping_fee - v_discount_amount;
      IF v_final_total < 0 THEN
        v_final_total := 0;
      END IF;

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
        estimated_delivery_time
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
        v_shipping_fee,
        p_estimated_delivery_time
      )
      RETURNING * INTO v_inserted_order;

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
  $fn$;
END
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, numeric, uuid) TO anon, authenticated;
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
  jsonb
) TO anon, authenticated;

INSERT INTO public.discount_codes (code, type, value, min_purchase_amount, description, is_active)
VALUES
  ('ISKIN10', 'percentage', 10, 500000, 'Giảm 10% cho đơn từ 500.000đ', true),
  ('WELCOME50K', 'fixed_amount', 50000, 0, 'Giảm trực tiếp 50.000đ', true)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
