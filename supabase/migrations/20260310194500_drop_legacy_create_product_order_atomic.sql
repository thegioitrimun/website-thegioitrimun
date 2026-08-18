-- Migration: drop_legacy_create_product_order_atomic
-- Description: Remove the legacy create_product_order_atomic overload without idempotency key.

DROP FUNCTION IF EXISTS public.create_product_order_atomic(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  public.order_status,
  text,
  jsonb
);
