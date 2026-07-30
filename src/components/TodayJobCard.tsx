import { format } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { startJobFromBooking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  bookingServiceLabel,
  isWalkService,
  petEmoji,
  type BookingWithRelations,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  booking: BookingWithRelations;
  activeWalkId?: string | null;
};

export function TodayJobCard({ booking, activeWalkId }: Props) {
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visit = Array.isArray(booking.visit) ? booking.visit[0] : booking.visit;
  const walkService = isWalkService(booking.service_type);
  const visitDone = visit?.status === "completed";
  const visitInProgress = visit?.status === "in_progress";
  const walkInProgress = Boolean(activeWalkId);
  const done = walkService ? false : visitDone;
  const inProgress = walkService ? walkInProgress : visitInProgress;

  const onStart = async () => {
    if (!ownerId) {
      setError("You’re not signed in. Refresh the page or open Settings, then try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (walkService && activeWalkId) {
        void navigate({ to: "/walks/$walkId", params: { walkId: activeWalkId } });
        return;
      }
      if (!walkService && visit?.id) {
        void navigate({ to: "/visits/$visitId", params: { visitId: visit.id } });
        return;
      }
      const job = await startJobFromBooking(ownerId, booking.id);
      if (walkService && job.kind !== "walk") {
        throw new Error(
          "Walks & Paw Reports aren’t enabled yet. Open Settings → Copy Walks & Paw Reports SQL.",
        );
      }
      if (job.kind === "walk") {
        void navigate({ to: "/walks/$walkId", params: { walkId: job.id } });
      } else {
        void navigate({ to: "/visits/$visitId", params: { visitId: job.id } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = busy
    ? "Starting…"
    : inProgress
      ? walkService
        ? "Continue walk"
        : "Continue visit"
      : walkService
        ? "Start walk"
        : "Start visit";

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-xl text-left active:bg-cream/60"
        onClick={() => {
          if (!done) void onStart();
        }}
        disabled={busy || done}
      >
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-olive-100 text-2xl">
          {booking.pet?.photo_url ? (
            <img src={booking.pet.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">{petEmoji(booking.pet?.species)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-dark">
            {format(new Date(booking.starts_at), "h:mm a")}
          </p>
          <h3 className="font-display text-2xl leading-tight text-olive-950">
            {booking.pet?.name ?? "Pet"}
          </h3>
          <p className="text-sm text-muted">{bookingServiceLabel(booking)}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {booking.client?.suburb || booking.client?.address || "Location TBC"}
            </span>
          </p>
        </div>
      </button>

      {walkService && !done ? (
        <p className="rounded-xl bg-cream/90 px-3 py-2 text-sm leading-snug text-olive-900">
          {inProgress ? (
            <>
              <span className="font-semibold">Walk in progress.</span> Tap Continue, then{" "}
              <span className="font-semibold">Finish walk → Paw Report</span> at the bottom.
            </>
          ) : (
            <>
              Tap the job or <span className="font-semibold">Start walk</span> → add photos →{" "}
              <span className="font-semibold">Finish walk → Paw Report</span>.
            </>
          )}
        </p>
      ) : null}

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

      <div className="flex flex-col gap-2">
        {done ? (
          <span className="inline-flex justify-center rounded-full bg-success/15 px-3 py-3 text-sm font-semibold text-success">
            Done
          </span>
        ) : (
          <Button
            className={cn("w-full min-h-14 text-base")}
            size="lg"
            variant="gold"
            disabled={busy}
            onClick={() => void onStart()}
          >
            {ctaLabel}
          </Button>
        )}
        <Link
          to="/bookings/$bookingId"
          params={{ bookingId: booking.id }}
          className="py-1 text-center text-sm font-semibold text-olive-800"
          onClick={(e) => e.stopPropagation()}
        >
          Job details
        </Link>
      </div>
    </Card>
  );
}
