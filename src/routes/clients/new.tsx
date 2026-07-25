import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button, Field, PageHeader, inputClassName } from "@/components/ui";
import { upsertClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    suburb: "",
    notes: "",
    emergency_contact: "",
    preferred_payment: "",
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setBusy(true);
    setError(null);
    try {
      const client = await upsertClient(ownerId, form);
      void navigate({ to: "/clients/$clientId", params: { clientId: client.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New client" subtitle="Contact details and notes for the household." />
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Name" className="md:col-span-2">
          <input
            className={inputClassName()}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClassName()}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClassName()}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <input
            className={inputClassName()}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Suburb">
          <input
            className={inputClassName()}
            value={form.suburb}
            onChange={(e) => setForm({ ...form, suburb: e.target.value })}
          />
        </Field>
        <Field label="Preferred payment">
          <input
            className={inputClassName()}
            placeholder="Cash, transfer, weekly invoice…"
            value={form.preferred_payment}
            onChange={(e) => setForm({ ...form, preferred_payment: e.target.value })}
          />
        </Field>
        <Field label="Emergency contact" className="md:col-span-2">
          <input
            className={inputClassName()}
            value={form.emergency_contact}
            onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
          />
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <textarea
            className={inputClassName("min-h-28")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error ? <p className="md:col-span-2 text-sm text-danger">{error}</p> : null}
        <div className="md:col-span-2">
          <Button type="submit" variant="gold" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save client"}
          </Button>
        </div>
      </form>
    </div>
  );
}

