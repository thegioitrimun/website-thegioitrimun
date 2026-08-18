-- Preserve order history when an admin removes a product from the catalog.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS products_public_active_idx
  ON public.products (is_published, id)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_delete_or_archive_product(
  p_product_id integer
)
RETURNS TABLE (
  product_id integer,
  outcome text,
  image_paths text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_has_orders boolean;
  v_image_paths text[];
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Không tìm thấy sản phẩm cần xóa.';
  END IF;

  SELECT COALESCE(
    array_agg(pi.image_path ORDER BY pi.id) FILTER (WHERE pi.image_path IS NOT NULL),
    ARRAY[]::text[]
  )
  INTO v_image_paths
  FROM public.product_images pi
  WHERE pi.product_id = p_product_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.product_order_items poi
    WHERE poi.product_id = p_product_id
  )
  INTO v_has_orders;

  IF v_has_orders THEN
    UPDATE public.products
    SET
      archived_at = COALESCE(archived_at, now()),
      is_published = false,
      is_featured = false,
      stock_quantity = 0
    WHERE id = p_product_id;

    RETURN QUERY SELECT p_product_id, 'archived'::text, ARRAY[]::text[];
    RETURN;
  END IF;

  DELETE FROM public.products
  WHERE id = p_product_id;

  RETURN QUERY SELECT p_product_id, 'deleted'::text, v_image_paths;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_delete_or_archive_product(integer)
  TO authenticated, service_role;
