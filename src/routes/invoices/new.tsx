import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, format } from "date-fns";
import { Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button, inputClassName } from "@/components/ui";
import {
  createInvoice,
  downloadStoredInvoicePdf,
  getPet,
  listClients,
  listPets,
  nextInvoiceNumber,
  saveInvoicePdfFile,
  upsertClient,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  INVOICE_BUSINESS,
  formatInvoiceNumber,
  paymentReference,
} from "@/lib/invoiceBusiness";
import { buildInvoicePdf, downloadPdfBytes } from "@/lib/invoicePdf";
import { buildInvoiceNotes, type InvoiceLineSnapshot } from "@/lib/rates";
import type { Client, Pet } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const searchSchema = z.object({
  clientId: z.string().optional(),
  petId: z.string().optional(),
});

export const Route = createFileRoute("/invoices/new")({
  validateSearch: searchSchema,
  component: NewInvoicePage,
});

type LineDraft = {
  id: string;
  date: string;
  description: string;
  amount: string;
};

type BillTo = {
  name: string;
  address: string;
  suburb: string;
  phone: string;
  email: string;
  petName: string;
};

type Step = "edit" | "done";

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function newId() {
  return crypto.randomUUID();
}

function emptyLine(date = todayIso()): LineDraft {
  return { id: newId(), date, description: "", amount: "" };
}

function emptyBillTo(): BillTo {
  return { name: "", address: "", suburb: "", phone: "", email: "", petName: "" };
}

const fieldClass =
  "w-full rounded-md border border-[#e8ebdd] bg-white px-2.5 py-2 text-sm text-[#263126] outline-none placeholder:text-[#7b8177]/focus:border-[#e5b950]";

