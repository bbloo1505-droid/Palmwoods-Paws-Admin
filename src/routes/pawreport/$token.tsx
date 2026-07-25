import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { RouteMap } from "@/components/RouteMap";
import {
  getPublicPawReport,
  getPublicWalkRoute,
  listPawReportMedia,
  pawReportMediaPublicUrl,
} from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";
import type { PublicPawReport } from "@/lib/types";
import { MOOD_OPTIONS } from "@/lib/types";
import { formatDistanceKm, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/pawreport/$token")({
  component: PublicPawReportPage,
});

function PublicPawReportPage() {
  const { token } = Route.useParams();
  const [report, setReport] = useState<PublicPawReport | null>(null);
  const [route, setRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [media, setMedia] = useState<{ kind: string; url: string; id: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getPublicPawReport(token);
        if (!r) {
          setError("This Paw Report link isn't available.");
          return;
        }
        setReport(r);
        const [pts, m] = await Promise.all([
          getPublicWalkRoute(token),
          // media via report id — public select on sent reports
          listPawReportMedia(r.id),
        ]);
        setRoute(pts);
        setMedia(m.map((item) => ({ ...item, url: pawReportMediaPublicUrl(item.storage_path) })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load report");
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream px-4">
        <p className="text-muted">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream px-4 text-muted">
        Loading adventure…
      </div>
    );
  }

  const mood = MOOD_OPTIONS.find((m) => m.value === report.mood);
  const video = media.find((m) => m.kind === "video");
  const photos = media.filter((m) => m.kind === "photo");

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-olive-800 px-4 py-5 text-center">
        <img src={LOGO_SRC} alt="Palmwoods Paws" className="mx-auto h-14 w-auto object-contain" />
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
            {report.sent_at ? format(new Date(report.sent_at), "EEEE d MMMM") : "Adventure"}
          </p>
          <h1 className="mt-2 font-display text-3xl text-olive-950">
            {report.pet_name}&apos;s Adventure
          </h1>
          <p className="mt-1 text-muted">
            {formatDuration(report.duration_sec)} · {formatDistanceKm(report.distance_m)}
            {report.suburb ? ` · ${report.suburb}` : ""}
          </p>
        </div>

        {video ? (
          <section className="overflow-hidden rounded-3xl bg-olive-950 shadow-sm">
            <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-gold">
              {report.pet_name} Cam
            </p>
            <video src={video.url} controls playsInline className="mt-2 aspect-[9/16] max-h-[70vh] w-full object-cover" />
          </section>
        ) : null}

        <section className="rounded-3xl border border-olive-100 bg-warm-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-olive-950">Today&apos;s adventure</h2>
          <RouteMap points={route} className="mt-3 min-h-48" />
          <p className="mt-2 text-xs text-muted">
            Route preview hides the start and end near home for privacy.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-olive-100 bg-warm-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Mood</p>
            <p className="mt-1 text-lg font-semibold">
              {mood ? `${mood.emoji} ${mood.label}` : "Happy"}
            </p>
          </div>
          <div className="rounded-2xl border border-olive-100 bg-warm-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Toilet</p>
            <p className="mt-1 text-lg font-semibold">
              {report.toilet_poo ? "💩 ✓ " : ""}
              {report.toilet_wee ? "💧 ✓" : ""}
              {!report.toilet_poo && !report.toilet_wee ? "—" : ""}
            </p>
          </div>
        </section>

        {report.report_body ? (
          <section className="rounded-3xl border border-olive-100 bg-warm-white p-5 shadow-sm">
            <h2 className="font-display text-xl text-olive-950">Anna&apos;s update</h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{report.report_body}</p>
          </section>
        ) : null}

        {photos.length > 0 ? (
          <section>
            <h2 className="mb-3 font-display text-xl text-olive-950">Photos</h2>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p) => (
                <img key={p.id} src={p.url} alt="" className="aspect-square rounded-2xl object-cover" />
              ))}
            </div>
          </section>
        ) : null}

        <footer className="space-y-3 pt-4 text-center">
          <p className="text-sm text-muted">Palmwoods Paws · Caring for pets like they&apos;re our own</p>
          <Link to="/my-paws" className="inline-block text-sm font-semibold text-olive-800">
            View all adventures →
          </Link>
        </footer>
      </main>
    </div>
  );
}
