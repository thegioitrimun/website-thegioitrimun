-- Durable one-way queue from the product source of truth to the ingredient
-- analysis project. Only product fields that affect the mirrored snapshot or
-- INCI analysis enqueue a new event.

CREATE TABLE IF NOT EXISTS public.product_ingredient_sync_events (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_ingredient_sync_events_pending
  ON public.product_ingredient_sync_events (created_at, product_id)
  WHERE processed_at IS NULL;

ALTER TABLE public.product_ingredient_sync_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_ingredient_sync_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_ingredient_sync_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.product_ingredient_sync_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_product_ingredient_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id BIGINT;
  v_action TEXT;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.id;
    v_action := 'delete';
    v_updated_at := OLD.updated_at;
  ELSE
    v_product_id := NEW.id;
    v_action := 'upsert';
    v_updated_at := NEW.updated_at;

    IF TG_OP = 'UPDATE' AND NOT (
      ROW(
        OLD.slug,
        OLD.sku,
        OLD.name,
        OLD.name_en,
        OLD.name_ru,
        OLD.name_cn,
        OLD.ingredients,
        OLD.ingredients_en,
        OLD.ingredients_ru,
        OLD.ingredients_cn,
        OLD.brand,
        OLD.category_id,
        OLD.is_published,
        OLD.archived_at
      ) IS DISTINCT FROM ROW(
        NEW.slug,
        NEW.sku,
        NEW.name,
        NEW.name_en,
        NEW.name_ru,
        NEW.name_cn,
        NEW.ingredients,
        NEW.ingredients_en,
        NEW.ingredients_ru,
        NEW.ingredients_cn,
        NEW.brand,
        NEW.category_id,
        NEW.is_published,
        NEW.archived_at
      )
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.product_ingredient_sync_events (
    product_id,
    action,
    source_updated_at
  ) VALUES (
    v_product_id,
    v_action,
    v_updated_at
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_product_ingredient_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_products_ingredient_sync ON public.products;
CREATE TRIGGER trg_products_ingredient_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_product_ingredient_sync();

-- Seed the queue so the first worker run backfills the complete product source.
INSERT INTO public.product_ingredient_sync_events (
  product_id,
  action,
  source_updated_at
)
SELECT
  id,
  'upsert',
  updated_at
FROM public.products;
