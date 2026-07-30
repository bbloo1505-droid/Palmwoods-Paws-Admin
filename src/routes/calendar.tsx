import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import {
  createBooking,
  createRecurringBookings,
  listBookingsBetween,
  listClients,
  listPets,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  SERVICE_LABELS,
  type BookingWithRelations,
  type Client,
  type Pet,
  type ServiceType,
  notesWithCustomService,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

type CalendarView = "day" | "week" | "month";
type ServiceEntry = "list" | "manual";

const VIEW_STORAGE_KEY = "pp-calendar-view";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const PRESET_SERVICES = (Object.keys(SERVICE_LABELS) as ServiceType[]).filter(
  (key) => key !== "other",
);

function readStoredView(): CalendarView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "day" || raw === "week" || raw === "month") return raw;
  } catch {
    /* ignore */
  }
  return "week";
}

function rangeForView(view: CalendarView, anchor: Date) {
  if (view === "day") {
    return { from: startOfDay(anchor), to: endOfDay(anchor) };
  }
  if (view === "week") {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  // Month grid includes leading/trailing days from adjacent months.
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  return {
    from: startOfWeek(monthStart, { weekStartsOn: 1 }),
    to: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  };
}

function CalendarPage() {
  const { ownerId } = useAuth();
  const [view, setView] = useState<CalendarView>(() => readStoredView());
  const [anchor, setAnchor] = useState(new Date());
  const [jobs, setJobs] = useState<BookingWithRelations[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"recurring" | "once">("recurring");
  const [serviceEntry, setServiceEntry] = useState<ServiceEntry>("list");
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
    custom_service: "",
    amount: "28",
    weeks: "12",
    notes: "",
  });

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);

  const listDays = useMemo(() => {
    if (view === "day") return [startOfDay(anchor)];
    if (view === "week") {
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    return eachDayOfInterval({ start: range.from, end: range.to });
  }, [view, anchor, weekStart, range.from, range.to]);

  const setViewPersist = (next: CalendarView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const goPrev = () => {
    if (view === "day") setAnchor((d) => addDays(d, -1));
    else if (view === "week") setAnchor((d) => addWeeks(d, -1));
    else setAnchor((d) => addMonths(d, -1));
  };

  const goNext = () => {
    if (view === "day") setAnchor((d) => addDays(d, 1));
    else if (view === "week") setAnchor((d) => addWeeks(d, 1));
    else setAnchor((d) => addMonths(d, 1));
  };

  const rangeLabel =
    view === "day"
      ? format(anchor, "EEEE d MMM yyyy")
      : view === "week"
        ? `Week of ${format(weekStart, "d MMM yyyy")}`
        : format(anchor, "MMMM yyyy");

  const reload = async () => {
    const { from, to } = rangeForView(view, anchor);
    const [b, c, p] = await Promise.all([
      listBookingsBetween(from, to),
      listClients(),
      listPets(),
    ]);
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
  }, [anchor, view]);

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

  const openDay = (day: Date) => {
    setAnchor(day);
    setViewPersist("day");
  };

  const serviceLabel =
    serviceEntry === "manual"
      ? form.custom_service.trim() || "Custom service"
      : SERVICE_LABELS[form.service_type];

  const resolvedServiceType: ServiceType =
    serviceEntry === "manual" ? "other" : form.service_type;

  const buildNotes = () =>
    notesWithCustomService(
      form.notes,
      serviceEntry === "manual" ? form.custom_service : null,
      resolvedServiceType,
    );

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    if (serviceEntry === "manual" && !form.custom_service.trim()) {
      setError("Type a service name, or switch back to the service list.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const notes = buildNotes();
      if (mode === "recurring") {
        const created = await createRecurringBookings(ownerId, {
          client_id: form.client_id,
          pet_id: form.pet_id,
          service_type: resolvedServiceType,
          amount: form.amount ? Number(form.amount) : null,
          notes,
          time: form.time,
          weekdays: form.weekdays,
          startFrom: form.start_from,
          weeks: Number(form.weeks) || 12,
        });
        setMessage(
          `Booked ${created.length} ${serviceLabel.toLowerCase()}${
            created.length === 1 ? "" : "s"
          } for ${selectedPet?.name ?? "pet"}.`,
        );
      } else {
        await createBooking(ownerId, {
          client_id: form.client_id,
          pet_id: form.pet_id,
          starts_at: new Date(form.starts_at).toISOString(),
          service_type: resolvedServiceType,
          amount: form.amount ? Number(form.amount) : null,
          weeks: 1,
          notes,
        });
        setMessage(`One-off booking created · ${serviceLabel}.`);
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={view === opt.value ? "gold" : "secondary"}
              onClick={() => setViewPersist(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <p className="text-center font-semibold text-olive-950">{rangeLabel}</p>
        <Button variant="secondary" onClick={goNext}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-success">{message}</p> : null}

      {showForm ? (
        <Card className="mb-5 space-y-4">
          <div className="flex flex-wrap gap-2">
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
              One-off / single
            </Button>
          </div>
          <p className="text-sm text-muted">
            {mode === "recurring"
              ? "Repeat on chosen weekdays for several weeks."
              : "Book one single visit on a date and time."}
          </p>

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

            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-olive-900">Service</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={serviceEntry === "list" ? "gold" : "secondary"}
                    onClick={() => {
                      setServiceEntry("list");
                      setForm((f) => ({
                        ...f,
                        service_type: f.service_type === "other" ? "dog_walk" : f.service_type,
                      }));
                    }}
                  >
                    From list
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={serviceEntry === "manual" ? "gold" : "secondary"}
                    onClick={() => setServiceEntry("manual")}
                  >
                    Type manually
                  </Button>
                </div>
              </div>
              {serviceEntry === "list" ? (
                <select
                  className={inputClassName()}
                  value={form.service_type}
                  onChange={(e) =>
                    setForm({ ...form, service_type: e.target.value as ServiceType })
                  }
                >
                  {PRESET_SERVICES.map((value) => (
                    <option key={value} value={value}>
                      {SERVICE_LABELS[value]}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputClassName()}
                  required
                  value={form.custom_service}
                  onChange={(e) => setForm({ ...form, custom_service: e.target.value })}
                  placeholder="e.g. Weekend drop-in, puppy social, custom visit…"
                />
              )}
            </div>

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
                      {selectedPet?.name ?? "Pet"} · {serviceLabel}
                    </p>
                    <p className="mt-1 text-muted">
                      {dayLabels || "Pick days"} at {form.time} · {previewCount} bookings · $
                      {form.amount || "0"} each
                    </p>
                  </Card>
                </div>
              </>
            ) : (
              <>
                <Field label="Date & time" className="md:col-span-2">
                  <input
                    className={inputClassName()}
                    type="datetime-local"
                    required
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Card className="w-full bg-cream/70 text-sm text-olive-950">
                    <p className="font-semibold">
                      One-off · {selectedPet?.name ?? "Pet"} · {serviceLabel}
                    </p>
                    <p className="mt-1 text-muted">
                      {form.starts_at
                        ? format(new Date(form.starts_at), "EEEE d MMM yyyy · h:mmaaa")
                        : "Pick a date and time"}{" "}
                      · ${form.amount || "0"}
                    </p>
                  </Card>
                </div>
              </>
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
                disabled={
                  busy ||
                  !form.pet_id ||
                  (mode === "recurring" && form.weekdays.length === 0) ||
                  (serviceEntry === "manual" && !form.custom_service.trim())
                }
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

      {view === "month" ? (
        <MonthGrid jobs={jobs} days={listDays} anchor={anchor} onOpenDay={openDay} />
      ) : (
        <div className="space-y-5">
          {listDays.map((day) => {
            const dayJobs = jobs.filter((j) => isSameDay(new Date(j.starts_at), day));
            return (
              <section key={day.toISOString()}>
                <h3
                  className={cn(
                    "mb-2 font-display text-lg text-olive-950",
                    isToday(day) && "text-olive-800",
                  )}
                >
                  {format(day, "EEEE d MMM")}
                  {isToday(day) ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                      Today
                    </span>
                  ) : null}
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
      )}
    </div>
  );
}

function MonthGrid({
  jobs,
  days,
  anchor,
  onOpenDay,
}: {
  jobs: BookingWithRelations[];
  days: Date[];
  anchor: Date;
  onOpenDay: (day: Date) => void;
}) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d.value} className="py-1">
            {d.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayJobs = jobs.filter((j) => isSameDay(new Date(j.starts_at), day));
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          const chips = dayJobs.slice(0, 2);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onOpenDay(day)}
              className={cn(
                "flex min-h-[4.5rem] flex-col rounded-xl border px-1.5 py-1.5 text-left transition sm:min-h-[5.5rem]",
                today
                  ? "border-olive-800 bg-olive-800 text-warm-white"
                  : inMonth
                    ? "border-olive-100 bg-warm-white text-olive-950 hover:border-olive-700/40"
                    : "border-transparent bg-cream/40 text-muted hover:border-olive-100",
              )}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  today ? "text-gold" : inMonth ? "text-olive-950" : "text-muted",
                )}
              >
                {format(day, "d")}
              </span>
              {dayJobs.length > 0 ? (
                <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {chips.map((job) => (
                    <span
                      key={job.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                        today ? "bg-warm-white/15 text-warm-white" : "bg-olive-100 text-olive-900",
                      )}
                    >
                      {format(new Date(job.starts_at), "h:mmaaa").replace(" ", "")}{" "}
                      {job.pet?.name ?? "Pet"}
                    </span>
                  ))}
                  {dayJobs.length > 2 ? (
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        today ? "text-gold" : "text-muted",
                      )}
                    >
                      +{dayJobs.length - 2} more
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
