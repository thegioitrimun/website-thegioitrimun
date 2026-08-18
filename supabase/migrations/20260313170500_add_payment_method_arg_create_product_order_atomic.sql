-- Add payment_method-aware overload for create_product_order_atomic.
-- This keeps backward compatibility with existing clients while allowing
-- frontend to explicitly send 'cod' | 'bank_transfer'.

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
SET search_path = public
AS $function$
DECLARE
  v_order public.product_orders;
  v_payment_method text := lower(coalesce(nullif(btrim(p_payment_method), ''), ''));
BEGIN
  -- Delegate core atomic logic to the existing stable function signature.
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

  IF v_payment_method IN ('cod', 'bank_transfer') THEN
    UPDATE public.product_orders
    SET payment_method = v_payment_method
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  RETURN v_order;
END;
$function$;

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
  text,
  jsonb
) TO anon, authenticated;
