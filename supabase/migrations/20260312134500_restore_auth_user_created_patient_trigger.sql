-- Ensure every auth signup creates a matching public.patients profile.
-- This migration also backfills missing profiles from existing auth.users rows.

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
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '0000000000'),
    NEW.email,
    'customer'::public.system_role,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Backfill for users created while trigger was missing.
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
  COALESCE(NULLIF(u.raw_user_meta_data->>'phone', ''), '0000000000'),
  u.email,
  'customer'::public.system_role,
  NULLIF(u.raw_user_meta_data->>'avatar_url', '')
FROM auth.users u
LEFT JOIN public.patients p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
