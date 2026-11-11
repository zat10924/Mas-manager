-- شغّله مرة واحدة من Supabase -> SQL Editor
-- بيسمح للمدير بإضافة مستخدم بالاسم وكلمة السر بس (من غير إيميل حقيقي)،
-- وبتغيير كلمة سر أي مستخدم. الحساب بيتعمل مؤكد وجاهز للدخول بالاسم.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_create_user(
  p_name text, p_password text, p_role text, p_section text, p_perms jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text;
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and coalesce(active, true)) then
    raise exception 'not allowed';
  end if;
  if length(v_name) < 2 then raise exception 'name too short'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'password too short'; end if;
  if p_role not in ('admin', 'manager', 'worker') then raise exception 'bad role'; end if;
  if exists (select 1 from public.profiles
             where lower(regexp_replace(trim(full_name), '\s+', ' ', 'g')) = lower(v_name)) then
    raise exception 'name already exists';
  end if;

  v_email := 'u' || substr(replace(v_id::text, '-', ''), 1, 14) || '@noemail.mas.app';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', v_name),
    now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  -- لو فيه Trigger بيعمل الـ profile تلقائي هيتحدّث، وإلا بيتضاف
  insert into public.profiles (id, full_name, email, role, section, active, perms)
  values (v_id, v_name, v_email, p_role,
          case when p_role = 'admin' then null else p_section end, true, coalesce(p_perms, '{}'::jsonb))
  on conflict (id) do update set
    full_name = excluded.full_name, email = excluded.email, role = excluded.role,
    section = excluded.section, active = true, perms = excluded.perms;

  return v_id;
end;
$$;
revoke all on function public.admin_create_user(text, text, text, text, jsonb) from public;
grant execute on function public.admin_create_user(text, text, text, text, jsonb) to authenticated;

create or replace function public.admin_set_password(p_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and coalesce(active, true)) then
    raise exception 'not allowed';
  end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'password too short'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.admin_set_password(uuid, text) from public;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
