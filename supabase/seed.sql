-- Seed demo data AFTER running: replace YOUR_USER_UUID with Anna's auth.users id
-- Example: select id, email from auth.users;

-- \set owner_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- Clients
insert into public.clients (id, owner_id, name, phone, email, address, suburb, preferred_payment, emergency_contact, notes)
values
  ('11111111-1111-1111-1111-111111111101', 'YOUR_USER_UUID', 'Sarah Mitchell', '0412 111 222', 'sarah@example.com', '12 Hibiscus Lane', 'Palmwoods', 'Weekly transfer', 'Tom Mitchell 0413 000 111', 'Regular Monday / Wednesday walks'),
  ('11111111-1111-1111-1111-111111111102', 'YOUR_USER_UUID', 'James Carter', '0433 444 555', 'james@example.com', '8 Pioneer Cres', 'Woombye', 'Cash', null, 'Pet visit while at work'),
  ('11111111-1111-1111-1111-111111111103', 'YOUR_USER_UUID', 'Emily Nguyen', '0400 777 888', 'emily@example.com', '22 Ocean View Rd', 'Buderim', 'Invoice', 'Mum 0411 222 333', 'Loves longer afternoon walks')
on conflict (id) do nothing;

insert into public.house_info (client_id, key_location, alarm_notes, bin_day, gate_notes, extras)
values
  ('11111111-1111-1111-1111-111111111101', 'Green meter box left of garage', 'Press OFF twice', 'Thursday', 'Keep side gate closed', 'Water bowl by laundry; refill if low'),
  ('11111111-1111-1111-1111-111111111102', 'Under doormat (temp)', 'No alarm', 'Tuesday', 'Latch front gate', 'Feed cat too if home before 1pm'),
  ('11111111-1111-1111-1111-111111111103', 'Lockbox code 4281', 'Disarm with 2468#', 'Friday', 'Side path preferred', 'Lead hangs on laundry hook')
on conflict (client_id) do nothing;

insert into public.pets (id, owner_id, client_id, name, species, breed, medication, feeding, behaviour, can_off_leash, swims)
values
  ('22222222-2222-2222-2222-222222222201', 'YOUR_USER_UUID', '11111111-1111-1111-1111-111111111101', 'Charlie', 'dog', 'Border Collie', null, 'Breakfast already done', 'Energetic, ball-obsessed', true, true),
  ('22222222-2222-2222-2222-222222222202', 'YOUR_USER_UUID', '11111111-1111-1111-1111-111111111101', 'Bella', 'dog', 'Cavoodle', 'Heartworm monthly', 'Half scoop evening', 'Friendly with known dogs', false, false),
  ('22222222-2222-2222-2222-222222222203', 'YOUR_USER_UUID', '11111111-1111-1111-1111-111111111102', 'Max', 'dog', 'Staffy mix', null, 'Leave puzzle feeder', 'Pulls on lead first 5 min', false, false),
  ('22222222-2222-2222-2222-222222222204', 'YOUR_USER_UUID', '11111111-1111-1111-1111-111111111103', 'Luna', 'dog', 'Kelpie', null, 'Bring water bottle', 'Loves creek track', true, true)
on conflict (id) do nothing;

insert into public.reminders (owner_id, pet_id, title, due_on, kind)
values
  ('YOUR_USER_UUID', '22222222-2222-2222-2222-222222222202', 'Bella vaccination due', current_date + 12, 'vaccination'),
  ('YOUR_USER_UUID', '22222222-2222-2222-2222-222222222203', 'Max heartworm tablet', current_date + 3, 'medication'),
  ('YOUR_USER_UUID', '22222222-2222-2222-2222-222222222201', 'Charlie birthday', current_date + 20, 'birthday');

-- Today's sample bookings (adjust times as needed)
insert into public.bookings (owner_id, client_id, pet_id, starts_at, service_type, amount, status)
values
  ('YOUR_USER_UUID', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', date_trunc('day', now()) + interval '8 hours', 'dog_walk', 28, 'scheduled'),
  ('YOUR_USER_UUID', '11111111-1111-1111-1111-111111111102', '22222222-2222-2222-2222-222222222203', date_trunc('day', now()) + interval '10 hours', 'pet_visit', 25, 'scheduled'),
  ('YOUR_USER_UUID', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222204', date_trunc('day', now()) + interval '14 hours', 'dog_walk', 30, 'scheduled');

insert into public.invoices (owner_id, client_id, amount, status, due_on, notes)
values
  ('YOUR_USER_UUID', '11111111-1111-1111-1111-111111111101', 84, 'owed', current_date + 7, '3 walks last week'),
  ('YOUR_USER_UUID', '11111111-1111-1111-1111-111111111103', 96, 'owed', current_date + 3, '2 walks + weekend minding');
