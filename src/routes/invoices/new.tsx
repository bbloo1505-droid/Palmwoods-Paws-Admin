import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button, Card, Field, PageHeader, inputClassName } from "@/components/ui";
import { createInvoice, getPet, listClients, listPets, nextInvoiceNumber } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatInvoiceNumber } from "@/lib/invoiceBusiness";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import {
  INVOICE_SERVICES,
  buildInvoiceNotes,
  getServiceRate,
  suggestInvoiceAmount,
  type DurationKey,
  type InvoiceServiceKey,
} from "@/lib/rates";
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

type Step = "details" | "review";

function NewInvoicePage() {
  const { ownerId } = useAuth();
  const navigate = useNavigate();
  const { clientId: presetClientId, petId: presetPetId } = Route.useSearch();

  const [step, setStep] = useState<Step>("details");
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSeq, setInvoiceSeq] = useState(1);

  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [petId, setPetId] = useState(presetPetId ?? "");
  const [serviceKey, setServiceKey] = useState<InvoiceServiceKey>("walk_regular");
  const [durationKey, setDurationKey] = useState<DurationKey>("30");
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [extraPets, setExtraPets] = useState(0);
  const [override, setOverride] = useState(false);
  const [amount, setAmount] = useState("28");
  const [freeNote, setFreeNote] = useState("");

  const service = getServiceRate(serviceKey);
  const invoiceNumber = formatInvoiceNumber(invoiceSeq);
  const quote = useMemo(
    () =>
      suggestInvoiceAmount({
        serviceKey,
        durationKey,
        extraPets: serviceKey === "pet_minding" ? extraPets : 0,
      }),
    [serviceKey, durationKey, extraPets],
  );

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
            setPetId(pet.id);
            setClientId(pet.client_id);
            const clientPets = await listPets(pet.client_id);
            setPets(clientPets);
            return;
          } catch {
            /* fall through */
          }
        }

        if (nextClientId) {
          const clientPets = await listPets(nextClientId);
          setPets(clientPets);
          if (!presetPetId) setPetId(clientPets[0]?.id ?? "");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [presetClientId, presetPetId]);

  // Keep amount in sync with rate card unless overridden.
  useEffect(() => {
    if (!override) setAmount(String(quote.standardTotal));
  }, [quote.standardTotal, override]);

  // When service changes, reset duration to first option for that service.
  useEffect(() => {
    const first = getServiceRate(serviceKey).options[0]?.key ?? "30";
    setDurationKey(first);
    setExtraPets(0);
  }, [serviceKey]);

  const onClientChange = async (id: string) => {
    setClientId(id);
    setPetId("");
    try {
      const clientPets = await listPets(id);
      setPets(clientPets);
      setPetId(clientPets[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pets");
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const selectedPet = pets.find((p) => p.id === petId) ?? null;
  const finalAmount = Number(amount);
  const overridden = override && finalAmount !== quote.standardTotal;
  const dateLabel = serviceDate
    ? format(new Date(`${serviceDate}T12:00:00`), "EEEE d MMMM yyyy")
    : "—";

  const serviceDescription = [
    `${quote.serviceLabel} · ${quote.durationLabel}`,
    selectedPet?.name ? `(${selectedPet.name})` : null,
    serviceKey === "pet_minding" && extraPets > 0
      ? `+ ${extraPets} extra pet${extraPets === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

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
        petName: selectedPet?.name ?? null,
      },
      lines: [
        {
          date: serviceDate,
          description: serviceDescription,
          amount: finalAmount,
        },
      ],
      note: freeNote.trim() || null,
    };
  };

  const goReview = () => {
    setError(null);
    if (!clientId) {
      setError("Pick a client.");
      return;
    }
    if (!Number.isFinite(finalAmount) || finalAmount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!invoiceDate || !dueDate || !serviceDate) {
      setError("Invoice date, due date, and service date are required.");
      return;
    }
    setStep("review");
  };

  const onPreviewPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadInvoicePdf(pdfInput());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build PDF");
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
        serviceLabel: quote.serviceLabel,
        durationLabel: quote.durationLabel,
        petName: selectedPet?.name,
        serviceDate: dateLabel,
        serviceDateIso: serviceDate,
        invoiceDateIso: invoiceDate,
        standardTotal: quote.standardTotal,
        finalAmount,
        overridden,
        extraPets: serviceKey === "pet_minding" ? extraPets : 0,
        extraTotal: quote.extraTotal,
        freeNote,
      });
      await createInvoice(ownerId, {
        client_id: clientId,
        amount: finalAmount,
        due_on: dueDate,
        notes,
      });
      await downloadInvoicePdf(pdfInput());
      void navigate({ to: "/invoices" });
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
            ? "Fill Anna’s invoice template for this client — review, then save & download PDF."
            : "Is this correct? Creating saves it and downloads the PDF."
        }
        action={
          <Link to="/invoices">
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </Link>
        }
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {step === "details" ? (
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

          <Field label="Pet (optional)">
            <select
              className={inputClassName()}
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              disabled={!clientId || pets.length === 0}
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
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value as InvoiceServiceKey)}
            >
              {INVOICE_SERVICES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Time / package">
            <div className="grid grid-cols-2 gap-2">
              {service.options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDurationKey(opt.key)}
                  className={cn(
                    "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                    durationKey === opt.key
                      ? "border-olive-800 bg-olive-800 text-warm-white"
                      : "border-olive-100 bg-cream text-olive-950",
                  )}
                >
                  <span className="block">{opt.label}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      durationKey === opt.key ? "text-gold" : "text-muted",
                    )}
                  >
                    {formatMoney(opt.price)}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {serviceKey === "pet_minding" ? (
            <Field label="Extra pets (+$10 each)">
              <input
                className={inputClassName()}
                type="number"
                min={0}
                max={10}
                value={extraPets}
                onChange={(e) => setExtraPets(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Service date">
              <input
                className={inputClassName()}
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
              />
            </Field>
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

          <div className="space-y-2 rounded-2xl border border-olive-100 bg-cream/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-olive-950">Price</p>
              <label className="flex items-center gap-2 text-sm font-medium text-olive-900">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => {
                    setOverride(e.target.checked);
                    if (!e.target.checked) setAmount(String(quote.standardTotal));
                  }}
                />
                Price override
              </label>
            </div>
            <p className="text-sm text-muted">
              Standard: {formatMoney(quote.standardTotal)}
              {quote.extraTotal > 0
                ? ` (${formatMoney(quote.base)} + ${formatMoney(quote.extraTotal)} extras)`
                : ""}
            </p>
            <Field label="Amount ($)">
              <input
                className={inputClassName()}
                type="number"
                min={0}
                step="1"
                required
                disabled={!override}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Extra note (optional)">
            <textarea
              className={inputClassName("min-h-20")}
              value={freeNote}
              onChange={(e) => setFreeNote(e.target.value)}
              placeholder="Anything else for the invoice…"
            />
          </Field>

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
      ) : (
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
              label="Bill to"
              value={
                [
                  selectedClient?.address,
                  selectedClient?.suburb,
                  selectedClient?.phone,
                  selectedClient?.email,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Add address/phone on client profile"
              }
            />
            <OverviewRow label="Pet" value={selectedPet?.name ?? "—"} />
            <OverviewRow label="Service" value={quote.serviceLabel} />
            <OverviewRow label="Time" value={quote.durationLabel} />
            <OverviewRow label="Service date" value={dateLabel} />
            <OverviewRow
              label="Invoice date"
              value={format(new Date(`${invoiceDate}T12:00:00`), "d MMM yyyy")}
            />
            <OverviewRow
              label="Due date"
              value={format(new Date(`${dueDate}T12:00:00`), "d MMM yyyy")}
            />
            {serviceKey === "pet_minding" && extraPets > 0 ? (
              <OverviewRow
                label="Extra pets"
                value={`${extraPets} × ${formatMoney(quote.extraPetPrice)} = ${formatMoney(quote.extraTotal)}`}
              />
            ) : null}
            <OverviewRow label="Standard rate" value={formatMoney(quote.standardTotal)} />
            <div className="rounded-xl border border-olive-100 bg-olive-800 px-4 py-3 text-warm-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                Amount on invoice
              </p>
              <p className="mt-1 font-display text-3xl">{formatMoney(finalAmount)}</p>
              {overridden ? (
                <p className="mt-1 text-sm text-warm-white/80">
                  Override · standard was {formatMoney(quote.standardTotal)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-warm-white/80">Standard rate</p>
              )}
            </div>
            {freeNote.trim() ? <OverviewRow label="Note" value={freeNote.trim()} /> : null}
          </dl>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full"
              disabled={busy}
              onClick={() => void onPreviewPdf()}
            >
              Preview PDF
            </Button>
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
                {busy ? "Creating…" : "Create & download PDF"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
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
