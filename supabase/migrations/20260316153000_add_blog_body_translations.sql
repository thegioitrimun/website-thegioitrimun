ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS content_en text,
  ADD COLUMN IF NOT EXISTS content_ru text,
  ADD COLUMN IF NOT EXISTS content_cn text;

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
