import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const BUCKET = "invoice-pdfs";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucket(sb: ReturnType<typeof serviceClient>) {
  const { data: buckets } = await sb.storage.listBuckets();
  if (!(buckets ?? []).some((b) => b.id === BUCKET || b.name === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

function bytesFromBase64(b64: string) {
  return Buffer.from(b64, "base64");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    body = {};
  }

  const action = body.action === "download" ? "download" : "save";

  try {
    const sb = serviceClient();
    await ensureBucket(sb);

    if (action === "download") {
      const path = typeof body.path === "string" ? body.path : "";
      if (!path || path.includes("..")) {
        return res.status(400).json({ error: "Valid PDF path required." });
      }
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) {
        return res.status(404).json({ error: error?.message || "PDF not found." });
      }
      const buf = Buffer.from(await data.arrayBuffer());
      const filename = path.split("/").pop() || "Palmwoods-Paws-Invoice.pdf";
      return res.status(200).json({
        ok: true,
        filename,
        pdfBase64: buf.toString("base64"),
      });
    }

    const ownerId = typeof body.ownerId === "string" ? body.ownerId : "";
    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
    const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber : "000";
    const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";

    if (!UUID_RE.test(ownerId) || !UUID_RE.test(invoiceId) || !pdfBase64) {
      return res.status(400).json({ error: "ownerId, invoiceId, and pdfBase64 are required." });
    }

    const path = `${ownerId}/${invoiceId}/invoice-${invoiceNumber}.pdf`;
    const bytes = bytesFromBase64(pdfBase64);

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: "application/pdf",
    });
    if (upErr) throw upErr;

    // Prefer dedicated column when migration is applied; fall back to notes marker.
    const { data: existing } = await sb
      .from("invoices")
      .select("id, notes")
      .eq("id", invoiceId)
      .maybeSingle();

    const notes = String(existing?.notes ?? "");
    const nextNotes = notes.includes("PDF_PATH:")
      ? notes.replace(/PDF_PATH:\S+/g, `PDF_PATH:${path}`)
      : [`PDF_PATH:${path}`, notes].filter(Boolean).join("\n");

    let invoice = null as Record<string, unknown> | null;
    const withCol = await sb
      .from("invoices")
      .update({ pdf_path: path, notes: nextNotes })
      .eq("id", invoiceId)
      .select("*")
      .maybeSingle();

    if (withCol.error) {
      const fallback = await sb
        .from("invoices")
        .update({ notes: nextNotes })
        .eq("id", invoiceId)
        .select("*")
        .single();
      if (fallback.error) throw fallback.error;
      invoice = fallback.data;
    } else {
      invoice = withCol.data;
    }

    return res.status(200).json({ ok: true, path, invoice });
  } catch (e) {
    console.error("invoice-pdf failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Invoice PDF failed.",
    });
  }
}
