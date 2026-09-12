import sqlite3
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

class CacheTriggersTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        for path in sorted((ROOT/'d1/app/migrations').glob('*.sql')):
            self.db.executescript(path.read_text())

    def versions(self):
        return self.db.execute('SELECT catalog,taxonomy,content,reviews,ingredients FROM public_cache_versions WHERE id=1').fetchone()

    def product(self):
        self.db.execute("INSERT INTO products(id,slug,name,is_published,created_at,updated_at) VALUES(1,'test','Test',1,'a','a')")

    def test_admin_pancake_checkout_writes_invalidate_without_call_site_hooks(self):
        self.product()
        for sql in ["UPDATE products SET price=100 WHERE id=1", "UPDATE products SET stock_quantity=10 WHERE id=1", "UPDATE products SET stock_quantity=stock_quantity-1 WHERE id=1"]:
            before=self.versions()
            self.db.execute(sql)
            after=self.versions()
            self.assertEqual(before[0]+1, after[0])
            self.assertEqual(before[2], after[2])
        before=self.versions()
        self.db.execute("UPDATE products SET updated_at='b' WHERE id=1")
        self.assertEqual(before, self.versions())

    def test_rollback_does_not_invalidate(self):
        self.product()
        self.db.commit()
        before=self.versions()
        self.db.execute('UPDATE products SET price=100 WHERE id=1')
        self.db.rollback()
        self.assertEqual(before, self.versions())

    def test_insert_delete_and_related_images_invalidate(self):
        self.product()
        before=self.versions()
        self.db.execute("INSERT INTO product_images(id,product_id,image_path,created_at,updated_at) VALUES('img',1,'img.webp','a','a')")
        self.assertEqual(before[0]+1, self.versions()[0])
        self.db.execute("DELETE FROM product_images WHERE id='img'")
        self.assertEqual(before[0]+2, self.versions()[0])
        self.db.execute('DELETE FROM products WHERE id=1')
        self.assertEqual(before[0]+3, self.versions()[0])

    def test_content_and_taxonomy_have_independent_versions(self):
        before=self.versions()
        self.db.execute("INSERT INTO product_categories(id,slug,name,created_at,updated_at) VALUES(1,'cat','Cat','a','a')")
        after=self.versions()
        self.assertEqual(before[1]+1, after[1])
        self.assertEqual(before[2], after[2])
        self.db.execute("INSERT INTO blog_categories(id,slug,name,created_at,updated_at) VALUES(1,'blog','Blog','a','a')")
        self.assertEqual(after[2]+1, self.versions()[2])
        self.assertEqual(after[1], self.versions()[1])

if __name__=='__main__': unittest.main()
