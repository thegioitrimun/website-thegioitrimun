SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1));
SELECT setval('product_categories_id_seq', COALESCE((SELECT MAX(id) FROM product_categories), 1));
SELECT setval('product_brands_id_seq', COALESCE((SELECT MAX(id) FROM product_brands), 1));
SELECT setval('product_images_id_seq', COALESCE((SELECT MAX(id) FROM product_images), 1));
