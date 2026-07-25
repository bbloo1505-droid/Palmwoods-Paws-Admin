import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, MapPin, Phone } from "lucide-react";
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
  new: "New enquiry",
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

  const acceptClient = async (enquiry: WebsiteEnquiry) => {
    if (!ownerId) return;
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

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Enquiries"
        subtitle="Website leads → contacted → meet & greet → client. Almost no retyping."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          body="When someone submits the Palmwoods Paws contact form, it will show up here."
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
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
                onBooked={() => void setStatus(e.id, "booked")}
                onAccept={() => void acceptClient(e)}
                onScheduleMeet={() => void bookMeetGreet(e)}
                onClose={() => void setStatus(e.id, "closed")}
              />
            ))}
          </div>

          {done.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-lg text-olive-950">Done</h2>
              {done.map((e) => (
                <Card key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-olive-950">{e.name}</p>
                    <p className="text-sm text-muted">{STATUS_LABEL[e.status]}</p>
                  </div>
                  {e.client_id ? (
                    <Link to="/clients/$clientId" params={{ clientId: e.client_id }}>
                      <Button variant="secondary" size="sm">
                        View client
                      </Button>
                    </Link>
                  ) : null}
                </Card>
              ))}
            </section>
          ) : null}
        </div>
      )}
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
  const stepIndex = Math.max(0, PIPELINE.indexOf(e.status === "closed" ? "new" : e.status));

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl text-olive-950">
            {e.name}
            {e.pet_type || e.pet_details ? (
              <span className="text-xl">
                {" "}
                · {(e.pet_details || e.pet_type || "").split(/[,\n]/)[0].trim().slice(0, 24) || "Pet"}{" "}
                🐕
              </span>
            ) : null}
          </h3>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold-dark">
            {STATUS_LABEL[e.status]} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {PIPELINE.map((step, i) => (
          <span
            key={step}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
              i <= stepIndex ? "bg-olive-800 text-warm-white" : "bg-olive-100 text-muted",
            )}
          >
            {STATUS_LABEL[step].replace(" enquiry", "")}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
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

      <div className="space-y-1 text-sm text-olive-950">
        {e.phone ? (
          <p className="flex items-center gap-2 text-muted">
            <Phone className="h-4 w-4" />
            {e.phone}
          </p>
        ) : null}
        {e.email ? (
          <p className="flex items-center gap-2 text-muted">
            <Mail className="h-4 w-4" />
            {e.email}
          </p>
        ) : null}
        {e.service_needed ? (
          <p>
            <span className="font-semibold">Service:</span> {e.service_needed}
          </p>
        ) : null}
        {e.suburb ? (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted" />
            {e.suburb}
          </p>
        ) : null}
        {e.preferred_dates ? (
          <p>
            <span className="font-semibold">Preferred:</span> {e.preferred_dates}
          </p>
        ) : null}
      </div>

      {(e.pet_details || e.message || e.meet_greet) && (
        <div className="rounded-2xl bg-cream/80 p-3 text-sm text-olive-950">
          {e.pet_type ? (
            <p className="font-semibold">
              {e.pet_type}
              {e.pet_details ? "" : ""}
            </p>
          ) : null}
          {e.pet_details ? <p className="mt-1 whitespace-pre-wrap">{e.pet_details}</p> : null}
          {e.message ? (
            <p className="mt-2 whitespace-pre-wrap text-muted">“{e.message}”</p>
          ) : null}
          {e.meet_greet ? (
            <p className="mt-2 font-semibold text-olive-800">Wants to discuss needs first</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Received {format(new Date(e.created_at), "d MMM yyyy · h:mm a")}
          </p>
        </div>
      )}

      {meetOpen ? (
        <div className="space-y-3 rounded-2xl border border-olive-100 p-3">
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
              {busy ? "Scheduling…" : "Add to calendar"}
            </Button>
            <Button variant="ghost" onClick={onToggleMeet}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {e.status === "new" ? (
          <Button variant="secondary" disabled={busy} onClick={onContacted}>
            Mark contacted
          </Button>
        ) : null}
        {e.status !== "converted" && e.status !== "closed" ? (
          <Button variant="secondary" disabled={busy} onClick={onToggleMeet}>
            Schedule Meet & Greet
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
        {e.status !== "closed" ? (
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
