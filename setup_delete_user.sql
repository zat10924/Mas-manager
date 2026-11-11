-- شغّل الملف ده مرة واحدة من Supabase -> SQL Editor
-- بيضيف دالة "حذف مستخدم نهائيًا" (للمدير بس): بتمسح الحساب من نظام الدخول ومن جدول profiles.
create or replace function public.delete_user(p_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_admins int;
begin
  -- المدير النشط بس هو اللي يقدر يحذف
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and coalesce(active, true)
  ) then
    raise exception 'not allowed';
  end if;

  if p_id = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;

  -- ما نسمحش بحذف آخر مدير
  if exists (select 1 from public.profiles where id = p_id and role = 'admin') then
    select count(*) into v_admins from public.profiles
      where role = 'admin' and coalesce(active, true) and id <> p_id;
    if v_admins = 0 then
      raise exception 'last admin';
    end if;
  end if;

  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end;
$$;
revoke all on function public.delete_user(uuid) from public;
grant execute on function public.delete_user(uuid) to authenticated;
