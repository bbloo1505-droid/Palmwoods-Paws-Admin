import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const LOCAL_OWNER = "a1111111-1111-4111-8111-111111111111";
const MARK = "DEMO_SEED";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const C = {
  sarah: "d1111111-1111-4111-8111-111111111101",
  james: "d1111111-1111-4111-8111-111111111102",
  emily: "d1111111-1111-4111-8111-111111111103",
  tom: "d1111111-1111-4111-8111-111111111104",
  priya: "d1111111-1111-4111-8111-111111111105",
  mark: "d1111111-1111-4111-8111-111111111106",
};

const P = {
  charlie: "d2222222-2222-4222-8222-222222222201",
  bella: "d2222222-2222-4222-8222-222222222202",
  max: "d2222222-2222-4222-8222-222222222203",
  luna: "d2222222-2222-4222-8222-222222222204",
  coco: "d2222222-2222-4222-8222-222222222205",
  maple: "d2222222-2222-4222-8222-222222222206",
  kiwi: "d2222222-2222-4222-8222-222222222207",
  nala: "d2222222-2222-4222-8222-222222222208",
};

const SERIES = "d3333333-3333-4333-8333-333333333301";
const WALK = "d4444444-4444-4444-8444-444444444401";
const REPORT = "d5555555-5555-4555-8555-555555555501";
const TOKEN = "DEMO01";

