-- PRODUCTION HARDENING
-- Run ONLY after Anna has a real Supabase Auth login and AUTH is enabled
-- (VITE_AUTH_DISABLED=false), and data owner_id matches her auth.users id.
--
-- This removes the temporary wide-open *_dev_all RLS policies.

do $$
declare
  t text;
  pol text;
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
    'reminders',
    'walks',
    'walk_track_points',
    'paw_reports',
    'paw_report_media',
    'website_enquiries'
  ]
  loop
    pol := t || '_dev_all';
    execute format('drop policy if exists %I on public.%I', pol, t);
  end loop;
end $$;

drop policy if exists "visit_photos_storage_dev" on storage.objects;
drop policy if exists "paw_report_media_storage_dev" on storage.objects;

-- Keep public read of sent paw report media via dedicated policies if present.
-- Re-create safe storage read for sent paw-report media (public bucket already used).
drop policy if exists "paw_report_media_storage_public_read" on storage.objects;
create policy "paw_report_media_storage_public_read"
on storage.objects for select
using (bucket_id = 'paw-report-media');

drop policy if exists "paw_report_media_storage_auth_write" on storage.objects;
create policy "paw_report_media_storage_auth_write"
on storage.objects for all
to authenticated
using (bucket_id = 'paw-report-media')
with check (bucket_id = 'paw-report-media');
