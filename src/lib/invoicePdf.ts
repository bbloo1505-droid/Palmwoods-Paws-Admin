import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  INVOICE_BUSINESS,
  formatAud,
  formatAuDate,
  formatInvoiceNumber,
  paymentReference,
} from "@/lib/invoiceBusiness";

const PAGE = { width: 595.3, height: 841.89 };
const MARGIN = 48;

const olive = rgb(0.294, 0.341, 0.259); // #4b5742
const oliveDark = rgb(0.169, 0.188, 0.149); // #2b3026
const gold = rgb(0.788, 0.635, 0.153); // #c9a227
const muted = rgb(0.42, 0.447, 0.396); // #6b7265
const line = rgb(0.91, 0.922, 0.894); // #e8ebe4
const cream = rgb(0.961, 0.945, 0.918); // #f5f1ea
const white = rgb(1, 1, 1);

export type InvoicePdfLine = {
  date: string; // yyyy-MM-dd
  description: string;
  amount: number;
};

export type InvoicePdfInput = {
  invoiceNumber: string | number;
  invoiceDate: string; // yyyy-MM-dd
  dueDate: string; // yyyy-MM-dd
  billTo: {
    name: string;
    address?: string | null;
    suburb?: string | null;
    phone?: string | null;
    email?: string | null;
    petName?: string | null;
  };
  lines: InvoicePdfLine[];
  note?: string | null;
};

