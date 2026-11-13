-- يسمح بتسجيل إنتاج أكبر من المتبقي في الطلبية (التنبيه بيظهر في البرنامج والتقارير)
-- شغّله مرة واحدة: Supabase ← SQL Editor ← الصق ← Run
-- بيدوّر على أي Trigger/Constraint على جداول الإنتاج رسالته «الكمية أكبر من المتبقي» ويشيله.
do $$
declare r record; n int := 0;
begin
  -- 1) Triggers
  for r in
    select distinct c.relname as tbl, t.tgname as trg
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and c.relname in ('glaze_production','deco_production','spray_production','free_production')
      and (p.prosrc ilike '%أكبر من المتبقي%' or p.prosrc ilike '%المتبقي%')
  loop
    execute format('drop trigger if exists %I on public.%I', r.trg, r.tbl);
    raise notice 'اتشال trigger % من %', r.trg, r.tbl; n := n + 1;
  end loop;
  -- 2) Check constraints
  for r in
    select c.relname as tbl, k.conname as cn
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
    where k.contype = 'c'
      and c.relname in ('glaze_production','deco_production','spray_production','free_production')
      and pg_get_constraintdef(k.oid) ilike '%remain%'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.cn);
    raise notice 'اتشال constraint % من %', r.cn, r.tbl; n := n + 1;
  end loop;
  raise notice 'تم. عدد الحواجز اللي اتشالت: %', n;
end $$;
