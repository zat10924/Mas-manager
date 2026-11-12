-- =====================================================================
-- setup_spray_color.sql — شغّله مرة واحدة من Supabase -> SQL Editor -> New query -> Run
-- (آمن لو اتشغّل أكتر من مرة)
-- الهدف: تسجيل «لون الرش» مع كل تسجيل إنتاج في قسم الرش.
-- لون الرش ممكن يختلف عن لون الطلبية (مثلًا طلبية أبيض واتّرش منها دفعة بلون تاني)،
-- فبيتخزّن في عمود مستقل على كل تسجيل إنتاج، وكل تقارير الرش بتحسب عليه.
-- الإنتاج بدون طلبية بيستخدم عمود sub (اللون) الموجود أصلًا فمش محتاج تعديل.
-- =====================================================================

alter table public.spray_production add column if not exists spray_color text;

-- التسجيلات القديمة: لون الرش = لون الطلبية اللي كانت متسجلة عليها
update public.spray_production p
   set spray_color = o.color
  from public.spray_orders o
 where p.order_id = o.id and p.spray_color is null;

create index if not exists spray_production_color_idx on public.spray_production (spray_color);

-- ملحوظة: سياسات الأمان (RLS) الحالية على spray_production بتنطبق على العمود الجديد تلقائيًا.
