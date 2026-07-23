import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button, Field, PageHeader, inputClassName } from "@/components/ui";
import { listClients, upsertPet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Client } from "@/lib/types";
import { z } from "zod";

const searchSchema = z.object({
  clientId: z.string().optional(),
});

export const Route = createFileRoute("/pets/new")({
  validateSearch: searchSchema,
  component: NewPetPage,
});

function NewPetPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clientId: presetClientId } = Route.useSearch();
  const [clients, setClients] = useState<Client[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: presetClientId ?? "",
    name: "",
    species: "dog",
    breed: "",
    medication: "",
    feeding: "",
    behaviour: "",
  });

  useEffect(() => {
    listClients()
      .then((c) => {
        setClients(c);
        if (!presetClientId && c[0]) setForm((f) => ({ ...f, client_id: c[0].id }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load clients"));
  }, [presetClientId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const pet = await upsertPet(user.id, form);
      void navigate({ to: "/pets/$petId", params: { petId: pet.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New pet" subtitle="Start with the essentials — you can fill the rest later." />
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Client">
          <select
            className={inputClassName()}
            required
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pet name">
          <input
            className={inputClassName()}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Species">
            <select
              className={inputClassName()}
              value={form.species}
              onChange={(e) => setForm({ ...form, species: e.target.value })}
            >
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Breed">
            <input
              className={inputClassName()}
              value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Medication">
          <textarea
            className={inputClassName("min-h-20")}
            value={form.medication}
            onChange={(e) => setForm({ ...form, medication: e.target.value })}
          />
        </Field>
        <Field label="Feeding">
          <textarea
            className={inputClassName("min-h-20")}
            value={form.feeding}
            onChange={(e) => setForm({ ...form, feeding: e.target.value })}
          />
        </Field>
        <Field label="Behaviour">
          <textarea
            className={inputClassName("min-h-20")}
            value={form.behaviour}
            onChange={(e) => setForm({ ...form, behaviour: e.target.value })}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" variant="gold" size="lg" disabled={busy || !form.client_id}>
          {busy ? "Saving…" : "Save pet"}
        </Button>
      </form>
    </div>
  );
}
