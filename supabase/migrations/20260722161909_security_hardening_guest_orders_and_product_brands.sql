-- Restrict product brand mutations to actual administrators.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.product_brands;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.product_brands;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.product_brands;
DROP POLICY IF EXISTS "Admins can insert product brands" ON public.product_brands;
DROP POLICY IF EXISTS "Admins can update product brands" ON public.product_brands;
DROP POLICY IF EXISTS "Admins can delete product brands" ON public.product_brands;

CREATE POLICY "Admins can insert product brands"
  ON public.product_brands
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product brands"
  ON public.product_brands
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product brands"
  ON public.product_brands
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- Remove the phone-only guest lookup. The replacement requires an order code,
-- returns a minimal masked payload and is callable only with the service role.
DROP FUNCTION IF EXISTS public.lookup_guest_product_orders_by_phone(text);
DROP FUNCTION IF EXISTS app_private.lookup_guest_product_orders_by_phone(text);

CREATE OR REPLACE FUNCTION public.lookup_guest_product_order_secure(
  p_order_code text,
  p_customer_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_order_code, '')));
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_order jsonb;
BEGIN
  IF length(v_code) < 5 OR length(v_code) > 40 THEN
    RAISE EXCEPTION 'Mã đơn hàng không hợp lệ.';
  END IF;
  IF length(v_phone) < 8 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ.';
  END IF;

  SELECT jsonb_build_object(
    'id', po.id,
    'user_id', null,
    'order_code', po.order_code,
    'subtotal_price', po.subtotal_price,
    'discount_code', po.discount_code,
    'discount_amount', po.discount_amount,
    'total_price', po.total_price,
    'status', po.status,
    'payment_method', po.payment_method,
    'payment_status', po.payment_status,
    'fulfillment_status', po.fulfillment_status,
    'customer_name', CASE
      WHEN length(trim(coalesce(po.customer_name, ''))) <= 1 THEN '*'
      ELSE left(trim(po.customer_name), 1) || repeat('*', least(8, length(trim(po.customer_name)) - 1))
    END,
    'customer_phone', repeat('*', greatest(0, length(v_phone) - 4)) || right(v_phone, 4),
    'shipping_street', '',
    'shipping_ward', '',
    'shipping_district', po.shipping_district,
    'shipping_province', po.shipping_province,
    'notes', null,
    'created_at', po.created_at,
    'shipping_provider', po.shipping_provider,
    'shipping_fee', po.shipping_fee,
    'shipping_net_amount', po.shipping_net_amount,
    'shipping_tax_rate', po.shipping_tax_rate,
    'shipping_tax_amount', po.shipping_tax_amount,
    'shipping_code', null,
    'ghtk_label', null,
    'ghtk_status_text', po.ghtk_status_text,
    'tax_profile_id', null,
    'tax_mode', po.tax_mode,
    'tax_rate', po.tax_rate,
    'taxable_amount', po.taxable_amount,
    'tax_amount', po.tax_amount,
    'currency', po.currency,
    'grand_total', po.grand_total,
    'estimated_delivery_time', po.estimated_delivery_time,
    'order_items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', poi.id,
          'order_id', poi.order_id,
          'product_id', poi.product_id,
          'quantity', poi.quantity,
          'price_at_purchase', poi.price_at_purchase,
          'product', jsonb_build_object(
            'id', p.id,
            'slug', p.slug,
            'name', coalesce(p.name, 'Sản phẩm'),
            'name_en', p.name_en,
            'name_ru', p.name_ru,
            'name_cn', p.name_cn,
            'brand', p.brand,
            'main_image_path', (
              SELECT pi.image_path
              FROM public.product_images pi
              WHERE pi.product_id = p.id
              ORDER BY coalesce(pi.is_primary, false) DESC,
                       coalesce(pi.display_order, 999999) ASC,
                       pi.id ASC
              LIMIT 1
            )
          )
        )
        ORDER BY poi.id
      )
      FROM public.product_order_items poi
      LEFT JOIN public.products p ON p.id = poi.product_id
      WHERE poi.order_id = po.id
    ), '[]'::jsonb)
  )
  INTO v_order
  FROM public.product_orders po
  WHERE upper(trim(coalesce(po.order_code, ''))) = v_code
    AND regexp_replace(coalesce(po.customer_phone, ''), '\D', '', 'g') = v_phone
  ORDER BY po.created_at DESC
  LIMIT 1;

  RETURN CASE WHEN v_order IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_order) END;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_product_order_secure(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_guest_product_order_secure(text, text) TO service_role;
