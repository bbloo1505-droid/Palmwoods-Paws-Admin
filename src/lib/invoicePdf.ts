import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import {
  INVOICE_BUSINESS,
  formatAud,
  formatAuDate,
  formatInvoiceNumber,
  paymentReference,
} from "@/lib/invoiceBusiness";

/** A4 — matches the Final Word template page. */
const PAGE = { width: 595.3, height: 841.89 };
const MARGIN = 44;

/** Colours taken from Palmwoods_Paws_Invoice_Template_Final.docx */
const ink = rgb(0x26 / 255, 0x31 / 255, 0x26 / 255); // #263126
const olive = rgb(0x5d / 255, 0x69 / 255, 0x50 / 255); // #5D6950
const oliveMid = rgb(0x46 / 255, 0x51 / 255, 0x3d / 255); // #46513D
const gold = rgb(0xe5 / 255, 0xb9 / 255, 0x50 / 255); // #E5B950
const muted = rgb(0x66 / 255, 0x70 / 255, 0x63 / 255); // #667063
const softMuted = rgb(0x7b / 255, 0x81 / 255, 0x77 / 255); // #7B8177
const cream = rgb(0xf6 / 255, 0xf2 / 255, 0xe8 / 255); // #F6F2E8
const creamSoft = rgb(0xfb / 255, 0xfa / 255, 0xf6 / 255); // #FBFAF6
const rowTint = rgb(0xe8 / 255, 0xeb / 255, 0xdd / 255); // #E8EBDD
const white = rgb(1, 1, 1);
const rule = rgb(0.9, 0.9, 0.88);

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
  color = ink,
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

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const res = await fetch(INVOICE_BUSINESS.logoPath);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Times-Roman stands in for Georgia (serif display used in the Word template)
  const display = await doc.embedFont(StandardFonts.TimesRomanBold);

  const invoiceNo =
    typeof input.invoiceNumber === "number"
      ? formatInvoiceNumber(input.invoiceNumber)
      : input.invoiceNumber.replace(/^#/, "").padStart(3, "0");

  const total = input.lines.reduce((sum, l) => sum + l.amount, 0);
  const left = MARGIN;
  const right = PAGE.width - MARGIN;
  const contentWidth = right - left;
  const gap = 14;
  const colW = (contentWidth - gap) / 2;

  // Page wash
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: creamSoft,
  });

  // Top gold accent
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 6,
    width: PAGE.width,
    height: 6,
    color: gold,
  });

  // —— Header: logo left, INVOICE + meta right ——
  const logo = await loadLogo(doc);
  let headerBottom = PAGE.height - 36;
  if (logo) {
    const logoW = 118;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, {
      x: left,
      y: PAGE.height - 28 - logoH,
      width: logoW,
      height: logoH,
    });
    headerBottom = PAGE.height - 28 - logoH;
  } else {
    drawText(page, "PALMWOODS PAWS", left, PAGE.height - 48, display, 18, olive);
    headerBottom = PAGE.height - 70;
  }

  const invoiceLabel = "INVOICE";
  const invoiceLabelSize = 28;
  const invoiceLabelW = bold.widthOfTextAtSize(invoiceLabel, invoiceLabelSize);
  drawText(
    page,
    invoiceLabel,
    right - invoiceLabelW,
    PAGE.height - 52,
    bold,
    invoiceLabelSize,
    olive,
  );

  let metaY = PAGE.height - 78;
  const metaRows: [string, string][] = [
    ["INVOICE #", invoiceNo],
    ["DATE", formatAuDate(input.invoiceDate)],
    ["DUE DATE", formatAuDate(input.dueDate)],
  ];
  for (const [label, value] of metaRows) {
    const labelW = bold.widthOfTextAtSize(label, 8);
    drawText(page, label, right - 150, metaY, bold, 8, gold);
    drawText(page, value, right - 150 + labelW + 8, metaY, regular, 10, ink);
    metaY -= 15;
  }

  // —— FROM | BILL TO cards ——
  let y = Math.min(headerBottom, metaY) - 28;
  const cardH = 118;
  const cardY = y - cardH;

  page.drawRectangle({
    x: left,
    y: cardY,
    width: colW,
    height: cardH,
    color: cream,
  });
  page.drawRectangle({
    x: left,
    y: cardY + cardH - 3,
    width: colW,
    height: 3,
    color: gold,
  });

  page.drawRectangle({
    x: left + colW + gap,
    y: cardY,
    width: colW,
    height: cardH,
    color: cream,
  });
  page.drawRectangle({
    x: left + colW + gap,
    y: cardY + cardH - 3,
    width: colW,
    height: 3,
    color: gold,
  });

  let fromY = cardY + cardH - 22;
  drawText(page, "FROM", left + 14, fromY, bold, 8, gold);
  fromY -= 16;
  drawText(page, INVOICE_BUSINESS.tradingName, left + 14, fromY, bold, 11, ink);
  fromY -= 14;
  drawText(page, INVOICE_BUSINESS.location, left + 14, fromY, regular, 9, muted);
  fromY -= 12;
  drawText(page, `Phone: ${INVOICE_BUSINESS.phone}`, left + 14, fromY, regular, 9, muted);
  fromY -= 12;
  drawText(page, `Email: ${INVOICE_BUSINESS.email}`, left + 14, fromY, regular, 9, muted);
  fromY -= 12;
  drawText(page, `ABN: ${INVOICE_BUSINESS.abn}`, left + 14, fromY, regular, 9, muted);

  const billX = left + colW + gap + 14;
  let billY = cardY + cardH - 22;
  drawText(page, "BILL TO", billX, billY, bold, 8, gold);
  billY -= 16;
  drawText(page, input.billTo.name || "[Client name]", billX, billY, bold, 11, ink);
  billY -= 14;
  const addressLine = [input.billTo.address, input.billTo.suburb].filter(Boolean).join(", ");
  if (addressLine) {
    for (const lineText of wrapText(addressLine, regular, 9, colW - 28)) {
      drawText(page, lineText, billX, billY, regular, 9, muted);
      billY -= 12;
    }
  } else {
    drawText(page, "[Client address]", billX, billY, regular, 9, softMuted);
    billY -= 12;
  }
  const contactBits = [input.billTo.phone, input.billTo.email].filter(Boolean).join(" / ");
  if (contactBits) {
    for (const lineText of wrapText(contactBits, regular, 9, colW - 28)) {
      drawText(page, lineText, billX, billY, regular, 9, muted);
      billY -= 12;
    }
  } else {
    drawText(page, "[Client phone / email]", billX, billY, regular, 9, softMuted);
    billY -= 12;
  }
  if (input.billTo.petName) {
    drawText(page, input.billTo.petName, billX, billY, regular, 9, muted);
  }

  // —— Line items table (template has header + several rows) ——
  y = cardY - 28;
  const dateColW = 90;
  const amountColW = 80;
  const serviceColW = contentWidth - dateColW - amountColW;
  const rowH = 26;
  const headerH = 24;
  const minRows = Math.max(5, input.lines.length);

  // Table header
  page.drawRectangle({
    x: left,
    y: y - headerH,
    width: contentWidth,
    height: headerH,
    color: olive,
  });
  drawText(page, "DATE", left + 10, y - 16, bold, 8, white);
  drawText(page, "SERVICE PROVIDED", left + dateColW + 10, y - 16, bold, 8, white);
  const amountHeader = "AMOUNT";
  drawText(
    page,
    amountHeader,
    right - 12 - bold.widthOfTextAtSize(amountHeader, 8),
    y - 16,
    bold,
    8,
    white,
  );

  y -= headerH;

  for (let i = 0; i < minRows; i++) {
    const row = input.lines[i];
    const top = y;
    page.drawRectangle({
      x: left,
      y: top - rowH,
      width: contentWidth,
      height: rowH,
      color: i % 2 === 0 ? white : rowTint,
    });
    page.drawLine({
      start: { x: left, y: top - rowH },
      end: { x: right, y: top - rowH },
      thickness: 0.5,
      color: rule,
    });

    if (row) {
      drawText(page, formatAuDate(row.date), left + 10, top - 17, regular, 9, ink);
      const desc = wrapText(row.description, regular, 9, serviceColW - 16);
      drawText(page, desc[0] ?? "", left + dateColW + 10, top - 17, regular, 9, ink);
      const amt = money(row.amount);
      drawText(
        page,
        amt,
        right - 12 - regular.widthOfTextAtSize(amt, 9),
        top - 17,
        regular,
        9,
        ink,
      );
    }
    y -= rowH;
  }

  if (input.note?.trim()) {
    y -= 10;
    drawText(page, "Note", left, y, bold, 8, muted);
    y -= 12;
    for (const nl of wrapText(input.note.trim(), regular, 9, contentWidth)) {
      drawText(page, nl, left, y, regular, 9, muted);
      y -= 12;
    }
  }

  // —— Totals (right-aligned, matches Word table 4) ——
  y -= 18;
  const totalsW = 200;
  const totalsX = right - totalsW;
  const sub = money(total);
  const tot = money(total);

  page.drawRectangle({
    x: totalsX,
    y: y - 22,
    width: totalsW,
    height: 22,
    color: cream,
  });
  drawText(page, "Subtotal", totalsX + 12, y - 15, regular, 10, muted);
  drawText(
    page,
    sub,
    right - 12 - regular.widthOfTextAtSize(sub, 10),
    y - 15,
    regular,
    10,
    ink,
  );
  y -= 22;

  page.drawRectangle({
    x: totalsX,
    y: y - 28,
    width: totalsW,
    height: 28,
    color: olive,
  });
  drawText(page, "TOTAL", totalsX + 12, y - 18, bold, 11, white);
  drawText(
    page,
    tot,
    right - 12 - bold.widthOfTextAtSize(tot, 12),
    y - 18,
    bold,
    12,
    white,
  );
  y -= 28;

  // —— PAYMENT DETAILS | PAYMENT REFERENCE (side by side) ——
  y -= 28;
  const payH = 108;
  const payY = y - payH;

  page.drawRectangle({
    x: left,
    y: payY,
    width: colW,
    height: payH,
    color: cream,
  });
  page.drawRectangle({
    x: left,
    y: payY + payH - 3,
    width: colW,
    height: 3,
    color: gold,
  });

  page.drawRectangle({
    x: left + colW + gap,
    y: payY,
    width: colW,
    height: payH,
    color: cream,
  });
  page.drawRectangle({
    x: left + colW + gap,
    y: payY + payH - 3,
    width: colW,
    height: 3,
    color: gold,
  });

  let payLeftY = payY + payH - 22;
  drawText(page, "PAYMENT DETAILS", left + 14, payLeftY, bold, 8, gold);
  payLeftY -= 16;
  drawText(page, `Bank: ${INVOICE_BUSINESS.bankName}`, left + 14, payLeftY, regular, 9, ink);
  payLeftY -= 13;
  drawText(page, `BSB: ${INVOICE_BUSINESS.bsb}`, left + 14, payLeftY, regular, 9, ink);
  payLeftY -= 13;
  drawText(
    page,
    `Account number: ${INVOICE_BUSINESS.accountNumber}`,
    left + 14,
    payLeftY,
    regular,
    9,
    ink,
  );

  const refX = left + colW + gap + 14;
  let refY = payY + payH - 22;
  drawText(page, "PAYMENT REFERENCE", refX, refY, bold, 8, gold);
  refY -= 16;
  const ref = paymentReference(input.billTo.name, invoiceNo);
  for (const lineText of wrapText(ref, bold, 10, colW - 28)) {
    drawText(page, lineText, refX, refY, bold, 10, oliveMid);
    refY -= 13;
  }
  refY -= 8;
  for (const lineText of wrapText(INVOICE_BUSINESS.thankYou, regular, 9, colW - 28)) {
    drawText(page, lineText, refX, refY, regular, 9, muted);
    refY -= 12;
  }

  // —— Footer ——
  page.drawLine({
    start: { x: left, y: MARGIN + 36 },
    end: { x: right, y: MARGIN + 36 },
    thickness: 1.5,
    color: gold,
  });
  const footer = INVOICE_BUSINESS.tagline;
  const footerW = regular.widthOfTextAtSize(footer, 9);
  drawText(page, footer, (PAGE.width - footerW) / 2, MARGIN + 18, regular, 9, softMuted);

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
