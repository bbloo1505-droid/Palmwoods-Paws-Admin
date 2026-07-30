/** Palmwoods Paws invoice letterhead — matches the paper template. */

export const INVOICE_BUSINESS = {
  tradingName: "Palmwoods Paws",
  tagline: "Thoughtful care when you can't be there.",
  location: "Palmwoods, Sunshine Coast QLD",
  phone: "0407 781 752",
  email: "contact@palmwoodspaws.com",
  abn: "78 966 296 302",
  bankName: "Heritage Bank",
  bsb: "638 060",
  accountNumber: "1701 55 37",
  thankYou: "Thank you for choosing Palmwoods Paws.",
} as const;

export function formatInvoiceNumber(n: number) {
  return String(Math.max(1, Math.floor(n))).padStart(3, "0");
}

export function clientSurname(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : parts[0] || "Client";
}

export function paymentReference(clientName: string, invoiceNumber: string) {
  return `${clientSurname(clientName)} - Invoice #${invoiceNumber}`;
}

/** DD/MM/YYYY from yyyy-MM-dd or Date. */
export function formatAuDate(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatAud(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}
