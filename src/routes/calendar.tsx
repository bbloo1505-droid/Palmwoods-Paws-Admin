import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import { createBooking, listClients, listPets, listWeekBookings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SERVICE_LABELS, type BookingWithRelations, type Client, type Pet, type ServiceType } from "@/lib/types";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { ownerId } = useAuth();
  const [anchor, setAnchor] = useState(new Date());
  const [jobs, setJobs] = useState<BookingWithRelations[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    pet_id: "",
    starts_at: format(new Date(), "yyyy-MM-dd'T'09:00"),
    service_type: "dog_walk" as ServiceType,
    amount: "28",
    weeks: "1",
    notes: "",
  });

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const reload = async () => {
    const [b, c, p] = await Promise.all([listWeekBookings(anchor), listClients(), listPets()]);
    setJobs(b);
    setClients(c);
    setPets(p);
    if (!form.client_id && c[0]) {
      const clientPets = p.filter((pet) => pet.client_id === c[0].id);
      setForm((f) => ({
        ...f,
        client_id: c[0].id,
        pet_id: clientPets[0]?.id ?? "",
      }));
    }
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load calendar"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  const clientPets = pets.filter((p) => p.client_id === form.client_id);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setBusy(true);
    setError(null);
    try {
      await createBooking(ownerId, {
        client_id: form.client_id,
        pet_id: form.pet_id,
        starts_at: new Date(form.starts_at).toISOString(),
        service_type: form.service_type,
        amount: form.amount ? Number(form.amount) : null,
        weeks: Number(form.weeks) || 1,
        notes: form.notes,
      });
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create booking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Recurring weekly jobs and one-off visits."
        action={
          <Button variant="gold" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Close" : "New booking"}
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setAnchor(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <p className="font-semibold text-olive-950">
          Week of {format(weekStart, "d MMM yyyy")}
        </p>
        <Button variant="secondary" onClick={() => setAnchor(addDays(weekStart, 7))}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <Card className="mb-5">
          <h3 className="mb-3 font-display text-xl">New booking</h3>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void onCreate(e)}>
            <Field label="Client">
              <select
                className={inputClassName()}
                required
                value={form.client_id}
                onChange={(e) => {
                  const client_id = e.target.value;
                  const nextPets = pets.filter((p) => p.client_id === client_id);
                  setForm({ ...form, client_id, pet_id: nextPets[0]?.id ?? "" });
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pet">
              <select
                className={inputClassName()}
                required
                value={form.pet_id}
                onChange={(e) => setForm({ ...form, pet_id: e.target.value })}
              >
                {clientPets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Starts">
              <input
                className={inputClassName()}
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </Field>
            <Field label="Service">
              <select
                className={inputClassName()}
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value as ServiceType })}
              >
                {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount ($)">
              <input
                className={inputClassName()}
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Repeat for weeks">
              <input
                className={inputClassName()}
                type="number"
                min={1}
                max={52}
                value={form.weeks}
                onChange={(e) => setForm({ ...form, weeks: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <input
                className={inputClassName()}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" variant="primary" size="lg" disabled={busy || !form.pet_id}>
                {busy ? "Saving…" : Number(form.weeks) > 1 ? `Create ${form.weeks} weekly jobs` : "Create booking"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="space-y-5">
        {days.map((day) => {
          const dayJobs = jobs.filter((j) => isSameDay(new Date(j.starts_at), day));
          return (
            <section key={day.toISOString()}>
              <h3 className="mb-2 font-display text-lg text-olive-950">
                {format(day, "EEEE d MMM")}
              </h3>
              {dayJobs.length === 0 ? (
                <Card className="text-sm text-muted">No jobs</Card>
              ) : (
                <div className="space-y-2">
                  {dayJobs.map((job) => (
                    <ScheduleCard key={job.id} booking={job} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

