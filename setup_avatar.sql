-- شغّله مرة واحدة من Supabase -> SQL Editor
-- بيضيف عمود الصورة الشخصية + دالة تخلّي كل مستخدم يغيّر صورته هو بس.
alter table public.profiles add column if not exists avatar text;

create or replace function public.set_my_avatar(p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_avatar is not null and (length(p_avatar) > 300000 or p_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$') then
    raise exception 'invalid image';
  end if;
  update public.profiles set avatar = p_avatar where id = auth.uid();
end;
$$;
revoke all on function public.set_my_avatar(text) from public;
grant execute on function public.set_my_avatar(text) to authenticated;
