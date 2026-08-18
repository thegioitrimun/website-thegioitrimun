-- Catalog SEO sync events
--
-- This table is intentionally tiny and append-only. It gives the admin/ops
-- layer a durable signal whenever public catalog data changes, without putting
-- Google/Search Console work inside the write transaction.

CREATE TABLE IF NOT EXISTS public.catalog_seo_events (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  source_table TEXT NOT NULL,
  product_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalog_seo_events_created_at
  ON public.catalog_seo_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_seo_events_unprocessed
  ON public.catalog_seo_events (processed_at, created_at DESC)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_seo_events_product_id
  ON public.catalog_seo_events (product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.catalog_seo_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_seo_events'
      AND policyname = 'Admins can read catalog SEO events'
  ) THEN
    CREATE POLICY "Admins can read catalog SEO events"
      ON public.catalog_seo_events
      FOR SELECT
      USING (public.is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_catalog_seo_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT := lower(TG_OP);
  v_entity_id TEXT;
  v_entity_type TEXT := TG_TABLE_NAME;
  v_product_id BIGINT;
  v_payload JSONB := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id::text;
      v_product_id := OLD.id;
      v_payload := jsonb_build_object(
        'slug', OLD.slug,
        'name', OLD.name,
        'updated_at', OLD.updated_at
      );
    ELSE
      v_entity_id := NEW.id::text;
      v_product_id := NEW.id;
      v_payload := jsonb_build_object(
        'slug', NEW.slug,
        'name', NEW.name,
        'updated_at', NEW.updated_at
      );
    END IF;
    v_entity_type := 'product';

  ELSIF TG_TABLE_NAME = 'product_images' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id::text;
      v_product_id := OLD.product_id;
      v_payload := jsonb_build_object(
        'image_path', OLD.image_path,
        'is_primary', OLD.is_primary,
        'display_order', OLD.display_order
      );
    ELSE
      v_entity_id := NEW.id::text;
      v_product_id := NEW.product_id;
      v_payload := jsonb_build_object(
        'image_path', NEW.image_path,
        'is_primary', NEW.is_primary,
        'display_order', NEW.display_order
      );
    END IF;

    -- Image changes affect sitemap/image sitemap/feed freshness for the parent product.
    IF v_product_id IS NOT NULL THEN
      UPDATE public.products
      SET updated_at = now()
      WHERE id = v_product_id;
    END IF;
    v_entity_type := 'product_image';

  ELSIF TG_TABLE_NAME = 'product_categories' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id::text;
      v_payload := jsonb_build_object('slug', OLD.slug, 'name', OLD.name);
    ELSE
      v_entity_id := NEW.id::text;
      v_payload := jsonb_build_object('slug', NEW.slug, 'name', NEW.name);
    END IF;
    v_entity_type := 'product_category';

  ELSIF TG_TABLE_NAME = 'product_brands' THEN
    IF TG_OP = 'DELETE' THEN
      v_entity_id := OLD.id::text;
      v_payload := jsonb_build_object('slug', OLD.slug, 'name', OLD.name, 'logo_path', OLD.logo_path);
    ELSE
      v_entity_id := NEW.id::text;
      v_payload := jsonb_build_object('slug', NEW.slug, 'name', NEW.name, 'logo_path', NEW.logo_path);
    END IF;
    v_entity_type := 'product_brand';
  END IF;

  INSERT INTO public.catalog_seo_events (
    entity_type,
    entity_id,
    action,
    source_table,
    product_id,
    payload
  ) VALUES (
    v_entity_type,
    v_entity_id,
    v_action,
    TG_TABLE_NAME,
    v_product_id,
    v_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_catalog_seo_products ON public.products;
    CREATE TRIGGER trg_catalog_seo_products
      AFTER INSERT OR UPDATE OR DELETE ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION public.record_catalog_seo_event();
  END IF;

  IF to_regclass('public.product_images') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_catalog_seo_product_images ON public.product_images;
    CREATE TRIGGER trg_catalog_seo_product_images
      AFTER INSERT OR UPDATE OR DELETE ON public.product_images
      FOR EACH ROW
      EXECUTE FUNCTION public.record_catalog_seo_event();
  END IF;

  IF to_regclass('public.product_categories') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_catalog_seo_product_categories ON public.product_categories;
    CREATE TRIGGER trg_catalog_seo_product_categories
      AFTER INSERT OR UPDATE OR DELETE ON public.product_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.record_catalog_seo_event();
  END IF;

  IF to_regclass('public.product_brands') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_catalog_seo_product_brands ON public.product_brands;
    CREATE TRIGGER trg_catalog_seo_product_brands
      AFTER INSERT OR UPDATE OR DELETE ON public.product_brands
      FOR EACH ROW
      EXECUTE FUNCTION public.record_catalog_seo_event();
  END IF;
END $$;
