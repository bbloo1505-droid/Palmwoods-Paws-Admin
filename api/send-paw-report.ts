import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

const FROM = "Palmwoods Paws <website@palmwoodspaws.com>";
const CONTACT = "contact@palmwoodspaws.com";

type Body = {
  reportId?: unknown;
  shareUrl?: unknown;
};

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const apiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY is not configured on Admin." });
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to send Paw Reports.",
    });
  }

  let body: Body;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Body;
  } catch {
    return res.status(400).json({ error: "Invalid request." });
  }

  const reportId = str(body.reportId);
  const shareUrl = str(body.shareUrl);
  if (!reportId || !shareUrl) {
    return res.status(400).json({ error: "reportId and shareUrl are required." });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: report, error } = await supabase
    .from("paw_reports")
    .select(
      `
      id,
      public_token,
      status,
      suburb,
      distance_m,
      duration_sec,
      report_body,
      pet:pets(name),
      client:clients(name, email, phone)
    `,
    )
    .eq("id", reportId)
    .single();

  if (error || !report) {
    console.error("Paw report load failed:", error);
    return res.status(404).json({ error: "Paw Report not found." });
  }

  const petName =
    (report as { pet?: { name?: string } | { name?: string }[] }).pet &&
    !Array.isArray((report as { pet?: unknown }).pet)
      ? ((report as { pet: { name?: string } }).pet.name ?? "Your dog")
      : Array.isArray((report as { pet?: { name?: string }[] }).pet)
        ? (report as { pet: { name?: string }[] }).pet[0]?.name ?? "Your dog"
        : "Your dog";

  const client = Array.isArray((report as { client?: unknown }).client)
    ? (report as { client: { name?: string; email?: string; phone?: string }[] }).client[0]
    : (report as { client?: { name?: string; email?: string; phone?: string } }).client;

  const ownerEmail = str(client?.email).toLowerCase();
  if (!ownerEmail) {
    return res.status(400).json({
      error: "This client has no email on file. Add an email on the client profile, or copy the link.",
    });
  }

  const ownerFirst = (client?.name || "there").split(/\s+/)[0] || "there";
  const mins = Math.max(1, Math.round(Number(report.duration_sec || 0) / 60));
  const km = (Number(report.distance_m || 0) / 1000).toFixed(1);
  const suburb = str(report.suburb) || "Palmwoods";

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [ownerEmail],
      replyTo: CONTACT,
      subject: `${petName}'s Paw Report is ready`,
      html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
    <div style="background:#3d4a2f;border-radius:18px 18px 0 0;padding:22px 24px;text-align:center;">
      <p style="margin:0;color:#c9a24a;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif;">Palmwoods Paws</p>
      <h1 style="margin:8px 0 0;color:#fff8ec;font-size:26px;font-weight:normal;">${escapeHtml(petName)}'s adventure is ready</h1>
    </div>
    <div style="background:#fffaf2;border-radius:0 0 18px 18px;padding:24px;border:1px solid #e8e4d9;border-top:none;font-family:Arial,sans-serif;">
      <p style="margin:0 0 14px;color:#2f3a24;font-size:16px;line-height:1.6;">
        Hi ${escapeHtml(ownerFirst)},
      </p>
      <p style="margin:0 0 14px;color:#2f3a24;font-size:16px;line-height:1.6;">
        ${escapeHtml(petName)}'s Paw Report from today's ${mins} min · ${km} km adventure around ${escapeHtml(suburb)} is ready.
      </p>
      <p style="margin:0 0 22px;text-align:center;">
        <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#c9a24a;color:#2f3a24;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;">
          View ${escapeHtml(petName)}'s Paw Report
        </a>
      </p>
      <p style="margin:0;color:#6b6a5f;font-size:14px;line-height:1.5;">
        Warm regards,<br />
        <strong style="color:#2f3a24;">Anna</strong><br />
        Palmwoods Paws
      </p>
    </div>
  </div>
</body>
</html>`,
      text: [
        `Hi ${ownerFirst},`,
        ``,
        `${petName}'s Paw Report is ready.`,
        `${mins} min · ${km} km · ${suburb}`,
        ``,
        `See today's walk: ${shareUrl}`,
        ``,
        `Anna`,
        `Palmwoods Paws`,
      ].join("\n"),
    });

    if (result.error) {
      console.error("Resend Paw Report failed:", result.error);
      return res.status(502).json({
        error: result.error.message || "Could not send email.",
      });
    }

    return res.status(200).json({
      ok: true,
      emailedTo: ownerEmail,
      emailId: result.data?.id ?? null,
      phone: client?.phone ?? null,
    });
  } catch (err) {
    console.error("Send Paw Report error:", err);
    return res.status(500).json({ error: "Something went wrong sending the Paw Report email." });
  }
}
