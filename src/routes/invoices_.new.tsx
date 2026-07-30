import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, format } from "date-fns";
import { Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import {
  createInvoice,
  downloadStoredInvoicePdf,
  getPet,
  listClients,
  listPets,
  nextInvoiceNumber,
  saveInvoicePdfFile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatInvoiceNumber } from "@/lib/invoiceBusiness";
import { buildInvoicePdf, downloadInvoicePdf, downloadPdfBytes } from "@/lib/invoicePdf";
import {
  INVOICE_SERVICES,
  buildInvoiceNotes,
  describeInvoiceLine,
  getServiceRate,
  suggestInvoiceAmount,
  type DurationKey,
  type InvoiceLineSnapshot,
  type InvoiceServiceKey,
} from "@/lib/rates";
import type { Client, Pet } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const searchSchema = z.object({
  clientId: z.string().optional(),
  petId: z.string().optional(),
});

export const Route = createFileRoute("/invoices_/new")({
  validateSearch: searchSchema,
  component: NewInvoicePage,
});

type Step = "details" | "review" | "done";

type LineDraft = {
  id: string;
  petId: string;
  serviceKey: InvoiceServiceKey;
  durationKey: DurationKey;
  serviceDate: string;
  extraPets: number;
  override: boolean;
  amount: string;
  customDescription: string;
};

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function newLineId() {
  return crypto.randomUUID();
}

function makeLine(partial?: Partial<LineDraft>): LineDraft {
  const serviceKey = partial?.serviceKey ?? "walk_regular";
  const durationKey =
    partial?.durationKey ?? getServiceRate(serviceKey).options[0]?.key ?? "30";
  const quote = suggestInvoiceAmount({
    serviceKey,
    durationKey,
    extraPets: serviceKey === "pet_minding" ? partial?.extraPets ?? 0 : 0,
  });
  return {
    id: partial?.id ?? newLineId(),
    petId: partial?.petId ?? "",
    serviceKey,
    durationKey,
    serviceDate: partial?.serviceDate ?? todayIso(),
    extraPets: partial?.extraPets ?? 0,
    override: partial?.override ?? false,
    amount: partial?.amount ?? String(quote.standardTotal),
    customDescription: partial?.customDescription ?? "",
  };
}

function NewInvoicePage() {
  const { ownerId } = useAuth();
  const { clientId: presetClientId, petId: presetPetId } = Route.useSearch();

  const [step, setStep] = useState<Step>("details");
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSeq, setInvoiceSeq] = useState(1);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [savedPdfBytes, setSavedPdfBytes] = useState<Uint8Array | null>(null);

  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [freeNote, setFreeNote] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([makeLine({ petId: presetPetId ?? "" })]);

  const invoiceNumber = formatInvoiceNumber(invoiceSeq);

  useEffect(() => {
    nextInvoiceNumber()
      .then(setInvoiceSeq)
      .catch(() => setInvoiceSeq(1));

    listClients()
      .then(async (c) => {
        setClients(c);
        let nextClientId = presetClientId ?? "";
        if (!nextClientId && c[0]) nextClientId = c[0].id;
        setClientId(nextClientId);

        if (presetPetId) {
          try {
            const pet = await getPet(presetPetId);
            setClientId(pet.client_id);
            const clientPets = await listPets(pet.client_id);
            setPets(clientPets);
            setLines((prev) =>
              prev.map((line, i) => (i === 0 ? { ...line, petId: pet.id } : line)),
            );
            return;
          } catch {
            /* fall through */
          }
        }

        if (nextClientId) {
          const clientPets = await listPets(nextClientId);
          setPets(clientPets);
          const firstPet = clientPets[0]?.id ?? "";
          setLines((prev) =>
            prev.map((line, i) => (i === 0 && !line.petId ? { ...line, petId: firstPet } : line)),
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [presetClientId, presetPetId]);

  const onClientChange = async (id: string) => {
    setClientId(id);
    try {
      const clientPets = await listPets(id);
      setPets(clientPets);
      const firstPet = clientPets[0]?.id ?? "";
      setLines((prev) => prev.map((line) => ({ ...line, petId: firstPet })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pets");
    }
  };

  const updateLine = (id: string, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };

        if (patch.serviceKey && patch.serviceKey !== line.serviceKey) {
          const first = getServiceRate(patch.serviceKey).options[0]?.key ?? "30";
          next.durationKey = first;
          next.extraPets = 0;
          next.override = false;
          if (patch.serviceKey === "custom") {
            next.amount = next.amount || "0";
          } else {
            const quote = suggestInvoiceAmount({
              serviceKey: patch.serviceKey,
              durationKey: first,
              extraPets: 0,
            });
            next.amount = String(quote.standardTotal);
          }
        }

        if (patch.durationKey && !next.override && next.serviceKey !== "custom") {
          const quote = suggestInvoiceAmount({
            serviceKey: next.serviceKey,
            durationKey: patch.durationKey,
            extraPets: next.serviceKey === "pet_minding" ? next.extraPets : 0,
          });
          next.amount = String(quote.standardTotal);
        }

        if (patch.extraPets != null && !next.override && next.serviceKey === "pet_minding") {
          const quote = suggestInvoiceAmount({
            serviceKey: next.serviceKey,
            durationKey: next.durationKey,
            extraPets: patch.extraPets,
          });
          next.amount = String(quote.standardTotal);
        }

        if (patch.override === false && next.serviceKey !== "custom") {
          const quote = suggestInvoiceAmount({
            serviceKey: next.serviceKey,
            durationKey: next.durationKey,
            extraPets: next.serviceKey === "pet_minding" ? next.extraPets : 0,
          });
          next.amount = String(quote.standardTotal);
        }

        return next;
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      makeLine({
        petId: prev[prev.length - 1]?.petId || pets[0]?.id || "",
        serviceDate: prev[prev.length - 1]?.serviceDate || todayIso(),
      }),
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const resolvedLines: InvoiceLineSnapshot[] = useMemo(() => {
    return lines.map((line) => {
      const pet = pets.find((p) => p.id === line.petId);
      const amount = Number(line.amount);
      return {
        date: line.serviceDate,
        description: describeInvoiceLine({
          serviceKey: line.serviceKey,
          durationKey: line.durationKey,
          petName: pet?.name,
          extraPets: line.extraPets,
          customDescription: line.customDescription,
        }),
        amount: Number.isFinite(amount) ? amount : 0,
        petName: pet?.name ?? null,
      };
    });
  }, [lines, pets]);

  const totalAmount = resolvedLines.reduce((sum, l) => sum + l.amount, 0);
  const petNamesOnInvoice = [...new Set(resolvedLines.map((l) => l.petName).filter(Boolean))];

  const pdfInput = () => {
    if (!selectedClient) throw new Error("Pick a client.");
    return {
      invoiceNumber,
      invoiceDate,
      dueDate,
      billTo: {
        name: selectedClient.name,
        address: selectedClient.address,
        suburb: selectedClient.suburb,
        phone: selectedClient.phone,
        email: selectedClient.email,
        petName:
          petNamesOnInvoice.length === 0
            ? null
            : petNamesOnInvoice.length === 1
              ? petNamesOnInvoice[0]
              : petNamesOnInvoice.join(", "),
      },
      lines: resolvedLines.map(({ date, description, amount }) => ({
        date,
        description,
        amount,
      })),
      note: freeNote.trim() || null,
    };
  };

  const goReview = () => {
    setError(null);
    if (!clientId) {
      setError("Pick a client.");
      return;
    }
    if (!invoiceDate || !dueDate) {
      setError("Invoice date and due date are required.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one service line.");
      return;
    }
    for (const [i, line] of lines.entries()) {
      if (!line.serviceDate) {
        setError(`Line ${i + 1}: pick a service date.`);
        return;
      }
      if (line.serviceKey === "custom" && !line.customDescription.trim()) {
        setError(`Line ${i + 1}: enter a description for the custom item.`);
        return;
      }
      const amount = Number(line.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        setError(`Line ${i + 1}: enter a valid amount.`);
        return;
      }
    }
    setStep("review");
  };

  const onDownloadSaved = async () => {
    setBusy(true);
    setError(null);
    try {
      const filename = `Palmwoods-Paws-Invoice-${invoiceNumber}.pdf`;
      if (savedPdfBytes) {
        downloadPdfBytes(savedPdfBytes, filename);
      } else if (savedPdfPath) {
        await downloadStoredInvoicePdf(savedPdfPath, filename);
      } else {
        await downloadInvoicePdf(pdfInput(), filename);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    if (!ownerId || !clientId || !selectedClient) return;
    setBusy(true);
    setError(null);
    try {
      const notes = buildInvoiceNotes({
        invoiceNumber,
        invoiceDateIso: invoiceDate,
        lines: resolvedLines,
        freeNote,
      });

      const invoice = await createInvoice(ownerId, {
        client_id: clientId,
        amount: totalAmount,
        due_on: dueDate,
        notes,
      });

      const pdfBytes = await buildInvoicePdf(pdfInput());
      setSavedPdfBytes(pdfBytes);

      try {
        const saved = await saveInvoicePdfFile({
          ownerId,
          invoiceId: invoice.id,
          invoiceNumber,
          pdfBytes,
        });
        setSavedPdfPath(saved.path ?? null);
      } catch (saveErr) {
        console.warn("Cloud PDF save failed:", saveErr);
      }

      downloadPdfBytes(pdfBytes, `Palmwoods-Paws-Invoice-${invoiceNumber}.pdf`);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title="Create invoice"
        subtitle={
          step === "details"
            ? "Add one or more services — walks, visits, different dogs, anything for the week."
            : step === "review"
              ? "Check the lines, then save — the PDF downloads automatically."
              : "Invoice saved. Download the PDF anytime."
        }
        action={
          step !== "done" ? (
            <Link to="/invoices">
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </Link>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {step === "details" ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="rounded-xl border border-olive-100 bg-cream/70 px-3 py-2 text-sm">
              <span className="text-muted">Invoice #</span>{" "}
              <span className="font-semibold text-olive-950">{invoiceNumber}</span>
            </div>

            <Field label="Client">
              <select
                className={inputClassName()}
                required
                value={clientId}
                onChange={(e) => void onClientChange(e.target.value)}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice date">
                <input
                  className={inputClassName()}
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </Field>
              <Field label="Due date">
                <input
                  className={inputClassName()}
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          {lines.map((line, index) => (
            <LineEditor
              key={line.id}
              index={index}
              line={line}
              pets={pets}
              canRemove={lines.length > 1}
              onChange={(patch) => updateLine(line.id, patch)}
              onRemove={() => removeLine(line.id)}
            />
          ))}

          <Button
            type="button"
            variant="secondary"
            className="min-h-12 w-full"
            onClick={addLine}
          >
            <Plus className="h-4 w-4" />
            Add another service
          </Button>

          <Card className="space-y-4 p-5">
            <Field label="Extra note (optional)">
              <textarea
                className={inputClassName("min-h-20")}
                value={freeNote}
                onChange={(e) => setFreeNote(e.target.value)}
                placeholder="Anything else for the invoice…"
              />
            </Field>

            <div className="rounded-xl border border-olive-100 bg-olive-800 px-4 py-3 text-warm-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                Invoice total ({lines.length} line{lines.length === 1 ? "" : "s"})
              </p>
              <p className="mt-1 font-display text-3xl">{formatMoney(totalAmount)}</p>
            </div>

            <Button
              type="button"
              variant="gold"
              size="lg"
              className="min-h-14 w-full"
              onClick={goReview}
            >
              Continue → Review
            </Button>
          </Card>
        </div>
      ) : null}

      {step === "review" ? (
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dark">
              Is this correct?
            </p>
            <h2 className="mt-1 font-display text-2xl text-olive-950">Invoice overview</h2>
          </div>

          <dl className="space-y-3 text-sm">
            <OverviewRow label="Invoice #" value={invoiceNumber} />
            <OverviewRow label="Client" value={selectedClient?.name ?? "—"} />
            <OverviewRow
              label="Due date"
              value={format(new Date(`${dueDate}T12:00:00`), "d MMM yyyy")}
            />
          </dl>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Services
            </p>
            {resolvedLines.map((line, i) => (
              <div
                key={`${line.date}-${line.description}-${i}`}
                className="flex items-start justify-between gap-3 border-b border-olive-100/80 pb-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-olive-950">{line.description}</p>
                  <p className="text-muted">
                    {format(new Date(`${line.date}T12:00:00`), "EEE d MMM yyyy")}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-olive-950">{formatMoney(line.amount)}</p>
              </div>
            ))}
          </div>

          {freeNote.trim() ? (
            <p className="text-sm text-muted">
              <span className="font-semibold text-olive-950">Note: </span>
              {freeNote.trim()}
            </p>
          ) : null}

          <div className="rounded-xl border border-olive-100 bg-olive-800 px-4 py-3 text-warm-white">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Total</p>
            <p className="mt-1 font-display text-3xl">{formatMoney(totalAmount)}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 flex-1"
              disabled={busy}
              onClick={() => setStep("details")}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="gold"
              className="min-h-12 flex-1"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              {busy ? "Saving PDF…" : "Save invoice & download PDF"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card className="space-y-4 p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dark">
            Saved
          </p>
          <h2 className="font-display text-2xl text-olive-950">
            Invoice #{invoiceNumber} is ready
          </h2>
          <p className="text-sm text-muted">
            {resolvedLines.length} service line{resolvedLines.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(totalAmount)}. Download now, or again later from Invoices.
          </p>
          <Button
            type="button"
            variant="gold"
            size="lg"
            className="min-h-14 w-full"
            disabled={busy}
            onClick={() => void onDownloadSaved()}
          >
            <Download className="h-4 w-4" />
            {busy ? "Preparing…" : "Download PDF"}
          </Button>
          <Link to="/invoices" className="block">
            <Button type="button" variant="secondary" className="min-h-12 w-full">
              Back to invoices
            </Button>
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function LineEditor({
  index,
  line,
  pets,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  line: LineDraft;
  pets: Pet[];
  canRemove: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  const service = getServiceRate(line.serviceKey);
  const quote = suggestInvoiceAmount({
    serviceKey: line.serviceKey,
    durationKey: line.durationKey,
    extraPets: line.serviceKey === "pet_minding" ? line.extraPets : 0,
  });
  const isCustom = line.serviceKey === "custom";

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dark">
          Service {index + 1}
        </p>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </div>

      <Field label="Pet (optional)">
        <select
          className={inputClassName()}
          value={line.petId}
          onChange={(e) => onChange({ petId: e.target.value })}
          disabled={pets.length === 0}
        >
          <option value="">No specific pet</option>
          {pets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Service">
        <select
          className={inputClassName()}
          value={line.serviceKey}
          onChange={(e) => onChange({ serviceKey: e.target.value as InvoiceServiceKey })}
        >
          {INVOICE_SERVICES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {isCustom ? (
        <Field label="Description">
          <input
            className={inputClassName()}
            value={line.customDescription}
            onChange={(e) => onChange({ customDescription: e.target.value })}
            placeholder="e.g. Weekend minding top-up, second dog walk…"
          />
        </Field>
      ) : (
        <Field label="Time / package">
          <div className="grid grid-cols-2 gap-2">
            {service.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange({ durationKey: opt.key })}
                className={cn(
                  "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                  line.durationKey === opt.key
                    ? "border-olive-800 bg-olive-800 text-warm-white"
                    : "border-olive-100 bg-cream text-olive-950",
                )}
              >
                <span className="block">{opt.label}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    line.durationKey === opt.key ? "text-gold" : "text-muted",
                  )}
                >
                  {formatMoney(opt.price)}
                </span>
              </button>
            ))}
          </div>
        </Field>
      )}

      {line.serviceKey === "pet_minding" ? (
        <Field label="Extra pets (+$10 each)">
          <input
            className={inputClassName()}
            type="number"
            min={0}
            max={10}
            value={line.extraPets}
            onChange={(e) => onChange({ extraPets: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
      ) : null}

      <Field label="Service date">
        <input
          className={inputClassName()}
          type="date"
          required
          value={line.serviceDate}
          onChange={(e) => onChange({ serviceDate: e.target.value })}
        />
      </Field>

      <div className="space-y-2 rounded-2xl border border-olive-100 bg-cream/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-olive-950">Amount</p>
          {!isCustom ? (
            <label className="flex items-center gap-2 text-sm font-medium text-olive-900">
              <input
                type="checkbox"
                checked={line.override}
                onChange={(e) => onChange({ override: e.target.checked })}
              />
              Override
            </label>
          ) : null}
        </div>
        {!isCustom ? (
          <p className="text-sm text-muted">
            Standard: {formatMoney(quote.standardTotal)}
            {quote.extraTotal > 0
              ? ` (${formatMoney(quote.base)} + ${formatMoney(quote.extraTotal)} extras)`
              : ""}
          </p>
        ) : null}
        <Field label="Amount ($)">
          <input
            className={inputClassName()}
            type="number"
            min={0}
            step="1"
            required
            disabled={!isCustom && !line.override}
            value={line.amount}
            onChange={(e) => onChange({ amount: e.target.value, override: true })}
          />
        </Field>
      </div>
    </Card>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-olive-100/80 pb-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold text-olive-950">{value}</dd>
    </div>
  );
}
