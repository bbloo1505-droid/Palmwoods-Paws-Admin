import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";

const BUCKET = "website-gallery";
const MANIFEST = "manifest.json";

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  storagePath?: string | null;
};

type Manifest = {
  updatedAt: string;
  photos: GalleryPhoto[];
};

const DEFAULT_PHOTOS: GalleryPhoto[] = [
  {
    id: "static-01",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/border-collie-porch-front.jpg",
    alt: "Border collie on a home porch",
  },
  {
    id: "static-02",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/border-collie-porch-head-tilt.jpg",
    alt: "Border collie looking up happily",
  },
  {
    id: "static-03",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/small-dog-grass-portrait.jpg",
    alt: "Small dog sitting on grass",
  },
  {
    id: "static-04",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/border-collie-lake-walk.jpg",
    alt: "Border collie on a lakeside walk",
  },
  {
    id: "static-05",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/small-dog-beach-sun-visor.png",
    alt: "Small dog enjoying a sunny beach outing",
  },
  {
    id: "static-06",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/border-collie-park-block.jpg",
    alt: "Border collie at the park",
  },
  {
    id: "static-07",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/border-collie-dog-menu-outing.jpg",
    alt: "Border collie on a dog-friendly outing",
  },
  {
    id: "static-08",
    url: "https://www.palmwoodspaws.com/assets/palmwoods-paws/real-dogs/gallery/dogs-shopping-outing.jpg",
    alt: "Happy dogs on a local outing",
  },
];

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function defaultManifest(): Manifest {
  return { updatedAt: new Date().toISOString(), photos: DEFAULT_PHOTOS };
}

async function ensureBucket(sb: SupabaseClient) {
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = (buckets ?? []).some((b) => b.id === BUCKET || b.name === BUCKET);
  if (!exists) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 12 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/json"],
    });
    if (error && !error.message.toLowerCase().includes("already")) {
      throw new Error(`Could not create gallery bucket: ${error.message}`);
    }
  }
}

async function readManifest(sb: SupabaseClient): Promise<Manifest> {
  const { data, error } = await sb.storage.from(BUCKET).download(MANIFEST);
  if (error || !data) return defaultManifest();
  try {
    const parsed = JSON.parse(await data.text()) as Manifest;
    if (!parsed || !Array.isArray(parsed.photos)) return defaultManifest();
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      photos: parsed.photos.filter((p) => p && p.id && p.url),
    };
  } catch {
    return defaultManifest();
  }
}

async function writeManifest(sb: SupabaseClient, manifest: Manifest) {
  const body = JSON.stringify({ ...manifest, updatedAt: new Date().toISOString() }, null, 2);
  const { error } = await sb.storage.from(BUCKET).upload(MANIFEST, body, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "60",
  });
  if (error) throw new Error(error.message);
}

function publicUrl(sb: SupabaseClient, path: string) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function extFromMime(mime: string, fallbackName = "") {
  const fromName = fallbackName.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const sb = adminClient();
  if (!sb) {
    return res.status(500).json({ error: "Supabase is not configured on Admin." });
  }

  try {
    await ensureBucket(sb);

    if (req.method === "GET") {
      let manifest = await readManifest(sb);
      // Persist defaults the first time so the website and admin share one source.
      const { data: existing } = await sb.storage.from(BUCKET).download(MANIFEST);
      if (!existing) {
        await writeManifest(sb, manifest);
        manifest = await readManifest(sb);
      }
      return res.status(200).json(manifest);
    }

    let body: Record<string, unknown> = {};
    try {
      body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) ?? {};
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }

    if (req.method === "POST") {
      const alt = typeof body.alt === "string" ? body.alt.trim() : "Local pet photo";
      const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
      const fileName = typeof body.fileName === "string" ? body.fileName : "photo.jpg";
      if (!dataUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "Choose an image to upload." });
      }
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
      if (!match) return res.status(400).json({ error: "Invalid image data." });
      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Photo is too large (max about 10MB)." });
      }

      const id = randomUUID();
      const path = `photos/${id}.${extFromMime(mime, fileName)}`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buffer, {
        contentType: mime,
        upsert: false,
        cacheControl: "3600",
      });
      if (upErr) throw new Error(upErr.message);

      const manifest = await readManifest(sb);
      manifest.photos.push({
        id,
        url: publicUrl(sb, path),
        alt: alt || "Local pet photo",
        storagePath: path,
      });
      await writeManifest(sb, manifest);
      return res.status(200).json(manifest);
    }

    if (req.method === "PATCH") {
      const action = typeof body.action === "string" ? body.action : "reorder";
      const manifest = await readManifest(sb);

      if (action === "alt") {
        const id = typeof body.id === "string" ? body.id : "";
        const alt = typeof body.alt === "string" ? body.alt.trim() : "";
        const photo = manifest.photos.find((p) => p.id === id);
        if (!photo) return res.status(404).json({ error: "Photo not found." });
        photo.alt = alt || photo.alt;
        await writeManifest(sb, manifest);
        return res.status(200).json(manifest);
      }

      const orderedIds = Array.isArray(body.orderedIds)
        ? body.orderedIds.filter((x): x is string => typeof x === "string")
        : [];
      if (!orderedIds.length) {
        return res.status(400).json({ error: "orderedIds is required." });
      }
      const map = new Map(manifest.photos.map((p) => [p.id, p]));
      const next: GalleryPhoto[] = [];
      for (const id of orderedIds) {
        const photo = map.get(id);
        if (photo) {
          next.push(photo);
          map.delete(id);
        }
      }
      // Keep any photos missing from the payload at the end
      for (const photo of map.values()) next.push(photo);
      manifest.photos = next;
      await writeManifest(sb, manifest);
      return res.status(200).json(manifest);
    }

    if (req.method === "DELETE") {
      const id =
        (typeof body.id === "string" && body.id) ||
        (typeof req.query.id === "string" ? req.query.id : "");
      if (!id) return res.status(400).json({ error: "id is required." });

      const manifest = await readManifest(sb);
      const photo = manifest.photos.find((p) => p.id === id);
      if (!photo) return res.status(404).json({ error: "Photo not found." });

      if (photo.storagePath) {
        await sb.storage.from(BUCKET).remove([photo.storagePath]);
      }
      manifest.photos = manifest.photos.filter((p) => p.id !== id);
      await writeManifest(sb, manifest);
      return res.status(200).json(manifest);
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    console.error("gallery api failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Gallery update failed.",
    });
  }
}
