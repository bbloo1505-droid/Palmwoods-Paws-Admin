import { addWeeks, endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CHECKLIST,
  type Booking,
  type BookingWithRelations,
  type Client,
  type HouseInfo,
  type Invoice,
  type Pet,
  type Reminder,
  type ServiceType,
  type Visit,
  type VisitChecklistItem,
  type VisitPhoto,
} from "@/lib/types";

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
