import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
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
import { cn, formatDistanceKm, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/pawreport/$token")({
  component: PublicPawReportPage,
});

type MediaItem = { kind: string; url: string; id: string };

const PREVIEW_PHOTOS = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80",
];

function previewPawReport(): { report: PublicPawReport; media: MediaItem[] } {
  const now = new Date().toISOString();
  return {
    report: {
      id: "preview",
      public_token: "preview",
      mood: "happy",
      toilet_poo: true,
      toilet_wee: true,
      report_body:
        "Luna was happy today around Palmwoods. She had a wonderful time sniffing the paths near the creek, said hello to a couple of friendly pups, and finished with a good stretch in the sun. See you next walk, Luna!",
      suburb: "Palmwoods",
      distance_m: 0,
      duration_sec: 32 * 60,
      show_full_route: false,
      sent_at: now,
      created_at: now,
      pet_name: "Luna",
      pet_species: "dog",
      pet_photo_url: PREVIEW_PHOTOS[0],
      client_name: "Sophie",
    },
    media: PREVIEW_PHOTOS.map((url, i) => ({
      id: `preview-photo-${i}`,
      kind: "photo",
      url,
    })),
  };
}

function PublicPawReportPage() {
  const { token } = Route.useParams();
  const [report, setReport] = useState<PublicPawReport | null>(null);
  const [route, setRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (token === "preview") {
          const demo = previewPawReport();
          setReport(demo.report);
          setMedia(demo.media);
          setRoute([]);
          document.title = "Luna's Paw Report · Preview · Palmwoods Paws";
          return;
        }
        const r = await getPublicPawReport(token);
        if (!r) {
          setError("This Paw Report link isn't available.");
          return;
        }
        setReport(r);
        document.title = `${r.pet_name}'s Paw Report · Palmwoods Paws`;
        const [pts, m] = await Promise.all([
          getPublicWalkRoute(token),
          listPawReportMedia(r.id),
        ]);
        setRoute(pts);
        setMedia(m.map((item) => ({ ...item, url: pawReportMediaPublicUrl(item.storage_path) })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load report");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f3efe6] px-6 text-center">
        <div className="max-w-sm">
          <img src={LOGO_SRC} alt="Palmwoods Paws" className="mx-auto h-12 w-auto object-contain" />
          <p className="mt-6 text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f3efe6] px-4">
        <div className="pp-fade-up text-center">
          <img src={LOGO_SRC} alt="Palmwoods Paws" className="mx-auto h-12 w-auto object-contain opacity-80" />
          <p className="mt-4 text-sm text-muted">Opening today&apos;s Paw Report…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {token === "preview" ? (
        <div className="sticky top-0 z-40 bg-olive-950 px-4 py-2 text-center text-xs font-semibold tracking-wide text-gold">
          Preview only · sample photos &amp; copy · real owner links look the same
        </div>
      ) : null}
      <PawReportView
        report={report}
        route={route}
        media={media}
        onOpenPhoto={setLightbox}
      />
      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-olive-950/90 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close photo"
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </button>
      ) : null}
    </>
  );
}

