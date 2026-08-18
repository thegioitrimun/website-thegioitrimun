-- Migration: phase2_refund_cap_hotfix
-- Description: Prevent cumulative over-refund beyond order grand total.

CREATE OR REPLACE FUNCTION public.create_order_refund(
  p_order_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT false
)
RETURNS public.product_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text := COALESCE(auth.role(), 'system');
  v_order public.product_orders%ROWTYPE;
  v_refund public.order_refunds%ROWTYPE;
  v_order_total numeric := 0;
  v_total_refunded numeric := 0;
  v_full_refund boolean := false;
  rec record;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo hoàn tiền.';
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Số tiền hoàn phải lớn hơn 0.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.product_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng.';
  END IF;

  IF v_order.payment_status NOT IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN
    RAISE EXCEPTION 'Đơn hàng chưa ở trạng thái có thể hoàn tiền.';
  END IF;

  v_order_total := ROUND(COALESCE(v_order.grand_total, v_order.total_price, 0), 2);

  IF ROUND(p_amount, 2) > v_order_total THEN
    RAISE EXCEPTION 'Số tiền hoàn (%) không được vượt tổng đơn (%).', p_amount, v_order_total;
  END IF;

  SELECT COALESCE(SUM(r.amount), 0)
  INTO v_total_refunded
  FROM public.order_refunds r
  WHERE r.order_id = p_order_id
    AND r.status = 'completed';

  IF v_total_refunded + ROUND(p_amount, 2) > v_order_total THEN
    RAISE EXCEPTION 'Tổng tiền hoàn (%) vượt tổng đơn (%).', v_total_refunded + ROUND(p_amount, 2), v_order_total;
  END IF;

  IF p_restock AND EXISTS (
    SELECT 1
    FROM public.order_refunds r
    WHERE r.order_id = p_order_id
      AND r.restocked = true
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Đơn hàng này đã hoàn kho trước đó.';
  END IF;

  INSERT INTO public.order_refunds (
    order_id,
    amount,
    reason,
    status,
    restocked,
    refunded_at,
    created_by
  ) VALUES (
    p_order_id,
    ROUND(p_amount, 2),
    NULLIF(btrim(p_reason), ''),
    'completed',
    false,
    now(),
    v_actor_id
  )
  RETURNING * INTO v_refund;

  IF p_restock THEN
    FOR rec IN
      SELECT
        oi.product_id,
        oi.quantity
      FROM public.product_order_items oi
      WHERE oi.order_id = p_order_id
    LOOP
      UPDATE public.products
      SET
        stock_quantity = COALESCE(stock_quantity, 0) + rec.quantity,
        sold_count = GREATEST(COALESCE(sold_count, 0) - rec.quantity, 0)
      WHERE id = rec.product_id;
    END LOOP;

    UPDATE public.order_refunds
    SET restocked = true
    WHERE id = v_refund.id;

    v_refund.restocked := true;
  END IF;

  v_total_refunded := v_total_refunded + ROUND(p_amount, 2);
  v_full_refund := v_total_refunded >= v_order_total;

  UPDATE public.product_orders
  SET
    payment_status = CASE
      WHEN v_full_refund THEN 'refunded'::public.payment_status
      ELSE payment_status
    END,
    status = CASE
      WHEN v_full_refund THEN 'refunded'::public.order_status
      ELSE status
    END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_payments (
    order_id,
    method,
    amount,
    status,
    transaction_ref,
    paid_at,
    metadata
  ) VALUES (
    p_order_id,
    v_order.payment_method,
    ROUND(p_amount, 2),
    'refunded'::public.payment_status,
    NULL,
    now(),
    jsonb_build_object(
      'source', 'create_order_refund',
      'refund_id', v_refund.id,
      'reason', COALESCE(v_refund.reason, ''),
      'restocked', COALESCE(v_refund.restocked, false),
      'actor_role', CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE COALESCE(v_actor_role, 'admin') END
    )
  );

  RETURN v_order;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_refund(
  uuid,
  numeric,
  text,
  boolean
) TO authenticated, service_role;
