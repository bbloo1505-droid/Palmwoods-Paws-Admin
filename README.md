# Palmwoods Paws Ops

Anna's daily operating system for dog walking and pet minding — clients, pets, calendar, visits, house info, and invoices in one place.

This is **not** the marketing website. It is a separate app for Anna to use on phone and laptop.

## Stack

- Vite + React 19 + TypeScript
- TanStack Router
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)

## Quick start

1. Create a Supabase project.
2. In the Supabase SQL editor, run:
   - [`supabase/migrations/20260723000000_init.sql`](supabase/migrations/20260723000000_init.sql)
3. Create Anna's user under **Authentication → Users** (email + password), or sign up from `/login`.
4. Copy env:

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.

5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:5173

6. Optional demo data: edit [`supabase/seed.sql`](supabase/seed.sql), replace `YOUR_USER_UUID` with Anna's user id from `auth.users`, then run it in the SQL editor.

## Version 1 features

- Daily dashboard (today's jobs, revenue, outstanding invoices, reminders)
- Clients + house instructions
- Pet profiles
- Calendar with weekly recurring bookings
- Visit flow: start → checklist → notes → photos → finish → invoice
- Invoice tracking (owed / paid)

## Version 2 (later)

- GPS walk tracking
- Automatic owner reports
- Invoice emailing
- Online booking requests
- Reminder SMS/email

## Deploy (Vercel)

1. Push this repo to GitHub (`palmwoods-paws-ops`).
2. Import the project in Vercel.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. `vercel.json` already rewrites SPA routes to `index.html`.

## Security notes

- Row Level Security scopes all data to Anna's `auth.uid()`.
- Visit photos are private (signed URLs).
- Pet avatars bucket is public-read for simple profile images.

## Product principle

Don't build a SaaS first. Build something Anna reaches for every morning instead of her diary, notes, and photo gallery.
