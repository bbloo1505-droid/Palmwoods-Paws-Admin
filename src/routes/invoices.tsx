import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, PageHeader, inputClassName } from "@/components/ui";
import { createInvoice, listClients, listInvoices, markInvoicePaid } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Client, Invoice } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/invoices")({
  component: InvoicesPage,
});

type InvoiceRow = Invoice & { client: Pick<Client, "id" | "name"> | null };

function InvoicesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    amount: "",
    notes: "",
  });

  const reload = async () => {
    const [inv, c] = await Promise.all([listInvoices(), listClients()]);
    setRows(inv as InvoiceRow[]);
    setClients(c);
    if (!form.client_id && c[0]) setForm((f) => ({ ...f, client_id: c[0].id }));
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoices"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const owed = rows.filter((r) => r.status === "owed");
  const paid = rows.filter((r) => r.status === "paid");
  const outstanding = owed.reduce((sum, r) => sum + Number(r.amount), 0);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await createInvoice(user.id, {
        client_id: form.client_id,
        amount: Number(form.amount),
        notes: form.notes,
      });
      setShowForm(false);
      setForm((f) => ({ ...f, amount: "", notes: "" }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  };

  const onPaid = async (id: string) => {
    setBusy(true);
    try {
      await markInvoicePaid(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark paid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`Outstanding ${formatMoney(outstanding)}`}
        action={
          <Button variant="gold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New invoice"}
          </Button>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <Card className="mb-5">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void onCreate(e)}>
            <Field label="Client">
              <select
                className={inputClassName()}
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount ($)">
              <input
                className={inputClassName()}
                type="number"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <input
                className={inputClassName()}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                Save invoice
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">Owed</h2>
        {owed.length === 0 ? (
          <EmptyState title="Nothing outstanding" body="Nice — all caught up." />
        ) : (
          <div className="space-y-3">
            {owed.map((inv) => (
              <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-olive-950">
                    {inv.client?.name ?? "Client"} · {formatMoney(inv.amount)}
                  </p>
                  <p className="text-sm text-muted">
                    {inv.due_on ? `Due ${format(new Date(inv.due_on), "d MMM")}` : "No due date"}
                    {inv.notes ? ` · ${inv.notes}` : ""}
                  </p>
                </div>
                <Button size="sm" disabled={busy} onClick={() => void onPaid(inv.id)}>
                  Mark paid
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Paid</h2>
        {paid.length === 0 ? (
          <Card className="text-sm text-muted">Paid invoices will appear here.</Card>
        ) : (
          <div className="space-y-3">
            {paid.map((inv) => (
              <Card key={inv.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-olive-950">
                    {inv.client?.name ?? "Client"} · {formatMoney(inv.amount)}
                  </p>
                  <p className="text-sm text-muted">
                    Paid {inv.paid_on ? format(new Date(inv.paid_on), "d MMM yyyy") : ""}
                  </p>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                  Paid
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
