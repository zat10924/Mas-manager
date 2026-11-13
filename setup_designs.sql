-- ربط الصنف بأكتر من كود رسمة (شغّله مرة واحدة في Supabase > SQL Editor > Run)
alter table public.catalog add column if not exists designs text[];

create or replace function public.catalog_set_designs(p_id bigint, p_designs text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and coalesce(active, true)) then
    raise exception 'not allowed';
  end if;
  update public.catalog
     set designs = case when p_designs is null or cardinality(p_designs) = 0 then null else p_designs end
   where id = p_id and kind = 'item';
end;
$$;
revoke all on function public.catalog_set_designs(bigint, text[]) from public;
grant execute on function public.catalog_set_designs(bigint, text[]) to authenticated;
