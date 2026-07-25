import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Camera, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import {
  createInvoice,
  finishVisit,
  getVisit,
  getVisitPhotoUrl,
  listVisitChecklist,
  listVisitPhotos,
  toggleChecklistItem,
  updateVisitNotes,
  uploadVisitPhoto,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { VisitChecklistItem, VisitPhoto } from "@/lib/types";

export const Route = createFileRoute("/visits/$visitId")({
  component: VisitFlowPage,
});

function VisitFlowPage() {
  const { visitId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<Awaited<ReturnType<typeof getVisit>> | null>(null);
  const [checklist, setChecklist] = useState<VisitChecklistItem[]>([]);
  const [photos, setPhotos] = useState<(VisitPhoto & { url?: string })[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [createInvoiceOnFinish, setCreateInvoiceOnFinish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    const [v, c, p] = await Promise.all([
      getVisit(visitId),
      listVisitChecklist(visitId),
      listVisitPhotos(visitId),
    ]);
    setVisit(v);
    setChecklist(c);
    setNotes(v.notes ?? "");
    const withUrls = await Promise.all(
      p.map(async (photo) => ({
        ...photo,
        url: await getVisitPhotoUrl(photo.storage_path),
      })),
    );
    setPhotos(withUrls);
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load visit"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const onToggle = async (item: VisitChecklistItem) => {
    await toggleChecklistItem(item.id, !item.done);
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)));
  };

  const onSaveNotes = async () => {
    await updateVisitNotes(visitId, notes);
    setMessage("Notes saved");
  };

  const onPhoto = async (file: File | null) => {
    if (!file || !ownerId) return;
    setBusy(true);
    try {
      await uploadVisitPhoto(ownerId, visitId, file);
      await reload();
      setMessage("Photo added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onFinish = async () => {
    if (!ownerId || !visit) return;
    setBusy(true);
    setError(null);
    try {
      await updateVisitNotes(visitId, notes);
      await finishVisit(visitId);
      const booking = visit.booking as {
        client_id?: string;
        amount?: number | null;
        client?: { id?: string };
      };
      if (createInvoiceOnFinish && booking) {
        const clientId = booking.client_id || booking.client?.id;
        const amount = Number(booking.amount ?? 0);
        if (clientId && amount > 0) {
          await createInvoice(ownerId, {
            client_id: clientId,
            visit_id: visitId,
            amount,
            notes: `Visit ${format(new Date(), "d MMM yyyy")}`,
          });
        }
      }
      setMessage("Visit finished");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish visit");
    } finally {
      setBusy(false);
    }
  };

  if (!visit && !error) return <p className="text-muted">Loading visit…</p>;
  if (!visit) return <p className="text-danger">{error}</p>;

  const booking = visit.booking as {
    pet?: { name?: string };
    client?: { name?: string };
    service_type?: string;
    amount?: number | null;
  };
  const done = visit.status === "completed";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title={booking?.pet?.name ? `${booking.pet.name}'s visit` : "Visit"}
        subtitle={`${booking?.client?.name ?? ""} · started ${format(new Date(visit.started_at), "h:mmaaa")}`}
      />
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <h3 className="mb-3 font-display text-xl">Checklist</h3>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={done}
                onClick={() => void onToggle(item)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-olive-100 bg-cream px-3 py-3 text-left"
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg ${
                    item.done ? "bg-success text-white" : "bg-warm-white text-muted"
                  }`}
                >
                  {item.done ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Field label="Notes">
          <textarea
            className={inputClassName("min-h-32")}
            value={notes}
            disabled={done}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Charlie was energetic and loved chasing the ball…"
          />
        </Field>
        {!done ? (
          <Button className="mt-3" variant="secondary" onClick={() => void onSaveNotes()}>
            Save notes
          </Button>
        ) : null}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl">Photos</h3>
          {!done ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-olive-800 px-4 py-2 text-sm font-semibold text-warm-white">
              <Camera className="h-4 w-4" />
              Take / add
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-muted">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt="Visit"
                className="aspect-square rounded-xl object-cover"
              />
            ))}
          </div>
        )}
      </Card>

      {!done ? (
        <Card className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={createInvoiceOnFinish}
              onChange={(e) => setCreateInvoiceOnFinish(e.target.checked)}
            />
            Create invoice{booking?.amount != null ? ` ($${Number(booking.amount).toFixed(0)})` : ""}
          </label>
          <Button
            className="w-full"
            size="lg"
            variant="gold"
            disabled={busy}
            onClick={() => void onFinish()}
          >
            {busy ? "Finishing…" : "Finish visit"}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3 text-center">
          <p className="font-display text-xl text-olive-950">Visit completed</p>
          <Button variant="secondary" onClick={() => void navigate({ to: "/invoices" })}>
            View invoices
          </Button>
        </Card>
      )}
    </div>
  );
}

