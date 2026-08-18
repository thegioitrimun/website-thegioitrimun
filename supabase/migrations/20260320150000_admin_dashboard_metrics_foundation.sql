-- Migration: admin_dashboard_metrics_foundation
-- Description:
-- 1) Adds security-checked RPCs for admin dashboard KPIs
-- 2) Adds timeseries, customer, inventory, top products/services, and alert feed metrics

CREATE OR REPLACE FUNCTION public.admin_dashboard_assert_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền truy cập dashboard quản trị.';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_kpi_snapshot(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  total_orders bigint,
  paid_orders bigint,
  pending_orders bigint,
  completed_orders bigint,
  cancelled_orders bigint,
  refunded_orders bigint,
  guest_orders bigint,
  gross_revenue numeric,
  net_revenue numeric,
  discount_total numeric,
  tax_total numeric,
  shipping_total numeric,
  refund_total numeric,
  average_order_value numeric,
  total_customers bigint,
  new_customers bigint,
  returning_customers bigint,
  appointments_total bigint,
  appointments_pending bigint,
  appointments_completed bigint,
  appointments_cancelled bigint,
  service_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamp with time zone := COALESCE(p_from, now() - interval '30 days');
  v_to timestamp with time zone := COALESCE(p_to, now());
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF v_to <= v_from THEN
    RAISE EXCEPTION 'Khoảng thời gian không hợp lệ.';
  END IF;

  RETURN QUERY
  WITH order_facts AS (
    SELECT
      po.id,
      po.user_id,
      po.created_at,
      COALESCE(
        po.fulfillment_status,
        CASE
          WHEN po.status = 'processing'::public.order_status THEN 'processing'::public.fulfillment_status
          WHEN po.status = 'shipped'::public.order_status THEN 'shipped'::public.fulfillment_status
          WHEN po.status = 'completed'::public.order_status THEN 'completed'::public.fulfillment_status
          WHEN po.status = 'cancelled'::public.order_status THEN 'cancelled'::public.fulfillment_status
          WHEN po.status = 'refunded'::public.order_status THEN 'completed'::public.fulfillment_status
          ELSE 'pending'::public.fulfillment_status
        END
      ) AS fulfillment_status,
      COALESCE(
        po.payment_status,
        CASE
          WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
          WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
          ELSE 'unpaid'::public.payment_status
        END
      ) AS payment_status,
      ROUND(COALESCE(po.grand_total, po.total_price, 0), 2) AS order_total,
      ROUND(COALESCE(po.discount_amount, 0), 2) AS discount_amount,
      ROUND(COALESCE(po.tax_amount, 0) + COALESCE(po.shipping_tax_amount, 0), 2) AS tax_total,
      ROUND(COALESCE(po.shipping_fee, 0), 2) AS shipping_total
    FROM public.product_orders po
    WHERE po.created_at >= v_from
      AND po.created_at < v_to
  ),
  refund_facts AS (
    SELECT
      COUNT(DISTINCT r.order_id)::bigint AS refunded_orders,
      ROUND(COALESCE(SUM(r.amount), 0), 2) AS refund_total
    FROM public.order_refunds r
    WHERE r.status = 'completed'
      AND COALESCE(r.refunded_at, r.created_at) >= v_from
      AND COALESCE(r.refunded_at, r.created_at) < v_to
  ),
  order_summary AS (
    SELECT
      COUNT(*)::bigint AS total_orders,
      COUNT(*) FILTER (WHERE order_facts.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status))::bigint AS paid_orders,
      COUNT(*) FILTER (WHERE order_facts.fulfillment_status = 'pending'::public.fulfillment_status)::bigint AS pending_orders,
      COUNT(*) FILTER (WHERE order_facts.fulfillment_status = 'completed'::public.fulfillment_status)::bigint AS completed_orders,
      COUNT(*) FILTER (WHERE order_facts.fulfillment_status = 'cancelled'::public.fulfillment_status)::bigint AS cancelled_orders,
      COUNT(*) FILTER (WHERE order_facts.user_id IS NULL)::bigint AS guest_orders,
      ROUND(COALESCE(SUM(CASE WHEN order_facts.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN order_facts.order_total ELSE 0 END), 0), 2) AS gross_revenue,
      ROUND(COALESCE(SUM(CASE WHEN order_facts.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN order_facts.discount_amount ELSE 0 END), 0), 2) AS discount_total,
      ROUND(COALESCE(SUM(CASE WHEN order_facts.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN order_facts.tax_total ELSE 0 END), 0), 2) AS tax_total,
      ROUND(COALESCE(SUM(CASE WHEN order_facts.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN order_facts.shipping_total ELSE 0 END), 0), 2) AS shipping_total
    FROM order_facts
  ),
  returning_customer_facts AS (
    SELECT COUNT(DISTINCT current_orders.user_id)::bigint AS returning_customers
    FROM public.product_orders current_orders
    WHERE current_orders.user_id IS NOT NULL
      AND current_orders.created_at >= v_from
      AND current_orders.created_at < v_to
      AND COALESCE(
        current_orders.payment_status,
        CASE
          WHEN current_orders.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
          WHEN current_orders.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
          ELSE 'unpaid'::public.payment_status
        END
      ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      AND EXISTS (
        SELECT 1
        FROM public.product_orders historical_orders
        WHERE historical_orders.user_id = current_orders.user_id
          AND historical_orders.created_at < v_from
          AND COALESCE(
            historical_orders.payment_status,
            CASE
              WHEN historical_orders.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
              WHEN historical_orders.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
              ELSE 'unpaid'::public.payment_status
            END
          ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      )
  ),
  appointment_facts AS (
    SELECT
      COUNT(*)::bigint AS appointments_total,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint AS appointments_pending,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint AS appointments_completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::bigint AS appointments_cancelled
    FROM public.appointments
    WHERE created_at >= v_from
      AND created_at < v_to
  ),
  service_revenue_facts AS (
    SELECT ROUND(COALESCE(SUM(i.total_amount), 0), 2) AS service_revenue
    FROM public.invoices i
    LEFT JOIN public.medical_records mr ON mr.id = i.medical_record_id
    WHERE COALESCE(i.payment_date::timestamp with time zone, mr.created_at, mr.encounter_date::timestamp with time zone) >= v_from
      AND COALESCE(i.payment_date::timestamp with time zone, mr.created_at, mr.encounter_date::timestamp with time zone) < v_to
      AND i.payment_status IN ('paid', 'partial')
  )
  SELECT
    order_summary.total_orders,
    order_summary.paid_orders,
    order_summary.pending_orders,
    order_summary.completed_orders,
    order_summary.cancelled_orders,
    refund_facts.refunded_orders,
    order_summary.guest_orders,
    order_summary.gross_revenue,
    ROUND(
      COALESCE(order_summary.gross_revenue, 0)
      - COALESCE(refund_facts.refund_total, 0),
      2
    ) AS net_revenue,
    order_summary.discount_total,
    order_summary.tax_total,
    order_summary.shipping_total,
    refund_facts.refund_total,
    ROUND(
      COALESCE(
        order_summary.gross_revenue / NULLIF(order_summary.paid_orders, 0),
        0
      ),
      2
    ) AS average_order_value,
    (
      SELECT COUNT(*)::bigint
      FROM public.patients p
      WHERE p.role = 'customer'
    ) AS total_customers,
    (
      SELECT COUNT(*)::bigint
      FROM public.patients p
      WHERE p.role = 'customer'
        AND p.created_at >= v_from
        AND p.created_at < v_to
    ) AS new_customers,
    returning_customer_facts.returning_customers,
    appointment_facts.appointments_total,
    appointment_facts.appointments_pending,
    appointment_facts.appointments_completed,
    appointment_facts.appointments_cancelled,
    service_revenue_facts.service_revenue
  FROM order_summary
  CROSS JOIN refund_facts
  CROSS JOIN returning_customer_facts
  CROSS JOIN appointment_facts
  CROSS JOIN service_revenue_facts;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_orders_timeseries(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE (
  bucket_start timestamp with time zone,
  total_orders bigint,
  paid_orders bigint,
  gross_revenue numeric,
  net_revenue numeric,
  refund_total numeric,
  appointments_total bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamp with time zone := COALESCE(p_from, now() - interval '30 days');
  v_to timestamp with time zone := COALESCE(p_to, now());
  v_granularity text := LOWER(COALESCE(p_granularity, 'day'));
  v_step interval;
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF v_to <= v_from THEN
    RAISE EXCEPTION 'Khoảng thời gian không hợp lệ.';
  END IF;

  IF v_granularity NOT IN ('day', 'week') THEN
    RAISE EXCEPTION 'Granularity không hợp lệ. Chỉ hỗ trợ day hoặc week.';
  END IF;

  v_step := CASE WHEN v_granularity = 'week' THEN interval '1 week' ELSE interval '1 day' END;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      date_trunc(v_granularity, v_from),
      date_trunc(v_granularity, v_to),
      v_step
    ) AS bucket_start
  ),
  order_facts AS (
    SELECT
      po.created_at,
      COALESCE(
        po.payment_status,
        CASE
          WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
          WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
          ELSE 'unpaid'::public.payment_status
        END
      ) AS payment_status,
      ROUND(COALESCE(po.grand_total, po.total_price, 0), 2) AS order_total
    FROM public.product_orders po
    WHERE po.created_at >= v_from
      AND po.created_at < v_to
  ),
  refund_facts AS (
    SELECT
      date_trunc(v_granularity, COALESCE(r.refunded_at, r.created_at)) AS bucket_start,
      ROUND(COALESCE(SUM(r.amount), 0), 2) AS refund_total
    FROM public.order_refunds r
    WHERE r.status = 'completed'
      AND COALESCE(r.refunded_at, r.created_at) >= v_from
      AND COALESCE(r.refunded_at, r.created_at) < v_to
    GROUP BY 1
  ),
  appointment_facts AS (
    SELECT
      date_trunc(v_granularity, a.created_at) AS bucket_start,
      COUNT(*)::bigint AS appointments_total
    FROM public.appointments a
    WHERE a.created_at >= v_from
      AND a.created_at < v_to
    GROUP BY 1
  ),
  order_bucket_facts AS (
    SELECT
      date_trunc(v_granularity, of.created_at) AS bucket_start,
      COUNT(*)::bigint AS total_orders,
      COUNT(*) FILTER (WHERE of.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status))::bigint AS paid_orders,
      ROUND(COALESCE(SUM(CASE WHEN of.payment_status IN ('paid'::public.payment_status, 'refunded'::public.payment_status) THEN of.order_total ELSE 0 END), 0), 2) AS gross_revenue
    FROM order_facts of
    GROUP BY 1
  )
  SELECT
    b.bucket_start,
    COALESCE(ob.total_orders, 0) AS total_orders,
    COALESCE(ob.paid_orders, 0) AS paid_orders,
    COALESCE(ob.gross_revenue, 0) AS gross_revenue,
    ROUND(COALESCE(ob.gross_revenue, 0) - COALESCE(rf.refund_total, 0), 2) AS net_revenue,
    COALESCE(rf.refund_total, 0) AS refund_total,
    COALESCE(af.appointments_total, 0) AS appointments_total
  FROM buckets b
  LEFT JOIN order_bucket_facts ob ON ob.bucket_start = b.bucket_start
  LEFT JOIN refund_facts rf ON rf.bucket_start = b.bucket_start
  LEFT JOIN appointment_facts af ON af.bucket_start = b.bucket_start
  WHERE b.bucket_start < v_to
  ORDER BY b.bucket_start ASC;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_inventory_metrics()
RETURNS TABLE (
  total_products bigint,
  published_products bigint,
  featured_products bigint,
  hidden_products bigint,
  in_stock_products bigint,
  low_stock_products bigint,
  out_of_stock_products bigint,
  near_expiry_products bigint,
  no_sku_products bigint,
  inventory_estimated_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_products,
    COUNT(*) FILTER (WHERE p.is_published = true)::bigint AS published_products,
    COUNT(*) FILTER (WHERE p.is_featured = true)::bigint AS featured_products,
    COUNT(*) FILTER (WHERE COALESCE(p.is_published, false) = false)::bigint AS hidden_products,
    COUNT(*) FILTER (WHERE COALESCE(p.stock_quantity, 0) > 0)::bigint AS in_stock_products,
    COUNT(*) FILTER (
      WHERE COALESCE(p.stock_quantity, 0) > 0
        AND COALESCE(p.low_stock_threshold, 0) > 0
        AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.low_stock_threshold, 0)
    )::bigint AS low_stock_products,
    COUNT(*) FILTER (WHERE COALESCE(p.stock_quantity, 0) <= 0)::bigint AS out_of_stock_products,
    COUNT(*) FILTER (
      WHERE p.expiry_date IS NOT NULL
        AND p.expiry_date >= current_date
        AND p.expiry_date <= current_date + interval '30 days'
    )::bigint AS near_expiry_products,
    COUNT(*) FILTER (WHERE NULLIF(btrim(COALESCE(p.sku, '')), '') IS NULL)::bigint AS no_sku_products,
    ROUND(COALESCE(SUM(GREATEST(COALESCE(p.stock_quantity, 0), 0) * COALESCE(p.price, 0)), 0), 2) AS inventory_estimated_value
  FROM public.products p;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_customer_metrics(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  patient_id uuid,
  name text,
  email text,
  phone text,
  created_at timestamp with time zone,
  total_orders bigint,
  total_spent numeric,
  average_order_value numeric,
  first_order_at timestamp with time zone,
  last_order_at timestamp with time zone,
  total_appointments bigint,
  last_appointment_at timestamp with time zone,
  orders_in_period bigint,
  spent_in_period numeric,
  segment text,
  is_at_risk boolean,
  is_returning boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamp with time zone := COALESCE(p_from, now() - interval '30 days');
  v_to timestamp with time zone := COALESCE(p_to, now());
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF v_to <= v_from THEN
    RAISE EXCEPTION 'Khoảng thời gian không hợp lệ.';
  END IF;

  RETURN QUERY
  WITH lifetime_orders AS (
    SELECT
      po.user_id AS patient_id,
      COUNT(*) FILTER (
        WHERE COALESCE(
          po.payment_status,
          CASE
            WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
            WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
            ELSE 'unpaid'::public.payment_status
          END
        ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      )::bigint AS total_orders,
      ROUND(COALESCE(SUM(
        CASE
          WHEN COALESCE(
            po.payment_status,
            CASE
              WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
              WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
              ELSE 'unpaid'::public.payment_status
            END
          ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
            THEN COALESCE(po.grand_total, po.total_price, 0)
          ELSE 0
        END
      ), 0), 2) AS total_spent,
      MIN(po.created_at) FILTER (
        WHERE COALESCE(
          po.payment_status,
          CASE
            WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
            WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
            ELSE 'unpaid'::public.payment_status
          END
        ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      ) AS first_order_at,
      MAX(po.created_at) FILTER (
        WHERE COALESCE(
          po.payment_status,
          CASE
            WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
            WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
            ELSE 'unpaid'::public.payment_status
          END
        ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      ) AS last_order_at
    FROM public.product_orders po
    WHERE po.user_id IS NOT NULL
    GROUP BY po.user_id
  ),
  period_orders AS (
    SELECT
      po.user_id AS patient_id,
      COUNT(*) FILTER (
        WHERE COALESCE(
          po.payment_status,
          CASE
            WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
            WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
            ELSE 'unpaid'::public.payment_status
          END
        ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      )::bigint AS orders_in_period,
      ROUND(COALESCE(SUM(
        CASE
          WHEN COALESCE(
            po.payment_status,
            CASE
              WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
              WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
              ELSE 'unpaid'::public.payment_status
            END
          ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
            THEN COALESCE(po.grand_total, po.total_price, 0)
          ELSE 0
        END
      ), 0), 2) AS spent_in_period
    FROM public.product_orders po
    WHERE po.user_id IS NOT NULL
      AND po.created_at >= v_from
      AND po.created_at < v_to
    GROUP BY po.user_id
  ),
  lifetime_appointments AS (
    SELECT
      a.patient_id,
      COUNT(*)::bigint AS total_appointments,
      MAX(a.created_at) AS last_appointment_at
    FROM public.appointments a
    GROUP BY a.patient_id
  )
  SELECT
    p.id AS patient_id,
    p.name,
    p.email,
    p.phone,
    p.created_at,
    COALESCE(lo.total_orders, 0) AS total_orders,
    COALESCE(lo.total_spent, 0) AS total_spent,
    ROUND(COALESCE(lo.total_spent / NULLIF(lo.total_orders, 0), 0), 2) AS average_order_value,
    lo.first_order_at,
    lo.last_order_at,
    COALESCE(la.total_appointments, 0) AS total_appointments,
    la.last_appointment_at,
    COALESCE(po.orders_in_period, 0) AS orders_in_period,
    COALESCE(po.spent_in_period, 0) AS spent_in_period,
    CASE
      WHEN COALESCE(lo.total_orders, 0) > 0 AND COALESCE(la.total_appointments, 0) > 0 THEN 'hybrid_customer'
      WHEN COALESCE(lo.total_orders, 0) > 0 THEN 'product_only_customer'
      WHEN COALESCE(la.total_appointments, 0) > 0 THEN 'service_only_customer'
      ELSE 'lead_only_customer'
    END AS segment,
    (
      GREATEST(
        COALESCE(lo.last_order_at, '-infinity'::timestamp with time zone),
        COALESCE(la.last_appointment_at, '-infinity'::timestamp with time zone),
        COALESCE(p.updated_at, p.created_at, '-infinity'::timestamp with time zone)
      ) < now() - interval '60 days'
    ) AS is_at_risk,
    COALESCE(lo.total_orders, 0) >= 2 AS is_returning
  FROM public.patients p
  LEFT JOIN lifetime_orders lo ON lo.patient_id = p.id
  LEFT JOIN period_orders po ON po.patient_id = p.id
  LEFT JOIN lifetime_appointments la ON la.patient_id = p.id
  WHERE p.role = 'customer'
  ORDER BY
    COALESCE(po.spent_in_period, 0) DESC,
    COALESCE(lo.total_spent, 0) DESC,
    p.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_top_products(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  product_id integer,
  product_name text,
  brand text,
  units_sold bigint,
  order_count bigint,
  gross_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamp with time zone := COALESCE(p_from, now() - interval '30 days');
  v_to timestamp with time zone := COALESCE(p_to, now());
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT
    poi.product_id,
    COALESCE(p.name, 'Sản phẩm #' || poi.product_id::text) AS product_name,
    COALESCE(p.brand, '') AS brand,
    COALESCE(SUM(poi.quantity), 0)::bigint AS units_sold,
    COUNT(DISTINCT poi.order_id)::bigint AS order_count,
    ROUND(COALESCE(SUM(poi.quantity * poi.price_at_purchase), 0), 2) AS gross_revenue
  FROM public.product_order_items poi
  JOIN public.product_orders po ON po.id = poi.order_id
  LEFT JOIN public.products p ON p.id = poi.product_id
  WHERE po.created_at >= v_from
    AND po.created_at < v_to
    AND COALESCE(
      po.payment_status,
      CASE
        WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
        WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
        ELSE 'unpaid'::public.payment_status
      END
    ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
  GROUP BY poi.product_id, p.name, p.brand
  ORDER BY gross_revenue DESC, units_sold DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_service_performance(
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  service_id integer,
  service_name text,
  appointment_count bigint,
  completed_count bigint,
  cancelled_count bigint,
  pending_count bigint,
  realized_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamp with time zone := COALESCE(p_from, now() - interval '30 days');
  v_to timestamp with time zone := COALESCE(p_to, now());
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT
    s.id AS service_id,
    s.name AS service_name,
    COUNT(a.id)::bigint AS appointment_count,
    COUNT(a.id) FILTER (WHERE a.status = 'completed')::bigint AS completed_count,
    COUNT(a.id) FILTER (WHERE a.status = 'cancelled')::bigint AS cancelled_count,
    COUNT(a.id) FILTER (WHERE a.status = 'pending')::bigint AS pending_count,
    ROUND(COALESCE(SUM(CASE WHEN i.payment_status IN ('paid', 'partial') THEN i.total_amount ELSE 0 END), 0), 2) AS realized_revenue
  FROM public.services s
  LEFT JOIN public.appointments a
    ON a.service_id = s.id
   AND a.created_at >= v_from
   AND a.created_at < v_to
  LEFT JOIN public.medical_records mr ON mr.appointment_id = a.id
  LEFT JOIN public.invoices i ON i.medical_record_id = mr.id
  GROUP BY s.id, s.name
  HAVING COUNT(a.id) > 0 OR COALESCE(SUM(CASE WHEN i.payment_status IN ('paid', 'partial') THEN i.total_amount ELSE 0 END), 0) > 0
  ORDER BY appointment_count DESC, realized_revenue DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_alert_feed(
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  alert_key text,
  alert_type text,
  severity text,
  title text,
  description text,
  ref_type text,
  ref_id text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  WITH alerts AS (
    SELECT
      'order-pending-' || po.id::text AS alert_key,
      'order_pending'::text AS alert_type,
      'high'::text AS severity,
      'Đơn hàng chờ xử lý quá lâu'::text AS title,
      format('Đơn %s của %s đã chờ hơn 2 giờ.', COALESCE(po.order_code, po.id::text), COALESCE(po.customer_name, 'khách hàng')) AS description,
      'order'::text AS ref_type,
      po.id::text AS ref_id,
      po.created_at
    FROM public.product_orders po
    WHERE COALESCE(
      po.fulfillment_status,
      CASE
        WHEN po.status = 'processing'::public.order_status THEN 'processing'::public.fulfillment_status
        WHEN po.status = 'shipped'::public.order_status THEN 'shipped'::public.fulfillment_status
        WHEN po.status = 'completed'::public.order_status THEN 'completed'::public.fulfillment_status
        WHEN po.status = 'cancelled'::public.order_status THEN 'cancelled'::public.fulfillment_status
        WHEN po.status = 'refunded'::public.order_status THEN 'completed'::public.fulfillment_status
        ELSE 'pending'::public.fulfillment_status
      END
    ) = 'pending'::public.fulfillment_status
      AND po.created_at <= now() - interval '2 hours'

    UNION ALL

    SELECT
      'order-shipping-' || po.id::text,
      'shipping_missing',
      'high',
      'Đơn đã thanh toán nhưng chưa có mã vận đơn',
      format('Đơn %s đã thanh toán nhưng chưa có shipping code.', COALESCE(po.order_code, po.id::text)),
      'order',
      po.id::text,
      po.updated_at
    FROM public.product_orders po
    WHERE COALESCE(
      po.payment_status,
      CASE
        WHEN po.status = 'completed'::public.order_status THEN 'paid'::public.payment_status
        WHEN po.status = 'refunded'::public.order_status THEN 'refunded'::public.payment_status
        ELSE 'unpaid'::public.payment_status
      END
    ) IN ('paid'::public.payment_status, 'refunded'::public.payment_status)
      AND COALESCE(po.shipping_provider, '') = 'ghtk'
      AND NULLIF(btrim(COALESCE(po.shipping_code, '')), '') IS NULL
      AND po.created_at <= now() - interval '30 minutes'

    UNION ALL

    SELECT
      'refund-pending-' || r.id::text,
      'refund_pending',
      'medium',
      'Hoàn tiền đang chờ xử lý',
      format('Refund %s của đơn %s đang ở trạng thái pending.', r.id::text, r.order_id::text),
      'refund',
      r.id::text,
      r.created_at
    FROM public.order_refunds r
    WHERE r.status = 'pending'
      AND r.created_at <= now() - interval '24 hours'

    UNION ALL

    SELECT
      'appointment-pending-' || a.id::text,
      'appointment_pending',
      'medium',
      'Lịch hẹn chưa được xử lý',
      format('Lịch hẹn %s cho ngày %s vẫn đang pending.', a.id::text, a.date::text),
      'appointment',
      a.id::text,
      a.created_at
    FROM public.appointments a
    WHERE a.status = 'pending'
      AND a.created_at <= now() - interval '24 hours'

    UNION ALL

    SELECT
      'product-out-of-stock-' || p.id::text,
      'product_out_of_stock',
      'high',
      'Sản phẩm hết hàng nhưng vẫn đang hiển thị',
      format('Sản phẩm %s đang published nhưng tồn kho bằng 0.', p.name),
      'product',
      p.id::text,
      COALESCE(p.updated_at, p.created_at)
    FROM public.products p
    WHERE p.is_published = true
      AND COALESCE(p.stock_quantity, 0) <= 0

    UNION ALL

    SELECT
      'product-low-stock-' || p.id::text,
      'product_low_stock',
      'medium',
      'Sản phẩm sắp hết hàng',
      format('Sản phẩm %s chỉ còn %s.', p.name, COALESCE(p.stock_quantity, 0)::text),
      'product',
      p.id::text,
      COALESCE(p.updated_at, p.created_at)
    FROM public.products p
    WHERE p.is_published = true
      AND COALESCE(p.stock_quantity, 0) > 0
      AND COALESCE(p.low_stock_threshold, 0) > 0
      AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.low_stock_threshold, 0)
  )
  SELECT *
  FROM alerts
  ORDER BY
    CASE alerts.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      ELSE 4
    END,
    alerts.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 25), 1);
END;
$fn$;
