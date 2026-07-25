import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  finishWalk,
  getOrCreatePawReport,
  getWalk,
  listPawReportMedia,
  updatePawReport,
  uploadPawReportMediaMany,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/walks/$walkId")({
  component: ActiveWalkPage,
});

function ActiveWalkPage() {
  const { walkId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLInputElement>(null);
  const photoLibraryRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);

  const [walk, setWalk] = useState<Awaited<ReturnType<typeof getWalk>> | null>(null);
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
  }, [walkId]);

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
    if (!ownerId) {
      setError("You’re not signed in. Refresh the page, then try Finish walk again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Best-effort: save quick flags, but never block ending the walk / opening the report.
      try {
        const id = await ensureReport();
        await updatePawReport(id, {
          toilet_poo: toiletPoo,
          toilet_wee: toiletWee || water,
          voice_note_raw: note.trim() || null,
        });
      } catch {
        /* report draft can be created on the next screen */
      }
      await finishWalk(walkId);
      await navigate({ to: "/walks/$walkId/report", params: { walkId } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not finish walk. Check Settings → Walks & Paw Reports SQL if this keeps happening.",
      );
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
      if (photoCameraRef.current) photoCameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  if (!walk && !error) return <p className="text-muted">Starting walk…</p>;
  if (!walk) return <p className="text-danger">{error}</p>;

  const mediaTotal = photoCount + videoCount;
  const quickActions = [
    {
      key: "photo",
      label: photoCount ? `Photos (${photoCount})` : "Photo",
      emoji: "📷",
      active: photoCount > 0,
      onClick: () => photoCameraRef.current?.click(),
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
    <div className="mx-auto max-w-xl space-y-4 pb-28">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dark">
          {inProgress ? "Step 2 of 3 · On the walk" : "Walk complete"}
        </p>
        <h1 className="mt-1 font-display text-3xl text-olive-950">
          {walk.pet?.name ?? "Walk"}&apos;s walk
        </h1>
        <p className="mt-1 text-sm text-muted">
          {inProgress
            ? "Snap a couple of photos (or a short clip), tap anything that happened, then finish."
            : "Next: send the Paw Report to the owner."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Time</p>
          <p className="font-display text-2xl text-olive-950">
            {formatDuration(walk.status === "completed" ? walk.duration_sec : elapsed)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Photos &amp; video</p>
          <p className="font-display text-2xl text-olive-950">{mediaTotal}</p>
        </Card>
      </div>

      {inProgress ? (
        <>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="gold"
              className="min-h-12 flex-1"
              disabled={busy}
              onClick={() => photoCameraRef.current?.click()}
            >
              Take photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 flex-1"
              disabled={busy}
              onClick={() => photoLibraryRef.current?.click()}
            >
              From gallery
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={busy}
                onClick={action.onClick}
                className={cn(
                  "flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98]",
                  action.active
                    ? "border-olive-700 bg-olive-800 text-warm-white"
                    : "border-olive-100 bg-warm-white text-olive-950",
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {action.emoji}
                </span>
                <span className="text-sm font-semibold">{action.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {noteOpen ? (
        <Card className="space-y-2">
          <label className="text-sm font-semibold text-olive-950" htmlFor="walk-note">
            Quick note for the owner
          </label>
          <textarea
            id="walk-note"
            className="min-h-28 w-full rounded-xl border border-olive-100 bg-cream/40 px-3 py-2 text-base"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Energetic today, loved the creek path…"
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
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onMedia(e.target.files, "photo")}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onMedia(e.target.files, "video")}
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

      {/* In-page finish control (always reachable even if sticky bar is awkward on some phones) */}
      {inProgress ? (
        <Button
          className="w-full min-h-14 text-base"
          size="lg"
          variant="gold"
          disabled={busy}
          onClick={() => void onFinish()}
        >
          {busy ? "Opening Paw Report…" : "Finish walk → Paw Report"}
        </Button>
      ) : (
        <Link to="/walks/$walkId/report" params={{ walkId }} className="block">
          <Button className="w-full min-h-14 text-base" size="lg" variant="gold">
            Open Paw Report
          </Button>
        </Link>
      )}
      {inProgress && mediaTotal === 0 ? (
        <p className="text-center text-xs text-muted">
          Tip: a couple of photos makes the owner report feel special — you can still finish without
          them.
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-olive-100 bg-warm-white/95 px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(43,48,38,0.45)] backdrop-blur md:hidden">
        <div className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)]">
          {inProgress ? (
            <Button
              className="w-full min-h-14 text-base"
              size="lg"
              variant="gold"
              disabled={busy}
              onClick={() => void onFinish()}
            >
              {busy ? "Opening Paw Report…" : "Finish walk → Paw Report"}
            </Button>
          ) : (
            <Link to="/walks/$walkId/report" params={{ walkId }} className="block">
              <Button className="w-full min-h-14 text-base" size="lg" variant="gold">
                Open Paw Report
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
