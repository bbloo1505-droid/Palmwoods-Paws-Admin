/** Anna’s standard rate card (matches palmwoodspaws.com pricing). */

export type InvoiceServiceKey =
  | "walk_regular"
  | "walk_casual"
  | "pet_feeding"
  | "pet_visit"
  | "pet_minding";

export type DurationKey = "30" | "60" | "half_day" | "full_day";

export type RateOption = {
  key: DurationKey;
  label: string;
  price: number;
};

export type ServiceRate = {
  key: InvoiceServiceKey;
  label: string;
  options: RateOption[];
  /** Extra charge per additional pet (minding). */
  extraPetPrice?: number;
};

export const INVOICE_SERVICES: ServiceRate[] = [
  {
    key: "walk_regular",
    label: "Regular weekly dog walk",
    options: [
      { key: "30", label: "30 minutes", price: 28 },
      { key: "60", label: "60 minutes", price: 48 },
    ],
  },
  {
    key: "walk_casual",
    label: "Casual dog walk",
    options: [
      { key: "30", label: "30 minutes", price: 30 },
      { key: "60", label: "60 minutes", price: 50 },
    ],
  },
  {
    key: "pet_feeding",
    label: "Pet feeding & cuddles",
    options: [
      { key: "30", label: "30 minutes", price: 25 },
      { key: "60", label: "60 minutes", price: 40 },
    ],
  },
  {
    key: "pet_visit",
    label: "Pet visit",
    options: [
      { key: "30", label: "30 minutes", price: 25 },
      { key: "60", label: "60 minutes", price: 40 },
    ],
  },
  {
    key: "pet_minding",
    label: "Pet minding",
    options: [
      { key: "half_day", label: "Half-day (4 hours)", price: 50 },
      { key: "full_day", label: "Full day (8 hours)", price: 70 },
    ],
    extraPetPrice: 10,
  },
];

export function getServiceRate(key: InvoiceServiceKey) {
  return INVOICE_SERVICES.find((s) => s.key === key) ?? INVOICE_SERVICES[0];
}

export function getDurationOption(serviceKey: InvoiceServiceKey, durationKey: DurationKey) {
  const service = getServiceRate(serviceKey);
  return service.options.find((o) => o.key === durationKey) ?? service.options[0];
}

export function suggestInvoiceAmount(input: {
  serviceKey: InvoiceServiceKey;
  durationKey: DurationKey;
  extraPets?: number;
}) {
  const service = getServiceRate(input.serviceKey);
  const option = getDurationOption(input.serviceKey, input.durationKey);
  const extras = Math.max(0, input.extraPets ?? 0);
  const extraTotal = (service.extraPetPrice ?? 0) * extras;
  const base = option.price;
  return {
    base,
    extraPets: extras,
    extraPetPrice: service.extraPetPrice ?? 0,
    extraTotal,
    standardTotal: base + extraTotal,
    serviceLabel: service.label,
    durationLabel: option.label,
  };
}

export function buildInvoiceNotes(input: {
  invoiceNumber: string;
  serviceLabel: string;
  durationLabel: string;
  petName?: string | null;
  serviceDate: string;
  serviceDateIso: string;
  invoiceDateIso: string;
  standardTotal: number;
  finalAmount: number;
  overridden: boolean;
  extraPets?: number;
  extraTotal?: number;
  freeNote?: string | null;
}) {
  const lines = [
    `Invoice #${input.invoiceNumber}`,
    `Invoice date: ${input.invoiceDateIso}`,
    `Service date: ${input.serviceDateIso}`,
    `${input.serviceLabel} · ${input.durationLabel}`,
    input.petName ? `Pet: ${input.petName}` : null,
    `Date: ${input.serviceDate}`,
    input.extraPets && input.extraPets > 0
      ? `Extra pets: ${input.extraPets} (+$${input.extraTotal ?? 0})`
      : null,
    input.overridden
      ? `Rate: $${input.finalAmount} override (standard $${input.standardTotal})`
      : `Rate: $${input.standardTotal} standard`,
    input.freeNote?.trim() ? input.freeNote.trim() : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/** Rebuild PDF fields from stored invoice notes when possible. */
export function parseInvoiceNotes(notes: string | null | undefined) {
  const text = notes ?? "";
  const invoiceNumber = text.match(/Invoice #(\d+)/i)?.[1] ?? null;
  const invoiceDateIso = text.match(/Invoice date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const serviceDateIso = text.match(/Service date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const petName = text.match(/^Pet:\s*(.+)$/im)?.[1]?.trim() ?? null;
  const serviceLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.includes("·") && !l.startsWith("Invoice") && !l.startsWith("Rate:")) ?? null;
  const freeNoteLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^Invoice #/i.test(l) &&
        !/^Invoice date:/i.test(l) &&
        !/^Service date:/i.test(l) &&
        !/^Pet:/i.test(l) &&
        !/^Date:/i.test(l) &&
        !/^Extra pets:/i.test(l) &&
        !/^Rate:/i.test(l) &&
        !l.includes("·"),
    );
  return {
    invoiceNumber,
    invoiceDateIso,
    serviceDateIso,
    petName,
    serviceDescription: serviceLine,
    freeNote: freeNoteLines.join("\n") || null,
  };
}
