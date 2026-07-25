-- Enquiry workflow statuses + Meet & Greet booking type
-- Run in Supabase SQL editor for project wuwpvmixdrruonrvryfu

alter table public.website_enquiries drop constraint if exists website_enquiries_status_check;
alter table public.website_enquiries
  add constraint website_enquiries_status_check
  check (status in ('new', 'contacted', 'meet_greet', 'booked', 'converted', 'closed'));

alter table public.bookings drop constraint if exists bookings_service_type_check;
alter table public.bookings
  add constraint bookings_service_type_check
  check (service_type in ('dog_walk', 'pet_visit', 'pet_feeding', 'pet_minding', 'meet_greet', 'other'));
