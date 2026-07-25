-- Seed Anna's CRM owner profile (required for website_enquiries.owner_id FK)
-- Run in Supabase SQL editor for project wuwpvmixdrruonrvryfu

-- Allow a local profile UUID without a matching auth.users row
alter table public.profiles drop constraint if exists profiles_id_fkey;

insert into public.profiles (id, full_name, email)
values (
  'a1111111-1111-4111-8111-111111111111',
  'Anna',
  'contact@palmwoodspaws.com'
)
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email;
