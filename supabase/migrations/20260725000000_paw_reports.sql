-- Paw Reports + Walks (customer-facing layer; GPS tables optional / unused for now)
-- Run after init + optional dev_open_access migrations.

create table if not exists public.walks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  visit_id uuid references public.visits (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  distance_m numeric(10, 1) not null default 0,
  duration_sec int not null default 0,
  suburb text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.walk_track_points (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.walks (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy numeric(8, 2)
);

create table if not exists public.paw_reports (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null unique references public.walks (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  public_token text not null unique,
  mood text,
  toilet_poo boolean not null default false,
  toilet_wee boolean not null default false,
  voice_note_raw text,
  report_body text,
  suburb text,
  distance_m numeric(10, 1) not null default 0,
  duration_sec int not null default 0,
  show_full_route boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.paw_report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.paw_reports (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists walks_pet_started_idx on public.walks (pet_id, started_at desc);
create index if not exists walk_track_points_walk_idx on public.walk_track_points (walk_id, recorded_at);
create index if not exists paw_reports_token_idx on public.paw_reports (public_token);
create index if not exists paw_reports_client_idx on public.paw_reports (client_id, created_at desc);

alter table public.walks enable row level security;
alter table public.walk_track_points enable row level security;
alter table public.paw_reports enable row level security;
alter table public.paw_report_media enable row level security;

-- Operator policies (Anna)
create policy "walks_all_own" on public.walks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "walk_points_all_own" on public.walk_track_points
  for all using (
    exists (select 1 from public.walks w where w.id = walk_id and w.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.walks w where w.id = walk_id and w.owner_id = auth.uid())
  );

create policy "paw_reports_all_own" on public.paw_reports
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "paw_media_all_own" on public.paw_report_media
  for all using (
    exists (select 1 from public.paw_reports r where r.id = report_id and r.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.paw_reports r where r.id = report_id and r.owner_id = auth.uid())
  );

-- Dev open access (matches AUTH_DISABLED local owner)
create policy "walks_dev_all" on public.walks for all using (true) with check (true);
create policy "walk_points_dev_all" on public.walk_track_points for all using (true) with check (true);
create policy "paw_reports_dev_all" on public.paw_reports for all using (true) with check (true);
create policy "paw_media_dev_all" on public.paw_report_media for all using (true) with check (true);

-- Public: anyone with the token can read a sent report
create policy "paw_reports_public_read_sent" on public.paw_reports
  for select using (status = 'sent');

create policy "paw_media_public_read_sent" on public.paw_report_media
  for select using (
    exists (
      select 1 from public.paw_reports r
      where r.id = report_id and r.status = 'sent'
    )
  );

-- Public can read pet name/species for sent reports (limited fields via view)
create or replace view public.paw_report_public as
select
  r.id,
  r.public_token,
  r.mood,
  r.toilet_poo,
  r.toilet_wee,
  r.report_body,
  r.suburb,
  r.distance_m,
  r.duration_sec,
  r.show_full_route,
  r.sent_at,
  r.created_at,
  p.name as pet_name,
  p.species as pet_species,
  p.photo_url as pet_photo_url,
  c.name as client_name
from public.paw_reports r
join public.pets p on p.id = r.pet_id
join public.clients c on c.id = r.client_id
where r.status = 'sent';

grant select on public.paw_report_public to anon, authenticated;

-- Safe route points for public (trim first/last 15% unless show_full_route)
create or replace function public.get_public_walk_route(p_token text)
returns table (lat double precision, lng double precision, recorded_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_walk uuid;
  v_full boolean;
  v_count int;
  v_trim int;
begin
  select r.walk_id, r.show_full_route
    into v_walk, v_full
  from public.paw_reports r
  where r.public_token = p_token and r.status = 'sent';

  if v_walk is null then
    return;
  end if;

  select count(*) into v_count from public.walk_track_points where walk_id = v_walk;
  if v_count = 0 then
    return;
  end if;

  if v_full or v_count < 8 then
    return query
      select t.lat, t.lng, t.recorded_at
      from public.walk_track_points t
      where t.walk_id = v_walk
      order by t.recorded_at;
  else
    v_trim := greatest(1, floor(v_count * 0.15)::int);
    return query
      select x.lat, x.lng, x.recorded_at
      from (
        select t.lat, t.lng, t.recorded_at,
               row_number() over (order by t.recorded_at) as rn,
               count(*) over () as total
        from public.walk_track_points t
        where t.walk_id = v_walk
      ) x
      where x.rn > v_trim and x.rn <= (x.total - v_trim)
      order by x.recorded_at;
  end if;
end;
$$;

grant execute on function public.get_public_walk_route(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('paw-report-media', 'paw-report-media', true)
on conflict (id) do nothing;

drop policy if exists "paw_report_media_storage_dev" on storage.objects;
create policy "paw_report_media_storage_dev"
on storage.objects for all
using (bucket_id = 'paw-report-media')
with check (bucket_id = 'paw-report-media');
