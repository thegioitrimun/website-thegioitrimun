-- Rebrand public editorial content without touching routes, media paths, contact
-- fields, or product catalog names that may legitimately contain "Natural Skin".
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'about_features',
        'about_page_content',
        'about_values',
        'blog_categories',
        'blog_posts',
        'doctors',
        'faq_items',
        'footer_content',
        'procedure_steps',
        'product_brands',
        'services',
        'site_info'
      )
      AND data_type IN ('text', 'character varying', 'json', 'jsonb')
      AND column_name NOT IN (
        'address',
        'canonical_url',
        'category_slug',
        'email',
        'facebook_url',
        'favicon_path',
        'icon',
        'image_desktop_path',
        'image_mobile_path',
        'image_path',
        'image_tablet_path',
        'instagram_url',
        'logo_dark_path',
        'logo_light_path',
        'logo_path',
        'phone',
        'slug',
        'tiktok_url',
        'youtube_url'
      )
  LOOP
    IF rec.data_type IN ('json', 'jsonb') THEN
      EXECUTE format(
        'UPDATE public.%I
            SET %I = regexp_replace(%I::text, %L, %L, ''gi'')::%s
          WHERE %I::text ~* %L',
        rec.table_name,
        rec.column_name,
        rec.column_name,
        'Natural Skin',
        'Thế Giới Trị Mụn',
        rec.data_type,
        rec.column_name,
        'Natural Skin'
      );
    ELSE
      EXECUTE format(
        'UPDATE public.%I
            SET %I = regexp_replace(%I, %L, %L, ''gi'')
          WHERE %I ~* %L',
        rec.table_name,
        rec.column_name,
        rec.column_name,
        'Natural Skin',
        'Thế Giới Trị Mụn',
        rec.column_name,
        'Natural Skin'
      );
    END IF;
  END LOOP;
END $$;

UPDATE public.site_info
SET clinic_name = 'Thế Giới Trị Mụn'
WHERE clinic_name IS DISTINCT FROM 'Thế Giới Trị Mụn';
