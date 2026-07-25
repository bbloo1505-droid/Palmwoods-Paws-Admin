import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Mic, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import {
  getOrCreatePawReport,
  getWalk,
  listPawReportMedia,
  pawReportMediaPublicUrl,
  pawReportShareUrl,
  regeneratePawReportBody,
  deliverPawReport,
  updatePawReport,
  uploadPawReportMedia,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MOOD_OPTIONS, type PawMood, type PawReport, type PawReportMedia } from "@/lib/types";
import { cn, formatDistanceKm, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/walks/$walkId/report")({
  component: PawReportComposePage,
});

function PawReportComposePage() {
  const { walkId } = Route.useParams();
  const { ownerId } = useAuth();
  const [walk, setWalk] = useState<Awaited<ReturnType<typeof getWalk>> | null>(null);
  const [report, setReport] = useState<PawReport | null>(null);
  const [media, setMedia] = useState<(PawReportMedia & { url: string })[]>([]);
  const [rawNote, setRawNote] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const reload = async () => {
    const w = await getWalk(walkId);
    setWalk(w);
    if (!ownerId) return;
    const r = await getOrCreatePawReport(ownerId, walkId);
    setReport(r);
    setRawNote(r.voice_note_raw ?? "");
    setPreview(r.report_body ?? "");
    if (r.status === "sent") setShareUrl(pawReportShareUrl(r.public_token));
    const m = await listPawReportMedia(r.id);
    setMedia(m.map((item) => ({ ...item, url: pawReportMediaPublicUrl(item.storage_path) })));
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load report"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkId, ownerId]);

  const setMood = async (mood: PawMood) => {
    if (!report) return;
    const updated = await updatePawReport(report.id, { mood });
    setReport(updated);
  };

  const toggleToilet = async (key: "toilet_poo" | "toilet_wee") => {
    if (!report) return;
    const updated = await updatePawReport(report.id, { [key]: !report[key] });
    setReport(updated);
  };

  const onPolish = async () => {
    if (!report) return;
    setBusy(true);
    try {
      await updatePawReport(report.id, { voice_note_raw: rawNote });
      const updated = await regeneratePawReportBody(report.id);
      setReport(updated);
      setPreview(updated.report_body ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not polish note");
    } finally {
      setBusy(false);
    }
  };

  const onDictate = () => {
    const SR =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!SR) {
      setError("Voice dictation isn't supported in this browser. Type the note instead.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-AU";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Couldn't capture voice. Try again or type the note.");
    };
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setRawNote((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.start();
  };

  const onUpload = async (file: File | null, kind: "photo" | "video") => {
    if (!file || !report || !ownerId) return;
    setBusy(true);
    try {
      await uploadPawReportMedia(ownerId, report.id, file, kind);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      await updatePawReport(report.id, {
        voice_note_raw: rawNote,
        report_body: preview || null,
      });
      if (!preview.trim()) await regeneratePawReportBody(report.id);
      const url = pawReportShareUrl(report.public_token);
      const delivered = await deliverPawReport(report.id, url);
      setReport(delivered.report);
      setShareUrl(pawReportShareUrl(delivered.report.public_token));
      setEmailedTo(delivered.emailedTo);
      setOwnerPhone(delivered.phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setBusy(false);
    }
  };

  if (!walk || !report) {
    return <p className="text-muted">{error ?? "Preparing Paw Report…"}</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title={`${walk.pet?.name ?? "Walk"}'s Walk`}
        subtitle={`${formatDuration(walk.duration_sec)} · ${formatDistanceKm(walk.distance_m)} · ${
          walk.suburb || walk.client?.suburb || "Palmwoods"
        }`}
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <h3 className="mb-3 font-display text-lg">How was {walk.pet?.name}?</h3>
        <div className="grid grid-cols-2 gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => void setMood(m.value)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm font-medium",
                report.mood === m.value
                  ? "border-olive-800 bg-olive-800 text-warm-white"
                  : "border-olive-100 bg-cream",
              )}
            >
              <span className="mr-1">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-lg">Toilet</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void toggleToilet("toilet_poo")}
            className={cn(
              "flex-1 rounded-xl border px-3 py-3 font-medium",
              report.toilet_poo ? "border-olive-800 bg-olive-800 text-warm-white" : "border-olive-100 bg-cream",
            )}
          >
            💩 {report.toilet_poo ? "✓" : ""}
          </button>
          <button
            type="button"
            onClick={() => void toggleToilet("toilet_wee")}
            className={cn(
              "flex-1 rounded-xl border px-3 py-3 font-medium",
              report.toilet_wee ? "border-olive-800 bg-olive-800 text-warm-white" : "border-olive-100 bg-cream",
            )}
          >
            💧 Wee {report.toilet_wee ? "✓" : ""}
          </button>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg">Anything to mention?</h3>
          <Button type="button" size="sm" variant="secondary" onClick={onDictate}>
            <Mic className="h-4 w-4" />
            {listening ? "Listening…" : "Dictate"}
          </Button>
        </div>
        <Field label="Rough note">
          <textarea
            className={inputClassName("min-h-28")}
            value={rawNote}
            onChange={(e) => setRawNote(e.target.value)}
            placeholder={`${walk.pet?.name} was really energetic today…`}
          />
        </Field>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void onPolish()}>
          Polish into Paw Report
        </Button>
        <Field label="Owner-facing update">
          <textarea
            className={inputClassName("min-h-40")}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
        </Field>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-lg">Today&apos;s media</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-olive-800 px-4 py-2 text-sm font-semibold text-warm-white">
            <Camera className="h-4 w-4" />
            Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null, "photo")}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-olive-100 bg-cream px-4 py-2 text-sm font-semibold">
            + Video clip
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null, "video")}
            />
          </label>
        </div>
        {media.length === 0 ? (
          <p className="text-sm text-muted">Add photos or a short face-cam clip (10–30s).</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {media.map((m) =>
              m.kind === "video" ? (
                <video key={m.id} src={m.url} controls className="aspect-square rounded-xl object-cover" />
              ) : (
                <img key={m.id} src={m.url} alt="" className="aspect-square rounded-xl object-cover" />
              ),
            )}
          </div>
        )}
      </Card>

      {shareUrl ? (
        <Card className="space-y-3">
          <p className="font-display text-xl text-olive-950">Paw Report sent</p>
          {emailedTo ? (
            <p className="text-sm text-olive-900">
              Email sent to <span className="font-semibold">{emailedTo}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">Report is ready. Share the link below if needed.</p>
          )}
          <p className="break-all text-sm text-muted">{shareUrl}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/pawreport/$token" params={{ token: report.public_token }} className="flex-1">
              <Button className="w-full" variant="gold">
                View owner page
              </Button>
            </Link>
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => void navigator.clipboard?.writeText(shareUrl)}
            >
              <Share2 className="h-4 w-4" />
              Copy link
            </Button>
          </div>
          {ownerPhone ? (
            <a
              href={`sms:${ownerPhone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(
                `${walk.pet?.name ?? "Your dog"}'s Paw Report is ready ${shareUrl}`,
              )}`}
            >
              <Button className="w-full" variant="secondary">
                Also text owner
              </Button>
            </a>
          ) : null}
        </Card>
      ) : (
        <Button className="w-full min-h-14" size="lg" variant="gold" disabled={busy} onClick={() => void onSend()}>
          {busy ? "Sending to owner…" : "Send Paw Report"}
        </Button>
      )}
    </div>
  );
}

// Minimal typings for Web Speech API in this file
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
};
type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