function NewInvoicePage() {
  const { ownerId } = useAuth();
  const { clientId: presetClientId, petId: presetPetId } = Route.useSearch();

  const [step, setStep] = useState<Step>("edit");
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [linkedClientId, setLinkedClientId] = useState(presetClientId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [savedPdfBytes, setSavedPdfBytes] = useState<Uint8Array | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("001");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [billTo, setBillTo] = useState<BillTo>(emptyBillTo());
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine(), emptyLine()]);
  const [note, setNote] = useState("");

  useEffect(() => {
    nextInvoiceNumber()
      .then((n) => setInvoiceNumber(formatInvoiceNumber(n)))
      .catch(() => setInvoiceNumber("001"));

    listClients()
      .then(async (c) => {
        setClients(c);
        let clientId = presetClientId ?? "";
        let petName = "";

        if (presetPetId) {
          try {
            const pet = await getPet(presetPetId);
            clientId = pet.client_id;
            petName = pet.name;
            const clientPets = await listPets(pet.client_id);
            setPets(clientPets);
          } catch {
            /* ignore */
          }
        }

        if (clientId) {
          const client = c.find((x) => x.id === clientId);
          if (client) {
            setLinkedClientId(client.id);
            setBillTo({
              name: client.name,
              address: client.address ?? "",
              suburb: client.suburb ?? "",
              phone: client.phone ?? "",
              email: client.email ?? "",
              petName,
            });
            if (!presetPetId) {
              const clientPets = await listPets(client.id);
              setPets(clientPets);
            }
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [presetClientId, presetPetId]);

  const filledLines: InvoiceLineSnapshot[] = useMemo(
    () =>
      lines
        .map((l) => ({
          date: l.date || invoiceDate,
          description: l.description.trim(),
          amount: Number(l.amount),
          petName: billTo.petName.trim() || null,
        }))
        .filter((l) => l.description && Number.isFinite(l.amount) && l.amount >= 0),
    [lines, invoiceDate, billTo.petName],
  );

  const total = filledLines.reduce((sum, l) => sum + l.amount, 0);
  const payRef = paymentReference(billTo.name || "Client", invoiceNumber || "000");

  const fillFromClient = async (id: string) => {
    setLinkedClientId(id);
    if (!id) return;
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    try {
      const clientPets = await listPets(id);
      setPets(clientPets);
      setBillTo({
        name: client.name,
        address: client.address ?? "",
        suburb: client.suburb ?? "",
        phone: client.phone ?? "",
        email: client.email ?? "",
        petName: clientPets[0]?.name ?? billTo.petName,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load client");
    }
  };

  const updateLine = (id: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const pdfInput = () => ({
    invoiceNumber,
    invoiceDate,
    dueDate,
    billTo: {
      name: billTo.name.trim(),
      address: billTo.address.trim() || null,
      suburb: billTo.suburb.trim() || null,
      phone: billTo.phone.trim() || null,
      email: billTo.email.trim() || null,
      petName: billTo.petName.trim() || null,
    },
    lines: filledLines.map(({ date, description, amount }) => ({ date, description, amount })),
    note: note.trim() || null,
  });

  const resolveClientId = async () => {
    if (!ownerId) throw new Error("Not signed in.");
    const name = billTo.name.trim();
    if (!name) throw new Error("Enter a client name on Bill To.");

    if (linkedClientId) {
      const linked = clients.find((c) => c.id === linkedClientId);
      if (linked) {
        // Keep profile in sync with what she typed on the invoice.
        await upsertClient(
          ownerId,
          {
            name,
            address: billTo.address.trim() || null,
            suburb: billTo.suburb.trim() || null,
            phone: billTo.phone.trim() || null,
            email: billTo.email.trim() || null,
          },
          linked.id,
        );
        return linked.id;
      }
    }

    const match = clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (match) {
      await upsertClient(
        ownerId,
        {
          name,
          address: billTo.address.trim() || null,
          suburb: billTo.suburb.trim() || null,
          phone: billTo.phone.trim() || null,
          email: billTo.email.trim() || null,
        },
        match.id,
      );
      return match.id;
    }

    const created = await upsertClient(ownerId, {
      name,
      address: billTo.address.trim() || null,
      suburb: billTo.suburb.trim() || null,
      phone: billTo.phone.trim() || null,
      email: billTo.email.trim() || null,
      notes: "Created from invoice",
    });
    return created.id;
  };

  const onSave = async () => {
    if (!ownerId) return;
    setError(null);
    if (!invoiceNumber.trim()) {
      setError("Enter an invoice number.");
      return;
    }
    if (!invoiceDate || !dueDate) {
      setError("Invoice date and due date are required.");
      return;
    }
    if (!billTo.name.trim()) {
      setError("Enter who to bill.");
      return;
    }
    if (filledLines.length === 0) {
      setError("Add at least one service line with a description and amount.");
      return;
    }

    setBusy(true);
    try {
      const clientId = await resolveClientId();
      const notes = buildInvoiceNotes({
        invoiceNumber: invoiceNumber.trim(),
        invoiceDateIso: invoiceDate,
        lines: filledLines,
        freeNote: note,
      });

      const invoice = await createInvoice(ownerId, {
        client_id: clientId,
        amount: total,
        due_on: dueDate,
        notes,
      });

      const pdfBytes = await buildInvoicePdf(pdfInput());
      setSavedPdfBytes(pdfBytes);

      try {
        const saved = await saveInvoicePdfFile({
          ownerId,
          invoiceId: invoice.id,
          invoiceNumber: invoiceNumber.trim(),
          pdfBytes,
        });
        setSavedPdfPath(saved.path ?? null);
      } catch (saveErr) {
        console.warn("Cloud PDF save failed:", saveErr);
      }

      downloadPdfBytes(pdfBytes, `Palmwoods-Paws-Invoice-${invoiceNumber.trim()}.pdf`);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save invoice");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadAgain = async () => {
    setBusy(true);
    setError(null);
    try {
      const filename = `Palmwoods-Paws-Invoice-${invoiceNumber.trim()}.pdf`;
      if (savedPdfBytes) downloadPdfBytes(savedPdfBytes, filename);
      else if (savedPdfPath) await downloadStoredInvoicePdf(savedPdfPath, filename);
      else downloadPdfBytes(await buildInvoicePdf(pdfInput()), filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-6">
        <div className="rounded-2xl border border-[#e8ebdd] bg-[#fbfaf6] p-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8861f]">
            Saved
          </p>
          <h1 className="mt-1 font-display text-2xl text-[#263126]">
            Invoice #{invoiceNumber} is ready
          </h1>
          <p className="mt-2 text-sm text-[#667063]">
            {filledLines.length} line{filledLines.length === 1 ? "" : "s"} · {formatMoney(total)}
          </p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button
            type="button"
            variant="gold"
            size="lg"
            className="mt-5 min-h-14 w-full"
            disabled={busy}
            onClick={() => void onDownloadAgain()}
          >
            <Download className="h-4 w-4" />
            {busy ? "Preparing…" : "Download PDF"}
          </Button>
          <Link to="/invoices" className="mt-2 block">
            <Button type="button" variant="secondary" className="min-h-12 w-full">
              Back to invoices
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-olive-950">New invoice</h1>
          <p className="mt-1 text-sm text-muted">
            Fill it out like the paper template. Optionally load a saved client.
          </p>
        </div>
        <Link to="/invoices">
          <Button variant="secondary" size="sm">
            Cancel
          </Button>
        </Link>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Optional autofill — not part of the printed look */}
      <div className="rounded-xl border border-olive-100 bg-warm-white p-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-olive-900">
            Autofill from saved client (optional)
          </span>
          <select
            className={inputClassName()}
            value={linkedClientId}
            onChange={(e) => void fillFromClient(e.target.value)}
          >
            <option value="">Type Bill To manually…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.suburb ? ` · ${c.suburb}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Visual invoice sheet */}
      <div className="overflow-hidden rounded-2xl border border-[#e8ebdd] bg-[#fbfaf6] shadow-sm">
        <div className="h-1.5 bg-[#e5b950]" />

        <div className="space-y-6 p-5 sm:p-7">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={INVOICE_BUSINESS.logoPath}
                alt="Palmwoods Paws"
                className="h-16 w-auto rounded-md object-contain"
              />
            </div>
            <div className="min-w-[12rem] space-y-2 text-right">
              <p className="font-display text-3xl font-semibold tracking-wide text-[#5d6950]">
                INVOICE
              </p>
              <label className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-[#e5b950]">
                Invoice #
                <input
                  className={cn(fieldClass, "max-w-[5.5rem] text-right font-semibold text-[#263126]")}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </label>
              <label className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-[#e5b950]">
                Date
                <input
                  className={cn(fieldClass, "max-w-[9.5rem]")}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </label>
              <label className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-[#e5b950]">
                Due date
                <input
                  className={cn(fieldClass, "max-w-[9.5rem]")}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* FROM | BILL TO */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f6f2e8] p-4">
              <div className="mb-2 h-0.5 bg-[#e5b950]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e5b950]">
                From
              </p>
              <p className="mt-2 font-semibold text-[#263126]">{INVOICE_BUSINESS.tradingName}</p>
              <p className="mt-1 text-sm text-[#667063]">{INVOICE_BUSINESS.location}</p>
              <p className="text-sm text-[#667063]">Phone: {INVOICE_BUSINESS.phone}</p>
              <p className="text-sm text-[#667063]">Email: {INVOICE_BUSINESS.email}</p>
              <p className="text-sm text-[#667063]">ABN: {INVOICE_BUSINESS.abn}</p>
            </div>

            <div className="rounded-xl bg-[#f6f2e8] p-4">
              <div className="mb-2 h-0.5 bg-[#e5b950]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e5b950]">
                Bill to
              </p>
              <div className="mt-2 space-y-2">
                <input
                  className={fieldClass}
                  placeholder="Client name"
                  value={billTo.name}
                  onChange={(e) => setBillTo({ ...billTo, name: e.target.value })}
                />
                <input
                  className={fieldClass}
                  placeholder="Address"
                  value={billTo.address}
                  onChange={(e) => setBillTo({ ...billTo, address: e.target.value })}
                />
                <input
                  className={fieldClass}
                  placeholder="Suburb"
                  value={billTo.suburb}
                  onChange={(e) => setBillTo({ ...billTo, suburb: e.target.value })}
                />
                <input
                  className={fieldClass}
                  placeholder="Phone"
                  value={billTo.phone}
                  onChange={(e) => setBillTo({ ...billTo, phone: e.target.value })}
                />
                <input
                  className={fieldClass}
                  placeholder="Email"
                  value={billTo.email}
                  onChange={(e) => setBillTo({ ...billTo, email: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    className={fieldClass}
                    placeholder="Pet name (optional)"
                    value={billTo.petName}
                    onChange={(e) => setBillTo({ ...billTo, petName: e.target.value })}
                    list="invoice-pet-suggestions"
                  />
                  {pets.length > 0 ? (
                    <datalist id="invoice-pet-suggestions">
                      {pets.map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-hidden rounded-xl border border-[#e8ebdd]">
            <div className="grid grid-cols-[7.5rem_1fr_6.5rem] gap-2 bg-[#5d6950] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white sm:grid-cols-[8.5rem_1fr_7rem]">
              <span>Date</span>
              <span>Service provided</span>
              <span className="text-right">Amount</span>
            </div>
            {lines.map((line, index) => (
              <div
                key={line.id}
                className={cn(
                  "grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-2 border-t border-[#e8ebdd] px-2 py-2 sm:grid-cols-[8.5rem_1fr_7rem]",
                  index % 2 === 0 ? "bg-white" : "bg-[#e8ebdd]/40",
                )}
              >
                <input
                  className={cn(fieldClass, "text-sm")}
                  type="date"
                  value={line.date}
                  onChange={(e) => updateLine(line.id, { date: e.target.value })}
                />
                <div className="flex min-w-0 items-center gap-1">
                  <input
                    className={cn(fieldClass, "min-w-0 flex-1")}
                    placeholder="e.g. Regular walk 30 min · Daisy"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
                  />
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-2 text-[#b54a3c] hover:bg-[#b54a3c]/10"
                      onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#667063]">
                    $
                  </span>
                  <input
                    className={cn(fieldClass, "pl-5 text-right")}
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                emptyLine(prev[prev.length - 1]?.date || todayIso()),
              ])
            }
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5d6950] hover:text-[#46513d]"
          >
            <Plus className="h-4 w-4" />
            Add another line
          </button>

          <textarea
            className={cn(fieldClass, "min-h-16")}
            placeholder="Optional note on the invoice…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Totals */}
          <div className="ml-auto w-full max-w-[14rem] space-y-1">
            <div className="flex items-center justify-between rounded-lg bg-[#f6f2e8] px-3 py-2 text-sm">
              <span className="text-[#667063]">Subtotal</span>
              <span className="font-semibold text-[#263126]">{formatMoney(total)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#5d6950] px-3 py-2.5 text-white">
              <span className="font-semibold">TOTAL</span>
              <span className="font-display text-lg font-semibold">{formatMoney(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f6f2e8] p-4">
              <div className="mb-2 h-0.5 bg-[#e5b950]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e5b950]">
                Payment details
              </p>
              <p className="mt-2 text-sm text-[#263126]">Bank: {INVOICE_BUSINESS.bankName}</p>
              <p className="text-sm text-[#263126]">BSB: {INVOICE_BUSINESS.bsb}</p>
              <p className="text-sm text-[#263126]">
                Account number: {INVOICE_BUSINESS.accountNumber}
              </p>
            </div>
            <div className="rounded-xl bg-[#f6f2e8] p-4">
              <div className="mb-2 h-0.5 bg-[#e5b950]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e5b950]">
                Payment reference
              </p>
              <p className="mt-2 font-semibold text-[#46513d]">{payRef}</p>
              <p className="mt-3 text-sm text-[#667063]">{INVOICE_BUSINESS.thankYou}</p>
            </div>
          </div>

          <div className="border-t border-[#e5b950] pt-4 text-center text-sm text-[#7b8177]">
            {INVOICE_BUSINESS.tagline}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="gold"
        size="lg"
        className="min-h-14 w-full"
        disabled={busy}
        onClick={() => void onSave()}
      >
        {busy ? "Saving PDF…" : "Save invoice & download PDF"}
      </Button>
    </div>
  );
}
