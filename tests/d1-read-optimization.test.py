"""Real SQLite regression checks for the dirty-set migration and query plans."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class ReadOptimizationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        paths = sorted((ROOT / 'd1/app/migrations').glob('*.sql'))
        for path in paths:
            if path.name < '0023':
                self.db.executescript(path.read_text())
        self.db.execute("INSERT INTO products(id,slug,name,ingredients,is_published,created_at,updated_at) VALUES (1,'test','Test','Aqua',1,'a','a')")
        self.db.executescript((ROOT / 'd1/app/migrations/0023_reduce_rows_read.sql').read_text())

    def generation(self):
        return self.db.execute('SELECT generation FROM product_ingredient_dirty WHERE product_id=1').fetchone()

    def test_backfill_and_edit_during_analysis(self):
        old = self.generation()[0]
        self.db.execute("UPDATE products SET ingredients='Glycerin' WHERE id=1")
        self.db.execute('DELETE FROM product_ingredient_dirty WHERE product_id=1 AND generation=?', (old,))
        new = self.generation()[0]
        self.assertNotEqual(new, old)
        self.db.execute('DELETE FROM product_ingredient_dirty WHERE product_id=1 AND generation=?', (new,))
        self.assertIsNone(self.generation())

    def test_unpublish_republish_does_not_reuse_generation(self):
        old = self.generation()[0]
        self.db.execute('UPDATE products SET is_published=0 WHERE id=1')
        self.assertIsNone(self.generation())
        self.db.execute('UPDATE products SET is_published=1 WHERE id=1')
        self.assertNotEqual(old, self.generation()[0])

    def test_empty_ingredients_and_product_deletion(self):
        self.db.execute("UPDATE products SET ingredients=' ' WHERE id=1")
        self.assertIsNone(self.generation())
        self.db.execute("UPDATE products SET inci_text='Aqua' WHERE id=1")
        self.assertIsNotNone(self.generation())
        self.db.execute('DELETE FROM products WHERE id=1')
        self.assertIsNone(self.generation())

    def test_insert_and_non_ingredient_edits_preserve_snapshot_revision_semantics(self):
        self.db.execute('DELETE FROM product_ingredient_dirty')
        self.db.execute("UPDATE products SET updated_at='b' WHERE id=1")
        self.assertIsNotNone(self.generation())
        self.db.execute("INSERT INTO products(id,slug,name,ingredients,is_published,created_at,updated_at) VALUES (2,'two','Two','Aqua',1,'a','a')")
        self.assertEqual(2, self.db.execute('SELECT count(*) FROM product_ingredient_dirty').fetchone()[0])

    def test_snapshot_write_rejects_stale_product_revision(self):
        source = (ROOT / 'worker/ingredientAnalyzer/productSyncD1.js').read_text()
        source = source.split('export async function syncD1ProductIngredientSnapshots', 1)[1]
        sql = re.search(r'prepare\(`(INSERT INTO product_ingredient_snapshots.*?)`\)', source, re.S).group(1)
        params = [1, 'Aqua', 'hash', '{}', 1, 1, 'v1', 'a', 'a', 'a', 1, 'a', 'Aqua', None]
        self.db.execute(sql, params)
        self.assertEqual('Aqua', self.db.execute('SELECT inci_text FROM product_ingredient_snapshots').fetchone()[0])
        self.db.execute("UPDATE products SET ingredients='Glycerin', updated_at='b' WHERE id=1")
        current = [1, 'Glycerin', 'new-hash', '{}', 1, 1, 'v1', 'b', 'b', 'b', 1, 'b', 'Glycerin', None]
        self.db.execute(sql, current)
        self.db.execute(sql, params)
        self.assertEqual('Glycerin', self.db.execute('SELECT inci_text FROM product_ingredient_snapshots').fetchone()[0])

    def test_indexes_match_filters_and_image_response(self):
        queries = [
            ("SELECT id FROM pancake_sync_outbox WHERE entity_type IN ('product','inventory') AND status IN ('pending','retrying') ORDER BY created_at LIMIT 50", 'pancake_outbox_type_status_created_idx'),
            ("SELECT id FROM telegram_order_outbox WHERE status='accepted' AND accepted_at<'a'", 'telegram_outbox_retention_idx'),
            ("SELECT * FROM products WHERE is_published=1 AND archived_at IS NULL ORDER BY name LIMIT 48", 'products_public_name_idx'),
            ("SELECT * FROM products WHERE is_published=1 AND archived_at IS NULL ORDER BY id DESC LIMIT 48", 'products_public_id_idx'),
            ("SELECT * FROM product_images WHERE product_id IN (1,2) ORDER BY product_id,is_primary DESC,display_order,id", 'COVERING INDEX product_images_read_idx'),
        ]
        for sql, index in queries:
            plan = str(self.db.execute('EXPLAIN QUERY PLAN '+sql).fetchall())
            self.assertIn(index, plan)

if __name__ == '__main__':
    unittest.main()
