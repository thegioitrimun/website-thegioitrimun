-- Migration: admin_dashboard_appointments_drilldown
-- Description:
-- 1) Adds drill-down RPC for appointment/service operations in admin dashboard
-- 2) Adds status update RPC for admin appointment handling

CREATE OR REPLACE FUNCTION public.admin_appointments_drilldown(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_service_id integer DEFAULT NULL,
  p_doctor_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  patient_id uuid,
  patient_name text,
  patient_email text,
  patient_phone text,
  doctor_id uuid,
  doctor_name text,
  service_id integer,
  service_name text,
  date date,
  "time" time without time zone,
  notes text,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  invoice_total_amount numeric,
  invoice_payment_status text,
  invoice_payment_method text,
  invoice_payment_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    p.name AS patient_name,
    p.email AS patient_email,
    p.phone AS patient_phone,
    a.doctor_id,
    d.name AS doctor_name,
    a.service_id,
    s.name AS service_name,
    a.date,
    a.time,
    a.notes,
    a.status::text AS status,
    a.created_at,
    a.updated_at,
    COALESCE(inv.total_amount, 0)::numeric AS invoice_total_amount,
    COALESCE(inv.payment_status::text, '') AS invoice_payment_status,
    COALESCE(inv.payment_method, '') AS invoice_payment_method,
    inv.payment_date AS invoice_payment_date
  FROM public.appointments a
  LEFT JOIN public.patients p ON p.id = a.patient_id
  LEFT JOIN public.patients d ON d.id = a.doctor_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN LATERAL (
    SELECT
      i.total_amount,
      i.payment_status,
      i.payment_method,
      i.payment_date
    FROM public.medical_records mr
    LEFT JOIN public.invoices i ON i.medical_record_id = mr.id
    WHERE mr.appointment_id = a.id
    ORDER BY COALESCE(i.payment_date::timestamp with time zone, mr.created_at, mr.encounter_date::timestamp with time zone) DESC NULLS LAST,
             mr.created_at DESC NULLS LAST
    LIMIT 1
  ) inv ON TRUE
  WHERE (p_from_date IS NULL OR a.date >= p_from_date)
    AND (p_to_date IS NULL OR a.date <= p_to_date)
    AND (p_status IS NULL OR btrim(p_status) = '' OR a.status::text = p_status)
    AND (p_service_id IS NULL OR a.service_id = p_service_id)
    AND (p_doctor_id IS NULL OR a.doctor_id = p_doctor_id)
    AND (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR lower(COALESCE(p.name, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(p.email, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE '%' || regexp_replace(btrim(p_search), '\\D', '', 'g') || '%'
      OR lower(COALESCE(d.name, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(s.name, '')) LIKE '%' || lower(btrim(p_search)) || '%'
    )
  ORDER BY a.date DESC, a.time DESC, a.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status public.appointment_status;
  v_result public.appointments;
BEGIN
  PERFORM public.admin_dashboard_assert_access();

  IF p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu appointment id.';
  END IF;

  v_status := p_status::public.appointment_status;

  UPDATE public.appointments a
  SET status = v_status,
      updated_at = now()
  WHERE a.id = p_appointment_id
  RETURNING a.* INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy appointment.';
  END IF;

  RETURN v_result;
END;
$fn$;
