import { addWeeks, endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CHECKLIST,
  type Booking,
  type BookingWithRelations,
  type Client,
  type HouseInfo,
  type Invoice,
  type PawMood,
  type PawReport,
  type PawReportMedia,
  type Pet,
  type PublicPawReport,
  type Reminder,
  type ServiceType,
  type Visit,
  type VisitChecklistItem,
  type VisitPhoto,
  type Walk,
  type WalkTrackPoint,
  type WebsiteEnquiry,
  type EnquiryStatus,
} from "@/lib/types";
import { haversineMetres, makePublicToken, polishPawReportCopy } from "@/lib/utils";

export async function listClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Client;
}

export async function upsertClient(
  ownerId: string,
  payload: Partial<Client> & { name: string },
  id?: string,
) {
  if (id) {
    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Client;
  }
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...payload, owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function getHouseInfo(clientId: string) {
  const { data, error } = await supabase
    .from("house_info")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return (data as HouseInfo | null) ?? null;
}

export async function upsertHouseInfo(clientId: string, payload: Partial<HouseInfo>) {
  const { data, error } = await supabase
    .from("house_info")
    .upsert({ client_id: clientId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return data as HouseInfo;
}

export async function listPets(clientId?: string) {
  let q = supabase.from("pets").select("*").order("name", { ascending: true });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Pet[];
}

export async function getPet(id: string) {
  const { data, error } = await supabase.from("pets").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Pet;
}

export async function upsertPet(
  ownerId: string,
  payload: Partial<Pet> & { name: string; client_id: string },
  id?: string,
) {
  if (id) {
    const { data, error } = await supabase
      .from("pets")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Pet;
  }
  const { data, error } = await supabase
    .from("pets")
    .insert({ ...payload, owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Pet;
}

export async function deletePet(id: string) {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

export async function listBookingsBetween(from: Date, to: Date) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      client:clients(id, name, suburb, address),
      pet:pets(id, name, photo_url, species),
      visit:visits(id, status, started_at, finished_at)
    `,
    )
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingWithRelations[];
}

export async function listTodaysBookings(day = new Date()) {
  return listBookingsBetween(startOfDay(day), endOfDay(day));
}

export async function listWeekBookings(day = new Date()) {
  const start = startOfWeek(day, { weekStartsOn: 1 });
  const end = endOfWeek(day, { weekStartsOn: 1 });
  return listBookingsBetween(start, end);
}

export async function createBooking(
  ownerId: string,
  input: {
    client_id: string;
    pet_id: string;
    starts_at: string;
    service_type: ServiceType;
    notes?: string;
    amount?: number | null;
    weeks?: number;
  },
) {
  const weeks = Math.max(1, input.weeks ?? 1);
  const seriesId = weeks > 1 ? crypto.randomUUID() : null;
  const rows = Array.from({ length: weeks }, (_, i) => {
    const starts = addWeeks(new Date(input.starts_at), i);
    return {
      owner_id: ownerId,
      client_id: input.client_id,
      pet_id: input.pet_id,
      starts_at: starts.toISOString(),
      service_type: input.service_type,
      notes: input.notes ?? null,
      amount: input.amount ?? null,
      recurrence_rule: weeks > 1 ? "WEEKLY" : null,
      series_id: seriesId,
      status: "scheduled" as const,
    };
  });

  const { data, error } = await supabase.from("bookings").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as Booking[];
}

export async function updateBooking(id: string, patch: Partial<Booking>) {
  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Booking;
}

export async function cancelBooking(id: string) {
  return updateBooking(id, { status: "cancelled" });
}

export async function getBooking(id: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      client:clients(*),
      pet:pets(*),
      visit:visits(*)
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as BookingWithRelations & {
    client: Client;
    pet: Pet;
    visit: Visit | null;
  };
}

export async function startVisit(ownerId: string, bookingId: string) {
  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      owner_id: ownerId,
      booking_id: bookingId,
      status: "in_progress",
    })
    .select("*")
    .single();
  if (error) throw error;

  const checklist = DEFAULT_CHECKLIST.map((label, i) => ({
    visit_id: (visit as Visit).id,
    label,
    done: false,
    sort_order: i,
  }));
  const { error: checkError } = await supabase.from("visit_checklist_items").insert(checklist);
  if (checkError) throw checkError;

  return visit as Visit;
}

export async function getVisit(id: string) {
  const { data, error } = await supabase
    .from("visits")
    .select(
      `
      *,
      booking:bookings(
        *,
        client:clients(*),
        pet:pets(*)
      )
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listVisitChecklist(visitId: string) {
  const { data, error } = await supabase
    .from("visit_checklist_items")
    .select("*")
    .eq("visit_id", visitId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VisitChecklistItem[];
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const { error } = await supabase
    .from("visit_checklist_items")
    .update({ done })
    .eq("id", id);
  if (error) throw error;
}

export async function updateVisitNotes(id: string, notes: string) {
  const { error } = await supabase.from("visits").update({ notes }).eq("id", id);
  if (error) throw error;
}

export async function finishVisit(id: string) {
  const { data, error } = await supabase
    .from("visits")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const visit = data as Visit;
  await updateBooking(visit.booking_id, { status: "completed" });
  return visit;
}

export async function listVisitPhotos(visitId: string) {
  const { data, error } = await supabase
    .from("visit_photos")
    .select("*")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VisitPhoto[];
}

export async function uploadVisitPhoto(ownerId: string, visitId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ownerId}/${visitId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("visit-photos")
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("visit_photos")
    .insert({ visit_id: visitId, storage_path: path })
    .select("*")
    .single();
  if (error) throw error;
  return data as VisitPhoto;
}

export async function getVisitPhotoUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("visit-photos")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function listInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createInvoice(
  ownerId: string,
  input: {
    client_id: string;
    visit_id?: string | null;
    amount: number;
    due_on?: string | null;
    notes?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: ownerId,
      client_id: input.client_id,
      visit_id: input.visit_id ?? null,
      amount: input.amount,
      due_on: input.due_on ?? format(new Date(), "yyyy-MM-dd"),
      notes: input.notes ?? null,
      status: "owed",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function markInvoicePaid(id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_on: format(new Date(), "yyyy-MM-dd") })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function listReminders(limit = 10) {
  const { data, error } = await supabase
    .from("reminders")
    .select("*, pet:pets(id, name)")
    .eq("done", false)
    .order("due_on", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as (Reminder & { pet: Pick<Pet, "id" | "name"> | null })[];
}

export async function getDashboardStats() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [today, invoices] = await Promise.all([
    listTodaysBookings(now),
    listInvoices(),
  ]);

  const weekPaid = (invoices as Invoice[])
    .filter((inv) => {
      if (inv.status !== "paid" || !inv.paid_on) return false;
      const paid = new Date(inv.paid_on);
      return paid >= weekStart && paid <= weekEnd;
    })
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const outstanding = (invoices as Invoice[])
    .filter((inv) => inv.status === "owed")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const unpaidCount = (invoices as Invoice[]).filter((inv) => inv.status === "owed").length;

  return {
    todayCount: today.length,
    weekRevenue: weekPaid,
    outstanding,
    unpaidCount,
  };
}

export async function listRecentVisits(limit = 5) {
  const { data, error } = await supabase
    .from("visits")
    .select(
      `
      *,
      booking:bookings(
        service_type,
        starts_at,
        pet:pets(id, name),
        client:clients(id, name)
      )
    `,
    )
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function startWalk(
  ownerId: string,
  input: { pet_id: string; client_id: string; suburb?: string | null; booking_id?: string | null },
) {
  if (input.booking_id) {
    const existing = await findActiveWalkForBooking(input.booking_id);
    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from("walks")
    .insert({
      owner_id: ownerId,
      pet_id: input.pet_id,
      client_id: input.client_id,
      booking_id: input.booking_id ?? null,
      suburb: input.suburb ?? null,
      status: "in_progress",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Walk;
}

export async function findActiveWalkForBooking(bookingId: string) {
  const { data, error } = await supabase
    .from("walks")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (error) throw error;
  return (data as Walk | null) ?? null;
}

export async function listActiveWalksByBookingIds(bookingIds: string[]) {
  if (bookingIds.length === 0) return [] as Walk[];
  const { data, error } = await supabase
    .from("walks")
    .select("id, booking_id, status, pet_id")
    .in("booking_id", bookingIds)
    .eq("status", "in_progress");
  if (error) throw error;
  return (data ?? []) as Pick<Walk, "id" | "booking_id" | "status" | "pet_id">[];
}

/** Start the right job type from a booking: walk (GPS + Paw Report) or visit. */
export async function startJobFromBooking(ownerId: string, bookingId: string) {
  const booking = await getBooking(bookingId);
  if (booking.service_type === "dog_walk") {
    if (!booking.pet_id || !booking.client_id) {
      throw new Error("This booking needs a pet and client before starting a walk.");
    }
    const walk = await startWalk(ownerId, {
      pet_id: booking.pet_id,
      client_id: booking.client_id,
      suburb: booking.client?.suburb ?? null,
      booking_id: booking.id,
    });
    return { kind: "walk" as const, id: walk.id };
  }

  const existing = Array.isArray(booking.visit) ? booking.visit[0] : booking.visit;
  if (existing?.id && existing.status === "in_progress") {
    return { kind: "visit" as const, id: existing.id };
  }
  if (existing?.id && existing.status === "completed") {
    return { kind: "visit" as const, id: existing.id };
  }
  const visit = await startVisit(ownerId, bookingId);
  return { kind: "visit" as const, id: visit.id };
}

export async function getWalk(id: string) {
  const { data, error } = await supabase
    .from("walks")
    .select(
      `
      *,
      pet:pets(*),
      client:clients(id, name, suburb, phone, email),
      report:paw_reports(id, public_token, status)
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Walk & {
    pet: Pet;
    client: Pick<Client, "id" | "name" | "suburb" | "phone" | "email">;
    report: Pick<PawReport, "id" | "public_token" | "status"> | Pick<PawReport, "id" | "public_token" | "status">[] | null;
  };
}

export async function appendWalkPoint(
  walkId: string,
  point: { lat: number; lng: number; accuracy?: number | null },
) {
  const { data, error } = await supabase
    .from("walk_track_points")
    .insert({
      walk_id: walkId,
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as WalkTrackPoint;
}

export async function listWalkPoints(walkId: string) {
  const { data, error } = await supabase
    .from("walk_track_points")
    .select("*")
    .eq("walk_id", walkId)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WalkTrackPoint[];
}

export async function finishWalk(walkId: string) {
  const points = await listWalkPoints(walkId);
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversineMetres(points[i - 1], points[i]);
  }

  const walk = await getWalk(walkId);
  const started = new Date(walk.started_at).getTime();
  const finished = Date.now();
  const durationSec = Math.max(0, Math.round((finished - started) / 1000));

  const { data, error } = await supabase
    .from("walks")
    .update({
      status: "completed",
      finished_at: new Date(finished).toISOString(),
      distance_m: Math.round(distance * 10) / 10,
      duration_sec: durationSec,
    })
    .eq("id", walkId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Walk;
}

export async function getOrCreatePawReport(ownerId: string, walkId: string) {
  const existing = await supabase
    .from("paw_reports")
    .select("*")
    .eq("walk_id", walkId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as PawReport;

  const walk = await getWalk(walkId);
  const { data, error } = await supabase
    .from("paw_reports")
    .insert({
      walk_id: walkId,
      owner_id: ownerId,
      pet_id: walk.pet_id,
      client_id: walk.client_id,
      public_token: makePublicToken(6),
      suburb: walk.suburb ?? walk.client?.suburb ?? null,
      distance_m: walk.distance_m,
      duration_sec: walk.duration_sec,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PawReport;
}

export async function updatePawReport(
  id: string,
  patch: Partial<{
    mood: PawMood | string | null;
    toilet_poo: boolean;
    toilet_wee: boolean;
    voice_note_raw: string | null;
    report_body: string | null;
    show_full_route: boolean;
  }>,
) {
  const { data, error } = await supabase
    .from("paw_reports")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PawReport;
}

export async function regeneratePawReportBody(reportId: string) {
  const { data: report, error } = await supabase
    .from("paw_reports")
    .select("*, pet:pets(name)")
    .eq("id", reportId)
    .single();
  if (error) throw error;
  const petName = (report as { pet?: { name?: string } }).pet?.name ?? "Your dog";
  const body = polishPawReportCopy({
    petName,
    suburb: report.suburb,
    distanceM: Number(report.distance_m),
    durationSec: Number(report.duration_sec),
    mood: report.mood,
    toiletPoo: report.toilet_poo,
    toiletWee: report.toilet_wee,
    rawNote: report.voice_note_raw,
  });
  return updatePawReport(reportId, { report_body: body });
}

export async function sendPawReport(reportId: string) {
  const { data: existing, error: loadError } = await supabase
    .from("paw_reports")
    .select("report_body")
    .eq("id", reportId)
    .single();
  if (loadError) throw loadError;
  if (!String(existing?.report_body || "").trim()) {
    await regeneratePawReportBody(reportId);
  }
  const { data, error } = await supabase
    .from("paw_reports")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", reportId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PawReport;
}

export async function listPawReportMedia(reportId: string) {
  const { data, error } = await supabase
    .from("paw_report_media")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PawReportMedia[];
}

export async function uploadPawReportMedia(
  ownerId: string,
  reportId: string,
  file: File,
  kind: "photo" | "video",
) {
  const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
  const path = `${ownerId}/${reportId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("paw-report-media")
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const existing = await listPawReportMedia(reportId);
  const { data, error } = await supabase
    .from("paw_report_media")
    .insert({
      report_id: reportId,
      kind,
      storage_path: path,
      sort_order: existing.length,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PawReportMedia;
}

export function pawReportMediaPublicUrl(path: string) {
  return supabase.storage.from("paw-report-media").getPublicUrl(path).data.publicUrl;
}

export async function getPublicPawReport(token: string) {
  const { data, error } = await supabase
    .from("paw_report_public")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicPawReport | null) ?? null;
}

export async function getPublicWalkRoute(token: string) {
  const { data, error } = await supabase.rpc("get_public_walk_route", { p_token: token });
  if (error) throw error;
  return (data ?? []) as { lat: number; lng: number; recorded_at: string }[];
}

export async function listPetWalkStats(petId: string) {
  const { data, error } = await supabase
    .from("walks")
    .select("id, distance_m, duration_sec, started_at, status")
    .eq("pet_id", petId)
    .eq("status", "completed")
    .order("started_at", { ascending: false });
  if (error) throw error;
  const walks = data ?? [];
  const adventureCount = walks.length;
  const totalKm = walks.reduce((sum, w) => sum + Number(w.distance_m || 0), 0) / 1000;
  return {
    adventureCount,
    totalKm,
    lastWalkAt: walks[0]?.started_at ?? null,
    walks,
  };
}

export async function listClientSentReports(clientId: string) {
  const { data, error } = await supabase
    .from("paw_reports")
    .select("*, pet:pets(id, name, photo_url)")
    .eq("client_id", clientId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function pawReportShareUrl(token: string) {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "");
  if (configured) return `${configured}/pawreport/${token}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pawreport/${token}`;
  }
  return `/pawreport/${token}`;
}

/** Mark report sent in DB, then email the owner the private link via Admin API. */
export async function deliverPawReport(reportId: string, shareUrl: string) {
  const sent = await sendPawReport(reportId);
  const res = await fetch("/api/send-paw-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, shareUrl }),
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
    emailedTo?: string;
    phone?: string | null;
  } | null;
  if (!res.ok) {
    throw new Error(payload?.error || "Paw Report was saved, but the owner email failed.");
  }
  return {
    report: sent,
    emailedTo: payload?.emailedTo ?? null,
    phone: payload?.phone ?? null,
  };
}

export async function listWebsiteEnquiries() {
  const { data, error } = await supabase
    .from("website_enquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WebsiteEnquiry[];
}

export async function countNewWebsiteEnquiries() {
  const { count, error } = await supabase
    .from("website_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

export async function updateWebsiteEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  patch?: Partial<Pick<WebsiteEnquiry, "client_id">>,
) {
  const { data, error } = await supabase
    .from("website_enquiries")
    .update({ status, updated_at: new Date().toISOString(), ...patch })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as WebsiteEnquiry;
}

export async function patchWebsiteEnquiry(
  id: string,
  patch: Partial<Pick<WebsiteEnquiry, "client_id" | "status">>,
) {
  const { data, error } = await supabase
    .from("website_enquiries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as WebsiteEnquiry;
}

function parsePetFromEnquiry(enquiry: WebsiteEnquiry) {
  const details = (enquiry.pet_details || "").trim();
  const typeRaw = (enquiry.pet_type || "").trim();
  const typeLower = typeRaw.toLowerCase();
  const species = typeLower.includes("cat")
    ? "Cat"
    : typeLower.includes("dog") || !typeRaw
      ? "Dog"
      : typeRaw;

  let name = "";
  let breed: string | null = null;
  const parts = details
    .split(/[,\n·|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts[0]) {
    const first = parts[0].replace(/^name[:\s]+/i, "").trim();
    if (first && first.length <= 40) name = first;
  }
  if (parts[1] && parts[1].length <= 60) breed = parts[1];

  if (!name) {
    const ownerFirst = enquiry.name.split(/\s+/)[0] || "Client";
    name = `${ownerFirst}'s ${species.toLowerCase()}`;
  }

  return {
    name,
    species,
    breed,
    notes: [
      details || null,
      enquiry.message ? `Enquiry message: ${enquiry.message}` : null,
      enquiry.preferred_dates ? `Preferred dates: ${enquiry.preferred_dates}` : null,
      enquiry.meet_greet ? "Requested a chat about needs first" : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Create/update client + pet from enquiry without changing enquiry status. */
export async function ensureEnquiryHousehold(ownerId: string, enquiry: WebsiteEnquiry) {
  const history = [
    `Website enquiry ${new Date(enquiry.created_at).toLocaleDateString("en-AU")}`,
    enquiry.service_needed ? `Service interest: ${enquiry.service_needed}` : null,
    enquiry.preferred_dates ? `Preferred: ${enquiry.preferred_dates}` : null,
    enquiry.message ? `Message: ${enquiry.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const client = enquiry.client_id
    ? await upsertClient(
        ownerId,
        {
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone,
          suburb: enquiry.suburb,
          notes: history,
        },
        enquiry.client_id,
      )
    : await upsertClient(ownerId, {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        suburb: enquiry.suburb,
        notes: history,
      });

  const petInfo = parsePetFromEnquiry(enquiry);
  const existingPets = await listPets(client.id);
  let pet = existingPets.find((p) => p.name.toLowerCase() === petInfo.name.toLowerCase());
  if (!pet) {
    pet = await upsertPet(ownerId, {
      client_id: client.id,
      name: petInfo.name,
      species: petInfo.species,
      breed: petInfo.breed,
      notes: petInfo.notes,
      behaviour: enquiry.pet_details || null,
    });
  }

  if (!enquiry.client_id) {
    await patchWebsiteEnquiry(enquiry.id, { client_id: client.id });
  }

  return { client, pet };
}

/** Accept as client: household + mark converted. */
export async function convertEnquiryToHousehold(ownerId: string, enquiry: WebsiteEnquiry) {
  const { client, pet } = await ensureEnquiryHousehold(ownerId, enquiry);
  const enquiryUpdated = await updateWebsiteEnquiryStatus(enquiry.id, "converted", {
    client_id: client.id,
  });
  return { client, pet, enquiry: enquiryUpdated };
}

/** Ensure household exists, book Meet & Greet, mark enquiry meet_greet. */
export async function scheduleMeetGreetFromEnquiry(
  ownerId: string,
  enquiry: WebsiteEnquiry,
  startsAt: string,
) {
  const { client, pet } = await ensureEnquiryHousehold(ownerId, enquiry);

  const bookings = await createBooking(ownerId, {
    client_id: client.id,
    pet_id: pet.id,
    starts_at: startsAt,
    service_type: "meet_greet",
    notes: [
      "Meet & Greet from website enquiry",
      enquiry.service_needed ? `Interested in: ${enquiry.service_needed}` : null,
      enquiry.message || null,
    ]
      .filter(Boolean)
      .join("\n"),
    amount: 0,
    weeks: 1,
  });

  const updated = await updateWebsiteEnquiryStatus(enquiry.id, "meet_greet", {
    client_id: client.id,
  });

  return { client, pet, booking: bookings[0], enquiry: updated };
}
