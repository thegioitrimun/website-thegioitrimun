-- Migration: admin_dashboard_order_bulk_and_report_schedules
-- Description:
-- 1) Adds bulk order transition RPC for stale pending orders
-- 2) Adds scheduled admin report storage and helper RPCs

CREATE OR REPLACE FUNCTION public.admin_bulk_transition_order_status(
  p_order_ids uuid[],
  p_to_status public.fulfillment_status,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  order_id uuid,
  ok boolean,
  error_message text,
  order_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order_id uuid;
  v_order public.product_orders;
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF COALESCE(array_length(p_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Danh sách đơn hàng trống.';
  END IF;

  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    BEGIN
      v_order := public.transition_order_status(v_order_id, p_to_status, p_note);
      order_id := v_order.id;
      ok := true;
      error_message := NULL;
      order_data := to_jsonb(v_order);
    EXCEPTION
      WHEN OTHERS THEN
        order_id := v_order_id;
        ok := false;
        error_message := SQLERRM;
        order_data := NULL;
    END;

    RETURN NEXT;
  END LOOP;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_transition_order_status(
  uuid[],
  public.fulfillment_status,
  text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_dashboard_compute_next_run(
  p_frequency text,
  p_day_of_week integer,
  p_hour_local integer,
  p_minute_local integer,
  p_timezone text,
  p_reference timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_timezone text := COALESCE(NULLIF(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh');
  v_local_reference timestamp without time zone := p_reference AT TIME ZONE v_timezone;
  v_target_local timestamp without time zone;
  v_current_dow integer := EXTRACT(DOW FROM v_local_reference);
  v_target_dow integer := COALESCE(p_day_of_week, 1);
  v_days_ahead integer;
BEGIN
  IF p_hour_local < 0 OR p_hour_local > 23 THEN
    RAISE EXCEPTION 'Giờ chạy không hợp lệ.';
  END IF;

  IF p_minute_local < 0 OR p_minute_local > 59 THEN
    RAISE EXCEPTION 'Phút chạy không hợp lệ.';
  END IF;

  IF lower(p_frequency) = 'daily' THEN
    v_target_local := date_trunc('day', v_local_reference)
      + make_interval(hours => p_hour_local, mins => p_minute_local);

    IF v_target_local <= v_local_reference THEN
      v_target_local := v_target_local + interval '1 day';
    END IF;
  ELSIF lower(p_frequency) = 'weekly' THEN
    IF v_target_dow < 0 OR v_target_dow > 6 THEN
      RAISE EXCEPTION 'Thứ trong tuần không hợp lệ.';
    END IF;

    v_days_ahead := mod(v_target_dow - v_current_dow + 7, 7);
    v_target_local := date_trunc('day', v_local_reference)
      + make_interval(days => v_days_ahead, hours => p_hour_local, mins => p_minute_local);

    IF v_target_local <= v_local_reference THEN
      v_target_local := v_target_local + interval '7 days';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tần suất báo cáo không hợp lệ.';
  END IF;

  RETURN v_target_local AT TIME ZONE v_timezone;
END;
$fn$;

CREATE TABLE IF NOT EXISTS public.admin_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preset text NOT NULL CHECK (preset IN ('7d', '30d', '90d')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  day_of_week integer CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  hour_local integer NOT NULL CHECK (hour_local BETWEEN 0 AND 23),
  minute_local integer NOT NULL DEFAULT 0 CHECK (minute_local BETWEEN 0 AND 59),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_sent_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_by uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view report schedules" ON public.admin_report_schedules;
CREATE POLICY "Admin can view report schedules"
  ON public.admin_report_schedules
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can insert report schedules" ON public.admin_report_schedules;
CREATE POLICY "Admin can insert report schedules"
  ON public.admin_report_schedules
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update report schedules" ON public.admin_report_schedules;
CREATE POLICY "Admin can update report schedules"
  ON public.admin_report_schedules
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete report schedules" ON public.admin_report_schedules;
CREATE POLICY "Admin can delete report schedules"
  ON public.admin_report_schedules
  FOR DELETE
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_admin_report_schedules_updated_at ON public.admin_report_schedules;
CREATE TRIGGER trg_admin_report_schedules_updated_at
BEFORE UPDATE ON public.admin_report_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.admin_list_report_schedules()
RETURNS TABLE (
  id uuid,
  name text,
  preset text,
  frequency text,
  day_of_week integer,
  hour_local integer,
  minute_local integer,
  timezone text,
  recipients text[],
  enabled boolean,
  next_run_at timestamptz,
  last_sent_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.preset,
    s.frequency,
    s.day_of_week,
    s.hour_local,
    s.minute_local,
    s.timezone,
    s.recipients,
    s.enabled,
    s.next_run_at,
    s.last_sent_at,
    s.last_error_at,
    s.last_error_message,
    s.created_by,
    s.updated_by,
    s.created_at,
    s.updated_at
  FROM public.admin_report_schedules s
  ORDER BY s.enabled DESC, s.next_run_at NULLS LAST, s.created_at ASC;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_upsert_report_schedule(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_preset text DEFAULT '30d',
  p_frequency text DEFAULT 'daily',
  p_day_of_week integer DEFAULT NULL,
  p_hour_local integer DEFAULT 8,
  p_minute_local integer DEFAULT 0,
  p_timezone text DEFAULT 'Asia/Ho_Chi_Minh',
  p_recipients text[] DEFAULT ARRAY[]::text[],
  p_enabled boolean DEFAULT true
)
RETURNS public.admin_report_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor_id uuid := auth.uid();
  v_schedule public.admin_report_schedules;
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_timezone text := COALESCE(NULLIF(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh');
  v_recipients text[] := ARRAY(
    SELECT DISTINCT lower(NULLIF(btrim(value), ''))
    FROM unnest(COALESCE(p_recipients, ARRAY[]::text[])) AS value
    WHERE NULLIF(btrim(value), '') IS NOT NULL
  );
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Tên lịch báo cáo là bắt buộc.';
  END IF;

  IF p_preset NOT IN ('7d', '30d', '90d') THEN
    RAISE EXCEPTION 'Preset báo cáo không hợp lệ.';
  END IF;

  IF p_frequency NOT IN ('daily', 'weekly') THEN
    RAISE EXCEPTION 'Tần suất báo cáo không hợp lệ.';
  END IF;

  IF p_frequency = 'weekly' AND p_day_of_week IS NULL THEN
    RAISE EXCEPTION 'Lịch weekly phải có day_of_week.';
  END IF;

  IF COALESCE(array_length(v_recipients, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Danh sách email nhận báo cáo không được để trống.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.admin_report_schedules (
      name,
      preset,
      frequency,
      day_of_week,
      hour_local,
      minute_local,
      timezone,
      recipients,
      enabled,
      next_run_at,
      created_by,
      updated_by
    )
    VALUES (
      v_name,
      p_preset,
      p_frequency,
      CASE WHEN p_frequency = 'weekly' THEN p_day_of_week ELSE NULL END,
      p_hour_local,
      p_minute_local,
      v_timezone,
      v_recipients,
      COALESCE(p_enabled, true),
      CASE
        WHEN COALESCE(p_enabled, true)
          THEN public.admin_dashboard_compute_next_run(
            p_frequency,
            p_day_of_week,
            p_hour_local,
            p_minute_local,
            v_timezone,
            now()
          )
        ELSE NULL
      END,
      v_actor_id,
      v_actor_id
    )
    RETURNING * INTO v_schedule;
  ELSE
    UPDATE public.admin_report_schedules
    SET
      name = v_name,
      preset = p_preset,
      frequency = p_frequency,
      day_of_week = CASE WHEN p_frequency = 'weekly' THEN p_day_of_week ELSE NULL END,
      hour_local = p_hour_local,
      minute_local = p_minute_local,
      timezone = v_timezone,
      recipients = v_recipients,
      enabled = COALESCE(p_enabled, true),
      next_run_at = CASE
        WHEN COALESCE(p_enabled, true)
          THEN public.admin_dashboard_compute_next_run(
            p_frequency,
            p_day_of_week,
            p_hour_local,
            p_minute_local,
            v_timezone,
            COALESCE(last_sent_at, now())
          )
        ELSE NULL
      END,
      updated_by = v_actor_id
    WHERE id = p_id
    RETURNING * INTO v_schedule;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy lịch báo cáo.';
    END IF;
  END IF;

  RETURN v_schedule;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_delete_report_schedule(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  DELETE FROM public.admin_report_schedules
  WHERE id = p_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_due_report_schedules(
  p_limit integer DEFAULT 10
)
RETURNS SETOF public.admin_report_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT *
  FROM public.admin_report_schedules s
  WHERE s.enabled = true
    AND s.next_run_at IS NOT NULL
    AND s.next_run_at <= now()
  ORDER BY s.next_run_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_mark_report_schedule_result(
  p_schedule_id uuid,
  p_sent_at timestamptz DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS public.admin_report_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_schedule public.admin_report_schedules;
  v_reference timestamptz := COALESCE(p_sent_at, now());
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  UPDATE public.admin_report_schedules
  SET
    last_sent_at = CASE WHEN NULLIF(btrim(COALESCE(p_error_message, '')), '') IS NULL THEN v_reference ELSE last_sent_at END,
    last_error_at = CASE WHEN NULLIF(btrim(COALESCE(p_error_message, '')), '') IS NULL THEN NULL ELSE now() END,
    last_error_message = NULLIF(btrim(COALESCE(p_error_message, '')), ''),
    next_run_at = CASE
      WHEN enabled
        THEN public.admin_dashboard_compute_next_run(
          frequency,
          day_of_week,
          hour_local,
          minute_local,
          timezone,
          v_reference
        )
      ELSE NULL
    END
  WHERE id = p_schedule_id
  RETURNING * INTO v_schedule;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy lịch báo cáo.';
  END IF;

  RETURN v_schedule;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_list_report_schedules() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_report_schedule(
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text[],
  boolean
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_report_schedule(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_due_report_schedules(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_mark_report_schedule_result(uuid, timestamptz, text) TO authenticated, service_role;

INSERT INTO public.admin_report_schedules (
  name,
  preset,
  frequency,
  day_of_week,
  hour_local,
  minute_local,
  timezone,
  recipients,
  enabled,
  next_run_at
)
SELECT
  'Daily Ops Digest',
  '30d',
  'daily',
  NULL,
  8,
  15,
  'Asia/Ho_Chi_Minh',
  ARRAY['hovidaiphuc@gmail.com'],
  true,
  public.admin_dashboard_compute_next_run('daily', NULL, 8, 15, 'Asia/Ho_Chi_Minh', now())
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_report_schedules
);
