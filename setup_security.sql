-- =====================================================================
-- تأمين الصلاحيات: كل قسم بيبان ويتعدّل من أعضائه بس (والمدير)
-- بيستبدل سياسة "auth all" المفتوحة (using true) بسياسة مربوطة بقسم المستخدم.
-- تشغّله مرة واحدة في Supabase > SQL Editor. جرّبه بعدها بحساب مدير + مسؤول قسم + مسجّل إنتاج.
-- للرجوع لو حصلت مشكلة: شغّل الكتلة اللي في آخر الملف (ROLLBACK).
-- =====================================================================

-- 1) دوال مساعدة
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.active, true) and p.role is not null);
$$;
create or replace function public.is_manager_any() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.active, true) and p.role in ('admin','manager'));
$$;
revoke all on function public.is_staff() from public;
revoke all on function public.is_manager_any() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_manager_any() to authenticated;

-- 2) سياسات الأقسام
do $$
declare r record;
begin
  for r in select * from (values
    ('glaze_orders','glaze'),('glaze_order_lines','glaze'),('glaze_order_increases','glaze'),('glaze_production','glaze'),('glaze_waste','glaze'),
    ('deco_orders','deco'),('deco_lines','deco'),('deco_increases','deco'),('deco_production','deco'),
    ('spray_orders','spray'),('spray_production','spray'),
    ('repair_log','repair')
  ) as v(t, s)
  loop
    execute format('drop policy if exists "auth all" on public.%I', r.t);
    execute format('drop policy if exists sec_all on public.%I', r.t);
    execute format('create policy sec_all on public.%I for all to authenticated using ((select public.can_section(%L))) with check ((select public.can_section(%L)))', r.t, r.s, r.s);
  end loop;
end $$;

drop policy if exists "auth all" on public.order_postponements;
drop policy if exists sec_all on public.order_postponements;
create policy sec_all on public.order_postponements for all to authenticated
  using ((select public.can_section(section))) with check ((select public.can_section(section)));

-- 3) الـ views: تلتزم بصلاحيات اللي بيقرا، ومقفولة عن الزوار بدون تسجيل دخول
do $$
declare v text;
begin
  foreach v in array array['glaze_lines_status','deco_lines_status','spray_status'] loop
    begin
      execute format('alter view public.%I set (security_invoker = true)', v);
      execute format('revoke all on public.%I from anon', v);
    exception when others then
      raise notice 'تخطّيت %: %', v, sqlerrm;
    end;
  end loop;
end $$;

-- 4) جدول الطلبية الأم (آمن)
create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz not null default now()
);
alter table public.order_groups enable row level security;
drop policy if exists og_select on public.order_groups;
drop policy if exists og_insert on public.order_groups;
drop policy if exists og_update on public.order_groups;
drop policy if exists og_delete on public.order_groups;
create policy og_select on public.order_groups for select to authenticated using ((select public.is_staff()));
create policy og_insert on public.order_groups for insert to authenticated with check ((select public.is_manager_any()));
create policy og_update on public.order_groups for update to authenticated using ((select public.is_manager_any())) with check ((select public.is_manager_any()));
create policy og_delete on public.order_groups for delete to authenticated using ((select public.is_manager_any()));

alter table public.glaze_orders add column if not exists group_id uuid references public.order_groups(id) on delete set null;
alter table public.deco_orders  add column if not exists group_id uuid references public.order_groups(id) on delete set null;
alter table public.spray_orders add column if not exists group_id uuid references public.order_groups(id) on delete set null;
create index if not exists glaze_orders_group_idx on public.glaze_orders(group_id);
create index if not exists deco_orders_group_idx  on public.deco_orders(group_id);
create index if not exists spray_orders_group_idx on public.spray_orders(group_id);

notify pgrst, 'reload schema';

-- =====================================================================
-- ROLLBACK (للرجوع للوضع القديم المفتوح — شغّله بس لو حصلت مشكلة):
-- do $$ declare t text; begin
--   foreach t in array array['glaze_orders','glaze_order_lines','glaze_order_increases','glaze_production','glaze_waste','deco_orders','deco_lines','deco_increases','deco_production','spray_orders','spray_production','repair_log','order_postponements'] loop
--     execute format('drop policy if exists sec_all on public.%I', t);
--     execute format('create policy "auth all" on public.%I for all to authenticated using (true) with check (true)', t);
--   end loop; end $$;
-- =====================================================================
