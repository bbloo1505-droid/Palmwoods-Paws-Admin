import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { RouteMap } from "@/components/RouteMap";
import {
  finishWalk,
  getOrCreatePawReport,
  getWalk,
  listPawReportMedia,
  listWalkPoints,
  updatePawReport,
  uploadPawReportMediaMany,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWalkGps } from "@/hooks/useWalkGps";
import { cn, formatDistanceKm, formatDuration } from "@/lib/utils";
import type { WalkTrackPoint } from "@/lib/types";

export const Route = createFileRoute("/walks/$walkId")({
  component: ActiveWalkPage,
});

function ActiveWalkPage() {
  const { walkId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLInputElement>(null);
  const photoLibraryRef = useRef<HTMLInputElement>(null);

  const [walk, setWalk] = useState<Awaited<ReturnType<typeof getWalk>> | null>(null);
  const [points, setPoints] = useState<WalkTrackPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [toiletPoo, setToiletPoo] = useState(false);
  const [toiletWee, setToiletWee] = useState(false);
  const [water, setWater] = useState(false);
  const [treat, setTreat] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);

  const inProgress = walk?.status === "in_progress";
  const gps = useWalkGps(walkId, Boolean(inProgress));

  useEffect(() => {
    getWalk(walkId)
      .then(async (w) => {
        setWalk(w);
        const report = Array.isArray(w.report) ? w.report[0] : w.report;
        if (report?.id) {
          setReportId(report.id);
          const media = await listPawReportMedia(report.id);
          setPhotoCount(media.filter((m) => m.kind === "photo").length);
          setVideoCount(media.filter((m) => m.kind === "video").length);
        }
      })
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

  const ensureReport = async () => {
    if (!ownerId) throw new Error("Not signed in");
    if (reportId) return reportId;
    const report = await getOrCreatePawReport(ownerId, walkId);
    setReportId(report.id);
    setToiletPoo(report.toilet_poo);
    setToiletWee(report.toilet_wee);
    setNote(report.voice_note_raw || "");
    return report.id;
  };

  const syncReportFlags = async (patch: {
    toilet_poo?: boolean;
    toilet_wee?: boolean;
    voice_note_raw?: string;
  }) => {
    const id = await ensureReport();
    await updatePawReport(id, patch);
  };

  const onFinish = async () => {
    if (!ownerId) return;
    setBusy(true);
    setError(null);
    try {
      if (note.trim() || toiletPoo || toiletWee) {
        const id = await ensureReport();
        await updatePawReport(id, {
          toilet_poo: toiletPoo,
          toilet_wee: toiletWee || water,
          voice_note_raw: note.trim() || null,
        });
      }
      await finishWalk(walkId);
      void navigate({ to: "/walks/$walkId/report", params: { walkId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish walk");
    } finally {
      setBusy(false);
    }
  };

  const onMedia = async (files: FileList | null, kind: "photo" | "video") => {
    if (!files?.length || !ownerId) return;
    setBusy(true);
    setError(null);
    try {
      const id = await ensureReport();
      const uploaded = await uploadPawReportMediaMany(ownerId, id, Array.from(files), kind);
      if (kind === "photo") setPhotoCount((n) => n + uploaded.length);
      else setVideoCount((n) => n + uploaded.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (photoLibraryRef.current) photoLibraryRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  if (!walk && !error) return <p className="text-muted">Starting walk…</p>;
  if (!walk) return <p className="text-danger">{error}</p>;

  const liveDistance = (() => {
    if (walk.status === "completed") return Number(walk.distance_m);
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

  const actions = [
    {
      key: "photo",
      label: photoCount ? `Photo (${photoCount})` : "Photo",
      emoji: "📷",
      active: photoCount > 0,
      onClick: () => photoLibraryRef.current?.click(),
    },
    {
      key: "video",
      label: videoCount ? `Video (${videoCount})` : "Video",
      emoji: "🎥",
      active: videoCount > 0,
      onClick: () => videoRef.current?.click(),
    },
    {
      key: "poo",
      label: "Toilet",
      emoji: "💩",
      active: toiletPoo,
      onClick: () => {
        const next = !toiletPoo;
        setToiletPoo(next);
        void syncReportFlags({ toilet_poo: next }).catch((e) =>
          setError(e instanceof Error ? e.message : "Could not save"),
        );
      },
    },
    {
      key: "water",
      label: "Water",
      emoji: "💧",
      active: water || toiletWee,
      onClick: () => {
        const next = !(water || toiletWee);
        setWater(next);
        setToiletWee(next);
        void syncReportFlags({ toilet_wee: next }).catch((e) =>
          setError(e instanceof Error ? e.message : "Could not save"),
        );
      },
    },
    {
      key: "treat",
      label: "Treat",
      emoji: "🦴",
      active: treat,
      onClick: () => setTreat((v) => !v),
    },
    {
      key: "note",
      label: "Note",
      emoji: "📝",
      active: Boolean(note.trim()) || noteOpen,
      onClick: () => setNoteOpen((v) => !v),
    },
  ] as const;

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
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
          <p className="text-xs uppercase tracking-wide text-muted">Media</p>
          <p className="font-display text-2xl text-olive-950">{photoCount + videoCount}</p>
        </Card>
      </div>

      {inProgress ? (
        <div className="grid grid-cols-3 gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busy}
              onClick={action.onClick}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition",
                action.active
                  ? "border-olive-700 bg-olive-800 text-warm-white"
                  : "border-olive-100 bg-warm-white text-olive-950 hover:border-olive-700/40",
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {action.emoji}
              </span>
              <span className="text-sm font-semibold">{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {noteOpen ? (
        <Card className="space-y-2">
          <label className="text-sm font-semibold text-olive-950" htmlFor="walk-note">
            Quick note
          </label>
          <textarea
            id="walk-note"
            className="min-h-24 w-full rounded-xl border border-olive-100 bg-cream/40 px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dictate or type a quick note for the Paw Report…"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void syncReportFlags({ voice_note_raw: note }).catch((e) =>
                setError(e instanceof Error ? e.message : "Could not save note"),
              );
              setNoteOpen(false);
            }}
          >
            Save note
          </Button>
        </Card>
      ) : null}

      <input
        ref={photoLibraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onMedia(e.target.files, "photo")}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => void onMedia(e.target.files, "video")}
      />

      <RouteMap points={points} className="min-h-40" />

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
        <Button className="w-full min-h-14" size="lg" variant="gold" disabled={busy} onClick={() => void onFinish()}>
          {busy ? "Finishing…" : "Finish Walk"}
        </Button>
      ) : (
        <Link to="/walks/$walkId/report" params={{ walkId }}>
          <Button className="w-full min-h-14" size="lg" variant="gold">
            Generate Paw Report
          </Button>
        </Link>
      )}
    </div>
  );
}