function money(n: number) {
  return formatAud(n);
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = oliveDark,
) {
  page.drawText(text, { x, y, size, font, color });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const invoiceNo =
    typeof input.invoiceNumber === "number"
      ? formatInvoiceNumber(input.invoiceNumber)
      : input.invoiceNumber.replace(/^#/, "").padStart(3, "0");

  const total = input.lines.reduce((sum, l) => sum + l.amount, 0);
  const left = MARGIN;
  const right = PAGE.width - MARGIN;
  const contentWidth = right - left;

  // Soft cream header band
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 120,
    width: PAGE.width,
    height: 120,
    color: cream,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 122,
    width: PAGE.width,
    height: 3,
    color: gold,
  });

  let y = PAGE.height - 52;
  drawText(page, INVOICE_BUSINESS.tradingName.toUpperCase(), left, y, bold, 18, oliveDark);
  y -= 16;
  drawText(page, INVOICE_BUSINESS.tagline, left, y, regular, 9, muted);

  const invoiceLabel = "INVOICE";
  const invoiceLabelW = bold.widthOfTextAtSize(invoiceLabel, 22);
  drawText(page, invoiceLabel, right - invoiceLabelW, PAGE.height - 52, bold, 22, olive);

  // Meta block (right)
  y = PAGE.height - 150;
  const meta = [
    ["INVOICE #", invoiceNo],
    ["DATE", formatAuDate(input.invoiceDate)],
    ["DUE DATE", formatAuDate(input.dueDate)],
  ] as const;
  for (const [label, value] of meta) {
    drawText(page, label, right - 170, y, bold, 8, muted);
    drawText(page, value, right - 90, y, regular, 10, oliveDark);
    y -= 16;
  }

  // FROM / BILL TO
  y = PAGE.height - 150;
  drawText(page, "FROM", left, y, bold, 8, gold);
  y -= 14;
  drawText(page, INVOICE_BUSINESS.tradingName, left, y, bold, 11, oliveDark);
  y -= 13;
  drawText(page, INVOICE_BUSINESS.location, left, y, regular, 9, muted);
  y -= 12;
  drawText(page, `Phone: ${INVOICE_BUSINESS.phone}`, left, y, regular, 9, muted);
  y -= 12;
  drawText(page, `Email: ${INVOICE_BUSINESS.email}`, left, y, regular, 9, muted);
  y -= 12;
  drawText(page, `ABN: ${INVOICE_BUSINESS.abn}`, left, y, regular, 9, muted);

  const billX = left + contentWidth / 2 + 8;
  let by = PAGE.height - 150;
  drawText(page, "BILL TO", billX, by, bold, 8, gold);
  by -= 14;
  drawText(page, input.billTo.name, billX, by, bold, 11, oliveDark);
  by -= 13;
  const addressLine = [input.billTo.address, input.billTo.suburb].filter(Boolean).join(", ");
  if (addressLine) {
    for (const lineText of wrapText(addressLine, regular, 9, contentWidth / 2 - 16)) {
      drawText(page, lineText, billX, by, regular, 9, muted);
      by -= 12;
    }
  }
  const contactBits = [input.billTo.phone, input.billTo.email].filter(Boolean).join(" · ");
  if (contactBits) {
    for (const lineText of wrapText(contactBits, regular, 9, contentWidth / 2 - 16)) {
      drawText(page, lineText, billX, by, regular, 9, muted);
      by -= 12;
    }
  }
  if (input.billTo.petName) {
    drawText(page, `Pet: ${input.billTo.petName}`, billX, by, regular, 9, muted);
    by -= 12;
  }

  // Line items table
  y = Math.min(y, by) - 36;
  page.drawRectangle({
    x: left,
    y: y - 6,
    width: contentWidth,
    height: 22,
    color: olive,
  });
  drawText(page, "DATE", left + 10, y, bold, 8, white);
  drawText(page, "SERVICE PROVIDED", left + 100, y, bold, 8, white);
  const amountHeader = "AMOUNT";
  drawText(
    page,
    amountHeader,
    right - 10 - bold.widthOfTextAtSize(amountHeader, 8),
    y,
    bold,
    8,
    white,
  );

  y -= 28;
  for (const row of input.lines) {
    drawText(page, formatAuDate(row.date), left + 10, y, regular, 10, oliveDark);
    const descLines = wrapText(row.description, regular, 10, contentWidth - 200);
    descLines.forEach((dl, i) => {
      drawText(page, dl, left + 100, y - i * 12, regular, 10, oliveDark);
    });
    const amt = money(row.amount);
    drawText(
      page,
      amt,
      right - 10 - regular.widthOfTextAtSize(amt, 10),
      y,
      regular,
      10,
      oliveDark,
    );
    y -= Math.max(22, descLines.length * 12 + 10);
    page.drawLine({
      start: { x: left, y: y + 8 },
      end: { x: right, y: y + 8 },
      thickness: 0.6,
      color: line,
    });
  }

  if (input.note?.trim()) {
    y -= 8;
    drawText(page, "Note", left + 10, y, bold, 8, muted);
    y -= 12;
    for (const nl of wrapText(input.note.trim(), regular, 9, contentWidth - 20)) {
      drawText(page, nl, left + 10, y, regular, 9, muted);
      y -= 12;
    }
  }

  // Totals
  y -= 16;
  const subtotalLabel = "Subtotal";
  const totalLabel = "TOTAL";
  const sub = money(total);
  const tot = money(total);
  drawText(page, subtotalLabel, right - 160, y, regular, 10, muted);
  drawText(page, sub, right - 10 - regular.widthOfTextAtSize(sub, 10), y, regular, 10, oliveDark);
  y -= 22;
  page.drawRectangle({
    x: right - 180,
    y: y - 8,
    width: 180,
    height: 28,
    color: cream,
  });
  drawText(page, totalLabel, right - 170, y, bold, 11, oliveDark);
  drawText(page, tot, right - 10 - bold.widthOfTextAtSize(tot, 12), y, bold, 12, oliveDark);

  // Payment details
  y -= 56;
  drawText(page, "PAYMENT DETAILS", left, y, bold, 8, gold);
  y -= 16;
  drawText(page, `Bank: ${INVOICE_BUSINESS.bankName}`, left, y, regular, 10, oliveDark);
  y -= 13;
  drawText(page, `BSB: ${INVOICE_BUSINESS.bsb}`, left, y, regular, 10, oliveDark);
  y -= 13;
  drawText(
    page,
    `Account number: ${INVOICE_BUSINESS.accountNumber}`,
    left,
    y,
    regular,
    10,
    oliveDark,
  );

  y -= 28;
  drawText(page, "PAYMENT REFERENCE", left, y, bold, 8, gold);
  y -= 16;
  const ref = paymentReference(input.billTo.name, invoiceNo);
  drawText(page, ref, left, y, bold, 11, oliveDark);

  // Footer
  drawText(
    page,
    INVOICE_BUSINESS.thankYou,
    left,
    MARGIN + 24,
    regular,
    10,
    muted,
  );
  page.drawLine({
    start: { x: left, y: MARGIN + 40 },
    end: { x: right, y: MARGIN + 40 },
    thickness: 1,
    color: gold,
  });

  return doc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoicePdf(input: InvoicePdfInput, filename?: string) {
  const bytes = await buildInvoicePdf(input);
  const no =
    typeof input.invoiceNumber === "number"
      ? formatInvoiceNumber(input.invoiceNumber)
      : String(input.invoiceNumber).padStart(3, "0");
  downloadPdfBytes(bytes, filename ?? `Palmwoods-Paws-Invoice-${no}.pdf`);
}
