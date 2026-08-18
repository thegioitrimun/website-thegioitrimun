DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'site_info',
        'footer_content',
        'about_page_content',
        'blog_posts',
        'services',
        'procedure_steps'
      )
      AND data_type IN ('text', 'character varying')
      AND column_name NOT IN (
        'image_path',
        'image_desktop_path',
        'image_tablet_path',
        'image_mobile_path',
        'logo_light_path',
        'logo_dark_path',
        'favicon_path',
        'slug',
        'category_slug',
        'canonical_url',
        'email',
        'phone',
        'address',
        'facebook_url',
        'instagram_url',
        'youtube_url',
        'tiktok_url',
        'icon'
      )
  LOOP
    EXECUTE format(
      'UPDATE public.%I
         SET %I = replace(
                     replace(
                       replace(
                         replace(
                           replace(%I, ''Dr.HappyPi'', ''Natural Skin''),
                           ''iSkin Clinic'', ''Natural Skin''
                         ),
                         ''Thế Giới Trị Mụn Clinic'', ''Natural Skin''
                       ),
                       ''Thế Giới Trị Mụn'', ''Natural Skin''
                     ),
                     ''iSkin'', ''Natural Skin''
                   )
       WHERE %I IS NOT NULL;',
      rec.table_name,
      rec.column_name,
      rec.column_name,
      rec.column_name
    );
  END LOOP;
END $$;

UPDATE public.site_info
SET clinic_name = 'Natural Skin'
WHERE clinic_name IS DISTINCT FROM 'Natural Skin';

UPDATE public.footer_content
SET copyright_text = replace(copyright_text, 'Dr.HappyPi', 'Natural Skin');

UPDATE public.footer_content
SET copyright_text = replace(copyright_text, 'iSkin Clinic', 'Natural Skin');

UPDATE public.footer_content
SET copyright_text = replace(copyright_text, 'Thế Giới Trị Mụn', 'Natural Skin');

UPDATE public.blog_posts
SET canonical_url = 'https://thegioitrimun.vn/kien-thuc/' || coalesce(nullif(category_slug, ''), 'tong-hop') || '/' || slug
WHERE canonical_url ILIKE '%iskin.vn%';
