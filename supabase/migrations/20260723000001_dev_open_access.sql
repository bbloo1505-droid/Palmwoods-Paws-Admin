-- Temporary open access while auth is disabled in the app.
-- Run this in the Supabase SQL editor after the init migration.

-- Allow a local profile without an auth.users row
alter table public.profiles drop constraint if exists profiles_id_fkey;

insert into public.profiles (id, full_name, email)
values (
  'a1111111-1111-4111-8111-111111111111',
  'Anna',
  'anna@palmwoodspaws.local'
)
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email;

-- Open RLS for early testing (replace later when auth returns)
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'clients',
    'house_info',
    'pets',
    'bookings',
    'visits',
    'visit_checklist_items',
    'visit_photos',
    'invoices',
    'reminders'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_dev_all', t);
    execute format(
      'create policy %I on public.%I for all using (true) with check (true)',
      t || '_dev_all',
      t
    );
  end loop;
end $$;

-- Storage: allow anon upload/read while auth is off
drop policy if exists "visit_photos_storage_dev" on storage.objects;
create policy "visit_photos_storage_dev"
on storage.objects for all
using (bucket_id in ('visit-photos', 'pet-avatars'))
with check (bucket_id in ('visit-photos', 'pet-avatars'));