function dayAt(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function routeAroundPalmwoods(walkId: string, startedAt: string) {
  const base = new Date(startedAt).getTime();
  // Rough Palmwoods / Montville foothills area
  const start = { lat: -26.6842, lng: 152.9598 };
  const steps = [
    [0, 0],
    [0.0006, 0.0004],
    [0.0012, 0.0009],
    [0.0018, 0.0011],
    [0.0024, 0.0006],
    [0.0030, 0.0001],
    [0.0034, -0.0005],
    [0.0028, -0.0010],
    [0.0020, -0.0012],
    [0.0012, -0.0008],
    [0.0005, -0.0003],
    [0, 0],
  ] as const;
  return steps.map(([dLat, dLng], i) => ({
    walk_id: walkId,
    recorded_at: new Date(base + i * 3 * 60 * 1000).toISOString(),
    lat: start.lat + dLat,
    lng: start.lng + dLng,
    accuracy: 8,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: unknown; ownerId?: unknown } = {};
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    body = {};
  }
  const action =
    body.action === "clear"
      ? "clear"
      : body.action === "reset_test"
        ? "reset_test"
        : "load";
  const requestedOwner =
    typeof body.ownerId === "string" && UUID_RE.test(body.ownerId) ? body.ownerId : "";

  const throwIf = (error: { message?: string } | null, label: string) => {
    if (error) throw new Error(`${label}: ${error.message || "unknown error"}`);
  };

  const tableExists = async (table: string) => {
    const { error } = await sb.from(table).select("*").limit(1);
    if (!error) return true;
    const msg = error.message || "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) return false;
    return true;
  };

  const resolveOwnerId = async () => {
    if (requestedOwner) {
      const { data } = await sb.from("profiles").select("id").eq("id", requestedOwner).maybeSingle();
      if (data?.id) return data.id as string;
    }

    // Prefer the real Auth user for Anna's email over the legacy local profile id
    try {
      const listed = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = (listed.data.users ?? []).find(
        (u) => (u.email || "").toLowerCase() === "contact@palmwoodspaws.com",
      );
      if (authUser?.id) {
        await sb.from("profiles").upsert(
          {
            id: authUser.id,
            full_name: "Anna",
            email: "contact@palmwoodspaws.com",
          },
          { onConflict: "id" },
        );
        return authUser.id;
      }
    } catch {
      /* fall through */
    }

    const { data: byEmail } = await sb
      .from("profiles")
      .select("id")
      .eq("email", "contact@palmwoodspaws.com");
    const profiles = byEmail ?? [];
    const nonLocal = profiles.find((p) => p.id !== LOCAL_OWNER);
    if (nonLocal?.id) return nonLocal.id as string;
    if (profiles[0]?.id) return profiles[0].id as string;

    return LOCAL_OWNER;
  };

  const clientIds = Object.values(C);
  const petIds = Object.values(P);

  const clearDemo = async () => {
    const hasWalks = await tableExists("walks");
    const hasReports = await tableExists("paw_reports");
    const hasEnquiries = await tableExists("website_enquiries");

    if (hasWalks) {
      if (await tableExists("walk_track_points")) {
        await sb.from("walk_track_points").delete().eq("walk_id", WALK);
      }
      if (hasReports) await sb.from("paw_reports").delete().eq("id", REPORT);
      await sb.from("walks").delete().eq("id", WALK);
    }

    // Clear by demo ids / markers so orphaned rows after auth remap are removed too
    const { data: oldBookings, error: oldBookErr } = await sb
      .from("bookings")
      .select("id")
      .or(`notes.eq.${MARK},series_id.eq.${SERIES},client_id.in.(${clientIds.join(",")})`);
    throwIf(oldBookErr, "list old bookings");

    const oldBookingIds = (oldBookings ?? []).map((b) => b.id);
    if (oldBookingIds.length) {
      const { data: oldVisits } = await sb
        .from("visits")
        .select("id")
        .in("booking_id", oldBookingIds);
      const visitIds = (oldVisits ?? []).map((v) => v.id);
      if (visitIds.length) {
        await sb.from("visit_checklist_items").delete().in("visit_id", visitIds);
        await sb.from("visit_photos").delete().in("visit_id", visitIds);
        await sb.from("invoices").update({ visit_id: null }).in("visit_id", visitIds);
        await sb.from("visits").delete().in("id", visitIds);
      }
      await sb.from("bookings").delete().in("id", oldBookingIds);
    }

    await sb.from("invoices").delete().in("client_id", clientIds);
    await sb.from("reminders").delete().in("pet_id", petIds);
    if (hasEnquiries) {
      await sb.from("website_enquiries").delete().like("name", "Demo %");
    }
    await sb.from("pets").delete().in("id", petIds);
    await sb.from("house_info").delete().in("client_id", clientIds);
    await sb.from("clients").delete().in("id", clientIds);

    return { hasWalks, hasReports, hasEnquiries };
  };

  /** Wipe ALL operational data for this owner, then leave one blank test client. */
  const resetToTestClient = async (ownerId: string) => {
    const hasWalks = await tableExists("walks");
    const hasReports = await tableExists("paw_reports");
    const hasEnquiries = await tableExists("website_enquiries");

    if (hasWalks) {
      const { data: ownerWalks } = await sb.from("walks").select("id").eq("owner_id", ownerId);
      const walkIds = (ownerWalks ?? []).map((w) => w.id as string);
      if (walkIds.length) {
        if (await tableExists("walk_track_points")) {
          await sb.from("walk_track_points").delete().in("walk_id", walkIds);
        }
        if (hasReports) await sb.from("paw_reports").delete().in("walk_id", walkIds);
        await sb.from("walks").delete().in("id", walkIds);
      }
    }

    const { data: ownerBookings, error: bookListErr } = await sb
      .from("bookings")
      .select("id")
      .eq("owner_id", ownerId);
    throwIf(bookListErr, "list owner bookings");
    const bookingIds = (ownerBookings ?? []).map((b) => b.id as string);

    if (bookingIds.length) {
      const { data: ownerVisits } = await sb
        .from("visits")
        .select("id")
        .in("booking_id", bookingIds);
      const visitIds = (ownerVisits ?? []).map((v) => v.id as string);
      if (visitIds.length) {
        await sb.from("visit_checklist_items").delete().in("visit_id", visitIds);
        await sb.from("visit_photos").delete().in("visit_id", visitIds);
        await sb.from("invoices").update({ visit_id: null }).in("visit_id", visitIds);
        await sb.from("visits").delete().in("id", visitIds);
      }
      await sb.from("bookings").delete().in("id", bookingIds);
    }

    await sb.from("invoices").delete().eq("owner_id", ownerId);
    await sb.from("reminders").delete().eq("owner_id", ownerId);
    if (hasEnquiries) await sb.from("website_enquiries").delete().eq("owner_id", ownerId);

    await sb.from("pets").delete().eq("owner_id", ownerId);

    const { data: ownerClients } = await sb.from("clients").select("id").eq("owner_id", ownerId);
    const allClientIds = (ownerClients ?? []).map((c) => c.id as string);
    if (allClientIds.length) {
      await sb.from("house_info").delete().in("client_id", allClientIds);
      await sb.from("clients").delete().in("id", allClientIds);
    }

    // Also clear any leftover fixed demo ids (orphans after owner remap)
    await clearDemo();

    const TEST_CLIENT_ID = "e1111111-1111-4111-8111-111111111199";
    const { error: insertErr } = await sb.from("clients").insert({
      id: TEST_CLIENT_ID,
      owner_id: ownerId,
      name: "Test Client",
      phone: null,
      email: null,
      address: null,
      suburb: "Palmwoods",
      preferred_payment: null,
      emergency_contact: null,
      notes: "Blank test client — fill in details, then create an invoice.",
    });
    throwIf(insertErr, "insert test client");

    return { testClientId: TEST_CLIENT_ID, testClientName: "Test Client" };
  };

  try {
    const OWNER = await resolveOwnerId();

    // Ensure Anna profile exists for the active owner
    const { error: profileErr } = await sb.from("profiles").upsert(
      {
        id: OWNER,
        full_name: "Anna",
        email: "contact@palmwoodspaws.com",
      },
      { onConflict: "id" },
    );
    throwIf(profileErr, "profiles");

    if (action === "clear") {
      await clearDemo();
      return res.status(200).json({
        ok: true,
        action: "clear",
        message: "Demo data removed.",
        ownerId: OWNER,
      });
    }

    if (action === "reset_test") {
      const result = await resetToTestClient(OWNER);
      return res.status(200).json({
        ok: true,
        action: "reset_test",
        message: "Cleared all data. One blank test client is ready for invoice testing.",
        ownerId: OWNER,
        ...result,
      });
    }

    const { hasWalks, hasReports, hasEnquiries } = await clearDemo();

    const { error: clientsErr } = await sb.from("clients").insert([
      {
        id: C.sarah,
        owner_id: OWNER,
        name: "Sarah Mitchell",
        phone: "0412 111 222",
        email: "sarah.mitchell@example.com",
        address: "12 Hibiscus Lane",
        suburb: "Palmwoods",
        preferred_payment: "Weekly transfer",
        emergency_contact: "Tom Mitchell 0413 000 111",
        notes: "Regular Mon / Wed / Fri walks. Prefers morning slots.",
      },
      {
        id: C.james,
        owner_id: OWNER,
        name: "James Carter",
        phone: "0433 444 555",
        email: "james.carter@example.com",
        address: "8 Pioneer Cres",
        suburb: "Woombye",
        preferred_payment: "Cash",
        notes: "Works from 9–3. Pet visits while he's at the warehouse.",
      },
      {
        id: C.emily,
        owner_id: OWNER,
        name: "Emily Nguyen",
        phone: "0400 777 888",
        email: "emily.nguyen@example.com",
        address: "22 Ocean View Rd",
        suburb: "Buderim",
        preferred_payment: "Invoice",
        emergency_contact: "Mum 0411 222 333",
        notes: "Loves longer afternoon adventures. Creek track OK when dry.",
      },
      {
        id: C.tom,
        owner_id: OWNER,
        name: "Tom Harris",
        phone: "0421 555 666",
        email: "tom.harris@example.com",
        address: "5 Razorback Rd",
        suburb: "Montville",
        preferred_payment: "Weekly transfer",
        notes: "New client after meet & greet. Quiet dog, nervous of bikes.",
      },
      {
        id: C.priya,
        owner_id: OWNER,
        name: "Priya Sharma",
        phone: "0477 888 999",
        email: "priya.sharma@example.com",
        address: "14 Margaret St",
        suburb: "Nambour",
        preferred_payment: "Invoice",
        notes: "Cat minding + occasional dog walk for Maple.",
      },
      {
        id: C.mark,
        owner_id: OWNER,
        name: "Mark & Jess Byrne",
        phone: "0418 222 333",
        email: "byrne.family@example.com",
        address: "3 Palm Court",
        suburb: "Palmwoods",
        preferred_payment: "Weekly transfer",
        emergency_contact: "Jess 0418 222 334",
        notes: "Two-dog household. Walk together unless one is sore.",
      },
    ]);
    throwIf(clientsErr, "clients");

    const { error: houseErr } = await sb.from("house_info").insert([
      {
        client_id: C.sarah,
        key_location: "Green meter box left of garage",
        alarm_notes: "Press OFF twice",
        bin_day: "Thursday",
        gate_notes: "Keep side gate closed",
        extras: "Water bowl by laundry — refill if low",
      },
      {
        client_id: C.james,
        key_location: "Under doormat (temporary)",
        alarm_notes: "No alarm",
        bin_day: "Tuesday",
        gate_notes: "Latch front gate",
        extras: "Feed cat too if home before 1pm",
      },
      {
        client_id: C.emily,
        key_location: "Lockbox code 4281",
        alarm_notes: "Disarm with 2468#",
        bin_day: "Friday",
        gate_notes: "Side path preferred",
        extras: "Lead hangs on laundry hook",
      },
      {
        client_id: C.tom,
        key_location: "Lockbox 7193",
        alarm_notes: "None",
        bin_day: "Wednesday",
        gate_notes: "Slow with the drive gate — squeaks",
        extras: "Treat pouch on hall table",
      },
      {
        client_id: C.priya,
        key_location: "With neighbour at #12 if not home",
        alarm_notes: "None",
        bin_day: "Monday",
        gate_notes: "Courtyard gate — lift latch",
        extras: "Cat litter scoop under sink",
      },
      {
        client_id: C.mark,
        key_location: "Spare key in black rock by jasmine",
        alarm_notes: "Panel inside laundry",
        bin_day: "Thursday",
        gate_notes: "Double gate — close both",
        extras: "Harnesses on hook; Nala needs the padded one",
      },
    ]);
    throwIf(houseErr, "house_info");

    const { error: petsErr } = await sb.from("pets").insert([
      {
        id: P.charlie,
        owner_id: OWNER,
        client_id: C.sarah,
        name: "Charlie",
        species: "dog",
        breed: "Border Collie",
        weight_kg: 22,
        favourite_treats: "Chicken bits",
        behaviour: "Energetic, ball-obsessed, excellent recall",
        commands: "Sit, stay, leave it",
        feeding: "Breakfast already done before walks",
        preferred_route: "Palmwoods village loop",
        can_off_leash: true,
        swims: true,
        vet_name: "Palmwoods Vet",
        photo_url:
          "https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=600&q=80",
        notes: "Needs a solid run or he'll invent jobs at home.",
      },
      {
        id: P.bella,
        owner_id: OWNER,
        client_id: C.sarah,
        name: "Bella",
        species: "dog",
        breed: "Cavoodle",
        weight_kg: 8.5,
        medication: "Heartworm monthly (1st of month)",
        behaviour: "Friendly with known dogs, shy with strangers at first",
        can_off_leash: false,
        swims: false,
        favourite_treats: "Cheese cubes",
        photo_url:
          "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: P.max,
        owner_id: OWNER,
        client_id: C.james,
        name: "Max",
        species: "dog",
        breed: "Staffy mix",
        weight_kg: 26,
        behaviour: "Pulls on lead first 5 minutes, then settles",
        feeding: "Leave puzzle feeder if visit is lunchtime",
        can_off_leash: false,
        swims: false,
        photo_url:
          "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: P.luna,
        owner_id: OWNER,
        client_id: C.emily,
        name: "Luna",
        species: "dog",
        breed: "Kelpie",
        weight_kg: 18,
        behaviour: "Loves creek track, high drive, happiest moving",
        preferred_route: "Buderim forest trails",
        can_off_leash: true,
        swims: true,
        photo_url:
          "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=600&q=80",
        notes: "Bring water bottle — she drinks a lot after runs.",
      },
      {
        id: P.coco,
        owner_id: OWNER,
        client_id: C.tom,
        name: "Coco",
        species: "dog",
        breed: "Groodle",
        weight_kg: 14,
        behaviour: "Quiet, nervous of bikes — step off path early",
        can_off_leash: false,
        swims: false,
        photo_url:
          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: P.maple,
        owner_id: OWNER,
        client_id: C.priya,
        name: "Maple",
        species: "dog",
        breed: "Spoodle",
        weight_kg: 9,
        behaviour: "Gentle, good on short neighbourhood loops",
        can_off_leash: false,
        swims: false,
        photo_url:
          "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: P.kiwi,
        owner_id: OWNER,
        client_id: C.priya,
        name: "Kiwi",
        species: "cat",
        breed: "Domestic shorthair",
        behaviour: "Shy — leave food and soft talk, don't force cuddles",
        feeding: "Half tin wet + kibble top-up",
        can_off_leash: false,
        swims: false,
        photo_url:
          "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80",
      },
      {
        id: P.nala,
        owner_id: OWNER,
        client_id: C.mark,
        name: "Nala",
        species: "dog",
        breed: "Lab mix",
        weight_kg: 28,
        behaviour: "Friendly tank — keep away from smaller reactive dogs",
        can_off_leash: true,
        swims: true,
        photo_url:
          "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=600&q=80",
      },
    ]);
    throwIf(petsErr, "pets");

    // Recurring Mon/Wed/Fri Charlie walks for 4 weeks + today jobs + past completed
    const recurring: {
      owner_id: string;
      client_id: string;
      pet_id: string;
      starts_at: string;
      service_type: string;
      amount: number;
      status: string;
      notes: string;
      recurrence_rule: string;
      series_id: string;
    }[] = [];

    for (let week = 0; week < 4; week++) {
      for (const weekdayOffset of [0, 2, 4]) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const day = start.getDay(); // 0 Sun
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const d = new Date(start);
        d.setDate(start.getDate() + mondayOffset + weekdayOffset + week * 7);
        d.setHours(8, 30, 0, 0);
        if (d < new Date(start.getTime() - 7 * 86400000)) continue;
        const past = d.getTime() < Date.now() - 60 * 60 * 1000;
        recurring.push({
          owner_id: OWNER,
          client_id: C.sarah,
          pet_id: P.charlie,
          starts_at: d.toISOString(),
          service_type: "dog_walk",
          amount: 28,
          status: past ? "completed" : "scheduled",
          notes: MARK,
          recurrence_rule: "WEEKLY:1,3,5",
          series_id: SERIES,
        });
      }
    }

    const oneOffsBase = [
      {
        owner_id: OWNER,
        client_id: C.james,
        pet_id: P.max,
        starts_at: dayAt(0, 10, 0),
        service_type: "pet_visit",
        amount: 25,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.emily,
        pet_id: P.luna,
        starts_at: dayAt(0, 14, 0),
        service_type: "dog_walk",
        amount: 32,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.mark,
        pet_id: P.nala,
        starts_at: dayAt(0, 16, 30),
        service_type: "dog_walk",
        amount: 30,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.priya,
        pet_id: P.kiwi,
        starts_at: dayAt(1, 9, 0),
        service_type: "pet_feeding",
        amount: 22,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.tom,
        pet_id: P.coco,
        starts_at: dayAt(1, 11, 0),
        service_type: "dog_walk",
        amount: 28,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.emily,
        pet_id: P.luna,
        starts_at: dayAt(2, 15, 0),
        service_type: "dog_walk",
        amount: 32,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.priya,
        pet_id: P.maple,
        starts_at: dayAt(3, 8, 0),
        service_type: "dog_walk",
        amount: 26,
        status: "scheduled",
        notes: MARK,
      },
      {
        owner_id: OWNER,
        client_id: C.james,
        pet_id: P.max,
        starts_at: dayAt(-1, 10, 0),
        service_type: "pet_visit",
        amount: 25,
        status: "completed",
        notes: MARK,
      },
    ];

    // meet_greet only if migration allowed it
    const oneOffs = [
      ...oneOffsBase,
      {
        owner_id: OWNER,
        client_id: C.tom,
        pet_id: P.coco,
        starts_at: dayAt(5, 10, 0),
        service_type: "meet_greet",
        amount: 0,
        status: "scheduled",
        notes: MARK,
      },
    ];

    let { data: bookings, error: bookErr } = await sb
      .from("bookings")
      .insert([...recurring, ...oneOffs])
      .select("id, pet_id, client_id, starts_at, service_type, status");

    if (bookErr?.message?.includes("meet_greet")) {
      ({ data: bookings, error: bookErr } = await sb
        .from("bookings")
        .insert([...recurring, ...oneOffsBase])
        .select("id, pet_id, client_id, starts_at, service_type, status"));
    }
    throwIf(bookErr, "bookings");

    const completedVisitBooking = (bookings ?? []).find(
      (b) => b.status === "completed" && b.service_type === "pet_visit",
    );
    if (completedVisitBooking) {
      const started = completedVisitBooking.starts_at;
      const finished = new Date(new Date(started).getTime() + 25 * 60 * 1000).toISOString();
      const { data: visit, error: visitErr } = await sb
        .from("visits")
        .insert({
          owner_id: OWNER,
          booking_id: completedVisitBooking.id,
          started_at: started,
          finished_at: finished,
          status: "completed",
          notes: "Max was calm. Food puzzle done. Litter checked for Kiwi's house mate — n/a.",
        })
        .select("id")
        .single();
      throwIf(visitErr, "visits");
      await sb.from("visit_checklist_items").insert([
        { visit_id: visit.id, label: "Fresh water", done: true, sort_order: 0 },
        { visit_id: visit.id, label: "Feed / treat", done: true, sort_order: 1 },
        { visit_id: visit.id, label: "Toilet break", done: true, sort_order: 2 },
        { visit_id: visit.id, label: "Play / cuddles", done: true, sort_order: 3 },
        { visit_id: visit.id, label: "Secure house", done: true, sort_order: 4 },
      ]);
    }

    let samplePawReport: string | null = null;
    if (hasWalks && hasReports) {
      const walkStart = dayAt(-1, 14, 0);
      const walkEnd = new Date(new Date(walkStart).getTime() + 42 * 60 * 1000).toISOString();
      const { error: walkErr } = await sb.from("walks").insert({
        id: WALK,
        owner_id: OWNER,
        pet_id: P.luna,
        client_id: C.emily,
        started_at: walkStart,
        finished_at: walkEnd,
        distance_m: 3100,
        duration_sec: 42 * 60,
        suburb: "Buderim",
        status: "completed",
      });
      throwIf(walkErr, "walks");

      if (await tableExists("walk_track_points")) {
        const points = routeAroundPalmwoods(WALK, walkStart);
        const { error: ptsErr } = await sb.from("walk_track_points").insert(points);
        throwIf(ptsErr, "walk_track_points");
      }

      const { error: reportErr } = await sb.from("paw_reports").insert({
        id: REPORT,
        walk_id: WALK,
        owner_id: OWNER,
        pet_id: P.luna,
        client_id: C.emily,
        public_token: TOKEN,
        mood: "energetic",
        toilet_poo: true,
        toilet_wee: true,
        voice_note_raw: "Luna was full of beans, creek sniffari, happy girl",
        report_body:
          "Luna had a brilliant afternoon adventure around Buderim. She was full of energy, loved the sniffari near the creek, and came home happily tired. Toilet breaks all sorted.",
        suburb: "Buderim",
        distance_m: 3100,
        duration_sec: 42 * 60,
        show_full_route: false,
        status: "sent",
        sent_at: walkEnd,
      });
      throwIf(reportErr, "paw_reports");
      samplePawReport = `/pawreport/${TOKEN}`;
    }

    const { error: invErr } = await sb.from("invoices").insert([
      {
        owner_id: OWNER,
        client_id: C.sarah,
        amount: 168,
        status: "owed",
        due_on: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        notes: "6 walks this fortnight",
      },
      {
        owner_id: OWNER,
        client_id: C.emily,
        amount: 96,
        status: "owed",
        due_on: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        notes: "3 walks incl. weekend",
      },
      {
        owner_id: OWNER,
        client_id: C.james,
        amount: 75,
        status: "paid",
        due_on: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
        paid_on: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        notes: "3 pet visits",
      },
      {
        owner_id: OWNER,
        client_id: C.mark,
        amount: 120,
        status: "owed",
        due_on: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        notes: "Shared walks for Nala",
      },
    ]);
    throwIf(invErr, "invoices");

    const { error: remErr } = await sb.from("reminders").insert([
      {
        owner_id: OWNER,
        pet_id: P.bella,
        title: "Bella vaccination due",
        due_on: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
        kind: "vaccination",
      },
      {
        owner_id: OWNER,
        pet_id: P.max,
        title: "Max heartworm tablet",
        due_on: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        kind: "medication",
      },
      {
        owner_id: OWNER,
        pet_id: P.charlie,
        title: "Charlie's birthday",
        due_on: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
        kind: "birthday",
      },
      {
        owner_id: OWNER,
        client_id: C.emily,
        title: "Invoice Emily for last week",
        due_on: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
        kind: "general",
      },
    ]);
    throwIf(remErr, "reminders");

    if (hasEnquiries) {
      const enquiries = [
        {
          owner_id: OWNER,
          name: "Demo Sophie Lane",
          email: "sophie.lane@example.com",
          phone: "0401 222 333",
          suburb: "Palmwoods",
          service_needed: "Regular weekday walks",
          pet_type: "dog",
          pet_details: "Friendly 2yo labrador, needs midday walk Mon-Fri",
          message:
            "Hi Anna, we both work in town and need a reliable walker. Are you taking new clients?",
          status: "new",
        },
        {
          owner_id: OWNER,
          name: "Demo Ben Walsh",
          email: "ben.walsh@example.com",
          phone: "0499 111 000",
          suburb: "Woombye",
          service_needed: "Pet minding",
          pet_type: "dog",
          pet_details: "1 cavoodle",
          message: "Away for a long weekend in August - can you do twice-daily visits?",
          status: "contacted",
        },
        {
          owner_id: OWNER,
          name: "Demo Rachel Ong",
          email: "rachel.ong@example.com",
          phone: "0432 888 777",
          suburb: "Buderim",
          service_needed: "Meet & greet",
          pet_type: "cat",
          pet_details: "2 indoor cats",
          message: "Looking for cat minding while we're interstate.",
          status: "new",
        },
      ];
      const { error: enqErr } = await sb.from("website_enquiries").insert(enquiries);
      throwIf(enqErr, "website_enquiries");
    }

    return res.status(200).json({
      ok: true,
      action: "load",
      message: "Demo data loaded.",
      ownerId: OWNER,
      clients: clientIds.length,
      pets: petIds.length,
      bookings: (bookings ?? []).length,
      samplePawReport,
      skipped: {
        walks: !hasWalks,
        pawReports: !hasReports,
        enquiries: !hasEnquiries,
      },
    });
  } catch (e) {
    console.error("seed-demo failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Seed failed.",
    });
  }
}
