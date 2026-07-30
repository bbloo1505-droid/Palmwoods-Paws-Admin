import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, MapPin } from "lucide-react";
import { Button, Card, Field, inputClassName } from "@/components/ui";
import { deletePet, getClient, getPet, listPetWalkStats, startWalk, upsertPet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Client, Pet } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { cn, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/pets/$petId")({
  component: PetDetailPage,
});

function PetDetailPage() {
  const { petId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof listPetWalkStats>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getPet(petId)
      .then(async (p) => {
        setPet(p);
        try {
          const c = await getClient(p.client_id);
          setClient(c);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load client");
        }
        try {
          const s = await listPetWalkStats(p.id);
          setStats(s);
        } catch {
          setStats({ adventureCount: 0, totalKm: 0, totalDurationSec: 0, lastWalkAt: null, walks: [] });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pet"));
  }, [petId]);

  const onStartWalk = async () => {
    if (!pet || !ownerId || !client) return;
    setBusy(true);
    setError(null);
    try {
      const walk = await startWalk(ownerId, {
        pet_id: pet.id,
        client_id: client.id,
        suburb: client.suburb,
      });
      void navigate({ to: "/walks/$walkId", params: { walkId: walk.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start walk");
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!pet || !ownerId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await upsertPet(ownerId, pet, pet.id);
      setPet(saved);
      setMessage("Pet profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (file: File | null) => {
    if (!file || !ownerId || !pet) return;
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${ownerId}/${pet.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("pet-avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("pet-avatars").getPublicUrl(path);
      const saved = await upsertPet(ownerId, { ...pet, photo_url: data.publicUrl }, pet.id);
      setPet(saved);
      setMessage("Photo updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const setField = <K extends keyof Pet>(key: K, value: Pet[K]) => {
    if (!pet) return;
    setPet({ ...pet, [key]: value });
  };

  const onDeletePet = async () => {
    if (!pet) return;
    if (
      !window.confirm(
        `Delete ${pet.name}'s profile?\n\nWalk history and Paw Reports for this pet may be removed too. This can’t be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const clientId = pet.client_id;
      await deletePet(pet.id);
      if (clientId) {
        void navigate({ to: "/clients/$clientId", params: { clientId } });
      } else {
        void navigate({ to: "/pets" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete pet");
      setBusy(false);
    }
  };

  if (!pet && !error) return <p className="text-muted">Loading pet…</p>;
  if (!pet) return <p className="text-danger">{error}</p>;

  const metaBits = [pet.breed, pet.species !== "dog" ? pet.species : null, pet.weight_kg ? `${pet.weight_kg} kg` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {/* Identity hero */}
      <section className="overflow-hidden rounded-[1.75rem] border border-olive-100 bg-warm-white shadow-sm">
        <div className="relative isolate min-h-56 overflow-hidden sm:min-h-64">
          {pet.photo_url ? (
            <img
              src={pet.photo_url}
              alt={pet.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 70% at 30% 20%, #6a735c 0%, transparent 55%), linear-gradient(160deg, #3d4636 0%, #4b5742 50%, #6a735c 100%)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(43,48,38,0.15) 0%, rgba(43,48,38,0.35) 45%, rgba(43,48,38,0.88) 100%)",
            }}
          />

          <div className="relative flex min-h-56 flex-col justify-between p-5 sm:min-h-64 sm:p-6">
            <div className="flex justify-end gap-2">
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-0 bg-warm-white/90 backdrop-blur"
                disabled={busy}
                onClick={() => photoRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {pet.photo_url ? "Change photo" : "Add photo"}
              </Button>
            </div>

            <div className="max-w-lg text-warm-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                Pet profile
              </p>
              <h1 className="mt-1 font-display text-4xl tracking-tight sm:text-5xl">{pet.name}</h1>
              {metaBits ? <p className="mt-2 text-sm text-warm-white/85">{metaBits}</p> : null}
              {client ? (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: client.id }}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline"
                >
                  With {client.name}
                  {client.suburb ? (
                    <span className="font-normal text-warm-white/70"> · {client.suburb}</span>
                  ) : null}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-olive-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {stats ? (
            <div className="grid flex-1 grid-cols-3 gap-2 text-center sm:text-left">
              <Stat label="Walks" value={String(stats.adventureCount)} />
              <Stat label="Time walked" value={formatDuration(stats.totalDurationSec)} />
              <Stat
                label="Last walked"
                value={stats.lastWalkAt ? format(new Date(stats.lastWalkAt), "d MMM") : "—"}
              />
            </div>
          ) : (
            <div />
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              to="/invoices/new"
              search={{ clientId: pet.client_id, petId: pet.id }}
              className="w-full sm:w-auto"
            >
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Create invoice
              </Button>
            </Link>
            <Button
              variant="gold"
              size="lg"
              className="w-full shrink-0 sm:w-auto"
              disabled={busy || !client}
              onClick={() => void onStartWalk()}
            >
              {busy ? "Starting…" : "Start Walk"}
            </Button>
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {(pet.can_off_leash || pet.swims || pet.lead_location || pet.preferred_route) && (
        <div className="flex flex-wrap gap-2">
          {pet.can_off_leash ? <Pill>Off leash OK</Pill> : null}
          {pet.swims ? <Pill>Swims</Pill> : null}
          {pet.lead_location ? (
            <Pill>
              <MapPin className="h-3.5 w-3.5" />
              Lead: {pet.lead_location}
            </Pill>
          ) : null}
          {pet.preferred_route ? <Pill>Route noted</Pill> : null}
        </div>
      )}

      <form className="space-y-4" onSubmit={(e) => void save(e)}>
        <Section title="About" hint="Basics for the profile card and walk notes.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClassName()}
                value={pet.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </Field>
            <Field label="Species">
              <input
                className={inputClassName()}
                value={pet.species}
                onChange={(e) => setField("species", e.target.value)}
              />
            </Field>
            <Field label="Breed">
              <input
                className={inputClassName()}
                value={pet.breed ?? ""}
                onChange={(e) => setField("breed", e.target.value || null)}
              />
            </Field>
            <Field label="Birthday">
              <input
                className={inputClassName()}
                type="date"
                value={pet.birthday ?? ""}
                onChange={(e) => setField("birthday", e.target.value || null)}
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                className={inputClassName()}
                type="number"
                step="0.1"
                value={pet.weight_kg ?? ""}
                onChange={(e) =>
                  setField("weight_kg", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
            <Field label="Microchip">
              <input
                className={inputClassName()}
                value={pet.microchip ?? ""}
                onChange={(e) => setField("microchip", e.target.value || null)}
              />
            </Field>
            <Field label="Vet">
              <input
                className={inputClassName()}
                value={pet.vet_name ?? ""}
                onChange={(e) => setField("vet_name", e.target.value || null)}
              />
            </Field>
            <Field label="Vaccinated until">
              <input
                className={inputClassName()}
                type="date"
                value={pet.vaccinated_until ?? ""}
                onChange={(e) => setField("vaccinated_until", e.target.value || null)}
              />
            </Field>
          </div>
        </Section>

        <Section title="On walks" hint="What Anna needs when heading out the door.">
          <div className="mb-4 flex flex-wrap gap-2">
            <ToggleChip
              active={pet.can_off_leash}
              onClick={() => setField("can_off_leash", !pet.can_off_leash)}
              label="Can be off leash"
            />
            <ToggleChip
              active={pet.swims}
              onClick={() => setField("swims", !pet.swims)}
              label="Swimming OK"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Favourite treats">
              <input
                className={inputClassName()}
                value={pet.favourite_treats ?? ""}
                onChange={(e) => setField("favourite_treats", e.target.value || null)}
              />
            </Field>
            <Field label="Lead location">
              <input
                className={inputClassName()}
                value={pet.lead_location ?? ""}
                onChange={(e) => setField("lead_location", e.target.value || null)}
                placeholder="Hook by laundry…"
              />
            </Field>
            <Field label="Preferred walking route" className="sm:col-span-2">
              <input
                className={inputClassName()}
                value={pet.preferred_route ?? ""}
                onChange={(e) => setField("preferred_route", e.target.value || null)}
              />
            </Field>
            <Field label="Known dogs" className="sm:col-span-2">
              <input
                className={inputClassName()}
                value={pet.known_dogs ?? ""}
                onChange={(e) => setField("known_dogs", e.target.value || null)}
              />
            </Field>
            <Field label="House access" className="sm:col-span-2">
              <input
                className={inputClassName()}
                value={pet.house_access ?? ""}
                onChange={(e) => setField("house_access", e.target.value || null)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Care notes" hint="Behaviour, routines, and anything important to remember.">
          <div className="grid gap-3">
            {(
              [
                ["behaviour", "Behaviour"],
                ["commands", "Commands"],
                ["medication", "Medication"],
                ["feeding", "Feeding"],
                ["notes", "Notes"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea
                  className={inputClassName("min-h-24")}
                  value={pet[key] ?? ""}
                  onChange={(e) => setField(key, e.target.value || null)}
                />
              </Field>
            ))}
          </div>
        </Section>

        <div className="sticky bottom-3 z-10">
          <Button
            type="submit"
            variant="gold"
            size="lg"
            className="min-h-14 w-full shadow-[0_12px_30px_-12px_rgba(43,48,38,0.55)]"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save pet profile"}
          </Button>
        </div>
      </form>

      <Card className="space-y-3 border-danger/20">
        <h2 className="font-display text-xl text-olive-950">Delete pet</h2>
        <p className="text-sm text-muted">
          Removes {pet.name} from this household. Related walks and reports may be removed when the
          database allows. This can’t be undone.
        </p>
        <Button type="button" variant="danger" disabled={busy} onClick={() => void onDeletePet()}>
          {busy ? "Deleting…" : `Delete ${pet.name}`}
        </Button>
      </Card>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl text-olive-950">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xl text-olive-950 sm:text-2xl">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-olive-100 bg-warm-white px-3 py-1.5 text-xs font-semibold text-olive-900">
      {children}
    </span>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-2 text-sm font-semibold transition",
        active
          ? "bg-olive-800 text-warm-white"
          : "border border-olive-100 bg-cream text-olive-900 hover:border-olive-700/40",
      )}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );
}
