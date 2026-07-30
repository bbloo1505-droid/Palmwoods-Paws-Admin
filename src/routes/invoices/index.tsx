import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { downloadStoredInvoicePdf, listInvoices, markInvoicePaid } from "@/lib/api";
import { formatInvoiceNumber } from "@/lib/invoiceBusiness";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { parseInvoiceNotes } from "@/lib/rates";
import type { Client, Invoice } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/invoices/")({
  component: InvoicesPage,
});

type InvoiceRow = Invoice & {
  client: Pick<Client, "id" | "name" | "phone" | "email" | "address" | "suburb"> | null;
};

function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const reload = async () => {
    const inv = await listInvoices();
    setRows(inv as InvoiceRow[]);
  };

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoices"));
  }, []);

  const owed = rows.filter((r) => r.status === "owed");
  const paid = rows.filter((r) => r.status === "paid");
  const outstanding = owed.reduce((sum, r) => sum + Number(r.amount), 0);

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

  const onDownloadPdf = async (inv: InvoiceRow) => {
    setPdfBusyId(inv.id);
    setError(null);
    try {
      const parsed = parseInvoiceNotes(inv.notes);
      const invoiceNumber = parsed.invoiceNumber ?? formatInvoiceNumber(1);
      const filename = `Palmwoods-Paws-Invoice-${invoiceNumber}.pdf`;
      const storedPath = inv.pdf_path || parsed.pdfPath;

      if (storedPath) {
        await downloadStoredInvoicePdf(storedPath, filename);
        return;
      }

      if (!inv.client) {
        throw new Error("Client details missing for this invoice.");
      }

      const invoiceDate =
        parsed.invoiceDateIso ??
        (inv.created_at ? inv.created_at.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
      const serviceDate = parsed.serviceDateIso ?? invoiceDate;
      const dueDate = inv.due_on ?? invoiceDate;
      const lines =
        parsed.lines.length > 0
          ? parsed.lines.map((l) => ({
              date: l.date || serviceDate,
              description: l.description,
              amount: Number(l.amount) || 0,
            }))
          : [
              {
                date: serviceDate,
                description: parsed.serviceDescription ?? "Palmwoods Paws service",
                amount: Number(inv.amount),
              },
            ];
      await downloadInvoicePdf({
        invoiceNumber,
        invoiceDate,
        dueDate,
        billTo: {
          name: inv.client.name,
          address: inv.client.address,
          suburb: inv.client.suburb,
          phone: inv.client.phone,
          email: inv.client.email,
          petName: parsed.petName,
        },
        lines,
        note: parsed.freeNote,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download PDF");
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`Outstanding ${formatMoney(outstanding)}`}
        action={
          <Link to="/invoices/new">
            <Button variant="gold">
              <Plus className="h-4 w-4" />
              New invoice
            </Button>
          </Link>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">Owed</h2>
        {owed.length === 0 ? (
          <EmptyState
            title="Nothing outstanding"
            body="Create an invoice from a client or pet profile, or tap New invoice."
            action={
              <Link to="/invoices/new">
                <Button variant="gold">Create invoice</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {owed.map((inv) => (
              <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-olive-950">
                    {inv.client?.name ?? "Client"} -+ {formatMoney(inv.amount)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted">
                    {inv.due_on ? `Due ${format(new Date(inv.due_on), "d MMM")}` : "No due date"}
                    {inv.notes
                      ? `\n${inv.notes
                          .split("\n")
                          .filter(
                            (l) =>
                              !l.startsWith("PDF_PATH:") &&
                              !l.startsWith("LINES_JSON:"),
                          )
                          .join("\n")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pdfBusyId === inv.id}
                    onClick={() => void onDownloadPdf(inv)}
                  >
                    <Download className="h-4 w-4" />
                    {pdfBusyId === inv.id ? "PDFGǪ" : "Download PDF"}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void onPaid(inv.id)}>
                    Mark paid
                  </Button>
                </div>
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
              <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-olive-950">
                    {inv.client?.name ?? "Client"} -+ {formatMoney(inv.amount)}
                  </p>
                  <p className="text-sm text-muted">
                    Paid {inv.paid_on ? format(new Date(inv.paid_on), "d MMM yyyy") : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pdfBusyId === inv.id}
                    onClick={() => void onDownloadPdf(inv)}
                  >
                    <Download className="h-4 w-4" />
                    {pdfBusyId === inv.id ? "PDFGǪ" : "Download PDF"}
                  </Button>
                  <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                    Paid
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
