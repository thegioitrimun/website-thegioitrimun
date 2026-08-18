ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS verified_purchase boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS product_reviews_product_verified_idx
  ON public.product_reviews (product_id, verified_purchase, created_at DESC);

CREATE INDEX IF NOT EXISTS product_order_items_product_order_idx
  ON public.product_order_items (product_id, order_id);

CREATE INDEX IF NOT EXISTS product_orders_user_fulfillment_payment_idx
  ON public.product_orders (user_id, fulfillment_status, payment_status);

CREATE OR REPLACE FUNCTION public.can_review_product(
  p_product_id integer,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_order_items poi
    JOIN public.product_orders po ON po.id = poi.order_id
    WHERE poi.product_id = p_product_id
      AND po.user_id = p_user_id
      AND po.fulfillment_status = 'completed'::public.fulfillment_status
      AND po.payment_status = 'paid'::public.payment_status
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_review_product(integer, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_verified_purchase_to_product_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.verified_purchase := public.can_review_product(NEW.product_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_reviews_set_verified_purchase_tg ON public.product_reviews;
CREATE TRIGGER product_reviews_set_verified_purchase_tg
BEFORE INSERT OR UPDATE OF product_id, user_id
ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.assign_verified_purchase_to_product_review();

UPDATE public.product_reviews
SET verified_purchase = public.can_review_product(product_id, user_id);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Verified buyers can insert reviews" ON public.product_reviews;

CREATE POLICY "Verified buyers can insert reviews"
ON public.product_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_review_product(product_id, user_id)
);

DROP VIEW IF EXISTS public.public_product_reviews;

CREATE VIEW public.public_product_reviews AS
SELECT
  r.id,
  r.product_id,
  r.user_id,
  r.rating,
  r.title,
  r.comment,
  r.created_at,
  p.name AS author_name,
  p.avatar_path AS author_avatar_path,
  r.verified_purchase
FROM public.product_reviews r
LEFT JOIN public.patients p ON p.id = r.user_id;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated, service_role;
