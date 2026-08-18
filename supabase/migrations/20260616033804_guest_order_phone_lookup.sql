CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.lookup_guest_product_orders_by_phone(p_customer_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_orders jsonb := '[]'::jsonb;
BEGIN
  IF length(v_phone) < 8 THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ.';
  END IF;

  WITH matched_orders AS (
    SELECT po.*
    FROM public.product_orders po
    WHERE regexp_replace(coalesce(po.customer_phone, ''), '\D', '', 'g') = v_phone
    ORDER BY po.created_at DESC
    LIMIT 20
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', po.id,
        'user_id', null,
        'order_code', po.order_code,
        'checkout_idempotency_key', null,
        'subtotal_price', po.subtotal_price,
        'discount_code', po.discount_code,
        'discount_amount', po.discount_amount,
        'total_price', po.total_price,
        'status', po.status,
        'payment_method', po.payment_method,
        'payment_status', po.payment_status,
        'fulfillment_status', po.fulfillment_status,
        'customer_name', po.customer_name,
        'customer_phone', po.customer_phone,
        'shipping_street', '',
        'shipping_ward', po.shipping_ward,
        'shipping_district', po.shipping_district,
        'shipping_province', po.shipping_province,
        'notes', null,
        'created_at', po.created_at,
        'shipping_provider', po.shipping_provider,
        'shipping_fee', po.shipping_fee,
        'shipping_net_amount', po.shipping_net_amount,
        'shipping_tax_rate', po.shipping_tax_rate,
        'shipping_tax_amount', po.shipping_tax_amount,
        'shipping_code', po.shipping_code,
        'ghtk_label', po.ghtk_label,
        'ghtk_status_text', po.ghtk_status_text,
        'tax_profile_id', po.tax_profile_id,
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
                  ORDER BY coalesce(pi.is_primary, false) DESC, coalesce(pi.display_order, 999999) ASC, pi.id ASC
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
      ORDER BY po.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM matched_orders po;

  RETURN v_orders;
END;
$$;

REVOKE ALL ON FUNCTION app_private.lookup_guest_product_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.lookup_guest_product_orders_by_phone(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lookup_guest_product_orders_by_phone(p_customer_phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, app_private, pg_temp
AS $$
  SELECT app_private.lookup_guest_product_orders_by_phone(p_customer_phone);
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_product_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_product_orders_by_phone(text) TO anon, authenticated;
