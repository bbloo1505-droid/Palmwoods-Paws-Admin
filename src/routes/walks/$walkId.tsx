import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { RouteMap } from "@/components/RouteMap";
import { finishWalk, getWalk, listWalkPoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWalkGps } from "@/hooks/useWalkGps";
import { formatDistanceKm, formatDuration } from "@/lib/utils";
import type { WalkTrackPoint } from "@/lib/types";

export const Route = createFileRoute("/walks/$walkId")({
  component: ActiveWalkPage,
});

function ActiveWalkPage() {
  const { walkId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [walk, setWalk] = useState<Awaited<ReturnType<typeof getWalk>> | null>(null);
  const [points, setPoints] = useState<WalkTrackPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inProgress = walk?.status === "in_progress";
  const gps = useWalkGps(walkId, Boolean(inProgress));

  useEffect(() => {
    getWalk(walkId)
      .then(setWalk)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load walk"));
    listWalkPoints(walkId)
      .then(setPoints)
      .catch(() => undefined);
  }, [walkId, gps.pointCount]);

  useEffect(() => {
    if (!walk || walk.status !== "in_progress") return;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(walk.started_at).getTime()) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [walk]);

  const onFinish = async () => {
    if (!ownerId) return;
    setBusy(true);
    setError(null);
    try {
      await finishWalk(walkId);
      void navigate({ to: "/walks/$walkId/report", params: { walkId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish walk");
    } finally {
      setBusy(false);
    }
  };

  if (!walk && !error) return <p className="text-muted">Starting walk…</p>;
  if (!walk) return <p className="text-danger">{error}</p>;

  const liveDistance = (() => {
    if (walk.status === "completed") return Number(walk.distance_m);
    // rough live estimate from loaded points
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const R = 6371000;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      d += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    return d;
  })();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title={`${walk.pet?.name ?? "Walk"}'s walk`}
        subtitle={walk.suburb || walk.client?.suburb || "Tracking in progress"}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Time</p>
          <p className="font-display text-2xl text-olive-950">
            {formatDuration(walk.status === "completed" ? walk.duration_sec : elapsed)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Distance</p>
          <p className="font-display text-2xl text-olive-950">{formatDistanceKm(liveDistance)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">GPS</p>
          <p className="font-display text-2xl text-olive-950">{gps.pointCount || points.length}</p>
        </Card>
      </div>

      <RouteMap points={points} className="min-h-48" />

      {gps.status === "denied" ? (
        <p className="text-sm text-danger">
          Location permission denied. Enable GPS for this site to record the route.
        </p>
      ) : null}
      {gps.status === "watching" ? (
        <p className="text-sm text-muted">GPS tracking while this screen stays open.</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {inProgress ? (
        <Button className="w-full" size="lg" variant="gold" disabled={busy} onClick={() => void onFinish()}>
          {busy ? "Finishing…" : "Finish Walk"}
        </Button>
      ) : (
        <Link to="/walks/$walkId/report" params={{ walkId }}>
          <Button className="w-full" size="lg" variant="gold">
            Open Paw Report
          </Button>
        </Link>
      )}
    </div>
  );
}
