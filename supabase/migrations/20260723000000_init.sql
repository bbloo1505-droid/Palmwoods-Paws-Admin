-- Palmwoods Paws Ops — Version 1 schema
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  suburb text,
  notes text,
  emergency_contact text,
  preferred_payment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.house_info (
  client_id uuid primary key references public.clients (id) on delete cascade,
  key_location text,
  alarm_notes text,
  bin_day text,
  gate_notes text,
  wifi text,
  garage_code text,
  extras text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  species text not null default 'dog',
  breed text,
  birthday date,
  microchip text,
  vet_name text,
  vaccinated_until date,
  weight_kg numeric(6, 2),
  favourite_treats text,
  behaviour text,
  commands text,
  medication text,
  feeding text,
  house_access text,
  lead_location text,
  preferred_route text,
  known_dogs text,
  can_off_leash boolean not null default false,
  swims boolean not null default false,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  starts_at timestamptz not null,
  service_type text not null default 'dog_walk'
    check (service_type in ('dog_walk', 'pet_visit', 'pet_feeding', 'pet_minding', 'other')),
  recurrence_rule text,
  series_id uuid,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  notes text,
  amount numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.visit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete set null,
  amount numeric(10, 2) not null,
  status text not null default 'owed'
    check (status in ('owed', 'paid', 'void')),
  due_on date,
  paid_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  title text not null,
  due_on date not null,
  kind text not null default 'general',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clients_owner_idx on public.clients (owner_id);
create index if not exists pets_owner_idx on public.pets (owner_id);
create index if not exists pets_client_idx on public.pets (client_id);
create index if not exists bookings_owner_starts_idx on public.bookings (owner_id, starts_at);
create index if not exists bookings_series_idx on public.bookings (series_id);
create index if not exists visits_owner_idx on public.visits (owner_id);
create index if not exists invoices_owner_status_idx on public.invoices (owner_id, status);
create index if not exists reminders_owner_due_idx on public.reminders (owner_id, due_on);

-- Auto-create profile on signup
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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

drop trigger if exists house_info_set_updated_at on public.house_info;
create trigger house_info_set_updated_at
  before update on public.house_info
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.house_info enable row level security;
alter table public.pets enable row level security;
alter table public.bookings enable row level security;
alter table public.visits enable row level security;
alter table public.visit_checklist_items enable row level security;
alter table public.visit_photos enable row level security;
alter table public.invoices enable row level security;
alter table public.reminders enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Clients
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- House info via client ownership
create policy "house_info_all_own" on public.house_info
  for all using (
    exists (
      select 1 from public.clients c
      where c.id = house_info.client_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = house_info.client_id and c.owner_id = auth.uid()
    )
  );

-- Pets
create policy "pets_all_own" on public.pets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Bookings
create policy "bookings_all_own" on public.bookings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Visits
create policy "visits_all_own" on public.visits
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Checklist via visit ownership
create policy "checklist_all_own" on public.visit_checklist_items
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_checklist_items.visit_id and v.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_checklist_items.visit_id and v.owner_id = auth.uid()
    )
  );

-- Photos via visit ownership
create policy "photos_all_own" on public.visit_photos
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id and v.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id and v.owner_id = auth.uid()
    )
  );

-- Invoices
create policy "invoices_all_own" on public.invoices
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Reminders
create policy "reminders_all_own" on public.reminders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('pet-avatars', 'pet-avatars', true)
on conflict (id) do nothing;

create policy "visit_photos_storage_own"
on storage.objects for all
using (
  bucket_id = 'visit-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'visit-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "pet_avatars_storage_own"
on storage.objects for all
using (
  bucket_id = 'pet-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'pet-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "pet_avatars_public_read"
on storage.objects for select
using (bucket_id = 'pet-avatars');
