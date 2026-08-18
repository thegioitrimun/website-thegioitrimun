-- Migration: phase2_order_lifecycle_payment_refund
-- Description:
-- 1) Adds payment/fulfillment foundation on product_orders.
-- 2) Adds lifecycle/payment/refund log tables with RLS.
-- 3) Adds state-machine RPC transition_order_status(...).
-- 4) Adds refund RPC create_order_refund(...), including optional inventory restock.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'failed', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
    CREATE TYPE public.fulfillment_status AS ENUM ('pending', 'processing', 'shipped', 'completed', 'cancelled');
  END IF;
END
$$;

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status,
  ADD COLUMN IF NOT EXISTS fulfillment_status public.fulfillment_status;

ALTER TABLE public.product_orders
  ALTER COLUMN payment_method SET DEFAULT 'cod',
  ALTER COLUMN payment_status SET DEFAULT 'unpaid',
  ALTER COLUMN fulfillment_status SET DEFAULT 'pending';

UPDATE public.product_orders
SET payment_method = CASE
  WHEN lower(COALESCE(payment_method, '')) IN ('cod', 'bank_transfer') THEN lower(payment_method)
  WHEN status = 'pending'::public.order_status THEN 'bank_transfer'
  ELSE 'cod'
END
WHERE payment_method IS NULL
   OR lower(COALESCE(payment_method, '')) NOT IN ('cod', 'bank_transfer');

UPDATE public.product_orders
SET fulfillment_status = CASE status
  WHEN 'pending'::public.order_status THEN 'pending'::public.fulfillment_status
  WHEN 'processing'::public.order_status THEN 'processing'::public.fulfillment_status
  WHEN 'shipped'::public.order_status THEN 'shipped'::public.fulfillment_status
  WHEN 'completed'::public.order_status THEN 'completed'::public.fulfillment_status
  WHEN 'cancelled'::public.order_status THEN 'cancelled'::public.fulfillment_status
  WHEN 'refunded'::public.order_status THEN 'completed'::public.fulfillment_status
  ELSE 'pending'::public.fulfillment_status
END
WHERE fulfillment_status IS NULL;

UPDATE public.product_orders
SET payment_status = CASE
  WHEN status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
  WHEN status = 'completed'::public.order_status THEN 'paid'::public.payment_status
  ELSE 'unpaid'::public.payment_status
END
WHERE payment_status IS NULL;

ALTER TABLE public.product_orders
  ALTER COLUMN payment_method SET NOT NULL,
  ALTER COLUMN payment_status SET NOT NULL,
  ALTER COLUMN fulfillment_status SET NOT NULL;

ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_payment_method_check;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_payment_method_check
  CHECK (payment_method IN ('cod', 'bank_transfer'));

CREATE INDEX IF NOT EXISTS product_orders_payment_status_idx
  ON public.product_orders(payment_status);

