-- شغّل الملف ده مرة واحدة من Supabase -> SQL Editor
-- بيسمح بتسجيل الدخول بالاسم (full_name في جدول profiles) بدل الإيميل.
-- الاسم لازم يكون مميز: لو في اسمين متطابقين الدخول بالاسم بيترفض لحد ما يتغيّر أحدهم.
create or replace function public.login_email(p_name text)
returns text language sql security definer set search_path = public stable as $$
  select case when count(*) = 1 then max(email) end
  from public.profiles
  where email is not null
    and lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'));
$$;
revoke all on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;
