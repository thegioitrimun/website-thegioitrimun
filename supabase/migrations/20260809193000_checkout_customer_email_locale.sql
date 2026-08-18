-- Transitional fields used while Supabase remains the write source during the D1 rollout.
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'vi';

ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_customer_email_format_check,
  ADD CONSTRAINT product_orders_customer_email_format_check
    CHECK (customer_email IS NULL OR customer_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  DROP CONSTRAINT IF EXISTS product_orders_locale_check,
  ADD CONSTRAINT product_orders_locale_check
    CHECK (locale IN ('vi', 'en', 'ru', 'cn'));

CREATE INDEX IF NOT EXISTS product_orders_customer_email_created_idx
  ON public.product_orders (lower(customer_email), created_at DESC)
  WHERE customer_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attach_product_order_contact(
  p_order_id uuid,
  p_checkout_idempotency_key text,
  p_customer_email text,
  p_locale text DEFAULT 'vi'
)
RETURNS public.product_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_locale text := lower(btrim(coalesce(p_locale, 'vi')));
  v_order public.product_orders%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid customer email is required.' USING ERRCODE = '22023';
  END IF;
  IF v_locale NOT IN ('vi', 'en', 'ru', 'cn') THEN
    v_locale := 'vi';
  END IF;

  UPDATE public.product_orders
  SET customer_email = v_email,
      locale = v_locale,
      updated_at = now()
  WHERE id = p_order_id
    AND checkout_idempotency_key = nullif(btrim(p_checkout_idempotency_key), '')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order contact update was rejected.' USING ERRCODE = '42501';
  END IF;
  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_product_order_contact(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_product_order_contact(uuid, text, text, text) TO anon, authenticated;

