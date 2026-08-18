-- Product/INCI mirror for the dedicated ingredient Supabase project.
-- The product project remains the source of truth. This table is private to
-- the Worker service key and is never exposed directly to the browser.

CREATE TABLE IF NOT EXISTS public.product_ingredient_snapshots (
  source_project TEXT NOT NULL DEFAULT 'thegioitrimun.vn',
  source_product_id BIGINT NOT NULL,
  slug TEXT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  name_en TEXT,
  name_ru TEXT,
  name_cn TEXT,
  ingredients TEXT NOT NULL,
  ingredients_en TEXT,
  ingredients_ru TEXT,
  ingredients_cn TEXT,
  brand TEXT,
  category_id BIGINT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ NOT NULL,
  inci_hash TEXT NOT NULL,
  analysis_by_lang JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis_version INTEGER NOT NULL DEFAULT 1,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_project, source_product_id),
  UNIQUE (source_project, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_ingredient_snapshots_public_slug
  ON public.product_ingredient_snapshots (source_project, slug)
  WHERE is_published = true AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_ingredient_snapshots_source_updated
  ON public.product_ingredient_snapshots (source_updated_at DESC);

ALTER TABLE public.product_ingredient_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_ingredient_snapshots FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_ingredient_snapshots TO service_role;

COMMENT ON TABLE public.product_ingredient_snapshots IS
  'Read-only product/INCI mirror owned by thegioitrimun.vn product database; populated by the Cloudflare Worker.';
