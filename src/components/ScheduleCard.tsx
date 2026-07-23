import { format, formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { SERVICE_LABELS, type BookingWithRelations } from "@/lib/types";
import { Card } from "@/components/ui";

export function ScheduleCard({ booking }: { booking: BookingWithRelations }) {
  const visit = Array.isArray(booking.visit) ? booking.visit[0] : booking.visit;
  const inProgress = visit?.status === "in_progress";
  const done = visit?.status === "completed";

  return (
    <Card className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-olive-100 text-lg">
        {booking.pet?.photo_url ? (
          <img src={booking.pet.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">🐾</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-olive-950">{format(new Date(booking.starts_at), "h:mmaaa")}</p>
          <p className="truncate font-medium">{booking.pet?.name ?? "Pet"}</p>
        </div>
        <p className="text-sm text-muted">{SERVICE_LABELS[booking.service_type]}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" />
          {booking.client?.suburb || booking.client?.address || "Location TBC"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {done ? (
          <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">
            Done
          </span>
        ) : inProgress ? (
          <Link
            to="/visits/$visitId"
            params={{ visitId: visit!.id }}
            className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-olive-950"
          >
            Continue
          </Link>
        ) : (
          <Link
            to="/bookings/$bookingId"
            params={{ bookingId: booking.id }}
            className="rounded-full bg-olive-800 px-3 py-1.5 text-xs font-semibold text-warm-white"
          >
            Open
          </Link>
        )}
        {!done && !inProgress ? (
          <p className="mt-1 text-[11px] text-muted">
            {formatDistanceToNow(new Date(booking.starts_at), { addSuffix: true })}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
