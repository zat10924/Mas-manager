-- =====================================================================
-- setup_edit_production.sql — شغّله مرة واحدة من Supabase -> SQL Editor -> New query -> Run
-- (آمن لو اتشغّل أكتر من مرة)
-- الهدف: السماح بتعديل تسجيلات الإنتاج (الكمية / التاريخ / العامل / الملاحظة)
-- للمدير والأدمن من صفحة «تسجيل الإنتاج». محتاج setup_v2.sql يكون اتشغّل قبله.
-- لو التعديل شغّال عندك أصلًا ومفيش رسالة «راجع الصلاحيات» يبقى مش محتاج الملف ده.
-- =====================================================================

drop policy if exists glaze_prod_edit on public.glaze_production;
create policy glaze_prod_edit on public.glaze_production for update to authenticated
  using (public.can_manage_section('glaze')) with check (public.can_manage_section('glaze'));
grant update on public.glaze_production to authenticated;

drop policy if exists deco_prod_edit on public.deco_production;
create policy deco_prod_edit on public.deco_production for update to authenticated
  using (public.can_manage_section('deco')) with check (public.can_manage_section('deco'));
grant update on public.deco_production to authenticated;

drop policy if exists spray_prod_edit on public.spray_production;
create policy spray_prod_edit on public.spray_production for update to authenticated
  using (public.can_manage_section('spray')) with check (public.can_manage_section('spray'));
grant update on public.spray_production to authenticated;