function PawReportView({
  report,
  route,
  media,
  onOpenPhoto,
}: {
  report: PublicPawReport;
  route: { lat: number; lng: number }[];
  media: MediaItem[];
  onOpenPhoto: (url: string) => void;
}) {
  const mood = MOOD_OPTIONS.find((m) => m.value === report.mood);
  const videos = media.filter((m) => m.kind === "video");
  const photos = media.filter((m) => m.kind === "photo");

  const heroUrl = useMemo(() => {
    if (photos[0]?.url) return photos[0].url;
    if (report.pet_photo_url) return report.pet_photo_url;
    return null;
  }, [photos, report.pet_photo_url]);

  const galleryPhotos = heroUrl && photos[0]?.url === heroUrl ? photos.slice(1) : photos;
  const dateLabel = report.sent_at
    ? format(new Date(report.sent_at), "EEEE d MMMM")
    : format(new Date(report.created_at), "EEEE d MMMM");

  const toiletBits = [
    report.toilet_poo ? "Poo" : null,
    report.toilet_wee ? "Wee" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-dvh bg-[#f3efe6] text-ink">
      {/* Atmospheric wash — keeps cream from feeling flat */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #dfe6d8 0%, transparent 55%), radial-gradient(80% 50% at 100% 100%, #e8dfc8 0%, transparent 45%), #f3efe6",
        }}
      />

      <header className="relative isolate overflow-hidden">
        <div className="relative min-h-[58vh] sm:min-h-[62vh]">
          {heroUrl ? (
            <img
              src={heroUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #3d4636 0%, #4b5742 45%, #6a735c 100%)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(43,48,38,0.55) 0%, rgba(43,48,38,0.15) 38%, rgba(43,48,38,0.72) 100%)",
            }}
          />

          <div className="relative flex min-h-[58vh] flex-col justify-between px-5 pb-8 pt-6 sm:min-h-[62vh] sm:px-8 sm:pb-10">
            <div className="pp-fade-up flex justify-center">
              <img
                src={LOGO_SRC}
                alt="Palmwoods Paws"
                className="h-14 w-auto object-contain drop-shadow-md sm:h-16"
              />
            </div>

            <div className="pp-fade-up-delay mx-auto max-w-lg text-center text-warm-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                Paw Report · {dateLabel}
              </p>
              <h1 className="mt-3 font-display text-[2.65rem] leading-[1.05] tracking-tight sm:text-5xl">
                {report.pet_name}&apos;s adventure
              </h1>
              <p className="mt-3 text-base text-warm-white/85 sm:text-lg">
                {[
                  formatDuration(report.duration_sec),
                  Number(report.distance_m) > 0 ? formatDistanceKm(report.distance_m) : null,
                  report.suburb || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-lg px-5 pb-20 pt-8 sm:px-6">
        {(mood || toiletBits.length > 0) && (
          <section className="pp-fade-up mb-10 flex flex-wrap items-center justify-center gap-2">
            {mood ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-olive-800 px-4 py-2 text-sm font-semibold text-warm-white">
                <span aria-hidden="true">{mood.emoji}</span>
                {mood.label} today
              </span>
            ) : null}
            {toiletBits.length > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-olive-800/15 bg-warm-white/80 px-4 py-2 text-sm font-medium text-olive-900 backdrop-blur">
                Toilet break · {toiletBits.join(" & ")} ✓
              </span>
            ) : null}
          </section>
        )}

        {videos.map((video, index) => (
          <section
            key={video.id}
            className="pp-fade-up mb-10 overflow-hidden rounded-[1.75rem] bg-olive-950 shadow-[0_20px_50px_-28px_rgba(43,48,38,0.55)]"
          >
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {report.pet_name} Cam
                {videos.length > 1 ? ` · ${index + 1}` : ""}
              </p>
              <p className="text-xs text-warm-white/50">Tap to play</p>
            </div>
            <video
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] max-h-[72vh] w-full bg-black object-cover"
            />
          </section>
        ))}

        {report.report_body ? (
          <section className="pp-fade-up mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">
              From Anna
            </p>
            <blockquote className="mt-3 border-l-[3px] border-gold pl-5">
              <p className="whitespace-pre-wrap text-base leading-relaxed text-olive-950 sm:text-lg">
                {report.report_body}
              </p>
            </blockquote>
            <p className="mt-4 text-sm text-muted">
              Caring for {report.pet_name} like they&apos;re our own.
            </p>
          </section>
        ) : null}

        {galleryPhotos.length > 0 ? (
          <section className="pp-fade-up mb-12">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl text-olive-950">Snapshots</h2>
              <p className="text-xs text-muted">{galleryPhotos.length} photo{galleryPhotos.length === 1 ? "" : "s"}</p>
            </div>
            <div
              className={cn(
                "grid gap-2.5",
                galleryPhotos.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {galleryPhotos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenPhoto(p.url)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                    galleryPhotos.length === 3 && i === 0 ? "col-span-2 aspect-[16/10]" : "aspect-square",
                    galleryPhotos.length === 1 ? "aspect-[4/5]" : null,
                  )}
                >
                  <img
                    src={p.url}
                    alt={`${report.pet_name} on walk`}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {route.length >= 2 ? (
          <section className="pp-fade-up mb-12">
            <h2 className="font-display text-2xl text-olive-950">Today&apos;s route</h2>
            <p className="mt-1 text-sm text-muted">
              A soft preview of the wander — start and end near home stay private.
            </p>
            <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-olive-800/10 bg-warm-white/70 p-3 shadow-[0_16px_40px_-30px_rgba(43,48,38,0.45)] backdrop-blur">
              <RouteMap points={route} className="min-h-52" />
              <div className="mt-3 flex items-center justify-center gap-5 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                  Start
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  Finish
                </span>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="pp-fade-up border-t border-olive-800/10 pt-8 text-center">
          <img
            src={LOGO_SRC}
            alt=""
            className="mx-auto h-10 w-auto object-contain opacity-90"
          />
          <p className="mt-4 font-display text-lg text-olive-950">Palmwoods Paws</p>
          <p className="mt-1 text-sm text-muted">
            Dog walking &amp; pet minding · Sunshine Coast
          </p>
          <p className="mt-4 text-sm text-olive-900">
            <a href="mailto:contact@palmwoodspaws.com" className="font-semibold underline-offset-2 hover:underline">
              contact@palmwoodspaws.com
            </a>
            <span className="mx-2 text-muted">·</span>
            <a href="tel:0407781752" className="font-semibold underline-offset-2 hover:underline">
              0407 781 752
            </a>
          </p>
          <Link
            to="/my-paws"
            className="mt-6 inline-block text-sm font-semibold text-olive-800 underline-offset-4 hover:underline"
          >
            View more adventures
          </Link>
        </footer>
      </main>
    </div>
  );
}
