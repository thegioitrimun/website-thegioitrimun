-- Normalize legacy auth rows and stop exposing private patient fields to public clients.
-- This migration:
-- 1. Fixes migrated auth.users rows with NULL instance_id so GoTrue can see them consistently.
-- 2. Backfills missing public.patients profiles from auth.users.
-- 3. Creates public-safe views for doctors, blog authors, and review authors.
-- 4. Removes the broad public SELECT policy on public.patients.

UPDATE auth.users
SET instance_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE instance_id IS NULL;

INSERT INTO public.patients (
  id,
  name,
  dob,
  phone,
  email,
  role,
  avatar_path
)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', ''), 'Người dùng mới'),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'dob', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (u.raw_user_meta_data->>'dob')::date
    ELSE '1990-01-01'::date
  END,
  COALESCE(NULLIF(u.raw_user_meta_data->>'phone', ''), '0000000000'),
  u.email,
  'customer'::public.system_role,
  NULLIF(u.raw_user_meta_data->>'avatar_url', '')
FROM auth.users u
LEFT JOIN public.patients p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE VIEW public.public_doctors_directory AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  d.job_title,
  d.specialization,
  d.homepage_description,
  d.job_title_en,
  d.job_title_ru,
  d.job_title_cn,
  d.specialization_en,
  d.specialization_ru,
  d.specialization_cn,
  d.homepage_description_en,
  d.homepage_description_ru,
  d.homepage_description_cn
FROM public.patients p
JOIN public.doctors d ON d.id = p.id
WHERE p.role IN ('doctor'::public.system_role, 'admin'::public.system_role, 'master_admin'::public.system_role);

CREATE OR REPLACE VIEW public.public_blog_posts AS
SELECT
  b.*,
  p.id AS author_public_id,
  p.name AS author_name,
  p.avatar_path AS author_avatar_path
FROM public.blog_posts b
LEFT JOIN public.patients p ON p.id = b.author_id;

CREATE OR REPLACE VIEW public.public_product_reviews AS
SELECT
  r.*,
  p.name AS author_name,
  p.avatar_path AS author_avatar_path
FROM public.product_reviews r
LEFT JOIN public.patients p ON p.id = r.user_id;

GRANT SELECT ON public.public_doctors_directory TO anon, authenticated, service_role;
GRANT SELECT ON public.public_blog_posts TO anon, authenticated, service_role;
GRANT SELECT ON public.public_product_reviews TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view doctor and admin profiles" ON public.patients;
