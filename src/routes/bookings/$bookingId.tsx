import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import {
  cancelBooking,
  findActiveWalkForBooking,
  getBooking,
  getHouseInfo,
  startJobFromBooking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SERVICE_LABELS, isWalkService, type HouseInfo } from "@/lib/types";

export const Route = createFileRoute("/bookings/$bookingId")({
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const { bookingId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getBooking>> | null>(null);
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [activeWalkId, setActiveWalkId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBooking(bookingId)
      .then(async (b) => {
        setData(b);
        const h = await getHouseInfo(b.client_id);
        setHouse(h);
        if (isWalkService(b.service_type)) {
          const walk = await findActiveWalkForBooking(b.id).catch(() => null);
          setActiveWalkId(walk?.id ?? null);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load booking"));
  }, [bookingId]);

  const onStart = async () => {
    if (!data) return;
    if (!ownerId) {
      setError("You’re not signed in. Refresh the page or open Settings, then try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (activeWalkId) {
        void navigate({ to: "/walks/$walkId", params: { walkId: activeWalkId } });
        return;
      }
      const job = await startJobFromBooking(ownerId, data.id);
      if (isWalkService(data.service_type) && job.kind !== "walk") {
        throw new Error(
          "Walks & Paw Reports aren’t enabled yet. Open Settings → Copy Walks & Paw Reports SQL.",
        );
      }
      if (job.kind === "walk") {
        void navigate({ to: "/walks/$walkId", params: { walkId: job.id } });
      } else {
        void navigate({ to: "/visits/$visitId", params: { visitId: job.id } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await cancelBooking(data.id);
      void navigate({ to: "/calendar" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <p className="text-muted">Loading booking…</p>;
  if (!data) return <p className="text-danger">{error}</p>;

  const visit = Array.isArray(data.visit) ? data.visit[0] : data.visit;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={`${data.pet?.name ?? "Pet"} · ${SERVICE_LABELS[data.service_type]}`}
        subtitle={`${format(new Date(data.starts_at), "EEEE d MMM · h:mmaaa")} · ${data.client?.name ?? ""}`}
      />
      {error ? (
        <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2">
          <p className="text-sm text-danger">{error}</p>
          {/Settings|SQL|enabled/i.test(error) ? (
            <Link to="/settings" className="text-sm font-semibold text-olive-800 underline-offset-2 hover:underline">
              Open Settings →
            </Link>
          ) : null}
        </div>
      ) : null}

      <Card className="space-y-2 text-sm">
        <p>
          <span className="font-semibold">Where: </span>
          {[data.client?.address, data.client?.suburb].filter(Boolean).join(", ") || "TBC"}
        </p>
        {data.notes ? (
          <p>
            <span className="font-semibold">Notes: </span>
            {data.notes}
          </p>
        ) : null}
        {data.amount != null ? (
          <p>
            <span className="font-semibold">Amount: </span>${Number(data.amount).toFixed(0)}
          </p>
        ) : null}
      </Card>

      {house ? (
        <Card>
          <h3 className="mb-2 font-display text-lg">House info</h3>
          <dl className="space-y-2 text-sm">
            {house.key_location ? (
              <div>
                <dt className="font-semibold">Key</dt>
                <dd className="text-muted">{house.key_location}</dd>
              </div>
            ) : null}
            {house.alarm_notes ? (
              <div>
                <dt className="font-semibold">Alarm</dt>
                <dd className="text-muted">{house.alarm_notes}</dd>
              </div>
            ) : null}
            {house.gate_notes ? (
              <div>
                <dt className="font-semibold">Gate</dt>
                <dd className="text-muted">{house.gate_notes}</dd>
              </div>
            ) : null}
            {house.extras ? (
              <div>
                <dt className="font-semibold">Extras</dt>
                <dd className="text-muted whitespace-pre-wrap">{house.extras}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {isWalkService(data.service_type) ? (
          <Button
            className="min-h-14 flex-1"
            size="lg"
            variant="gold"
            disabled={busy}
            onClick={() => void onStart()}
          >
            {busy ? "Starting…" : activeWalkId ? "Continue walk" : "Start walk"}
          </Button>
        ) : visit?.status === "in_progress" || visit?.status === "completed" ? (
          <Link to="/visits/$visitId" params={{ visitId: visit.id }} className="flex-1">
            <Button className="w-full min-h-14" size="lg" variant="gold">
              {visit.status === "completed" ? "View visit" : "Continue visit"}
            </Button>
          </Link>
        ) : (
          <Button
            className="min-h-14 flex-1"
            size="lg"
            variant="gold"
            disabled={busy}
            onClick={() => void onStart()}
          >
            {busy ? "Starting…" : "Start visit"}
          </Button>
        )}
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => void onCancel()}>
          Cancel booking
        </Button>
      </div>

      {data.pet?.id ? (
        <Link to="/pets/$petId" params={{ petId: data.pet.id }} className="block text-center font-semibold text-olive-800">
          Open pet profile
        </Link>
      ) : null}
    </div>
  );
}

