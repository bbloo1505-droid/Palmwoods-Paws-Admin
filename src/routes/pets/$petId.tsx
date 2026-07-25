import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import { getClient, getPet, listPetWalkStats, startWalk, upsertPet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Client, Pet } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export const Route = createFileRoute("/pets/$petId")({
  component: PetDetailPage,
});

function PetDetailPage() {
  const { petId } = Route.useParams();
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof listPetWalkStats>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPet(petId)
      .then(async (p) => {
        setPet(p);
        const [c, s] = await Promise.all([getClient(p.client_id), listPetWalkStats(p.id)]);
        setClient(c);
        setStats(s);
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
      setError(
        err instanceof Error
          ? `${err.message}. Run the Paw Reports SQL migration if tables are missing.`
          : "Could not start walk",
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!pet || !ownerId) return;
    setBusy(true);
    setMessage(null);
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
    }
  };

  if (!pet && !error) return <p className="text-muted">Loading pet…</p>;
  if (!pet) return <p className="text-danger">{error}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={pet.name}
        subtitle={client ? `With ${client.name}` : pet.breed || pet.species}
        action={
          <Button variant="gold" size="lg" disabled={busy || !client} onClick={() => void onStartWalk()}>
            {busy ? "Starting…" : "Start Walk"}
          </Button>
        }
      />
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {stats ? (
        <Card className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-2xl text-olive-950">{stats.adventureCount}</p>
            <p className="text-xs text-muted">Adventures</p>
          </div>
          <div>
            <p className="font-display text-2xl text-olive-950">{stats.totalKm.toFixed(1)}</p>
            <p className="text-xs text-muted">km explored</p>
          </div>
          <div>
            <p className="font-display text-lg text-olive-950">
              {stats.lastWalkAt ? format(new Date(stats.lastWalkAt), "d MMM") : "—"}
            </p>
            <p className="text-xs text-muted">Last walked</p>
          </div>
        </Card>
      ) : null}

      {client ? (
        <Link to="/clients/$clientId" params={{ clientId: client.id }} className="text-sm font-semibold text-olive-800">
          View client & house info →
        </Link>
      ) : null}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-28 w-28 overflow-hidden rounded-2xl bg-olive-100">
          {pet.photo_url ? (
            <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">🐾</div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Profile photo</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </Card>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void save(e)}>
        {(
          [
            ["name", "Name"],
            ["species", "Species"],
            ["breed", "Breed"],
            ["birthday", "Birthday"],
            ["microchip", "Microchip"],
            ["vet_name", "Vet"],
            ["vaccinated_until", "Vaccinated until"],
            ["weight_kg", "Weight (kg)"],
            ["favourite_treats", "Favourite treats"],
            ["lead_location", "Lead location"],
            ["preferred_route", "Preferred walking route"],
            ["known_dogs", "Known dogs"],
            ["house_access", "House access"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className={inputClassName()}
              type={key.includes("until") || key === "birthday" ? "date" : key === "weight_kg" ? "number" : "text"}
              step={key === "weight_kg" ? "0.1" : undefined}
              value={(pet[key] as string | number | null) ?? ""}
              onChange={(e) =>
                setPet({
                  ...pet,
                  [key]:
                    key === "weight_kg"
                      ? e.target.value
                        ? Number(e.target.value)
                        : null
                      : e.target.value,
                })
              }
            />
          </Field>
        ))}

        {(
          [
            ["behaviour", "Behaviour"],
            ["commands", "Commands"],
            ["medication", "Medication"],
            ["feeding", "Feeding"],
            ["notes", "Notes"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label} className="md:col-span-2">
            <textarea
              className={inputClassName("min-h-24")}
              value={pet[key] ?? ""}
              onChange={(e) => setPet({ ...pet, [key]: e.target.value })}
            />
          </Field>
        ))}

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={pet.can_off_leash}
            onChange={(e) => setPet({ ...pet, can_off_leash: e.target.checked })}
          />
          Can be off leash
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={pet.swims}
            onChange={(e) => setPet({ ...pet, swims: e.target.checked })}
          />
          Swimming OK
        </label>

        <div className="md:col-span-2">
          <Button type="submit" variant="gold" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save pet profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}

