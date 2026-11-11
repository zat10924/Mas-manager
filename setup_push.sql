-- setup_push.sql — شغّله مرة واحدة في Supabase > SQL Editor
create table if not exists public.push_subs(
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.push_subs enable row level security;  -- من غير policies: الوصول بس عن طريق الدوال تحت والـ function

create or replace function public.save_push_sub(p_endpoint text,p_p256dh text,p_auth text,p_ua text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.push_subs(endpoint,user_id,p256dh,auth,ua,updated_at)
  values(p_endpoint,auth.uid(),p_p256dh,p_auth,p_ua,now())
  on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,ua=excluded.ua,updated_at=now();
end $$;

create or replace function public.delete_push_sub(p_endpoint text)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.push_subs where endpoint=p_endpoint and user_id=auth.uid();
end $$;

grant execute on function public.save_push_sub(text,text,text,text) to authenticated;
grant execute on function public.delete_push_sub(text) to authenticated;
