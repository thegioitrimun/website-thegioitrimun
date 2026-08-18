-- Migration: add_insert_policy_product_order_items
-- Description: Adds a permissive INSERT policy to product_order_items to allow unauthenticated checkouts.

-- Allow anyone to insert order items (relies on unguessable UUIDs for order_id to prevent abuse)
CREATE POLICY "Anyone can insert order items" ON "public"."product_order_items" FOR INSERT WITH CHECK (true);
