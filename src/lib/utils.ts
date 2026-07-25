import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PawMood } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number | string | null | undefined) {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function makePublicToken(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Haversine distance in metres between two WGS84 points. */
export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceKm(metres: number | string | null | undefined) {
  const m = Number(metres ?? 0);
  if (!Number.isFinite(m) || m <= 0) return "0 km";
  return `${(m / 1000).toFixed(m >= 1000 ? 1 : 2)} km`;
}

export function formatDuration(seconds: number | string | null | undefined) {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const mins = Math.floor(s / 60);
  if (mins < 1) return `${s}s`;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

const MOOD_PHRASE: Record<PawMood, string> = {
  chill: "nice and chill",
  happy: "very happy",
  crazy: "in absolute chaos mode",
  energetic: "full of beans",
};

/** Lightweight local polish until a real AI provider is wired. */
export function polishPawReportCopy(input: {
  petName: string;
  suburb?: string | null;
  distanceM: number;
  durationSec: number;
  mood?: string | null;
  toiletPoo?: boolean;
  toiletWee?: boolean;
  rawNote?: string | null;
}) {
  const km = formatDistanceKm(input.distanceM);
  const mins = formatDuration(input.durationSec);
  const area = input.suburb?.trim() || "the Sunshine Coast";
  const moodKey = (input.mood as PawMood) || "happy";
  const moodPhrase = MOOD_PHRASE[moodKey] ?? "in great spirits";
  const note = (input.rawNote ?? "").trim();

  const story = note
    ? note.replace(/\s+/g, " ")
    : `${input.petName} had a wonderful time exploring ${area}.`;

  const lines = [
    `${input.petName}'s Adventure`,
    "",
    `${input.petName} was ${moodPhrase} today! We covered ${km} around ${area}. ${story}`,
    "",
    `${mins} adventure · ${km}`,
  ];

  if (input.toiletPoo || input.toiletWee) {
    lines.push("");
    if (input.toiletPoo) lines.push("Toilet break ✓");
    if (input.toiletWee) lines.push("Wee ✓");
  }

  lines.push("", `See you next adventure, ${input.petName}!`);
  return lines.join("\n");
}
