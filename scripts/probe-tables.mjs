import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const tables = [
  "profiles",
  "clients",
  "pets",
  "house_info",
  "bookings",
  "visits",
  "invoices",
  "reminders",
  "website_enquiries",
  "walks",
  "paw_reports",
  "walk_track_points",
];

for (const t of tables) {
  const { error } = await sb.from(t).select("*").limit(1);
  console.log(t, error ? `MISSING/ERR: ${error.message}` : "ok");
}
