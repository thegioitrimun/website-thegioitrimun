-- 1. Cập nhật Hàm Trigger để lưu trực tiếp link Avatar Google vào avatar_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.patients (
    id,
    name,
    dob,
    phone,
    role,
    avatar_path
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Người dùng mới'),
    COALESCE(NEW.raw_user_meta_data->>'dob', '1990-01-01'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '0000000000'),
    'customer',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Chạy bù data avatar_path cho những tài khoản Google đã có
UPDATE public.patients p
SET avatar_path = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE p.id = au.id
  AND p.avatar_path IS NULL
  AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL;
