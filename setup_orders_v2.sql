-- =====================================================================
-- تطوير الطلبيات: رقم للطلبية + موبايل العميل + ملاحظات (تمهيدًا للفاتورة)
-- شغّله مرة واحدة في Supabase > SQL Editor > Run. آمن: مفيش حذف ولا تعديل في بيانات موجودة.
-- لازم setup_order_groups.sql (أو setup_security.sql) يكون اتشغّل قبله.
-- الصفحة بتشتغل عادي حتى قبل ما تشغّله، بس الحقول الجديدة مش هتظهر.
-- =====================================================================

alter table public.order_groups add column if not exists order_no bigint;
alter table public.order_groups add column if not exists customer_phone text;
alter table public.order_groups add column if not exists notes text;

-- حدود الطول (حماية من إدخال ضخم)
alter table public.order_groups drop constraint if exists og_phone_len;
alter table public.order_groups add  constraint og_phone_len check (customer_phone is null or char_length(customer_phone) <= 30);
alter table public.order_groups drop constraint if exists og_notes_len;
alter table public.order_groups add  constraint og_notes_len check (notes is null or char_length(notes) <= 500);

-- ترقيم الطلبيات القديمة حسب تاريخ الإنشاء، والجديدة بتكمّل بعدها تلقائيًا
create sequence if not exists public.order_groups_no_seq;
with n as (
  select id, row_number() over (order by created_at, id) rn
  from public.order_groups where order_no is null
)
update public.order_groups g set order_no = n.rn from n where g.id = n.id;
select setval('public.order_groups_no_seq', coalesce((select max(order_no) from public.order_groups), 0) + 1, false);
alter table public.order_groups alter column order_no set default nextval('public.order_groups_no_seq');
create unique index if not exists order_groups_no_uq on public.order_groups(order_no);

notify pgrst, 'reload schema';

-- =====================================================================
-- دفتر العملاء: اسم العميل وموبايله بيتحفظوا مرة واحدة ويظهروا كاقتراحات في الطلبية الجديدة
-- (الملف كله آمن تعيد تشغيله حتى لو شغّلته قبل كده)
-- =====================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now()
);
create unique index if not exists customers_name_uq on public.customers (lower(name));

alter table public.customers enable row level security;
drop policy if exists cu_select on public.customers;
drop policy if exists cu_insert on public.customers;
drop policy if exists cu_update on public.customers;
drop policy if exists cu_delete on public.customers;
create policy cu_select on public.customers for select to authenticated using ((select public.is_staff()));
create policy cu_insert on public.customers for insert to authenticated with check ((select public.is_manager_any()));
create policy cu_update on public.customers for update to authenticated using ((select public.is_manager_any())) with check ((select public.is_manager_any()));
create policy cu_delete on public.customers for delete to authenticated using ((select public.is_manager_any()));

notify pgrst, 'reload schema';

-- =====================================================================
-- تسليم الطلبية: تاريخ التسليم + ملاحظة (الطلبية ممكن تتسلّم حتى لو فيها عجز، والعجز بيتسجّل ويظهر في التقارير)
-- =====================================================================
alter table public.order_groups add column if not exists delivered_at date;
alter table public.order_groups add column if not exists delivery_note text;
alter table public.order_groups drop constraint if exists og_dnote_len;
alter table public.order_groups add  constraint og_dnote_len check (delivery_note is null or char_length(delivery_note) <= 300);
notify pgrst, 'reload schema';

-- =====================================================================
-- الرش: اللون المطلوب رشه (مستقل عن لون الصنف) على الطلبية نفسها
-- =====================================================================
alter table public.spray_orders add column if not exists spray_color text;
alter table public.spray_orders drop constraint if exists so_spray_color_len;
alter table public.spray_orders add  constraint so_spray_color_len check (spray_color is null or char_length(spray_color) <= 60);
notify pgrst, 'reload schema';

-- =====================================================================
-- سجل التسليم: كل مرة الطلبية بتتسلّم (كامل أو جزئي) بتتسجل بتاريخها والعجز اللي كان وقتها
-- عشان تعرف الطلبية خلصت على كام مرة وتكمّل العجز بعدين
-- =====================================================================
create table if not exists public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.order_groups(id) on delete cascade,
  delivered_on date not null default current_date,
  qty_done integer not null default 0,
  qty_short integer not null default 0,
  is_final boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists order_deliveries_group_idx on public.order_deliveries(group_id, delivered_on);

alter table public.order_deliveries enable row level security;
drop policy if exists od_select on public.order_deliveries;
drop policy if exists od_insert on public.order_deliveries;
drop policy if exists od_update on public.order_deliveries;
drop policy if exists od_delete on public.order_deliveries;
create policy od_select on public.order_deliveries for select to authenticated using ((select public.is_staff()));
create policy od_insert on public.order_deliveries for insert to authenticated with check ((select public.is_manager_any()));
create policy od_update on public.order_deliveries for update to authenticated using ((select public.is_manager_any())) with check ((select public.is_manager_any()));
create policy od_delete on public.order_deliveries for delete to authenticated using ((select public.is_manager_any()));
notify pgrst, 'reload schema';
