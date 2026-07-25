-- Auth go-live helper: new auth users upsert into profiles (safe if Anna profile already exists).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Anna'),
    new.email
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;

-- After Anna's auth.users row exists with id a1111111-1111-4111-8111-111111111111,
-- you may restore the FK (optional hardening):
--
-- alter table public.profiles
--   drop constraint if exists profiles_id_fkey;
-- alter table public.profiles
--   add constraint profiles_id_fkey
--   foreign key (id) references auth.users (id) on delete cascade;
--
-- Then run 20260725030000_close_dev_open_access.sql to drop open *_dev_all policies.
