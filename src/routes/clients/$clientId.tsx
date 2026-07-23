import { createFileRoute, Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import { getClient, getHouseInfo, listPets, upsertClient, upsertHouseInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Client, HouseInfo, Pet } from "@/lib/types";

export const Route = createFileRoute("/clients/$clientId")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [house, setHouse] = useState<Partial<HouseInfo>>({});
  const [pets, setPets] = useState<Pet[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getClient(clientId), getHouseInfo(clientId), listPets(clientId)])
      .then(([c, h, p]) => {
        setClient(c);
        setHouse(h ?? {});
        setPets(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [clientId]);

  const saveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!client || !user) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await upsertClient(user.id, client, client.id);
      setClient(saved);
      setMessage("Client saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveHouse = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const saved = await upsertHouseInfo(clientId, house);
      setHouse(saved);
      setMessage("House info saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!client && !error) return <p className="text-muted">Loading client…</p>;
  if (!client) return <p className="text-danger">{error}</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle={[client.suburb, client.phone].filter(Boolean).join(" · ")}
        action={
          <Link to="/pets/new" search={{ clientId }}>
            <Button variant="gold">
              <Plus className="h-4 w-4" />
              Add pet
            </Button>
          </Link>
        }
      />
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-xl">Contact & notes</h2>
          <form className="grid gap-3" onSubmit={(e) => void saveClient(e)}>
            <Field label="Name">
              <input
                className={inputClassName()}
                value={client.name}
                onChange={(e) => setClient({ ...client, name: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClassName()}
                value={client.phone ?? ""}
                onChange={(e) => setClient({ ...client, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClassName()}
                value={client.email ?? ""}
                onChange={(e) => setClient({ ...client, email: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClassName()}
                value={client.address ?? ""}
                onChange={(e) => setClient({ ...client, address: e.target.value })}
              />
            </Field>
            <Field label="Suburb">
              <input
                className={inputClassName()}
                value={client.suburb ?? ""}
                onChange={(e) => setClient({ ...client, suburb: e.target.value })}
              />
            </Field>
            <Field label="Emergency contact">
              <input
                className={inputClassName()}
                value={client.emergency_contact ?? ""}
                onChange={(e) => setClient({ ...client, emergency_contact: e.target.value })}
              />
            </Field>
            <Field label="Preferred payment">
              <input
                className={inputClassName()}
                value={client.preferred_payment ?? ""}
                onChange={(e) => setClient({ ...client, preferred_payment: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className={inputClassName("min-h-24")}
                value={client.notes ?? ""}
                onChange={(e) => setClient({ ...client, notes: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Save client
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-xl">House information</h2>
          <form className="grid gap-3" onSubmit={(e) => void saveHouse(e)}>
            <Field label="Key location">
              <input
                className={inputClassName()}
                placeholder="Green meter box"
                value={house.key_location ?? ""}
                onChange={(e) => setHouse({ ...house, key_location: e.target.value })}
              />
            </Field>
            <Field label="Alarm">
              <input
                className={inputClassName()}
                placeholder="Press OFF twice"
                value={house.alarm_notes ?? ""}
                onChange={(e) => setHouse({ ...house, alarm_notes: e.target.value })}
              />
            </Field>
            <Field label="Bin day">
              <input
                className={inputClassName()}
                value={house.bin_day ?? ""}
                onChange={(e) => setHouse({ ...house, bin_day: e.target.value })}
              />
            </Field>
            <Field label="Gate / access">
              <input
                className={inputClassName()}
                value={house.gate_notes ?? ""}
                onChange={(e) => setHouse({ ...house, gate_notes: e.target.value })}
              />
            </Field>
            <Field label="WiFi">
              <input
                className={inputClassName()}
                value={house.wifi ?? ""}
                onChange={(e) => setHouse({ ...house, wifi: e.target.value })}
              />
            </Field>
            <Field label="Garage code">
              <input
                className={inputClassName()}
                value={house.garage_code ?? ""}
                onChange={(e) => setHouse({ ...house, garage_code: e.target.value })}
              />
            </Field>
            <Field label="Extras">
              <textarea
                className={inputClassName("min-h-24")}
                placeholder="Feed cat too, water plants…"
                value={house.extras ?? ""}
                onChange={(e) => setHouse({ ...house, extras: e.target.value })}
              />
            </Field>
            <Button type="submit" variant="gold" disabled={busy}>
              Save house info
            </Button>
          </form>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl">Pets ({pets.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Link key={pet.id} to="/pets/$petId" params={{ petId: pet.id }}>
              <Card className="flex items-center gap-3 transition hover:border-olive-700/30">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-olive-100">
                  {pet.photo_url ? (
                    <img src={pet.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>🐶</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-olive-950">{pet.name}</p>
                  <p className="text-sm text-muted">{pet.breed || pet.species}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
