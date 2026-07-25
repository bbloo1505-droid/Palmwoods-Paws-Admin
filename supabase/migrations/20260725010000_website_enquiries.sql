-- Website contact form enquiries → Anna's CRM inbox
-- Run in Supabase SQL editor for project wuwpmixdrruonrvryfu

create table if not exists public.website_enquiries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  suburb text,
  service_needed text,
  pet_type text,
  preferred_dates text,
  pet_details text,
  message text not null default '',
  meet_greet boolean not null default false,
  source text not null default 'website',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'closed')),
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_enquiries_owner_status_idx
  on public.website_enquiries (owner_id, status, created_at desc);

alter table public.website_enquiries enable row level security;

drop policy if exists "website_enquiries_all_own" on public.website_enquiries;
create policy "website_enquiries_all_own" on public.website_enquiries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Dev open access while AUTH_DISABLED
drop policy if exists "website_enquiries_dev_all" on public.website_enquiries;
create policy "website_enquiries_dev_all" on public.website_enquiries
  for all using (true) with check (true);
