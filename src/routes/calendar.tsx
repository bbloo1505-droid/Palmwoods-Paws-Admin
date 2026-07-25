import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import { createBooking, createRecurringBookings, listClients, listPets, listWeekBookings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  SERVICE_LABELS,
  type BookingWithRelations,
  type Client,
  type Pet,
  type ServiceType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

function CalendarPage() {
  const { ownerId } = useAuth();
  const [anchor, setAnchor] = useState(new Date());
  const [jobs, setJobs] = useState<BookingWithRelations[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"recurring" | "once">("recurring");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    pet_id: "",
    starts_at: format(new Date(), "yyyy-MM-dd'T'09:00"),
    start_from: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    weekdays: [1, 3] as number[],
    service_type: "dog_walk" as ServiceType,
    amount: "28",
    weeks: "12",
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
  const selectedPet = clientPets.find((p) => p.id === form.pet_id) || pets.find((p) => p.id === form.pet_id);

  const previewCount = useMemo(() => {
    if (mode === "once") return 1;
    const weeks = Math.max(1, Number(form.weeks) || 1);
    const startFrom = new Date(`${form.start_from}T00:00:00`);
    let count = 0;
    for (let w = 0; w < weeks; w++) {
      const ws = startOfWeek(addWeeks(startFrom, w), { weekStartsOn: 1 });
      for (const weekday of form.weekdays) {
        const day = addDays(ws, weekday - 1);
        if (day >= startFrom) count += 1;
      }
    }
    return count;
  }, [mode, form.weeks, form.weekdays, form.start_from]);

  const dayLabels = form.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
    .filter(Boolean)
    .join(" + ");

  const toggleDay = (value: number) => {
    setForm((f) => {
      const has = f.weekdays.includes(value);
      return {
        ...f,
        weekdays: has ? f.weekdays.filter((d) => d !== value) : [...f.weekdays, value],
      };
    });
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "recurring") {
        const created = await createRecurringBookings(ownerId, {
          client_id: form.client_id,
          pet_id: form.pet_id,
          service_type: form.service_type,
          amount: form.amount ? Number(form.amount) : null,
          notes: form.notes,
          time: form.time,
          weekdays: form.weekdays,
          startFrom: form.start_from,
          weeks: Number(form.weeks) || 12,
        });
        setMessage(
          `Booked ${created.length} ${SERVICE_LABELS[form.service_type].toLowerCase()}${
            created.length === 1 ? "" : "s"
          } for ${selectedPet?.name ?? "pet"}.`,
        );
      } else {
        await createBooking(ownerId, {
          client_id: form.client_id,
          pet_id: form.pet_id,
          starts_at: new Date(form.starts_at).toISOString(),
          service_type: form.service_type,
          amount: form.amount ? Number(form.amount) : null,
          weeks: 1,
          notes: form.notes,
        });
        setMessage("One-off booking created.");
      }
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
        subtitle="Set Charlie for Mon + Wed at 10am once. The calendar fills itself."
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
        <p className="font-semibold text-olive-950">Week of {format(weekStart, "d MMM yyyy")}</p>
        <Button variant="secondary" onClick={() => setAnchor(addDays(weekStart, 7))}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-success">{message}</p> : null}

      {showForm ? (
        <Card className="mb-5 space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "recurring" ? "gold" : "secondary"}
              size="sm"
              onClick={() => setMode("recurring")}
            >
              Recurring
            </Button>
            <Button
              type="button"
              variant={mode === "once" ? "gold" : "secondary"}
              size="sm"
              onClick={() => setMode("once")}
            >
              One-off
            </Button>
          </div>

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

            {mode === "recurring" ? (
              <>
                <Field label="Time">
                  <input
                    className={inputClassName()}
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </Field>
                <Field label="Start from">
                  <input
                    className={inputClassName()}
                    type="date"
                    required
                    value={form.start_from}
                    onChange={(e) => setForm({ ...form, start_from: e.target.value })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-medium text-olive-900">Weekdays</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                      const active = form.weekdays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={cn(
                            "min-w-12 rounded-full px-3 py-2 text-sm font-semibold",
                            active
                              ? "bg-olive-800 text-warm-white"
                              : "border border-olive-100 bg-cream text-olive-900",
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Repeat for (weeks)">
                  <select
                    className={inputClassName()}
                    value={form.weeks}
                    onChange={(e) => setForm({ ...form, weeks: e.target.value })}
                  >
                    <option value="4">4 weeks</option>
                    <option value="8">8 weeks</option>
                    <option value="12">12 weeks</option>
                    <option value="26">26 weeks</option>
                    <option value="52">52 weeks</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <Card className="w-full bg-cream/70 text-sm text-olive-950">
                    <p className="font-semibold">
                      {selectedPet?.name ?? "Pet"} · {SERVICE_LABELS[form.service_type]}
                    </p>
                    <p className="mt-1 text-muted">
                      {dayLabels || "Pick days"} at {form.time} · {previewCount} bookings · $
                      {form.amount || "0"} each
                    </p>
                  </Card>
                </div>
              </>
            ) : (
              <Field label="Starts" className="md:col-span-2">
                <input
                  className={inputClassName()}
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </Field>
            )}

            <Field label="Notes" className="md:col-span-2">
              <input
                className={inputClassName()}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes for Anna"
              />
            </Field>

            <div className="md:col-span-2">
              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="min-h-14 w-full"
                disabled={busy || !form.pet_id || (mode === "recurring" && form.weekdays.length === 0)}
              >
                {busy
                  ? "Saving…"
                  : mode === "recurring"
                    ? `Fill calendar · ${previewCount} jobs`
                    : "Create one-off booking"}
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
              <h3 className="mb-2 font-display text-lg text-olive-950">{format(day, "EEEE d MMM")}</h3>
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
