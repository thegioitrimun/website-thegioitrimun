-- 1. Cập nhật lại Hàm Trigger để tự động điền mặc định cho Google Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.patients (
    id,
    name,
    dob,
    phone,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Người dùng mới'),
    COALESCE(NEW.raw_user_meta_data->>'dob', '1990-01-01'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '0000000000'),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Chạy bù data cho những tài khoản Google bạn đã lỡ đăng nhập bị lỗi lúc nãy
INSERT INTO public.patients (id, name, dob, phone, role)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Người dùng mới'), 
  '1990-01-01', 
  '0000000000', 
  'customer'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.patients);
