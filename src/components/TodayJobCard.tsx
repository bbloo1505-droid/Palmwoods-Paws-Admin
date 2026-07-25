import { format } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { startJobFromBooking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  SERVICE_LABELS,
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
    if (!ownerId) return;
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
      <div className="flex items-start gap-3">
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
          <p className="text-sm text-muted">{SERVICE_LABELS[booking.service_type]}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {booking.client?.suburb || booking.client?.address || "Location TBC"}
            </span>
          </p>
        </div>
      </div>

      {walkService && !done ? (
        <p className="rounded-xl bg-cream/90 px-3 py-2 text-sm leading-snug text-olive-900">
          {inProgress ? (
            <>
              <span className="font-semibold">In progress.</span> Add photos, then finish to send the
              Paw Report.
            </>
          ) : (
            <>
              <span className="font-semibold">Walk tip:</span> Start → photos/video on the walk →
              Finish → send Paw Report to owner.
            </>
          )}
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

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
        >
          Job details
        </Link>
      </div>
    </Card>
  );
}
