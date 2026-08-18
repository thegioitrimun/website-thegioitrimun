-- Migration: Add translation columns to products, blog_posts, product_categories
-- Languages: English (_en), Russian (_ru), Chinese (_cn)
-- Default language: Vietnamese (original columns)

-- =============================================
-- 1. PRODUCTS TABLE
-- =============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_en text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_ru text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_cn text[];

ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_cn text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_ru text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_cn text;

-- =============================================
-- 2. BLOG_POSTS TABLE
-- =============================================
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title_en text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title_ru text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title_cn text;

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS summary_en text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS summary_ru text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS summary_cn text;

-- =============================================
-- 3. PRODUCT_CATEGORIES TABLE
-- =============================================
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_cn text;

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description_cn text;

-- =============================================
-- 4. BLOG_CATEGORIES TABLE  
-- =============================================
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS name_cn text;