CREATE INDEX IF NOT EXISTS product_orders_fulfillment_status_idx
  ON public.product_orders(fulfillment_status);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  from_status public.fulfillment_status,
  to_status public.fulfillment_status NOT NULL,
  actor_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  actor_role text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_created_idx
  ON public.order_status_history(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'cod',
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status public.payment_status NOT NULL,
  transaction_ref text,
  paid_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_payments
  DROP CONSTRAINT IF EXISTS order_payments_method_check;

ALTER TABLE public.order_payments
  ADD CONSTRAINT order_payments_method_check
  CHECK (method IN ('cod', 'bank_transfer'));

CREATE INDEX IF NOT EXISTS order_payments_order_created_idx
  ON public.order_payments(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'completed',
  restocked boolean NOT NULL DEFAULT false,
  refunded_at timestamp with time zone,
  created_by uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_refunds
  DROP CONSTRAINT IF EXISTS order_refunds_status_check;

ALTER TABLE public.order_refunds
  ADD CONSTRAINT order_refunds_status_check
  CHECK (status IN ('pending', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS order_refunds_order_created_idx
  ON public.order_refunds(order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_restock_once_uidx
  ON public.order_refunds(order_id)
  WHERE restocked = true AND status = 'completed';

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order status history" ON public.order_status_history;
CREATE POLICY "Users can view own order status history"
  ON public.order_status_history
  FOR SELECT
  USING (
    (SELECT po.user_id FROM public.product_orders po WHERE po.id = order_id) = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can manage order status history" ON public.order_status_history;
CREATE POLICY "Admins can manage order status history"
  ON public.order_status_history
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own order payments" ON public.order_payments;
CREATE POLICY "Users can view own order payments"
  ON public.order_payments
  FOR SELECT
  USING (
    (SELECT po.user_id FROM public.product_orders po WHERE po.id = order_id) = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can manage order payments" ON public.order_payments;
CREATE POLICY "Admins can manage order payments"
  ON public.order_payments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own order refunds" ON public.order_refunds;
CREATE POLICY "Users can view own order refunds"
  ON public.order_refunds
  FOR SELECT
  USING (
    (SELECT po.user_id FROM public.product_orders po WHERE po.id = order_id) = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can manage order refunds" ON public.order_refunds;
CREATE POLICY "Admins can manage order refunds"
  ON public.order_refunds
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.sync_product_order_lifecycle_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_inferred_fulfillment public.fulfillment_status := 'pending'::public.fulfillment_status;
BEGIN
  IF NEW.status = 'pending'::public.order_status THEN
    v_inferred_fulfillment := 'pending'::public.fulfillment_status;
  ELSIF NEW.status = 'processing'::public.order_status THEN
    v_inferred_fulfillment := 'processing'::public.fulfillment_status;
  ELSIF NEW.status = 'shipped'::public.order_status THEN
    v_inferred_fulfillment := 'shipped'::public.fulfillment_status;
  ELSIF NEW.status = 'completed'::public.order_status THEN
    v_inferred_fulfillment := 'completed'::public.fulfillment_status;
  ELSIF NEW.status = 'cancelled'::public.order_status THEN
    v_inferred_fulfillment := 'cancelled'::public.fulfillment_status;
  ELSIF NEW.status = 'refunded'::public.order_status THEN
    IF TG_OP = 'UPDATE' AND OLD.fulfillment_status IS NOT NULL THEN
      v_inferred_fulfillment := OLD.fulfillment_status;
    ELSE
      v_inferred_fulfillment := 'completed'::public.fulfillment_status;
    END IF;
  END IF;

  IF NEW.payment_method IS NULL OR NEW.payment_method NOT IN ('cod', 'bank_transfer') THEN
    NEW.payment_method := CASE
      WHEN NEW.status = 'pending'::public.order_status THEN 'bank_transfer'
      ELSE 'cod'
    END;
  END IF;

  IF NEW.fulfillment_status IS NULL THEN
    NEW.fulfillment_status := v_inferred_fulfillment;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status::text IN ('pending', 'processing', 'shipped', 'completed', 'cancelled') THEN
      NEW.fulfillment_status := NEW.status::text::public.fulfillment_status;
    END IF;

    IF NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status THEN
      NEW.status := NEW.fulfillment_status::text::public.order_status;
    END IF;
  END IF;

  IF NEW.payment_status IS NULL THEN
    NEW.payment_status := CASE
      WHEN NEW.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
      WHEN NEW.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
      ELSE 'unpaid'::public.payment_status
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS sync_product_order_lifecycle_columns_tg ON public.product_orders;
CREATE TRIGGER sync_product_order_lifecycle_columns_tg
BEFORE INSERT OR UPDATE ON public.product_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_order_lifecycle_columns();

CREATE OR REPLACE FUNCTION public.seed_order_lifecycle_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_status_history osh
    WHERE osh.order_id = NEW.id
  ) THEN
    INSERT INTO public.order_status_history (
      order_id,
      from_status,
      to_status,
      actor_id,
      actor_role,
      note,
      created_at
    ) VALUES (
      NEW.id,
      NULL,
      NEW.fulfillment_status,
      NEW.user_id,
      COALESCE(auth.role(), 'system'),
      'Order created',
      COALESCE(NEW.created_at, now())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_payments op
    WHERE op.order_id = NEW.id
  ) THEN
    INSERT INTO public.order_payments (
      order_id,
      method,
      amount,
      status,
      transaction_ref,
      paid_at,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      NEW.payment_method,
      ROUND(COALESCE(NEW.grand_total, NEW.total_price, 0), 2),
      NEW.payment_status,
      NULL,
      CASE
        WHEN NEW.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
          THEN COALESCE(NEW.created_at, now())
        ELSE NULL
      END,
      jsonb_build_object('source', 'order_created'),
      COALESCE(NEW.created_at, now())
    );
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seed_order_lifecycle_logs_tg ON public.product_orders;
CREATE TRIGGER seed_order_lifecycle_logs_tg
AFTER INSERT ON public.product_orders
FOR EACH ROW
EXECUTE FUNCTION public.seed_order_lifecycle_logs();

INSERT INTO public.order_status_history (
  order_id,
  from_status,
  to_status,
  actor_id,
  actor_role,
  note,
  created_at
)
SELECT
  po.id,
  NULL,
  po.fulfillment_status,
  po.user_id,
  'system',
  'Backfill lifecycle seed',
  po.created_at
FROM public.product_orders po
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_status_history osh
  WHERE osh.order_id = po.id
);

INSERT INTO public.order_payments (
  order_id,
  method,
  amount,
  status,
  transaction_ref,
  paid_at,
  metadata,
  created_at
)
SELECT
  po.id,
  po.payment_method,
  ROUND(COALESCE(po.grand_total, po.total_price, 0), 2),
  po.payment_status,
  NULL,
  CASE
    WHEN po.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      THEN po.created_at
    ELSE NULL
  END,
  jsonb_build_object('source', 'backfill'),
  po.created_at
FROM public.product_orders po
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_payments op
  WHERE op.order_id = po.id
);

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_to_status public.fulfillment_status,
  p_note text DEFAULT NULL
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
  v_from_status public.fulfillment_status;
  v_prev_payment_status public.payment_status;
  v_allowed boolean := false;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái đơn hàng.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.product_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng.';
  END IF;

  v_from_status := v_order.fulfillment_status;

  IF v_from_status = p_to_status THEN
    RAISE EXCEPTION 'Đơn hàng đã ở trạng thái mục tiêu.';
  END IF;

  v_allowed := CASE v_from_status
    WHEN 'pending'::public.fulfillment_status THEN p_to_status IN ('processing'::public.fulfillment_status, 'cancelled'::public.fulfillment_status)
    WHEN 'processing'::public.fulfillment_status THEN p_to_status IN ('shipped'::public.fulfillment_status, 'cancelled'::public.fulfillment_status)
    WHEN 'shipped'::public.fulfillment_status THEN p_to_status IN ('completed'::public.fulfillment_status, 'cancelled'::public.fulfillment_status)
    WHEN 'completed'::public.fulfillment_status THEN false
    WHEN 'cancelled'::public.fulfillment_status THEN false
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Không thể chuyển trạng thái từ % sang %.', v_from_status, p_to_status;
  END IF;

  v_prev_payment_status := v_order.payment_status;

  UPDATE public.product_orders
  SET
    fulfillment_status = p_to_status,
    payment_status = CASE
      WHEN p_to_status = 'completed'::public.fulfillment_status
           AND payment_status IN ('unpaid'::public.payment_status, 'failed'::public.payment_status)
        THEN 'paid'::public.payment_status
      WHEN p_to_status = 'cancelled'::public.fulfillment_status
           AND payment_status = 'unpaid'::public.payment_status
           AND payment_method = 'bank_transfer'
        THEN 'failed'::public.payment_status
      ELSE payment_status
    END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    actor_id,
    actor_role,
    note
  ) VALUES (
    v_order.id,
    v_from_status,
    p_to_status,
    v_actor_id,
    CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE COALESCE(v_actor_role, 'admin') END,
    NULLIF(btrim(p_note), '')
  );

  IF v_prev_payment_status IS DISTINCT FROM v_order.payment_status THEN
    INSERT INTO public.order_payments (
      order_id,
      method,
      amount,
      status,
      transaction_ref,
      paid_at,
      metadata
    ) VALUES (
      v_order.id,
      v_order.payment_method,
      CASE
        WHEN v_order.payment_status = 'paid'::public.payment_status
          THEN ROUND(COALESCE(v_order.grand_total, v_order.total_price, 0), 2)
        ELSE 0
      END,
      v_order.payment_status,
      NULL,
      CASE WHEN v_order.payment_status = 'paid'::public.payment_status THEN now() ELSE NULL END,
      jsonb_build_object(
        'source', 'transition_order_status',
        'from_status', v_from_status,
        'to_status', p_to_status
      )
    );
  END IF;

  RETURN v_order;
END;
$fn$;

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

GRANT EXECUTE ON FUNCTION public.transition_order_status(
  uuid,
  public.fulfillment_status,
  text
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_order_refund(
  uuid,
  numeric,
  text,
  boolean
) TO authenticated, service_role;
