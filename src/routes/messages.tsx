import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, Mail, MapPin, Phone, PawPrint } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, PageHeader, inputClassName } from "@/components/ui";
import {
  convertEnquiryToHousehold,
  scheduleMeetGreetFromEnquiry,
  updateWebsiteEnquiryStatus,
  listWebsiteEnquiries,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EnquiryStatus, WebsiteEnquiry } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  component: EnquiriesPage,
});

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  meet_greet: "Meet & greet",
  booked: "Booked",
  converted: "Client",
  closed: "Closed",
};

const PIPELINE: EnquiryStatus[] = ["new", "contacted", "meet_greet", "booked", "converted"];

function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function smsHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${digits}`;
}

function petSummary(e: WebsiteEnquiry) {
  const fromDetails = (e.pet_details || "").split(/[,\n]/)[0]?.trim();
  if (fromDetails) return fromDetails.slice(0, 48);
  if (e.pet_type?.trim()) return e.pet_type.trim();
  return null;
}

function EnquiriesPage() {
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WebsiteEnquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [meetForId, setMeetForId] = useState<string | null>(null);
  const [meetAt, setMeetAt] = useState("");

  const load = () =>
    listWebsiteEnquiries()
      .then(setRows)
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message}. Run the website_enquiries SQL migrations in Supabase if needed.`
            : "Failed to load enquiries",
        ),
      );

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (id: string, status: EnquiryStatus) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateWebsiteEnquiryStatus(id, status);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. If status fails, run 20260725020000_enquiry_workflow.sql in Supabase.`
          : "Could not update status",
      );
    } finally {
      setBusyId(null);
    }
  };

  const closeEnquiry = (enquiry: WebsiteEnquiry) => {
    if (
      !window.confirm(
        `Close enquiry from ${enquiry.name}?\n\nThey’ll move to Done and leave the open list. You can still see them under Done.`,
      )
    ) {
      return;
    }
    void setStatus(enquiry.id, "closed");
  };

  const markBooked = (enquiry: WebsiteEnquiry) => {
    if (!window.confirm(`Mark ${enquiry.name} as booked?`)) return;
    void setStatus(enquiry.id, "booked");
  };

  const acceptClient = async (enquiry: WebsiteEnquiry) => {
    if (!ownerId) return;
    if (
      !window.confirm(
        `Accept ${enquiry.name} as a client?\n\nThis creates their client record (and pet if details were provided) and opens their profile.`,
      )
    ) {
      return;
    }
    setBusyId(enquiry.id);
    setError(null);
    try {
      const { client } = await convertEnquiryToHousehold(ownerId, enquiry);
      setRows((prev) =>
        prev.map((r) =>
          r.id === enquiry.id ? { ...r, status: "converted", client_id: client.id } : r,
        ),
      );
      void navigate({ to: "/clients/$clientId", params: { clientId: client.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create client");
    } finally {
      setBusyId(null);
    }
  };

  const bookMeetGreet = async (enquiry: WebsiteEnquiry) => {
    if (!ownerId || !meetAt) return;
    const when = format(new Date(meetAt), "d MMM yyyy · h:mm a");
    if (!window.confirm(`Add Meet & Greet for ${enquiry.name} on ${when}?`)) return;
    setBusyId(enquiry.id);
    setError(null);
    try {
      const startsAt = new Date(meetAt).toISOString();
      const { booking, enquiry: updated } = await scheduleMeetGreetFromEnquiry(
        ownerId,
        enquiry,
        startsAt,
      );
      setRows((prev) => prev.map((r) => (r.id === enquiry.id ? updated : r)));
      setMeetForId(null);
      setMeetAt("");
      void navigate({ to: "/bookings/$bookingId", params: { bookingId: booking.id } });
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. Run enquiry workflow SQL if Meet & Greet booking type is missing.`
          : "Could not schedule meet & greet",
      );
    } finally {
      setBusyId(null);
    }
  };

  const open = rows.filter((r) => r.status !== "closed" && r.status !== "converted");
  const done = rows.filter((r) => r.status === "converted" || r.status === "closed");
  const newCount = open.filter((r) => r.status === "new").length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Enquiries"
        subtitle="Website leads → contacted → meet & greet → client."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          body="When someone submits the Palmwoods Paws contact form, it will show up here."
        />
      ) : (
        <div className="space-y-8">
          {open.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl text-olive-950">Open</h2>
                  <p className="text-sm text-muted">
                    {open.length} lead{open.length === 1 ? "" : "s"}
                    {newCount > 0 ? ` · ${newCount} new` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {open.map((e) => (
                  <EnquiryCard
                    key={e.id}
                    enquiry={e}
                    busy={busyId === e.id}
                    meetOpen={meetForId === e.id}
                    meetAt={meetAt}
                    onMeetAt={setMeetAt}
                    onToggleMeet={() => {
                      setMeetForId((id) => (id === e.id ? null : e.id));
                      setMeetAt("");
                    }}
                    onContacted={() => void setStatus(e.id, "contacted")}
                    onBooked={() => markBooked(e)}
                    onAccept={() => void acceptClient(e)}
                    onScheduleMeet={() => void bookMeetGreet(e)}
                    onClose={() => closeEnquiry(e)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <Card className="text-sm text-muted">No open enquiries — nice work.</Card>
          )}

          {done.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-olive-950">Done</h2>
              <div className="space-y-2">
                {done.map((e) => (
                  <Card
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-olive-950">{e.name}</p>
                      <p className="text-sm text-muted">
                        {STATUS_LABEL[e.status]}
                        {petSummary(e) ? ` · ${petSummary(e)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      {e.client_id ? (
                        <Link to="/clients/$clientId" params={{ clientId: e.client_id }}>
                          <Button variant="secondary" size="sm">
                            View client
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const isNew = status === "new";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        isNew && "bg-gold text-olive-950",
        status === "converted" && "bg-success/15 text-success",
        status === "closed" && "bg-olive-100 text-muted",
        !isNew &&
          status !== "converted" &&
          status !== "closed" &&
          "bg-olive-800 text-warm-white",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function PipelineBar({ status }: { status: EnquiryStatus }) {
  const stepIndex = Math.max(0, PIPELINE.indexOf(status === "closed" ? "new" : status));
  return (
    <div className="flex items-center gap-1" aria-label="Pipeline progress">
      {PIPELINE.map((step, i) => (
        <div key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className={cn(
              "h-1.5 w-full rounded-full",
              i <= stepIndex ? "bg-olive-800" : "bg-olive-100",
            )}
          />
          <span
            className={cn(
              "hidden text-[10px] font-semibold uppercase tracking-wide sm:block",
              i <= stepIndex ? "text-olive-900" : "text-muted",
            )}
          >
            {STATUS_LABEL[step]}
          </span>
        </div>
      ))}
    </div>
  );
}

function EnquiryCard({
  enquiry: e,
  busy,
  meetOpen,
  meetAt,
  onMeetAt,
  onToggleMeet,
  onContacted,
  onBooked,
  onAccept,
  onScheduleMeet,
  onClose,
}: {
  enquiry: WebsiteEnquiry;
  busy: boolean;
  meetOpen: boolean;
  meetAt: string;
  onMeetAt: (v: string) => void;
  onToggleMeet: () => void;
  onContacted: () => void;
  onBooked: () => void;
  onAccept: () => void;
  onScheduleMeet: () => void;
  onClose: () => void;
}) {
  const pet = petSummary(e);
  const when = formatDistanceToNow(new Date(e.created_at), { addSuffix: true });

  return (
    <Card className={cn("overflow-hidden p-0", e.status === "new" && "ring-1 ring-gold/50")}>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl text-olive-950">{e.name}</h3>
              <StatusBadge status={e.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{when}</p>
            {pet ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-olive-900">
                <PawPrint className="h-4 w-4 text-gold-dark" />
                {pet}
              </p>
            ) : null}
          </div>
        </div>

        <PipelineBar status={e.status} />

        {e.message?.trim() ? (
          <blockquote className="border-l-[3px] border-gold bg-cream/70 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-olive-950">
              “{e.message.trim()}”
            </p>
          </blockquote>
        ) : null}

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {e.service_needed ? (
            <Fact label="Service" value={e.service_needed} />
          ) : null}
          {e.suburb ? (
            <Fact
              label="Area"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted" />
                  {e.suburb}
                </span>
              }
            />
          ) : null}
          {e.preferred_dates ? <Fact label="Preferred" value={e.preferred_dates} /> : null}
          {e.phone ? <Fact label="Phone" value={e.phone} /> : null}
          {e.email ? <Fact label="Email" value={e.email} /> : null}
          {e.meet_greet ? <Fact label="Note" value="Wants to discuss needs first" /> : null}
        </dl>

        {(e.pet_details && e.pet_details.trim() !== pet) || e.pet_type ? (
          <div className="rounded-xl bg-cream/80 px-3 py-2.5 text-sm text-olive-950">
            {e.pet_type ? <p className="font-semibold">{e.pet_type}</p> : null}
            {e.pet_details ? (
              <p className="mt-1 whitespace-pre-wrap text-muted">{e.pet_details}</p>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted">
          Received {format(new Date(e.created_at), "d MMM yyyy · h:mm a")}
        </p>

        {(e.phone || e.email) && (
          <div className="flex flex-wrap gap-2 border-t border-olive-100 pt-4">
            {e.phone ? (
              <>
                <a href={phoneHref(e.phone)}>
                  <Button variant="secondary" size="sm">
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                </a>
                <a href={smsHref(e.phone)}>
                  <Button variant="secondary" size="sm">
                    Text
                  </Button>
                </a>
              </>
            ) : null}
            {e.email ? (
              <a href={`mailto:${e.email}`}>
                <Button variant="secondary" size="sm">
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              </a>
            ) : null}
          </div>
        )}

        {meetOpen ? (
          <div className="space-y-3 rounded-2xl border border-olive-100 bg-cream/50 p-3">
            <Field label="Meet & Greet date and time">
              <input
                type="datetime-local"
                className={inputClassName()}
                value={meetAt}
                onChange={(ev) => onMeetAt(ev.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="gold" disabled={busy || !meetAt} onClick={onScheduleMeet}>
                <CalendarDays className="h-4 w-4" />
                {busy ? "Scheduling…" : "Add to calendar"}
              </Button>
              <Button variant="ghost" onClick={onToggleMeet}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-olive-100 bg-cream/40 px-4 py-3 sm:px-5">
        {e.status === "new" ? (
          <Button variant="secondary" disabled={busy} onClick={onContacted}>
            Mark contacted
          </Button>
        ) : null}
        {e.status !== "converted" && e.status !== "closed" ? (
          <Button variant="secondary" disabled={busy} onClick={onToggleMeet}>
            <CalendarDays className="h-4 w-4" />
            Meet &amp; Greet
          </Button>
        ) : null}
        {e.status === "meet_greet" || e.status === "contacted" ? (
          <Button variant="secondary" disabled={busy} onClick={onBooked}>
            Mark booked
          </Button>
        ) : null}
        {e.status !== "converted" && e.status !== "closed" ? (
          <Button variant="gold" disabled={busy} onClick={onAccept}>
            {busy ? "Creating…" : "Accept client"}
          </Button>
        ) : null}
        {e.client_id ? (
          <Link to="/clients/$clientId" params={{ clientId: e.client_id }}>
            <Button variant="secondary">View client</Button>
          </Link>
        ) : null}
        <div className="flex-1" />
        {e.status !== "closed" ? (
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-olive-100/80 bg-warm-white px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-olive-950">{value}</dd>
    </div>
  );
}
