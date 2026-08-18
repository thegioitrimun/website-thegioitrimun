-- Add slug column to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Function to generate slug
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Lowercase and replace non-alphanumeric with hyphen
  -- Also handle Vietnamese characters
  base_slug := lower(title);
  base_slug := translate(base_slug, 'áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ', 'aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  new_slug := base_slug;
  
  -- Ensure uniqueness in services
  WHILE EXISTS (SELECT 1 FROM services WHERE slug = new_slug) LOOP
    new_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN new_slug;
END;
$$ LANGUAGE plpgsql;

-- Generate slugs for existing services
UPDATE services SET slug = generate_slug(name) WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE services ALTER COLUMN slug SET NOT NULL;
