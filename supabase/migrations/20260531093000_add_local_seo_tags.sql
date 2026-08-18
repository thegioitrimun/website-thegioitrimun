ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS local_seo_tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS local_seo_tags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.blog_posts.local_seo_tags IS
  'Curated Phu Quoc dermatology search tags rendered as public hashtags and SEO article tags.';

COMMENT ON COLUMN public.services.local_seo_tags IS
  'Curated Phu Quoc dermatology search tags rendered as public hashtags and service SEO keywords.';

DROP VIEW IF EXISTS public.public_blog_posts;

CREATE VIEW public.public_blog_posts AS
SELECT
  b.*,
  p.id AS author_public_id,
  p.name AS author_name,
  p.avatar_path AS author_avatar_path
FROM public.blog_posts b
LEFT JOIN public.patients p ON p.id = b.author_id;

GRANT SELECT ON public.public_blog_posts TO anon, authenticated, service_role;
