-- Match the filters used by recurring outbox maintenance and public catalog reads.
CREATE INDEX IF NOT EXISTS pancake_outbox_type_status_created_idx
  ON pancake_sync_outbox(entity_type, status, created_at, id);
CREATE INDEX IF NOT EXISTS telegram_outbox_retention_idx
  ON telegram_order_outbox(status, accepted_at);
CREATE INDEX IF NOT EXISTS products_public_id_idx
  ON products(is_published, id DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS products_public_name_idx
  ON products(is_published, name) WHERE archived_at IS NULL;

-- Cover the image response as well as its per-product ordering, avoiding table lookups.
CREATE INDEX IF NOT EXISTS product_images_read_idx ON product_images(
  product_id, is_primary DESC, display_order, id, image_path, alt_text, created_at, updated_at
);
DROP INDEX IF EXISTS product_images_product_idx;

-- A durable dirty set replaces the recurring product/snapshot full comparison.
-- A unique generation protects edits made while analysis is running, including delete/reinsert.
CREATE TABLE IF NOT EXISTS product_ingredient_dirty (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  generation TEXT NOT NULL DEFAULT (lower(hex(randomblob(16))))
);
CREATE TRIGGER IF NOT EXISTS product_ingredient_dirty_insert
AFTER INSERT ON products
WHEN NEW.is_published = 1
 AND trim(COALESCE(NULLIF(trim(NEW.ingredients), ''), NULLIF(trim(NEW.inci_text), ''), '')) <> ''
BEGIN
  INSERT INTO product_ingredient_dirty(product_id) VALUES (NEW.id)
  ON CONFLICT(product_id) DO UPDATE SET generation = lower(hex(randomblob(16)));
END;
CREATE TRIGGER IF NOT EXISTS product_ingredient_dirty_update
AFTER UPDATE ON products
WHEN NEW.updated_at IS NOT OLD.updated_at
 OR NEW.ingredients IS NOT OLD.ingredients OR NEW.inci_text IS NOT OLD.inci_text
 OR NEW.is_published IS NOT OLD.is_published
BEGIN
  DELETE FROM product_ingredient_dirty WHERE product_id = NEW.id
    AND (NEW.is_published <> 1 OR trim(COALESCE(NULLIF(trim(NEW.ingredients), ''), NULLIF(trim(NEW.inci_text), ''), '')) = '');
  INSERT INTO product_ingredient_dirty(product_id)
  SELECT NEW.id WHERE NEW.is_published = 1
    AND trim(COALESCE(NULLIF(trim(NEW.ingredients), ''), NULLIF(trim(NEW.inci_text), ''), '')) <> ''
  ON CONFLICT(product_id) DO UPDATE SET generation = lower(hex(randomblob(16)));
END;
INSERT INTO product_ingredient_dirty(product_id)
SELECT p.id FROM products p LEFT JOIN product_ingredient_snapshots s ON s.product_id = p.id
WHERE p.is_published = 1
  AND trim(COALESCE(NULLIF(trim(p.ingredients), ''), NULLIF(trim(p.inci_text), ''), '')) <> ''
  AND (s.product_id IS NULL OR s.source_updated_at IS NULL OR s.source_updated_at <> p.updated_at)
ON CONFLICT(product_id) DO NOTHING;
