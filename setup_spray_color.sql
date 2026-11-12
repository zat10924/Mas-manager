-- =====================================================================
-- setup_spray_color.sql — شغّله مرة واحدة من Supabase -> SQL Editor -> New query -> Run
-- (آمن لو اتشغّل أكتر من مرة)
-- لون الرش حاجة مستقلة عن لون الصنف: الصنف ليه لون، والرش بيتعمل بلون تاني.
-- بيتسجل على كل تسجيل إنتاج في الرش (على طلبية أو بدون طلبية).
-- =====================================================================

alter table public.spray_production add column if not exists spray_color text;
alter table public.free_production  add column if not exists spray_color text;

-- لو كنت شغّلت النسخة القديمة من الملف ده: كانت بتنسخ لون الطلبية كلون رش (غلط).
-- السطر ده بيمسح القيم اللي مطابقة للون الطلبية بالظبط عشان ما تتحسبش لون رش بالغلط.
update public.spray_production p
   set spray_color = null
  from public.spray_orders o
 where p.order_id = o.id and p.spray_color is not null and p.spray_color = o.color;

create index if not exists spray_production_color_idx on public.spray_production (spray_color);
