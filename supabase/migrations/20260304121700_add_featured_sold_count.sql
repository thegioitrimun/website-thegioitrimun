-- Migration: Add featured and sold counts to products table for Homepage sections

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;

-- Optional: Add an index on these columns for faster sorting/filtering on the homepage
CREATE INDEX IF NOT EXISTS products_is_featured_idx ON products(is_featured);
CREATE INDEX IF NOT EXISTS products_sold_count_idx ON products(sold_count DESC);
