import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Preferred owner id — used when Auth allows custom ids. */
const ANNA_OWNER_ID = "a1111111-1111-4111-8111-111111111111";

const ALLOWED_EMAILS = new Set([
  "contact@palmwoodspaws.com",
  "anna@palmwoodspaws.com",
]);

const OWNER_TABLES = [
  "website_enquiries",
  "paw_reports",
  "walks",
  "invoices",
  "reminders",
  "visits",
  "bookings",
  "pets",
  "clients",
] as const;

type Body = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  bootstrapSecret?: unknown;
};

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errMessage(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim() && msg.trim() !== "{}") return msg;
  }
  try {
    const raw = JSON.stringify(error);
    if (raw && raw !== "{}") return raw;
  } catch {
    /* ignore */
  }
  return "Could not create Anna's login.";
}

async function remapOwner(sb: SupabaseClient, fromId: string, toId: string) {
  if (fromId === toId) return;

  for (const table of OWNER_TABLES) {
    const { error } = await sb.from(table).update({ owner_id: toId }).eq("owner_id", fromId);
    // Table may not exist yet (e.g. walks) — ignore missing relation
    if (error && !/schema cache|does not exist|Could not find/i.test(error.message)) {
      throw new Error(`Could not move ${table}: ${error.message}`);
    }
  }

  // Ensure new profile has Anna's details, then remove the old local profile row.
  await sb.from("profiles").upsert(
    {
      id: toId,
      full_name: "Anna",
      email: "contact@palmwoodspaws.com",
    },
    { onConflict: "id" },
  );

  const { count } = await sb
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", fromId);
  if (!count) {
    await sb.from("profiles").delete().eq("id", fromId);
  }
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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on Admin Vercel.",
    });
  }

  let body: Body;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Body;
  } catch {
    return res.status(400).json({ error: "Invalid request." });
  }

  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = str(body.fullName) || "Anna";
  const bootstrapSecret = str(body.bootstrapSecret);
  const requiredSecret = str(process.env.AUTH_BOOTSTRAP_SECRET);

  if (!email || !ALLOWED_EMAILS.has(email)) {
    return res.status(400).json({
      error: "Use contact@palmwoodspaws.com (one s in paws) for Anna's login.",
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (requiredSecret && bootstrapSecret !== requiredSecret) {
    return res.status(403).json({ error: "Bootstrap secret is incorrect." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Already bootstrapped?
  const existingFixed = await admin.auth.admin.getUserById(ANNA_OWNER_ID);
  if (existingFixed.data.user) {
    return res.status(409).json({
      error: "Anna's login already exists. Go back and sign in, or use Forgot password.",
    });
  }

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) {
    return res.status(500).json({
      error: `Auth admin not working: ${errMessage(listed.error)}. Check SUPABASE_SERVICE_ROLE_KEY on Admin Vercel.`,
    });
  }

  const emailTaken = (listed.data.users ?? []).find(
    (u) => (u.email || "").toLowerCase() === email,
  );
  if (emailTaken) {
    // User exists under a different id — remap CRM data onto that account.
    try {
      await remapOwner(admin, ANNA_OWNER_ID, emailTaken.id);
    } catch (e) {
      return res.status(500).json({ error: errMessage(e) });
    }
    return res.status(409).json({
      error: "That email already has a login. Your CRM data was linked to it — sign in instead.",
      ownerId: emailTaken.id,
    });
  }

  // Prefer keeping the stable local owner id so existing CRM rows stay put.
  let created = await admin.auth.admin.createUser({
    id: ANNA_OWNER_ID,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let ownerId = ANNA_OWNER_ID;
  let remapped = false;

  if (created.error || !created.data.user) {
    // Common when profiles row already exists and the signup trigger isn't upsert-safe.
    console.warn("Fixed-id create failed, trying without custom id:", created.error);
    created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error || !created.data.user) {
      console.error("bootstrap-auth createUser failed:", created.error);
      return res.status(500).json({
        error: errMessage(created.error),
        hint: "In Supabase SQL editor, run 20260725040000_auth_profile_upsert.sql then try again.",
      });
    }

    ownerId = created.data.user.id;
    try {
      await remapOwner(admin, ANNA_OWNER_ID, ownerId);
      remapped = true;
    } catch (e) {
      return res.status(500).json({
        error: `Login was created, but linking CRM data failed: ${errMessage(e)}`,
        ownerId,
      });
    }
  } else {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: ANNA_OWNER_ID,
        full_name: fullName,
        email,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      console.error("bootstrap-auth profile upsert failed:", profileError);
    }
  }

  return res.status(200).json({
    ok: true,
    email,
    ownerId,
    remapped,
    message: "Anna's login is ready. Sign in with this email and password.",
  });
}
