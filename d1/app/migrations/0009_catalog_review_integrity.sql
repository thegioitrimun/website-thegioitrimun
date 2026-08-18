PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_product_path_uidx
ON product_images(product_id, image_path);

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_user_product_uidx
ON product_reviews(user_id, product_id)
WHERE user_id IS NOT NULL;

