-- Migration: phase0_order_hardening_idempotency
-- Description:
-- 1) Removes permissive INSERT policy on product_order_items.
-- 2) Adds checkout idempotency key to product_orders.
-- 3) Replaces atomic checkout RPC with idempotency support.

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.product_order_items;

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS product_orders_checkout_idempotency_key_uidx
  ON public.product_orders (checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

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

      v_final_total := v_subtotal + v_shipping_fee - v_discount_amount;
      IF v_final_total < 0 THEN
        v_final_total := 0;
      END IF;

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
          v_shipping_fee,
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
  $fn$;

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
