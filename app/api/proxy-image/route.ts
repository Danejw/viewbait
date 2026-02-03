/**
 * Proxy Image API Route
 *
 * Fetches an image from an allowed URL server-side and returns base64 + mimeType.
 * Used when the client cannot fetch the URL directly (e.g. CORS, YouTube thumbnails).
 * SSRF protection: only allowlisted hosts and https (or http for localhost).
 */

import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Hosts allowed for image proxy (no trailing dots; subdomains matched via .endsWith). */
const ALLOWED_HOSTS = [
  "i.ytimg.com", // YouTube thumbnails
  "img.youtube.com",
  "localhost",
  "127.0.0.1",
];

/** Supabase storage host from env (e.g. eqxagfhgfgrcdbtmxepl.supabase.co). */
function getSupabaseStorageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return null;
  }
}

function isUrlAllowed(targetUrl: string, requestOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (parsed.protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1")
    return false;

  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h))) return true;
  const supabaseHost = getSupabaseStorageHost();
  if (supabaseHost && (host === supabaseHost || host.endsWith("." + supabaseHost))) return true;
  try {
    const originUrl = new URL(requestOrigin);
    if (originUrl.hostname.toLowerCase() === host) return true;
  } catch {
    // ignore
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const requestOrigin = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  if (!isUrlAllowed(url, requestOrigin)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ViewBait-Image-Proxy/1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const isImage =
      ALLOWED_IMAGE_TYPES.includes(contentType) ||
      contentType.startsWith("image/");
    if (!isImage) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = ALLOWED_IMAGE_TYPES.includes(contentType) ? contentType : "image/png";
    return NextResponse.json({ data: base64, mimeType: mime });
  } catch (e) {
    console.error("[proxy-image]", e);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
