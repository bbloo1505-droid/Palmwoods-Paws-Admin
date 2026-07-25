import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";

export const Route = createFileRoute("/gallery")({
  component: WebsiteGalleryPage,
});

type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  storagePath?: string | null;
};

type Manifest = {
  updatedAt?: string;
  photos: GalleryPhoto[];
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}

function WebsiteGalleryPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [alt, setAlt] = useState("Local pet photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyManifest = (manifest: Manifest) => {
    setPhotos(manifest.photos ?? []);
  };

  const reload = async () => {
    const res = await fetch("/api/gallery");
    const data = (await res.json().catch(() => ({}))) as Manifest & { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not load gallery");
    applyManifest(data);
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Could not load gallery"));
  }, []);

  const mutate = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/gallery", {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const data = (await res.json().catch(() => ({}))) as Manifest & { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      applyManifest(data);
      setMessage("Homepage gallery updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo (JPG, PNG, or WebP).");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          fileName: file.name,
          alt: alt.trim() || "Local pet photo",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Manifest & { error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      applyManifest(data);
      setAlt("Local pet photo");
      setMessage("Photo added to the homepage gallery.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= photos.length) return;
    const ordered = [...photos];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setPhotos(ordered);
    await mutate({
      method: "PATCH",
      body: JSON.stringify({ action: "reorder", orderedIds: ordered.map((p) => p.id) }),
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this photo from the homepage gallery?")) return;
    await mutate({
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Website gallery"
        subtitle="Photos on the Real local pets carousel at palmwoodspaws.com."
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}

      <Card className="space-y-3">
        <h2 className="font-display text-xl text-olive-950">Add a photo</h2>
        <p className="text-sm text-muted">
          Upload a clear portrait-style photo from a walk or visit. It appears on the homepage
          gallery in the order below.
        </p>
        <Field label="Alt text (for accessibility)">
          <input
            className={inputClassName()}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Border collie on a sunny walk"
          />
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="gold"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          {busy ? "Working…" : "Choose photo"}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl text-olive-950">Gallery order</h2>
          <p className="text-xs text-muted">{photos.length} photo{photos.length === 1 ? "" : "s"}</p>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-muted">No photos yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="flex items-center gap-3 rounded-2xl border border-olive-100 bg-cream/40 p-2"
              >
                <img
                  src={photo.url}
                  alt={photo.alt}
                  className="h-20 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-olive-950">{photo.alt}</p>
                  <p className="text-xs text-muted">Position {index + 1}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy || index === 0}
                    onClick={() => void move(index, -1)}
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy || index === photos.length - 1}
                    onClick={() => void move(index, 1)}
                    aria-label="Move later"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void remove(photo.id)}
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted">
        Changes go live on{" "}
        <a
          href="https://www.palmwoodspaws.com"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-olive-800 underline-offset-2 hover:underline"
        >
          www.palmwoodspaws.com
        </a>{" "}
        within about a minute.
      </p>
    </div>
  );
}
