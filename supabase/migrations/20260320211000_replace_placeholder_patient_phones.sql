-- Replace legacy placeholder phone values with empty strings so admin analytics
-- no longer flags fake duplicate phones for accounts that never supplied a phone.

UPDATE public.patients
SET phone = ''
WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = '0000000000';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'phone'
WHERE COALESCE(raw_user_meta_data->>'phone', '') = '0000000000';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patients (
    id,
    name,
    dob,
    phone,
    email,
    role,
    avatar_path
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), 'Người dùng mới'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'dob', '') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (NEW.raw_user_meta_data->>'dob')::date
      ELSE '1990-01-01'::date
    END,
    COALESCE(NULLIF(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '0000000000'), ''),
    NEW.email,
    'customer'::public.system_role,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.patients (
  id,
  name,
  dob,
  phone,
  email,
  role,
  avatar_path
)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', ''), 'Người dùng mới'),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'dob', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (u.raw_user_meta_data->>'dob')::date
    ELSE '1990-01-01'::date
  END,
  COALESCE(NULLIF(NULLIF(u.raw_user_meta_data->>'phone', ''), '0000000000'), ''),
  u.email,
  'customer'::public.system_role,
  NULLIF(u.raw_user_meta_data->>'avatar_url', '')
FROM auth.users u
LEFT JOIN public.patients p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
