-- A single indexed row lets every edge location select the current cache version.
CREATE TABLE IF NOT EXISTS public_cache_versions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog INTEGER NOT NULL DEFAULT 1,
  taxonomy INTEGER NOT NULL DEFAULT 1,
  content INTEGER NOT NULL DEFAULT 1,
  reviews INTEGER NOT NULL DEFAULT 1,
  ingredients INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO public_cache_versions(id) VALUES (1);

CREATE TRIGGER IF NOT EXISTS public_cache_products_insert
AFTER INSERT ON products
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_products_update
AFTER UPDATE ON products
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."sku" IS NOT NEW."sku" OR OLD."category_id" IS NOT NEW."category_id" OR OLD."brand" IS NOT NEW."brand" OR OLD."name" IS NOT NEW."name" OR OLD."name_en" IS NOT NEW."name_en" OR OLD."name_ru" IS NOT NEW."name_ru" OR OLD."name_cn" IS NOT NEW."name_cn" OR OLD."description" IS NOT NEW."description" OR OLD."description_en" IS NOT NEW."description_en" OR OLD."description_ru" IS NOT NEW."description_ru" OR OLD."description_cn" IS NOT NEW."description_cn" OR OLD."long_description" IS NOT NEW."long_description" OR OLD."long_description_en" IS NOT NEW."long_description_en" OR OLD."long_description_ru" IS NOT NEW."long_description_ru" OR OLD."long_description_cn" IS NOT NEW."long_description_cn" OR OLD."usage_instructions" IS NOT NEW."usage_instructions" OR OLD."usage_instructions_en" IS NOT NEW."usage_instructions_en" OR OLD."usage_instructions_ru" IS NOT NEW."usage_instructions_ru" OR OLD."usage_instructions_cn" IS NOT NEW."usage_instructions_cn" OR OLD."ingredients" IS NOT NEW."ingredients" OR OLD."ingredients_en" IS NOT NEW."ingredients_en" OR OLD."ingredients_ru" IS NOT NEW."ingredients_ru" OR OLD."ingredients_cn" IS NOT NEW."ingredients_cn" OR OLD."inci_text" IS NOT NEW."inci_text" OR OLD."key_benefits_json" IS NOT NEW."key_benefits_json" OR OLD."key_benefits_en_json" IS NOT NEW."key_benefits_en_json" OR OLD."key_benefits_ru_json" IS NOT NEW."key_benefits_ru_json" OR OLD."key_benefits_cn_json" IS NOT NEW."key_benefits_cn_json" OR OLD."skin_types_json" IS NOT NEW."skin_types_json" OR OLD."faq_items_json" IS NOT NEW."faq_items_json" OR OLD."precautions" IS NOT NEW."precautions" OR OLD."precautions_en" IS NOT NEW."precautions_en" OR OLD."precautions_ru" IS NOT NEW."precautions_ru" OR OLD."precautions_cn" IS NOT NEW."precautions_cn" OR OLD."price" IS NOT NEW."price" OR OLD."vat_rate" IS NOT NEW."vat_rate" OR OLD."stock_quantity" IS NOT NEW."stock_quantity" OR OLD."low_stock_threshold" IS NOT NEW."low_stock_threshold" OR OLD."volume" IS NOT NEW."volume" OR OLD."origin" IS NOT NEW."origin" OR OLD."origin_en" IS NOT NEW."origin_en" OR OLD."origin_ru" IS NOT NEW."origin_ru" OR OLD."origin_cn" IS NOT NEW."origin_cn" OR OLD."texture" IS NOT NEW."texture" OR OLD."texture_en" IS NOT NEW."texture_en" OR OLD."texture_ru" IS NOT NEW."texture_ru" OR OLD."texture_cn" IS NOT NEW."texture_cn" OR OLD."expiry_date" IS NOT NEW."expiry_date" OR OLD."sold_count" IS NOT NEW."sold_count" OR OLD."is_published" IS NOT NEW."is_published" OR OLD."is_featured" IS NOT NEW."is_featured" OR OLD."archived_at" IS NOT NEW."archived_at" OR OLD."created_at" IS NOT NEW."created_at" OR OLD."vat_category_code" IS NOT NEW."vat_category_code" OR OLD."vat_classification_approved_at" IS NOT NEW."vat_classification_approved_at" OR OLD."vat_classification_approved_by" IS NOT NEW."vat_classification_approved_by")
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_products_delete
AFTER DELETE ON products
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_images_insert
AFTER INSERT ON product_images
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_images_update
AFTER UPDATE ON product_images
WHEN (OLD."id" IS NOT NEW."id" OR OLD."product_id" IS NOT NEW."product_id" OR OLD."image_path" IS NOT NEW."image_path" OR OLD."alt_text" IS NOT NEW."alt_text" OR OLD."is_primary" IS NOT NEW."is_primary" OR OLD."display_order" IS NOT NEW."display_order" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_images_delete
AFTER DELETE ON product_images
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_categories_insert
AFTER INSERT ON product_categories
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_categories_update
AFTER UPDATE ON product_categories
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."name" IS NOT NEW."name" OR OLD."name_en" IS NOT NEW."name_en" OR OLD."name_ru" IS NOT NEW."name_ru" OR OLD."name_cn" IS NOT NEW."name_cn" OR OLD."description" IS NOT NEW."description" OR OLD."description_en" IS NOT NEW."description_en" OR OLD."description_ru" IS NOT NEW."description_ru" OR OLD."description_cn" IS NOT NEW."description_cn" OR OLD."image_path" IS NOT NEW."image_path" OR OLD."is_featured" IS NOT NEW."is_featured" OR OLD."display_order" IS NOT NEW."display_order" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_categories_delete
AFTER DELETE ON product_categories
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_brands_insert
AFTER INSERT ON product_brands
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_brands_update
AFTER UPDATE ON product_brands
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."name" IS NOT NEW."name" OR OLD."description" IS NOT NEW."description" OR OLD."logo_path" IS NOT NEW."logo_path" OR OLD."is_active" IS NOT NEW."is_active" OR OLD."display_order" IS NOT NEW."display_order" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_brands_delete
AFTER DELETE ON product_brands
BEGIN
  UPDATE public_cache_versions SET catalog = catalog + 1, taxonomy = taxonomy + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_services_insert
AFTER INSERT ON services
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_services_update
AFTER UPDATE ON services
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."name" IS NOT NEW."name" OR OLD."name_en" IS NOT NEW."name_en" OR OLD."name_ru" IS NOT NEW."name_ru" OR OLD."name_cn" IS NOT NEW."name_cn" OR OLD."description" IS NOT NEW."description" OR OLD."description_en" IS NOT NEW."description_en" OR OLD."description_ru" IS NOT NEW."description_ru" OR OLD."description_cn" IS NOT NEW."description_cn" OR OLD."long_description" IS NOT NEW."long_description" OR OLD."long_description_en" IS NOT NEW."long_description_en" OR OLD."long_description_ru" IS NOT NEW."long_description_ru" OR OLD."long_description_cn" IS NOT NEW."long_description_cn" OR OLD."benefits_json" IS NOT NEW."benefits_json" OR OLD."benefits_en_json" IS NOT NEW."benefits_en_json" OR OLD."benefits_ru_json" IS NOT NEW."benefits_ru_json" OR OLD."benefits_cn_json" IS NOT NEW."benefits_cn_json" OR OLD."faq_items_json" IS NOT NEW."faq_items_json" OR OLD."local_seo_tags_json" IS NOT NEW."local_seo_tags_json" OR OLD."price" IS NOT NEW."price" OR OLD."duration_minutes" IS NOT NEW."duration_minutes" OR OLD."image_path" IS NOT NEW."image_path" OR OLD."icon" IS NOT NEW."icon" OR OLD."is_published" IS NOT NEW."is_published" OR OLD."is_featured" IS NOT NEW."is_featured" OR OLD."created_at" IS NOT NEW."created_at" OR OLD."vat_category_code" IS NOT NEW."vat_category_code" OR OLD."vat_classification_approved_at" IS NOT NEW."vat_classification_approved_at" OR OLD."vat_classification_approved_by" IS NOT NEW."vat_classification_approved_by")
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_services_delete
AFTER DELETE ON services
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_procedure_steps_insert
AFTER INSERT ON procedure_steps
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_procedure_steps_update
AFTER UPDATE ON procedure_steps
WHEN (OLD."id" IS NOT NEW."id" OR OLD."service_id" IS NOT NEW."service_id" OR OLD."step_number" IS NOT NEW."step_number" OR OLD."title" IS NOT NEW."title" OR OLD."description" IS NOT NEW."description" OR OLD."created_at" IS NOT NEW."created_at" OR OLD."title_en" IS NOT NEW."title_en" OR OLD."title_ru" IS NOT NEW."title_ru" OR OLD."title_cn" IS NOT NEW."title_cn" OR OLD."description_en" IS NOT NEW."description_en" OR OLD."description_ru" IS NOT NEW."description_ru" OR OLD."description_cn" IS NOT NEW."description_cn" OR OLD."image_path" IS NOT NEW."image_path")
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_procedure_steps_delete
AFTER DELETE ON procedure_steps
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_posts_insert
AFTER INSERT ON blog_posts
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_posts_update
AFTER UPDATE ON blog_posts
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."category_slug" IS NOT NEW."category_slug" OR OLD."author_id" IS NOT NEW."author_id" OR OLD."title" IS NOT NEW."title" OR OLD."title_en" IS NOT NEW."title_en" OR OLD."title_ru" IS NOT NEW."title_ru" OR OLD."title_cn" IS NOT NEW."title_cn" OR OLD."summary" IS NOT NEW."summary" OR OLD."summary_en" IS NOT NEW."summary_en" OR OLD."summary_ru" IS NOT NEW."summary_ru" OR OLD."summary_cn" IS NOT NEW."summary_cn" OR OLD."content" IS NOT NEW."content" OR OLD."content_en" IS NOT NEW."content_en" OR OLD."content_ru" IS NOT NEW."content_ru" OR OLD."content_cn" IS NOT NEW."content_cn" OR OLD."image_path" IS NOT NEW."image_path" OR OLD."meta_description" IS NOT NEW."meta_description" OR OLD."meta_keywords" IS NOT NEW."meta_keywords" OR OLD."canonical_url" IS NOT NEW."canonical_url" OR OLD."local_seo_tags_json" IS NOT NEW."local_seo_tags_json" OR OLD."status" IS NOT NEW."status" OR OLD."published_at" IS NOT NEW."published_at" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_posts_delete
AFTER DELETE ON blog_posts
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_categories_insert
AFTER INSERT ON blog_categories
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_categories_update
AFTER UPDATE ON blog_categories
WHEN (OLD."id" IS NOT NEW."id" OR OLD."slug" IS NOT NEW."slug" OR OLD."name" IS NOT NEW."name" OR OLD."name_en" IS NOT NEW."name_en" OR OLD."name_ru" IS NOT NEW."name_ru" OR OLD."name_cn" IS NOT NEW."name_cn" OR OLD."description" IS NOT NEW."description" OR OLD."display_order" IS NOT NEW."display_order" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_blog_categories_delete
AFTER DELETE ON blog_categories
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_site_content_insert
AFTER INSERT ON site_content
WHEN (NEW.resource IN ('about_features','about_page_content','about_values','auth_page_images','faq_items','featured_doctors','featured_posts','footer_content','homepage_hero','payment_settings','site_info','doctors','procedure_steps'))
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_site_content_update
AFTER UPDATE ON site_content
WHEN (OLD."resource" IS NOT NEW."resource" OR OLD."resource_key" IS NOT NEW."resource_key" OR OLD."payload_json" IS NOT NEW."payload_json" OR OLD."is_published" IS NOT NEW."is_published" OR OLD."created_at" IS NOT NEW."created_at") AND (OLD.resource IN ('about_features','about_page_content','about_values','auth_page_images','faq_items','featured_doctors','featured_posts','footer_content','homepage_hero','payment_settings','site_info','doctors','procedure_steps') OR NEW.resource IN ('about_features','about_page_content','about_values','auth_page_images','faq_items','featured_doctors','featured_posts','footer_content','homepage_hero','payment_settings','site_info','doctors','procedure_steps'))
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_site_content_delete
AFTER DELETE ON site_content
WHEN (OLD.resource IN ('about_features','about_page_content','about_values','auth_page_images','faq_items','featured_doctors','featured_posts','footer_content','homepage_hero','payment_settings','site_info','doctors','procedure_steps'))
BEGIN
  UPDATE public_cache_versions SET content = content + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_reviews_insert
AFTER INSERT ON product_reviews
BEGIN
  UPDATE public_cache_versions SET reviews = reviews + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_reviews_update
AFTER UPDATE ON product_reviews
WHEN (OLD."id" IS NOT NEW."id" OR OLD."product_id" IS NOT NEW."product_id" OR OLD."user_id" IS NOT NEW."user_id" OR OLD."rating" IS NOT NEW."rating" OR OLD."title" IS NOT NEW."title" OR OLD."comment" IS NOT NEW."comment" OR OLD."verified_purchase" IS NOT NEW."verified_purchase" OR OLD."is_published" IS NOT NEW."is_published" OR OLD."created_at" IS NOT NEW."created_at")
BEGIN
  UPDATE public_cache_versions SET reviews = reviews + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_reviews_delete
AFTER DELETE ON product_reviews
BEGIN
  UPDATE public_cache_versions SET reviews = reviews + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_ingredient_snapshots_insert
AFTER INSERT ON product_ingredient_snapshots
BEGIN
  UPDATE public_cache_versions SET ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_ingredient_snapshots_update
AFTER UPDATE ON product_ingredient_snapshots
WHEN (OLD."product_id" IS NOT NEW."product_id" OR OLD."inci_text" IS NOT NEW."inci_text" OR OLD."inci_hash" IS NOT NEW."inci_hash" OR OLD."analysis_json" IS NOT NEW."analysis_json" OR OLD."recognized_count" IS NOT NEW."recognized_count" OR OLD."total_count" IS NOT NEW."total_count" OR OLD."analyzer_version" IS NOT NEW."analyzer_version" OR OLD."analyzed_at" IS NOT NEW."analyzed_at")
BEGIN
  UPDATE public_cache_versions SET ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_product_ingredient_snapshots_delete
AFTER DELETE ON product_ingredient_snapshots
BEGIN
  UPDATE public_cache_versions SET ingredients = ingredients + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_cache_review_author_update
AFTER UPDATE OF display_name ON users WHEN OLD.display_name IS NOT NEW.display_name
BEGIN
  UPDATE public_cache_versions SET reviews = reviews + 1 WHERE id = 1;
END;
