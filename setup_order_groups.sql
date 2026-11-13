-- =====================================================================
-- الطلبية كيان واحد يحتوي أكثر من صنف (تشغّله مرة واحدة في Supabase > SQL Editor)
-- آمن: مفيش حذف ولا تعديل في بيانات موجودة، والطلبيات القديمة بتفضل زي ما هي.
-- =====================================================================

-- ملاحظة: الأفضل تشغّل setup_security.sql بدل الملف ده (بيشمله وبيأمّن باقي الجداول). لو هتشغّل ده لوحده لازم setup_security.sql يتشغّل قبله.

-- 1) جدول الطلبية (الأب): اسم/عميل اختياري
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

-- 2) ربط أصناف الأقسام بالطلبية (العمود اختياري: الفاضي = طلبية قديمة مستقلة)
alter table public.glaze_orders add column if not exists group_id uuid references public.order_groups(id) on delete set null;
alter table public.deco_orders  add column if not exists group_id uuid references public.order_groups(id) on delete set null;
alter table public.spray_orders add column if not exists group_id uuid references public.order_groups(id) on delete set null;

create index if not exists glaze_orders_group_idx on public.glaze_orders(group_id);
create index if not exists deco_orders_group_idx  on public.deco_orders(group_id);
create index if not exists spray_orders_group_idx on public.spray_orders(group_id);

-- 3) تحديث كاش الـ API
notify pgrst, 'reload schema';

-- =====================================================================
-- (اختياري) تجميع الطلبيات القديمة اللي اتسجلت مع بعض في نفس الشاشة:
-- شيل علامة -- من الكتلة اللي تحت وشغّلها لو عاوز. بتجمّع الأصناف اللي
-- ليها نفس تاريخ الطلبية والتسليم واتسجلت في نفس الثانية (داخل نفس القسم).
-- لازم يكون في الجدول عمود created_at.
-- =====================================================================
-- do $$
-- declare t text; r record; gid uuid;
-- begin
--   foreach t in array array['glaze_orders','deco_orders','spray_orders'] loop
--     for r in execute format($f$
--       select array_agg(id) as ids from public.%I
--       where group_id is null
--       group by date_trunc('second', created_at), order_date, due_date
--       having count(*) > 1$f$, t)
--     loop
--       insert into public.order_groups default values returning id into gid;
--       execute format('update public.%I set group_id = $1 where id = any($2)', t) using gid, r.ids;
--     end loop;
--   end loop;
-- end $$;
