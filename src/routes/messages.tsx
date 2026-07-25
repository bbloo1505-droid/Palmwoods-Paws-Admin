import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { listWebsiteEnquiries, updateWebsiteEnquiryStatus, upsertClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EnquiryStatus, WebsiteEnquiry } from "@/lib/types";

export const Route = createFileRoute("/messages")({
  component: EnquiriesPage,
});

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

function EnquiriesPage() {
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WebsiteEnquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () =>
    listWebsiteEnquiries()
      .then(setRows)
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message}. Run the website_enquiries SQL migration in Supabase if the table is missing.`
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
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyId(null);
    }
  };

  const convertToClient = async (enquiry: WebsiteEnquiry) => {
    if (!ownerId) return;
    setBusyId(enquiry.id);
    setError(null);
    try {
      const notes = [
        `Website enquiry ${format(new Date(enquiry.created_at), "d MMM yyyy")}`,
        enquiry.service_needed ? `Service: ${enquiry.service_needed}` : null,
        enquiry.pet_type ? `Pet type: ${enquiry.pet_type}` : null,
        enquiry.preferred_dates ? `Preferred dates: ${enquiry.preferred_dates}` : null,
        enquiry.pet_details ? `Pet details: ${enquiry.pet_details}` : null,
        enquiry.meet_greet ? "Wants to discuss needs first" : null,
        enquiry.message ? `Message: ${enquiry.message}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const client = await upsertClient(ownerId, {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        suburb: enquiry.suburb,
        notes,
      });

      const updated = await updateWebsiteEnquiryStatus(enquiry.id, "converted", {
        client_id: client.id,
      });
      setRows((prev) => prev.map((r) => (r.id === enquiry.id ? updated : r)));
      void navigate({ to: "/clients/$clientId", params: { clientId: client.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert to client");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle="Website contact form submissions land here for Anna."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          body="When someone submits the Palmwoods Paws contact form, it will show up here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <Card key={e.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl text-olive-950">{e.name}</h3>
                  <p className="text-sm text-muted">
                    {format(new Date(e.created_at), "EEE d MMM · h:mm a")} · {e.source}
                  </p>
                </div>
                <span className="rounded-full bg-olive-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-olive-900">
                  {STATUS_LABEL[e.status]}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-muted">
                {e.phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${e.phone}`} className="text-olive-900">
                      {e.phone}
                    </a>
                  </p>
                ) : null}
                {e.email ? (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${e.email}`} className="text-olive-900">
                      {e.email}
                    </a>
                  </p>
                ) : null}
                {e.suburb ? (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {e.suburb}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl bg-cream/80 p-3 text-sm text-olive-950">
                {e.service_needed ? (
                  <p>
                    <span className="font-semibold">Service:</span> {e.service_needed}
                  </p>
                ) : null}
                {e.pet_type ? (
                  <p>
                    <span className="font-semibold">Pet:</span> {e.pet_type}
                  </p>
                ) : null}
                {e.preferred_dates ? (
                  <p>
                    <span className="font-semibold">Dates:</span> {e.preferred_dates}
                  </p>
                ) : null}
                {e.pet_details ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    <span className="font-semibold">Pet details:</span> {e.pet_details}
                  </p>
                ) : null}
                {e.message ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    <span className="font-semibold">Message:</span> {e.message}
                  </p>
                ) : null}
                {e.meet_greet ? (
                  <p className="mt-2 text-olive-800">Wants to discuss their pet&apos;s needs first</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {e.status === "new" ? (
                  <Button
                    variant="secondary"
                    disabled={busyId === e.id}
                    onClick={() => void setStatus(e.id, "contacted")}
                  >
                    Mark contacted
                  </Button>
                ) : null}
                {e.status !== "converted" && e.status !== "closed" ? (
                  <Button
                    variant="gold"
                    disabled={busyId === e.id}
                    onClick={() => void convertToClient(e)}
                  >
                    Convert to client
                  </Button>
                ) : null}
                {e.client_id ? (
                  <Link to="/clients/$clientId" params={{ clientId: e.client_id }}>
                    <Button variant="secondary">View client</Button>
                  </Link>
                ) : null}
                {e.status !== "closed" ? (
                  <Button
                    variant="ghost"
                    disabled={busyId === e.id}
                    onClick={() => void setStatus(e.id, "closed")}
                  >
                    Close
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
