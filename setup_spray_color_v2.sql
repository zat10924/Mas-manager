-- =====================================================================
-- setup_spray_color_v2.sql — شغّله مرة واحدة من Supabase -> SQL Editor -> New query -> Run
-- (آمن لو اتشغّل أكتر من مرة، ويغني عن setup_spray_color.sql وجزء الرش في setup_orders_v2.sql)
-- لون الرش المطلوب على الطلبية بيظهر في تسجيل الإنتاج، واللون اللي اتسجّل فعليًا بيتحفظ مع كل تسجيل.
-- =====================================================================

-- 1) لون الرش المطلوب على الطلبية
alter table public.spray_orders add column if not exists spray_color text;
alter table public.spray_orders drop constraint if exists so_spray_color_len;
alter table public.spray_orders add  constraint so_spray_color_len
  check (spray_color is null or char_length(spray_color) <= 60);

-- 2) لون الرش المسجّل على كل تسجيل إنتاج (على طلبية أو بدون طلبية)
alter table public.spray_production add column if not exists spray_color text;
alter table public.free_production  add column if not exists spray_color text;

-- 3) فهرس للتقارير
create index if not exists spray_production_color_idx on public.spray_production (spray_color);

-- 4) تنضيف: القيم اللي اتنسخت غلط من لون الصنف (النسخة القديمة) كلون رش
update public.spray_production p
   set spray_color = null
  from public.spray_orders o
 where p.order_id = o.id and p.spray_color is not null and p.spray_color = o.color;

-- 5) تحديث كاش الـ API عشان الأعمدة الجديدة تتشاف فورًا
notify pgrst, 'reload schema';
