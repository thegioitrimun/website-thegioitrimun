-- Add is_featured column to product_categories table
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Create an index for faster querying on the homepage
CREATE INDEX IF NOT EXISTS product_categories_is_featured_idx ON product_categories(is_featured);
