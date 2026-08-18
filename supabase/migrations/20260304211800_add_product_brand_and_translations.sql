-- Migration: add_product_brand_and_translations
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;

-- Translation columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_instructions_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_en TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_ru TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS key_benefits_cn TEXT[];

ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precautions_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_cn TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_ru TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_cn TEXT;

-- Notify PostgREST to reload the schema cache so the API recognizes the new columns immediately
NOTIFY pgrst, 'reload schema';
