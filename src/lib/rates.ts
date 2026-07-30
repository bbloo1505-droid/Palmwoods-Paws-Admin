/** Anna’s standard rate card (matches palmwoodspaws.com pricing). */

export type InvoiceServiceKey =
  | "walk_regular"
  | "walk_casual"
  | "pet_feeding"
  | "pet_visit"
  | "pet_minding"
  | "custom";

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
  {
    key: "custom",
    label: "Custom line",
    options: [{ key: "30", label: "Custom amount", price: 0 }],
  },
];

export type InvoiceLineSnapshot = {
  date: string; // yyyy-MM-dd
  description: string;
  amount: number;
  petName?: string | null;
};

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

export function describeInvoiceLine(input: {
  serviceKey: InvoiceServiceKey;
  durationKey: DurationKey;
  petName?: string | null;
  extraPets?: number;
  customDescription?: string | null;
}) {
  if (input.serviceKey === "custom") {
    const custom = input.customDescription?.trim() || "Custom service";
    return input.petName ? `${custom} (${input.petName})` : custom;
  }
  const quote = suggestInvoiceAmount({
    serviceKey: input.serviceKey,
    durationKey: input.durationKey,
    extraPets: input.serviceKey === "pet_minding" ? input.extraPets : 0,
  });
  return [
    `${quote.serviceLabel} · ${quote.durationLabel}`,
    input.petName ? `(${input.petName})` : null,
    input.serviceKey === "pet_minding" && (input.extraPets ?? 0) > 0
      ? `+ ${input.extraPets} extra pet${input.extraPets === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildInvoiceNotes(input: {
  invoiceNumber: string;
  invoiceDateIso: string;
  lines: InvoiceLineSnapshot[];
  freeNote?: string | null;
}) {
  const petNames = [...new Set(input.lines.map((l) => l.petName).filter(Boolean))];
  const total = input.lines.reduce((sum, l) => sum + l.amount, 0);
  const firstDate = input.lines[0]?.date ?? input.invoiceDateIso;

  const body = [
    `Invoice #${input.invoiceNumber}`,
    `Invoice date: ${input.invoiceDateIso}`,
    `Service date: ${firstDate}`,
    `LINES_JSON:${JSON.stringify(input.lines)}`,
    ...input.lines.map((l) => `${l.date} · ${l.description} · $${l.amount}`),
    petNames.length === 1 ? `Pet: ${petNames[0]}` : null,
    petNames.length > 1 ? `Pets: ${petNames.join(", ")}` : null,
    `Rate: $${total}`,
    input.freeNote?.trim() ? input.freeNote.trim() : null,
  ].filter(Boolean);

  return body.join("\n");
}

/** Rebuild PDF fields from stored invoice notes when possible. */
export function parseInvoiceNotes(notes: string | null | undefined) {
  const text = notes ?? "";
  const invoiceNumber = text.match(/Invoice #(\d+)/i)?.[1] ?? null;
  const invoiceDateIso = text.match(/Invoice date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const serviceDateIso = text.match(/Service date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const petName =
    text.match(/^Pets?:\s*(.+)$/im)?.[1]?.trim() ??
    text.match(/^Pet:\s*(.+)$/im)?.[1]?.trim() ??
    null;

  let lines: InvoiceLineSnapshot[] = [];
  const jsonMatch = text.match(/LINES_JSON:(\[[\s\S]*?\])(?:\n|$)/);
  if (jsonMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as InvoiceLineSnapshot[];
      if (Array.isArray(parsed)) lines = parsed.filter((l) => l && l.description);
    } catch {
      lines = [];
    }
  }

  if (!lines.length) {
    const legacy =
      text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.includes("·") && !l.startsWith("Invoice") && !l.startsWith("Rate:")) ?? null;
    if (legacy) {
      lines = [
        {
          date: serviceDateIso || invoiceDateIso || formatTodayIso(),
          description: legacy.includes(" · $")
            ? legacy.replace(/\s·\s\$[\d.]+$/, "").replace(/^\d{4}-\d{2}-\d{2}\s·\s/, "")
            : legacy,
          amount: Number(text.match(/Rate:\s*\$?([\d.]+)/i)?.[1] ?? 0),
        },
      ];
    }
  }

  const freeNoteLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^Invoice #/i.test(l) &&
        !/^Invoice date:/i.test(l) &&
        !/^Service date:/i.test(l) &&
        !/^Pets?:/i.test(l) &&
        !/^Date:/i.test(l) &&
        !/^Extra pets:/i.test(l) &&
        !/^Rate:/i.test(l) &&
        !/^PDF_PATH:/i.test(l) &&
        !/^LINES_JSON:/i.test(l) &&
        !/^\d{4}-\d{2}-\d{2}\s·/.test(l) &&
        !l.includes("·"),
    );

  return {
    invoiceNumber,
    invoiceDateIso,
    serviceDateIso,
    petName,
    serviceDescription: lines[0]?.description ?? null,
    lines,
    freeNote: freeNoteLines.join("\n") || null,
    pdfPath: text.match(/PDF_PATH:(\S+)/i)?.[1] ?? null,
  };
}

function formatTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
